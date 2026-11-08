import * as Application from "expo-application";
import type { TFunction } from "i18next";
import { Platform } from "react-native";
import i18n from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { safeStorage } from "@/lib/safeStorage";
import { ANDROID_PACKAGE, APPLE_APP_ID, APP_NAME } from "@/constants/brand";

/**
 * Çift Arkadaşını Davet Et. Kuralların ve ödüllerin tek kaynağı sunucudur
 * (supabase/migrations/20261104000006_couple_referrals.sql): kod girmek tek başına ödül vermez; kodu giren
 * kişi sevgilisiyle eşleşip 2 kişilik bir çift olduğu an iki çifte de ödül verilir. İstemci yalnızca kodu
 * gönderir ve durumu okur.
 */

export const REFERRAL_CODE_PREFIX = "SKY";
const REFERRAL_CODE_BODY_LENGTH = 5;
export const REFERRAL_CODE_LENGTH = REFERRAL_CODE_PREFIX.length + REFERRAL_CODE_BODY_LENGTH;
/** Sunucudaki CHECK ile aynı alfabe (0/O, 1/I/L yok) */
const REFERRAL_CODE_PATTERN = /^SKY[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}$/;

/**
 * Sunucu kuralları (referral_reward_period / referral_reward_tokens / referral_reward_quota). Ekranlar sunucunun
 * döndürdüğü değeri gösterir; bunlar yalnızca veri gelmeden önceki metinler için.
 */
export const DEFAULT_REFERRAL_REWARD_DAYS = 3;
const DEFAULT_REFERRAL_REWARD_TOKENS = 250;
const DEFAULT_REFERRAL_QUOTA = 5;

/** Davet bağlantısıyla gelen, hesap eşleşme ekranına ulaşınca girilecek kod */
export const PENDING_REFERRAL_CODE_KEY = "@pending_referral_code";
/** Play Install Referrer bu kurulumda okundu (kurulum başına bir kez) */
const INSTALL_REFERRER_READ_KEY = "@install_referrer_read";
/** Play Store yanıt vermezse eşleşme ekranı bekletilmez */
const INSTALL_REFERRER_TIMEOUT_MS = 3000;
const INSTALL_REFERRER_UNAVAILABLE = "ERR_APPLICATION_INSTALL_REFERRER_UNAVAILABLE";

export type ReferralStatus = "pending" | "rewarded" | "rejected";
/** Davet edilen çiftin ödülü (premium_days / premium_extended / tokens) ya da davet edenin ek durumları */
export type ReferralReward = "premium_days" | "premium_extended" | "tokens" | "quota_reached" | "none";

export interface ReferralInvitee {
  readonly id: number;
  /** Eşleşen çiftte iki ilk ad, bekleyen kişide kendi ilk adı; okunamazsa null */
  readonly label: string | null;
  readonly status: ReferralStatus;
  /** Davet edenin bu davetten aldığı ödül (yalnızca rewarded) */
  readonly reward: ReferralReward | null;
}

export interface MyReferral {
  readonly status: ReferralStatus;
  readonly reward: ReferralReward | null;
  /** Davet eden çiftin etiketi (yalnızca rewarded) */
  readonly inviterLabel: string | null;
}

export interface ReferralOverview {
  /** Çiftin davet kodu; yalnızca eşleşmiş çiftte */
  readonly code: string | null;
  readonly rewardDays: number;
  readonly rewardTokens: number;
  /** Davet edenin en fazla kaç davetten ödül alacağı */
  readonly quota: number;
  readonly rewardedCount: number;
  readonly hasStar: boolean;
  /** Bu kullanıcı hâlâ bir davet kodu girebilir mi (yeni hesap, çift henüz davet edilmemiş) */
  readonly canEnterCode: boolean;
  /** Bu çiftin kendisinin girdiği davet */
  readonly myReferral: MyReferral | null;
  readonly invitees: readonly ReferralInvitee[];
}

export interface ReferralStarInvite {
  readonly friendLabel: string | null;
  readonly friendStarName: string | null;
  readonly ra: number;
  readonly dec: number;
  readonly catalogId: number;
  /** true: bizi davet eden çiftin yıldızı; false: bizim davet ettiğimiz çiftin yıldızı */
  readonly invitedUs: boolean;
}

export interface ApplyReferralResult {
  readonly status: ReferralStatus | null;
  /** Sunucunun hata kodu (INVALID_CODE, NOT_ELIGIBLE...) ya da ağ / RPC hatası metni */
  readonly error: string | null;
}

// ─── Kod biçimi ───────────────────────────────────────────────────────────────

/** Yazılan / yapıştırılan metni büyük harfli, ayraçsız biçime getirir (Türkçe "İ/ı/i" → "I"). */
export function cleanReferralInput(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/[İıi]/g, "I")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, REFERRAL_CODE_LENGTH);
}

/** Gönderilecek kod: önek yazılmadıysa (yalnızca 5 karakter) eklenir. */
export function normalizeReferralCode(raw: string | null | undefined): string {
  const cleaned = cleanReferralInput(raw);
  return cleaned.length === REFERRAL_CODE_BODY_LENGTH && !cleaned.startsWith(REFERRAL_CODE_PREFIX)
    ? REFERRAL_CODE_PREFIX + cleaned
    : cleaned;
}

export function isReferralCode(raw: string | null | undefined): boolean {
  return REFERRAL_CODE_PATTERN.test(normalizeReferralCode(raw));
}

/**
 * Eşleşme kodu kutusuna yapıştırılan metin aslında bir davet kodu mu? Eşleşme kodu 6 karakterdir; "SKY" ile
 * başlayan 8 karakterlik kod ancak bir davet kodu olabilir.
 */
export function looksLikeReferralCode(raw: string | null | undefined): boolean {
  const cleaned = (raw ?? "").replace(/[İıi]/g, "I").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.length === REFERRAL_CODE_LENGTH && REFERRAL_CODE_PATTERN.test(cleaned);
}

/** Ekranda ve paylaşımda okunaklı biçim: SKY-T4MAU */
export function formatReferralCode(code: string): string {
  const normalized = normalizeReferralCode(code);
  return normalized.startsWith(REFERRAL_CODE_PREFIX)
    ? `${REFERRAL_CODE_PREFIX}-${normalized.slice(REFERRAL_CODE_PREFIX.length)}`
    : normalized;
}

/**
 * Çiftin özel davet bağlantısı (mağaza sayfası). Kod `referrer` parametresinde taşınır; arkadaş uygulamayı bu
 * bağlantıdan kurarsa kod Play Install Referrer'dan okunur (bkz. captureInstallReferrerCode).
 */
export function buildReferralInviteLink(code: string): string {
  const referrer = encodeURIComponent(`utm_source=referral&utm_content=${normalizeReferralCode(code)}`);
  return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&referrer=${referrer}`;
}

/**
 * App Store sayfası. iOS'ta Play Install Referrer gibi bir kurulum kanalı yoktur: kod bağlantıyla taşınamaz,
 * arkadaş kodu paylaşım metninden eşleşme ekranına yapıştırır (looksLikeReferralCode bunu davet kodu olarak tanır).
 */
export function buildReferralIosLink(): string {
  return `https://apps.apple.com/app/id${APPLE_APP_ID}`;
}

/**
 * Arkadaşın telefonu bilinmediği için iki mağaza bağlantısı birlikte verilir; paylaşım metni ve "bağlantıyı
 * kopyala" düğmesi bunu kullanır. Platform adları dil bağımsızdır.
 */
export function buildReferralStoreLinks(code: string): string {
  return [`Android: ${buildReferralInviteLink(code)}`, `iPhone: ${buildReferralIosLink()}`].join("\n");
}

/**
 * Play Install Referrer metninden davet kodunu çıkarır ("utm_source=referral&utm_content=SKYT4MAU"). Play bu
 * metnin tam bir URL olmayabileceğini söylüyor: yalnızca anahtar=değer çiftlerine bakılır. Organik kurulumlar
 * ("utm_source=google-play&utm_medium=organic") ve başka kampanyalar null döner.
 */
export function parseInstallReferrerCode(referrer: unknown): string | null {
  if (typeof referrer !== "string" || !referrer) return null;
  const query = referrer.includes("?") ? referrer.slice(referrer.indexOf("?") + 1) : referrer;

  const params = new Map<string, string>();
  for (const pair of query.split("&")) {
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    params.set(decodeQueryPart(pair.slice(0, separator)), decodeQueryPart(pair.slice(separator + 1)));
  }

  if (params.get("utm_source") !== "referral") return null;
  const code = params.get("utm_content");
  return isReferralCode(code) ? normalizeReferralCode(code) : null;
}

function decodeQueryPart(part: string): string {
  try {
    return decodeURIComponent(part.replace(/\+/g, " "));
  } catch {
    return part;
  }
}

/** Uygulama yüklüyse davet kodunu doğrudan açan bağlantı */
export function buildReferralAppLink(code: string): string {
  return `couplesapp://refer?code=${normalizeReferralCode(code)}`;
}

export function buildReferralShareMessage(
  t: TFunction,
  { code, hasStar, rewardDays }: { code: string; hasStar: boolean; rewardDays: number }
): string {
  return [
    hasStar
      ? t("referral.share.introWithStar", { app: APP_NAME, days: rewardDays })
      : t("referral.share.introNoStar", { app: APP_NAME, days: rewardDays }),
    "",
    t("referral.share.codeLine", { code: formatReferralCode(code) }),
    t("referral.share.howTo"),
    "",
    buildReferralStoreLinks(code),
  ].join("\n");
}

// ─── Hatalar ──────────────────────────────────────────────────────────────────

/** Sunucu kodu kesin olarak reddetti mi? (Ağ hatası değil; aynı kodu tekrar denemek işe yaramaz) */
export function isDefinitiveReferralError(code: string | null | undefined): boolean {
  return !!code && /INVALID_CODE|SELF_CODE|NOT_ELIGIBLE|ALREADY_REFERRED|COUPLE_ALREADY_REFERRED/.test(code);
}

export function translateReferralError(code: string | null | undefined): string {
  switch (code) {
    case "INVALID_CODE":
      return i18n.t("referral.errors.invalidCode");
    case "SELF_CODE":
      return i18n.t("referral.errors.selfCode");
    case "NOT_ELIGIBLE":
      return i18n.t("referral.errors.notEligible");
    case "ALREADY_REFERRED":
      return i18n.t("referral.errors.alreadyReferred");
    case "COUPLE_ALREADY_REFERRED":
      return i18n.t("referral.errors.coupleAlreadyReferred");
    case "TOO_MANY_REQUESTS":
      return i18n.t("auth.errors.tooManyAttempts");
    default:
      return i18n.t("referral.errors.generic");
  }
}

// ─── Sunucu yanıtlarının ayrıştırılması ───────────────────────────────────────

const STATUSES: readonly ReferralStatus[] = ["pending", "rewarded", "rejected"];
const REWARDS: readonly ReferralReward[] = ["premium_days", "premium_extended", "tokens", "quota_reached", "none"];

function asStatus(value: unknown): ReferralStatus | null {
  return STATUSES.find((status) => status === value) ?? null;
}

function asReward(value: unknown): ReferralReward | null {
  return REWARDS.find((reward) => reward === value) ?? null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Sayı ya da sayısal metin (PostgREST NUMERIC'i metin döndürebilir); null / boş metin sayı sayılmaz */
function asNumber(value: unknown, fallback: number): number {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function parseReferralOverview(raw: unknown): ReferralOverview {
  const data = asRecord(raw) ?? {};
  const mine = asRecord(data.my_referral);
  const myStatus = asStatus(mine?.status);
  const invitees = Array.isArray(data.invitees) ? data.invitees : [];

  return {
    code: asText(data.code),
    rewardDays: asNumber(data.reward_days, DEFAULT_REFERRAL_REWARD_DAYS),
    rewardTokens: asNumber(data.reward_tokens, DEFAULT_REFERRAL_REWARD_TOKENS),
    quota: asNumber(data.quota, DEFAULT_REFERRAL_QUOTA),
    rewardedCount: asNumber(data.rewarded_count, 0),
    hasStar: data.has_star === true,
    canEnterCode: data.can_enter_code === true,
    myReferral: myStatus
      ? { status: myStatus, reward: asReward(mine?.reward), inviterLabel: asText(mine?.inviter_label) }
      : null,
    invitees: invitees.flatMap((item): ReferralInvitee[] => {
      const row = asRecord(item);
      const status = asStatus(row?.status);
      const id = asNumber(row?.id, NaN);
      if (!row || !status || !Number.isFinite(id)) return [];
      return [{ id, label: asText(row.label), status, reward: asReward(row.reward) }];
    }),
  };
}

export function parseReferralStarInvite(raw: unknown): ReferralStarInvite | null {
  const row = asRecord(Array.isArray(raw) ? raw[0] : raw);
  if (!row) return null;
  const ra = asNumber(row.friend_ra, NaN);
  const dec = asNumber(row.friend_dec, NaN);
  const catalogId = asNumber(row.friend_catalog_id, NaN);
  if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(catalogId)) return null;
  return {
    friendLabel: asText(row.friend_label),
    friendStarName: asText(row.friend_star_name),
    ra,
    dec,
    catalogId,
    invitedUs: row.invited_us === true,
  };
}

// ─── RPC'ler ──────────────────────────────────────────────────────────────────

/** Davet penceresinin verisi; eşleşmiş çiftin kodu yoksa sunucu üretir. */
export async function fetchReferralOverview(): Promise<ReferralOverview> {
  const { data, error } = await supabase.rpc("get_my_referral_overview");
  if (error) throw error;
  return parseReferralOverview(data);
}

/**
 * Davet kodunu girer. Sunucu kod tahmini belirtisi olan sonuçları (geçersiz kod, deneme sınırı) hata yerine
 * `result_error` ile döndürür (bkz. migration 20261104000006). Eşleşmiş çiftte ödül hemen değerlendirilir.
 */
export async function applyReferralCode(code: string): Promise<ApplyReferralResult> {
  const { data, error } = await supabase.rpc("apply_referral_code", { p_code: normalizeReferralCode(code) });
  if (error) return { status: null, error: error.message };

  const row = asRecord(Array.isArray(data) ? data[0] : data);
  const serverError = asText(row?.result_error);
  if (serverError) return { status: null, error: serverError };
  return { status: asStatus(row?.result_status), error: null };
}

async function readInstallReferrer(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    if (await safeStorage.getItem(INSTALL_REFERRER_READ_KEY)) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("install referrer timeout")), INSTALL_REFERRER_TIMEOUT_MS);
    });
    const referrer = await Promise.race([Application.getInstallReferrerAsync(), timeout]).finally(() =>
      clearTimeout(timer)
    );

    // Açık bir bağlantıyla (couplesapp://refer) gelmiş kodun yerine geçmez
    const code = parseInstallReferrerCode(referrer);
    if (code && !(await safeStorage.getItem(PENDING_REFERRAL_CODE_KEY))) {
      await safeStorage.setItem(PENDING_REFERRAL_CODE_KEY, code);
    }
    await safeStorage.setItem(INSTALL_REFERRER_READ_KEY, "1");
  } catch (cause) {
    // Play Store yok / API desteklenmiyor: bu kurulumda hiç okunamaz. Bağlantı kopması ya da zaman aşımı
    // geçicidir; bir sonraki açılışta yeniden denenir.
    const errorCode = typeof cause === "object" && cause !== null ? (cause as { code?: unknown }).code : undefined;
    if (errorCode === INSTALL_REFERRER_UNAVAILABLE) {
      await safeStorage.setItem(INSTALL_REFERRER_READ_KEY, "1").catch(() => undefined);
    }
  }
}

let installReferrerRead: Promise<void> | null = null;

/**
 * Uygulama Play Store'daki davet bağlantısından kurulduysa bağlantıdaki kodu bekleyen koda yazar; arkadaş kodu
 * elle girmek zorunda kalmaz. Kurulum başına bir kez (oturumda tek çağrı) okunur ve hata fırlatmaz.
 */
export function captureInstallReferrerCode(): Promise<void> {
  installReferrerRead ??= readInstallReferrer();
  return installReferrerRead;
}

/**
 * Davet bağlantısıyla gelip saklanan kodu girer (bekleyen kod yoksa null). Kurulum bağlantısındaki kod da
 * burada okunur. Sonuç kesinse (kabul ya da kesin red) kod silinir; ağ hatasında ya da deneme sınırında bir
 * sonraki denemeye kalır.
 */
export async function applyPendingReferralCode(): Promise<(ApplyReferralResult & { code: string }) | null> {
  await captureInstallReferrerCode();
  const stored = await safeStorage.getItem(PENDING_REFERRAL_CODE_KEY);
  if (!stored) return null;
  if (!isReferralCode(stored)) {
    await safeStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
    return null;
  }

  const code = normalizeReferralCode(stored);
  const result = await applyReferralCode(code).catch(
    (cause: unknown): ApplyReferralResult => ({ status: null, error: cause instanceof Error ? cause.message : null })
  );
  if (result.status || isDefinitiveReferralError(result.error)) {
    await safeStorage.removeItem(PENDING_REFERRAL_CODE_KEY);
  }
  return { ...result, code };
}

/** Gökkubbe davet kartı: yıldızımız yokken davetle bağlı arkadaş çiftin yıldızı (yoksa null). */
export async function fetchReferralStarInvite(): Promise<ReferralStarInvite | null> {
  const { data, error } = await supabase.rpc("get_referral_star_invite");
  if (error) throw error;
  return parseReferralStarInvite(data);
}
