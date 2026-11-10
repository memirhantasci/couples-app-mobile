/// <reference types="jest" />
import { Text, TextInput, TouchableOpacity } from "react-native";

/**
 * Eski sürümün sanitizeStrict ile kodlayıp yazdığı buluşma kaydı, gerçek buluşmalar ekranı ve GERÇEK Supabase
 * istemcisi üzerinden: ağ (global fetch) taklit edilir, veritabanı kodlanmış satırı döndürür.
 * Beklenen: kart ve düzenleme formu çözülmüş metni gösterir, kaydedince veritabanına kodlanmadan yazılır,
 * yalnızca başlık değiştiyse partnere "yer değişti" bildirimi gitmez.
 */

const ME = "user-me";
const MEETING_ISO = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

const mockNotifyPartner = jest.fn();
const mockScheduleMeetingReminder = jest.fn(async () => {});
const mockAlert = jest.fn();
const mockToast = { warning: jest.fn(), error: jest.fn(), success: jest.fn() };

jest.mock("@/lib/secureAuthStorage", () => ({
  secureAuthStorage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
}));
jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    session: { user: { id: "user-me" } },
    profile: { coupleId: 5, isPaired: true, isPremium: false, displayName: "Ben" },
    isDemoMode: false,
  }),
}));
jest.mock("@/context/ThemeContext", () => {
  const theme = new Proxy({ isLight: false, cardShadow: {} } as Record<string, unknown>, {
    get: (target, key: string) => (key in target ? target[key] : "#000000"),
  });
  return { useTheme: () => ({ isLight: false, theme }) };
});
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "tr" } }) }));
jest.mock("@/lib/i18n", () => ({ __esModule: true, default: { language: "tr", t: (key: string) => key } }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: (_target, name) => (name === "__esModule" ? false : () => null) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("react-native-keyboard-aware-scroll-view", () => ({
  KeyboardAwareScrollView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/lib/notifications", () => ({
  notifyPartner: (...args: unknown[]) => mockNotifyPartner(...args),
  cancelLocalNotification: jest.fn(async () => {}),
}));
jest.mock("@/lib/reminderSync", () => ({
  scheduleMeetingReminder: (...args: unknown[]) => mockScheduleMeetingReminder(...(args as [])),
  meetingReminderId: (id: unknown) => `meeting-${id}`,
}));
jest.mock("@/lib/soloGate", () => ({ useSoloGate: () => ({ isSolo: false, blockPartnerFeature: () => false }) }));
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
jest.mock("@/hooks/useDeferredReady", () => ({ useDeferredReady: () => false }));
jest.mock("@/hooks/useCoupleAvatars", () => ({ useCoupleAvatars: () => ({ getAvatarUrl: () => null }) }));
jest.mock("@/lib/dialog", () => ({ appAlert: (...args: unknown[]) => mockAlert(...args) }));
jest.mock("@/lib/toast", () => ({
  get toast() {
    return mockToast;
  },
}));
jest.mock("@/components/map/openDirections", () => ({ openDirections: jest.fn(), openMapSearch: jest.fn() }));
jest.mock("@/components/ui/ActionCard", () => ({ ActionCard: () => null }));
jest.mock("@/components/ui/Reveal", () => ({ Reveal: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/components/ui/Pulse", () => ({ Pulse: ({ children }: { children: React.ReactNode }) => children }));
jest.mock("@/components/ui/ScreenBackground", () => ({
  ScreenBackground: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/ui/ScreenHeader", () => ({ ScreenHeader: () => null }));
jest.mock("@/components/ui/Skeleton", () => ({ Skeleton: () => null }));
jest.mock("@/components/ui/DialogHost", () => ({ DialogHost: () => null }));
jest.mock("@/components/ui/EmptyState", () => ({ EmptyState: () => null }));
jest.mock("@/components/ui/lazyMount", () => ({
  LazyDemoActionModal: () => null,
  LazyPageTourModal: () => null,
  LazyDateTimePickerSheet: () => null,
}));
jest.mock("@/components/MapPickerModal", () => ({ MapPickerModal: () => null }));
jest.mock("@/components/avatar/UserAvatar", () => ({ UserAvatar: () => null }));
jest.mock("@/components/common/SoloFeatureBanner", () => ({ SoloFeatureBanner: () => null }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer");
const { act } = TestRenderer;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { QueryClient, QueryClientProvider } = require("@tanstack/react-query");

type Node = {
  type: unknown;
  props: Record<string, any>;
  findAll: (predicate: (node: Node) => boolean) => Node[];
  findAllByType: (type: unknown) => Node[];
};

process.env.EXPO_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";

type Call = { url: string; method: string; body: any };
let calls: Call[] = [];

/** Veritabanında eski sürümün yazdığı hâliyle duran satır. */
const STORED_ROW = {
  id: 77,
  couple_id: 5,
  user_id: ME,
  title: "Ali&#x27;s &amp; Ayşe",
  location_name: "Kahve &amp;amp; Kitap",
  latitude: null,
  longitude: null,
  meeting_datetime: MEETING_ISO,
  is_active: true,
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  calls = [];
  mockNotifyPartner.mockClear();
  mockScheduleMeetingReminder.mockClear();
  mockAlert.mockClear();
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.includes("/rest/v1/meetings") && method === "GET") return json([STORED_ROW]);
    if (url.includes("/rest/v1/meetings") && method === "PATCH") return json([{ id: STORED_ROW.id }]);
    return json([]);
  }) as unknown as typeof fetch;
});

const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

async function settle() {
  for (let i = 0; i < 6; i += 1) await flush();
}

let renderer: { root: Node; unmount: () => void } | null = null;
let queryClient: { clear: () => void } | null = null;

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  queryClient?.clear();
});

// Ekran modülünün ilk yüklenmesi (soğuk derleme) yavaş makinede tek başına 5 sn'yi aşabiliyor
jest.setTimeout(30000);
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("@/app/(tabs)/meetings");
});

afterAll(async () => {
  // Gerçek istemcinin oturum yenileme zamanlayıcısı jest'in kapanmasını engellemesin
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  await require("@/lib/supabase").supabase.auth.stopAutoRefresh();
});

function textsOf(root: Node): string[] {
  return root
    .findAllByType(Text)
    .map((node) => {
      const children = node.props.children;
      return Array.isArray(children) ? children.join("") : String(children ?? "");
    });
}

async function renderMeetings() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MeetingsScreen = require("@/app/(tabs)/meetings").default;
  queryClient = new QueryClient({
    // gcTime: Infinity → react-query önbellek temizleme zamanlayıcısı kurmaz (jest kapanışını bekletmesin)
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  act(() => {
    renderer = TestRenderer.create(
      <QueryClientProvider client={queryClient}>
        <MeetingsScreen />
      </QueryClientProvider>
    );
  });
  await settle();
  return renderer!.root;
}

describe("buluşmalar: eski sürümün kodladığı kayıt", () => {
  it("kartta çözülmüş başlık ve konum görünür", async () => {
    const root = await renderMeetings();
    const texts = textsOf(root);
    expect(texts).toContain("Ali's & Ayşe");
    expect(texts).toContain("Kahve & Kitap");
    expect(texts.join(" ")).not.toMatch(/&(amp|lt|gt|quot|#x27);/);
  });

  it("düzenleme formu çözülmüş değerle açılır, kaydedince kodlanmadan yazılır ve yer değişmediyse bildirim gitmez", async () => {
    const root = await renderMeetings();

    const editButton = root
      .findAllByType(TouchableOpacity)
      .find((node) => node.props.accessibilityLabel === "meetings.card.editA11y");
    expect(editButton).toBeDefined();
    act(() => editButton!.props.onPress());

    const titleInput = root.findAllByType(TextInput).find((node) => node.props.placeholder === "meetings.form.titlePlaceholder")!;
    const locationInput = root
      .findAllByType(TextInput)
      .find((node) => node.props.placeholder === "meetings.form.locationPlaceholder")!;
    expect(titleInput.props.value).toBe("Ali's & Ayşe");
    expect(locationInput.props.value).toBe("Kahve & Kitap");

    act(() => titleInput.props.onChangeText("Ali's & Ayşe <3 \"özel\""));

    const saveButton = root
      .findAllByType(TouchableOpacity)
      .find((node) => node.findAllByType(Text).some((text) => text.props.children === "meetings.form.update"))!;
    await act(async () => {
      await saveButton.props.onPress();
    });
    await settle();

    const patch = calls.find((call) => call.method === "PATCH" && call.url.includes("/rest/v1/meetings"));
    expect(patch).toBeDefined();
    expect(patch!.body.title).toBe("Ali's & Ayşe <3 \"özel\"");
    expect(patch!.body.location_name).toBe("Kahve & Kitap");
    expect(mockAlert).not.toHaveBeenCalled();
    // Tarih ve yer değişmedi: partnere "plan güncellendi" bildirimi gitmemeli
    expect(mockNotifyPartner).not.toHaveBeenCalled();
    // Yerel hatırlatıcı da düz metinle kurulur
    expect(mockScheduleMeetingReminder).toHaveBeenCalledWith(STORED_ROW.id, "Ali's & Ayşe <3 \"özel\"", expect.any(Date));
  });
});
