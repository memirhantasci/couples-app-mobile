/// <reference types="jest" />
import { isDefinitivePairingError, normalizePairingCode } from "../pairingCode";

jest.mock("@/lib/i18n", () => ({ __esModule: true, default: { t: (key: string) => key } }));

describe("normalizePairingCode", () => {
  it("küçük harf, boşluk ve tireleri temizler", () => {
    expect(normalizePairingCode("ab c-d12")).toBe("ABCD12");
  });

  it("Türkçe klavyedeki i / ı / İ harflerini I'ya çevirir", () => {
    expect(normalizePairingCode("iıİ123")).toBe("III123");
  });

  it("6 karakterle sınırlar ve boş girdiyi tolere eder", () => {
    expect(normalizePairingCode("ABCDEFGH")).toBe("ABCDEF");
    expect(normalizePairingCode(null)).toBe("");
    expect(normalizePairingCode(undefined)).toBe("");
  });
});

describe("isDefinitivePairingError", () => {
  it("sunucunun kesin red kodlarını tanır", () => {
    expect(isDefinitivePairingError("INVALID_CODE")).toBe(true);
    expect(isDefinitivePairingError("ALREADY_PAIRED: ...")).toBe(true);
  });

  it("ağ hatasını kesin red saymaz", () => {
    expect(isDefinitivePairingError("Network request failed")).toBe(false);
    expect(isDefinitivePairingError(undefined)).toBe(false);
  });
});
