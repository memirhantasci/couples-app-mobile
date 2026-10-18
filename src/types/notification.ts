export type NotificationType = 
  | "letter"            // Mühürlü Aşk Mektubu 💌
  | "medicine"          // İlaç İçildi Kutlaması 💊
  | "medicine_reminder" // İlaç Alma Vakti 💧
  | "photo"             // Yeni Fotoğraf & Anı 📸
  | "map"               // Haritada Aşk Notu 📍
  | "period"            // Regl & Şefkat Desteği 🌸
  | "mood"              // Ruh Hali Paylaşımı ✨
  | "meeting"           // Buluşma / Özel Gün 🗓️
  | "pairing"           // Eşleşme Tamamlandı 💑
  | "general";          // Genel Aşk Bildirimi ❤️

export interface InAppNotificationData {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  senderName?: string;
  avatarUrl?: string;
  timestamp?: string;
  route?: string;
  actionLabel?: string;
  metadata?: {
    medicineName?: string;
    letterId?: number | string;
    photoUrl?: string;
    moodEmoji?: string;
    noteSnippet?: string;
    status?: string;
    [key: string]: any;
  };
}

export interface NotificationThemeConfig {
  type: NotificationType;
  badgeLabel: string;
  badgeIcon: string;
  gradient: readonly [string, string, ...string[]];
  borderGlow: string;
  accentColor: string;
  secondaryColor: string;
  iconBg: string;
  defaultActionLabel: string;
}

export const NOTIFICATION_THEMES: Record<NotificationType, NotificationThemeConfig> = {
  letter: {
    type: "letter",
    badgeLabel: "Mühürlü Mektup",
    badgeIcon: "Mail",
    gradient: ["#4A1224", "#2B0B15", "#18060C"],
    borderGlow: "rgba(255, 180, 80, 0.45)",
    accentColor: "#F5C563", // Altın varak ışıltısı
    secondaryColor: "#FF5C77",
    iconBg: "rgba(245, 197, 99, 0.15)",
    defaultActionLabel: "Mektuplara Git 💌",
  },
  medicine: {
    type: "medicine",
    badgeLabel: "İlacını İçti!",
    badgeIcon: "Pill",
    gradient: ["#0B3A2C", "#08251C", "#04140F"],
    borderGlow: "rgba(52, 211, 153, 0.5)",
    accentColor: "#34D399", // Canlı zümrüt nane
    secondaryColor: "#6EE7B7",
    iconBg: "rgba(52, 211, 153, 0.18)",
    defaultActionLabel: "İlaç Takibine Git 💊",
  },
  medicine_reminder: {
    type: "medicine_reminder",
    badgeLabel: "İlaç Vakti Geldi",
    badgeIcon: "Clock",
    gradient: ["#0C2E4E", "#081E33", "#040F1A"],
    borderGlow: "rgba(56, 189, 248, 0.45)",
    accentColor: "#38BDF8", // Taze gök mavisi
    secondaryColor: "#7DD3FC",
    iconBg: "rgba(56, 189, 248, 0.16)",
    defaultActionLabel: "İlaç Takibine Git 💊",
  },
  photo: {
    type: "photo",
    badgeLabel: "Yeni Bir Anı",
    badgeIcon: "Camera",
    gradient: ["#421A3B", "#270F23", "#140712"],
    borderGlow: "rgba(244, 114, 182, 0.45)",
    accentColor: "#F472B6", // Romantik pembe
    secondaryColor: "#FBCFE8",
    iconBg: "rgba(244, 114, 182, 0.16)",
    defaultActionLabel: "Anılara Git 📸",
  },
  map: {
    type: "map",
    badgeLabel: "Haritada Aşk Notu",
    badgeIcon: "MapPin",
    gradient: ["#31184E", "#1D0E2F", "#0F0719"],
    borderGlow: "rgba(167, 139, 250, 0.45)",
    accentColor: "#A78BFA", // Büyüleyici lavanta/mor
    secondaryColor: "#C4B5FD",
    iconBg: "rgba(167, 139, 250, 0.16)",
    defaultActionLabel: "Haritaya Git 🗺️",
  },
  period: {
    type: "period",
    badgeLabel: "Şefkat & Özen Zamanı",
    badgeIcon: "Flower",
    gradient: ["#3D1225", "#240A16", "#14050C"],
    borderGlow: "rgba(251, 113, 133, 0.45)",
    accentColor: "#FB7185", // Çiçeksi pembe
    secondaryColor: "#FDA4AF",
    iconBg: "rgba(251, 113, 133, 0.16)",
    defaultActionLabel: "Döngü Takibine Git 🌸",
  },
  mood: {
    type: "mood",
    badgeLabel: "Ruh Hali Güncellemesi",
    badgeIcon: "Smile",
    gradient: ["#3D2410", "#24150A", "#140B05"],
    borderGlow: "rgba(251, 191, 36, 0.45)",
    accentColor: "#FBBF24", // Sıcak güneş kehribarı
    secondaryColor: "#FDE68A",
    iconBg: "rgba(251, 191, 36, 0.16)",
    defaultActionLabel: "Ana Sayfaya Git ✨",
  },
  meeting: {
    type: "meeting",
    badgeLabel: "Buluşma Planı",
    badgeIcon: "Calendar",
    gradient: ["#2B1B4A", "#1A102E", "#0D0817"],
    borderGlow: "rgba(192, 132, 252, 0.45)",
    accentColor: "#C084FC",
    secondaryColor: "#E9D5FF",
    iconBg: "rgba(192, 132, 252, 0.16)",
    defaultActionLabel: "Buluşmalara Git 🗓️",
  },
  pairing: {
    type: "pairing",
    badgeLabel: "Eşleşme Tamamlandı",
    badgeIcon: "Sparkles",
    gradient: ["#4A1530", "#2B0B1D", "#16050E"],
    borderGlow: "rgba(255, 138, 168, 0.5)",
    accentColor: "#FF8AA8",
    secondaryColor: "#FFC2D1",
    iconBg: "rgba(255, 138, 168, 0.16)",
    defaultActionLabel: "Birlikte Başlayalım ✨",
  },
  general: {
    type: "general",
    badgeLabel: "Çift Bildirimi",
    badgeIcon: "Heart",
    gradient: ["#3D0C1A", "#260610", "#140308"],
    borderGlow: "rgba(255, 92, 119, 0.45)",
    accentColor: "#FF5C77",
    secondaryColor: "#FFA3B2",
    iconBg: "rgba(255, 92, 119, 0.16)",
    defaultActionLabel: "Görüntüle ❤️",
  },
};
