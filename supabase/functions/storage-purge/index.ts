// Silinmesi gereken dosyaları depodan siler: public.storage_purge_queue
// (bkz. migrations/20261104000003_subscription_lifecycle.sql).
//
// Kuyruğa veritabanı tetikleyicileri yazar: fotoğraf / anı / anı gezegeni kaydı silinince ya da görseli kayıttan
// çıkarılınca, ve kasa süresi dolan çiftlerin tam boy görselleri ve profil fotoğrafları için. Dosya SQL ile silinemez (depoda sahipsiz
// kalır); bu fonksiyon Storage API ile siler. Kullanıcının silme hakkı böylece Premium'a ve istemcinin depo
// çağrısının başarısına bağlı olmaz.
//
// pg_cron 10 dakikada bir, yalnızca kuyrukta hazır iş varsa çağırır (invoke_storage_purge). Yetki: service_role
// ya da webhook secret:
//   supabase functions deploy storage-purge --no-verify-jwt
//
// Güvenlik: claim_storage_purge_batch hâlâ bir kayıt tarafından gösterilen dosyayı hiç vermez (kuyruktan düşer).
// Olmayan dosyayı silmek hata değildir. Başarısız silme artan beklemeyle yeniden denenir; 10 denemeden sonra
// last_error ile kuyrukta kalır.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const BATCH_SIZE = 100;
const TIME_BUDGET_MS = 45_000;
const BUCKETS = ["photos", "memories", "couple-memories", "avatars"] as const;
type Bucket = (typeof BUCKETS)[number];

interface PurgeItem {
  queue_id: number;
  bucket_id: Bucket;
  object_name: string;
}

function isPurgeItem(value: unknown): value is PurgeItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.queue_id === "number" &&
    typeof item.object_name === "string" &&
    (BUCKETS as readonly unknown[]).includes(item.bucket_id)
  );
}

/** Bir bucket'taki dosyaları tek çağrıda siler ve kuyruğu sonuca göre günceller. */
async function purgeBucket(admin: SupabaseClient, bucket: Bucket, items: PurgeItem[]): Promise<{ removed: number; failed: number }> {
  const ids = items.map((item) => item.queue_id);
  const { error } = await admin.storage.from(bucket).remove(items.map((item) => item.object_name));
  if (error) {
    await admin.rpc("fail_storage_purge", { p_queue_ids: ids, p_error: error.message });
    console.error(`[storage-purge] ${bucket}: ${error.message}`);
    return { removed: 0, failed: ids.length };
  }
  const { error: completeError } = await admin.rpc("complete_storage_purge", { p_queue_ids: ids });
  // Kuyruk satırı kalırsa kilit dolunca yeniden verilir; olmayan dosyayı yeniden silmek zararsız
  if (completeError) console.error(`[storage-purge] kuyruk güncellenemedi: ${completeError.message}`);
  return { removed: ids.length, failed: 0 };
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

  const startedAt = Date.now();
  let removed = 0;
  let failed = 0;

  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const { data, error } = await admin.rpc("claim_storage_purge_batch", { p_limit: BATCH_SIZE });
    if (error) {
      console.error("[storage-purge] kuyruk okunamadı:", error.message);
      return Response.json({ error: "queue_unavailable", removed, failed }, { status: 500 });
    }
    const batch = (Array.isArray(data) ? data : []).filter(isPurgeItem);
    if (batch.length === 0) break;

    for (const bucket of BUCKETS) {
      const items = batch.filter((item) => item.bucket_id === bucket);
      if (items.length === 0) continue;
      const result = await purgeBucket(admin, bucket, items);
      removed += result.removed;
      failed += result.failed;
    }
  }

  // Yanıt herkese açık değil ama yine de dosya yolu döndürülmez
  return Response.json({ removed, failed });
});
