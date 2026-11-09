/**
 * Dikey bütçeler, tasarım biriminde. Ekran görülemediği için sığma burada hesapla kanıtlanır: kartlar satır
 * yüksekliklerini yalnızca buradan alır, grafik kalan alanın tamamını kullanır.
 */

/** StoryCard.tsx ile aynı olmalı (testle denetlenir). */
export const STORY_CANVAS = { width: 360, height: 640, safeTop: 78, safeBottom: 96, sidePadding: 28 } as const;
/** StoryFooter: 8 (üst boşluk) + 14 (imza) + 5 + 13 (onay çizgisi) + 6 + 11 (indirme çağrısı). */
export const STORY_FOOTER_HEIGHT = 57;
/** Yazı tipi ölçü farklarına karşı pay. */
const SLACK = 3;

export const STORY_ROWS = {
  kicker: { marginTop: 0, height: 14 },
  title: { marginTop: 2, height: 30 },
  chart: { marginTop: 6 },
  date: { marginTop: 6, height: 16 },
  place: { marginTop: 1, height: 15 },
  names: { marginTop: 2, height: 22 },
  moon: { marginTop: 2, height: 14 },
  star: { marginTop: 1, height: 14 },
  note: { marginTop: 3, height: 10 },
} as const;

export const PRINT_CANVAS = { width: 360, height: 480, paddingTop: 26, paddingBottom: 18, sidePadding: 28 } as const;

export const PRINT_ROWS = {
  title: { marginTop: 0, height: 30 },
  subtitle: { marginTop: 1, height: 14 },
  chart: { marginTop: 6 },
  date: { marginTop: 6, height: 14 },
  place: { marginTop: 1, height: 14 },
  names: { marginTop: 1, height: 20 },
  moon: { marginTop: 1, height: 12 },
  star: { marginTop: 1, height: 12 },
  attribution: { marginTop: 4, height: 8 },
} as const;

export interface PosterLayout {
  /** Grafiğin kenar uzunluğu (kare) */
  chartSize: number;
  /** İçeriğin kullanabileceği yükseklik */
  available: number;
  /** Tüm satırlar + grafik + pay */
  total: number;
  /** İçerik genişliği */
  contentWidth: number;
}

const rowHeight = (row: { marginTop: number; height: number }) => row.marginTop + row.height;

function fit(available: number, fixedHeight: number, contentWidth: number): PosterLayout {
  const chartSize = Math.min(contentWidth, available - fixedHeight - SLACK);
  return { chartSize, available, total: fixedHeight + SLACK + chartSize, contentWidth };
}

/** 9:16 kart. Boş satırlar (yer, isim) bütçeden düşer, kalan alan grafiğe gider. */
export function storyPosterLayout(options: { hasPlace: boolean; hasNames: boolean; hasStarLine?: boolean }): PosterLayout {
  const r = STORY_ROWS;
  const available = STORY_CANVAS.height - STORY_CANVAS.safeTop - STORY_CANVAS.safeBottom - STORY_FOOTER_HEIGHT;
  const fixed =
    rowHeight(r.kicker) +
    rowHeight(r.title) +
    r.chart.marginTop +
    rowHeight(r.date) +
    (options.hasPlace ? rowHeight(r.place) : 0) +
    (options.hasNames ? rowHeight(r.names) : 0) +
    rowHeight(r.moon) +
    (options.hasStarLine ? rowHeight(r.star) : 0) +
    rowHeight(r.note);
  return fit(available, fixed, STORY_CANVAS.width - 2 * STORY_CANVAS.sidePadding);
}

/** 3:4 baskı. */
export function printPosterLayout(options: { hasSubtitle: boolean; hasPlace: boolean; hasNames: boolean; hasStarLine?: boolean }): PosterLayout {
  const r = PRINT_ROWS;
  const available = PRINT_CANVAS.height - PRINT_CANVAS.paddingTop - PRINT_CANVAS.paddingBottom;
  const fixed =
    rowHeight(r.title) +
    (options.hasSubtitle ? rowHeight(r.subtitle) : 0) +
    r.chart.marginTop +
    rowHeight(r.date) +
    (options.hasPlace ? rowHeight(r.place) : 0) +
    (options.hasNames ? rowHeight(r.names) : 0) +
    rowHeight(r.moon) +
    (options.hasStarLine ? rowHeight(r.star) : 0) +
    rowHeight(r.attribution);
  return fit(available, fixed, PRINT_CANVAS.width - 2 * PRINT_CANVAS.sidePadding);
}
