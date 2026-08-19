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
  bgGradient: ["#B86B7D", "#A3586A", "#B86B7D"] as const,
  cardBg: "#4A152B",
  cardBorder: "rgba(255,255,255,0.05)",
  unitBg: "#330d1d", // biraz daha koyu mürdüm
  accent: "#FF4081",
  accentLight: "#FF80AB",
  pillAccentBorder: "rgba(255,64,129,0.3)",
  pillAccentBg: "rgba(255,64,129,0.12)",
  inputBg: "#1a0812", // neredeyse siyah/koyu gri istendi
  headerBg: "transparent",
};

export const MALE_THEME: AppTheme = {
  bgGradient: ["#1a0812", "#0d0407", "#1a0812"] as const,
  cardBg: "#231218",
  cardBorder: "rgba(255,255,255,0.07)",
  unitBg: "#1e0e14",
  accent: "#ff4d6d",
  accentLight: "#ff8fa3",
  pillAccentBorder: "rgba(255,77,109,0.25)",
  pillAccentBg: "rgba(255,77,109,0.06)",
  inputBg: "rgba(255,255,255,0.03)",
  headerBg: "transparent",
};

export const DEFAULT_THEME = FEMALE_THEME;

export function getTheme(gender: string | null | undefined): AppTheme {
  if (!gender) return FEMALE_THEME;
  const g = gender.toLowerCase();
  if (g === "female" || g === "kadın" || g === "kadin") return FEMALE_THEME;
  if (g === "male" || g === "erkek") return MALE_THEME;
  return FEMALE_THEME;
}
