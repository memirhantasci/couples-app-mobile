/**
 * Collision-free placement of solar-system labels. Pure worklet code (no Skia), so it runs on the
 * UI thread every frame and in Node tests alike.
 *
 * Every marker is reserved first; then each label, in order, takes the first free spot of
 * below / above / right / left of its body and reserves it. A planet label with no free spot is
 * hidden this frame (bodies move, so it reappears as they drift apart or when zooming in); a body
 * flagged `always` (the sun) falls back to "below".
 */

/** Gap between a marker and its label, in px. */
export const LABEL_GAP_PX = 3;

export interface LabelBody {
  readonly x: number;
  readonly y: number;
  /** Visual radius of the marker, in px. */
  readonly radius: number;
  /** null when the body has no label or should not be labelled this frame. */
  readonly label: { readonly width: number; readonly top: number; readonly bottom: number } | null;
  /** Always show this label, even when every spot is taken (the sun). */
  readonly always: boolean;
}

export interface LabelPlacement {
  /** Drawing point of the label picture (centred on x, `top`/`bottom` relative to y). */
  readonly x: number;
  readonly y: number;
}

function overlapsAny(boxes: readonly number[], left: number, top: number, right: number, bottom: number, skip: number): boolean {
  'worklet';
  for (let i = 0; i + 3 < boxes.length; i += 4) {
    if (i / 4 === skip) continue;
    if (left < boxes[i + 2] && right > boxes[i] && top < boxes[i + 3] && bottom > boxes[i + 1]) return true;
  }
  return false;
}

/** One placement per body (same order), or null where the label is hidden. */
export function placeSolarLabels(bodies: readonly LabelBody[]): (LabelPlacement | null)[] {
  'worklet';
  // Flat [left, top, right, bottom] boxes: markers first (index = body index), then placed labels
  const boxes: number[] = [];
  for (const body of bodies) {
    boxes.push(body.x - body.radius, body.y - body.radius, body.x + body.radius, body.y + body.radius);
  }

  const placements: (LabelPlacement | null)[] = [];
  for (let index = 0; index < bodies.length; index += 1) {
    const body = bodies[index];
    const label = body.label;
    if (!label) {
      placements.push(null);
      continue;
    }
    const half = label.width / 2;
    const reach = body.radius + LABEL_GAP_PX;
    const middle = -(label.top + label.bottom) / 2;
    // Drawing point per candidate: below, above, right, left
    const candidates = [
      body.x, body.y + reach - label.top,
      body.x, body.y - reach - label.bottom,
      body.x + reach + half, body.y + middle,
      body.x - reach - half, body.y + middle,
    ];
    let chosen: LabelPlacement | null = null;
    for (let c = 0; c < candidates.length; c += 2) {
      const cx = candidates[c];
      const cy = candidates[c + 1];
      if (!overlapsAny(boxes, cx - half, cy + label.top, cx + half, cy + label.bottom, index)) {
        chosen = { x: cx, y: cy };
        break;
      }
    }
    if (!chosen && body.always) chosen = { x: candidates[0], y: candidates[1] };
    if (chosen) boxes.push(chosen.x - half, chosen.y + label.top, chosen.x + half, chosen.y + label.bottom);
    placements.push(chosen);
  }
  return placements;
}
