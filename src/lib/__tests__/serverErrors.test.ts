/// <reference types="jest" />
import i18n from "@/lib/i18n";
import { localizeServerError } from "../serverErrors";

jest.mock("@/lib/i18n", () => ({ __esModule: true, default: { language: "en", t: (key: string) => `T[${key}]` } }));

describe("localizeServerError", () => {
  beforeEach(() => {
    i18n.language = "en";
  });

  it("bilinen Türkçe sunucu mesajını çeviri anahtarına eşler", () => {
    expect(localizeServerError({ message: "Bu kodu zaten kullandınız" }, "FALLBACK")).toBe("T[serverErrors.promoUsed]");
    expect(localizeServerError({ message: "Çok fazla deneme yaptınız. Lütfen biraz sonra tekrar deneyin." }, "FALLBACK")).toBe(
      "T[serverErrors.promoRateLimited]"
    );
  });

  it("tanınmayan Türkçe metin yerine yedek mesajı döndürür", () => {
    expect(localizeServerError("Bilinmeyen bir şey oldu çünkü işlem başarısız", "FALLBACK")).toBe("FALLBACK");
  });

  it("İngilizce hata metnini aynen geçirir, boşta yedeği kullanır", () => {
    expect(localizeServerError(new Error("Network request failed"), "FALLBACK")).toBe("Network request failed");
    expect(localizeServerError(null, "FALLBACK")).toBe("FALLBACK");
  });

  it("Türkçe arayüzde ham mesajı korur", () => {
    i18n.language = "tr";
    expect(localizeServerError({ message: "Bu kodu zaten kullandınız" }, "FALLBACK")).toBe("Bu kodu zaten kullandınız");
  });
});
