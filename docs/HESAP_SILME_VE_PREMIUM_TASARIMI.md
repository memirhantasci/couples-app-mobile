# Hesap silme, tek kalma ve Premium sürekliliği: tasarım kararları

Bu dosya, ürün sahibiyle yapılan konuşmanın SONUCUDUR. Her madde kesinleşmiş karardır; yeniden tartışılmaz, yalnızca
uygulanır. Belirsiz kalan yerler en altta "Açık noktalar" başlığındadır (bunlar için önerim yazılı, ürün sahibine sor).

Terimler: **A** = hesabını silen kişi, **B** = partneri. "Tek kalan" = çiftten ayrılmış / eşleşmemiş kullanıcı.

## Yetki (ürün sahibi verdi)
Supabase CLI bu makinede bağlı (`supabase db query --linked`, `supabase functions deploy`, `supabase secrets set`).
Ürün sahibi migration'ları CANLI veritabanına KENDİN uygulamanı, Edge Function'ları deploy etmeni ve gerekli secret'ları
(`REVOKE`/`GRANT`, `REVENUECAT_SECRET_KEY` vb.) eklemeni açıkça onayladı; her seferinde ayrıca sorma. Uygulama yayında değil,
canlıdaki test verisi önemsiz. Yine de her migration'ı önce ROLLBACK'li dene, sonra uygula, sonuçları doğrula ve ürün sahibine özetle.
İstisnalar (hâlâ sor): commit/push, EAS build/submit, mağaza (Play/App Store) işlemleri.

## Önce oku (tuzaklar)
- `supabase db push` ASLA çalıştırma. Migration'lar `supabase db query --linked -f dosya.sql` ile tek tek uygulanır
  (canlıdaki geçmiş tablosu eksik). Önce ROLLBACK'li test, sonra uygula.
- Uygulama henüz yayında DEĞİL; canlı veritabanındaki çiftler/veriler test verisidir, korunmaları gerekmez.
- Çalışma ağacında commit edilmemiş işler var (yeni paywall tasarımı `src/app/paywall.tsx` + `src/components/premium/*`,
  alt çubuk varsayılanı, Premium/davet kartı renkleri, `LetterAdCard`, promosyon kodu girişinin kaldırılması).
  Bunları silme / geri alma.
- Çeviri anahtarları tip güvenlidir: `tr.json` ve `en.json` dosyalarına BİRLİKTE ekle. Dosyalar CRLF.
- RevenueCat v2 gizli anahtarı `C:\Users\emirh\AppData\Local\Temp\claude\...\rc.key` içinde (proje `projb156267f`).
  Supabase'e secret olarak eklenecek (adı: `REVENUECAT_SECRET_KEY`), koda/depoya YAZILMAZ. Anahtar sohbette göründü:
  iş bitince ürün sahibine yenilemesini söyle.
- Premium'u yalnızca `revenuecat-webhook` (service_role) yazar. İstemciye Premium yazma yetkisi verme.
- Mevcut akış: `supabase/migrations/20261022000000_account_deletion.sql`, `20261030000002_partner_notices.sql`,
  `supabase/functions/process-account-deletions/index.ts` (saatlik cron). Bunları oku.

## 1. Hesap silme (A)
- 7 gün bekleme. "Hesabımı Sil"de randevu verilir; hesap hemen silinmez.
- A bekleme süresinde tekrar giriş yaparsa silme OTOMATİK iptal olur ve A bilgilendirilir ("silme talebin iptal edildi").
  B'ye "partnerin vazgeçti" bildirimi gider (mevcut `deletion_cancelled`).
- Silme ekranında A'nın aktif aboneliği varsa uyarı: "Hesabı silmek aboneliğini iptal etmez; mağazadan iptal et"
  + mağaza abonelik sayfası bağlantısı. Zorlama yok.
- Bildirim zamanlaması: silmeye 3 gün ve 1 gün kala push, HEM A'ya ("hesabın siliniyor, vazgeçmek için gir") HEM B'ye.
- Silme talebi bildiriminde B'ye ek Premium cümlesi EKLENMEZ.

## 2. 7. günde ne silinir / ne kalır
Genel kural: **A'nın oluşturduğu/yüklediği/yazdığı HER ŞEY silinir. B'nin oluşturduğu HER ŞEY kalır.**
- Çift kaydı (`couples`) SİLİNMEZ; B'nin çifti olarak kalır (tek üyeli). A çiftten çıkarılır, A'nın hesabı silinir.
- Mektuplar: A'nın yazdıkları (B'ye gidenler dahil) silinir; B'nin yazdıkları KALIR. B'nin yazdığı mektupların alıcısı A'dır:
  A silinirken FK zinciri bu mektupları silmesin (`receiver_id` boşalt / FK kuralını kontrol et).
- Fotoğraflar, günlük, ruh hali, ilaç, regl, takvim notu, harita notu, buluşma: `user_id` kimindeyse onunla gider/kalır.
- Özel günler/anılar (`memories`): A'nın oluşturdukları silinir, B'ninkiler kalır. Otomatik oluşan "tanışma yıldönümü" ve
  "sevgililik yıldönümü" (`is_default = true`) HER ZAMAN silinir.
  → `memories` ve `star_exoplanets` tablolarında OLUŞTURAN yok: `created_by uuid` ekle (yeni kayıtlarda doldur).
  Oluşturanı bilinmeyen eski kayıtlar silinir (test verisi).
- Yıldız (`couple_stars`) ve içindeki tüm gezegenler (`star_exoplanets`): kimin oluşturduğuna bakılmaksızın silinir,
  yıldız gökyüzüne serbest kalır.
- `couples.meet_date` / `relationship_start_date` ve tarih değiştirme sayaçları sıfırlanır (yeni eşleşmede yeniden girilir).
- **Eşleşme kodu YENİLENİR** (eski kodu A biliyor/paylaşmış olabilir). `member_count` = 1, `is_paired` = false.
- Storage: yalnızca A'nın dosyaları silinir (`photo_archive.storage_path`/`thumb_path` A'nınkiler, A'nın avatarı,
  A'nın `memories.image_path` dosyaları). Çiftin klasörünün tamamını SİLME (şu anki edge function bunu yapıyor, değişmeli).
  B'nin dosyaları kalır.
- Çiftle ilgili artakalanlar: `couple_referrals`, `star_connections`, `star_sparks` vb. için tutarlılığı kontrol et.
- B'ye bildirim (`couple_dissolved` metni YENİDEN YAZILACAK): "Partnerin hesabını sildi. Onun oluşturduğu her şey silindi;
  senin oluşturduklarının hepsi duruyor. Yıldızınız ve içindeki gezegenler silindi. Yeni biriyle eşleşebilirsin."

## 3. B tek kaldığında
- Hesabı ve kendi verileri durur; uygulamada gezinir, kendi yazdıklarını okur.
- **Ayarlar'ın EN ÜSTÜNDE belirgin "Yeni eşleşme" kartı**: B tek kalır kalmaz çıkar (silme gününde, beklemeden). Kart,
  yenilenen eşleşme kodunu gösterir/paylaştırır ve kod girme akışına götürür. B'nin yeni kişiyle eşleşmesi mevcut
  kod akışıyla çalışır.
- Yıldız alma sadece çiftlere özeldir: tek kalan Premium alsa bile YILDIZ ALAMAZ.
- Premium satın alma tek kalana AÇIK.
- Özellikler:
  - **Premium'u varsa:** ruh hali, günlük, aşk takvimine not, haritaya pinli not, ilaç takibi, (kadınsa) regl takvimi kullanır.
  - **Premium yoksa:** HİÇBİR ŞEY kaydedemez; yalnızca Gökkubbe'de gezinir ve eski verilerini okur.
  - Bu, sunucuda da zorlanmalı (RLS/tetikleyici), yalnızca istemci kontrolü yetmez.

## 4. Premium kuralları
Premium çiftin kaydında durur. **Kimin aldığı** kayıtlı olmalı: `couples.premium_owner_id uuid` (apply_revenuecat_event'te
`p_user_id` yazılır; mevcut test çiftleri için gerekmez).
- A aldı → silme gününde (7 gün bittiği an) B'nin Premium'u BİTER. Tolerans yok.
- B aldı → B'de kalır. Ömür boyuysa her zaman kalır (kiminle ayrılırsa ayrılsın).
- İkisi de ayrı abonelik aldıysa B'nin kendi aboneliği sürdüğü için kalır.
- Kimse almadıysa değişiklik yok.
- 7 günlük süreçte Premium biterse süreç aynen devam eder (ikisi de ücretsiz).
- Eşleşme/uygulama açılışında Premium sürekliliği: B yeni biriyle eşleşince, B'nin RevenueCat'te aktif yetkisi varsa
  sunucu (RevenueCat v2 REST ile doğrulayarak; istemciye güvenme) yeni çifte, kalan süre kadar Premium yazar.
  Ömür boyuysa yeni çift de süresiz olur. A silindikten sonra aynı Apple/Google hesabıyla yeniden kayıt olup
  eşleşirse aynı mekanizmayla kalan abonelik süresi yazılır (mağaza hesabına göre; e-postaya göre DEĞİL).
- Premium aboneliği olan A'ya silme ekranında "iptal et" uyarısı (madde 1).

## 5. Hareketsiz hesap temizliği (tek kalan/eşleşmemiş)
- Son uygulama açılışı kaydedilir: `users.last_seen_at` (oturum açık kalan kişiyi ölçmek için `last_sign_in_at` yetmez);
  uygulama açılışında, aralıklı (örn. günde bir) güncellenir.
- Yalnızca EŞLEŞMEMİŞ kullanıcılar silinir. Eşleşmiş kullanıcılar ASLA silinmez.
  - Hiç eşleşmemiş yeni kayıt: son açılıştan 30 gün sonra.
  - Eşleşip tek kalan: son açılıştan 60 gün sonra.
  - Aktif aboneliği olan: silinmez. Abonelik bittikten 60 gün sonra silinir.
- Silmeden 7 gün ve 1 gün önce push.
- Silme, hesap silme hattını (dosyalar → `purge_account_data` → `auth.admin.deleteUser`) kullanır; abonelik uyarısı gerekmez
  (aktif abonelik zaten silinmez).

## 6. Yasal / metin güncellemeleri (TR ve EN)
`src/constants/legalTexts.ts` (KVKK, Gizlilik, Kullanım Koşulları, Abonelik), `docs/legal/*` (yeniden üret:
`node scripts/build-legal-pages.js`), `partnerNotice` çevirileri, hesap silme onay metinleri, mağaza veri güvenliği notları.
Eklenecekler: (a) partner silince çift verisinin tamamı değil, silenin içeriği silinir; B'nin içeriği ve hesabı kalır;
(b) hareketsiz eşleşmemiş hesapların silinmesi (30/60 gün, abonelik istisnası); (c) tek kalanın kısıtları; (d) Premium'un
çifte bağlı olduğu ve silenin Premium'u almışsa partnerde bitmesi; (e) hesap silmenin abonelik iptali olmadığı.

## Sonradan netleşen kararlar (2026-11-07)
- **A silerken B de silme talebi verirse (kademeli silme):** Her hesap KENDİ 7. gününde silinir. Örnek: A 1. gün talep verir,
  3. gün B talep verir; A 8. günde, B 10. günde silinir. A silinince madde 2 (B'ye kalanlar) uygulanır; B'nin talebi sürerken
  B'nin hesabı ve içeriği durur. B'nin gününde B'nin hesabı ve KALAN HER ŞEY silinir (hesap, içerik, çift kaydı, dosyalar).
  Bağ kopar. Premium için bkz. "Açık noktalar" 1.
- **Tek kalan, kapalı özelliğe girerse** (fotoğraf, mektup, anı/özel gün, yıldız): engelleme yerine açıklayıcı mesaj:
  "Bu özellik için bir partnerle eşleşmen gerekiyor." + eşleşme kartına/ekranına yönlendirme. Premium olsa bile böyle.
- **Hareketsizlik silmesinden MUAF hesaplar:** mağaza inceleme/demo hesapları (Apple/Google reviewer'ın giriş yaptığı hesap)
  ve geliştirici hesapları. `users.protected_from_cleanup boolean default false` benzeri bir alan ekle; temizlik işi bunları atlar.
  Aksi halde inceleme sırasında hesap silinir ve uygulama reddedilir.
- Anahtar: ürün sahibi verdiği `sk_` anahtarının kullanılmasına izin verdi.

## Üçüncü tur kararlar (2026-11-07)
- **Premium geri gelişi (kesinleşti):** B kendi silme gününde (örnekte 10. gün) her şey silinir (hesap, içerik, çift). Sonradan aynı
  Apple/Google (mağaza) hesabıyla yeniden kayıt olup giriş yapan kişi: hesap BOŞTUR, yalnızca hâlâ süresi olan Premium
  hakkı görünür/kullanılır (uygulama açılışında/ilk girişte mağaza satın almalarını sessizce senkronla ve sunucuda doğrula).
  Silme talebinden 7. güne kadar veriler durur; 7. gün dolunca silinir.
- **Yeni eşleşmede görünürlük (YENİ KURAL):** Eşleşen kişinin görebileceği veriler YALNIZCA eşleşme anından SONRA kaydedilenlerdir.
  - Çifte `paired_at` (ikinci üye katıldığı an) ekle; çiftin ortak görünürlüğü `created_at >= paired_at` ile sınırlı olsun
    (tüm ortak tablolar: memories/özel günler, meetings, calendar_notes, map_notes, photo_archive, letters, moods, medicine*,
    period_logs, daily_notes görünürlüğü vb.; RLS ve RPC'leri tara).
  - İki kişi de önceki sevgililerinden ayrılmış ve birbiriyle eşleşirse: yine yalnızca eşleşme anından itibarenki veriler görünür.
  - Tek kalınca (ve yeni eşleşmeye kadar) **Aşk Ölçer 0**, ana sayfanın üstündeki **tanışma** ve **sevgili olma** sayaçları 0/boş.
    Aşk ölçer yalnızca `paired_at` sonrasındaki etkinlikten hesaplanır (`get_couple_love_activity`).
- **Mektup silme isteği:** Gönderilen mektup silinirken karşı tarafa onay isteği gider. Karşı taraf yoksa (hesabı silinmiş,
  `receiver_id` boş) ya da gönderen yeni biriyle eşleşmişse (mektubun alıcısı artık partneri değil) onay beklenmez: gönderen
  mektubu DOĞRUDAN silebilir (istek akışı atlanır, gönderen yeterli).

## Açık noktalar (ürün sahibine sor, önerim yazılı)
0. KARAR: Yeni eşleşmeden sonra B kendi ESKİ verilerini görmeye devam eder; partner (C) göremez. Aynı kural simetriktir: B de
   C'nin eski verilerini göremez; ikisi de yalnızca eşleşme anından sonrasını ortak görür. Kişisel veriler (ruh hali, günlük, ilaç,
   regl, kendi fotoğrafları, kendi yazdığı mektuplar) sahibine görünür kalır.
   KARAR (kesin): çift düzeyindeki eski ortak öğeler de (özel günler, haritadaki pinler, ortak takvim notları, buluşmalar)
   YALNIZCA oluşturanına (B) görünmeye devam eder; yeni partner (C) kesinlikle göremez. A'nın oluşturdukları zaten silinmiştir.
   B bu eski öğeleri istediği zaman silebilir (hesapta yalnızca kendi oluşturdukları kaldığı için sorun yok).
   Uygulama notu: bu tablolarda görünürlük kuralı `created_by/user_id = ben VEYA created_at >= paired_at` olmalı; silme
   yetkisi yalnızca oluşturana verilir. Takvim/harita ekranları bu eski öğeleri yalnızca sahibine çizer.
1. Kademeli silmede "premium ise kalsın, bağ kopacak, premium olmayan tamamen silinecek" ifadesi: önerim şu — B'nin
   silme gününde hesap ve içerik TAMAMEN silinir (Premium'lu olsun olmasın). "Premium kalsın" = abonelik hakkı mağaza
   hesabına bağlı olduğu için, aynı Apple/Google hesabıyla yeniden kayıt + "satın alımları geri yükle" yapıldığında kalan
   süre geri gelir (madde 4). Sunucuda silinmiş kişinin Premium'u saklanmaz. Ürün sahibine bu yorum doğru mu diye sor.
2. A silme talebindeyken B "çiftten erken ayrıl" diyemez (öneri; şimdilik yok).
3. B 7 gün hiç açmazsa: bildirim + açılışta açıklama diyaloğu yeterli (mevcut).
4. (Karar verildi: tek kalana fotoğraf/mektup/anı kapalı; bkz. yukarıdaki mesaj kuralı.)
5. Premium bitince mevcut "kış uykusu / kasa" yaşam döngüsü (`sync_subscription_lifecycle`) ile yıldızın silinmesi çakışmasın;
   tek kalınca yıldız zaten silindiği için bu döngü tek kalan çift için devreye girmemeli.
6. Mağaza formları (Play veri güvenliği / hesap silme URL) hareketsizlik silmesini yansıtmalı.

## Test
Her migration'ı önce canlıda ROLLBACK'li senaryolarla dene (A siler/vazgeçer, A mektup/foto/özel gün/yıldız,
B içeriği korunur, kod yenilenir, Premium sahibi A/B, tek kalan kısıtları, hareketsizlik silmesi + abonelik istisnası).
JS tarafı için `npx tsc --noEmit`, `npx eslint`, `npm test`. Yeni ekranlar için gerçek cihaz testi gerekir.

## Uygulama durumu (2026-11-07)
Kod yazıldı; sunucu tarafı CANLIDA, istemci yeni build bekliyor. Commit/push yapılmadı.
- Migration'lar (canlıya `db query --linked -f` ile uygulandı; önce ROLLBACK'li 82 senaryo testi geçti):
  `20261107000002_partner_left_schema_and_pairing` (sütunlar, eşleşmede taşıma + sunucuda yeniden şifreleme, paired_at),
  `20261107000003_account_deletion_partner_stays` (silme hattı, hatırlatmalar, hareketsiz hesap temizliği, cron'lar),
  `20261107000004_solo_guards_and_paired_visibility` (tek kalan kısıtları, görünürlük RLS + depolama, aşk ölçer, mektup),
  `20261107000005_premium_owner_and_continuity` (premium_owner_id, apply_verified_entitlement, partnersiz çiftte kış uykusu yok).
- Edge Function'lar deploy edildi: process-account-deletions, send-push, revenuecat-webhook (TRANSFER), sync-premium (yeni),
  ortak kod `supabase/functions/_shared/revenuecat.ts`. Secret: REVENUECAT_SECRET_KEY, REVENUECAT_PROJECT_ID.
- İstemci: `isSolo` (AuthContext), girişte otomatik silme iptali, Ayarlar'da `NewPairingCard`, `src/lib/soloGate.ts` +
  `SoloFeatureBanner`, silmede abonelik uyarısı, `premiumContinuity.ts` (syncPurchases + sync-premium, last_seen).
- Uygulama kararları: buluşma (meetings) ve günlük dilek de eşleşme ister; tek kalanın Premium'u bitince doğrudan ücretsiz
  (kış uykusu/kasa yok). Yeni eşleşmede katılanın kendi kayıtları yeni çifte taşınır, günlük/mektup metinleri yeni çiftin
  anahtarıyla yeniden şifrelenir, dosyalar eski klasörde kalır (`couple_merges` silme kuyruğuna izin verir).
- Bekleyen: RevenueCat anahtarına `customer_information:customers:read` izni (yoksa mağaza doğrulaması atlanır),
  gerçek cihaz testi, açık nokta 1 için ürün sahibi onayı.
