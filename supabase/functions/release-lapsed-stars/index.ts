// Premium'u bitip 14 günlük yenileme süresini de kaçıran çiftlerin yıldızlarını serbest bırakır
// (bkz. migrations/20261104000002_premium_lapse_star_release.sql).
//
// Günlük pg_cron işi bu fonksiyonu çağırır. Yenilenmiş bir abonelik için çağrılması zararsızdır:
// release_lapsed_star koşulu kendisi yeniden doğrular. Yetkilendirme service_role ya da webhook secret ile:
//   supabase functions deploy release-lapsed-stars --no-verify-jwt
//
// Her çift için sıra:
//   1. Anı gezegenlerinin fotoğrafları Storage API ile silinir (SQL ile silmek dosyayı depoda sahipsiz bırakır).
//      Gezegen medyası yalnızca couple-memories/<çift>/exoplanets/ altında durur.
//   2. release_lapsed_star(): sahiplik, ışıltı skoru, kıvılcımlar, gezegenler, bağlantılar.
// Bir adım başarısız olursa çift bir sonraki gün yeniden denenir.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const BATCH_SIZE = 20;
const LIST_PAGE_SIZE = 1000;
const REMOVE_CHUNK_SIZE = 100;
const BUCKET = "couple-memories";

/** `prefix` altındaki tüm dosya yollarını (alt klasörler dahil) döner. */
async function listFiles(admin: SupabaseClient, prefix: string): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: LIST_PAGE_SIZE, offset });
    if (error) {
      if (String(error.statusCode ?? "") === "404" || /bucket not found/i.test(error.message ?? "")) return [];
      throw new Error(`${BUCKET}/${prefix} listelenemedi: ${error.message}`);
    }
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      if (item.id === null) files.push(...(await listFiles(admin, path)));
      else files.push(path);
    }
    if (!data || data.length < LIST_PAGE_SIZE) return files;
  }
}

async function removeExoplanetFiles(admin: SupabaseClient, coupleId: number): Promise<number> {
  const files = await listFiles(admin, `${coupleId}/exoplanets`);
  for (let i = 0; i < files.length; i += REMOVE_CHUNK_SIZE) {
    const { error } = await admin.storage.from(BUCKET).remove(files.slice(i, i + REMOVE_CHUNK_SIZE));
    if (error) throw new Error(`${BUCKET} dosyaları silinemedi: ${error.message}`);
  }
  return files.length;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  const authorized =
    (!!serviceKey && authHeader === `Bearer ${serviceKey}`) ||
    (!!secret && req.headers.get("x-webhook-secret") === secret);
  if (!authorized) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: lapsed, error } = await admin.rpc("list_lapsed_stars", { p_limit: BATCH_SIZE });
  if (error) {
    console.error("[release-lapsed-stars] liste okunamadı:", error.message);
    return Response.json({ error: "list_unavailable" }, { status: 500 });
  }

  let released = 0;
  let failed = 0;
  for (const row of (lapsed ?? []) as { couple_id: number }[]) {
    try {
      // Dosyalar ancak koşul hâlâ geçerliyse silinmeli; SQL fonksiyonu yenilemeyi görürse dosyalar boşuna gitmesin
      const { data: stillLapsed } = await admin.rpc("is_star_lapsed", { p_couple_id: row.couple_id });
      if (stillLapsed === false) continue;
      await removeExoplanetFiles(admin, row.couple_id);
      const { data: done, error: releaseError } = await admin.rpc("release_lapsed_star", { p_couple_id: row.couple_id });
      if (releaseError) throw new Error(releaseError.message);
      if (done) released++;
    } catch (cause) {
      failed++;
      console.error(`[release-lapsed-stars] çift ${row.couple_id}:`, cause instanceof Error ? cause.message : cause);
    }
  }

  // Yanıt herkese açık değil ama yine de kimlik döndürülmez
  return Response.json({ released, failed });
});
