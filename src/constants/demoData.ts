import { Image } from "expo-image";
import { dayjs } from "@/lib/date";
import { CoupleProfile } from "@/context/AuthContext";
import type { CoupleStarDetails, StarExoplanetRecord } from "@/modules/stars/types/star.types";
import i18n from "@/lib/i18n";

export const DEMO_USER_ID = "demo-guest-user-id";
export const DEMO_PARTNER_ID = "demo-partner-user-id";
export const DEMO_COUPLE_ID = 999999;

function createLocalizedProxy<T extends object>(trObj: T, enObj: T): T {
  return new Proxy(trObj, {
    get(target, prop, receiver) {
      const active = (i18n?.language === "en") ? enObj : trObj;
      const val = Reflect.get(active, prop, receiver);
      if (typeof val === "function") {
        return (val as (...args: unknown[]) => unknown).bind(active);
      }
      return val;
    },
    ownKeys() {
      const active = (i18n?.language === "en") ? enObj : trObj;
      return Reflect.ownKeys(active);
    },
    getOwnPropertyDescriptor(target, prop) {
      const active = (i18n?.language === "en") ? enObj : trObj;
      return Reflect.getOwnPropertyDescriptor(active, prop);
    },
    has(target, prop) {
      const active = (i18n?.language === "en") ? enObj : trObj;
      return Reflect.has(active, prop);
    },
  });
}

// ─── PROFILE ────────────────────────────────────────────────────────────────
const DEMO_PROFILE_TR: CoupleProfile = {
  coupleId: DEMO_COUPLE_ID,
  meetDate: dayjs().subtract(428, "day").format("YYYY-MM-DD"), // 428 gün
  relationshipStartDate: dayjs().subtract(365, "day").format("YYYY-MM-DD"), // 365 gün
  isPaired: true,
  hasDates: true,
  displayName: "Misafir (Demo)",
  username: "misafir",
  gender: "female",
  isPremium: true,
  tokenBalance: 350,
};

const DEMO_PROFILE_EN: CoupleProfile = {
  ...DEMO_PROFILE_TR,
  displayName: "Guest (Demo)",
  username: "guest",
};

export const DEMO_PROFILE: CoupleProfile = createLocalizedProxy(DEMO_PROFILE_TR, DEMO_PROFILE_EN);

// ─── SESSION ────────────────────────────────────────────────────────────────
const DEMO_SESSION_TR = {
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

const DEMO_SESSION_EN = {
  ...DEMO_SESSION_TR,
  user: {
    ...DEMO_SESSION_TR.user,
    user_metadata: { display_name: "Guest" },
  },
} as any;

export const DEMO_SESSION = createLocalizedProxy(DEMO_SESSION_TR, DEMO_SESSION_EN);

// ─── HOME DATA ──────────────────────────────────────────────────────────────
const DEMO_HOME_DATA_TR = {
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

const DEMO_HOME_DATA_EN = {
  currentMood: "love",
  partnerMood: "🥰",
  currentNote: "Today was a bit busy, but grabbing my coffee and listening to the breeze on the balcony truly rested my mind. Sometimes cherishing small moments brings deep peace. ☕📖✨",
  meetings: [
    {
      id: 501,
      title: "Nature Trail Walk & Sunday Brunch 🌿🥞",
      location_name: "Polonezköy Nature Park",
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
        username: "sweetheart",
        display_name: "Your Sweetheart ❤️",
      },
    },
  ],
};

export const DEMO_HOME_DATA = createLocalizedProxy(DEMO_HOME_DATA_TR, DEMO_HOME_DATA_EN);

// ─── LOVE SCORE ─────────────────────────────────────────────────────────────
const DEMO_LOVE_SCORE_TR = {
  percentage: 96,
  statusText: "Kusursuz Bir Uyum! 💖",
  daysTogether: 365,
  breakdown: {
    interaction: 98,
    memory: 94,
    sharedJoy: 96,
  },
};

const DEMO_LOVE_SCORE_EN = {
  percentage: 96,
  statusText: "A Flawless Connection! 💖",
  daysTogether: 365,
  breakdown: {
    interaction: 98,
    memory: 94,
    sharedJoy: 96,
  },
};

export const DEMO_LOVE_SCORE = createLocalizedProxy(DEMO_LOVE_SCORE_TR, DEMO_LOVE_SCORE_EN);

// ─── LETTERS ────────────────────────────────────────────────────────────────
const DEMO_LETTERS_TR = [
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

const DEMO_LETTERS_EN = [
  {
    id: 1,
    couple_id: DEMO_COUPLE_ID,
    sender_id: DEMO_PARTNER_ID,
    receiver_id: DEMO_USER_ID,
    title: "The Rainy Day We First Met ☕",
    content: "I will never forget the spark in your eyes while ordering at that little café. I am grateful every single day that you walked into my life. I know we will make countless more wonderful memories together... I love you so much!",
    unlock_date: dayjs().subtract(10, "day").format("YYYY-MM-DD"),
    created_at: dayjs().subtract(40, "day").toISOString(),
    _type: "received" as const,
    sender: {
      id: DEMO_PARTNER_ID,
      username: "sweetheart",
      display_name: "Your Sweetheart ❤️",
    },
  },
  {
    id: 2,
    couple_id: DEMO_COUPLE_ID,
    sender_id: DEMO_PARTNER_ID,
    receiver_id: DEMO_USER_ID,
    title: "🔒 Sealed Letter to Open on Our 2nd Anniversary",
    content: "This letter has been sealed with a romantic wax seal by your love until your chosen anniversary day...",
    unlock_date: dayjs().add(60, "day").format("YYYY-MM-DD"),
    created_at: dayjs().subtract(5, "day").toISOString(),
    _type: "received" as const,
    sender: {
      id: DEMO_PARTNER_ID,
      username: "sweetheart",
      display_name: "Your Sweetheart ❤️",
    },
  },
  {
    id: 3,
    couple_id: DEMO_COUPLE_ID,
    sender_id: DEMO_USER_ID,
    receiver_id: DEMO_PARTNER_ID,
    title: "Why Do I Love You So Much? 🕊️",
    content: "Because your smile brightens even my darkest day, because I feel at home whenever I'm in your arms, and because you believe in every dream of mine...",
    unlock_date: dayjs().subtract(2, "day").format("YYYY-MM-DD"),
    _type: "sent" as const,
    receiver: {
      id: DEMO_PARTNER_ID,
      username: "sweetheart",
      display_name: "Your Sweetheart ❤️",
    },
  },
];

export const DEMO_LETTERS = createLocalizedProxy(DEMO_LETTERS_TR, DEMO_LETTERS_EN);

// ─── PHOTOS ─────────────────────────────────────────────────────────────────
const DEMO_PHOTOS_TR = [
  {
    id: 309,
    storage_path: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&auto=format&fit=crop&q=80",
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
    storage_path: "https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=800&auto=format&fit=crop&q=80",
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
    storage_path: "https://images.unsplash.com/photo-1527838832700-5059252407fa?w=800&auto=format&fit=crop&q=80",
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
    storage_path: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop&q=80",
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
    storage_path: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&auto=format&fit=crop&q=80",
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
    storage_path: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&auto=format&fit=crop&q=80",
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
    storage_path: "https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=800&auto=format&fit=crop&q=80",
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
    storage_path: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&auto=format&fit=crop&q=80",
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
    storage_path: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=800&auto=format&fit=crop&q=80",
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
    storage_path: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80",
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
    storage_path: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&auto=format&fit=crop&q=80",
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

const DEMO_PHOTOS_EN = [
  {
    ...DEMO_PHOTOS_TR[0],
    title: "Sunset at Galata Tower 🌇",
    description: "Sharing warm bagels and watching the sunset under the tower's shadow. The whole city felt like ours alone.",
  },
  {
    ...DEMO_PHOTOS_TR[1],
    title: "Bike Ride on Moda Coast 🚲💕",
    description: "Holding hands as we pedaled, that sweet evening when the sunset turned the sky soft pink.",
  },
  {
    ...DEMO_PHOTOS_TR[2],
    title: "Blue Hour in the Old City 💜",
    description: "Holding you tight while the evening glow washed over the historic skyline.",
  },
  {
    ...DEMO_PHOTOS_TR[3],
    title: "Parisian Sunset 🗼✨",
    description: "The magical moment the Eiffel Tower lit up for the first time... You, me, and the cool breeze along the Seine.",
  },
  {
    ...DEMO_PHOTOS_TR[4],
    title: "Our Trevi Fountain Wish ⛲🪙",
    description: "Closing our eyes and tossing coins into the Trevi Fountain, knowing we both made the exact same wish.",
  },
  {
    ...DEMO_PHOTOS_TR[5],
    title: "Canal Cycling Tour 🚲🌷",
    description: "Getting lost hand-in-hand on that serene afternoon as golden autumn leaves drifted along the canals.",
  },
  {
    ...DEMO_PHOTOS_TR[6],
    title: "Belvedere Gardens Waltz 🎻🏰",
    description: "A fairy-tale afternoon dancing together to violin melodies echoing through the palace gardens.",
  },
  {
    ...DEMO_PHOTOS_TR[7],
    title: "Our Cappadocia Balloon Flight 🎈🌅",
    description: "The wish we whispered as we floated up into the sky with the very first rays of dawn...",
  },
  {
    ...DEMO_PHOTOS_TR[8],
    title: "Turquoise Magic of Kaputaş 🌊🏖️",
    description: "Descending the canyon steps to discover that endless blue sea and the wind dancing in your hair.",
  },
  {
    ...DEMO_PHOTOS_TR[9],
    title: "Misty Mountain Highlands 🌲⛰️",
    description: "Swinging gently above the clouds with fresh brewed tea and crisp alpine air.",
  },
  {
    ...DEMO_PHOTOS_TR[10],
    title: "Cobblestone Streets of Şirince 🍇🏡",
    description: "Sipping handmade fruit juices among olive groves and under the shade of blooming bougainvillea.",
  },
];

export const DEMO_PHOTOS = createLocalizedProxy(DEMO_PHOTOS_TR, DEMO_PHOTOS_EN);

// ─── MAP LOCATIONS ──────────────────────────────────────────────────────────
const DEMO_MAP_LOCATIONS_TR = [
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

const DEMO_MAP_LOCATIONS_EN = [
  {
    ...DEMO_MAP_LOCATIONS_TR[0],
    title: "Historic Houses of Odunpazarı 🎨",
    description: "We wandered through colorful historical mansions, visited handmade glass studios, and sipped Turkish coffee by the river. A deeply peaceful day.",
  },
  {
    ...DEMO_MAP_LOCATIONS_TR[1],
    title: "Mardin Castle Terraces 🌙",
    description: "Overlooking the vast Mesopotamian plains from a rooftop terrace. As evening fell, the stone homes glowed like gold under the warm lanterns.",
  },
  {
    ...DEMO_MAP_LOCATIONS_TR[2],
    title: "Cumalıkızık Village Breakfast ☕🥞",
    description: "Exploring narrow 700-year-old cobblestone alleyways and enjoying a rich country breakfast with fresh baked bread and homemade jams.",
  },
  {
    ...DEMO_MAP_LOCATIONS_TR[3],
    title: "Azmak River Boat Cruise 🚣🌿",
    description: "Gliding through crystal-clear cold spring waters, admiring underwater flora and swimming ducks under the clear afternoon sky.",
  },
  {
    ...DEMO_MAP_LOCATIONS_TR[4],
    title: "Autumn Trek at Seven Lakes 🍁⛺",
    description: "A long, quiet walk around the lakes surrounded by fiery red and golden foliage. The forest silence was a breath of fresh air.",
  },
  {
    ...DEMO_MAP_LOCATIONS_TR[5],
    title: "Cape Sunset & Windmills 🌅🍷",
    description: "Sitting side-by-side near the windmills watching the sun sink into the Aegean horizon. The sky turned into deep purple and crimson.",
  },
  {
    ...DEMO_MAP_LOCATIONS_TR[6],
    title: "Salda Lake White Sands 💎🏝️",
    description: "Hours of heartfelt conversations on powder-white sands beside turquoise waters. Even more breathtaking than the pictures.",
  },
  {
    ...DEMO_MAP_LOCATIONS_TR[7],
    title: "Sümela Cliffside Monastery ⛰️🕊️",
    description: "Ascending to the ancient monastery perched high on the cliff walls; the misty valley below looked straight out of a legend.",
  },
];

export const DEMO_MAP_LOCATIONS = createLocalizedProxy(DEMO_MAP_LOCATIONS_TR, DEMO_MAP_LOCATIONS_EN);

// ─── MEETINGS ───────────────────────────────────────────────────────────────
const DEMO_MEETINGS_TR = [
  {
    id: 501,
    title: "Polonezköy Doğa Yürüyüşü & Brunch 🌿🥞",
    location_name: "Polonezköy Tabiat Parkı, Beykoz",
    meeting_datetime: dayjs().add(2, "day").hour(10).minute(30).second(0).toISOString(),
    notes: "Ağaçlar altında sessiz sakin kahvaltı edip yürüyüş yapacağız.",
    is_active: true,
    latitude: 41.1147,
    longitude: 29.2085,
    user_id: DEMO_USER_ID,
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
    user_id: DEMO_USER_ID,
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
    user_id: DEMO_USER_ID,
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
    user_id: DEMO_USER_ID,
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
    user_id: DEMO_USER_ID,
  },
];

const DEMO_MEETINGS_EN = [
  {
    ...DEMO_MEETINGS_TR[0],
    title: "Nature Trail Walk & Sunday Brunch 🌿🥞",
    location_name: "Polonezköy Nature Park",
    notes: "Quiet breakfast under the forest canopies followed by a scenic walk.",
  },
  {
    ...DEMO_MEETINGS_TR[1],
    title: "Candlelit Waterfront Dinner 🍷🕯️",
    location_name: "Rumeli Castle Terrace Restaurant",
    notes: "Watching the bridge lights reflect on the water; dress up nicely!",
  },
  {
    ...DEMO_MEETINGS_TR[2],
    title: "Island Bicycle & Ice Cream Outing 🚲🍦",
    location_name: "Princes' Islands Clock Tower Square",
    notes: "Ferry ride feeding seagulls, then hiking up to the hill to make a wish.",
  },
  {
    ...DEMO_MEETINGS_TR[3],
    title: "Coastline Sunset Stroll 🌅☕",
    location_name: "Florya Seaside Promenade",
    notes: "Enjoying the fresh sea breeze with warm coffees as the sun sets.",
  },
  {
    ...DEMO_MEETINGS_TR[4],
    title: "Panoramic Skyline Night View 🌆✨",
    location_name: "Çamlıca Hill Panoramic Grove",
    notes: "Surprise date looking down at the glittering city lights from the highest hill.",
  },
];

export const DEMO_MEETINGS = createLocalizedProxy(DEMO_MEETINGS_TR, DEMO_MEETINGS_EN);

// ─── MEDICINES ──────────────────────────────────────────────────────────────
const DEMO_MEDICINES_TR = [
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

const DEMO_MEDICINES_EN = [
  {
    id: 601,
    name: "Vitamin C & Zinc 🍊",
    dosage: "1 Effervescent Tablet",
    time: "09:00",
    days: "Daily",
    notes: "With plenty of water right after breakfast.",
    taken_today: true,
  },
  {
    id: 602,
    name: "Magnesium & B6 🌙",
    dosage: "1 Capsule",
    time: "22:30",
    days: "Daily",
    notes: "Right before bed for restful sleep.",
    taken_today: false,
  },
];

export const DEMO_MEDICINES = createLocalizedProxy(DEMO_MEDICINES_TR, DEMO_MEDICINES_EN);

// ─── DAILY NOTES ────────────────────────────────────────────────────────────
const DEMO_DAILY_NOTES_TR = [
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

const DEMO_DAILY_NOTES_EN = [
  {
    id: 701,
    date: dayjs().format("YYYY-MM-DD"),
    content: "Today was quite busy, but stepping onto the balcony with an evening coffee and listening to the night breeze completely soothed my mind. Gratitude for little moments brings genuine peace. ☕📖✨",
  },
  {
    id: 702,
    date: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
    content: "Woke up early for a brisk morning walk. The crisp air and organizing my daily plans felt invigorating. A very productive, centered day. 🌿🎯",
  },
  {
    id: 703,
    date: dayjs().subtract(2, "day").format("YYYY-MM-DD"),
    content: "Finally read a few chapters from the book I've kept putting off. I had truly missed carving out quiet, undisturbed moments just for myself. 📚🕯️",
  },
];

export const DEMO_DAILY_NOTES = createLocalizedProxy(DEMO_DAILY_NOTES_TR, DEMO_DAILY_NOTES_EN);

// ─── CALENDAR NOTES ─────────────────────────────────────────────────────────
const DEMO_CALENDAR_NOTES_TR = [
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

const DEMO_CALENDAR_NOTES_EN = [
  {
    id: 801,
    date: dayjs().format("YYYY-MM-DD"),
    note: "You popped into my head while having my morning coffee; I'm still smiling. Want to meet up at Galata tonight?",
    user_id: DEMO_PARTNER_ID,
    created_at: dayjs().hour(8).minute(42).second(0).toISOString(),
  },
  {
    id: 802,
    date: dayjs().format("YYYY-MM-DD"),
    note: "Of course! Every evening with you is the sweetest part of my day. I'll bring the treats 🥨",
    user_id: DEMO_USER_ID,
    created_at: dayjs().hour(9).minute(5).second(0).toISOString(),
  },
  {
    id: 803,
    date: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
    note: "It poured today, but under your umbrella I never felt a single drop. So grateful for you.",
    user_id: DEMO_PARTNER_ID,
    created_at: dayjs().subtract(1, "day").hour(21).minute(18).second(0).toISOString(),
  },
  {
    id: 804,
    date: dayjs().subtract(3, "day").format("YYYY-MM-DD"),
    note: "Our special song came on again... Instantly took me back to the very first time I held your hand.",
    user_id: DEMO_USER_ID,
    created_at: dayjs().subtract(3, "day").hour(18).minute(30).second(0).toISOString(),
  },
];

export const DEMO_CALENDAR_NOTES = createLocalizedProxy(DEMO_CALENDAR_NOTES_TR, DEMO_CALENDAR_NOTES_EN);

// ─── CALENDAR USERS ─────────────────────────────────────────────────────────
const DEMO_CALENDAR_USERS_TR = [
  { id: DEMO_USER_ID, display_name: "Sen", avatar_url: null },
  { id: DEMO_PARTNER_ID, display_name: "Sevgilin ❤️", avatar_url: null },
];

const DEMO_CALENDAR_USERS_EN = [
  { id: DEMO_USER_ID, display_name: "You", avatar_url: null },
  { id: DEMO_PARTNER_ID, display_name: "Your Sweetheart ❤️", avatar_url: null },
];

export const DEMO_CALENDAR_USERS = createLocalizedProxy(DEMO_CALENDAR_USERS_TR, DEMO_CALENDAR_USERS_EN);

// ─── PERIOD DATA ────────────────────────────────────────────────────────────
const DEMO_PERIOD_DATA_TR = {
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

const DEMO_PERIOD_DATA_EN = {
  ...DEMO_PERIOD_DATA_TR,
  phaseName: "Luteal Phase (Calm & Reflective)",
  partnerTip: "Your partner might be feeling a bit tired or tender right now. Surprise them with warm hot chocolate or a soothing massage! 🌸",
};

export const DEMO_PERIOD_DATA = createLocalizedProxy(DEMO_PERIOD_DATA_TR, DEMO_PERIOD_DATA_EN);

// ─── STAR DETAILS ───────────────────────────────────────────────────────────
const DEMO_STAR_DETAILS_TR: CoupleStarDetails = {
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

const DEMO_STAR_DETAILS_EN: CoupleStarDetails = {
  ...DEMO_STAR_DETAILS_TR,
  custom_name: "Our North Star ✨",
};

export const DEMO_STAR_DETAILS: CoupleStarDetails = createLocalizedProxy(DEMO_STAR_DETAILS_TR, DEMO_STAR_DETAILS_EN);

// ─── STAR EXOPLANETS ────────────────────────────────────────────────────────
const DEMO_STAR_EXOPLANETS_TR: StarExoplanetRecord[] = [
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

const DEMO_STAR_EXOPLANETS_EN: StarExoplanetRecord[] = [
  {
    ...DEMO_STAR_EXOPLANETS_TR[0],
    title: "The Day We Met 🌸",
    description: "Talking for hours in a cozy café on a rainy autumn afternoon.",
  },
  {
    ...DEMO_STAR_EXOPLANETS_TR[1],
    title: "Our Cappadocia Trip 🎈",
    description: "That breathtaking morning watching colorful hot air balloons rise with the dawn.",
  },
  {
    ...DEMO_STAR_EXOPLANETS_TR[2],
    title: "Our First Vacation Together 🌊",
    description: "Watching the sunset over the sparkling bay, surrounded by pure serenity.",
  },
];

export const DEMO_STAR_EXOPLANETS: StarExoplanetRecord[] = createLocalizedProxy(DEMO_STAR_EXOPLANETS_TR, DEMO_STAR_EXOPLANETS_EN);

/**
 * Demo görselleri Unsplash'tan çekilir (Unsplash hotlink'i şart koşar). Demoya girerken hepsi diske indirilir
 * (expo-image önbelleği); ilk açılıştan sonra demo çevrimdışı da görselleriyle çalışır.
 */
export function prefetchDemoImages(): void {
  const urls = new Set<string>(
    JSON.stringify([DEMO_PHOTOS_TR, DEMO_STAR_EXOPLANETS_TR]).match(/https:\/\/images\.unsplash\.com\/[^"]+/g) ?? []
  );
  Image.prefetch([...urls], "disk").catch(() => {});
}
