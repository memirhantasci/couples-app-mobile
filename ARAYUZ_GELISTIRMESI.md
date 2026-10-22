# Couples App Mobile - Arayüz ve Fonksiyonel Geliştirme Dokümanı

Bu belge, uygulamadaki bildirilen hataları, arayüz aksaklıklarını ve talep edilen yeni özellikleri Claude'un en az araştırma token'ı harcayarak doğrudan çözüme odaklanabilmesi amacıyla hazırlanmıştır. 

> **Geliştirici Notu:** Bu dokümanda doğrudan kod yamaları veya "şunu şöyle yaz" talimatları yer almamaktadır. Her maddenin **mevcut durumu (sorun)**, **kullanıcı beklentisi** ve araştırmayı hızlandırmak için **derinlemesine mimari bağlamı (ilgili dosyalar, state'ler ve akışlar)** sunulmuştur. Çözüm mimarisini ve kod uygulamasını Claude kendisi tasarlamalıdır.
> 
> *Not: Tamamlanan 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 3.1 ve 3.2 numaralı görevler başarıyla tamamlanarak dokümandan temizlenmiştir. Geriye yalnızca üzerinde çalışılacak aktif görevler bırakılmıştır.*

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

## 📌 Aktif Görevler Özet Tablosu

| No | Görev Başlığı | Modül / Dosya | Zorluk | Öncelik | Durum |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1.4** | Yıldızımızdaki "Kıvılcım" terimi ve UX anlatımı | `MicroStarHeader.tsx`, `StarSparkManager.ts` | 🟢 Kolay | Orta | Beklemede |
| **2.6** | Yıldızımız ekranı alt panel buton karmaşıklığının giderilmesi | `OurStarScreen.tsx`, `MicroSystemDock.tsx` | 🟡 Orta | Orta | Beklemede |
| **4.1** | Güvenli Kasa & Şifreleme Revizyonu (Private Storage & Vault Modeli) | `crypto.ts`, `photos.tsx`, `login.tsx`, Supabase | 🔴 Zor | Kritik | Kod tamamlandı — migration + `auth-gateway` dağıtımı bekliyor |


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
* **Kategori:** Kritik Güvenlik / Kriptografi, Kimlik Yönetimi & Storage Mimarisi
* **Ön Koşul Avantajı:** Uygulamada canlıda gerçek kullanıcı bulunmamaktadır; içerideki test çiftinin tüm verileri sıfırlanmıştır. Geriye dönük eski şifreli verileri kurtarma (migration) zahmeti yoktur; sistem doğrudan en temiz, modern ve hatasız mimariyle sıfırdan kurulacaktır.

#### 1. Sorunun Kök Sebepleri ve Güvenlik Zafiyet Analizi:
1. **Sabit Anahtar Zaafı (Hardcoded Secrets):**
   * Mevcut `src/utils/crypto.ts` içerisinde `KEY_HEX` ve `STATIC_IV_HEX` gibi statik anahtarlar kodun içine gömülüdür. Mobil uygulama derlenip APK/IPA haline getirildiğinde, tersine mühendislik araçlarıyla (JADX, APKTool) bu anahtarlar saniyeler içinde elde edilebilmekte ve şifreleme katmanı tamamen anlamsız hale gelmektedir.
2. **Deterministik Şifrelemenin Yan Etkileri (`det:` formatı):**
   * Kullanıcı adları (`username`) veritabanında deterministik AES ile şifrelenmektedir. Deterministik şifreleme aynı girdiye her zaman aynı çıktıyı ürettiği için kriptografik frekans analizine açıktır.
   * Daha da önemlisi, kullanıcı adıyla giriş yapabilmek için `get_email_by_username` adında halka açık (anon erişimli) bir RPC fonksiyonu tanımlanmıştır. Bu durum kullanıcıların e-postalarını sorgulamaya açık bir arka kapı oluşturmaktadır.
   * Kullanıcı adı benzersiz bir kimlik tanımlayıcısıdır; şifrelenmesi hem arama, profil ve bildirim akışlarında gereksiz çözme (decrypt) yükü yaratmakta hem de hata ihtimalini artırmaktadır.
3. **Açık Fotoğraf Deposu (Public Storage CDN):**
   * Çiftlerin fotoğraf arşivi (`photos` bucket'ı) Supabase üzerinde `public: true` olarak barındırılmakta ve veritabanına doğrudan genel CDN URL'leri (`getPublicUrl`) kaydedilmektedir.
   * Bu durum, URL bağlantısına sahip olan veya bağlantıyı tahmin eden herhangi bir üçüncü şahsın oturum açmadan, hiçbir yetki kontrolüne takılmadan çiftlerin en özel fotoğraflarını indirmesine olanak tanımaktadır.
4. **Karmaşık Fallback ve Önbellek Zincirleri:**
   * `crypto.ts` içerisinde yer alan "önce session key dene, çözülemezse static key ile çöz" şeklindeki katmanlı deneme mekanizması kod karmaşasına yol açmakta, hata ayıklamayı zorlaştırmakta ve performans kaybı oluşturmaktadır.

#### 2. Seçilen Çözüm Modeli (2. Yol: Sunucu Doğrulamalı Oturum Zırhı & Özel Depolama Kasası):
* **Neden 1. Yol (Cihaz Kilitli Asimetrik / Biyometrik Kasa) Seçilmedi?**
  * Kullanıcı cihazını değiştirdiğinde, telefon çalındığında veya uygulama silinip yeniden yüklendiğinde, cihaz anahtarları silineceği için kullanıcının 24 kelimelik bir kurtarma şifresine (seed phrase) ihtiyacı olur. Kullanıcı bu şifreyi unuttuğunda çiftin yıllarca biriktirdiği tüm anılar, mektuplar ve fotoğraflar sonsuza dek kaybolur. Bu durum bir çift uygulaması için kabul edilemez bir kullanıcı deneyimidir.
* **2. Yolun Mantıksal Üstünlüğü:**
  * Güvenlik, kullanıcı oturumunun geçerliliğine (Supabase Auth JWT) ve çifte özel güvenli sunucu tuzuna (salt) dayanır.
  * Kullanıcı yeni bir telefona geçtiğinde sadece e-posta ve şifresiyle giriş yapar; oturum açıldığı anda bellek üzerinde şifreleme anahtarı dinamik olarak türetilir ve geçmişteki tüm veriler sıfır kayıpla anında çözülür.

---

#### 3. Mantıksal ve Mimari Uygulama Gereksinimleri:

##### A. Özel Depolama Kasası ve İmzalı URL Mimarisi (Storage & Photos):
1. **Depolama Gizliliği (Private Buckets):**
   * `photos` ve `couple-memories` storage bucket'ları Supabase üzerinde `public = false` moduna geçirilmelidir.
   * Storage RLS politikaları, yalnızca kimliği doğrulanmış ve ilgili çiftin üyesi olan kullanıcılara dosya okuma/yükleme izni tanıyacak şekilde kurgulanmalıdır.
2. **Kalıcı Genel URL'lerin Tasfiyesi:**
   * Veritabanında (`photo_archive` tablosu) artık genel CDN URL'leri (`publicUrl`) kalıcı veri olarak saklanmamalıdır. Bunun yerine, depolama içerisindeki göreli yol (`storage_path` ve thumbnail için ilgili yol) birincil doğruluk kaynağı (source of truth) olmalıdır.
3. **Dinamik Süreli İmzalı Bağlantılar (Signed URLs):**
   * Galeri, harita veya anı ekranlarında fotoğraflar yüklenirken Supabase Storage API'sinin imzalı URL üretme yeteneği (`createSignedUrl` veya toplu listelemeler için `createSignedUrls`) kullanılmalıdır.
   * Üretilen imzalı bağlantılar belirlenen bir geçerlilik süresine (TTL) sahip olmalı; yetkisiz kişilerin veya oturumu sonlananların bağlantıyı kullanamaması sağlanmalıdır.
4. **İstemci Tarafı Görsel Önbellekleme Güvencesi (Expo Image):**
   * Uygulamada görseller `expo-image` bileşeni ile disk ve bellek önbelleğinde (`cachePolicy="memory-disk"`) tutulduğundan, imzalı URL'nin süresi dolsa bile kullanıcının yerel cihazında fotoğrafların kesintisiz ve hızlı yüklenmesi temin edilmelidir.

##### B. Kriptografi Altyapısının Sadeleştirilmesi ve Bellek Güvenliği (`src/utils/crypto.ts`):
1. **Sabit Anahtarların Koddan Temizlenmesi:**
   * Kod içine gömülmüş olan `KEY_HEX`, `STATIC_IV_HEX` ve bunlara bağlı türevler tamamen tasfiye edilmelidir.
2. **Çalışma Zamanı Dinamik Anahtar Türetimi (Runtime In-Memory Key):**
   * Şifreleme ve deşifreleme işlemleri, diskte veya kodda saklanan statik bir değere değil; kullanıcının aktif oturum bilgisine ve `couples.encryption_salt` alanına bağlı olarak yalnızca çalışma zamanında (RAM belleğinde) türetilen anahtara dayanmalıdır.
   * Oturum kapandığında (`signOut`), anahtar bellekten tamamen silinmeli ve önbellek temizlenmelidir.
3. **Çift Öncesi ve Çift Sonrası Durum Tutarlılığı:**
   * Kullanıcı henüz bir çifte dahil değilken (solo kullanıcı) ve bir çifte katıldıktan sonraki şifreleme durumları mantıksal bir süreklilik içinde ele alınmalıdır.
   * Sadece gerçekten şifrelenmesi gereken özel çift verileri (mektup içerikleri, günlük notları) simetrik olarak şifrelenmeli; şifrelenmesi gerekmeyen sistem alanları gereksiz yere kriptografik yüke sokulmamalıdır.
4. **Deterministik Şifrelemenin Tasfiyesi:**
   * `deterministicEncrypt` ve `deterministicDecrypt` fonksiyonları ile `det:` ön eki taşıyan tüm mantık sistemden arındırılmalıdır.

##### C. Kullanıcı Adı (`username`) ve Kimlik Doğrulama Akışının Modernizasyonu:
1. **Standart Düz Metin Kullanıcı Adı:**
   * Kullanıcı adları artık asla şifrelenmemelidir. `public.users` tablosundaki `username` sütunu standart, küçük harf (lowercase), boşluksuz, alfanümerik ve benzersiz (unique constraint & index) bir metin alanı olarak yönetilmelidir.
2. **Kayıt ve Giriş Akışının Sadeleşmesi (`login.tsx`):**
   * Kayıt sırasında kullanıcı adı benzersizlik kontrolü ve veritabanına yazımı düz metin üzerinden doğrudan yapılmalıdır.
   * Giriş ekranında kullanıcı ister e-posta ister kullanıcı adı girsin; sistem arka planda güvenli, hızlı ve temiz bir akışla kimliği doğrulamalıdır.
   * Güvensiz, brute-force saldırılarına zemin hazırlayan `get_email_by_username` RPC fonksiyonuna duyulan bağımlılık tamamen kaldırılmalı veya güvenli bir mimariyle ikame edilmelidir.
3. **Uygulama Genelinde Kullanıcı Adı Referanslarının Temizlenmesi:**
   * Arayüzün farklı yerlerinde (`home.tsx`, `letters.tsx`, `calendar.tsx`, `menu.tsx`, `notifications.ts`, `letterArrival.ts`, `ownerInitials.ts`) yer alan ve kullanıcı adını ekrana basmadan önce `deterministicDecrypt` çağıran tüm kod blokları sadeleştirilerek doğrudan düz metin değerini kullanacak hale getirilmelidir.

##### D. Yeni Cihaz Değişiminde Sıfır Veri Kaybı Garantisi:
1. Kullanıcı telefonunu kaybettiğinde, sildiğinde veya yeni bir cihaza geçtiğinde; kurtarma kelimesi veya özel cihaz sertifikası aranmaksızın, yalnızca e-posta ve şifresiyle oturum açarak tüm verilerine (mektuplar, notlar, fotoğraflar) eksiksiz erişebilmelidir.
2. Oturum açıldığı anda oturum anahtarı anında RAM belleğinde yeniden üretilmeli ve mevcut şifreli metinler şeffaf bir biçimde okunabilir hale gelmelidir.

---

#### 4. İlgili Dosyalar ve Mimari Sorumluluk Haritası:

| Modül / Dosya | Mevcut Sorumluluk & Sorun | Revizyon Sonrası Beklenen Mantık |
| :--- | :--- | :--- |
| `src/utils/crypto.ts` | Sabit anahtarlar, deterministik şifreleme, fallback zincirleri barındırıyor. | Hardcoded anahtarlar temizlenir; sadece oturumdan beslenen dinamik bellek anahtarı ile temiz simetrik şifreleme/çözme kalır. |
| `src/app/(auth)/login.tsx` | Girişte ve kayıtta kullanıcı adını deterministik şifreliyor; `get_email_by_username` çağırıyor. | Düz metin kullanıcı adı ile temiz kayıt ve giriş akışı. Güvensiz RPC bağımlılığı kalkar. |
| `src/app/(auth)/forgot-password.tsx` | Şifre sıfırlamada kullanıcı adını deterministik şifreleyerek arıyor. | Doğrudan düz metin kullanıcı adı/e-posta araması. |
| `src/app/(auth)/complete-profile.tsx` | Statik anahtarla `encryptStatic` üzerinden isim kaydediyor. | Dinamik oturum yapısına veya doğrudan güvenli profil alanına uygun kayıt. |
| `src/context/AuthContext.tsx` | `deterministicDecrypt` ile kullanıcı adını çözüyor, dinamik oturum anahtarını başlatıyor. | Kullanıcı adını doğrudan okur; oturum anahtarını temiz ve kesintisiz başlatır/temizler. |
| `src/app/(tabs)/add-photo.tsx` | Fotoğrafı yükleyip doğrudan `getPublicUrl` üreterek veritabanına kaydediyor. | `storage_path` esas kaynak olarak kaydedilir; açık genel URL'lere bağımlılık kaldırılır. |
| `src/app/(tabs)/photos.tsx` & Fotoğraf Hücreleri | `image_url` ve `thumb_url` üzerinden açık CDN bağlantılarını render ediyor. | Özel bucket'tan süreli imzalı URL (`createSignedUrl(s)`) alarak güvenli render sağlar. |
| `src/hooks/useMapData.ts` & `useCalendarData.ts` | Fotoğraf URL'lerini açık bağlantı varsayımıyla harita/takvimde gösteriyor. | İmzalı URL veya depolama yolu desteğiyle uyumlu hale getirilir. |
| `src/modules/stars/` ve diğer tüketici dosyalar | Kullanıcı adını göstermek için `deterministicDecrypt` kullanıyor. | Düz metin kullanıcı adı doğrudan kullanılır. |
| `supabase/migrations/` | `photos` bucket'ı public; kullanıcı adı indeksleri ve RPC'ler eski yapıya göre. | `photos` private moda çekilir, RLS politikaları düzenlenir, `users.username` kısıtları netleştirilir. |

---

#### 5. Claude İçin Kritik Mimari İlkeler ve Dikkat Edilecek Riskler:
* **Kod Dikte Edilmemiştir:** Bu mimari çerçeve, sistemin gereksinimlerini ve "neden"lerini sunar. Kod bloklarının yazımı, fonksiyon imzaları, state yönetimi ve refactor planının adım adım uygulanması tamamen Claude'un mühendislik kararına bırakılmıştır.
* **Geriye Dönük Veri Yükü Yoktur:** Veritabanındaki test çifti sıfırlandığı için eski `det:` veya `enc:` kayıtlarını dönüştürme (data migration) zorunluluğu yoktur. Temiz bir başlangıç esastır.
* **Hermes & React Native Performansı:** Deşifreleme işlemlerinin arayüzde donma (UI jank) yaratmaması için mevcut önbellekleme (`decryptCache`) ve `expo-image` disk önbelleği prensipleri gözetilmelidir.
* **Regresyon Engeli:** Mektup gönderme (`letters.tsx`), günlük notu kaydetme (`daily-notes.tsx`) ve fotoğraf yükleme gibi temel akışların kesintiye uğramaması garanti edilmelidir.