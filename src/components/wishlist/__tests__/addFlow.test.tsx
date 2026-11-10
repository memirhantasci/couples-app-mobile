/// <reference types="jest" />
import { TextInput, TouchableOpacity } from "react-native";

import WishlistScreen from "@/app/(tabs)/wishlist";
import type { WishlistItem } from "@/lib/wishlist";

/**
 * Ayrıntılı ekleme akışı, gerçek ekran (wishlist.tsx) + gerçek hızlı ekleme çubuğu + gerçek pencere ile.
 * Yalnızca kenar bağımlılıklar (veri hook'u, tema, oturum, diyalog, harita) taklit edilir.
 * Bileşenler adlarıyla bulunur (import edilmez): eski kodda dosya yüklenir, eksik davranış test başına kırılır.
 */

const ME = "user-me";

const mockState = {
  openItems: [] as WishlistItem[],
  offline: false,
  addItem: jest.fn(),
  saveItem: jest.fn(),
};
const mockAlert = jest.fn();
const mockToast = { warning: jest.fn(), error: jest.fn(), success: jest.fn() };

jest.mock("@/hooks/useWishlist", () => ({
  useWishlist: () => ({
    openItems: mockState.openItems,
    doneItems: [],
    doneTotal: 0,
    doneHasMore: false,
    loadMoreDone: jest.fn(),
    isLoadingMoreDone: false,
    isLoaded: true,
    isError: false,
    isPaused: false,
    done: { isInitialLoading: false, isSwitching: false, isError: false, isPaused: false, retry: jest.fn() },
    refetch: jest.fn(),
    toggleWant: jest.fn(),
    toggleDone: jest.fn(),
    addItem: mockState.addItem,
    saveItem: mockState.saveItem,
    removeItem: jest.fn(),
  }),
}));
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    session: { user: { id: "user-me" } },
    profile: { coupleId: 5, isPaired: true, isPremium: false, displayName: "Ben" },
    isDemoMode: false,
    refreshProfile: () => Promise.resolve(),
  }),
}));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    isLight: false,
    theme: {
      isLight: false,
      bgGradient: ["#000000", "#111111"],
      cardBg: "#222",
      cardShadow: {},
      accent: "#D85F78",
      pillAccentBg: "#444",
      pillAccentBorder: "#555",
      inputBg: "#111",
      inputBorder: "#333",
      text: "#fff",
      textSecondary: "#ccc",
      textMuted: "#999",
    },
  }),
}));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "tr" } }) }));
jest.mock("@/lib/i18n", () => ({ __esModule: true, default: { language: "tr", t: (key: string) => key } }));
// Reanimated jest'te yerel modül ister: açılır kapanır çubuk (Collapse) ve kart için en küçük taklit
jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  const { useState } = jest.requireActual("react");
  const shared = (initial: unknown) => {
    let current = initial;
    return { get: () => current, set: (next: unknown) => (current = next) };
  };
  return {
    __esModule: true,
    default: { View },
    Easing: { out: () => (t: number) => t, cubic: (t: number) => t },
    useReducedMotion: () => false,
    useSharedValue: (initial: unknown) => useState(() => shared(initial))[0],
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (to: unknown) => to,
    withSequence: (...steps: unknown[]) => steps[steps.length - 1],
  };
});
jest.mock("lucide-react-native", () => new Proxy({}, { get: (_target, name) => (name === "__esModule" ? false : () => null) }));
jest.mock("expo-router", () => ({ Redirect: () => null, router: { push: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("react-native-keyboard-aware-scroll-view", () => ({
  KeyboardAwareScrollView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/lib/soloGate", () => ({
  useSoloGate: () => ({ isSolo: false, blockPartnerFeature: () => false }),
  showPartnerRequired: jest.fn(),
  showSoloPremiumRequired: jest.fn(),
}));
jest.mock("@/hooks/useIsOffline", () => ({ useIsOffline: () => mockState.offline }));
jest.mock("@/hooks/useDemoAction", () => ({
  useDemoAction: () => ({
    executeOrIntercept: () => false,
    isDemoModalOpen: false,
    setIsDemoModalOpen: jest.fn(),
    modalConfig: { title: "", description: "" },
  }),
}));
jest.mock("@/hooks/usePageTour", () => ({
  usePageTour: () => ({ isTourVisible: false, guide: null, openTour: jest.fn(), closeTour: jest.fn() }),
}));
jest.mock("@/hooks/useCoupleAvatars", () => ({ useCoupleAvatars: () => ({ getAvatarUrl: () => null, partnerAvatarUrl: null }) }));
jest.mock("@/hooks/usePullToRefresh", () => ({ usePullToRefresh: () => ({ refreshing: false, onRefresh: jest.fn() }) }));
jest.mock("@/lib/dialog", () => ({ appAlert: (...args: unknown[]) => mockAlert(...args) }));
jest.mock("@/lib/toast", () => ({
  get toast() {
    return mockToast;
  },
}));
jest.mock("@/lib/soundEffects", () => ({ hapticSelection: jest.fn(), playBubblePop: jest.fn(), playSuccessChime: jest.fn() }));
jest.mock("@/lib/wishlistAvailability", () => ({ canOpenWishlist: () => true, wishlistDataNotice: () => null }));
jest.mock("@/components/ui/EmptyState", () => ({ EmptyState: () => null }));
jest.mock("@/components/ui/Reveal", () => ({ Reveal: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/components/ui/ScreenBackground", () => ({
  ScreenBackground: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/ui/ScreenHeader", () => ({ ScreenHeader: () => null }));
jest.mock("@/components/ui/Skeleton", () => ({ Skeleton: () => null }));
jest.mock("@/components/ui/DialogHost", () => ({ DialogHost: () => null }));
jest.mock("@/components/ui/lazyMount", () => ({
  LazyDemoActionModal: () => null,
  LazyPageTourModal: () => null,
  LazyPremiumPaywall: function PaywallStub() {
    return null;
  },
}));
jest.mock("@/components/MapPickerModal", () => ({
  MapPickerModal: function MapPickerStub() {
    return null;
  },
}));
jest.mock("@/components/avatar/UserAvatar", () => ({ UserAvatar: () => null }));
jest.mock("@/components/common/SoloFeatureBanner", () => ({ SoloFeatureBanner: () => null }));
jest.mock("@/components/wishlist/BothWantSection", () => ({ BothWantSection: () => null }));
jest.mock("@/components/wishlist/PickerSheet", () => ({ PickerSheet: () => null }));
jest.mock("@/components/wishlist/WishlistIdeas", () => ({ WishlistIdeas: () => null }));
jest.mock("@/components/wishlist/WishlistItemCard", () => ({ WishlistItemCard: () => null }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer");
const { act } = TestRenderer;

type Node = {
  type: unknown;
  props: Record<string, any>;
  findAll: (predicate: (node: Node) => boolean) => Node[];
  findAllByType: (type: unknown) => Node[];
};

function item(id: number, overrides: Partial<WishlistItem> = {}): WishlistItem {
  return {
    id,
    couple_id: 5,
    created_by: ME,
    title: `Madde ${id}`,
    note: null,
    category: "other",
    location_name: null,
    latitude: null,
    longitude: null,
    status: "open",
    done_at: null,
    done_by: null,
    created_at: new Date(Date.UTC(2026, 0, id)).toISOString(),
    updated_at: "2026-01-01T00:00:00.000Z",
    wants: [ME],
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const CAPPADOCIA = { latitude: 38.64, longitude: 34.83, locationName: "Göreme" };
const nameOf = (type: unknown) => (typeof type === "function" ? type.name : "");
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));

let renderer: { root: Node; update: (element: unknown) => void; unmount: () => void } | null = null;

function render() {
  act(() => {
    renderer = TestRenderer.create(<WishlistScreen />);
  });
  return renderer!.root;
}
const rerender = () => act(() => renderer!.update(<WishlistScreen />));

const byName = (root: Node, name: string) => {
  const found = root.findAll((node) => nameOf(node.type) === name);
  if (found.length === 0) throw new Error(`${name} bulunamadı`);
  return found[0];
};
const touchable = (scope: Node, label: string) => {
  const found = scope.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityLabel === label);
  if (found.length === 0) throw new Error(`"${label}" düğmesi bulunamadı`);
  return found[0];
};
const input = (scope: Node, label: string) => {
  const found = scope.findAllByType(TextInput).filter((node) => node.props.accessibilityLabel === label);
  if (found.length === 0) throw new Error(`"${label}" alanı bulunamadı`);
  return found[0];
};
const selectedChip = (scope: Node) =>
  scope
    .findAllByType(TouchableOpacity)
    .filter((node) => node.props.accessibilityState?.selected === true)
    .map((node) => node.props.accessibilityLabel);

const bar = (root: Node) => byName(root, "QuickAddBar");
const sheet = (root: Node) => byName(root, "WishlistItemSheet");
const sheetOpen = (root: Node) => sheet(root).props.request !== null;
const paywallVisible = (root: Node) => byName(root, "PaywallStub").props.visible === true;
const DETAILS = "wishlist.quick.details, wishlist.quick.detailsHint";

/**
 * Çubuğa odaklanır (kategori çipleri ve "Ayrıntı ekle" yalnızca odakta ya da yazı varken görünür), başlık yazar,
 * kategori seçer, "Ayrıntı ekle"ye basar.
 */
function openDetails(root: Node, title: string, category?: string) {
  act(() => input(bar(root), "wishlist.quick.placeholder").props.onFocus());
  act(() => input(bar(root), "wishlist.quick.placeholder").props.onChangeText(title));
  if (category) act(() => touchable(bar(root), `wishlist.categories.${category}`).props.onPress());
  act(() => touchable(bar(root), DETAILS).props.onPress());
}

beforeEach(() => {
  mockState.openItems = [item(1)];
  mockState.offline = false;
  mockState.addItem.mockReset().mockResolvedValue("ok");
  mockState.saveItem.mockReset().mockResolvedValue("ok");
  mockAlert.mockReset();
  Object.values(mockToast).forEach((fn) => fn.mockReset());
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
});

describe("ayrıntılı ekleme: çubuk → pencere", () => {
  it("(b) çubuktaki başlık ve seçili kategori pencereye taşınır; pencere ekleme modunda açılır", () => {
    const root = render();
    expect(sheetOpen(root)).toBe(false);
    openDetails(root, "Kapadokya", "travel");

    expect(sheet(root).props.request).toEqual({ mode: "create", title: "Kapadokya", category: "travel" });
    expect(input(sheet(root), "wishlist.edit.titleLabel").props.value).toBe("Kapadokya");
    expect(selectedChip(sheet(root))).toEqual(["wishlist.categories.travel"]);
    // Not ve konum boş başlar; kaydet düğmesi "ekle" der
    expect(input(sheet(root), "wishlist.edit.noteLabel").props.value).toBe("");
    expect(input(sheet(root), "wishlist.edit.locationLabel").props.value).toBe("");
    expect(touchable(sheet(root), "wishlist.create.cta")).toBeTruthy();
  });

  it("(b) kategori seçilmediyse pencerede 'Diğer' seçili gelir (hızlı eklemedeki varsayılan)", () => {
    const root = render();
    openDetails(root, "");
    expect(input(sheet(root), "wishlist.edit.titleLabel").props.value).toBe("");
    expect(selectedChip(sheet(root))).toEqual(["wishlist.categories.other"]);
  });

  it("(a) not ve haritadan seçilen konumla tek INSERT yapılır; pencere kapanır, çubuk sıfırlanır", async () => {
    const root = render();
    openDetails(root, "Kapadokya", "travel");
    act(() => input(sheet(root), "wishlist.edit.noteLabel").props.onChangeText("  Balon turu  "));
    act(() => byName(sheet(root), "MapPickerStub").props.onSelectLocation(CAPPADOCIA));
    expect(input(sheet(root), "wishlist.edit.locationLabel").props.value).toBe("Göreme");

    await act(async () => touchable(sheet(root), "wishlist.create.cta").props.onPress());
    await flush();

    expect(mockState.addItem).toHaveBeenCalledTimes(1);
    expect(mockState.addItem).toHaveBeenCalledWith({
      title: "Kapadokya",
      note: "Balon turu",
      category: "travel",
      location_name: "Göreme",
      latitude: 38.64,
      longitude: 34.83,
    });
    expect(sheetOpen(root)).toBe(false);
    expect(input(bar(root), "wishlist.quick.placeholder").props.value).toBe("");
    expect(selectedChip(bar(root))).toEqual([]);
  });

  it("(c) iptalde (kapat düğmesi ya da geri tuşu) çubuktaki yazı ve kategori kaybolmaz, hiçbir şey eklenmez", async () => {
    const root = render();
    openDetails(root, "Kapadokya", "travel");
    // Pencerede değiştirilen başlık çubuğa yazılmaz: iptal, pencereden önceki hâle döner
    act(() => input(sheet(root), "wishlist.edit.titleLabel").props.onChangeText("Başka bir şey"));
    act(() => touchable(sheet(root), "a11y.close").props.onPress());
    await flush();

    expect(sheetOpen(root)).toBe(false);
    expect(input(bar(root), "wishlist.quick.placeholder").props.value).toBe("Kapadokya");
    expect(selectedChip(bar(root))).toEqual(["wishlist.categories.travel"]);

    // Android geri tuşu (Modal onRequestClose) da aynı
    act(() => touchable(bar(root), DETAILS).props.onPress());
    expect(sheetOpen(root)).toBe(true);
    act(() => sheet(root).findAll((node) => node.props.onRequestClose && node.props.animationType === "slide")[0].props.onRequestClose());
    await flush();
    expect(sheetOpen(root)).toBe(false);
    expect(input(bar(root), "wishlist.quick.placeholder").props.value).toBe("Kapadokya");
    expect(mockState.addItem).not.toHaveBeenCalled();
  });

  it("(c) kapatınca pencere aşağı kayarken içi boşalmaz; yeniden açılınca form baştan kurulur", async () => {
    const root = render();
    openDetails(root, "Kapadokya", "travel");
    act(() => input(sheet(root), "wishlist.edit.titleLabel").props.onChangeText("Başka bir şey"));
    act(() => touchable(sheet(root), "a11y.close").props.onPress());
    await flush();

    // Modal görünmez oldu ama içine form verilmeye devam eder: gerçek Modal kapanış animasyonu bitene kadar
    // içini çizer, form boşalsaydı pencere aşağı kaymadan bir anda kaybolurdu. (Jest'in Modal taklidi görünmez
    // pencerenin içini çizmez; bu yüzden Modal'a verilen içerik denetlenir.)
    const modal = sheet(root).findAll((node) => node.props.animationType === "slide")[0];
    expect(modal.props.visible).toBe(false);
    const forms = [modal.props.children].flat().filter((child) => nameOf(child?.type) === "SheetForm");
    expect(forms.map((form) => form.props.request)).toEqual([{ mode: "create", title: "Kapadokya", category: "travel" }]);

    // Yeniden açılış eski taslağı getirmez: çubuktaki başlıkla yeni form
    act(() => touchable(bar(root), DETAILS).props.onPress());
    expect(modal.props.visible).toBe(true);
    expect(input(sheet(root), "wishlist.edit.titleLabel").props.value).toBe("Kapadokya");
  });

  it("(c) ekleme hata verirse pencere açık kalır, hata pencerede söylenir, çubuk korunur", async () => {
    mockState.addItem.mockResolvedValue("network");
    const root = render();
    openDetails(root, "Kapadokya");
    await act(async () => touchable(sheet(root), "wishlist.create.cta").props.onPress());
    await flush();

    expect(sheetOpen(root)).toBe(true);
    expect(mockAlert).toHaveBeenCalledWith("common.error", "wishlist.errors.network");
    expect(input(bar(root), "wishlist.quick.placeholder").props.value).toBe("Kapadokya");
  });
});

describe("ayrıntılı ekleme: sınır (15) ve kapılar", () => {
  const full = () => Array.from({ length: 15 }, (_, i) => item(i + 1));

  it("(d) sınır doluyken 'Ayrıntı ekle' pencereyi açmaz, paywall açılır, sunucuya gidilmez", () => {
    mockState.openItems = full();
    const root = render();
    act(() => input(bar(root), "wishlist.quick.placeholder").props.onChangeText("Kapadokya"));
    act(() => touchable(bar(root), "wishlist.quick.limitA11y").props.onPress());
    // Sınırda "Ayrıntı ekle" de paywall'a gider
    const details = bar(root)
      .findAllByType(TouchableOpacity)
      .filter((node) => node.props.accessibilityLabel === "wishlist.quick.limitA11y");
    expect(details.length).toBe(2);
    act(() => details[1].props.onPress());

    expect(sheetOpen(root)).toBe(false);
    expect(paywallVisible(root)).toBe(true);
    expect(mockState.addItem).not.toHaveBeenCalled();
  });

  it("(d) pencere açıkken liste dolarsa kayıt sunucuya gitmez; pencere kapanır, ardından paywall açılır", async () => {
    mockState.openItems = Array.from({ length: 14 }, (_, i) => item(i + 1));
    const root = render();
    openDetails(root, "Kapadokya");
    // Partner bu arada bir madde ekledi
    mockState.openItems = full();
    rerender();
    await act(async () => touchable(sheet(root), "wishlist.create.cta").props.onPress());
    await flush();

    expect(mockState.addItem).not.toHaveBeenCalled();
    expect(sheetOpen(root)).toBe(false);
    // iOS iki Modal'ı aynı anda sunamaz: paywall pencerenin kapanışından sonra açılır
    expect(paywallVisible(root)).toBe(false);
    await wait(500);
    expect(paywallVisible(root)).toBe(true);
    expect(input(bar(root), "wishlist.quick.placeholder").props.value).toBe("Kapadokya");
  });

  it("(d) sunucu P0022 (limit) dönerse pencere kapanır, paywall açılır, çubuk korunur", async () => {
    mockState.addItem.mockResolvedValue("limit");
    const root = render();
    openDetails(root, "Kapadokya");
    await act(async () => touchable(sheet(root), "wishlist.create.cta").props.onPress());
    await wait(500);

    expect(mockState.addItem).toHaveBeenCalledTimes(1);
    expect(sheetOpen(root)).toBe(false);
    expect(paywallVisible(root)).toBe(true);
    expect(input(bar(root), "wishlist.quick.placeholder").props.value).toBe("Kapadokya");
  });

  it("çevrimdışıyken pencere açılmaz (uyarı), açıkken çevrimdışı olunursa kayıt gönderilmez", async () => {
    mockState.offline = true;
    const root = render();
    openDetails(root, "Kapadokya");
    expect(sheetOpen(root)).toBe(false);
    expect(mockToast.warning).toHaveBeenCalledWith("wishlist.errors.offline");
    await flush();
    // Reddedilen açılış çubuğu bozmaz
    expect(input(bar(root), "wishlist.quick.placeholder").props.value).toBe("Kapadokya");

    mockState.offline = false;
    rerender();
    act(() => touchable(bar(root), DETAILS).props.onPress());
    expect(sheetOpen(root)).toBe(true);
    mockState.offline = true;
    rerender();
    await act(async () => touchable(sheet(root), "wishlist.create.cta").props.onPress());
    expect(mockState.addItem).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith("common.error", "wishlist.errors.offline");
    expect(sheetOpen(root)).toBe(true);
  });
});

describe("ayrıntılı ekleme: çift dokunuş", () => {
  it("(e) kaydet'e aynı karede iki dokunuş tek kayıt yapar; sürerken pencere kapatılamaz", async () => {
    const gate = deferred<string>();
    mockState.addItem.mockReturnValue(gate.promise);
    const root = render();
    openDetails(root, "Kapadokya");

    act(() => {
      touchable(sheet(root), "wishlist.create.cta").props.onPress();
      touchable(sheet(root), "wishlist.create.cta").props.onPress();
    });
    expect(mockState.addItem).toHaveBeenCalledTimes(1);
    // Kayıt sürerken kapat düğmesi pasif, geri tuşu da kapatmaz
    expect(touchable(sheet(root), "a11y.close").props.disabled).toBe(true);

    await act(async () => gate.resolve("ok"));
    await flush();
    expect(mockState.addItem).toHaveBeenCalledTimes(1);
    expect(sheetOpen(root)).toBe(false);
  });

  it("(e) hızlı gönderim sürerken aynı karede gelen 'Ayrıntı ekle' pencere açmaz (aynı başlık iki kez eklenmez)", async () => {
    const gate = deferred<string>();
    mockState.addItem.mockReturnValue(gate.promise);
    const root = render();
    act(() => input(bar(root), "wishlist.quick.placeholder").props.onChangeText("Sinema"));
    // Hızlı gönderim yolda: aynı karede gelen "Ayrıntı ekle" pencere açmaz (aynı başlık iki kez eklenebilirdi)
    act(() => {
      touchable(bar(root), "wishlist.quick.sendA11y").props.onPress();
      touchable(bar(root), DETAILS).props.onPress();
    });
    expect(sheetOpen(root)).toBe(false);
    await act(async () => gate.resolve("ok"));
    await flush();
    expect(mockState.addItem).toHaveBeenCalledTimes(1);
  });

  it("(e) düzenleme modunda da kaydet'e çift dokunuş tek güncelleme yapar", async () => {
    const gate = deferred<string>();
    mockState.saveItem.mockReturnValue(gate.promise);
    mockState.openItems = [item(7, { title: "Kapadokya" })];
    const root = render();
    // Karta dokun → ayrıntı → Düzenle: ekran aynı pencereyi düzenleme modunda açar
    await openEditViaDetail(root, 7);

    expect(sheet(root).props.request).toMatchObject({ mode: "edit" });
    act(() => {
      touchable(sheet(root), "common.save").props.onPress();
      touchable(sheet(root), "common.save").props.onPress();
    });
    expect(mockState.saveItem).toHaveBeenCalledTimes(1);
    await act(async () => gate.resolve("ok"));
    await flush();
    expect(sheetOpen(root)).toBe(false);
  });
});

describe("ayrıntılı ekleme: konum kuralları ekleme modunda da geçerli", () => {
  const save = async (root: Node) => {
    await act(async () => touchable(sheet(root), "wishlist.create.cta").props.onPress());
    await flush();
    return mockState.addItem.mock.calls[0][0];
  };

  it("(f) haritadan seçilen nokta, ad elle değişince düşer", async () => {
    const root = render();
    openDetails(root, "Gezi");
    act(() => byName(sheet(root), "MapPickerStub").props.onSelectLocation(CAPPADOCIA));
    act(() => input(sheet(root), "wishlist.edit.locationLabel").props.onChangeText("Kapalıçarşı"));
    expect(await save(root)).toMatchObject({ location_name: "Kapalıçarşı", latitude: null, longitude: null });
  });

  it("(f) ad silinirse koordinat kaydedilmez", async () => {
    const root = render();
    openDetails(root, "Gezi");
    act(() => byName(sheet(root), "MapPickerStub").props.onSelectLocation(CAPPADOCIA));
    act(() => input(sheet(root), "wishlist.edit.locationLabel").props.onChangeText(""));
    expect(await save(root)).toMatchObject({ location_name: null, latitude: null, longitude: null });
  });

  it("(f) elle yazılan ad noktasız kaydedilir; adres çözülemeyen seçimde ad koordinattır", async () => {
    const root = render();
    openDetails(root, "Gezi");
    act(() => input(sheet(root), "wishlist.edit.locationLabel").props.onChangeText("Moda sahili"));
    act(() => byName(sheet(root), "MapPickerStub").props.onSelectLocation({ latitude: 41, longitude: 29, locationName: "" }));
    expect(await save(root)).toMatchObject({ location_name: "41.00000, 29.00000", latitude: 41, longitude: 29 });
  });
});

/**
 * Karta dokunulur (ayrıntı penceresi açılır) ve "Düzenle" seçilir; ayrıntı kapanınca düzenleme penceresi açılır.
 * Kart taklit; ekranın ona verdiği eylemler kullanılır.
 */
async function openEditViaDetail(root: Node, id: number) {
  const card = root.findAll((node) => node.props.item?.id === id && typeof node.props.actions?.onOpen === "function")[0];
  act(() => card.props.actions.onOpen(card.props.item));
  const detail = byName(root, "WishlistDetailSheet");
  expect(detail.props.item).toMatchObject({ id });
  act(() => touchable(detail, "wishlist.menu.edit").props.onPress());
  await wait(500);
}
