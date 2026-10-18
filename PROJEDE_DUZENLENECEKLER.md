# 📋 Couples App Mobile — Kapsamlı Proje İyileştirme ve Düzenleme Raporu

Bu belge; uygulamanın tüm ekranları, veri akışları, güvenlik mekanizmaları, tasarım estetiği, performans darboğazları ve kullanıcı deneyimi (UX) taranarak hazırlanmış master yol haritasıdır. Tamamlanan maddeler arşivlenmiş olup belgede yalnızca henüz çözülmemiş bekleyen maddeler listelenmektedir.

---

## 📑 İçindekiler
1. [Tamamlanan & Doğrulanan İyileştirmeler](#1-tamamlanan--doğrulanan-iyileştirmeler)
2. [Kritik Mantık & Fonksiyonel Hatalar (Logic Bugs)](#2-kritik-mantık--fonksiyonel-hatalar-logic-bugs)
3. [Güvenlik & Oturum Açıkları (Security & Auth)](#3-güvenlik--oturum-açıkları-security--auth)
4. [Performans & Mimari Refactoring](#4-performans--mimari-refactoring)
5. [Kalan Görevler Uygulama Planı](#5-kalan-görevler-uygulama-planı)
6. [Kozmik Yıldız Haritası İyileştirmeleri (Tamamlandı)](#6-kozmik-yıldız-haritası-iyileştirmeleri-tamamlandı-)

---

## 1. Tamamlanan & Doğrulanan İyileştirmeler

Aşağıdaki tüm optimizasyonlar başarıyla kodlanmış, entegre edilmiş ve test edilmiştir:

- [x] **Harita Fotoğraf Bellek Sızıntısı ve OOM Çökmesi ([`map.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/map.tsx)):**
  - Harita pinlerinde (`PhotoPin`) tam boyutlu yüksek çözünürlüklü fotoğraflar yerine `thumb_url` bağlandı.
- [x] **Mektuplarda Otomatik Yerel Taslak Kaydı ([`letters.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/letters.tsx)):**
  - Mektup yazılırken AsyncStorage'a anlık taslak kaydedilerek veri kaybı önlendi.
- [x] **Form Ekranlarında Alt Bar Çakışması ([`_layout.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/_layout.tsx)):**
  - `add-memory`, `add-photo` ve `add-daily-note` formlarında CustomTabBar gizlendi.
- [x] **Aşk Skoru Bellek İçi Önbellek ([`loveScore.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/lib/loveScore.ts) & [`home.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/home.tsx)):**
  - Senkron bellek içi skor önbelleği eklendi; ilk açılıştaki %50 titremesi sıfırlandı.
- [x] **Menü Navigasyon Emniyeti & Güvenlik Kilidi ([`menu.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/menu.tsx)):**
  - `handleRoute` ve `handleClose` fonksiyonlarına 600ms kilit açma emniyet zamanlayıcısı eklendi.
- [x] **Oturum Kapatmada Çift Veri İzolasyonu ([`AuthContext.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/context/AuthContext.tsx)):**
  - `signOut()` işleminde çifte özel tüm yerel önbellekler temizlendi.
- [x] **Buluşma Planlamasında Saniyelik Hata & Tolerans Esnekliği ([`meetings.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/meetings.tsx)):**
  - 5 dakikalık tolerans payı (`Date.now() - 5 * 60 * 1000`) tanınarak form doldurma esnasında saniye farkıyla hata fırlatılması engellendi.
- [x] **Buluşma Yaklaşırken Yerel Hatırlatıcı Bildirimi ([`meetings.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/meetings.tsx)):**
  - Buluşma saatinden 2 saat önce otomatik yerel bildirim (`scheduleDateLocalNotification`) planlandı; silindiğinde zamanlanmış bildirim iptal ediliyor.
- [x] **Ortak Takvim ile Buluşmalar ve Regl Günlerinin Entegrasyonu ([`calendar.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/calendar.tsx)):**
  - Takvim veri sorgusuna `meetings` ve `period_logs` dahil edildi.
  - Erkek kullanıcılar için regl takibi **sadece çift Premium ise** aktifleştirildi (`canSeePeriod = isFemale || isPremium`). Premium olmayan erkek kullanıcılar için döngü noktaları, lejant ve kartlar gizlendi. Kadın kullanıcılar ise kendi döngülerini daima görmektedir.
- [x] **Takvim Hücrelerinde 4+ Noktanın Taşmasının Önlenmesi ([`calendar.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/calendar.tsx)):**
  - Gün hücresinde (36px) nokta boyutları 5px'e optimize edildi ve en fazla 3 noktaya sınırlandırılarak hücre dışına taşma sorunu çözüldü.
- [x] **Silinen Fotoğrafların Thumbnail (Küçük Resim) Temizliği ([`photos.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/photos.tsx)):**
  - Fotoğraf silinirken Supabase Storage'daki `${coupleId}/thumbs/` klasöründeki küçük resim dosyaları da tespit edilip silinerek çöp dosya birikmesi önlendi.
- [x] **Özel Günler & Yıl Dönümlerinde Geri Sayım & Kilometre Taşları ([`memories.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/memories.tsx)):**
  - Her özel gün için bir sonraki yıllık tekrar tarihi hesaplanarak "X. Yılımıza Y Gün Kaldı ⏳" rozeti ve toplam "✨ Z. Gün" kilometre taşı rozetleri eklendi.
- [x] **Aşk Ölçer (LoveMeter) Sayı Sayacı & Haptik ([`LoveMeter.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/components/home/LoveMeter.tsx)):**
  - Yüzde metninin 0'dan hedefe akıcı sayılması (rolling counter) sağlandı; karta dokunulduğunda kutlama sesi ve başarı haptiği (`triggerHaptic("celebration")`) entegre edildi.
- [x] **Açık Tema (Light Mode) Metin & Kontrast Düzeltmeleri ([`add-daily-note.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/add-daily-note.tsx) & [`add-memory.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/add-memory.tsx)):**
  - Statik `getTheme()` yerine dinamik `useTheme()` bağlandı; açık temada görünmeyen sert kodlanmış `#ffffff` metinler `theme.text` ve `theme.textMuted` renklerine dönüştürüldü.
- [x] **İlaç Takviminde Seri (Streak) ve 7 Günlük Hap Uyum Matrisi ([`medicine.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/medicine.tsx)):**
  - Çiftlerin düzenli ilaç/vitamin alışkanlığını motive eden "🔥 X Günlük Seri!" sayacı ve son 7 günün gün gün durumunu gösteren (P, S, Ç, P, C, C, P) interaktif mini hap durum matrisi eklendi.
- [x] **Giriş Ekranında Brute-Force Korumasının Kalıcılaştırılması ([`login.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/login.tsx)):**
  - Başarısız deneme sayısı ve 30 saniyelik kilit bitiş zamanı `AsyncStorage` (safeStorage) içine yazılarak ekran kapatılıp açılsa bile kilidin korunması sağlandı.
- [x] **Ana Sayfa Sorgu ve Partner Verisi Konsolidasyonu ([`home.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/home.tsx)):**
  - Partner bilgisi doğrudan ana pano sorgusuyla çekildi; regl yaklaşma kontrolü yalnızca erkek kullanıcı ve kayıtlı kadın partner varsa tekil sorguyla sınırlandırılarak gereksiz ağ trafiği önlendi.
- [x] **Kullanılmayan Importların Temizlenmesi ([`profile.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/profile.tsx)):**
  - `PlayCircle`, `ThemeMode` vb. gereksiz kütüphane importları temizlendi.
- [x] **Kozmik Yıldız Haritası: Kayan Yıldızlar & Dilek Tutma ([`MacroSkyCanvas.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/MacroSkyCanvas.tsx)):**
  - 20-40s rastgele aralıkla ekranda süzülen meteor animasyonu; UI thread saatiyle zamanlanıyor (`useFrameCallback`). Dokunulduğunda haptics + kristal çan sesi + `onWishGranted` ile *"Dileğin gökyüzüne yazıldı 🌠"* toast'ı tetikleniyor.
- [x] **Kozmik Yıldız Haritası: Yıldızların Nefes Alması ([`starStyle.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/macro/starStyle.ts) & [`drawSkyFrame.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/macro/drawSkyFrame.ts)):**
  - Mag < 4.0 parlak yıldızlar için konumlarından türeyen deterministik faz ve hızla sinüzoidal parlaklık salınımı (`twinkleFactor`) eklendi.
- [x] **Kozmik Yıldız Haritası: Samanyolu Derin Uzay Tozu Şeridi ([`skyOverlay.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/macro/skyOverlay.ts) & [`drawSkyFrame.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/macro/drawSkyFrame.ts)):**
  - J2000 galaktik→ekvatoral rotasyon matrisiyle (Sgr A* merkezli: RA≈266.4°, Dec≈-28.9°) galaktik ekvator boyunca örtüşen yumuşak ışıma noktaları üretildi (`drawMilkyWay`).
- [x] **Kozmik Yıldız Haritası: Kozmik Ambiyans & Kristal Çan Tınısı ([`soundEffects.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/lib/soundEffects.ts) & [`OurStarScreen.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/components/OurStarScreen.tsx)):**
  - 12s kesintisiz döngü (seamless-loop) sentezlenmiş derin uzay ambient pad'i (`startCosmicAmbient`/`stopCosmicAmbient`, ekran odaklanmasında yumuşak fade-in/out) ve yıldıza dokunulduğunda kristal çan sesi (`playCelestialChime`) eklendi (`assets/sounds/cosmic_ambient.wav`, `celestial_chime.wav`).
- [x] **Kozmik Yıldız Haritası: Akan Enerji & Canlı Bağlantı Çizgileri ([`drawSkyFrame.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/macro/drawSkyFrame.ts)):**
  - Statik kesikli çizgi yerine her karede animasyonlu dash-phase ve yıldızdan yıldıza süzülen parlak enerji partikülleri eklendi.
- [x] **Şifre Sıfırlama ile Supabase Auth Entegrasyonu ([`forgot-password.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/forgot-password.tsx), [`reset-password.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/reset-password.tsx)):**
  - Supabase Auth kimlik doğrulama sunucusunda `auth.users.encrypted_password` değerini güncelleyen güvenli RPC fonksiyonları (`request_password_reset_otp` ve `reset_password_with_otp`) ve `public.otp_codes` tablosu bağlandı ([`20261018000000_fix_password_reset_otp_flow.sql`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/supabase/migrations/20261018000000_fix_password_reset_otp_flow.sql)).

---

## 2. Kritik Mantık & Fonksiyonel Hatalar (Logic Bugs)

### 🔴 2.1. Döngü Takviminde Biyolojik Olarak İmkansız 4 Gün Sınırı
- **Dosya:** [`src/app/(tabs)/period-tracker.tsx#L128-L135`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/period-tracker.tsx#L128-L135)
- **Hata:** 
  ```typescript
  const monthLogsCount = logs?.filter(l => l.date.startsWith(currentMonthStr)).length || 0;
  if (monthLogsCount >= 4) {
    Alert.alert("Sınır", "Bir ay içerisinde en fazla 4 gün işaretleyebilirsiniz.");
    return;
  }
  ```
- **Problem:** Kadınların menstrüasyon döngüsü ortalama 5 ila 7 gün sürer. Ayda en fazla 4 gün işaretleme sınırı koymak biyolojik gerçeklikle uyuşmamaktadır. Kullanıcılar 5., 6. ve 7. günleri kaydedememektedir. Ayrıca ay başında ve ay sonunda iki kez döngü yaşayan kadınlar tamamen kilitlenmektedir.
- **Çözüm:** 4 gün sınırı kaldırılmalı veya mantıklı bir sınıra (örneğin döngü başına 10 gün ya da aylık 12 gün) yükseltilmelidir.

### 🔴 2.2. Döngü Tahmini & Geri Sayım Vaadi Ama Sıfır Hesaplama
- **Dosya:** [`src/app/(tabs)/period-tracker.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/period-tracker.tsx)
- **Problem:** Ekranda ve tanıtım metinlerinde "Bilimsel tahminler almak ve döngünüzü takip etmek..." vaadi verilmektedir. Ancak kod tabanında:
  - Ortalama döngü uzunluğu (Cycle length, örn: 28 gün),
  - Bir sonraki beklenen regl tarihi,
  - "Sonraki Regl: 12 Gün Kaldı" geri sayımı,
  - Ovülasyon (yumurtlama) / verimli dönem tahmini
  için hiçbir matematiksel hesaplama bulunmamaktadır.
- **Çözüm:** Geçmiş döngü başlangıç tarihlerinden ortalama döngü periyodu hesaplayan ve takvimde hafif renkli tahmin noktaları gösteren bir algoritma eklenmelidir.

### 🔴 2.3. Ruh Hali (Mood) Seçiminde 24 Saatlik Kalıcı Kilit
- **Dosya:** [`src/components/home/MoodSelector.tsx#L46-L89`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/components/home/MoodSelector.tsx#L46-L89)
- **Problem:** Kullanıcı gün içinde bir emojiye bastığında `setLocked(true)` olmakta ve butonlar `disabled` hale gelmektedir. Oysa arkadaki veritabanı kodu `if (existing)` durumunda güncelleme yapabilecek şekilde yazılmıştır. Sabah yorgun uyanıp gün içinde enerjisi yerine gelen veya yanlış emojiye basan bir kullanıcı gün boyunca modunu güncelleyememektedir.
- **Çözüm:** Kalıcı `disabled` kilidi kaldırılmalı; kullanıcı istediğinde modunu güncelleyebilmeli ve partnerine güncel hissi iletilebilmelidir.

---

## 3. Güvenlik & Oturum Açıkları (Security & Auth)

### ✅ [x] 3.1. Şifre Sıfırlama ile Supabase Auth Uyuşmazlığı (Çözüldü)
- **Dosyalar:**
  - [`src/app/(auth)/forgot-password.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/forgot-password.tsx)
  - [`src/app/(auth)/reset-password.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/reset-password.tsx)
  - [`supabase/migrations/20261018000000_fix_password_reset_otp_flow.sql`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/supabase/migrations/20261018000000_fix_password_reset_otp_flow.sql)
- **Çözüm:** `request_password_reset_otp` ve `reset_password_with_otp` SECURITY DEFINER RPC fonksiyonları yazılarak OTP doğrulandıktan sonra asıl `auth.users.encrypted_password` alanı atomik olarak güncellenecek şekilde bağlandı.

---

## 4. Performans & Mimari Refactoring

### ⚡ 4.1. Monolitik Dev Dosyaların Parçalanması
Uygulamada bazı ekranlar tek dosya içinde binlerce satıra ulaşmıştır:
- `src/app/(tabs)/map.tsx` — **2.304 satır**
- `src/app/(tabs)/profile.tsx` — **2.021 satır**
- `src/app/(tabs)/medicine.tsx` — **1.675 satır**
- `src/app/(tabs)/calendar.tsx` — **1.482 satır**
- `src/app/(tabs)/photos.tsx` — **1.115 satır**

Bu dosyaların içindeki alt kartlar (örneğin `profile.tsx` içindeki ses efektleri test kutusu, tab bar özelleştirici, yasal modal listesi vb.) modüler alt bileşenler olarak ayrıştırılmalıdır. Bu işlem hot-reload hızını ve kod bakımını ciddi oranda rahatlatacaktır.

---

## 5. Kalan Görevler Uygulama Planı

| Sıra | Görev | Kategori | Hedef Dosya | Etki |
| :--- | :--- | :--- | :--- | :--- |
| **1** | `period-tracker.tsx` 4 gün sınırının kaldırılması | Mantık | [`period-tracker.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/period-tracker.tsx) | Kadın kullanıcıların döngü günlerini eksiksiz kaydetmesini sağlar |
| **2** | `period-tracker.tsx` döngü tahmini ve sonraki regl geri sayımı | Mantık / UX | [`period-tracker.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/period-tracker.tsx) | Döngü takvimini gerçek anlamda işlevsel kılar |
| **3** | `MoodSelector.tsx` 24 saatlik kalıcı kilidin kaldırılarak güncellemelerin açılması | UX / Mantık | [`MoodSelector.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/components/home/MoodSelector.tsx) | Gün içi ruh hali değişimlerinin anında paylaşılmasını sağlar |
| **4** | ~~Şifre sıfırlama Supabase Auth entegrasyonu~~ (Tamamlandı ✅) | Güvenlik / Auth | [`forgot-password.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/forgot-password.tsx) & [`reset-password.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/reset-password.tsx) | Şifresini unutan kullanıcıların hesaplarına güvenle tekrar erişebilmesini sağlar |
| **5** | Monolitik ekranların alt bileşenlere modüler ayrıştırılması | Mimari / Refactor | `map.tsx`, `profile.tsx`, `medicine.tsx`, `calendar.tsx` | Hot-reload ve maintainability hızını artırır |

---

## 6. Kozmik Yıldız Haritası İyileştirmeleri (Tamamlandı ✅)

Yıldız haritası modülünü Apple Design Award seviyesine taşıyan aşağıdaki 5 temel görsel ve işitsel geliştirmenin tamamı kodlanmış ve doğrulanmıştır:
*(Not: Bu özellikler Skia/Reanimated UI-thread canvas ve ses motorunu kullandığından, gerçek cihazda veya development build ortamında [`npx expo run:android` / `run:ios`] deneyimlenmelidir.)*

### ✅ [x] 🌠 6.1. Rastgele Kayan Yıldızlar & Dilek Tutma (Shooting Stars & Wish Interaction)
- **Açıklama:** Haritada gezinirken 20-40 saniyelik rastgele aralıklarla ekranın bir köşesinden diğerine doğru süzülen ince kuyruklu bir meteor animasyonu.
- **Uygulama:** `MacroSkyCanvas.tsx` içinde `useFrameCallback` saatiyle zamanlanan meteor mekaniği. Meteor ekrandan geçerken dokunulduğunda `expo-haptics` titreşimi, kristal çan sesi ve `onWishGranted` callback'i ile *"Dileğin gökyüzüne yazıldı 🌠"* toast bildirimi tetiklenir.
- **Hedef Dosyalar:** [`MacroSkyCanvas.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/MacroSkyCanvas.tsx), [`drawSkyFrame.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/macro/drawSkyFrame.ts) & [`OurStarScreen.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/components/OurStarScreen.tsx)

### ✅ [x] ✨ 6.2. Yıldızların Nefes Alması (Twinkle / Scintillation)
- **Açıklama:** Parlak yıldızların (mag < 4.0) UI thread render döngüsünde sinüzoidal bir salınımla (hafif alpha ve yarıçap dalgalanmasıyla) nefes alır gibi parıldaması.
- **Uygulama:** `starStyle.ts` dosyasına eklenen `twinkleFactor` ile yıldızlar, konumlarından türeyen deterministik faz ve hızla yumuşak bir parlaklık salınımı yapar (`drawSkyFrame.ts`).
- **Hedef Dosyalar:** [`starStyle.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/macro/starStyle.ts) & [`drawSkyFrame.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/macro/drawSkyFrame.ts)

### ✅ [x] 🌌 6.3. Samanyolu Derin Uzay Tozu Şeridi (Milky Way Dust Band)
- **Açıklama:** Gökkubbeyi boydan boya saran, eflatun-mavi tonlarında yarı saydam ve zarif bir derin uzay tozu şeridi çizilmesi.
- **Uygulama:** `skyOverlay.ts` dosyasında J2000 galaktik→ekvatoral rotasyon matrisiyle (Sgr A* merkezli: RA≈266.4°, Dec≈-28.9°) galaktik ekvator boyunca örtüşen yumuşak ışıma noktaları üretildi; `drawMilkyWay` fonksiyonuyla yıldızların alt katmanına çizildi.
- **Hedef Dosyalar:** [`skyOverlay.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/macro/skyOverlay.ts) & [`drawSkyFrame.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/macro/drawSkyFrame.ts)

### ✅ [x] 🎵 6.4. Kozmik Ambiyans ve Kristal Tıklama Sesleri (Celestial Audio)
- **Açıklama:** Gökyüzü haritasında büyüleyici uzay ambiyansı ve yıldıza dokunulduğunda kristal ses efekti.
- **Uygulama:** `soundEffects.ts` içine `startCosmicAmbient` ve `stopCosmicAmbient` fonksiyonları (12s dikişsiz döngülü sentezlenmiş ambient pad, ekran focus/blur'da 1400ms fade-in / 900ms fade-out) ve `playCelestialChime` fonksiyonu eklendi. Gerekli ses dosyaları (`assets/sounds/cosmic_ambient.wav`, `celestial_chime.wav`) sentezlenerek projeye dahil edildi.
- **Hedef Dosyalar:** [`soundEffects.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/lib/soundEffects.ts) & [`OurStarScreen.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/components/OurStarScreen.tsx)

### ✅ [x] ⚡ 6.5. Akan Enerji & Canlı Bağlantı Çizgileri (Animated Constellation Stream)
- **Açıklama:** Bağlı arkadaş çiftler arasındaki yıldız bağının statik kesikli çizgi yerine canlı enerji akışı şeklinde görselleştirilmesi.
- **Uygulama:** `drawSkyFrame.ts` içindeki `drawConnectionLines` güncellendi; her karede animasyonlu dash-phase ve yıldızdan yıldıza doğru süzülen parlak enerji partikülü çizilmektedir.
- **Hedef Dosyalar:** [`drawSkyFrame.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/macro/drawSkyFrame.ts)


