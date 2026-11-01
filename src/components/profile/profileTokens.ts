import type { AppTheme } from "@/lib/theme";

/** Açılır kartların içindeki alanların (input, tarih seçici, liste) çerçevesiz dolgu rengi. */
export function fieldSurface(theme: AppTheme): string {
  return theme.isLight ? "rgba(0,0,0,0.045)" : "rgba(255,255,255,0.06)";
}

/** Gruplardaki ince ayraç çizgisinin rengi. */
export function hairlineColor(theme: AppTheme): string {
  return theme.isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)";
}

/** Uyarı kutuları için amber ton (kilit, bekleme süresi). */
export const AMBER = "#FFB300";
