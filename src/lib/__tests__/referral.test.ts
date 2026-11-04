/// <reference types="jest" />
import type { TFunction } from "i18next";
import { supabase } from "@/lib/supabase";
import {
  PENDING_REFERRAL_CODE_KEY,
  applyPendingReferralCode,
  applyReferralCode,
  buildReferralInviteLink,
  buildReferralShareMessage,
  cleanReferralInput,
  formatReferralCode,
  isDefinitiveReferralError,
  isReferralCode,
  looksLikeReferralCode,
  normalizeReferralCode,
  parseReferralOverview,
  parseReferralStarInvite,
  translateReferralError,
} from "../referral";

const mockStore = new Map<string, string>();

jest.mock("@/lib/i18n", () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock("@/lib/supabase", () => ({ supabase: { rpc: jest.fn() } }));
jest.mock("@/lib/safeStorage", () => ({
  safeStorage: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStore.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      mockStore.delete(key);
      return Promise.resolve();
    }),
  },
}));

const rpc = supabase.rpc as unknown as jest.Mock;

describe("davet kodu biçimi", () => {
  it("ayraçları ve küçük harfleri temizler, Türkçe i harflerini I yapar", () => {
    expect(cleanReferralInput("sky-t4m au")).toBe("SKYT4MAU");
    expect(cleanReferralInput("skyİıi")).toBe("SKYIII");
    expect(cleanReferralInput(null)).toBe("");
  });

  it("8 karakterle sınırlar", () => {
    expect(cleanReferralInput("SKYT4MAU99")).toBe("SKYT4MAU");
  });

  it("yalnızca 5 karakter yazıldıysa öneki ekler", () => {
    expect(normalizeReferralCode("t4mau")).toBe("SKYT4MAU");
    expect(normalizeReferralCode("SKY-T4MAU")).toBe("SKYT4MAU");
  });

  it("sunucu alfabesine uymayan kodları reddeder", () => {
    expect(isReferralCode("SKY-T4MAU")).toBe(true);
    expect(isReferralCode("t4mau")).toBe(true);
    expect(isReferralCode("SKY-T4MA0")).toBe(false); // 0 alfabede yok
    expect(isReferralCode("SKY-T4MA")).toBe(false);
    expect(isReferralCode("ABC123")).toBe(false);
  });

  it("eşleşme kutusuna yapıştırılan davet kodunu tanır, eşleşme kodunu tanımaz", () => {
    expect(looksLikeReferralCode("SKY-T4MAU")).toBe(true);
    expect(looksLikeReferralCode("SKYT4M")).toBe(false);
    expect(looksLikeReferralCode("T4MAU")).toBe(false);
  });

  it("ekranda tireli gösterir", () => {
    expect(formatReferralCode("SKYT4MAU")).toBe("SKY-T4MAU");
  });

  it("mağaza bağlantısı kodu referrer parametresinde taşır", () => {
    const link = buildReferralInviteLink("sky-t4mau");
    expect(link).toContain("id=app.couplesky.mobile");
    expect(decodeURIComponent(link.split("referrer=")[1])).toBe("utm_source=referral&utm_content=SKYT4MAU");
  });

  it("paylaşım metni kodu, nasıl yapılır satırını ve bağlantıyı içerir; yıldız durumuna göre giriş seçer", () => {
    const t = ((key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key) as unknown as TFunction;
    const withStar = buildReferralShareMessage(t, { code: "SKYT4MAU", hasStar: true, rewardDays: 3 });
    expect(withStar).toContain("referral.share.introWithStar");
    expect(withStar).toContain('"code":"SKY-T4MAU"');
    expect(withStar).toContain("referral.share.howTo");
    expect(withStar).toContain("https://play.google.com/store/apps/details?id=app.couplesky.mobile");
    expect(buildReferralShareMessage(t, { code: "SKYT4MAU", hasStar: false, rewardDays: 3 })).toContain(
      "referral.share.introNoStar"
    );
  });
});

describe("davet hataları", () => {
  it("kesin redleri ağ hatasından ayırır", () => {
    expect(isDefinitiveReferralError("INVALID_CODE")).toBe(true);
    expect(isDefinitiveReferralError("COUPLE_ALREADY_REFERRED")).toBe(true);
    expect(isDefinitiveReferralError("TOO_MANY_REQUESTS")).toBe(false);
    expect(isDefinitiveReferralError("Network request failed")).toBe(false);
    expect(isDefinitiveReferralError(null)).toBe(false);
  });

  it("sunucu kodlarını çeviri anahtarına, bilinmeyenleri genel hataya çevirir", () => {
    expect(translateReferralError("NOT_ELIGIBLE")).toBe("referral.errors.notEligible");
    expect(translateReferralError("TOO_MANY_REQUESTS")).toBe("auth.errors.tooManyAttempts");
    expect(translateReferralError("boom")).toBe("referral.errors.generic");
  });
});

describe("sunucu yanıtlarının ayrıştırılması", () => {
  it("davet penceresini okur, bozuk satırları atlar", () => {
    const overview = parseReferralOverview({
      code: "SKYT4MAU",
      reward_days: 3,
      reward_tokens: 250,
      quota: 5,
      rewarded_count: 2,
      has_star: true,
      can_enter_code: false,
      my_referral: { status: "rewarded", reward: "premium_days", inviter_label: "Ayşe 💕 Ahmet" },
      invitees: [
        { id: 7, label: "Banu 💕 Burak", status: "rewarded", reward: "premium_extended" },
        { id: 8, label: null, status: "pending", reward: null },
        { id: "x", status: "rewarded" },
        { id: 9, status: "unknown" },
      ],
    });
    expect(overview).toEqual({
      code: "SKYT4MAU",
      rewardDays: 3,
      rewardTokens: 250,
      quota: 5,
      rewardedCount: 2,
      hasStar: true,
      canEnterCode: false,
      myReferral: { status: "rewarded", reward: "premium_days", inviterLabel: "Ayşe 💕 Ahmet" },
      invitees: [
        { id: 7, label: "Banu 💕 Burak", status: "rewarded", reward: "premium_extended" },
        { id: 8, label: null, status: "pending", reward: null },
      ],
    });
  });

  it("boş yanıtta güvenli varsayılanlara döner", () => {
    const overview = parseReferralOverview(null);
    expect(overview.code).toBeNull();
    expect(overview.rewardDays).toBe(3);
    expect(overview.quota).toBe(5);
    expect(overview.myReferral).toBeNull();
    expect(overview.invitees).toEqual([]);
  });

  it("Gökkubbe kartı satırını okur; koordinatsız satırı yok sayar", () => {
    expect(
      parseReferralStarInvite([
        { friend_label: "Ayşe 💕 Ahmet", friend_star_name: null, friend_ra: "12.5", friend_dec: -3, friend_catalog_id: 42, invited_us: true },
      ])
    ).toEqual({ friendLabel: "Ayşe 💕 Ahmet", friendStarName: null, ra: 12.5, dec: -3, catalogId: 42, invitedUs: true });
    expect(parseReferralStarInvite([])).toBeNull();
    expect(parseReferralStarInvite([{ friend_label: "x", friend_ra: null, friend_dec: 1, friend_catalog_id: 1 }])).toBeNull();
  });
});

describe("applyReferralCode", () => {
  beforeEach(() => rpc.mockReset());

  it("kodu normalize edip gönderir ve durumu döndürür", async () => {
    rpc.mockResolvedValue({ data: [{ result_status: "pending", result_error: null }], error: null });
    await expect(applyReferralCode("sky-t4mau")).resolves.toEqual({ status: "pending", error: null });
    expect(rpc).toHaveBeenCalledWith("apply_referral_code", { p_code: "SKYT4MAU" });
  });

  it("sunucunun result_error alanını hata olarak sunar", async () => {
    rpc.mockResolvedValue({ data: [{ result_status: null, result_error: "INVALID_CODE" }], error: null });
    await expect(applyReferralCode("SKYT4MAU")).resolves.toEqual({ status: null, error: "INVALID_CODE" });
  });

  it("RPC hatasını metniyle iletir", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Network request failed" } });
    await expect(applyReferralCode("SKYT4MAU")).resolves.toEqual({ status: null, error: "Network request failed" });
  });
});

describe("applyPendingReferralCode", () => {
  beforeEach(() => {
    rpc.mockReset();
    mockStore.clear();
  });

  it("bekleyen kod yoksa hiçbir şey yapmaz", async () => {
    await expect(applyPendingReferralCode()).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("geçersiz biçimli kodu sunucuya göndermeden siler", async () => {
    mockStore.set(PENDING_REFERRAL_CODE_KEY, "HELLO");
    await expect(applyPendingReferralCode()).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
    expect(mockStore.has(PENDING_REFERRAL_CODE_KEY)).toBe(false);
  });

  it("kabul edilen kodu siler", async () => {
    mockStore.set(PENDING_REFERRAL_CODE_KEY, "SKYT4MAU");
    rpc.mockResolvedValue({ data: [{ result_status: "pending", result_error: null }], error: null });
    await expect(applyPendingReferralCode()).resolves.toEqual({ status: "pending", error: null, code: "SKYT4MAU" });
    expect(mockStore.has(PENDING_REFERRAL_CODE_KEY)).toBe(false);
  });

  it("kesin reddedilen kodu siler", async () => {
    mockStore.set(PENDING_REFERRAL_CODE_KEY, "SKYT4MAU");
    rpc.mockResolvedValue({ data: [{ result_status: null, result_error: "SELF_CODE" }], error: null });
    await applyPendingReferralCode();
    expect(mockStore.has(PENDING_REFERRAL_CODE_KEY)).toBe(false);
  });

  it("ağ hatasında ve deneme sınırında kodu sonraki denemeye saklar", async () => {
    mockStore.set(PENDING_REFERRAL_CODE_KEY, "SKYT4MAU");
    rpc.mockResolvedValueOnce({ data: null, error: { message: "Network request failed" } });
    await applyPendingReferralCode();
    expect(mockStore.get(PENDING_REFERRAL_CODE_KEY)).toBe("SKYT4MAU");

    rpc.mockResolvedValueOnce({ data: [{ result_status: null, result_error: "TOO_MANY_REQUESTS" }], error: null });
    await applyPendingReferralCode();
    expect(mockStore.get(PENDING_REFERRAL_CODE_KEY)).toBe("SKYT4MAU");
  });

  it("fırlatan istekte de kodu saklar", async () => {
    mockStore.set(PENDING_REFERRAL_CODE_KEY, "SKYT4MAU");
    rpc.mockRejectedValue(new Error("offline"));
    await expect(applyPendingReferralCode()).resolves.toEqual({ status: null, error: "offline", code: "SKYT4MAU" });
    expect(mockStore.get(PENDING_REFERRAL_CODE_KEY)).toBe("SKYT4MAU");
  });
});
