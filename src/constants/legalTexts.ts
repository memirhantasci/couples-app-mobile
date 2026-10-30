import i18n from "@/lib/i18n";

/**
 * CoupleSky Yasal & Mevzuat Metinleri
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

export const LEGAL_DOCS_TR: Record<LegalDocType, LegalDocument> = {
  kvkk: {
    id: "kvkk",
    title: "KVKK Aydınlatma Metni",
    badge: "6698 Sayılı Kanun",
    lastUpdated: "Ekim 2026",
    summary: "Kişisel verilerinizin işlenme amaçları, toplanma yöntemleri, hukuki sebepleri ve 6698 Sayılı KVKK 11. madde kapsamındaki haklarınız hakkında bilgilendirme.",
    content: [
      "1. VERİ SORUMLUSU",
      "Veri sorumlusu: Necati Taşcı (CoupleSky) · İletişim ve destek: destek@couplesky.app. CoupleSky (\"Uygulama\" veya \"Veri Sorumlusu\") olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") ve ilgili mevzuat uyarınca, kullanıcılarımızın kişisel verilerinin güvenliğine ve gizliliğine azami hassasiyet göstermekteyiz. İşbu Aydınlatma Metni, mobil uygulamamız üzerinden toplanan kişisel verilerinizin hangi amaçlarla işlendiğini ve haklarınızı açıklamaktadır.",

      "2. İŞLENEN KİŞİSEL VERİ KATEGORİLERİ VE VERİ TÜRLERİ",
      "Uygulamamızın sunduğu çift anı defteri, zaman kilitli mektuplar, konum tabanlı buluşma planları ve sağlık/döngü takip fonksiyonları kapsamında aşağıdaki kişisel verileriniz işlenmektedir:\n" +
      "• Kimlik ve İletişim Bilgileri: Ad-soyad, kullanıcı adı, e-posta adresi, cinsiyet bilgisi.\n" +
      "• Çift ve İlişki Bilgileri: Eşleşme kodu (pairing code), tanışma tarihi, sevgili olma tarihi, yıldönümü tarihleri.\n" +
      "• Görsel ve İşitsel Kayıtlar: Ortak galeriye veya günlüklere yüklediğiniz fotoğraflar, anı görselleri ve profil avatarları.\n" +
      "• Lokasyon (Konum) Bilgileri: Buluşma noktası seçimi ve anılarınıza isteğe bağlı eklenen GPS koordinatları ve harita pinleri.\n" +
      "• Özel Nitelikli Kişisel Veriler (Sağlık Bilgileri): Kadın kullanıcılar ve çiftleri için döngü/regl başlangıç ve tahmin tarihleri, günlük ilaç/vitamin saatleri ve takip kayıtları.\n" +
      "• Mesajlaşma ve Anı Verileri: Zaman kilitli mektuplar, günlük notları ve ruh hali (mood) seçimleri. (Bu veriler sunucuda şifreli olarak saklanmaktadır).\n" +
      "• Müşteri İşlem ve Finansal Bilgiler: RevenueCat ve uygulama mağazası (App Store / Google Play) üzerinden sağlanan anonim işlem tokenları, abonelik durumu, paket türü ve token bakiyesi.\n" +
      "• Cihaz ve İşlem Güvenliği: Cihaz modeli, işletim sistemi versiyonu, push bildirim tokenları, benzersiz cihaz kimliği (UUID), son oturum açma zamanı ve güvenlik logları.\n" +
      "• Reklam Verileri: Uygulamada gösterilen reklamlar için Google AdMob tarafından işlenen reklam kimliği ve reklam etkileşim verileri (yalnızca kişiselleştirilmemiş reklam talebi ile sınırlı).",

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
      "Kişisel verileriniz, kanunun emrettiği istisnalar haricinde hiçbir üçüncü tarafa reklam veya ticari amaçla satılmaz. Veriler yalnızca hizmetin ifası için aşağıdaki sağlayıcılarla paylaşılır. Bu sağlayıcıların bir kısmı yurt dışında yerleşiktir; veriler bu nedenle KVKK md. 9 kapsamında yurt dışına aktarılabilir:\n" +
      "• Supabase Inc.: Güvenli PostgreSQL veritabanı, şifreli depolama ve kimlik doğrulama altyapısı,\n" +
      "• RevenueCat Inc.: Uygulama içi satın alma, abonelik doğrulama ve iade altyapısı,\n" +
      "• Google Cloud / Firebase & Expo Notifications: Push bildirimlerinin cihazınıza güvenle ulaştırılması,\n" +
      "• Google LLC (AdMob ve Google Haritalar): reklam gösterimi ve harita hizmetleri,\n" +
      "• Apple Inc. ve Google LLC: Apple ile giriş ve Google ile giriş hizmetleri,\n" +
      "• Yetkili Kamu Kurum ve Kuruluşları: Yargı kararları veya yasal zorunluluklar halinde yetkili adli/idari makamlar.",

      "5. VERİ TOPLAMANIN YÖNTEMİ VE HUKUKİ SEBEPLERİ",
      "Verileriniz mobil uygulama arayüzü, kamera/galeri erişimi, cihaz sensörleri ve bildirim izinleri vasıtasıyla elektronik ortamda toplanır. Hukuki sebepler:\n" +
      "• KVKK md. 5/2-c: Bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması (Kullanıcı Sözleşmesi),\n" +
      "• KVKK md. 5/2-f: Temel hak ve özgürlüklerinize zarar vermemek kaydıyla veri sorumlusunun meşru menfaatleri,\n" +
      "• KVKK md. 5/1 ve md. 6/2: Sağlık verileri (regl/ilaç takibi), hassas konum verileri ve pazarlama/bildirim süreçleri için vermiş olduğunuz Açık Rıza.",

      "6. VERİLERİN GÜVENLİĞİ VE ŞİFRELEME (AES-256)",
      "CoupleSky, günlük notlarınızı ve mektuplarınızı veritabanına AES-256 ile şifrelenmiş olarak yazar. Şifreleme anahtarı, çiftinize özel ve sunucuda tutulan rastgele bir değerden uygulama içinde türetilir. Bu nedenle sistem uçtan uca şifreleme değildir: hizmeti işleten taraf olarak teknik olarak bu içeriklere erişebilecek konumdayız; içeriklerinizi pazarlama dahil hiçbir başka amaçla kullanmayız. Verilere erişim, Satır Düzeyi Güvenlik (RLS) kurallarıyla yalnızca oturum açmış ve ilgili çifte ait kullanıcılarla sınırlandırılmıştır. Fotoğraflarınız özel depolama alanında tutulur ve yalnızca süreli, imzalı bağlantılarla gösterilir. Tüm iletişim TLS ile şifrelidir.",

      "7. VERİ SAKLAMA VE SİLME (UNUTULMA HAKKI)",
      "Profil > Hesap Yönetimi & Tehlike Bölgesi bölümünden hesabınızı silme talebinde bulunabilirsiniz. Talep 7 gün beklemeye alınır; bu süre içinde aynı hesapla giriş yaparak talebi iptal edebilirsiniz. 7 gün sonunda hesabınıza ait profil bilgileri, dosyalar, günlükler ve mektuplar sunuculardan geri döndürülemez biçimde silinir. Partneriniz kendi hesabıyla kullanmaya devam eder; ortak anılar ise her iki taraftan da silinir ve partneriniz çiftten ayrılmış olur. Yedek kopyalar en geç 30 gün içinde otomatik olarak imha edilir.",

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
      "Haklarınızı kullanmak için uygulama içi destek alanından veya destek@couplesky.app adresinden bizimle iletişime geçebilirsiniz."
    ]
  },

  privacy: {
    id: "privacy",
    title: "Gizlilik Politikası",
    badge: "Privacy Policy",
    lastUpdated: "Ekim 2026",
    summary: "Uygulamamızın veri toplama, işleme, koruma prensipleri ve gizliliğinizi nasıl koruduğumuzun detayları.",
    content: [
      "1. GİRİŞ VE TAAHHÜDÜMÜZ",
      "CoupleSky, çiftler arasındaki en özel anları, mektupları ve günlükleri güvenli bir dijital alanda paylaşmaları için tasarlanmıştır. Bu sebeple kullanıcı gizliliği en temel önceliğimizdir. Bilgileriniz asla üçüncü şahıslara satılmaz, pazarlama veritabanlarına devredilmez.",

      "2. TOPLANAN BİLGİLER VE KULLANIM ALANLARI",
      "• Hesap Bilgileri: Kayıt sırasında belirttiğiniz ad, kullanıcı adı, e-posta adresi ve şifreniz (güvenli hash olarak).\n" +
      "• İlişki ve Anı İçeriği: Eklediğiniz fotoğraflar, anı açıklamaları, mektuplar ve takvim notları. Bu içerikler yalnızca siz ve eşleştiğiniz partneriniz tarafından görüntülenebilir.\n" +
      "• Döngü ve Sağlık Verileri: Regl başlangıç tarihleri ve ilaç saatleri. Bu veriler yalnızca döngü tahmini ve size zamanında hatırlatıcı bildirim göndermek için işlenir.\n" +
      "• Konum Bilgileri: Yalnızca siz harita üzerinde bir buluşma noktası seçtiğinizde veya fotoğraflarınıza isteğe bağlı konum eklediğinizde alınır; arka planda sürekli konum takibi yapılmaz.\n" +
      "• Üçüncü taraf hizmetler: Google AdMob (reklam), Google Haritalar (harita), Apple/Google ile giriş, Supabase (veritabanı), RevenueCat (abonelik) ve Expo (bildirim). Ayrıntılar için KVKK Aydınlatma Metni, 4. bölüm.",

      "3. GÜVENLİK VE VERİ ŞİFRELEMESİ",
      "Tüm veri iletişimi SSL/TLS protokolleri ile şifreli olarak gerçekleşir. Özel günlükler ve mektuplar şifrelenmiş olarak depolanır. Oturum bilgileri cihazınızda uygulamanın yerel depolama alanında tutulur; cihazınızı kilit ekranıyla korumanız önerilir.",

      "4. ÇEREZLER VE CİHAZ KİMLİĞİ",
      "Uygulama içinde yetkisiz cihaz girişlerini tespit etmek ve brute-force saldırılarını önlemek amacıyla rastgele üretilmiş bir 'Cihaz Kimliği' (UUID) kullanılır. Bu kimlik kişisel profilinizle ilişkilendirilerek başka bir cihazdan giriş yapıldığında e-posta onayı (OTP) istememizi sağlar.",

      "5. HESAP SİLME VE VERİLERİN İMHASI (GDPR & KVKK UYUMLU)",
      "Hesabınızı istediğiniz zaman Profil > Hesap Yönetimi & Tehlike Bölgesi bölümünden silebilirsiniz. Talep 7 gün beklemeye alınır; bu süre içinde yalnızca hesabın sahibi aynı hesapla giriş yaparak talebi iptal edebilir. 7 gün sonunda hesabınıza ait kayıtlar, dosyalar ve ortak anılar sunuculardan kalıcı olarak silinir ve geri getirilemez.",

      "6. YAŞ SINIRI",
      "CoupleSky, 16 yaşından küçüklerin kullanımına yönelik değildir. 16 yaşın altındaki bir kullanıcının veri sağladığı tespit edilirse veriler derhal silinir.",

      "7. POLİTİKA GÜNCELLEMELERİ",
      "Gizlilik politikamız zaman zaman mevzuat veya uygulama özellikleri gereği güncellenebilir. Önemli değişiklikler uygulama içerisinden bildirim ile duyurulacaktır."
    ]
  },

  terms: {
    id: "terms",
    title: "Kullanım Koşulları (EULA)",
    badge: "Kullanıcı Sözleşmesi",
    lastUpdated: "Ekim 2026",
    summary: "Uygulamayı kullanırken uyulması gereken genel kurallar, hesap güvenliği, çift eşleşmesi ve sorumluluk sınırları.",
    content: [
      "1. SÖZLEŞMENİN KABULÜ",
      "CoupleSky mobil uygulamasını indirerek, hesap oluşturarak veya kullanarak işbu Kullanım Koşulları'nı (\"Sözleşme\") kabul etmiş sayılırsınız. Bu koşulları kabul etmiyorsanız lütfen uygulamayı kullanmayınız.",

      "2. HİZMETİN KAPSAMI VE ÇİFT EŞLEŞMESİ",
      "CoupleSky, iki kullanıcının özel bir kod (\"Eşleşme Kodu\") aracılığıyla birbirine bağlanarak ortak anı, takvim, fotoğraf, döngü takibi ve zaman kilitli mektuplar paylaşmasını sağlayan bir platformdur. Eşleşme kodunuzu yalnızca güvendiğiniz partnerinizle paylaşmalısınız.",

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
    lastUpdated: "Ekim 2026",
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
    lastUpdated: "Ekim 2026",
    summary: "Premium abonelik, ücretsiz deneme (tanımlıysa), otomatik yenileme, iptal prosedürü ve iade şartları.",
    content: [
      "1. COUPLES PREMIUM ABONELİĞİ VE KAPSAMI",
      "CoupleSky Premium, çiftlerden birinin abone olması halinde her iki partner için de geçerli olan ortak bir abonelik modelidir. Premium avantajları:\n" +
      "• Sınırsız fotoğraf yükleme ve ortak yüksek çözünürlüklü galeri,\n" +
      "• Döngü takibi ve ilgili hatırlatıcı bildirimleri,\n" +
      "• Zaman kilitli sınırsız mektup yazma ve ileri tarihli teslimatlar,\n" +
      "• Tüm banner ve geçiş reklamlarından tamamen arındırılmış deneyim,\n" +
      "• Fotoğraflı geçmiş takvim günleri ve özel gün sayaçları.",

      "2. ÜCRETSİZ DENEME SÜRESİ",
      "İlk kez Premium pakete geçen kullanıcılara mağazada ve uygulama içinde belirtilen süre boyunca ücretsiz deneme hakkı tanınabilir. Deneme süresi boyunca kullanıcıdan herhangi bir ücret tahsil edilmez. Deneme süresi sona ermeden en az 24 saat önce iptal edilmediği takdirde, seçilen paket ücreti üzerinden otomatik olarak ücretli aboneliğe geçiş yapılır.",

      "3. OTOMATİK YENİLEME VE ÜCRETLENDİRME (APPLE & GOOGLE EULA)",
      "• Satın alma onayıyla birlikte ödeme Apple Kimliği / Google Play hesabınızdan tahsil edilir.\n" +
      "• Abonelik, mevcut abonelik döneminin bitiminden en az 24 saat önce kapatılmadığı sürece seçilen plan periyodunda (aylık veya yıllık) otomatik olarak yenilenir.\n" +
      "• Cari dönemin bitimine 24 saat kala yenileme ücreti hesabınızdan tahsil edilir ve yenileme tutarı net olarak belirtilir.",

      "4. ABONELİĞİ İPTAL ETME PROSEDÜRÜ",
      "Aboneliğinizi istediğiniz an hiçbir cezai şart olmaksızın iptal edebilirsiniz. İptal işlemi mobil uygulama üzerinden değil, mağaza hesap ayarlarınızdan yapılmalıdır:\n" +
      "• iOS (Apple App Store): iPhone Ayarlar > [Adınız] > Abonelikler > CoupleSky > Aboneliği İptal Et adımlarını takip ediniz.\n" +
      "• Android (Google Play Store): Google Play Uygulaması > Profil Simgesi > Ödemeler ve Abonelikler > Abonelikler > CoupleSky > İptal Et adımlarını takip ediniz.\n" +
      "Aboneliğinizi iptal ettiğinizde, mevcut fatura döneminin sonuna kadar Premium haklarınızdan faydalanmaya devam edersiniz.",

      "5. CAYMA HAKKI VE İADE POLİTİKASI",
      "Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesinin 1. fıkrasının (ğ) bendi uyarınca; 'Elektronik ortamda anında ifa edilen hizmetler veya tüketiciye anında teslim edilen gayrimaddi mallara ilişkin sözleşmelerde' cayma hakkı kullanılamaz. Bununla birlikte, hatalı veya mükerrer tahsilatlara ilişkin iade talepleri doğrudan Apple Destek (reportaproblem.apple.com) veya Google Play Destek platformları üzerinden yürütülmektedir."
    ]
  }
};

export const LEGAL_DOCS_EN: Record<LegalDocType, LegalDocument> = {
  kvkk: {
    id: "kvkk",
    title: "Personal Data Protection & GDPR Clarification Text",
    badge: "GDPR & KVKK Compliant",
    lastUpdated: "October 2026",
    summary: "Information on the processing purposes, collection methods, legal grounds of your personal data, and your rights under GDPR and Article 11 of Turkish Law No. 6698 (KVKK).",
    content: [
      "1. DATA CONTROLLER",
      "Data Controller: NECATI TASCI (CoupleSky) · Contact & support: support@couplesky.app. As CoupleSky (\"App\" or \"Data Controller\"), under the relevant data protection legislations (GDPR and Turkish Law No. 6698), we place the highest priority on the security and privacy of our users' personal data. This Clarification Text explains the purposes for which your data collected via our mobile app is processed and outlines your statutory rights.",

      "2. CATEGORIES OF PROCESSED PERSONAL DATA AND DATA TYPES",
      "Within the scope of our shared couple journal, time-capsule sealed letters, location-based date planner, and health/menstrual cycle tracking features, the following personal data is processed:\n" +
      "• Identity and Contact Information: Full name, username, email address, gender selection.\n" +
      "• Couple and Relationship Information: Pairing code, first meeting date, relationship anniversary dates.\n" +
      "• Visual and Audio Records: Photos uploaded to the shared gallery or private journals, memory pictures, and profile avatars.\n" +
      "• Location Information: Meeting point coordinates and optional GPS pins attached to memory photos.\n" +
      "• Special Category Personal Data (Health Information): Menstrual cycle start dates, predicted cycle intervals, daily medication/vitamin hours and adherence logs.\n" +
      "• Messaging and Memory Content: Time-capsule letters, private daily notes, and mood selections (stored encrypted on our servers).\n" +
      "• Transaction and Financial Information: Anonymous transaction identifiers, subscription status, package type, and token balance processed via RevenueCat and app stores (App Store / Google Play).\n" +
      "• Device and Operation Security: Device model, OS version, push notification tokens, unique device identifier (UUID), last login timestamp, and security logs.\n" +
      "• Advertising Data: Non-personalized advertising identifiers processed by Google AdMob for displayed in-app banners.",

      "3. PURPOSES OF PROCESSING PERSONAL DATA",
      "Your personal data is processed in accordance with applicable data protection principles for the following purposes:\n" +
      "• Account creation, secure authentication, and prevention of unauthorized access,\n" +
      "• Connecting two partners via a unique private pairing code to enable real-time synchronized memory and calendar sharing,\n" +
      "• Cryptographic encryption of time-locked letters and preserving their confidentiality until the chosen unlock date,\n" +
      "• Displaying shared date locations on map with convenient routing,\n" +
      "• Delivering timely push notifications for medicine schedules, cycle updates, anniversaries, and unlocked letters,\n" +
      "• Provisioning CoupleSky Premium entitlements so that a single subscription covers both partners,\n" +
      "• Maintaining network and information security against cyber attacks and brute-force attempts.",

      "4. PARTIES TO WHOM PERSONAL DATA IS TRANSFERRED",
      "Your personal data is never sold to third parties for advertising or commercial purposes. Data is shared strictly to perform our services with the following vetted providers, some of which are located internationally:\n" +
      "• Supabase Inc.: Secure PostgreSQL database, encrypted cloud storage, and authentication infrastructure,\n" +
      "• RevenueCat Inc.: In-app purchases, subscription entitlement verification, and receipt validation,\n" +
      "• Google Cloud / Firebase & Expo Notifications: Reliable delivery of push notifications to your device,\n" +
      "• Google LLC (AdMob & Google Maps): Map services and non-personalized advertising,\n" +
      "• Apple Inc. & Google LLC: Sign in with Apple and Sign in with Google authentication services,\n" +
      "• Competent Public Authorities: In response to lawful court orders or binding legal obligations.",

      "5. DATA COLLECTION METHODS AND LEGAL GROUNDS",
      "Your data is collected electronically via app UI inputs, camera/gallery permissions, device sensors, and notification permissions. Legal grounds include:\n" +
      "• Contractual Necessity: Performance of the User Agreement and core service delivery,\n" +
      "• Legitimate Interests: Enhancing app security, preventing fraud, and optimizing stability without overriding fundamental user rights,\n" +
      "• Explicit Consent: For health-related cycle/medicine logs, sensitive location pins, and marketing communications.",

      "6. DATA SECURITY AND ENCRYPTION (AES-256)",
      "CoupleSky writes your daily notes and letters to the database encrypted with AES-256. The encryption key is derived inside the app from a random, couple-specific value kept on the server. This is therefore not end-to-end encryption: as the party operating the service we are technically able to access this content, and we do not use it for any other purpose, including marketing. Access is limited by Row-Level Security (RLS) rules to authenticated members of the relevant couple. Your photos are kept in private storage and displayed only through time-limited, signed links. All traffic is encrypted with TLS.",

      "7. DATA RETENTION AND DELETION (RIGHT TO BE FORGOTTEN)",
      "You can request permanent account deletion anytime from Profile > Account Management & Danger Zone. Deletion requests enter a 7-day safety grace period during which you can cancel by logging back in. After 7 days, all profile records, private journals, letters, and storage files are permanently and irreversibly purged from our servers. Shared memories are wiped for both sides, uncoupling your partner. Backup copies are purged within 30 days.",

      "8. YOUR RIGHTS UNDER GDPR AND DATA PROTECTION LAWS",
      "You have the right at any time to:\n" +
      "a) Inquire whether your personal data is being processed,\n" +
      "b) Request information regarding the processing of your data,\n" +
      "c) Understand the purpose of processing and verify compliance,\n" +
      "d) Know third parties to whom data has been transferred domestically or abroad,\n" +
      "e) Request correction of inaccurate or incomplete data,\n" +
      "f) Request deletion or erasure of your personal data under statutory conditions,\n" +
      "g) Request notification of corrections and deletions to third-party recipients,\n" +
      "h) Object to decisions made solely by automated systems that cause an adverse legal effect,\n" +
      "i) Seek compensation if you suffer damages due to unlawful processing.\n\n" +
      "To exercise your rights, you can reach us through in-app support or directly via email at support@couplesky.app."
    ]
  },

  privacy: {
    id: "privacy",
    title: "Privacy Policy",
    badge: "Privacy Policy",
    lastUpdated: "October 2026",
    summary: "Detailed guidelines on our data collection, processing, and protection principles, and how your couple privacy is strictly preserved.",
    content: [
      "1. INTRODUCTION AND OUR COMMITMENT",
      "CoupleSky is designed for partners to cherish their most precious memories, letters, and daily moments within a protected private digital space. User privacy is our core foundation. Your personal data is never sold to third parties or traded with advertising brokers.",

      "2. COLLECTED INFORMATION AND USAGE SCOPE",
      "• Account Data: Name, username, email address, and securely hashed passwords provided during sign up.\n" +
      "• Relationship Content: Photos, captions, time-capsule letters, and calendar notes. This content is exclusively accessible to you and your paired partner.\n" +
      "• Cycle and Health Data: Menstrual start dates and medication hours. Used solely to provide cycle predictions and timely reminders for you and your partner.\n" +
      "• Location Coordinates: Obtained only when you explicitly select a meeting point on the map or geotag a photo; no persistent background tracking is ever conducted.\n" +
      "• Third-Party Infrastructure: Google AdMob, Google Maps, Apple/Google Sign-In, Supabase, RevenueCat, and Expo. For details, refer to Section 4 of our Clarification Text.",

      "3. SECURITY AND CRYPTOGRAPHIC ENCRYPTION",
      "All network traffic is encrypted via TLS/SSL protocols. Private letters and journal entries are encrypted before persistent storage. Session tokens reside in secure device storage; securing your device with biometric or passcode locks is strongly advised.",

      "4. COOKIES AND UNIQUE DEVICE IDENTIFIER",
      "To prevent brute-force attacks and unauthorized multi-device logins, a randomly generated UUID device identifier is utilized. When logging in from an unrecognized device, one-time verification is prompted to safeguard your account.",

      "5. ACCOUNT ERASURE AND DATA PURGE (GDPR & CCPA COMPLIANT)",
      "You may request account deletion at any time under Profile > Account Management & Danger Zone. Requests are subject to a 7-day cancellation window. Following the 7-day period, all account data, photos, and linked memories are irreversibly removed from active servers.",

      "6. AGE RESTRICTION",
      "CoupleSky is not intended for individuals under 16 years of age. If we learn that personal data of a minor under 16 has been collected without parental consent, we will promptly delete that information.",

      "7. POLICY UPDATES",
      "We may update our Privacy Policy periodically to reflect technological or legal requirements. Material updates will be highlighted via in-app notifications."
    ]
  },

  terms: {
    id: "terms",
    title: "Terms of Use (EULA)",
    badge: "User Agreement",
    lastUpdated: "October 2026",
    summary: "General rules, account safety, couple pairing mechanisms, intellectual property, and limitations of liability.",
    content: [
      "1. ACCEPTANCE OF TERMS",
      "By downloading, installing, registering, or using CoupleSky, you agree to be bound by these Terms of Use (\"Agreement\"). If you do not accept all terms contained herein, do not use the application.",

      "2. SERVICE SCOPE AND COUPLE PAIRING",
      "CoupleSky provides a private platform enabling two partners to connect via a unique pairing code to share memories, calendars, photographs, health tracking, and time-capsule letters. You must only share your pairing code with your trusted partner.",

      "3. ACCOUNT CREDENTIALS AND SECURITY",
      "You are solely responsible for maintaining the confidentiality of your login credentials. You accept responsibility for all activities that occur under your account. If you suspect unauthorized access, reset your password immediately or contact our support team.",

      "4. PROHIBITED USES AND CONDUCT",
      "When using the application, you agree not to:\n" +
      "• Upload unlawful, threatening, abusive, defamatory, or invasive content,\n" +
      "• Upload or share private photographs of your partner without their explicit consent,\n" +
      "• Attempt to reverse-engineer, decompile, or tamper with the application's source code or backend servers,\n" +
      "• Deploy automated scrapers, crawlers, or bots to harvest data.",

      "5. INTELLECTUAL PROPERTY RIGHTS",
      "The application UI, designs, logos, artwork, and software code are owned exclusively by the Data Controller. You retain ownership of all photographs and text memories you upload, while granting the necessary technical license required to render the service.",

      "6. SERVICE AVAILABILITY AND DISCLAIMER OF WARRANTIES",
      "CoupleSky is provided on an \"AS IS\" and \"AS AVAILABLE\" basis. We cannot guarantee uninterrupted uptime due to maintenance, force majeure events, or network provider disruptions, and disclaim liability for indirect or consequential damages to the extent permitted by law.",

      "7. TERMINATION AND SUSPENSION",
      "We reserve the right to suspend or terminate accounts that violate these Terms or present safety risks to other users without prior liability."
    ]
  },

  consent: {
    id: "consent",
    title: "Explicit Consent Statement",
    badge: "Special Category Data",
    lastUpdated: "October 2026",
    summary: "Declaration of explicit consent regarding health (menstrual cycle / medication) data, sensitive location data, and push notification flows.",
    content: [
      "1. NATURE AND SCOPE OF EXPLICIT CONSENT",
      "Under applicable data protection laws, I freely and knowingly provide my explicit consent for the processing and couple-synchronized sharing of my personal and special-category personal data as detailed below, in full accordance with the principles set forth in the Clarification Text.",

      "2. DATA CATEGORIES SUBJECT TO EXPLICIT CONSENT AND PURPOSES",
      "• Special Category Data (Health Information): Dates, cycle lengths, symptom notes, and medication schedules entered into the cycle and medicine tracker modules, processed to forecast menstrual cycles, generate reminders, and display synchronizations on my paired partner's screen,\n" +
      "• Geolocation Data: Coordinates selected for meeting points and GPS locations tagged onto photos, processed to display shared map markers and facilitate route planning,\n" +
      "• Shared Couple Content: Memory photos, love letters, and mood statuses stored in encrypted form strictly for sharing with my paired partner,\n" +
      "• Push Notifications: Receiving instant notifications for approaching anniversaries, delivered letters, and medication schedules.",

      "3. WITHDRAWAL OF CONSENT",
      "I understand and agree that I may withdraw this consent at any time by disabling health or location permissions within the app settings, or by requesting account deletion."
    ]
  },

  subscription: {
    id: "subscription",
    title: "Subscription & Refund Terms",
    badge: "App Store & Google Play",
    lastUpdated: "October 2026",
    summary: "CoupleSky Premium subscription features, free trial duration (if defined), auto-renewal rules, cancellation steps, and statutory refund policies.",
    content: [
      "1. COUPLES PREMIUM SUBSCRIPTION & SHARED COVERAGE",
      "CoupleSky Premium operates on a shared subscription model: when one partner subscribes, both partners unlock all Premium features instantly. Premium benefits include:\n" +
      "• Unlimited high-resolution photo uploads and shared cloud archive,\n" +
      "• Advanced cycle tracking and synchronized health notifications,\n" +
      "• Unlimited time-capsule letters with future scheduled unlocks,\n" +
      "• 100% ad-free experience across the entire application,\n" +
      "• Memory timeline with interactive anniversary countdowns.",

      "2. FREE TRIAL PERIOD",
      "First-time subscribers may be eligible for a promotional free trial as displayed in the store paywall. No charges are billed during the trial. If the subscription is not canceled at least 24 hours prior to the end of the trial period, it will automatically convert into a paid recurring subscription.",

      "3. AUTOMATIC RENEWAL AND BILLING (STANDARD STORE EULA)",
      "• Payment is charged to your Apple ID / Google Play Account upon confirmation of purchase.\n" +
      "• Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current billing cycle (monthly or annual plan).\n" +
      "• Your account will be charged for renewal within 24 hours prior to the end of the current period at the then-applicable renewal rate.",

      "4. SUBSCRIPTION CANCELLATION PROCEDURE",
      "You can cancel your subscription at any time without cancellation fees. Cancellations must be performed through your store account settings rather than within the mobile app:\n" +
      "• iOS (Apple App Store): Go to iPhone Settings > [Your Name] > Subscriptions > CoupleSky > Cancel Subscription.\n" +
      "• Android (Google Play Store): Open Google Play Store > Profile Icon > Payments & Subscriptions > Subscriptions > CoupleSky > Cancel Subscription.\n" +
      "Upon cancellation, you will retain access to all Premium features until the conclusion of your active billing period.",

      "5. RIGHT OF WITHDRAWAL AND REFUND POLICY",
      "Under applicable digital consumer regulations, statutory withdrawal rights do not apply once digital content or services have commenced with the consumer's consent. Refund requests for accidental or duplicate charges are administered directly by Apple Support (reportaproblem.apple.com) or Google Play Customer Support in accordance with store refund policies."
    ]
  }
};

/**
 * Belirtilen dil için yasal metinleri döndürür ('en' veya 'tr').
 */
export function getLegalDocs(language?: string): Record<LegalDocType, LegalDocument> {
  const isEn = language === "en" || (!language && i18n?.language === "en");
  return isEn ? LEGAL_DOCS_EN : LEGAL_DOCS_TR;
}

/**
 * Tek bir yasal metni belirtilen dilde döndürür.
 */
export function getLegalDoc(id: LegalDocType, language?: string): LegalDocument {
  const docs = getLegalDocs(language);
  return docs[id] || docs.kvkk;
}

/**
 * Mevcut dille senkronize dinamik LEGAL_DOCS nesnesi.
 * Mevcut kod tabanıyla %100 geriye dönük uyumludur: LEGAL_DOCS.kvkk veya LEGAL_DOCS[tab] dili izler.
 */
export const LEGAL_DOCS: Record<LegalDocType, LegalDocument> = new Proxy(LEGAL_DOCS_TR, {
  get(target, prop, receiver) {
    const active = getLegalDocs();
    const val = Reflect.get(active, prop, receiver);
    if (typeof val === "function") {
      return (val as (...args: unknown[]) => unknown).bind(active);
    }
    return val;
  },
  ownKeys() {
    return Reflect.ownKeys(getLegalDocs());
  },
  getOwnPropertyDescriptor(target, prop) {
    return Reflect.getOwnPropertyDescriptor(getLegalDocs(), prop);
  },
  has(target, prop) {
    return Reflect.has(getLegalDocs(), prop);
  },
});
