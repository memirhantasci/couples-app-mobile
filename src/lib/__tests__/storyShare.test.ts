/// <reference types="jest" />
import { PixelRatio, Platform } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

import { captureImage, shareStoryImage } from "../storyShare";

jest.mock("react-native-view-shot", () => ({ captureRef: jest.fn(async () => "/tmp/a.png") }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }));

const ref = { current: {} as never };
const OPTIONS = { dialogTitle: "d", fallbackMessage: "f" };

function setPlatform(os: "ios" | "android") {
  Object.defineProperty(Platform, "OS", { configurable: true, get: () => os });
}

describe("storyShare", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(PixelRatio, "get").mockReturnValue(3);
  });

  it("hikâye Android'de piksel, iOS'ta nokta ister ve paylaşır", async () => {
    setPlatform("android");
    await shareStoryImage(ref, OPTIONS);
    expect(captureRef).toHaveBeenLastCalledWith(ref.current, { format: "png", quality: 1, result: "tmpfile", width: 1080, height: 1920 });
    expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///tmp/a.png", expect.objectContaining({ mimeType: "image/png", dialogTitle: "d" }));

    setPlatform("ios");
    await shareStoryImage(ref, OPTIONS);
    expect(captureRef).toHaveBeenLastCalledWith(ref.current, { format: "png", quality: 1, result: "tmpfile", width: 360, height: 640 });
  });

  it("görünüm yoksa hikâye sessizce çıkar", async () => {
    await shareStoryImage({ current: null }, OPTIONS);
    expect(captureRef).not.toHaveBeenCalled();
  });

  it("baskı boyutunda aynı nokta/piksel kuralı", async () => {
    setPlatform("ios");
    await captureImage(ref, { widthPx: 2400, heightPx: 3200 });
    expect(captureRef).toHaveBeenLastCalledWith(ref.current, expect.objectContaining({ width: 800, height: 3200 / 3 }));
    setPlatform("android");
    await captureImage(ref, { widthPx: 2400, heightPx: 3200 });
    expect(captureRef).toHaveBeenLastCalledWith(ref.current, expect.objectContaining({ width: 2400, height: 3200 }));
  });

  it("captureImage görünüm yoksa ve yakalama boşsa hata verir (geri düşme bunu yakalar)", async () => {
    await expect(captureImage({ current: null }, { widthPx: 1, heightPx: 1 })).rejects.toThrow();
    (captureRef as jest.Mock).mockResolvedValueOnce("");
    await expect(captureImage(ref, { widthPx: 1, heightPx: 1 })).rejects.toThrow();
  });
});
