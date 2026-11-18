# iPhone Duo ve Android katlanabilir araştırması

Tarih: 2026-11-09. Yöntem: web kaynakları okundu, kod yalnızca ilgili yerlerde tarandı. Her bilgi şu etiketlerden birini taşır:

- **[KESİN]** resmi kaynakta okundu
- **[3. TARAF]** resmi olmayan kaynak, doğrulanmadı
- **[ÇIKARIM]** kaynaklardan benim çıkardığım sonuç, hiçbir yerde açıkça yazmıyor
- **[BİLİNMİYOR]** bulunamadı, yeni oturum doğrulamalı

## 1. iPhone Duo cihaz gerçekleri

| | İç ekran (açık) | Dış ekran (kapalı) |
|---|---|---|
| Köşegen | 7.6″ (dikdörtgen olarak 7.58″) [KESİN] | 5.4″ (5.36″) [KESİN] |
| Piksel | 1878×2670, 430 ppi [KESİN] | 1398×2034, 460 ppi [KESİN] |
| Nokta (pt), @3x | **626×890** [3. TARAF] | **466×678** [3. TARAF] |
| En-boy | ~1.42 [3. TARAF] | ~1.45 [3. TARAF] |
| Size class (Apple) | yatay Regular + dikey Regular, iki yönde de [KESİN] | dikey: yatay Compact + dikey Regular; yatay: ikisi Compact [KESİN] |

- Apple pt boyutlarını, ölçek katsayısını, safe-area değerlerini, köşe yarıçapını ve menteşe genişliğini **yazmıyor** [BİLİNMİYOR]. Yukarıdaki pt değerleri piksel/3 hesabı.
- Açık boyut 164.6×117.8 mm, kapalı 84.1×117.8 mm. Satışa çıkış: 23 Ekim 2026 [KESİN].
- Dış ekran 466 pt genişliğinde: bugünkü en geniş telefondan (440 pt) geniş, ama çok kısa (678 pt). **Bu yüzden "440'ın üstü = geniş" kuralı dış ekranı yanlış sınıflandırırdı.**

Kaynaklar: https://www.apple.com/newsroom/2026/09/apple-unveils-iphone-duo/ , https://www.apple.com/iphone-duo/specs/ , https://developer.apple.com/videos/play/tech-talks/111461/ , https://iphoneduosupport.com/specs/ (3. taraf)

## 2. Eski SDK ile derlenmiş uygulama ne görür (siyah bant meselesi)

Sebep tasarım değil, uygulamanın **hangi iOS SDK'sıyla derlendiği** [KESİN: Apple prepare sayfası + teknik konuşma; heise ile uyumlu].

| Derleme SDK'sı | Dış ekran | İç ekran |
|---|---|---|
| iOS 26 ve öncesi | Durum çubuğu ve kameranın solundaki alana sığar, kalın boş/siyah çerçeve | Ekranın ortasında, çevresinde boş alan |
| iOS 27 | (okunabilir metinde ayrı tarif yok) | İç ekranın çoğunu doldurur, sağ kenardaki durum çubuğundan kaçınır |
| **iOS 27.1 (Xcode 27.1)** | Tam ekran, çubuklar durum çubuğunun altında dikey | Ekran kenarına kadar, standart gezinme/araç çubuğu düğmeleri dikey dizilir |

- Apple "siyah bant" demiyor, "boş alan" diyor [KESİN]. Boyutu verilmemiş.
- Tam ekran için **Xcode 27.1** gerekli. "Recompile existing apps with Xcode 27.1" [KESİN].
- iOS 27 SDK ile derlenen uygulamalar **canlı yeniden boyutlanır**: katlayınca oturum ortasında pencere boyutu değişir, yeniden başlatma yok [KESİN].
- Apple 27.1 SDK'yı zorunlu kılmıyor, ama App Store Connect'te "Duo için optimize" rozeti veriyor [KESİN: https://developer.apple.com/news/?id=kkphp5qo].
- **Nisan 2027'den itibaren gönderilen her uygulama/oyun iPhone Duo ekran görüntüsü içermeli** [KESİN, haber sayfasından birebir]. Başka bir yerde "27.1 SDK kullanan uygulamalar için" diye geçiyor, kapsam çelişkili [BİLİNMİYOR → canlı sayfadan kontrol].
- Ekran görüntüsü boyutları (özetten, birebir değil): dış 1398×2034, iç 2007×2853 [3. TARAF/ÖZET].
- Genel kural: Nisan 2026'dan beri iOS 26 SDK şart [KESİN, upcoming-requirements].

## 3. Apple'ın tasarım rehberi (okunabilen kısım)

HIG sayfası ve "Preparing your app for iPhone Duo" makalesi okunamadı (yalnızca başlık geldi). Aşağıdakiler teknik konuşma kayıtlarından [KESİN ama eksik].

- "İki size class'a odaklan: dış ekranda compact genişlik, iç ekranda regular genişlik." Sabit genişlik ve `bounds.height == 844` gibi kontrolleri sil. Yönelime veya idiom'a göre düzen seçme.
- Safe area: sol ve sağ inset'ler **simetrik değil**, ayrı ele alınmalı. Arka plan görselleri safe area dışına taşabilir, etkileşimli içerik içinde kalır.
- Sistem tab bar ve toolbar'ları dış ekranda ve iç ekran yatayında yana geçebilir. **Özel (JS ile çizilmiş) çubuklar sistem davranışını almaz.** Metinde "tab bar altta kalır" ve "kenara geçer" çelişkisi var [BİLİNMİYOR].
- `UIScreen.main` kullanma, ileride kaldırılacak. Aspect-fill tam ekran görselleri kontrol et.
- Katlama bölgesi (reserved region, 27.1) ve menteşe açısı API'leri var; menteşe açısı yalnızca etkileşim/efekt içindir, yerleşim için değil [KESİN].
- Yeni pencere dış ekranda açılamaz, yalnızca iç ekranda.
- **Yönelim çelişkisi:** Aynı konuşmada hem "iç ekran desteklenen yönelimleri dikkate almaz" hem "yönelimlere saygı gösterir ama iç ekranda ölçeklenir" yazıyor. Dikey kilitli uygulamanın iç ekranda ne yaptığı net değil [BİLİNMİYOR]. **Varsayım: dikey kilit iç ekranda garanti değil, düzen her en-boy oranında çalışmalı.**
- `UIRequiresFullScreen` anahtarı korunuyor ama uygulama yine de yeniden boyutlanır [KESİN].
- Test: Xcode 27.1 Device Hub'ın Duo simülatörü (aç/kapat/döndür/katla). Mac gerektirir. Mac'siz yol bulunmadı [KESİN: bulunamadı].

## 4. Expo / React Native tarafı

Proje: `expo ~57.0.31`, `react-native 0.86.3`, `ios/` klasörü yok (CNG, her build'de üretiliyor), [app.json](../app.json) içinde iOS native özelleştirmesi yok, özel plugin yalnızca Android widget için ([plugins/withAndroidWidget.js](../plugins/withAndroidWidget.js)). [eas.json](../eas.json) içinde `image` tanımlı değil (varsayılan `auto`).

- **iOS 27 SDK ile derlenen uygulama UIScene yaşam döngüsünü ZORUNLU kullanır; yoksa açılışta çöker** [KESİN: RN 0.88 duyurusu, Expo SDK 58 changelog]. RN 0.86.3'te SceneDelegate desteği yok [KESİN].
- **SDK 57'de çözüm:** `expo-build-properties` içinde `ios.enableSceneSupport: true`. Gereken: expo ≥ 57.0.23 (bizde 57.0.31 var). Yalnızca standart SDK 57 Swift AppDelegate şablonu destekleniyor (bizde özelleştirme yok) [KESİN: Expo dokümanı].
- **EAS image:** `macos-tahoe-26.6-xcode-27.1` (takma adlar: `latest`, `sdk-58`), araç zinciri "Xcode 27.1 RC (27A9275)". `sdk-57` takma adı Xcode 26.6'ya gider ve iOS 27 SDK ile derleyemez [KESİN]. `eas.json`'da `build.<profil>.image` olarak yazılır, yazım biçimi birebir doğrulanmadı [ÇIKARIM].
- Başka bir kaynakta Xcode 27.2 image dokümanı PR'ı geçiyor (expo/expo#53215). Güncel image listesini canlı kontrol et [BİLİNMİYOR].
- **Expo SDK 58 yayınlandı (15 Ekim 2026), React Native 0.88 kullanıyor.** Scene desteği yerleşik, flag gerekmiyor. Duo için **zorunlu değil**: SDK 57 + flag açılışa yeter. Menteşe/Arrangement/NavigationSplitView API'leri yalnızca SDK 58'de [KESİN].
- SDK 58 kırıcı değişiklikleri: strict TypeScript, `InteractionManager` ve `Touchable` kaldırıldı, `Modal animated` prop'u kaldırıldı, Android R8 varsayılan açık, bildirim varsayılanları, Node 22.13+, Router değişiklikleri vb. Büyük bir yükseltme, ayrı onay ister.
- iOS 27'de `requireFullScreen` artık yeniden boyutlanmayı engellemez. `ScreenOrientation.lockAsync` etkisiz kalabilir. Yeniden boyutlanabilir uygulamada desteklenen yönelim "tercih" sayılır. **Config'deki `orientation: portrait` için aynısı muhtemel ama hiçbir kaynak doğrulamıyor** [ÇIKARIM] (kaynak: Expo screen-orientation v58 dokümanı).
- Expo paketleri artık `UIScreen.main` kullanmıyor. Safe-area için `react-native-safe-area-context` güncellenmeli ve bazı yerlerde `SafeAreaView` gerekebilir [KESİN: SDK 58 changelog].
- RN 0.88: UIScene ile pencere yeniden boyutlanır ve `Dimensions.get()` ile `useWindowDimensions()` güncel değer verir [KESİN]. **Yine de modül seviyesinde okunan `Dimensions.get` değerleri yükleme anında donar** [ÇIKARIM, standart JS davranışı].
- Fold/menteşe algılama: `expo-hinge` (SDK 58) yalnızca menteşe durumunu verir, yerleşim için değil. Reserved region (katlama bölgesi) için yayınlanmış Expo API'si yok [KESİN: bulunamadı]. **Yerleşim için `useWindowDimensions` + genişlik eşiği kullan.**
- Mac yok: EAS bulut build'i ve TestFlight kullanılır. "EAS Simulator" duyurulmuş ama durumu bilinmiyor [BİLİNMİYOR].

Kaynaklar: https://expo.dev/changelog/sdk-58 , https://docs.expo.dev/build-reference/infrastructure/ , https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/ , https://reactnative.dev/blog/2026/10/19/react-native-0.88 , https://docs.expo.dev/versions/v58.0.0/sdk/screen-orientation/

## 5. Kütüphane uyumu (projedeki sürüm → bilinen durum)

Hiçbirinde "katlanabilir" notu yok. Aşağıdakiler iOS 27/UIScene/Duo ile doğrudan ilgili bulunanlar. Sürümleri Expo SDK 57'nin sabitlediği aralıkla çakıştırmadan yükseltmek gerekir (`npx expo install --check`).

| Kütüphane (bizde) | Bulgu |
|---|---|
| react-native-reanimated 4.5.1 | 4.7.1 "UIScene'de `useAnimatedKeyboard` çökmesi"ni düzeltiyor (PR #10587). 4.7 RN 0.86–0.88 destekler. 4.5.1–4.5.5'te kaldırma/yeniden takma sırasında bellek sızıntısı (#11088). 4.7.0 yeni layout-animation motoru varsayılan: yükseltirse animasyonlar değişebilir (kart animasyon tercihlerine dikkat) |
| react-native-screens ~4.26 | 4.30.1: "açılmış Duo'da soğuk açılıştan sonra tab bar görünür" (#4990). 4.30.0: Stack v4'te iOS 27/Duo desteği (özetten, doğrulanmadı). 5.0 beta ayrı büyük sürüm, kaçın |
| react-native-safe-area-context ~5.7 | 5.11.1'e kadar resize/rotation inset düzeltmeleri var (5.8.1, 5.11.1). iOS 27 notu yok |
| @shopify/react-native-skia 2.6.2 | 2.x'te "canvas boyutunu piksel ızgarasına yuvarla" (2.15.3, #4365). Başka resize notu yok. Yıldız gökyüzü tuvali için önemli |
| react-native-maps 1.27.2 | 1.29.x'te iOS marker düzeltmeleri. iOS 27/resize notu yok |
| react-native-google-mobile-ads 16.3.4 | **17.3.0**: "pencereyi AppDelegate yerine scene üzerinden çöz", "tam ekran kapatma scene-güvenli". 17.0.0 kırıcı: Yeni Mimari şart, iOS 15.1 minimum. UIScene ile açılışta/reklamda sorun çıkarma riski yüksek |
| react-native-gesture-handler ~2.32 | 2.33.x modal responder düzeltmesi (özetten). iOS 27 notu yok |
| nativewind 4.2.6 | 4.2.7 "Expo SDK 57 toolchain" desteği. v5 Tailwind 4 ister, geçme |
| react-native-view-shot 5.1.0 | Kontrol edilemedi (404) [BİLİNMİYOR] |
| expo-router, expo-notifications, expo-widgets, expo-glass-effect | Doğrudan kontrol edilemedi. SDK 58'de `isLiquidGlassAvailable` iOS 27 SDK build'inde true |
| react-native-calendars, keyboard-aware-scroll-view | iOS 27/resize notu yok |

Açık issue: react-native#59731 "ters çevrilmiş FlatList iOS 27'de aygıtta boş" (Needs Repro). Uygulamada ters FlatList kullanımı varsa kontrol et.

## 6. Android katlanabilirler

- **Cihaz ölçüleri (piksel; dp DOĞRULANMADI [BİLİNMİYOR]):** Galaxy Z Fold 7 iç ~8″ 2184×1968, dış 6.5″ 2520×1080. Pixel 10 Pro Fold iç 2076×2152, dış 6.4″ 2364×1080 [3. TARAF]. Yalnızca Android'in test referansı "katlanabilir 841×701 dp" okundu.
- **Pencere genişlik sınıfları (dp) [KESİN]:** Compact <600, Medium 600–840, Expanded 840–1200, Large 1200–1600, Extra-large ≥1600. Yükseklik: Compact <480, Medium 480–900, Expanded ≥900. Dokümana göre açık katlanabilirin dikey durumu çoğunlukla Medium, yatayı en az Expanded. "isTablet" mantığı için kullanılmamalı.
- **En önemli bulgu:** Expo SDK 57 `targetSdkVersion = 36` ve `compileSdkVersion = 36` kullanıyor [KESİN]. **Android 16'da API 36 hedefleyen uygulamalar için, en küçük genişliği ≥600 dp olan ekranlarda `screenOrientation`, `resizeableActivity` ve en-boy oranı kısıtlamaları yok sayılır** [KESİN: Android 16 behavior changes]. Yani `orientation: portrait` kilidi, Fold'un açık iç ekranında muhtemelen tutmaz. Uygulama hem dikey hem yatay ve geniş pencerede çalışmalı. **Bu durum bugün yayında olan Android uygulaması için de geçerli olabilir (iç ekranda gerilmiş görünür) [ÇIKARIM].**
- Geçici kaçış: `android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY` (API 37 hedeflenince çalışmaz). Android dokümanı bunu "hızlı çözüm" olarak önermiyor. Expo'da nasıl ekleneceği belgelenmemiş (muhtemelen config plugin) [BİLİNMİYOR]. **Kaçış değil, gerçek çözüm: duyarlı düzen.**
- 600 dp altı (tüm normal telefonlar ve katlanabilirlerin kapalı dış ekranı) kısıtlamalar geçerli kalır, **mevcut telefonlar etkilenmez**.
- Katlayıp açmak Android'de bir yapılandırma değişikliğidir. Varsayılan olarak Activity yeniden oluşturulabilir. `android:configChanges="screenSize|smallestScreenSize|orientation|screenLayout"` bunu engeller, ama uygulamanın değişikliği işlemesi gerekir. Üretilen manifestte (android/ klasörü var) ana Activity'nin `configChanges` değerini **kontrol et**. Yeniden oluşturma bellek içi durumu sıfırlar [KESİN + ÇIKARIM].
- Kenardan kenara (edge-to-edge) Android 16'da API 36 için kapatılamaz [KESİN]. Öngörülü geri hareketi varsayılan açık (projede `predictiveBackGestureEnabled: false`).
- Test (Windows'ta mümkün): Android Studio emülatörü, Phone → **Pixel Fold**, Tablet → Medium Tablet, "resizable" emülatör. Katlama simülasyonu, `adb shell wm size` ve menteşe sensörü simülasyonunun adımları doğrulanmadı [BİLİNMİYOR].
- `useWindowDimensions` Android'de katlamada: RN 0.86 dokümanı doğrulanmadı [BİLİNMİYOR]. RN 0.86 sürüm notlarında Android 15+ edge-to-edge `Dimensions` düzeltmeleri var.

Kaynaklar: https://developer.android.com/about/versions/16/behavior-changes-16 , https://developer.android.com/develop/ui/views/layout/window-size-classes , https://developer.android.com/guide/topics/resources/runtime-changes , https://developer.android.com/develop/ui/compose/layouts/adaptive/foldables/learn-about-foldables

## 7. Projede bulunanlar

- **Modül seviyesinde `Dimensions.get(...)` (katlayınca güncellenmez, ilk bakılacaklar):**
  - [MapPhotoLightbox.tsx:22](../src/components/map/MapPhotoLightbox.tsx)
  - [PhotoGrid3Cell.tsx:7](../src/components/photos/PhotoGrid3Cell.tsx), [PhotoGrid2Cell.tsx:10](../src/components/photos/PhotoGrid2Cell.tsx)
  - [ExoplanetModal.tsx:85](../src/modules/stars/components/ExoplanetModal.tsx), [HomeRadarOverlay.tsx:21](../src/modules/stars/components/HomeRadarOverlay.tsx), [OurStarScreen.tsx:115](../src/modules/stars/components/OurStarScreen.tsx), [ClaimStarModal.tsx:105](../src/modules/stars/components/ClaimStarModal.tsx), [StarDemoAuthModal.tsx:34](../src/modules/stars/components/StarDemoAuthModal.tsx), [StellarHibernationModal.tsx:35](../src/modules/stars/components/StellarHibernationModal.tsx)
  - [MicroSystemCanvas.tsx:143,642](../src/modules/stars/canvas/MicroSystemCanvas.tsx) (bunlar fonksiyon içinde, ama render'da tek seferlik okunuyor olabilir, kontrol et)
  - [storyShare.ts:38](../src/lib/storyShare.ts) (hikâye paylaşımı: çıktı boyutu ekrandan bağımsız kalmalı)
- Pencere/safe-area okuyan toplam 72 dosya (178 geçiş).
- Uygulama ayarları: [app.json](../app.json) `orientation: portrait`, `ios.supportsTablet: false`, `userInterfaceStyle: dark`. `expo-build-properties` yalnızca Android bölümü tanımlı.
- Bilgi grafı, ekran envanteri ve ayrıntılı etki analizi yeni oturumda yapılacak.

## 8. Çözülmemiş sorular (yeni oturum doğrulamalı)

1. Gerçek Duo safe-area, durum çubuğu ve köşe değerleri. Duo'lu biri veya TestFlight olmadan kesinleşmez.
2. Dikey kilitli iPhone uygulamasının iç ekranda gerçek davranışı (yönelim çelişkisi).
3. Özel (JS) tab bar'ın 27.1 SDK'da nasıl göründüğü ([src/app/(tabs)/_layout.tsx](../src/app/(tabs)/_layout.tsx) ve [src/app/menu.tsx](../src/app/menu.tsx) neyi kullanıyor?).
4. SDK 57 + `enableSceneSupport` + Xcode 27.1 görüntüsüyle **sıradan iPhone'da** regresyon çıkıyor mu (derin bağlantılar, bildirimler, reklam, widget, Apple girişi).
5. Android: dp ölçüleri, `configChanges`, katlama sırasında durum kaybı.
6. Nisan 2027 ekran görüntüsü şartının tam kapsamı.

---

# 9. Ek araştırma (topluluk, blog, GitHub, haber siteleri, Android) — 2026-11-09

Reddit, Stack Overflow, Google ve DuckDuckGo okunamadı (engel/bot koruması). Bu bölümdeki bilgiler Expo'nun kendi blogu, GitHub issue'ları, MacRumors/9to5Mac ve Android/Samsung dokümanlarından. Aşağıda kod değişikliği gerektiren kararlar için **bu bölüm §4'teki "SDK 58 zorunlu değil" ifadesini nüanslıyor.**

## 9.1 Expo'nun resmi Duo rehberi (en önemli kaynak)

"Supporting iPhone Duo with Expo: a developer guide" (23 Ekim 2026): https://expo.dev/blog/supporting-iphone-duo [KESİN, Expo'nun kendi yazısı]

- Rehber **Expo SDK 58 + Xcode 27.1** varsayıyor. EAS'ta `sdk-58` veya `latest` image.
- **Duo'da yan "rail" şeridi: 84 pt, sol veya sağ inset olarak gelir.** `useWindowDimensions` render anında okunmalı (state'e kopyalanmış değer, pencere büyüyünce bayatlar).
- Kaydırmalı sayfalarda içeride `<SafeAreaView edges={['left','right']}>`. Yüzen öğeler `right: insets.right + 16` olmalı, sabit `right: 16` değil. `contentInsetAdjustmentBehavior="automatic"` için RN PR #59194 hâlâ açık.
- `useVerticalBarEdgeIOS()` Duo algılayıcısı DEĞİL (açık dikeyde `null`).
- **Özel (JS) başlık ve tab bar "klasik" çizilir**, sistem uyarlaması almaz; açık dikeyde "büyük boş üst inset" oluşabilir. Bizde bu geçerli: [src/app/(tabs)/_layout.tsx](../src/app/(tabs)/_layout.tsx) `CustomTabBar` kullanıyor, tüm Stack'ler `headerShown: false`, başlıklar özel (`ScreenHeader`, `useRealTopInset`).
- Duo simülatöründe StandBy ve çoğu uygulama uzantısı yok (Xcode 27.1 notları) → widget ve paylaşım uzantısı **gerçek cihazda** test edilmeli. Bizde expo-widgets var.
- Scene geçişi rehberi: https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md → `prebuild` SceneDelegate ve manifest'i üretir; sorun listesi: manifest eksikse siyah ekran, **soğuk açılışta `Linking.getInitialURL()` null** (erken SDK 58 build'lerinde, expo/expo#47628'de düzeltilmiş), AppDelegate de URL iletirse **çift URL olayı**; doğrudan `UIApplicationDelegate` kancaları artık çalışmaz (bunu kullanan kütüphaneler scene eşdeğeri ister); uzantılarda `ExpoAppSceneDelegate` kullanılmaz. SDK 57 + `enableSceneSupport` yolu da var.

## 9.2 Gerçek dünyadan raporlar (GitHub, ikincil)

- **Dış ekran ölçüsü doğrulandı: 466×678 pt** (iOS 27.1 simülatörü, iki bağımsız kaynak: dadanisme/nouveau #38, flutter/flutter #195401).
- **İç ekran:** flutter #195401 "951×669" diyor (birim belirtilmemiş, tek kaynak). Bu 626×890'ın yatay hâli olmayabilir (başka mod/rail?). **Çelişkili, gerçek cihaz/simülatör ölçümü şart.** Her halde iç ekran **yatay (genişlik > yükseklik)** olabilir: düzen her en-boy oranında çalışmalı.
- nouveau #38: dış ekranda bir alt sayfa ~757 pt oluyor (ekran 678 pt), sistem saati başlık butonlarını kapatıyor, bir tutar bileşeni görünmüyor. **Ders: 678 pt yükseklik modallar/bottom sheet'ler için sıkı.**
- zooniverse/mobile #937: scene geçişinden sonra dış ekranda durum çubuğu gezinmeyle çakışıyor; `UIRequiresFullScreen` + yalnız dikey uygulama iç ekranda yatayda siyah kenar gösteriyor.
- TeamPiKi/client #789: iOS 26 SDK ile derlenmiş uygulama iç ekranda ortada dar pencere + siyah yanlar. Çözüm planı SDK 58 + sol/sağ safe-area.
- Dioxus #5853: iOS 27 SDK ile derlenip scene'e geçmeyen uygulama **gerçek iPhone 13 Pro'da açılışta öldürülüyor** ("UIScene life cycle is required"). **Yani SDK değişikliği sıradan telefonları etkiliyor.**
- Flutter #195401: iç ekran açıkken soğuk açılışta boş ekran (motor zamanlaması). RN karşılığı belirsiz, ama **"açıkken soğuk açılış" testi şart.**
- Apple DTS forum özeti (thread 847644): ekran geçişleri scene kopması değil, trait/size-class değişimi; süreç sürer, metin girişi/kaydırma çoğunlukla korunur; Stage Manager yok; pencere boyutu isteyecek API yok.
- Reklam SDK'sı ile ilgili hiçbir rapor bulunamadı.

## 9.3 Gerçek uygulamalar nasıl yapmış (MacRumors, 9to5Mac)

- Apple "100.000+ uygulama Duo için hazır" diyor (doğrulanmadı). Rozet: "Made for iPhone Duo".
- **Google Maps:** iç ekranda harita tam ekran, sol panelde sekmeler, sağda harita kontrolleri. Önceki sürümde durum çubuğu yerinde dikey siyah şerit vardı. **Zoom/Webex:** paylaşılan içerik bir yanda, katılımcılar diğer yanda. **Word/Excel/PowerPoint:** tam ekran + dikey araç çubukları. **Teams, Google Docs/Sheets, Apple Store uygulaması, Duolingo, Venmo, bankalar:** güncellenmemiş (listelere göre).
- Tek sütunlu "liste + detay" iki panel düzeni indie uygulamalarda yaygın (Faro, Blankie, CalibReader). Menteşeyi özellik yapanlar var (BrainDrain, SPAN, Load Bearing).
- Kullanıcı yorumları (forum, doğrulanmamış): "siyah bantlar ve büyütülmüş pikseller yorucu", "uygulamaların çoğu hâlâ mini iPhone boyutunda siyah bantlı". **Ortalanmış kolon yaklaşımı ile gerçek uyarlanır düzeni karşılaştıran bir kaynak yok.** Yorumlar boş kenarlardan hoşlanılmadığını gösteriyor: bu, B'nin değerini destekler ama "kolon" yaklaşımının tam tersine kanıt da değil (eleştirilen iOS 26 SDK'daki sistem letterbox'ı, bizimki uygulama içinde koyu arka planla doldurulmuş kolon olacak).
- Çiftler/sosyal/flört/müzik uygulaması örneği bulunamadı.
- SDK eşiği haberlerde de tutarsız (27 mi 27.1 mi). Apple'ın kendi dediği: tam ekran için 27.1.

## 9.4 Expo yönlendirme/uyarlanır yapılar (SDK 58 dokümanları)

- **Expo Router SplitView** (`expo-router/unstable-split-view`): alpha, **yalnızca iOS**, iPhone'da tek sütuna çöker, Android/web'de düz `Slot`. Bizim ihtiyacımız için uygun değil.
- **`@expo/ui` ArrangementView / NavigationSplitView:** SwiftUI tabanlı, 27.1 ister, altı düz render. Bizim JS/NativeWind düzenimize uymaz.
- **`expo-device` `deviceType`** ekran köşegenine göre (Android: 3–6.9″ PHONE, 7–18″ TABLET), pencere boyutuna göre DEĞİL ve katlamada değişmez. **Kullanma, pencere genişliği kullan.**
- **`expo-hinge`**: yalnız menteşe açısı/durumu (SDK 58), yerleşim için değil.
- **Sonuç:** B için kendi duyarlı JS düzenimizi (genişlik eşikli) yazmak hem iOS hem Android'de çalışan tek yol. Sistem bileşenlerine yaslanan Expo API'leri iOS-only/27.1-only.
- **SDK 58 geçişinde mevcut telefonlarda görünüm değişme riskleri** (https://docs.expo.dev/router/migrate/sdk-57-to-58/): iOS 26+ Liquid Glass'ta `Stack` başlıkları varsayılan saydam. **Bizde tüm Stack'ler `headerShown: false` olduğu için bu risk büyük ölçüde yok** (doğrulanacak). Diğerleri: `Modal animated` prop'u kaldırıldı, `InteractionManager` kaldırıldı, Android R8 varsayılan açık, bildirim varsayılanları (ön planda bildirim gösterilir), strict TS, Node 22.13+. SDK 58'de ek yerlerde `SafeAreaView` gerekebilir.
- SDK 58 uyumluluk tablosunda Xcode 26.4+ yazıyor, "27.1" yazmıyor; image listesi güncel doğrulanmalı. SDK 58 "yayınlandı" (15 Ekim) ama "kararlı" ifadesi geçmiyor.

## 9.5 Android (ek)

- **Proje bulgusu:** [android/app/src/main/AndroidManifest.xml:42](../android/app/src/main/AndroidManifest.xml) `MainActivity` zaten `configChanges="keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode|smallestScreenSize|assetsPaths"` içeriyor → **katlayınca Activity yeniden oluşmaz** (iyi haber). Ama `android:screenOrientation="portrait"` da var; Android 16 + targetSdk 36'da ≥600 dp ekranda bu yok sayılır. (`android/` klasörü commit'li olduğu için prebuild ile bu manifest üretiliyor/ezilebilir: `npx expo prebuild` davranışı ve hangi dosyanın gerçek kaynak olduğu doğrulanmalı.)
- **Cihaz piksel ölçüleri (dp hâlâ doğrulanmadı):** Galaxy Z Fold 7 iç 8.0″ 2184×1968, dış 6.5″ 2520×1080; Z Flip 7 ana 6.9″ 2520×1080, dış 4.1″ 948×1048; Pixel 10 Pro Fold iç 8.0″ 2152×2076, dış 6.4″ 2364×1080. Yeni nesiller çıkmış: Fold 8 (7.6″ 1828×2448), Fold 8 Ultra (8.0″ 2256×2504). Kaynak: Wikipedia, https://developer.samsung.com/galaxy-emulator-skin/galaxy-z.html. **Gerçek dp'yi uygulama içinde `Dimensions.get('screen')` / emülatörden oku.**
- RN dokümanı: `Dimensions` değerleri "katlanabilirlerde değişebilir", `useWindowDimensions` tercih edilen API.
- Dış ekran dp'si 600'ün altında → mevcut telefon düzeni; Flip dış ekranı (948×1048 px) çok küçük/kare olabilir, ayrıca test edilmeli.
- Emülatör: Samsung Galaxy Emulator Skin'leri (yalnız görünüm), Android Studio donanım profili ile tablet boyutlu profil oluşturup Medium/Expanded test edilebilir; Espresso Device (alfa) `setDisplaySize()`. Android Studio'da "katlama" düğmesi/`adb` posture komutları bu aramada doğrulanamadı.
- Ek Android 16 notu: kenardan kenara zorunlu, öngörülü geri varsayılan açık.

## 9.6 Mac'siz test seçenekleri

- **EAS Simulator**: "sınırlı erişim önizlemesi, seçili ortaklara", bekleme listesi, Duo'dan söz edilmiyor, fiyat yok. Windows/Linux'ta iOS simülatörü sunduğunu söylüyor.
- **expo-device-hub**: Duo menteşe 3D modeli var ama iOS simülatörü için macOS + Xcode gerekiyor. Windows'tan tarayıcıyla bir Mac'e bağlanma kurgulanabilir (Mac kiralama gerekir, satıcılar doğrulanmadı).
- BrowserStack/Sauce/AWS Device Farm/Appetize'ın Duo desteği doğrulanamadı.
- **Gerçekçi yol:** (1) geliştirme build'inde sahte pencere boyutu (466×678, 626×890, 951×669) telefonumuzda ve Android emülatörde, (2) EAS ile TestFlight build'i Duo'su olan bir kişiye, (3) Mac kiralama.

## 9.7 "Mevcut telefonlar bozulmadı"yı kanıtlama araçları

- Expo: arayüz için snapshot yerine E2E (Maestro) öneriyor. Windows'ta Maestro **Android emülatöründe** çalışır: **önce/sonra ekran görüntüsü karşılaştırması** (telefon profilleri) en güçlü kanıt.
- `jest-expo` SDK 58'de Jest 30 ister; `react-test-renderer` kullanımdan kalkmış, **`@testing-library/react-native`** kullan. Çözülmüş stil JSON'unu (`toJSON()`) telefon genişliklerinde snapshot'la: stil prop farkları git diff'inde görünür. (Piksel kanıtı değil, yalnızca stil kanıtı.)
- Expo Router testi: `renderRouter` (`@testing-library/react-native` ≥ 14).
- Mevcut projede bu araçların kurulu olup olmadığı kontrol edilecek (`package.json` devDependencies).

## 9.8 Planı değiştiren sonuçlar

1. **Yol seçimi:** Expo'nun resmi rehberi SDK 58'i varsayıyor. SDK 57 + `enableSceneSupport` + Xcode 27.1 image'ı belgelenmiş ama Duo için "resmi rehberli" değil. İkisini de karşılaştırıp bana raporla: SDK 58, projedeki özel `headerShown:false`/custom tab bar yapısı sayesinde Liquid Glass başlık riskinden büyük ölçüde etkilenmiyor olabilir; ama R8, bildirim varsayılanı, Modal prop'u, 11 kütüphanenin uyumu, Node sürümü gibi ayrı riskler var.
2. **Özel JS başlık ve tab bar** sistem uyarlamasını almayacak: sağ/sol rail (84 pt) ve boş üst inset'i **bizim kodumuz** yönetecek. Bu, düzeltmenin merkezi.
3. **İç ekran yatay da olabilir (951×669?)**, düzen genişlik > yükseklik durumunda da çalışmalı.
4. **678 pt yükseklik** (dış ekran) modal/bottom sheet/klavye/tur için sıkı. Ayrı test.
5. **Soğuk açılış (açık/kapalı), derin bağlantı, bildirim tıklaması, widget** scene geçişinde risk listesi.
6. **Android:** Activity yeniden oluşturma sorunu yok (configChanges var), asıl iş portrait kilidinin Android 16'da yok sayılması.
7. **Test kanıtı:** Android emülatörde Maestro önce/sonra ekran görüntüsü + jest stil snapshot.
