// ─── Tema Sistemi ────────────────────────────────────────────────────────────
// Erkek: Siyah/koyu tema (SADECE ERKEK İÇİN GEÇERLİ OLACAK AMA TASARIM ASLINDA KADIN KODUYDU - BİZİ İLGİLENDİREN KISIM AŞAĞIDA)
// Kullanıcı açıkça sadece belirli renkleri zorunlu kıldı, o yüzden varsayılanı o renkler yapacağız.

// Ortak renkler
export const TEXT_WHITE = "#ffffff";
export const TEXT_MUTED = "rgba(255,255,255,0.45)";
export const TEXT_DIM = "rgba(255,255,255,0.25)";
export const BORDER_SOFT = "rgba(255,255,255,0.07)";

// Tema tipi
export interface AppTheme {
  bgGradient: readonly [string, string, ...string[]];
  cardBg: string;
  cardBorder: string;
  unitBg: string;
  accent: string;
  accentLight: string;
  pillAccentBorder: string;
  pillAccentBg: string;
  inputBg: string;
  headerBg: string;
}

// Ana Arka Plan: Biraz daha hafif pembe istendi (#EC4899 - #E11D48 tonları)
// Kartlar: #4A152B
// Aksiyonlar: #FF4081

export const FEMALE_THEME: AppTheme = {
  bgGradient: ["#CA3F7A", "#B83067", "#CA3F7A"] as const,
  cardBg: "#4A152B",
  cardBorder: "rgba(255,255,255,0.05)",
  unitBg: "#330d1d",
  accent: "#FF5C77",
  accentLight: "#FF80AB",
  pillAccentBorder: "rgba(255,92,119,0.3)",
  pillAccentBg: "rgba(255,92,119,0.12)",
  inputBg: "#1c1c1e",
  headerBg: "transparent",
};

export const MALE_THEME: AppTheme = {
  bgGradient: ["#0B111A", "#060A10", "#0B111A"] as const,
  cardBg: "#1A2235",
  cardBorder: "rgba(255,255,255,0.07)",
  unitBg: "#0f172a",
  accent: "#4D9CFF",
  accentLight: "#93c5fd",
  pillAccentBorder: "rgba(77,156,255,0.25)",
  pillAccentBg: "rgba(77,156,255,0.06)",
  inputBg: "#121A28",
  headerBg: "transparent",
};

export const DEFAULT_THEME = FEMALE_THEME;

let lastTheme: AppTheme = FEMALE_THEME;

export function getTheme(gender: string | null | undefined): AppTheme {
  if (!gender) return lastTheme;
  const g = gender.toLowerCase();
  if (g === "female" || g === "kadın" || g === "kadin") {
    lastTheme = FEMALE_THEME;
    return FEMALE_THEME;
  }
  if (g === "male" || g === "erkek") {
    lastTheme = MALE_THEME;
    return MALE_THEME;
  }
  lastTheme = FEMALE_THEME;
  return FEMALE_THEME;
}
