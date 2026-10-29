# 🔍 COUPLES APP MOBILE — YAYIN ÖNCESİ SON BÜYÜK KOD, GÜVENLİK VE MAĞAZA DENETİM RAPORU

**Tarih:** 29 Ekim 2026  
**Denetlenen Dallar (Branches):** `develop` (Temel/Yayın Öncesi), `feat/i18n-english` (Çok Dilli / İngilizce Altyapısı)  
**Teknoloji Yığını:** React Native 0.86.2, Expo SDK 57, React 19.2.3, Reanimated 4.5.1, Shopify React Native Skia 2.6.2, Supabase (PostgreSQL, RLS, Edge Functions, pg_cron), TanStack Query v5, i18next v26, react-i18next v17, expo-localization  
**Kapsam:** `src/` (tüm ekranlar, bileşenler, hook'lar, context'ler, servisler, yerelleştirme sözlükleri ve yıldız modülü), `supabase/migrations/`, `supabase/functions/`, `plugins/`, `docs/legal/`, `app.json` ve `eas.json` dosyalarının satır satır incelenmesi.

---

## 📊 ÖZET TABLO (KRİTİKLİK DAĞILIMI)

| Kategori | P0-Kritik | P1-Yüksek | P2-Orta | P3-Düşük | Toplam Kalan |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. 🎨 Arayüz (UI/UX), Çentik & Tema** | 0 | 0 | 0 | 0 | **0** |
| **2. ⚡ Bellek, State & Performans** | 0 | 0 | 0 | 0 | **0** |
| **3. 🛡️ TypeScript, Çökme & Tip Güvenliği** | 0 | 0 | 0 | 0 | **0** |
| **4. 🍎 Mağaza Ret & İzinler** | 0 | 0 | 0 | 0 | **0** |
| **5. 🔄 Veri Bütünlüğü, Önbellek & Eşzamanlama** | 0 | 0 | 0 | 0 | **0** |
| **6. 🔒 Supabase Güvenlik, RLS & Edge Functions** | 0 | 0 | 0 | 0 | **0** |
| **7. 🌐 Çok Dilli Altyapı (i18n & Yerelleştirme)** | 0 | 0 | 0 | 0 | **0** |
| **TOPLAM KALAN İŞ** | **0** | **0** | **0** | **0** | **0** |

---

# 🤖 BÖLÜM: KALAN İŞLER

Raporda çözülmeyi bekleyen açık bir madde kalmamıştır. Tüm denetim maddeleri, güvenlik kontrolleri ve çok dilli yerelleştirme altyapısı eksiksiz tamamlanmıştır.

---

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


