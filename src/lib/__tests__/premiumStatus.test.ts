import { derivePremiumPhase, PREMIUM_GRACE_DAYS } from "../premiumStatus";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-04T12:00:00Z");
const iso = (offsetDays: number) => new Date(NOW + offsetDays * DAY).toISOString();

describe("derivePremiumPhase", () => {
  it("hiç Premium olmamış çift ücretsizdir", () => {
    expect(derivePremiumPhase({ isPremium: false, premiumExpiresAt: null, now: NOW }).phase).toBe("free");
  });

  it("bitişi olmayan etkin Premium süresizdir", () => {
    expect(derivePremiumPhase({ isPremium: true, premiumExpiresAt: null, now: NOW }).phase).toBe("lifetime");
  });

  it("bitişi gelecekte olan Premium etkindir ve kalan günü verir", () => {
    const result = derivePremiumPhase({ isPremium: true, premiumExpiresAt: iso(10), now: NOW });
    expect(result.phase).toBe("active");
    expect(result.daysUntilEnd).toBe(10);
  });

  it("Premium bitince 14 günlük yenileme süresi başlar", () => {
    const result = derivePremiumPhase({ isPremium: false, premiumExpiresAt: iso(-1), now: NOW });
    expect(result.phase).toBe("grace");
    expect(result.graceDaysLeft).toBe(PREMIUM_GRACE_DAYS - 1);
  });

  it("bitişin hemen ardından 14 gün kalır", () => {
    const result = derivePremiumPhase({ isPremium: false, premiumExpiresAt: iso(0), now: NOW });
    expect(result.graceDaysLeft).toBe(PREMIUM_GRACE_DAYS);
  });

  it("yenileme süresinin son gününde en az 1 gün gösterir", () => {
    const result = derivePremiumPhase({ isPremium: false, premiumExpiresAt: iso(-(PREMIUM_GRACE_DAYS - 0.2)), now: NOW });
    expect(result.phase).toBe("grace");
    expect(result.graceDaysLeft).toBe(1);
  });

  it("14 gün geçince süre dolmuştur", () => {
    expect(derivePremiumPhase({ isPremium: false, premiumExpiresAt: iso(-PREMIUM_GRACE_DAYS - 1), now: NOW }).phase).toBe("expired");
  });

  it("mağaza iadesiyle erken kapanan Premium da bitiş tarihinden itibaren sayılır", () => {
    const result = derivePremiumPhase({ isPremium: false, premiumExpiresAt: iso(5), now: NOW });
    expect(result.phase).toBe("grace");
    expect(result.graceDaysLeft).toBe(PREMIUM_GRACE_DAYS + 5);
  });

  it("geçersiz bitiş tarihi ücretsiz sayılır", () => {
    expect(derivePremiumPhase({ isPremium: false, premiumExpiresAt: "bozuk", now: NOW }).phase).toBe("free");
  });
});
