# Couples App Mobile - Arayüz ve Fonksiyonel Geliştirme Dokümanı

Bu belge, uygulamadaki bildirilen hataları, arayüz aksaklıklarını ve talep edilen yeni özellikleri Claude'un en az araştırma token'ı harcayarak doğrudan çözüme odaklanabilmesi amacıyla hazırlanmıştır. 

> **Geliştirici Notu:** Bu dokümanda doğrudan kod yamaları veya "şunu şöyle yaz" talimatları yer almamaktadır. Her maddenin **mevcut durumu (sorun)**, **kullanıcı beklentisi** ve araştırmayı hızlandırmak için **derinlemesine mimari bağlamı (ilgili dosyalar, state'ler ve akışlar)** sunulmuştur. Çözüm mimarisini ve kod uygulamasını Claude kendisi tasarlamalıdır.
> 
> *Not: Tamamlanan 1.1, 1.2, 1.3, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 3.1 ve 3.2 numaralı görevler başarıyla tamamlanarak dokümandan temizlenmiştir. Geriye yalnızca üzerinde çalışılacak aktif görevler bırakılmıştır.*

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

## 📌 Aktif Görevler Özet Tablosu

| No | Görev Başlığı | Modül / Dosya | Zorluk | Öncelik | Durum |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1.4** | Yıldızımızdaki "Kıvılcım" terimi ve UX anlatımı | `MicroStarHeader.tsx`, `StarSparkManager.ts` | 🟢 Kolay | Orta | Beklemede |
| **4.1** | Güvenli Kasa & Şifreleme Revizyonu (Private Storage & Vault Modeli) | `crypto.ts`, `photos.tsx`, `login.tsx`, Supabase | 🔴 Zor | Kritik | Kod tamamlandı — migration + `auth-gateway` dağıtımı bekliyor |

---

## 📌 Açık Tasarım Kararları & Test Notları

* [ ] Kıvılcım sayacı kalkacak mı yoksa sevgi titreşimi/rezonansı olarak yeniden mi adlandırılacak?
* [ ] Uygulama şifrelemesi (4.1) yeni cihaz oturum zırhı mimarisine göre test edilmeli.
* [x] Yıldız ekranındaki alt panel kontrolleri (Dock & FAB) sadeleştirildi ve çakışmalar giderildi.
* [ ] Uygulamadaki tüm ses efektleri ve dokunsal bildirimler (haptic) test edilmeli.
* [ ] Yıldız tescil, claim ve puanlama mantığı 0'dan temiz hesapla test edilmeli.
* [ ] Arkadaş yıldız ekleme ve takımyıldızı bağları test edilmeli.
* [ ] Fotoğraf yüklemeye (fotoğraf kasası / galeri) çift veya tekil sınır konmalı mı kararlaştırılmalı.

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


kıvılcım kalkacak mı duracak mı karar ver 
uygulama şifrelemesi ne kadar güvenli ona göre ilerle 
yıldızda en alttaki karmaşıklığı gider 
uygulamadaki tüm sesleri test et 
yıldız mantığı çalışıyor mu test et 
Arkadaş ekle yıldız olarak test et
fotoğaf yüklemeye sınır konmalı mı 