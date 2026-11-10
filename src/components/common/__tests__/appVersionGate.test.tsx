/// <reference types="jest" />
import { AppState, Linking, Text, TouchableOpacity, type AppStateStatus } from "react-native";

import { AppVersionGate } from "../AppVersionGate";
import { useAppVersionGate } from "@/hooks/useAppVersionGate";
import {
  DEFAULT_STORE_URLS,
  GATE_CACHE_KEY,
  GATE_CHECK_INTERVAL_MS,
  GATE_LOCKED_CHECK_INTERVAL_MS,
  serializeGateCache,
  type GateDecision,
  type VersionRequirement,
} from "@/lib/appVersionGate";
import type { AppTheme } from "@/lib/theme";

/**
 * Kapının kancası ve ekranı birlikte: sunucu (supabase.rpc), depolama, cihaz sürümü, oturum ve tema taklit edilir;
 * karar modülü, kanca, kapı ve ekran gerçektir.
 */

// ─── Taklitler ───────────────────────────────────────────────────────────────

const mockRpc = jest.fn();
jest.mock("@/lib/supabase", () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

const mockStore = new Map<string, string>();
const mockStorage = {
  getItem: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    mockStore.delete(key);
    return Promise.resolve();
  }),
};
jest.mock("@/lib/safeStorage", () => ({
  safeStorage: {
    getItem: (key: string) => mockStorage.getItem(key),
    setItem: (key: string, value: string) => mockStorage.setItem(key, value),
    removeItem: (key: string) => mockStorage.removeItem(key),
  },
}));

const mockDevice = { version: "1.0.0" as string | null, build: "18" as string | null };
jest.mock("expo-application", () => ({
  __esModule: true,
  get nativeApplicationVersion() {
    return mockDevice.version;
  },
  get nativeBuildVersion() {
    return mockDevice.build;
  },
}));

const mockAuth = { isDemoMode: false };
jest.mock("@/context/AuthContext", () => ({ useAuth: () => mockAuth }));

const mockThemeState: { theme: AppTheme | null } = { theme: null };
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ theme: mockThemeState.theme, isLight: mockThemeState.theme?.isLight ?? false }),
}));

// EmptyState'in süzülme / parlama animasyonları: jest'te native worklet yok (wishlist testleriyle aynı taklit)
jest.mock("react-native-reanimated", () => {
  const { View, Text } = jest.requireActual("react-native");
  const { useState } = jest.requireActual("react");
  const shared = (initial: unknown) => {
    let current = initial;
    return { get: () => current, set: (next: unknown) => (current = next) };
  };
  const identity = (t: number) => t;
  return {
    __esModule: true,
    default: { View, Text },
    Easing: { out: () => identity, inOut: () => identity, sin: identity, quad: identity },
    useReducedMotion: () => false,
    useSharedValue: (initial: unknown) => useState(() => shared(initial))[0],
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (to: unknown) => to,
    withRepeat: (animation: unknown) => animation,
    withSequence: (...steps: unknown[]) => steps[steps.length - 1],
    cancelAnimation: () => {},
  };
});
jest.mock("@/components/ui/EmptyStateIllustrations", () => ({ EmptyIllustration: () => null }));

const mockLanguage = { current: "tr" };
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}|${JSON.stringify(options)}` : key),
    i18n: { language: mockLanguage.current },
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer");
const { act } = TestRenderer;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const themes = require("@/lib/theme") as typeof import("@/lib/theme");

const ALL_THEMES: AppTheme[] = [
  themes.FEMALE_CURRENT,
  themes.FEMALE_DARK,
  themes.FEMALE_LIGHT,
  ...themes.getAvailableThemes("male"),
];

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

const row = (overrides: Record<string, unknown> = {}) => ({
  platform: "ios",
  min_version: "1.1.0",
  min_build: null,
  store_url: DEFAULT_STORE_URLS.ios,
  message_tr: null,
  message_en: null,
  ...overrides,
});
const respond = (data: unknown) => mockRpc.mockImplementation(() => Promise.resolve({ data, error: null }));
const respondError = () =>
  mockRpc.mockImplementation(() => Promise.resolve({ data: null, error: { code: "PGRST202", message: "not found" } }));

const T0 = Date.UTC(2026, 10, 11, 12);
let now = T0;

let appStateListener: ((state: AppStateStatus) => void) | null = null;

type Renderer = { root: any; update: (el: unknown) => void; unmount: () => void };
let renderer: Renderer | null = null;

async function flush() {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function render(element: React.ReactElement) {
  await act(async () => {
    renderer = TestRenderer.create(element);
  });
  await flush();
  return renderer!;
}

async function foreground(advanceMs: number) {
  now += advanceMs;
  await act(async () => appStateListener?.("active"));
  await flush();
}

function cache(requirement: VersionRequirement | null, savedAt = T0 - 1000) {
  mockStore.set(GATE_CACHE_KEY, serializeGateCache("ios", requirement, savedAt));
}

const requirement = (overrides: Partial<VersionRequirement> = {}): VersionRequirement => ({
  minVersion: "1.1.0",
  minBuild: null,
  storeUrl: null,
  messageTr: null,
  messageEn: null,
  ...overrides,
});

/** Kancanın son kararını okuyan sonda */
let lastDecision: GateDecision | null = null;
const recordDecision = (decision: GateDecision) => {
  lastDecision = decision;
};
function HookProbe({ onDecision }: { onDecision: (decision: GateDecision) => void }) {
  onDecision(useAppVersionGate(mockAuth.isDemoMode));
  return null;
}
const Probe = () => <HookProbe onDecision={recordDecision} />;

const Child = () => <Text testID="app-content">uygulama</Text>;
const gateTree = () => (
  <AppVersionGate>
    <Child />
  </AppVersionGate>
);

const isLocked = () => renderer!.root.findAll((n: any) => n.props.testID === "force-update-screen").length > 0;
const hasContent = () => renderer!.root.findAll((n: any) => n.props.testID === "app-content").length > 0;
const texts = () =>
  renderer!.root.findAllByType(Text).map((n: any) => [n.props.children].flat().join(""));

beforeEach(() => {
  mockRpc.mockReset();
  mockStore.clear();
  mockStorage.getItem.mockClear();
  mockStorage.setItem.mockClear();
  mockStorage.removeItem.mockClear();
  mockDevice.version = "1.0.0";
  mockDevice.build = "18";
  mockAuth.isDemoMode = false;
  mockLanguage.current = "tr";
  mockThemeState.theme = themes.FEMALE_CURRENT;
  lastDecision = null;
  now = T0;
  jest.spyOn(Date, "now").mockImplementation(() => now);
  appStateListener = null;
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_type: string, listener: (s: AppStateStatus) => void) => {
    appStateListener = listener;
    return { remove: () => (appStateListener = null) };
  }) as any);
});

afterEach(() => {
  if (renderer) act(() => renderer!.unmount());
  renderer = null;
  jest.restoreAllMocks();
});

// ─── Kanca ───────────────────────────────────────────────────────────────────

describe("useAppVersionGate", () => {
  it("açılışta platformla bir kez sorar", async () => {
    respond(row({ min_version: null }));
    await render(<Probe />);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("get_app_version_requirement", { p_platform: "ios" });
    expect(lastDecision).toEqual({ locked: false, reason: "no-requirement" });
  });

  it("sorgu hata verirse (önbellek yok) kapı açık", async () => {
    respondError();
    await render(<Probe />);
    expect(lastDecision?.locked).toBe(false);
    expect(mockStorage.setItem).not.toHaveBeenCalled();
  });

  it("ağ hatasında (önbellek yok) kapı açık", async () => {
    mockRpc.mockImplementation(() => Promise.reject(new TypeError("Network request failed")));
    await render(<Probe />);
    expect(lastDecision?.locked).toBe(false);
  });

  it("bozuk yanıtta (önbellek yok) kapı açık", async () => {
    respond(["1.1.0"]);
    await render(<Probe />);
    expect(lastDecision?.locked).toBe(false);
  });

  it("eşik altında kapanır ve son başarılı yanıtı saklar", async () => {
    respond(row());
    await render(<Probe />);
    expect(lastDecision).toMatchObject({ locked: true, reason: "below-min-version", storeUrl: DEFAULT_STORE_URLS.ios });
    expect(JSON.parse(mockStore.get(GATE_CACHE_KEY)!)).toMatchObject({
      v: 1,
      platform: "ios",
      requirement: { minVersion: "1.1.0" },
    });
  });

  it("eşik düşürülünce (geri alma) kapalıyken kısa aralıkla yeniden sorar ve açılır", async () => {
    respond(row());
    await render(<Probe />);
    expect(lastDecision?.locked).toBe(true);

    respond(row({ min_version: null }));
    await foreground(GATE_LOCKED_CHECK_INTERVAL_MS - 1);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(lastDecision?.locked).toBe(true);

    await foreground(1);
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(lastDecision?.locked).toBe(false);
    expect(JSON.parse(mockStore.get(GATE_CACHE_KEY)!).requirement).toMatchObject({ minVersion: null });
  });

  it("eşik yükseltilince açıkken en sık 15 dakikada bir sorar, sonra kapanır", async () => {
    respond(row({ min_version: null }));
    await render(<Probe />);
    expect(lastDecision?.locked).toBe(false);

    respond(row());
    await foreground(GATE_CHECK_INTERVAL_MS - 1);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(lastDecision?.locked).toBe(false);

    await foreground(1);
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(lastDecision?.locked).toBe(true);
  });

  it("arka plana geçiş sorgu tetiklemez", async () => {
    respond(null);
    await render(<Probe />);
    now += GATE_CHECK_INTERVAL_MS * 2;
    await act(async () => appStateListener?.("background"));
    await act(async () => appStateListener?.("inactive"));
    await flush();
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it("bir kez zorunlu görülen sürüm çevrimdışıyken (sorgu başarısız) kilitli kalır", async () => {
    cache(requirement());
    mockRpc.mockImplementation(() => Promise.reject(new TypeError("Network request failed")));
    await render(<Probe />);
    expect(lastDecision).toMatchObject({ locked: true, reason: "below-min-version" });
  });

  it("önbellek kilitliyken sunucu 'koşul yok' derse açılır", async () => {
    cache(requirement());
    respond(null);
    await render(<Probe />);
    expect(lastDecision?.locked).toBe(false);
  });

  it("önbellek kilitli ama cihaz artık eşiği geçiyorsa (güncellenmiş) açılır", async () => {
    cache(requirement());
    mockDevice.version = "1.1.0";
    respondError();
    await render(<Probe />);
    expect(lastDecision).toEqual({ locked: false, reason: "up-to-date" });
  });

  it("bozuk önbellek kapıyı kapatmaz ve silinir", async () => {
    mockStore.set(GATE_CACHE_KEY, "{bozuk");
    respondError();
    await render(<Probe />);
    expect(lastDecision?.locked).toBe(false);
    expect(mockStorage.removeItem).toHaveBeenCalledWith(GATE_CACHE_KEY);
  });

  it("30 günden eski kilit önbelleği kullanılmaz", async () => {
    cache(requirement(), T0 - 31 * 24 * 3600 * 1000);
    respondError();
    await render(<Probe />);
    expect(lastDecision?.locked).toBe(false);
  });

  it("başka platformun önbelleği kullanılmaz", async () => {
    mockStore.set(GATE_CACHE_KEY, serializeGateCache("android", requirement(), T0));
    respondError();
    await render(<Probe />);
    expect(lastDecision?.locked).toBe(false);
  });

  it("zaman aşımında (önbellek yok) kapı açık kalır", async () => {
    jest.useFakeTimers({ doNotFake: ["Date"] });
    try {
      mockRpc.mockImplementation(() => new Promise(() => {}));
      await act(async () => {
        renderer = TestRenderer.create(<Probe />);
      });
      await act(async () => {
        jest.advanceTimersByTime(8000);
      });
      expect(lastDecision?.locked).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it("demo modunda eşik altında bile kapı uygulanmaz", async () => {
    mockAuth.isDemoMode = true;
    cache(requirement());
    respond(row({ min_version: "99.0.0" }));
    await render(<Probe />);
    expect(lastDecision).toEqual({ locked: false, reason: "demo" });
  });

  it("aynı görünen sürümde eski build kapanır (min_build)", async () => {
    mockDevice.version = "1.1.0";
    mockDevice.build = "19";
    respond(row({ min_version: "1.1.0", min_build: 20 }));
    await render(<Probe />);
    expect(lastDecision).toMatchObject({ locked: true, reason: "below-min-build" });
  });

  it("cihaz sürümü okunamıyorsa kapı açık", async () => {
    mockDevice.version = null;
    respond(row({ min_version: "99.0.0" }));
    await render(<Probe />);
    expect(lastDecision).toEqual({ locked: false, reason: "device-version-unknown" });
  });
});

// ─── Kapı ve ekran ───────────────────────────────────────────────────────────

describe("AppVersionGate + ForceUpdateScreen", () => {
  it("açıkken uygulamayı olduğu gibi çizer", async () => {
    respond(row({ min_version: "1.0.0" }));
    await render(gateTree());
    expect(hasContent()).toBe(true);
    expect(isLocked()).toBe(false);
  });

  it("sorgu hata verince uygulama açık", async () => {
    respondError();
    await render(gateTree());
    expect(hasContent()).toBe(true);
    expect(isLocked()).toBe(false);
  });

  it("eşik altında uygulamanın yerine ekran çizilir; kapatma düğmesi yok, tek düğme mağaza", async () => {
    respond(row());
    await render(gateTree());
    expect(isLocked()).toBe(true);
    expect(hasContent()).toBe(false);
    const buttons = renderer!.root.findAllByType(TouchableOpacity);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].props.accessibilityLabel).toBe("forceUpdate.cta");
    expect(texts()).toContain("forceUpdate.title");
  });

  it("düğme sunucudaki mağaza adresine gider", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    respond(row({ store_url: "https://apps.apple.com/tr/app/id6829036716" }));
    await render(gateTree());
    await act(async () => renderer!.root.findByType(TouchableOpacity).props.onPress());
    expect(openURL).toHaveBeenCalledWith("https://apps.apple.com/tr/app/id6829036716");
  });

  it("sunucu adresi yoksa ya da geçersizse yerel mağaza adresine gider", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    respond(row({ store_url: "https://evil.example/app" }));
    await render(gateTree());
    await act(async () => renderer!.root.findByType(TouchableOpacity).props.onPress());
    expect(openURL).toHaveBeenCalledWith(DEFAULT_STORE_URLS.ios);
  });

  it("mağaza açılamazsa ekranda kalır ve yol gösterir", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no handler"));
    respond(row());
    await render(gateTree());
    await act(async () => renderer!.root.findByType(TouchableOpacity).props.onPress());
    expect(isLocked()).toBe(true);
    expect(texts().some((t: string) => t.startsWith("forceUpdate.storeError"))).toBe(true);
  });

  it("sunucu metni varsa onu, yoksa yerel metni gösterir (dile göre)", async () => {
    respond(row({ message_tr: "Yeni sürüm hazır, hemen güncelle.", message_en: "Update now." }));
    await render(gateTree());
    expect(texts()).toContain("Yeni sürüm hazır, hemen güncelle.");
    act(() => renderer!.unmount());

    mockLanguage.current = "en";
    await render(gateTree());
    expect(texts()).toContain("Update now.");
    act(() => renderer!.unmount());

    respond(row({ message_tr: null, message_en: "Update now." }));
    mockLanguage.current = "tr";
    await render(gateTree());
    expect(texts().some((t: string) => t.startsWith("forceUpdate.message"))).toBe(true);
  });

  it("yüklü sürümü gösterir", async () => {
    respond(row());
    await render(gateTree());
    expect(texts()).toContain('forceUpdate.installedVersion|{"version":"1.0.0"}');
  });

  it("eşik yükselince ekran açılır, düşünce uygulama geri gelir", async () => {
    respond(row({ min_version: null }));
    await render(gateTree());
    expect(hasContent()).toBe(true);

    respond(row());
    await foreground(GATE_CHECK_INTERVAL_MS);
    expect(isLocked()).toBe(true);
    expect(hasContent()).toBe(false);

    respond(row({ min_version: null }));
    await foreground(GATE_LOCKED_CHECK_INTERVAL_MS);
    expect(isLocked()).toBe(false);
    expect(hasContent()).toBe(true);
  });

  it("demo modunda ekran hiç çıkmaz", async () => {
    mockAuth.isDemoMode = true;
    respond(row({ min_version: "99.0.0" }));
    await render(gateTree());
    expect(hasContent()).toBe(true);
    expect(isLocked()).toBe(false);
  });

  it.each(ALL_THEMES.map((theme) => [`${theme.gender}/${theme.id}`, theme] as const))(
    "%s temasında yalnızca tema token'larıyla çizilir",
    async (_label, theme) => {
      mockThemeState.theme = theme;
      respond(row());
      await render(gateTree());
      const screen = renderer!.root.find((n: any) => n.props.testID === "force-update-screen");
      expect(screen.props.colors).toEqual(theme.bgGradient);
      const title = renderer!.root.findAllByType(Text).find((n: any) => n.props.children === "forceUpdate.title");
      expect([title.props.style].flat(3)).toEqual(expect.arrayContaining([expect.objectContaining({ color: theme.text })]));
      const version = renderer!.root
        .findAllByType(Text)
        .find((n: any) => String(n.props.children).startsWith("forceUpdate.installedVersion"));
      expect([version.props.style].flat(3)).toEqual(expect.arrayContaining([expect.objectContaining({ color: theme.textMuted })]));
      const button = renderer!.root.findByType(TouchableOpacity);
      expect([button.props.style].flat(3)).toEqual(expect.arrayContaining([expect.objectContaining({ backgroundColor: theme.accent })]));
    }
  );
});
