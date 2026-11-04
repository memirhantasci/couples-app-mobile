// RevenueCat → Supabase: mağaza aboneliği olaylarını çiftin Premium yaşam döngüsüne yansıtır.
//
// Premium'u yalnızca bu fonksiyon (service_role) yazar; istemci artık `set_premium_status` çağırmaz.
// Karar veritabanında tek işlemde verilir: public.apply_revenuecat_event (bkz.
// migrations/20261104000003_subscription_lifecycle.sql) çift satırını kilitler, kuralı uygular ve yaşam
// döngüsünü (active → grace_period → vault → free) aynı işlemde ilerletir. Eşzamanlı ya da sırası karışık gelen
// olaylar birbirini ezemez (önceki sürüm okuyup ayrı istekle yazıyordu). Kurallar:
//   • Satın alma / yenileme: bitiş = max(mevcut bitiş, mağaza bitişi). Süresiz (NULL) Premium korunur.
//     Kış uykusu ve kasa kalkar.
//   • Bitiş / iade: Premium kapatılmaz, her şey kilitlenmez. Bitiş tarihi hakkın gerçek bitiş anına çekilir
//     (iade: şimdi) ve 14 günlük kış uykusu başlar. Daha geç bir promosyon süresi ya da süresiz Premium etkilenmez.
//   • CANCELLATION (otomatik yenileme kapatıldı): ödenmiş dönem sürer, değişiklik yok; kış uykusu dönem
//     bitince EXPIRATION ile başlar.
//
// RevenueCat panelinde: Integrations → Webhooks → URL = <proje>/functions/v1/revenuecat-webhook,
// "Authorization header value" = REVENUECAT_WEBHOOK_SECRET ile aynı değer.
//   supabase secrets set REVENUECAT_WEBHOOK_SECRET=<uzun rastgele değer>
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
//
// RevenueCat app_user_id, istemcinin `Purchases.logIn(userId)` ile verdiği Supabase kullanıcı UUID'sidir.

import { createClient } from "npm:@supabase/supabase-js@2";

const ENTITLEMENTS = new Set(["Premium", "couples_app_pro"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** apply_revenuecat_event dönüşleri */
const LIFECYCLE_RESULTS = ["granted", "kept_lifetime", "lapsed", "kept", "ignored", "no_couple"] as const;
type LifecycleResult = (typeof LIFECYCLE_RESULTS)[number];
type WebhookResult = LifecycleResult | "test" | "other_entitlement" | "no_user";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  entitlement_ids?: string[] | null;
  expiration_at_ms?: number | null;
  cancel_reason?: string | null;
}

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function isAuthorized(req: Request): boolean {
  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!secret) return false;
  const header = (req.headers.get("Authorization") ?? "").trim();
  const token = header.replace(/^Bearer\s+/i, "");
  return safeEqual(token, secret);
}

function resolveUserId(event: RevenueCatEvent): string | null {
  const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])];
  return candidates.find((id): id is string => typeof id === "string" && UUID_PATTERN.test(id)) ?? null;
}

function isLifecycleResult(value: unknown): value is LifecycleResult {
  return typeof value === "string" && (LIFECYCLE_RESULTS as readonly string[]).includes(value);
}

/** Mağaza bitişi (ISO); yoksa ya da geçersizse null (satın almada süresiz demektir) */
function storeExpiration(event: RevenueCatEvent): string | null {
  const ms = event.expiration_at_ms;
  return typeof ms === "number" && Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

async function applyEvent(event: RevenueCatEvent): Promise<WebhookResult> {
  const type = event.type ?? "";
  if (type === "TEST") return "test";

  // Başka bir hakka ait olay (varsa) yok sayılır
  if (event.entitlement_ids && !event.entitlement_ids.some(id => ENTITLEMENTS.has(id))) return "other_entitlement";

  const userId = resolveUserId(event);
  if (!userId) return "no_user";

  const { data, error } = await admin.rpc("apply_revenuecat_event", {
    p_user_id: userId,
    p_event_type: type,
    p_expiration_at: storeExpiration(event),
    p_cancel_reason: event.cancel_reason ?? null,
  });
  if (error) throw new Error(`olay uygulanamadı: ${error.message}`);
  if (!isLifecycleResult(data)) throw new Error(`beklenmeyen sonuç: ${String(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!isAuthorized(req)) return new Response("Unauthorized", { status: 401 });

  let event: RevenueCatEvent;
  try {
    const body = await req.json();
    event = body?.event ?? {};
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    const result = await applyEvent(event);
    return Response.json({ ok: true, result });
  } catch (cause) {
    // 5xx: RevenueCat olayı yeniden dener
    console.error("[revenuecat-webhook]", cause instanceof Error ? cause.message : cause);
    return Response.json({ ok: false }, { status: 500 });
  }
});
