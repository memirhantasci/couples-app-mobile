import {
  DUST_COUNT,
  STRAND_COUNT,
  drawConnectionStrands,
  type StrandCanvas,
  type StrandResources,
} from '../connectionStrands';

interface Line {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly alpha: number;
  /** Stroke width in screen pixels. */
  readonly widthPx: number;
}

interface Dot {
  readonly kind: 'core' | 'glow';
  readonly x: number;
  readonly y: number;
  /** Radius in screen pixels. */
  readonly radius: number;
  readonly alpha: number;
}

type Matrix = [number, number, number, number, number, number];

interface FakePaint {
  kind: 'line' | 'spark' | 'glow' | 'core';
  alpha: number;
  width: number;
  setShader: (shader: unknown) => void;
  setAlphaf: (alpha: number) => void;
  setStrokeWidth: (width: number) => void;
}

function fakePaint(kind: FakePaint['kind']): FakePaint {
  return {
    kind,
    alpha: 1,
    width: 1,
    setShader() {},
    setAlphaf(alpha) {
      this.alpha = alpha;
    },
    setStrokeWidth(width) {
      this.width = width;
    },
  };
}

/** Records the strands (as lines) and dots a bond draws, in screen pixels. */
function render(
  view: { width: number; height: number },
  from: [number, number],
  to: [number, number],
  seed: number,
  seconds: number,
) {
  const lines: Line[] = [];
  const sparks: Line[] = [];
  const dots: Dot[] = [];
  let m: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const mul = (a: Matrix, b: Matrix): Matrix => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  const apply = (x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const scaleOf = () => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));

  const canvas = {
    save: () => stack.push([...m] as Matrix),
    restore: () => {
      m = stack.pop()!;
    },
    translate: (x: number, y: number) => {
      m = mul(m, [1, 0, 0, 1, x, y]);
    },
    scale: (sx: number, sy: number) => {
      m = mul(m, [sx, 0, 0, sy, 0, 0]);
    },
    rotate: (deg: number) => {
      const r = (deg * Math.PI) / 180;
      m = mul(m, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]);
    },
    drawLine: (x0: number, y0: number, x1: number, y1: number, paint: FakePaint) => {
      const [ax, ay] = apply(x0, y0);
      const [bx, by] = apply(x1, y1);
      const line = { x0: ax, y0: ay, x1: bx, y1: by, alpha: paint.alpha, widthPx: paint.width * scaleOf() };
      (paint.kind === 'spark' ? sparks : lines).push(line);
    },
    drawCircle: (x: number, y: number, r: number, paint: FakePaint) => {
      const [cx, cy] = apply(x, y);
      dots.push({ kind: paint.kind as 'core' | 'glow', x: cx, y: cy, radius: r * scaleOf(), alpha: paint.alpha });
    },
  } as unknown as StrandCanvas;

  const resources = {
    line: fakePaint('line'),
    glow: fakePaint('glow'),
    core: fakePaint('core'),
    gradients: [{}, {}, {}],
    glowShader: {},
  } as unknown as StrandResources;

  drawConnectionStrands(canvas, resources, view, from[0], from[1], to[0], to[1], seed, seconds);

  // Each strand is one continuous run of lines: a new strand starts where a line does not
  // begin at the previous line's end.
  const strands: Line[][] = [];
  for (const line of lines) {
    const run = strands[strands.length - 1];
    const prev = run?.[run.length - 1];
    if (prev && Math.hypot(prev.x1 - line.x0, prev.y1 - line.y0) < 1e-6) run.push(line);
    else strands.push([line]);
  }
  return { strands, sparks, dots, lineCount: lines.length };
}

const VIEW = { width: 390, height: 844 };
const FROM: [number, number] = [20, 400];
const TO: [number, number] = [370, 480];

/** Sideways distance of a point from the chord, signed. */
function offset(x: number, y: number, from: [number, number], to: [number, number]) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return ((x - from[0]) * (to[1] - from[1]) - (y - from[1]) * (to[0] - from[0])) / len;
}

/** Position along the chord, 0…1. */
function along(x: number, y: number, from: [number, number], to: [number, number]) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  return ((x - from[0]) * dx + (y - from[1]) * dy) / (dx * dx + dy * dy);
}

/** Every strand's offset near fraction u of the chord. */
function offsetsAt(strands: Line[][], u: number, from: [number, number], to: [number, number]) {
  return strands.map((strand) => {
    let best = strand[0];
    let bestGap = Infinity;
    for (const line of strand) {
      const gap = Math.abs(along(line.x1, line.y1, from, to) - u);
      if (gap < bestGap) {
        best = line;
        bestGap = gap;
      }
    }
    return offset(best.x1, best.y1, from, to);
  });
}

describe('connectionStrands', () => {
  const frame = render(VIEW, FROM, TO, 0.7, 2);

  it('draws a bundle of 13 hairline strands (30–60 % opaque, under 1 px wide)', () => {
    expect(STRAND_COUNT).toBe(13);
    expect(frame.strands).toHaveLength(STRAND_COUNT);
    for (const strand of frame.strands) {
      for (const line of strand) {
        expect(line.alpha).toBeGreaterThanOrEqual(0.3);
        expect(line.alpha).toBeLessThanOrEqual(0.62);
        expect(line.widthPx).toBeGreaterThan(0.4);
        expect(line.widthPx).toBeLessThan(0.95);
      }
    }
  });

  it('meets at both stars: every strand starts on our star and ends on the other', () => {
    for (const strand of frame.strands) {
      const first = strand[0];
      const last = strand[strand.length - 1];
      expect(Math.hypot(first.x0 - FROM[0], first.y0 - FROM[1])).toBeLessThan(0.5);
      expect(Math.hypot(last.x1 - TO[0], last.y1 - TO[1])).toBeLessThan(0.5);
    }
  });

  it('waves in a gentle S, not a straight line', () => {
    const len = Math.hypot(TO[0] - FROM[0], TO[1] - FROM[1]);
    const centre = (u: number) => {
      const o = offsetsAt(frame.strands, u, FROM, TO).sort((a, b) => a - b);
      return o[Math.floor(o.length / 2)];
    };
    const crestA = centre(0.25);
    const crestB = centre(0.75);
    expect(Math.abs(crestA)).toBeGreaterThan(len * 0.03);
    expect(Math.abs(crestB)).toBeGreaterThan(len * 0.03);
    expect(crestA * crestB).toBeLessThan(0); // one crest each side: an S
    expect(Math.abs(centre(0.5))).toBeLessThan(Math.abs(crestA)); // crosses the chord in the middle
  });

  it('is tight at the crests and open where the S crosses, like a twisting ribbon', () => {
    const spreadAt = (u: number) => {
      const o = offsetsAt(frame.strands, u, FROM, TO);
      return Math.max(...o) - Math.min(...o);
    };
    expect(spreadAt(0.5)).toBeGreaterThan(spreadAt(0.25) * 2);
    expect(spreadAt(0.5)).toBeGreaterThan(8);
    // and closed up again at the stars
    expect(spreadAt(0.02)).toBeLessThan(spreadAt(0.5) / 3);
  });

  it('scatters 10–15 tiny specks of stardust along the strands, none larger than a speck', () => {
    expect(DUST_COUNT).toBeGreaterThanOrEqual(10);
    expect(DUST_COUNT).toBeLessThanOrEqual(15);
    const cores = frame.dots.filter((d) => d.kind === 'core');
    expect(cores).toHaveLength(DUST_COUNT);
    const len = Math.hypot(TO[0] - FROM[0], TO[1] - FROM[1]);
    for (const dot of cores) {
      expect(dot.radius).toBeLessThanOrEqual(1.4);
      // along the trajectory, not scattered over the screen
      const u = along(dot.x, dot.y, FROM, TO);
      expect(u).toBeGreaterThan(0);
      expect(u).toBeLessThan(1);
      expect(Math.abs(offset(dot.x, dot.y, FROM, TO))).toBeLessThan(len * 0.2);
    }
  });

  it('moves slowly: the S slides and the dust drifts, endpoints stay put', () => {
    const later = render(VIEW, FROM, TO, 0.7, 6);
    const again = render(VIEW, FROM, TO, 0.7, 2);
    expect(again.strands).toEqual(frame.strands);
    expect(later.strands).not.toEqual(frame.strands);
    const mid = (f: typeof frame) => offsetsAt(f.strands, 0.5, FROM, TO).reduce((a, b) => a + b, 0) / STRAND_COUNT;
    const shift = Math.abs(mid(later) - mid(frame));
    expect(shift).toBeGreaterThan(0.2); // it does move
    expect(shift).toBeLessThan(25); // slowly, not jumping
    expect(later.strands[0][0].x0).toBeCloseTo(FROM[0], 3);
    const dustMoved = later.dots.filter((d) => d.kind === 'core')[0];
    expect(dustMoved).not.toEqual(frame.dots.filter((d) => d.kind === 'core')[0]);
  });

  it('leans to opposite sides for different bonds', () => {
    const lean = (seed: number) => {
      const f = render(VIEW, FROM, TO, seed, 0);
      const o = offsetsAt(f.strands, 0.25, FROM, TO).sort((a, b) => a - b);
      return o[Math.floor(o.length / 2)];
    };
    expect(lean(0.1) * lean(0.9)).toBeLessThan(0);
  });

  it('never brightens the stars: no glow, glint or speck is drawn on or right next to them', () => {
    for (const seconds of [0, 1.3, 2, 4.7, 9, 20]) {
      const f = render(VIEW, FROM, TO, 0.7, seconds);
      expect(f.sparks).toHaveLength(0);
      for (const dot of f.dots) {
        for (const star of [FROM, TO]) {
          expect(Math.hypot(dot.x - star[0], dot.y - star[1])).toBeGreaterThanOrEqual(25);
        }
      }
    }
    // short bonds too
    for (const [a, b] of [[[100, 100], [160, 130]], [[100, 100], [100, 200]]] as [[number, number], [number, number]][]) {
      for (const dot of render(VIEW, a, b, 0.4, 3).dots) {
        for (const star of [a, b]) expect(Math.hypot(dot.x - star[0], dot.y - star[1])).toBeGreaterThanOrEqual(25);
      }
    }
  });

  it('draws nothing off screen and stays bounded for a very long bond', () => {
    expect(render(VIEW, [5000, 5000], [6000, 5200], 0.5, 0).lineCount).toBe(0);
    const long = render(VIEW, [-3000, -2000], [3000, 4000], 0.5, 0);
    expect(long.lineCount).toBeGreaterThan(0);
    expect(long.lineCount).toBeLessThan(900);
  });

  it('copes with degenerate and short bonds', () => {
    expect(render(VIEW, [100, 100], [100, 100], 0.5, 0).lineCount).toBe(0);
    expect(render(VIEW, [100, 100], [102, 103], 0.5, 0).lineCount).toBe(0);
    expect(render(VIEW, [100, 100], [100, 500], 0.5, 0).strands).toHaveLength(STRAND_COUNT);
    expect(render(VIEW, [100, 100], [300, 100], 0.5, 0).strands).toHaveLength(STRAND_COUNT);
    expect(render(VIEW, [100, 100], [160, 130], 0.5, 0).strands).toHaveLength(STRAND_COUNT);
  });
});
