# 📋 Couples App Mobile — Kapsamlı Proje İyileştirme ve Düzenleme Raporu

Bu belge; uygulamanın tüm ekranları, veri akışları, güvenlik mekanizmaları, tasarım estetiği, performans darboğazları ve kullanıcı deneyimi (UX) taranarak hazırlanmış master yol haritasıdır. Tamamlanan maddeler arşivlenmiş olup belgede yalnızca henüz çözülmemiş bekleyen maddeler listelenmektedir.

---

## 📑 İçindekiler
1. [Tamamlanan & Doğrulanan İyileştirmeler](#1-tamamlanan--doğrulanan-iyileştirmeler)
2. [Kritik Mantık & Fonksiyonel Hatalar (Logic Bugs)](#2-kritik-mantık--fonksiyonel-hatalar-logic-bugs)
3. [Güvenlik & Oturum Açıkları (Security & Auth)](#3-güvenlik--oturum-açıkları-security--auth)
4. [Performans & Mimari Refactoring](#4-performans--mimari-refactoring)
5. [Kalan Görevler Uygulama Planı](#5-kalan-görevler-uygulama-planı)

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
  - Takvim veri sorgusuna `meetings` ve `period_logs` dahil edildi; seçili günün detayında buluşma kartları ve döngü kayıtları lejanterle birlikte gösterildi.
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

### 🚨 3.1. Şifre Sıfırlama ile Supabase Auth Uyuşmazlığı
- **Dosyalar:**
  - [`src/app/(auth)/forgot-password.tsx#L48-L65`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/forgot-password.tsx#L48-L65)
  - [`src/app/(auth)/reset-password.tsx#L67-L72`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/reset-password.tsx#L67-L72)
- **Kritik Bulgu:** 
  1. `forgot-password.tsx` ekranında üretilen OTP kodu yalnızca geliştirici konsoluna (`console.log`) basılmaktadır. Gerçek cihazda veya mağaza sürümünde kullanıcının telefonuna SMS veya e-posta ile kod gitmemektedir.
  2. `reset-password.tsx` ekranında şifre yalnızca `public.users` tablosundaki `password` sütununda güncellenmektedir. Oysa `login.tsx` ekranı oturumu `supabase.auth.signInWithPassword` ile açmaktadır!
  3. **Sonuç:** Kullanıcı şifresini sıfırlasa bile Supabase Auth kimlik sunucusundaki asıl şifresi DEĞİŞMEZ. Kullanıcı yeni şifresiyle sisteme ASLA giriş yapamaz.
- **Çözüm:** Şifre sıfırlama akışı ya Supabase Auth'un yerleşik e-posta kurtarma mekanizmasına (`supabase.auth.resetPasswordForEmail`) bağlanmalı ya da güvenli bir Edge Function/RPC üzerinden hem `auth.users` hem `public.users` senkron güncellenmelidir.

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
| **4** | Şifre sıfırlama Supabase Auth e-posta kurtarma akışı entegrasyonu | Güvenlik / Auth | [`forgot-password.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/forgot-password.tsx) & [`reset-password.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/reset-password.tsx) | Şifresini unutan kullanıcıların hesaplarına tekrar erişebilmesini sağlar |
| **5** | Monolitik ekranların alt bileşenlere modüler ayrıştırılması | Mimari / Refactor | `map.tsx`, `profile.tsx`, `medicine.tsx`, `calendar.tsx` | Hot-reload ve maintainability hızını artırır |
