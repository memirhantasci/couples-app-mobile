# Couples App Mobile - Arayüz ve Fonksiyonel Geliştirme Dokümanı

Bu belge, uygulamadaki bildirilen hataları, arayüz aksaklıklarını ve talep edilen yeni özellikleri Claude'un en az araştırma token'ı harcayarak doğrudan çözüme odaklanabilmesi amacıyla hazırlanmıştır. 

> **Geliştirici Notu:** Bu dokümanda doğrudan kod yamaları veya "şunu şöyle yaz" talimatları yer almamaktadır. Her maddenin **mevcut durumu (sorun)**, **kullanıcı beklentisi** ve araştırmayı hızlandırmak için **derinlemesine mimari bağlamı (ilgili dosyalar, state'ler ve akışlar)** sunulmuştur. Çözüm mimarisini ve kod uygulamasını Claude kendisi tasarlamalıdır.

---

## 🟢 1. BÖLÜM: KOLAY İŞLER (Quick Wins)

---

### Görev 1.1: Galeri Tam Ekran Görünümünde (Lightbox) Silme Onay Uyarısının Arkada Kalması
* **Kategori:** Kolay / Bugfix
* **Mevcut Sorun:**
  Kullanıcı ortak galeride herhangi bir fotoğrafı büyüttüğünde (tam ekran Lightbox modalı açıldığında), sağ üstteki çöp kutusu (sil) butonuna bastığında silme onaylama uyarısı ekranda görünmemektedir. Kullanıcı fotoğrafı parmağıyla kaydırıp veya kapatıp tam ekrandan çıktığında (fotoğraf küçüldüğünde), arkada kalmış olan onay uyarısıyla karşılaşmaktadır.
* **Kullanıcı Beklentisi:**
  Fotoğraf tam ekran büyütülmüş haldeyken sil butonuna basıldığında, silme onay diyalog kartı fotoğrafın üzerinde doğrudan belirgin şekilde açılmalı; kullanıcı "Sil" veya "Vazgeç" dediğinde işlem fotoğraf kapanmadan anında yönetilebilmelidir.
* **Araştırma & Mimari Bağlam:**
  * **İlgili Dosyalar:**
    * [`src/components/photos/PhotoLightboxModal.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/components/photos/PhotoLightboxModal.tsx)
    * [`src/app/(tabs)/photos.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/app/(tabs)/photos.tsx)
    * [`src/lib/dialog.ts`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/lib/dialog.ts)
  * **İnceleme Notu:**
    Uygulama genelinde sistem `Alert.alert` yerine özel cam efektli diyaloglar (`appAlert` - `src/lib/dialog.ts`) kullanmaktadır. Bu diyaloglar kök katmandaki `<DialogHost />` (`src/app/_layout.tsx`) tarafından ekrana basılır. Ancak `PhotoLightboxModal`, React Native'in tam ekran yerel `<Modal>` bileşenini kullanmaktadır. React Native mimarisinde native modallar kök görünümdeki tüm elemanların üzerine çıktığı için, `appAlert` çağrıldığında diyalog kartı modalın fiziksel olarak arkasında (kök ekranda) kalmaktadır. `src/lib/dialog.ts` dosyasının ilk satırlarındaki dokümantasyon incelendiğinde, modal içi uyarılar için `<DialogHost embedded />` desteğinin tasarlandığı görülmektedir.

---

### Görev 1.2: Güneş Sistemi Cisimleri Tıklandığında Beyaz Modda Açıklama Metninin Okunamaması
* **Kategori:** Kolay / UI-Kontrast
* **Mevcut Sorun:**
  Gök kubbe ekranında Güneş Sistemi referans cisimlerine (Güneş, Venüs, Dünya, Mars vb.) tıklandığında ekranın altında beliren bilgi kartındaki altın/sarı renkli açıklama metni, uygulama beyaz (açık) moddayken açık arka plan üzerinde kaybolmakta ve hiçbir şekilde okunamamaktadır.
* **Kullanıcı Beklentisi:**
  Açık (beyaz) moddayken de koyu moddayken de Güneş Sistemi cisimlerine tıklandığında çıkan açıklama metninin zeminle kusursuz bir kontrasta sahip olması, rahatça ve net bir şekilde okunabilmesi.
* **Araştırma & Mimari Bağlam:**
  * **İlgili Dosya:**
    * [`src/modules/stars/components/OurStarScreen.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/modules/stars/components/OurStarScreen.tsx)
  * **İnceleme Notu:**
    `OurStarScreen.tsx` içerisinde Güneş Sistemi gök cisimleri `selectedMacroStar.catalog_code?.startsWith('SOL-')` bloğu ile kontrol edilmektedir. Metinler `SOLAR_DESCRIPTIONS` sözlüğünden çekilerek `solarObjectBanner` kapsayıcısı ve `solarObjectText` stiliyle çizilmektedir. Stil tanımları incelendiğinde `solarObjectText` renginin statik olarak `#FDE68A` (açık sarı/gold) verildiği ve `isLight` tema durumuna göre dinamik bir metin veya zemin rengi almadığı görülmektedir.

---

### Görev 1.3: Sayfa Geçişlerinde ve Ana Sayfaya Tıklamada Yaşanan Saliselik Beyaz Işık Patlaması (White Flash / Flicker)
* **Kategori:** Kolay / Navigasyon Performansı & Tema Bütünlüğü
* **Mevcut Sorun:**
  Alt gezinme çubuğundaki sekmeler arasında geçiş yaparken (özellikle Ana Sayfa sekmesine veya diğer sekmelere ilk tıklandığı anlarda) saliselik beyaz bir ışık patlaması / beyaz ekran parlaması yaşanmaktadır. Koyu temada gezinirken bu durum gözü ciddi şekilde rahatsız etmektedir.
* **Kullanıcı Beklentisi:**
  Sekmeler arası veya sayfalar arası geçişlerde hiçbir beyaz kare veya parlayış görünmemeli; geçiş anında uygulamanın aktif temasına ait zemin rengi kesintisiz korunmalıdır.
* **Araştırma & Mimari Bağlam:**
  * **İlgili Dosyalar:**
    * [`src/app/(tabs)/_layout.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/app/(tabs)/_layout.tsx)
    * [`src/app/_layout.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/app/_layout.tsx)
    * [`src/components/ui/ScreenBackground.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/components/ui/ScreenBackground.tsx)
  * **İnceleme Notu:**
    Expo Router ve React Navigation mimarisinde `<Tabs>` ve `<Stack>` bileşenlerinin varsayılan konteyner arka plan rengi native düzeyde saf beyazdır (`#FFFFFF`). `TabsLayout` (`src/app/(tabs)/_layout.tsx`) bileşeni incelendiğinde, sekmelerin `freezeOnBlur: true` ile dondurulduğu ve sekmeyi saran dış `View` ile `Tabs` bileşeninin `screenOptions` / `sceneStyle` (veya `contentStyle`) zemin renginin temaya (`theme.bg` / `theme.bgGradient`) bağlanmadığı tespit edilmiştir. Sekme unfreeze olurken veya ilk mount anında, sayfa içeriği henüz ilk pikselini çizmeden önce altındaki native beyaz konteyner saliselik olarak görünmektedir.

---

### Görev 1.4: Yıldızımız Ekranında "Kıvılcım" Teriminin ve Rozet Anlatımının Netleştirilmesi
* **Kategori:** Kolay / UX & Metin Düzenlemesi
* **Mevcut Sorun:**
  "Bizim Yıldızımız" ekranında yer alan sayaç şeridinde bir şimşek simgesi eşliğinde "KIVILCIM" yazmaktadır. Kullanıcılar bu ifadenin ne anlama geldiğini, neyi temsil ettiğini ve neden orada durduğunu anlayamamaktadır.
* **Kullanıcı Beklentisi:**
  Bu sayacın ne olduğunu kullanıcıya hissettiren, çift ilişkisine ve sevgi etkileşimine uygun, sıcak ve anlaşılır bir terminoloji (örneğin sevgi dokunuşları, aşk sinyalleri, kalp titreşimi vb.) ve açıklayıcı bir UX dokunuşu sunulması.
* **Araştırma & Mimari Bağlam:**
  * **İlgili Dosyalar:**
    * [`src/modules/stars/components/micro/MicroStarHeader.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/modules/stars/components/micro/MicroStarHeader.tsx)
    * [`src/modules/stars/services/StarSparkManager.ts`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/modules/stars/services/StarSparkManager.ts)
    * [`src/modules/stars/types/star.types.ts`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/modules/stars/types/star.types.ts)
  * **İnceleme Notu:**
    `MicroStarHeader.tsx` dosyasında `statStrip` bileşeni incelendiğinde; `IŞIK` (% parlaklık), `ANI` (yörüngedeki gezegen sayısı), `KIVILCIM` (`starDetails.total_sparks_count`) ve `GÜN` (yıldızın tescilinden beri geçen gün) gösterilmektedir. Arka plandaki `StarSparkManager.ts`, çiftlerin yıldıza dokunarak birbirlerine gönderdikleri canlı "Love Ping" rezonans sinyallerini yönetmektedir. Buradaki sayaç aslında bu anlık sevgi dokunuşlarının toplamıdır; ancak arayüzde sadece ham bir "KIVILCIM" etiketi olarak sunulmuştur.

---

### Görev 1.5: Widget Görünümünde İki Profil Fotoğrafı Arasındaki Kalp İkonunun Fotoğrafları Örtmesi
* **Kategori:** Kolay / Widget UI Düzeltmesi
* **Mevcut Sorun:**
  Kilit ekranı ve ana ekran widget'larında çiftin iki profil fotoğrafı yan yana birleştirilirken, tam birleşim noktalarının üzerine konulan beyaz çerçeveli kalp ikonu fotoğraflardaki yüzleri kapatmakta, estetik olmayan ve fotoğrafların görünmesini engelleyen bir yapı oluşturmaktadır.
* **Kullanıcı Beklentisi:**
  Profil fotoğraflarının yüzleri örtmeyecek şekilde temiz görünmesi; aradaki örtücü kalp rozetinin kaldırılması veya fotoğrafları kapatmayacak şık, minimalist bir halka/çift çerçevesi kurgulanması.
* **Araştırma & Mimari Bağlam:**
  * **İlgili Dosyalar:**
    * [`widgets/CoupleWidget.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/widgets/CoupleWidget.tsx) (iOS WidgetKit / Swift UI)
    * [`plugins/android-widget/CoupleWidgetProvider.kt`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/plugins/android-widget/CoupleWidgetProvider.kt) (Android RemoteViews)
  * **İnceleme Notu:**
    `widgets/CoupleWidget.tsx` dosyasındaki `couple` fonksiyonu incelendiğinde:
    İki avatar `HStack spacing={-overlap}` ile birbirine yaklaştırılmakta ve üzerine `ZStack` içinde `{heartBadge(Math.round(size * 0.42))}` yerleştirilmektedir. Bu `heartBadge`, avatarların tam göbeğine oturduğundan kullanıcıların yüz detaylarını doğrudan perdelemektedir.

---

## 🟡 2. BÖLÜM: ORTA İŞLER (Feature Polish & Consistency)

---

### Görev 2.1: Fotoğraf Galerisi ve Haritada Başkasının Yüklediği Fotoğrafı Partnerin Silememesi (Sahiplik Kuralı) [TAMAMLANDI ✅]
* **Kategori:** Orta / Yetkilendirme & Güvenlik
* **Mevcut Sorun:**
  Çiftlerden biri (X kişisi) galeriye veya haritaya bir fotoğraf yüklediğinde, diğer kişinin (Y kişisi) bu fotoğrafı silebilmesi istenmeyen bir durumdur. Şu an bazı ekranlarda (özellikle harita detay kartında ve silme fonksiyonlarının parametrik çağrılarında) silme aksiyonu partner için de tetiklenebilmektedir.
* **Kullanıcı Beklentisi:**
  X kişisi fotoğrafı yüklediyse, Y kişisi o fotoğrafı silememelidir. Sadece yükleyen kişi (sahibi) silebilmelidir. Partnerin arayüzünde silme butonu hiç gösterilmemeli; haritadan veya galeriden silme fonksiyonu çağrılsa bile sahiplik kontrolü yapılarak işlem reddedilmelidir.
* **Uygulanan Çözüm:**
  * `PhotoLightboxModal.tsx` ve `PhotoSingleCell.tsx` içerisinde `isOwner` kontrolü `Boolean(userId && photo.user_id && photo.user_id === userId)` şeklinde sıkılaştırıldı; partner arayüzünde silme butonu gizlendi.
  * `photos.tsx` (`handleDelete`) ve `map.tsx` (`handleDeletePhoto` & `handleDeleteNote`) fonksiyonlarına fonksiyon seviyesinde sahiplik koruması eklendi; partner silmeye çalışırsa uyarı diyalogu verilip işlem engellendi.
  * Silme sorgularına `.eq("user_id", userId)` koşulu eklendi.
  * `MapDetailCard.tsx` içerisindeki `isOwner` prop'u boolean tip garantisiyle bağlandı.
  * Supabase veritabanı seviyesinde `supabase/migrations/20261022000001_restrict_photo_delete_to_owner.sql` migrasyonu oluşturularak `photo_archive` tablosundaki DELETE RLS politikası `couple_id = get_my_couple_id() AND user_id = auth.uid()` şeklinde sıkılaştırıldı.

---

### Görev 2.2: Profilde İlişki Tarihleri (Sevgililik ve Tanışma) Değiştiğinde Özel Günlerdeki İlgili Kartların Güncellenmesi [TAMAMLANDI ✅]
* **Kategori:** Orta / Veri Senkronizasyonu & State Bütünlüğü
* **Mevcut Sorun:**
  Profil / Ayarlar ekranından tanışma tarihi veya sevgili olma tarihi değiştirildiğinde, Özel Günler / Anılar (`memories`) ekranında önceden oluşturulmuş olan "Tanışma Yıl Dönümümüz" ve "Sevgili Olma Yıl Dönümümüz" kartlarının tarihleri güncellenmemekte; eski tarihlerde sabit kalmaktadır.
* **Kullanıcı Beklentisi:**
  Profil üzerinden ilişki tarihleri (tanışma veya sevgili olma) güncellendiğinde, Özel Günler listesindeki varsayılan bu iki kartın da tarihleri otomatik olarak yeni tarihlerle senkronize olmalı; sayaçlar ile anı kartları arasında tarih çelişkisi yaşanmamalıdır.
* **Uygulanan Çözüm:**
  * `src/app/(tabs)/profile.tsx` içerisindeki `handleUpdateDates` fonksiyonuna `memories` tablosu senkronizasyonu eklendi: `couples` tablosu güncellendikten hemen sonra "Tanışma Yıl Dönümümüz" ve "Sevgili Olma Yıl Dönümümüz" kayıtları aranıp yeni tarihlerle veritabanında güncelleniyor, yoksa otomatik ekleniyor.
  * Güncelleme sonrasında `["memories"]`, `["calendar_data"]` ve `["home_dashboard"]` React Query önbellekleri anında geçersiz kılınarak arayüzün anlık tazelenmesi sağlandı.
  * `src/app/(tabs)/memories.tsx` içerisindeki kontrol güncellendi; mevcut varsayılan kartların tarihleri profildeki güncel tarihlerle farklıysa sayfa açılışında da otomatik olarak senkronize ediliyor.

---

### Görev 2.3: Aşk Haritasının Uygulama Tema Moduna Göre Gece/Gündüz Modunu Otomatik Senkronize Etmesi [TAMAMLANDI ✅]
* **Kategori:** Orta / Tema & UI Tutarlılığı
* **Mevcut Sorun:**
  Kullanıcı uygulamayı gece modunda veya koyu modda kullanıyor olsa dahi, Aşk Haritası sekmesine geçildiğinde harita her zaman varsayılan açık/krem ("romantic") temasında açılmaktadır. Kullanıcının sistem teması haritaya yansımamaktadır.
* **Kullanıcı Beklentisi:**
  Kullanıcı beyaz (açık) modda değilse (koyu mod, gece modu vb. kullanıyorsa), Aşk Haritası otomatik olarak gece/midnight modunda açılmalıdır. Kullanıcı beyaz/açık modda ise sade ve aydınlık harita stili ile açılmalıdır.
* **Uygulanan Çözüm:**
  * `src/app/(tabs)/map.tsx` içerisinde `useTheme()` hook'undan `isLight: isAppLight` çekildi.
  * Harita başlangıç teması `isAppLight ? "silver" : "midnight"` olarak dinamik başlatıldı (koyu/gece modunda `midnight`, beyaz/açık modda minimalist sade `silver`).
  * `userManualThemeRef` referansı eklenerek kullanıcının oturum içinde harita üzerindeki tema seçiciden yaptığı manuel seçimler korunurken, genel tema modu değişiminde haritanın otomatik gece/gündüz adaptasyonu sağlandı.

---

### Görev 2.4: Bizim Yıldızımız Ekranında Ses ve Titreşimin Kalıcılığı & Genel Ayarlara Tam Bağlanması [TAMAMLANDI ✅]
* **Kategori:** Orta / Ses & Haptik Mimarisi
* **Mevcut Sorunlar:**
  1. *Kalıcılık Hatası:* Kullanıcı Yıldızımız ekranında sağ üstteki butonla ortam sesini kapattıktan sonra ana sayfaya dönüp tekrar yıldız ekranına girdiğinde, ses tekrar açık olarak çalmaya başlamaktadır (kullanıcının kapatma tercihi sıfırlanmaktadır).
  2. *Genel Ayar Entegrasyon Eksikliği:* Profil / Ayarlar altındaki "Ses & Dokunsal Efektler" bölümünden uygulama içi sesler veya dokunsal titreşim (Haptics) kapatıldığında, Yıldızımız ekranındaki ses çalmaya ve yıldıza dokunulduğunda titreşim vermeye devam etmektedir.
  3. *Ses Tınısı İhtiyacı:* Yıldız modülündeki ambiyans sesinin daha kaliteli, büyüleyici ve dinlendirici bir kozmik tını ile güncellenmesi gerekmektedir.
* **Kullanıcı Beklentisi:**
  * Yıldız ekranındaki ses açma/kapama tercihi kalıcı olmalı; kullanıcı sesi kapattıysa sayfadan çıkıp tekrar girdiğinde ses kapalı kalmalıdır.
  * Profildeki "Uygulama İçi Sesler" veya "Dokunsal Titreşim" anahtarları kapatıldığında, yıldız ekranı dahil tüm uygulamadaki ilgili ses ve titreşimler anında ve eksiksiz olarak susturulmalıdır.
  * Uygulamadaki tüm ses efektlerinin (mektup, ilaç, harita, fotoğraf vb.) tek tek çalışıp çalışmadığı ve anahtarlara uyup uymadığı doğrulanmalı; ambiyans sesi yenilenmelidir.
* **Uygulanan Çözüm:**
  * `OurStarScreen.tsx` içinde ortam sesi kapatma durumu `@star_ambient_muted` anahtarıyla AsyncStorage'a kaydedildi; ekran her açıldığında ve odaklandığında kalıcı tercih korunuyor.
  * `useFocusEffect` içinde hem `@star_ambient_muted` hem de profil ayarlarındaki `getSoundEffectsEnabled()` aynı anda doğrulanıyor; ayarlardan ses kapalıysa yıldız sesi asla başlamıyor.
  * `src/lib/soundEffects.ts` içindeki `setSoundEffectsEnabled(false)` fonksiyonuna `stopCosmicAmbient()` eklendi; ayarlardan ses kapatıldığı salisede yıldız sesi de anında susturuluyor.
  * `OurStarScreen.tsx`, `StarSparkManager.ts`, `MacroSkyCanvas.tsx`, `HomeRadarOverlay.tsx`, `ClaimStarModal.tsx`, `ExoplanetModal.tsx`, `StarConnectionModal.tsx` ve `ConnectionRequestBadge.tsx` bileşenlerindeki tüm ham `expo-haptics` çağrıları `src/lib/soundEffects.ts` altındaki merkezi haptik yardımcılarına (`hapticTap`, `hapticStamp`, `hapticSuccess`, `hapticError`, `hapticSelection`) bağlandı. Böylece kullanıcı ayarlardan titreşimi kapattığında yıldız modülündeki tüm titreşimler eksiksiz olarak susuyor.
  * `assets/sounds/cosmic_ambient.wav` sesi 44.1 kHz, 16-bit stereo, Eb Maj9 armonik tınıları, ince binaural derinlik, uzay rüzgarı dokusu ve sıfır klik geçişli kusursuz döngü (seamless loop) ile yeniden sentezlenerek büyüleyici bir kozmik tınıya kavuşturuldu.

---

### Görev 2.5: Sahipsiz / Tescilsiz Yıldızların Farklı Parlaklıklarda Olması ve Mag Değerlerinin Tutarsızlığı
* **Kategori:** Orta / Gökyüzü Render Mantığı & Star HUD
* **Mevcut Sorun:**
  Gökyüzü haritasında sahipsiz (tescilsiz) yıldızların üzerine tıklandığında bazı yıldızlar çok parlak, bazıları çok sönük görünmektedir. Alt kartta ise astronomik katalogdaki kadir (`magnitude` / `mag`) değerleri listelenmektedir. Ancak tescilsiz yıldızlar henüz hiçbir çifte ait olmadığından, bu parlaklık farklılıkları ve mag değerleri arayüzde mantıksal bir kafa karışıklığı yaratmaktadır.
* **Kullanıcı Beklentisi:**
  Tescilsiz (sahipsiz) olan tüm yıldızlar hem gökyüzü haritası çiziminde (canvas) hem de tıklandığında açılan alt bilgi kartında eşit, sabit ve düşük bir parlaklık seviyesine sahip olmalıdır. Bir yıldız ancak bir çift tarafından tescillenip aşk aktiviteleriyle beslendiğinde ışığı parlamalı; sahipsiz yıldızlar nötr, düşük ve eşit parlamalıdır.
* **Araştırma & Mimari Bağlam:**
  * **İlgili Dosyalar:**
    * [`src/modules/stars/canvas/macro/starStyle.ts`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/modules/stars/canvas/macro/starStyle.ts)
    * [`src/modules/stars/canvas/MacroSkyCanvas.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/modules/stars/canvas/MacroSkyCanvas.tsx)
    * [`src/modules/stars/components/OurStarScreen.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/modules/stars/components/OurStarScreen.tsx)
  * **İnceleme Notu:**
    1. `starStyle.ts` dosyası incelendiğinde, `starCoreAlpha` ve `starBaseRadius` fonksiyonlarında `claimed` olmayan (sahipsiz) yıldızların opasite ve yarıçaplarının ham katalog verisi olan `magnitude` değişkenine göre dinamik hesaplandığı görülmektedir (`const normalized = Math.max(0, Math.min(1, 1 - (magnitude + 2) / 11));`). Bu yüzden kimi sahipsiz yıldız 1 mag iken devasa ve çok parlak, kimi ise 6 mag iken soluk çizilmektedir.
    2. `OurStarScreen.tsx` satır 1271'de tıklandığında açılan kartta `Parlaklık: {selectedMacroStar.magnitude} mag` basılmaktadır. Kullanıcının beklentisi tescilsiz olanların arayüzde de eşit ve düşük bir standart parlaklık değeriyle temsil edilmesidir.

---

### Görev 2.6: Yıldızımız Ekranı Alt Panelindeki (Dock & HUD) Buton Karmaşıklığının Giderilmesi
* **Kategori:** Orta / UX Sadeleştirme & Ergonomi
* **Mevcut Sorun:**
  "Bizim Yıldızımız" ekranında hem makro görünümde (gök kubbe) hem de mikro görünümde (yıldızın içi) ekranın alt ve sağ kenarlarında çok sayıda buton (anı gezegenleri dock'u, gök kubbeye dön butonu, ses aç/kapat, arama, takımyıldızı bağlantıları, tescil sertifikası vb.) yer almakta; butonlar görsel hiyerarşiyi bozarak karmaşa yaratmaktadır.
* **Kullanıcı Beklentisi:**
  Alt kontrol çubuğunun ve yüzen butonların gereksiz kalabalıktan arındırılması, kullanıcının o an nerede olduğunu (gökyüzünde mi yoksa kendi yıldızının içinde mi) net hissettiren, sezgisel ve minimalist bir kontrol mimarisine kavuşturulması.
* **Araştırma & Mimari Bağlam:**
  * **İlgili Dosyalar:**
    * [`src/modules/stars/components/OurStarScreen.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/modules/stars/components/OurStarScreen.tsx)
    * [`src/modules/stars/components/micro/MicroSystemDock.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/modules/stars/components/micro/MicroSystemDock.tsx)
  * **İnceleme Notu:**
    `OurStarScreen.tsx` satır 1010-1065 arasında yer alan `cosmicBagRow` yüzen buton grubu (bağlantı rozeti, ses aç/kapat, arama butonu) ile `MicroSystemDock.tsx` içerisindeki alt kartlar ve "Gök Kubbeye Dön" eylemi görsel ve dokunma alanı olarak çakışabilmektedir. Mikro ve makro sahneler arasındaki buton ayrımının daha temiz bir hiyerarşiye oturtulması hedeflenmektedir.

---

### Görev 2.7: Profil Bilgileri (Görünen İsim, Cinsiyet, İlişki Tarihleri) İçin Değişiklik Kısıtlamaları & Tema Uyum Mantığı
* **Kategori:** Orta / İş Mantığı (Business Logic) & Tema Senkronizasyonu
* **Mevcut Sorunlar:**
  1. *Sınırsız Değişiklik Açığı:* Görünen isim, cinsiyet tercihi ve ilişki başlangıç/tanışma tarihleri kullanıcı tarafından hiçbir sınır, cooldown veya hak kısıtlaması olmaksızın anlık olarak sınırsız kez değiştirilebilmektedir. Bu durum veritabanında gereksiz manipülasyonlara ve partner tarafında tutarsızlıklara yol açabilmektedir.
  2. *Cinsiyet Değişimi Tema Uyumsuzluğu:* Kullanıcı cinsiyet tercihini değiştirdiğinde (örneğin Kadın'dan Erkek'e veya tam tersi), arayüz tema seçeneklerinin ve mevcut aktif temanın bu yeni cinsiyete göre otomatik güncellenmesi gerekirken tema uyumsuz kalabilmektedir.
* **Kullanıcı Beklentisi:**
  * Görünen ismin, cinsiyet tercihinin ve ilişki tarihlerinin kaç kez veya hangi sıklıkla değiştirilebileceğine dair mantıklı bir kısıtlama / bekleme süresi politikası kurgulanması.
  * Cinsiyet tercihi değiştiğinde arayüz tema modlarının da anında yeni cinsiyet profiline göre adapte olması.
* **Araştırma & Mimari Bağlam:**
  * **İlgili Dosyalar:**
    * [`src/app/(tabs)/profile.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/app/(tabs)/profile.tsx)
    * [`src/context/ThemeContext.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/context/ThemeContext.tsx)
    * [`src/lib/theme.ts`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/lib/theme.ts)
    * [`src/components/profile/PersonalInfoForm.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/components/profile/PersonalInfoForm.tsx)
    * [`src/components/profile/ThemePicker.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/components/profile/ThemePicker.tsx)
  * **İnceleme Notu:**
    `profile.tsx` dosyasındaki `handleUpdateProfile` ve `handleUpdateDates` doğrudan `users` ve `couples` tablolarını güncellemektedir; veritabanında veya istemcide herhangi bir rate-limit veya değişiklik sayısı sayacı tutulmamaktadır. Ayrıca `PersonalInfoForm` içindeki yerel `gender` state'i değiştiğinde, `ThemeContext` bu değişikliği sunucuya kaydedilip profil yenilenene kadar bilmemektedir; kaydedildiğinde ise mevcut `themeMode` ("current" vb.) yeni cinsiyetin varsayılan temasına pürüzsüz geçirilmelidir.

---

## 🔴 3. BÖLÜM: ZOR İŞLER (Product Decisions & Platform Features)

---

### Görev 3.1: Mektuplarda Silme ve Gizleme Politikası (Ürün Kararı & Mimari Tasarım)
* **Kategori:** Zor / Ürün Kararı, Veri Güvenliği & RLS
* **Mevcut Durum:**
  Zaman kilitli mektuplar modülünde (`letters`) şu an hiçbir silme veya gizleme mekanizması bulunmamaktadır. Gönderilen veya alınan mektuplar kalıcı olarak listede durmaktadır.
* **Tartışılan Ürün Seçenekleri ve İhtiyaçlar:**
  Mektuplar çiftler arasındaki en mahrem ve duygusal içerikler olduğu için silme mantığının kötüye kullanıma ve partner kırgınlıklarına yol açmayacak şekilde tasarlanması gerekmektedir:
  1. *Yalnızca Yazan Kişi Silebilir kuralı:* Gönderen kişi kendi yazdığı mektubu silebilir; ancak karşı tarafın yazdığı mektubu silemez.
  2. *Kilit Durumuna Göre Silme kuralı:* Mektup henüz zaman kilidi açılmamışken mi silinebilir, yoksa açılıp okunduktan sonra mı silinebilir? (Veya kilitli bir mektup silinirse alıcıya "Bu mektup göndericisi tarafından geri çekildi" gibi bir bilgilendirme mi gösterilmeli?)
  3. *Silme yerine Gizleme (Arşivleme) Alternatifi:* Mektubu veritabanından kalıcı olarak silmek yerine çiftin kendi arayüzünde "Gizle/Arşivle" butonuyla ekranından kaldırması; böylece partnerin elindeki hatıranın aniden kaybolmaması.
* **Kullanıcı Beklentisi:**
  Bu senaryoların netleştirilerek mektup kartlarına ve detay ekranına güvenli, onay mekanizmalı bir silme/gizleme akışının kazandırılması.
* **Araştırma & Mimari Bağlam:**
  * **İlgili Dosyalar:**
    * [`src/app/(tabs)/letters.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/app/(tabs)/letters.tsx)
    * `supabase/migrations/` (özellikle `letters` tablosu RLS politikaları)
  * **İnceleme Notu:**
    Mektuplar uçtan uca AES şifrelidir (`encrypt` / `decrypt`). `letters` tablosunda `018_security_and_manipulation_fixes.sql` migration'ı ile kilitli mektupların erken okunması RLS seviyesinde engellenmiştir. Silme veya gizleme özelliği eklendiğinde `letters` tablosuna `is_hidden_by_sender`, `is_hidden_by_receiver` veya `deleted_at` gibi kolonların gerekip gerekmediği ve RLS kuralları Claude tarafından değerlendirilmelidir.

---

### Görev 3.2: Widget İyileştirmeleri: Fotoğraf Yerleşimi, Partner Ruh Hali, Bildirim Sayacı & Premium Kilitleme
* **Kategori:** Zor / iOS WidgetKit & Android AppWidget Çift Platform Geliştirmesi
* **Mevcut Durum:**
  Mevcut widget yapısında fotoğraflar ekranın ortasında büyük ve örtüşen şekilde yer almakta; partnerin anlık ruh hali ve bekleyen okunmamış bildirimler widget üzerinde kompakt biçimde yer almamaktadır. Ayrıca widget'ların Premium aboneliğe bağlı kılınması kuralının tam olarak işletilmesi gerekmektedir.
* **Kullanıcı Beklentisi:**
  1. *Profil Fotoğrafları:* Widget üzerinde çiftin profil fotoğraflarının sağ üst köşede küçük, zarif ve birbirini örtmeyen (yüzleri kapatmayan) bir düzende konumlandırılması.
  2. *Partnerin Ruh Hali:* Widget üzerinde partnerin o günkü ruh halinin (emojisi ve durumunun) görünür olması.
  3. *Bildirim Rozeti:* Uygulamada açılmamış mektup veya okunmamış bildirim biriktiğinde widget üzerinde biriken bildirim sayısının rozet olarak gösterilmesi.
  4. *Premium Özel:* Widget kullanımının Premium abonelere özel olması; ücretsiz kullanıcılarda widget'ın kilitli durumunun ve Premium'a yönlendiren paywall kilidinin gösterilmesi.
* **Araştırma & Mimari Bağlam:**
  * **İlgili Dosyalar:**
    * [`widgets/CoupleWidget.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/widgets/CoupleWidget.tsx) (iOS Swift UI / WidgetKit)
    * [`plugins/android-widget/CoupleWidgetProvider.kt`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/plugins/android-widget/CoupleWidgetProvider.kt) (Android RemoteViews)
    * [`src/utils/widgetBridge.ts`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/utils/widgetBridge.ts) (Uygulama ile Widget arasındaki veri köprüsü)
    * [`src/app/(tabs)/home.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/app/(tabs)/home.tsx) (`syncCoupleWidget` çağrısı)
  * **İnceleme Notu:**
    * `CoupleWidgetPayload` (`src/utils/widgetBridge.ts`) veri yapısı incelendiğinde; `state`, `myName`, `partnerName`, `startDate`, `premiumUntilMs`, `partnerMoodEmoji`, `partnerMoodLabel`, `moodDate`, `myAvatarPath`, `partnerAvatarPath` alanlarının tanımlı olduğu, ancak bekleyen bildirim sayısını (`unreadCount`) taşıyan bir alanın henüz bulunmadığı görülmektedir.
    * Bu geliştirme hem iOS tarafında `CoupleWidget.tsx` (SwiftUI) hem de Android tarafında `CoupleWidgetProvider.kt` (XML RemoteViews) dosyalarının her ikisinde birden görsel ve veri uyumu gerektirmektedir.

---

## 📌 Özet Görev Dağılım Tablosu

| No | Görev Başlığı | Modül / Dosya | Zorluk | Öncelik |
| :--- | :--- | :--- | :--- | :--- |
| **1.1** | Galeri Lightbox silme onayının modal arkasında kalması | `PhotoLightboxModal.tsx`, `dialog.ts` | 🟢 Kolay | Yüksek |
| **1.2** | Güneş sistemi cisimlerinde beyaz modda açıklama okunmaması | `OurStarScreen.tsx` | 🟢 Kolay | Yüksek |
| **1.3** | Sekme ve sayfa geçişlerindeki saliselik beyaz flaş (flicker) | `(tabs)/_layout.tsx`, `_layout.tsx` | 🟢 Kolay | Yüksek |
| **1.4** | Yıldızımızdaki "Kıvılcım" terimi ve UX anlatımı | `MicroStarHeader.tsx`, `StarSparkManager.ts` | 🟢 Kolay | Orta |
| **1.5** | Widget'ta fotoğrafların üzerini örten kalbin kaldırılması | `CoupleWidget.tsx`, `CoupleWidgetProvider.kt` | 🟢 Kolay | Yüksek |
| **2.1** | Başkasının yüklediği fotoğrafı partnerin silememesi kuralı | `photos.tsx`, `map.tsx`, `MapDetailCard.tsx` | 🟡 Orta | Kritik |
| **2.2** | İlişki tarihleri değiştiğinde anılardaki 2 kartın güncellenmesi | `profile.tsx`, `memories.tsx` | 🟡 Orta | Yüksek |
| **2.3** | Aşk haritasının gece/gündüz moduna otomatik senkronizasyonu | `map.tsx`, `mapStyles.ts` | 🟡 Orta | Orta |
| **2.4** | Yıldız ses/titreşim kalıcılığı ve genel ayarlara tam uyum | `OurStarScreen.tsx`, `soundEffects.ts` | 🟡 Orta | Yüksek |
| **2.5** | Sahipsiz yıldızların eşit düşük parlaklığa ve mag tutarlılığına çekilmesi | `starStyle.ts`, `OurStarScreen.tsx` | 🟡 Orta | Orta |
| **2.6** | Yıldızımız ekranı alt panel buton karmaşıklığının giderilmesi | `OurStarScreen.tsx`, `MicroSystemDock.tsx` | 🟡 Orta | Orta |
| **2.7** | Görünen isim, cinsiyet ve tarih değişim limitleri & tema senkronu | `profile.tsx`, `ThemeContext.tsx` | 🟡 Orta | Orta |
| **3.1** | Mektuplarda silme/gizleme politikası tasarımı ve RLS kurgusu | `letters.tsx`, Supabase RLS | 🔴 Zor | Orta |
| **3.2** | Widget sağ üst avatar, ruh hali, bildirim sayısı & premium kilit | `CoupleWidget.tsx`, `widgetBridge.ts` | 🔴 Zor | Yüksek |
