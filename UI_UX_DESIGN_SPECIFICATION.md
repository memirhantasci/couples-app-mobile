# COUPLES APP — FONKSİYONEL EKRAN, İŞLEV VE KURAL ŞARTNAMESİ

> **Tasarım Aracı (Stitch / AI / Figma) İçin Saf İşlevsel Rehber:**  
> Bu belgede görsel stil, renk kodları veya piksel boyutları yer almaz. Doğrudan **hangi sayfaların olacağı, her sayfada hangi eleman ve işlevlerin bulunacağı, hangi iş kurallarının ve kısıtlamaların işleyeceği** eksiksiz olarak listelenmiştir.

---

## GENEL MİMARİ VE ÇALIŞMA MANTIĞI

1. **İki Kişilik Kapalı Sistem:** Uygulamada sadece 2 kullanıcı birbirine bağlanabilir. Üçüncü bir kişi eklenemez.
2. **Ortak Premium Kuralı:** Çiftlerden herhangi biri Premium aldığında, sistem her iki kullanıcının hesabını da otomatik olarak Premium yapar.
3. **Cinsiyete Dayalı Deneyim Kuralı:** Kullanıcı kayıt olurken veya profilinden cinsiyetini (Kadın / Erkek) seçer. Bu seçim bazı ekranlardaki yetkileri (özellikle Regl Takvimi) ve arayüz varyantını belirler.
4. **Uçtan Uca Şifreli Veriler:** Günlük notlar, mektuplar ve özel anı detayları istemci tarafında şifrelenir. Arayüzde kilit / gizlilik göstergeleri yer almalıdır.
5. **Token (Jeton) Ekonomisi:** Premium olmayan kullanıcılar ödüllü reklam izleyerek token kazanabilir ve bu tokenleri kilitli özellikleri (örn. mektup hakkı) tek seferlik açmak için harcayabilir.

---

## TÜM EKRANLAR, İŞLEVLER VE KURALLAR LİSTESİ

---

### BÖLÜM 1: GİRİŞ VE GÜVENLİK AKIŞI (AUTH)

#### EKRAN 1: Giriş Yap (Login Screen)
- **Ekrandaki Elemanlar:**
  - "Giriş Yap" / "Kayıt Ol" sekme geçişi.
  - Kullanıcı Adı veya E-posta giriş alanı.
  - Şifre giriş alanı + Şifreyi Göster/Gizle butonu.
  - "Şifremi Unuttum" yönlendirme butonu.
  - "Giriş Yap" ana aksiyon butonu.
- **İşlevler & Kurallar:**
  - Kullanıcı adı veya e-posta ile giriş yapılabilir.
  - **Brute Force Kuralı:** Art arda 5 kez yanlış şifre girilirse sistem girişi 30 saniye süreyle kilitler. Geri sayım sayacı gösterilir ve buton pasifleşir.
  - Başarılı girişte: Kullanıcı eşleşmişse doğrudan Ana Sayfaya, eşleşmemişse Eşleştirme Ekranına yönlendirilir.

#### EKRAN 2: Kayıt Ol (Register Screen)
- **Ekrandaki Elemanlar:**
  - İsim / Hitap Adı giriş alanı (Partnerin göreceği isim).
  - Kullanıcı Adı giriş alanı (Benzersiz).
  - E-posta adresi giriş alanı.
  - Şifre giriş alanı (Göster/Gizle özellikli).
  - **Cinsiyet Seçici Elemanı:** "Kadın" ve "Erkek" seçenek butonları.
  - **Eşleşme Kodu Alanı (Opsiyonel):** Partneri daha önce kod ürettiyse hemen burada girebilmesi için 6 haneli kod alanı.
  - "Hesap Oluştur" butonu.
  - Kullanıcı Sözleşmesi ve Gizlilik Onayı onay kutusu/metni.
- **İşlevler & Kurallar:**
  - Cinsiyet seçimi zorunludur.
  - Şifre en az 6 karakter olmalıdır.
  - Eğer kullanıcı kayıt olurken partnerinin geçerli eşleşme kodunu girerse, kayıt anında otomatik eşleşir.

#### EKRAN 3: Şifremi Unuttum (Forgot Password Screen)
- **Ekrandaki Elemanlar:**
  - Geri dön butonu.
  - Açıklama metni.
  - Kayıtlı E-posta giriş alanı.
  - "Sıfırlama Bağlantısı Gönder" butonu.
- **İşlevler & Kurallar:**
  - E-posta formatı kontrol edilir, geçerli ise e-postaya tek kullanımlık sıfırlama bağlantısı gönderilir.
  - Başarı mesajı ekran üzerinde gösterilir.

#### EKRAN 4: Yeni Şifre Belirleme (Reset Password Screen)
- **Ekrandaki Elemanlar:**
  - Yeni Şifre alanı.
  - Yeni Şifre Tekrar alanı.
  - "Şifreyi Güncelle ve Giriş Yap" butonu.
- **İşlevler & Kurallar:**
  - Yalnızca geçerli bir e-posta sıfırlama token'ı ile açılır.
  - İki şifrenin birbiriyle uyuşması zorunludur.

#### EKRAN 5: E-posta Doğrulama (Verify Screen)
- **Ekrandaki Elemanlar:**
  - Başarı simgesi ve "E-postan Doğrulandı" mesajı.
  - "Devam Et" butonu.
- **İşlevler & Kurallar:**
  - Kullanıcı e-postasına gelen bağlantıya tıkladığında açılan ara onay ekranıdır.

#### EKRAN 6: Yeni Cihaz Güvenlik Onayı (Verify Device Screen)
- **Ekrandaki Elemanlar:**
  - 6 Haneli OTP Kod giriş kutucukları.
  - Kodu tekrar gönder butonu ve geri sayım sayacı.
  - "Doğrula" butonu.
- **İşlevler & Kurallar:**
  - Farklı bir cihazdan giriş yapıldığında hesabı korumak için e-postaya giden kodu ister.

---

### BÖLÜM 2: ÇİFT KURULUM VE BAĞLANMA AKIŞI (SETUP)

#### EKRAN 7: Çift Eşleştirme (Pairing Screen)
- **Ekrandaki Elemanlar:**
  - **A Bölümü (Kendi Kodun):**
    - Sistem tarafından otomatik üretilen 6 haneli alfanümerik kod (Örn: `X9K2P1`).
    - "Kodu Kopyala" butonu (Panoya kopyalar).
    - "Partnerine Gönder" butonu (WhatsApp, SMS, Telegram vb. sistem paylaşımını açar).
    - "Partner bekleniyor..." canlı durum göstergesi.
  - **B Bölümü (Partnerin Kodunu Girme):**
    - 6 Haneli kod giriş alanı (Büyük harfe otomatik dönüşür).
    - "Eşleş ve Bağlan" butonu.
  - Yanlış hesapla giriş yapanlar için "Çıkış Yap" butonu.
- **İşlevler & Kurallar:**
  - **Kendi Kodunu Girememe Kuralı:** Kullanıcı kendi ürettiği kodu girdiğinde sistem hata verir ("Kendi kodunu kullanamazsın").
  - **Dolu Çift Kuralı:** 2 kişiden fazla bağlanmaya çalışılırsa kod geçersiz sayılır ("Bu çift dolu").
  - **Canlı Dinleme:** Bir kullanıcı kodu paylaşıp beklerken, partneri kodu girdiği anda bekleyen tarafın ekranı beklemeden otomatik olarak bir sonraki adıma (Tarihler Ekranı) geçer.

#### EKRAN 8: İlişki Başlangıç Tarihleri (Dates Setup Screen)
- **Ekrandaki Elemanlar:**
  - **1. Tanışma Tarihi Seçici:** Tarih seçici modalını açan kart/alan.
  - **2. Sevgili Olma Tarihi Seçici:** Tarih seçici modalını açan kart/alan.
  - Açıklama metinleri ("İlk konuştuğunuz gün", "Aşkınızın başladığı gün").
  - "Aşk Yolculuğuna Başla" onay butonu.
- **İşlevler & Kurallar:**
  - **Gelecek Tarih Kuralı:** Bugünün tarihinden sonraki bir tarih seçilemez.
  - **Mantıksal Sıra Kuralı:** Tanışma tarihi, sevgili olma tarihinden sonraki bir gün olamaz (Önce tanışılır, sonra sevgili olunur).
  - Bu tarihler kaydedildiğinde uygulamanın ana sayfasındaki sayaçlar ve özel günler otomatik oluşur.

---

### BÖLÜM 3: ANA TAB DÜZENİ VE MERKEZ MODÜLLER

Uygulamanın alt kısmında sabit yüzen bir Navigasyon Çubuğu (Tab Bar) yer alır:
1. **Ana Sayfa**
2. **İlaçlar**
3. **Takvim**
4. **Mektuplar**
5. **Ayarlar/Profil**

---

#### EKRAN 9: ANA SAYFA (Home / Dashboard)
İlişkinin günlük kontrol merkezidir. Sayfa dikey kaydırılabilir kartlardan oluşur:

- **1. Header (Üst Alan):**
  - Selamlama metni: *"Günaydın / Tünaydın / İyi Akşamlar, [İsim]"*.
  - Bugünün güncel uzun tarihi (Örn: *"31 Ağustos Pazartesi"*).
  - Hamburger Menü butonu (Tüm alt modülleri içeren Tam Ekran Menüyü açar).
- **2. Aşk Sayaç Kapsülleri (Counter Pills):**
  - 1. Kapsül: `[X] gün tanışalı 🤝` (Tanışma tarihinden bugüne geçen gün sayısı).
  - 2. Kapsül: `[Y] gün sevgili ❤️` (Sevgili olma tarihinden bugüne geçen gün sayısı).
- **3. Günün Aşk Sözü Kartı:**
  - Yılın gününe göre (365 gün) her gün değişen romantik bir Türkçe söz gösterir.
- **4. Aşk Ölçer (Love Meter):**
  - Başlık ve dinamik yüzde değeri (Örn: `%98`).
  - Animasyonlu dolan seviye gösterge çubuğu.
  - Günlük uyum mikrokopyası.
- **5. Sıradaki Buluşma Geri Sayımı (Meeting Countdown):**
  - *Sadece planlanmış aktif bir buluşma varsa görünür.*
  - Buluşma Başlığı ve Mekan adı.
  - **4'lü Canlı Geri Sayım Sayacı:** Gün / Saat / Dakika / Saniye.
  - Karta basıldığında: Harita yönlendirme modalını açar (Google Maps / Apple Maps ile doğrudan rota başlatma).
  - Süre dolduğunda: "Buluşma gerçekleşti!" kutlama durumuna geçer.
- **6. Günlük Ruh Hali Seçici (Mood Selector):**
  - Başlık: *"Bugün nasılsın?"*.
  - 6 Adet Seçenek Butonu: Çok Mutlu (😍), Mutlu (😊), Normal (😐), Üzgün (😢), Kızgın (😡), Yorgun (😴).
  - **Kural:** Kullanıcı bir mod seçtiğinde gün boyunca seçim kilitlenir ("Bugün için kaydedildi").
  - **Push Bildirim Kuralı:** Seçim yapıldığı an partnerin telefonuna anlık bildirim gider (*"[İsim] bugün kendini Mutlu 😊 hissediyor"*).
- **7. Günlük Notum Kartı (Daily Note Card):**
  - Henüz yazılmadıysa: Metin alanı + "Kaydet" butonu.
  - Yazıldıysa: Yazılan notun kart üstü gösterimi + *"Yarın yeni bir not yazabilirsin"* uyarısı + "Geçmiş Notlarımı Gör" butonu.
- **8. Bekleyen Mektuplar Kartı (Pending Letters Card):**
  - *Sadece partnerin gelecekte açılmak üzere yazdığı kilitli mektuplar varsa görünür.*
  - Kilit simgesi, partnerin adı, *"Gözlerini kapat ve oku..."* gizli içerik önizlemesi.
  - **Geri Sayım Rozeti:** `[X] gün kaldı 🔒`.
  - Açılma tarihi etiketi.
  - "Tümünü Gör" butonu (Mektuplar sekmesine götürür).
- **9. Reklam Alanı (Banner):**
  - Ücretsiz kullanıcılarda en altta gösterilen standart reklam bandı.

---

#### EKRAN 10: İLAÇ VE TAKVİYE TAKİBİ (Medicine Screen)
Çiftlerin karşılıklı ilaç içme saatlerini takip ettiği ve onayladığı ekran.

- **1. Üst Alan:**
  - Sayfa başlığı ve "+ Yeni İlaç Ekle" aksiyon butonu.
- **2. Kullanıcı Sekmeleri (Segment Switcher):**
  - **[Benim İlaçlarım]** ve **[Partnerimin İlaçları]** sekmeleri.
- **3. Bugünün Doz Kartları:**
  - İlaç adı.
  - Doz saati (Örn: `08:00`, `13:30`, `20:00`).
  - **Doz Onay Butonları:**
    - **İçtim / Alındı Butonu (Check):** Dozu yeşil duruma getirir.
    - **Atladım / Alınmadı Butonu (Cross):** Dozu atlandı durumuna getirir.
    - **Bekliyor Durumu:** Henüz içilmedi/işlem yapılmadı.
- **4. 14 Günlük Tarihsel Geçmiş:**
  - Son iki hafta boyunca hangi ilaçların alınıp hangilerinin atlandığını gün gün listeleyen geçmiş dökümü.
- **5. İlaç Ekleme & Düzenleme Modalı:**
  - İlaç Adı alanı.
  - İlaç Sahibi Seçimi: "Kendim İçin" veya "Partnerim İçin" (Partnerine de ilaç tanımlayabilir).
  - Başlangıç Tarihi ve Bitiş Tarihi seçicileri.
  - Günlük Sıklık: Günde 1 Kez / 2 Kez / 3 Kez seçicisi.
  - Her doz için ayrı Zaman Seçici (TimePicker) kutucukları.
  - İlacı Sil ve İlacı Düzenle aksiyonları.

---

#### EKRAN 11: ORTAK İLİŞKİ TAKVİMİ (Calendar Screen)
- **1. Aylık İnteraktif Takvim:**
  - Ay/Yıl başlığı ve önceki/sonraki ay okları.
  - Günlük hücreler.
- **2. Çok Renkli Etkinlik Noktaları (Dots):**
  - Takvim gününün altında hangi verinin olduğunu belirten simgeler/noktalar:
    - **Not Noktası:** O güne ait takvim notu var.
    - **Benim Modum Noktası:** O gün kaydettiğim ruh hali var.
    - **Partnerimin Modu Noktası:** Partnerin kaydettiği ruh hali var.
    - **Fotoğraf Noktası:** O gün çekilmiş ortak galeri fotoğrafı var.
- **3. Seçili Gün Detay Paneli (Güne basınca altta açılır):**
  - Seçilen günün açık tarihi.
  - **Ruh Halleri Bölümü:** Her iki partnerin o günkü duygu durumu emojileri ve isimleri.
  - **Takvim Notları Bölümü:** O güne yazılmış ortak not metni + "Not Ekle / Düzenle" butonu.
  - **O Günün Fotoğrafları Bölümü:** O gün çekilmiş anı fotoğraflarının küçük resimleri.
- **4. Kural & Kısıtlama:**
  - Takvimde geçmiş günlerin fotoğraflarını görüntüleme özelliği **Premium kilitlidir**. Ücretsiz kullanıcı dokunduğunda Paywall modalı açılır.

---

#### EKRAN 12: GELECEĞE MEKTUPLAR (Letters Screen)
Belirlenen ileri bir tarihe kadar içeriği gizlenen zaman kapsülü mektupları.

- **1. Üst Alan:**
  - Sayfa başlığı ve "Yeni Mektup Yaz" butonu.
- **2. Sekmeler:**
  - **[Gelen Mektuplar]** ve **[Gönderdiklerim]** sekmeleri.
- **3. Mektup Kartı Durumları:**
  - **KİLİTLİ MEKTUP DURUMU (Zamanı Gelmemiş):**
    - Kilit simgesi.
    - Başlık: "Gözlerini Açma Vakti Gelmedi".
    - Gönderen bilgisi.
    - Açılacağı kesin tarih ve **"[X] Gün Kaldı"** geri sayım rozeti.
    - **Kural:** Basıldığında mektup içeriği kesinlikle gösterilmez, açılacağı tarih uyarısı verir.
  - **AÇILMIŞ MEKTUP DURUMU (Zamanı Gelmiş):**
    - Açık zarf simgesi.
    - Mektup Başlığı ve açıldığı tarih.
    - Basıldığında: Mektup Okuma Modalı açılır.
- **4. Mektup Okuma Modalı:**
  - Mektup başlığı, gönderen, mühürlenme tarihi.
  - Uçtan uca şifresi çözülen tam mektup metni.
  - Kapat butonu.
- **5. Yeni Mektup Yazma Formu / Modalı:**
  - Alıcı (Partner ismi sabit).
  - **Açılacağı Tarih Seçici:** Bugünden sonraki bir gelecek tarih seçilmek zorundadır (Bugün veya geçmiş tarih seçilemez).
  - Mektup Başlığı alanı.
  - Uzun Mektup İçeriği alanı.
  - "Mühürle ve Gönder" butonu.
- **6. Limit ve Token Kuralı:**
  - Ücretsiz kullanıcılarda toplam 15 mektup limiti vardır.
  - Limit dolduğunda: Kullanıcı **Token Harcayarak (10 Token)** tek seferlik mektup yazabilir veya **Premium'a geçerek** sınırsız mektup hakkı kazanır.

---

#### EKRAN 13: AYARLAR VE PROFİL (Profile & Settings Screen)
Tüm kişisel ve çift ayarlarının yönetildiği akordeon (açılır/kapanır kart) ekranı.

- **1. Üst Profil Kartı:**
  - Kullanıcı profil ikonu.
  - İsim, kullanıcı adı.
  - *"Emirhan & Partner • 450 Gündür Birlikte ❤️"* özet metni.
- **2. Profil Bilgileri Akordeonu:**
  - İsim değiştirme alanı.
  - **Cinsiyet Seçimi (Kadın / Erkek):** Değiştirildiği anda uygulamanın tema varyantı anında değişir.
  - "Bilgileri Kaydet" butonu.
- **3. İlişki Tarihleri Akordeonu:**
  - Tanışma Tarihi ve Sevgili Olma Tarihi seçicileri.
  - "Tarihleri Güncelle" butonu (Ana sayfadaki tüm sayaçları anında günceller).
- **4. Cüzdan & Token Yönetimi Akordeonu:**
  - **Mevcut Token Bakiyesi:** Sayısal gösterge (Örn: `75 Token ⚡`).
  - **"Reklam İzle (+25 Token Kazan)"** butonu (Ödüllü reklam modalını tetikler).
  - Token kullanım bilgilendirme metni.
- **5. Promosyon Kodu Kullan Akordeonu:**
  - Kod giriş alanı (Örn: `ASK2026`).
  - "Kodu Uygula" butonu.
  - Kural: Geçerli kod girildiğinde hesaba hediye Token veya ortak Premium süresi tanımlar.
- **6. Güvenlik Akordeonu:**
  - Kayıtlı e-posta bilgisi.
  - "Şifre Sıfırlama E-postası Gönder" butonu.
- **7. Çift ve Hesap Yönetimi (Tehlikeli Alan):**
  - **Eşleşmeyi Sonlandır:** Partner ile olan bağlantıyı koparır, çifti beklemeye alır.
  - **Hesabımı Sil (Soft Delete):** Kullanıcıya 30 gün cayma süresi tanır, bu süre içinde giriş yapılmazsa veriler kalıcı olarak silinir.
- **8. Çıkış Yap Butonu:**
  - Oturumu kapatır ve Giriş Yap ekranına döner.

---

### BÖLÜM 4: GENİŞLETİLMİŞ MODÜLLER (MENÜDEN ERİŞİLEN SAYFALAR)

Ana sayfadaki menü butonundan ulaşılan sayfalar:

---

#### EKRAN 14: REGL VE DÖNGÜ TAKVİMİ (Period Tracker Screen)
Cinsiyete ve Premium durumuna göre tamamen farklı çalışan sağlık modülü.

- **DURUM 1: KADIN KULLANICI GÖRÜNÜMÜ (Tam Yetkili):**
  - Aylık regl takvimi.
  - **Gün İşaretleme:** Takvimdeki bir güne tıklandığında gün kırmızı halka içine alınır (Regl başlangıcı). Tekrar tıklanırsa işaret kalkar.
  - **Kural (Sınır):** Bir takvim ayı içerisinde en fazla 2 başlangıç günü seçilebilir. 3. gün seçilmek istendiğinde sistem "Bir ayda en fazla 2 gün seçebilirsiniz" uyarısı verir.
  - Döngü Analiz Kartı: Gelecek regl tahmini ve doğurganlık/ovülasyon dönemi tahmin göstergeleri.
- **DURUM 2: ERKEK KULLANICI — ÜCRETSİZ HESAP (Kilitli):**
  - Ekran içeriği buğulu/kilitlidir.
  - Ortada büyük Kilit simgesi.
  - Başlık: *"Partnerinin Döngüsünü Takip Et"*.
  - Açıklama: *"Partnerinin özel günlerini, ruh hali döngülerini önceden bilmek ve ona destek olmak için Premium'a geç."*
  - "Premium ile Kilidi Aç" butonu (Paywall açar).
- **DURUM 3: ERKEK KULLANICI — PREMIUM HESAP (Açık):**
  - Kadın partnerin girdiği tüm regl günlerini ve döngü tahminlerini canlı olarak görür.
  - Erkeğe özel destek ve ilgi ipuçları kartı yer alır.

---

#### EKRAN 15: ORTAK FOTOĞRAF GALERİSİ (Photos Screen)
Çiftin ortak fotoğraf arşivi.

- **1. Üst Alan:**
  - Sayfa başlığı, "Fotoğraf Yükle" kamera butonu ve Menü butonu.
- **2. Fotoğraf Listesi (Sonsuz Kaydırma / Pagination):**
  - Çekilme tarihine göre sıralanmış fotoğraf ızgarası.
  - Fotoğraf Kartı:
    - Çekilme tarihi etiketi (Örn: *"14 Şubat 2025"*).
    - Fotoğraf görseli.
    - Yükleyen kişi kendi fotoğrafında "Sil (Çöp Kutusu)" butonunu görür.
    - Şifrelenmiş başlık ve hikaye metni (tıklandığında okunur).
- **3. Kural & Kısıtlama:**
  - Ortak Galeri **yalnızca Premium kullanıcılar** içindir. Ücretsiz kullanıcılar sayfayı açtığında kilit ekranı ve Paywall butonu ile karşılaşır.

---

#### EKRAN 16: FOTOĞRAF YÜKLEME (Add Photo Screen)
- **1. Fotoğraf Seçim Alanı:**
  - Galeriden fotoğraf seçme butonu.
  - Seçilen fotoğrafın önizlemesi ve "Değiştir" butonu.
- **2. Otomatik EXIF Analiz Motoru:**
  - Fotoğraf galeriden seçildiği an dosyanın EXIF metadata'sı taranır (`DateTimeOriginal`).
  - **EXIF Bulunursa:** "Fotoğrafın çekildiği gerçek tarih ve saat otomatik algılandı!" onay rozeti çıkar ve tarih/saat seçicileri otomatik dolar.
  - **EXIF Bulunamazsa:** Bugüne ayarlanır ve kullanıcıya manuel seçmesi önerilir.
- **3. Tarih ve Saat Seçicileri:**
  - Çekildiği Gün (DatePicker) ve Çekildiği Saat (TimePicker).
- **4. Metin Alanları:**
  - Fotoğraf Başlığı.
  - Anının Hikayesi / Açıklaması alanı.
- **5. "Galeriye Kaydet" Butonu:**
  - Görseli ve şifreli bilgileri veritabanına yükler. Premium kontrolü yapar.

---

#### EKRAN 17: ÖZEL GÜNLER VE YIL DÖNÜMLERİ (Memories Screen)
- **1. Otomatik Eklenen Özel Günler:**
  - Tanışma Yıl Dönümü (Kayıtlı tarihe göre her yıl otomatik tekrarlar).
  - Sevgili Olma Yıl Dönümü (Her yıl otomatik tekrarlar).
- **2. Özel Gün Kartları:**
  - Tarih ikonu / küçük resim.
  - Özel Gün Başlığı (Örn: *"İlk Sinemamız"*, *"Nişan Günümüz"*).
  - Açıklama metni.
  - **Sayaç Rozeti:** Gelecekse `[X] gün kaldı`, geçmişse `[X]. yıl dönümü`.
  - Düzenle ve Sil butonları.
- **3. "+ Yeni Özel Gün Ekle" butonu.**

---

#### EKRAN 18: ÖZEL GÜN EKLE / DÜZENLE (Add Memory Screen)
- **Ekrandaki Elemanlar:**
  - Başlık alanı.
  - Tarih Seçici alanı.
  - Açıklama / Anı metni alanı.
  - **Fotoğraf Ekleme Seçeneği:**
    - Kural: Özel güne fotoğraf bağlama özelliği **Premium kullanıcılara özeldir**. Ücretsiz kullanıcı fotoğraf eklemek istediğinde Paywall tetiklenir.
  - "Kaydet" butonu.

---

#### EKRAN 19: GÜNLÜĞÜM / GEÇMİŞ GÜNLÜK NOTLARI (Daily Notes Screen)
- **Ekrandaki Elemanlar:**
  - Ana sayfadan kaydedilen geçmiş günlük notlarının ters kronolojik listesi.
  - Her kartta: Tarih etiketi (Örn: *"28 Ağustos 2026, Cuma"*), şifresi çözülmüş günlük içeriği.
  - Kart üzeri hızlı aksiyonlar: Düzenle butonu ve Sil butonu.
  - Not düzenleme açılır penceresi / modalı.

---

#### EKRAN 20: YENİ GÜNLÜK YAZ (Add Daily Note Screen)
- **Ekrandaki Elemanlar:**
  - Geri dön butonu.
  - Bugünün tarihi başlığı.
  - Tam ekran metin yazma alanı (Placeholder: *"Sevgili günlük..."*).
  - "Kaydet" onay butonu.
- **Kural:** Kaydedilen içerik doğrudan şifrelenir ve ana sayfadaki günlük kutusunu da günceller.

---

#### EKRAN 21: BULUŞMALAR VE HARİTA KONUM SEÇİCİ (Meetings Screen)
- **1. Gelecek Buluşmalar Listesi:**
  - Buluşma Adı (Örn: *"Yıldönümü Yemeği"*).
  - Buluşma Tarihi ve Saati.
  - Mekan Adı (Örn: *"Kadıköy Rıhtım"*).
  - **"Yol Tarifi Al" Butonu:** Google Maps veya Apple Maps uygulamasını koordinatlarla doğrudan açar.
  - Düzenle ve Sil butonları.
- **2. Yeni Buluşma Planlama Alanı:**
  - Başlık input'u.
  - Tarih ve Saat seçicileri (Geçmiş tarihe buluşma planlanamaz kuralı).
  - Mekan Adı input'u.
  - **"Haritadan Seç" Butonu:** Harita seçim penceresini açar.
- **3. İnteraktif Harita Konum Seçici Modalı (`MapPickerModal`):**
  - İnteraktif Harita (Kullanıcı haritayı kaydırabilir ve yakınlaştırabilir).
  - Haritanın merkezinde sabit duran Kalp Konum İğnesi (Pin).
  - Harita hareket ettikçe otomatik koordinat tespiti (`latitude`, `longitude`).
  - "Bu Konumu Onayla" butonu.

---

#### EKRAN 22: TAM EKRAN MENÜ (Full Menu Drawer Modal)
- **Ekrandaki Elemanlar:**
  - Kapat (X) butonu.
  - Mini Çift Kartı (İsimler ve gün sayısı).
  - **11 Adet Sayfa Yönlendirme Butonu:**
    - 1. Ana Sayfa
    - 2. İlaçlar
    - 3. Özel Günler
    - 4. Ortak Galeri
    - 5. Fotoğraf Yükle
    - 6. Günlüğüm
    - 7. Takvim
    - 8. Mektuplar
    - 9. Regl Takvimi
    - 10. Buluşmalar
    - 11. Ayarlar & Profil
  - Çıkış Yap butonu.

---

### BÖLÜM 5: PARASAL, REKLAM VE ABONELİK SİSTEMİ (MONETIZATION)

---

#### EKRAN 23: PREMIUM SATIN ALMA EKRANI (Paywall Screen)
- **1. Başlık ve Vurgu:**
  - Taç simgesi.
  - *"Couples Premium: İkiniz İçin Tek Abonelik"*.
  - *"Biri satın alır, her iki partner de sınırsız kullanır!"* temel kuralı.
- **2. Özellik Avantaj Maddeleri:**
  - Partnerin için de geçerli ortak Premium abonelik.
  - Sınırsız fotoğraf yükleme ve ortak galeri arşivi.
  - Erkekler için canlı regl takvimi görünümü.
  - Takvimde geçmiş günlerin fotoğraflı anılarını inceleme.
  - Sınırsız geleceğe mektup yazma.
  - Reklamsız deneyim.
- **3. Paket Seçenek Kartları:**
  - **Yıllık Paket (Tavsiye Edilen):** Yıllık indirimli fiyat ve 14 gün ücretsiz deneme etiketi.
  - **Aylık Paket:** Standart aylık yenilenen abonelik.
- **4. Aksiyon Butonları:**
  - "Satın Al / 14 Gün Ücretsiz Dene" butonu.
  - "Satın Alımları Geri Yükle (Restore)" butonu.
  - İptal koşulları bilgilendirme metni.

---

#### EKRAN 24: ÖZELLİK İÇİ PAYWALL MODALI (`PremiumPaywall` Modal)
Kullanıcı uygulama içinde kilitli bir fonksiyona bastığında açılan köprü penceredir.

- **Ekrandaki Elemanlar:**
  - Kilit simgesi ve "Bu özellik Premium üyelere özeldir" başlığı.
  - 5 ana avantaj maddesi.
  - **1. Seçenek:** "Premium'a Geç" butonu (Paywall ekranına yönlendirir).
  - **2. Seçenek (Token ile Açma):**
    - "veya" ayırıcı çizgisi.
    - **"[X] Token ile Kullan" butonu:** Kullanıcının mevcut token bakiyesi gösterilir. Yeterli token'ı varsa özellik tek seferlik açılır.
  - **3. Seçenek (Reklam İzle Token Kazan):**
    - "🎬 Reklam İzleyerek +25 Token Kazan" butonu.

---

#### EKRAN 25: ÖDÜLLÜ REKLAM İZLEME MODALI (`WatchAdModal`)
- **Ekrandaki Elemanlar:**
  - Jeton/Token simgesi.
  - Başlık: *"Token Kazan"*.
  - Açıklama: *"Kısa bir video reklam izleyerek anında 25 Token kazanabilirsin."*
  - "Reklamı Başlat" butonu.
- **Kural:** Kullanıcı reklamı sonuna kadar izlediğinde cüzdanına +25 Token eklenir ve "Tebrikler!" başarı uyarısı verilir. Reklam yarıda kapatılırsa ödül verilmez.

---

#### EKRAN 26: PREMIUM BAŞARI KUTLAMA MODALI (`PremiumSuccessModal`)
- **Ekrandaki Elemanlar:**
  - Kutlama simgesi.
  - Başlık: *"Tebrikler, Artık Premium Çiftsiniz!"*.
  - Açıklama: *"Bu abonelik hem senin hem de partnerin için başarıyla aktif edildi. Tüm kilitler açıldı."*
  - "Harika!" kapatma butonu.

---

## BÖLÜM 6: TÜM İŞ KURALLARI VE KISITLAMALARIN ÖZET TABLOSU

| Özellik / Ekran | İş Kuralı & Kısıtlama Mantığı |
| :--- | :--- |
| **Giriş (Login)** | 5 başarısız denemede 30 saniye süreyle kilitlenir (Brute force koruması). |
| **Eşleşme (Pairing)** | Kendi ürettiğin kodu giremezsin. Çiftte en fazla 2 kişi olabilir. |
| **Tarihler (Dates)** | Tanışma ve sevgili olma tarihi bugünden ileri bir tarih olamaz. Tanışma tarihi sevgili olma tarihinden sonra olamaz. |
| **Ruh Hali (Mood)** | Günde sadece 1 kez seçilebilir, gün içinde kilitlenir. Seçilince partnere anlık push bildirim gider. |
| **Günlük Not** | Günde 1 not kaydedilebilir. Yarın yeni not yazılabilir. |
| **Buluşma (Meetings)** | Geçmiş bir zamana buluşma planlanamaz. Konum koordinatları harita pininden dinamik alınır. |
| **Regl Takvimi (Kadın)** | Ayda en fazla 2 başlangıç günü kaydedilebilir. |
| **Regl Takvimi (Erkek)** | Ücretsiz erkek kullanıcılara tamamen kilitlidir. Premium erkekler partnerinin döngüsünü görür. |
| **Mektuplar (Letters)** | Açılma tarihi bugünden sonraki bir tarih olmak zorundadır. Kilit tarihi gelmeden mektup açılamaz. |
| **Mektup Limiti** | Ücretsiz kullanıcılarda 15 mektup limiti vardır. Limit dolunca Token veya Premium gerekir. |
| **Fotoğraf Yükleme** | EXIF verisi taranarak çekilme tarihi otomatik tespit edilir. Galeriye fotoğraf ekleme Premium özelliğidir. |
| **Özel Gün Fotoğrafı** | Özel günlere fotoğraf eklemek Premium özelliğidir. |
| **Ortak Premium** | Eşlerden biri Premium aldığında veya promosyon kodu kullandığında her iki taraf da Premium olur. |
| **Token Kazanımı** | Her ödüllü reklam izleme kullanıcının şahsi cüzdanına 25 token ekler. |
