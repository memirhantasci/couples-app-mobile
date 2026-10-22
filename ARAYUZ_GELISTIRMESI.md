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