# 📋 Couples App Mobile — Kapsamlı Proje Yol Haritası ve Görev Takibi

Bu belge; uygulamanın tüm ekranları, veri akışları, güvenlik mekanizmaları, tasarım estetiği, performans darboğazları ve kullanıcı deneyimi (UX) taranarak hazırlanmış master yol haritasıdır.

Tüm maddeler **BÖLÜM 1: TAMAMLANANLAR (✅)** ve **BÖLÜM 2: YAPILACAKLAR (📋)** olarak iki ana grupta toplanmıştır.

---

# BÖLÜM 1: TAMAMLANANLAR (✅)

Bu bölümdeki tüm geliştirmeler başarıyla kodlanmış, TypeScript derleme testinden (`npx tsc --noEmit`) 0 hata ile geçmiş ve projeye entegre edilmiştir.

## 1. Onboarding, İzinler & Giriş Akışı Modernizasyonu (Faz 1)
- [x] **Adım 1 — Bildirim Ön-Onay Mekanizması (`PermissionPrimingModal.tsx` & `useNotificationPriming.ts`):**
  - Uygulama açılışındaki veya kayıt anındaki zamansız işletim sistemi bildirim pencereleri engellendi.
  - Bildirim izni yalnızca ilk mektup yazıldığında veya anı kaydedildiğinde duygusal ve açıklayıcı bir ön-onay kartıyla soruluyor; "Şimdilik Değil" denirse 7 gün boyunca tekrar sormayan AsyncStorage zaman damgası mekanizması kuruldu.
- [x] **Adım 2 — Kayıt Formundaki Zorunlu Checkbox Engellerinin Kaldırılması ([`login.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/login.tsx)):**
  - Kullanıcıyı yoran iki ayrı zorunlu onay kutusu kaldırıldı.
  - Yerine modern mağaza standardı getirildi: *"Hesap Oluştur'a dokunarak [Kullanım Koşulları], [Gizlilik Politikası] ve [KVKK Şartları]'nı kabul etmiş sayılırsınız."* (Tıklanabilir dinamik modal bağlantıları).
- [x] **Adım 3 — Esnek Tarih Seçimi & "Daha Sonra Belirle" Atlama Akışı ([`dates.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(setup)/dates.tsx) & [`datesSkip.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/lib/datesSkip.ts)):**
  - Çiftlerin tanışma gününü hatırlayamama sürtünmesi çözüldü; tek zorunlu tarih "Sevgili Olma Tarihi" yapıldı, tanışma tarihi ise isteğe bağlı onay kutusuna bağlandı.
  - Formun altına "Daha Sonra Belirle" butonu eklendi; `datesSkip.ts` üzerinden `AuthContext`, `login`, `verify` ve `verify-device` akışlarında kullanıcıların döngüye girmeden ana sayfaya geçebilmesi sağlandı.
  - Tarihi henüz girmemiş çiftler için ana sayfa aşk sayaçlarında uydurma veri yerine zarif bir `—` gösterimi bağlandı.
  - Profil ekranındaki [`RelationshipDatesCard.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/components/profile/RelationshipDatesCard.tsx) ve [`profile.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/profile.tsx) validasyonu yalnızca sevgililik tarihini zorunlu tutacak şekilde güncellendi.
- [x] **Adım 4 — Eşleşme Bekleme Odası & Romantik Davet Metni ([`pairing.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(setup)/pairing.tsx)):**
  - WhatsApp ve sistem paylaşım mesajı merak uyandıran, samimi ve derin bağlantılı (Deep Link) yeni romantik kopya ile güncellendi.
  - Bekleme ekranına "Partnerin Katıldığında Neler Açılacak? ✨" bilgi kutusu eklendi (Aşk Sayacı, Mühürlü Mektuplar, Ortak Albüm).
  - Yalnız kalan kullanıcının uygulamayı terk etmemesi için "Uygulamayı Demo Modunda Keşfet ✨" butonu altına açıklayıcı rehber eklendi; eşleşme öncesi veritabanına yetim kayıt yazmama kuralı korundu.
- [x] **Adım 5 — Google ve Apple ile Giriş UI & Entegrasyon Altyapısı ([`login.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/login.tsx)):**
  - `expo-apple-authentication` paketi kuruldu ve iOS platformuna native Apple Sign-In butonu entegre edildi.
  - Google OAuth akışı `expo-web-browser` ve `expo-linking` ile bağlandı; `detectSessionInUrl: false` kısıtı nedeniyle token'lar URL'den manuel ayıklanarak `supabase.auth.setSession` ile yetkilendirildi.
  - Android deep link dönüşünde router çakışmasını önleyen [`src/app/+native-intent.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/+native-intent.tsx) kancası yazıldı.
  - Sosyal giriş yapan kullanıcılar için otomatik cihaz yetkilendirme (`device_authorizations`) ve brute-force baypas güvenlik kuralları uygulandı.

---

## 2. Monolitik Dev Dosyaların Parçalanması (Mimari Refactor)
Uygulamada binlerce satıra ulaşmış 5 dev ekran modüler alt bileşenlere ayrılarak ana ekran dosyaları toplamda ~5.100 satır hafifletildi:
- [x] **`src/app/(tabs)/profile.tsx`** — 2.021 ➔ **704 satır** (`src/components/profile/` altında 10 modül).
- [x] **`src/app/(tabs)/photos.tsx`** — 1.121 ➔ **498 satır** (`src/components/photos/` altında memoize hücreler ve lightbox).
- [x] **`src/app/(tabs)/calendar.tsx`** — 1.554 ➔ **1.024 satır** (`src/components/calendar/` altında `DaySectionCard`, `CalendarMonthView` ve modallar).
- [x] **`src/app/(tabs)/medicine.tsx`** — 1.674 ➔ **829 satır** (`src/components/medicine/` altında seri/doz kartları ve local state modal).
- [x] **`src/app/(tabs)/map.tsx`** — 2.304 ➔ **496 satır** (`src/components/map/`, `src/constants/mapStyles.ts`, `useMapData.ts` ve pin yokken gerçekçi boş durum kartı).

---

## 3. Güvenlik & Oturum İyileştirmeleri
- [x] **Şifre Sıfırlama ile Supabase Auth Entegrasyonu ([`forgot-password.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/forgot-password.tsx), [`reset-password.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/reset-password.tsx)):**
  - Supabase Auth sunucusunda `auth.users.encrypted_password` değerini atomik güncelleyen güvenli RPC fonksiyonları (`request_password_reset_otp` ve `reset_password_with_otp`) bağlandı ([`20261018000000_fix_password_reset_otp_flow.sql`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/supabase/migrations/20261018000000_fix_password_reset_otp_flow.sql)).
- [x] **Giriş Ekranında Brute-Force Korumasının Kalıcılaştırılması ([`login.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/login.tsx)):**
  - Başarısız deneme sayısı ve 30 saniyelik kilit süresi `AsyncStorage` içine yazılarak ekran kapatılıp açılsa bile kilit korundu.
- [x] **Oturum Kapatmada Çift Veri İzolasyonu ([`AuthContext.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/context/AuthContext.tsx)):**
  - `signOut()` işleminde çifte özel tüm yerel önbellekler temizlendi.

---

## 4. Kozmik Yıldız Haritası İyileştirmeleri
Skia/Reanimated UI-thread canvas ve ses motoruyla çalışan 5 temel özellik:
- [x] **🌠 Kayan Yıldızlar & Dilek Tutma ([`MacroSkyCanvas.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/MacroSkyCanvas.tsx)):** 20-40s rastgele meteor animasyonu, dokunulduğunda haptik, kristal ses ve *"Dileğin gökyüzüne yazıldı 🌠"* toast'ı.
- [x] **✨ Yıldızların Nefes Alması ([`starStyle.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/macro/starStyle.ts)):** Sinüzoidal deterministik parlaklık salınımı (`twinkleFactor`).
- [x] **🌌 Samanyolu Derin Uzay Tozu Şeridi ([`skyOverlay.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/macro/skyOverlay.ts)):** Galaktik rotasyon matrisiyle yumuşak ışıma noktaları (`drawMilkyWay`).
- [x] **🎵 Kozmik Ambiyans & Kristal Çan Tınısı ([`soundEffects.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/lib/soundEffects.ts)):** 12s dikişsiz ambient pad ve yıldıza dokunma tınısı.
- [x] **⚡ Canlı Bağlantı Çizgileri ([`drawSkyFrame.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/modules/stars/canvas/macro/drawSkyFrame.ts)):** Yıldızlar arası animasyonlu enerji partikülleri.

---

## 5. Fonksiyonel & UX Düzeltmeleri
- [x] **Harita Fotoğraf Bellek Sızıntısı & OOM ([`map.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/map.tsx)):** Tam boyut fotoğraflar yerine `thumb_url` bağlandı.
- [x] **Mektuplarda Yerel Taslak Kaydı ([`letters.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/letters.tsx)):** Yazım esnasında veri kaybı önlendi.
- [x] **Form Ekranlarında Alt Bar Çakışması ([`_layout.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/_layout.tsx)):** Formlarda CustomTabBar gizlendi.
- [x] **Aşk Skoru Bellek İçi Önbellek ([`loveScore.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/lib/loveScore.ts)):** Açılıştaki %50 titremesi giderildi.
- [x] **Buluşma Planlamasında Hata Payı & Hatırlatıcı ([`meetings.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/meetings.tsx)):** 5 dk tolerans ve 2 saat öncesi yerel bildirim.
- [x] **Ortak Takvim Regl Entegrasyonu ([`calendar.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/calendar.tsx)):** Erkek partner için Premium kısıtı, kadın için tam erişim sağlandı; gün hücresinde nokta taşması (4+) engellendi.
- [x] **İlaç Takviminde Seri & 7 Günlük Hap Matrisi ([`medicine.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/medicine.tsx)):** Seri sayacı ve P-S-Ç-P-C-C-P matrisi eklendi.
- [x] **Özel Günler Geri Sayımı ([`memories.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/memories.tsx)):** "X. Yılımıza Y Gün Kaldı ⏳" rozetleri eklendi.

---

# BÖLÜM 2: YAPILACAKLAR (📋)

Aşağıdaki görevler öncelik sırasına göre bekleyen işlerdir.

## 1. Dış Sağlayıcı & Supabase Konsol Ayarları (Kullanıcı Tarafından Yapılacak)
Google ve Apple ile giriş butonlarına basıldığında uygulamanın hata vermeden oturum açabilmesi için konsollardan yapılması gereken ayarlar:

- [ ] **1.1. Supabase Redirect URL Yapılandırması:**
  - **Adres:** Supabase Dashboard → Authentication → URL Configuration → **Redirect URLs**
  - **Eklenecek URL:** `couplesapp://auth/callback`
  - *(Expo Go üzerinden geliştirme testi yapılacaksa `exp://...` formatındaki yerel tünel adresi de eklenmeli).*
- [ ] **1.2. Google OAuth Sağlayıcısının Aktif Edilmesi:**
  - **Adres:** Supabase Dashboard → Authentication → Providers → **Google**
  - **Gerekenler:** Google Cloud Console üzerinden oluşturulan `OAuth 2.0 Client ID` (Web) ve `Client Secret` girilerek Provider aktif edilecek.
- [ ] **1.3. Apple OAuth Sağlayıcısının Aktif Edilmesi:**
  - **Adres:** Supabase Dashboard → Authentication → Providers → **Apple**
  - **Gerekenler:** Apple Developer Console üzerinden alınan `Services ID`, `Team ID`, `Key ID` ve `.p8 Private Key` girilerek Provider aktif edilecek. Paket kimliği: `com.memirhantasci.couplesapp`.

---

## 6. Sosyal Girişte Profil Tamamlama (Ad & Cinsiyet)
- [x] **[`complete-profile.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/complete-profile.tsx) & [`login.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/login.tsx):**
  - Google veya Apple ile ilk kez giriş yapan kullanıcılarda `display_name` veya `gender` eksikse araya giren zarif profil tamamlama ekranı bağlandı.
  - İsim deterministik/statik AES ile şifrelenip `users` tablosuna yazılıyor, kadın/erkek seçimi ile tema ve döngü takvimi rolleri belirleniyor.
  - `useProtectedRoute` kancası henüz cinsiyet seçmemiş kullanıcıların eşleşme ekranına eksik profille geçmesini engelliyor.

---

## 7. Regl Takviminin Başlangıç Günü Modeline Dönüştürülmesi & Döngü Algoritması
- [x] **[`period-tracker.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/period-tracker.tsx) & [`calendar.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/calendar.tsx):**
  - Kadınların her gün "bugün de kanamam var" diye manuel işaretleme zorunluluğu kaldırıldı; yalnızca **başlangıç günü** kaydediliyor.
  - Takvimde 5 günlük biyolojik süreç otomatik olarak boyanıyor (başlangıç günü koyu pembe `#FF3366`, sonraki 4 gün yarı saydam).
  - Kadın kullanıcılar için tek dokunuşla çalışan "Bugün Reglim Başladı 🌸" hızlı butonu eklendi ve partnere anında bildirim iletiliyor.
  - Manipülasyon koruması: Gelecek tarih engeli, ayda en fazla 2 başlangıç ve iki başlangıç arasında en az 16 gün aralık kuralı bağlandı.
  - Döngü hesaplama: Geçmiş başlangıçlardan ortalama döngü süresi (varsayılan 28 gün) hesaplanıp "Sonraki Döngü: X Gün Kaldı" canlı geri sayımı durum kartına yerleştirildi.
  - Ortak takvimde ([`calendar.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/calendar.tsx)) partnerin de 5 günü görmesi sağlandı.

---

## 8. Ruh Hali (Mood) Seçiminde 24 Saatlik Kalıcı Kilidin Açılması
- [x] **[`MoodSelector.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/components/home/MoodSelector.tsx) & [`home.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/home.tsx):**
  - Kullanıcı gün içinde bir emoji seçtiğinde oluşan kalıcı kilit (`disabled`) kaldırıldı.
  - Kullanıcı gün içinde sabah "Yorgun 😴" seçip öğleden sonra modunu "Mutlu 😊" olarak güncelleyebiliyor.
  - Veritabanındaki `moods` tablosunda mevcut günün kaydı atomik olarak güncelleniyor, partnere anında yeni mod bildirimi iletiliyor.

---

# BÖLÜM 2: YAPILACAKLAR (📋)

Aşağıdaki görevler dış yapılandırma ve kullanıcı aksiyonlarıdır.

## 1. Dış Sağlayıcı & Supabase Konsol Ayarları (Kullanıcı Tarafından Yapılacak)
Google ve Apple ile giriş butonlarına basıldığında uygulamanın hata vermeden oturum açabilmesi için konsollardan yapılması gereken ayarlar:

- [ ] **1.1. Supabase Redirect URL Yapılandırması:**
  - **Adres:** Supabase Dashboard → Authentication → URL Configuration → **Redirect URLs**
  - **Eklenecek URL:** `couplesapp://auth/callback`
  - *(Expo Go üzerinden geliştirme testi yapılacaksa `exp://...` formatındaki yerel tünel adresi de eklenmeli).*
- [ ] **1.2. Google OAuth Sağlayıcısının Aktif Edilmesi:**
  - **Adres:** Supabase Dashboard → Authentication → Providers → **Google**
  - **Gerekenler:** Google Cloud Console üzerinden oluşturulan `OAuth 2.0 Client ID` (Web) ve `Client Secret` girilerek Provider aktif edilecek.
- [ ] **1.3. Apple OAuth Sağlayıcısının Aktif Edilmesi:**
  - **Adres:** Supabase Dashboard → Authentication → Providers → **Apple**
  - **Gerekenler:** Apple Developer Console üzerinden alınan `Services ID`, `Team ID`, `Key ID` ve `.p8 Private Key` girilerek Provider aktif edilecek. Paket kimliği: `com.memirhantasci.couplesapp`.

---

## 📊 Görevler Özet Tablosu

| Sıra | Görev | Kategori | Hedef Dosya / Alan | Durum |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Supabase & OAuth Konsol Ayarları | Dış Yapılandırma | Supabase Dashboard & Google/Apple Console | ⏳ Kullanıcı Tarafından Yapılacak |
| **2** | Sosyal Girişte Profil Tamamlama (Ad & Cinsiyet) | UX / Auth | `complete-profile.tsx` & `login.tsx` | ✅ Tamamlandı |
| **3** | Regl Takviminde başlangıç günü modeli & 5 gün boyama | Mantık / Biyoloji | [`period-tracker.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/period-tracker.tsx) | ✅ Tamamlandı |
| **4** | Regl Takviminde döngü tahmini ve geri sayım | Algoritma / UX | [`period-tracker.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/period-tracker.tsx) | ✅ Tamamlandı |
| **5** | MoodSelector 24 saatlik kalıcı kilidin kaldırılması | UX / Mantık | [`MoodSelector.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/components/home/MoodSelector.tsx) | ✅ Tamamlandı |
