// Premium sürekliliği: kişinin (ve partnerinin) mağaza aboneliğini RevenueCat v2 REST ile doğrular ve
// GÜNCEL çiftine kalan süre kadar Premium yazar (bkz. docs/HESAP_SILME_VE_PREMIUM_TASARIMI.md madde 4).
//
// Uygulama bunu açılışta (günde en fazla birkaç kez) ve eşleşmeden hemen sonra, mağaza satın almalarını
// sessizce senkronladıktan (Purchases.syncPurchases) sonra çağırır. Kapsadığı durumlar:
//   • B yeni biriyle eşleşti: B'nin kendi aboneliği yeni çifte yazılır (ömür boyuysa süresiz)
//   • A silindikten sonra aynı Apple/Google hesabıyla yeniden kayıt oldu: RevenueCat satın almayı yeni
//     kullanıcıya aktarır, kalan süre yeni (boş) hesabın çiftine yazılır
// İstemci yalnızca "bak" der; hakkın kendisi mağaza kaydından okunur, istemcinin gönderdiği hiçbir şey kullanılmaz.
//
// Dağıtım (kullanıcı JWT'si zorunlu):
//   supabase functions deploy sync-premium

import { createClient } from "npm:@supabase/supabase-js@2";
import { syncVerifiedPremium } from "../_shared/revenuecat.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  const userId = auth?.user?.id;
  if (authError || !userId) return new Response("Unauthorized", { status: 401 });

  // RevenueCat'e gereksiz yük bindirilmesin: kişi başına saatte 12
  const { data: allowed } = await admin.rpc("consume_auth_rate_limit", {
    p_bucket: "premium_sync",
    p_subject: userId,
    p_max: 12,
    p_window_seconds: 3600,
  });
  if (allowed === false) return Response.json({ ok: false, reason: "rate_limited" }, { status: 429 });

  // Kişi ve (varsa) partneri: eşleşmede iki tarafın aboneliği de yeni çifte yazılabilsin
  const { data: me } = await admin.from("users").select("couple_id").eq("id", userId).maybeSingle();
  const members = new Set<string>([userId]);
  if (me?.couple_id != null) {
    const { data: rows } = await admin.from("users").select("id").eq("couple_id", me.couple_id);
    for (const row of rows ?? []) members.add(row.id);
  }

  const results: Record<string, string> = {};
  for (const memberId of members) {
    try {
      results[memberId === userId ? "self" : "partner"] = await syncVerifiedPremium(admin, memberId);
    } catch (cause) {
      console.error("[sync-premium]", cause instanceof Error ? cause.message : cause);
      results[memberId === userId ? "self" : "partner"] = "error";
    }
  }

  return Response.json({ ok: true, results });
});
