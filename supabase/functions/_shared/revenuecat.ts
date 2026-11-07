// RevenueCat v2 REST ile bir kişinin Premium hakkını SUNUCUDA doğrular (istemcinin söylediğine güvenilmez).
//
// Kullanım yerleri:
//   • sync-premium: uygulama açılışında / eşleşmeden sonra (yeni çifte kalan süre yazılır; aynı mağaza hesabıyla
//     yeniden kayıt olan kişinin hakkı geri gelir)
//   • process-account-deletions: partner silindikten sonra kalan kişinin KENDİ aboneliği
//   • revenuecat-webhook: TRANSFER olayı (satın alma yeni hesaba aktarıldı)
//
// Gizli anahtar Supabase secret'ıdır, koda yazılmaz:
//   supabase secrets set REVENUECAT_SECRET_KEY=sk_...   (v2 anahtarı; customer_information:customers:read izni şart)
//   supabase secrets set REVENUECAT_PROJECT_ID=proj...  (varsayılan aşağıda)
// Anahtar yoksa ya da izni yetmiyorsa doğrulama "unavailable" döner ve HİÇBİR ŞEY değiştirilmez.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const API = "https://api.revenuecat.com/v2";
const DEFAULT_PROJECT_ID = "projb156267f";
/** Uygulamanın Premium hakkı (RevenueCat "lookup_key"); src/lib/revenuecat.ts ile aynı */
const PREMIUM_LOOKUP_KEYS = new Set(["Premium", "couples_app_pro"]);

export type VerifyResult =
  | { status: "active"; expiresAt: string | null; lifetime: boolean }
  | { status: "none" }
  | { status: "unavailable"; reason: string };

let entitlementIdsCache: { ids: Set<string>; at: number } | null = null;
const ENTITLEMENT_CACHE_MS = 10 * 60 * 1000;

function config(): { key: string; project: string } | null {
  const key = (Deno.env.get("REVENUECAT_SECRET_KEY") ?? "").trim();
  if (!key) return null;
  return { key, project: (Deno.env.get("REVENUECAT_PROJECT_ID") ?? DEFAULT_PROJECT_ID).trim() };
}

async function rcGet(path: string, key: string): Promise<Response> {
  return await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
}

/** Premium hakkının RevenueCat iç kimlikleri (entl...) */
async function premiumEntitlementIds(key: string, project: string): Promise<Set<string>> {
  if (entitlementIdsCache && Date.now() - entitlementIdsCache.at < ENTITLEMENT_CACHE_MS) {
    return entitlementIdsCache.ids;
  }
  const res = await rcGet(`/projects/${encodeURIComponent(project)}/entitlements?limit=100`, key);
  if (!res.ok) throw new Error(`entitlements ${res.status}`);
  const body = await res.json();
  const ids = new Set<string>();
  for (const item of Array.isArray(body?.items) ? body.items : []) {
    if (typeof item?.id === "string" && PREMIUM_LOOKUP_KEYS.has(item?.lookup_key)) ids.add(item.id);
  }
  entitlementIdsCache = { ids, at: Date.now() };
  return ids;
}

/** RevenueCat müşterisinin (app_user_id = Supabase kullanıcı UUID'si) aktif Premium hakkı */
export async function verifyPremium(appUserId: string): Promise<VerifyResult> {
  const cfg = config();
  if (!cfg) return { status: "unavailable", reason: "missing_secret" };

  try {
    const ids = await premiumEntitlementIds(cfg.key, cfg.project);
    if (ids.size === 0) return { status: "unavailable", reason: "entitlement_not_found" };

    let path: string | null =
      `/projects/${encodeURIComponent(cfg.project)}/customers/${encodeURIComponent(appUserId)}/active_entitlements?limit=100`;
    let best: { expiresMs: number | null } | null = null;

    for (let page = 0; path && page < 5; page++) {
      const res = await rcGet(path, cfg.key);
      if (res.status === 404) return { status: "none" };
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { status: "unavailable", reason: `active_entitlements ${res.status} ${text.slice(0, 160)}` };
      }
      const body = await res.json();
      for (const item of Array.isArray(body?.items) ? body.items : []) {
        if (!ids.has(item?.entitlement_id)) continue;
        // expires_at: ms; açıkça null ise bitişsiz (süresiz ürün). Alan hiç yoksa güvenilmez, atlanır.
        if (!("expires_at" in item)) continue;
        const expiresMs = item.expires_at === null ? null : Number(item.expires_at);
        if (expiresMs !== null && (!Number.isFinite(expiresMs) || expiresMs <= Date.now())) continue;
        if (!best || expiresMs === null || (best.expiresMs !== null && expiresMs > best.expiresMs)) {
          best = { expiresMs };
        }
      }
      const next = typeof body?.next_page === "string" && body.next_page ? body.next_page : null;
      path = next ? next.replace(/^\/v2/, "") : null;
    }

    if (!best) return { status: "none" };
    return best.expiresMs === null
      ? { status: "active", expiresAt: null, lifetime: true }
      : { status: "active", expiresAt: new Date(best.expiresMs).toISOString(), lifetime: false };
  } catch (cause) {
    return { status: "unavailable", reason: cause instanceof Error ? cause.message : String(cause) };
  }
}

/**
 * Doğrulanan hakkı kişinin GÜNCEL çiftine yazar (süresiz kazanır, aksi halde daha geç biten süre).
 * Hak yoksa ya da doğrulanamadıysa veritabanına dokunulmaz.
 */
export async function syncVerifiedPremium(admin: SupabaseClient, userId: string): Promise<string> {
  const verified = await verifyPremium(userId);
  if (verified.status !== "active") {
    if (verified.status === "unavailable") console.warn(`[revenuecat] ${userId} doğrulanamadı: ${verified.reason}`);
    return verified.status;
  }
  const { data, error } = await admin.rpc("apply_verified_entitlement", {
    p_user_id: userId,
    p_expires_at: verified.expiresAt,
    p_lifetime: verified.lifetime,
  });
  if (error) throw new Error(`apply_verified_entitlement: ${error.message}`);
  return typeof data === "string" ? data : "applied";
}
