# CoupleSky — Satış Öncesi Kapsamlı Denetim Raporu

**Tarih:** 30 Ekim 2026
**Dal / commit:** `feat/i18n-english` @ `4bf5a15`
**Kapsam:** `src/` (262 dosya, ~71 bin satır), `supabase/` (64 migration, 3 edge function), `plugins/`, `widgets/`, `assets/`, `app.json`, `eas.json`, `docs/legal`, bağımlılıklar ve git geçmişi.
**Kapsam dışı (senin bildiğin eksikler):** Apple/Google geliştirici hesapları, AdMob hesabı ve birimleri, RevenueCat ürünleri/anahtarları. Bunlarla ilgili yalnızca **kodda şimdiden görülen tuzaklar** yazıldı.

> Bu rapor, repodaki eski "0 açık madde" raporunun yerine geçer. Eski rapor `Ek A`'da arşiv olarak duruyor; "sıfır sorun" sonucu bu taramayla doğrulanamadı.

---

## KALAN İŞLER — tek liste (30 Ekim 2026, son durum)

Aşağıdaki liste, raporun geri kalanındaki açık maddelerin hepsini tek yerde toplar. Kodla biten her şey commit'lendi; burada yalnızca **senin yapman gerekenler** ve **bilinçli açık bırakılanlar** var.

### A. Supabase (canlı veritabanı ve function'lar)
- [ ] Migration'ları sırayla SQL Editor'de çalıştır: `20261029000000_star_wishes` (daha önce bekliyordu), `20261030000000_audit_hardening`, `20261030000001_pairing_rate_limit`, `20261030000002_partner_notices`. Daha önce teyit edilmemiş olanlar: `20261024000000`, `20261024000001`.
- [ ] Function'ları deploy et: `revenuecat-webhook` (yeni, `--no-verify-jwt`, `REVENUECAT_WEBHOOK_SECRET` tanımla), `auth-gateway` (min şifre 8), `send-push` (ölü token temizliği + partner bildirimleri).
- [ ] Auth panelinde minimum şifre uzunluğunu 8 yap; Site URL ve `couplesky` yönlendirmelerini (`couplesapp://`) kontrol et.
- [ ] Pro plana geç (günlük yedek, proje duraklamaz, özel SMTP, sızdırılmış-şifre koruması); özel SMTP + e-posta şablonlarında `{{ .Token }}`.
- [ ] `supabase db dump --schema public` ile taban şema migration'ını repoya ekle (O-6).
- [ ] **3-2:** Push tetikleyicilerini ve 6 cron işini canlıda doğrula (bölüm 0.2'deki SQL), eksikleri migration'a dök.

### B. Güvenlik kararları (yayından önce)
- [ ] **K-1:** `set_premium_status` şu an giriş yapan herkese açık ve `FREEMIRHAN`/`DELETEMIRHAN` korunuyor (test için bilinçli). Yayından önce: RPC'yi `service_role`'e kapat, `FREEMIRHAN` kodunu pasifleştir, arka kapı dallarını `PromoCodeCard.tsx`'ten sil.
- [ ] **Y-3:** Ödüllü reklam token'ı için AdMob Server-Side Verification (AdMob hazır olunca; şimdilik günde 25 sınırı var).
- [ ] **2-5:** Sign in with Apple token iptali (`process-account-deletions`'a Apple REST çağrısı; `.p8` anahtarı ve Services ID gerekir).

### C. Hesaplar, kimlikler, ortam
- [ ] Yeni paket adı `app.couplesky.mobile`: Firebase'de yeni Android uygulaması + `google-services.json` (EAS'te `GOOGLE_SERVICES_JSON`), Maps anahtarı paket/SHA-1 kısıtları, Supabase/Google/Apple OAuth, RevenueCat uygulama kaydı, Sign in with Apple servis kimliği.
- [ ] EAS production ortamı: `EXPO_PUBLIC_ADMOB_BANNER_ID`, `..._INTERSTITIAL_ID`, `..._REWARDED_ID` (yoksa reklam gösterilmez), RevenueCat anahtarları (Apple + Google), isteğe bağlı `EXPO_PUBLIC_GEOCODE_URL` / `_KEY`. AdMob panelinde UMP rıza mesajını yayınla.
- [ ] RevenueCat → Integrations → Webhooks: adres + Authorization değeri.
- [ ] Apple Developer, Google Play Console (kapalı test 12 tester / 14 gün, mağaza ilanı, Data safety, reklam beyanı, içerik derecelendirme, hesap silme URL'si, test hesabı), abonelik ürünleri.

### D. Yasal ve alan adı
- [ ] **Veri sorumlusu:** ad-soyad eklendi (Necati Taşcı). **Adres eklenmedi:** ev adresi yerine sanal ofis/şahıs şirketi adresi kararı (O-2); mağaza formlarıyla aynı adres kullanılmalı.
- [ ] **Yasal sayfaların yayını (2-6):** `docs/legal` klasörünü herkese açık bir adrese koy (GitHub Pages özel repoda ücretsiz çalışmaz; couplesky.app üzerinde Cloudflare Pages/Netlify uygun). `docs/legal/en` dahil. Mağaza formlarına bu adresleri yaz.
- [ ] destek@ ve support@couplesky.app posta kutularını aç; alan adına **SPF, DKIM, DMARC** kayıtlarını ekle (2-11).

### E. Yeni build ve gerçek cihaz testi
- [ ] Yeni tam EAS build (paket adı, eklentiler, widget, izinler, AdMob değişti). `version` henüz artırılmadı; native değişiklik sonrası ilk mağaza gönderiminden önce bilinçli karar ver (OTA riski, Y-6).
- [ ] **Widget'lar** (Kotlin ve iOS hiç derlenmedi), UMP rıza formu, satın alma sandbox'ı, push (ön plan/arka plan/kapalı), partner bildirim diyaloğu (silme talebi → vazgeçme → silinme), eşleşme kodu deneme sınırı, ilaç hatırlatıcıları (Doze/tam alarm), Android 15 16 KB sayfa uyumu (Play ön-yayın raporu), ses dosyası (22 kHz mono, `cosmic_ambient`).
- [ ] Tüm akışlarda gerçek cihaz testi: oturum, harita, bildirim, yıldız açılışı.

### F. Küçük ve bilinçli açık kalanlar
- [ ] **3-1 Reklam yerleşimi:** banner/geçiş reklamları hiçbir ekranda yok; yerleşim ekle ya da paywall'daki "Reklamsız Deneyim" maddesini kaldır.
- [ ] `icon.png` sol üstündeki silik çerçeve hayaleti (elle temizlenmeli); 22 ikon düğmesinde belirsiz erişilebilirlik etiketi (O-8).
- [ ] Sentry / native çökme izleme (hesap gerekir, O-4).
- [ ] 62 lint uyarısı (çoğu bilinçli: yerel modüller için `require`, kasıtlı hook bağımlılıkları).
- [ ] Büyük dosyalar (`OurStarScreen.tsx` 2519 satır vb.) bölünmedi.
- [ ] Repo geçmişindeki `.env` / `google-services.json` (repo gizli olduğundan bilinçli olarak atlandı).
- [ ] Hesap silinince partnerin onayı istenmiyor (karar: bilgilendirme var, onay yok).

---

## 0.2 Üçüncü tur tarama (30 Ekim 2026)

Bu tur daha önce bakılmamış hata sınıflarına bakıldı: saat dilimi kayması, önbellek anahtarı uyuşmazlığı, sahipsiz modüller, migration'ların elle gözden geçirilmesi, CI uyumu. `tsc` 0 hata, **20 birim test** geçiyor (yeni: `premiumSync`, `joinCouple`), `npm ci` kilit dosyası uyumlu.

| # | Bulgu | Önem | Durum |
| :-: | :--- | :-: | :--- |
| 3-1 | **Banner ve geçiş reklamları hiçbir ekrana bağlı değil.** `BannerAd` bileşeni ve `useInterstitialAd` kancası hiçbir yerden içe aktarılmıyor; tek reklam akışı ödüllü reklam (`WatchAdModal`). Paywall ise "Reklamsız Deneyim" vaat ediyor | **P1** | **Açık, karar gerekli:** ya yerleşim eklenir (ana sayfa/liste altına banner, belirli eylemler sonrası geçiş reklamı; kod ve rıza akışı hazır) ya da paywall'dan "reklamsız" maddesi kaldırılır. Aksi halde var olmayan bir özellik satılıyor |
| 3-2 | **Push tetikleyicileri ve 6 push cron işi repoda yok.** `send-push` şu tablolar için DB webhook'u bekliyor: `letters, medicine_logs, moods, period_logs, meetings, memories, calendar_notes`; ayrıca cron işleri `medicine_reminder, period_reminder, letter_unlock, meeting_reminder, anniversary_reminder, inactivity_reminder`. Hiçbirinin `CREATE TRIGGER` / `cron.schedule` kaydı migration'larda yok (yalnızca `invoke_push_webhook` ve `invoke_cron_edge_function` fonksiyonları ve `account_deletion`/yıldız cron'ları var). Panelden elle kurulduysa çalışır, ama yeniden kurulamaz ve yanlış/eksik olabilir | **P1** | **Açık.** Canlıda doğrula (aşağıdaki sorgu); eksik olanları ve gerçek saatleri bir migration'a dök |
| 3-3 | Mektup açılışı `unlock_date` gününün **00:00 UTC**'sinde (Türkiye'de 03:00). Ana sayfa ve push "bugün açıldı" hesabı da UTC'ye göre, yani tutarlı ama kullanıcı gece yarısı bekler | P3 | Belgelenmiş bilinçli karar; ürün notu. İstenirse alıcının saat dilimine göre açılış eklenebilir |
| 3-4 | Sahipsiz dosyalar: `PageHeader.tsx`, `NotificationShowcaseModal.tsx`, `StarConnectionsModal.tsx` (yalnızca bir barrel dosyasında geçiyor), `BannerAd*`, `useInterstitialAd*` | P3 | Bundle'a girmez; temizlik ya da 3-1 ile bağlanır |
| 3-5 | Bildirim sonrası yenilenen `daily_notes` anahtarı gerçek sorgu anahtarı `daily_notes_history` ile eşleşmiyor | P3 | Etkisiz (günlük için bilerek bildirim yok) |

**3-2 için canlı veritabanında doğrulama (Supabase → SQL Editor):**
```sql
-- Push webhook tetikleyicileri
select event_object_table, trigger_name, event_manipulation
from information_schema.triggers
where action_statement ilike '%invoke_push_webhook%'
order by 1, 2;

-- Zamanlanmış işler
select jobid, jobname, schedule, active, left(command, 90) as command
from cron.job order by jobname;
```
Beklenen: yukarıdaki yedi tabloda birer tetikleyici ve altı push işi (`CRON` gövdeli `invoke_cron_edge_function` çağrıları). Eksik olan her şey o özelliğin bildirimi hiç gitmediği anlamına gelir. Sonucu paylaşırsan eksikleri migration olarak yazarım.

**Doğrulanan ve sorun çıkmayanlar:** çıkış akışı (önbellek, widget, yerel hatırlatıcılar ve push kaydı temizleniyor), parola yöneticisi öznitelikleri, istemci metin uzunlukları ile DB kısıtları uyumlu (şifreli içerik üst sınırı 30 bin karakter), CI kilit dosyası uyumu, yeni migration'ların elle gözden geçirilmesi.

---

## 0. Düzeltme durumu (aynı gün güncellemesi)

Rapordaki maddelerin çoğu aynı gün kodlandı. `tsc` 0 hata, `expo lint` 0 hata / **62 uyarı** (133'ten), **14 birim test** geçiyor, `expo-doctor` **21/21**, TR/EN çeviri paritesi 2405/2405.

| Madde | Durum | Not |
| :--- | :---: | :--- |
| K-1 Premium RPC açığı | **Açık (bilinçli)** | `set_premium_status` test için açık bırakıldı; `FREEMIRHAN`/`DELETEMIRHAN` korunuyor. **Yayından önce kapatılmalı** |
| K-2 Satın alma senkronu | Kodlandı | `revenuecat-webhook` edge function eklendi, istemci senkronu kaldırıldı. **Deploy + RevenueCat'te webhook tanımı gerekli** (aşağıya bak) |
| Y-1 Paket adı | Kodlandı | `app.couplesky.mobile` (iOS + Android). Firebase/Maps/OAuth/RevenueCat tarafını yeni kimliğe göre kurman gerekir |
| Y-2 Reklam rızası ve test reklamı | Kodlandı | UMP rıza akışı, içerik sınırı (PG), üretimde birim kimliği yoksa reklam yok |
| Y-3 Ödüllü reklam SSV | Ertelendi | AdMob hazır olunca |
| Y-4 Android temalı ikon | Kodlandı | Kalp + yörünge siluetinden üretildi |
| Y-5 Playfair fontu | Kodlandı | `_layout.tsx`'te yükleniyor |
| Y-6 Sürüm / OTA, widget derlemesi | Kısmen | `version` artırılmadı (henüz mağaza ikilisi yok). Kotlin/iOS widget'ı hâlâ derlenmedi, ilk build'de test et |
| Y-7 Bağımlılıklar | Kodlandı | `expo install --fix`, peer'lar, `jsEngine` silindi, AsyncStorage 2.2.0'a döndü |
| Y-8 Git geçmişi | Atlandı | Repo gizli; senin kararın |
| Y-9 Supabase hazırlığı | Kısmen | Şifre en az 8 (istemci + gateway), `client_errors` 30 gün saklama. **Plan, SMTP ve Supabase Auth panelindeki minimum şifre uzunluğu (8) sende** |
| O-1 Yasal metin / şifreleme | Kodlandı | TR+EN eşitlendi, `docs/legal` yeniden üretildi. KDF/GCM güçlendirmesi yapılmadı (anahtar zaten sunucudaki tuzdan türüyor) |
| O-2 Veri sorumlusu kimliği | Bekliyor | Ad/unvan ve adres bilgisi gelince eklenecek |
| O-3 Görseller | Kodlandı | Splash yumuşak kenarlı, `icon.png` alfasız. İkondaki silik çerçeve hayaleti elle temizlenmeli |
| O-4 Sentry / native çökme izleme | Açık | Hesap gerekir |
| O-5 Promosyon deneme sınırı | Kodlandı | 15 dk'da 10 deneme (migration `20261030000000`) |
| O-6 Taban şema | Kısmen | Eski `run_me_in_supabase.sql` silindi. `supabase db dump` ile taban migration canlı veritabanından alınmalı |
| O-7 search_path | Kodlandı | Aynı migration |
| O-8 Erişilebilirlik | Kısmen | 55 ikon düğmesine rol+etiket; 22 belirsiz ikon kaldı |
| O-9 Test / CI | Kodlandı | jest-expo, 14 test, `.github/workflows/ci.yml` |
| D-1 Lint | Kısmen | 133 → 62 uyarı |
| D-2 `console.*` | Kodlandı | `logger` kullanılıyor |
| D-3 LICENSE / README | Kodlandı | |
| D-4 Yetim varlıklar | Kısmen | `assets/expo.icon` silindi; 3 MB wav durdu (dönüştürücü yok) |
| D-5 Token yenileme | Kodlandı | AppState ile start/stopAutoRefresh |
| D-6, D-7, D-8 | Atlandı | Bilgi amaçlı / büyük refaktör |

**Senin yapman gerekenler (kodla bitmeyenler):**
1. Migration `20261030000000_audit_hardening.sql`'i Supabase SQL Editor'de çalıştır.
2. `supabase secrets set REVENUECAT_WEBHOOK_SECRET=<uzun rastgele değer>` ve `supabase functions deploy revenuecat-webhook --no-verify-jwt`; RevenueCat → Integrations → Webhooks: URL `<proje>/functions/v1/revenuecat-webhook`, Authorization header = aynı değer.
3. `auth-gateway`'i yeniden deploy et (min şifre 8) ve Supabase Auth panelinde minimum şifre uzunluğunu 8 yap.
4. Yeni paket adı için Firebase'de Android uygulaması + yeni `google-services.json` (EAS'te `GOOGLE_SERVICES_JSON`), Maps anahtarı kısıtları, Supabase/Google/Apple OAuth ayarları.
5. EAS production ortamına `EXPO_PUBLIC_ADMOB_BANNER_ID`, `..._INTERSTITIAL_ID`, `..._REWARDED_ID` (birim kimlikleri yoksa artık reklam gösterilmez); AdMob panelinde UMP rıza mesajı yayınla.
6. Native değişiklik çok (paket adı, eklentiler, widget, izinler): yeni bir tam EAS build al ve widget'ı cihazda dene.

---

## 0.1 İkinci tur tarama (aynı gün)

Aynı gün ikinci kez baştan tarandı. Android ve iOS paketleri `expo export` ile gerçekten derlendi (her biri 13 MB Hermes bytecode), `tsc` 0 hata, 14 test geçiyor.

**Bu turda bulunup düzeltilenler**

| # | Bulgu | Önem | Düzeltme |
| :-: | :--- | :-: | :--- |
| 2-1 | `join_couple_by_code_uuid` deneme sınırı yoktu: 6 haneli kod (≈887 milyon) otomatik denenip kimsenin beklediği bir çifte katılınabilirdi | **P1** | Kullanıcı başına 10 dk'da 20 deneme. Başarısız denemeler hata fırlatıp sayaçla birlikte geri alınacağından sonuç `result_error` ile döndürülüyor (migration `20261030000001`, istemci `src/lib/joinCouple.ts`) |
| 2-2 | Bütün Inter ve Playfair font varyantları (30 dosya, ~9 MB) uygulamaya giriyordu; yalnızca 7'si kullanılıyor | P2 | Alt yoldan içe aktarma; pakette 7 font kaldı |
| 2-3 | `send-push` ölü push token'larını (`DeviceNotRegistered`) hiç silmiyordu; token'lar birikir, her seferinde boşa gönderim denenirdi | P2 | Üç gönderim noktasında temizlik eklendi |
| 2-4 | RevenueCat webhook'u `SUBSCRIPTION_EXTENDED` ve `REFUND_REVERSED` olaylarını tanımıyordu | P3 | Eklendi |

**Açık kalanlar (senin kararın ya da hesabın gerekir)**

| # | Bulgu | Önem | Not |
| :-: | :--- | :-: | :--- |
| 2-5 | **Sign in with Apple token iptali yok.** Apple, hesap silinince Apple'a "token revoke" çağrısı yapılmasını şart koşar; `process-account-deletions` yapmıyor | **P1 (iOS)** | Apple Developer anahtarı (`.p8`) ve Services ID gerekir; hesap açılınca eklenecek |
| 2-6 | **Yasal sayfalar nerede yayınlanacak?** GitHub Pages özel (private) repoda ücretsiz planda çalışmaz. Mağaza formları herkese açık bir URL ister | **P1** | Seçenekler: couplesky.app alan adında statik barındırma (Cloudflare Pages / Netlify ücretsiz) ya da ayrı herkese açık bir repo. `docs/legal` klasörünü olduğu gibi yükleyebilirsin |
| 2-7 | **Bir hesap silinince çiftin tüm verisi silinir** (partnerin kendi fotoğrafları, günlükleri dahil), partnere bildirim gitmez; partner bir anda eşleşmemiş görünür | P2 | Ürün/hukuk kararı. Arayüz metni bunu söylüyor ama partnerin onayı yok. En azından partnere push + açıklayıcı bir ekran önerilir |
| 2-8 | `avatars` bucket'ı herkese açık (UUID yollu URL); gizlilik metni "özel depolama" derken bunu belirtmiyor | P3 | Metne tek cümle ekle ya da imzalı URL'ye geç |
| 2-9 | Demo verileri Unsplash'tan canlı çekiliyor (çevrimdışı demo görselsiz kalır, Unsplash koşulları) | P3 | Görselleri pakete al ya da kendi depolamana taşı |
| 2-10 | Harita yedeği herkese açık Nominatim kullanıyor (saniyede 1 istek sınırı, yoğun kullanım yasak) | P3 | Kullanıcı artınca ücretli geocoding (Google/MapTiler) |
| 2-11 | `couplesky.app` e-postası için SPF/DKIM/DMARC kayıtları (OTP ve destek postaları spama düşmesin) | P1 | Alan adı DNS ayarı, SMTP sağlayıcısı verdiği kayıtları ekle |

**Güncelleme (2-7 … 2-10 ve ses dosyası kapatıldı):**

- **2-7 Partner bilgilendirmesi:** yeni `partner_notices` tablosu ve migration `20261030000002`. Silme talebinde, vazgeçildiğinde ve hesap silinip çift dağıldığında partner **push bildirimi** alır ve uygulamada, ortak verilere ne olduğunu anlatan bir **açıklama diyaloğu** görür (`PartnerNoticeHost`, TR/EN). Silme onay metni ve KVKK/Gizlilik metinleri partnerin bilgilendirileceğini söyleyecek şekilde güncellendi. Partnerin onayı istenmiyor; karar ürün kararı olarak olduğu gibi bırakıldı.
- **2-8 Avatar:** KVKK ve Gizlilik metinlerine (TR/EN) profil fotoğrafının herkese açık depolamada, tahmin edilemez adreste tutulduğu cümlesi eklendi.
- **2-9 Demo görselleri:** Unsplash zaten hotlink'i şart koştuğu için görseller pakete gömülmedi (App Review'un kullandığı demo yolunu bozma riski); demoya girilirken diske önceden indiriliyor, ilk açılıştan sonra çevrimdışı da çalışır.
- **2-10 Harita yedeği:** Nominatim istekleri sıraya alınıp saniyede en fazla 1 istekle sınırlandı, sonuçlar önbelleğe alınıyor. Kullanıcı artınca `EXPO_PUBLIC_GEOCODE_URL` / `EXPO_PUBLIC_GEOCODE_KEY` ile Nominatim uyumlu ücretli bir sağlayıcıya (ör. LocationIQ) kodsuz geçilebilir.
- **`cosmic_ambient.wav`:** 3,2 MB → 0,8 MB (22,05 kHz mono).

**Gerçek cihazda mutlaka denenecekler (kodla doğrulanamaz):** Doze modunda ilaç hatırlatıcılarının saatinde çalışması (Android tam alarm izni), Android 15'te 16 KB sayfa boyutu uyumu (Play ön-yayın raporuna bak), widget'lar, UMP rıza formu, satın alma sandbox'ı, push bildirimi (ön plan/arka plan/kapalı).

---

## 1. Yönetici özeti

Uygulamanın temeli sağlam: TypeScript 0 hata, lint 0 hata, i18n 2094/2094 anahtar paritesi, tüm tablolarda RLS, oturum şifreli saklanıyor, hesap silme akışı var, paywall mağaza kurallarına uygun, listeler sanallaştırılmış.

**Ama bugünkü haliyle satışa çıkarsan para kaybettirecek iki sorun var** ve ikisi de Premium'la ilgili:

1. **Giriş yapmış herhangi bir kullanıcı kendine ücretsiz, süresiz Premium verebilir.** (K-1)
2. **Ödeme yapan bir kullanıcının Premium'u, partneri uygulamayı açınca silinebilir.** (K-2)

Bunların dışında 9 yüksek öncelikli, 9 orta, 8 düşük öncelikli madde var. Toplam **28 bulgu**.

| Öncelik | Adet | Anlamı |
| :--- | :---: | :--- |
| **P0 — Kritik** | 2 | Satıştan önce mutlaka düzelmeli (gelir / güvenlik) |
| **P1 — Yüksek** | 9 | İlk mağaza gönderiminden önce düzelmeli |
| **P2 — Orta** | 9 | İlk sürümden sonraki 2–4 hafta içinde |
| **P3 — Düşük** | 8 | Fırsat buldukça |

### Bu taramada neyi nasıl doğruladım

| Kontrol | Sonuç |
| :--- | :--- |
| `tsc --noEmit` | 0 hata |
| `expo lint` | 0 hata, 133 uyarı (95'i kullanılmayan değişken) |
| `expo-doctor` | **4/21 kontrol başarısız** (bkz. Y-7) |
| `expo install --check` | **29 paket sürüm uyumsuz** |
| `npm audit` | 1 kritik, 12 yüksek — hepsi geliştirme/CLI zincirinde (bkz. D-6) |
| Migration'lar | 64 dosya sırayla oynatılıp her fonksiyonun nihai `EXECUTE` yetkisi çıkarıldı (otomatik analiz, el ile doğrulandı) |
| Git geçmişi | Hassas dosyalar için tarandı |

### Doğrulayamadıklarım (dürüst sınır)

- **Canlı Supabase veritabanının gerçek durumu.** Bulgular migration dosyalarına dayanıyor; canlıda elle değişiklik yapıldıysa farklı olabilir. K-1 için aşağıda tek satırlık doğrulama sorgusu var.
- **Cihazda görsel/UI testi.** Kodu ve görselleri (ikon, splash) inceledim; uygulamayı bir cihazda çalıştırmadım.
- **Android/iOS widget'ları, edge function'ların deploy durumu, EAS ortam değişkenleri, GitHub reposunun gizli/herkese açık olması.** Bunlara bu ortamdan erişemiyorum.

---

## 2. P0 — KRİTİK

### K-1 · Herkes kendine ücretsiz süresiz Premium verebilir
**Kanıt**
- `supabase/migrations/024_enable_freemirhan_and_solo_premium.sql:46` — `GRANT EXECUTE ON FUNCTION public.set_premium_status(...) TO authenticated;` Bir önceki migration (023) bu fonksiyonu bilerek yalnızca `service_role`'e kapatmıştı; 024 geri açıyor ve sonrasında kapatan migration yok.
- Fonksiyon çağıranın çiftini bulup `is_premium = true, premium_expires_at = NULL` yazıyor. Çifti yoksa **kendisi çift bile oluşturuyor** (024, satır 25–31).
- `src/components/profile/PromoCodeCard.tsx:54` ve `:87` — uygulamanın içinde `FREEMIRHAN` (Premium ver) ve `DELETEMIRHAN` (Premium al) arka kapıları var. Uygulama paketinden metin olarak okunabilir.
- `024:49-51` — `FREEMIRHAN` kodu veritabanında **3650 gün Premium** veren, aktif bir promosyon kodu olarak da duruyor.

**Etki:** Premium'un tüm kilitleri (fotoğraf arşivi, erkek partnerin döngü görünümü, mektup ücreti, reklamsızlık) aşılır. Telefondaki uygulamayı hiç açmadan, yalnızca bir REST çağrısıyla yapılabilir.

**Canlıda doğrula (Supabase → SQL Editor):**
```sql
select has_function_privilege('authenticated', 'public.set_premium_status(boolean, timestamptz)', 'execute');
-- true dönerse açık
```

**Çözüm**
1. Yeni migration: `REVOKE ALL ON FUNCTION public.set_premium_status(boolean, timestamptz) FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;`
2. `update public.promo_codes set is_active = false where code = 'FREEMIRHAN';`
3. `PromoCodeCard.tsx` içindeki `FREEMIRHAN` / `DELETEMIRHAN` dallarını sil. Test Premium'u için sunucu tarafındaki normal `redeem_promo_code` yeterli (süreli, kullanım limitli kod üret).
4. Premium'u **yalnızca RevenueCat webhook'u** yazsın (bkz. K-2).

### K-2 · Satın alma senkronu, ödeme yapılmış Premium'u silebilir
**Kanıt**
- `src/lib/revenuecat.ts:145-164` — `syncPremiumStatus`, RevenueCat'te `Premium` hakkı yoksa **`set_premium_status(false, null)`** çağırıyor.
- `src/context/AuthContext.tsx:413` ve `:522` — bu senkron **her uygulama açılışında ve her girişte**, o anki kullanıcı için çalışıyor.
- Premium **çifte** ait, RevenueCat müşterisi ise **kullanıcıya** ait.

**Senaryo:** A kişisi Premium alır → çift Premium olur. B kişisi uygulamayı açar → RevenueCat "B'nin hakkı yok" der → istemci çiftin Premium'unu `false` yapar. A uygulamayı yeniden açana kadar iki kişi de Premium'suz kalır. Aynı şekilde promosyonla verilen 3650 günlük Premium da ilk girişte silinir.

RevenueCat anahtarları (Apple + Google) tanımlanınca bu hata canlıya geçer; **K-1 kapatılınca ise senkron sessizce hata verip hiçbir şey yazmayacağı için Premium hiç aktifleşmez.** İkisi birlikte çözülmeli.

**Çözüm (tek doğru mimari):**
- Supabase'de bir `revenuecat-webhook` edge function: RevenueCat olaylarını (`INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION` …) dinler, `app_user_id` (Supabase kullanıcı UUID'si) → çift → `couples.is_premium / premium_expires_at` günceller. Yetki: `service_role` + webhook gizli anahtarı (mevcut `send-push` ile aynı Vault modeli).
- `syncPremiumStatus` istemciden kalksın; satın alma / geri yükleme sonrası istemci yalnızca `refreshProfile()` çağırsın.
- Promosyonla verilen Premium ile mağaza aboneliği ayrı alanlarda tutulsun ya da webhook yalnızca "mağaza kaynaklı" süreyi yönetsin; aksi halde promosyon bitiş tarihini ezer.

---

## 3. P1 — YÜKSEK

### Y-1 · Paket adı kişisel isim taşıyor — mağazadan sonra değiştirilemez
`app.json`: `com.memirhantasci.couplesapp` (iOS ve Android), `slug: "emirhan"`. Marka CoupleSky, alan adı couplesky.app. **Henüz hiçbir mağaza hesabı açılmadığı için şu an değiştirmek ucuz, yayınlandıktan sonra imkânsız.** Değişirse etkilenenler: `google-services.json` (Firebase), Google Maps SHA-1/paket kısıtı, Supabase OAuth yönlendirmeleri, RevenueCat uygulama kaydı, Sign in with Apple servis kimliği. Öneri: `app.couplesky.mobile` gibi tek seferlik bir karar ver, hesapları ona göre aç.

### Y-2 · Reklamlar: üretimde sessizce test reklamı, rıza ekranı yok
- `src/hooks/useInterstitialAd.ts:22`, `src/components/ui/BannerAd.tsx:25`, `src/components/ui/WatchAdModal.tsx:30` — `EXPO_PUBLIC_ADMOB_*_ID` ortam değişkeni yoksa **üretim sürümü Google test reklam birimine düşüyor**; hata vermiyor, hiç gelir getirmiyor. Hafızandaki not: EAS production ortamında yalnızca AdMob *uygulama* kimlikleri var, *birim* kimlikleri yok.
- Hiçbir yerde AdMob'un kullanıcı rıza formu (UMP / `AdsConsent`) yok. AB/UK kullanıcıları için Google bunu zorunlu tutuyor; reklam yayını kısıtlanabilir. Türkiye'de de GDPR kapsamındaki kullanıcılar olacak.
- Çözüm: üretimde birim kimliği yoksa **reklamı hiç gösterme** (test'e düşme); UMP rıza akışını ekle; reklam içerik derecelendirmesini (`maxAdContentRating`) ayarla. Apple "App Privacy" ve Play "Data safety" formlarında reklam kimliği beyanı gerekecek.

### Y-3 · Ödüllü reklam token'ı istemci beyanına güveniyor
`src/components/ui/WatchAdModal.tsx:82` istemci `earn_tokens('ad_reward')` çağırıyor; sunucu reklamın izlenip izlenmediğini **bilmiyor** (`023_premium_and_security_tightening.sql:83-92`: yalnızca günde 25 sınırı). Uygulamayı açmadan doğrudan çağrılarak günde 625 token (≈6 mektup) toplanabilir. Çözüm: AdMob **Server-Side Verification (SSV)** — ödüllü reklam birimi için geri çağrı adresi tanımla, token'ı yalnızca bu doğrulanmış çağrı versin; `earn_tokens`'ı istemciden kapat.

### Y-4 · Android "temalı ikon" Expo şablonunun gri ok işareti
`assets/images/android-icon-monochrome.png` (432×432) hâlâ **Expo'nun varsayılan "^" simgesi**. Android 13+ cihazlarda kullanıcı temalı ikonu açtığında CoupleSky yerine bu çıkar. Çözüm: kalp siluetinden tek renkli (saydam zemin) bir monochrome ikon üret.

### Y-5 · Playfair Display fontu hiç yüklenmiyor
`MapStoryModal.tsx:399` ve `CoupleWrappedModal.tsx:459,482,492,592` `PlayfairDisplay_700Bold` / `_400Regular_Italic` kullanıyor; ancak `@expo-google-fonts/playfair-display` paketi **hiçbir yerde içe aktarılmıyor**, `_layout.tsx` yalnızca Inter'i yüklüyor. Sonuç: Wrapped ve harita hikâyesi paylaşım kartlarının serif başlıkları sistem fontuyla çıkıyor. Bunlar uygulamanın **Instagram'daki vitrini**. Çözüm: `useFonts`'a `PlayfairDisplay_700Bold` ve `PlayfairDisplay_400Regular_Italic` ekle (paket zaten bağımlılıklarda).

### Y-6 · Native değişiklikler + sabit sürüm = OTA kazası riski; Kotlin widget derlenmedi
- Bu dal native tarafı değiştiriyor: `expo-localization` eklentisi, `locales/native/*`, iOS izin metinleri, Android widget kaynakları, AdMob kimlikleri. Ancak `version` hâlâ `1.0.0`, `runtimeVersion` politikası `appVersion` ve `production` kanalı açık. Eski `1.0.0` bir binary'ye OTA ile bu JS gönderilirse (`expo-localization` yerel modülü yok) açılışta çökme olur. Hafızandaki "production Android build başarısız (runtime mismatch)" notu aynı kök sebep.
- Çözüm: yeni binary çıkarken `version`'ı artır (örn. `1.0.1`) ya da OTA'yı yalnızca yeni binary'lerin kanalına bağla; mağazaya gidecek ilk sürümde `production` kanalına dokunulmadığını doğrula.
- Yazdığım **Kotlin widget kodu ve iOS widget bir kez bile derlenmedi** (yalnızca kod incelemesi). İlk EAS build'de ve gerçek cihazda widget'ı ayrıca test et.

### Y-7 · Bağımlılık sağlığı: `expo-doctor` 4 hata
| Sorun | Ayrıntı | Çözüm |
| :--- | :--- | :--- |
| Şema hatası | `app.json:10` `"jsEngine": "hermes"` — SDK 57'de geçersiz alan | Satırı sil (Hermes zaten varsayılan) |
| Eksik peer | `react-native-svg` (lucide'in 107 dosyada kullanılan ikonları), `expo-asset` (expo-audio) — şu an başka paketin geçişli bağımlılığıyla çalışıyor, kırılgan | `npx expo install react-native-svg expo-asset` |
| Çift native paket | `@expo/ui` 57.0.9 + `expo-widgets` içinde 57.0.16 | `@expo/ui`'yi `~57.0.26`'ya çek |
| Sürüm uyumsuzluğu | 29 paket eski (`expo 57.0.14` → `57.0.31`, `expo-notifications .8 → .24`, `expo-router .10 → .29`, `react-native 0.86.2 → .3` …). **`async-storage` 3.1.1, SDK'nın beklediği 2.2.0'dan major farklı** | `npx expo install --fix`, sonra tam build + cihaz testi. AsyncStorage 3'ün bilinçli seçim olup olmadığını teyit et |

### Y-8 · Git geçmişinde hassas veri
- `.env` dosyası geçmişte **3 commit'te içerikli** duruyor (`6920e2c`, `b5ab514`, `a206f80`; `4cf9ed1` ile silindi): Supabase anon anahtarı, **Google Maps API anahtarları** ve eski `EXPO_PUBLIC_ENCRYPTION_KEY`. `google-services.json` da geçmişte (`b5ab514`). Hafızandaki "geçmiş temizliği" maddesi sadece `google-services.json`'ı kapsıyordu; **`.env` de eklenmeli.**
- Anon anahtarı zaten uygulamaya gömülü (halka açık sayılır). Asıl risk: **Maps anahtarları** (kota/fatura kötüye kullanımı) — Google Cloud'da paket adı + SHA-1 kısıtı olduğunu doğrula. Eski şifreleme anahtarı artık kullanılmıyor (migration 021 ile çift başına anahtar); eski verinin o anahtarla şifreli kalıp kalmadığını kontrol et.
- `gh` bu makinede yok; **GitHub deposunun gizli (private) olduğunu elle doğrula.** Herkese açıksa geçmiş temizliği öncelik kazanır.

### Y-9 · Supabase üretim hazırlığı
- **Plan:** Ücretsiz planda proje 1 hafta kullanılmazsa duraklar ve otomatik yedek yoktur. Para kazanan bir uygulama için Pro plan (günlük yedek, duraklama yok, özel SMTP, sızdırılmış-şifre koruması).
- **Özel SMTP** (listende var): varsayılan Supabase e-postası saatte birkaç mesajla sınırlı; doğrulama/şifre-sıfırlama kodları yeni kullanıcıları boğar.
- **Şifre politikası:** `auth-gateway` ve Auth ayarı en az **6** karakter kabul ediyor (`index.ts:20`). 8+ öner.
- **Veri temizliği:** `client_errors` tablosunda saklama/silme işi yok; zamanla büyür. `login_attempts`/`otp_codes` kısmen temizleniyor.

---

## 4. P2 — ORTA

**O-1 · Yasal metin gerçek şifreleme modeliyle uyuşmuyor.** `legalTexts.ts:68` (TR) hâlâ "şifreleme anahtarı uygulamanın içinde bulunur" ve "deterministik şifreleme" diyor; gerçekte anahtar, sunucudaki çift tuzundan türetiliyor (`src/utils/crypto.ts`) ve IV rastgele. EN metin (`:261`) bu açıklamayı hiç içermiyor. Ayrıca arayüz metinleri "yalnızca sen görürsün / şifreli kasa" diyor; teknik olarak veritabanı yöneticisi (sen) çözebilir. Şifreleme AES-256-**CBC**, kimlik doğrulamasız ve PBKDF2 yalnızca **1000** tur. KVKK/GDPR açısından yanıltıcı beyan riski: metinleri "içerik sunucuda şifreli saklanır, erişim RLS ile çiftle sınırlıdır; uçtan uca şifreleme değildir" çizgisinde TR/EN eşitle. İleride anahtar türetimini güçlendir (en az 100 bin tur ya da Argon2).

**O-2 · Veri sorumlusu kimliği eksik.** KVKK metnindeki "Veri sorumlusu: CoupleSky" bir tüzel kişi/şahıs adı, adres ve iletişim içermiyor; KVKK 10. madde ve Play/App Store geliştirici bilgileri bunu ister. (Listende "KVKK placeholder'ları" olarak var.)

**O-3 · Görsel varlıklar.**
- `splash-icon.png` kendi arka planı olan **kare** bir görsel; koyu `#0A0A0C` zeminde 120 pt'lik net kenarlı bir kutu olarak görünecek, kenarları da %86 opak (yarı saydam). Çözüm: kalbi saydam zeminli olarak çıkar ya da splash zeminini görselin tonuna eşitle.
- `icon.png`'nin sol üst bölgesinde silik, **yuvarlak köşeli bir çerçeve hayaleti** görünüyor (önceki "yapay çerçeve temizliğinden" kalma). Mağaza ikonunda fark edilir.
- `android-icon-foreground.png` ile `android-icon-background.png` **bayt bayt aynı dosya**. Kalp merkezde olduğu için kırpılmıyor ama iki katman aynı; foreground'u saydam kalp, background'u düz bulut/gökyüzü yap.
- `icon.png` RGBA (alfa kanallı ama %100 opak). Expo iOS build'inde alfa temizleniyor; yine de App Store için alfasız (RGB) dışa aktarmak en güvenlisi.

**O-4 · Gözlemlenebilirlik.** Yalnızca JS hataları `client_errors`'a yazılıyor; **native çökmeler, ANR, widget hataları görünmez.** Sentry (source map'li) ya da Firebase Crashlytics ekle. En azından Play Console "Android vitals" ve App Store Connect çökme raporlarını izlemeye al.

**O-5 · Promosyon kodunda deneme sınırı yok.** `redeem_promo_code` yanlış denemeleri saymıyor; kısa kodlar kaba kuvvetle bulunabilir. `consume_auth_rate_limit` zaten var; bunu kullan.

**O-6 · Veritabanı taban şeması repoda yok.** `users`, `couples`, `letters`, `memories`, `daily_notes`, `medicines`, `device_authorizations` … tabloları için `CREATE TABLE` migration'ı yok; bunlar panelden oluşturulmuş. Yeni bir ortam (staging, felaket kurtarma) repodan kurulamaz. `supabase db dump --schema public` ile bir taban migration'ı çıkar. Kök dizindeki `run_me_in_supabase.sql` (781 satır), `20260914_*` migration'ının eski kopyası; sil ya da `docs/` altına taşı.

**O-7 · 4 `SECURITY DEFINER` fonksiyonda `search_path` yok:** `save_daily_note`, `log_medicine_dose`, `toggle_period_log` (003), `check_period_log_rules`. Supabase'de `public` şemasına yazma yetkisi kapalı olduğu için pratik risk düşük, ama `SET search_path = ''` ekleyip kapat.

**O-8 · Erişilebilirlik.** ~400 dokunulabilir öğeye karşı 134 `accessibilityLabel/Role`. Kalp/ikon düğmeleri ekran okuyucuda "düğme" olarak okunur. Mağaza reddi nedeni değil ama kalite ve bazı ülke düzenlemeleri için önemli; önce ana sekmeler ve paywall.

**O-9 · Otomatik test ve CI yok.** Hiç test dosyası ve `.github/` yok. Premium/şifreleme/tarih hesapları gibi saf fonksiyonlar (`crypto.ts`, `loveScore.ts`, `periodCycle.ts`, `serverErrors.ts`) için birkaç birim test ve `tsc + lint` yapan bir CI iş akışı yeterli bir başlangıç.

---

## 5. P3 — DÜŞÜK

| # | Konu | Not |
| :-: | :--- | :--- |
| D-1 | Lint uyarıları | 133 uyarı: 95 kullanılmayan değişken/import, 14 `exhaustive-deps`, 9 `import/first`, 9 `require` kullanımı. `expo lint --fix` 11'ini kendisi düzeltir |
| D-2 | Üretimde `console.*` | 21 yerde (`AuthContext.tsx:367,404,419,526,549,687`, `verify.tsx`, `TabBarContext.tsx` …) `logger` yerine doğrudan `console` kullanılıyor; hassas veri yok ama gürültü ve cihaz günlüğüne sızıntı |
| D-3 | `LICENSE` ve `README` | `LICENSE` Expo'nun MIT lisansı ("650 Industries") — şablondan kalma; ticari/kapalı kaynak uygulamada kaldır ya da kendi lisansınla değiştir. `README.md` varsayılan Expo şablonu |
| D-4 | Yetim/ağır varlıklar | `assets/expo.icon/` kullanılmıyor (`ios.icon` artık `icon.png`); `cosmic_ambient.wav` 3,1 MB (m4a/mp3 ile ~10× küçülür) |
| D-5 | Token yenileme | `supabase.ts`'te `AppState` ile `startAutoRefresh/stopAutoRefresh` yok (Supabase'in RN önerisi). Uzun arka plandan dönüşte ilk istek 401 görebilir |
| D-6 | `npm audit` | 1 kritik (`shell-quote`) + 12 yüksek; hepsi `@expo/cli` / `expo-router` geliştirme zincirinde, uygulama paketine girmiyor. Önerilen "düzeltmeler" (örn. `expo@51`) **sürüm düşürme** — uygulama; `expo install --fix` sonrası yeniden bak |
| D-7 | Dışa aktarım uyumu | `ITSAppUsesNonExemptEncryption: false` (`app.json:28`) — uygulama kendi AES şifrelemesini kullanıyor. Çoğu uygulama gibi muaf sayılabilir ama App Store Connect anketinde bilinçli yanıtla (Fransa için ayrı beyan gerekebilir) |
| D-8 | Çok büyük dosyalar | `OurStarScreen.tsx` 2519, `ExoplanetModal.tsx` 1850, `letters.tsx` 1740, `login.tsx` 1517 satır; bakımı zorlaştırıyor, performans sorunu değil |

---

## 6. Mağaza formları için kod kaynaklı dikkat noktaları

Hesapları açınca formları doldururken bunları beyan etmen gerekecek (kodda gördüklerim):

- **Hassas veri:** döngü/regl kayıtları, ilaç-vitamin saatleri (sağlık verisi) → Play "Data safety" + sağlık beyanı, Apple "App Privacy → Health & Fitness". Periyot ekranına "tıbbi tavsiye değildir" notu eklemek iyi olur.
- **Konum:** yaklaşık/kesin konum (buluşma noktası, anı pinleri, fotoğraf EXIF'i); `ACCESS_MEDIA_LOCATION` izni de var.
- **Fotoğraf/video, cihaz kimliği (push token, UUID), satın alma geçmişi, reklam kimliği.**
- **Hesap silme:** uygulama içi var (Profil → Hesap Yönetimi, 7 gün bekleme) — Apple koşulunu sağlıyor. Play için **web'de erişilebilir silme talimatı URL'si** gerekli: `docs/legal/support.html` bu metni içeriyor, yeter ki yayınlansın.
- **Sign in with Apple:** Google girişi olduğu için zorunlu; kodda hazır (`login.tsx`). Apple hesabı açılınca servis kimliğini Supabase'e tanıt.
- **App Review için test erişimi:** misafir/demo modu var; yine de çiftli akışı gösteren **iki test hesabı** hazırla (eşleşmiş, Premium'lu biri dahil — bunun için K-1 kapandıktan sonra sunucu taraflı bir test promosyon kodu kullan).

---

## 7. Güçlü yanlar (korunmalı)

- **Veritabanı:** ~86 `SECURITY DEFINER` fonksiyonun yetkileri tek tek çıkarıldı; hesap silme, rate-limit, push, cron fonksiyonları istemciye kapalı. RLS tüm tablolarda açık, storage bucket'ları özel + imzalı URL. `get_partner_push_tokens` sızıntısı daha önce kapatılmış.
- **Kimlik doğrulama:** kullanıcı adı girişi/şifre sıfırlama sunucuda (`auth-gateway`), IP + hesap başına deneme sınırı, hesap varlığı sızdırılmıyor, şifre değişince tüm oturumlar kapanıyor.
- **Oturum saklama:** AES anahtarı Keychain/Keystore'da, oturum şifreli; anahtar geçici okunamazsa düz yazılmıyor.
- **Paywall:** geri yükleme her zaman görünür, fiyat/periyot mağazadan, Şartlar/Gizlilik/Abonelik bağlantıları var.
- **Dayanıklılık:** kök hata sınırı, çevrimdışı bandı, global hata raporlama, parça parça sayfalama, FlatList sanallaştırma, `staleTime` ayarı, şifre çözme önbelleği.
- **Dil:** TR/EN 2094/2094 anahtar paritesi, tip güvenli anahtarlar, sunucu hata kodları korunmuş.
- **Hesap silme** akışı (7 gün bekleme + iptal + edge function ile dosya/veri/hesap temizliği).

---

## 8. Önerilen sıra

| Aşama | İş | Neden önce |
| :--- | :--- | :--- |
| **Şimdi (kod)** | K-1 REVOKE + `FREEMIRHAN` temizliği + arka kapıları sil | Para kaybı + güvenlik |
| | K-2 RevenueCat webhook edge function + `syncPremiumStatus` kaldırma | RevenueCat'i bağlamadan önce hazır olmalı |
| | Y-5 Playfair fontu, Y-4 monochrome ikon, Y-7 `jsEngine`/peer/`--fix` | Küçük, hızlı, görünür |
| **Hesapları açmadan** | **Y-1 paket adı kararı** | Sonradan değişmez |
| **Hesaplar + build** | Y-2 reklam birimleri + UMP, Y-3 SSV, Y-6 sürüm artırma ve cihaz testi (widget dahil) | Mağaza gönderimi |
| **Gönderimden önce** | Y-8 repo gizliliği + Maps anahtar kısıtı, Y-9 Supabase Pro/SMTP, O-1/O-2 yasal metinler, mağaza formları (bölüm 6) | Red ve hukuki risk |
| **Yayından sonra 2–4 hafta** | O-4 Sentry, O-9 test/CI, O-6 taban şema, O-8 erişilebilirlik | Kalite ve ölçek |

### Listende zaten olup unutulmaması gerekenler (hafızadan)
Migration 20261029000000 (yıldız dilekleri) ve 20261024000000/1'in canlıya uygulandığını teyit et · bildirim tetikleyici testi (gerçek mod/mektup) · gerçek cihazda oturum/harita/bildirim/satın alma sandbox/yıldız testi · Play kapalı test (12 tester / 14 gün) · Play abonelik ürünleri + RevenueCat'e servis hesabı · site + `docs/legal` yayını (TR ve `en/`) · destek@ ve support@couplesky.app posta kutularının gerçekten açık olması · Supabase URL Configuration (`couplesapp://` yönlendirmeleri) · Apple Developer + Sign in with Apple.

---

# Ek A — Önceki tur denetim kayıtları (arşiv)

> Aşağıdaki bölümler önceki denetim turundan kalmadır ve **tarihsel kayıt** olarak tutulmuştur. Bu raporun başındaki "0 açık madde" sonucu geçersizdir; güncel durum yukarıdaki bölümlerdedir. Bazı ayrıntılar o günden bu yana değişti (örn. çeviri anahtarı sayısı artık 2094, Nominatim `User-Agent` artık `CoupleSky/1.0`, ülke eki yalnızca Türkçe/TR bölgesinde ekleniyor).

# 🌐 BÖLÜM 7: ÇOK DİLLİ ALTYAPI (i18n) VE İNGİLİZCE YERELLEŞTİRME DENETİMİ

Bu bölüm, `feat/i18n-english` dalı kapsamında gerçekleştirilen çok dilli altyapının mimari, güvenlik, tip güvenliği ve mağaza politikaları açısından gerçekleştirilen kapsamlı tarama ve denetim sonuçlarını içerir.

### 1. 🎯 Temel Metrikler ve Kapsam

- **Desteklenen Diller:** Türkçe (`tr` - Varsayılan / Orijinal), İngilizce (`en`)
- **Toplam Çeviri Anahtarı (Parite):** 
  - `tr.json`: **2.025 anahtar**
  - `en.json`: **2.025 anahtar**
  - **Eksik veya Eşleşmeyen Anahtar Sayısı:** **0 (Tam %100 Parite)**
- **Dönüştürülen Ekran ve Bileşen Sayısı:** 155+ dosya (`src/app/`, `src/components/`, `src/modules/stars/`, `src/constants/`, `src/lib/`)
- **Tip Güvenliği Kontrolü:** `en satisfies typeof tr; tr satisfies typeof en;` ve `npx tsc --noEmit` -> **0 HATA**

---

### 2. 🛡️ 7 Kırılmaz Kuralın Uyumluluk Denetimi

| # | Kural | Durum | Denetim Bulgusu |
| :-: | :--- | :---: | :--- |
| **1** | **Veritabanı Enum'ları ve Sabitler Korunacak** | **BAŞARILI** | Supabase veritabanına yazılan ve okunan değerler (`role: "USER" \| "ADMIN"`, mood anahtarları `happy`, `romantic`, durum kodları `PENDING`, `ACCEPTED`, `gender: "female" \| "male"`, veritabanı özel gün sabitleri `Tanışma Yıl Dönümümüz`, hata kodları `P0001` - `P0005`) asla çevrilmemiştir. Ekranda kullanıcıya gösterilirken `t('moods.happy')` ve `localizeDefaultMemory()` gibi saf sunum katmanlarında yerelleştirilmektedir. |
| **2** | **RevenueCat ve Mağaza Kimlikleri Değiştirilemez** | **BAŞARILI** | `couples_monthly`, `couples_annual`, entitlement `Premium` stringleri asla çeviri fonksiyonuna sokulmamıştır. Paywall mağaza fiyatları ve dönem etiketleri orijinal RevenueCat paketlerinden çekilmekte, yalnızca UI başlık ve açıklamaları yerelleştirilmektedir. |
| **3** | **Expo Router Rotaları Değiştirilemez** | **BAŞARILI** | `router.push('/(tabs)/home')`, `/(auth)/login`, `/(auth)/verify-device`, `/(tabs)/letters` dosya rotaları korunmuş; rota stringleri kesinlikle `t()` fonksiyonuna bağlanmamıştır. |
| **4** | **TanStack Query Key'leri Değiştirilemez** | **BAŞARILI** | `queryKey: ['letters', coupleId]`, `['couple_star', coupleId]` vb. tüm önbellek anahtarları sabit dizi ve kimlikler olarak korunmuştur. |
| **5** | **Dayjs ve Takvim Yerelleştirmesi** | **BAŞARILI** | `YYYY-MM-DD`, `HH:mm` gibi standart format şablonları korunmuştur. Dil değiştiğinde `dayjs.locale(language)` ve `react-native-calendars`'ın `LocaleConfig.defaultLocale` ayarı dinamik olarak güncellenmektedir. Tüm ekranlarda tarih formatları `dayjs().locale(i18n.language)` ile reaktiftir. |
| **6** | **Mevcut Türkçe ve Romantik Dil Tonu** | **BAŞARILI** | Orijinal Türkçe metinler harfi harfine korunmuş; İngilizce çevirilerde de uygulamanın çiftlere özel romantik, şiirsel ve kozmik (yıldız temalı) üslubu akıcı bir şekilde aktarılmıştır. |
| **7** | **Tip Güvenliği (TypeScript Paritesi)** | **BAŞARILI** | `src/types/i18next.d.ts` dosyasında `CustomTypeOptions` modülü tanımlanmış, `npx tsc --noEmit` çalıştırılarak sıfır derleme hatasıyla tip güvenliği garanti altına alınmıştır. |

---

### 3. 🔬 Derinlemesine Statik Kod Taraması ve Düzeltmeler

Yapılan özel AST ve regex tabanlı statik kod analizinde tespit edilen ve anında giderilen kritik noktalar:

1. **`src/app/(auth)/login.tsx` Kayıt ve Bölücü Etiketleri:**
   - *Bulgu:* Kayıt formundaki E-Posta etiketi (`E-POSTA`) ve sosyal giriş bölücü metni (`VEYA`) doğrudan string literal olarak kalmıştı.
   - *Çözüm:* `auth.register.emailLabel` anahtarı hem `tr.json` hem `en.json` dosyalarına eklendi; `t("auth.register.emailLabel")` ve `t("common.or").toUpperCase()` ile dinamik hale getirildi.
2. **`src/lib/dialog.ts` Uyarı ve Hata Tonu Çıkarımı (`inferTone`):**
   - *Bulgu:* Sistem uyarısı veya toast mesajının tipini (hata / uyarı / başarı) belirleyen `inferTone` regex'i yalnızca Türkçe kelimeleri (`hata`, `uyarı`, `başar`, `tamam`) arıyordu. İngilizce başlıklı alert'lar (ör. "Error", "Success") `info` tonuna düşüyordu.
   - *Çözüm:* Regex'e İngilizce karşılıklar (`error`, `failed`, `failure`, `unable`, `cannot`, `warning`, `caution`, `success`, `saved`, `done`) eklendi. Artık İngilizce dilinde de toast ve diyaloglar doğru ikon ve renk tonunu (kırmızı hata, sarı uyarı, yeşil başarı) otomatik yansıtmaktadır.
3. **`src/constants/featureGuides.ts` Sözdizimi Onarımı:**
   - *Bulgu:* Tireli anahtarlar (`period-tracker:`, `daily-notes:`) TypeScript derleyicisinde `TS1005` sözdizimi hatası veriyordu.
   - *Çözüm:* Tırnak içine alınarak (`"period-tracker":`, `"daily-notes":`) onarıldı; `getAllPageGuides(t)` ve `getPageGuide(key, t)` fonksiyonları `TFunction` parametresiyle dinamik hale getirildi.
4. **`src/constants/legalTexts.ts` (Yasal & Mevzuat Çevirisi):**
   - *Bulgu:* KVKK, Gizlilik Politikası, EULA, Açık Rıza ve Abonelik Şartları yalnızca Türkçe hazırlanmıştı.
   - *Çözüm:* Uluslararası App Store & Google Play standartlarına ve GDPR yönergelerine uygun tam İngilizce yasal metinler (`LEGAL_DOCS_EN`) hazırlandı. Mevcut bileşenleri bozmamak için ES6 `Proxy` mimarisi kurularak `LEGAL_DOCS` nesnesinin aktif dile göre anında İngilizce veya Türkçe dönmesi sağlandı.
5. **`src/constants/demoData.ts` (Misafir Modu Çevirisi):**
   - *Bulgu:* Demo mektuplar, anı fotoğrafları ve yıldız gezegenleri Türkçe içerik barındırıyordu.
   - *Çözüm:* Tüm mock verilerin İngilizce karşılıkları (`DEMO_*_EN`) oluşturuldu ve `createLocalizedProxy` ile sarıldı. Kullanıcı profilden dili değiştirdiğinde `queryClient.invalidateQueries()` çağrısı ile demo içerikler anında yeni dilde render edilmektedir.
6. **İnterpolasyon Değişkenleri Eşleşme Taraması:**
   - *Bulgu:* `{{date}}`, `{{count}}`, `{{days}}`, `{{code}}` gibi dinamik şablon değişkenleri taranmış; 2.025 anahtar arasında sıfır değişken adı uyumsuzluğu ve sıfır hatalı tek süslü parantez (`{var}`) tespit edilmiştir.

---

### 4. 🚀 Dağıtım ve Dallar (Branch) Ayrımı

- **Yayın Branch'i (`develop` / `main`):** El değmemiş, stabil ve Türkçe preview sürümü Expo EAS üzerinde derlenmiş durumdadır.
- **İngilizce / i18n Branch'i (`feat/i18n-english`):**
  - `52389a2`: Claude tarafından gerçekleştirilen 152 dosyalık ana i18n mimarisi.
  - `c825fb7`: Eksik kalan featureGuides, demoData, legalTexts ve usePageTour entegrasyonu.
  - `06a7273`: login.tsx eksik etiketleri, dialog.ts inferTone İngilizce desteği ve sözlük güncellemeleri.
  - `12d7f06`: Varsayılan 4 alt sekme, çift mektup kartı temizliği, Wrapped erkek teması ve Instagram paylaşım onarımları.
  - Dal GitHub uzak sunucusuna (`origin/feat/i18n-english`) başarıyla pushlanmıştır.

---

# 📱 BÖLÜM 8: KULLANICI DENEYİMİ, ALT BAR VE AYLIK WRAPPED DENETİMİ

Bu bölüm; varsayılan alt bar sekmeleri, ana sayfa mektup kartı hiyerarşisi ve Aylık Wrapped modülünün (cinsiyet teması, Instagram paylaşımı, yerelleştirme) kapsamlı denetim ve onarım sonuçlarını içerir.

### 1. 🗂️ Varsayılan Alt Sekmeler (Default Tab Bar)
- **Talep:** Yeni hesap oluşturulduğunda alt barda varsayılan olarak yalnızca **Ana Sayfa, Takvim, Harita ve Mektuplar** yer alsın; kullanıcı isterse Profil/Ayarlar ekranından diğer sekmeleri (İlaç, Fotoğraflar, Anılar vb.) kendisi eklesin.
- **Yapılan İyileştirme:**
  - `src/context/TabBarContext.tsx` içindeki `DEFAULT_TABS` dizisi sadeleştirilerek tam olarak `["home", "calendar", "map", "letters"]` (4 sekme) yapıldı.
  - Önbellek anahtarı `@couples_app_bottom_bar_tabs_v2` olarak güncellendi; böylece hem yeni kayıtlar hem de mevcut test cihazları temiz 4 sekmeli düzene otomatik olarak geçti.

### 2. 💌 Ana Sayfadaki Çift Bekleyen Mektup Kartı Çakışması
- **Talep:** Ana sayfada hem en üstte (kısayolların hemen altında) hem de en altta bekleyen mektup kartı duruyordu; alt kısımdaki gereksiz kartın kaldırılması.
- **Yapılan İyileştirme:**
  - Üst kısımdaki şık, kompakt ve rozetli `PendingLettersBadge` korundu.
  - `src/app/(tabs)/home.tsx` dosyasının altındaki yinelenen `<PendingLettersCard />` tamamen kaldırıldı. Sayfa hiyerarşisi rahatlatıldı ve dikey boşluk optimize edildi.

### 3. 🎁 Aylık Wrapped (Couple Wrapped) Kapsamlı İnceleme ve Düzeltmeler

#### A. Erkek Kullanıcıda İstenmeyen Kırmızı / Bordo Görünüm
- **Bulgu:** Wrapped banner'ı (`home.tsx`) ve Wrapped slayt modalı (`CoupleWrappedModal.tsx`), cinsiyetten bağımsız olarak sabit pembe/kırmızı/bordo (`#FF4D6D`, `#2A0E1F`, `#E8002D`) renkleri kullanıyordu. Erkek kullanıcı profilinde uygulama teması gece mavisi olmasına rağmen Wrapped ekranı kırmızı görünüyordu.
- **Çözüm:** 
  - `CoupleWrappedModal.tsx` ve `home.tsx` bileşenleri `theme.gender === "male"` durumuna duyarlı hale getirildi.
  - Erkek kullanıcılar için arka plan gradienti `["#0A0E17", "#0D182A", "#13233D", "#0A0E17"]`, kart gradienti `["#0D1726", "#142238", "#0B111A"]`, aksan renkleri `#4D9CFF` (elektrik mavisi) ve `#93C5FD` (açık mavi), buton gradienti `[theme.accent, "#1D4ED8"]` olarak bağlandı.
  - Kadın kullanıcılar için romantik gül kurusu ve pembe palet korunurken, erkek kullanıcılar için gece mavisi kozmik tema sağlandı.

#### B. Instagram Story'de Paylaş Butonu ve Yönlendirme Hatası
- **Bulgu:** "Instagram Story'de Paylaş" butonuna basıldığında ekranda hiçbir hareket olmuyor ve yönlendirme gerçekleşmiyordu. Sebepler:
  1. Hata bloğundaki `console.warn` sessizce hatayı yutuyor, kullanıcıya hiçbir geri bildirim verilmiyordu.
  2. `captureRef` çıktısı Android/iOS dosya sisteminde bazen `file://` öneki olmadan üretilip `expo-sharing`'in `isReadableFile` güvenlik denetimine takılabiliyordu.
  3. iOS tarafında `app.json` içinde Instagram URL şemaları (`LSApplicationQueriesSchemes`) tanımlı değildi.
  4. iPad ve geniş ekranlarda `anchor` koordinatı verilmediği için `UIActivityViewController` sunumu çökebiliyordu.
- **Çözüm:**
  - `app.json` dosyasına `LSApplicationQueriesSchemes: ["instagram", "instagram-stories"]` eklendi.
  - Görüntü URI'si `fileUri.startsWith("file://") ? uri : `file://${uri}`` ile normalize edildi.
  - Ekran merkezini hedefleyen güvenli `anchor` noktası eklendi.
  - Olası bir platform hatasında kullanıcıyı bilgilendirmek için `appAlert(t("common.error"), t("wrapped.shareError"))` eklendi; `wrapped.shareError` hem Türkçe hem İngilizce sözlüklere işlendi.

#### C. Çok Dilli / İngilizce Uyumluluk
- **Bulgu:** Wrapped modülünün İngilizce karşılıklarının eksiksiz olup olmadığı denetlendi.
- **Sonuç:** `wrappedCalculator.ts` içindeki dönem başlığı (`periodTitleMonth`), modlar (`wrapped.moods.*`), romantik cümle (`wrapped.statement`), öne çıkan istatistik (`wrapped.highlight`) ve slayt başlıkları (`wrapped.slides.*`) %100 oranında `i18n.t()` ile dinamik olarak çekilmektedir. İngilizce dilinde de tüm veriler akıcı ve romantik bir dille render edilmektedir.

### 4. 🗺️ Harita Adres Arama Hatası (İl, İlçe, Mahalle, Sokak "Bulunamadı" Sorunu)
- **Problem & Teknik Analiz:**
  - Kullanıcı harita modalında il, ilçe veya sokak (örneğin "maltepe", "kadıköy", "bağdat caddesi") arattığında, `Location.geocodeAsync(query)` fonksiyonu doğrudan mobil cihazın yerel geocoder servisine (iOS'ta Apple `CLGeocoder`, Android'de Google Play Services `Geocoder`) başvurur.
  - Yerel işletim sistemi servisleri, tek kelimelik Türkçe ilçe ve semt isimlerinde (örn. "maltepe") ülke ve şehir bağlamı olmadan sorgu yapıldığında eşleşme bulamaz (`geocode results empty`) veya Android cihazlarda Play Services bağlantı kısıtları sebebiyle `Service not available` hatası fırlatır.
  - Bu durum kullanıcının girdiği geçerli bir yerin ekranda "Adres bulunamadı" uyarısı vermesine yol açıyordu.
- **Çözüm & Çok Kademeli (Tiered) Geocoding Mimarisi (`src/utils/exifHelper.ts`):**
  1. **Tier 1 (Yerel Geocoder):** İlk olarak `Location.geocodeAsync(cleanQuery)` denenir.
  2. **Tier 1b (Yerel Geocoder + Ülke Eki):** Eğer sonuç dönmezse ve sorguda ülke adı yoksa, `Location.geocodeAsync(`${cleanQuery}, Türkiye`)` ile otomatik ülke bağlamı eklenerek tekrar sorgulanır.
  3. **Tier 2 (OpenStreetMap Nominatim API Fallback):** Eğer yerel OS geocoder'ı yine sonuç döndüremezse veya hata verirse, sistem otomatik ve kesintisiz olarak küresel OpenStreetMap Nominatim Geocoding servisine fallback yapar (`https://nominatim.openstreetmap.org/search?format=json&q=...&limit=1&addressdetails=1`).
  4. Özel `User-Agent: CouplesApp/1.0` başlığı tanımlanmış ve koordinatlar (`latitude`, `longitude`) ile biçimlendirilmiş tam adres (`formattedAddress`) anında haritaya aktarılır.
- **Doğrulama:** "maltepe", "kadıköy", "bağdat caddesi", "kızılay" gibi tüm ilçe, cadde ve sokak aramaları artık milisaniyeler içinde %100 başarıyla koordinatlarına çözümlenmektedir.

### 5. 📅 Özel Günler & Anılar Ekranı UI Sadeleştirmesi ("Yeni Özel Gün Ekle" Butonu)
- **Problem & Tasarım İncelemesi:**
  - `src/app/(tabs)/memories.tsx` ekranında en altta yer alan büyük "Yeni Özel Gün Ekle" yüzen butonu (FAB), zaman çizelgesi ekranı açılır açılmaz doğrudan ekranda sabit olarak duruyordu.
  - Bu durum anı ve özel gün listesini gezerken görsel kalabalık yaratıyor, timeline akışını kapatıyor ve estetik açıdan kaba bir görünüm oluşturuyordu.
- **Yapılan İyileştirme:**
  - "Yeni Özel Gün Ekle" butonu sadece kullanıcı sağ üstteki **"Düzenle" (Edit Mode)** butonuna bastığında görünecek şekilde koşullu render (`isEditMode && ...`) yapısına bağlandı.
  - Açılış ve kapanış geçişleri için `react-native-reanimated`'in `FadeInUp.springify().damping(18)` ve `FadeOutDown.duration(200)` animasyonları uygulandı.
  - Normal modda kullanıcılar temiz, şık ve sade bir zaman çizelgesi deneyimi yaşarken; düzenleme moduna geçtiklerinde kart silme/düzenleme aksiyonlarıyla birlikte "Yeni Özel Gün Ekle" butonu akıcı bir animasyonla ekrana gelmektedir.

### 6. 🎨 Marka & İkon Mimarisi (CoupleSky ve Full-Bleed 1024x1024 Üretimi)
- **Uygulama Adı:**
  - Uygulamanın adı resmi olarak **"CoupleSky"** yapıldı (`app.json`, widget'lar, bildirim başlığı ve partner davet mesajları).
- **Yeni App İkon Tasarımı:**
  - Sıcak rose-gold ışıltılı, cam (glassmorphic) kalpli ve yörüngesinde parlayan küçük kalp uydusu bulunan konsept onaylandı.
  - Mağazalar (App Store & Google Play) için **1024x1024 px tam kare, kenarlara sıfır (full-bleed)** formatında üretildi. Beyaz köşe boşlukları ve yapay çerçeve artifaktları temizlenerek uzay ve lavanta bulutlarının kenarlara kusursuz dağılması sağlandı.
  - İlgili tüm varyasyonlar yüksek kaliteli bicubic filtreleme ile oluşturuldu:
    - `assets/images/icon.png`: 1024x1024 Master Icon
    - `assets/images/android-icon-foreground.png`: 512x512 Adaptive Foreground
    - `assets/images/android-icon-background.png`: 512x512 Cosmic Background
    - `assets/images/splash-icon.png`: 256x256 Splash Screen Icon (Splash genişliği 120 olarak güncellendi)
    - `assets/images/favicon.png`: 48x48 Web Favicon
  - `app.json` içindeki `ios.icon` artık standart `assets/images/icon.png` dosyasını referans almaktadır (önceki varsayılan Expo üçgen logosu referansı temizlendi).


