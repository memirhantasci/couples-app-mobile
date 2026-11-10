/// <reference types="jest" />
import i18n from "@/lib/i18n";
import { isNetworkError, isTimeoutError, isWishlistLimitError, localizeServerError, serverErrorCode } from "../serverErrors";

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
    expect(localizeServerError(new Error("Unexpected token in JSON"), "FALLBACK")).toBe("Unexpected token in JSON");
    expect(localizeServerError(null, "FALLBACK")).toBe("FALLBACK");
  });

  it("ağ, zaman aşımı ve RLS reddini her dilde ayrı, çevrilmiş metne eşler", () => {
    for (const language of ["en", "tr"]) {
      i18n.language = language;
      expect(localizeServerError(new Error("Network request failed"), "FALLBACK")).toBe("T[serverErrors.network]");
      expect(localizeServerError({ code: "", message: "TypeError: Failed to fetch" }, "FALLBACK")).toBe("T[serverErrors.network]");
      expect(localizeServerError({ code: "57014", message: "canceling statement due to statement timeout" }, "FALLBACK")).toBe(
        "T[serverErrors.timeout]"
      );
      expect(localizeServerError({ name: "AbortError", message: "Aborted" }, "FALLBACK")).toBe("T[serverErrors.timeout]");
      expect(
        localizeServerError({ code: "42501", message: "new row violates row-level security policy for table \"x\"" }, "FALLBACK")
      ).toBe("T[serverErrors.unauthorized]");
    }
  });

  it("Türkçe arayüzde ham mesajı korur", () => {
    i18n.language = "tr";
    expect(localizeServerError({ message: "Bu kodu zaten kullandınız" }, "FALLBACK")).toBe("Bu kodu zaten kullandınız");
  });

  it("tek kalan kısıt kodlarını her dilde kodsuz, çevrilmiş metne eşler", () => {
    for (const language of ["en", "tr"]) {
      i18n.language = language;
      expect(
        localizeServerError({ message: "PARTNER_REQUIRED: Bu özellik için bir partnerle eşleşmen gerekiyor." }, "FALLBACK")
      ).toBe("T[solo.partnerRequired.message]");
      expect(
        localizeServerError({ message: "SOLO_PREMIUM_REQUIRED: Partnerin olmadan kayıt eklemek için Premium gerekir." }, "FALLBACK")
      ).toBe("T[solo.premiumRequired.message]");
    }
  });

  it("ortak liste sınırını her dilde kodsuz, çevrilmiş metne eşler", () => {
    for (const language of ["en", "tr"]) {
      i18n.language = language;
      expect(localizeServerError({ code: "P0022", message: "WISHLIST_LIMIT" }, "FALLBACK")).toBe("T[serverErrors.wishlistLimit]");
    }
  });
});

describe("isWishlistLimitError", () => {
  it("hata kodunu ya da mesajı tanır, diğerlerini geçirir", () => {
    expect(isWishlistLimitError({ code: "P0022", message: "x" })).toBe(true);
    expect(isWishlistLimitError(new Error("WISHLIST_LIMIT"))).toBe(true);
    expect(isWishlistLimitError({ code: "P0020", message: "PARTNER_REQUIRED: x" })).toBe(false);
    expect(isWishlistLimitError(null)).toBe(false);
  });
});

describe("hata kodu ve ağ yardımcıları", () => {
  it("SQLSTATE kodunu okur, yoksa boş döner", () => {
    expect(serverErrorCode({ code: "42501" })).toBe("42501");
    expect(serverErrorCode({ code: 5 })).toBe("");
    expect(serverErrorCode(new Error("x"))).toBe("");
  });

  it("Postgres'in 'current transaction is aborted' (25P02) hatası zaman aşımı sayılmaz", () => {
    const aborted = {
      code: "25P02",
      message: "current transaction is aborted, commands ignored until end of transaction block",
    };
    expect(isTimeoutError(aborted)).toBe(false);
    // Kodu düşmüş (yalnızca metin) hâli de zaman aşımı değildir
    expect(isTimeoutError(new Error(aborted.message))).toBe(false);
    i18n.language = "en";
    expect(localizeServerError(aborted, "FALLBACK")).not.toBe("T[serverErrors.timeout]");
    // Gerçek iptaller hâlâ tanınır
    expect(isTimeoutError({ name: "AbortError", message: "Aborted" })).toBe(true);
    expect(isTimeoutError(new Error("Aborted"))).toBe(true);
    expect(isTimeoutError(new Error("The operation was aborted."))).toBe(true);
    expect(isTimeoutError(new Error("Request timed out"))).toBe(true);
  });

  it("ağ ve zaman aşımını birbirinden ve sunucu hatalarından ayırır", () => {
    expect(isNetworkError(new TypeError("Network request failed"))).toBe(true);
    expect(isTimeoutError(new TypeError("Network request failed"))).toBe(false);
    expect(isTimeoutError({ code: "57014", message: "x" })).toBe(true);
    expect(isNetworkError({ code: "P0022", message: "WISHLIST_LIMIT" })).toBe(false);
    expect(isTimeoutError({ code: "P0022", message: "WISHLIST_LIMIT" })).toBe(false);
  });
});
