/// <reference types="jest" />
import { withoutNulls } from "../widgetPayload";

describe("withoutNulls", () => {
  it("null ve undefined alanları atar", () => {
    expect(withoutNulls({ a: 1, b: null, c: undefined, d: "x" })).toEqual({ a: 1, d: "x" });
  });

  it("0, boş metin, false ve boş dizi gibi geçerli değerleri korur", () => {
    expect(withoutNulls({ n: 0, s: "", f: false, list: [], map: {} })).toEqual({
      n: 0,
      s: "",
      f: false,
      list: [],
      map: {},
    });
  });

  it("çıkış / kilit görünümü verisi (çoğu alan null) yalnızca dolu alanlarla kalır", () => {
    const signedOut = {
      state: "signedOut",
      myName: "",
      partnerName: "",
      startDate: null,
      premiumUntilMs: null,
      partnerMoodEmoji: null,
      partnerMoodLabel: null,
      moodDate: null,
      myAvatarPath: null,
      partnerAvatarPath: null,
      unreadCount: 0,
      letterUnlocksMs: [] as number[],
      language: "tr",
      strings: { title: "Aşkımızın Yolculuğu" },
    };
    const result = withoutNulls(signedOut);
    expect(Object.values(result).some((value) => value === null)).toBe(false);
    expect(result).toEqual({
      state: "signedOut",
      myName: "",
      partnerName: "",
      unreadCount: 0,
      letterUnlocksMs: [],
      language: "tr",
      strings: { title: "Aşkımızın Yolculuğu" },
    });
  });

  it("girdiyi değiştirmez", () => {
    const input = { a: null, b: 1 };
    withoutNulls(input);
    expect(input).toEqual({ a: null, b: 1 });
  });
});
