import { dayjs } from "@/lib/date";
import { CoupleProfile } from "@/context/AuthContext";

export const DEMO_USER_ID = "demo-guest-user-id";
export const DEMO_PARTNER_ID = "demo-partner-user-id";
export const DEMO_COUPLE_ID = 999999;

export const DEMO_PROFILE: CoupleProfile = {
  coupleId: DEMO_COUPLE_ID,
  meetDate: dayjs().subtract(730, "day").format("YYYY-MM-DD"), // 2 yıl önce
  relationshipStartDate: dayjs().subtract(520, "day").format("YYYY-MM-DD"), // 520 gün
  isPaired: true,
  hasDates: true,
  displayName: "Misafir (Demo)",
  username: "misafir",
  gender: "male",
  isPremium: true,
  tokenBalance: 350,
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
  currentNote: "Bugün aklıma ilk göz göze geldiğimiz o yağmurlu gün geldi... Akşam yemeğe çıkalım mı birtanem? ✨❤️",
  activeMeeting: {
    id: 101,
    title: "Moda Sahili & Akşam Yemeği 🍷",
    location_name: "Kadıköy Moda",
    meeting_datetime: dayjs().add(2, "day").hour(19).minute(30).second(0).toISOString(),
    latitude: 40.9855,
    longitude: 29.0285,
  },
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
  daysTogether: 520,
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
    created_at: dayjs().subtract(15, "day").toISOString(),
    _type: "sent" as const,
    receiver: {
      id: DEMO_PARTNER_ID,
      username: "sevgilin",
      display_name: "Sevgilin ❤️",
    },
  },
];

export const DEMO_PHOTOS = [
  {
    id: 301,
    image_url: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&auto=format&fit=crop&q=80",
    title: "Kapadokya Balon Turumuz 🎈",
    description: "Sabahın ilk ışıklarında gökyüzüne yükselirken tuttuğumuz o dilek...",
    taken_date: dayjs().subtract(45, "day").format("YYYY-MM-DD"),
    taken_time: "06:45",
    user_id: DEMO_USER_ID,
    city: "Nevşehir",
    latitude: 38.6431,
    longitude: 34.8289,
  },
  {
    id: 302,
    image_url: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=800&auto=format&fit=crop&q=80",
    title: "Kaş Gün Batımı Yürüyüşü 🌅",
    description: "Denizin sesini dinleyip saatlerce konuştuğumuz o harika akşam.",
    taken_date: dayjs().subtract(90, "day").format("YYYY-MM-DD"),
    taken_time: "19:20",
    user_id: DEMO_PARTNER_ID,
    city: "Antalya",
    latitude: 36.1997,
    longitude: 29.6377,
  },
  {
    id: 303,
    image_url: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=800&auto=format&fit=crop&q=80",
    title: "İlk Kahve Buluşmamız ☕",
    description: "Heyecandan ellerimin titrediği ama zamanın nasıl geçtiğini anlamadığımız gün.",
    taken_date: dayjs().subtract(520, "day").format("YYYY-MM-DD"),
    taken_time: "15:30",
    user_id: DEMO_USER_ID,
    city: "İstanbul",
    latitude: 40.9855,
    longitude: 29.0285,
  },
];

export const DEMO_MAP_LOCATIONS = [
  {
    id: 401,
    latitude: 41.0256,
    longitude: 28.9741,
    title: "Galata Kulesi 🏰",
    description: "Birlikte çıktığımız ilk kule, efsaneye göre buraya kiminle çıkarsan onunla evlenirsin...",
    category: "special",
    date: dayjs().subtract(120, "day").format("YYYY-MM-DD"),
  },
  {
    id: 402,
    latitude: 40.9855,
    longitude: 29.0285,
    title: "Moda Sahili 🌊",
    description: "Çimlerde oturup yıldızları izlediğimiz unutulmaz yaz akşamı.",
    category: "date",
    date: dayjs().subtract(30, "day").format("YYYY-MM-DD"),
  },
  {
    id: 403,
    latitude: 41.0822,
    longitude: 29.0433,
    title: "Bebek Parkı Pikniği 🧺",
    description: "Kendi yaptığımız kurabiyelerle Boğaz kenarında piknik.",
    category: "photo",
    date: dayjs().subtract(60, "day").format("YYYY-MM-DD"),
  },
];

export const DEMO_MEETINGS = [
  {
    id: 501,
    title: "Yıldönümü Yemeği 🕯️🍷",
    location_name: "Sunset Grill & Bar, Ulus",
    meeting_datetime: dayjs().add(12, "day").hour(20).minute(0).second(0).toISOString(),
    notes: "Şık giyineceğiz, sürpriz hediyen hazır!",
    is_active: true,
  },
  {
    id: 502,
    title: "Hafta Sonu Kahvaltısı ☕🥞",
    location_name: "Emirgan Korusu",
    meeting_datetime: dayjs().add(2, "day").hour(10).minute(30).second(0).toISOString(),
    notes: "Lale bahçesinde yürüyüş yapacağız.",
    is_active: true,
  },
];

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
    content: "Bugün seninle konuştuğum her an içim huzurla doldu. Yanımda olduğun her güne teşekkür ederim. ❤️",
  },
  {
    id: 702,
    date: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
    content: "Birlikte izlediğimiz o film ne kadar güzeldi... Bir sonraki sinema gecemizi sabırsızlıkla bekliyorum. 🎬",
  },
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
