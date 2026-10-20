/**
 * @file microScene.ts
 * @module modules/stars/canvas/micro
 * @description Yıldızın içi (mikro sistem) sahnesinin saf geometrisi.
 *
 * Skia çizimi, RN katmanları (gezegen isimleri, çift fotoğrafları) ve dokunma
 * testi aynı formülleri kullanır; hepsi UI thread'de bu dosyadaki worklet'lerle
 * hesaplanır, böylece görünen ile dokunulan konum asla ayrışmaz.
 *
 * Yörüngeler eğik bir düzlemde çizilir (y ekseni `tilt` ile basılır): alttaki
 * yarı izleyiciye yakın (büyük, parlak, yıldızın önünde), üstteki yarı uzak
 * (küçük, soluk, yıldızın arkasında).
 */

import type { SkPath, SkPathBuilder } from '@shopify/react-native-skia';
import { Skia } from '../skiaBridge';
import type { OrbitZone, PlanetType, StarSystemMapPlanet } from '../../types/star.types';
import { calculateOrbitalAngularVelocity, ORBIT_CONFIG } from '../../types/star.types';

// ============================================================================
// SABİTLER
// ============================================================================

export const MICRO_PALETTE = {
  gold: '#FBBF24',
  goldSoft: '#FDE68A',
  rose: '#F472B6',
  violet: '#A78BFA',
  sky: '#7DD3FC',
  lockedLight: '#94A3B8',
  lockedDark: '#334155',
} as const;

/** Varsayılan bakış eğikliği (1 = tepeden, 0 = tam yandan). */
export const DEFAULT_TILT = 0.56;
export const MIN_TILT = 0.28;
const MAX_TILT_LIMIT = 0.9;

export const STAR_CORE_RADIUS = 24;
export const CENTER_TOUCH_RADIUS = 46;
export const MIN_PLANET_TOUCH_RADIUS = 28;

/** Sürüklemede 1 radyan dönüş için gereken piksel. */
export const SPIN_PX_PER_RADIAN = 150;
/** Dikey sürüklemede eğikliği 1 birim değiştiren piksel. */
export const TILT_PX_PER_UNIT = 420;

/** İki ruhun (çiftin) yıldız etrafındaki açısal hızı (rad/s). */
export const SOUL_ANGULAR_VELOCITY = 0.7;

/** Gezegen kuyruğunun yörünge boyunca uzunluğu (derece). */
export const PLANET_TRAIL_DEG = 40;
export const SOUL_TRAIL_DEG = 85;

/**
 * Her gövde için (gezegen / ruh) UI thread'de yazılan durum dizisinin adımı:
 * [x, y, ölçek, derinlik, opaklık, ışıkX, ışıkY, açı]
 */
export const BODY_STRIDE = 8;
export const B_X = 0;
export const B_Y = 1;
export const B_SCALE = 2;
export const B_DEPTH = 3;
export const B_ALPHA = 4;
export const B_LIGHT_X = 5;
export const B_LIGHT_Y = 6;
export const B_ANGLE = 7;

/** Gezegen tipine göre gövde yarıçapı (px, derinlik ölçeğinden önce). */
export const PLANET_RADIUS_BY_TYPE: Record<PlanetType, number> = {
  terrestrial: 10,
  gas_giant: 15,
  ice_world: 11,
  ocean_world: 11,
  crystal: 10,
  volcanic: 11,
  desert: 10,
  ringed_giant: 14,
};

// ============================================================================
// YERLEŞİM
// ============================================================================

export interface OrbitLayout {
  readonly cx: number;
  readonly cy: number;
  /** 1. kuşağın yarıçapı */
  readonly inner: number;
  /** 5. kuşağın yarıçapı */
  readonly outer: number;
  readonly step: number;
  /** Çiftin iki ruhunun dolaştığı yakın yörünge */
  readonly soulRadius: number;
  /** Mevcut dikey alana sığan en yüksek eğiklik */
  readonly maxTilt: number;
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

/**
 * Yörünge sistemini HUD'lar arasındaki boş alana yerleştirir.
 * `viewportTop` / `viewportBottom`: üst başlığın altı ve alt panelin üstü (px).
 */
export function computeOrbitLayout(
  width: number,
  height: number,
  viewportTop = 0,
  viewportBottom = height,
): OrbitLayout {
  const top = clamp(viewportTop, 0, height * 0.45);
  const bottom = clamp(viewportBottom, height * 0.55, height);
  const outer = clamp(width / 2 - 26, 120, 210);
  const inner = Math.max(58, outer * 0.38);
  const halfAvailable = Math.max(60, (bottom - top) / 2 - 24);
  return {
    cx: width / 2,
    cy: (top + bottom) / 2,
    inner,
    outer,
    step: (outer - inner) / (ORBIT_CONFIG.ZONE_COUNT - 1),
    soulRadius: inner * 0.62,
    maxTilt: clamp(halfAvailable / outer, MIN_TILT + 0.08, MAX_TILT_LIMIT),
  };
}

export function zoneRadius(layout: OrbitLayout, zone: number): number {
  const safeZone = clamp(Math.round(zone) || 1, 1, ORBIT_CONFIG.ZONE_COUNT);
  return layout.inner + (safeZone - 1) * layout.step;
}

/** Gezegenin yörüngedeki başlangıç açısı: id'den türetilir, her açılışta aynı. */
export function deterministicPhase(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % 360) * (Math.PI / 180);
}

/** Worklet'lere kapanış olarak verilen, gezegen başına sabit yörünge parametreleri. */
export interface PlanetOrbitSpec {
  readonly orbitRadius: number;
  readonly omega: number;
  readonly phase: number;
  readonly radius: number;
}

export function buildPlanetSpecs(
  planets: readonly StarSystemMapPlanet[],
  layout: OrbitLayout,
): PlanetOrbitSpec[] {
  return planets.map((planet) => ({
    orbitRadius: zoneRadius(layout, planet.orbit_distance),
    omega: calculateOrbitalAngularVelocity(
      clamp(Math.round(planet.orbit_distance) || 1, 1, ORBIT_CONFIG.ZONE_COUNT) as OrbitZone,
      planet.orbit_speed || 1,
    ),
    phase: deterministicPhase(planet.id),
    radius: PLANET_RADIUS_BY_TYPE[planet.planet_type] ?? 10,
  }));
}

/** Açılış animasyonunda yörüngeler merkezden dışarı açılır. */
export function introOrbitFactor(intro: number): number {
  'worklet';
  return 0.3 + 0.7 * intro;
}

/**
 * Eğik düzlemdeki bir gövdenin ekran durumunu `out` dizisine yazar.
 * Derinlik = sin(açı): +1 izleyiciye en yakın (altta), -1 en uzak (üstte).
 */
export function writeBodyState(
  out: number[],
  base: number,
  cx: number,
  cy: number,
  orbitRadius: number,
  angle: number,
  tilt: number,
  intro: number,
) {
  'worklet';
  const r = orbitRadius * introOrbitFactor(intro);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x = cx + cos * r;
  const y = cy + sin * r * tilt;
  // Eğiklik azaldıkça (yandan bakış) perspektif farkı büyür.
  const perspective = 1 - tilt;
  const scale = (1 + 0.34 * perspective * sin) * (0.25 + 0.75 * intro);
  // Işık yönü: gövdeden yıldıza (ekranda), birim vektör.
  const lx = cx - x;
  const ly = cy - y;
  const len = Math.sqrt(lx * lx + ly * ly);
  out[base + B_X] = x;
  out[base + B_Y] = y;
  out[base + B_SCALE] = scale;
  out[base + B_DEPTH] = sin;
  out[base + B_ALPHA] = (0.72 + 0.28 * (sin + 1) * 0.5) * intro;
  out[base + B_LIGHT_X] = len > 0.001 ? lx / len : 0;
  out[base + B_LIGHT_Y] = len > 0.001 ? ly / len : -1;
  out[base + B_ANGLE] = angle;
}

// ============================================================================
// RENK YARDIMCILARI
// ============================================================================

export function hexToRgb(hex: string | null | undefined): [number, number, number] {
  const clean = (hex || '').replace('#', '');
  if (clean.length < 6) return [200, 200, 255];
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return [200, 200, 255];
  return [r, g, b];
}

export function rgba(hex: string | null | undefined, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

/** Rengi beyaza (amount > 0) veya siyaha (amount < 0) doğru karıştırır. */
export function shade(hex: string | null | undefined, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const target = amount >= 0 ? 255 : 0;
  const k = Math.abs(amount);
  const mixChannel = (c: number) => Math.round(c + (target - c) * k);
  const toHex = (c: number) => mixChannel(c).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Bir gezegeni çizmek için gereken görünüm alanları (harita kaydı, tam kayıt veya form önizlemesi). */
export type PlanetLook = Pick<StarSystemMapPlanet, 'palette' | 'planet_type' | 'is_locked'>;

/** Gezegenin iki ana rengi (kilitli gezegenler gri tonlarda). */
export function planetColors(planet: PlanetLook): { primary: string; secondary: string } {
  if (planet.is_locked) {
    return { primary: MICRO_PALETTE.lockedLight, secondary: MICRO_PALETTE.lockedDark };
  }
  const primary = planet.palette[0] || '#4FACFE';
  const secondary = planet.palette[1] || planet.palette[0] || '#00F2FE';
  return { primary, secondary };
}

export function isRingedPlanet(planet: PlanetLook): boolean {
  return planet.planet_type === 'ringed_giant' || planet.planet_type === 'gas_giant';
}

// ============================================================================
// ARKA PLAN YILDIZ ALANI (deterministik — her çiftin gökyüzü kendine özgü)
// ============================================================================

function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface StarfieldLayers {
  readonly dust: { x: number; y: number }[];
  readonly small: { x: number; y: number }[];
  readonly bright: { x: number; y: number }[];
}

/**
 * Ekran merkezli bir disk içine dağılmış üç katman yıldız. Disk ekran
 * köşegeninden geniştir; katman yavaşça döndüğünde köşeler boş kalmaz.
 */
export function createStarfield(seedText: string, width: number, height: number): StarfieldLayers {
  const rand = mulberry32(hashString(seedText || 'our-star'));
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.sqrt(width * width + height * height) / 2 + 24;
  const scatter = (count: number) => {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = radius * Math.sqrt(rand());
      points.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist });
    }
    return points;
  };
  return { dust: scatter(120), small: scatter(48), bright: scatter(14) };
}

// ============================================================================
// PATH ÜRETİCİLERİ (yalnızca Skia mevcutken çağrılır)
// ============================================================================

type PathSink = Pick<SkPathBuilder, 'moveTo' | 'lineTo' | 'close' | 'addArc'>;

function buildPath(draw: (sink: PathSink) => void): SkPath {
  if (Skia.PathBuilder) {
    const builder = Skia.PathBuilder.Make();
    draw(builder);
    return builder.build();
  }
  const path = Skia.Path.Make();
  draw(path as unknown as PathSink);
  return path;
}

/** Merkezli çember yayı (derece). */
export function makeArcPath(radius: number, startDeg: number, sweepDeg: number): SkPath {
  return buildPath((sink) => {
    sink.addArc({ x: -radius, y: -radius, width: radius * 2, height: radius * 2 }, startDeg, sweepDeg);
  });
}

/** Elips yayı (halkalar için: arka yarı 180→360, ön yarı 0→180). */
export function makeOvalArcPath(rx: number, ry: number, startDeg: number, sweepDeg: number): SkPath {
  return buildPath((sink) => {
    sink.addArc({ x: -rx, y: -ry, width: rx * 2, height: ry * 2 }, startDeg, sweepDeg);
  });
}

/**
 * Kırınım hüzmeleri: verilen açılarda merkezden geçen ince eşkenar dörtgenler
 * (her biri iki uçlu bir ışık iğnesi). JWST fotoğraflarındaki yıldız ışıltısı.
 */
export function makeSpikePath(length: number, halfWidth: number, anglesDeg: readonly number[]): SkPath {
  return buildPath((sink) => {
    for (const deg of anglesDeg) {
      const a = (deg * Math.PI) / 180;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const px = -uy * halfWidth;
      const py = ux * halfWidth;
      sink.moveTo(ux * length, uy * length);
      sink.lineTo(px, py);
      sink.lineTo(-ux * length, -uy * length);
      sink.lineTo(-px, -py);
      sink.close();
    }
  });
}

/** Dört kollu küçük parıltı (kristal gezegen yüzeyi için). */
export function makeSparklePath(size: number): SkPath {
  const w = size * 0.22;
  return buildPath((sink) => {
    sink.moveTo(0, -size);
    sink.lineTo(w, -w);
    sink.lineTo(size, 0);
    sink.lineTo(w, w);
    sink.lineTo(0, size);
    sink.lineTo(-w, w);
    sink.lineTo(-size, 0);
    sink.lineTo(-w, -w);
    sink.close();
  });
}
