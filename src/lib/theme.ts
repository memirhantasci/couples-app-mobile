// ─── Tema Sistemi (Canlı ve Çoklu Varyant) ──────────────────────────────────
// Kadın ve Erkek için 3'er mod:
// Kadın: Şuanki Gül & Bordo (Varsayılan), Gece Koyu Mod, Açık Pudra Mod
// Erkek: Şuanki Mavi Mod (Varsayılan), Gece Koyu Mod, Beyaz Mod

export type ThemeMode = "current" | "dark" | "light";

export interface AppTheme {
  id: ThemeMode;
  name: string;
  gender: "female" | "male";
  isLight: boolean;
  bgGradient: readonly [string, string, ...string[]];
  cardBg: string;
  cardBorder: string;
  unitBg: string;
  accent: string;
  accentLight: string;
  pillAccentBorder: string;
  pillAccentBg: string;
  inputBg: string;
  inputBorder: string;
  headerBg: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  tabBarBg: string;
  tabBarBorder: string;
  blurTint: "light" | "dark";
  description: string;
  previewColors: [string, string, string];
}

// ─── Ortak Renk Sabitleri ───────────────────────────────────────────────────
export const TEXT_WHITE = "#ffffff";
export const TEXT_MUTED = "rgba(255,255,255,0.45)";
export const TEXT_DIM = "rgba(255,255,255,0.25)";
export const BORDER_SOFT = "rgba(255,255,255,0.07)";

// ─── KADIN TEMALARI ─────────────────────────────────────────────────────────

// 1. Kadın: Şuanki Arayüz (Gül & Bordo)
export const FEMALE_CURRENT: AppTheme = {
  id: "current",
  name: "Gül & Bordo",
  gender: "female",
  isLight: false,
  bgGradient: ["#2E0F1C", "#17070E", "#2E0F1C"] as const,
  cardBg: "#4A152B",
  cardBorder: "rgba(255, 255, 255, 0.06)",
  unitBg: "#330D1D",
  accent: "#FF5C77",
  accentLight: "#FF80AB",
  pillAccentBorder: "rgba(255, 92, 119, 0.3)",
  pillAccentBg: "rgba(255, 92, 119, 0.12)",
  inputBg: "#1C1C1E",
  inputBorder: "rgba(255, 255, 255, 0.08)",
  headerBg: "transparent",
  text: "#FFFFFF",
  textSecondary: "rgba(255, 255, 255, 0.72)",
  textMuted: "rgba(255, 255, 255, 0.45)",
  tabBarBg: "rgba(23, 7, 14, 0.82)",
  tabBarBorder: "rgba(255, 255, 255, 0.12)",
  blurTint: "dark",
  description: "Romantik bordo ve gül tonları (Varsayılan)",
  previewColors: ["#2E0F1C", "#4A152B", "#FF5C77"],
};

// 2. Kadın: Gece Modu (Derin Siyah & Pembe Işıltı)
export const FEMALE_DARK: AppTheme = {
  id: "dark",
  name: "Gece Modu",
  gender: "female",
  isLight: false,
  bgGradient: ["#0E0A10", "#070508", "#0E0A10"] as const,
  cardBg: "#19121E",
  cardBorder: "rgba(255, 255, 255, 0.07)",
  unitBg: "#120B16",
  accent: "#FF4D6D",
  accentLight: "#FF758F",
  pillAccentBorder: "rgba(255, 77, 109, 0.35)",
  pillAccentBg: "rgba(255, 77, 109, 0.14)",
  inputBg: "#120B16",
  inputBorder: "rgba(255, 255, 255, 0.08)",
  headerBg: "transparent",
  text: "#FFFFFF",
  textSecondary: "rgba(255, 255, 255, 0.72)",
  textMuted: "rgba(255, 255, 255, 0.45)",
  tabBarBg: "rgba(7, 5, 8, 0.88)",
  tabBarBorder: "rgba(255, 255, 255, 0.1)",
  blurTint: "dark",
  description: "Zarif, göz yormayan derin gece siyahı",
  previewColors: ["#070508", "#19121E", "#FF4D6D"],
};

// 3. Kadın: Açık Mod (İpeksi Pudra & Saf Beyaz)
export const FEMALE_LIGHT: AppTheme = {
  id: "light",
  name: "Açık Mod",
  gender: "female",
  isLight: true,
  bgGradient: ["#FFF5F8", "#FDE8EF", "#FFF8FA"] as const,
  cardBg: "#FFFFFF",
  cardBorder: "rgba(225, 29, 72, 0.12)",
  unitBg: "#FFF1F5",
  accent: "#E11D48",
  accentLight: "#FB7185",
  pillAccentBorder: "rgba(225, 29, 72, 0.25)",
  pillAccentBg: "rgba(225, 29, 72, 0.08)",
  inputBg: "#FDF2F5",
  inputBorder: "rgba(225, 29, 72, 0.15)",
  headerBg: "transparent",
  text: "#1E1B24",
  textSecondary: "#5E5366",
  textMuted: "#8E8296",
  tabBarBg: "rgba(255, 255, 255, 0.92)",
  tabBarBorder: "rgba(225, 29, 72, 0.15)",
  blurTint: "light",
  description: "Aydınlık, ferah ve canlı pembe tonlar",
  previewColors: ["#FFF5F8", "#FFFFFF", "#E11D48"],
};

// ─── ERKEK TEMALARI ─────────────────────────────────────────────────────────

// 1. Erkek: Şuanki Mavi Mod (Gece Mavisi)
export const MALE_CURRENT: AppTheme = {
  id: "current",
  name: "Mavi Mod",
  gender: "male",
  isLight: false,
  bgGradient: ["#0B111A", "#060A10", "#0B111A"] as const,
  cardBg: "#1A2235",
  cardBorder: "rgba(255, 255, 255, 0.07)",
  unitBg: "#0F172A",
  accent: "#4D9CFF",
  accentLight: "#93C5FD",
  pillAccentBorder: "rgba(77, 156, 255, 0.25)",
  pillAccentBg: "rgba(77, 156, 255, 0.08)",
  inputBg: "#121A28",
  inputBorder: "rgba(255, 255, 255, 0.08)",
  headerBg: "transparent",
  text: "#FFFFFF",
  textSecondary: "rgba(255, 255, 255, 0.72)",
  textMuted: "rgba(255, 255, 255, 0.45)",
  tabBarBg: "rgba(6, 10, 16, 0.85)",
  tabBarBorder: "rgba(255, 255, 255, 0.12)",
  blurTint: "dark",
  description: "Mevcut derin gece mavisi (Varsayılan)",
  previewColors: ["#0B111A", "#1A2235", "#4D9CFF"],
};

// 2. Erkek: Gece Modu (Obsidyen Siyah & Elektrik Mavi)
export const MALE_DARK: AppTheme = {
  id: "dark",
  name: "Gece Modu",
  gender: "male",
  isLight: false,
  bgGradient: ["#080A0F", "#030407", "#080A0F"] as const,
  cardBg: "#111622",
  cardBorder: "rgba(255, 255, 255, 0.07)",
  unitBg: "#0A0E17",
  accent: "#38BDF8",
  accentLight: "#7DD3FC",
  pillAccentBorder: "rgba(56, 189, 248, 0.3)",
  pillAccentBg: "rgba(56, 189, 248, 0.12)",
  inputBg: "#0A0E17",
  inputBorder: "rgba(255, 255, 255, 0.08)",
  headerBg: "transparent",
  text: "#FFFFFF",
  textSecondary: "rgba(255, 255, 255, 0.72)",
  textMuted: "rgba(255, 255, 255, 0.45)",
  tabBarBg: "rgba(3, 4, 7, 0.88)",
  tabBarBorder: "rgba(255, 255, 255, 0.1)",
  blurTint: "dark",
  description: "Karizmatik, simsiyah obsidyen koyu mod",
  previewColors: ["#030407", "#111622", "#38BDF8"],
};

// 3. Erkek: Beyaz Mod (Kar Beyazı & Kobalt Mavi)
export const MALE_LIGHT: AppTheme = {
  id: "light",
  name: "Beyaz Mod",
  gender: "male",
  isLight: true,
  bgGradient: ["#F8FAFC", "#EEF2F6", "#F1F5F9"] as const,
  cardBg: "#FFFFFF",
  cardBorder: "rgba(37, 99, 235, 0.12)",
  unitBg: "#F1F5F9",
  accent: "#2563EB",
  accentLight: "#60A5FA",
  pillAccentBorder: "rgba(37, 99, 235, 0.25)",
  pillAccentBg: "rgba(37, 99, 235, 0.08)",
  inputBg: "#F8FAFC",
  inputBorder: "rgba(37, 99, 235, 0.15)",
  headerBg: "transparent",
  text: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#64748B",
  tabBarBg: "rgba(255, 255, 255, 0.92)",
  tabBarBorder: "rgba(37, 99, 235, 0.15)",
  blurTint: "light",
  description: "Aydınlık, minimalist kar beyazı ve kobalt",
  previewColors: ["#F8FAFC", "#FFFFFF", "#2563EB"],
};

// Geriye dönük uyumluluk takma adları
export const FEMALE_THEME = FEMALE_CURRENT;
export const MALE_THEME = MALE_CURRENT;
export const DEFAULT_THEME = FEMALE_CURRENT;

export const FEMALE_THEMES: readonly AppTheme[] = [
  FEMALE_CURRENT,
  FEMALE_DARK,
  FEMALE_LIGHT,
];

export const MALE_THEMES: readonly AppTheme[] = [
  MALE_CURRENT,
  MALE_DARK,
  MALE_LIGHT,
];

// Global aktif durum (Hook dışında çağrılan legacy `getTheme` için)
let globalGender: "female" | "male" = "female";
let globalMode: ThemeMode = "current";
let globalActiveTheme: AppTheme = FEMALE_CURRENT;

export function setGlobalActiveTheme(gender: "female" | "male", mode: ThemeMode) {
  globalGender = gender;
  globalMode = mode;
  globalActiveTheme = resolveTheme(gender, mode);
}

function resolveTheme(gender: "female" | "male", mode: ThemeMode): AppTheme {
  const isFemale = gender === "female";
  if (isFemale) {
    if (mode === "dark") return FEMALE_DARK;
    if (mode === "light") return FEMALE_LIGHT;
    return FEMALE_CURRENT;
  } else {
    if (mode === "dark") return MALE_DARK;
    if (mode === "light") return MALE_LIGHT;
    return MALE_CURRENT;
  }
}

export function getTheme(
  gender?: string | null,
  mode?: ThemeMode | null
): AppTheme {
  const g: "female" | "male" =
    gender && (gender.toLowerCase() === "male" || gender.toLowerCase() === "erkek")
      ? "male"
      : gender
      ? "female"
      : globalGender;

  const m: ThemeMode = mode || globalMode;
  return resolveTheme(g, m);
}

export function getAvailableThemes(gender?: string | null): readonly AppTheme[] {
  const isMale = gender && (gender.toLowerCase() === "male" || gender.toLowerCase() === "erkek");
  return isMale ? MALE_THEMES : FEMALE_THEMES;
}
