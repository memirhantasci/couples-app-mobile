import type {
  FontWeight,
  SkCanvas,
  SkPaint,
  SkPicture,
  SkTypefaceFontProvider,
} from '@shopify/react-native-skia';
import type { ActiveStarConnection, ViewportStarItem } from '../../types/star.types';
import { CONSTELLATION_LINES } from '../../config/constellationLines.data';
import { SKY_SECTORS_LIST } from '../../config/skySectors.data';
import { Skia } from '../skiaBridge';
import { colorOf } from './starField';

/**
 * Everything drawn around the stars, prepared once on the JS thread.
 * Markers and labels are small pictures anchored at (0, 0); the per-frame
 * worklet only positions them, so they keep a constant screen size at
 * every zoom.
 */

export interface PositionedPicture {
  readonly ra: number;
  readonly dec: number;
  readonly picture: SkPicture;
}

export interface NebulaItem extends PositionedPicture {
  /** The picture is a unit-radius gradient; this scales it in world space. */
  readonly radiusDeg: number;
}

export interface SolarItem extends PositionedPicture {
  /** The sun's marker is unit-sized and scales with zoom. */
  readonly isSun: boolean;
  readonly label: SkPicture | null;
  readonly labelOffsetY: number;
}

export interface ClaimedLabelItem {
  readonly ra: number;
  readonly dec: number;
  readonly magnitude: number;
  readonly spectralType: string;
  readonly label: SkPicture;
}

export interface ConnectionItem {
  readonly ra: number;
  readonly dec: number;
  readonly label: SkPicture | null;
}

export interface HeroItem extends PositionedPicture {
  readonly label: SkPicture | null;
}

export interface SkyOverlay {
  readonly background: SkPicture;
  readonly milkyWay: readonly NebulaItem[];
  readonly nebulae: readonly NebulaItem[];
  /** Flat [fromRa, fromDec, toRa, toDec, ...] segments. */
  readonly constellations: readonly number[];
  readonly constellationPaint: SkPaint;
  readonly sectorLabels: readonly PositionedPicture[];
  readonly hero: HeroItem | null;
  readonly connections: readonly ConnectionItem[];
  readonly connectionNode: SkPicture;
  readonly solar: readonly SolarItem[];
  readonly claimedLabels: readonly ClaimedLabelItem[];
}


const NEBULA_RADIUS_DEG = 12;

// ─── Milky Way band ──────────────────────────────────────────────────────────
// A soft dust-lane strip along the galactic equator, built once from the
// J2000 galactic-to-equatorial rotation matrix (verified against Sgr A*:
// l=0,b=0 maps to RA≈266.4°, Dec≈-28.9°, matching the known galactic centre).

const MILKY_WAY_RADIUS_DEG = 16;
const MILKY_WAY_LONGITUDE_STEP_DEG = 8;

/** Transpose of the equatorial→galactic rotation matrix (J2000), i.e. galactic→equatorial. */
const GAL_TO_EQ = [
  [-0.0548755604, 0.4941094279, -0.8676661490],
  [-0.8734370902, -0.4448296300, -0.1980763734],
  [-0.4838350155, 0.7469822445, 0.4559837762],
] as const;

function galacticToEquatorial(lDeg: number, bDeg = 0): { ra: number; dec: number } {
  const l = (lDeg * Math.PI) / 180;
  const b = (bDeg * Math.PI) / 180;
  const xg = Math.cos(b) * Math.cos(l);
  const yg = Math.cos(b) * Math.sin(l);
  const zg = Math.sin(b);
  const xe = GAL_TO_EQ[0][0] * xg + GAL_TO_EQ[0][1] * yg + GAL_TO_EQ[0][2] * zg;
  const ye = GAL_TO_EQ[1][0] * xg + GAL_TO_EQ[1][1] * yg + GAL_TO_EQ[1][2] * zg;
  const ze = GAL_TO_EQ[2][0] * xg + GAL_TO_EQ[2][1] * yg + GAL_TO_EQ[2][2] * zg;
  const dec = (Math.asin(Math.max(-1, Math.min(1, ze))) * 180) / Math.PI;
  let raRad = Math.atan2(ye, xe);
  if (raRad < 0) raRad += 2 * Math.PI;
  return { ra: (raRad * 180) / Math.PI, dec };
}

function buildMilkyWayPath(): readonly { ra: number; dec: number }[] {
  const points: { ra: number; dec: number }[] = [];
  for (let l = 0; l < 360; l += MILKY_WAY_LONGITUDE_STEP_DEG) {
    points.push(galacticToEquatorial(l));
  }
  return points;
}

function record(draw: (canvas: SkCanvas) => void, bounds = 400) {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(-bounds, -bounds, bounds * 2, bounds * 2));
  draw(canvas);
  return recorder.finishRecordingAsPicture();
}

function fillPaint(color: string | Float32Array) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(typeof color === 'string' ? Skia.Color(color) : color);
  return paint;
}

function strokePaint(color: string, width: number) {
  const paint = fillPaint(color);
  paint.setStyle(1);
  paint.setStrokeWidth(width);
  return paint;
}

/** Soft disc that stands in for a blurred circle, without a per-frame blur. */
function glowPaint(color: string, radius: number, stops: readonly number[], alphas: readonly number[]) {
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  const shader = Skia.Shader.MakeRadialGradient(
    Skia.Point(0, 0),
    radius,
    alphas.map((alpha) => colorOf(color, alpha)),
    [...stops],
    0,
  );
  if (shader) paint.setShader(shader);
  return paint;
}

// ─── Labels ────────────────────────────────────────────────────────────────
// Labels use the Paragraph API: Inter from the app bundle, with automatic
// fallback to the system fonts for glyphs Inter lacks, such as the emoji in
// "Güneş ☀️" or the sector symbols. Widths are measured by the shaper, so
// pills fit their text.

/** Family name the canvas registers Inter under (see useFonts there). */
export const LABEL_FONT_FAMILY = 'Inter';
const LABEL_LAYOUT_WIDTH = 2000;

interface TextSpec {
  readonly size: number;
  readonly weight: 'regular' | 'semibold';
  readonly color: string;
}

interface PillStyle {
  readonly text: TextSpec;
  readonly background: string;
  readonly border: string | null;
  readonly paddingX: number;
  readonly top: number;
  readonly height: number;
  readonly radius: number;
}

const HERO_PILL: PillStyle = {
  text: { size: 12, weight: 'semibold', color: '#FDE68A' },
  background: 'rgba(15, 23, 42, 0.94)',
  border: 'rgba(245, 158, 11, 0.75)',
  paddingX: 8,
  top: -12,
  height: 20,
  radius: 10,
};
const CLAIMED_PILL: PillStyle = {
  text: { size: 12, weight: 'semibold', color: '#E0F2FE' },
  background: 'rgba(15, 23, 42, 0.9)',
  border: 'rgba(147, 197, 253, 0.5)',
  paddingX: 8,
  top: -12,
  height: 20,
  radius: 10,
};
const SUN_PILL: PillStyle = {
  text: { size: 10, weight: 'regular', color: '#FDE68A' },
  background: 'rgba(20, 15, 5, 0.9)',
  border: 'rgba(245, 158, 11, 0.8)',
  paddingX: 8,
  top: -12,
  height: 20,
  radius: 10,
};
const CONNECTION_PILL: PillStyle = {
  text: { size: 10, weight: 'regular', color: '#F472B6' },
  background: 'rgba(24, 15, 36, 0.85)',
  border: null,
  paddingX: 6,
  top: -10,
  height: 16,
  radius: 8,
};

function layoutParagraph(text: string, provider: SkTypefaceFontProvider, spec: TextSpec) {
  const builder = Skia.ParagraphBuilder.Make({ maxLines: 1 }, provider);
  builder.pushStyle({
    color: Skia.Color(spec.color),
    fontFamilies: [LABEL_FONT_FAMILY],
    fontSize: spec.size,
    fontStyle: { weight: (spec.weight === 'semibold' ? 600 : 400) as FontWeight },
  });
  builder.addText(text);
  const paragraph = builder.build();
  paragraph.layout(LABEL_LAYOUT_WIDTH);
  return paragraph;
}

/** Pill centred on x = 0 spanning `top`…`top + height`, text vertically centred. */
function recordPill(text: string, provider: SkTypefaceFontProvider, style: PillStyle) {
  return record((canvas) => {
    const paragraph = layoutParagraph(text, provider, style.text);
    const textWidth = paragraph.getLongestLine();
    const rect = Skia.RRectXY(
      Skia.XYWHRect(-textWidth / 2 - style.paddingX, style.top, textWidth + style.paddingX * 2, style.height),
      style.radius,
      style.radius,
    );
    canvas.drawRRect(rect, fillPaint(style.background));
    if (style.border) canvas.drawRRect(rect, strokePaint(style.border, 1.2));
    paragraph.paint(canvas, -textWidth / 2, style.top + (style.height - paragraph.getHeight()) / 2);
  });
}

/** Bare text centred on x = 0 with its baseline on y = 0. */
function recordText(text: string, provider: SkTypefaceFontProvider, spec: TextSpec) {
  return record((canvas) => {
    const paragraph = layoutParagraph(text, provider, spec);
    const baseline = paragraph.getLineMetrics()[0]?.baseline ?? spec.size;
    paragraph.paint(canvas, -paragraph.getLongestLine() / 2, -baseline);
  });
}

/** Caches label pictures by style and text across overlay rebuilds. */
export class LabelPictureCache {
  private readonly pictures = new Map<string, SkPicture>();

  get(key: string, create: () => SkPicture) {
    let picture = this.pictures.get(key);
    if (!picture) {
      picture = create();
      this.pictures.set(key, picture);
      if (this.pictures.size > 256) {
        const oldest = this.pictures.keys().next().value as string | undefined;
        if (oldest !== undefined) this.pictures.delete(oldest);
      }
    }
    return picture;
  }
}

// ─── Static assets ─────────────────────────────────────────────────────────

interface StaticOverlayAssets {
  readonly background: SkPicture;
  readonly milkyWay: readonly NebulaItem[];
  readonly nebulae: readonly NebulaItem[];
  readonly constellations: readonly number[];
  readonly constellationPaint: SkPaint;
  readonly connectionNode: SkPicture;
  readonly heroMarker: SkPicture;
  readonly sunMarker: SkPicture;
  readonly earthMarker: SkPicture;
  readonly venusMarker: SkPicture;
  readonly moonMarker: SkPicture;
  readonly mercuryMarker: SkPicture;
  readonly marsMarker: SkPicture;
  readonly jupiterMarker: SkPicture;
  readonly saturnMarker: SkPicture;
  readonly uranusMarker: SkPicture;
  readonly neptuneMarker: SkPicture;
  readonly plutoMarker: SkPicture;
}

/** Fonts-independent pictures and paints; build once per viewport size. */
export function createStaticOverlayAssets(width: number, height: number): StaticOverlayAssets {
  const background = record((canvas) => {
    const paint = Skia.Paint();
    const shader = Skia.Shader.MakeRadialGradient(
      Skia.Point(width / 2, height / 2),
      Math.max(width, height) * 1.2,
      [Skia.Color('#0A0F1E'), Skia.Color('#020408')],
      null,
      0,
    );
    if (shader) paint.setShader(shader);
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint);
  }, Math.max(width, height) * 2);

  const milkyWayGlow = record((canvas) => {
    const paint = glowPaint('#8B9CFF', 1, [0, 0.4, 0.75, 1], [0.15, 0.08, 0.025, 0]);
    paint.setBlendMode(12); // Plus (additive), as the nebula glows do
    canvas.drawCircle(0, 0, 1, paint);
  }, 2);
  const milkyWay: NebulaItem[] = buildMilkyWayPath().map((point) => ({
    ra: point.ra,
    dec: point.dec,
    radiusDeg: MILKY_WAY_RADIUS_DEG,
    picture: milkyWayGlow,
  }));

  const nebulae = SKY_SECTORS_LIST.map((sector) => {
    const color = sector.nebulaPalette?.[0] ?? '#38BDF8';
    const picture = record((canvas) => {
      const paint = glowPaint(color, 1, [0, 0.5, 1], [0.22, 0.06, 0]);
      paint.setBlendMode(12); // Plus (additive), as the previous renderer used
      canvas.drawCircle(0, 0, 1, paint);
    }, 2);
    return { ra: sector.center.ra, dec: sector.center.dec, radiusDeg: NEBULA_RADIUS_DEG, picture };
  });

  const constellations: number[] = [];
  for (const line of CONSTELLATION_LINES) {
    constellations.push(line.from.ra, line.from.dec, line.to.ra, line.to.dec);
  }

  const heroMarker = record((canvas) => {
    canvas.drawCircle(0, 0, 50, glowPaint('#F59E0B', 50, [0, 0.6, 1], [0.28, 0.16, 0]));
    canvas.drawCircle(0, 0, 25, glowPaint('#FBBF24', 25, [0, 0.65, 1], [0.6, 0.38, 0]));
    canvas.drawCircle(0, 0, 11, strokePaint('#F59E0B', 2));
    canvas.drawCircle(0, 0, 5.5, fillPaint('#FFFFFF'));
  });

  // Unit radius: the frame scales it by the zoom-dependent sun radius.
  const sunMarker = record((canvas) => {
    const corona = Skia.Paint();
    corona.setAntiAlias(true);
    const shader = Skia.Shader.MakeRadialGradient(
      Skia.Point(0, 0),
      2.8,
      [
        Skia.Color('rgba(255, 255, 255, 0.95)'),
        Skia.Color('rgba(251, 191, 36, 0.85)'),
        Skia.Color('rgba(245, 158, 11, 0.45)'),
        Skia.Color('rgba(239, 68, 68, 0.15)'),
        Skia.Color('rgba(239, 68, 68, 0)'),
      ],
      [0, 0.2, 0.45, 0.75, 1],
      0,
    );
    if (shader) corona.setShader(shader);
    canvas.drawCircle(0, 0, 2.8, corona);
    canvas.drawCircle(0, 0, 0.7, fillPaint('#FFFDF0'));
  }, 4);

  const earthMarker = record((canvas) => {
    canvas.drawCircle(0, 0, 16, glowPaint('#38BDF8', 16, [0, 0.45, 1], [0.6, 0.35, 0]));
    canvas.drawCircle(0, 0, 4.5, fillPaint('#38BDF8'));
    canvas.drawCircle(0, 0, 1.8, fillPaint('#FFFFFF'));
  });

  const venusMarker = record((canvas) => {
    canvas.drawCircle(0, 0, 6, fillPaint('rgba(251, 191, 36, 0.5)'));
    canvas.drawCircle(0, 0, 3.5, fillPaint('#FFE5C2'));
  });

  const moonMarker = record((canvas) => {
    canvas.drawCircle(0, 0, 5, fillPaint('rgba(226, 232, 240, 0.5)'));
    canvas.drawCircle(0, 0, 2.8, fillPaint('#E2E8F0'));
  });

  const mercuryMarker = record((canvas) => {
    canvas.drawCircle(0, 0, 5, fillPaint('rgba(203, 213, 225, 0.4)'));
    canvas.drawCircle(0, 0, 2.5, fillPaint('#CBD5E1'));
  });

  const marsMarker = record((canvas) => {
    canvas.drawCircle(0, 0, 10, glowPaint('#EF4444', 10, [0, 0.5, 1], [0.5, 0.2, 0]));
    canvas.drawCircle(0, 0, 3.8, fillPaint('#EF4444'));
    canvas.drawCircle(0, 0, 1.2, fillPaint('#FCA5A5'));
  });

  const jupiterMarker = record((canvas) => {
    canvas.drawCircle(0, 0, 22, glowPaint('#F59E0B', 22, [0, 0.5, 1], [0.5, 0.2, 0]));
    canvas.drawCircle(0, 0, 7.5, fillPaint('#F59E0B'));
    canvas.drawCircle(0, 0, 5.0, fillPaint('#FDE68A'));
    canvas.drawCircle(0, 0, 2.0, fillPaint('#FFFFFF'));
  });

  const saturnMarker = record((canvas) => {
    canvas.drawCircle(0, 0, 18, glowPaint('#FDE047', 18, [0, 0.5, 1], [0.4, 0.15, 0]));
    // Tilted ring
    canvas.save();
    canvas.rotate(-25, 0, 0);
    canvas.drawOval(Skia.XYWHRect(-12, -4, 24, 8), strokePaint('rgba(253, 224, 71, 0.8)', 1.8));
    canvas.restore();
    // Planet body
    canvas.drawCircle(0, 0, 5.5, fillPaint('#EAB308'));
    canvas.drawCircle(0, 0, 2.0, fillPaint('#FEF08A'));
  });

  const uranusMarker = record((canvas) => {
    canvas.drawCircle(0, 0, 14, glowPaint('#22D3EE', 14, [0, 0.5, 1], [0.45, 0.18, 0]));
    canvas.drawCircle(0, 0, 4.8, fillPaint('#06B6D4'));
    canvas.drawCircle(0, 0, 1.8, fillPaint('#CFFAFE'));
  });

  const neptuneMarker = record((canvas) => {
    canvas.drawCircle(0, 0, 14, glowPaint('#3B82F6', 14, [0, 0.5, 1], [0.5, 0.2, 0]));
    canvas.drawCircle(0, 0, 4.8, fillPaint('#2563EB'));
    canvas.drawCircle(0, 0, 1.8, fillPaint('#BFDBFE'));
  });

  const plutoMarker = record((canvas) => {
    canvas.drawCircle(0, 0, 4, fillPaint('rgba(192, 132, 252, 0.4)'));
    canvas.drawCircle(0, 0, 2.0, fillPaint('#C084FC'));
  });

  const connectionNode = record((canvas) => {
    canvas.drawCircle(0, 0, 7, strokePaint('rgba(244, 114, 182, 0.8)', 1.2));
  });

  return {
    background,
    milkyWay,
    nebulae,
    constellations,
    constellationPaint: strokePaint('rgba(255, 255, 255, 0.18)', 1),
    connectionNode,
    heroMarker,
    sunMarker,
    earthMarker,
    venusMarker,
    moonMarker,
    mercuryMarker,
    marsMarker,
    jupiterMarker,
    saturnMarker,
    uranusMarker,
    neptuneMarker,
    plutoMarker,
  };
}

// ─── Assembly ──────────────────────────────────────────────────────────────

export interface SkyOverlayInput {
  readonly assets: StaticOverlayAssets;
  /** Label fonts; labels are skipped until it has loaded. */
  readonly fontProvider: SkTypefaceFontProvider | null;
  readonly labels: LabelPictureCache;
  readonly myStar: { readonly ra: number; readonly dec: number; readonly name?: string } | null;
  readonly connections: readonly ActiveStarConnection[];
  readonly stars: readonly ViewportStarItem[];
  readonly solarObjects: readonly ViewportStarItem[];
}

const SMALL_TEXT = { size: 10, weight: 'regular' } as const;

export function buildSkyOverlay({
  assets,
  fontProvider,
  labels,
  myStar,
  connections,
  stars,
  solarObjects,
}: SkyOverlayInput): SkyOverlay {
  const pill = (text: string, style: PillStyle, kind: string) =>
    fontProvider ? labels.get(`${kind}|${text}`, () => recordPill(text, fontProvider, style)) : null;
  const plain = (text: string, spec: TextSpec) =>
    fontProvider
      ? labels.get(`text|${spec.size}|${spec.weight}|${spec.color}|${text}`, () => recordText(text, fontProvider, spec))
      : null;

  const sectorLabels: PositionedPicture[] = [];
  for (const sector of SKY_SECTORS_LIST) {
    const picture = plain(`${sector.symbol} ${sector.name}`, {
      size: 14,
      weight: 'semibold',
      color: sector.themeColor || 'rgba(255,255,255,0.6)',
    });
    if (picture) sectorLabels.push({ ra: sector.center.ra, dec: sector.center.dec, picture });
  }

  const hero: HeroItem | null = myStar
    ? {
        ra: myStar.ra,
        dec: myStar.dec,
        picture: assets.heroMarker,
        label: pill(`⭐ ${myStar.name || 'Bizim Yıldızımız ✨'}`, HERO_PILL, 'hero'),
      }
    : null;

  const connectionItems: ConnectionItem[] = [];
  if (myStar) {
    for (const connection of connections) {
      const ra = Number(connection.other_star_ra);
      const dec = Number(connection.other_star_dec);
      if (!Number.isFinite(ra) || !Number.isFinite(dec)) continue;
      connectionItems.push({
        ra,
        dec,
        label: pill(`🔗 ${connection.other_star_name}`, CONNECTION_PILL, 'connection'),
      });
    }
  }

  const solar: SolarItem[] = [];
  for (const object of solarObjects) {
    switch (object.catalog_code) {
      case 'SOL-SUN':
        solar.push({ ra: object.ra, dec: object.dec, picture: assets.sunMarker, isSun: true, label: pill('Güneş ☀️', SUN_PILL, 'sun'), labelOffsetY: 18 });
        break;
      case 'SOL-EARTH':
        solar.push({ ra: object.ra, dec: object.dec, picture: assets.earthMarker, isSun: false, label: plain('Dünya 🌍', { ...SMALL_TEXT, color: '#93C5FD' }), labelOffsetY: 18 });
        break;
      case 'SOL-VENUS':
        solar.push({ ra: object.ra, dec: object.dec, picture: assets.venusMarker, isSun: false, label: plain('Venüs ✨', { ...SMALL_TEXT, color: '#FDE68A' }), labelOffsetY: 18 });
        break;
      case 'SOL-MOON':
        solar.push({ ra: object.ra, dec: object.dec, picture: assets.moonMarker, isSun: false, label: plain('Ay 🌙', { ...SMALL_TEXT, color: '#CBD5E1' }), labelOffsetY: 16 });
        break;
      case 'SOL-MERCURY':
        solar.push({ ra: object.ra, dec: object.dec, picture: assets.mercuryMarker, isSun: false, label: plain('Merkür ☿', { ...SMALL_TEXT, color: '#CBD5E1' }), labelOffsetY: 16 });
        break;
      case 'SOL-MARS':
        solar.push({ ra: object.ra, dec: object.dec, picture: assets.marsMarker, isSun: false, label: plain('Mars 🔴', { ...SMALL_TEXT, color: '#FCA5A5' }), labelOffsetY: 16 });
        break;
      case 'SOL-JUPITER':
        solar.push({ ra: object.ra, dec: object.dec, picture: assets.jupiterMarker, isSun: false, label: plain('Jüpiter 🪐', { ...SMALL_TEXT, color: '#FDE68A' }), labelOffsetY: 22 });
        break;
      case 'SOL-SATURN':
        solar.push({ ra: object.ra, dec: object.dec, picture: assets.saturnMarker, isSun: false, label: plain('Satürn 🪐', { ...SMALL_TEXT, color: '#FEF08A' }), labelOffsetY: 20 });
        break;
      case 'SOL-URANUS':
        solar.push({ ra: object.ra, dec: object.dec, picture: assets.uranusMarker, isSun: false, label: plain('Uranüs ❄️', { ...SMALL_TEXT, color: '#A5F3FC' }), labelOffsetY: 18 });
        break;
      case 'SOL-NEPTUNE':
        solar.push({ ra: object.ra, dec: object.dec, picture: assets.neptuneMarker, isSun: false, label: plain('Neptün 🌊', { ...SMALL_TEXT, color: '#93C5FD' }), labelOffsetY: 18 });
        break;
      case 'SOL-PLUTO':
        solar.push({ ra: object.ra, dec: object.dec, picture: assets.plutoMarker, isSun: false, label: plain('Plüton 💜', { ...SMALL_TEXT, color: '#E9D5FF' }), labelOffsetY: 14 });
        break;
      default:
        break;
    }
  }

  const claimedLabels: ClaimedLabelItem[] = [];
  for (const star of stars) {
    if (star.is_mine || !star.is_claimed || !star.custom_name) continue;
    const label = pill(star.custom_name, CLAIMED_PILL, 'claimed');
    if (!label) continue;
    claimedLabels.push({
      ra: star.ra,
      dec: star.dec,
      magnitude: star.magnitude,
      spectralType: star.spectral_type || 'G',
      label,
    });
  }

  return {
    background: assets.background,
    milkyWay: assets.milkyWay,
    nebulae: assets.nebulae,
    constellations: assets.constellations,
    constellationPaint: assets.constellationPaint,
    sectorLabels,
    hero,
    connections: connectionItems,
    connectionNode: assets.connectionNode,
    solar,
    claimedLabels,
  };
}
