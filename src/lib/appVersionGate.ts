/**
 * Zorunlu güncelleme kapısı: karar mantığının tek kaynağı (saf; React, Supabase ve depolama bağımlılığı yoktur).
 *
 * Sunucu: supabase/migrations/20261111000000_app_version_gate.sql (`get_app_version_requirement`).
 * Kanca: src/hooks/useAppVersionGate.ts · Ekran: src/components/common/ForceUpdateScreen.tsx
 * İşletim notu: docs/ZORUNLU_GUNCELLEME.md
 *
 * EN ÖNEMLİ KURAL: bu kapıdaki bir hata herkesi uygulamanın dışında bırakır. Bu yüzden her belirsizlikte kapı
 * AÇIK kalır. Kapı yalnızca geçerli bir asgari sürüm bilindiğinde (sunucudan ya da sunucudan daha önce okunmuş
 * geçerli önbellekten) ve cihazdaki sürüm ondan KESİN olarak küçük olduğunda kapanır.
 *
 * Sürüm kaynağı: ikilinin kendi görünen sürümü (expo-application `nativeApplicationVersion`: iOS
 * CFBundleShortVersionString, Android versionName). OTA güncellemesi bu değeri değiştirmez; `Constants.expoConfig.version`
 * ise OTA ile gelen yapılandırmayı gösterir, bu yüzden kullanılmaz. Aynı görünen sürümün build'lerini ayırmak için
 * sunucuda isteğe bağlı `min_build` vardır (iOS CFBundleVersion / Android versionCode); yalnızca sürüm EŞİTKEN uygulanır.
 */

import { ANDROID_PACKAGE, APPLE_APP_ID } from "@/constants/brand";

export type GatePlatform = "ios" | "android";

/** Sunucudaki satırın istemcideki karşılığı. Alanlar ayrıştırılmış ve doğrulanmıştır; geçersiz alan null'dır. */
export interface VersionRequirement {
  /** Ayrıştırılmış asgari görünen sürüm; null = kapı kapalı (her sürüm geçer). */
  minVersion: string | null;
  /** Aynı görünen sürümdeki asgari build; yalnızca minVersion doluyken anlamlıdır. */
  minBuild: number | null;
  storeUrl: string | null;
  messageTr: string | null;
  messageEn: string | null;
}

/** Sunucu sorgusunun sonucu. "ok" + null = sunucu "bu platform için koşul yok" dedi (geçerli yanıt). */
export type FetchOutcome =
  | { kind: "ok"; requirement: VersionRequirement | null }
  | { kind: "error"; reason: "network" | "timeout" | "rpc" | "malformed" };

export type GateDecision =
  | {
      locked: false;
      reason: "demo" | "unsupported-platform" | "no-requirement" | "device-version-unknown" | "up-to-date";
    }
  | {
      locked: true;
      reason: "below-min-version" | "below-min-build";
      storeUrl: string;
      /** Sunucudan gelen geçerli metin; null ise ekran yerel metni gösterir. */
      messageTr: string | null;
      messageEn: string | null;
    };

// ─── Sabitler ────────────────────────────────────────────────────────────────

export const APP_VERSION_RPC = "get_app_version_requirement";
/** Son başarılı sunucu yanıtı (sürüm: şema değişirse anahtar değişir, eski kayıt okunmaz). */
export const GATE_CACHE_KEY = "@app_version_gate_v1";
/** Önbellekteki yanıt en fazla bu kadar eski olabilir; daha eskisi "bilinmiyor" sayılır (kapı açık). */
export const GATE_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** Sorgu bu sürede yanıt vermezse vazgeçilir (kapı önbelleğe / açığa düşer). */
export const GATE_FETCH_TIMEOUT_MS = 8000;
/** Uygulama öne geldiğinde en sık bu aralıkla sorulur. */
export const GATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
/** Kapı kapalıyken daha sık sorulur: sunucuda geri alınırsa kullanıcı çabuk içeri girsin. */
export const GATE_LOCKED_CHECK_INTERVAL_MS = 60 * 1000;
/** Sunucu metni en fazla bu uzunlukta gösterilir (migration'daki CHECK ile aynı). */
export const GATE_MESSAGE_MAX_LENGTH = 300;

/** Mağaza adresleri (sunucu adresi yoksa / geçersizse kullanılır; migration'daki başlangıç değerleriyle aynı). */
export const DEFAULT_STORE_URLS: Readonly<Record<GatePlatform, string>> = {
  ios: `https://apps.apple.com/app/id${APPLE_APP_ID}`,
  android: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
};

/** Sunucudan gelen mağaza adresi yalnızca bu alan adlarındaysa kullanılır. */
const STORE_HOSTS: Readonly<Record<GatePlatform, readonly string[]>> = {
  ios: ["apps.apple.com", "itunes.apple.com"],
  android: ["play.google.com"],
};

// ─── Sürüm ayrıştırma ve karşılaştırma ───────────────────────────────────────

/** Migration'daki CHECK ile aynı biçim: 1-4 parça, her parça 1-6 rakam. Ön ek, son ek, boşluk kabul edilmez. */
const VERSION_PATTERN = /^\d{1,6}(\.\d{1,6}){0,3}$/;

/** "1.10.2" → [1, 10, 2]. Geçersiz her değerde null. */
export function parseVersion(value: unknown): number[] | null {
  if (typeof value !== "string" || !VERSION_PATTERN.test(value)) return null;
  return value.split(".").map((part) => Number(part));
}

/** Eksik parçalar 0 sayılır: "1.1" = "1.1.0". Sonuç: a<b → -1, a=b → 0, a>b → 1. */
export function compareVersions(a: readonly number[], b: readonly number[]): -1 | 0 | 1 {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/** Build numarası: pozitif tam sayı (sayı ya da yalnızca rakamlardan oluşan metin). Geçersizse null. */
export function parseBuild(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647 ? value : null;
  }
  if (typeof value !== "string" || !/^\d{1,10}$/.test(value)) return null;
  return parseBuild(Number(value));
}

// ─── Sunucu yanıtı ───────────────────────────────────────────────────────────

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= GATE_MESSAGE_MAX_LENGTH ? trimmed : null;
}

/** Yalnızca https ve platformun mağaza alan adı. Diğer her şeyde null (istemci kendi adresini kullanır). */
export function cleanStoreUrl(value: unknown, platform: GatePlatform): string | null {
  if (typeof value !== "string" || value.length > 300) return null;
  const match = /^https:\/\/([a-z0-9.-]+)(?:[/?#]|$)/i.exec(value);
  if (!match) return null;
  return STORE_HOSTS[platform].includes(match[1].toLowerCase()) ? value : null;
}

/**
 * RPC yanıtını ayrıştırır. `null` = sunucuda bu platform için satır yok (geçerli, kapı açık).
 * Nesne değilse ya da başka platformun satırıysa "malformed" (sorgu hatası gibi davranılır).
 * Nesnenin tek tek alanları bozuksa o alan yok sayılır: bozuk min_version → kapı açık.
 */
export function parseRequirementResponse(data: unknown, platform: GatePlatform): FetchOutcome {
  if (data === null) return { kind: "ok", requirement: null };
  if (!isPlainObject(data)) return { kind: "error", reason: "malformed" };
  if (data.platform !== undefined && data.platform !== platform) return { kind: "error", reason: "malformed" };

  const minVersion = parseVersion(data.min_version) ? (data.min_version as string) : null;
  return {
    kind: "ok",
    requirement: {
      minVersion,
      minBuild: minVersion ? parseBuild(data.min_build) : null,
      storeUrl: cleanStoreUrl(data.store_url, platform),
      messageTr: cleanMessage(data.message_tr),
      messageEn: cleanMessage(data.message_en),
    },
  };
}

export type RequirementRpc = (
  fn: typeof APP_VERSION_RPC,
  args: { p_platform: GatePlatform }
) => PromiseLike<{ data: unknown; error: unknown }>;

/**
 * Sunucuya sorar; hiçbir durumda fırlatmaz. Ağ hatası, RPC hatası, zaman aşımı ve bozuk yanıt "error" döner.
 * `rpc` dışarıdan verilir (uygulamada supabase.rpc), testler sahte bir çağrı verir.
 */
export async function fetchRequirement(
  rpc: RequirementRpc,
  platform: GatePlatform,
  timeoutMs: number = GATE_FETCH_TIMEOUT_MS
): Promise<FetchOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<FetchOutcome>((resolve) => {
    timer = setTimeout(() => resolve({ kind: "error", reason: "timeout" }), timeoutMs);
  });
  const request = (async (): Promise<FetchOutcome> => {
    try {
      const { data, error } = await rpc(APP_VERSION_RPC, { p_platform: platform });
      if (error) return { kind: "error", reason: "rpc" };
      return parseRequirementResponse(data, platform);
    } catch {
      return { kind: "error", reason: "network" };
    }
  })();
  try {
    return await Promise.race([request, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ─── Önbellek (son başarılı yanıt) ───────────────────────────────────────────

interface GateCacheRecord {
  v: 1;
  platform: GatePlatform;
  savedAt: number;
  requirement: VersionRequirement | null;
}

export function serializeGateCache(platform: GatePlatform, requirement: VersionRequirement | null, now: number): string {
  const record: GateCacheRecord = { v: 1, platform, savedAt: now, requirement };
  return JSON.stringify(record);
}

/**
 * Önbelleği okur. Kullanılabilir kayıt yoksa (yok, bozuk, başka platform, çok eski, saati ileride) `undefined`.
 * Kayıt içindeki gereksinim yeniden doğrulanır: elle bozulmuş bir değer kapıyı kapatamaz.
 */
export function readGateCache(
  raw: string | null | undefined,
  platform: GatePlatform,
  now: number,
  maxAgeMs: number = GATE_CACHE_MAX_AGE_MS
): { requirement: VersionRequirement | null } | undefined {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 4000) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isPlainObject(parsed) || parsed.v !== 1 || parsed.platform !== platform) return undefined;
  const savedAt = parsed.savedAt;
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) return undefined;
  // Saat geri alınmış / ileri kaymışsa (1 günden fazla gelecekte) kayıt güvenilmez
  if (savedAt > now + 24 * 60 * 60 * 1000 || now - savedAt > maxAgeMs) return undefined;

  if (parsed.requirement === null) return { requirement: null };
  if (!isPlainObject(parsed.requirement)) return undefined;
  const r = parsed.requirement;
  // Saklanan biçimi sunucu biçimine çevirip aynı doğrulamadan geçirir
  const outcome = parseRequirementResponse(
    {
      min_version: r.minVersion,
      min_build: r.minBuild,
      store_url: r.storeUrl,
      message_tr: r.messageTr,
      message_en: r.messageEn,
    },
    platform
  );
  if (outcome.kind !== "ok") return undefined;
  // minVersion yazılmış ama geçersizse kayıt bozuktur (sunucudan gelirken zaten temizlenmişti)
  if (r.minVersion !== null && outcome.requirement?.minVersion === null) return undefined;
  return { requirement: outcome.requirement };
}

// ─── Karar ───────────────────────────────────────────────────────────────────

/**
 * Hangi gereksinim geçerli: bu oturumdaki son başarılı sunucu yanıtı, yoksa önbellek, o da yoksa hiçbiri (açık).
 * `latestSuccess` undefined = bu oturumda henüz başarılı yanıt yok.
 */
export function resolveRequirement(
  latestSuccess: VersionRequirement | null | undefined,
  cached: { requirement: VersionRequirement | null } | undefined
): VersionRequirement | null {
  if (latestSuccess !== undefined) return latestSuccess;
  return cached?.requirement ?? null;
}

export function asGatePlatform(os: string): GatePlatform | null {
  return os === "ios" || os === "android" ? os : null;
}

export interface GateInput {
  /** Platform.OS */
  platform: string;
  isDemoMode: boolean;
  /** expo-application nativeApplicationVersion */
  deviceVersion: unknown;
  /** expo-application nativeBuildVersion */
  deviceBuild: unknown;
  requirement: VersionRequirement | null;
}

export function decideGate(input: GateInput): GateDecision {
  // Misafir demo: gömülü örnek veri, sahte oturum; gerçek veriye dokunmaz. (Mağaza incelemesi demoyla DEĞİL gerçek
  // hesapla yapılır, kapı ona uygulanır: docs/ZORUNLU_GUNCELLEME.md)
  if (input.isDemoMode) return { locked: false, reason: "demo" };
  const platform = asGatePlatform(input.platform);
  if (!platform) return { locked: false, reason: "unsupported-platform" };

  const requirement = input.requirement;
  const minVersion = requirement ? parseVersion(requirement.minVersion) : null;
  if (!requirement || !minVersion) return { locked: false, reason: "no-requirement" };

  const deviceVersion = parseVersion(input.deviceVersion);
  if (!deviceVersion) return { locked: false, reason: "device-version-unknown" };

  const order = compareVersions(deviceVersion, minVersion);
  if (order > 0) return { locked: false, reason: "up-to-date" };

  if (order === 0) {
    const minBuild = parseBuild(requirement.minBuild);
    const deviceBuild = parseBuild(input.deviceBuild);
    // Build şartı yoksa ya da cihazın build'i okunamıyorsa: eşit sürüm geçer
    if (minBuild === null || deviceBuild === null || deviceBuild >= minBuild) {
      return { locked: false, reason: "up-to-date" };
    }
  }

  return {
    locked: true,
    reason: order < 0 ? "below-min-version" : "below-min-build",
    storeUrl: cleanStoreUrl(requirement.storeUrl, platform) ?? DEFAULT_STORE_URLS[platform],
    messageTr: cleanMessage(requirement.messageTr),
    messageEn: cleanMessage(requirement.messageEn),
  };
}

/** Ekranda gösterilecek sunucu metni (dil Türkçe ise TR, değilse EN); yoksa null → yerel metin. */
export function pickGateMessage(
  decision: Extract<GateDecision, { locked: true }>,
  language: string | undefined
): string | null {
  return (language ?? "").toLowerCase().startsWith("tr") ? decision.messageTr : decision.messageEn;
}

/** Şimdi sunucuya sorulmalı mı. İlk soru (lastAttemptAt null) her zaman; sonra aralık dolunca. */
export function shouldCheck(lastAttemptAt: number | null, now: number, locked: boolean): boolean {
  if (lastAttemptAt === null) return true;
  const interval = locked ? GATE_LOCKED_CHECK_INTERVAL_MS : GATE_CHECK_INTERVAL_MS;
  // Saat geri alınmışsa (now < lastAttemptAt) beklemeden sor
  return now - lastAttemptAt >= interval || now < lastAttemptAt;
}
