/// <reference types="jest" />
import { Modal, TouchableOpacity } from "react-native";

import type { WishlistPick } from "@/lib/wishlist";
import { PickerSheet } from "../PickerSheet";

/**
 * 🎲 penceresinin zar durumu: açılınca döner, süre dolunca sonuç çıkar, "hareketi azalt"ta hiç dönmez,
 * kapanınca sıfırlanır, "Başka bir tane" yeniden döndürür. Yalnızca kenar bağımlılıklar taklit edilir.
 */

const mockMotion = { reduce: false };

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
      text: "#fff",
      textSecondary: "#ccc",
      textMuted: "#999",
    },
  }),
}));
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
    useReducedMotion: () => mockMotion.reduce,
    useSharedValue: (initial: unknown) => useState(() => shared(initial))[0],
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (to: unknown) => to,
  };
});
jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: (_target, name) => (name === "__esModule" ? false : () => null) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer");
const { act } = TestRenderer;

const ROLL_MS = 650;

const PICK = {
  item: {
    id: 1,
    couple_id: 5,
    created_by: "u",
    title: "Kapadokya",
    note: null,
    category: "travel",
    location_name: null,
    latitude: null,
    longitude: null,
    status: "open",
    done_at: null,
    done_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    wants: ["u"],
  },
  source: "all",
  poolSize: 3,
} as unknown as WishlistPick;

type Props = React.ComponentProps<typeof PickerSheet>;
let renderer: { root: any; update: (el: unknown) => void; unmount: () => void } | null = null;

const element = (props: Partial<Props> = {}) => (
  <PickerSheet visible pick={PICK} rollId={1} onAgain={jest.fn()} onClose={jest.fn()} {...props} />
);
function mount(props: Partial<Props> = {}) {
  act(() => {
    renderer = TestRenderer.create(element(props));
  });
}
function update(props: Partial<Props>) {
  act(() => renderer!.update(element(props)));
}

const rollingBox = () => renderer!.root.findAll(
    (n: any) => n.props.accessibilityLabel === "wishlist.pick.rolling" && typeof n.type === "string"
  );
const resultShown = () => rollingBox().length === 0;
const againButton = () =>
  renderer!.root.findAllByType(TouchableOpacity).find((n: any) => n.props.accessibilityLabel === "wishlist.pick.again");
const advance = (ms: number) => act(() => void jest.advanceTimersByTime(ms));

beforeEach(() => {
  jest.useFakeTimers();
  mockMotion.reduce = false;
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  jest.useRealTimers();
});

describe("PickerSheet zar animasyonu", () => {
  it("pencere açılınca zar döner (sonuç gizli, 'Başka bir tane' kilitli), süre dolunca sonuç çıkar", () => {
    mount();
    expect(rollingBox()).toHaveLength(1);
    expect(againButton()!.props.disabled).toBe(true);

    advance(ROLL_MS - 1);
    expect(rollingBox()).toHaveLength(1);

    advance(1);
    expect(resultShown()).toBe(true);
    expect(againButton()!.props.disabled).toBe(false);
  });

  it("'hareketi azalt'ta hiç dönmez: sonuç doğrudan görünür", () => {
    mockMotion.reduce = true;
    mount();
    expect(resultShown()).toBe(true);
    expect(againButton()!.props.disabled).toBe(false);
  });

  it("'Başka bir tane' (yeni rollId) zarı yeniden döndürür", () => {
    mount();
    advance(ROLL_MS);
    expect(resultShown()).toBe(true);

    update({ rollId: 2 });
    expect(rollingBox()).toHaveLength(1);
    advance(ROLL_MS);
    expect(resultShown()).toBe(true);
  });

  it("'Başka bir tane' düğmesi onAgain'i çağırır", () => {
    const onAgain = jest.fn();
    mount({ onAgain });
    advance(ROLL_MS);
    act(() => againButton()!.props.onPress());
    expect(onAgain).toHaveBeenCalledTimes(1);
  });

  it("kapanınca sıfırlanır: aynı rollId ile yeniden açılınca zar yine döner", () => {
    mount();
    advance(ROLL_MS);
    expect(resultShown()).toBe(true);

    update({ visible: false });
    expect(renderer!.root.findByType(Modal).props.visible).toBe(false);

    update({ visible: true });
    expect(rollingBox()).toHaveLength(1);
    advance(ROLL_MS);
    expect(resultShown()).toBe(true);
  });

  it("dönerken kapanırsa eski zamanlayıcı yeni açılışı erken bitirmez", () => {
    mount();
    advance(300);
    update({ visible: false });
    update({ visible: true });
    advance(ROLL_MS - 300); // eski zamanlayıcının dolacağı an
    expect(rollingBox()).toHaveLength(1);
    advance(300);
    expect(resultShown()).toBe(true);
  });
});
