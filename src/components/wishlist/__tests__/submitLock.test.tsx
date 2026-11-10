/// <reference types="jest" />
import { TextInput, TouchableOpacity } from "react-native";

import { createSubmitLock } from "@/lib/submitLock";
import { QuickAddBar } from "../QuickAddBar";
import { WishlistIdeas } from "../WishlistIdeas";

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    isLight: false,
    theme: {
      isLight: false,
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
jest.mock("lucide-react-native", () => new Proxy({}, { get: (_target, name) => (name === "__esModule" ? false : () => null) }));
jest.mock("../CategoryChips", () => ({ CategoryChips: () => null }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require("react-test-renderer");
const { act } = TestRenderer;

type Node = { props: Record<string, any> };
type Root = { findAllByType: (type: unknown) => Node[]; findByType: (type: unknown) => Node };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const QUOTA = { openCount: 3, limit: 15, reached: false, showCounter: true, shownCount: 3 };

describe("createSubmitLock", () => {
  it("aynı karede gelen ikinci çağrı işlemi başlatmaz; bitince kilit açılır", async () => {
    const lock = createSubmitLock();
    const gate = deferred<string>();
    const task = jest.fn(() => gate.promise);

    const first = lock.run(task);
    const second = lock.run(task);
    expect(task).toHaveBeenCalledTimes(1);
    expect(lock.isBusy()).toBe(true);
    expect(await second).toBeUndefined();

    gate.resolve("ok");
    expect(await first).toBe("ok");
    expect(lock.isBusy()).toBe(false);
    await lock.run(task);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("işlem hata verse de kilit bırakılır", async () => {
    const changes: boolean[] = [];
    const lock = createSubmitLock((busy) => changes.push(busy));
    await expect(lock.run(() => Promise.reject(new Error("x")))).rejects.toThrow("x");
    expect(lock.isBusy()).toBe(false);
    expect(changes).toEqual([true, false]);
  });
});

describe("QuickAddBar çift gönderim", () => {
  const render = (onSubmit: jest.Mock) => {
    let root!: { root: Root };
    act(() => {
      root = TestRenderer.create(
        <QuickAddBar quota={QUOTA} locked={false} onLockedPress={jest.fn()} onLimitPress={jest.fn()} onSubmit={onSubmit} />
      );
    });
    return root.root;
  };
  const sendButton = (root: Root) =>
    root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === "wishlist.quick.sendA11y")!;

  it("klavyedeki gönder ile düğme aynı karede gelirse tek ekleme yapılır", async () => {
    const gate = deferred<boolean>();
    const onSubmit = jest.fn(() => gate.promise);
    const root = render(onSubmit);
    act(() => root.findByType(TextInput).props.onChangeText("Kapadokya"));

    act(() => {
      root.findByType(TextInput).props.onSubmitEditing();
      sendButton(root).props.onPress();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("Kapadokya", "other");

    await act(async () => gate.resolve(true));
    // Eklendi: kutu temizlendi, yeni metinle yeniden gönderilebilir
    expect(root.findByType(TextInput).props.value).toBe("");
  });

  it("hızlı çift dokunma tek ekleme yapar; işlem bitince kilit açılır", async () => {
    const gate = deferred<boolean>();
    const onSubmit = jest.fn(() => gate.promise);
    const root = render(onSubmit);
    act(() => root.findByType(TextInput).props.onChangeText("Sinema"));

    act(() => {
      sendButton(root).props.onPress();
      sendButton(root).props.onPress();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // Başarısız: metin kalır, ikinci deneme yapılabilir
    await act(async () => gate.resolve(false));
    expect(root.findByType(TextInput).props.value).toBe("Sinema");
    const retry = deferred<boolean>();
    onSubmit.mockImplementation(() => retry.promise);
    act(() => sendButton(root).props.onPress());
    expect(onSubmit).toHaveBeenCalledTimes(2);
    await act(async () => retry.resolve(true));
  });
});

describe("Hazır fikir çipleri çift gönderim", () => {
  it("hızlı çift dokunma aynı fikri bir kez ekler, işlem sürerken çipler pasif", async () => {
    const gate = deferred<boolean>();
    const onPick = jest.fn(() => gate.promise);
    let renderer!: { root: Root };
    act(() => {
      renderer = TestRenderer.create(<WishlistIdeas onPick={onPick} />);
    });
    const chips = () => renderer.root.findAllByType(TouchableOpacity);
    expect(chips().length).toBeGreaterThan(1);

    act(() => {
      chips()[0].props.onPress();
      chips()[0].props.onPress();
      chips()[1].props.onPress();
    });
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(chips().every((chip) => chip.props.disabled === true)).toBe(true);

    await act(async () => gate.resolve(true));
    expect(chips().every((chip) => chip.props.disabled === false)).toBe(true);
  });
});
