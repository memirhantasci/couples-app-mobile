// Süresi dolan hesap silme taleplerini işler (bkz. migrations/20261022000000_account_deletion.sql).
//
// Saatlik pg_cron işi bu fonksiyonu çağırır. Yalnızca `scheduled_for` zamanı geçmiş talepler
// işlendiği için erken ya da tekrar çağrılması zararsızdır; JWT doğrulaması kapalı dağıtılır:
//   supabase functions deploy process-account-deletions --no-verify-jwt
//
// Her talep için sıra:
//   1. Storage API ile dosyalar (SQL ile silmek dosyayı depoda sahipsiz bırakır)
//   2. purge_account_data(): kişisel ve ortak veritabanı kayıtları
//   3. auth.admin.deleteUser(): hesabın kendisi (talep satırı da cascade ile silinir)
// Bir adım başarısız olursa talep kalır, hata kaydedilir ve bir sonraki saatte yeniden denenir.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const BATCH_SIZE = 20;
const LIST_PAGE_SIZE = 1000;
const REMOVE_CHUNK_SIZE = 100;

/** Çiftin dosyaları bu bucket'larda `<couple_id>/...` altında durur. */
const COUPLE_BUCKETS = ["photos", "memories", "couple-memories"];
/** Profil fotoğrafı `<user_id>/avatar.jpg`. */
const AVATAR_BUCKET = "avatars";

function isMissingBucket(error: { message?: string; statusCode?: string | number }): boolean {
  return String(error.statusCode ?? "") === "404" || /bucket not found/i.test(error.message ?? "");
}

/** `prefix` altındaki tüm dosya yollarını (alt klasörler dahil) döner. */
async function listFiles(admin: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: LIST_PAGE_SIZE, offset });
    if (error) {
      if (isMissingBucket(error)) return [];
      throw new Error(`${bucket}/${prefix} listelenemedi: ${error.message}`);
    }
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      // Klasörlerin id'si yoktur
      if (item.id === null) files.push(...(await listFiles(admin, bucket, path)));
      else files.push(path);
    }
    if (!data || data.length < LIST_PAGE_SIZE) return files;
  }
}

async function removeFolder(admin: SupabaseClient, bucket: string, prefix: string): Promise<number> {
  const files = await listFiles(admin, bucket, prefix);
  for (let i = 0; i < files.length; i += REMOVE_CHUNK_SIZE) {
    const { error } = await admin.storage.from(bucket).remove(files.slice(i, i + REMOVE_CHUNK_SIZE));
    if (error) throw new Error(`${bucket}/${prefix} silinemedi: ${error.message}`);
  }
  return files.length;
}

async function deleteAccount(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("couple_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw new Error(`Profil okunamadı: ${profileError.message}`);

  // 1. Dosyalar. Profil satırı önceki bir denemede silinmişse çift verisi de silinmiştir.
  await removeFolder(admin, AVATAR_BUCKET, userId);
  const coupleId = profile?.couple_id;
  if (coupleId !== null && coupleId !== undefined) {
    for (const bucket of COUPLE_BUCKETS) {
      await removeFolder(admin, bucket, String(coupleId));
    }
  }

  // 2. Veritabanı
  const { error: purgeError } = await admin.rpc("purge_account_data", { p_user_id: userId });
  if (purgeError) throw new Error(`Veritabanı temizlenemedi: ${purgeError.message}`);

  // 3. Hesap. Eşzamanlı bir çalıştırma zaten silmişse sorun değil.
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError && authError.status !== 404) {
    throw new Error(`Hesap silinemedi: ${authError.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: due, error } = await admin
    .from("account_deletion_requests")
    .select("user_id")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[account-deletion] talepler okunamadı:", error.message);
    return Response.json({ error: "requests_unavailable" }, { status: 500 });
  }

  let deleted = 0;
  let failed = 0;
  for (const { user_id: userId } of due ?? []) {
    try {
      await deleteAccount(admin, userId);
      deleted++;
    } catch (cause) {
      failed++;
      const message = cause instanceof Error ? cause.message : String(cause);
      console.error(`[account-deletion] ${userId}:`, message);
      await admin
        .from("account_deletion_requests")
        .update({ last_attempt_at: new Date().toISOString(), last_error: message.slice(0, 1000) })
        .eq("user_id", userId);
    }
  }

  // Yanıt herkese açık: kullanıcı kimlikleri döndürülmez
  return Response.json({ deleted, failed });
});
