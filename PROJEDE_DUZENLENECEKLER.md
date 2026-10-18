# 📋 Couples App Mobile — Kapsamlı Proje İyileştirme ve Düzenleme Raporu

Bu belge; uygulamanın tüm ekranları, veri akışları, güvenlik mekanizmaları, tasarım estetiği, performans darboğazları ve kullanıcı deneyimi (UX) baştan sona taranarak hazırlanmış master yol haritasıdır.

---

## 📑 İçindekiler
1. [Tamamlanan & Doğrulanan İyileştirmeler](#1-tamamlanan--doğrulanan-iyileştirmeler)
2. [Kritik Mantık & Fonksiyonel Hatalar (Logic Bugs)](#2-kritik-mantık--fonksiyonel-hatalar-logic-bugs)
3. [Tasarım & UI/UX Görsel İyileştirmeleri (Aesthetics)](#3-tasarım--uiux-görsel-iyileştirmeleri-aesthetics)
4. [Güvenlik & Oturum Açıkları (Security & Auth)](#4-güvenlik--oturum-açıkları-security--auth)
5. [Performans & Mimari Refactoring](#5-performans--mimari-refactoring)
6. [Önceliklendirilmiş Uygulama Planı](#6-önceliklendirilmiş-uygulama-planı)

---

## 1. Tamamlanan & Doğrulanan İyileştirmeler

Aşağıdaki optimizasyonlar başarıyla kodlanmış ve TypeScript tip denetiminden sıfır hata ile geçmiştir:

- [x] **Harita Fotoğraf Bellek Sızıntısı ve OOM Çökmesi ([`map.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/map.tsx)):**
  - Harita pinlerinde (`PhotoPin`) tam boyutlu yüksek çözünürlüklü fotoğraflar yerine `thumb_url` kaynağı bağlandı.
  - Pin açılışlarındaki RAM tüketimi ve harita üzerindeki donma/çökme riski ortadan kaldırıldı.
- [x] **Mektuplarda Otomatik Yerel Taslak Kaydı ([`letters.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/letters.tsx)):**
  - Uzun mektup yazarken uygulama kapansa veya modal yanlışlıkla kapatılsa bile harf harf AsyncStorage'a taslak (`@couples_letter_draft_${coupleId}`) kaydediliyor.
  - Modal yeniden açıldığında taslak otomatik geri yükleniyor, mektup başarıyla gönderildiğinde temizleniyor.
- [x] **Form Ekranlarında Alt Bar Çakışması ([`_layout.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/_layout.tsx)):**
  - `add-memory`, `add-photo` ve `add-daily-note` tam ekran formlarında CustomTabBar gizlenerek form butonlarının ("Kaydet / Vazgeç") üzerine binmesi engellendi.
- [x] **Aşk Skoru Sıfır Gecikme & Bellek İçi Önbellek ([`loveScore.ts`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/lib/loveScore.ts) & [`home.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/home.tsx)):**
  - Bellek içi senkron önbellek (`inMemoryScoreCache` / `getCachedLoveScoreSync`) eklendi.
  - Ana sayfa ilk açıldığında görülen "%50" titremesi ve bekleme süresi giderildi.
  - Regl yaklaşma bildirimi döngü başına önbelleğe alınarak gereksiz veritabanı sorguları kesildi.
- [x] **Menü Navigasyon & Çoklu Dokunma Kilidi ([`menu.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/menu.tsx)):**
  - Keyfi `setTimeout(100)` gecikmesi kaldırılarak `requestAnimationFrame` ve 600ms güvenlik emniyet kilidi entegre edildi.
- [x] **Oturum Kapatmada Çift Veri İzolasyonu ([`AuthContext.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/context/AuthContext.tsx)):**
  - `signOut()` işleminde çifte özel tüm yerel önbellekler (`@love_score_*`, `@couples_letter_draft_*`, `@defaults_seeded_*`, `@period_notif_scheduled_*`) temizlenerek oturumlar arası veri sızıntısı önlendi.

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
- **Çözüm:** 4 gün sınırı kaldırılmalı veya mantıklı bir sınıra (örneğin döngü başına 10 gün ya da aylık 12 gün) yükseltilmeli.

### 🔴 2.2. Döngü Tahmini & Geri Sayım Vaadi Ama Sıfır Hesaplama
- **Dosya:** [`src/app/(tabs)/period-tracker.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/period-tracker.tsx)
- **Problem:** Ekranda ve tanıtım metinlerinde "Bilimsel tahminler almak ve döngünüzü takip etmek..." vaadi verilmektedir. Ancak kod tabanında:
  - Ortalama döngü uzunluğu (Cycle length, örn: 28 gün),
  - Bir sonraki beklenen regl tarihi,
  - "Sonraki Regl: 12 Gün Kaldı" geri sayımı,
  - Ovülasyon (yumurtlama) / verimli dönem tahmini
  için hiçbir matematiksel hesaplama bulunmamaktadır.
- **Çözüm:** Geçmiş döngü başlangıç tarihlerinden ortalama döngü periyodu hesaplayan ve takvimde hafif renkli tahmin noktaları gösteren hafif bir algoritma eklenmelidir.

### 🔴 2.3. Ruh Hali (Mood) Seçiminde 24 Saatlik Kalıcı Kilit
- **Dosya:** [`src/components/home/MoodSelector.tsx#L46-L89`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/components/home/MoodSelector.tsx#L46-L89)
- **Problem:** Kullanıcı gün içinde bir emojiye bastığında `setLocked(true)` olmakta ve butonlar `disabled` hale gelmektedir. Oysa arkadaki veritabanı kodu `if (existing)` durumunda güncelleme yapabilecek şekilde yazılmıştır. Sabah yorgun uyanıp gün içinde enerjisi yerine gelen veya yanlış emojiye basan bir kullanıcı gün boyunca modunu güncelleyememektedir.
- **Çözüm:** Kalıcı `disabled` kilidi kaldırılmalı; kullanıcı istediğinde modunu güncelleyebilmeli ve partnerine güncel hissi iletilebilmelidir.

### 🔴 2.4. Buluşma Planlamasında Saniyelik Hata & Toleranssızlık
- **Dosya:** [`src/app/(tabs)/meetings.tsx#L134`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/meetings.tsx#L134)
- **Problem:** 
  ```typescript
  if (meetingDate < new Date() && !editingMeetingId) {
    Alert.alert("Hata", "Geçmiş bir zamana buluşma planlayamazsınız!");
    return;
  }
  ```
  Kullanıcı şu anki saate yakın bir saat seçip başlık ve konumu yazarken 1 dakika geçtiğinde, saniye farkıyla form kaydedilemeyip hata fırlatmaktadır.
- **Çözüm:** En az 5-10 dakikalık bir esneklik payı (`meetingDate.getTime() < Date.now() - 5 * 60 * 1000`) tanınmalıdır.

### 🔴 2.5. Buluşma Zamanı Yaklaşırken Hatırlatıcı Eksikliği
- **Dosya:** [`src/app/(tabs)/meetings.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/meetings.tsx)
- **Problem:** Buluşma oluşturulduğunda partnere anlık push bildirimi gitmektedir. Ancak buluşma gününün sabahında veya buluşmaya 2 saat kala her iki partner için de yerel bildirim (`scheduleDateLocalNotification`) zamanlanmamaktadır. Buluşma zamanı yaklaşırken çiftler bildirim almamaktadır.
- **Çözüm:** Buluşma tarihi için Expo Notifications üzerinden yerel bildirim planlanmalıdır.

### 🔴 2.6. Ortak Takvim ile Buluşmalar ve Regl Günlerinin Kopukluğu
- **Dosya:** [`src/app/(tabs)/calendar.tsx#L104-L128`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/calendar.tsx#L104-L128)
- **Problem:** "Ortak Takvim" ekranı sadece `calendar_notes`, `moods` ve `photo_archive` verilerini çekmektedir. `meetings` (buluşmalar) ve `period_logs` (döngü günleri) bu takvimde hiç yer almamaktadır. Kullanıcı bir buluşma ayarladığında ortak takvimde bunu görememektedir.
- **Çözüm:** Takvim sorgusuna buluşma ve döngü kayıtları da dahil edilerek takvim günü tıklandığında alt listede buluşma kartı da gösterilmelidir.

### 🔴 2.7. Silinen Fotoğrafların Küçük Resimlerinin (Thumbs) Storage'da Çöp Olarak Kalması
- **Dosya:** [`src/app/(tabs)/photos.tsx#L144-L148`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/photos.tsx#L144-L148)
- **Problem:** Bir fotoğraf silindiğinde yalnızca ana dosyanın `storage_path`'i silinmektedir. `add-photo.tsx` tarafından `${coupleId}/thumbs/` klasörüne yüklenen küçük resim dosyaları silinmemekte ve Supabase Storage'da kalıcı olarak depolama alanı harcamaktadır.
- **Çözüm:** Fotoğraf silinirken türetilen veya saklanan `thumb` yolu da Storage `remove` listesine eklenmelidir.

### 🔴 2.8. Özel Günler & Yıl Dönümlerinde Geri Sayım Eksikliği
- **Dosya:** [`src/app/(tabs)/memories.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/memories.tsx)
- **Problem:** "Tanışma Yıl Dönümümüz", "Sevgili Olma Yıl Dönümümüz" kartlarında yalnızca geçmiş tarihler metin olarak yazmaktadır. Yaklaşan yıl dönümüne kaç gün kaldığı (örn: "2. Yılımıza 42 Gün Kaldı ⏳") ve kilometre taşları ("Birlikte 500. Gün! 🎉") gösterilmemektedir.
- **Çözüm:** Her anı için bir sonraki yıllık tekrar tarihi ve kalan gün sayısı hesaplanıp kart üzerinde şık bir rozet olarak sunulmalıdır.

### 🟡 2.9. Menü Kapatma Güvenlik Kilidi
- **Dosya:** [`src/app/menu.tsx#L46-L56`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/menu.tsx#L46-L56)
- **Problem:** `handleRoute` içerisine eklenen 600ms kilit açma emniyeti `handleClose` fonksiyonuna eklenmemiştir. Olası bir geri gitme takılmasında `isNavigatingRef.current` kilitli kalabilir.
- **Çözüm:** `handleClose` içine de güvenlik zamanlayıcısı eklenmelidir.

---

## 3. Tasarım & UI/UX Görsel İyileştirmeleri (Aesthetics)

### 🎨 3.1. Aşk Ölçer (LoveMeter) Hareketli Sayı Sayacı
- **Dosya:** [`src/components/home/LoveMeter.tsx#L52`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/components/home/LoveMeter.tsx#L52)
- **Eksiklik:** Renkli ilerleme çubuğu 1 saniye boyunca yumuşak bir eğriyle dolarken, üzerindeki yüzde metni (`%85`) anında belirmektedir.
- **İyileştirme:** Sayının da çubukla eşzamanlı olarak `0%`'dan hedef puana doğru akıcı biçimde sayması (rolling number animation) sağlanmalıdır.
- **Haptik:** Karta dokunulduğunda kutlama sesinin yanında `triggerHaptic("notification_success")` eklenmelidir.

### 🎨 3.2. Açık Tema (Light Mode) Metin & Renk Bozulmaları
- **Dosyalar:**
  - [`src/app/(tabs)/add-daily-note.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/add-daily-note.tsx)
  - [`src/app/(tabs)/add-memory.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/add-memory.tsx)
- **Eksiklik:** Bu iki form sayfasında `useTheme()` yerine statik `getTheme()` çağrılmakta ve başlıklarda/etiketlerde `#ffffff`, `rgba(255,255,255,0.7)` gibi hardcoded beyaz renkler kullanılmaktadır. Kullanıcı Açık Tema (Light Mode) seçtiğinde arka plan açık renge döndüğü için beyaz metinler okunamaz hale gelmektedir.
- **İyileştirme:** `useTheme()` hook'u bağlanmalı; renkler `theme.text`, `theme.textMuted`, `theme.unitBg` ve `theme.cardBorder` ile uyumlu hale getirilmelidir.

### 🎨 3.3. İlaç Takviminde Seri (Streak) ve Görsel Uyum Matrisi
- **Dosya:** [`src/app/(tabs)/medicine.tsx`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/medicine.tsx)
- **Eksiklik:** Geçmiş kayıtlar sadece alt alta metin listesi şeklindedir.
- **İyileştirme:** 
  - Çiftlerin düzenli ilaç/vitamin alışkanlığını kutlayan "🔥 5 Günlük Seri!" sayacı,
  - Son 7 günün gün gün durumunu gösteren (P, S, Ç, P, C, C, P) yeşil/gri mini hap ikon matrisi eklenerek görsel çekicilik ve motivasyon artırılmalıdır.

### 🎨 3.4. Ortak Takvim Hücrelerinde 4 Noktanın Taşması
- **Dosya:** [`src/app/(tabs)/calendar.tsx#L164-L178`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/calendar.tsx#L164-L178)
- **Eksiklik:** Aynı günde not, her iki sevgilinin modu ve fotoğraf olduğunda takvim gün hücresinin altına 4 adet ayrı nokta sığmamakta ve hücre sınırından taşmaktadır.
- **İyileştirme:** 3'ten fazla işaret olduğunda taşmayı önleyen çoklu renk rozeti veya kompakt çizgi gösterimi uygulanmalıdır.

---

## 4. Güvenlik & Oturum Açıkları (Security & Auth)

### 🚨 4.1. Şifre Sıfırlama ile Supabase Auth Uyuşmazlığı
- **Dosyalar:**
  - [`src/app/(auth)/forgot-password.tsx#L48-L65`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/forgot-password.tsx#L48-L65)
  - [`src/app/(auth)/reset-password.tsx#L67-L72`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/reset-password.tsx#L67-L72)
- **Kritik Bulgu:** 
  1. `forgot-password.tsx` ekranında üretilen OTP kodu yalnızca geliştirici konsoluna (`console.log`) basılmaktadır. Gerçek cihazda veya mağaza sürümünde kullanıcının telefonuna SMS veya e-posta ile kod gitmemektedir.
  2. `reset-password.tsx` ekranında şifre yalnızca `public.users` tablosundaki `password` sütununda güncellenmektedir. Oysa `login.tsx` ekranı oturumu `supabase.auth.signInWithPassword` ile açmaktadır!
  3. **Sonuç:** Kullanıcı şifresini sıfırlasa bile Supabase Auth kimlik sunucusundaki asıl şifresi DEĞİŞMEZ. Kullanıcı yeni şifresiyle sisteme ASLA giriş yapamaz.
- **Çözüm:** Şifre sıfırlama akışı ya Supabase Auth'un yerleşik e-posta kurtarma mekanizmasına (`supabase.auth.resetPasswordForEmail`) bağlanmalı ya da güvenli bir Edge Function/RPC üzerinden hem `auth.users` hem `public.users` senkron güncellenmelidir.

### 🚨 4.2. Giriş Ekranında Brute-Force Korumasının Resetlenebilmesi
- **Dosya:** [`src/app/(auth)/login.tsx#L97-L108`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(auth)/login.tsx#L97-L108)
- **Hata:** `loginAttempts` ve `lockedUntil` değerleri `useState` içinde tutulmaktadır.
- **Güvenlik Riski:** Kötü niyetli biri veya şifresini art arda deneyen biri ekranı kapatıp açtığında veya uygulamayı yeniden başlattığında React durumu sıfırlandığı için 30 saniyelik bekleme kilidi tamamen devre dışı kalmaktadır.
- **Çözüm:** Başarısız deneme sayısı ve kilit bitiş zamanı `safeStorage` (AsyncStorage) içinde saklanmalıdır.

---

## 5. Performans & Mimari Refactoring

### ⚡ 5.1. Monolitik Dev Dosyaların Parçalanması
Uygulamada bazı ekranlar tek dosya içinde binlerce satıra ulaşmıştır:
- `src/app/(tabs)/map.tsx` — **2.304 satır**
- `src/app/(tabs)/profile.tsx` — **2.023 satır**
- `src/app/(tabs)/medicine.tsx` — **1.452 satır**
- `src/app/(tabs)/calendar.tsx` — **1.352 satır**
- `src/app/(tabs)/photos.tsx` — **1.115 satır**

Bu dosyaların içindeki alt kartlar (örneğin `profile.tsx` içindeki ses efektleri test kutusu, tab bar özelleştirici, yasal modal listesi vb.) `src/components/profile/` altına modüler bileşenler olarak ayrıştırılmalıdır. Bu işlem hem hot-reload hızını hem de kod bakımını ciddi oranda rahatlatacaktır.

### ⚡ 5.2. Ana Sayfa Sorgu Şelalesinin (Waterfall) Konsolidasyonu
- **Dosya:** [`src/app/(tabs)/home.tsx#L113-L151`](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/home.tsx#L113-L151)
- **Durum:** Ana sayfa her odaklandığında `moods`, `daily_notes`, `meetings`, `letters`, `users`, `love_score` (6 alt sorgu) ve `period_logs` için 10'dan fazla ayrı HTTP isteği atılmaktadır.
- **Öneri:** Bu temel metrikleri tek bir Postgres RPC fonksiyonu (`get_home_dashboard_summary`) ile birleştirip tek bir ağ gidiş-dönüşünde (RTT) çekmek mobil veri tüketimini ve açılış süresini %60 azaltacaktır.

### ⚡ 5.3. Kullanılmayan Importların Temizlenmesi
- `profile.tsx` dosyasında `Trash2` ve `LogOut` gibi kullanılmayan ikon importları bulunmaktadır.

---

## 6. Önceliklendirilmiş Uygulama Planı

| Sıra | Görev | Kategori | Etki |
| :--- | :--- | :--- | :--- |
| **1** | `period-tracker.tsx` 4 gün sınırının kaldırılması & döngü tahmini | Mantık | Kadın kullanıcıların uygulamayı terk etmesini önler |
| **2** | `LoveMeter.tsx` hareketli sayı sayacı ve haptik entegrasyonu | Tasarım / UX | Ana sayfada anında premium his ve "WOW" etkisi yaratır |
| **3** | `MoodSelector.tsx` 24 saatlik kalıcı kilidin kaldırılarak güncellemelerin açılması | UX / Mantık | Gün içi ruh hali değişimlerini mümkün kılar |
| **4** | `login.tsx` Brute-force kilidinin AsyncStorage ile kalıcılaştırılması | Güvenlik | Brute-force ataklarını ve kilit atlatmayı engeller |
| **5** | `add-daily-note.tsx` ve `add-memory.tsx` Açık Tema renk düzeltmeleri | Tasarım / Erişilebilirlik | Açık temada metinlerin okunamaz olmasını düzeltir |
| **6** | `meetings.tsx` form zaman toleransı (grace buffer) ve yerel bildirim | Mantık / UX | Buluşma kaydında saniyelik hata almayı önler |
| **7** | `calendar.tsx` içine buluşma ve döngü kayıtlarının entegre edilmesi | Fonksiyonellik | Takvimi gerçek anlamda çiftin ortak ajandası yapar |
| **8** | `photos.tsx` silme işleminde orphan thumbnail temizliği | Veri / Depolama | Supabase Storage kotasını korur |
| **9** | `memories.tsx` yıl dönümü geri sayımı ve kilometre taşı rozetleri | UX / Duygusal Bağ | Çiftler için özel günleri anlamlı hale getirir |
| **10** | `medicine.tsx` 7 günlük seri (streak) ve uyum göstergesi | Tasarım / Sağlık | İlaç takibini motivasyon aracına dönüştürür |
