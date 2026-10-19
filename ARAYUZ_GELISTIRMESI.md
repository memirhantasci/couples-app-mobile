# 🎨 Arayüz, Hata ve Geliştirme Yol Haritası (Claude Görev Rehberi)

> **Belge Amacı:** Bu dosya, kullanıcı testleri, gerçek cihaz ekran kayıtları ve doğrudan kullanıcı geri bildirimleriyle tespit edilen tüm eksiklik ve hataların **zorluk derecesine göre gruplandırılmış** detaylı haritasıdır.  
> **Geliştirici Notu (Claude İçin):** Bu belgede kodun **nasıl düzeltileceğine kesinlikle karışılmamıştır; çözüm mimarisine ve uygulanacak koda tamamen Claude karar verecektir.** Burada amaç; Claude'un kod tabanında dosya aramakla vakit kaybetmemesi için her bir sorunun **"NE OLDUĞUNU"** ve **"NEREDE (HANGİ DOSYA, BİLEŞEN, SATIR) OLDUĞUNU"** en ince detayına kadar sunmaktır.

---

## 📊 Hızlı Zorluk Dağılım Tablosu

| Seviye | Madde Sayısı | Kapsam |
|:---:|:---:|---|
| 🟢 **KOLAY** | 9 Görev | Metin, rozet, gereksiz buton/ses kaldırma, etiket, demo galeri/fotoğraf açılışı |
| 🟡 **ORTA** | 8 Görev | Scroll padding, klavye kapamaları, çark hizalaması, kart tasarımları, demo veri mantığı |
| 🟠 **ZOR** | 7 Görev | Açık tema kontrastı, sistem alertlerinin özel modala taşınması, paywall kaldırma, kamera açısı |
| 🔴 **ÇOK ZOR** | 2 Görev | Yeni CRUD akışı (Buluşma Düzenleme) & Depolama + Premium yetkili Profil Fotoğrafı (PP) sistemi |

---

# 🟢 1. BÖLÜM: KOLAY İŞLER (Hızlı Düzeltmeler, Metin & İkon Ayarları)

---

### [KOLAY-1] 🔇 Aşk Ölçer Tıklama Sesinin Kaldırılması
* **Sorun Nedir? (NE):** Ana sayfada "Aşk Ölçer" bileşenine tıklandığında arka planda ses efekti çalıyor. Kullanıcı bunu gereksiz gürültü olarak değerlendiriyor ve ses çalmasını istemiyor.
* **Nerededir? (NEREDE):**
  * `src/components/home/LoveMeter.tsx` (kartın `onPress` veya dokunma tetikleyicisi)
  * `src/app/(tabs)/home.tsx`
* **Kullanıcı Beklentisi:** Aşk ölçere tıklandığında hiçbir ses efekti çalmamalıdır.

---

### [KOLAY-2] 🖼️ Ortak Galeri Ekranındaki Izgara (Grid) Seçim Butonunun Kaldırılması
* **Sorun Nedir? (NE):** Ortak Galeri ekranında sağ üstte "+ Fotoğraf Ekle" butonunun yanında görünüm modunu (ızgara/liste) değiştiren bir ızgara ikonu butonu yer alıyor. Kullanıcı uygulamanın hiçbir yerinde bu tarz karmaşık görünüm değiştirici butonlar istemiyor.
* **Nerededir? (NEREDE):**
  * `src/app/(tabs)/photos.tsx` (sağ üst bar eylemleri / header actions)
* **Kullanıcı Beklentisi:** Izgara seçimi butonu tamamen kaldırılmalı, galeri tek ve temiz bir standart düzende sunulmalıdır.

---

### [KOLAY-3] 😊 Takvimde Ruh Hali Ham Metni (`love`) Yerine Türkçe İsim ve Emoji Gösterimi
* **Sorun Nedir? (NE):** Takvim ekranında "HİSSEDİLEN RUH HALLERİ" bölümündeki kartta emoji yerine koca harflerle ham veritabanı enum değeri olan `"love"` metni yazıyor.
* **Nerededir? (NEREDE):**
  * `src/app/(tabs)/calendar.tsx` (yaklaşık 585 - 597. satırlar arasındaki `m.mood_type` basılan alan)
* **Kullanıcı Beklentisi:** Ekranda ham kod (`love`) yerine uygulamanın ana sayfasındaki gibi gerçek emoji ve Türkçe ad (**Aşık / Sevgi Dolu 🥰**) gösterilmelidir.

---

### [KOLAY-4] 🏷️ Takvim Ruh Halleri Kartında "Partnerin" Yerine Sevgilinin Gerçek Adının Yazılması
* **Sorun Nedir? (NE):** Takvim ekranındaki "HİSSEDİLEN RUH HALLERİ" kartının üst etiketinde jenerik `"Partnerin"` yazıyor.
* **Nerededir? (NEREDE):**
  * `src/app/(tabs)/calendar.tsx` (satır 590: `{isMe ? "Sen" : "Partnerin"}` ve üst filtre çipleri)
* **Kullanıcı Beklentisi:** `"Partnerin"` ibaresi kaldırılmalı, yerine sevgilinin gerçek adı (veya profildeki partner adı, örn. "Emirhan") yazmalıdır.

---

### [KOLAY-5] ⏳ Demo Modunda "Aşkımızın Yolculuğu" Gün Sayacının Boş Kalması
* **Sorun Nedir? (NE):** Demo modunda ana sayfada "AŞKIMIZIN YOLCULUĞU" kartında gün sayıları boş tire (`- Gündür Sevgiliyiz`, `- Gündür Hayatımdasın`) olarak görünüyor.
* **Nerededir? (NEREDE):**
  * `src/app/(tabs)/home.tsx` (veya `src/components/home/LoveJourneyCard.tsx` / `useCoupleData`)
* **Kullanıcı Beklentisi:** Demo modunda gün sayıları boş kalmamalı; gerçekçi ve romantik sayılar (örn. "365 Gündür Sevgiliyiz", "428 Gündür Hayatımdasın") gösterilmelidir.

---

### [KOLAY-6] 🔒 Mektuplar Listesinde Alıcı Kısmındaki Ham Şifreli Dizenin (`enc:...`) Gizlenmesi
* **Sorun Nedir? (NE):** Mektuplar ekranında mektup kartının üzerinde `Alıcı: enc:882bb8fbdfb131583fafde09732650ff:da18aa2bb4f...` şeklinde şifrelenmiş ham ciphertext dizesi kullanıcıya gösteriliyor.
* **Nerededir? (NEREDE):**
  * `src/app/(tabs)/letters.tsx` (veya mektup kartı bileşeni: `src/components/letters/`)
* **Kullanıcı Beklentisi:** Uygulamanın hiçbir yerinde şifreli ham metin gösterilmemeli; alıcı kısmında doğrudan sevgilinin adı (örn: `Alıcı: Sevgilim ❤️` veya sevgilisinin ismi) yer almalıdır.

---

### [KOLAY-7] 🔊 Gökyüzü / Yıldız Ekranına Ortam Sesini Açma/Kapatma (Mute/Unmute) Butonu Eklenmesi
* **Sorun Nedir? (NE):** Gökyüzü ve yıldız sahnesinde arka planda çalan uzay sesini kullanıcının kolayca kapatıp açabileceği bir ses butonu bulunmuyor.
* **Nerededir? (NEREDE):**
  * `src/modules/stars/components/OurStarScreen.tsx` (üst kontrol butonları alanı)
* **Kullanıcı Beklentisi:** Ekranın üst çubuğuna tek dokunuşla sesi susturan veya açan şık bir hoparlör ikonu (🔊 / 🔇) eklenmelidir.

---

### [KOLAY-8] ✨ Yıldız Dış Görünümündeyken İçeri Giriş Butonunun Açıklanması / Belirginleştirilmesi
* **Sorun Nedir? (NE):** Yıldızın dışındayken sağ alttaki butona basıldığında içeri girildiği kullanıcı tarafından anlaşılamıyor, buton işlevsiz gibi duruyor.
* **Nerededir? (NEREDE):**
  * `src/modules/stars/components/OurStarScreen.tsx` (sağ altta yer alan geçiş butonu)
* **Kullanıcı Beklentisi:** Butonun üzerine belirgin bir etiket ("Yıldızın İçine Gir ✨") veya net bir yönlendirme rozeti eklenmelidir.

---

### [KOLAY-9] 🖼️ Demo Modunda Galeri & Fotoğraf Yükle Ekranlarının Açık Olması (Temsili Fotoğraflar & Fotoğraf Seçiminde Kayıt Ol Uyarısı)
* **Sorun Nedir? (NE):**
  * Demo sürümünü gezen kullanıcı Ortak Galeri'ye girdiğinde `PhotosLockCard` ("Fotoğrafları Görmek İçin Premium'a Geçin 🔒") kilit ekranı ile karşılaşıyor ve hiçbir içerik göremiyor.
  * "+ Fotoğraf Ekle" butonu gizleniyor ve "Fotoğraf Yükle" sayfasına (`add-photo.tsx`) gidildiğinde sayfa açılmadan direkt Premium Paywall modalı patlıyor.
  * Kullanıcı demo modunda uygulamanın bu en güzel alanlarının kilitli kalmamasını, galeride 2-3 adet temsili romantik çift anı fotoğrafının sergilenmesini, "Fotoğraf Yükle" sayfasının serbestçe açılabilmesini; ancak kullanıcı fotoğraf yüklemeye veya galeriden fotoğraf seçmeye kalkıştığında ("Fotoğraf Seç" butonuna bastığında) devreye `executeOrIntercept` girerek kullanıcıyı tatlı bir dille "Kayıt Ol" akışına yönlendirmesini istemektedir.
* **Nerededir? (NEREDE):**
  * `src/app/(tabs)/photos.tsx`:
    * `Satır 214`: `{isPremium && (` kontrolü yüzünden "Fotoğraf Ekle" butonu demoda gizleniyor (`isPremium || isDemoMode` olmalı).
    * `Satır 229-231`: `{!isPremium ? <PhotosLockCard ... /> : ...}` alanı demoda galeriyi tamamen kilitliyor; demoda temsili 2-3 anı fotoğrafı listelenmeli.
  * `src/app/(tabs)/add-photo.tsx`:
    * `Satır 114-117 & 358-360`: Sayfa açılışında `if (!isPremium) setShowPaywall(true)` tetikleyicisi demoda devre dışı kalmalı.
    * `Satır 106-112`: `handlePickImage` içinde `executeOrIntercept` ("Ortak Fotoğraf Eklemek İçin Kayıt Olun 📸") zaten mevcut; sayfa açılır açılmaz paywall göstermek yerine kullanıcı "Fotoğraf Seç"e dokunduğunda bu yönlendirme çalışmalıdır.
* **Kullanıcı Beklentisi:**
  * Demo modunda Ortak Galeri kilitli görünmemeli; temsili 2-3 güzel fotoğraf listelenmelidir.
  * "Fotoğraf Ekle" butonu demoda görünür olmalı ve Fotoğraf Yükle ekranı paywall engeli olmadan açılabilmelidir.
  * Kullanıcı fotoğraf seçmeye/eklemeye dokunduğunda ise kayıt ol yönlendirmesi yapılmalıdır.

---

# 🟡 2. BÖLÜM: ORTA ZORLUKTAKİ İŞLER (Layout, Klavye, Kart Tasarımları & Hizalama)

---

### [ORTA-1] 📱 Ana Sayfa "Kaydet" Butonunun Altta Tab Bar Arkasında Kalması
* **Sorun Nedir? (NE):** Ana sayfada "Günlük Notum" kartının altındaki kaydetme butonu, sayfa en alta kaydırıldığında Floating Bottom Tab Bar'ın arkasında kalıyor ve tıklanamıyor.
* **Nerededir? (NEREDE):**
  * `src/app/(tabs)/home.tsx` (Ana sayfa ana `ScrollView` ve `contentContainerStyle`)
* **Kullanıcı Beklentisi:** Sayfa en alta kaydırıldığında kaydet butonu Tab Bar'ın tamamen üzerinde, rahatça görülebilir ve tıklanabilir olmalıdır.

---

### [ORTA-2] 💌 Ana Sayfada Bekleyen Mektup Kartının Demo Barı ve Tab Bar Tarafından Ezilmesi
* **Sorun Nedir? (NE):** Ana sayfanın en altında bulunan "Bekleyen Mektuplar" kartı, ekranın altındaki sabit "Demo Sürümü" banner'ı ve Tab Bar yüzünden dikeyde sıkışıyor, alt yarısı kesiliyor ve ezik görünüyor.
* **Nerededir? (NEREDE):**
  * `src/app/(tabs)/home.tsx` (en alt kart yerleşimi)
  * `src/components/home/PendingLettersCard.tsx`
* **Kullanıcı Beklentisi:** Kart alt gezinme ve demo çubukları tarafından ezilmemeli, tam görünür olmalı; bekleyen mektup varsa sayfanın üstünde de dikkat çeken bir bildirim rozeti yer almalıdır.

---

### [ORTA-3] ⌨️ Giriş (Login) ve Kayıt Ol (Register) Ekranlarında Klavyenin Butonları Kapatması
* **Sorun Nedir? (NE):** Giriş Yap ve Kayıt Ol sekmelerinde klavye açıldığında alttaki form alanları, "Giriş Yap" ve "Kayıt Ol" butonları klavyenin altında kalıyor. Kullanıcı butonu göremiyor ve basamıyor.
* **Nerededir? (NEREDE):**
  * `src/app/(auth)/login.tsx` (satır 720-735 arasındaki `KeyboardAwareScrollView` ve ana form konteyneri)
* **Kullanıcı Beklentisi:** Klavye açıldığında aktif input alanı ve alttaki submit butonu otomatik olarak klavyenin üzerine kaymalı, hiçbir buton klavye arkasında saklanmamalıdır.

---

### [ORTA-4] ⏰ İlaç Takibi / Doz Saati Seçim Çarkında (Wheel Picker) Dakika Sütununun Aşağı Kayması
* **Sorun Nedir? (NE):** İlaç Yönetimi modalında "Doz Saati" seçilirken, sağdaki dakika sütunu (`56, 57, 58, 59`) sol sütundaki saatlere (`06, 07, 08, 09`) ve orta seçim çerçevesine göre dikeyde belirgin şekilde aşağı kaymış ve hizasız duruyor.
* **Nerededir? (NEREDE):**
  * `src/components/medicine/MedicineManagerModal.tsx` (Doz saati wheel/picker bileşeni, `itemHeight`, `lineHeight` ve `contentContainerStyle` alanları)
* **Kullanıcı Beklentisi:** Saat ve dakika rakamları seçim çerçevesi içinde tam yatay hizada ve kusursuz merkezlenmiş (`08 : 58`) olarak durmalıdır.

---

### [ORTA-5] 📖 Takvim Ekranındaki "Günün Notları" Kart Tasarımının İyileştirilmesi
* **Sorun Nedir? (NE):** Takvim ekranında "GÜNÜN NOTLARI" kartı, solunda çiğ ve kaba pembe bir dikey çizgi bulunan düzensiz beyaz bir kutu olarak duruyor. Aşk temasına yakışır bir zarafete sahip değil.
* **Nerededir? (NEREDE):**
  * `src/app/(tabs)/calendar.tsx` (satır 555-570 arası "Günün Notları" render bloğu)
  * `src/components/calendar/DaySectionCard.tsx` (`variant="note"` stilleri)
* **Kullanıcı Beklentisi:** Kart tasarımı romantik hatıra defteri/anı kartı konseptine kavuşturulmalı, kaba çizgiler yerine yumuşak gölgeler, minik avatar ve zarif tırnak işaretleriyle şıklaştırılmalıdır.

---

### [ORTA-6] 🚫 Demo Modundaki Kayan Alt Banner'ın Ekranda Butonları ve İşlem Alanlarını Örtmesi
* **Sorun Nedir? (NE):** Sayfanın altında yüzen siyah `Demo Sürümü - Kayıt Ol` banner'ı; haritada pin tıklandığında "Yol Tarifi Al" butonunu, takvimde etkinlik kartlarını ve ana sayfadaki kartları tamamen kapatarak kullanıma engel oluyor.
* **Nerededir? (NEREDE):**
  * `src/components/demo/DemoModeBanner.tsx`
  * `src/app/(tabs)/_layout.tsx` (banner'ın yerleştirildiği ana layout)
* **Kullanıcı Beklentisi:** Demo bilgilendirmesi alttaki kritik interaktif butonların üzerini örtmemelidir; ekran tepesinde ince bir rozet veya sadece ayarlarda bir davet şeklinde konumlandırılmalıdır.

---

### [ORTA-7] 🗺️ Aşk Haritası ve Takvimde İlk Açılışta Örnek Fotoğrafların Gösterilmesi
* **Sorun Nedir? (NE):** Demo modunda Aşk Haritası ilk açıldığında harita boş ve kuru duruyor; takvimdeki fotoğraf arşivi alanı kilitli ve boş kalıyor.
* **Nerededir? (NEREDE):**
  * `src/app/(tabs)/map.tsx` & `src/hooks/useMapData.ts`
  * `src/app/(tabs)/calendar.tsx` (satır 496-550 arası fotoğraf bölümü)
* **Kullanıcı Beklentisi:** Harita ilk açıldığında örnek aşk konumlarında 1-2 tatlı anı fotoğrafı sergilenmeli, takvimde de fotoğraflar boş bırakılmamalıdır.

---

### [ORTA-8] 🔐 Takvimde Günlük Notun Kişiye Özel Olması ve Demo Veri Mantığı
* **Sorun Nedir? (NE):** Takvim ekranındaki demo verisinde günlük not `- Misafir (Demo)` imzasıyla uluorta sergileniyor. Kullanıcı günlük notun kişiye özel olduğunu ve burada bu şekilde gösterilmesinin mantıksız olduğunu belirtiyor.
* **Nerededir? (NEREDE):**
  * `src/app/(tabs)/calendar.tsx` (not listeleme ve filtreleme mantığı)
* **Kullanıcı Beklentisi:** Kişiye özel gizli notlar uluorta paylaşılmamalı; demo verisi ortak aşk notu formatına dönüştürülmeli veya kişisel notlar ayrıştırılmalıdır.

---

# 🟠 3. BÖLÜM: ZOR İŞLER (Tema Kontrastı, Sistem Alertleri, Paywall & Kamera)

---

### [ZOR-1] ☀️ Açık Tema (Light Mode) Kontrast Faciası: Beyaz Üzeri Beyaz Okunaksızlık (Tüm Ekranlar Taraması)
* **Sorun Nedir? (NE):**
  * Açık tema (Kadın: İpeksi Pudra Açık Mod / Erkek: Kar Beyazı & Kobalt Açık Mod) seçildiğinde uygulamanın neredeyse tüm ana ve alt ekranlarında ciddi bir kontrast kaybı ve beyaz üzeri beyaz okunaksızlık yaşanıyor.
  * Kartlar beyaz arka plan üzerinde kayboluyor, sayfa başlıkları ve alt başlıklar beyaz olarak kaldığı için görünmüyor, `TextInput` alanlarının kenarlıkları siliniyor, placeholder metinleri açık gri olduğu için okunmuyor.
  * Bu durum hem **Kadın Açık Temasında** (`FEMALE_LIGHT`) hem de **Erkek Açık Temasında** (`MALE_LIGHT`) gerçekleşmektedir.

* **Genel Kök Neden (Global Root Cause):**
  1. `src/lib/theme.ts`: `FEMALE_LIGHT` ve `MALE_LIGHT` tema token'larında `cardBorder`, `inputBorder` ve `unitBg` değerleri aşırı açık (`rgba(..., 0.08-0.12)`). Açık modda kartlar ve kutular zeminle birleşip kayboluyor; belirgin kenarlık veya yumuşak gölge (`shadow-sm` / elevation) eksik.
  2. Ekranların çoğunda `StyleSheet.create` içerisinde `headerTitle`, `headerSubtitle`, `textInput`, `fieldLabel` gibi stillere doğrudan `color: "#ffffff"` veya `rgba(255,255,255,...)` sert kodlanmış (hardcoded). Koyu temada güzel olan bu değerler, açık temada dinamik olarak `theme.text` ve `theme.textSecondary` ile ezilmediği için beyaz üstüne beyaz kalıyor.
  3. Bazı ekranlarda (`add-photo.tsx` gibi) `useTheme()` hook'u yerine `getTheme(profile?.gender)` fonksiyonu çağrılmış ve kullanıcının seçtiği `themeMode` ("light") parametresi fonksiyona hiç iletilmediği için ekran koyu mod stillerini almaya devam ediyor.

* **Ekran Ekran Tespit Edilen Tüm Dosya ve Satır Konumları (NEREDE):**

  1. 📸 **Fotoğraf Yükle Ekranı (`src/app/(tabs)/add-photo.tsx`):**
     * `Satır 49`: `getTheme(profile?.gender)` çağrılmış; `themeMode` verilmediği için `useTheme()` dinamik tema değişimini yakalayamıyor.
     * `Satır 382`: Geri butonu ikonu sert kodlu beyaz: `<ChevronLeft color="#ffffff" size={24} />`.
     * `Satır 754-765`: `headerTitle` (`color: "#ffffff"`) ve `headerSubtitle` (`color: "rgba(255,255,255,0.6)"`).
     * `Satır 777`: `cardHeaderTitle` (`color: "rgba(255,255,255,0.9)"`).
     * `Satır 871-883`: `placeholderTitle` (`color: "#ffffff"`) ve `placeholderSubtitle` (`color: "rgba(255,255,255,0.5)"`).
     * `Satır 961-966`: `fieldLabel` (`color: "rgba(255,255,255,0.7)"`).
     * `Satır 977-981`: Tarih/Saat buton metni `inputRowBtnText` (`color: "#ffffff"`).
     * `Satır 985-994`: `textInput` (`color: "#ffffff"`, `borderColor: "rgba(255,255,255,0.08)"`). Açık temada yazılan yazı beyaz zemin üstünde beyaz kalıyor!

  2. 🖼️ **Ortak Galeri Ekranı (`src/app/(tabs)/photos.tsx`):**
     * `Satır 390-401`: `headerTitle` (`color: "#ffffff"`), `headerSubtitle` (`color: "rgba(255,255,255,0.55)"`). JSX içinde `{ color: theme.text }` override'ı olmadan çağrılıyor.
     * `Satır 404-415`: `controlBar` ve `uploadQuickBtn` açık temada kart kenarlıkları silikleşiyor.
     * Fotoğraf bulunmayan boş durumda (empty state) metinler açık temada kayboluyor.

  3. 📍 **Buluşmalar Ekranı (`src/app/(tabs)/meetings.tsx`):**
     * `Satır 686-697`: `headerTitle` (`color: "#ffffff"`), `headerSubtitle` (`color: "rgba(255,255,255,0.55)"`).
     * `Satır 705-720`: `quickPlanBtn` açık modda saf beyaz arka plan üstünde kenarlıksız beyaz kart olarak kalıyor.
     * `Satır 780-820`: Buluşma kartlarındaki adres, saat ve durum etiketleri açık modda kontrast standardını karşılamıyor.

  4. 💌 **Mektuplar Ekranı & Mektup Yaz Modalı (`src/app/(tabs)/letters.tsx`):**
     * `Satır 942-953`: `headerTitle` (`color: "#ffffff"`), `headerSubtitle` (`color: "rgba(255,255,255,0.6)"`).
     * `Satır 1173-1178`: Mektup Yaz Modalı `modalHeaderTitle` (`color: "#ffffff"`).
     * `Satır 1187-1192`: `fieldLabel` (`color: "rgba(255,255,255,0.7)"`).
     * `Satır 1210-1230`: Mühür açılış tarihi seçici ve mektup metin giriş alanı (`textInput`) açık modda beyaz üstü beyaz kalıyor.
     * `Satır 1140-1149`: Mektup listesi kartlarındaki `letterContentSnippet` ve `letterFooterNote` açık temada okunaksız.

  5. 🩸 **Döngü & Regl Takvimi Ekranı (`src/app/(tabs)/period-tracker.tsx`):**
     * `Satır 613-624`: `headerTitle` (`color: "#ffffff"`), `headerSubtitle` (`color: "rgba(255,255,255,0.55)"`).
     * `Satır 680-730`: Takvim grid'indeki gün numaraları (`calendarDayText`), açık modda beyaz daireler ve açık pembe zemin üzerinde kayboluyor.
     * Rehber ve destek kartlarında açık modda metin renkleri zeminle aynı tona yaklaşıyor.

  6. 📅 **Takvim Ekranı (`src/app/(tabs)/calendar.tsx`):**
     * `Satır 775-786`: `headerTitle` (`color: "#ffffff"`), `headerSubtitle` (`color: "rgba(255,255,255,0.55)"`).
     * `Satır 800-810`: `selectedDayDate` (`color: "#ffffff"`), `selectedDaySub` (`color: "rgba(255,255,255,0.5)"`).
     * `Satır 830-860`: Filtre çipleri (`Not`, `Ruh Halim`, `Partnerim`, `Fotoğraf`, `Buluşma`, `Döngü`) ve takvim gün kutuları açık modda yetersiz sınır çizgisine sahip.

  7. 💊 **İlaç Takibi Ekranı (`src/app/(tabs)/medicine.tsx`):**
     * `Satır 732-743`: `headerTitle` (`color: "#ffffff"`), `headerSubtitle` (`color: "rgba(255,255,255,0.55)"`).
     * `Satır 750-765`: `quickActionCard` ve `quickActionTitle` (`color: "#ffffff"`).
     * `Satır 790-840`: İlaç kartları listesi ve günlük doz sayaçları açık modda beyaz üzeri beyaz kalıyor.

  8. 📖 **Günlüklerim Ekranı (`src/app/(tabs)/daily-notes.tsx`):**
     * `Satır 461-472`: `headerTitle` (`color: "#ffffff"`), `headerSubtitle` (`color: "rgba(255,255,255,0.55)"`).
     * `Satır 477-490`: `writeNoteActionBtn` kartı.
     * `Satır 520-560`: Günlük notu kartları (`noteSnippet`, `noteDate`) açık modda aşırı silik.

  9. 👤 **Profil & Ayarlar Ekranı (`src/app/(tabs)/profile.tsx`):**
     * `Satır 543-554`: `headerTitle` (`color: "#ffffff"`), `headerSubtitle` (`color: "rgba(255,255,255,0.55)"`).
     * `Satır 562-580`: `heroProfileCard` ve ayar menü satırları (`settingRow`) açık modda kenarlıksız beyaz kart olarak duruyor.

  10. 📝 **Anı Ekle Ekranı (`src/app/(tabs)/add-memory.tsx`):**
      * `Satır 265, 305`: `theme.unitBg` açık modda saf beyazken kart kenarlıkları (`cardBorder`) neredeyse görünmez; `placeholderTextColor` açık gri olarak kayboluyor.

  11. 🗺️ **Harita Konum Seçici Modalı (`src/components/MapPickerModal.tsx`):**
      * Arama kutusu ve alttaki seçilen konum onay kartı açık modda harita üzerinde koyu/açık uyumsuzluğu yaşıyor, metinler seçilemiyor.

  12. ⏱️ **Tarih & Saat Seçici Sheet (`src/components/ui/DateTimePickerSheet.tsx`):**
      * Modal zemininde açık mod aktifken butonlar ve takvim başlığı zemin rengiyle çakışıyor.

* **Kullanıcı Beklentisi:**
  * Açık temada (hem kadın hem erkek) tüm kartlar saf beyaz zeminde belirgin gölgeler (`shadow-sm`) veya zarif kenarlıklar ile zeminden ayrılmalıdır.
  * Başlıklar, giriş metinleri ve etiketler net, okunabilir koyu tonlarda (`#0F172A` / `#1E1B24`); placeholder'lar ve alt başlıklar belirgin gri (`#64748B` / `#5E5366`) olmalıdır.
  * Hiçbir ekranda `#ffffff` veya `rgba(255,255,255)` rengi dinamik tema kontrolü olmadan arayüz metinlerine ve inputlara sert kodlanmamalıdır.

---

### [ZOR-2] 🚫 Genel: Tasarımsız Ham Sistem Alert'lerinin (`Alert.alert`) Kaldırılması
* **Sorun Nedir? (NE):** Döngü takviminde veya diğer ekranlarda dokunulduğunda çiğ, estetikten uzak, siyah/koyu gri sistem pop-up'ı (`Bilgi 🌸 Regl takvimini yalnızca kadın partner güncelleyebilir. OK`) açılıyor. Kullanıcı uygulamanın hiçbir yerinde böyle tasarımsız uyarı istemiyor.
* **Nerededir? (NEREDE):**
  * `src/app/(tabs)/period-tracker.tsx` (ve uygulama genelindeki tüm standart `Alert.alert` kullanımları)
* **Kullanıcı Beklentisi:** Ham sistem diyalogları tamamen kaldırılmalı; uygulamanın lüks aşk estetiğine uygun cam efektli, pastel tonlu özel Toast veya zarif Bottom Sheet/Modal uyarıları kullanılmalıdır.

---

### [ZOR-3] 💎 Demo Modunda Kullanıcıyı Kaçıran Premium / Kilit Duvarlarının Kaldırılması
* **Sorun Nedir? (NE):** Demo modunu inceleyen kullanıcıya takvimde `Fotoğraflar Gizli - Premium'a geçin 🔒`, döngü takviminde `VIP ÇİFT AYRICALIĞI 👑` şeklinde kilitler gösteriliyor. Kullanıcı henüz kayıt olmadan bu kilitleri görünce uygulamadan uzaklaşıyor.
* **Nerededir? (NEREDE):**
  * `src/components/photos/PhotosLockCard.tsx`
  * `src/app/(tabs)/period-tracker.tsx` (VIP kilit ekranı)
  * `src/app/(tabs)/calendar.tsx`
* **Kullanıcı Beklentisi:** Demo modunda tüm Premium kilitleri devre dışı bırakılmalı; kullanıcı tüm özellikleri açık ve dolu gibi deneyimleyebilmelidir.

---

### [ZOR-4] 🌸 Demo Modunun Her Zaman Kadınlara Hitap Eden Pembe Modda Başlatılması
* **Sorun Nedir? (NE):** Demo modu bazen açık gri veya koyu temada başlayabiliyor. Hedef kitle kadınlar olduğu için ilk izlenim zayıf kalıyor.
* **Nerededir? (NEREDE):**
  * `src/context/ThemeContext.tsx`
  * `src/context/AuthContext.tsx` (`enterDemoMode` fonksiyonu)
* **Kullanıcı Beklentisi:** Demo modu açıldığında varsayılan tema her zaman romantik pembe (Rose & Soft Pink / Kadın Modu) olarak açılmalıdır.

---

### [ZOR-5] 🌌 Kozmik Bağlar: Arkadaşın Çift Kodunu Arama ve Bağlantı Kurma Ekranı
* **Sorun Nedir? (NE):** Gökyüzü modülündeki "Kozmik Bağlar" modalında sadece kendi çift kodu gösteriliyor. Arkadaşın / diğer çiftin kodunu aratıp takımyıldız bağı kuracak bir giriş alanı (input) bulunmuyor.
* **Nerededir? (NEREDE):**
  * `src/modules/stars/components/StarConnectionModal.tsx`
  * `src/modules/stars/components/OurStarScreen.tsx`
* **Kullanıcı Beklentisi:** Modala 6 haneli çift kodu giriş alanı ve "Bağlantı Kur" butonu eklenerek diğer çiftin yıldızıyla kozmik bağ kurulabilmelidir.

---

### [ZOR-6] 🪐 Gökyüzü: "Yıldızımıza Gir" Denildiğinde Önce Dış Görünümün Sergilenmesi
* **Sorun Nedir? (NE):** Menüden "Yıldızımıza Gir" seçildiğinde kamera hemen yıldızın iç küresine odaklanıyor ve yıldızın dışındaki uzay ihtişamı atlanıyor.
* **Nerededir? (NEREDE):**
  * `src/modules/stars/canvas/macro/useSkyCamera.ts` (kamera açılış pozisyonu ve animasyon hedefi)
  * `src/modules/stars/components/OurStarScreen.tsx`
* **Kullanıcı Beklentisi:** Kamera ilk açılışta doğrudan yıldızın içine değil, önce yıldızın uzaydaki parıltılı dış görünümüne konumlanmalıdır. ANCAK KULLANICI AYNI BEKLENTİYİ DEMO MODUNDA DA İSTEMEKTEDİR.

---

### [ZOR-7] 🩸 Döngü & Regl Takvimi: "Sonraki Döngü 40 Gün" Mantık Hatasının Düzeltilmesi
* **Sorun Nedir? (NE):** Döngü takviminde "Sonraki döngü 40 gün" şeklinde kadın biyolojisine aykırı ve mantıksız bir hesaplama çıkıyor.
* **Nerededir? (NEREDE):**
  * `src/app/(tabs)/period-tracker.tsx` (döngü tahmin algoritması ve geçmiş kayıt ortalaması fonksiyonu)
* **Kullanıcı Beklentisi:** Standart medikal döngü süresi (28 gün varsayılan) baz alınmalı, 40 gün gibi anormal sapmalar engellenmelidir.

---

# 🔴 4. BÖLÜM: ÇOK ZOR İŞLER (Yeni CRUD Akışları, Medya Yükleme & Premium Mimarisi)

---

### [ÇOK ZOR-1] ✏️ Buluşmalar: Oluşturan Kişi İçin "Düzenle" (Edit Meetup) Akışı
* **Sorun Nedir? (NE):** "Yaklaşan Buluşmalar" kartında sağ üstte yalnızca kırmızı çöp kutusu (Sil) butonu bulunuyor. Buluşmayı oluşturan partner yanlış tarih, saat veya konum girdiğinde düzenleyemiyor; silip baştan oluşturmak zorunda kalıyor.
* **Nerededir? (NEREDE):**
  * `src/app/(tabs)/meetings.tsx` (Buluşmalar listesi ve kart render bloğu)
  * Buluşma oluşturma formu / modalı (`src/components/meetings/` veya `meetings.tsx` içindeki modal)
  * Supabase `meetings` tablosu `update` sorgusu
* **Kullanıcı Beklentisi:** Buluşmayı oluşturan kişi (`created_by === current_user_id`) için silme butonunun yanına bir **"Düzenle" (Kalem ikonu)** butonu eklenmeli; form mevcut verilerle açılarak güncellenebilmelidir.

---

### [ÇOK ZOR-2] 📸 Uygulama Menüsünde & Profilde Profil Fotoğrafı (PP) Yükleme Sistemi ve Premium Sızıntı Koruması
* **Sorun ve İhtiyaç Tanımı (NE):**
  * Uygulama menüsünde (Drawer/Sidebar: `menu.tsx`) ve Ayarlar ekranında (`profile.tsx`) profil kartındaki avatar alanında yalnızca ismin baş harfi ("O", "E" vb.) pembe/mavi bir daire içinde gösteriliyor.
  * Kullanıcıların kendi sevdikleri profil fotoğraflarını (PP) yükleyebilmesi, kırpabilmesi ve bunu hem menüde hem de takvimdeki not imzalarında partneriyle karşılıklı görebilmesi istenmektedir.
  * **EN KRİTİK ŞART:** Bu özellik **SADECE VE SADECE PREMIUM KULLANICILARA ÖZEL BİR VIP AYRICALIK** olacaktır. Ücretsiz kullanıcıların bu özelliği kullanması kesinlikle engellenmeli ve hiçbir şekilde "Premium Sızıntısı" (paywall bypass) yaşanmamalıdır.

* **UI / UX ve Kullanıcı Deneyimi Akışı (Nerede ve Nasıl Çalışacak?):**
  1. **Tetikleyici Arayüz Noktaları (Triggers):**
     * `src/app/menu.tsx` (Satır 174-177): Menüdeki profil avatar dairesi.
     * `src/app/(tabs)/profile.tsx` (Satır 333-336): Profil Ayarları hero kartındaki avatar dairesi.
     * *Görsel İpucu:* Avatar dairesinin sağ alt köşesinde minik bir kamera/düzenleme rozeti (`Camera` veya `Sparkles` ikonu) yer almalı; kullanıcı bu alana dokunulabileceğini ilk bakışta hissetmelidir.
  2. **Ücretsiz (Non-Premium) Kullanıcı Dokunduğunda:**
     * Kamera veya galeri izni ASLA istenmemeli ve açılmamalıdır.
     * Doğrudan şık bir `PremiumPaywall` veya PP'ye özel bir VIP Ayrıcalık modalı açılmalıdır:  
       *"Özel Profil Fotoğrafı Premium Üyelere Özeldir 👑 Sevgilinizle birbirinizin en tatlı fotoğraflarını profilinizde görmek için Premium'a geçin."*
  3. **Demo Modundaki Kullanıcı Dokunduğunda:**
     * Demo kullanıcısı dokunduğunda `useDemoAction` / `executeOrIntercept` devreye girerek kullanıcıyı kaçırmadan *"Profilinizi Özelleştirmek İçin Ücretsiz Kayıt Olun 📸"* kayıt daveti sunulmalıdır.
  4. **Premium Kullanıcı Dokunduğunda (Yükleme Akışı):**
     * Yeni, hantal bir sayfa açmak yerine ekranın altından modern, cam efektli bir **Avatar İşlem Menüsü (Action Sheet / Bottom Sheet)** açılmalıdır:
       - 📸 **"Fotoğraf Çek"** (`expo-image-picker` kamera modu)
       - 🖼️ **"Galeriden Seç"** (`expo-image-picker` galeri modu)
       - 🗑️ **"Mevcut Fotoğrafı Kaldır"** (Kullanıcı dilerse harf avatarına geri dönebilmeli)
       - ❌ **"Vazgeç"**
     * Fotoğraf seçilirken `allowsEditing: true`, `aspect: [1, 1]` ile kullanıcının yüzünü tam kare olarak kırpmasına olanak tanınmalıdır.
     * Seçilen görsel `expo-image-manipulator` ile hafifçe optimize edilmeli (örn. max 500x500px, WebP veya sıkıştırılmış JPEG; devasa 10MB fotoğrafların JS heap'i ve depolamayı şişirmesi engellenmelidir).
     * Yükleme esnasında avatar dairesi üzerinde minik, estetik bir `ActivityIndicator` (yükleniyor çarkı) dönmelidir.
     * Yükleme başarılı olduğunda harf ikonu kaybolmalı, kullanıcının seçtiği fotoğraf yuvarlak maskeli olarak yerleşmelidir.

* **🛡️ Premium Sızıntılarını ve Güvenlik Açıklarını Önleme Kriterleri (Anti-Bypass & Security Guard):**
  * **1. Çift Katmanlı İstemci Koruması (Client-Side Guards):**
    * Sadece arayüzde butona basılmasını engellemek yetmez; yükleme fonksiyonunun (`uploadAvatar`) en tepesinde `if (!profile?.isPremium) { setShowPaywall(true); return; }` sert kontrolü bulunmalıdır.
    * Kodun hiçbir yerinde `isPremium` kontrolü atlanarak doğrudan storage yükleme fonksiyonu tetiklenememelidir.
  * **2. Sunucu & Depolama Tarafı Güvenliği (Supabase Storage & RLS):**
    * Yüklenen görsel Supabase Storage'daki `avatars` bucket'ına atılmalıdır.
    * Dosya yolu mutlaka kullanıcı ID'siyle yalıtılmalıdır: `${userId}/avatar.jpg`. Bir kullanıcının başka bir kullanıcının avatarını ezmesi veya yetkisiz dizinlere dosya atması RLS politikalarıyla imkansız kılınmalıdır.
    * `users` tablosundaki `avatar_url` sütununa yalnızca oturumu açık kullanıcının kendi `auth.uid() == id` satırı yazabilmelidir.
  * **3. Önbellek Çakışması Koruması (Cache-Busting):**
    * Kullanıcı fotoğrafını değiştirdiğinde, aynı dosya adı kullanılırsa `expo-image` önbelleği eski fotoğrafı göstermeye devam edebilir. Bu nedenle yüklenen URL sonuna benzersiz bir zaman damgası (`?v=${Date.now()}`) veya rastgele bir hash eklenerek önbelleğin anında yenilenmesi garanti edilmelidir.
  * **4. Eş ve Sistem Senkronizasyonu (Realtime Sync):**
    * Yükleme tamamlandığında `refreshProfile()` çağrılarak `AuthContext` içindeki güncel profil yenilenmeli; `queryClient.invalidateQueries` ile ana sayfa, menü ve takvim ekranlarındaki yazar avatarları (`getAuthorAvatar`) anında yeni fotoğrafla güncellenmelidir.

* **🌟 Profil Fotoğrafının (PP) Uygulama Genelindeki 7 Kritik Kullanım Alanı (Premium Değer Vitrini):**
  *Profil fotoğrafı sadece menüdeki küçük bir dairede kalırsa Premium için yeterli satın alma motivasyonu yaratmaz. Bu nedenle profil fotoğrafı uygulamanın tüm romantik dokusuna entegre edilmeli ve aşağıdaki alanlarda karşılıklı sergilenmelidir:*

  1. 🏠 **Ana Sayfa: Birbirine Bağlı Çift Halkası & Canlı Ruh Hali (`src/app/(tabs)/home.tsx`):**
     * Ana sayfanın en üstünde veya "Aşkımızın Yolculuğu" kartında iç içe geçmiş iki zarif dairede çiftin fotoğrafları yer alır: `[ Sen ] ❤️ [ Sevgilin ]`.
     * Sevgilinizin fotoğrafının sağ alt köşesinde o anki ruh hali emojisi (örn: 🥰, 😊, 😴) minik bir canlı rozet olarak parlar.
  2. 💌 **Mektuplar: Mühür & Gönderen Pulu (`src/app/(tabs)/letters.tsx` & `src/components/home/PendingLettersCard.tsx`):**
     * Bekleyen ve gelen mektup kartlarında mum mührün yanında veya zarfın köşesinde sevgilinizin gülen profil fotoğrafı ve *"Sevgilin Ayşe'den Geleceğe Mühürlü Mektup 💌"* damgası yer alır. Mektup açıldığında başlıkta sevgilinin fotoğrafı karşılar.
  3. 📖 **Takvim & Günün Notları: İmzalı Romantik Defter (`src/components/calendar/NoteMemoryCard.tsx` & `src/app/(tabs)/calendar.tsx`):**
     * Takvimde bırakılan günlük aşk notlarında veya hatıralarda harf ikonu yerine doğrudan sevgilinizin fotoğrafı bir imza pulu gibi görünür:  
       `[Ayşe'nin Fotoğrafı] "Bugün kahve içerken seni ne kadar çok özlediğimi fark ettim..." — 19:38` *(Zaten `NoteMemoryCard.tsx:L88-95` içinde `avatarUrl` altyapısı hazır olan yer!)*
  4. 📍 **Aşk Haritası: Fotoğraflı Harita Pinleri (`src/app/(tabs)/map.tsx` & `src/components/map/MapDetailCard.tsx`):**
     * Harita üzerindeki sıradan kırmızı iğneler yerine, o anıyı veya buluşmayı kim eklediyse onun mini dairesel fotoğrafı harita baloncuğu olarak parlar. Çift haritaya baktığında anıları fotoğraflarla tanır.
  5. 🍷 **Buluşmalar: "Randevuyu Planlayan" İmzası (`src/app/(tabs)/meetings.tsx` & Ana Sayfa Sıradaki Buluşma):**
     * Sıradaki buluşma geri sayım sayacında ve buluşma kartlarında randevuyu oluşturan partnerin profil fotoğrafı yer alır:  
       `[Emirhan'ın Fotoğrafı] "Emirhan bu Cuma için romantik bir akşam yemeği planladı ✨"`
  6. 🌌 **Gökyüzü / Yıldızımız: Ortak Yıldızın Yörüngesinde İki Ruh (`src/modules/stars/components/OurStarScreen.tsx`):**
     * 3D Yıldız sahnesinde ve yıldız detay modalında, çiftin gökyüzündeki ortak yıldızının etrafında dönen ışık huzmelerinin ucunda iki partnerin ışıldayan minik fotoğrafları yer alır.
  7. 📱 **Telefon Ana Ekran Widget'ı (`widgets/CoupleWidget`):**
     * Uygulamanın `expo-widgets` altyapısında, telefonun kilit veya ana ekranına yerleştirilen widget'ta sevgilinizin gerçek fotoğrafı ve altında *"365 Gündür Birlikteyiz ❤️"* sayacı sergilenir.

* **Teknik Etkileşim ve Kod Konumları (NEREDE):**
  * `src/app/menu.tsx`: Satır 174-177 (`styles.avatarCircle` ve kullanıcı kartı)
  * `src/app/(tabs)/profile.tsx`: Satır 333-336 (`styles.avatarCircle` ve `isPremium` rozeti)
  * `src/app/(tabs)/home.tsx`: Çift başlığı ve karşılama alanı
  * `src/context/AuthContext.tsx`: Profil tipi (`profile.avatarUrl`) ve `refreshProfile` mekanizması
  * `src/components/calendar/NoteMemoryCard.tsx`: Satır 88-95 (`avatarUrl ? <Image source={{ uri: avatarUrl }} ... /> : ...` mevcut kullanım alanı)
  * `src/app/(tabs)/calendar.tsx`: Satır 431-434 (`getAuthorAvatar` fonksiyonu)
  * `src/app/(tabs)/map.tsx` & `src/components/map/`: Harita marker balonları
  * `src/app/(tabs)/letters.tsx`: Mektup listesi ve detay kartları
  * Paketler (Zaten Kurulu): `expo-image-picker`, `expo-image-manipulator`, `expo-image`, `base64-arraybuffer`

* **Kullanıcı Beklentisi:**
  * Premium kullanıcı menüden veya ayarlardan tek dokunuşla profil fotoğrafını seçip kare kırparak yükleyebilmeli; fotoğraf sadece menüde kalmayıp ana sayfada, takvim notlarında, mektuplarda ve haritada çiftin aşkını taçlandırmalıdır.
  * Ücretsiz kullanıcılar bu alana dokunduğunda Premium Paywall ile karşılaşmalı, hiçbir şekilde açık veya sızıntı yoluyla fotoğraf yükleyememelidir.
