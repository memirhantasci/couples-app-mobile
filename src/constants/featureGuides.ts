export interface FeatureItem {
  id: string;
  title: string;
  icon: string; // Lucide icon key
  badge?: string;
  description: string;
  tip?: string;
}

export interface PageTourGuide {
  pageKey: string;
  title: string;
  tagline: string;
  icon: string;
  summary: string;
  features: FeatureItem[];
}

export const FEATURE_GUIDES: Record<string, PageTourGuide> = {
  home: {
    pageKey: "home",
    title: "Ana Sayfa",
    tagline: "Aşkınızın Günlük Merkezi",
    icon: "Home",
    summary: "İlişkinizin nabzını tuttuğunuz, ortak aşk puanınızı ve günün en tatlı özetlerini gördüğünüz ana kumanda merkeziniz.",
    features: [
      {
        id: "love-counter",
        title: "Birliktelik Sayacı",
        icon: "Heart",
        badge: "Canlı Sayaç",
        description: "Birlikte geçirdiğiniz her an çok kıymetli! İlk günden bugüne geçen gün, saat ve dakikayı canlı olarak sayar ve ilişkinizin ne kadar büyüdüğünü hatırlatır.",
        tip: "İlişki başlangıç tarihinizi Ayarlar sekmesinden dilediğiniz zaman güncelleyebilirsiniz.",
      },
      {
        id: "love-score",
        title: "Dinamik Aşk Puanı & Metre",
        icon: "Flame",
        badge: "Ortak Puan",
        description: "Uygulamada bıraktığınız aşk notları, paylaştığınız anılar ve günlük duygu bildirimleriniz ortak aşk puanınızı yükseltir. Her iki partner için %100 eşit ve simetriktir.",
        tip: "Her gün birbirinize küçük bir not bırakmak veya modunuzu seçmek aşk puanınızı zirvede tutar!",
      },
      {
        id: "mood-selector",
        title: "Duygu Durumu (Mod) Paylaşımı",
        icon: "Sparkles",
        badge: "Canlı Senkron",
        description: "Günün nasıl geçiyor? Mutlu, romantik, yorgun veya hüzünlü... Modunu tek dokunuşla seç, partnerin anında haberdar olsun ve birbirinize destek olun.",
        tip: "Partnerin yorgun veya üzgün hissettiğinde ona tatlı bir mesaj atmak ilişkinizi güçlendirir.",
      },
      {
        id: "daily-note",
        title: "Günün Aşk Notu & Alıntısı",
        icon: "BookOpen",
        badge: "Her Gün Yeni",
        description: "Her yeni gün ikinize özel romantik bir aşk sözü, bilge bir ilişki tavsiyesi veya ilham verici bir alıntıyla başlar.",
        tip: "Günün notunu okuduktan sonra birbirinize ne hissettirdiğini konuşabilirsiniz.",
      },
      {
        id: "quick-cards",
        title: "Geri Sayımlar ve Mektup Kartları",
        icon: "Clock",
        badge: "Hızlı Erişim",
        description: "Bir sonraki buluşmanıza kalan süreyi ve henüz açılma vakti gelmemiş mühürlü mektupların durumunu ana sayfa kartlarından anlık takip edebilirsiniz.",
      },
    ],
  },

  calendar: {
    pageKey: "calendar",
    title: "Aşk Takvimi",
    tagline: "Zamanın İçindeki İkiniz",
    icon: "CalendarHeart",
    summary: "Birlikte paylaştığınız her özel anı, duyguyu ve planı ay ay saklayan ortak zaman kapsülünüz.",
    features: [
      {
        id: "calendar-view",
        title: "İnteraktif Aylık Takvim",
        icon: "Calendar",
        badge: "Ortak Ajanda",
        description: "Tüm ayları gezebilir, geçmişte veya gelecekteki günleri seçerek o tarihte yaşanan tüm notları, fotoğrafları ve modları inceleyebilirsiniz.",
      },
      {
        id: "colored-dots",
        title: "Renkli Gün Noktaları",
        icon: "Sparkles",
        badge: "Görsel İşaretler",
        description: "Takvimdeki her günün altında renkli noktalar yer alır: Mor (Aşk Notu), Pembe (Partnerinin Modu), Mavi (Senin Modun) ve Yeşil (Anı Fotoğrafı).",
        tip: "Rengarenk bir takvim, birlikte ne kadar çok anı biriktirdiğinizin en güzel kanıtıdır!",
      },
      {
        id: "add-note",
        title: "Güne Not Düşme",
        icon: "StickyNote",
        badge: "Özel Planlar",
        description: "Herhangi bir güne dokunup 'Not Ekle' butonuna basarak o gün için randevu, sinema planı, doktor randevusu veya tatlı bir hatıra notu düşebilirsiniz.",
      },
      {
        id: "daily-summary",
        title: "Günlük Detay Listesi",
        icon: "Clock",
        badge: "Kronolojik Akış",
        description: "Seçtiğiniz güne ait tüm olaylar (kim hangi moddaydı, hangi notlar yazıldı, hangi fotoğraflar çekildi) alt listede kronolojik olarak sıralanır.",
      },
    ],
  },

  letters: {
    pageKey: "letters",
    title: "Mühürlü Mektuplar",
    tagline: "Geleceğe Gönderilen Aşk Sözleri",
    icon: "Mail",
    summary: "Bugünden yazıp gelecekteki özel bir gün için mühürlediğiniz, zamanı gelene kadar açılamayan sürpriz aşk mektupları.",
    features: [
      {
        id: "time-capsule",
        title: "Zaman Kilitli Mektup Yazma",
        icon: "Lock",
        badge: "Sürpriz",
        description: "Partnerine kalbinden geçenleri yaz ve gelecekte açılacağı tarih ve saati belirle! Mektup bulutta şifrelenir ve zamanı gelene kadar içeriği kimse tarafından okunamaz.",
        tip: "Yıl dönümleri, doğum günleri veya zorlu bir sınav/iş günü öncesi için motive edici mektuplar mühürleyebilirsiniz.",
      },
      {
        id: "origami-ceremony",
        title: "Mühür Kırma & Origami Turna Kuşu",
        icon: "Sparkles",
        badge: "Özel Animasyon",
        description: "Mektup gönderildiğinde origami turna kuşu uçuşuyla sevgiline ulaşır. Vakti geldiğinde ise mum mührünü kırarak mektubu okumanın büyülü törenini yaşarsınız.",
      },
      {
        id: "letter-vault",
        title: "Gelen ve Gönderilen Mektuplar",
        icon: "Mail",
        badge: "Sonsuz Arşiv",
        description: "Daha önce açılmış mektuplarınızı dilediğiniz zaman tekrar tekrar okuyabilir, kilitli bekleyen mektupların ise kalan süresini takip edebilirsiniz.",
      },
      {
        id: "tokens",
        title: "Aşk Jetonları",
        icon: "Coins",
        badge: "Mektup Hakkı",
        description: "Mektup göndermek için jetonlarınızı kullanabilir veya Premium üyelikle sınırsız mektup yazmanın özgürlüğünü yaşayabilirsiniz.",
      },
    ],
  },

  photos: {
    pageKey: "photos",
    title: "Ortak Galeri",
    tagline: "En Güzel Kareleriniz",
    icon: "Images",
    summary: "İkinizin birlikte yüklediği, yüksek çözünürlüklü ve güvenli ortak hatıra albümünüz.",
    features: [
      {
        id: "shared-archive",
        title: "Bulut Fotoğraf Arşivi",
        icon: "Images",
        badge: "Özel & Güvenli",
        description: "Telefon belleğinde kaybolmayan, sadece ikinizin erişebildiği ortak anı galerisi. Yüklediğiniz fotoğraflar partnerinizin ekranına anında düşer.",
      },
      {
        id: "exif-location",
        title: "Akıllı EXIF ve Konum Algılama",
        icon: "MapPin",
        badge: "Otomatik Bilgi",
        description: "Fotoğraf yüklediğinizde çekildiği tarih, saat ve GPS konumu otomatik olarak tespit edilir ve haritanızla senkronize edilir.",
        tip: "Eski bir tatil fotoğrafı yüklediğinizde bile orijinal çekim tarihi ve konumu korunur!",
      },
      {
        id: "fullscreen-stories",
        title: "Tam Ekran Anı İnceleme & Hikayeler",
        icon: "Maximize2",
        badge: "Detaylı Görünüm",
        description: "Fotoğrafa dokunarak tam ekran görüntüleyebilir, fotoğrafın altındaki özel açıklamayı, çekildiği şehri ve saati inceleyebilirsiniz.",
      },
    ],
  },

  map: {
    pageKey: "map",
    title: "Aşk Haritası",
    tagline: "Ayak İzleriniz ve Gizli Notlarınız",
    icon: "MapPin",
    summary: "Birlikte keşfettiğiniz şehirler, ilk buluştuğunuz kafeler ve haritaya bıraktığınız gizli aşk notları.",
    features: [
      {
        id: "photo-pins",
        title: "Fotoğraflı Anı Pinleri",
        icon: "Camera",
        badge: "Görsel Pinler",
        description: "Galeriye eklediğiniz konumlu fotoğraflar, çekildikleri koordinatta kalp çerçeveli pinler olarak haritada parıldar.",
      },
      {
        id: "secret-notes",
        title: "Haritaya Aşk Notu Bırakma",
        icon: "StickyNote",
        badge: "Gizli Notlar",
        description: "Haritanın dilediğiniz yerine uzun basarak veya dokunarak sevgilinize özel bir aşk notu bırakın! 'İlk burada sarılmıştık', 'Buranın kahvesi çok güzeldi' gibi.",
        tip: "Bir sonraki buluşacağınız yere önceden sürpriz bir not bırakabilirsiniz!",
      },
      {
        id: "themes-filters",
        title: "Romantik Temalar ve Filtreler",
        icon: "Layers",
        badge: "Kişiselleştirme",
        description: "Haritanızı Romantik Pembe, Gece Yarısı Koyu veya Doğa modunda görüntüleyebilir; sadece fotoğrafları veya sadece notları filtreleyebilirsiniz.",
      },
      {
        id: "fit-bounds",
        title: "Tüm Anıları Tek Bakışta Gör",
        icon: "Maximize2",
        badge: "Odaklanma",
        description: "Sağ üstteki sığdır butonuna basarak dünyanın neresinde anınız varsa haritanın otomatik olarak tüm anılarınızı kapsayacak şekilde uzaklaşmasını sağlayabilirsiniz.",
      },
    ],
  },

  medicine: {
    pageKey: "medicine",
    title: "İlaç & Sağlık Takibi",
    tagline: "Birbirinizin Sağlığına Emanetsiniz",
    icon: "Pill",
    summary: "Günlük vitaminler, düzenli ilaçlar ve sağlık hatırlatıcıları. Birbirinizin sağlığını sevgiyle takip edin.",
    features: [
      {
        id: "dose-reminders",
        title: "Zamanında Alarm ve Hatırlatıcılar",
        icon: "Clock",
        badge: "Hassas Takip",
        description: "İlaç veya vitaminlerinizin saatlerini belirleyin. Saati geldiğinde sesli ve titreşimli yerel bildirimlerle asla doz kaçırmazsınız.",
      },
      {
        id: "partner-care",
        title: "Partner Bildirimi & Takibi",
        icon: "Heart",
        badge: "Sevgiyle Takip",
        description: "Alarm yalnızca ilacın sahibine çalar. Partneriniz ilacını içtiğinde haberdar olursunuz; unutulan dozlar için sevgilinize bildirim gönderilmez, istediğinizde ona kendiniz tatlı bir hatırlatma yapabilirsiniz.",
        tip: "Aşk, birbirinin sağlığına da özen göstermektir!",
      },
      {
        id: "history-logs",
        title: "Geçmiş Doz Kayıtları",
        icon: "CheckCircle",
        badge: "Sağlık Geçmişi",
        description: "Hangi gün ilacın alınıp alınmadığını geriye dönük listeleyerek düzenli kullanım alışkanlığı kazanın.",
      },
    ],
  },

  "period-tracker": {
    pageKey: "period-tracker",
    title: "Döngü & Regl Takibi",
    tagline: "Birlikte Daha Anlayışlı ve Şefkatli",
    icon: "Droplet",
    summary: "Kadın döngü takvimi, regl ve yumurtlama tahminleri. Çiftlerin hassas günlerde birbirini daha iyi anlaması için tasarlandı.",
    features: [
      {
        id: "cycle-prediction",
        title: "Akıllı Döngü ve Faz Tahminleri",
        icon: "Calendar",
        badge: "Bilimsel Hesaplama",
        description: "Döngü uzunluğuna göre bir sonraki regl tarihi, ovülasyon (yumurtlama) dönemi ve doğurganlık günleri otomatik hesaplanır.",
      },
      {
        id: "symptoms-mood",
        title: "Semptom ve Ruh Hali Kaydı",
        icon: "Sparkles",
        badge: "Detaylı Takip",
        description: "Kramp, baş ağrısı, yorgunluk veya duygu durum değişikliklerini gün be gün kaydedebilirsiniz.",
      },
      {
        id: "partner-empathy",
        title: "Partner Empati ve Destek Rehberi",
        icon: "Heart",
        badge: "Erkek Partner İçin",
        description: "Erkek partner, sevgilisinin hangi fazda olduğunu görerek hassas günlerinde ona sıcak bir çikolata, masaj veya ekstra şefkat göstermek için bildirim alır.",
        tip: "Zor günlerde gösterilen küçük bir ilgi tüm dünyayı güzelleştirir.",
      },
    ],
  },

  meetings: {
    pageKey: "meetings",
    title: "Buluşma Planlayıcı",
    tagline: "Kavuşma Anı İçin Geri Sayım",
    icon: "Clock",
    summary: "Bir sonraki randevunuzu heyecanla planlayın, saniyeleri geri sayın ve geçmiş buluşmalarınızı ölümsüzleştirin.",
    features: [
      {
        id: "live-countdown",
        title: "Canlı Buluşma Geri Sayımı",
        icon: "Clock",
        badge: "Heyecanlı Bekleyiş",
        description: "Buluşmanıza kaç gün, kaç saat ve kaç saniye kaldığını canlı olarak gösteren kalp atışlı sayaç.",
      },
      {
        id: "meeting-details",
        title: "Randevu Konumu ve Notları",
        icon: "MapPin",
        badge: "Planlama",
        description: "Buluşacağınız mekanı, saati ve o güne özel hazırlık notlarınızı ortak listeye ekleyin.",
        tip: "Buluşma noktası olarak haritadan özel bir yer seçebilirsiniz.",
      },
      {
        id: "meeting-history",
        title: "Geçmiş Buluşmalar Günlüğü",
        icon: "BookOpen",
        badge: "Hatıra Defteri",
        description: "Gerçekleşen tüm güzel buluşmalarınız hatıra olarak saklanır, böylece ne kadar sık bir araya geldiğinizi görebilirsiniz.",
      },
    ],
  },

  memories: {
    pageKey: "memories",
    title: "Özel Günler & Milatlar",
    tagline: "Aşkınızın Dönüm Noktaları",
    icon: "Sparkles",
    summary: "İlk 'seni seviyorum' dediğiniz an, ilk seyahatiniz, tanışma ve yıl dönümü gibi ilişkinizin altın anları.",
    features: [
      {
        id: "milestone-cards",
        title: "İlişki Kilometre Taşları",
        icon: "Sparkles",
        badge: "Unutulmaz Anlar",
        description: "İlişkinizdeki tüm önemli olayları fotoğraflı ve açıklamalı olarak ekleyin. Her milat için geçen süre otomatik hesaplanır.",
      },
      {
        id: "anniversary-reminders",
        title: "Yıl Dönümü Hatırlatıcıları",
        icon: "Bell",
        badge: "Önceden Bildirim",
        description: "Özel günler yaklaşırken partnerinize sürpriz hazırlayabilmeniz için vaktinde bildirimler alırsınız.",
        tip: "Asla bir yıl dönümünü unutma stresi yaşamayın!",
      },
    ],
  },

  "daily-notes": {
    pageKey: "daily-notes",
    title: "Kişisel Günlük",
    tagline: "Kalbinden Geçen Gizli Cümleler",
    icon: "BookOpen",
    summary: "Sadece senin gözlerinin görebileceği, cihazında ve bulutta uçtan uca şifrelenen özel günlük defterin.",
    features: [
      {
        id: "encrypted-vault",
        title: "Uçtan Uca Şifreli Notlar",
        icon: "ShieldCheck",
        badge: "%100 Gizlilik",
        description: "Bu günlüğe yazdığın hisler ve notlar sadece senin tarafında şifrelenir. Partnerin dahil hiç kimse okuyamaz.",
        tip: "Kendine zaman ayırıp içini dökmek ruhuna çok iyi gelecektir.",
      },
      {
        id: "daily-reflection",
        title: "Günün Muhasebesi ve Duyguları",
        icon: "Heart",
        badge: "Kişisel Gelişim",
        description: "Günün nasıl geçtiğini, hedeflerini ve ilişkine dair kişisel farkındalıklarını güvenle kaydet.",
      },
    ],
  },

  profile: {
    pageKey: "profile",
    title: "Profil & Yapılandırma",
    tagline: "Uygulamayı Kendinize Göre Şekillendirin",
    icon: "Settings",
    summary: "Temanızı, alt menü sekmelerinizi, güvenlik ayarlarınızı ve çift bağlantınızı yönettiğiniz kontrol paneli.",
    features: [
      {
        id: "tabbar-customizer",
        title: "Alt Barı (Sekmeleri) Özelleştirme",
        icon: "Layers",
        badge: "Kişiselleştirme",
        description: "En sık kullandığınız 5 sekmeyi seçin! İlaç, Takvim, Harita, Mektuplar gibi sekmeleri dilediğiniz sırayla alt menünüze yerleştirin.",
        tip: "Menü ekranından kullanmadığınız sekmeleri alt bardan kaldırıp yerlerine yenilerini koyabilirsiniz.",
      },
      {
        id: "theme-options",
        title: "Açık / Koyu & Pastel Renk Temaları",
        icon: "Sparkles",
        badge: "Görsel Uyum",
        description: "Gözü yormayan koyu mod veya romantik açık tema seçenekleriyle uygulamanın görünümünü kişiselleştirin.",
      },
      {
        id: "couple-connection",
        title: "Çift Eşleşmesi ve Hesap Güvenliği",
        icon: "ShieldCheck",
        badge: "Güvenlik",
        description: "Partnerinizin e-postası, ilişki başlangıç tarihiniz, şifre değiştirme ve cihaz yetkilendirme ayarlarınızı bu ekrandan yönetin.",
      },
      {
        id: "reset-tours",
        title: "Tanıtımları ve Rehberleri İnceleme",
        icon: "HelpCircle",
        badge: "Rehber",
        description: "İstediğiniz zaman sayfa tanıtımlarını sıfırlayabilir veya tüm özelliklerin açıklamalarını baştan gözden geçirebilirsiniz.",
      },
    ],
  },
};
