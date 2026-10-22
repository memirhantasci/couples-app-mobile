# Couples App Mobile - Arayüz ve Fonksiyonel Geliştirme Dokümanı

Bu belge, uygulamadaki bildirilen hataları, arayüz aksaklıklarını ve talep edilen yeni özellikleri Claude'un en az araştırma token'ı harcayarak doğrudan çözüme odaklanabilmesi amacıyla hazırlanmıştır. 

> **Geliştirici Notu:** Bu dokümanda doğrudan kod yamaları veya "şunu şöyle yaz" talimatları yer almamaktadır. Her maddenin **mevcut durumu (sorun)**, **kullanıcı beklentisi** ve araştırmayı hızlandırmak için **derinlemesine mimari bağlamı (ilgili dosyalar, state'ler ve akışlar)** sunulmuştur. Çözüm mimarisini ve kod uygulamasını Claude kendisi tasarlamalıdır.
> 
> *Not: Tamamlanan 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1 ve 3.2 numaralı görevler başarıyla commit edilerek dokümandan temizlenmiştir. Geriye yalnızca üzerinde çalışılacak aktif görevler bırakılmıştır.*

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

## 📌 Aktif Görevler Özet Tablosu

| No | Görev Başlığı | Modül / Dosya | Zorluk | Öncelik | Durum |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1.4** | Yıldızımızdaki "Kıvılcım" terimi ve UX anlatımı | `MicroStarHeader.tsx`, `StarSparkManager.ts` | 🟢 Kolay | Orta | Beklemede |
| **2.6** | Yıldızımız ekranı alt panel buton karmaşıklığının giderilmesi | `OurStarScreen.tsx`, `MicroSystemDock.tsx` | 🟡 Orta | Orta | Beklemede |
| **2.7** | Görünen isim, cinsiyet ve tarih değişim limitleri & tema senkronu | `profile.tsx`, `ThemeContext.tsx`, Supabase | 🟡 Orta | Yüksek | Kurallar Belirlendi |
| **4.1** | Güvenli Kasa & Şifreleme Revizyonu (Private Storage & Vault Modeli) | `crypto.ts`, `photos.tsx`, `login.tsx`, Supabase | 🔴 Zor | Kritik | Mimari Hazırlandı |


kıvılcım kalkacak mı duracak mı karar ver 
uygulama şifrelemesi ne kadar güvenli ona göre ilerle 
yıldızda en alttaki karmaşıklığı gider 
uygulamadaki tüm sesleri test et 
yıldız mantığı çalışıyor mu test et 
Arkadaş ekle yıldız olarak test et
fotoğaf yüklemeye sınır konmalı mı 

---

## 🔐 4. BÖLÜM: ŞİFRELEME VE VERİ GÜVENLİĞİ REVİZYONU (Kaya Gibi Sağlam & Sıfır Veri Kaybı)

---

### Görev 4.1: Şifreleme Altyapısının Sadeleştirilmesi, Sabit Anahtarların Tasfiyesi ve Gizli Fotoğraf Kasası (2. Yol: Sunucu Kasası & Oturum Koruması)
* **Kategori:** Kritik Güvenlik / Kriptografi & Storage Mimarisi
* **Ön Koşul Avantajı:** Uygulamada henüz canlıda gerçek kullanıcı **bulunmamaktadır** ve içerideki test verileri sıfırlanabilir. Geriye dönük eski şifreli verileri kurtarma (migration) zahmeti yoktur; sistem doğrudan en temiz ve hatasız haliyle sıfırdan kurulacaktır.

#### 1. Sorunun Özeti ve Hedef:
* **Mevcut Durum:**
  1. `src/utils/crypto.ts` içerisinde `KEY_HEX = "3586ea..."` ve `STATIC_IV_HEX` gibi sabit anahtarlar kodun içine açıkça yazılmıştır. APK paketini açan herhangi biri bu anahtarları 1 dakikada ele geçirebilir.
  2. Kullanıcı adları (`username`) deterministik AES (`det:`) ile şifrelendiğinden hem frekans analizine açıktır hem de giriş yaparken `get_email_by_username` gibi herkese açık güvensiz arka kapı RPC fonksiyonlarına muhtaç bırakmıştır.
  3. Fotoğraf galerisi (`photos` bucket) `public: true` modundadır ve doğrudan `getPublicUrl` üretmektedir. URL'yi bilen yabancılar özel fotoğrafları CDN'den şifresiz indirebilmektedir.
* **Seçilen Çözüm Modeli (2. Yol):**
  Aşırı mühendislikten (kullanıcı telefonunu değiştirdiğinde eski anıların sonsuza dek kaybolmasına yol açacak cihaz kilitli asimetrik protokollerden) **kesinlikle uzak durulacak**; bunun yerine endüstri standardı olan **"Sunucu Zırhı & Doğrulanmış Oturum (JWT) Kasası"** benimsenecektir.

#### 2. Uygulanacak Mimari Adımlar:

##### A. Fotoğraf Kasası (Private Storage Bucket + Signed URL):
1. `photos` ve `couple-memories` storage bucket'ları Supabase üzerinde `public = false` (özel/gizli) olarak yapılandırılmalıdır.
2. Fotoğraflar artık asla `getPublicUrl` ile çağrılmayacaktır.
3. İstemci tarafında fotoğraf görüntülenirken veya önbelleğe alınırken Supabase'in yerel `supabase.storage.from("photos").createSignedUrl(path, 3600)` (1 saat geçerli imzalı ve geçici URL) fonksiyonu kullanılacaktır. Böylece internetten hiç kimse bağlantı tahmin ederek fotoğraflara erişemez.

##### B. Kod İçi Sabit Anahtarın (`KEY_HEX`) ve Fallback Zincirlerinin Temizlenmesi:
1. `src/utils/crypto.ts` içindeki hardcoded `KEY_HEX` ve `STATIC_IV_HEX` sabitleri tamamen kaldırılacaktır.
2. `crypto.ts` içindeki "önce session key dene, olmazsa static key ile çöz" şeklindeki karmaşık fallback zinciri silinecektir.
3. Şifreleme anahtarı, yalnızca kullanıcının oturum açtığı anda Supabase Auth tarafından doğrulanmış oturum bilgisi (JWT / Session token) ve çiftin güvenli ortam değişkeniyle dinamik olarak çalışma zamanı (RAM) belleğinde türetilecek; diske veya koda asla düz metin anahtar yazılmayacaktır.

##### C. Kullanıcı Adı (`username`) Deterministik Şifrelemesinin Kaldırılması:
1. Sıfır veri ile başlandığı için kullanıcı adlarını deterministik AES ile şifreleme zorunluluğu tamamen ortadan kaldırılacaktır.
2. `public.users` tablosundaki `username` alanı doğrudan standart, küçük harf ve benzersiz (unique index) bir metin sütunu olarak tutulacaktır.
3. Giriş ekranında (`login.tsx`) kullanıcı adı girildiğinde gereksiz şifreleme yapılmayacak; doğrudan Supabase Auth altyapısı ile temiz, hızlı ve hatasız giriş akışı sağlanacaktır. Güvensiz `get_email_by_username` RPC fonksiyonu devreden çıkarılacaktır.

##### D. Yeni Telefon Değişiminde Sıfır Veri Kaybı Garantisi:
1. Kullanıcı yeni bir telefon aldığında, sadece e-posta ve şifresiyle giriş yapacaktır.
2. Supabase Auth oturumu açtığı anda dinamik oturum anahtarı anında yeniden oluşacak ve kullanıcının geçmiş tüm mektupları, günlük notları ve fotoğrafları hiçbir kurtarma şifresine gerek kalmadan anında ekrana gelecektir.

* **İlgili Dosyalar:**
  * [`src/utils/crypto.ts`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/utils/crypto.ts)
  * [`src/app/(auth)/login.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/app/(auth)/login.tsx)
  * [`src/app/(auth)/complete-profile.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/app/(auth)/complete-profile.tsx)
  * [`src/app/(tabs)/add-photo.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/app/(tabs)/add-photo.tsx)
  * [`src/app/(tabs)/photos.tsx`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/src/app/(tabs)/photos.tsx)
  * [`supabase/migrations/`](file:///c:/Users/emirh/Desktop/çift/couples-app-mobile/supabase/migrations/)