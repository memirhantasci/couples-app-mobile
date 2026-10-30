/// <reference types="jest" />
import { istanbulToday, letterOpenedAt, letterUnlockAt } from "../letterPolicy";

describe("mektup açılışı (Türkiye saati)", () => {
  it("açılış anı unlock_date günü 00:00 Türkiye saatidir (önceki günün 21:00 UTC'si)", () => {
    expect(new Date(letterUnlockAt({ unlock_date: "2026-11-05" })).toISOString()).toBe("2026-11-04T21:00:00.000Z");
  });

  it("geçersiz tarihte hiç açılmaz", () => {
    expect(letterUnlockAt({ unlock_date: null })).toBe(Number.POSITIVE_INFINITY);
  });

  it("açılıştan sonra yazılan mektubun açılış anı yazılma anıdır", () => {
    const created = "2026-12-01T10:00:00.000Z";
    expect(letterOpenedAt({ unlock_date: "2026-11-05", created_at: created })).toBe(Date.parse(created));
  });

  it("istanbulToday: UTC 21:00 sonrası Türkiye'de ertesi gündür", () => {
    expect(istanbulToday(Date.parse("2026-11-04T20:59:59Z"))).toBe("2026-11-04");
    expect(istanbulToday(Date.parse("2026-11-04T21:00:00Z"))).toBe("2026-11-05");
  });
});
