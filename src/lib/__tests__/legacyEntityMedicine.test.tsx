/// <reference types="jest" />
import { Text, TextInput, TouchableOpacity } from "react-native";

/**
 * Eski sürümün sanitizeStrict ile kodlayıp yazdığı ilaç adı, gerçek ilaç ekranı + gerçek yönetim modalı ve GERÇEK
 * Supabase istemcisi üzerinden (ağ taklit edilir). Beklenen: kartta, modaldaki kayıtlı listede ve düzenleme
 * formunda çözülmüş ad görünür; kaydedince veritabanına ve yerel hatırlatıcıya kodlanmadan yazılır.
 */

const ME = "user-me";

const mockScheduleMedicineReminder = jest.fn();
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
jest.mock("@/context/NotificationContext", () => ({ useCustomNotification: () => ({ showNotification: jest.fn() }) }));
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "tr" } }) }));
jest.mock("@/lib/i18n", () => ({ __esModule: true, default: { language: "tr", t: (key: string) => key } }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: (_target, name) => (name === "__esModule" ? false : () => null) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("react-native-keyboard-aware-scroll-view", () => ({
  KeyboardAwareScrollView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/lib/notifications", () => ({ notifyPartner: jest.fn(), cancelLocalNotification: jest.fn(async () => {}) }));
jest.mock("@/lib/reminderSync", () => ({
  scheduleMedicineReminder: (...args: unknown[]) => mockScheduleMedicineReminder(...args),
  medicineReminderId: (id: unknown, time: unknown) => `medicine-${id}-${time}`,
  syncLocalReminders: jest.fn(),
}));
jest.mock("@/lib/soloGate", () => ({ useSoloGate: () => ({ isSolo: false, blockSoloWrite: () => false }) }));
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
jest.mock("@/hooks/useNotificationPriming", () => ({
  useNotificationPriming: () => ({ isVisible: false, maybePrompt: jest.fn(), accept: jest.fn(), dismiss: jest.fn() }),
}));
jest.mock("@/lib/dialog", () => ({ appAlert: (...args: unknown[]) => mockAlert(...args) }));
jest.mock("@/lib/toast", () => ({
  get toast() {
    return mockToast;
  },
}));
jest.mock("@/components/legal/HealthConsentGate", () => ({
  HealthConsentGate: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/ui/ActionCard", () => {
  const { TouchableOpacity: Touchable } = jest.requireActual("react-native");
  return {
    ActionCard: ({ title, onPress }: { title: string; onPress: () => void }) => (
      <Touchable accessibilityLabel={title} onPress={onPress} />
    ),
  };
});
// Doz kartı yalnızca kendisine verilen adı çizer: ekranın karta hangi metni verdiği doğrulanır
jest.mock("@/components/medicine/MedicineDoseCard", () => {
  const { Text: RNText } = jest.requireActual("react-native");
  return { MedicineDoseCard: ({ medicine }: { medicine: { name: string } }) => <RNText>{medicine.name}</RNText> };
});
jest.mock("@/components/medicine/MedicineStreakCard", () => ({ MedicineStreakCard: () => null }));
jest.mock("@/components/medicine/MedicineHistoryList", () => ({ MedicineHistoryList: () => null }));
jest.mock("@/components/profile/SegmentedControl", () => ({ SegmentedControl: () => null }));
jest.mock("@/components/ui/DateTimePickerSheet", () => ({ DateTimePickerSheet: () => null }));
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
  LazyPermissionPrimingModal: () => null,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer");
const { act } = TestRenderer;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { QueryClient, QueryClientProvider } = require("@tanstack/react-query");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dayjs = require("dayjs");

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

/** Veritabanında eski sürümün yazdığı hâliyle duran ilaç: "D'vit & Omega" → kodlanmış, bir kez de eski formda kaydedilmiş. */
const STORED_ROW = {
  id: 31,
  name: "D&amp;#x27;vit &amp; Omega",
  time: "09:00",
  times: ["09:00"],
  start_date: dayjs().subtract(2, "day").format("YYYY-MM-DD"),
  end_date: dayjs().add(10, "day").format("YYYY-MM-DD"),
  is_active: true,
  user_id: ME,
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  calls = [];
  mockScheduleMedicineReminder.mockClear();
  mockAlert.mockClear();
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (url.includes("/rest/v1/medicines?") && method === "GET") return json([STORED_ROW]);
    if (url.includes("/rest/v1/medicines") && method === "PATCH") return new Response(null, { status: 204 });
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
  require("@/app/(tabs)/medicine");
});

afterAll(async () => {
  // Gerçek istemcinin oturum yenileme zamanlayıcısı jest'in kapanmasını engellemesin
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  await require("@/lib/supabase").supabase.auth.stopAutoRefresh();
});

function textsOf(root: Node): string[] {
  return root.findAllByType(Text).map((node) => {
    const children = node.props.children;
    return Array.isArray(children) ? children.join("") : String(children ?? "");
  });
}

async function renderMedicine() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const MedicineScreen = require("@/app/(tabs)/medicine").default;
  queryClient = new QueryClient({
    // gcTime: Infinity → react-query önbellek temizleme zamanlayıcısı kurmaz (jest kapanışını bekletmesin)
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  act(() => {
    renderer = TestRenderer.create(
      <QueryClientProvider client={queryClient}>
        <MedicineScreen />
      </QueryClientProvider>
    );
  });
  await settle();
  return renderer!.root;
}

describe("ilaçlar: eski sürümün kodladığı kayıt", () => {
  it("doz kartında ve yönetim listesinde çözülmüş ad görünür", async () => {
    const root = await renderMedicine();
    expect(textsOf(root)).toContain("D'vit & Omega");

    const manage = root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === "medicine.manage.cta")!;
    act(() => manage.props.onPress());
    const texts = textsOf(root);
    expect(texts.filter((text) => text === "D'vit & Omega")).toHaveLength(2);
    expect(texts.join(" ")).not.toMatch(/&(amp|lt|gt|quot|#x27);/);
  });

  it("düzenleme formu çözülmüş adla açılır, kaydedince kodlanmadan yazılır", async () => {
    const root = await renderMedicine();
    const manage = root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === "medicine.manage.cta")!;
    act(() => manage.props.onPress());

    const edit = root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === "a11y.edit")!;
    act(() => edit.props.onPress());

    const nameInput = root.findAllByType(TextInput).find((node) => node.props.placeholder === "medicine.manager.namePlaceholder")!;
    expect(nameInput.props.value).toBe("D'vit & Omega");

    act(() => nameInput.props.onChangeText("D'vit & Omega <sabah>"));

    const save = root
      .findAllByType(TouchableOpacity)
      .find((node) => node.findAllByType(Text).some((text) => text.props.children === "medicine.manager.saveUpdate"))!;
    await act(async () => {
      await save.props.onPress();
    });
    await settle();

    expect(mockAlert).not.toHaveBeenCalled();
    const patch = calls.find((call) => call.method === "PATCH" && call.url.includes("/rest/v1/medicines"));
    expect(patch).toBeDefined();
    expect(patch!.body.name).toBe("D'vit & Omega <sabah>");
    expect(mockScheduleMedicineReminder).toHaveBeenCalledWith(STORED_ROW.id, "D'vit & Omega <sabah>", "09:00");
  });
});
