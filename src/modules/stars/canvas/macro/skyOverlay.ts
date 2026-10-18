import type { SkCanvas, SkFont, SkPaint, SkPicture } from '@shopify/react-native-skia';
import type { ActiveStarConnection, ViewportStarItem } from '../../types/star.types';
import { CONSTELLATION_LINES } from '../../config/constellationLines.data';
import { SKY_SECTORS_LIST } from '../../config/skySectors.data';
import { Skia } from '../skiaBridge';
import { colorOf } from './starTileScene';

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
  readonly nebulae: readonly NebulaItem[];
  /** Flat [fromRa, fromDec, toRa, toDec, ...] segments. */
  readonly constellations: readonly number[];
  readonly constellationPaint: SkPaint;
  readonly sectorLabels: readonly PositionedPicture[];
  readonly hero: HeroItem | null;
  readonly connections: readonly ConnectionItem[];
  readonly connectionLinePaint: SkPaint;
  readonly connectionNode: SkPicture;
  readonly solar: readonly SolarItem[];
  readonly claimedLabels: readonly ClaimedLabelItem[];
}

export interface SkyOverlayFonts {
  readonly label: SkFont | null;
  readonly name: SkFont | null;
  readonly sector: SkFont | null;
}

const NEBULA_RADIUS_DEG = 12;

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

interface PillStyle {
  readonly background: string;
  readonly border: string | null;
  readonly color: string;
  readonly paddingX: number;
  readonly top: number;
  readonly height: number;
  readonly radius: number;
}

const HERO_PILL: PillStyle = {
  background: 'rgba(15, 23, 42, 0.94)',
  border: 'rgba(245, 158, 11, 0.75)',
  color: '#FDE68A',
  paddingX: 8,
  top: -12,
  height: 20,
  radius: 10,
};
const CLAIMED_PILL: PillStyle = {
  background: 'rgba(15, 23, 42, 0.9)',
  border: 'rgba(147, 197, 253, 0.5)',
  color: '#E0F2FE',
  paddingX: 8,
  top: -12,
  height: 20,
  radius: 10,
};
const SUN_PILL: PillStyle = {
  background: 'rgba(20, 15, 5, 0.9)',
  border: 'rgba(245, 158, 11, 0.8)',
  color: '#FDE68A',
  paddingX: 8,
  top: -12,
  height: 20,
  radius: 10,
};
const CONNECTION_PILL: PillStyle = {
  background: 'rgba(24, 15, 36, 0.85)',
  border: null,
  color: '#F472B6',
  paddingX: 6,
  top: -10,
  height: 16,
  radius: 8,
};

/** Pill centred on x = 0; the text baseline sits 2px below y = 0. */
function recordPill(text: string, font: SkFont, style: PillStyle) {
  return record((canvas) => {
    const textWidth = font.getTextWidth(text);
    const rect = Skia.RRectXY(
      Skia.XYWHRect(-textWidth / 2 - style.paddingX, style.top, textWidth + style.paddingX * 2, style.height),
      style.radius,
      style.radius,
    );
    canvas.drawRRect(rect, fillPaint(style.background));
    if (style.border) canvas.drawRRect(rect, strokePaint(style.border, 1.2));
    canvas.drawText(text, -textWidth / 2, 2, fillPaint(style.color), font);
  });
}

/** Bare text centred on x = 0 with its baseline on y = 0. */
function recordText(text: string, font: SkFont, color: string) {
  return record((canvas) => {
    canvas.drawText(text, -font.getTextWidth(text) / 2, 0, fillPaint(color), font);
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
  readonly nebulae: readonly NebulaItem[];
  readonly constellations: readonly number[];
  readonly constellationPaint: SkPaint;
  readonly connectionLinePaint: SkPaint;
  readonly connectionNode: SkPicture;
  readonly heroMarker: SkPicture;
  readonly sunMarker: SkPicture;
  readonly earthMarker: SkPicture;
  readonly venusMarker: SkPicture;
  readonly moonMarker: SkPicture;
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

  const connectionLinePaint = strokePaint('rgba(251, 191, 36, 0.6)', 1.6);
  const dash = Skia.PathEffect.MakeDash([4, 6], 0);
  if (dash) connectionLinePaint.setPathEffect(dash);

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

  const connectionNode = record((canvas) => {
    canvas.drawCircle(0, 0, 7, strokePaint('rgba(244, 114, 182, 0.8)', 1.2));
  });

  return {
    background,
    nebulae,
    constellations,
    constellationPaint: strokePaint('rgba(255, 255, 255, 0.18)', 1),
    connectionLinePaint,
    connectionNode,
    heroMarker,
    sunMarker,
    earthMarker,
    venusMarker,
    moonMarker,
  };
}

// ─── Assembly ──────────────────────────────────────────────────────────────

export interface SkyOverlayInput {
  readonly assets: StaticOverlayAssets;
  readonly fonts: SkyOverlayFonts;
  readonly labels: LabelPictureCache;
  readonly myStar: { readonly ra: number; readonly dec: number; readonly name?: string } | null;
  readonly connections: readonly ActiveStarConnection[];
  readonly stars: readonly ViewportStarItem[];
  readonly solarObjects: readonly ViewportStarItem[];
}

export function buildSkyOverlay({
  assets,
  fonts,
  labels,
  myStar,
  connections,
  stars,
  solarObjects,
}: SkyOverlayInput): SkyOverlay {
  const labelFont = fonts.label;
  const nameFont = fonts.name ?? fonts.label;
  const sectorFont = fonts.sector;

  const pill = (text: string, font: SkFont | null, style: PillStyle, kind: string) =>
    font ? labels.get(`${kind}|${text}`, () => recordPill(text, font, style)) : null;
  const plain = (text: string, font: SkFont | null, color: string) =>
    font ? labels.get(`text|${color}|${text}`, () => recordText(text, font, color)) : null;

  const sectorLabels: PositionedPicture[] = [];
  if (sectorFont) {
    for (const sector of SKY_SECTORS_LIST) {
      const picture = plain(`${sector.symbol} ${sector.name}`, sectorFont, sector.themeColor || 'rgba(255,255,255,0.6)');
      if (picture) sectorLabels.push({ ra: sector.center.ra, dec: sector.center.dec, picture });
    }
  }

  const hero: HeroItem | null = myStar
    ? {
        ra: myStar.ra,
        dec: myStar.dec,
        picture: assets.heroMarker,
        label: pill(`⭐ ${myStar.name || 'Bizim Yıldızımız ✨'}`, nameFont, HERO_PILL, 'hero'),
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
        label: pill(`🔗 ${connection.other_star_name}`, labelFont, CONNECTION_PILL, 'connection'),
      });
    }
  }

  const solar: SolarItem[] = [];
  for (const object of solarObjects) {
    switch (object.catalog_code) {
      case 'SOL-SUN':
        solar.push({ ra: object.ra, dec: object.dec, picture: assets.sunMarker, isSun: true, label: pill('Güneş ☀️', labelFont, SUN_PILL, 'sun'), labelOffsetY: 18 });
        break;
      case 'SOL-EARTH':
        solar.push({ ra: object.ra, dec: object.dec, picture: assets.earthMarker, isSun: false, label: plain('Dünya 🌍', labelFont, '#93C5FD'), labelOffsetY: 18 });
        break;
      case 'SOL-VENUS':
        solar.push({ ra: object.ra, dec: object.dec, picture: assets.venusMarker, isSun: false, label: plain('Venüs ✨', labelFont, '#FDE68A'), labelOffsetY: 18 });
        break;
      case 'SOL-MOON':
        solar.push({ ra: object.ra, dec: object.dec, picture: assets.moonMarker, isSun: false, label: plain('Ay 🌙', labelFont, '#CBD5E1'), labelOffsetY: 16 });
        break;
      default:
        break;
    }
  }

  const claimedLabels: ClaimedLabelItem[] = [];
  for (const star of stars) {
    if (star.is_mine || !star.is_claimed || !star.custom_name) continue;
    const label = pill(star.custom_name, nameFont, CLAIMED_PILL, 'claimed');
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
    nebulae: assets.nebulae,
    constellations: assets.constellations,
    constellationPaint: assets.constellationPaint,
    sectorLabels,
    hero,
    connections: connectionItems,
    connectionLinePaint: assets.connectionLinePaint,
    connectionNode: assets.connectionNode,
    solar,
    claimedLabels,
  };
}
