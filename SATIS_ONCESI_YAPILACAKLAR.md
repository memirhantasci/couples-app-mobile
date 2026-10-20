# 🚀 Couples App — Satış ve Mağaza Yayını Öncesi Yapılacaklar Rehberi (Master Launch Roadmap)

> **Belge Amacı:** Bu kılavuz, uygulamanın teknik geliştirmeleri tamamlandıktan sonra **Apple App Store** ve **Google Play Store** üzerinde resmi olarak satışa ve yayına açılması için yapılması gereken tüm kurumsal, yasal, teknik ve pazarlama adımlarını eksiksiz olarak listeler.

---

## 📊 Yönetici Özeti: Uygulama Ne Kadar Hazır?

| Alan | Durum | Açıklama |
|---|:---:|---|
| **Arayüz & Kullanıcı Deneyimi (UI/UX)** | ✅ %95 Hazır | Aşk Takvimi, Mektuplar, Galeri, Yıldızlar, Harita, Widget ve Temalar tamamlandı. |
| **Veritabanı & Şifreleme (Supabase/Crypto)** | ✅ %90 Hazır | Çift eşleme, uçtan uca veri şifreleme ve RLS politikaları çalışıyor. |
| **Abonelik Altyapısı (RevenueCat/IAP)** | ⚠️ %40 Hazır | Kod tarafı (`RevenueCatService`, `paywall.tsx`) yazıldı; fakat **gerçek mağaza anahtarları ve ürünleri henüz bağlanmadı**. |
| **Geliştirici & Mağaza Hesapları** | ❌ Eksik | Apple Developer ($99) ve Google Play Console ($25) hesaplarının açılması ve onaylanması gerekiyor. |
| **Yasal Belgeler (Gizlilik & Şartlar)** | ⚠️ %50 Hazır | Metinler uygulama içinde var, ancak **mağazaların zorunlu tuttuğu herkese açık HTTPS web linkleri** eksik. |
| **Reklam Kimlikleri (AdMob)** | ⚠️ %30 Hazır | `app.json` içinde Google örnek test ID'leri duruyor; gerçek AdMob hesap ID'leri girilmeli. |
| **Push Bildirim Sertifikaları** | ⚠️ %30 Hazır | Apple APNs `.p8` ve Firebase FCM v1 anahtarlarının EAS Credential kasasına yüklenmesi gerekiyor. |
| **Mağaza Görselleri & ASO** | ❌ Eksik | 1024x1024 iconsuz alpha ikon, 6.9" ve 6.5" mockuplı ekran görüntüleri hazırlanmalı. |

---

# 🔴 1. BÖLÜM: EN KRİTİK ADIM — GELİR MODELİ VE REVENUECAT ENTEGRASYONU

Apple ve Google, dijital özellik satan uygulamalarda **kendi In-App Purchase (Uygulama İçi Satın Alma)** sistemleri haricinde hiçbir ödeme yöntemine (kredi kartı formu, IBAN, web linki vb.) izin vermez. İhlali durumunda uygulama doğrudan reddedilir (**Apple Guideline 3.1.1**).

Uygulamamızda RevenueCat paketi (`react-native-purchases`) kurulmuş durumdadır. Satışa çıkmak için aşağıdaki 4 adımı tamamlamanız şarttır:

### 1.1. RevenueCat Hesabı Açma ve Proje Kurulumu
1. [revenuecat.com](https://www.revenuecat.com/) adresinden ücretsiz bir hesap açın.
2. Yeni bir proje oluşturun: `Couples App`.
3. Sol menüden **Entitlements** sekmesine gidin ve `Premium` adında bir entitlement oluşturun *(Kodumuzda doğrudan `customerInfo.entitlements.active['Premium']` kontrol edilmektedir, bu ismi birebir kullanın)*.
4. **Offerings** sekmesine gidin ve `default` adında bir offering oluşturun. İçine iki paket ekleyin:
   * **Aylık Paket (Monthly):** identifier: `$rc_monthly`
   * **Yıllık Paket (Annual):** identifier: `$rc_annual` (Önerilen/İndirimli)

### 1.2. App Store Connect Ürünlerini Tanımlama (iOS)
1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com/) adresine girin.
2. Uygulamanızın sayfasına gidin -> **Abonelikler (Subscriptions)** -> Yeni Abonelik Grubu: `Couples Premium`.
3. 2 Adet Otomatik Yenilenen Abonelik (Auto-Renewable Subscription) oluşturun:
   * **Ürün ID 1:** `couples_sub_monthly` (Fiyat: örn. 79.99 TL / $2.99)
   * **Ürün ID 2:** `couples_sub_annual` (Fiyat: örn. 499.99 TL / $19.99)
4. Her ürün için bir ekran görüntüsü yükleyin (Paywall ekranınızın bir ekran görüntüsü kabul edilir) ve açıklama yazın.
5. **App Store Connect -> Uygulama Bilgileri -> Paylaşılan Gizli Anahtar (Shared Secret)** oluşturun ve bunu RevenueCat panelindeki iOS App ayarlarına yapıştırın.

### 1.3. Google Play Console Ürünlerini Tanımlama (Android)
1. [play.google.com/console](https://play.google.com/console) adresine girin.
2. **Para Kazanma -> Ürünler -> Abonelikler (Subscriptions)** bölümüne gidin.
3. Aynı şekilde aylık ve yıllık abonelikleri tanımlayın:
   * `couples_sub_monthly`
   * `couples_sub_annual`
4. Google Cloud Console üzerinden bir **Service Account JSON** anahtarı oluşturup RevenueCat panelindeki Android App ayarlarına bağlayın.

### 1.4. Kod İçindeki API Anahtarlarını Güncelleme
[src/lib/revenuecat.ts](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/lib/revenuecat.ts) dosyasında şu an yer alan `appl_xxxxxxxx` ve `goog_xxxxxxxx` yer tutucularını gerçek Public SDK Key'leriniz ile değiştirin:
* `EXPO_PUBLIC_REVENUECAT_APPLE_KEY=appl_GercekRevenueCatAppleAnahtari`
* `EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY=goog_GercekRevenueCatGoogleAnahtari`

---

# 🟠 2. BÖLÜM: MAĞAZA RET (REJECTION) RİSKLERİ VE ALINACAK ÖNLEMLER

Apple App Store inceleme süreci oldukça titizdir. Çift uygulamalarının en sık takıldığı 5 temel ret nedeni ve bizim uygulamamızdaki çözümleri:

### 🚨 Ret Nedeni 1: "İncelemeci Tek Kişi, Eşleşme Ekranını Geçemiyor" (Guideline 2.1)
* **Risk:** Apple test ekibindeki görevli tek bir iPhone ile uygulamanızı açar. Partneri olmadığı için çift kodu üretemez, partnerin kodunu giremez ve ana ekrana ulaşamaz. Bu durumda *"Uygulama tam olarak incelenemedi"* diyerek reddeder.
* **Kesin Çözüm:** 
  1. Giriş ekranımızdaki **"Demo Olarak İncele"** modu reviewers için hayat kurtarıcıdır!
  2. Ayrıca App Store Connect'teki **İnceleme Notları (App Review Notes)** kısmına şu metni yazın:
     > *"Değerli İnceleme Ekibi; uygulamamız çiftler için ortak bir alandır. Test edebilmeniz için iki seçenek hazırladık:*  
     > *1) Giriş ekranındaki 'Demo Olarak İncele' butonuna basarak tüm Premium özellikleri ve ekranları tek dokunuşla dolu olarak inceleyebilirsiniz.*  
     > *2) Gerçek kullanıcı girişi yapmak isterseniz birbirine bağlanmış hazır test hesabı: E-posta: reviewer@couplesapp.com / Şifre: Reviewer1234!"*

### 🚨 Ret Nedeni 2: "Hesap Silme Akışı Yetersiz" (Guideline 5.1.1(v) Account Deletion)
* **Risk:** Apple, kullanıcıların hesap açabildiği tüm uygulamalarda **uygulama içerisinden hesabını ve tüm kişisel verilerini tek dokunuşla silebilmesini** şart koşar. Eğer silme işlemi sadece "destek e-postası atın" şeklindeyse veya gecikmeli/anlaşılmaz ise uygulama reddedilir.
* **Mevcut Durumumuz:** [profile.tsx](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/(tabs)/profile.tsx) içinde `DangerZoneCard` bileşeninde "Hesabımı ve Tüm Verileri Sil" butonu bulunuyor.
* **Yapılması Gereken:** Kullanıcı onay verdiğinde yalnızca `couples` tablosunda tarih güncellenmekle kalmamalı, kullanıcının Supabase oturumu derhal sonlandırılmalı (`supabase.auth.signOut()`) ve cihazdaki tüm yerel önbellek (`AsyncStorage.clear()`) sıfırlanmalıdır.

### 🚨 Ret Nedeni 3: "Abonelik Koşulları ve EULA Eksikliği" (Guideline 3.1.2)
* **Risk:** Paywall ekranında aboneliğin ne zaman yenileneceği, nereden iptal edileceği ve Apple Standart Kullanım Şartları (EULA) linki açıkça görünmüyorsa Apple anında ret verir.
* **Mevcut Durumumuz:** [paywall.tsx](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/src/app/paywall.tsx) ekranımızda `Restore Purchases (Satın Alımları Geri Yükle)` butonu ve yasal linkler mevcut.
* **Yapılması Gereken:** Paywall altına standart Apple EULA bağlantısı eklenmelidir: `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`.

### 🚨 Ret Nedeni 4: "İzin İsteme Metinlerinin Yetersiz Olması" (Data Privacy)
* **Risk:** Kamera veya Fotoğraf Galerisi izni istenirken sadece "Kameraya erişmek istiyoruz" yazılırsa Apple reddeder. Neden erişmek istediğinizi açıkça anlatmalısınız.
* **Mevcut Durumumuz:** [app.json](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/app.json) dosyasında açıklamalarımız gayet samimi yazılmıştır:
  * `NSCameraUsageDescription`: *"Anılarınıza fotoğraf ekleyebilmek için kameraya erişmemiz gerekiyor."*
  * `NSPhotoLibraryUsageDescription`: *"Anılarınıza fotoğraf ekleyebilmek için fotoğraf kütüphanesine erişmemiz gerekiyor."*
  * `NSLocationWhenInUseUsageDescription`: *"Buluşma noktası seçerken mevcut konumunuzu haritada gösterebilmek için konum erişimi gereklidir."*

---

# 🟡 3. BÖLÜM: YASAL BELGELER VE WEB SİTESİ GEREKSİNİMLERİ

Apple ve Google mağaza formlarını doldururken aşağıdaki 2 web bağlantısını (HTTPS linki) girmenizi **zorunlu** kılar. Bu linkler girilmeden mağaza gönderimi yapılamaz:

1. **Gizlilik Politikası URL'si (Privacy Policy URL):**  
   * Kullanıcıların hangi verilerinin (şifreli aşk notları, e-postalar, fotoğraflar, regl döngüsü tarihleri) nerede saklandığını açıklayan metin.
2. **Kullanım Koşulları & EULA URL'si (Terms of Service URL):**  
   * Kullanıcı sözleşmesi ve abonelik kuralları.
3. **Destek URL'si (Support URL):**  
   * Kullanıcıların bir sorun yaşadığında ulaşabileceği iletişim sayfası veya destek formu.

> 💡 **Hızlı ve Ücretsiz Çözüm:**  
> Kendi alan adınız (domain) henüz yoksa, projenin `legalTexts.ts` içindeki hazır metinlerini **Notion**'a yapıştırıp *"Share to Web"* diyebilir veya **GitHub Pages / Vercel** üzerinde tek sayfalık statik bir web sitesi (`https://memirhantasci.github.io/couples-legal/`) açabilirsiniz.

---

# 🟢 4. BÖLÜM: ADMOB (REKLAM) ÜRETİM AYARLARI

Uygulamanın ücretsiz kullanıcılarında reklam gösterimi için `react-native-google-mobile-ads` paketi kurulmuştur. Ancak [app.json](file:///c:/Users/ahmet/OneDrive/Masa%C3%BCst%C3%BC/couples-app-mobile/app.json) dosyasında şu an Google'ın test App ID'leri bulunmaktadır:
* Android: `ca-app-pub-3940256099942544~3347511713`
* iOS: `ca-app-pub-3940256099942544~1458002511`

### Yapılması Gerekenler:
1. [admob.google.com](https://admob.google.com/) adresine girip bir yayıncı hesabı açın.
2. "Yeni Uygulama Ekle" diyerek iOS ve Android için 2 uygulama oluşturun.
3. Size verilen gerçek App ID'leri `app.json` içindeki `react-native-google-mobile-ads` alanına yazın.
4. Reklam birimlerini oluşturun (Banner, Geçiş/Interstitial).
5. **iOS App Tracking Transparency (ATT):** iOS 14.5+ sonrası kişiselleştirilmiş reklam göstermek için kullanıcıdan izin istemek gerekir. `expo-tracking-transparency` entegrasyonunun aktif olduğundan emin olun.

---

# 🔵 5. BÖLÜM: ANLIK BİLDİRİMLER (PUSH NOTIFICATIONS)

Çift uygulamalarında push bildirimi hayati önem taşır ("Sevgilin yeni bir mektup mühürledi! 💌", "Partnerin bugün Aşık hissediyor 🥰").

### 5.1. Apple (iOS) APNs Kurulumu:
1. Apple Developer hesabınızda **Certificates, Identifiers & Profiles -> Keys** sekmesine gidin.
2. **Apple Push Notifications service (APNs)** yetkisine sahip bir anahtar (`.p8` dosyası) indirin.
3. Terminalde `eas credentials` komutunu çalıştırarak bu `.p8` anahtarını Expo sunucularına tanıtın.

### 5.2. Android (FCM v1) Kurulumu:
1. Firebase Console üzerinde `couples-app` projesi açın.
2. `google-services.json` dosyasını indirip projenin kök dizinine yerleştirin *(Zaten mevcut, ancak kendi canlı Firebase projenizle yenilenmelidir)*.
3. Firebase -> Project Settings -> Cloud Messaging altındaki FCM v1 API'sini etkinleştirin.

### 5.3. Supabase Database Webhook Entegrasyonu:
* Bir partner takvime not eklediğinde, mektup yolladığında veya fotoğraf yüklediğinde diğer partnerin cihazına bildirim gitmesi için Supabase Webhook veya Edge Function üzerinden Expo Push API (`https://exp.host/--/api/v2/push/send`) tetiklenmelidir.

---

# 🟣 6. BÖLÜM: MAĞAZA VARLIKLARI VE ASO (APP STORE OPTIMIZATION)

Mağazada uygulamanızın indirilmesini sağlayan en büyük faktör ekran görüntüleri ve ikon kalitesidir.

### 6.1. Uygulama İkonu (App Icon)
* **Boyut:** `1024 x 1024 px` (PNG formatında).
* ⚠️ **EN ÖNEMLİ KURAL:** İkonda **kesinlikle şeffaflık (alpha kanalı) olmamalıdır!** Arka plan tamamen dolu ve opak olmalıdır; aksi halde Apple Store onaylamaz.
* **Android Adaptive Icon:** Projedeki `./assets/images/android-icon-foreground.png` ve `background.png` dosyaları hazır durumdadır.

### 6.2. Ekran Görüntüleri (Screenshots Checklist)
Uygulama mağazaya yüklenirken aşağıdaki boyutlarda en az 3'er adet mockup'lı ekran görüntüsü zorunludur:
1. **iPhone 6.9" Display:** iPhone 16 Pro Max (`1320 x 2868 px`)
2. **iPhone 6.5" Display:** iPhone 14/15 Plus (`1284 x 2778 px`)
3. **Android Telefon:** Minimum 4 ekran (`1080 x 2400 px` veya `1080 x 1920 px`)

**Öne Çıkarılması Gereken 5 Ana Ekran:**
1. **Ana Sayfa:** Aşk sayacı, partnerlerin avatarları, günün sözü ve romantik arayüz.
2. **Ortak Takvim:** Birlikte geçirilen anılar, renkli etkinlik noktaları ve özel aşk notları.
3. **Geleceğe Mektuplar:** Mühürlü mektuplar, sürpriz açılış tarihleri ve balmumu mührü.
4. **Ortak Galeri:** Çiftlere özel şifreli fotoğraf arşivi.
5. **Gökyüzü & Ortak Yıldız:** Çiftin gökyüzündeki 3D yıldızı ve yıldız kümesi.

### 6.3. ASO Metinleri (Hazır Şablon)

* **Uygulama Adı (App Title - Max 30 Karakter):**  
  `Couples: Çiftler İçin Aşk Alanı`
* **Alt Başlık (Subtitle - Max 30 Karakter):**  
  `Ortak Takvim, Mektup & Sayaç`
* **Anahtar Kelimeler (Keywords - 100 Karakter):**  
  `çift,aşk,sevgili,ilişki takibi,aşk sayacı,ortak takvim,mektup,regl takvimi,ilişki,anı defteri,widget`
* **Promosyon Metni (Promotional Text):**  
  `Sevgilinizle aranızdaki mesafeleri ve zamanı unutturan, size özel güvenli ve romantik bir dünya.`

---

# ⚙️ 7. BÖLÜM: DERLEME (BUILD) VE MAĞAZAYA YÜKLEME ADIMLARI

Tüm ayarlar tamamlandıktan sonra Expo Application Services (EAS) üzerinden canlı mağaza paketleri şu adımlarla üretilir:

### 1. Adım: EAS CLI Kurulumu ve Giriş
```powershell
npm install -g eas-cli
eas login
```

### 2. Adım: Projeyi EAS'a Bağlama ve Ortam Değişkenleri
EAS Secrets içerisine gizli anahtarlarınızı tanımlayın:
```powershell
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-supabase-url.supabase.co" --type string
eas secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key" --type string
eas secret:create --name EXPO_PUBLIC_REVENUECAT_APPLE_KEY --value "appl_xxx" --type string
eas secret:create --name EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY --value "goog_xxx" --type string
```

### 3. Adım: Canlı Üretim Derlemesi (Production Build) Alma
```powershell
# iOS (.ipa) için canlı derleme
eas build --platform ios --profile production

# Android (.aab - App Bundle) için canlı derleme
eas build --platform android --profile production
```

### 4. Adım: Mağazalara Otomatik Gönderme (Submit)
```powershell
# App Store Connect TestFlight'a yükler
eas submit --platform ios

# Google Play Console Dahili Test'e yükler
eas submit --platform android
```

---

# ✅ SATIŞ ÖNCESİ MASTER KONTROL LİSTESİ (CHECKLIST)

Aşağıdaki maddeleri sırayla tamamlayıp işaretleyerek mağaza onayına güvenle gidebilirsiniz:

- [ ] **1. Hesaplar:** Apple Developer ($99) ve Google Play Console ($25) hesapları açıldı.
- [ ] **2. RevenueCat:** Entitlement (`Premium`), Offering (`default`) ve ürün ID'leri tanımlandı.
- [ ] **3. In-App Purchase:** App Store Connect ve Play Console'da aylık ve yıllık abonelikler onaylandı.
- [ ] **4. RevenueCat Keys:** `revenuecat.ts` içine gerçek iOS ve Android SDK anahtarları girildi.
- [ ] **5. Yasal Linkler:** Herkese açık Gizlilik Politikası ve Kullanım Koşulları web linkleri hazırlandı.
- [ ] **6. Paywall EULA:** Paywall altına standart Apple EULA bağlantısı eklendi.
- [ ] **7. AdMob ID:** `app.json` içindeki test AdMob ID'leri gerçek yayıncı ID'leriyle değiştirildi.
- [ ] **8. Push Bildirimler:** Apple APNs `.p8` ve Android FCM v1 anahtarları EAS kasasına yüklendi.
- [ ] **9. Hesap Silme:** Ayarlar ekranındaki "Hesabı Sil" akışı Supabase auth ve yerel veri sıfırlama ile doğrulandı.
- [ ] **10. İnceleme Notu:** App Store Connect inceleme ekibi için Demo Modu ve test hesabı bilgileri notlara yazıldı.
- [ ] **11. İkon Kontrolü:** `icon.png` 1024x1024 boyutunda ve şeffaflıksız (no-alpha) olarak doğrulandı.
- [ ] **12. Ekran Görüntüleri:** 6.9", 6.5" iPhone ve Android için mockup'lı pazarlama görselleri hazırlandı.
- [ ] **13. ASO Bilgileri:** Başlık, alt başlık, açıklama ve 100 karakterlik anahtar kelimeler mağaza paneline girildi.
- [ ] **14. Yaş Derecelendirmesi:** App Store Connect ve Play Console anketleri (12+ / 17+) dolduruldu.
- [ ] **15. TestFlight:** İlk canlı build TestFlight'a atıldı ve gerçek cihazda satın alma/çift eşleme akışı test edildi.
