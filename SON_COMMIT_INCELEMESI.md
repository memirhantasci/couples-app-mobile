# Son Commit İnceleme Raporu: `4f26e19`
**Commit Başlığı:** `feat(stars): gate premium planet access`  
**Tarih:** 10 Eylül 2026  
**Yazar:** memirhantasci  
**Kapsam:** 11 dosya, +1196 satır ekleme, -192 satır silme  
**Statik Tip Denetimi:** `npx tsc --noEmit` ➔ **BAŞARILI (0 Hata)**

---

## 1. Genel Özet ve Amaç

Bu commit ile **Yıldız Modülü (Stars Module)** içerisindeki anı gezegenleri (exoplanets) ve yıldız sahiplenme (star claiming) akışlarına **uçtan uca (Veritabanı RPC/Trigger'dan UI katmanına kadar) Premium Hak Yönetimi (Entitlement Gate)** entegre edilmiştir.

### Temel Mimari Hedefler:
1. **Çift Kademeli Gezegen Mimarisi (Map vs. Details):** Sistem haritasını çizmek için gereken temel yörünge/görsel veriler ile anı detayları (fotoğraflar, mektuplar, başlık, açıklama) ayrılmıştır.
2. **Hassas Veri İzolasyonu:** Kilitli gezegenlerin fotoğrafları, mektup bağlantıları ve açıklamaları `get_star_system_map` ile istemciye ASLA iletilmez.
3. **Kısa Ömürlü İmzalı URL Modeli:** Önceden veritabanına yazılan 10 yıllık kalıcı Signed URL yaklaşımı terk edilmiş, DB'de yalnızca Storage object path saklanması hedeflenmiştir.
4. **Dinamik Paywall Sistemi:** Kullanıcının takıldığı özelliğe özel başlık, açıklama ve aksiyon (CTA) sunan esnek paywall entegrasyonu.

---

## 2. Dosya Bazında Yapılan Değişiklikler

### 🗄️ Veritabanı ve Migration
#### `supabase/migrations/20260914_premium_entitlement_and_gates.sql` (+752 satır)
- **`get_my_couple_id()`:** Çağıran kullanıcının `couple_id` değerini `auth.uid()` üzerinden güvenli biçimde çeken STABLE `SECURITY DEFINER` fonksiyonu.
- **`has_active_premium(p_couple_id)` & `has_my_active_premium()`:** Çiftin `is_premium = true` durumunu ve `premium_expires_at` tarihinin dolup dolmadığını (`c.premium_expires_at IS NULL OR c.premium_expires_at > statement_timestamp()`) denetler. `NULL` süresiz/promosyon hakkını temsil eder.
- **`enforce_premium_star_claim()` (Trigger):** `couple_stars` tablosuna `BEFORE INSERT` trigger'ı olarak eklenmiştir. Premium hakkı olmayan çiftlerin yıldız sahiplenmesini `P0010` exception'ı ile bloke eder. `UPDATE` işlemlerini etkilemez.
- **`get_star_system_map(p_star_id)`:** Sistemdeki gezegenlerin yalnızca yörünge ve görsel verilerini döner (`StarSystemMapPlanet`). Çift premium değilse `is_locked = true` döner, başlık `"Anı Gezegeni"` olarak maskelenir; medya, açıklama ve mektup alanları payload'a dahil edilmez.
- **`get_exoplanet_details(p_exoplanet_id)`:** Gezegenin hassas detaylarını yalnızca aktif Premium üyeler için döner; aksi halde `P0010` hatası üretir.
- **`create_exoplanet(...)` & `update_exoplanet(...)`:** Gezegen ekleme ve düzenleme işlemleri Premium şartına ve kota limitlerine bağlanmıştır.
- **`delete_exoplanet(...)`:** Gezegen silme işlemi, **Premium şartı aranmadan** serbest bırakılmıştır (üyeliği biten kullanıcıların kendi verilerini silebilme hakkı korunmuştur).
- **`append_media_to_exoplanet` & `remove_media_from_exoplanet`:** Storage yolu formatını (`{coupleId}/exoplanets/...`) ve sahipliği doğrulayan atomik RPC'ler.
- **`process_due_auto_exoplanets`:** 45 günlük otomatik gezegen döngüsünü batch halinde işleyen fonksiyon.

---

### 🔐 Kimlik ve Oturum Yönetimi
#### `src/context/AuthContext.tsx` (+39 satır)
- `CoupleProfile` arayüzüne `premiumExpiresAt?: string | null` eklendi.
- **Client-Side Expiry Scheduler:** İstemci tarafında `premiumExpiresAt` zamanına kurulan `setTimeout` mekanizması. Süre bittiğinde state anında `isPremium: false` yapılır ve `refreshProfile()` tetiklenir. 24.8 günlük 32-bit `setTimeout` sınırına karşı parçalı (chunked) zamanlayıcı kullanılmıştır.

---

### 💳 Paywall ve Abonelik Arayüzü
#### `src/components/ui/PremiumPaywall.types.ts` (+12 satır, Yeni Dosya)
- `PremiumFeatureSource` tipi tanımlandı: `'general' | 'star_claim' | 'exoplanet_create' | 'exoplanet_view' | 'exoplanet_auto'`.

#### `src/components/ui/PremiumPaywall.tsx` (+58 satır, -16 satır)
- Tetikleyici kaynağa göre dinamik metinler ve aksiyon butonları:
  - **`star_claim`:** *"Yıldızımızı Aç"*
  - **`exoplanet_create`:** *"Anı Gezegenlerini Aç"*
  - **`exoplanet_view`:** *"Anılarımı Aç"*
  - **`exoplanet_auto`:** *"Otomatik Anıları Aç"*

---

### 🪐 Yıldız ve Gezegen Servis Katmanı
#### `src/modules/stars/types/star.types.ts` (+25 satır, -4 satır)
- `StarSystemMapPlanet` arayüzü tanımlandı (kilit durumu ve temel yörünge alanları).
- `milestone_date` alanı düzenlemede temizlenebilmesi için `string | null` olarak esnetildi.

#### `src/modules/stars/api/starService.ts` (+135 satır, -101 satır)
- **`PremiumRequiredError`:** Backend'den dönen `P0010` premium hatasını yakalayan özel sınıf.
- **`getStarExoplanets`:** Artık doğrudan tablo okumak yerine `get_star_system_map` RPC'sini çağırır.
- **`getExoplanetDetails`:** Hassas gezegen içeriğini `get_exoplanet_details` RPC'si ile çeker.
- **`hydrateMediaUrls`:** Veritabanında saklanan private dosya yollarını oturum esnasında 15 dakikalık geçici Signed URL'lere dönüştürür.

---

### 🎨 Görsel Kanvas ve Modallar
#### `src/modules/stars/canvas/MicroSystemCanvas.tsx`
- Kilitli gezegenler donuk gri tonlarında (`#64748B`, `['#475569', '#94A3B8']`) çizilir; halkalı devlerin halkaları gizlenir.

#### `src/modules/stars/components/ClaimStarModal.tsx` & `ExoplanetModal.tsx`
- Sahiplenme, oluşturma ve düzenleme butonlarına Premium kontrolleri eklendi.
- `view` modunda kilitli gezegenler için fotoğraflar gizlenerek şık bir kilit kartı ve silme imkanı sunulur.

#### `src/modules/stars/components/OurStarScreen.tsx`
- Merkezi `handlePremiumAction(source, action)` koruması.
- Kilitli gezegen tıklandığında veya detay RPC'si hata verdiğinde dinamik `PremiumPaywall` açılır.

---

## 3. Mimari ve Güvenlik İncelemesi: Kritik Bulgular ve Risk Analizi

Aşağıdaki maddeler, commit'in getirdiği yeniliklerin teknik sınırlarını, risklerini ve yapılması gereken düzeltmeleri ortaya koymaktadır:

### ⚠️ 1. Eski 10 Yıllık Signed URL'ler ve "Zero-Leakage" Gerçekliği
* **Bulgu:** Bu commit, yeni oluşturulan veya güncellenen kayıtlar için 15 dakikalık URL mantığını devreye almıştır. Ancak **veritabanındaki mevcut (legacy) `star_exoplanets.media_urls` kayıtları için bir migration/backfill yazılmamıştır.**
* **Risk:**
  1. Daha önce veritabanına yazılmış olan 10 yıllık imzalı URL'ler Supabase CDN üzerinde **hâlâ geçerlidir ve erişilebilirdir**.
  2. `starService.ts` içerisindeki `storagePathFromMediaReference` fonksiyonu URL'den regex ile yol ayıklamaya çalışsa da, geçmişte dışarı sızmış veya istemci tarafında önbelleğe alınmış linkleri iptal etmez.
* **Aksiyon:**
  - Bir SQL update script'i ile veritabanındaki tüm eski imzalı URL'ler canonical dosya yoluna (`{coupleId}/exoplanets/...`) dönüştürülmelidir.
  - Kesin geçersiz kılma (invalidation) hedefleniyorsa Supabase Storage HMAC secret'ı döndürülmeli veya eski nesneler yeni path'e taşınmalıdır.

---

### ⚠️ 2. Mobil Yaşam Döngüsü (App Lifecycle) ve "Tam Saniyesinde Kilitlenme"
* **Bulgu:** `AuthContext.tsx` dosyasında abonelik bitişi yalnızca JavaScript `setTimeout` zamanlayıcısına bağlanmıştır. `AppState` dinleyicisi **bulunmamaktadır**.
* **Risk:**
  - iOS ve Android işletim sistemleri, uygulama arka plana (background) alındığında JS event loop'unu ve zamanlayıcıları askıya alır (freeze).
  - Kullanıcı süresi dolmadan önce uygulamayı arka plana atıp saatler sonra geri açarsa, `setTimeout` çalışmamış olacağından kullanıcı arayüzü kilitli moda geçmeyebilir.
* **TTL Gerçeği:**
  - Daha önce üretilmiş olan 15 dakikalık Signed URL'ler, abonelik tam saniyesinde bitse dahi token süreleri dolana kadar (kalan 1-15 dk) çalışmaya devam eder.
* **Aksiyon:**
  - `AuthContext.tsx` içerisine `AppState.addEventListener('change', ...)` eklenerek uygulama foreground'a (`active`) geçtiğinde `recomputePremiumStatus()` ve `refreshProfile()` tetiklenmelidir.
  - Güvenlik beyanı: *"Arayüz abonelik bitiminde veya uygulama öne geldiğinde kilitlenir; daha önce üretilmiş imzalı linkler kalan TTL süresi (maksimum 15 dk) boyunca geçerlidir"* olarak düzeltilmelidir. İhtiyaca göre TTL süresi 2–5 dakikaya indirilebilir.

---

### ⚠️ 3. 45 Günlük Otomasyon: Cron Fonksiyonu Var, Ancak Schedule Yok!
* **Bulgu:** Migration dosyasında `process_due_auto_exoplanets` fonksiyonu tanımlanmış ve `service_role` yetkisi verilmiştir. Ancak dosyada **`CREATE EXTENSION IF NOT EXISTS pg_cron;` veya `SELECT cron.schedule(...);` ifadesi yer almamaktadır.**
* **Risk:** Fonksiyon veritabanında mevcuttur ancak **otomatik olarak kendiliğinden ASLA tetiklenmeyecektir**.
* **Aksiyon:**
  - Supabase Dashboard veya yeni bir migration ile `pg_cron` extension'ı aktif edilip schedule oluşturulmalı (`SELECT cron.schedule('process-due-auto-exoplanets', '0 * * * *', 'SELECT public.process_due_auto_exoplanets(50);');`).
  - Alternatif olarak Supabase Scheduled Edge Function veya GitHub Actions cron workflow'u kurulmalıdır.

---

### ⚠️ 4. Migration Dosya Adı ve Tarih Sıralaması (`20260914_...`)
* **Bulgu:** Commit tarihi 10 Eylül 2026 olmasına rağmen dosya adı `20260914_premium_entitlement_and_gates.sql` olarak adlandırılmıştır.
* **Neden:** Proje geçmişinde `20260912_...` ve `20260913_...` gibi ileri tarihli migration'lar kullanıldığı için geliştirici monoton sırayı korumak adına 14 değerini seçmiştir.
* **Risk:** Supabase CLI migration'ları alfabetik/leksikografik sırada çalıştırır. Eğer araya gerçek takvim tarihli bir migration (örneğin `20260911_...`) girerse, `20260914`'ten önce çalışır.
* **Aksiyon:** Ekip migration adlandırma standardını monoton artan timestamp formatına (`YYYYMMDDHHMMSS`) standardize etmelidir.

---

### ⚠️ 5. Storage Path Formatı ve Canonical Yapı
* **Bulgu:** Rapordaki önceki metinde geçen `couple-memories/{coupleId}/exoplanets/...` ifadesi bucket adı ile dosya yolunun birleşimini ifade etmektedir.
* **Doğrulama:**
  - **Bucket:** `couple-memories`
  - **Object Path (DB / Storage):** `{coupleId}/exoplanets/{fileName}`
  - Veritabanı fonksiyonundaki kontrol:
    ```sql
    (storage.foldername(v_media_path))[1] IS DISTINCT FROM v_caller_couple_id::text
    OR (storage.foldername(v_media_path))[2] IS DISTINCT FROM 'exoplanets'
    ```
  - Bu kontrol `[1]` = `{coupleId}`, `[2]` = `exoplanets` olmasını bekler. Dolayısıyla veritabanına bucket adı ASLA yazılmamalıdır; kod da bu kuralla uyumlu çalışmaktadır.

---

### ⚠️ 6. Trigger Kapsamı (`enforce_premium_star_claim`)
* **Bulgu:** Trigger `BEFORE INSERT ON public.couple_stars` olarak kurulmuştur.
* **Değerlendirme:**
  - **Olumlu:** Sadece yeni kayıt eklenirken (claim) çalışır. Mevcut bir yıldızın parlaklık, rezonans veya isim güncellemelerinde (`UPDATE`) devreye girmez; dolayısıyla üyeliği bitmiş bir çiftin mevcut yıldızı güncellenirken kilitlenme veya çökme yaşanmaz.
  - **Dikkat:** Admin/seed işlemlerinde veya toplu backfill durumlarında premium olmayan çiftlere yıldız insert edilmek istenirse trigger engelleme yapacaktır.

---

## 4. Kalite ve Test Doğrulaması

- **Statik Kod Analizi:** `npx tsc --noEmit` çalıştırıldı ve sıfır hata ile tamamlandı.
- **Birim Testler:** Projede `npm test` script'i bulunmamaktadır.
- **Entegrasyon Testi Tavsiyesi:** Bu güvenlik fonksiyonlarının SQL Editor'da `postgres` rolüyle değil; Supabase Client üzerinden farklı JWT rolleri (`anon`, `authenticated` [aktif premium], `authenticated` [süresi dolmuş], `authenticated` [farklı çift]) ile test edilmesi kritik önemdedir.
