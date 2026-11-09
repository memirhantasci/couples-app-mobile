export interface PrintSize {
  width: number;
  height: number;
}

/** 3:4, büyükten küçüğe. İlki ~7,7 MP; bellek yetmezse bir alt boyut denenir. */
export const PRINT_SIZES: readonly PrintSize[] = [
  { width: 2400, height: 3200 },
  { width: 1800, height: 2400 },
  { width: 1200, height: 1600 },
];

export interface CaptureSuccess {
  uri: string;
  size: PrintSize;
}

/** Sırayla dener, ilk başarıda durur. Hiçbiri olmazsa null: arayüz hata gösterir, istisna yukarı çıkmaz. */
export async function captureWithFallback(
  sizes: readonly PrintSize[],
  capture: (size: PrintSize) => Promise<string | null | undefined>,
  onFailure?: (size: PrintSize) => void
): Promise<CaptureSuccess | null> {
  for (const size of sizes) {
    try {
      const uri = await capture(size);
      if (uri) return { uri, size };
    } catch {
      // bir alt boyuta geç
    }
    onFailure?.(size);
  }
  return null;
}

/**
 * Yerel bellek taşması JS'te yakalanamaz, süreci öldürür. Denemeden önce yazılan iz, tamamlanınca silinir:
 * iz duruyorsa önceki deneme uygulamayla birlikte düşmüştür ve o boyut tekrar denenmez.
 * En küçük boyutta bile iz kaldıysa yine en küçüğü denenir: başka seçenek yok.
 */
export function sizesAfterCrash(lastAttemptWidth: number | null, sizes: readonly PrintSize[] = PRINT_SIZES): readonly PrintSize[] {
  if (lastAttemptWidth === null) return sizes;
  const safer = sizes.filter((size) => size.width < lastAttemptWidth);
  return safer.length > 0 ? safer : sizes.slice(-1);
}

export function parseAttemptWidth(raw: string | null): number | null {
  if (raw === null || !/^\d{3,5}$/.test(raw)) return null;
  return Number(raw);
}
