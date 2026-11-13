// AdMob ödüllü reklam sunucu tarafı doğrulaması (SSV).
//
// DURUM (2026-11-13): deploy edildi, migration canlıda. AdMob panelinde geri çağrı adresi tanımlanana ve istemci
// kullanıcı kimliğini reklama iliştirene kadar hiçbir ödül yazmaz. Kalan adımlar: README.md.
//
// AdMob, ödüllü reklam tamamlanınca bu adrese imzalı bir GET isteği gönderir. İmza Google'ın açık
// anahtarlarıyla doğrulanır; token'ı yalnızca bu doğrulanmış çağrı yazar (grant_ad_reward_ssv, migration
// 20261113000002). İstemcinin beyanına (earn_tokens) güvenilmez.
//
// Yanıt kuralı: Google 200 dışındaki yanıtta isteği 5 kez yineler. Bu yüzden geçerli imzalı her istek
// (yinelenen işlem, günlük sınır, kullanıcısız test isteği dahil) 200 döner; yalnızca imzası doğrulanamayan
// istek reddedilir.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isUuid, parseSsvQuery, verifySsvSignature, type SsvKey } from "./verify.ts";

const KEYS_URL = "https://gstatic.com/admob/reward/verifier-keys.json";
/** Anahtarlar döner; Google 24 saatten uzun önbelleğe almamayı ister. */
const KEYS_TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Ödüllü reklam birimlerimizin sayısal kimlikleri (ca-app-pub-3252755330955913/<kimlik>): Android, iOS.
 * EXPO_PUBLIC_ADMOB_REWARDED_ID_* ile aynı olmalı. ADMOB_SSV_AD_UNITS sırrı tanımlıysa o kullanılır.
 */
const DEFAULT_REWARDED_AD_UNITS = ["1652675123", "2834341963"];

let cachedKeys: { keys: SsvKey[]; fetchedAt: number } | null = null;

async function loadKeys(force = false): Promise<SsvKey[]> {
  if (!force && cachedKeys && Date.now() - cachedKeys.fetchedAt < KEYS_TTL_MS) return cachedKeys.keys;
  const response = await fetch(KEYS_URL);
  if (!response.ok) throw new Error(`verifier keys: HTTP ${response.status}`);
  const body = await response.json();
  const keys: SsvKey[] = (body?.keys ?? [])
    .map((key: { keyId?: unknown; base64?: unknown }) => ({ keyId: Number(key.keyId), base64: String(key.base64 ?? "") }))
    .filter((key: SsvKey) => Number.isSafeInteger(key.keyId) && key.base64);
  if (keys.length === 0) throw new Error("verifier keys: empty");
  cachedKeys = { keys, fetchedAt: Date.now() };
  return keys;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "GET") return json(405, { error: "method_not_allowed" });

  const queryStart = req.url.indexOf("?");
  const parsed = queryStart < 0 ? null : parseSsvQuery(req.url.slice(queryStart + 1));
  if (!parsed) return json(400, { error: "bad_request" });

  let valid = false;
  try {
    valid = await verifySsvSignature(parsed, await loadKeys());
    // Anahtar yeni dönmüş olabilir: önbellekte yoksa bir kez taze listeyle dene
    if (!valid && cachedKeys && !cachedKeys.keys.some((key) => key.keyId === parsed.keyId)) {
      valid = await verifySsvSignature(parsed, await loadKeys(true));
    }
  } catch (error) {
    console.error("admob-ssv: anahtarlar alınamadı:", (error as Error).message);
    // 200 dışı: Google yeniden dener
    return json(503, { error: "keys_unavailable" });
  }
  if (!valid) return json(403, { error: "invalid_signature" });

  const userId = parsed.params.get("user_id");
  const transactionId = parsed.params.get("transaction_id");
  const adUnit = parsed.params.get("ad_unit");

  // AdMob panelindeki "URL'yi doğrula" testi ve kullanıcı kimliği iliştirmeyen eski istemciler
  if (!isUuid(userId) || !transactionId) return json(200, { ok: true, result: "no_user" });

  // ZORUNLU: yalnızca bizim ödüllü reklam birimlerimiz. Google'ın imza anahtarı bütün AdMob yayıncıları için
  // ortaktır: bu denetim olmasa başka bir yayıncı kendi reklam biriminin SSV adresine bu fonksiyonu yazıp,
  // kendi reklamını izleyerek buradaki bir hesaba geçerli imzalı ödül yazdırabilirdi.
  const configuredUnits = (Deno.env.get("ADMOB_SSV_AD_UNITS") ?? "").split(",").map((unit) => unit.trim()).filter(Boolean);
  const allowedUnits = configuredUnits.length > 0 ? configuredUnits : DEFAULT_REWARDED_AD_UNITS;
  if (!adUnit || !allowedUnits.includes(adUnit)) {
    console.warn("admob-ssv: beklenmeyen reklam birimi:", adUnit);
    return json(200, { ok: true, result: "unknown_ad_unit" });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data, error } = await admin.rpc("grant_ad_reward_ssv", {
    p_user_id: userId,
    p_transaction_id: transactionId.slice(0, 200),
    p_ad_unit: adUnit,
  });
  if (error) {
    console.error("admob-ssv: ödül yazılamadı:", error.message);
    // Geçici veritabanı hatası: Google yeniden denesin (işlem kimliği tekrar yazmayı önler)
    return json(500, { error: "grant_failed" });
  }
  return json(200, { ok: true, result: data });
});
