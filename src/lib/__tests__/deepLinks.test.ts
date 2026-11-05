/// <reference types="jest" />
import { isVerifyLinkType, parseAppLink } from "../deepLinks";

// expo-linking'in gerçek ayrıştırıcısı Expo Constants'a (geliştirme sunucusu adresi) dayanır; testte yok.
// Mantık yalnızca `hostname` ve `queryParams`'a bakar, bu yüzden aynı şekli standart URL ile üretiriz.
jest.mock("expo-linking", () => ({
  parse: (url: string) => {
    const parsed = new URL(url);
    const queryParams: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });
    return { hostname: parsed.hostname || null, queryParams };
  },
}));

describe("parseAppLink", () => {
  it("e-posta doğrulama bağlantısını çözer; tür yoksa 'email' varsayılır", () => {
    expect(parseAppLink("couplesapp://verify?token_hash=abc123&type=signup")).toEqual({
      kind: "verify",
      tokenHash: "abc123",
      type: "signup",
    });
    expect(parseAppLink("couplesapp://verify?token_hash=abc123")).toEqual({
      kind: "verify",
      tokenHash: "abc123",
      type: "email",
    });
  });

  it("uygulamanın kullanmadığı doğrulama türlerini kabul etmez", () => {
    for (const type of ["magiclink", "recovery", "invite", "email_change", "sms", "constructor"]) {
      expect(parseAppLink(`couplesapp://verify?token_hash=abc123&type=${type}`)).toBeNull();
    }
  });

  it("belirteci olmayan doğrulama bağlantısını reddeder", () => {
    expect(parseAppLink("couplesapp://verify?type=email")).toBeNull();
    expect(parseAppLink("couplesapp://verify")).toBeNull();
  });

  it("davet ve arkadaş daveti bağlantılarını çözer", () => {
    expect(parseAppLink("couplesapp://invite?code=ABC123")).toEqual({ kind: "invite", code: "ABC123" });
    expect(parseAppLink("couplesapp://pair?code=ABC123")).toEqual({ kind: "invite", code: "ABC123" });
    expect(parseAppLink("couplesapp://refer?code=SKY-AB12C")).toEqual({ kind: "refer", code: "SKY-AB12C" });
  });

  it("kodsuz davet bağlantısını ve bilinmeyen adresleri yok sayar", () => {
    expect(parseAppLink("couplesapp://invite")).toBeNull();
    expect(parseAppLink("couplesapp://refer?code=")).toBeNull();
    expect(parseAppLink("couplesapp://unknown?code=ABC")).toBeNull();
  });
});

describe("isVerifyLinkType", () => {
  it("yalnızca email ve signup türlerini kabul eder", () => {
    expect(isVerifyLinkType("email")).toBe(true);
    expect(isVerifyLinkType("signup")).toBe(true);
    expect(isVerifyLinkType("recovery")).toBe(false);
    expect(isVerifyLinkType(undefined)).toBe(false);
    expect(isVerifyLinkType(42)).toBe(false);
  });
});
