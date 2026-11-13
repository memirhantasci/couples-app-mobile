# admob-ssv: ödüllü reklam sunucu tarafı doğrulaması

**Durum (2026-11-13): yazıldı, devrede değil.** Edge Function deploy edilmedi, migration
`20261113000002_ad_reward_ssv.sql` canlıya uygulanmadı (canlıda ROLLBACK'li denendi), istemci değişmedi.

## Neden

Bugün reklam ödülünü istemci `earn_tokens('ad_reward')` ile kendisi ister. Sunucu reklamın izlendiğini
doğrulayamaz; RPC'yi doğrudan çağıran biri günde 25 ödüle kadar jeton toplayabilir. SSV'de AdMob, reklam
bitince bu fonksiyona imzalı istek gönderir ve jetonu yalnızca o yazar.

## Parçalar

| Parça | Yer |
| :-- | :-- |
| İmza doğrulama (saf, WebCrypto) | `verify.ts` |
| Geri çağrı | `index.ts` |
| Tablo + ödül fonksiyonu | `supabase/migrations/20261113000002_ad_reward_ssv.sql` |

Doğrulananlar: imza mantığı Node'da 345 kontrolle (geçerli, değiştirilmiş, başka kullanıcı, bilinmeyen
anahtar, bozuk imza); Google'ın gerçek anahtar listesi P-256 SPKI olarak içe aktarıldı; ödül fonksiyonu canlıda
ROLLBACK'li (ödül, yineleme, 25 sınırı, bilinmeyen kullanıcı, istemci çağıramaz). **Gerçek bir AdMob
isteğiyle denenmedi:** imzalanan baytların ham mı çözülmüş mü olduğu belgede açık değil, kod ikisini de dener.

## Etkinleştirme sırası

Sıra önemli: 3. adımdan önce 4. adım yapılırsa yeni istemcide hiç ödül verilmez.

1. Migration'ı uygula: `supabase db query --linked -f supabase/migrations/20261113000002_ad_reward_ssv.sql`
   (yalnızca ekler; `earn_tokens`'a dokunmaz).
2. Deploy: `supabase functions deploy admob-ssv --no-verify-jwt --use-api`.
   İsteğe bağlı sır: `ADMOB_SSV_AD_UNITS` (ödüllü reklam birimlerinin sayısal kimlikleri, virgülle).
3. **AdMob paneli (elle):** Uygulamalar > reklam birimi (iOS ve Android ödüllü birimleri ayrı ayrı) >
   Gelişmiş ayarlar > Sunucu tarafı doğrulama > geri çağrı URL'si
   `https://<proje>.supabase.co/functions/v1/admob-ssv` > "URL'yi doğrula". Test isteği kullanıcı kimliği
   taşımaz; fonksiyon geçerli imzaya 200 `no_user` döner.
4. İstemci (`src/components/ui/WatchAdModal.tsx`, yeni build ya da OTA):
   - `useRewardedAd(adUnitId, { ..., serverSideVerificationOptions: { userId: <auth kullanıcı kimliği> } })`
   - ödül olayından sonra `earn_tokens` ÇAĞIRMA; bakiye sunucuda birkaç saniye içinde artar:
     `refreshProfile()` ile kısa aralıklarla (ör. 1 sn, en çok 10 sn) yokla, sonra başarı mesajını göster.
   - Günlük sınırda sunucu ödül yazmaz; bakiye artmadıysa "sınır doldu / biraz sonra görünecek" mesajı.
5. Eski sürümler `earn_tokens` kullanmaya devam eder (kimlik iliştirmedikleri için SSV onlara ödül yazmaz,
   çifte ödül olmaz). Yeni istemci yayılıp eskiler kapatılınca:
   `REVOKE EXECUTE ON FUNCTION public.earn_tokens(text) FROM authenticated;`

## Yanıtlar

| Durum | HTTP | Gövde |
| :-- | :-- | :-- |
| İmza geçerli, ödül yazıldı | 200 | `granted` |
| Aynı işlem kimliği yeniden geldi | 200 | `duplicate` |
| 24 saatte 25 ödül doldu | 200 | `limit` |
| Kullanıcı kimliği yok / geçersiz (panel testi) | 200 | `no_user` |
| İmza doğrulanamadı | 403 | |
| Anahtar listesi alınamadı / veritabanı hatası | 503 / 500 | Google 5 kez yeniden dener |
