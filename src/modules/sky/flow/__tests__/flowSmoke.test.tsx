/// <reference types="jest" />
import { Text, TextInput, TouchableOpacity } from "react-native";

import { NightSkyFlowModal } from "../NightSkyFlowModal";
import { NightSkyStoryCard } from "../../render";

let mockAuth: { profile: Record<string, unknown> | null; isDemoMode: boolean };
let mockStoredPrefs: string | null = null;
const mockPaywall = jest.fn((props: Record<string, unknown>) => (void props, null));

jest.mock("@/context/AuthContext", () => ({ useAuth: () => mockAuth }));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    isLight: false,
    theme: {
      bgGradient: ["#000", "#111"],
      cardBg: "#222",
      cardBorder: "#333",
      accent: "#D85F78",
      pillAccentBg: "#444",
      pillAccentBorder: "#555",
      text: "#fff",
      textSecondary: "#ccc",
      textMuted: "#999",
    },
  }),
}));
jest.mock("@/hooks/useStoryCouple", () => ({ useStoryCouple: () => ({ names: "Ada & Can", initials: "A & C", cover: null, myName: "Ada", partnerName: "Can" }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: (_target, name) => (name === "__esModule" ? false : () => null) }));
jest.mock("@/lib/storageImages", () => ({ useStorageImage: () => null }));
jest.mock("@/lib/textCase", () => ({ caseLocale: () => "tr" }));
jest.mock("@/components/memories/WashiTape", () => ({ WashiTape: () => null, WASHI_COLORS: {} }));
jest.mock("@/components/MapPickerModal", () => ({ MapPickerModal: () => null }));
jest.mock("@/components/share/StorySharePreview", () => ({ StorySharePreview: () => null }));
jest.mock("@/components/ui/lazyMount", () => ({ LazyDateTimePickerSheet: () => null, LazyPremiumPaywall: (props: Record<string, unknown>) => mockPaywall(props) }));
jest.mock("@/lib/date", () => {
  jest.requireActual("dayjs/locale/tr");
  return { dayjs: jest.requireActual("dayjs") };
});
jest.mock("@/lib/safeStorage", () => ({ safeStorage: { getItem: async () => mockStoredPrefs, setItem: async () => {}, removeItem: async () => {} } }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "tr" } }) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer");

type Root = { findAllByType: (type: unknown) => { props: Record<string, any> }[] };

async function mount(props: Partial<React.ComponentProps<typeof NightSkyFlowModal>> = {}) {
  let tree: { root: Root; toJSON: () => unknown };
  // Tercihler cihazdan asenkron okunur: act, bu güncellemeleri de bekler
  await TestRenderer.act(async () => {
    tree = TestRenderer.create(<NightSkyFlowModal visible onClose={() => {}} {...props} />);
  });
  return tree!;
}

const texts = (root: Root) => root.findAllByType(Text).map((node) => String(node.props.children));
const buttonByLabel = (root: Root, label: string) =>
  root.findAllByType(TouchableOpacity).find((node) => {
    const visible = (node as unknown as { findAllByType: Root["findAllByType"] }).findAllByType(Text).map((text) => String(text.props.children));
    return visible.includes(label);
  })!;
const press = (node: { props: Record<string, any> }) =>
  TestRenderer.act(() => {
    node.props.onPress();
  });

const PROFILE = { meetDate: "2023-05-20", relationshipStartDate: "2023-06-01", isPremium: false };

describe("akış duman testi", () => {
  it("kapalıyken hiçbir şey çizmez", async () => {
    mockAuth = { profile: PROFILE, isDemoMode: false };
    expect((await mount({ visible: false })).toJSON()).toBeNull();
  });

  it("1. adım üç seçeneği gösterir, tanışma günü seçili gelir, ileri açıktır", async () => {
    mockAuth = { profile: PROFILE, isDemoMode: false };
    const { root } = await mount();
    const radios = root.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityRole === "radio");
    expect(radios).toHaveLength(3);
    expect(radios[0].props.accessibilityState.selected).toBe(true);
    expect(buttonByLabel(root, "sky.flow.next").props.disabled).toBe(false);
  });

  it("tarihi olmayan seçenek pasif, ikisi de yoksa özel tarih seçilene kadar ileri kapalıdır", async () => {
    mockAuth = { profile: { isPremium: false }, isDemoMode: false };
    const { root } = await mount();
    const radios = root.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityRole === "radio");
    expect(radios.map((node) => node.props.disabled)).toEqual([true, true, false]);
    expect(buttonByLabel(root, "sky.flow.next").props.disabled).toBe(true);
  });

  it("yıldönümü girişinde sevgili olma günü ön seçili gelir", async () => {
    mockAuth = { profile: PROFILE, isDemoMode: false };
    const { root } = await mount({ initialDateChoice: "relationship" });
    const radios = root.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityRole === "radio");
    expect(radios.map((node) => node.props.accessibilityState.selected)).toEqual([false, true, false]);
  });

  it("yer seçilmeden 2. adımdan ilerlenmez", async () => {
    mockAuth = { profile: PROFILE, isDemoMode: false };
    const { root } = await mount();
    press(buttonByLabel(root, "sky.flow.next"));
    expect(texts(root)).toContain("sky.flow.place.question");
    expect(buttonByLabel(root, "sky.flow.next").props.disabled).toBe(true);
  });

  it("demo: hazır yerle dört adımı geçer ve önizlemede kart çizilir, paylaşım açıktır", async () => {
    mockAuth = { profile: { ...PROFILE, isPremium: true }, isDemoMode: true };
    const { root } = await mount();
    press(buttonByLabel(root, "sky.flow.next"));
    expect(buttonByLabel(root, "sky.flow.next").props.disabled).toBe(false);
    press(buttonByLabel(root, "sky.flow.next"));
    expect(texts(root)).toContain("sky.flow.time.question");
    press(buttonByLabel(root, "sky.flow.next"));
    expect(root.findAllByType(NightSkyStoryCard)).toHaveLength(1);
    const card = root.findAllByType(NightSkyStoryCard)[0].props;
    expect(card.dateLine).toBe("20 Mayıs 2023 · 22:00");
    expect(card.placeName).toBe("İstanbul");
    expect(card.sky.stars.length).toBeGreaterThan(0);
    expect(buttonByLabel(root, "sky.flow.preview.share").props.disabled).toBe(false);
  });

  describe("önizleme adımı, cihazdaki tercihle (gerçek kullanıcı)", () => {
    const PREFS = JSON.stringify({ place: { latitude: -33.8688, longitude: 151.2093, name: null }, time: "21:00", timeKnown: false, title: "Bizim Özel Gece" });

    async function toPreview(isPremium: boolean) {
      mockStoredPrefs = PREFS;
      mockAuth = { profile: { ...PROFILE, isPremium }, isDemoMode: false };
      mockPaywall.mockClear();
      const { root } = await mount();
      for (let i = 0; i < 3; i++) press(buttonByLabel(root, "sky.flow.next"));
      return root;
    }

    afterEach(() => {
      mockStoredPrefs = null;
    });

    it("kayıtlı yer yüklenir; yer adı yoksa kart yer satırı almaz, saat bilinmiyorsa tarih satırında saat yoktur", async () => {
      const root = await toPreview(false);
      const card = root.findAllByType(NightSkyStoryCard)[0].props;
      expect(card.placeName).toBeNull();
      expect(card.dateLine).toBe("20 Mayıs 2023");
      expect(card.southern).toBe(true); // Sidney: enlem < 0
    });

    it("ücretsiz: özel başlık kilitli, kart varsayılan başlıkla çizilir, dokununca paywall açılır", async () => {
      const root = await toPreview(false);
      expect(root.findAllByType(TextInput)).toHaveLength(0);
      expect(root.findAllByType(NightSkyStoryCard)[0].props.title).toBeNull();
      expect(mockPaywall.mock.calls.at(-1)?.[0]).toMatchObject({ visible: false, featureSource: "night_sky" });
      press(buttonByLabel(root, "sky.flow.preview.titleLabel"));
      expect(mockPaywall.mock.calls.at(-1)?.[0]).toMatchObject({ visible: true });
    });

    it("ücretsiz: baskı satırı da paywall açar", async () => {
      const root = await toPreview(false);
      press(buttonByLabel(root, "sky.flow.preview.print"));
      expect(mockPaywall.mock.calls.at(-1)?.[0]).toMatchObject({ visible: true });
    });

    it("Premium: başlık alanı var, kayıtlı başlık karta işlenir, baskı satırı geçici bilgi verir", async () => {
      const root = await toPreview(true);
      expect(root.findAllByType(TextInput)).toHaveLength(1);
      expect(root.findAllByType(NightSkyStoryCard)[0].props.title).toBe("Bizim Özel Gece");
      press(buttonByLabel(root, "sky.flow.preview.print"));
      expect(texts(root)).toContain("sky.flow.preview.printSoon");
      expect(mockPaywall.mock.calls.at(-1)?.[0]).toMatchObject({ visible: false });
    });

    it("Premium bitmiş kullanıcının kayıtlı özel başlığı uygulanmaz", async () => {
      const root = await toPreview(false);
      expect(root.findAllByType(NightSkyStoryCard)[0].props.title).toBeNull();
    });

    it("bozuk kayıt akışı çökertmez", async () => {
      mockStoredPrefs = "{bozuk";
      mockAuth = { profile: PROFILE, isDemoMode: false };
      const { root } = await mount();
      press(buttonByLabel(root, "sky.flow.next"));
      expect(buttonByLabel(root, "sky.flow.next").props.disabled).toBe(true); // yer yok
    });
  });
});
