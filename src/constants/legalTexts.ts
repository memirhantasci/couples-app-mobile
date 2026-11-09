import i18n from "@/lib/i18n";

/**
 * CoupleSky Yasal & Mevzuat Metinleri
 * 6698 Sayılı KVKK, GDPR, Apple App Store Review Guidelines (3.1.2, 5.1.1) ve Google Play Politikalarına Uygun Metinler
 */

/**
 * Veri sorumlusunun tebligat adresi. Boş bırakılırsa metinlere yazılmaz.
 * (KVKK Aydınlatma Yükümlülüğü Tebliği: veri sorumlusunun kimliği ve adresi). Doldurunca
 * "node scripts/build-legal-pages.js" ile web sayfaları yeniden üretilir.
 */
const CONTROLLER_ADDRESS_TR_TEXT = "Küçükbakkalköy Mah. Sümer Sok. No:8, Ataşehir / İstanbul";
const CONTROLLER_ADDRESS_EN_TEXT = "Küçükbakkalköy Mah., Sümer Sok. No:8, Ataşehir, Istanbul, Türkiye";
const CONTROLLER_ADDRESS_TR = CONTROLLER_ADDRESS_TR_TEXT ? " · Adres: " + CONTROLLER_ADDRESS_TR_TEXT : "";
const CONTROLLER_ADDRESS_EN = CONTROLLER_ADDRESS_EN_TEXT ? " · Address: " + CONTROLLER_ADDRESS_EN_TEXT : "";

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
    lastUpdated: "Kasım 2026",
    summary: "Kişisel verilerinizin işlenme amaçları, toplanma yöntemleri, hukuki sebepleri ve 6698 Sayılı KVKK 11. madde kapsamındaki haklarınız hakkında bilgilendirme.",
    content: [
      "1. VERİ SORUMLUSU",
      "Veri sorumlusu: Necati Taşcı (CoupleSky)" + CONTROLLER_ADDRESS_TR + " · İletişim ve destek: destek@couplesky.app. CoupleSky (\"Uygulama\" veya \"Veri Sorumlusu\") olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") ve ilgili mevzuat uyarınca, kullanıcılarımızın kişisel verilerinin güvenliğine ve gizliliğine azami hassasiyet göstermekteyiz. İşbu Aydınlatma Metni, mobil uygulamamız üzerinden toplanan kişisel verilerinizin hangi amaçlarla işlendiğini ve haklarınızı açıklamaktadır.",

      "2. İŞLENEN KİŞİSEL VERİ KATEGORİLERİ VE VERİ TÜRLERİ",
      "Uygulamamızın sunduğu çift anı defteri, zaman kilitli mektuplar, konum tabanlı buluşma planları ve sağlık/döngü takip fonksiyonları kapsamında aşağıdaki kişisel verileriniz işlenmektedir:\n" +
      "• Kimlik ve İletişim Bilgileri: Ad-soyad, kullanıcı adı, e-posta adresi, cinsiyet bilgisi.\n" +
      "• Çift ve İlişki Bilgileri: Eşleşme kodu (pairing code), tanışma tarihi, sevgili olma tarihi, yıldönümü tarihleri. Çift ilişkisi sona erdiğinde (partnerin hesabını silmesi gibi) tanışma ve sevgili olma tarihleri sıfırlanır; yeni bir eşleşmede yeniden girilir.\n" +
      "• Görsel ve İşitsel Kayıtlar: Ortak galeriye veya günlüklere yüklediğiniz fotoğraflar, anı görselleri ve profil avatarları.\n" +
      "• Lokasyon (Konum) Bilgileri: Buluşma noktası seçimi ve anılarınıza isteğe bağlı eklenen GPS koordinatları ve harita pinleri. Gökyüzü posteri özelliğinde seçtiğiniz yer, tarih ve saat yalnızca cihazınızda posteri hesaplamak için kullanılır; koordinatlar saklanmaz ve sunucularımıza gönderilmez. Yer adı (ilçe/şehir düzeyinde), saat ve başlık cihazınızda tutulur, çıkış yaptığınızda silinir ve cihaz yedeğine dahil olabilir.\n" +
      "• Özel Nitelikli Kişisel Veriler (Sağlık Bilgileri): Kadın kullanıcılar ve çiftleri için döngü/regl başlangıç ve tahmin tarihleri, günlük ilaç/vitamin saatleri ve takip kayıtları.\n" +
      "• Mesajlaşma ve Anı Verileri: Zaman kilitli mektuplar, günlük notları ve ruh hali (mood) seçimleri. (Bu veriler sunucuda şifreli olarak saklanmaktadır).\n" +
      "• Müşteri İşlem ve Finansal Bilgiler: RevenueCat ve uygulama mağazası (App Store / Google Play) üzerinden sağlanan anonim işlem tokenları, abonelik durumu, paket türü ve token bakiyesi.\n" +
      "• Cihaz ve İşlem Güvenliği: Cihaz modeli, işletim sistemi versiyonu, push bildirim tokenları, benzersiz cihaz kimliği (UUID), son oturum açma ve son uygulama kullanım zamanı, güvenlik logları ve giriş / şifre sıfırlama denemelerini sınırlamak için IP adresi (en fazla 1 gün tutulur).\n" +
      "• Hata Kayıtları: Uygulama hata verdiğinde hata mesajı, teknik yığın izi, uygulama sürümü, platform (iOS/Android) ve hesap kimliğiniz. Mektup, günlük gibi içerik bu kayıtlara yazılmaz; kayıtlar en fazla 30 gün saklanır.\n" +
      "• Reklam Verileri: Uygulamada gösterilen reklamlar için Google AdMob tarafından işlenen reklam kimliği ve reklam etkileşim verileri (yalnızca kişiselleştirilmemiş reklam talebi ile sınırlı). Uygulama sizi diğer uygulama ve web siteleri arasında takip etmez; bu amaçla izleme izni (ATT) istenmez.",

      "3. KİŞİSEL VERİLERİN İŞLENME AMAÇLARI",
      "Kişisel verileriniz aşağıdaki amaçlarla (\"Amaçlar\") KVKK'nın 5. ve 6. maddelerine uygun olarak işlenmektedir:\n" +
      "• Kullanıcı hesabı oluşturulması, kimlik doğrulama ve yetkisiz erişimlerin engellenmesi,\n" +
      "• İki partnerin özel eşleşme kodu ile birbirine bağlanması ve eşleşme anından sonra kaydedilen anı/takvim içeriğinin senkronize paylaşılması,\n" +
      "• Zaman kilitli mektupların şifrelenmesi ve belirlenen tarihe kadar kilitli tutulması,\n" +
      "• Ortak buluşma noktalarının haritada görüntülenmesi ve rota kolaylığı sunulması,\n" +
      "• İlaç saati, regl döngüsü, yıldönümü ve mektup teslim bildirimlerinin gönderilmesi,\n" +
      "• Premium abonelik haklarının tanımlanması ve tek abonelikle her iki partnerin de premium özelliklerden faydalandırılması,\n" +
      "• Bilgi güvenliği süreçlerinin yürütülmesi ve siber saldırılara/brute-force denemelerine karşı koruma sağlanması,\n" +
      "• Kullanılmayan, eşleşmemiş hesapların belirli süre sonunda silinmesi (saklama sınırlaması ilkesi) ve silmeden önce bildirim gönderilmesi.",

      "4. KİŞİSEL VERİLERİN AKTARILDIĞI TARAFLAR",
      "Kişisel verileriniz, kanunun emrettiği istisnalar haricinde hiçbir üçüncü tarafa reklam veya ticari amaçla satılmaz. Veriler yalnızca hizmetin ifası için aşağıdaki sağlayıcılarla paylaşılır. Bu sağlayıcıların bir kısmı yurt dışında yerleşiktir; veriler bu nedenle KVKK md. 9 kapsamında yurt dışına aktarılabilir:\n" +
      "• Supabase Inc.: Güvenli PostgreSQL veritabanı, şifreli depolama ve kimlik doğrulama altyapısı (veriler Frankfurt / Almanya bölgesinde barındırılır),\n" +
      "• RevenueCat Inc.: Uygulama içi satın alma, abonelik doğrulama ve iade altyapısı,\n" +
      "• Google Cloud / Firebase, Apple (APNs) & Expo Notifications: Push bildirimlerinin cihazınıza ulaştırılması (bildirim metinleri partnerinizin paylaştığı ilaç adı, döngü durumu gibi sağlık ayrıntılarını içerebilir ve bu metinler söz konusu servislerden geçer),\n" +
      "• Google LLC (AdMob ve Google Haritalar): reklam gösterimi ve harita hizmetleri,\n" +
      "• Apple Inc. ve Google LLC: Apple ile giriş ve Google ile giriş hizmetleri; cihaz üzerindeki adres arama ve adres çözümleme (konum seçerken yazdığınız adres metni ve haritada seçtiğiniz noktanın koordinatı),\n" +
      "• Expo (Expo Updates / EAS): Uygulama güncellemelerinin dağıtımı; güncelleme kontrolünde IP adresiniz, platform ve uygulama sürümü bilgileri,\n" +
      "• OpenStreetMap Vakfı (Nominatim): Cihazın kendi adres arama servisi sonuç vermezse yedek olarak kullanılır; yalnızca adres arama kutusuna yazdığınız metin ve IP adresiniz,\n" +
      "• Unsplash: Keşif (demo) modunda gösterilen örnek görseller; görseller yüklenirken IP adresiniz,\n" +
      "• Yetkili Kamu Kurum ve Kuruluşları: Yargı kararları veya yasal zorunluluklar halinde yetkili adli/idari makamlar.\n\n" +
      "Yurt dışına aktarım dayanağı: Yurt dışında yerleşik sağlayıcılara aktarım, KVKK md. 9 uyarınca Kişisel Verileri Koruma Kurulu'nun yeterlilik kararına, yeterlilik kararı yoksa md. 9'da sayılan uygun güvencelere (standart sözleşme, bağlayıcı şirket kuralları vb.) ya da kanunda öngörülen diğer hâllere dayanılarak yapılır. Hangi sağlayıcı için hangi dayanağın kullanıldığı bilgisini destek@couplesky.app adresinden talep edebilirsiniz.",

      "5. VERİ TOPLAMANIN YÖNTEMİ VE HUKUKİ SEBEPLERİ",
      "Verileriniz mobil uygulama arayüzü, kamera/galeri erişimi, cihaz sensörleri ve bildirim izinleri vasıtasıyla elektronik ortamda toplanır. Hukuki sebepler:\n" +
      "• KVKK md. 5/2-c: Bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması (Kullanıcı Sözleşmesi),\n" +
      "• KVKK md. 5/2-f: Temel hak ve özgürlüklerinize zarar vermemek kaydıyla veri sorumlusunun meşru menfaatleri,\n" +
      "• KVKK md. 6/2: Sağlık verileri (regl/ilaç takibi) için ilgili özelliğin ilk kullanımında, kayıttaki koşul onayından ayrı olarak onay kutusuyla verdiğiniz Açık Rıza. Konum bilgisi, cihazınızın konum iznini vermenize ve ilgili özelliği kullanmayı seçmenize bağlıdır.",

      "6. VERİLERİN GÜVENLİĞİ VE ŞİFRELEME (AES-256)",
      "CoupleSky, günlük notlarınızı ve mektuplarınızı veritabanına AES-256 ile şifrelenmiş olarak yazar. Şifreleme anahtarı, çiftinize özel ve sunucuda tutulan rastgele bir değerden uygulama içinde türetilir. Bu nedenle sistem uçtan uca şifreleme değildir: hizmeti işleten taraf olarak teknik olarak bu içeriklere erişebilecek konumdayız; içeriklerinizi pazarlama dahil hiçbir başka amaçla kullanmayız. Verilere erişim, Satır Düzeyi Güvenlik (RLS) kurallarıyla yalnızca oturum açmış ve ilgili çifte ait kullanıcılarla sınırlandırılmıştır. Ortak fotoğraflarınız özel depolama alanında tutulur ve yalnızca süreli, imzalı bağlantılarla gösterilir; profil fotoğrafınız (avatar) ise tahmin edilemez bir adreste herkese açık bir depolama alanında tutulur ve bu adresi bilen herkes tarafından görüntülenebilir. Tüm iletişim TLS ile şifrelidir.",

      "7. VERİ SAKLAMA VE SİLME (UNUTULMA HAKKI)",
      "Profil > Hesap Yönetimi & Tehlike Bölgesi bölümünden hesabınızı silme talebinde bulunabilirsiniz. Talep 7 gün beklemeye alınır; bu süre içinde aynı hesapla giriş yaparak talebi iptal edebilirsiniz (giriş yaptığınızda talep otomatik iptal edilir ve size bilgi verilir). Silme gününe 3 gün ve 1 gün kala, vazgeçebilmeniz için uygulama bildirimiyle hatırlatma gönderilir. 7 gün sonunda sizin oluşturduğunuz, yüklediğiniz veya yazdığınız her şey (profil bilgileri, fotoğraflar, günlükler, mektuplar, notlar, özel günler, harita pinleri, ilaç ve döngü kayıtları ve yıldızınızdaki içerikler) sunuculardan geri döndürülemez biçimde silinir. Partnerinizin hesabı silinmez; partnerinizin kendi oluşturduğu içerikler yalnızca kendisi için saklanmaya devam eder. Ortak yıldız ve içindeki anı gezegenleri, kimin oluşturduğuna bakılmaksızın silinir; otomatik oluşturulan yıl dönümü kayıtları da silinir. Partnerinizin eşleşme kodu yenilenir ve partneriniz yeniden eşleşebilir. Partnerinize silme talebi, silinmeye 3 gün ve 1 gün kala hatırlatma, vazgeçilmesi ve silinme durumunda uygulama içi açıklama ve bildirimle bilgi verilir. Her iki taraf da silme talebinde bulunduysa her hesap kendi 7. gününde silinir; son silinen hesapla birlikte çifte ait kalan tüm kayıtlar ve dosyalar da kalıcı olarak silinir. Yedek kopyalar en geç 30 gün içinde otomatik olarak imha edilir.\n\n" +
      "Kullanıcıların KVKK'nın 11. maddesi ve GDPR'ın 17. maddesi uyarınca kendi kişisel verilerini, yükledikleri fotoğrafları ve mektupları silme hakkı hiçbir surette ücretli abonelik şartına bağlanamaz. Kullanıcılar abonelikleri sona erse dahi ücretsiz planda kendi içeriklerini diledikleri zaman kalıcı olarak silebilirler (mektuplarda, karşı tarafa ulaşmış bir mektubun silinmesi için partner onaylı silme kuralları geçerlidir).\n\n" +
      "Saklama süreleri:\n" +
      "• Hesap, profil ve içerikler: Hesabınız silinene kadar (silme talebinden 7 gün sonra silinir). Partnerinizin oluşturduğu içerikler, siz silseniz de partnerinizin hesabı sürdükçe partnerinize aittir,\n" +
      "• Kullanılmayan hesaplar: Hiç eşleşmemiş yeni kayıtlar son uygulama kullanımından 30 gün, bir çiftten ayrılıp tek kalan hesaplar son kullanımdan 60 gün sonra silinir. Aktif aboneliği olan hesaplar silinmez; abonelik sona erdikten 60 gün sonra silinir. Eşleşmiş kullanıcıların hesapları bu nedenle silinmez. Silmeden yaklaşık 7 gün ve 1 gün önce uygulama bildirimi gönderilir (bildirimleri kapattıysanız ulaşmayabilir),\n" +
      "• Partnere gösterilen eski veriler: Yeni bir eşleşmede yeni partneriniz yalnızca eşleşme anından sonra kaydedilen verileri görür; önceki ilişkinize ait verileriniz yeni partnerinize gösterilmez ve yalnızca sizin erişiminizde kalır (siz dilediğinizde silebilirsiniz),\n" +
      "• Yıldız tescili ve koordinatı: Premium bittikten sonra 14 günlük Kış Uykusu (Grace Period) süresince çifte ait kalır; 14 gün sonunda yenilenmezse yıldız koordinatı boşa çıkar ve diğer çiftlerin tesciline açılır. Partnerinizin hesabını silmesi hâlinde yıldız ve içindeki anı gezegenleri kış uykusu/kasa süreci beklenmeden silinir ve yıldızın koordinatı boşa çıkar,\n" +
      "• Yıldız anı kasası ve gezegen verileri: Yıldız koordinatı serbest kaldıktan sonra 90 gün boyunca sistem kasasında (Vault) saklanır; bu sürede yeniden abone olunup bir yıldız sahiplenilirse anı gezegenleri o yıldıza aktarılır,\n" +
      "• Medya depolama tasfiyesi: Kasa süresi (koordinatın serbest kalmasından 90 gün sonra) yenilenmeden dolarsa tam boy fotoğraf dosyaları, anı ve gezegen görselleri ile profil fotoğrafları kalıcı olarak silinir. Fotoğraf arşivinin küçük önizlemeleri ile metin kayıtları (anı, gezegen, mektup, not) korunur; küçük önizlemesi olmayan fotoğraf kaydı silinir. Tasfiye tarihi uygulamada Profil > Premium ekranında gösterilir; tasfiyeden yaklaşık 7 gün ve 1 gün önce uygulama bildirimi gönderilir (bildirimler kapalıysa ulaşmayabilir),\n" +
      "• Hata kayıtları: en fazla 30 gün,\n" +
      "• Giriş ve şifre sıfırlama deneme kayıtları (IP adresi dahil): en fazla 1 gün,\n" +
      "• Bildirimin tekrar gönderilmesini önleyen kayıtlar: 14 gün,\n" +
      "• Partnerinize gösterilen uygulama içi hesap bildirimleri: görüldükten 30 gün sonra,\n" +
      "• Push bildirim tokenı: oturumunuz ve hesabınız süresince (hesap silme talebinden sonra yalnızca silme hatırlatması için silme gününe kadar),\n" +
      "• Üçüncü taraf sağlayıcılardaki kayıtlar (ör. RevenueCat, Expo, Google): sağlayıcının kendi saklama politikalarına tabidir.",

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
    lastUpdated: "Kasım 2026",
    summary: "Uygulamamızın veri toplama, işleme, koruma prensipleri ve gizliliğinizi nasıl koruduğumuzun detayları.",
    content: [
      "1. GİRİŞ VE TAAHHÜDÜMÜZ",
      "CoupleSky, çiftler arasındaki en özel anları, mektupları ve günlükleri güvenli bir dijital alanda paylaşmaları için tasarlanmıştır. Bu sebeple kullanıcı gizliliği en temel önceliğimizdir. Bilgileriniz asla üçüncü şahıslara satılmaz, pazarlama veritabanlarına devredilmez.",

      "2. TOPLANAN BİLGİLER VE KULLANIM ALANLARI",
      "• Hesap Bilgileri: Kayıt sırasında belirttiğiniz ad, kullanıcı adı, e-posta adresi ve şifreniz (güvenli hash olarak).\n" +
      "• İlişki ve Anı İçeriği: Eklediğiniz fotoğraflar, anı açıklamaları, mektuplar ve takvim notları. Bu içerikler yalnızca siz ve eşleştiğiniz partneriniz tarafından görüntülenebilir. Yeni bir eşleşmede partneriniz yalnızca eşleşme anından sonra kaydedilen içerikleri görür; önceki ilişkiye ait içerikleriniz yeni partnerinize gösterilmez.\n" +
      "• Yıldız (Gökyüzü): Yıldızınıza verdiğiniz ad ve çiftinizin baş harfleri diğer kullanıcılara ve uygulamayı hesap açmadan deneyen ziyaretçilere görünür. İlk adınız yalnızca yıldız bağı kurduğunuz çiftlere ve siz Sertifika > İsimlerimiz ve Fotoğraflarımız bölümünden açıkça izin verirseniz herkese gösterilir. Profil fotoğrafınız (Premium) yalnızca aynı bölümden ayrıca izin verirseniz yıldız kartınızda herkese gösterilir; Premium sona erdiğinde ya da fotoğrafı kaldırdığınızda gösterilmez. İzinler kişi başınadır (partneriniz sizin adınıza açamaz) ve istediğiniz an kapatılabilir. Soyadınız, kullanıcı adınız ve e-posta adresiniz gösterilmez. Uygunsuz yıldız adları, isimler ve fotoğraflar uygulama içinden bildirilebilir.\n" +
      "• Döngü ve Sağlık Verileri: Regl başlangıç tarihleri ve ilaç saatleri. Bu veriler yalnızca döngü tahmini ve size zamanında hatırlatıcı bildirim göndermek için işlenir.\n" +
      "• Konum Bilgileri: Yalnızca siz harita üzerinde bir buluşma noktası seçtiğinizde veya fotoğraflarınıza isteğe bağlı konum eklediğinizde alınır; arka planda sürekli konum takibi yapılmaz. Gökyüzü posterinde seçtiğiniz yer ve saat posteri hesaplamak için yalnızca cihazınızda işlenir; koordinatlar saklanmaz ve sunucularımıza gönderilmez, yer adı (ilçe/şehir düzeyinde), saat ve başlık cihazınızda tutulur ve çıkışta silinir. Haritada seçtiğiniz noktanın adresini bulmak için koordinat, cihazınızın adres servisine (Apple/Google) iletilir.\n" +
      "• Kullanım Zamanı: Hesabınızın son kullanıldığı zaman. Yalnızca kullanılmayan, eşleşmemiş hesapları silebilmek için tutulur (Bölüm 5).\n" +
      "• Hata ve Güvenlik Kayıtları: Uygulama hata verdiğinde hata mesajı, teknik yığın izi, uygulama sürümü ve platform bilgisi (en fazla 30 gün); giriş denemelerini sınırlamak için IP adresi (en fazla 1 gün). İçerikleriniz bu kayıtlara yazılmaz.\n" +
      "• Üçüncü taraf hizmetler: Google AdMob (reklam), Google Haritalar (harita), Apple/Google ile giriş, Supabase (veritabanı), RevenueCat (abonelik), Expo (bildirim ve uygulama güncellemeleri), OpenStreetMap Nominatim (yedek adres arama) ve Unsplash (keşif modundaki örnek görseller). Ayrıntılar ve yurt dışı aktarım bilgisi için KVKK Aydınlatma Metni, 4. bölüm.",

      "3. GÜVENLİK VE VERİ ŞİFRELEMESİ",
      "Tüm veri iletişimi SSL/TLS protokolleri ile şifreli olarak gerçekleşir. Özel günlükler ve mektuplar şifrelenmiş olarak depolanır. Ortak fotoğraflarınız özel depolamada tutulur; profil fotoğrafınız (avatar) ise tahmin edilemez bir adreste herkese açık depolamada tutulur ve adresi bilen herkes görüntüleyebilir. Oturum bilgileri cihazınızda uygulamanın yerel depolama alanında tutulur; cihazınızı kilit ekranıyla korumanız önerilir.",

      "4. ÇEREZLER VE CİHAZ KİMLİĞİ",
      "Uygulama içinde yetkisiz cihaz girişlerini tespit etmek ve brute-force saldırılarını önlemek amacıyla rastgele üretilmiş bir 'Cihaz Kimliği' (UUID) kullanılır. Bu kimlik kişisel profilinizle ilişkilendirilerek başka bir cihazdan giriş yapıldığında e-posta onayı (OTP) istememizi sağlar. Arkadaş daveti programında aynı cihazda açılmış hesaplarla ödül kazanılmasını önlemek için davet eden ve davet edilen çiftlerin cihaz kimlikleri sunucuda karşılaştırılır; bu karşılaştırma başka bir amaçla kullanılmaz.",

      "5. HESAP SİLME VE VERİLERİN İMHASI (GDPR & KVKK UYUMLU)",
      "Hesabınızı istediğiniz zaman Profil > Hesap Yönetimi & Tehlike Bölgesi bölümünden silebilirsiniz. Talep 7 gün beklemeye alınır; bu süre içinde yalnızca hesabın sahibi aynı hesapla giriş yaparak talebi iptal edebilir (giriş yapıldığında talep otomatik iptal edilir). Silme gününe 3 gün ve 1 gün kala hatırlatma bildirimi gönderilir. 7 gün sonunda sizin oluşturduğunuz, yüklediğiniz veya yazdığınız her şey (kayıtlar, dosyalar, mektuplar, özel günler, harita pinleri ve yıldızınızdaki içerikler) sunuculardan kalıcı olarak silinir ve geri getirilemez. Partnerinizin hesabı silinmez ve partnerinizin kendi oluşturduğu içerikler yalnızca kendisi için saklanmaya devam eder. Ortak yıldız ve içindeki anı gezegenleri kimin oluşturduğuna bakılmaksızın silinir. Partnerinize silme talebi, silinmeye 3 gün ve 1 gün kala hatırlatma, vazgeçilmesi ve silinme durumunda uygulama içi açıklama ve bildirimle bilgi verilir. Her iki taraf da silme talebinde bulunduysa her hesap kendi 7. gününde silinir ve son hesap silindiğinde çifte ait kalan her şey de silinir.\n\n" +
      "Kullanılmayan hesaplar: Hiç eşleşmemiş yeni hesaplar son kullanımdan 30 gün, bir çiftten ayrılıp tek kalan hesaplar 60 gün sonra silinir; silmeden yaklaşık 7 gün ve 1 gün önce bildirim gönderilir. Aktif aboneliği olan hesaplar silinmez (abonelik bittikten 60 gün sonra silinir). Eşleşmiş hesaplar bu nedenle silinmez.\n\n" +
      "Hesabınızı silmek mağazadaki (Apple/Google) aboneliğinizi iptal etmez; aboneliği mağaza hesabınızdan ayrıca iptal etmelisiniz.\n\n" +
      "Abonelik sona erdiğinde de kendi içeriğinizi silme hakkınız Premium'a bağlı değildir: kendi yüklediğiniz fotoğrafları, özel günleri ve anı gezegenlerini Premium olmadan da silebilir, mektuplar için silme isteği gönderebilirsiniz (mektuplarda partner onaylı silme kuralları geçerlidir). Premium sona erdiğinde yıldız 14 günlük Kış Uykusuna geçer; 14 gün sonunda yenilenmezse yıldız koordinatı serbest bırakılır ve anı gezegenleri ile hatıralar 90 gün boyunca kasada (Vault) saklanır. Kasa süresi de yenilenmeden dolarsa tam boy fotoğraf dosyaları ve profil fotoğrafları depolama sunucularından silinir; fotoğrafların küçük önizlemeleri ve metin kayıtları korunur. Tasfiye tarihi uygulamada Profil > Premium ekranında gösterilir. Partneriniz hesabını silerse yıldız ve gezegenler bu sürece girmeden silinir.",

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
    lastUpdated: "Kasım 2026",
    summary: "Uygulamayı kullanırken uyulması gereken genel kurallar, hesap güvenliği, çift eşleşmesi ve sorumluluk sınırları.",
    content: [
      "1. SÖZLEŞMENİN KABULÜ",
      "CoupleSky mobil uygulamasını indirerek, hesap oluşturarak veya kullanarak işbu Kullanım Koşulları'nı (\"Sözleşme\") kabul etmiş sayılırsınız. Bu koşulları kabul etmiyorsanız lütfen uygulamayı kullanmayınız.",

      "2. HİZMETİN KAPSAMI VE ÇİFT EŞLEŞMESİ",
      "CoupleSky, iki kullanıcının özel bir kod (\"Eşleşme Kodu\") aracılığıyla birbirine bağlanarak ortak anı, takvim, fotoğraf, döngü takibi ve zaman kilitli mektuplar paylaşmasını sağlayan bir platformdur. Eşleşme kodunuzu yalnızca güvendiğiniz partnerinizle paylaşmalısınız.\n\n" +
      "Yeni bir eşleşmede partner yalnızca eşleşme anından sonra kaydedilen içerikleri görür. Çift ilişkisi sona erdiğinde (örneğin partnerinizin hesabını silmesiyle) ortak yıldız ve içindeki gezegenler silinir; kendi oluşturduğunuz içerikler hesabınızda kalır. Tek kalan bir kullanıcı, eşleşme gerektiren özellikleri (fotoğraf, mektup, anı, buluşma ve yıldız) kullanmak için yeniden eşleşmelidir; Premium'a sahip tek kalan kullanıcı ruh hali, günlük, takvim notu, harita notu ve ilaç/döngü takibini kullanabilir.",

      "3. HESAP GÜVENLİĞİ VE ŞİFRELER",
      "Kullanıcı, hesap şifresinin gizliliğini korumaktan bizzat sorumludur. Hesabınız altında gerçekleşen tüm faaliyetler sizin sorumluluğunuzdadır. Yetkisiz bir giriş fark ettiğinizde derhal şifrenizi sıfırlamalı veya bizimle iletişime geçmelisiniz. Hesabınızı silmeniz mağaza aboneliğinizi iptal etmez; aboneliği mağazadan iptal etmekten siz sorumlusunuz.",

      "4. KABUL EDİLEMEZ KULLANIM VE YASAKLI İÇERİKLER",
      "Uygulamayı kullanırken aşağıdaki eylemlerde bulunmak kesinlikle yasaktır:\n" +
      "• Yasadışı, tehditkar, taciz edici, hakaret içeren veya üçüncü şahısların mahremiyetini ihlal eden içerik yüklemek,\n" +
      "• Yıldız adlarında veya görünen isimlerde hakaret, nefret söylemi ya da uygunsuz ifadeler kullanmak (bildirilen adlar gizlenebilir),\n" +
      "• Partnerinizin rızası olmaksızın özel görüntülerini yüklemek veya paylaşmak,\n" +
      "• Uygulama altyapısına, sunucularına veya tersine mühendislik yöntemleriyle kaynak koduna müdahale etmeye çalışmak,\n" +
      "• Otomatik botlar veya scriptler ile veri çekmek (scraping).",

      "5. FİKRİ MÜLKİYET HAKLARI",
      "Uygulamanın tasarımı, logoları, kodları, arayüz unsurları ve marka hakları Veri Sorumlusuna aittir. Yüklediğiniz fotoğrafların ve anıların telif hakları size aittir; ancak uygulamanın çalışması için gerekli teknik lisansı vermiş sayılırsınız. Gökyüzü haritasındaki gerçek yıldızların konum, parlaklık ve tür bilgileri HYG Veritabanı'ndan (Hipparcos, Yale Parlak Yıldız Kataloğu ve Gliese; https://www.astronexus.com/projects/hyg) alınmıştır. Bu veri Creative Commons Atıf-AynıLisanslaPaylaş 4.0 (CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/) lisansıyla sunulur; uygulamada seçilip dönüştürülerek kullanılmıştır. Gökyüzü posterindeki yıldız verisi HYG Database v4.2'den (CC BY-SA 4.0, https://codeberg.org/astronexus/hyg), takımyıldızı çizgileri Stellarium western sky culture verisinden (CC BY-SA, sürüm belirtilmemiş, https://github.com/Stellarium/stellarium-skycultures) alınmıştır; bu veri dosyaları süzülüp yuvarlanarak değiştirilmiş olup aynı lisansla sunulur.",

      "6. HİZMET KESİNTİLERİ VE SORUMLULUK REDDİ",
      "Uygulama 'olduğu gibi' ve 'mevcut haliyle' sunulmaktadır. Mücbir sebepler, internet altyapı arızaları veya bakım çalışmaları nedeniyle yaşanabilecek geçici kesintilerden doğrudan veya dolaylı maddi/manevi zararlardan Veri Sorumlusu sorumlu tutulamaz. Uygulamadaki yıldızlar, çiftlere özel sembolik bir uygulama içi deneyimdir; astronomik bir kuruluşun resmi yıldız adlandırması veya bir gök cismi üzerinde mülkiyet/sahiplik hakkı doğurmaz. Gökyüzü posteri ve yıldız bilgileri eğlence ve bilgilendirme amaçlıdır; konumlar yaklaşık hesaplanır, gözlem veya bilimsel kullanım için doğruluk garantisi verilmez.",

      "7. FESİH VE ASKIYA ALMA",
      "İşbu koşullara aykırı hareket eden kullanıcıların hesapları önceden bildirim yapılmaksızın askıya alınabilir veya kalıcı olarak sonlandırılabilir.\n\n" +
      "Kullanılmayan hesapların silinmesi: Hiç eşleşmemiş hesaplar 30 gün, çiftten ayrılıp tek kalan hesaplar 60 gün kullanılmazsa silinir (aktif aboneliği olan hesaplar hariç, bunlar abonelik bittikten 60 gün sonra silinir). Silmeden önce bildirim gönderilir. Eşleşmiş hesaplar bu nedenle silinmez.",

      "8. TELİF HAKKI VE İÇERİK BİLDİRİMİ",
      "Uygulamaya yüklenen bir içeriğin (fotoğraf, profil fotoğrafı, yıldız adı, metin) telif hakkınızı ya da kişilik haklarınızı ihlal ettiğini veya hukuka aykırı ya da uygunsuz olduğunu düşünüyorsanız Profil > Yasal Bilgiler & Gizlilik > Destek ve İçerik Bildirimi satırından ya da destek@couplesky.app adresinden bildirim gönderebilirsiniz. Bildirimde şunlar yer almalıdır:\n" +
      "• Adınız ve iletişim bilginiz,\n" +
      "• İhlal edildiği ileri sürülen eser veya hakkın tanımı ile hak sahipliğinizin dayanağı,\n" +
      "• İçeriğin uygulamadaki yeri (yıldız adı, kullanıcı adı, ekran görüntüsü vb.),\n" +
      "• Bildirimin doğru olduğuna ve hak sahibi adına yetkiyle yapıldığına dair beyan.\n" +
      "Bildirimler en geç 7 gün içinde incelenir; hukuka aykırı olduğu anlaşılan içerik kaldırılır ya da erişime kapatılır ve bildirimi yapan kişiye sonuç bildirilir. İhlali tekrarlayan hesaplar askıya alınabilir veya kapatılabilir. Yetkili makamların kararları saklıdır. Yıldız adları ayrıca uygulama içinden \"Bu Yıldızı Bildir\" ile bildirilebilir; birden fazla çiftin bildirdiği adlar herkesten gizlenir.",

      "9. HİZMET SAĞLAYICI VE İLETİŞİM",
      "Hizmet sağlayıcı: Necati Taşcı (CoupleSky)" + CONTROLLER_ADDRESS_TR + " · E-posta: destek@couplesky.app. Uygulamanın herkese açık alanları yıldız adı, çiftin baş harfleri, isteğe bağlı ilk ad ve profil fotoğrafıyla sınırlıdır; fotoğraf, mektup, günlük ve notlar yalnızca eşleşen çiftin erişimindedir. Yasal bildirimler ve resmi makam talepleri bu adrese iletilebilir."
    ]
  },

  consent: {
    id: "consent",
    title: "Açık Rıza Metni",
    badge: "Özel Nitelikli Veri",
    lastUpdated: "Kasım 2026",
    summary: "Sağlık (döngü/regl) verileri, hassas konum verileri ve bildirim süreçlerine ilişkin açık rıza beyanı.",
    content: [
      "1. AÇIK RIZANIN KAPSAMI VE NİTELİĞİ",
      "6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") kapsamında, veri sorumlusuna sunduğum ve aşağıda detaylandırılan kişisel ve özel nitelikli kişisel verilerimin, Aydınlatma Metni'nde belirtilen ilkeler doğrultusunda işlenmesine ve eşleştiğim partnerimle paylaşılmasına özgür irademle açık rıza veriyorum.",

      "2. AÇIK RIZA VERİLEN VERİ TÜRLERİ VE AMACI",
      "• Özel Nitelikli Kişisel Veri (Sağlık Bilgisi): Uygulama içerisindeki regl/döngü takvimi ve ilaç takibi modüllerinde girdiğim tarih, döngü uzunluğu, semptom ve ilaç kullanım verilerimin; döngü tahmini yapılması, hatırlatıcı bildirimler üretilmesi ve eşleştiğim partnerimin ekranında görüntülenmesi amacıyla işlenmesi,\n" +
      "• Lokasyon (Konum) Verisi: Harita üzerinden seçtiğim buluşma noktaları ve anılara eklediğim GPS koordinatlarının, harita üzerinde partnerime gösterilmesi ve ortak rota planlaması amacıyla işlenmesi,\n" +
      "• Çift Ortak Verisi: Yüklediğim anı fotoğrafları, aşk mektupları ve ruh hali durumlarının yalnızca eşleştiğim partnerimle ve yalnızca eşleşme anından sonra kaydedilenler olmak üzere paylaşılmak üzere şifreli sunucularda saklanması; ilişkimin sona ermesi hâlinde kendi oluşturduğum verilerin yeni partnerimden gizli kalması,\n" +
      "• Bildirim Gönderimi: Önemli yıldönümleri, teslim edilen mektuplar ve partnerimin paylaştığı güncellemeler için cihazıma anlık push bildirimi gönderilmesi (bildirim metinlerinde ilaç adı, döngü durumu gibi sağlık ayrıntıları yer alabilir ve bu metinler Google, Apple ve Expo bildirim servislerinden geçer).",

      "3. RIZANIN GERİ ALINMASI",
      "İşbu Açık Rıza beyanımı dilediğim zaman uygulama içerisindeki Ayarlar bölümünden döngü/sağlık veya konum izinlerimi kapatarak, Profil > Yasal Bilgiler bölümündeki Destek satırından talepte bulunarak ya da hesabımı silerek geri alabileceğimi biliyor ve kabul ediyorum."
    ]
  },

  subscription: {
    id: "subscription",
    title: "Abonelik ve İade Koşulları",
    badge: "App Store & Play Store",
    lastUpdated: "Kasım 2026",
    summary: "Premium abonelik, ücretsiz deneme (tanımlıysa), otomatik yenileme, iptal prosedürü ve iade şartları.",
    content: [
      "1. COUPLES PREMIUM ABONELİĞİ VE KAPSAMI",
      "CoupleSky Premium, çiftlerden birinin abone olması halinde her iki partner için de geçerli olan ortak bir abonelik modelidir. Premium avantajları:\n" +
      "• Sınırsız fotoğraf yükleme ve ortak yüksek çözünürlüklü galeri,\n" +
      "• Döngü takibi ve ilgili hatırlatıcı bildirimleri,\n" +
      "• Zaman kilitli sınırsız mektup yazma ve ileri tarihli teslimatlar,\n" +
      "• Fotoğraflı geçmiş takvim günleri ve özel gün sayaçları,\n" +
      "• Kendi yıldızınız: yıldız sahipliği, ışıltı skoru, kıvılcımlar ve anı gezegenleri (bkz. madde 7).",

      "2. ÜCRETSİZ DENEME SÜRESİ",
      "İlk kez Premium pakete geçen kullanıcılara mağazada ve uygulama içinde belirtilen süre boyunca ücretsiz deneme hakkı tanınabilir. Deneme süresi boyunca kullanıcıdan herhangi bir ücret tahsil edilmez. Deneme süresi sona ermeden en az 24 saat önce iptal edilmediği takdirde, seçilen paket ücreti üzerinden otomatik olarak ücretli aboneliğe geçiş yapılır.",

      "3. OTOMATİK YENİLEME VE ÜCRETLENDİRME (APPLE & GOOGLE EULA)",
      "• Satın alma onayıyla birlikte ödeme Apple Kimliği / Google Play hesabınızdan tahsil edilir.\n" +
      "• Abonelik, mevcut abonelik döneminin bitiminden en az 24 saat önce kapatılmadığı sürece seçilen plan periyodunda (mağazada ve satın alma ekranında gösterilen haftalık, aylık, yıllık vb. dönem) otomatik olarak yenilenir.\n" +
      "• Cari dönemin bitimine 24 saat kala yenileme ücreti hesabınızdan tahsil edilir ve yenileme tutarı net olarak belirtilir.",

      "4. ABONELİĞİ İPTAL ETME PROSEDÜRÜ",
      "Aboneliğinizi istediğiniz an hiçbir cezai şart olmaksızın iptal edebilirsiniz. İptal işlemi mobil uygulama üzerinden değil, mağaza hesap ayarlarınızdan yapılmalıdır:\n" +
      "• iOS (Apple App Store): iPhone Ayarlar > [Adınız] > Abonelikler > CoupleSky > Aboneliği İptal Et adımlarını takip ediniz.\n" +
      "• Android (Google Play Store): Google Play Uygulaması > Profil Simgesi > Ödemeler ve Abonelikler > Abonelikler > CoupleSky > İptal Et adımlarını takip ediniz.\n" +
      "Aboneliğinizi iptal ettiğinizde, mevcut fatura döneminin sonuna kadar Premium haklarınızdan faydalanmaya devam edersiniz. Abonelik iki partner için ortak olduğundan, abonelik sona erdiğinde (iptal edilen dönemin bitiminde) partnerinizin Premium hakları da sona erer. Hesabınızı silmek aboneliğinizi iptal etmez; iptal yalnızca mağaza hesabınızdan yapılır.",

      "5. CAYMA HAKKI VE İADE POLİTİKASI",
      "Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesinin 1. fıkrasının (ğ) bendi uyarınca; 'Elektronik ortamda anında ifa edilen hizmetler veya tüketiciye anında teslim edilen gayrimaddi mallara ilişkin sözleşmelerde' cayma hakkı kullanılamaz. Bununla birlikte, hatalı veya mükerrer tahsilatlara ilişkin iade talepleri doğrudan Apple Destek (reportaproblem.apple.com) veya Google Play Destek platformları üzerinden yürütülmektedir. Fiyat, yenileme periyodu, deneme sonrası tahsilat ve cayma bilgisi, satın almadan önce satın alma ekranında da gösterilir.",

      "6. HESAP SİLME, AYRILMA VE PREMIUM'UN DURUMU",
      "• Premium aboneliği satın alan kişi hesabını sildiğinde (7 günlük bekleme sonunda), partnerinin Premium hakları o anda sona erer.\n" +
      "• Aboneliği satın alan kişi partner ise, silme işleminden sonra da Premium onda kalır; yeni bir eşleşmede yeni partnerine de geçerli olur (abonelik süresi boyunca).\n" +
      "• Süresiz (ömür boyu) paketi satın alan kişi, kimden ayrılırsa ayrılsın ve kiminle eşleşirse eşleşsin süresiz Premium'a sahip olmaya devam eder.\n" +
      "• Abonelik mağaza hesabınıza (Apple Kimliği / Google hesabı) bağlıdır. Hesabınızı sildikten sonra aynı mağaza hesabıyla yeniden kayıt olup satın alımlarınızı geri yüklediğinizde, süresi devam eden Premium hakkınız yeniden görünür; ancak eski hesabınızdaki veriler geri gelmez.\n" +
      "• Tek kalan (eşleşmemiş) kullanıcı Premium satın alabilir; ancak yıldız sahiplenme yalnızca çiftlere özeldir.\n" +
      "• Tek kalan kullanıcı Premium'a sahip değilse yeni kayıt oluşturamaz (yalnızca gökyüzünü gezebilir ve eski verilerini okuyabilir).",

      "7. PREMİUM BİTTİĞİNDE YILDIZ, KIŞ UYKUSU VE İÇERİK ERİŞİMİ",
      "Yıldız sahipliği, ışıltı skoru, kıvılcımlar ve anı gezegenleri Premium'a bağlıdır. Premium sona erdiğinde (iptal, ödemenin alınamaması ya da sürenin bitmesi) süreç şu şekilde işler:\n\n" +
      "• 14 Günlük Kış Uykusu (Grace Period): Çifte yenilemesi için hakkın bittiği andan itibaren 14 gün süre tanınır. Bu sürede hiçbir şey silinmez; gökkubbedeki yıldız koordinatı çifte ait kalır ve gökyüzünden izlenebilir. Ancak yıldız sönük görünür, yıldızın içi (anı gezegenleri) açılmaz, arkadaş çiftlerle ışık bağları gökyüzünde gösterilmez ve yeni bağ kurulamaz, yıldızın adı değiştirilemez. Bağ kayıtları silinmez; abonelik yenilenirse her şey olduğu gibi döner.\n" +
      "• İçerik Erişim ve İşlem Hakları: Premium bittiğinde geçmiş fotoğraflar (tam boy dahil), özel günler, mektuplar, aşk haritasındaki fotoğraf, not ve buluşmalar görüntülenmeye devam eder. Yeni fotoğraf yüklenemez; özel günlerin başlığı, açıklaması ve tarihi düzenlenebilir ancak Premium iken yüklenmiş özel gün fotoğrafı değiştirilemez; yeni özel gün yalnızca fotoğrafsız eklenebilir; mektup Premium olmadan yalnızca jetonla gönderilebilir. Profil fotoğrafları uygulamada gösterilmez, döngü takvimini partner olarak görüntüleme kapanır, anı gezegenlerinin ve yıldızın düzenlenmesi kilitlenir. İsimlerin yıldızda görünürlüğü ayarı ise değiştirilebilir. Kendi yüklediğiniz fotoğrafları, özel günleri ve anı gezegenlerini silme hakkınız ile mektuplar için silme isteği gönderme hakkınız Premium'a bağlı değildir.\n" +
      "• 14 Günün Sonu (Koordinatın Boşa Çıkması & Kasa): 14 gün içinde yenilenmezse yıldızın gökkubbedeki koordinatı serbest bırakılır ve diğer çiftlerin tesciline açılır; ışıltı skoru, kıvılcımlar ve yıldız bağları sıfırlanır. Çiftin anı gezegenleri ve hatıraları silinmez, 90 gün boyunca sistem kasasında (Vault) saklanır. Bu sürede yeniden abone olunup bir yıldız sahiplenilirse (eski yıldız hâlâ boştaysa o da seçilebilir) anı gezegenleri kayıpsız olarak o yıldıza aktarılır.\n" +
      "• Kasa Süresinin Sonu (Depolama Tasfiyesi): Kasa süresi de yenilenmeden dolarsa tam boy fotoğraf dosyaları, anı ve gezegen görselleri ile profil fotoğrafları kalıcı olarak silinir. Fotoğraf arşivinde her fotoğrafın küçük önizlemesi kalır ve tam boy görselin yerine gösterilir; küçük önizlemesi olmayan fotoğraf kaydı silinir. Metin kayıtları korunur. Kalan süreler ve tasfiye tarihi uygulamada Profil > Premium ekranında gösterilir. Tasfiyeden yaklaşık 7 gün ve 1 gün önce ayrıca uygulama bildirimi gönderilir (bildirimleri kapattıysanız ulaşmayabilir). Partnerinizin hesabını silmesi nedeniyle çift dağılırsa yıldız ve gezegenler kış uykusu/kasa süreci beklenmeden silinir; kasada saklanmaz.",

      "8. ARKADAŞ ÇİFT DAVETİ (HEDİYE PREMIUM)",
      "Eşleşmiş her çiftin bir davet kodu vardır (Profil > Çift Arkadaşlarımızı Davet Et). Koşullar:\n" +
      "• Ödül yalnızca kodu giren arkadaş kendi sevgilisiyle eşleşip iki kişilik bir çift oluşturduğunda verilir; uygulamayı indirmek ya da kodu girmek tek başına ödül kazandırmaz.\n" +
      "• Ödül her iki çifte ayrı ayrı verilir: Premium'u olmayan çifte 3 gün Premium; Premium'u bu programın hediyesi olan çifte mevcut süresine 3 gün eklenir; ücretli aboneliği ya da süresiz Premium'u olan çiftin iki üyesine 250'şer jeton verilir. Hediye Premium mağaza aboneliği değildir, ücret alınmaz ve kendiliğinden yenilenmez; süresi bitince madde 7'deki kış uykusu ve kasa süreçleri uygulanır.\n" +
      "• Davet kodu yalnızca hesabın açılmasından sonraki ilk 7 gün içinde ve kişi başına bir kez girilebilir; bir çift tek davetle ödüllenir. Davet eden bir çift en fazla 5 davetten ödül alır; sınır dolduktan sonra davet edilen arkadaşlar hediyelerini almaya devam eder.\n" +
      "• Aynı cihazda açılmış hesaplar, kendi kendini davet ve daha önce ödüllenmiş bir çiftin üyelerinin yeniden ödül kazandırması ödüle hak kazandırmaz; bu durumların tespiti için cihaz kimlikleri karşılaştırılır (Gizlilik Politikası, madde 4). Kötüye kullanım tespit edilirse verilen ödüller geri alınabilir.\n" +
      "• Kodu giren kişinin adı davet eden çiftin davet listesinde görünür; eşleşmeden sonra iki çiftin de ilk adları birbirine gösterilir ve iki çiftin de yıldızı olduğunda yıldızları arasında bir ışık bağı kendiliğinden kurulur. Bu bağ diğer yıldız bağları gibi istenildiği an kaldırılabilir."
    ]
  }
};

export const LEGAL_DOCS_EN: Record<LegalDocType, LegalDocument> = {
  kvkk: {
    id: "kvkk",
    title: "Personal Data Protection & GDPR Clarification Text",
    badge: "GDPR & KVKK Compliant",
    lastUpdated: "November 2026",
    summary: "Information on the processing purposes, collection methods, legal grounds of your personal data, and your rights under GDPR and Article 11 of Turkish Law No. 6698 (KVKK).",
    content: [
      "1. DATA CONTROLLER",
      "Data Controller: NECATI TASCI (CoupleSky)" + CONTROLLER_ADDRESS_EN + " · Contact & support: support@couplesky.app. As CoupleSky (\"App\" or \"Data Controller\"), under the relevant data protection legislations (GDPR and Turkish Law No. 6698), we place the highest priority on the security and privacy of our users' personal data. This Clarification Text explains the purposes for which your data collected via our mobile app is processed and outlines your statutory rights.",

      "2. CATEGORIES OF PROCESSED PERSONAL DATA AND DATA TYPES",
      "Within the scope of our shared couple journal, time-capsule sealed letters, location-based date planner, and health/menstrual cycle tracking features, the following personal data is processed:\n" +
      "• Identity and Contact Information: Full name, username, email address, gender selection.\n" +
      "• Couple and Relationship Information: Pairing code, first meeting date, relationship anniversary dates. When a relationship ends (for example when your partner deletes their account), the meeting and relationship dates are reset and entered again in a new pairing.\n" +
      "• Visual and Audio Records: Photos uploaded to the shared gallery or private journals, memory pictures, and profile avatars.\n" +
      "• Location Information: Meeting point coordinates and optional GPS pins attached to memory photos. For the sky poster feature, the place, date and time you choose are used only on your device to compute the poster; coordinates are not stored and are not sent to our servers. The place name (district/city level), time and title are kept on your device, deleted when you sign out, and may be included in device backups.\n" +
      "• Special Category Personal Data (Health Information): Menstrual cycle start dates, predicted cycle intervals, daily medication/vitamin hours and adherence logs.\n" +
      "• Messaging and Memory Content: Time-capsule letters, private daily notes, and mood selections (stored encrypted on our servers).\n" +
      "• Transaction and Financial Information: Anonymous transaction identifiers, subscription status, package type, and token balance processed via RevenueCat and app stores (App Store / Google Play).\n" +
      "• Device and Operation Security: Device model, OS version, push notification tokens, unique device identifier (UUID), last sign-in and last app usage time, security logs, and IP address used to rate-limit sign-in / password-reset attempts (kept for at most 1 day).\n" +
      "• Error Logs: When the app errors, the error message, technical stack trace, app version, platform (iOS/Android) and your account identifier. Content such as letters or journal entries is not written to these logs; they are kept for at most 30 days.\n" +
      "• Advertising Data: Advertising identifiers and ad interaction data processed by Google AdMob for the rewarded ads shown in the app (limited to non-personalized ad requests). The app does not track you across other apps and websites, and no tracking permission (ATT) is requested.",

      "3. PURPOSES OF PROCESSING PERSONAL DATA",
      "Your personal data is processed in accordance with applicable data protection principles for the following purposes:\n" +
      "• Account creation, secure authentication, and prevention of unauthorized access,\n" +
      "• Linking two partners with a private pairing code and sharing the memory/calendar content saved after the pairing moment,\n" +
      "• Deleting unused, unpaired accounts after a set period (storage limitation) and sending a notice before deletion,\n" +
      "• Cryptographic encryption of time-locked letters and preserving their confidentiality until the chosen unlock date,\n" +
      "• Displaying shared date locations on map with convenient routing,\n" +
      "• Delivering timely push notifications for medicine schedules, cycle updates, anniversaries, and unlocked letters,\n" +
      "• Provisioning CoupleSky Premium entitlements so that a single subscription covers both partners,\n" +
      "• Maintaining network and information security against cyber attacks and brute-force attempts.",

      "4. PARTIES TO WHOM PERSONAL DATA IS TRANSFERRED",
      "Your personal data is never sold to third parties for advertising or commercial purposes. Data is shared strictly to perform our services with the following vetted providers, some of which are located internationally:\n" +
      "• Supabase Inc.: Secure PostgreSQL database, encrypted cloud storage, and authentication infrastructure (data is hosted in the Frankfurt / Germany region),\n" +
      "• RevenueCat Inc.: In-app purchases, subscription entitlement verification, and receipt validation,\n" +
      "• Google Cloud / Firebase, Apple (APNs) & Expo Notifications: Delivery of push notifications to your device (notification text may include health details such as medicine name or cycle status that your partner shares, and passes through these services),\n" +
      "• Google LLC (AdMob & Google Maps): Map services and non-personalized advertising,\n" +
      "• Apple Inc. & Google LLC: Sign in with Apple and Sign in with Google authentication services; on-device address search and address lookup (the address text you type and the coordinates of the point you pick on the map),\n" +
      "• Expo (Expo Updates / EAS): Distribution of app updates; your IP address, platform and app version are sent when checking for updates,\n" +
      "• OpenStreetMap Foundation (Nominatim): Used as a fallback when the device's own address search returns nothing; only the text you type in the address search box and your IP address are sent,\n" +
      "• Unsplash: Sample images shown in explore (demo) mode; your IP address is visible while the images load,\n" +
      "• Competent Public Authorities: In response to lawful court orders or binding legal obligations.\n\n" +
      "Basis for transfers abroad: Transfers to providers located abroad are made under Article 9 of KVKK, relying on an adequacy decision of the Personal Data Protection Board, or, where there is none, on the appropriate safeguards listed in Article 9 (standard contract, binding corporate rules, etc.) or other cases provided by law. You can ask which basis is used for which provider at support@couplesky.app.",

      "5. DATA COLLECTION METHODS AND LEGAL GROUNDS",
      "Your data is collected electronically via app UI inputs, camera/gallery permissions, device sensors, and notification permissions. Legal grounds include:\n" +
      "• Contractual Necessity: Performance of the User Agreement and core service delivery,\n" +
      "• Legitimate Interests: Enhancing app security, preventing fraud, and optimizing stability without overriding fundamental user rights,\n" +
      "• Explicit Consent (KVKK Art. 6/2): For health-related cycle/medicine data, given with a separate tick box when you first use the feature, apart from the terms acceptance at sign-up. Location depends on your granting the device location permission and choosing to use the related feature.",

      "6. DATA SECURITY AND ENCRYPTION (AES-256)",
      "CoupleSky writes your daily notes and letters to the database encrypted with AES-256. The encryption key is derived inside the app from a random, couple-specific value kept on the server. This is therefore not end-to-end encryption: as the party operating the service we are technically able to access this content, and we do not use it for any other purpose, including marketing. Access is limited by Row-Level Security (RLS) rules to authenticated members of the relevant couple. Your shared photos are kept in private storage and displayed only through time-limited, signed links; your profile photo (avatar), however, is kept in public storage at an unguessable address and can be viewed by anyone who has that address. All traffic is encrypted with TLS.",

      "7. DATA RETENTION AND DELETION (RIGHT TO BE FORGOTTEN)",
      "You can request deletion of your account in Profile > Account Management & Danger Zone. The request waits 7 days; signing in with the same account during this period cancels the request automatically and you are informed. A reminder notification is sent 3 days and 1 day before the deletion day so you can still cancel. After 7 days everything you created, uploaded or wrote (profile details, photos, journals, letters, notes, special days, map pins, medicine and cycle records and content in your star) is permanently deleted from our servers. Your partner's account is not deleted; content your partner created remains available only to your partner. The shared star and the memory planets inside it are deleted regardless of who created them; automatically created anniversary entries are also deleted. Your partner's pairing code is renewed so your partner can pair again. Your partner is informed in the app and by notification about the request, reminders 3 days and 1 day before deletion, withdrawal and deletion. If both sides requested deletion, each account is deleted on its own 7th day; with the last account, everything remaining that belongs to the couple is permanently deleted. Backups are destroyed automatically within 30 days at the latest.\n\n" +
      "Under GDPR Article 17 and applicable data protection legislation, the statutory right to delete your personal data, uploaded photos, and letters cannot be conditioned upon an active paid subscription. Users may permanently delete their own content or terminate their accounts at any time, even on the free tier (for letters already delivered to the partner, the partner-approved deletion rules apply).\n\n" +
      "Retention periods:\n" +
      "• Account, profile and content: until your account is deleted (deleted 7 days after the request). Content your partner created belongs to your partner as long as their account exists, even if you delete yours,\n" +
      "• Unused accounts: New accounts that never paired are deleted 30 days after last use; accounts left alone after a couple ended are deleted 60 days after last use. Accounts with an active subscription are not deleted; they are deleted 60 days after the subscription ends. Paired accounts are never deleted for this reason. A notification is sent about 7 days and 1 day before deletion (it may not reach you if notifications are off),\n" +
      "• Earlier data and new partners: In a new pairing your new partner only sees data saved after the pairing moment; data from your earlier relationship is not shown to your new partner and stays only in your access (you can delete it any time),\n" +
      "• Star registration and coordinate: retained for the couple during a 14-day Stellar Hibernation (Grace Period) following subscription expiration; if not renewed within 14 days, the coordinate is released to the public catalog for other couples to claim. If your partner deletes their account, the star and the memory planets inside it are deleted without waiting for the hibernation/vault period,\n" +
      "• Star memory vault and planet data: kept in the system vault for 90 days after the coordinate is released; if you subscribe again and claim a star in that time, the memory planets move to it,\n" +
      "• Media storage purge: if the vault period (90 days after the coordinate is released) ends without renewal, full-size photo files, memory and planet images and profile photos are permanently deleted. Small previews in the photo archive and text records (memories, planets, letters, notes) are kept; a photo record without a small preview is deleted. The purge date is shown in the app under Profile > Premium; an app notification is sent about 7 days and 1 day before the purge (it may not reach you if notifications are off),\n" +
      "• Error logs: at most 30 days,\n" +
      "• Sign-in and password-reset attempt records (including IP address): at most 1 day,\n" +
      "• Records that prevent duplicate notifications: 14 days,\n" +
      "• In-app account notices shown to your partner: 30 days after they are seen,\n" +
      "• Push notification token: for the life of your session and account (after a deletion request, only until the deletion day, for the deletion reminder),\n" +
      "• Records held by third-party providers (e.g. RevenueCat, Expo, Google): subject to the provider's own retention policies.",

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
    lastUpdated: "November 2026",
    summary: "Detailed guidelines on our data collection, processing, and protection principles, and how your couple privacy is strictly preserved.",
    content: [
      "1. INTRODUCTION AND OUR COMMITMENT",
      "CoupleSky is designed for partners to cherish their most precious memories, letters, and daily moments within a protected private digital space. User privacy is our core foundation. Your personal data is never sold to third parties or traded with advertising brokers.",

      "2. COLLECTED INFORMATION AND USAGE SCOPE",
      "• Account Data: Name, username, email address, and securely hashed passwords provided during sign up.\n" +
      "• Relationship Content: Photos, captions, time-capsule letters, and calendar notes. This content is exclusively accessible to you and your paired partner. In a new pairing your partner only sees content saved after the pairing moment; content from an earlier relationship is not shown to your new partner.\n" +
      "• Stars (Sky): Your star's name and your couple's initials are visible to other users and to visitors trying the app without an account. Your first name is shown only to couples you have a star bond with and, if you explicitly allow it under Certificate > Our Names & Photos, to everyone. Your profile photo (Premium) is shown on your star card to everyone only if you separately allow it in the same section; it is no longer shown when Premium ends or when you remove the photo. Each person gives their own consent (your partner cannot turn it on for you), and you can turn it off at any time. Your last name, username, and email address are never shown. Inappropriate star names, names, and photos can be reported in the app.\n" +
      "• Cycle and Health Data: Menstrual start dates and medication hours. Used solely to provide cycle predictions and timely reminders for you and your partner.\n" +
      "• Location Coordinates: Obtained only when you explicitly select a meeting point on the map or geotag a photo; no persistent background tracking is ever conducted. For the sky poster, the place and time you choose are processed only on your device to compute the poster; coordinates are not stored and are not sent to our servers, and the place name (district/city level), time and title are kept on your device and deleted when you sign out. To find the address of a point you pick on the map, its coordinates are sent to your device's address service (Apple/Google).\n" +
      "• Usage time: The last time your account was used. Kept only so unused, unpaired accounts can be deleted (Section 5).\n" +
      "• Error and Security Logs: When the app errors, the error message, technical stack trace, app version and platform (at most 30 days); IP address used to rate-limit sign-in attempts (at most 1 day). Your content is not written to these logs.\n" +
      "• Third-Party Infrastructure: Google AdMob, Google Maps, Apple/Google Sign-In, Supabase, RevenueCat, Expo (notifications and app updates), OpenStreetMap Nominatim (fallback address search) and Unsplash (sample images in explore mode). For details and information on transfers abroad, refer to Section 4 of our Clarification Text.",

      "3. SECURITY AND CRYPTOGRAPHIC ENCRYPTION",
      "All network traffic is encrypted via TLS/SSL protocols. Private letters and journal entries are encrypted before persistent storage. Shared photos are kept in private storage; your profile photo (avatar) is kept in public storage at an unguessable address and can be viewed by anyone who has that address. Session tokens reside in secure device storage; securing your device with biometric or passcode locks is strongly advised.",

      "4. COOKIES AND UNIQUE DEVICE IDENTIFIER",
      "To prevent brute-force attacks and unauthorized multi-device logins, a randomly generated UUID device identifier is utilized. When logging in from an unrecognized device, one-time verification is prompted to safeguard your account. In the friend invite program, the device identifiers of the inviting and invited couples are compared on our server to stop rewards being earned with accounts created on the same device; this comparison is not used for any other purpose.",

      "5. ACCOUNT ERASURE AND DATA PURGE (GDPR & CCPA COMPLIANT)",
      "You can request deletion of your account in Profile > Account Management & Danger Zone. The request waits 7 days; signing in with the same account during this period cancels the request automatically and you are informed. A reminder notification is sent 3 days and 1 day before the deletion day so you can still cancel. After 7 days everything you created, uploaded or wrote (profile details, photos, journals, letters, notes, special days, map pins, medicine and cycle records and content in your star) is permanently deleted from our servers. Your partner's account is not deleted; content your partner created remains available only to your partner. The shared star and the memory planets inside it are deleted regardless of who created them; automatically created anniversary entries are also deleted. Your partner's pairing code is renewed so your partner can pair again. Your partner is informed in the app and by notification about the request, reminders 3 days and 1 day before deletion, withdrawal and deletion. If both sides requested deletion, each account is deleted on its own 7th day; with the last account, everything remaining that belongs to the couple is permanently deleted. Backups are destroyed automatically within 30 days at the latest.\n\n" +
      "Unused accounts: New accounts that never paired are deleted 30 days after last use; accounts left alone after a couple ended are deleted 60 days after last use. Accounts with an active subscription are not deleted; they are deleted 60 days after the subscription ends. Paired accounts are never deleted for this reason. A notification is sent about 7 days and 1 day before deletion (it may not reach you if notifications are off).\n\n" +
      "Deleting your account does not cancel your Apple/Google subscription; cancel it separately in the store account.\n\n" +
      "Your right to delete your own content does not depend on Premium, including after your subscription ends: you can delete the photos, special days and memory planets you added without Premium and send deletion requests for letters (the partner-approved deletion rules for letters apply). When Premium ends, the star enters a 14-day Stellar Hibernation; if not renewed, the star coordinate is released and memory planets and memories are kept in the vault for 90 days. If the vault period also ends without renewal, full-size photo files and profile photos are deleted from storage; small photo previews and text records are kept. The purge date is shown in the app under Profile > Premium. If your partner deletes their account, the star and planets are deleted without entering this process.",

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
    lastUpdated: "November 2026",
    summary: "General rules, account safety, couple pairing mechanisms, intellectual property, and limitations of liability.",
    content: [
      "1. ACCEPTANCE OF TERMS",
      "By downloading, installing, registering, or using CoupleSky, you agree to be bound by these Terms of Use (\"Agreement\"). If you do not accept all terms contained herein, do not use the application.",

      "2. SERVICE SCOPE AND COUPLE PAIRING",
      "CoupleSky provides a private platform enabling two partners to connect via a unique pairing code to share memories, calendars, photographs, health tracking, and time-capsule letters. You must only share your pairing code with your trusted partner.\n\n" +
      "In a new pairing the partner only sees content saved after the pairing moment. When a couple's relationship ends (for example your partner deletes their account), the shared star and its planets are deleted and content you created stays in your account. A user left alone must pair again to use features that need a pairing (photos, letters, memories, meetups and star); a user left alone with Premium can use mood, journal, calendar notes, map notes and medicine/cycle tracking.",

      "3. ACCOUNT CREDENTIALS AND SECURITY",
      "You are solely responsible for maintaining the confidentiality of your login credentials. You accept responsibility for all activities that occur under your account. If you suspect unauthorized access, reset your password immediately or contact our support team. Deleting your account does not cancel your store subscription; you are responsible for cancelling it in the store.",

      "4. PROHIBITED USES AND CONDUCT",
      "When using the application, you agree not to:\n" +
      "• Upload unlawful, threatening, abusive, defamatory, or invasive content,\n" +
      "• Use offensive, hateful, or inappropriate wording in star names or display names (reported names may be hidden),\n" +
      "• Upload or share private photographs of your partner without their explicit consent,\n" +
      "• Attempt to reverse-engineer, decompile, or tamper with the application's source code or backend servers,\n" +
      "• Deploy automated scrapers, crawlers, or bots to harvest data.",

      "5. INTELLECTUAL PROPERTY RIGHTS",
      "The application UI, designs, logos, artwork, and software code are owned exclusively by the Data Controller. You retain ownership of all photographs and text memories you upload, while granting the necessary technical license required to render the service. The positions, brightness and types of the real stars on the sky map come from the HYG Database (Hipparcos, Yale Bright Star and Gliese catalogs; https://www.astronexus.com/projects/hyg), provided under the Creative Commons Attribution-ShareAlike 4.0 license (CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/); the data was selected and converted for use in the app. The star data on the sky poster comes from HYG Database v4.2 (CC BY-SA 4.0, https://codeberg.org/astronexus/hyg) and the constellation lines from the Stellarium western sky culture (CC BY-SA, version not specified, https://github.com/Stellarium/stellarium-skycultures); these data files have been modified (filtered and rounded) and remain under the same license.",

      "6. SERVICE AVAILABILITY AND DISCLAIMER OF WARRANTIES",
      "CoupleSky is provided on an \"AS IS\" and \"AS AVAILABLE\" basis. We cannot guarantee uninterrupted uptime due to maintenance, force majeure events, or network provider disruptions, and disclaim liability for indirect or consequential damages to the extent permitted by law. The stars in the app are a symbolic in-app experience for couples; they do not constitute an official star naming by any astronomical organization or any ownership right over a celestial body. The sky poster and star information are for entertainment and information only; positions are computed approximately and no accuracy is guaranteed for observation or scientific use.",

      "7. TERMINATION AND SUSPENSION",
      "We reserve the right to suspend or terminate accounts that violate these Terms or present safety risks to other users without prior liability.\n\n" +
      "Deleting unused accounts: accounts that never paired are deleted after 30 days of no use, accounts left alone after a couple ended after 60 days (except accounts with an active subscription, which are deleted 60 days after the subscription ends). A notice is sent before deletion. Paired accounts are not deleted for this reason.",

      "8. COPYRIGHT AND CONTENT REPORTS",
      "If you believe content uploaded to the app (photo, profile photo, star name, text) infringes your copyright or personality rights, or is unlawful or inappropriate, you can send a report from Profile > Legal Information & Privacy > Support & Content Reports or by email to support@couplesky.app. The report should include:\n" +
      "• Your name and contact details,\n" +
      "• A description of the work or right allegedly infringed and the basis of your ownership,\n" +
      "• Where the content appears in the app (star name, username, screenshot, etc.),\n" +
      "• A statement that the report is accurate and made with authority on behalf of the rights holder.\n" +
      "Reports are reviewed within 7 days at the latest; content found to be unlawful is removed or made inaccessible and the reporter is told the outcome. Accounts that repeatedly infringe may be suspended or closed. Decisions of competent authorities are reserved. Star names can also be reported in the app with \"Report This Star\"; names reported by several couples are hidden from everyone.",

      "9. SERVICE PROVIDER AND CONTACT",
      "Service provider: Necati Taşcı (CoupleSky)" + CONTROLLER_ADDRESS_EN + " · Email: support@couplesky.app. The app's public areas are limited to star names, couple initials, an optional first name and the profile photo; photos, letters, journal entries and notes are accessible only to the paired couple. Legal notices and official authority requests can be sent to this address."
    ]
  },

  consent: {
    id: "consent",
    title: "Explicit Consent Statement",
    badge: "Special Category Data",
    lastUpdated: "November 2026",
    summary: "Declaration of explicit consent regarding health (menstrual cycle / medication) data, sensitive location data, and push notification flows.",
    content: [
      "1. NATURE AND SCOPE OF EXPLICIT CONSENT",
      "Under applicable data protection laws, I freely and knowingly provide my explicit consent for the processing and couple-synchronized sharing of my personal and special-category personal data as detailed below, in full accordance with the principles set forth in the Clarification Text.",

      "2. DATA CATEGORIES SUBJECT TO EXPLICIT CONSENT AND PURPOSES",
      "• Special Category Data (Health Information): Dates, cycle lengths, symptom notes, and medication schedules entered into the cycle and medicine tracker modules, processed to forecast menstrual cycles, generate reminders, and display synchronizations on my paired partner's screen,\n" +
      "• Geolocation Data: Coordinates selected for meeting points and GPS locations tagged onto photos, processed to display shared map markers and facilitate route planning,\n" +
      "• Shared Couple Content: Memory photos, love letters, and mood statuses stored on encrypted servers to be shared only with my paired partner and only for content saved after the pairing moment; and, if my relationship ends, for my own data to remain hidden from my new partner,\n" +
      "• Push Notifications: Receiving instant notifications for approaching anniversaries, delivered letters and updates my partner shares (notification text may include health details such as medicine name or cycle status that your partner shares, and passes through these services).",

      "3. WITHDRAWAL OF CONSENT",
      "I understand and agree that I may withdraw this consent at any time by disabling health or location permissions within the app settings, by writing to us from the Support row under Profile > Legal Information, or by requesting account deletion."
    ]
  },

  subscription: {
    id: "subscription",
    title: "Subscription & Refund Terms",
    badge: "App Store & Google Play",
    lastUpdated: "November 2026",
    summary: "CoupleSky Premium subscription features, free trial duration (if defined), auto-renewal rules, cancellation steps, and statutory refund policies.",
    content: [
      "1. COUPLES PREMIUM SUBSCRIPTION & SHARED COVERAGE",
      "CoupleSky Premium operates on a shared subscription model: when one partner subscribes, both partners unlock all Premium features instantly. Premium benefits include:\n" +
      "• Unlimited high-resolution photo uploads and shared cloud archive,\n" +
      "• Advanced cycle tracking and synchronized health notifications,\n" +
      "• Unlimited time-capsule letters with future scheduled unlocks,\n" +
      "• Memory timeline with interactive anniversary countdowns,\n" +
      "• Your own star: star ownership, glow score, sparks and memory planets (see Section 7).",

      "2. FREE TRIAL PERIOD",
      "First-time subscribers may be eligible for a promotional free trial as displayed in the store paywall. No charges are billed during the trial. If the subscription is not canceled at least 24 hours prior to the end of the trial period, it will automatically convert into a paid recurring subscription.",

      "3. AUTOMATIC RENEWAL AND BILLING (STANDARD STORE EULA)",
      "• Payment is charged to your Apple ID / Google Play Account upon confirmation of purchase.\n" +
      "• Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current billing cycle (the weekly, monthly, annual etc. period shown in the store and on the purchase screen).\n" +
      "• Your account will be charged for renewal within 24 hours prior to the end of the current period at the then-applicable renewal rate.",

      "4. SUBSCRIPTION CANCELLATION PROCEDURE",
      "You can cancel your subscription at any time without cancellation fees. Cancellations must be performed through your store account settings rather than within the mobile app:\n" +
      "• iOS (Apple App Store): Go to iPhone Settings > [Your Name] > Subscriptions > CoupleSky > Cancel Subscription.\n" +
      "• Android (Google Play Store): Open Google Play Store > Profile Icon > Payments & Subscriptions > Subscriptions > CoupleSky > Cancel Subscription.\n" +
      "Upon cancellation, you will retain access to all Premium features until the conclusion of your active billing period. Because the subscription is shared by both partners, your partner's Premium access also ends when the subscription ends (at the end of the canceled period). Deleting your account does not cancel your subscription; cancellation is made only in your store account.",

      "5. RIGHT OF WITHDRAWAL AND REFUND POLICY",
      "Under applicable digital consumer regulations, statutory withdrawal rights do not apply once digital content or services have commenced with the consumer's consent. Refund requests for accidental or duplicate charges are administered directly by Apple Support (reportaproblem.apple.com) or Google Play Customer Support in accordance with store refund policies. The price, renewal period, post-trial charge and withdrawal information are also shown on the purchase screen before you buy.",

      "6. ACCOUNT DELETION, BREAKUP AND PREMIUM",
      "• If the person who bought the Premium subscription deletes their account (after the 7-day wait), the partner's Premium ends at that moment.\n" +
      "• If the partner is the one who bought the subscription, Premium stays with the partner after the deletion and also applies to a new partner during the subscription period.\n" +
      "• A person who bought the lifetime package keeps lifetime Premium no matter whom they part from or pair with.\n" +
      "• The subscription belongs to your store account (Apple ID / Google account). If you register again with the same store account after deleting your account and restore your purchases, the remaining Premium right becomes visible again; data from the old account does not come back.\n" +
      "• A user left alone can buy Premium, but claiming a star is only for couples.\n" +
      "• A user left alone without Premium cannot create new records (they can only browse the sky and read earlier data).",

      "7. YOUR STAR WHEN PREMIUM ENDS, STELLAR HIBERNATION AND CONTENT ACCESS",
      "Star ownership, glow score, sparks and memory planets depend on Premium. When Premium ends (cancellation, failed payment or expiration), the lifecycle proceeds as follows:\n\n" +
      "• 14-Day Stellar Hibernation (Grace Period): The couple gets 14 days from the moment the entitlement ends to renew. Nothing is deleted during this time; the celestial coordinate stays registered to the couple and the star can be watched in the sky. However, the star appears dim, its inner world (memory planets) cannot be opened, light bonds with friends' stars are not drawn in the sky and new bonds cannot be made, and the star's name cannot be changed. Bond records are not deleted; if the subscription is renewed, everything returns as it was.\n" +
      "• Content Access and Action Rights: When Premium ends, existing photos (including full size), special days, letters and the photos, notes and meetups on the love map remain viewable. New photos cannot be uploaded; the title, description and date of special days can still be edited but a photo uploaded while Premium cannot be changed, and new special days can only be added without a photo; without Premium, letters can only be sent with tokens. Profile photos are not shown in the app, viewing the cycle calendar as a partner is closed, and editing memory planets and the star is locked. The setting for showing your names on the star can still be changed. Your right to delete the photos, special days and memory planets you added, and to request deletion of letters, does not depend on Premium.\n" +
      "• End of 14 Days (Coordinate Release & Vault): If not renewed within 14 days, the star's celestial coordinate is released and can be claimed by other couples; the glow score, sparks and star bonds are reset. The couple's memory planets and memories are not deleted; they are kept in the system vault for 90 days. If you subscribe again and claim a star in that time (the old star can be chosen if it is still free), the memory planets move to it unchanged.\n" +
      "• End of the Vault Period (Storage Purge): If the vault period also ends without renewal, full-size photo files, memory and planet images and profile photos are permanently deleted. Each photo in the archive keeps its small preview, which is shown in place of the full-size image; a photo record without a small preview is deleted. Text records are kept. Remaining time and the purge date are shown in the app under Profile > Premium. An app notification is also sent about 7 days and 1 day before the purge (it may not reach you if notifications are turned off). If the couple breaks up because your partner deletes their account, the star and planets are deleted without waiting for hibernation/vault and are not stored in the vault.",

      "8. COUPLE FRIEND INVITES (GIFT PREMIUM)",
      "Every paired couple has an invite code (Profile > Invite Our Couple Friends). Conditions:\n" +
      "• The reward is given only when the friend who entered the code pairs with their own partner and forms a two-person couple; downloading the app or entering the code alone does not earn a reward.\n" +
      "• Both couples are rewarded separately: a couple without Premium gets 3 days of Premium; a couple whose Premium is a gift from this program gets 3 days added to it; each member of a couple with a paid subscription or lifetime Premium gets 250 tokens. Gift Premium is not a store subscription, is free of charge and does not renew; when it ends, the hibernation and vault process in Section 7 applies.\n" +
      "• An invite code can be entered only within the first 7 days after creating an account and only once per person; a couple is rewarded for one invite only. An inviting couple earns rewards for at most 5 invites; after that limit, the friends they invite still receive their gift.\n" +
      "• Accounts created on the same device, inviting yourself, and members of an already-rewarded couple earning a reward again do not qualify; device identifiers are compared to detect these cases (Privacy Policy, Section 4). Rewards may be revoked if abuse is detected.\n" +
      "• The name of the person who enters the code appears in the inviting couple's invite list; after pairing, both couples' first names are shown to each other, and once both couples have a star, a light bond between their stars is created automatically. Like any star bond, it can be removed at any time."
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
