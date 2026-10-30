// RevenueCat → Supabase: mağaza aboneliği olaylarını çiftin Premium durumuna yansıtır.
//
// Premium'u yalnızca bu fonksiyon (service_role) yazar; istemci artık `set_premium_status` çağırmaz.
// Eski istemci eşitlemesi, RevenueCat'te hakkı olmayan partner uygulamayı açınca çiftin (ödenmiş ya da
// promosyonla verilmiş) Premium'unu kapatıyordu. Burada kurallar:
//   • Satın alma / yenileme: bitiş = max(mevcut bitiş, mağaza bitişi). Süresiz (NULL) Premium korunur.
//   • Bitiş / iade: yalnızca bitiş tarihi mağaza bitişine eşit ya da öncesindeyse kapatılır; daha geç bir
//     promosyon süresi ya da süresiz Premium bu olaylardan etkilenmez.
//
// RevenueCat panelinde: Integrations → Webhooks → URL = <proje>/functions/v1/revenuecat-webhook,
// "Authorization header value" = REVENUECAT_WEBHOOK_SECRET ile aynı değer.
//   supabase secrets set REVENUECAT_WEBHOOK_SECRET=<uzun rastgele değer>
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
//
// RevenueCat app_user_id, istemcinin `Purchases.logIn(userId)` ile verdiği Supabase kullanıcı UUID'sidir.

import { createClient } from "npm:@supabase/supabase-js@2";

const ENTITLEMENT = "Premium";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GRANT_EVENTS = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
  "NON_RENEWING_PURCHASE",
  "SUBSCRIPTION_EXTENDED",
  "REFUND_REVERSED",
]);
const END_SLACK_MS = 60_000;

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

async function applyEvent(event: RevenueCatEvent): Promise<string> {
  const type = event.type ?? "";
  if (type === "TEST") return "test";

  // Başka bir hakka ait olay (varsa) yok sayılır
  if (event.entitlement_ids && !event.entitlement_ids.includes(ENTITLEMENT)) return "other_entitlement";

  const userId = resolveUserId(event);
  if (!userId) return "no_user";

  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("couple_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new Error(`profil okunamadı: ${profileError.message}`);
  if (!profile?.couple_id) return "no_couple";

  const { data: couple, error: coupleError } = await admin
    .from("couples")
    .select("is_premium, premium_expires_at")
    .eq("id", profile.couple_id)
    .single();
  if (coupleError) throw new Error(`çift okunamadı: ${coupleError.message}`);

  const currentExpiry = couple.premium_expires_at ? Date.parse(couple.premium_expires_at) : null;
  const storeExpiry = typeof event.expiration_at_ms === "number" ? event.expiration_at_ms : null;

  if (GRANT_EVENTS.has(type)) {
    // Mevcut süresiz Premium (ör. promosyon) mağaza olayıyla kısalmaz
    if (couple.is_premium && couple.premium_expires_at === null) return "kept_lifetime";

    const nextExpiry = storeExpiry === null ? null : Math.max(currentExpiry ?? 0, storeExpiry);
    const { error } = await admin
      .from("couples")
      .update({
        is_premium: true,
        premium_expires_at: nextExpiry === null ? null : new Date(nextExpiry).toISOString(),
      })
      .eq("id", profile.couple_id);
    if (error) throw new Error(`Premium yazılamadı: ${error.message}`);
    return "granted";
  }

  const refund = type === "CANCELLATION" && event.cancel_reason === "CUSTOMER_SUPPORT";
  if (type === "EXPIRATION" || refund) {
    // Daha geç bir tarihle verilmiş Premium (promosyon / süresiz) bu olaydan etkilenmez
    const endsWithStore = currentExpiry !== null && currentExpiry <= (storeExpiry ?? Date.now()) + END_SLACK_MS;
    if (!couple.is_premium || !endsWithStore) return "kept";
    const { error } = await admin.from("couples").update({ is_premium: false }).eq("id", profile.couple_id);
    if (error) throw new Error(`Premium kapatılamadı: ${error.message}`);
    return "revoked";
  }

  // CANCELLATION (dönem sonunda biter), BILLING_ISSUE vb.: bitiş tarihi zaten geçerlilik süresini belirler
  return "ignored";
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
