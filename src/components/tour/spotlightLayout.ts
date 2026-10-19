// Spotlight turu için saf yerleşim hesapları (React / native bağımlılığı yok).

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface VisibleArea {
  /** Görünür alanın üst sınırı (safe-area üstü) */
  top: number;
  /** Görünür alanın alt sınırı (alt sekme çubuğunun üstü) */
  bottom: number;
}

export type TooltipPlacement = "top" | "bottom" | "center";

export interface TooltipLayout {
  left: number;
  top: number;
  placement: TooltipPlacement;
  /** Okun balon içindeki x konumu; null ise ok gösterilmez */
  arrowX: number | null;
}

export const SCREEN_MARGIN = 16;
export const TOOLTIP_GAP = 14;
export const TOOLTIP_MAX_WIDTH = 340;
const ARROW_EDGE_INSET = 26;
/** Hedefin bu kadarı görünür değilse spotlight yerine ortalanmış kart gösterilir */
const MIN_VISIBLE_HEIGHT = 56;

const clamp = (v: number, min: number, max: number) =>
  max < min ? min : Math.min(Math.max(v, min), max);

export function getTooltipWidth(screenWidth: number) {
  return Math.min(TOOLTIP_MAX_WIDTH, screenWidth - SCREEN_MARGIN * 2);
}

/**
 * Ölçülen hedefi spotlight'a uygun hale getirir: geçersiz ölçümleri ve görünür alanın
 * dışında kalan hedefleri eler (null → ortalanmış kart), kısmen görünenleri kırpar.
 */
export function resolveSpotlightRect(
  measured: Rect | null,
  screen: Size,
  area: VisibleArea,
  padding: number
): Rect | null {
  if (!measured) return null;
  const { x, y, width, height } = measured;
  if (![x, y, width, height].every(Number.isFinite) || width < 2 || height < 2) return null;

  const top = Math.max(y - padding, area.top);
  const bottom = Math.min(y + height + padding, area.bottom);
  const left = Math.max(x - padding, 0);
  const right = Math.min(x + width + padding, screen.width);

  if (right - left < 2 || bottom - top < Math.min(height, MIN_VISIBLE_HEIGHT)) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Balonu hedefin altına (yer yoksa üstüne) yerleştirir; ekran dışına taşmasını engeller. */
export function computeTooltipLayout(
  target: Rect | null,
  tooltip: Size,
  screen: Size,
  area: VisibleArea
): TooltipLayout {
  const minLeft = SCREEN_MARGIN;
  const maxLeft = screen.width - SCREEN_MARGIN - tooltip.width;
  const minTop = area.top + SCREEN_MARGIN;
  const maxTop = area.bottom - SCREEN_MARGIN - tooltip.height;

  if (!target) {
    return {
      left: clamp((screen.width - tooltip.width) / 2, minLeft, maxLeft),
      top: clamp((screen.height - tooltip.height) / 2, minTop, maxTop),
      placement: "center",
      arrowX: null,
    };
  }

  const centerX = target.x + target.width / 2;
  const left = clamp(centerX - tooltip.width / 2, minLeft, maxLeft);
  const spaceBelow = area.bottom - SCREEN_MARGIN - (target.y + target.height + TOOLTIP_GAP);
  const spaceAbove = target.y - TOOLTIP_GAP - minTop;

  let placement: TooltipPlacement;
  let top: number;
  let fits = true;
  if (tooltip.height <= spaceBelow) {
    placement = "bottom";
    top = target.y + target.height + TOOLTIP_GAP;
  } else if (tooltip.height <= spaceAbove) {
    placement = "top";
    top = target.y - TOOLTIP_GAP - tooltip.height;
  } else {
    // Hiçbir tarafa sığmıyor (çok büyük hedef / küçük ekran): geniş tarafa yaslanır, ok gizlenir
    fits = false;
    placement = spaceBelow >= spaceAbove ? "bottom" : "top";
    top = placement === "bottom" ? maxTop : minTop;
  }

  return {
    left,
    top: clamp(top, minTop, maxTop),
    placement,
    arrowX: fits
      ? clamp(centerX - left, ARROW_EDGE_INSET, tooltip.width - ARROW_EDGE_INSET)
      : null,
  };
}
