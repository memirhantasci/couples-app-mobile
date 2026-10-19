# 🚀 Couples App Mobile — Kalan Görevler ve Geliştirme Yol Haritası

> **Durum Özeti:** Kod tabanındaki 11 teknik hata (Hermes rastgele sayı güvenliği, bildirim trigger formatı, Supabase storage JPEG MIME tipi, günlük notu çakışması, iOS harita teması, iOS ses havuzu, mektup takvim yerelleştirmesi, buluşma seçimi vb.) ve giriş ekranı sinematik arka planı dün ve bugün başarıyla tamamlanmış ve derleme 0 hata ile doğrulanmıştır. 
> 
> Yapılan ve tamamlanan işler temizlenmiş olup, bu belgede yalnızca **kullanıcı aksiyonu bekleyen dış ayarlar** ile **sıradaki yeni geliştirme yol haritası** yer almaktadır.

---

## ⏳ 1. Bekleyen Dış Yapılandırmalar (Kullanıcı Aksiyonu)

Aşağıdaki adımlar kodla değil, harici servis panelleri üzerinden tek seferlik yapılması gereken ayarlardır:

| # | Konu | Platform / Servis | Açıklama |
|---|---|---|---|
| 1 | **Supabase `save_letter` Fonksiyon Temizliği** | Supabase SQL Editor | Projedeki [`20261019000000_fix_save_letter_overload.sql`](file:///c:/Users/ahmet/OneDrive/Masaüstü/couples-app-mobile/supabase/migrations/20261019000000_fix_save_letter_overload.sql) dosyası Supabase Dashboard SQL Editor'da çalıştırılarak eski çakışan fonksiyonlar temizlenmeli ve PGRST203 hatası kalıcı olarak giderilmelidir. |
| 2 | **Supabase Auth Redirect URL** | Supabase Dashboard | *Authentication ➔ URL Configuration ➔ Redirect URLs* kısmına `couplesapp://auth/callback` eklenmelidir. |
| 3 | **Google & Apple OAuth Kimlik Bilgileri** | Google Cloud & Apple Developer | Google Client ID ve Apple Services ID bilgileri Supabase Provider paneline girilerek sosyal giriş aktif edilmelidir. |

---

## 💡 2. Sıradaki Geliştirme Yol Haritası & Yeni Özellik Fikirleri

Kullanıcı etkileşimini ve çiftlerin bağlılığını artırmak için geliştirilmeye hazır özellikler:

### 🌟 A. "Günün Sorusu" / "Birlikte Keşfet" (Daily Couple Question)
- **Açıklama:** Her gün çiftlerin ana sayfasına tek bir derin veya eğlenceli soru düşer.
- **Kör Yanıt (Blind Answer):** Her iki partner de cevap yazana kadar karşı tarafın yanıtı blurlu/kilitli kalır. İki taraf da yanıtladığında aynı anda kilit açılır, konfeti patlar ve bildirim gider.
- **Arşiv:** Tüm yanıtlar "Bizim Aşk Kitabımız" arşivinde ömür boyu saklanır.

### 💓 B. "Seni Düşünüyorum" (Haptic Heartbeat Pulse)
- **Açıklama:** Ana sayfada tek dokunuşluk zarif bir kalp butonu.
- **Etki:** Dokunulduğunda partnerin telefonuna o an özel bir çift vuruşlu kalp atışı (`boom-boom... boom-boom`) haptik titreşimi iletilir ve sessiz push bildirim düşer: *"Ahmet şu an seni düşünüyor... 💓"*.

### 📝 C. "Ortak Hayal & Bucket List" (Birlikte Yapılacaklar)
- **Açıklama:** Seyahat, Deneyim, Film/Dizi ve Restoran kategorilerinde ortak yapılacaklar listesi.
- **İlerleme:** Yapıldıkça tik atılır, fotoğraf iliştirilir ve *"Hayallerimizin %42'sini tamamladık ✨"* ilerleme çubuğu gösterilir.

### 🎲 D. "Ne Yapsak?" / Aşk Karar Çarkı (Date Night Decider)
- **Açıklama:** "Bugün ne yesek?", "Akşam hangi filmi izlesek?", "Hafta sonu nereye gitsek?" kararsızlığını çözen interaktif çark veya kart kaydırmalı (Tinder tarzı) aktivite eşleşmesi.

### 🎙️ E. Sesli & Fotoğraflı Mühürlü Mektuplar (Time-Capsule Audio)
- **Açıklama:** Mühürlü mektuplara sadece metin değil, 30-60 saniyelik bir ses kaydı veya gizli fotoğraf iliştirme imkanı. Kilit açılma tarihine kadar ses şifreli ve kilitli kalır; vakti geldiğinde mühür erir ve dinlenebilir.

### 📱 F. iOS & Android Ana Ekran Widget'ları (Home Screen Widgets)
- **Açıklama:** Telefonun ana ekranına konulabilen:
  - "1,248 gündür birlikteyiz ❤️" sayacı.
  - Partnerin güncel mod emojisi ("Mutlu 😊").
  - Rastgele eski bir anı fotoğrafı ("1 yıl önce bugün 📸").
