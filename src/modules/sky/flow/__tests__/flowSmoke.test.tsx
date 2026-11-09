/// <reference types="jest" />
import { Text, TextInput, TouchableOpacity } from "react-native";

import { NightSkyFlowModal } from "../NightSkyFlowModal";
import { NightSkyStoryCard } from "../../render";

let mockAuth: { profile: Record<string, unknown> | null; isDemoMode: boolean };
let mockStoredPrefs: string | null = null;
let mockStar: Record<string, unknown> | undefined;
const mockPrint = jest.fn((props: Record<string, unknown>) => (void props, null));
const mockPaywall = jest.fn((props: Record<string, unknown>) => (void props, null));
const mockMap = jest.fn((props: Record<string, unknown>) => (void props, null));
const mockDemoModal = jest.fn((props: Record<string, unknown>) => (void props, null));
const mockSetItem = jest.fn(async (key: string, value: string) => void [key, value]);

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
jest.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: mockStar }) }));
jest.mock("@/modules/stars/api/starService", () => ({ getMyStarDetails: jest.fn() }));
jest.mock("@/constants/demoData", () => ({ DEMO_STAR_DETAILS: { catalog_code: "HIP-32349", custom_name: "Demo Yıldızı", magnitude: -1.46 } }));
jest.mock("../PrintSharePreview", () => ({ PrintSharePreview: (props: Record<string, unknown>) => mockPrint(props) }));
jest.mock("@/hooks/useStoryCouple", () => ({ useStoryCouple: () => ({ names: "Ada & Can", initials: "A & C", cover: null, myName: "Ada", partnerName: "Can" }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: (_target, name) => (name === "__esModule" ? false : () => null) }));
jest.mock("@/lib/storageImages", () => ({ useStorageImage: () => null }));
jest.mock("@/lib/textCase", () => ({ caseLocale: () => "tr" }));
jest.mock("@/components/memories/WashiTape", () => ({ WashiTape: () => null, WASHI_COLORS: {} }));
jest.mock("@/components/MapPickerModal", () => ({ MapPickerModal: (props: Record<string, unknown>) => mockMap(props) }));
jest.mock("@/components/share/StorySharePreview", () => ({ StorySharePreview: () => null }));
jest.mock("@/components/ui/lazyMount", () => ({
  LazyDateTimePickerSheet: () => null,
  LazyPremiumPaywall: (props: Record<string, unknown>) => mockPaywall(props),
  LazyDemoActionModal: (props: Record<string, unknown>) => mockDemoModal(props),
}));
jest.mock("@/lib/date", () => {
  jest.requireActual("dayjs/locale/tr");
  return { dayjs: jest.requireActual("dayjs") };
});
jest.mock("@/lib/safeStorage", () => ({ safeStorage: { getItem: async () => mockStoredPrefs, setItem: (key: string, value: string) => mockSetItem(key, value), removeItem: async () => {} } }));
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

/** Harita seçicinin onayını taklit eder (2. adımda). */
const pickOnMap = (location: { latitude: number; longitude: number; locationName?: string }) =>
  TestRenderer.act(() => {
    (mockMap.mock.calls.at(-1)?.[0].onSelectLocation as (value: typeof location) => void)(location);
  });

// İlk render modülleri yükler; tam paket koşusunda yük altında 5 sn aşılabiliyor
jest.setTimeout(30000);

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

  describe("demo kapısı", () => {
    async function demoPreview() {
      mockAuth = { profile: { ...PROFILE, isPremium: true }, isDemoMode: true };
      mockDemoModal.mockClear();
      mockPrint.mockClear();
      mockPaywall.mockClear();
      const { root } = await mount();
      for (let i = 0; i < 3; i++) press(buttonByLabel(root, "sky.flow.next"));
      return root;
    }

    it("baskı satırı kayıt isteği açar, baskı önizlemesi ve paywall açılmaz", async () => {
      const root = await demoPreview();
      press(buttonByLabel(root, "sky.flow.preview.print"));
      expect(mockDemoModal.mock.calls.at(-1)?.[0]).toMatchObject({ visible: true, title: "sky.flow.demoPrompt.title", description: "sky.flow.demoPrompt.description" });
      expect(mockPrint.mock.calls.every(([props]) => props.visible === false)).toBe(true);
      expect(mockPaywall.mock.calls.every(([props]) => props.visible === false)).toBe(true);
    });

    it("özel başlık alanı yoktur; satır kayıt isteği açar ve kart varsayılan başlıkla çizilir", async () => {
      const root = await demoPreview();
      expect(root.findAllByType(TextInput)).toHaveLength(0);
      expect(root.findAllByType(NightSkyStoryCard)[0].props.title).toBeNull();
      press(buttonByLabel(root, "sky.flow.preview.titleLabel"));
      expect(mockDemoModal.mock.calls.at(-1)?.[0]).toMatchObject({ visible: true });
    });

    it("kayıt için demo bitince akış kendini kapatır; üstteki modal varsa o da kapanır", async () => {
      mockAuth = { profile: PROFILE, isDemoMode: true };
      const onClose = jest.fn();
      const onLeaveForUpgrade = jest.fn();
      const tree = await mount({ onClose, onLeaveForUpgrade });
      expect(onLeaveForUpgrade).not.toHaveBeenCalled();
      mockAuth = { profile: PROFILE, isDemoMode: false };
      await TestRenderer.act(async () => {
        (tree as unknown as { update: (element: React.ReactElement) => void }).update(<NightSkyFlowModal visible onClose={onClose} onLeaveForUpgrade={onLeaveForUpgrade} />);
      });
      expect(onLeaveForUpgrade).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("demo açıkken ve demo kapandığı anda cihaz tercihlerine hiçbir şey yazılmaz", async () => {
      mockAuth = { profile: PROFILE, isDemoMode: true };
      mockSetItem.mockClear();
      const onLeaveForUpgrade = jest.fn();
      const tree = await mount({ onLeaveForUpgrade });
      for (let i = 0; i < 3; i++) press(buttonByLabel(tree.root, "sky.flow.next"));
      expect(tree.root.findAllByType(NightSkyStoryCard)[0].props.placeName).toBe("İstanbul"); // demo yeri önizlemede
      await TestRenderer.act(async () => {});
      expect(mockSetItem).not.toHaveBeenCalled();

      // Kayıt isteğinden giriş yapılınca demo biter; üstteki modal kapanmasa bile demo yeri kalıcıya sızmamalı
      mockAuth = { profile: PROFILE, isDemoMode: false };
      await TestRenderer.act(async () => {
        (tree as unknown as { update: (element: React.ReactElement) => void }).update(<NightSkyFlowModal visible onClose={() => {}} onLeaveForUpgrade={onLeaveForUpgrade} />);
      });
      await TestRenderer.act(async () => {});
      expect(onLeaveForUpgrade).toHaveBeenCalledTimes(1);
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it("önizleme ve hikâye paylaşımı açık kalır, kayıt isteği açılmaz", async () => {
      const root = await demoPreview();
      expect(root.findAllByType(NightSkyStoryCard)).toHaveLength(1);
      expect(buttonByLabel(root, "sky.flow.preview.share").props.disabled).toBe(false);
      expect(mockDemoModal).not.toHaveBeenCalled();
    });
  });

  describe("yer adı ve gizlilik (2. adım)", () => {
    const SYDNEY = { latitude: -33.8688, longitude: 151.2093 };

    async function atPlaceStep() {
      mockAuth = { profile: PROFILE, isDemoMode: false };
      const { root } = await mount();
      press(buttonByLabel(root, "sky.flow.next"));
      return root;
    }
    const toLast = (root: Root) => {
      press(buttonByLabel(root, "sky.flow.next"));
      press(buttonByLabel(root, "sky.flow.next"));
      return root.findAllByType(NightSkyStoryCard)[0].props;
    };

    afterEach(() => {
      mockStoredPrefs = null;
      mockSetItem.mockClear();
    });

    it("kayıtlı yer adı hatırlatılır; koordinat yoktur, yer yeniden seçilmeden ilerlenmez", async () => {
      mockStoredPrefs = JSON.stringify({ placeName: "Kadıköy, İstanbul", time: "21:00", timeKnown: true, title: "" });
      const root = await atPlaceStep();
      expect(buttonByLabel(root, "sky.flow.next").props.disabled).toBe(true);
      expect(root.findAllByType(TextInput)).toHaveLength(0);
      expect(texts(root)).toContain("sky.flow.place.lastPlace");
    });

    it("eski koordinatlı kayıt yüklenmez, hemen koordinatsız yeniden yazılır ve eski ad hatırlatılmaz", async () => {
      mockStoredPrefs = JSON.stringify({ place: { ...SYDNEY, name: "Moda Cd. No:12, Kadıköy, İstanbul" }, time: "21:00", timeKnown: true, title: "" });
      const root = await atPlaceStep();
      expect(buttonByLabel(root, "sky.flow.next").props.disabled).toBe(true);
      expect(texts(root)).not.toContain("sky.flow.place.lastPlace");
      // 4. adıma varılmadan, açılışta yazıldı
      const written = mockSetItem.mock.calls.at(-1)?.[1] as string;
      expect(written).toBeDefined();
      expect(written).not.toMatch(/latitude|longitude|33\.8688|151\.2093|Moda/);
    });

    it("düzenlenen ad haritadan onaylanınca (pin aynı) bozulmaz", async () => {
      const root = await atPlaceStep();
      pickOnMap({ ...SYDNEY, locationName: "Kadıköy, İstanbul" });
      TestRenderer.act(() => root.findAllByType(TextInput)[0].props.onChangeText("İlk Buluşma 2019"));
      // seçici verdiğimiz adı aynen geri verir
      expect((mockMap.mock.calls.at(-1)?.[0].initialLocation as { locationName?: string }).locationName).toBe("İlk Buluşma 2019");
      pickOnMap({ ...SYDNEY, locationName: "İlk Buluşma 2019" });
      expect(root.findAllByType(TextInput)[0].props.value).toBe("İlk Buluşma 2019");
      expect(toLast(root).placeName).toBe("İlk Buluşma 2019");
    });

    it("tam adres posterde ilçe/şehir olur ve alanda düzenlenebilir", async () => {
      const root = await atPlaceStep();
      pickOnMap({ ...SYDNEY, locationName: "Moda Caddesi No:12, Caferağa Mah., Kadıköy, İstanbul" });
      expect(root.findAllByType(TextInput)[0].props.value).toBe("Kadıköy, İstanbul");
      expect(toLast(root).placeName).toBe("Kadıköy, İstanbul");
    });

    it("kullanıcı adı değiştirirse poster onu yazar; yazarken boşluk girilebilir", async () => {
      const root = await atPlaceStep();
      pickOnMap({ ...SYDNEY, locationName: "Kadıköy, İstanbul" });
      TestRenderer.act(() => root.findAllByType(TextInput)[0].props.onChangeText("İlk Buluşma "));
      expect(root.findAllByType(TextInput)[0].props.value).toBe("İlk Buluşma ");
      expect(toLast(root).placeName).toBe("İlk Buluşma");
    });

    it("alan boşaltılırsa poster yer satırını almaz", async () => {
      const root = await atPlaceStep();
      pickOnMap({ ...SYDNEY, locationName: "Kadıköy, İstanbul" });
      TestRenderer.act(() => root.findAllByType(TextInput)[0].props.onChangeText("   "));
      expect(texts(root)).toContain("sky.flow.place.unnamedHint");
      expect(toLast(root).placeName).toBeNull();
    });

    it.each(["map.picker.selected", "map.picker.markedPoint", "map.customLocation"])("adres çözülemeyince gelen %s postere gitmez", async (locationName) => {
      const root = await atPlaceStep();
      pickOnMap({ ...SYDNEY, locationName });
      expect(root.findAllByType(TextInput)[0].props.value).toBe("");
      expect(toLast(root).placeName).toBeNull();
    });

    it("cihaza yazılan kayıtta koordinat yoktur", async () => {
      const root = await atPlaceStep();
      pickOnMap({ ...SYDNEY, locationName: "Sydney, Australia" });
      toLast(root);
      await TestRenderer.act(async () => {});
      const written = mockSetItem.mock.calls.at(-1)?.[1] as string;
      expect(written).toContain("Sydney, Australia");
      expect(written).not.toMatch(/latitude|longitude|33\.8688|151\.2093/);
    });
  });

  describe("önizleme adımı, cihazdaki tercihle (gerçek kullanıcı)", () => {
    const PREFS = JSON.stringify({ placeName: null, time: "21:00", timeKnown: false, title: "Bizim Özel Gece" });

    async function toPreview(isPremium: boolean) {
      mockStoredPrefs = PREFS;
      mockAuth = { profile: { ...PROFILE, isPremium }, isDemoMode: false };
      mockPaywall.mockClear();
      const { root } = await mount();
      press(buttonByLabel(root, "sky.flow.next"));
      pickOnMap({ latitude: -33.8688, longitude: 151.2093 });
      for (let i = 0; i < 2; i++) press(buttonByLabel(root, "sky.flow.next"));
      return root;
    }

    afterEach(() => {
      mockStoredPrefs = null;
    });

    it("yer adı yoksa kart yer satırı almaz, saat bilinmiyorsa tarih satırında saat yoktur", async () => {
      const root = await toPreview(false);
      const card = root.findAllByType(NightSkyStoryCard)[0].props;
      expect(card.placeName).toBeNull();
      expect(card.dateLine).toBe("20 Mayıs 2023");
    });

    it("ücretsiz: özel başlık kilitli, kart varsayılan başlıkla çizilir, dokununca paywall açılır", async () => {
      const root = await toPreview(false);
      expect(root.findAllByType(TextInput)).toHaveLength(0); // 4. adımda yer alanı da yok
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

    it("Premium: başlık alanı var, kayıtlı başlık karta işlenir, baskı satırı baskı önizlemesini açar", async () => {
      const root = await toPreview(true);
      expect(root.findAllByType(TextInput)).toHaveLength(1);
      expect(root.findAllByType(NightSkyStoryCard)[0].props.title).toBe("Bizim Özel Gece");
      press(buttonByLabel(root, "sky.flow.preview.print"));
      expect(mockPrint.mock.calls.at(-1)?.[0]).toMatchObject({ visible: true });
      expect(mockPaywall.mock.calls.at(-1)?.[0]).toMatchObject({ visible: false });
    });

    it("Premium bitmiş kullanıcının kayıtlı özel başlığı uygulanmaz", async () => {
      const root = await toPreview(false);
      expect(root.findAllByType(NightSkyStoryCard)[0].props.title).toBeNull();
    });

    it("yıldız yokken cümlesiz çizilir; veri gelince HIP yıldızının cümlesi eklenir", async () => {
      mockStar = undefined;
      const root = await toPreview(false);
      expect(root.findAllByType(NightSkyStoryCard)[0].props.starLine).toBeNull();
      expect(root.findAllByType(NightSkyStoryCard)[0].props.highlight).toBeUndefined();
      mockStar = { catalog_code: "VIRT-ORI-1-ABC", custom_name: "Sanal" };
      expect((await toPreview(false)).findAllByType(NightSkyStoryCard)[0].props.starLine).toBeNull();
      const polaris = { catalog_code: "HIP-11767", custom_name: "Bizim", magnitude: 1.97, ra: 37.946, dec: 89.264 };
      mockStar = polaris;
      const withStar = (await toPreview(false)).findAllByType(NightSkyStoryCard)[0].props;
      expect(withStar.starLine).toMatch(/^sky\.poster\.star\./);
      mockStar = { ...polaris, magnitude: 4 };
      expect((await toPreview(false)).findAllByType(NightSkyStoryCard)[0].props.starLine).toBeNull();
      mockStar = { ...polaris, dec: 60 };
      expect((await toPreview(false)).findAllByType(NightSkyStoryCard)[0].props.starLine).toBeNull();
      mockStar = undefined;
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
