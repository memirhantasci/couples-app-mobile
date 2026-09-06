# 🚀 Couples App — Viral Büyüme ve Yeni Özellik Stratejisi

> **Özet:** Manus'un çıkardığı metin temel olarak doğru bir pazarlama içgörüsüne dayanıyor: *"Çok fazla karmaşık özellik eklemek yerine, her gün küçük bir romantik eylem üretip bunu Instagram Story / TikTok'ta paylaşılabilir estetik bir karta dönüştürmek."* 
> 
> Bu dokümanda, mevcut uygulamamızdaki altyapıyı (Mektuplar, Harita, Anılar, Günlük Notlar, Supabase) temel alarak bu fikirleri sadeleştirdik, elenecekleri eledik ve en yüksek viral etki getirecek özellikleri uygulanabilir hale getirdik.

---

## 1. Mantık Neden Doğru? (Büyüme Tezi)

Çift uygulamalarında en büyük problem **"Retention (Uygulamada Kalma)"** ve **"Organik Büyüme (Kullanıcı Kazanımı)"** dir:
1. **Düşük Efor (Low Effort Interaction):** Kullanıcıdan her gün 10 sayfa yazı yazmasını beklerseniz 4. gün uygulamayı bırakır. Ancak "günün tek sorusunu yanıtla" veya "anlık bir fotoğraf çek" derseniz günde 15 saniye harcar.
2. **Kişiselleştirilmiş Paylaşım (Social Proof):** Kullanıcı "Couples App harika bir uygulama indirin" demez. Ama *"Biz bu ay 31 kez birbirimizi seçtik ve 4 şehri gezdik"* kartını Instagram Story'ye gururla atar.
3. **Organik Kanca (Viral Loop):** Hikayeyi gören arkadaşı *"Bu ne uygulaması?"* diyerek alttaki şık logoya bakar ve indirir.

---

## 2. Manus'un Önerileri vs. Mevcut Uygulamamız: Ne Durumdayız?

| Manus Önerisi | Bizde Zaten Var mı? | Durum & Entegrasyon Fırsatı | Viral Potansiyel |
| :--- | :--- | :--- | :--- |
| **Couple Wrapped (Yıllık/Aylık Özet)** | ❌ Yok | Harita, anılar, mektuplar ve notlarımız var. Bu verileri toplayıp harika bir **Story Kartı** üretmek çok kolay! | ⭐⭐⭐⭐⭐ (En Yüksek) |
| **Aşk Zarfları ("Şu Anda Aç")** | 🟡 Kısmen (`letters.tsx`) | Zaten mektup sistemimiz var! Tek gereken "tarih" yerine "durum kuralı" (Örn: *Kavga ettiğimizde aç*, *Beni özlediğinde aç*). | ⭐⭐⭐⭐⭐ (Çok Kolay & Hızlı) |
| **Günlük Couple Drop (BeReal Çift Versiyonu)** | 🟡 Kısmen (`daily-notes.tsx`) | Günlük notlarımız var. Bunu "iki taraf da yanıtlamadan karşı tarafın yanıtı açılmaz" mantığına çevirebiliriz. | ⭐⭐⭐⭐⭐ (En Yüksek Retention) |
| **Aşk Haritası Hikayeleri** | 🟡 Kısmen (`map.tsx`) | Haritamız ve pinlerimiz zaten var! Yapılacak tek şey pinleri birleştirip *"Hikayemiz 3 şehirde büyüdü"* dikey görseli üretmek. | ⭐⭐⭐⭐ (Çok Yüksek) |
| **Gizli Görevler (Secret Missions)** | ❌ Yok | Partnerlerin birbirine gönderdiği küçük jest görevleri (*"Bugün sevdiği kahveyi al"*). | ⭐⭐⭐⭐ (Yüksek) |
| **İlişki Bingo / Challenge** | ❌ Yok | 3x3 kutucuklu "Bu Ay Yapılacaklar". Tamamlandıkça rozet ve paylaşılabilir kart. | ⭐⭐⭐ (Orta-Yüksek) |
| **Ana Ekran Widget'ı** | ❌ Yok | React Native'de iOS/Android widget köprüsü gerekir (Teknik eforu biraz daha yüksektir). | ⭐⭐⭐⭐ (Retention için iyi) |
| **Ortak Sanal Pet / Ev (SumOne)** | ❌ Yok | Çizim, animasyon ve oyun motoru gerektirir. Şu an için eforu çok yüksek. | 🛑 *İlk etapta pas geçilmeli* |

---

## 3. En Güçlü 4 Viral Özellik (Öncelikli Yol Haritası)

### 🥇 1. "Aşk Zarfları" (Mevcut Mektupların Seviye Atlamış Hali)
* **Mantık:** Kullanıcı mektup yazarken tarih seçmek yerine bir **"Zarf Teması"** seçer:
  - 💔 *Kavga ettiğimizde aç*
  - 🥺 *Beni çok özlediğinde aç*
  - 🌧️ *Kendini yetersiz/kötü hissettiğinde aç*
  - 🎂 *Bir sonraki doğum gününde aç*
  - ✈️ *Uzakta olduğumuz bir gece aç*
* **Neden Viral?** TikTok'ta *"Sevgilim bana 'kavga ettiğimizde aç' zarfı bırakmıştı, bugün ilk kez açtık..."* videoları milyonlarca izleniyor.
* **Bizim için Kolaylığı:** `letters.tsx` sayfamız zaten hazır. Sadece zarf tipi (envelope_type / open_condition) alanı ve mühürlü zarf animasyonu eklenecek.

---

### 🥈 2. "Couple Wrapped" (Aylık & Yıllık İlişki Özeti)
* **Mantık:** Spotify Wrapped gibi her ayın 1'inde veya yıl dönümünde otomatik estetik kartlar hazırlanır:
  - *"Bu ay birbirinize 14 mektup yazdınız."*
  - *"En çok ziyaret ettiğiniz yer: Kadıköy Sahil"*
  - *"Birlikte 4 yeni anı biriktirdiniz."*
  - *"Bu ay birbirinizi 31 gün seçtiniz."*
* **Çıktı:** Tek tıkla Instagram Story / WhatsApp'a dikey görsel (9:16) olarak atılır (`react-native-view-shot` + `expo-sharing`).
* **Altındaki İmza:** En altta küçük, zarif bir logo: `Couples App • Bizim Hikayemiz`.

---

### 🥉 3. "Couple Drop" (Çiftlere Özel Günlük Soru / An)
* **Mantık:** Her gün saat 20:00'de iki tarafa da bildirim gider:
  - *"Bugün partnerinde en çok sevdiğin detay neydi?"*
  - *"Şu an neredesin? Tek bir fotoğraf çek."*
  - *"Bugün partnerin için küçük bir teşekkür notu yaz."*
* **Kritik Kural (BeReal & Paired Sırrı):** İki taraf da cevabını girmeden, partnerinin yazdığı/yüklediği içerik bulanık kalır (Blurred). İkisi de girince kilit açılır!
* **Paylaşım:** İki cevabın yan yana durduğu şık bir polaroid kartı oluşur.

---

### 🏅 4. "Aşk Haritası Özeti" (LDR ve Seyahat Eden Çiftler İçin)
* **Mantık:** Mevcut `map.tsx` üzerinde 3'ten fazla anı olduğunda haritanın üstünde *"Rotamızı Gör"* butonu çıkar.
* **Görsel:** İki sevgilinin şehirleri arasındaki çizgi, eklenen tüm şehir pinleri ve anı fotoğrafları birleştirilip dikey bir kolaj haritaya dönüşür:
  - *"2 Şehir, 1.450 km mesafe, 12 Unutulmaz Anı."*
* Özellikle uzak mesafe ilişkisi yaşayan çiftler için müthiş bir sosyal medya paylaşım malzemesidir.

---

## 4. Teknik Olarak Nasıl Uygularız? (React Native & Expo Uyumu)

1. **Paylaşılabilir Kart Motoru (`react-native-view-shot` + `expo-sharing`):**
   - Kullanıcı hiçbir zaman ekran görüntüsü almakla uğraşmamalı.
   - Uygulama içinde gizli veya modal olarak render edilen 1080x1920 piksel estetik kart (kartvizit/polaroid tasarımı) doğrudan native paylaşım menüsünü açar (Instagram Stories, WhatsApp vb.).
2. **Kilitli İçerik Mantığı (RLS / Supabase):**
   - Günlük soru mekaniğinde Supabase tablosuna `both_answered` kontrolü eklenir veya front-end'de partner cevabı gizlenir.
3. **Mevcut Sayfalarla Entegrasyon:**
   - Yeni ekranlar türetip uygulamayı şişirmek yerine, mevcut `letters.tsx`, `daily-notes.tsx` ve `map.tsx` içine bu viral yetenekler entegre edilir.

---

## 5. Kaçınılması Gereken Tehlikeli Hatalar

1. ⚠️ **Aşk Skoruyla Tehdit Etmek:** *"Aşk skorunuz %40'a düştü!"* gibi bildirimler çiftlerde toksik stres yaratır ve uygulamayı sildirir. Bunun yerine *"Bugün birbirinize sarılmayı unuttunuz mu?"* gibi pozitif dil kullanılmalıdır.
2. ⚠️ **Ceza Veren Streak'ler (Duolingo Hatası):** Biri yoğun olup girmeyince serinin yanması partnerler arasında kavga çıkarır. Streak yerine *"Birlikte geçirilen günler"* veya dondurulabilir seriler kullanılmalıdır.
3. ⚠️ **Aşırı Bildirim Spam'i:** Günde 5 bildirim atılırsa çiftler bildirimi kapatır. Günde yalnızca 1 adet merak uyandıran bildirim (Örn: saat 21:00'de *"Partnerin senin için bir zarf bıraktı 💌"*) çok daha etkilidir.
4. ⚠️ **Filigranı (Watermark) Göze Sokmak:** Paylaşım kartında devasa bir reklam logosu olursa kullanıcı Story'ye atmaz. Zarif, minimalist bir fontla altta durmalıdır: *"Made with Couples App"*.

---

## 6. Önerilen İlk Adım

Hepsini aynı anda yapmak yerine şu adımla başlamak en mantıklısıdır:
1. **1. Faz (Hemen Yapılabilir):** `letters.tsx` içerisine **"Aşk Zarfları" (Mood & Durum Kilitleri)** ve tek tıkla **"Story'de Paylaş"** kartı eklemek.
2. **2. Faz:** Ay sonu / Yıl dönümü için **Couple Wrapped** ekranı ve dikey paylaşım kartları üretmek.
3. **3. Faz:** Günlük notları (`daily-notes.tsx`) karşılıklı kilitli **Couple Drop** soru-cevap döngüsüne dönüştürmek.
