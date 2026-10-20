import { dayjs } from "@/lib/date";
import { CoupleProfile } from "@/context/AuthContext";
import type { CoupleStarDetails, StarExoplanetRecord } from "@/modules/stars/types/star.types";

export const DEMO_USER_ID = "demo-guest-user-id";
export const DEMO_PARTNER_ID = "demo-partner-user-id";
export const DEMO_COUPLE_ID = 999999;

export const DEMO_PROFILE: CoupleProfile = {
  coupleId: DEMO_COUPLE_ID,
  meetDate: dayjs().subtract(428, "day").format("YYYY-MM-DD"), // 428 gün
  relationshipStartDate: dayjs().subtract(365, "day").format("YYYY-MM-DD"), // 365 gün
  isPaired: true,
  hasDates: true,
  displayName: "Misafir (Demo)",
  username: "misafir",
  // Hedef kitle kadınlar: demo, kadın modunda (pembe tema, kişisel döngü takibi) açılır
  gender: "female",
  isPremium: true,
  tokenBalance: 350,
  encryptionSalt: "demo-salt-123",
};

export const DEMO_SESSION = {
  access_token: "demo_guest_token",
  token_type: "bearer",
  expires_in: 999999,
  refresh_token: "demo_guest_refresh",
  user: {
    id: DEMO_USER_ID,
    app_metadata: {},
    user_metadata: { display_name: "Misafir" },
    aud: "authenticated",
    created_at: new Date().toISOString(),
    email: "demo@couplesapp.local",
  },
} as any;

export const DEMO_HOME_DATA = {
  currentMood: "love",
  partnerMood: "🥰",
  currentNote: "Bugün biraz yoğun geçti ama akşam kahvemi alıp balkonda rüzgarı dinlemek zihnimi çok dinlendirdi. Bazen küçük anların kıymetini bilmek insana huzur veriyor. ☕📖✨",
  meetings: [
    {
      id: 501,
      title: "Polonezköy Doğa Yürüyüşü & Brunch 🌿🥞",
      location_name: "Polonezköy Tabiat Parkı, Beykoz",
      meeting_datetime: dayjs().add(2, "day").hour(10).minute(30).second(0).toISOString(),
      latitude: 41.1147,
      longitude: 29.2085,
    },
  ],
  pendingLetters: [
    {
      id: 201,
      unlock_date: dayjs().add(15, "day").format("YYYY-MM-DD"),
      sender_id: DEMO_PARTNER_ID,
      sender: {
        id: DEMO_PARTNER_ID,
        username: "sevgilin",
        display_name: "Sevgilin ❤️",
      },
    },
  ],
};

export const DEMO_LOVE_SCORE = {
  percentage: 96,
  statusText: "Kusursuz Bir Uyum! 💖",
  daysTogether: 365,
  breakdown: {
    interaction: 98,
    memory: 94,
    sharedJoy: 96,
  },
};

export const DEMO_LETTERS = [
  {
    id: 1,
    couple_id: DEMO_COUPLE_ID,
    sender_id: DEMO_PARTNER_ID,
    receiver_id: DEMO_USER_ID,
    title: "İlk Tanıştığımız Yağmurlu Gün ☕",
    content: "O gün o küçük kafede sipariş verirken gözlerinin parıltısını asla unutamıyorum. Hayatıma girdiğin için her gün şükrediyorum. Birlikte daha nice güzel anılar biriktireceğimize eminim... Seni çok seviyorum!",
    unlock_date: dayjs().subtract(10, "day").format("YYYY-MM-DD"),
    created_at: dayjs().subtract(40, "day").toISOString(),
    _type: "received" as const,
    sender: {
      id: DEMO_PARTNER_ID,
      username: "sevgilin",
      display_name: "Sevgilin ❤️",
    },
  },
  {
    id: 2,
    couple_id: DEMO_COUPLE_ID,
    sender_id: DEMO_PARTNER_ID,
    receiver_id: DEMO_USER_ID,
    title: "🔒 2. Yıldönümümüzde Açılacak Mühürlü Mektup",
    content: "Bu mektup sevdiğin tarafından belirlenen yıldönümü gününüze kadar aşk mührüyle kilitlenmiştir...",
    unlock_date: dayjs().add(60, "day").format("YYYY-MM-DD"),
    created_at: dayjs().subtract(5, "day").toISOString(),
    _type: "received" as const,
    sender: {
      id: DEMO_PARTNER_ID,
      username: "sevgilin",
      display_name: "Sevgilin ❤️",
    },
  },
  {
    id: 3,
    couple_id: DEMO_COUPLE_ID,
    sender_id: DEMO_USER_ID,
    receiver_id: DEMO_PARTNER_ID,
    title: "Seni Neden Bu Kadar Çok Seviyorum? 🕊️",
    content: "Gülüşünle en karanlık günümü bile aydınlattığın için, yanındayken kendimi evimde hissettirdiğin için ve hayallerime ortak olduğun için...",
    unlock_date: dayjs().subtract(2, "day").format("YYYY-MM-DD"),
    _type: "sent" as const,
    receiver: {
      id: DEMO_PARTNER_ID,
      username: "sevgilin",
      display_name: "Sevgilin ❤️",
    },
  },
];

export const DEMO_PHOTOS = [
  // Güncel anılar: Aşk Haritası'nın açılış görünümü (İstanbul) ve takvimin bugünkü sayfası boş kalmasın diye
  // ilk açılışta görünen örnek fotoğraflar. En yeniden eskiye sıralıdır.
  {
    id: 309,
    image_url: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&auto=format&fit=crop&q=80",
    title: "Galata'da Gün Batımı 🌇",
    description: "Simitlerimizi paylaşıp kulenin gölgesinde gün batımını izledik. Bütün şehir sanki sadece bizimdi.",
    taken_date: dayjs().format("YYYY-MM-DD"),
    taken_time: "18:20",
    user_id: DEMO_PARTNER_ID,
    city: "İstanbul · Galata",
    latitude: 41.0256,
    longitude: 28.9744,
  },
  {
    id: 310,
    image_url: "https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=800&auto=format&fit=crop&q=80",
    title: "Moda Sahilinde Bisiklet Turu 🚲💕",
    description: "Elele tutuşup pedal çevirdiğimiz, gökyüzünün pembeye döndüğü o güzel akşam.",
    taken_date: dayjs().format("YYYY-MM-DD"),
    taken_time: "08:15",
    user_id: DEMO_USER_ID,
    city: "İstanbul · Moda",
    latitude: 40.9806,
    longitude: 29.0253,
  },
  {
    id: 311,
    image_url: "https://images.unsplash.com/photo-1527838832700-5059252407fa?w=800&auto=format&fit=crop&q=80",
    title: "Sultanahmet'te Mavi Saat 💜",
    description: "Minarelerin arkasında gökyüzü pembeye boyanırken sana sarıldığım an.",
    taken_date: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
    taken_time: "19:05",
    user_id: DEMO_PARTNER_ID,
    city: "İstanbul · Sultanahmet",
    latitude: 41.0054,
    longitude: 28.9768,
  },
  {
    id: 301,
    image_url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop&q=80",
    title: "Paris'te Gün Batımı 🗼✨",
    description: "Eyfel Kulesi'nin ışıkları ilk kez yandığı o büyüleyici an... Sen ve Sen Nehri'nin serin esintisi.",
    taken_date: dayjs().subtract(180, "day").format("YYYY-MM-DD"),
    taken_time: "19:45",
    user_id: DEMO_USER_ID,
    city: "Paris",
    latitude: 48.8584,
    longitude: 2.2945,
  },
  {
    id: 302,
    image_url: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&auto=format&fit=crop&q=80",
    title: "Aşk Çeşmesi Dileğimiz ⛲🪙",
    description: "Gözlerimizi kapatıp Trevi Çeşmesi'ne bozuk para fırlatırken ikimizin de aynı dileği tuttuğuna emindim.",
    taken_date: dayjs().subtract(210, "day").format("YYYY-MM-DD"),
    taken_time: "16:20",
    user_id: DEMO_PARTNER_ID,
    city: "Roma",
    latitude: 41.9009,
    longitude: 12.4833,
  },
  {
    id: 303,
    image_url: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&auto=format&fit=crop&q=80",
    title: "Kanallar Arası Bisiklet Turu 🚲🌷",
    description: "Sonbahar yaprakları kanallara dökülürken el ele kaybolduğumuz o huzur dolu öğleden sonra.",
    taken_date: dayjs().subtract(320, "day").format("YYYY-MM-DD"),
    taken_time: "14:15",
    user_id: DEMO_USER_ID,
    city: "Amsterdam",
    latitude: 52.3731,
    longitude: 4.8827,
  },
  {
    id: 304,
    image_url: "https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=800&auto=format&fit=crop&q=80",
    title: "Belvedere Bahçeleri Valsı 🎻🏰",
    description: "Saray bahçesinde yankılanan keman ezgileri eşliğinde dans ettiğimiz masalsı gün.",
    taken_date: dayjs().subtract(410, "day").format("YYYY-MM-DD"),
    taken_time: "17:00",
    user_id: DEMO_PARTNER_ID,
    city: "Viyana",
    latitude: 48.1915,
    longitude: 16.3808,
  },
  {
    id: 305,
    image_url: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&auto=format&fit=crop&q=80",
    title: "Kapadokya Balon Turumuz 🎈🌅",
    description: "Sabahın ilk ışıklarında gökyüzüne yükselirken tuttuğumuz o dilek...",
    taken_date: dayjs().subtract(45, "day").format("YYYY-MM-DD"),
    taken_time: "06:30",
    user_id: DEMO_USER_ID,
    city: "Nevşehir",
    latitude: 38.6431,
    longitude: 34.8289,
  },
  {
    id: 306,
    image_url: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=800&auto=format&fit=crop&q=80",
    title: "Kaputaş'ın Turkuaz Büyüsü 🌊🏖️",
    description: "Kanyondan inen o merdivenlerin sonunda karşılaştığımız sonsuz mavilik ve saçlarına vuran rüzgar.",
    taken_date: dayjs().subtract(90, "day").format("YYYY-MM-DD"),
    taken_time: "18:40",
    user_id: DEMO_PARTNER_ID,
    city: "Antalya",
    latitude: 36.2290,
    longitude: 29.4490,
  },
  {
    id: 307,
    image_url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80",
    title: "Sisli Yayla Masalı 🌲⛰️",
    description: "Bulutların üzerinde salıncakta sallanırken içtiğimiz taze demlenmiş dağ çayının tadı hala damağımızda.",
    taken_date: dayjs().subtract(135, "day").format("YYYY-MM-DD"),
    taken_time: "11:20",
    user_id: DEMO_USER_ID,
    city: "Rize",
    latitude: 40.9542,
    longitude: 41.0963,
  },
  {
    id: 308,
    image_url: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&auto=format&fit=crop&q=80",
    title: "Şirince'nin Taş Sokakları 🍇🏡",
    description: "Zeytin ağaçları arasında, begonvillerin gölgesinde el yapımı meyve şerbetlerimizi yudumladığımız gün.",
    taken_date: dayjs().subtract(260, "day").format("YYYY-MM-DD"),
    taken_time: "15:10",
    user_id: DEMO_PARTNER_ID,
    city: "İzmir",
    latitude: 37.9439,
    longitude: 27.3685,
  },
];

export const DEMO_MAP_LOCATIONS = [
  {
    id: 401,
    latitude: 39.7615,
    longitude: 30.5284,
    title: "Odunpazarı Tarihi Evleri 🎨",
    description: "Burada rengarenk tarihi konakları gezdik, el yapımı cam atölyelerini inceledik ve Porsuk çayı kıyısında kahve içtik. Çok huzurlu bir gündü.",
    category: "special",
    date: dayjs().subtract(75, "day").format("YYYY-MM-DD"),
  },
  {
    id: 402,
    latitude: 37.3129,
    longitude: 40.7356,
    title: "Mardin Kalesi Etekleri 🌙",
    description: "Burada Mezopotamya ovasına bakan terasta menengiç kahvesi içtik. Akşam ışıklandırmasıyla taş evler adeta altın gibi parlıyordu, manzarası büyüleyiciydi.",
    category: "travel",
    date: dayjs().subtract(150, "day").format("YYYY-MM-DD"),
  },
  {
    id: 403,
    latitude: 40.1764,
    longitude: 29.1711,
    title: "Cumalıkızık Köyü ☕🥞",
    description: "Burada 700 yıllık dar taş sokakları gezdik, sıcacık bazlama ve reçellerle harika bir köy kahvaltısı yaptık. Zamanda yolculuk gibi hissettirdi.",
    category: "date",
    date: dayjs().subtract(105, "day").format("YYYY-MM-DD"),
  },
  {
    id: 404,
    latitude: 37.0544,
    longitude: 28.3242,
    title: "Azmak Nehri Tekne Turu 🚣🌿",
    description: "Burada nehrin buz gibi berrak sularında süzüldük, sualtı bitkileri ve ördekler eşliğinde doğanın tadını çıkardık. Havası tertemizdi.",
    category: "special",
    date: dayjs().subtract(115, "day").format("YYYY-MM-DD"),
  },
  {
    id: 405,
    latitude: 40.9427,
    longitude: 31.7483,
    title: "Yedigöller Sonbahar Gezisi 🍁⛺",
    description: "Burada sarı ve kırmızı yapraklar arasında göl kenarında uzun bir yürüyüş yaptık. Ormanın sessizliği ve tertemiz dağ havası bize çok iyi geldi.",
    category: "photo",
    date: dayjs().subtract(190, "day").format("YYYY-MM-DD"),
  },
  {
    id: 406,
    latitude: 39.8228,
    longitude: 26.0125,
    title: "Bozcaada Batı Burnu Gün Batımı 🌅🍷",
    description: "Burada rüzgar güllerinin yanında oturup güneşi denizin ardına uğurladık. Gökyüzünün kızıla bürünüşünü saatlerce hayranlıkla izledik.",
    category: "special",
    date: dayjs().subtract(220, "day").format("YYYY-MM-DD"),
  },
  {
    id: 407,
    latitude: 37.5539,
    longitude: 29.6847,
    title: "Salda Gölü Beyaz Kumsalı 💎🏝️",
    description: "Burada turkuaz suyun ve bembeyaz kumların kenarında saatlerce sohbet ettik. Gerçekten fotoğraflardan bile çok daha güzel bir yerdi.",
    category: "travel",
    date: dayjs().subtract(165, "day").format("YYYY-MM-DD"),
  },
  {
    id: 408,
    latitude: 40.6901,
    longitude: 39.6582,
    title: "Sümela Manastırı Ziyaretimiz ⛰️🕊️",
    description: "Burada sarp kayalıklara inşa edilmiş tarihi manastıra çıktık, vadiye bakan sisli manzara nefes kesiciydi.",
    category: "travel",
    date: dayjs().subtract(280, "day").format("YYYY-MM-DD"),
  },
];

export const DEMO_MEETINGS = [
  {
    id: 501,
    title: "Polonezköy Doğa Yürüyüşü & Brunch 🌿🥞",
    location_name: "Polonezköy Tabiat Parkı, Beykoz",
    meeting_datetime: dayjs().add(2, "day").hour(10).minute(30).second(0).toISOString(),
    notes: "Ağaçlar altında sessiz sakin kahvaltı edip yürüyüş yapacağız.",
    is_active: true,
    latitude: 41.1147,
    longitude: 29.2085,
  },
  {
    id: 502,
    title: "Boğaz Manzaralı Akşam Yemeği 🍷🕯️",
    location_name: "Rumeli Kale Kafe & Restaurant, Sarıyer",
    meeting_datetime: dayjs().add(5, "day").hour(19).minute(30).second(0).toISOString(),
    notes: "Boğaz köprüsünün ışıklarını izleyeceğiz, şık giyinmeyi unutma!",
    is_active: true,
    latitude: 41.0848,
    longitude: 29.0573,
  },
  {
    id: 503,
    title: "Büyükada Bisiklet & Dondurma Gezisi 🚲🍦",
    location_name: "Büyükada Saat Meydanı & Aya Yorgi, Adalar",
    meeting_datetime: dayjs().add(9, "day").hour(11).minute(0).second(0).toISOString(),
    notes: "Vapurda martılara simit atacağız, tepeye çıkıp dilek tutacağız.",
    is_active: true,
    latitude: 40.8583,
    longitude: 29.1244,
  },
  {
    id: 504,
    title: "Florya Sahilinde Gün Batımı Yürüyüşü 🌅☕",
    location_name: "Florya Sahil Parkı, Bakırköy",
    meeting_datetime: dayjs().add(13, "day").hour(18).minute(0).second(0).toISOString(),
    notes: "Deniz havası alıp kahvelerimizi yudumlayarak gün batımını izleyeceğiz.",
    is_active: true,
    latitude: 40.9723,
    longitude: 28.7912,
  },
  {
    id: 505,
    title: "Panoramik İstanbul Gece Manzarası 🌆✨",
    location_name: "Büyük Çamlıca Korusu, Üsküdar",
    meeting_datetime: dayjs().add(18, "day").hour(20).minute(0).second(0).toISOString(),
    notes: "Gece ışıklarında İstanbul'u 360 derece izleyeceğimiz sürpriz buluşma.",
    is_active: true,
    latitude: 41.0264,
    longitude: 29.0682,
  },
  // Buluşmaları demo kullanıcısı planlamış gibi gösterilir: kartlarda düzenle / sil butonları görünür
  // (dokununca kayıt daveti açılır).
].map((meeting) => ({ ...meeting, user_id: DEMO_USER_ID }));

export const DEMO_MEDICINES = [
  {
    id: 601,
    name: "C Vitamini & Çinko 🍊",
    dosage: "1 Efervesan Tablet",
    time: "09:00",
    days: "Her Gün",
    notes: "Sabah kahvaltısından hemen sonra bol suyla.",
    taken_today: true,
  },
  {
    id: 602,
    name: "Magnezyum & B6 🌙",
    dosage: "1 Kapsül",
    time: "22:30",
    days: "Her Gün",
    notes: "Gece rahat uyumak için yatmadan önce.",
    taken_today: false,
  },
];

export const DEMO_DAILY_NOTES = [
  {
    id: 701,
    date: dayjs().format("YYYY-MM-DD"),
    content: "Bugün biraz yoğun geçti ama akşam kahvemi alıp balkonda rüzgarı dinlemek zihnimi çok dinlendirdi. Bazen küçük anların kıymetini bilmek insana huzur veriyor. ☕📖✨",
  },
  {
    id: 702,
    date: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
    content: "Sabah erkenden uyanıp yürüyüşe çıktım. Temiz hava almak ve günün planını yapmak bana çok iyi geldi. Hedeflerime odaklandığım verimli bir gündü. 🌿🎯",
  },
  {
    id: 703,
    date: dayjs().subtract(2, "day").format("YYYY-MM-DD"),
    content: "Uzun zamandır ertelediğim o kitaptan birkaç bölüm okudum. Kendime böyle sakin vakitler ayırmayı özlemişim. 📚🕯️",
  },
];

/**
 * Takvimin ORTAK not defteri (calendar_notes): iki partnerin birbirine bıraktığı küçük notlar.
 * Kişiye özel günlük kayıtları (DEMO_DAILY_NOTES) takvimde gösterilmez.
 */
export const DEMO_CALENDAR_NOTES = [
  {
    id: 801,
    date: dayjs().format("YYYY-MM-DD"),
    note: "Sabah kahveni içerken aklıma geldin; gülümsemem hâlâ yüzümde. Akşam Galata'da buluşalım mı?",
    user_id: DEMO_PARTNER_ID,
    created_at: dayjs().hour(8).minute(42).second(0).toISOString(),
  },
  {
    id: 802,
    date: dayjs().format("YYYY-MM-DD"),
    note: "Olur tabii! Seninle geçen her akşam, günün en güzel yeri. Simitleri ben alırım 🥨",
    user_id: DEMO_USER_ID,
    created_at: dayjs().hour(9).minute(5).second(0).toISOString(),
  },
  {
    id: 803,
    date: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
    note: "Bugün yağmur yağdı ama senin şemsiyenin altında hiç ıslanmadım. İyi ki varsın.",
    user_id: DEMO_PARTNER_ID,
    created_at: dayjs().subtract(1, "day").hour(21).minute(18).second(0).toISOString(),
  },
  {
    id: 804,
    date: dayjs().subtract(3, "day").format("YYYY-MM-DD"),
    note: "Bizim şarkımız çaldı yine… Elini tuttuğum o ilk günü hatırladım.",
    user_id: DEMO_USER_ID,
    created_at: dayjs().subtract(3, "day").hour(18).minute(30).second(0).toISOString(),
  },
];

/** Takvimdeki not / fotoğraf / ruh hali imzaları için çift üyeleri. */
export const DEMO_CALENDAR_USERS = [
  { id: DEMO_USER_ID, display_name: "Sen", avatar_url: null },
  { id: DEMO_PARTNER_ID, display_name: "Sevgilin ❤️", avatar_url: null },
];

export const DEMO_PERIOD_DATA = {
  lastPeriodDate: dayjs().subtract(18, "day").format("YYYY-MM-DD"),
  cycleLength: 28,
  periodLength: 5,
  nextPeriodDate: dayjs().add(10, "day").format("YYYY-MM-DD"),
  ovulationDate: dayjs().subtract(4, "day").format("YYYY-MM-DD"),
  fertileWindowStart: dayjs().subtract(8, "day").format("YYYY-MM-DD"),
  fertileWindowEnd: dayjs().subtract(3, "day").format("YYYY-MM-DD"),
  phase: "luteal",
  phaseName: "Luteal Faz (Dinginlik Dönemi)",
  partnerTip: "Partnerin şu sıralar biraz yorgun veya duygusal olabilir. Ona sıcacık bir çikolata veya masajla sürpriz yapabilirsin! 🌸",
};

export const DEMO_STAR_DETAILS: CoupleStarDetails = {
  star_id: "demo-star-sirius",
  couple_id: DEMO_COUPLE_ID,
  catalog_id: 1,
  catalog_code: "HIP-32349",
  custom_name: "Bizim Kutup Yıldızımız ✨",
  ra: 101.2875,
  dec: -16.7161,
  magnitude: -1.46,
  spectral_type: "A1V",
  base_color: "#9DB4FF",
  luminosity_level: 0.95,
  last_spark_at: dayjs().subtract(3, "hour").toISOString(),
  resonance_active: true,
  resonance_until: null,
  created_at: dayjs().subtract(120, "day").toISOString(),
  can_spark_daily: true,
  daily_spark_available_at: dayjs().toISOString(),
  cooldown_remaining_seconds: 0,
  exoplanet_count: 3,
  total_sparks_count: 142,
};

export const DEMO_STAR_EXOPLANETS: StarExoplanetRecord[] = [
  {
    id: "demo-planet-1",
    star_id: "demo-star-sirius",
    title: "İlk Tanışmamız 🌸",
    description: "Yağmurlu bir sonbahar günü Kadıköy'de bir kafede saatlerce sohbet etmiştik.",
    milestone_date: dayjs().subtract(428, "day").format("YYYY-MM-DD"),
    orbit_distance: 1,
    orbit_speed: 1.0,
    planet_type: "terrestrial",
    palette: ["#FF6B8B", "#FF8E53", "#FFA07A"],
    media_urls: ["https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80"],
    custom_metadata: {},
    is_auto_generated: false,
    window_started_at: null,
    created_at: dayjs().subtract(428, "day").toISOString(),
    updated_at: dayjs().subtract(428, "day").toISOString(),
  },
  {
    id: "demo-planet-2",
    star_id: "demo-star-sirius",
    title: "Kapadokya Gezimiz 🎈",
    description: "Sabahın ilk ışıklarında rengarenk sıcak hava balonlarını izlediğimiz o büyüleyici an.",
    milestone_date: dayjs().subtract(240, "day").format("YYYY-MM-DD"),
    orbit_distance: 2,
    orbit_speed: 1.0,
    planet_type: "gas_giant",
    palette: ["#F59E0B", "#EF4444", "#8B5CF6"],
    media_urls: ["https://images.unsplash.com/photo-1570939274717-7eda259b50ed?w=600&auto=format&fit=crop&q=80"],
    custom_metadata: {},
    is_auto_generated: false,
    window_started_at: null,
    created_at: dayjs().subtract(240, "day").toISOString(),
    updated_at: dayjs().subtract(240, "day").toISOString(),
  },
  {
    id: "demo-planet-3",
    star_id: "demo-star-sirius",
    title: "Birlikte İlk Tatilimiz 🌊",
    description: "Bodrum'da gün batımında denizin kokusu ve sonsuz huzur.",
    milestone_date: dayjs().subtract(90, "day").format("YYYY-MM-DD"),
    orbit_distance: 3,
    orbit_speed: 1.0,
    planet_type: "ocean_world",
    palette: ["#00F2FE", "#4FACFE", "#00C6FF"],
    media_urls: ["https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80"],
    custom_metadata: {},
    is_auto_generated: false,
    window_started_at: null,
    created_at: dayjs().subtract(90, "day").toISOString(),
    updated_at: dayjs().subtract(90, "day").toISOString(),
  },
];

