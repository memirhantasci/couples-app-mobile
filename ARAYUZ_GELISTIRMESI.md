# Couples App Mobile - Arayüz ve Fonksiyonel Geliştirme Dokümanı

Bu belge, uygulamadaki bildirilen hataları, arayüz aksaklıklarını ve talep edilen yeni özellikleri Claude'un en az araştırma token'ı harcayarak doğrudan çözüme odaklanabilmesi amacıyla hazırlanmıştır. 

> **Geliştirici Notu:** Bu dokümanda doğrudan kod yamaları veya "şunu şöyle yaz" talimatları yer almamaktadır. Her maddenin **mevcut durumu (sorun)**, **kullanıcı beklentisi** ve araştırmayı hızlandırmak için **derinlemesine mimari bağlamı (ilgili dosyalar, state'ler ve akışlar)** sunulmuştur. Çözüm mimarisini ve kod uygulamasını Claude kendisi tasarlamalıdır.
> 
> *Not: Tamamlanan 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3 ve 2.4 numaralı görevler dokümandan temizlenmiş; geriye yalnızca üzerinde çalışılacak aktif görevler bırakılmıştır.*

---

## 🟢 1. BÖLÜM: KOLAY İŞLER (Quick Wins)

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

## 🟡 2. BÖLÜM: ORTA İŞLER (Feature Polish & Consistency)

---

### Görev 2.5: Sahipsiz / Tescilsiz Yıldızların Farklı Parlaklıklarda Olması ve Mag Değerlerinin Tutarsızlığı [TAMAMLANDI ✅]
* **Uygulanan Çözüm:** Yıldızın görünümü artık hiçbir zaman katalog kadirinden (`mag`) gelmiyor. Tüm sahipsiz yıldızlar aynı sabit ve düşük ışıkla (`UNCLAIMED_STAR_BRIGHTNESS = 0.20`, sunucunun 0 puanlı parlaklığı) aynı boyutta, titreşmeden ve beyaz çekirdek olmadan çizilir; tescilli yıldızın boyutu, opaklığı, ışıması ve titreşimi yalnızca çiftin aktivite ışığıyla büyür (tescilli yıldız hiçbir zaman sahipsizden sönük çizilmez). Kadir yalnızca hangi zoom'da hangi yıldızların yükleneceğini belirler. Seçilen yıldız kartında "Parlaklık" artık `mag` değil: sahipsizlerde herkes için `%20`, kendi/bağlı yıldızda gerçek ışık, diğer tescillilerde "Gizemli" yazar; sahiplenme ve demo modallarındaki `mag` gösterimi de kaldırıldı (`starStyle.ts`, `starField.ts`, `drawSkyFrame.ts`, `hitTest.ts`, `skyOverlay.ts`, `OurStarScreen.tsx`, `ClaimStarModal.tsx`, `StarDemoAuthModal.tsx`).
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
* **Kategori:** Orta / İş Mantığı (Business Logic), Kısıtlamalar (Cooldown) & Tema Senkronizasyonu
* **Mevcut Sorunlar:**
  1. *Sınırsız Değişiklik Açığı:* Görünen isim, cinsiyet tercihi ve ilişki başlangıç/tanışma tarihleri kullanıcı tarafından hiçbir sınır, cooldown veya hak kısıtlaması olmaksızın anlık olarak sınırsız kez değiştirilebilmektedir. Bu durum veritabanında gereksiz manipülasyonlara ve partner tarafında tutarsızlıklara yol açabilmektedir.
  2. *Cinsiyet Değişimi Tema Uyumsuzluğu:* Kullanıcı cinsiyet tercihini değiştirdiğinde (örneğin Kadın'dan Erkek'e veya tam tersi), arayüz tema seçeneklerinin ve mevcut aktif temanın bu yeni cinsiyete göre otomatik güncellenmesi gerekirken tema uyumsuz kalabilmektedir.
* **Kullanıcının Belirlediği Kesin İş Mantığı ve Kurallar:**

  #### 1. Görünen İsim (30 Günde 1 - Kişi Bazlı):
  * **Periyot:** Kullanıcı görünen ismini **30 günde bir** değiştirebilir.
  * **İlk Kurulum Hakkı:** Kullanıcı hesap kurulumunda ismini yanlış veya eksik yazmış olabileceğinden, kurulumdan sonra **30 gün beklemesi istenmez**; kurulum anında doğrudan kullanabileceği **1 adet anında değişiklik hakkı** hazır olarak tanımlıdır.
  * **Sayaç Başlangıcı:** Bu ilk hak kullanıldığı anda 30 günlük bekleme süresi (cooldown) başlar. Süre dolmadan yeni bir isim değişikliği yapılamaz.
  * **Yetki Kapsamı:** **Kişi bazlıdır**. Kullanıcının isim değişikliği yalnızca kendi profilini bağlar, partnerin isim değiştirme hakkını veya süresini etkilemez.
  * **Arayüz Bildirimi:** Kilitliyken butonda veya form altında *"Sonraki isim değişikliği için X gün kaldı"* bilgisi verilir. Değişiklik onay modalında: *"İsminizi değiştirmek üzeresiniz. Bu işlem sonrasında 30 gün boyunca tekrar isim değiştiremezsiniz. Onaylıyor musunuz?"* uyarısı gösterilir.

  #### 2. Cinsiyet Tercihi (90 Günde 1 - Kişi Bazlı + Anında Tema Senkronizasyonu):
  * **Periyot:** Cinsiyet tercihi **90 günde bir** değiştirilebilir.
  * **İlk Kurulum Hakkı:** Kurulum aşamasında yanlış cinsiyet seçilmiş olma ihtimaline karşılık kullanıcıya **1 adet anında düzeltme hakkı** hazır verilir; kurulumdan hemen sonra 90 gün beklenmez.
  * **Sayaç Başlangıcı:** Bu ilk değişiklik yapıldığı andan itibaren 90 günlük bekleme süresi devreye girer.
  * **Yetki Kapsamı:** **Kişi bazlıdır**.
  * **Otomatik Tema & Modül Senkronizasyonu:**
    - Cinsiyet değiştirildiği anda `ThemeContext` anında yeni cinsiyete adapte edilmelidir.
    - Örneğin Kadın'dan Erkek'e geçildiyse kadın gül temasından erkek varsayılan temasına (veya tersi) pürüzsüz geçiş sağlanmalı ve tema seçici kartları anında yeni cinsiyet paletini sunmalıdır.
    - Regl takvimi gibi cinsiyete özel modüller ve arayüz kartları anında kullanıcının yeni cinsiyetine uygun duruma getirilmelidir.
  * **Arayüz Bildirimi:** Onay modalında: *"Cinsiyet tercihinizi değiştirmek üzeresiniz. Bu işlem tema paletinizi ve cinsiyete özel modülleri doğrudan güncelleyecektir. Sonraki 90 gün boyunca tekrar cinsiyet değiştiremezsiniz. Onaylıyor musunuz?"* uyarısı yer alır.

  #### 3. İlişki Tarihleri: Tanışma & Sevgili Olma (30 Günde 1 - İLİŞKİ / ÇİFT BAZLI):
  * **Periyot:** İlişki tarihleri (Tanışma Tarihi ve Sevgili Olma Tarihi) **30 günde bir** değiştirilebilir.
  * **İlk Kurulum Hakkı:** Kurulum sırasında tarihlerin yanlış girilmiş olma ihtimali yüksek olduğundan, kurulumdan sonra 30 gün beklenmez; **çifte hemen kullanabileceği 1 ortak düzeltme hakkı** doğrudan hazır verilir.
  * **ÇİFT (İLİŞKİ) BAZLI KURAL (ÇOK ÖNEMLİ):**
    - Bu hak kişi bazlı **değildir**, doğrudan **ilişki / çift (couple) bazlıdır**.
    - Çiftlerden herhangi bir tanesi (Partner A veya Partner B) tarihleri güncellediği anda **o ortak hak tamamen biter**.
    - **Her iki partner için birden** 30 günlük bekleme süresi başlar. Değişikliği yapmayan diğer partner de sonraki 30 gün boyunca tarihleri değiştiremez.
    - 30 gün dolduktan sonra çift ortak olarak tekrar 1 hak kazanır (hangi partner önce davranırsa o hak ikisi için de tekrar tüketilir).
  * **Arayüz Bildirimi:** Değişiklik öncesi onay modalında açıkça belirtilmelidir: *"İlişki tarihlerinizi güncellemek üzeresiniz. Bu işlem ana sayfa sayaçlarınızı ve Özel Günler arşivinizi güncelleyecektir. Bu hak çift bazlıdır; siz güncellediğinizde partneriniz de dahil olmak üzere her iki taraf için sonraki 30 gün boyunca tarih değişimi kilitlenecektir. Onaylıyor musunuz?"*
  * **Kilit Durumu:** Süre devam ederken her iki tarafın profilinde de tarih seçici alanında kilit ikonu ve *"İlişki tarihleri partneriniz veya sizin tarafınızdan yakın zamanda güncellendi. Sonraki değişiklik için X gün kaldı"* mesajı yer almalıdır.

* **Araştırma & Mimari Bağlam:**
  * **İlgili Dosyalar:**
    * [`src/app/(tabs)/profile.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/app/(tabs)/profile.tsx)
    * [`src/context/ThemeContext.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/context/ThemeContext.tsx)
    * [`src/lib/theme.ts`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/lib/theme.ts)
    * [`src/components/profile/PersonalInfoForm.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/components/profile/PersonalInfoForm.tsx)
    * [`src/components/profile/ThemePicker.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/components/profile/ThemePicker.tsx)
    * `supabase/migrations/`
  * **Veritabanı & Şema Tasarım Rehberi:**
    1. **`users` Tablosu (Kişi Bazlı):**
       * `name_last_changed_at TIMESTAMPTZ DEFAULT NULL`
       * `gender_last_changed_at TIMESTAMPTZ DEFAULT NULL`
       * *İlk Hak Mantığı:* Değer `NULL` iken kullanıcının ilk hakkı hazır kabul edilir. Değişiklik yapıldığı anda `NOW()` yazılır. Değer `NULL` değilse `NOW() - last_changed_at >= interval '30 days'` (veya '90 days') kontrolü yapılır. Böylece hem yeni kullanıcılar hem de mevcut kullanıcılar için ek bayrağa gerek kalmadan ilk hak kusursuz işler.
    2. **`couples` Tablosu (Çift Bazlı):**
       * `dates_last_changed_at TIMESTAMPTZ DEFAULT NULL`
       * *Çift Bazlı İlk Hak Mantığı:* `couples` tablosundaki bu alan `NULL` iken çiftin 1 ilk düzeltme hakkı vardır. Çiftlerden kim güncellerse güncellesin `dates_last_changed_at = NOW()` yapılır. Böylece her iki kullanıcı da sorgulandığında `couples` tablosundaki ortak zaman damgasını okur ve ikisi için birden 30 günlük kilit devreye girer.

---

## 🔴 3. BÖLÜM: ZOR İŞLER (Product Decisions & Platform Features)

---

### Görev 3.1: Mektuplarda Silme ve Gizleme Politikası (Ürün Kararı & Mimari Tasarım) [TAMAMLANDI ✅]
* **Uygulanan Ürün Kararı:**
  1. Gönderilen mektup açılış gününe kadar **silinemez** (mektup karşı tarafa ulaşmalı).
  2. Her iki taraf da mektubu **yalnızca kendi listesinden gizleyebilir** ve "Gizlenenler" görünümünden dilediği an geri getirebilir (ör. uygulamayı denerken yazılan deneme mektubu yer kaplamaz). Gizlemek partneri etkilemez.
  3. Açılıştan **72 saat** sonra gönderen silme **isteyebilir**; alıcıya bildirim gider ve mektup kartında "Saklansın / Silinmesine İzin Ver" kararı çıkar. **Alıcı onay vermeden mektup silinmez.**
  4. Onaylanan mektup en erken açılıştan **72 saat** sonra silinir (onay daha sonra verilirse hemen). Silinene kadar gönderen isteğini geri çekebilir, alıcı onayından vazgeçebilir. Reddedilen istek 72 saat sonra yeniden gönderilebilir.
* **Uygulanan Mimari:** `20261022000002_letter_hide_and_deletion_consent.sql` — `hidden_by_sender`, `hidden_by_receiver`, `deletion_requested_at`, `deletion_approved_at`, `deletion_rejected_at` kolonları; `set_letter_hidden`, `request_letter_deletion`, `cancel_letter_deletion`, `respond_letter_deletion` RPC'leri; onaylanıp vakti gelenleri silen saatlik `letter-deletion-purge` pg_cron işi. Göndericinin mektubu doğrudan silmesine/güncellemesine izin veren eski "Update/Delete own sent letters" politikaları kaldırıldı. İstemci kuralları: `src/lib/letterPolicy.ts`; arayüz: `letters.tsx` (kart "⋯" menüsü, karar kutusu, durum şeritleri, onay bekleyen istek bandı, Gizlenenler görünümü).
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
    Mektuplar uçtan uca AES şifrelidir (`encrypt` / `decrypt`). `letters` tablosunda `018_security_and_manipulation_fixes.sql` migration'ı ile kilitli mektupların erken okunması RLS seviyesinde engellenmiştir. Silme veya gizleme özelliği eklendiğinde `letters` tablosuna `is_hidden_by_sender`, `is_hidden_by_receiver` veya `deleted_at` gibi kolonların gerekip gerekmediği ve RLS kuralları değerlendirilmelidir.

---

### Görev 3.2: Widget İyileştirmeleri: Fotoğraf Yerleşimi, Partner Ruh Hali, Bildirim Sayacı & Premium Kilitleme [TAMAMLANDI ✅]
* **Uygulanan Çözüm (iOS + Android aynı):**
  1. Çift fotoğrafları her boyda **sağ üst köşede küçük ve yan yana**; birbirini örtmez.
  2. Partnerin bugünkü ruh hali küçük/orta boyda kartta, büyük boyda büyük emojili ayrı bir kartta ("Ayşe bugün · Mutlu").
  3. **Okunmamış rozeti** (`unreadCount` + `letterUnlocksMs`): mektuplar ekranına son girişten beri gelen/açılan mektuplar + yanıt bekleyen silme istekleri. Alıcıya gelen kilitli mektupların açılış anları da widget'a verilir; uygulama kapalıyken mektup açıldığında rozet kendiliğinden artar (iOS zaman çizelgesi kaydı, Android alarm). Rozete dokununca mektuplar açılır; mektuplar ekranı görülünce rozet sıfırlanır (`src/lib/widgetUnread.ts`).
  4. Premium kilidi korunuyor: ücretsiz kullanıcıda kilit görünümü ve paywall bağlantısı; Premium bitişinde widget kendini kilitler.
  * **Sınır:** Uygulama kapalıyken partnerin yeni gönderdiği mektup ya da push bildirimleri rozete ancak uygulama bir sonraki açılışta senkronlandığında yansır (arka planda push işleme yok).
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

## 📌 Aktif Görevler Özet Tablosu

| No | Görev Başlığı | Modül / Dosya | Zorluk | Öncelik | Durum |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1.4** | Yıldızımızdaki "Kıvılcım" terimi ve UX anlatımı | `MicroStarHeader.tsx`, `StarSparkManager.ts` | 🟢 Kolay | Orta | Beklemede |
| **2.5** | Sahipsiz yıldızların eşit düşük parlaklığa ve mag tutarlılığına çekilmesi | `starStyle.ts`, `OurStarScreen.tsx` | 🟡 Orta | Orta | Tamamlandı ✅ |
| **2.6** | Yıldızımız ekranı alt panel buton karmaşıklığının giderilmesi | `OurStarScreen.tsx`, `MicroSystemDock.tsx` | 🟡 Orta | Orta | Beklemede |
| **2.7** | Görünen isim, cinsiyet ve tarih değişim limitleri & tema senkronu | `profile.tsx`, `ThemeContext.tsx`, Supabase | 🟡 Orta | Yüksek | Kurallar Belirlendi |
| **3.1** | Mektuplarda silme/gizleme politikası tasarımı ve RLS kurgusu | `letters.tsx`, Supabase RLS | 🔴 Zor | Orta | Tamamlandı ✅ |
| **3.2** | Widget sağ üst avatar, ruh hali, bildirim sayısı & premium kilit | `CoupleWidget.tsx`, `widgetBridge.ts` | 🔴 Zor | Yüksek | Tamamlandı ✅ |


kıvılcım kalkacak mı duracak mı karar ver 
uygulama şifrelemesi ne kadar güvenli ona göre ilerle 
yıldızda en alttaki karmaşıklığı gider 
uygulamadaki tüm sesleri test et 
yıldız mantığı çalışıyor mu test et 
Arkadaş ekle yıldız olarak test et
fotoğaf yüklemeye sınır konmalı mı 