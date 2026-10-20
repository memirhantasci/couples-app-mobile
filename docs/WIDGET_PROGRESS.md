# 🧩 Ana Ekran Widget'ı — İlerleme Takibi

Branch: `widget-picture` · Her faz ayrı commit. Token biterse buradan devam edilir.

## Kararlar
- **Tamamı Premium:** ücretsiz kullanıcıda widget "Premium üyelere özel 👑" kilit görünümünü gösterir (tıklayınca `/paywall`).
  Premium bitiş zamanı (`premiumUntilMs`) payload'da taşınır; uygulama açılmasa bile widget o anda kendini kilitler
  (iOS: timeline kaydı, Android: alarm + her çizimde kontrol).
- **İçerik:** gün sayacı + çift fotoğrafı + partnerin (bugünkü) ruh hali. Özel günlük notu ARTIK widget'a gitmez (gizlilik).
- **Platformlar:** iOS (`expo-widgets`; küçük/orta + kilit ekranı accessory circular/rectangular/inline) ve
  Android (kendi config plugin'imiz + native Kotlin; küçük ve orta yerleşim).
- Gün sayısı **widget içinde hesaplanır** (`startDate`'ten): uygulama günlerce açılmasa da doğru kalır.
- Çıkış/oturum bitişi → widget temizlenir (`signedOut` + fotoğraf dosyaları silinir). Demo modunda widget'a veri gitmez.
- `expo-widgets`'in deneysel Android modu (`enableAndroid`, Glance) KAPALI bırakıldı; kendi plugin'imiz kullanılıyor.

## Mimari
- **Sözleşme:** `CoupleWidgetPayload` → `src/utils/widgetBridge.ts` (iOS `widgets/CoupleWidget.tsx` ve Android
  `plugins/android-widget/CoupleWidgetProvider.kt` aynı alanları okur — birini değiştirirsen üçünü de güncelle).
- **Akış:** `home.tsx` effect → `syncCoupleWidget()` → avatarları indir (iOS: App Group `widgetsDirectory`,
  Android: `Paths.document/widget`) → iOS `updateTimeline` (30 gece yarısı) / Android `CoupleWidgetModule.updateWidget` (SharedPreferences + yenileme).
- **Android plugin:** `plugins/withAndroidWidget.js` → `plugins/android-widget/*.kt` + `res/**` kopyalar, manifest'e receiver,
  `MainApplication.kt`'ye `CoupleWidgetPackage()` ekler. `couple_widget.xml` şablondur (`__DAYS__`/`__LABEL__`).

## Fazlar
- [x] **Faz 1** — `widgetBridge.ts` yeniden yazımı + çağrı noktaları (home, çıkış)
- [x] **Faz 2** — iOS widget
- [x] **Faz 3** — Android widget (plugin + Kotlin + layout'lar)
- [x] **Faz 4** — Doğrulama: tsc temiz; `expo prebuild --platform android` başarılı (manifest receiver, MainApplication, Kotlin, 3 layout,
  drawable, xml üretildi; XML'ler dengeli; Kotlin'in kullandığı tüm `R.id`'ler layout'larda var). **Yapılamayanlar:** Kotlin/Swift DERLEME
  (bu makinede Android SDK/JDK yok, iOS Windows'ta derlenmez) ve gerçek cihazda görüntü testi.

## Sıradaki adım (kullanıcı)
1. Yeni **development build** al (Expo Go'da widget çalışmaz). Native kod değiştiği için ZORUNLU:
   `eas build --profile development --platform android` ve `--platform ios`.
   - iOS ilk build'inde Apple Developer hesabı, `group.com.memirhantasci.couplesapp` App Group'u ve widget target'ının
     (`...ExpoWidgetsTarget`) kimlik bilgilerini EAS otomatik oluşturur/sorar — onaylanmalı.
2. Derleme hatası olursa hata çıktısını ilet (Kotlin/Swift ilk kez burada derlenecek).
3. Aşağıdaki test listesini uygula.

## Telefonda test listesi
**Hazırlık:** Premium hesapla giriş yap, eşleşmiş çift, profil fotoğrafı yüklü, ana sayfayı bir kez aç (widget ilk veriyi buradan alır).
- [ ] Android: ana ekran › widget'lar › "Aşkımızın Yolculuğu" görünüyor, önizlemede örnek veri var.
- [ ] Android: ekle → gün sayısı, iki fotoğraf, partner ruh hali emojisi doğru; küçük (2x2) ve geniş (4x2) boyutta bozulmuyor.
- [ ] iOS: widget galerisinde var; küçük/orta boyut ve kilit ekranı (daire/dikdörtgen/satır) doğru.
- [ ] Widget'a dokun → uygulama ana sayfada açılıyor.
- [ ] Partner ruh halini değiştirince (ana sayfayı yenileyince) widget'ta emoji güncelleniyor; ertesi gün emoji kayboluyor.
- [ ] Profil fotoğrafını değiştirince widget'ta yeni fotoğraf.
- [ ] Uygulamayı kapat, telefonun tarihini 1 gün ileri al → gün sayısı +1 (uygulama açılmadan).
- [ ] Ücretsiz hesap / Premium bitmiş: widget "Premium üyelere özel 👑" gösteriyor, dokununca paywall açılıyor.
- [ ] Çıkış yap → widget "Giriş yap" mesajına dönüyor, eski fotoğraf/isim kalmıyor.
- [ ] Demo modunda widget'a veri gitmiyor.
- [ ] Release/preview build'de (R8/minify) Android widget hâlâ çalışıyor.

## Bilinen sınırlamalar
- Partner ruh hali, yalnızca ana sayfa verisi yenilendiğinde (açılış / aşağı çekme / 5 dk staleTime sonrası) widget'a iletilir.
- Android'de alarm hassas değildir (Doze'da gecikebilir); `updatePeriodMillis` (1 saat) ve tarih değişim yayınları yedektir.
- iOS timeline 30 gün ileriyi kapsar; uygulama 30+ gün açılmazsa widget son kayıtta kalır.
