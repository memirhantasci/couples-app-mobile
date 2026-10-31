import { drawConnectionMist, MIST_COLORS, type MistCanvas, type MistPaint } from '../connectionMist';

interface Puff {
  readonly x: number;
  readonly y: number;
  readonly reach: number;
  readonly alpha: number;
}

/** Records every soft glow the mist draws (position, size, opacity). */
function renderMist(
  view: { width: number; height: number },
  from: [number, number],
  to: [number, number],
  seed: number,
  seconds: number,
): Puff[] {
  const puffs: Puff[] = [];
  const stack: [number, number, number][] = [];
  let tx = 0;
  let ty = 0;
  let scale = 1;
  let alpha = 1;
  let radius = 0;
  const canvas = {
    save: () => stack.push([tx, ty, scale]),
    restore: () => {
      [tx, ty, scale] = stack.pop()!;
    },
    translate: (x: number, y: number) => {
      tx += x * scale;
      ty += y * scale;
    },
    scale: (s: number) => {
      scale *= s;
    },
    drawCircle: (_x: number, _y: number, r: number) => {
      radius = r;
      puffs.push({ x: tx, y: ty, reach: scale * radius, alpha });
    },
  } as unknown as MistCanvas;
  const paint = {
    setShader: () => {},
    setAlphaf: (a: number) => {
      alpha = a;
    },
  } as unknown as MistPaint;
  const shaders = MIST_COLORS.map(() => ({})) as never[];
  drawConnectionMist(canvas, paint, shaders, view, from[0], from[1], to[0], to[1], seed, seconds);
  return puffs;
}

const VIEW = { width: 390, height: 844 };

describe('connectionMist', () => {
  it('draws only soft glows: no particle, no hard line', () => {
    const puffs = renderMist(VIEW, [60, 400], [330, 300], 0.3, 2);
    expect(puffs.length).toBeGreaterThan(20);
    for (const p of puffs) {
      expect(p.alpha).toBeGreaterThan(0);
      expect(p.alpha).toBeLessThanOrEqual(1);
      expect(p.reach).toBeGreaterThan(5); // nothing as small as the old 2.4 px ball
    }
  });

  it('is a curve, not a straight line', () => {
    const [x1, y1, x2, y2] = [40, 500, 360, 460];
    const puffs = renderMist(VIEW, [x1, y1], [x2, y2], 0.2, 1);
    const len = Math.hypot(x2 - x1, y2 - y1);
    const deviations = puffs.map((p) => Math.abs(((p.x - x1) * (y2 - y1) - (p.y - y1) * (x2 - x1)) / len));
    expect(Math.max(...deviations)).toBeGreaterThan(12);
  });

  it('bows to opposite sides for different bonds', () => {
    const side = (seed: number) => {
      const puffs = renderMist(VIEW, [40, 500], [360, 500], seed, 0);
      const mid = puffs.filter((p) => p.x > 150 && p.x < 250);
      return mid.reduce((sum, p) => sum + (p.y - 500), 0) / mid.length;
    };
    expect(side(0.1) * side(0.9)).toBeLessThan(0);
  });

  it('drifts over time and is repeatable for the same time', () => {
    const a = renderMist(VIEW, [60, 400], [330, 300], 0.4, 1);
    const b = renderMist(VIEW, [60, 400], [330, 300], 0.4, 1);
    const c = renderMist(VIEW, [60, 400], [330, 300], 0.4, 4);
    expect(a).toEqual(b);
    expect(c).not.toEqual(a);
  });

  it('starts and ends at the two stars', () => {
    const puffs = renderMist(VIEW, [60, 400], [330, 300], 0.4, 1);
    const near = (x: number, y: number) => puffs.some((p) => Math.hypot(p.x - x, p.y - y) < 20);
    expect(near(60, 400)).toBe(true);
    expect(near(330, 300)).toBe(true);
  });

  it('draws nothing for a bond far off screen and stays cheap for a long one', () => {
    expect(renderMist(VIEW, [5000, 5000], [6000, 5200], 0.5, 0)).toHaveLength(0);
    // a bond across the whole screen diagonal and beyond: only the visible part is drawn
    const long = renderMist(VIEW, [-3000, -2000], [3000, 4000], 0.5, 0);
    expect(long.length).toBeLessThan(450);
    expect(long.length).toBeGreaterThan(0);
  });

  it('copes with degenerate bonds', () => {
    expect(renderMist(VIEW, [100, 100], [100, 100], 0.5, 0)).toHaveLength(0);
    expect(renderMist(VIEW, [100, 100], [100, 500], 0.5, 0).length).toBeGreaterThan(0);
    expect(renderMist(VIEW, [100, 100], [300, 100], 0.5, 0).length).toBeGreaterThan(0);
  });
});
