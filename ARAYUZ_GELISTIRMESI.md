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


kıvılcım kalkacak mı duracak mı karar ver 
uygulama şifrelemesi ne kadar güvenli ona göre ilerle 
yıldızda en alttaki karmaşıklığı gider 
uygulamadaki tüm sesleri test et 
yıldız mantığı çalışıyor mu test et 
Arkadaş ekle yıldız olarak test et
fotoğaf yüklemeye sınır konmalı mı 