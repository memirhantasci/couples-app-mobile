export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;

/** Açıyı [0, 360) aralığına getirir. */
export function normalizeDegrees(degrees: number): number {
  const remainder = degrees % 360;
  const positive = remainder < 0 ? remainder + 360 : remainder;
  // Çok küçük negatif değerde `r + 360` yuvarlanıp tam 360 olabilir
  return positive >= 360 ? 0 : positive;
}

/** asin için tanım kümesine sıkıştırma (yuvarlama hatası 1'i aşınca NaN olmasın). */
export function clampUnit(value: number): number {
  return Math.min(1, Math.max(-1, value));
}
