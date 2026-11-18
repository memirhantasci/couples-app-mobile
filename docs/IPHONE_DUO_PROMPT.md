# Görev: CoupleSky'ı iPhone Duo (katlanabilir iPhone) ve Android katlanabilirlere uyumlu yap

Model/efor önerisi: Opus 5.5, high efor. Mekanik ekran düzenlemeleri Sonnet 5.5 alt ajanlarına verilebilir, her diff'i sen incele.

Önce `docs/IPHONE_DUO_ARASTIRMA.md` dosyasını tamamen oku. Orada kaynaklı araştırma ve her bilginin güvenilirlik etiketi var ([KESİN], [3. TARAF], [ÇIKARIM], [BİLİNMİYOR]). Etiketi [BİLİNMİYOR]/[ÇIKARIM] olanı gerçek gibi kullanma, önce doğrula.

## Mutlak kurallar (her şeyden önce)

1. **Mevcut telefonlardaki arayüz KESİNLİKLE ve KESİNLİKLE bozulmamalı.** Her iPhone (SE'den Pro Max'e, Ekran Büyütme dahil) ve her Android telefon bugünkü tasarımı piksel piksel aynı görür: boşluk, animasyon, davranış. Yeni tasarım YALNIZCA geniş pencerede (aşağıda tanım) devreye girer.
2. Çalışma yeni dalda: `git switch -c iphone-duo-uyumu` (main'den). `supabase/fix_photos_couple_165.sql` ve `supabase/seed_marketing_en_couple_165.sql` takip edilmeyen dosyalar, dokunma, commit'leme. `docs/IPHONE_DUO_ARASTIRMA.md` ve bu dosya da takip edilmiyor, istersem commit ederiz.
3. **Push, main'e merge, OTA yayını, production build, mağaza gönderimi bana sormadan YAPILMAZ.** OTA JS değişikliklerini bütün telefonlara anında dağıtır, bu iş için OTA kullanma. Native değişiklik OTA ile zaten gitmez.
4. Kart animasyonu tercihlerime dokunma (ekran başına tek seferlik giriş, ana sayfa ilk kurulumda sessiz). Metin/çeviri (locales) değiştirme.
5. Expo sürümlü dokümanı kodlamadan önce oku: https://docs.expo.dev/versions/v57.0.0/ (AGENTS.md kuralı). Kod soruları için önce AST grafına bak: `py -m graphify query "<soru>" --graph graphify-out/graph.json --budget 1500`. Sonuçları kaynak dosyada doğrula. `docs/OZELLIKLER.md`'yi oku, iş bitince güncelle.
6. Ben Windows'tayım: Xcode/iOS simülatörü yok. iOS native build EAS bulutunda, test TestFlight/gerçek cihazla. Android emülatör Windows'ta çalışır.
7. Türkçe konuş. Belirsizlikte DUR ve sor, tahminle ilerleme.

## Kapsam ve "geniş pencere" tanımı

- **Geniş** = pencere genişliği ≥ ~600 pt/dp (kesin eşiği Aşama 2'de doğrulayıp bana göster). iPhone Duo iç ekran ≈ 626 pt, Android genişlik sınıfı Medium 600 dp'de başlar.
- **Dar (mevcut yol)** = bunun altı: tüm iPhone'lar (en geniş 440 pt), Android telefonlar, **Duo'nun dış ekranı (≈466×678 pt, Apple'a göre compact genişlik)**, katlanabilir Android'lerin kapalı dış ekranı. Eşik, 466 ile 626 arasında kalmalı. Eski "440 üstü geniş" kuralı YANLIŞTIR çünkü dış ekranı geniş sayar.
- Android tabletler ve büyük pencereler de geniş sayılır (aynı kural), Android telefonlar hiç etkilenmez. Bu bilinçli bir karar, bana göster.
- Sınıflandırma SAF bir fonksiyon olacak (`getLayoutClass(width, height)`), Jest ile test edilecek: 320x568, 375x667, 375x812, 390x844, 393x852, 402x874, 414x896, 430x932, 440x956, 466x678 (Duo dış) -> hepsi 'compact'; 626x890 (Duo iç) ve ≥600 genişlikler 'wide'.

## Aşama 0: Hazırlık

Dalı aç, ilgili dosyaları oku. Çalışma planını bana 10 satırda özetle. Aşağıdaki sıra: önce build yolu (çünkü siyah bantlar SDK'dan gelir), sonra düzen.

## Aşama 1: Build yolu (en riskli kısım, çünkü bu build TÜM iPhone'lara gider)

Araştırma özeti: Siyah bantlar tasarımdan değil, uygulamanın iOS 27.1 SDK (Xcode 27.1) ile derlenmemesinden. iOS 27 SDK UIScene yaşam döngüsünü zorunlu kılar, yoksa uygulama açılışta çöker. RN 0.86.3'te SceneDelegate yok.

Yapılacak, sırayla, her adımdan sonra bana rapor:

1. Mevcut durumu doğrula: `eas.json`'da `image` yok, `ios/` klasörü yok (CNG), AppDelegate özelleştirmesi yok. Güncel EAS image listesini https://docs.expo.dev/build-reference/infrastructure/ sayfasından oku (Xcode 27.1 / 27.2 image adı değişmiş olabilir).
2. **İki yolu karşılaştır, bana gerekçeli rapor ver, ben seçeceğim** (araştırma §4 ve §9.1, §9.4):
   - **Yol A: SDK 57 kalır.** `expo-build-properties` içine `ios: { enableSceneSupport: true }` (expo ≥ 57.0.23, bizde 57.0.31) + Xcode 27.1 image'ı. Belgelenmiş ama Expo'nun resmi Duo rehberi bu yolu varsaymıyor, kanıtı zayıf.
   - **Yol B: Expo SDK 58 (RN 0.88).** Expo'nun resmi Duo rehberinin (https://expo.dev/blog/supporting-iphone-duo) varsaydığı yol, scene desteği yerleşik. Ama büyük yükseltme: https://docs.expo.dev/router/migrate/sdk-57-to-58/ listesini bizim koda karşı tara (Modal `animated` prop'u, `InteractionManager`, Android R8, ön planda bildirim varsayılanı, strict TS, Node 22.13+, 11+ kütüphane uyumu). Bizde tüm Stack'ler `headerShown:false` ve özel başlık/tab bar var, bu yüzden Liquid Glass saydam başlık riski büyük ölçüde yok olabilir; doğrula.
   Her iki yol için ayrı `eas.json` profili aç (örn. `duo-preview`, `distribution: internal`, kanal `preview`, `image` güncel listeden), production profiline DOKUNMA. `npx expo-doctor` ve `npx expo prebuild --platform ios --no-install` ile yapılandırmayı Windows'ta doğrula. Hiçbir yükseltmeyi kendiliğinden yapma.
3. Kütüphane uyumu (araştırma §5): `npx expo install --check` ile SDK 57'nin istediği aralıkları gör. Özellikle: react-native-reanimated (4.7.1'de UIScene `useAnimatedKeyboard` çökme düzeltmesi), react-native-screens (≥4.30.1'de Duo tab bar düzeltmesi), react-native-safe-area-context (5.11.x), react-native-google-mobile-ads (17.3.0 scene-güvenli ama 17.x kırıcı: Yeni Mimari şart, kullanımı bizde reklam akışını etkiler). **Her yükseltmeyi ayrı ayrı yap ve neden gerektiğini yaz. Expo'nun sabitlediği aralığı aşan yükseltmeden önce bana sor.** Reanimated 4.7'nin layout-animation motoru değişikliği animasyonları etkileyebilir, dikkat.
4. `duo-preview` build'i hazır olduğunda DUR ve bana bildir: ben EAS'ta çalıştıracağım. Doğrulanacak (gerçek telefonumda): açılış, giriş, derin bağlantılar (soğuk açılış `Linking.getInitialURL()` null olabiliyor, çift URL olayı olabiliyor), bildirim tıklaması (uygulama açıkken ve kapalıyken), reklam, widget, Apple girişi, klavye, tüm sekmeler, animasyonlar. Bu doğrulama olmadan düzen işine (Aşama 4+) yayın hedefiyle geçilmez.
5. Reklam kütüphanesi (react-native-google-mobile-ads; 17.3.0 scene-güvenli ama kırıcı sürüm), bildirim, derin bağlantı ve expo-widgets scene yaşam döngüsünde değişebilir: bunları özellikle listele. Uzantılarda (widget) `ExpoAppSceneDelegate` kullanılmaz. Duo simülatöründe uzantılar çalışmaz, gerçek cihaz gerekir.
6. **Bu build bütün iPhone'lara gider.** iOS 27 SDK ile derlenip scene'e geçmeyen uygulamalar sıradan iPhone'larda açılışta öldürülüyor (Dioxus #5853). Bu yüzden kanıt: gerçek telefonumda preview build'in sorunsuz çalışması.

## Aşama 2: Regresyon güvenlik ağı ve taban

- Mevcut `npx tsc --noEmit`, `npx eslint .`, `npx jest` sonuçlarını baz olarak kaydet. Her aşamadan sonra yeni hata olmamalı.
- **Kanıt araçları (araştırma §9.7):** (1) Android emülatörde (Windows'ta çalışır) Maestro ile kilit ekranların telefon profillerindeki "önce" ekran görüntülerini al, her aşamadan sonra "sonra" ile karşılaştır. (2) `jest-expo` (SDK'nın Jest sürümüne uygun) + `@testing-library/react-native` ile ana ekranların çözülmüş stil JSON'unu (`toJSON()`) telefon genişliklerinde (390, 430, 440) snapshot'la; diff'te stil farkı görünmemeli. `react-test-renderer` kullanma (kullanımdan kalkmış). package.json'da hangileri kurulu, kontrol et, eksik olan kurulumu bana bildir.
- `src/lib/layout.ts` (saf `getLayoutClass`, eşik sabitleri) ve testleri. Eşiği ve gerekçesini bana göster.
- **Boyut kaynağı:** `useWindowDimensions` üstünde bir hook (`useLayoutClass`) yaz, ama boyutu kökte bir bağlamdan da besleyebilir yapıda kur: geliştirmede sahte pencere boyutunu verebilmek için. `__DEV__`'de çalışan, yayın build'inde bulunmayan "geniş yerleşimi zorla / sahte boyut" anahtarı ekle (örn. 466×678 ve 626×890 ön ayarları). Amaç: Duo'm yokken telefonumda ve Android emülatörde yeni düzeni görebilmek. Anahtar yayında kullanıcıya hiçbir etki yapmamalı.
- Diff disiplini: ekran dosyalarındaki her değişiklikte DAR yolun değeri aynen korunur (`style={[eski, wide && yeni]}` veya `wide ? yeni : eski`). Dar yolda ekstra `View` sarmalayıcı, hook sırası değişikliği, yeni state, `key` değişikliği YASAK. Sarmalayıcı bileşen dar yolda `children`'ı olduğu gibi döndürür. Ortak bileşeni yerinde değiştirme, geniş ekran için ayrı bileşen/dal ekle. Ortak sabit/stil değiştirme, geniş için ayrı değer ekle.

## Aşama 3: Salt-okunur envanter (kod yok)

`docs/IPHONE_DUO_UYUMU.md` içinde risk tablosu (dosya, ne yapıyor, risk, çözüm). Mutlaka bak:
- Modül seviyesinde `Dimensions.get`: MapPhotoLightbox.tsx:22, PhotoGrid3Cell.tsx:7, PhotoGrid2Cell.tsx:10, ExoplanetModal.tsx:85, HomeRadarOverlay.tsx:21, OurStarScreen.tsx:115, ClaimStarModal.tsx:105, StarDemoAuthModal.tsx:34, StellarHibernationModal.tsx:35, MicroSystemCanvas.tsx:143 ve 642, storyShare.ts:38. Katlayınca güncellenmez. Dar yolda aynı değeri üreten hook'a çevir.
- `useWindowDimensions`, `useSafeAreaInsets`, `useRealTopInset`: **sol/sağ inset'ler simetrik varsayılmasın.** Expo'ya göre Duo'da yan "rail" 84 pt'lik sol veya sağ inset olarak gelir. Kalıplar: `paddingHorizontal: insets.left`, yüzen öğede sabit `right: 16` (olması gereken `right: insets.right + 16`), kaydırmalı sayfa içinde `<SafeAreaView edges={['left','right']}>`. Pencere boyutu state'e kopyalanmasın, render anında okunsun (toast gibi sonradan açılan bileşenlerde bayatlar).
- **Özel başlık ve sekme çubuğu:** `src/app/(tabs)/_layout.tsx` içinde `CustomTabBar` var ve tüm Stack'ler `headerShown:false`; başlıklar özel (`ScreenHeader`, `useRealTopInset`). Expo'ya göre özel JS çubukları sistem uyarlamasını ALMAZ ve açık dikeyde "büyük boş üst inset" oluşabilir. Rail ve boş inset'i bizim kodumuz yönetecek: bunun envanterini ve çözümünü çıkar. Bu geniş yolun merkezi işi, dar yol aynen kalmalı.
- Skia tuvalleri (src/modules/stars/canvas/*, OurStarScreen, MicroSystemCanvas, HomeRadarOverlay, src/modules/sky/flow/* gece gökyüzü posteri), harita ekranları, fotoğraf ızgaraları, mektup modalleri, SpotlightTour/PageTourModal, auth ve kurulum ekranları (klavye), LaunchAnimation, ConfettiRainHost, DialogHost, ToastHost, OfflineBanner, DateTimePickerSheet, lightbox'lar.
- Paylaşım/dışa aktarım (storyShare.ts, StorySharePreview, PrintSharePreview, CoupleWrappedModal): çıktı boyutu ekrandan BAĞIMSIZ kalmalı.
- Ters çevrilmiş (inverted) FlatList kullanımı (react-native#59731 iOS 27'de sorunlu).
- Widget'lar ve Android widget plugin'i: etkilenmemeli, doğrula.
- Yönelim: `orientation: portrait` iOS 27'de ve Android 16 (targetSdk 36, ≥600 dp) iç ekranda geçerli olmayabilir. Düzen dikey, yatay ve her en-boy oranında çalışmalı (wide yolda). Dar yol telefonda hâlâ dikey kilitli.

## Aşama 4: Taban uyum (Seçenek A, güvenli ilk kilometre taşı)

Amaç: Duo'nun iç ekranında, dış ekranında (466×678) ve Android katlanabilirde uygulama bozulmasın, taşmasın, gerilmesin.
- Geniş yolda içerik ortalanmış, makul genişlikte (maxWidth) bir kolonda durur, kenarlar uygulamanın koyu arka plan rengiyle dolar. Dar yolda hiçbir şey değişmez.
- **İç ekran yatay olabilir:** bir kaynak iç ekranı 951×669 (birim belirsiz) bildiriyor, bu 626×890 ile çelişiyor. Gerçek değer bilinmiyor. Düzen genişlik > yükseklik ve her en-boy oranında çalışmalı. Sahte boyut ön ayarlarına 951×669'u da ekle.
- **678 pt yükseklik sıkı:** başka bir uygulamada dış ekranda alt sayfa ~757 pt olup taştı, sistem saati başlık butonlarını kapattı. Tüm modal/bottom sheet/klavye/tur/lightbox'ları 466×678'de dene.
- **Dış ekran (466×678, 'compact')**: eski düzen kullanılır, ama bugünkü hiçbir telefonun şekli bu değil (daha geniş ve çok daha kısa). Sahte boyutla test et: taşma, kesilen buton, sıkışan sekme çubuğu, klavye. Gerekiyorsa SADECE bu boyutlara özel (örn. yükseklik < 700 pt ve genişlik > 440 pt) güvenli düzeltme ekle ve bunun gerçek telefonlarda (genişlik ≤ 440) tetiklenmediğini test et.
- Modül seviyesi `Dimensions.get` noktalarını düzelt, simetrik inset'leri düzelt, modal/tost/lightbox/tur konumlarını kontrol et.
- Katlama/açma geçişi: navigasyon durumu, form girdisi, açık modal, klavye, çalan animasyon kaybolmamalı; Reanimated shared value, Skia tuval boyutu ve harita bölgesi yeni boyuta uymalı.

## Aşama 5: Android katlanabilir

- `android/app/src/main/AndroidManifest.xml:42`: MainActivity'de `configChanges` ZATEN `screenSize|smallestScreenSize|screenLayout|orientation|...` içeriyor (katlayınca Activity yeniden oluşmaz, iyi). Ama `android:screenOrientation="portrait"` de var; Android 16 + targetSdk 36'da ≥600 dp ekranda yok sayılır. `android/` klasörü commit'li: prebuild bu dosyayı ezer mi, değişikliği nereye yapmalıyım (config plugin?), v57 dokümanından ve `plugins/withAndroidWidget.js`'ten bak, bana söyle.
- targetSdk 36 + Android 16: ≥600 dp ekranlarda yönelim/yeniden boyutlanma kısıtlamaları yok sayılır. Geçici opt-out özelliğini (`PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY`) çözüm olarak KULLANMA (API 37'de çalışmaz, Android önermiyor), bana yalnızca seçenek olarak yaz.
- Android Studio emülatörü (Pixel Fold ve resizable profiller): telefon profilleri bugünkü gibi görünmeli, katlanabilir profili dar -> geniş -> dar geçişte test et. Katlanabilir dp ölçülerini emülatörden oku ve araştırma dosyasına ekle.
- Android widget ve bildirimler etkilenmemeli.

## Aşama 6: Uyarlanır düzen (Seçenek B), her ekran için AYRI ONAYLA

Önce her aday ekran için bana kısa bir tasarım önerisi sun (geniş düzende ne değişecek, hangi dosyalar, risk, dar yolun neden bozulmayacağı) ve onay iste. Aday ekranlar (öneri): fotoğraflar (daha çok sütun), takvim ve anılar (liste + detay), mektuplar (liste + okuma), ana sayfa (iki sütun), yıldız gökyüzü (geniş tuval). Her biri ayrı commit, ayrı doğrulama (tsc + jest + 'dar telefon boyutları compact döner' testi + diff kontrolü). Ortak bileşeni yerinde değiştirme, geniş için ayrı bileşen yaz. Menteşe/katlama bölgesi için yerleşim API'si yok (Expo'da yok), düzeni genişlik eşiğiyle kur; `expo-hinge` (SDK 58) yalnızca etkileşim içindir. Expo Router SplitView (alfa, yalnızca iOS), `@expo/ui` ArrangementView (27.1+, SwiftUI) ve `expo-device deviceType` (köşegene göre, katlamada değişmez) KULLANMA: kendi duyarlı JS düzenimizi (genişlik eşikli) yaz, iOS ve Android'de aynı kodla çalışır. Gerçek örnekler (araştırma §9.3): Google Maps (sol panelde sekmeler, sağda harita), Zoom/Webex (içerik bir yanda, katılımcılar öbür yanda), "liste + detay" iki panel. Kullanıcılar siyah kenarlardan şikâyetçi: A tek başına yeterli değil, B değerli.

## Aşama 7: Doğrulama ve teslim

- tsc, eslint, jest temiz; `npx expo-doctor` temiz.
- Elle test listesi ver (gerçek telefonumda): giriş, ana sayfa, anılar, takvim, fotoğraflar, mektuplar, harita, yıldız gökyüzü, profil, paywall, tur, paylaşım, bildirim, derin bağlantı, reklam, widget.
- `/code-review high` çalıştır, bulguları düzelt.
- App Store Connect: Duo ekran görüntüsü boyutları (dış 1398×2034, iç 2007×2853, canlı sayfadan doğrula) ve "Duo için optimize" rozeti şartlarını bana listele. Nisan 2027 şartının tam kapsamını canlı sayfadan doğrula.
- `docs/IPHONE_DUO_UYUMU.md` (kararlar, envanter, sonuçlar) ve `docs/OZELLIKLER.md` güncel. Commit'ler küçük ve ayrı. Push/merge/OTA yok: durumu özetle, onayımı bekle.
