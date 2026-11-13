/// <reference types="jest" />
// Modül düzeyindeki durum (havuz, soğuma zamanları) her testte sıfırlansın diye require ile yeniden yüklenir
/* eslint-disable @typescript-eslint/no-require-imports */
import { AppState } from "react-native";

interface FakePlayer {
  playing: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  remove: jest.Mock;
  loop: boolean;
  volume: number;
}

const mockPlayers: FakePlayer[] = [];

jest.mock("expo-audio", () => ({
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
  createAudioPlayer: jest.fn(() => {
    const player: FakePlayer = {
      playing: false,
      loop: false,
      volume: 1,
      play: jest.fn(() => {
        player.playing = true;
      }),
      pause: jest.fn(() => {
        player.playing = false;
      }),
      seekTo: jest.fn(() => Promise.resolve()),
      remove: jest.fn(),
    };
    mockPlayers.push(player);
    return player;
  }),
}));
jest.mock("expo-haptics", () => ({
  AndroidHaptics: new Proxy({}, { get: (_t, key) => String(key) }),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/lib/safeStorage", () => ({
  safeStorage: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) },
}));

type SoundModule = typeof import("../soundEffects");

let sound: SoundModule;
let appStateHandler: (state: string) => void;

beforeEach(() => {
  jest.useFakeTimers();
  mockPlayers.length = 0;
  jest.resetModules();
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_event: string, handler: (state: string) => void) => {
    appStateHandler = handler;
    return { remove: jest.fn() };
  }) as never);
  sound = require("../soundEffects") as SoundModule;
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** Sesi çalar; sonraki çağrı tam `gapMs` sonra gelsin diye saati ilerletir. */
async function play(type: Parameters<SoundModule["playSoundEffect"]>[0], gapMs = 1000) {
  await sound.playSoundEffect(type, { haptic: false });
  jest.advanceTimersByTime(gapMs);
}

const totalPlays = () => mockPlayers.reduce((sum, p) => sum + p.play.mock.calls.length, 0);

describe("soundEffects: soğuma kalkanı", () => {
  it("minimum aralıktan sık gelen isteği yerel motora iletmez", async () => {
    await play("bubble_pop", 10);
    await play("bubble_pop", 10);
    await play("bubble_pop", 10);
    expect(totalPlays()).toBe(1);

    jest.advanceTimersByTime(60);
    await play("bubble_pop");
    expect(totalPlays()).toBe(2);
  });

  it("her ses kendi aralığını izler: farklı sesler birbirini engellemez", async () => {
    await play("bubble_pop", 5);
    await play("camera_click", 5);
    expect(totalPlays()).toBe(2);
  });

  it("başlıca ses tipleri için sınırlar tanımlıdır (celebration 500 ms)", async () => {
    await play("celebration", 400);
    await play("celebration", 0);
    expect(totalPlays()).toBe(1);
    jest.advanceTimersByTime(100);
    await play("celebration");
    expect(totalPlays()).toBe(2);
  });
});

describe("soundEffects: sabit havuz", () => {
  it("bubble_pop 3, celestial_chime 2, stamp_drop 2, diğerleri 1 + ortam müziği; toplam 12 oynatıcı", () => {
    sound.warmUpSoundEffects();
    expect(mockPlayers).toHaveLength(12);
    // Tekrarlayan ısındırma yeni oynatıcı üretmez
    sound.warmUpSoundEffects();
    expect(mockPlayers).toHaveLength(12);
  });

  it("art arda çalma havuzu round-robin gezer ve büyütmez", async () => {
    // Aralık kısa tutulur: 3 sn'lik açılış ısındırması devreye girip diğer havuzları kurmasın
    for (let i = 0; i < 7; i++) await play("bubble_pop", 100);
    expect(mockPlayers).toHaveLength(3);
    expect(mockPlayers.map((p) => p.play.mock.calls.length)).toEqual([3, 2, 2]);
  });

  it("çalmış oynatıcı başa sarılır, ilk çalışta sarma atlanır", async () => {
    await play("success_chime");
    expect(mockPlayers[0].seekTo).not.toHaveBeenCalled();
    await play("success_chime");
    expect(mockPlayers[0].seekTo).toHaveBeenCalledWith(0);
  });

  it("başa sarma hata verse ya da hiç dönmese de ses çalar", async () => {
    await play("success_chime");
    mockPlayers[0].seekTo.mockReturnValueOnce(Promise.reject(new Error("seek failed")));
    await play("success_chime");
    expect(totalPlays()).toBe(2);

    mockPlayers[0].seekTo.mockReturnValueOnce(new Promise(() => {}));
    const pending = sound.playSoundEffect("success_chime", { haptic: false });
    await jest.advanceTimersByTimeAsync(100);
    await pending;
    expect(totalPlays()).toBe(3);
  });

  it("çalan oynatıcı yeniden kullanılmadan önce durdurulur", async () => {
    await play("success_chime", 350);
    expect(mockPlayers[0].playing).toBe(true);
    await play("success_chime");
    expect(mockPlayers[0].pause).toHaveBeenCalled();
  });
});

describe("soundEffects: eşzamanlılık sınırı", () => {
  it("aynı anda en fazla 4 efekt çalar, fazlası için en eski susturulur", async () => {
    const types = ["bubble_pop", "celestial_chime", "stamp_drop", "camera_click"] as const;
    for (const type of types) await play(type, 130);
    expect(mockPlayers.filter((p) => p.playing)).toHaveLength(4);
    const oldest = mockPlayers.find((p) => p.playing)!;

    await play("success_chime", 0);
    expect(oldest.pause).toHaveBeenCalled();
    expect(oldest.playing).toBe(false);
    expect(mockPlayers.filter((p) => p.playing)).toHaveLength(4);
  });

  it("bitmiş sesler yer tutmaz", async () => {
    const types = ["bubble_pop", "celestial_chime", "stamp_drop", "camera_click"] as const;
    for (const type of types) await play(type, 130);
    // Hepsi doğal olarak bitti (native `playing` false) ve başlangıç payı geçti
    for (const p of mockPlayers) p.playing = false;
    jest.advanceTimersByTime(1000);

    await play("success_chime", 0);
    expect(mockPlayers.every((p) => p.pause.mock.calls.length === 0)).toBe(true);
  });
});

describe("soundEffects: yaşam döngüsü", () => {
  it("arka plana geçince çalan tüm efektler durur", async () => {
    await play("bubble_pop", 100);
    await play("camera_click", 0);
    expect(mockPlayers.filter((p) => p.playing).length).toBeGreaterThan(0);

    appStateHandler("background");
    expect(mockPlayers.some((p) => p.playing)).toBe(false);
  });

  it("sesler kapatılınca havuzdaki sesler anında durur ve yenisi çalmaz", async () => {
    await play("bubble_pop", 100);
    await play("stamp_drop", 0);
    await sound.setSoundEffectsEnabled(false);
    expect(mockPlayers.some((p) => p.playing)).toBe(false);

    const before = totalPlays();
    await play("success_chime");
    expect(totalPlays()).toBe(before);
  });
});

describe("soundEffects: haptik koruması", () => {
  it("triggerHaptic aynı sesin soğuma süresinde tekrar titreşim vermez", async () => {
    const Haptics = require("expo-haptics");
    await sound.setHapticFeedbackEnabled(true);

    await sound.triggerHaptic("camera_click");
    await sound.triggerHaptic("camera_click");
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(150);
    await sound.triggerHaptic("camera_click");
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
  });

  it("playSoundEffect hızlı dokunuşta titreşimi de düşürür, sesle birlikte bir kez verir", async () => {
    const Haptics = require("expo-haptics");
    await sound.setHapticFeedbackEnabled(true);

    await sound.playSoundEffect("camera_click");
    await sound.playSoundEffect("camera_click");
    await sound.playSoundEffect("camera_click");
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(totalPlays()).toBe(1);
  });
});
