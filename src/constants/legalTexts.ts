/**
 * Couples App Yasal & Mevzuat Metinleri
 * 6698 Sayılı KVKK, GDPR, Apple App Store Review Guidelines (3.1.2, 5.1.1) ve Google Play Politikalarına Uygun Metinler
 */

export type LegalDocType = "kvkk" | "privacy" | "terms" | "consent" | "subscription";

export interface LegalDocument {
  id: LegalDocType;
  title: string;
  badge: string;
  lastUpdated: string;
  summary: string;
  content: string[];
}

export const LEGAL_DOCS: Record<LegalDocType, LegalDocument> = {
  kvkk: {
    id: "kvkk",
    title: "KVKK Aydınlatma Metni",
    badge: "6698 Sayılı Kanun",
    lastUpdated: "Eylül 2026",
    summary: "Kişisel verilerinizin işlenme amaçları, toplanma yöntemleri, hukuki sebepleri ve 6698 Sayılı KVKK 11. madde kapsamındaki haklarınız hakkında bilgilendirme.",
    content: [
      "1. VERİ SORUMLUSU",
      "Couples App (\"Uygulama\" veya \"Veri Sorumlusu\") olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") ve ilgili mevzuat uyarınca, kullanıcılarımızın kişisel verilerinin güvenliğine ve gizliliğine azami hassasiyet göstermekteyiz. İşbu Aydınlatma Metni, mobil uygulamamız üzerinden toplanan kişisel verilerinizin hangi amaçlarla işlendiğini ve haklarınızı açıklamaktadır.",

      "2. İŞLENEN KİŞİSEL VERİ KATEGORİLERİ VE VERİ TÜRLERİ",
      "Uygulamamızın sunduğu çift anı defteri, zaman kilitli mektuplar, konum tabanlı buluşma planları ve sağlık/döngü takip fonksiyonları kapsamında aşağıdaki kişisel verileriniz işlenmektedir:\n" +
      "• Kimlik ve İletişim Bilgileri: Ad-soyad, kullanıcı adı, e-posta adresi, cinsiyet bilgisi.\n" +
      "• Çift ve İlişki Bilgileri: Eşleşme kodu (pairing code), tanışma tarihi, sevgili olma tarihi, yıldönümü tarihleri.\n" +
      "• Görsel ve İşitsel Kayıtlar: Ortak galeriye veya günlüklere yüklediğiniz fotoğraflar, anı görselleri ve profil avatarları.\n" +
      "• Lokasyon (Konum) Bilgileri: Buluşma noktası seçimi ve anılarınıza isteğe bağlı eklenen GPS koordinatları ve harita pinleri.\n" +
      "• Özel Nitelikli Kişisel Veriler (Sağlık Bilgileri): Kadın kullanıcılar ve çiftleri için döngü/regl başlangıç ve tahmin tarihleri, günlük ilaç/vitamin saatleri ve takip kayıtları.\n" +
      "• Mesajlaşma ve Anı Verileri: Zaman kilitli mektuplar, günlük notları ve ruh hali (mood) seçimleri. (Bu veriler yerel olarak ve sunucuda şifreli/hash formatında saklanmaktadır).\n" +
      "• Müşteri İşlem ve Finansal Bilgiler: RevenueCat ve uygulama mağazası (App Store / Google Play) üzerinden sağlanan anonim işlem tokenları, abonelik durumu, paket türü ve token bakiyesi.\n" +
      "• Cihaz ve İşlem Güvenliği: Cihaz modeli, işletim sistemi versiyonu, push bildirim tokenları, benzersiz cihaz kimliği (UUID), son oturum açma zamanı ve güvenlik logları.",

      "3. KİŞİSEL VERİLERİN İŞLENME AMAÇLARI",
      "Kişisel verileriniz aşağıdaki amaçlarla (\"Amaçlar\") KVKK'nın 5. ve 6. maddelerine uygun olarak işlenmektedir:\n" +
      "• Kullanıcı hesabı oluşturulması, kimlik doğrulama ve yetkisiz erişimlerin engellenmesi,\n" +
      "• İki partnerin özel eşleşme kodu ile birbirine bağlanması ve senkronize anı/takvim paylaşımı sağlanması,\n" +
      "• Zaman kilitli mektupların şifrelenmesi ve belirlenen tarihe kadar kilitli tutulması,\n" +
      "• Ortak buluşma noktalarının haritada görüntülenmesi ve rota kolaylığı sunulması,\n" +
      "• İlaç saati, regl döngüsü, yıldönümü ve mektup teslim bildirimlerinin gönderilmesi,\n" +
      "• Premium abonelik haklarının tanımlanması ve tek abonelikle her iki partnerin de premium özelliklerden faydalandırılması,\n" +
      "• Bilgi güvenliği süreçlerinin yürütülmesi ve siber saldırılara/brute-force denemelerine karşı koruma sağlanması.",

      "4. KİŞİSEL VERİLERİN AKTARILDIĞI TARAFLAR",
      "Kişisel verileriniz, kanunun emrettiği istisnalar haricinde hiçbir üçüncü tarafa reklam veya ticari amaçla satılmaz. Veriler yalnızca hizmetin ifası için teknik altyapı sağlayıcılarımızla paylaşılır:\n" +
      "• Supabase Inc.: Güvenli PostgreSQL veritabanı, uçtan uca şifreleme ve kimlik doğrulama altyapısı,\n" +
      "• RevenueCat Inc.: Uygulama içi satın alma, abonelik doğrulama ve iade altyapısı,\n" +
      "• Google Cloud / Firebase & Expo Notifications: Push bildirimlerinin cihazınıza güvenle ulaştırılması,\n" +
      "• Yetkili Kamu Kurum ve Kuruluşları: Yargı kararları veya yasal zorunluluklar halinde yetkili adli/idari makamlar.",

      "5. VERİ TOPLAMANIN YÖNTEMİ VE HUKUKİ SEBEPLERİ",
      "Verileriniz mobil uygulama arayüzü, kamera/galeri erişimi, cihaz sensörleri ve bildirim izinleri vasıtasıyla elektronik ortamda toplanır. Hukuki sebepler:\n" +
      "• KVKK md. 5/2-c: Bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması (Kullanıcı Sözleşmesi),\n" +
      "• KVKK md. 5/2-f: Temel hak ve özgürlüklerinize zarar vermemek kaydıyla veri sorumlusunun meşru menfaatleri,\n" +
      "• KVKK md. 5/1 ve md. 6/2: Sağlık verileri (regl/ilaç takibi), hassas konum verileri ve pazarlama/bildirim süreçleri için vermiş olduğunuz Açık Rıza.",

      "6. VERİLERİN GÜVENLİĞİ VE ŞİFRELEME (AES-256)",
      "Couples App, kullanıcıların özel hayatının gizliliğini korumak adına gelişmiş kriptografik yöntemler kullanır. Günlük notlarınız, mektuplarınız ve hassas kullanıcı bilgileriniz veritabanında simetrik ve deterministik şifreleme (AES standartları) ile korunmaktadır. Veritabanına fiziksel erişim olsa dahi şifre çözme anahtarı olmaksızın içerikler okunamamaktadır.",

      "7. VERİ SAKLAMA VE SİLME (UNUTULMA HAKKI)",
      "Kullanıcı profil ayarlarından hesabını silme talebinde bulunduğunda, veriler derhal kullanıma kapatılır ve 7 günlük güvenlik/cayma süresinin ardından tüm ortak fotoğraflar, günlükler, mektuplar ve hesap kayıtları geri döndürülemez biçimde sunuculardan kalıcı olarak silinir.",

      "8. KVKK'NIN 11. MADDESİ KAPSAMINDAKİ HAKLARINIZ",
      "KVKK 11. maddesi uyarınca dilediğiniz zaman Veri Sorumlumuza başvurarak:\n" +
      "a) Kişisel verinizin işlenip işlenmediğini öğrenme,\n" +
      "b) İşlenmişse buna ilişkin bilgi talep etme,\n" +
      "c) İşlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme,\n" +
      "d) Yurt içinde veya yurt dışında kişisel verilerin aktarıldığı üçüncü kişileri bilme,\n" +
      "e) Eksik veya yanlış işlenmişse düzeltilmesini isteme,\n" +
      "f) KVKK 7. maddesi uyarınca silinmesini veya yok edilmesini isteme,\n" +
      "g) Yapılan işlemlerin aktarılan üçüncü kişilere bildirilmesini isteme,\n" +
      "h) İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,\n" +
      "i) Kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.\n\n" +
      "Haklarınızı kullanmak için uygulama içi destek alanından veya emirhanekin94@gmail.com adresinden bizimle iletişime geçebilirsiniz."
    ]
  },

  privacy: {
    id: "privacy",
    title: "Gizlilik Politikası",
    badge: "Privacy Policy",
    lastUpdated: "Eylül 2026",
    summary: "Uygulamamızın veri toplama, işleme, koruma prensipleri ve gizliliğinizi nasıl koruduğumuzun detayları.",
    content: [
      "1. GİRİŞ VE TAAHHÜDÜMÜZ",
      "Couples App, çiftler arasındaki en özel anları, mektupları ve günlükleri güvenli bir dijital alanda paylaşmaları için tasarlanmıştır. Bu sebeple kullanıcı gizliliği en temel önceliğimizdir. Bilgileriniz asla üçüncü şahıslara satılmaz, pazarlama veritabanlarına devredilmez.",

      "2. TOPLANAN BİLGİLER VE KULLANIM ALANLARI",
      "• Hesap Bilgileri: Kayıt sırasında belirttiğiniz ad, kullanıcı adı, e-posta adresi ve şifreniz (güvenli hash olarak).\n" +
      "• İlişki ve Anı İçeriği: Eklediğiniz fotoğraflar, anı açıklamaları, mektuplar ve takvim notları. Bu içerikler yalnızca siz ve eşleştiğiniz partneriniz tarafından görüntülenebilir.\n" +
      "• Döngü ve Sağlık Verileri: Regl başlangıç tarihleri ve ilaç saatleri. Bu veriler yalnızca döngü tahmini ve size zamanında hatırlatıcı bildirim göndermek için işlenir.\n" +
      "• Konum Bilgileri: Yalnızca siz harita üzerinde bir buluşma noktası seçtiğinizde veya fotoğraflarınıza isteğe bağlı konum eklediğinizde alınır; arka planda sürekli konum takibi yapılmaz.",

      "3. GÜVENLİK VE VERİ ŞİFRELEMESİ",
      "Tüm veri iletişimi SSL/TLS protokolleri ile şifreli olarak gerçekleşir. Özel günlükler ve mektuplar şifrelenmiş olarak depolanır. Cihazınızda oturum anahtarları şifrelenmiş yerel hafızada (Secure AsyncStorage) saklanır.",

      "4. ÇEREZLER VE CİHAZ KİMLİĞİ",
      "Uygulama içinde yetkisiz cihaz girişlerini tespit etmek ve brute-force saldırılarını önlemek amacıyla rastgele üretilmiş bir 'Cihaz Kimliği' (UUID) kullanılır. Bu kimlik kişisel profilinizle ilişkilendirilerek başka bir cihazdan giriş yapıldığında e-posta onayı (OTP) istememizi sağlar.",

      "5. HESAP SİLME VE VERİLERİN İMHASI (GDPR & KVKK UYUMLU)",
      "Hesabınızı istediğiniz zaman Profil > Ayarlar > Hesabımı Sil adımından silebilirsiniz. Silme talebi verildiğinde çiftin ortak havuzu 7 günlük bir güvenlik beklemesine alınır. 7 gün içinde herhangi bir partner giriş yapmazsa, tüm mektuplar, fotoğraflar, sohbetler ve veritabanı kayıtları sunuculardan kalıcı olarak silinir ve geri getirilemez.",

      "6. YAŞ SINIRI",
      "Couples App, 16 yaşından küçüklerin kullanımına yönelik değildir. 16 yaşın altındaki bir kullanıcının veri sağladığı tespit edilirse veriler derhal silinir.",

      "7. POLİTİKA GÜNCELLEMELERİ",
      "Gizlilik politikamız zaman zaman mevzuat veya uygulama özellikleri gereği güncellenebilir. Önemli değişiklikler uygulama içerisinden bildirim ile duyurulacaktır."
    ]
  },

  terms: {
    id: "terms",
    title: "Kullanım Koşulları (EULA)",
    badge: "Kullanıcı Sözleşmesi",
    lastUpdated: "Eylül 2026",
    summary: "Uygulamayı kullanırken uyulması gereken genel kurallar, hesap güvenliği, çift eşleşmesi ve sorumluluk sınırları.",
    content: [
      "1. SÖZLEŞMENİN KABULÜ",
      "Couples App mobil uygulamasını indirerek, hesap oluşturarak veya kullanarak işbu Kullanım Koşulları'nı (\"Sözleşme\") kabul etmiş sayılırsınız. Bu koşulları kabul etmiyorsanız lütfen uygulamayı kullanmayınız.",

      "2. HİZMETİN KAPSAMI VE ÇİFT EŞLEŞMESİ",
      "Couples App, iki kullanıcının özel bir kod (\"Eşleşme Kodu\") aracılığıyla birbirine bağlanarak ortak anı, takvim, fotoğraf, döngü takibi ve zaman kilitli mektuplar paylaşmasını sağlayan bir platformdur. Eşleşme kodunuzu yalnızca güvendiğiniz partnerinizle paylaşmalısınız.",

      "3. HESAP GÜVENLİĞİ VE ŞİFRELER",
      "Kullanıcı, hesap şifresinin gizliliğini korumaktan bizzat sorumludur. Hesabınız altında gerçekleşen tüm faaliyetler sizin sorumluluğunuzdadır. Yetkisiz bir giriş fark ettiğinizde derhal şifrenizi sıfırlamalı veya bizimle iletişime geçmelisiniz.",

      "4. KABUL EDİLEMEZ KULLANIM VE YASAKLI İÇERİKLER",
      "Uygulamayı kullanırken aşağıdaki eylemlerde bulunmak kesinlikle yasaktır:\n" +
      "• Yasadışı, tehditkar, taciz edici, hakaret içeren veya üçüncü şahısların mahremiyetini ihlal eden içerik yüklemek,\n" +
      "• Partnerinizin rızası olmaksızın özel görüntülerini yüklemek veya paylaşmak,\n" +
      "• Uygulama altyapısına, sunucularına veya tersine mühendislik yöntemleriyle kaynak koduna müdahale etmeye çalışmak,\n" +
      "• Otomatik botlar veya scriptler ile veri çekmek (scraping).",

      "5. FİKRİ MÜLKİYET HAKLARI",
      "Uygulamanın tasarımı, logoları, kodları, arayüz unsurları ve marka hakları Veri Sorumlusuna aittir. Yüklediğiniz fotoğrafların ve anıların telif hakları size aittir; ancak uygulamanın çalışması için gerekli teknik lisansı vermiş sayılırsınız.",

      "6. HİZMET KESİNTİLERİ VE SORUMLULUK REDDİ",
      "Uygulama 'olduğu gibi' ve 'mevcut haliyle' sunulmaktadır. Mücbir sebepler, internet altyapı arızaları veya bakım çalışmaları nedeniyle yaşanabilecek geçici kesintilerden doğrudan veya dolaylı maddi/manevi zararlardan Veri Sorumlusu sorumlu tutulamaz.",

      "7. FESİH VE ASKIYA ALMA",
      "İşbu koşullara aykırı hareket eden kullanıcıların hesapları önceden bildirim yapılmaksızın askıya alınabilir veya kalıcı olarak sonlandırılabilir."
    ]
  },

  consent: {
    id: "consent",
    title: "Açık Rıza Metni",
    badge: "Özel Nitelikli Veri",
    lastUpdated: "Eylül 2026",
    summary: "Sağlık (döngü/regl) verileri, hassas konum verileri ve bildirim süreçlerine ilişkin açık rıza beyanı.",
    content: [
      "1. AÇIK RIZANIN KAPSAMI VE NİTELİĞİ",
      "6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") kapsamında, veri sorumlusuna sunduğum ve aşağıda detaylandırılan kişisel ve özel nitelikli kişisel verilerimin, Aydınlatma Metni'nde belirtilen ilkeler doğrultusunda işlenmesine ve eşleştiğim partnerimle paylaşılmasına özgür irademle açık rıza veriyorum.",

      "2. AÇIK RIZA VERİLEN VERİ TÜRLERİ VE AMACI",
      "• Özel Nitelikli Kişisel Veri (Sağlık Bilgisi): Uygulama içerisindeki regl/döngü takvimi ve ilaç takibi modüllerinde girdiğim tarih, döngü uzunluğu, semptom ve ilaç kullanım verilerimin; döngü tahmini yapılması, hatırlatıcı bildirimler üretilmesi ve eşleştiğim partnerimin ekranında görüntülenmesi amacıyla işlenmesi,\n" +
      "• Lokasyon (Konum) Verisi: Harita üzerinden seçtiğim buluşma noktaları ve anılara eklediğim GPS koordinatlarının, harita üzerinde partnerime gösterilmesi ve ortak rota planlaması amacıyla işlenmesi,\n" +
      "• Çift Ortak Verisi: Yüklediğim anı fotoğrafları, aşk mektupları ve ruh hali durumlarının yalnızca eşleştiğim partnerimle paylaşılmak üzere şifreli sunucularda saklanması,\n" +
      "• Bildirim Gönderimi: Önemli yıldönümleri, teslim edilen mektuplar ve ilaç hatırlatmaları için cihazıma anlık push bildirimi gönderilmesi.",

      "3. RIZANIN GERİ ALINMASI",
      "İşbu Açık Rıza beyanımı dilediğim zaman uygulama içerisindeki Ayarlar bölümünden döngü/sağlık veya konum izinlerimi kapatarak ya da hesabımı silerek geri alabileceğimi biliyor ve kabul ediyorum."
    ]
  },

  subscription: {
    id: "subscription",
    title: "Abonelik ve İade Koşulları",
    badge: "App Store & Play Store",
    lastUpdated: "Eylül 2026",
    summary: "Premium abonelik, 14 günlük ücretsiz deneme, otomatik yenileme, iptal prosedürü ve iade şartları.",
    content: [
      "1. COUPLES PREMIUM ABONELİĞİ VE KAPSAMI",
      "Couples App Premium, çiftlerden birinin abone olması halinde her iki partner için de geçerli olan ortak bir abonelik modelidir. Premium avantajları:\n" +
      "• Sınırsız fotoğraf yükleme ve ortak yüksek çözünürlüklü galeri,\n" +
      "• Erkek partnerler için özel regl/döngü takvimi görünümü ve bildirimleri,\n" +
      "• Zaman kilitli sınırsız mektup yazma ve ileri tarihli teslimatlar,\n" +
      "• Tüm banner ve geçiş reklamlarından tamamen arındırılmış deneyim,\n" +
      "• Fotoğraflı geçmiş takvim günleri ve özel gün sayaçları.",

      "2. ÜCRETSİZ DENEME SÜRESİ (14 GÜN)",
      "İlk kez Premium pakete geçen kullanıcılara 14 günlük ücretsiz deneme hakkı tanınabilir. 14 günlük deneme süresi boyunca kullanıcıdan herhangi bir ücret tahsil edilmez. Deneme süresi sona ermeden en az 24 saat önce iptal edilmediği takdirde, seçilen paket ücreti üzerinden otomatik olarak ücretli aboneliğe geçiş yapılır.",

      "3. OTOMATİK YENİLEME VE ÜCRETLENDİRME (APPLE & GOOGLE EULA)",
      "• Satın alma onayıyla birlikte ödeme Apple Kimliği / Google Play hesabınızdan tahsil edilir.\n" +
      "• Abonelik, mevcut abonelik döneminin bitiminden en az 24 saat önce kapatılmadığı sürece seçilen plan periyodunda (aylık veya yıllık) otomatik olarak yenilenir.\n" +
      "• Cari dönemin bitimine 24 saat kala yenileme ücreti hesabınızdan tahsil edilir ve yenileme tutarı net olarak belirtilir.",

      "4. ABONELİĞİ İPTAL ETME PROSEDÜRÜ",
      "Aboneliğinizi istediğiniz an hiçbir cezai şart olmaksızın iptal edebilirsiniz. İptal işlemi mobil uygulama üzerinden değil, mağaza hesap ayarlarınızdan yapılmalıdır:\n" +
      "• iOS (Apple App Store): iPhone Ayarlar > [Adınız] > Abonelikler > Couples App > Aboneliği İptal Et adımlarını takip ediniz.\n" +
      "• Android (Google Play Store): Google Play Uygulaması > Profil Simgesi > Ödemeler ve Abonelikler > Abonelikler > Couples App > İptal Et adımlarını takip ediniz.\n" +
      "Aboneliğinizi iptal ettiğinizde, mevcut fatura döneminin sonuna kadar Premium haklarınızdan faydalanmaya devam edersiniz.",

      "5. CAYMA HAKKI VE İADE POLİTİKASI",
      "Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesinin 1. fıkrasının (ğ) bendi uyarınca; 'Elektronik ortamda anında ifa edilen hizmetler veya tüketiciye anında teslim edilen gayrimaddi mallara ilişkin sözleşmelerde' cayma hakkı kullanılamaz. Bununla birlikte, hatalı veya mükerrer tahsilatlara ilişkin iade talepleri doğrudan Apple Destek (reportaproblem.apple.com) veya Google Play Destek platformları üzerinden yürütülmektedir."
    ]
  }
};
