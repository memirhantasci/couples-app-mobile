# 🧩 Ana Ekran & Kilit Ekranı Widget'ı

## Kararlar
- **Tamamı Premium:** ücretsiz kullanıcıda widget "Premium üyelere özel 👑" kilit görünümünü gösterir (tıklayınca `/paywall`).
  Premium bitiş zamanı (`premiumUntilMs`) payload'da taşınır; uygulama açılmasa bile widget o anda kendini kilitler
  (iOS: timeline kaydı, Android: alarm + her çizimde kontrol).
- **İçerik:** gün sayacı + çift fotoğrafları + partnerin (bugünkü) ruh hali + sıradaki dönüm noktası
  (yıl dönümü ya da 100'ün katı gün, hangisi yakınsa). Özel günlük notu widget'a GİTMEZ (gizlilik).
- Gün sayısı ve dönüm noktası **widget içinde hesaplanır** (`startDate`'ten): uygulama günlerce açılmasa da doğru kalır.
- Çıkış/oturum bitişi → widget temizlenir (`signedOut` + fotoğraf dosyaları silinir). Demo modunda widget'a veri gitmez.
- `expo-widgets`'in deneysel Android modu (`enableAndroid`, Glance) KAPALI; kendi plugin'imiz kullanılıyor.

## Tasarım (iki platformda aynı)
Gece moru degrade zemin (`#3F1240 → #1F0B2A → #120818`), sağ üstte gül rengi (`#FF5C8A`), sol altta mor ışıltı;
beyaz halkalı, üst üste binen iki fotoğraf ve ortalarında kalp rozeti; büyük yuvarlak hatlı sayaç + "gün";
yarı saydam kapsül kartlarda ruh hali ve dönüm noktası. Fotoğraf yoksa gül→mor degrade dairede baş harf.

| Boyut | iOS | Android |
| --- | --- | --- |
| Küçük | `systemSmall` | 2x2 (`couple_widget_small.xml`) |
| Orta | `systemMedium` | 4x2 (`couple_widget.xml`, ilk yerleşim) |
| Büyük | `systemLarge` | 4x3+ (`couple_widget_large.xml`) |
| Kilit ekranı | `accessoryCircular` / `Rectangular` / `Inline` (tek renk, sistem tonu) | kilit ekranı widget alanında yukarıdaki yerleşimler |

- iOS: `contentMarginsDisabled` açık (degrade kenara kadar uzanır, iç boşluk widget'ta verilir). Renkli olmayan
  modlarda (tinted ana ekran, StandBy gece) degrade çizilmez, sistem tonuyla çizilir; fotoğraflar tam renkli kalır.
  `uiImage` için `resizable()` + `aspectRatio(fill)` şart: aksi halde fotoğraf doğal boyutunda kırpılıyordu.
- Android 12+: üç yerleşim `RemoteViews(Map<SizeF, RemoteViews>)` ile verilir; başlatıcı / kilit ekranı gerçek boyuta
  göre seçer. Eski sürümlerde `OPTION_APPWIDGET_*` ölçülerinden seçilir. Köşe yarıçapı Android 12+'da sistemin değeridir.

## Kilit ekranı
- **iOS 16+:** kilit ekranını düzenle → widget ekle → "Aşkımızın Yolculuğu" (daire, dikdörtgen, satır).
- **Android:** `widgetCategory="home_screen|keyguard"`.
  - Android 16 QPR1 sonrası AOSP kilit ekranı widget alanı (Pixel ve bu özelliği açan üreticiler) ve tabletlerdeki
    widget merkezi tüm widget'ları kabul eder; `not_keyguard` kullanılmadığı için widget orada listelenir.
  - `keyguard` kategorisine bakan eski / üretici kilit ekranlarında da eklenebilir.
  - **Samsung One UI'nin kendi kilit ekranı yalnızca Samsung'un widget'larını kabul eder**; orada hiçbir üçüncü taraf
    uygulama widget koyamaz (Good Lock › LockStar gibi Samsung araçları hariç). Bu bir sistem sınırıdır.
  - Kilit ekranında dokununca cihaz kilidi açıldıktan sonra uygulama açılır (aktivite `showWhenLocked` değildir).

## Mimari
- **Sözleşme:** `CoupleWidgetPayload` → `src/utils/widgetBridge.ts` (iOS `widgets/CoupleWidget.tsx` ve Android
  `plugins/android-widget/CoupleWidgetProvider.kt` aynı alanları okur — birini değiştirirsen üçünü de güncelle).
- **Akış:** `home.tsx` effect → `syncCoupleWidget()` → avatarları indir (iOS: App Group `widgetsDirectory`,
  Android: `Paths.document/widget`) → iOS `updateTimeline` (30 gece yarısı) / Android `CoupleWidgetModule.updateWidget`
  (SharedPreferences + yenileme).
- **Android plugin:** `plugins/withAndroidWidget.js` → `plugins/android-widget/*.kt` + `res/**` kopyalar, manifest'e
  receiver, `MainApplication.kt`'ye `CoupleWidgetPackage()` ekler. Üç yerleşimdeki view kimlikleri ortaktır
  (Kotlin hepsine yazar; RemoteViews'da eksik kimlik widget'ı "yüklenemedi"ye düşürür).

## Telefonda test listesi
**Hazırlık:** yeni development build (native kod değişti), Premium hesap, eşleşmiş çift, profil fotoğrafları yüklü,
ana sayfayı bir kez aç (widget ilk veriyi buradan alır).
- [ ] Android ana ekran: 2x2, 4x2 ve 4x3'e boyutlandırınca küçük/orta/büyük yerleşim geliyor, taşma yok.
- [ ] Android kilit ekranı (Android 16 QPR1+ Pixel ya da tablet widget merkezi): widget listede, eklenince büyük yerleşim.
- [ ] iOS: küçük/orta/büyük ve kilit ekranı (daire/dikdörtgen/satır) doğru; tinted ana ekranda okunaklı.
- [ ] Fotoğraflar dairenin içinde tam görünüyor (aşırı yakınlaştırılmış değil); fotoğraf yoksa baş harf.
- [ ] Widget'a dokun → uygulama ana sayfada açılıyor; kilitliyken paywall.
- [ ] Partner ruh halini değiştirince (ana sayfayı yenileyince) kartta güncelleniyor; ertesi gün kayboluyor.
- [ ] Yıl dönümüne yakın bir başlangıç tarihiyle "🎂 N. yıl dönümüne X gün", 100'ün katı günde "🎉 Bugün ... gününüz".
- [ ] Uygulamayı kapat, telefonun tarihini 1 gün ileri al → gün sayısı +1 (uygulama açılmadan).
- [ ] Ücretsiz hesap / Premium bitmiş: "Premium üyelere özel 👑"; çıkış yapınca "Couples App · giriş yap".
- [ ] Release/preview build'de (R8/minify) Android widget hâlâ çalışıyor.

## Bilinen sınırlamalar
- Partner ruh hali, yalnızca ana sayfa verisi yenilendiğinde widget'a iletilir.
- Android'de alarm hassas değildir (Doze'da gecikebilir); `updatePeriodMillis` (1 saat) ve tarih değişim yayınları yedektir.
- iOS timeline 30 gün ileriyi kapsar; uygulama 30+ gün açılmazsa widget son kayıtta kalır.
- Windows'ta, yolunda Türkçe karakter (ör. `çift`) bulunan klasörden yerel Gradle derlemesi başarısız olur
  (node çıktısı yanlış kod sayfasıyla okunur); EAS build etkilenmez. Yerel derleme için ASCII bir yol kullanın.
