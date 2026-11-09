export const MAX_STAR_LABELS = 14;
/** Bundan sönük adlı yıldız etiketlenmez. */
export const LABEL_MAX_MAG = 2.5;
/** Etiket puntosu, ufuk yarıçapına oranla: hikâye kartı ve baskıda aynı görünür. */
export const LABEL_FONT_SIZE = 0.06;
const LABEL_LINE_HEIGHT = LABEL_FONT_SIZE * 1.3;
// Gerçek metin ölçülemez: harf başına cömert genişlik (Inter ortalaması ~0,55). Kutu darsa metin kesilir.
const LABEL_CHAR_WIDTH = LABEL_FONT_SIZE * 0.62;
const LABEL_STAR_GAP = 0.03;
const LABEL_MAX_RADIUS = 0.98;

export interface LabelStar {
  hip: number;
  x: number;
  y: number;
  mag: number;
}

export interface LabelBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PlacedLabel extends LabelBox {
  hip: number;
  text: string;
  side: "right" | "left";
}

export interface LabelOptions {
  /** Birim dairede etiketlerin kapatmaması gereken alanlar (Ay) */
  obstacles?: readonly LabelBox[];
  /** Öncelikli özel etiket (Bölüm 5 "yıldızımız"): kadir sınırına bakılmaz, ilk yerleşir */
  priority?: { hip: number; label?: string };
  maxLabels?: number;
}

function intersects(a: LabelBox, b: LabelBox): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function insideDisc(box: LabelBox): boolean {
  return [
    [box.left, box.top],
    [box.right, box.top],
    [box.left, box.bottom],
    [box.right, box.bottom],
  ].every(([x, y]) => x * x + y * y <= LABEL_MAX_RADIUS * LABEL_MAX_RADIUS);
}

function boxFor(star: LabelStar, text: string, side: "right" | "left"): LabelBox {
  const width = Array.from(text).length * LABEL_CHAR_WIDTH;
  const left = side === "right" ? star.x + LABEL_STAR_GAP : star.x - LABEL_STAR_GAP - width;
  return { left, right: left + width, top: star.y - LABEL_LINE_HEIGHT / 2, bottom: star.y + LABEL_LINE_HEIGHT / 2 };
}

/**
 * Açgözlü yerleştirme: parlaktan sönüğe, kutusu öncekilerle çakışan atlanır. Sol tarafa yalnızca sağ taraf
 * daireden taşıyorsa geçilir; çakışmada geçilmez, yoksa dip dibe iki yıldızın ikisi de etiket alırdı.
 */
export function placeStarLabels(
  stars: readonly LabelStar[],
  names: Readonly<Record<number, string>>,
  options: LabelOptions = {}
): PlacedLabel[] {
  const { obstacles = [], priority, maxLabels = MAX_STAR_LABELS } = options;
  const priorityText = priority?.label?.trim();
  const candidates = stars
    .filter((star) => {
      if (star.x * star.x + star.y * star.y > 1) return false;
      if (priorityText && star.hip === priority?.hip) return true;
      return Boolean(names[star.hip]) && star.mag <= LABEL_MAX_MAG;
    })
    .sort((a, b) => {
      if (priorityText) {
        if (a.hip === priority?.hip) return -1;
        if (b.hip === priority?.hip) return 1;
      }
      return a.mag - b.mag || a.hip - b.hip;
    });

  const placed: PlacedLabel[] = [];
  for (const star of candidates) {
    if (placed.length >= maxLabels) break;
    const text = priorityText && star.hip === priority?.hip ? priorityText : names[star.hip];
    const right = boxFor(star, text, "right");
    const side = insideDisc(right) ? "right" : "left";
    const box = side === "right" ? right : boxFor(star, text, "left");
    if (!insideDisc(box)) continue;
    if (obstacles.some((obstacle) => intersects(box, obstacle)) || placed.some((other) => intersects(box, other))) continue;
    placed.push({ ...box, hip: star.hip, text, side });
  }
  return placed;
}
