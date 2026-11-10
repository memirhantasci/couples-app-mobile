/// <reference types="jest" />
import { Text, TextInput, TouchableOpacity } from "react-native";

import WishlistScreen from "@/app/(tabs)/wishlist";
import type { WishlistItem } from "@/lib/wishlist";
import { COLLAPSE_DURATION } from "../Collapse";
import { QuickAddBar } from "../QuickAddBar";
import { WishlistDetailSheet } from "../WishlistDetailSheet";
import { WishlistItemCard, type WishlistCardActions, type WishlistCardPeople } from "../WishlistItemCard";

/**
 * Yeni yerleşimin davranışları: tek satırlık ekleme çubuğunun açılıp kapanması, karta dokununca menünün
 * (ve ekran okuyucuda düzenle/sil eylemlerinin) başlaması, 🎲 düğmesinin görünürlük kuralı.
 * Çubuk, kart ve ekran gerçek; yalnızca kenar bağımlılıklar (veri hook'u, tema, oturum, diyalog) taklit edilir.
 */

const ME = "user-me";
const PARTNER = "user-partner";

const mockState = { openItems: [] as WishlistItem[] };
const mockAlert = jest.fn();

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
    toggleWant: jest.fn(() => Promise.resolve("ok")),
    toggleDone: jest.fn(() => Promise.resolve("ok")),
    addItem: jest.fn(() => Promise.resolve("ok")),
    saveItem: jest.fn(() => Promise.resolve("ok")),
    removeItem: jest.fn(() => Promise.resolve("ok")),
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
      cardBorder: "#2a2a2a",
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
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "tr" } }) }));
jest.mock("@/lib/i18n", () => ({ __esModule: true, default: { language: "tr", t: (key: string) => key } }));
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
jest.mock("@/hooks/useIsOffline", () => ({ useIsOffline: () => false }));
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
jest.mock("@/lib/toast", () => ({ toast: { warning: jest.fn(), error: jest.fn(), success: jest.fn() } }));
jest.mock("@/lib/soundEffects", () => ({ hapticSelection: jest.fn(), playBubblePop: jest.fn(), playSuccessChime: jest.fn() }));
jest.mock("@/lib/wishlistAvailability", () => ({ canOpenWishlist: () => true, wishlistDataNotice: () => null }));
jest.mock("@/components/avatar/UserAvatar", () => ({ UserAvatar: () => null }));
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
  LazyPremiumPaywall: () => null,
}));
jest.mock("@/components/MapPickerModal", () => ({ MapPickerModal: () => null }));
jest.mock("@/components/common/SoloFeatureBanner", () => ({ SoloFeatureBanner: () => null }));
// "İkimiz de" bölümü kendi kartlarını çizer; burada yalnızca başlığın sağındaki yuvası (🎲) önemli
jest.mock("@/components/wishlist/BothWantSection", () => ({
  BothWantSection: function BothWantStub({ accessory }: { accessory?: React.ReactNode }) {
    return accessory ?? null;
  },
}));
jest.mock("@/components/wishlist/PickerSheet", () => ({
  PickerSheet: function PickerSheetStub() {
    return null;
  },
}));
jest.mock("@/components/wishlist/WishlistIdeas", () => ({ WishlistIdeas: () => null }));

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

const nameOf = (type: unknown) => (typeof type === "function" ? type.name : "");
const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));

let renderer: { root: Node; unmount: () => void } | null = null;
function mount(element: React.ReactElement): Node {
  act(() => {
    renderer = TestRenderer.create(element);
  });
  return renderer!.root;
}
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  mockAlert.mockReset();
});

const touchables = (scope: Node, label: string) =>
  scope.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityLabel === label);
const texts = (scope: Node) =>
  scope
    .findAllByType(Text)
    .map((node) =>
      [node.props.children]
        .flat()
        .filter((part) => typeof part === "string" || typeof part === "number")
        .join("")
    );

// ─── Ekleme çubuğu ──────────────────────────────────────────────────────────

describe("hızlı ekleme çubuğu: dinlenirken tek satır", () => {
  const QUOTA = { openCount: 3, limit: 15, reached: false, showCounter: true, shownCount: 3 };
  const FULL = { openCount: 15, limit: 15, reached: true, showCounter: true, shownCount: 15 };
  const DETAILS = "wishlist.quick.details, wishlist.quick.detailsHint";

  const renderBar = (props: Partial<React.ComponentProps<typeof QuickAddBar>> = {}) =>
    mount(
      <QuickAddBar
        quota={QUOTA}
        locked={false}
        onLockedPress={jest.fn()}
        onLimitPress={jest.fn()}
        onSubmit={jest.fn(() => Promise.resolve(true))}
        onOpenDetails={jest.fn(() => Promise.resolve(false))}
        {...props}
      />
    );
  const field = (root: Node) => root.findAllByType(TextInput)[0];
  const isOpen = (root: Node) => touchables(root, DETAILS).length > 0;
  const chipCount = (root: Node) =>
    root.findAllByType(TouchableOpacity).filter((node) => /^wishlist\.categories\./.test(node.props.accessibilityLabel ?? ""))
      .length;

  it("ilk açılışta yalnızca yazı kutusu, sayaç ve gönder görünür; çipler ve 'Ayrıntı ekle' yok", () => {
    const root = renderBar();
    expect(isOpen(root)).toBe(false);
    expect(chipCount(root)).toBe(0);
    expect(touchables(root, "wishlist.quick.sendA11y")).toHaveLength(1);
    expect(texts(root)).toContain("3/15");
  });

  it("kutu odaklanınca açılır; boşken odak giderse kapanır (kapanış animasyonundan sonra ağaçtan kalkar)", async () => {
    const root = renderBar();
    act(() => field(root).props.onFocus());
    expect(isOpen(root)).toBe(true);
    expect(chipCount(root)).toBe(6);

    act(() => field(root).props.onBlur());
    await wait(COLLAPSE_DURATION + 30);
    expect(isOpen(root)).toBe(false);
    expect(chipCount(root)).toBe(0);
  });

  it("içinde yazı varken odak gitse de açık kalır; yazı silinince kapanır", async () => {
    const root = renderBar();
    act(() => field(root).props.onChangeText("Kapadokya"));
    expect(isOpen(root)).toBe(true);
    act(() => field(root).props.onBlur());
    await wait(COLLAPSE_DURATION + 30);
    expect(isOpen(root)).toBe(true);

    act(() => field(root).props.onChangeText(""));
    await wait(COLLAPSE_DURATION + 30);
    expect(isOpen(root)).toBe(false);
  });

  it("hızlı ekleme başarılı olunca (yazı temizlenir, odak yok) çubuk yeniden tek satıra döner", async () => {
    const onSubmit = jest.fn(() => Promise.resolve(true));
    const root = renderBar({ onSubmit });
    act(() => field(root).props.onFocus());
    act(() => field(root).props.onChangeText("Sinema"));
    await act(async () => touchables(root, "wishlist.quick.sendA11y")[0].props.onPress());
    act(() => field(root).props.onBlur());
    await wait(COLLAPSE_DURATION + 30);
    expect(onSubmit).toHaveBeenCalledWith("Sinema", "other");
    expect(field(root).props.value).toBe("");
    expect(isOpen(root)).toBe(false);
  });

  it("seçili kategori kapanınca korunur, yeniden açılınca seçili görünür ve gönderime gider", async () => {
    const onSubmit = jest.fn(() => Promise.resolve(true));
    const root = renderBar({ onSubmit });
    act(() => field(root).props.onFocus());
    act(() => touchables(root, "wishlist.categories.food")[0].props.onPress());
    act(() => field(root).props.onBlur());
    await wait(COLLAPSE_DURATION + 30);
    expect(isOpen(root)).toBe(false);

    act(() => field(root).props.onChangeText("Pizza"));
    expect(touchables(root, "wishlist.categories.food")[0].props.accessibilityState).toEqual({ selected: true });
    await act(async () => touchables(root, "wishlist.quick.sendA11y")[0].props.onPress());
    expect(onSubmit).toHaveBeenCalledWith("Pizza", "food");
  });

  it("tek kalan: kutu yazılamaz, çubuk açılmaz; kutuya ve gönder'e dokunmak nedenini anlatır", () => {
    const onLockedPress = jest.fn();
    const root = renderBar({ locked: true, onLockedPress });
    expect(field(root).props.editable).toBe(false);
    // Odak bir yoldan gelse bile kilitliyken açılmaz
    act(() => field(root).props.onFocus());
    expect(isOpen(root)).toBe(false);

    const wrapper = root.findAllByType(TouchableOpacity).find((node) => node.props.disabled === false && !node.props.accessibilityLabel)!;
    act(() => wrapper.props.onPress());
    act(() => touchables(root, "wishlist.quick.sendA11y")[0].props.onPress());
    expect(onLockedPress).toHaveBeenCalledTimes(2);
  });

  it("sınır dolu: uyarı metni çubuk kapalıyken de görünür; gönder (taç) ve uyarı paywall'a gider", () => {
    const onLimitPress = jest.fn();
    const onSubmit = jest.fn();
    const root = renderBar({ quota: FULL, onLimitPress, onSubmit });
    expect(isOpen(root)).toBe(false);
    expect(texts(root)).toEqual(expect.arrayContaining(["wishlist.quick.limitPerPerson"]));
    expect(texts(root).some((text) => text.startsWith("wishlist.quick.limitHint"))).toBe(true);

    act(() => touchables(root, "wishlist.quick.limitA11y")[0].props.onPress());
    const hint = root
      .findAllByType(TouchableOpacity)
      .find((node) => node.props.accessibilityRole === "button" && node.props.accessibilityLabel === undefined)!;
    act(() => hint.props.onPress());
    expect(onLimitPress).toHaveBeenCalledTimes(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

// ─── Madde kartı ────────────────────────────────────────────────────────────

describe("madde kartı: dokununca ayrıntı, ekran okuyucuda eylemler", () => {
  const people: WishlistCardPeople = { userId: ME, myName: "Ben", partnerName: "Sevgilim", getAvatarUrl: () => null };
  const makeActions = (): jest.Mocked<WishlistCardActions> => ({
    onToggleWant: jest.fn(),
    onToggleDone: jest.fn(),
    onOpen: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
  });
  const body = (root: Node) =>
    root.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityHint === "wishlist.card.detailsA11y");

  it("benim kartımda ortaya dokunmak ayrıntıyı açar; üç nokta düğmesi yok", () => {
    const actions = makeActions();
    const card = item(3, { title: "Kapadokya", note: "Balon turu", location_name: "Göreme", category: "travel" });
    const root = mount(<WishlistItemCard item={card} people={people} actions={actions} />);

    expect(body(root)).toHaveLength(1);
    act(() => body(root)[0].props.onPress());
    expect(actions.onOpen).toHaveBeenCalledWith(card);
    expect(actions.onEdit).not.toHaveBeenCalled();
    // Ekran okuyucu kartı tek parça okur: başlık, not, konum, ekleyen
    expect(body(root)[0].props.accessibilityLabel).toBe(
      "Kapadokya, Balon turu, Göreme, wishlist.card.addedByYouA11y"
    );
  });

  it("ekran okuyucu: Düzenle ve Sil ayrı eylemlerdir, etkinleştirme ayrıntıyı açar", () => {
    const actions = makeActions();
    const card = item(4);
    const root = mount(<WishlistItemCard item={card} people={people} actions={actions} />);
    const target = body(root)[0];

    expect(target.props.accessibilityActions.map((action: { name: string }) => action.name)).toEqual([
      "activate",
      "edit",
      "delete",
    ]);
    act(() => target.props.onAccessibilityAction({ nativeEvent: { actionName: "edit" } }));
    act(() => target.props.onAccessibilityAction({ nativeEvent: { actionName: "delete" } }));
    act(() => target.props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } }));
    expect(actions.onEdit).toHaveBeenCalledWith(card);
    expect(actions.onDelete).toHaveBeenCalledWith(card);
    expect(actions.onOpen).toHaveBeenCalledWith(card);
  });

  it("partnerin kartı da dokununca ayrıntıyı açar ama düzenle/sil sunmaz (yetki aynen)", () => {
    const actions = makeActions();
    const card = item(5, { created_by: PARTNER, wants: [PARTNER] });
    const root = mount(<WishlistItemCard item={card} people={people} actions={actions} />);
    expect(body(root)).toHaveLength(1);
    expect(body(root)[0].props.accessibilityActions).toBeUndefined();
    expect(body(root)[0].props.accessibilityLabel).toBe(
      "Madde 5, wishlist.categories.other, wishlist.card.addedByPartnerA11y"
    );
    act(() => body(root)[0].props.onPress());
    expect(actions.onOpen).toHaveBeenCalledWith(card);
    // Kalp ve yaptık herkes için açık; partnerin isteği kalbin etiketinde söylenir
    expect(touchables(root, "wishlist.card.wantA11y, wishlist.card.partnerWantsA11y")).toHaveLength(1);
    act(() => touchables(root, "wishlist.card.markDoneA11y: Madde 5")[0].props.onPress());
    expect(actions.onToggleDone).toHaveBeenCalledTimes(1);
  });

  it("notsuz ve konumsuz kartta ikincil satır boş kalmaz: kategori adı yazar", () => {
    const root = mount(<WishlistItemCard item={item(6, { category: "food" })} people={people} actions={makeActions()} />);
    expect(texts(root)).toEqual(["Madde 6", "wishlist.categories.food"]);
  });

  it("yapılmış madde aynı kartı kullanır: daire işaretli, kalp yok, dokununca ayrıntı açılır", () => {
    const actions = makeActions();
    const card = item(7, { status: "done", done_at: "2026-02-14T10:00:00.000Z", done_by: ME });
    const root = mount(<WishlistItemCard item={card} people={people} actions={actions} />);
    const check = root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityRole === "checkbox")!;
    expect(check.props.accessibilityState).toEqual({ checked: true });
    expect(check.props.accessibilityLabel).toBe("wishlist.card.undoDoneA11y: Madde 7");
    expect(touchables(root, "wishlist.card.wantA11y")).toHaveLength(0);
    expect(texts(root)).toContain("wishlist.card.doneOn");
    act(() => body(root)[0].props.onPress());
    expect(actions.onOpen).toHaveBeenCalledWith(card);
  });
});

// ─── Ekran: 🎲 ve karta dokunma ─────────────────────────────────────────────

describe("ekran: 🎲 düğmesi ve karttan ayrıntı", () => {
  const PICK_ALL = "wishlist.pick.cta, wishlist.pick.subAll";
  const PICK_BOTH = "wishlist.pick.cta, wishlist.pick.subBoth";
  const pickButtons = (root: Node) => [...touchables(root, PICK_ALL), ...touchables(root, PICK_BOTH)];
  const pickerVisible = (root: Node) =>
    root.findAll((node) => nameOf(node.type) === "PickerSheetStub")[0].props.visible === true;
  const both = (id: number, overrides: Partial<WishlistItem> = {}) => item(id, { wants: [ME, PARTNER], ...overrides });

  beforeEach(() => {
    mockState.openItems = [];
  });

  it("açık fikirler bölüm başlığında sayı ve küçük 🎲 düğmesi; basınca seçim açılır", () => {
    mockState.openItems = [item(1), item(2)];
    const root = mount(<WishlistScreen />);
    expect(texts(root)).toContain("wishlist.sections.open");
    expect(pickButtons(root)).toHaveLength(1);
    expect(touchables(root, PICK_ALL)).toHaveLength(1);
    // Eski büyük kart yok: düğmenin görünen metni kısa
    expect(texts(root)).toContain("wishlist.pick.button");
    expect(pickerVisible(root)).toBe(false);
    act(() => touchables(root, PICK_ALL)[0].props.onPress());
    expect(pickerVisible(root)).toBe(true);
  });

  it("ikisinin de istediği varsa etiket seçimin oradan yapılacağını söyler", () => {
    mockState.openItems = [item(1), both(2)];
    const root = mount(<WishlistScreen />);
    expect(pickButtons(root)).toHaveLength(1);
    expect(touchables(root, PICK_BOTH)).toHaveLength(1);
  });

  it("bütün açıklar 'ikimiz de' ise açık fikirler bölümü yok; 🎲 'İkimiz de' başlığında tek kez durur", () => {
    mockState.openItems = [both(1), both(2)];
    const root = mount(<WishlistScreen />);
    expect(texts(root)).not.toContain("wishlist.sections.open");
    expect(pickButtons(root)).toHaveLength(1);
    expect(touchables(root, PICK_BOTH)).toHaveLength(1);
  });

  it("filtrede seçilecek madde yoksa 🎲 gizlenir; liste boşsa hiç görünmez", () => {
    mockState.openItems = [item(1, { category: "travel" })];
    const root = mount(<WishlistScreen />);
    expect(pickButtons(root)).toHaveLength(1);
    act(() => touchables(root, "wishlist.categories.food")[0].props.onPress());
    expect(pickButtons(root)).toHaveLength(0);
    expect(texts(root)).toContain("wishlist.empty.filtered");

    act(() => renderer!.unmount());
    mockState.openItems = [];
    const empty = mount(<WishlistScreen />);
    expect(pickButtons(empty)).toHaveLength(0);
  });

  it("ekranda filtre çip sırası tektir (ekleme çubuğu kapalıyken kategori çipi yalnızca filtrede)", () => {
    mockState.openItems = [item(1)];
    const root = mount(<WishlistScreen />);
    expect(touchables(root, "wishlist.categories.food")).toHaveLength(1);
    expect(touchables(root, "wishlist.categories.all")).toHaveLength(1);
  });

  const cardBody = (root: Node, title: string) =>
    root
      .findAllByType(TouchableOpacity)
      .find(
        (node) =>
          node.props.accessibilityHint === "wishlist.card.detailsA11y" &&
          String(node.props.accessibilityLabel).startsWith(`${title},`)
      )!;
  const detail = (root: Node) => root.findAll((node) => nameOf(node.type) === "WishlistDetailSheet")[0];

  it("karta dokununca ayrıntı penceresi açılır: tam not, konum, ekleyen, istekler; menü çıkmaz", () => {
    const longNote = "Balon turu için sabah 5'te kalkmamız lazım, otel önerisini de not alalım";
    mockState.openItems = [
      item(1, { title: "Kapadokya", note: longNote, location_name: "Göreme", category: "travel", wants: [ME] }),
    ];
    const root = mount(<WishlistScreen />);
    expect(detail(root).props.item).toBeNull();

    act(() => cardBody(root, "Kapadokya").props.onPress());
    expect(mockAlert).not.toHaveBeenCalled();
    expect(detail(root).props.item).toMatchObject({ id: 1 });
    expect(detail(root).props.bothWant).toBe(false);
    const shown = texts(detail(root));
    expect(shown).toEqual(
      expect.arrayContaining([
        "wishlist.categories.travel",
        "Kapadokya",
        longNote,
        "Göreme",
        "wishlist.detail.addedByYou",
        "wishlist.detail.wantsMe",
      ])
    );
    // Ekleyen için düzenle / sil pencerenin içinde
    expect(touchables(detail(root), "wishlist.menu.edit")).toHaveLength(1);
    expect(touchables(detail(root), "wishlist.menu.delete")).toHaveLength(1);

    act(() => touchables(detail(root), "a11y.close")[0].props.onPress());
    expect(detail(root).props.item).toBeNull();
  });

  it("partnerin maddesinde ayrıntı görünür ama düzenle / sil yok", () => {
    mockState.openItems = [item(2, { title: "Sinema", created_by: PARTNER, wants: [PARTNER] })];
    const root = mount(<WishlistScreen />);
    act(() => cardBody(root, "Sinema").props.onPress());
    expect(texts(detail(root))).toEqual(
      expect.arrayContaining(["Sinema", "wishlist.detail.addedByPartner", "wishlist.detail.wantsPartner"])
    );
    expect(touchables(detail(root), "wishlist.menu.edit")).toHaveLength(0);
    expect(touchables(detail(root), "wishlist.menu.delete")).toHaveLength(0);
  });

  it("ayrıntıdan Düzenle: pencere kapanır, ardından düzenleme penceresi açılır (iOS iki Modal'ı birlikte sunamaz)", async () => {
    mockState.openItems = [item(1, { title: "Kapadokya" })];
    const root = mount(<WishlistScreen />);
    act(() => cardBody(root, "Kapadokya").props.onPress());
    act(() => touchables(detail(root), "wishlist.menu.edit")[0].props.onPress());

    expect(detail(root).props.item).toBeNull();
    const sheet = () => root.findAll((node) => nameOf(node.type) === "WishlistItemSheet")[0];
    expect(sheet().props.request).toBeNull();
    await wait(500);
    expect(sheet().props.request).toMatchObject({ mode: "edit", item: { id: 1 } });
  });

  it("ayrıntıdan Sil: pencere kapanır, ardından silme onayı sorulur", async () => {
    mockState.openItems = [item(1, { title: "Kapadokya" })];
    const root = mount(<WishlistScreen />);
    act(() => cardBody(root, "Kapadokya").props.onPress());
    act(() => touchables(detail(root), "wishlist.menu.delete")[0].props.onPress());
    expect(detail(root).props.item).toBeNull();
    expect(mockAlert).not.toHaveBeenCalled();
    await wait(500);
    expect(mockAlert).toHaveBeenCalledWith(
      "wishlist.delete.title",
      "wishlist.delete.message",
      expect.any(Array),
      expect.objectContaining({ tone: "danger" })
    );
  });

  it("açıkken madde listeden kalkarsa (partner sildi) pencere kendiliğinden kapanır", () => {
    mockState.openItems = [item(1, { title: "Kapadokya" })];
    const root = mount(<WishlistScreen />);
    act(() => cardBody(root, "Kapadokya").props.onPress());
    expect(detail(root).props.item).not.toBeNull();
    mockState.openItems = [];
    act(() => (renderer as unknown as { update: (el: unknown) => void }).update(<WishlistScreen />));
    expect(detail(root).props.item).toBeNull();
  });

  it("ekran okuyucunun Sil eylemi pencere açmadan doğrudan silme onayını açar", () => {
    mockState.openItems = [item(1, { title: "Kapadokya" })];
    const root = mount(<WishlistScreen />);
    act(() => cardBody(root, "Kapadokya").props.onAccessibilityAction({ nativeEvent: { actionName: "delete" } }));
    expect(detail(root).props.item).toBeNull();
    expect(mockAlert).toHaveBeenCalledWith(
      "wishlist.delete.title",
      "wishlist.delete.message",
      expect.any(Array),
      expect.objectContaining({ tone: "danger" })
    );
  });
});

// ─── Ayrıntı penceresi ──────────────────────────────────────────────────────

describe("ayrıntı penceresi", () => {
  const people: WishlistCardPeople = { userId: ME, myName: "Ben", partnerName: "Sevgilim", getAvatarUrl: () => null };
  const renderDetail = (detailItem: WishlistItem, bothWant: boolean) =>
    mount(
      <WishlistDetailSheet
        item={detailItem}
        people={people}
        partnerAvatarUrl={null}
        bothWant={bothWant}
        onClose={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    );

  it("ikisi de istiyorsa bunu söyler; notsuz ve konumsuz maddede boş satır yok", () => {
    const root = renderDetail(item(1, { title: "Kamp", wants: [ME, PARTNER] }), true);
    const shown = texts(root);
    expect(shown).toContain("wishlist.detail.wantsBoth");
    expect(shown).not.toContain("");
  });

  it("yapılmış maddede istekler yerine yapılma tarihi gösterilir", () => {
    const root = renderDetail(item(2, { status: "done", done_at: "2026-02-14T10:00:00.000Z", done_by: ME }), false);
    const shown = texts(root);
    expect(shown).toContain("wishlist.card.doneOn");
    expect(shown.some((text) => text.startsWith("wishlist.detail.wants"))).toBe(false);
  });
});
