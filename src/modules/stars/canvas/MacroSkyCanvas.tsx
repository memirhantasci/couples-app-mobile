import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, runOnJS, useDerivedValue, withTiming, cancelAnimation, Easing } from 'react-native-reanimated';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import * as Haptics from 'expo-haptics';
import { Sparkles } from 'lucide-react-native';
import { Canvas, Group, Picture, Skia, useFont, isSkiaAvailable } from './skiaBridge';
import type {
  ActiveStarConnection,
  ViewportStarItem,
  SkyCameraState,
} from '@/modules/stars/types/star.types';
import { CONSTELLATION_LINES } from '../config/constellationLines.data';
import { SKY_SECTORS_LIST } from '../config/skySectors.data';

export interface MacroSkyBounds {
  readonly minRa: number;
  readonly maxRa: number;
  readonly minDec: number;
  readonly maxDec: number;
  readonly zoomLevel: number;
}

export interface MacroSkyCanvasProps {
  readonly stars: ViewportStarItem[];
  readonly initialCamera?: Partial<SkyCameraState>;
  readonly targetCamera?: { readonly centerRa: number; readonly centerDec: number; readonly zoom?: number; readonly nonce?: number };
  readonly onSelectStar?: (star: ViewportStarItem) => void;
  readonly onBoundsChange?: (bounds: MacroSkyBounds) => void;
  readonly onCameraChange?: (camera: SkyCameraState) => void;
  readonly connections?: ActiveStarConnection[];
  readonly myStarCoords?: { readonly ra: number; readonly dec: number; readonly name?: string };
  readonly width?: number;
  readonly height?: number;
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 35.0;
// Keep enough world-space coverage around a committed camera that a long swipe
// cannot reveal an unpainted edge while its replacement picture is recorded.
const OVERSCAN_PAD = 2400;
// Rebase only after the retained world transform nears the overscan edge. This
// keeps ordinary gestures repaint-free while allowing unlimited exploration.
const WORLD_REBASE_PAN_PX = 1440;
const WORLD_REBASE_MIN_SCALE = 0.55;
const WORLD_REBASE_MAX_SCALE = 2.2;
const FRUSTUM_PADDING = 50;
const RENDER_TILE_DEGREES = 30;
const MAX_TILE_PICTURES = 50;

type RenderLod = 'low' | 'medium' | 'high';

type PaintPool = {
  lowPaint: any;
  lowRingPaint: any;
  resonanceGoldPaint: any;
  resonancePurplePaint: any;
  mediumGlowPaint: any;
  mediumCorePaint: any;
  highGlowPaint: any;
  highCorePaint: any;
  highClaimPaint: any;
  highHotCenterPaint: any;
  myStarRingPaint: any;
  pillBgPaint: any;
  pillBorderPaint: any;
  labelPaint: any;
};

type TilePictureEntry = {
  readonly picture: any;
};

type StarTilePicture = {
  readonly key: string;
  readonly picture: any;
  readonly x: number;
  readonly y: number;
};

const EMPTY_STARS: ViewportStarItem[] = [];

function createPaintPool(): PaintPool {
  const lowPaint = Skia.Paint();
  const lowRingPaint = Skia.Paint();
  lowRingPaint.setStyle(1);
  lowRingPaint.setStrokeWidth(1.5);

  const resonanceGoldPaint = Skia.Paint();
  resonanceGoldPaint.setStyle(1);
  resonanceGoldPaint.setStrokeWidth(1.25);

  const resonancePurplePaint = Skia.Paint();
  resonancePurplePaint.setStyle(1);
  resonancePurplePaint.setStrokeWidth(1.25);

  const myStarRingPaint = Skia.Paint();
  myStarRingPaint.setStyle(1);
  myStarRingPaint.setStrokeWidth(1.8);
  const myDash = Skia.PathEffect.MakeDash([4, 4], 0);
  if (myDash) myStarRingPaint.setPathEffect(myDash);

  const pillBorderPaint = Skia.Paint();
  pillBorderPaint.setStyle(1);
  pillBorderPaint.setStrokeWidth(1.2);

  return {
    lowPaint,
    lowRingPaint,
    resonanceGoldPaint,
    resonancePurplePaint,
    mediumGlowPaint: Skia.Paint(),
    mediumCorePaint: Skia.Paint(),
    highGlowPaint: Skia.Paint(),
    highCorePaint: Skia.Paint(),
    highClaimPaint: Skia.Paint(),
    highHotCenterPaint: Skia.Paint(),
    myStarRingPaint,
    pillBgPaint: Skia.Paint(),
    pillBorderPaint,
    labelPaint: Skia.Paint(),
  };
}

function getRenderLod(zoom: number): RenderLod {
  if (zoom < 1.5) return 'low';
  if (zoom < 4) return 'medium';
  return 'high';
}

function isInFrustum(x: number, y: number, width: number, height: number, padding = FRUSTUM_PADDING) {
  return x >= -padding && x <= width + padding && y >= -padding && y <= height + padding;
}

function tileKeyForStar(star: ViewportStarItem): string {
  const raTile = Math.floor((((star.ra % 360) + 360) % 360) / RENDER_TILE_DEGREES);
  const decTile = Math.floor((Math.max(-90, Math.min(89.9999, star.dec)) + 90) / RENDER_TILE_DEGREES);
  return `${raTile}:${decTile}`;
}

function tileCenterFromKey(key: string) {
  const [raIndex, decIndex] = key.split(':').map(Number);
  return {
    ra: raIndex * RENDER_TILE_DEGREES + RENDER_TILE_DEGREES / 2,
    dec: decIndex * RENDER_TILE_DEGREES - 90 + RENDER_TILE_DEGREES / 2,
  };
}

function disposePicture(picture: any) {
  try {
    picture?.dispose?.();
  } catch {
    // A disposed Skia picture is safe to ignore during cache eviction.
  }
}

function clusterVisibleStars(
  stars: readonly ViewportStarItem[],
  camera: SkyCameraState,
  width: number,
  height: number,
) {
  const clusters = new Map<string, { x: number; y: number; count: number }>();
  for (const star of stars) {
    const position = projectToScreen(star.ra, star.dec, camera, width, height);
    if (!isInFrustum(position.x, position.y, width, height)) continue;
    const key = `${Math.floor(position.x / 72)}:${Math.floor(position.y / 72)}`;
    const existing = clusters.get(key);
    if (existing) {
      existing.x = (existing.x * existing.count + position.x) / (existing.count + 1);
      existing.y = (existing.y * existing.count + position.y) / (existing.count + 1);
      existing.count += 1;
    } else {
      clusters.set(key, { x: position.x, y: position.y, count: 1 });
    }
  }
  return Array.from(clusters.values());
}

export const SOLAR_SYSTEM_OBJECTS: ViewportStarItem[] = [
  {
    catalog_id: 999901,
    catalog_code: 'SOL-SUN',
    common_name: 'Güneş',
    ra: 280.4600,
    dec: -23.4400,
    magnitude: -26.74,
    spectral_type: 'G2V',
    base_color: '#FFF4E8',
    is_claimed: true,
    is_mine: false,
    custom_name: 'Güneş ☀️',
    luminosity_level: 1.0,
    resonance_active: true,
  },
  {
    catalog_id: 999902,
    catalog_code: 'SOL-EARTH',
    common_name: 'Dünya',
    ra: 100.4600,
    dec: 23.4400,
    magnitude: -3.80,
    spectral_type: 'Terrestrial',
    base_color: '#38BDF8',
    is_claimed: true,
    is_mine: false,
    custom_name: 'Dünya 🌍',
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999903,
    catalog_code: 'SOL-VENUS',
    common_name: 'Venüs',
    ra: 243.6000,
    dec: -19.9000,
    magnitude: -4.40,
    spectral_type: 'Terrestrial',
    base_color: '#FFE5C2',
    is_claimed: true,
    is_mine: false,
    custom_name: 'Venüs ✨',
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999904,
    catalog_code: 'SOL-MOON',
    common_name: 'Ay',
    ra: 101.2000,
    dec: 23.1000,
    magnitude: -12.74,
    spectral_type: 'Moon',
    base_color: '#E2E8F0',
    is_claimed: true,
    is_mine: false,
    custom_name: 'Ay 🌙',
    luminosity_level: 1.0,
    resonance_active: false,
  },
];

const STAR_BASE_RADIUS_PX: Record<string, number> = {
  O: 3.5, B: 3.2, A: 3.0, F: 2.8, G: 2.6, K: 2.4, M: 2.2,
};
const FALLBACK_STAR_RADIUS = 2.4;

export function computeBounds(camera: Partial<SkyCameraState> & { centerRa: number; centerDec: number; zoom: number }): MacroSkyBounds {
  const fovDec = (60 / camera.zoom) * 1.5;
  const aspect = (camera.viewportWidth && camera.viewportHeight) ? (camera.viewportWidth / camera.viewportHeight) : (390 / 844);
  const fovRa = fovDec * aspect;
  let minRa = camera.centerRa - fovRa / 2;
  let maxRa = camera.centerRa + fovRa / 2;
  const minDec = Math.max(-90, camera.centerDec - fovDec / 2);
  const maxDec = Math.min(90, camera.centerDec + fovDec / 2);

  if (minRa < 0) minRa = ((minRa % 360) + 360) % 360;
  if (maxRa > 360) maxRa = maxRa % 360;

  return { minRa, maxRa, minDec, maxDec, zoomLevel: camera.zoom };
}

function projectToScreen(
  ra: number,
  dec: number,
  camera: SkyCameraState,
  width: number,
  height: number,
) {
  const fovDec = 60 / camera.zoom;
  const fovRa = fovDec * (width / height);
  const deltaRa = ((ra - camera.centerRa + 540) % 360) - 180;
  const deltaDec = dec - camera.centerDec;
  const x = width / 2 + (deltaRa / fovRa) * width;
  const y = height / 2 - (deltaDec / fovDec) * height;
  return { x, y };
}

function magnitudeToRadius(magnitude: number, spectralType: string, zoom: number): number {
  const baseClass = (spectralType || 'G').charAt(0).toUpperCase();
  const baseRadius = STAR_BASE_RADIUS_PX[baseClass] ?? FALLBACK_STAR_RADIUS;
  const magScale = Math.max(0.6, Math.min(3.2, 1 + (3 - magnitude) * 0.25));
  const zoomBonus = Math.min(5.5, 1 + (zoom - 1) * 0.18);
  return baseRadius * magScale * zoomBonus;
}

function hexToRgba(hex: string, alpha: number): Float32Array {
  const clean = hex.replace('#', '');
  let r = 255, g = 255, b = 255;
  if (clean.length >= 6) {
    r = parseInt(clean.substring(0, 2), 16);
    g = parseInt(clean.substring(2, 4), 16);
    b = parseInt(clean.substring(4, 6), 16);
  }
  return Skia.Color(`rgba(${r}, ${g}, ${b}, ${alpha})`);
}

function magnitudeToAlpha(magnitude: number, luminosity: number): number {
  const normalized = Math.max(0, Math.min(1, 1 - (magnitude + 2) / 11));
  return 0.45 + normalized * 0.55 * luminosity;
}

function tileContentSignature(stars: readonly ViewportStarItem[]) {
  return stars
    .map((star) => [
      star.catalog_id,
      star.magnitude,
      star.spectral_type,
      star.base_color,
      star.is_mine ? 1 : 0,
      star.resonance_active ? 1 : 0,
      star.luminosity_level,
      star.custom_name ?? '',
    ].join(':'))
    .join('|');
}

/**
 * Records a tile relative to its centre so the same picture can be translated
 * while panning. The cache key includes the exact zoom because pixel-per-degree
 * changes with zoom; camera translation does not invalidate the tile picture.
 */
function buildLodTilePicture(
  tileStars: readonly ViewportStarItem[],
  tileCenter: { ra: number; dec: number },
  camera: SkyCameraState,
  width: number,
  height: number,
  lod: RenderLod,
  paintPool: PaintPool,
  font: any,
  starNameFont?: any,
) {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(-30000, -30000, 60000, 60000));
  const pixelsPerDegree = height / (60 / camera.zoom);

  for (const star of tileStars) {
    if (star.is_mine) continue; // Rendered authoritatively by Pass 5 Hero Star Beacon in skyBackgroundPicture
    let dRa = star.ra - tileCenter.ra;
    if (dRa > 180) dRa -= 360;
    if (dRa < -180) dRa += 360;
    const localX = dRa * pixelsPerDegree;
    const localY = -(star.dec - tileCenter.dec) * pixelsPerDegree;
    const radius = magnitudeToRadius(star.magnitude, star.spectral_type || 'G', camera.zoom);
    const baseColor = star.base_color || '#FFFFFF';
    const alpha = magnitudeToAlpha(star.magnitude, star.luminosity_level ?? 1);
    const lum = star.luminosity_level ?? 1.0;

    if (lod === 'low') {
      if (star.resonance_active && !star.is_mine) {
        paintPool.resonanceGoldPaint.setColor(hexToRgba('#F59E0B', 0.9));
        paintPool.resonancePurplePaint.setColor(hexToRgba('#A855F7', 0.9));
        canvas.drawCircle(localX, localY, radius * 1.9, paintPool.resonanceGoldPaint);
        canvas.drawCircle(localX, localY, radius * 1.35, paintPool.resonancePurplePaint);
        continue;
      }

      paintPool.lowPaint.setColor(star.is_mine ? Skia.Color('#FBBF24') : hexToRgba(baseColor, alpha));
      canvas.drawCircle(localX, localY, star.is_mine ? radius * 1.8 : radius, paintPool.lowPaint);

      if (star.is_mine) {
        paintPool.lowRingPaint.setColor(Skia.Color('rgba(255,255,255,0.9)'));
        canvas.drawCircle(localX, localY, radius * 1.8 + 2, paintPool.lowRingPaint);
        if (font && star.custom_name) {
          paintPool.labelPaint.setColor(Skia.Color('#FDE68A'));
          const label = star.custom_name;
          canvas.drawText(label, localX - font.getTextWidth(label) / 2, localY + radius * 1.8 + 16, paintPool.labelPaint, font);
        }
      }
      continue;
    }

    if (lod === 'medium') {
      // Medium LOD uses concentric solid circles
      paintPool.mediumGlowPaint.setColor(hexToRgba(baseColor, 1));
      paintPool.mediumGlowPaint.setAlphaf(0.25);
      canvas.drawCircle(localX, localY, radius * 2.5, paintPool.mediumGlowPaint);
      paintPool.mediumGlowPaint.setAlphaf(0.45);
      canvas.drawCircle(localX, localY, radius * 1.6, paintPool.mediumGlowPaint);
      paintPool.mediumCorePaint.setColor(hexToRgba(baseColor, alpha));
      canvas.drawCircle(localX, localY, star.is_mine ? radius * 1.35 : radius, paintPool.mediumCorePaint);

      if (star.resonance_active) {
        paintPool.resonanceGoldPaint.setColor(hexToRgba('#F59E0B', 0.9));
        paintPool.resonancePurplePaint.setColor(hexToRgba('#A855F7', 0.8));
        canvas.drawCircle(localX, localY, radius * 2.2, paintPool.resonanceGoldPaint);
        canvas.drawCircle(localX, localY, radius * 1.75, paintPool.resonancePurplePaint);
      } else if (star.is_mine) {
        paintPool.lowRingPaint.setColor(Skia.Color('#F59E0B'));
        canvas.drawCircle(localX, localY, radius * 1.35 + 4, paintPool.lowRingPaint);
        if (font && star.custom_name) {
          paintPool.labelPaint.setColor(Skia.Color('#FDE68A'));
          const label = star.custom_name;
          canvas.drawText(label, localX - font.getTextWidth(label) / 2, localY + radius * 1.35 + 16, paintPool.labelPaint, font);
        }
      }
      continue;
    }

    // ─── HIGH LOD (zoom >= 4.0) ──────────────────────────────────────
    const isMine = star.is_mine;
    const r = radius * (isMine ? 1.6 : 1.0);

    // 1. Claimed / Resonance Halos
    if (star.resonance_active) {
      paintPool.resonanceGoldPaint.setColor(hexToRgba('#F59E0B', 0.5 * lum));
      canvas.drawCircle(localX, localY, r + 20, paintPool.resonanceGoldPaint);
      paintPool.resonancePurplePaint.setColor(hexToRgba('#A855F7', 0.6 * lum));
      canvas.drawCircle(localX, localY, r + 10, paintPool.resonancePurplePaint);
    } else if (star.is_claimed) {
      paintPool.highClaimPaint.setColor(hexToRgba(baseColor, 0.4 * lum));
      canvas.drawCircle(localX, localY, r + 14, paintPool.highClaimPaint);
    }

    // 2. Core & Aura
    paintPool.highGlowPaint.setColor(hexToRgba(baseColor, alpha * 0.45));
    canvas.drawCircle(localX, localY, r * 2.2, paintPool.highGlowPaint);

    paintPool.highCorePaint.setColor(hexToRgba(baseColor, alpha));
    canvas.drawCircle(localX, localY, r, paintPool.highCorePaint);

    if (star.magnitude <= 3.5 || isMine) {
      paintPool.highHotCenterPaint.setColor(hexToRgba('#FFFFFF', Math.min(1, alpha * 1.2)));
      canvas.drawCircle(localX, localY, Math.max(1, r * 0.35), paintPool.highHotCenterPaint);
    }

    // 3. My Star Golden Ring
    if (isMine) {
      paintPool.myStarRingPaint.setColor(Skia.Color('#F59E0B'));
      canvas.drawCircle(localX, localY, r + 6, paintPool.myStarRingPaint);
    }

    // 4. Name Tag
    const activeFont = starNameFont || font;
    if (activeFont && ((isMine && star.custom_name) || (star.is_claimed && star.custom_name))) {
      const labelText = isMine ? `⭐ ${star.custom_name}` : star.custom_name;
      const textWidth = activeFont.getTextWidth(labelText);
      const labelX = localX - textWidth / 2;
      const labelY = localY + r + 20;

      paintPool.pillBgPaint.setColor(Skia.Color('rgba(15, 23, 42, 0.9)'));
      canvas.drawRRect(
        Skia.RRectXY(Skia.XYWHRect(labelX - 8, labelY - 12, textWidth + 16, 20), 10, 10),
        paintPool.pillBgPaint
      );

      paintPool.pillBorderPaint.setColor(isMine ? Skia.Color('rgba(245, 158, 11, 0.7)') : Skia.Color('rgba(147, 197, 253, 0.5)'));
      canvas.drawRRect(
        Skia.RRectXY(Skia.XYWHRect(labelX - 8, labelY - 12, textWidth + 16, 20), 10, 10),
        paintPool.pillBorderPaint
      );

      paintPool.labelPaint.setColor(isMine ? Skia.Color('#FDE68A') : Skia.Color('#E0F2FE'));
      canvas.drawText(labelText, labelX, labelY + 2, paintPool.labelPaint, activeFont);
    }
  }

  return recorder.finishRecordingAsPicture();
}

function MacroSkyCanvasSkia({
  stars,
  initialCamera,
  targetCamera,
  onSelectStar,
  onBoundsChange,
  onCameraChange,
  connections = [],
  myStarCoords,
  width = 390,
  height = 844,
}: MacroSkyCanvasProps) {
  // Parents construct this prop inline. Keep primitive values so their ordinary
  // re-renders do not invalidate the expensive background SkPicture.
  const myStarRa = myStarCoords?.ra;
  const myStarDec = myStarCoords?.dec;
  const myStarName = myStarCoords?.name;

  
  // Font loading from the bundle
  const font = useFont(Inter_400Regular, 10);
  const starNameFont = useFont(Inter_600SemiBold, 12);
  const sectorFont = useFont(Inter_600SemiBold, 14);

  // Paints are native objects: create them once and only mutate their values
  // while recording. Never put this pool in a memo dependency array.
  const paintPoolRef = useRef<PaintPool | null>(null);
  if (!paintPoolRef.current) {
    paintPoolRef.current = createPaintPool();
  }
  const tilePictureCacheRef = useRef<Map<string, TilePictureEntry>>(new Map());

  // ═══════════════════════════════════════════════════════════════════════
  // CAMERA: useRef — NO React re-render when camera moves during gestures
  // ═══════════════════════════════════════════════════════════════════════
  const cameraRef = React.useRef<SkyCameraState>({
    centerRa: initialCamera?.centerRa ?? 180,
    centerDec: initialCamera?.centerDec ?? 0,
    zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialCamera?.zoom ?? 1.2)),
    fovRa: 60,
    fovDec: 60,
    viewportWidth: width,
    viewportHeight: height,
  });
  // The camera used to record SkPictures. It intentionally stays fixed while
  // the logical camera moves; the GPU transform maps this world to the logical
  // camera without replacing the visible picture after every gesture.
  const renderCameraRef = React.useRef<SkyCameraState>(cameraRef.current);

  // pictureVersion is reserved for an explicit fly-to / viewport reset. Pan
  // and pinch must never change it: replacing a SkPicture is visibly lossy.
  const [pictureVersion, setPictureVersion] = React.useState(0);
  // A network response can arrive while a UI-thread gesture is in progress.
  // Rendering that response against the pre-commit camera then clearing the
  // transform is what caused the visible jump. Hold it until the gesture ends.
  const [pictureStars, setPictureStars] = React.useState(stars);
  const pendingStarsRef = useRef<ViewportStarItem[] | null>(null);
  const activeGestureCountRef = useRef(0);

  // Server data is authoritative and bypasses the pan/zoom throttle when the
  // canvas is idle. While moving, it is applied atomically after camera commit.
  useEffect(() => {
    pendingStarsRef.current = stars;
    if (activeGestureCountRef.current > 0) return;
    setPictureStars((current) => (current === stars ? current : stars));
  }, [stars]);

  useEffect(() => () => {
    for (const entry of tilePictureCacheRef.current.values()) {
      disposePicture(entry.picture);
    }
    tilePictureCacheRef.current.clear();
  }, []);

  // Stable refs for parent callbacks (never cause re-renders)
  const onBoundsChangeRef = React.useRef(onBoundsChange);
  onBoundsChangeRef.current = onBoundsChange;
  const onCameraChangeRef = React.useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;

  // Bounds debounce timer
  const boundsTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const beginCanvasGesture = useCallback(() => {
    activeGestureCountRef.current += 1;
  }, []);

  // Request debounced bounds change (350ms — triggers Supabase RPC)
  const requestBoundsChange = React.useCallback(() => {
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    boundsTimerRef.current = setTimeout(() => {
      onBoundsChangeRef.current?.(computeBounds(cameraRef.current));
    }, 350);
  }, []);

  // Notify parent of camera position (called immediately, not debounced)
  const notifyCameraChange = React.useCallback(() => {
    onCameraChangeRef.current?.(cameraRef.current);
  }, []);

  // Cleanup timers on unmount
  React.useEffect(() => {
    return () => {
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // REANIMATED SHARED VALUES — gesture feedback on UI thread (60fps)
  // ═══════════════════════════════════════════════════════════════════════
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const pinchStartX = useSharedValue(0);
  const pinchStartY = useSharedValue(0);
  const pinchStartFocalX = useSharedValue(0);
  const pinchStartFocalY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const scale = useSharedValue(1);

  // Gesture state guards to prevent simultaneous pan & pinch conflicts
  const isPinching = useSharedValue(false);
  const pinchJustEnded = useSharedValue(false);

  // ─── FLY-TO ANIMATION SHARED VALUES (Reanimated UI-thread worklet) ───────
  // Flight animates from 0 to 1 over withTiming. Translation and scale interpolate
  // seamlessly from starting offsets to target centering offsets without early cancel.
  const isFlying = useSharedValue(false);
  const flightAnim = useSharedValue(0);
  const flyStartX = useSharedValue(0);
  const flyStartY = useSharedValue(0);
  const flyTargetX = useSharedValue(0);
  const flyTargetY = useSharedValue(0);
  const flyStartScale = useSharedValue(1);
  const flyTargetScale = useSharedValue(1);

  // Seamless rebase coordination: reset GPU worklet values synchronously when the new
  // picture has finished rendering, completely eliminating any 1-frame tear or position jump.
  const isRebasingRef = React.useRef(false);

  React.useLayoutEffect(() => {
    if (isRebasingRef.current) {
      isRebasingRef.current = false;
      isFlying.value = false;
      offsetX.value = 0;
      offsetY.value = 0;
      scale.value = 1;
      flightAnim.value = 0;
      flyStartX.value = 0;
      flyStartY.value = 0;
      flyTargetX.value = 0;
      flyTargetY.value = 0;
      flyStartScale.value = 1;
      flyTargetScale.value = 1;
      pinchStartX.value = 0;
      pinchStartY.value = 0;
      pinchStartFocalX.value = 0;
      pinchStartFocalY.value = 0;
      pinchStartScale.value = 1;
    }
  }, [pictureVersion]);

  const endCanvasGesture = useCallback(() => {
    activeGestureCountRef.current = Math.max(0, activeGestureCountRef.current - 1);
    if (activeGestureCountRef.current > 0) return;

    const pendingStars = pendingStarsRef.current;
    pendingStarsRef.current = null;
    if (pendingStars) {
      setPictureStars((current) => (current === pendingStars ? current : pendingStars));
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // INITIAL MOUNT: fire first bounds change
  // ═══════════════════════════════════════════════════════════════════════
  const isInitializedRef = React.useRef(false);
  React.useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      onBoundsChangeRef.current?.(computeBounds(cameraRef.current));
      onCameraChangeRef.current?.(cameraRef.current);
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // FLY-TO TARGET: Google Maps-style smooth animated camera flight
  // The animation runs entirely on the Reanimated UI thread (worklet) so
  // it stays at 60/120fps even if the JS thread is busy with RPC calls.
  // ═══════════════════════════════════════════════════════════════════════

  // JS-thread callback: bake fly-to into the authoritative camera and rebuild.
  const commitFlyEnd = useCallback((targetRa: number, targetDec: number, targetZoom: number) => {
    const nextCamera = {
      ...renderCameraRef.current,
      centerRa: ((targetRa % 360) + 360) % 360,
      centerDec: Math.max(-85, Math.min(85, targetDec)),
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom)),
    };
    cameraRef.current = nextCamera;
    renderCameraRef.current = nextCamera;
    isRebasingRef.current = true;
    setPictureVersion((v) => v + 1);
    notifyCameraChange();
    requestBoundsChange();
  }, [notifyCameraChange, requestBoundsChange]);

  React.useEffect(() => {
    if (!targetCamera) return;
    const base = renderCameraRef.current;

    // Cancel any in-progress animation immediately
    cancelAnimation(flightAnim);
    isFlying.value = false;

    const targetRa  = ((targetCamera.centerRa % 360) + 360) % 360;
    const targetDec = Math.max(-85, Math.min(85, targetCamera.centerDec));
    const targetZoom = targetCamera.zoom ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetCamera.zoom)) : base.zoom;

    // ── Shortest göksel yay (ΔRA): 0°–360° wrapping handled ──────────────
    const fovDecBase = 60 / base.zoom;
    const fovRaBase  = fovDecBase * (width / height);

    // Target position relative to current render camera
    const deltaRa  = ((targetRa  - base.centerRa  + 540) % 360) - 180;
    const deltaDec = targetDec - base.centerDec;
    const angularDist = Math.sqrt(deltaRa * deltaRa + deltaDec * deltaDec);

    const finalTotalScale = targetZoom / base.zoom;

    // In Skia with transform T(cx+tx, cy+ty) * S(s) * T(-cx, -cy):
    // P_screen = cx + totalOffsetX + totalScale * (P_world - cx)
    // To center target at P_screen = cx: totalOffsetX = - totalScale * (P_world - cx)
    // where (P_world - cx) = (deltaRa / fovRaBase) * width
    const targetTotalOffsetX = -finalTotalScale * ((deltaRa  / fovRaBase)  * width);
    const targetTotalOffsetY =  finalTotalScale * ((deltaDec / fovDecBase) * height);

    // Capture starting offsets from current gesture values
    flyStartX.value = offsetX.value;
    flyStartY.value = offsetY.value;
    flyTargetX.value = targetTotalOffsetX;
    flyTargetY.value = targetTotalOffsetY;
    flyStartScale.value = scale.value;
    flyTargetScale.value = finalTotalScale;

    // Flight duration: smooth 650ms minimum up to 1200ms
    const duration = Math.round(Math.min(1200, Math.max(650, 550 + angularDist * 8)));
    const easing = Easing.bezier(0.25, 0.1, 0.25, 1);

    flightAnim.value = 0;
    isFlying.value = true;

    flightAnim.value = withTiming(1, { duration, easing }, (finished) => {
      if (!finished) return;
      runOnJS(commitFlyEnd)(targetRa, targetDec, targetZoom);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetCamera?.centerRa, targetCamera?.centerDec, targetCamera?.zoom, targetCamera?.nonce]);

  // ═══════════════════════════════════════════════════════════════════════
  // COMMIT HANDLERS: update only the logical camera used by bounds/data work.
  // The recorded world stays mounted and is moved by the GPU transform.
  // ═══════════════════════════════════════════════════════════════════════
  const updateCameraFromOffsets = useCallback((curOffsetX: number, curOffsetY: number, curScale: number) => {
    const base = renderCameraRef.current;
    const fovDecBase = 60 / base.zoom;
    const fovRaBase = fovDecBase * (width / height);

    // Exact closed-form inverse of Skia transform:
    // P_screen = C + S * (P_world - C) + Offset
    // At center P_screen = C => P_world - C = -Offset / S
    const dRa = (-curOffsetX / (curScale * width)) * fovRaBase;
    const dDec = (curOffsetY / (curScale * height)) * fovDecBase;

    const nextCamera = {
      ...base,
      centerRa: ((base.centerRa + dRa) % 360 + 360) % 360,
      centerDec: Math.max(-85, Math.min(85, base.centerDec + dDec)),
      zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, base.zoom * curScale)),
    };
    cameraRef.current = nextCamera;
    renderCameraRef.current = nextCamera;
    isRebasingRef.current = true;
    setPictureVersion((v) => v + 1);
    notifyCameraChange();
    requestBoundsChange();
  }, [width, height, notifyCameraChange, requestBoundsChange]);

  const finishPan = useCallback((endOffsetX: number, endOffsetY: number) => {
    updateCameraFromOffsets(endOffsetX, endOffsetY, scale.value);
    endCanvasGesture();
  }, [updateCameraFromOffsets, scale, endCanvasGesture]);

  const finishPinch = useCallback((endScale: number, endOffsetX: number, endOffsetY: number) => {
    updateCameraFromOffsets(endOffsetX, endOffsetY, endScale);
    endCanvasGesture();
  }, [updateCameraFromOffsets, endCanvasGesture]);

  // ═══════════════════════════════════════════════════════════════════════
  // HIT-TESTING: use the exact base-world transform rendered by Skia.
  // Reprojecting through cameraRef after a persistent pinch/pan is subtly
  // different around wraps and clamps, making a visible planet untappable.
  // ═══════════════════════════════════════════════════════════════════════
  const handleTap = useCallback((tx: number, ty: number) => {
    if (!onSelectStar) return;
    const camera = renderCameraRef.current;
    const renderedScale = scale.value;
    const renderedOffsetX = offsetX.value;
    const renderedOffsetY = offsetY.value;
    const centerX = width / 2;
    const centerY = height / 2;
    let minDist = Infinity;
    let nearest: ViewportStarItem | null = null;
    const MIN_TOUCH_RADIUS = 46;

    const allTargets = [...SOLAR_SYSTEM_OBJECTS, ...stars];
    if (myStarRa !== undefined && myStarDec !== undefined) {
      allTargets.unshift({
        catalog_id: 999999,
        catalog_code: 'OUR-STAR',
        common_name: myStarName || 'Bizim Yıldızımız',
        ra: myStarRa,
        dec: myStarDec,
        magnitude: 1.5,
        spectral_type: 'G',
        base_color: '#FBBF24',
        is_claimed: true,
        is_mine: true,
        custom_name: myStarName || 'Bizim Yıldızımız',
        luminosity_level: 1.0,
        resonance_active: false,
      });
    }
    for (const star of allTargets) {
      const basePos = projectToScreen(star.ra, star.dec, camera, width, height);
      const pos = {
        x: centerX + (basePos.x - centerX) * renderedScale + renderedOffsetX,
        y: centerY + (basePos.y - centerY) * renderedScale + renderedOffsetY,
      };
      const isMine = star.is_mine;
      const isSun = star.catalog_code === 'SOL-SUN';
      const baseRadius = magnitudeToRadius(star.magnitude, star.spectral_type || 'G', camera.zoom) * renderedScale;
      const r = baseRadius * (isSun ? 3.0 : (isMine ? 1.6 : 1.0));
      const touchRadius = Math.max(r + 30, star.catalog_code.startsWith('SOL-') ? 56 : MIN_TOUCH_RADIUS);
      const dx = tx - pos.x;
      const dy = ty - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= touchRadius && dist < minDist) {
        minDist = dist;
        nearest = star;
      }
    }
    if (nearest) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
      onSelectStar(nearest);
    } else {
      // User tapped empty sky -> dismiss selection card
      onSelectStar(null as any);
    }
  }, [stars, width, height, onSelectStar, scale, offsetX, offsetY]);

  // ═══════════════════════════════════════════════════════════════════════
  // GESTURE DEFINITIONS
  // ═══════════════════════════════════════════════════════════════════════
  const tap = Gesture.Tap()
    .maxDuration(350)
    .maxDistance(25)
    .onEnd((e) => {
      runOnJS(handleTap)(e.x, e.y);
    });

  // These are relative to the currently recorded world. They are captured by
  // the UI worklet, so visual zoom cannot pass the same limits as cameraRef.
  const minRenderScale = MIN_ZOOM / renderCameraRef.current.zoom;
  const maxRenderScale = MAX_ZOOM / renderCameraRef.current.zoom;

  const pan = Gesture.Pan()
    .minDistance(6)
    .maxPointers(1)
    .onStart(() => {
      // Guard: Ignore pan when pinch is active or just completed to prevent gesture conflict
      if (isPinching.value || pinchJustEnded.value) return;
      // Interrupt any in-flight fly-to animation. Freeze shared values at current mid-flight frame.
      if (isFlying.value) {
        cancelAnimation(flightAnim);
        isFlying.value = false;
        const p = flightAnim.value;
        offsetX.value = flyStartX.value + (flyTargetX.value - flyStartX.value) * p;
        offsetY.value = flyStartY.value + (flyTargetY.value - flyStartY.value) * p;
        scale.value   = flyStartScale.value + (flyTargetScale.value - flyStartScale.value) * p;
      }
      startX.value = offsetX.value;
      startY.value = offsetY.value;
      runOnJS(beginCanvasGesture)();
    })
    .onUpdate((e) => {
      if (isPinching.value || pinchJustEnded.value) return;
      offsetX.value = startX.value + e.translationX;
      offsetY.value = startY.value + e.translationY;
    })
    .onEnd((e) => {
      if (isPinching.value || pinchJustEnded.value) {
        pinchJustEnded.value = false;
        return;
      }
      runOnJS(finishPan)(startX.value + e.translationX, startY.value + e.translationY);
    })
    .onFinalize((_event, success) => {
      if (!success) runOnJS(endCanvasGesture)();
    });

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      isPinching.value = true;
      pinchJustEnded.value = false;
      // Mirror fly-to interrupt logic from pan.onStart
      if (isFlying.value) {
        cancelAnimation(flightAnim);
        isFlying.value = false;
        const p = flightAnim.value;
        offsetX.value = flyStartX.value + (flyTargetX.value - flyStartX.value) * p;
        offsetY.value = flyStartY.value + (flyTargetY.value - flyStartY.value) * p;
        scale.value   = flyStartScale.value + (flyTargetScale.value - flyStartScale.value) * p;
      }
      pinchStartX.value = offsetX.value;
      pinchStartY.value = offsetY.value;
      pinchStartScale.value = scale.value;
      pinchStartFocalX.value = e.focalX;
      pinchStartFocalY.value = e.focalY;
      runOnJS(beginCanvasGesture)();
    })
    .onUpdate((e) => {
      const totalScale = Math.max(
        minRenderScale,
        Math.min(maxRenderScale, pinchStartScale.value * e.scale),
      );
      const k = totalScale / pinchStartScale.value;
      scale.value = totalScale;
      // Mathematically exact focal point anchoring: the point under fingers at pinchStartFocal
      // tracks finger translation to e.focal with zero coordinate drift.
      offsetX.value = (e.focalX - width / 2) - k * (pinchStartFocalX.value - width / 2) + k * pinchStartX.value;
      offsetY.value = (e.focalY - height / 2) - k * (pinchStartFocalY.value - height / 2) + k * pinchStartY.value;
    })
    .onEnd((e) => {
      isPinching.value = false;
      pinchJustEnded.value = true;
      const totalScale = Math.max(
        minRenderScale,
        Math.min(maxRenderScale, pinchStartScale.value * e.scale),
      );
      const k = totalScale / pinchStartScale.value;
      const endOffsetX = (e.focalX - width / 2) - k * (pinchStartFocalX.value - width / 2) + k * pinchStartX.value;
      const endOffsetY = (e.focalY - height / 2) - k * (pinchStartFocalY.value - height / 2) + k * pinchStartY.value;
      runOnJS(finishPinch)(totalScale, endOffsetX, endOffsetY);
    })
    .onFinalize((_event, success) => {
      isPinching.value = false;
      if (!success) runOnJS(endCanvasGesture)();
    });

  const panOrTap = Gesture.Exclusive(pan, tap);
  const composed = Gesture.Simultaneous(panOrTap, pinch);

  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 2: STAR TILE PICTURES
  // Every star (LOW, MEDIUM, HIGH LOD) is recorded into independent native
  // SkPictures per 30-degree tile. Panning reuses cached tiles without rebuild.
  // ═══════════════════════════════════════════════════════════════════════
  const starTilePictures = useMemo<StarTilePicture[]>(() => {
    const camera = renderCameraRef.current;
    const lod = getRenderLod(cameraRef.current.zoom);
    if (!font) return [];

    const tileGroups = new Map<string, ViewportStarItem[]>();
    for (const star of pictureStars) {
      const pos = projectToScreen(star.ra, star.dec, camera, width, height);
    // Keep loaded tiles for the same overscan window as the static sky. They
    // can slide into view on the next swipe without a React/Skia replacement.
    if (!isInFrustum(pos.x, pos.y, width, height, OVERSCAN_PAD)) continue;
      const key = tileKeyForStar(star);
      const group = tileGroups.get(key);
      if (group) group.push(star);
      else tileGroups.set(key, [star]);
    }

    const tiles: StarTilePicture[] = [];
    for (const [tileKey, tileStars] of tileGroups) {
      const center = tileCenterFromKey(tileKey);
      // The cache key MUST include the exact camera zoom because `pixelsPerDegree`
      // used in `buildLodTilePicture` depends on it. During a continuous pinch gesture,
      // `camera.zoom` (which comes from `renderCameraRef`) does not change—only the GPU
      // scale changes—so the cache remains stable and flicker-free. It only rebuilds
      // when the gesture ends and a world rebase occurs.
      const cacheKey = `${tileKey}@${lod}@${camera.zoom.toFixed(4)}@${tileContentSignature(tileStars)}`;
      let entry = tilePictureCacheRef.current.get(cacheKey);

      if (entry) {
        // Touch (move to end of LRU Map) so this tile is the last to be evicted
        tilePictureCacheRef.current.delete(cacheKey);
        tilePictureCacheRef.current.set(cacheKey, entry);
      } else {
        // ── FRUSTUM-PROTECTED LAZY LRU EVICTION ─────────────────────────
        // activeKeys is built ONLY when the cache is full — lazy evaluation
        // so normal frames pay zero Set-allocation cost.
        if (tilePictureCacheRef.current.size >= MAX_TILE_PICTURES) {
          const activeKeys = new Set(tileGroups.keys());
          let evictKey: string | null = null;
          for (const k of tilePictureCacheRef.current.keys()) {
            // Cache key format: `${tileKey}@${lod}@${signature}`
            const tileCoords = k.split('@')[0];
            // Only evict tiles that are NOT in the current frustum+overscan
            if (!activeKeys.has(tileCoords)) {
              evictKey = k;
              break;
            }
          }
          if (evictKey) {
            const evicted = tilePictureCacheRef.current.get(evictKey);
            tilePictureCacheRef.current.delete(evictKey);
            disposePicture(evicted?.picture);
          }
          // If every cached tile is currently active (edge case: user zoomed
          // fast and all 50 tiles are visible), skip eviction this frame to
          // avoid disposing an in-use GPU resource. The cache grows by 1 and
          // will self-correct as the user pans away.
        }
        entry = {
          picture: buildLodTilePicture(
            tileStars,
            center,
            camera,
            width,
            height,
            lod,
            paintPoolRef.current!,
            font,
            starNameFont
          ),
        };
        tilePictureCacheRef.current.set(cacheKey, entry);
      }

      const anchor = projectToScreen(center.ra, center.dec, camera, width, height);
      // `tileKey` ("ra:dec") is the stable JSX key — React never unmounts
      // this Group node; only the picture prop is swapped in-place.
      tiles.push({ key: tileKey, picture: entry.picture, x: anchor.x, y: anchor.y });
    }

    return tiles;
  }, [pictureVersion, pictureStars, width, height, font, starNameFont]);

  // ═══════════════════════════════════════════════════════════════════════
  // LAYER 1: STATIC SKY BACKGROUND PICTURE
  // Nebulas, constellation lines, sector labels, solar system bodies, and
  // friend connections. ZERO dependency on dynamic star catalog data.
  // ═══════════════════════════════════════════════════════════════════════
  const skyBackgroundPicture = useMemo(() => {
    const camera = renderCameraRef.current;
    if (!font || !sectorFont) return null;
    const recorder = Skia.PictureRecorder();
    const recW = width + OVERSCAN_PAD * 2;
    const recH = height + OVERSCAN_PAD * 2;
    const canvas = recorder.beginRecording(Skia.XYWHRect(-OVERSCAN_PAD, -OVERSCAN_PAD, recW, recH));

    // ─── PASS 0: Deep Space Background Gradient (Includes Overscan) ───
    const bgPaint = Skia.Paint();
    bgPaint.setShader(
      Skia.Shader.MakeRadialGradient(
        Skia.Point(width / 2, height / 2),
        Math.max(width, height) * 1.2,
        [Skia.Color('#0A0F1E'), Skia.Color('#020408')],
        null,
        3
      )
    );
    canvas.drawRect(Skia.XYWHRect(-OVERSCAN_PAD, -OVERSCAN_PAD, recW, recH), bgPaint);

    // ─── PASS 1: Sector Nebula Gradients ───────────────────────────────
    SKY_SECTORS_LIST.forEach((sector) => {
      const center = projectToScreen(sector.center.ra, sector.center.dec, camera, width, height);
      if (
        center.x < -OVERSCAN_PAD - 200 || center.x > width + OVERSCAN_PAD + 200 ||
        center.y < -OVERSCAN_PAD - 200 || center.y > height + OVERSCAN_PAD + 200
      ) return;

      const radius = magnitudeToRadius(-2, 'O', camera.zoom) * 22;
      const color = sector.nebulaPalette?.[0] ?? '#38BDF8';

      const nebulaPaint = Skia.Paint();
      nebulaPaint.setBlendMode(12); // Screen
      nebulaPaint.setShader(
        Skia.Shader.MakeRadialGradient(
          Skia.Point(center.x, center.y),
          radius,
          [hexToRgba(color, 0.22), hexToRgba(color, 0.06), hexToRgba(color, 0)],
          null,
          3
        )
      );
      canvas.drawCircle(center.x, center.y, radius, nebulaPaint);
    });

    // ─── PASS 2: Sector Labels (Zoom < 2.0) ───────────────────────────
    if (camera.zoom < 2.0 && sectorFont) {
      SKY_SECTORS_LIST.forEach((sector) => {
        const center = projectToScreen(sector.center.ra, sector.center.dec, camera, width, height);
        if (
          center.x < -60 || center.x > width + 60 ||
          center.y < -60 || center.y > height + 60
        ) return;

        const text = `${sector.symbol} ${sector.name}`;
        const textWidth = sectorFont.getTextWidth(text);
        const sPaint = Skia.Paint();
        sPaint.setColor(Skia.Color(sector.themeColor || 'rgba(255,255,255,0.6)'));
        canvas.drawText(text, center.x - textWidth / 2, center.y + 12, sPaint, sectorFont);
      });
    }

    // ─── PASS 3: Constellation Lines ──────────────────────────────────
    const constPaint = Skia.Paint();
    constPaint.setColor(Skia.Color('rgba(255, 255, 255, 0.18)'));
    constPaint.setStrokeWidth(1);
    constPaint.setStyle(1); // Stroke

    CONSTELLATION_LINES.forEach((line) => {
      const p1 = projectToScreen(line.from.ra, line.from.dec, camera, width, height);
      const p2 = projectToScreen(line.to.ra, line.to.dec, camera, width, height);
      if (
        (p1.x < -OVERSCAN_PAD && p2.x < -OVERSCAN_PAD) ||
        (p1.x > width + OVERSCAN_PAD && p2.x > width + OVERSCAN_PAD) ||
        (p1.y < -OVERSCAN_PAD && p2.y < -OVERSCAN_PAD) ||
        (p1.y > height + OVERSCAN_PAD && p2.y > height + OVERSCAN_PAD)
      ) return;

      canvas.drawLine(p1.x, p1.y, p2.x, p2.y, constPaint);
    });

    // ─── PASS 4: Active Star Connection Lines & Badges ────────────────
    if (myStarRa !== undefined && myStarDec !== undefined && connections.length > 0) {
      const p1 = projectToScreen(myStarRa, myStarDec, camera, width, height);
      const connLinePaint = Skia.Paint();
      connLinePaint.setColor(Skia.Color('rgba(251, 191, 36, 0.6)'));
      connLinePaint.setStrokeWidth(1.6);
      connLinePaint.setStyle(1); // Stroke
      const connDash = Skia.PathEffect.MakeDash([4, 6], 0);
      if (connDash) connLinePaint.setPathEffect(connDash);

      connections.forEach((conn) => {
        if (!conn.other_star_ra || !conn.other_star_dec) return;
        const p2 = projectToScreen(conn.other_star_ra, conn.other_star_dec, camera, width, height);
        canvas.drawLine(p1.x, p1.y, p2.x, p2.y, connLinePaint);

        // Pink node badge around friend's star
        const nodePaint = Skia.Paint();
        nodePaint.setColor(Skia.Color('rgba(244, 114, 182, 0.8)'));
        nodePaint.setStyle(1);
        nodePaint.setStrokeWidth(1.2);
        canvas.drawCircle(p2.x, p2.y, 7, nodePaint);

        // Connected Star Name Tag
        if (font) {
          const labelText = `🔗 ${conn.other_star_name}`;
          const textWidth = font.getTextWidth(labelText);
          const labelX = p2.x - textWidth / 2;
          const labelY = p2.y + 22;

          const pillBg = Skia.Paint();
          pillBg.setColor(Skia.Color('rgba(24, 15, 36, 0.85)'));
          canvas.drawRRect(
            Skia.RRectXY(
              Skia.XYWHRect(labelX - 6, labelY - 10, textWidth + 12, 16),
              8,
              8
            ),
            pillBg
          );

          const textP = Skia.Paint();
          textP.setColor(Skia.Color('#F472B6'));
          canvas.drawText(labelText, labelX, labelY + 2, textP, font);
        }
      });
    }

    // ─── PASS 9: Güneş Sistemi Cisimleri (Güneş, Dünya, Venüs, Ay) ─────
    SOLAR_SYSTEM_OBJECTS.forEach((obj) => {
      const pos = projectToScreen(obj.ra, obj.dec, camera, width, height);
      if (
        pos.x < -OVERSCAN_PAD || pos.x > width + OVERSCAN_PAD ||
        pos.y < -OVERSCAN_PAD || pos.y > height + OVERSCAN_PAD
      ) return;

      if (obj.catalog_code === 'SOL-SUN') {
        // GÜNEŞ: İhtişamlı Altın Korona ve Güneş Aurası
        const sunRadius = Math.max(16, 20 * Math.min(3.0, 1 + (camera.zoom - 1) * 0.12));
        const coronaRadius = sunRadius * 2.8;

        const coronaPaint = Skia.Paint();
        const coronaShader = Skia.Shader.MakeRadialGradient(
          Skia.Point(pos.x, pos.y),
          coronaRadius,
          [
            Skia.Color('rgba(255, 255, 255, 0.95)'),
            Skia.Color('rgba(251, 191, 36, 0.85)'),
            Skia.Color('rgba(245, 158, 11, 0.45)'),
            Skia.Color('rgba(239, 68, 68, 0.15)'),
            Skia.Color('rgba(239, 68, 68, 0)'),
          ],
          [0, 0.2, 0.45, 0.75, 1.0],
          3
        );
        if (coronaShader) coronaPaint.setShader(coronaShader);
        canvas.drawCircle(pos.x, pos.y, coronaRadius, coronaPaint);

        // Güneş Çekirdeği
        const sunCorePaint = Skia.Paint();
        sunCorePaint.setColor(Skia.Color('#FFFDF0'));
        canvas.drawCircle(pos.x, pos.y, sunRadius * 0.7, sunCorePaint);

        // Güneş Etiketi
        if (font) {
          const sunLabel = 'Güneş ☀️';
          const textW = font.getTextWidth(sunLabel);
          const labelX = pos.x - textW / 2;
          const labelY = pos.y + sunRadius + 18;

          const pillP = Skia.Paint();
          pillP.setColor(Skia.Color('rgba(20, 15, 5, 0.9)'));
          canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(labelX - 8, labelY - 12, textW + 16, 20), 10, 10), pillP);

          const borderP = Skia.Paint();
          borderP.setColor(Skia.Color('rgba(245, 158, 11, 0.8)'));
          borderP.setStyle(1);
          borderP.setStrokeWidth(1.2);
          canvas.drawRRect(Skia.RRectXY(Skia.XYWHRect(labelX - 8, labelY - 12, textW + 16, 20), 10, 10), borderP);

          const textP = Skia.Paint();
          textP.setColor(Skia.Color('#FDE68A'));
          canvas.drawText(sunLabel, labelX, labelY + 2, textP, font);
        }
      } else if (obj.catalog_code === 'SOL-EARTH') {
        // DÜNYA
        const earthGlow = Skia.Paint();
        earthGlow.setColor(Skia.Color('rgba(56, 189, 248, 0.6)'));
        const eBlur = Skia.MaskFilter.MakeBlur(0, 8, true);
        if (eBlur) earthGlow.setMaskFilter(eBlur);
        canvas.drawCircle(pos.x, pos.y, 7, earthGlow);

        const earthCore = Skia.Paint();
        earthCore.setColor(Skia.Color('#38BDF8'));
        canvas.drawCircle(pos.x, pos.y, 4.5, earthCore);

        const earthDot = Skia.Paint();
        earthDot.setColor(Skia.Color('#FFFFFF'));
        canvas.drawCircle(pos.x, pos.y, 1.8, earthDot);

        if (font) {
          const earthLabel = 'Dünya 🌍';
          const elWidth = font.getTextWidth(earthLabel);
          const elPaint = Skia.Paint();
          elPaint.setColor(Skia.Color('#93C5FD'));
          canvas.drawText(earthLabel, pos.x - elWidth / 2, pos.y + 18, elPaint, font);
        }
      } else if (obj.catalog_code === 'SOL-VENUS') {
        // VENÜS
        const vGlow = Skia.Paint();
        vGlow.setColor(Skia.Color('rgba(251, 191, 36, 0.5)'));
        canvas.drawCircle(pos.x, pos.y, 6, vGlow);

        const vCore = Skia.Paint();
        vCore.setColor(Skia.Color('#FFE5C2'));
        canvas.drawCircle(pos.x, pos.y, 3.5, vCore);

        if (font) {
          const vLabel = 'Venüs ✨';
          const vWidth = font.getTextWidth(vLabel);
          const vPaint = Skia.Paint();
          vPaint.setColor(Skia.Color('#FDE68A'));
          canvas.drawText(vLabel, pos.x - vWidth / 2, pos.y + 18, vPaint, font);
        }
      } else if (obj.catalog_code === 'SOL-MOON') {
        // AY
        const mGlow = Skia.Paint();
        mGlow.setColor(Skia.Color('rgba(226, 232, 240, 0.5)'));
        canvas.drawCircle(pos.x, pos.y, 5, mGlow);

        const mCore = Skia.Paint();
        mCore.setColor(Skia.Color('#E2E8F0'));
        canvas.drawCircle(pos.x, pos.y, 2.8, mCore);

        if (font) {
          const mLabel = 'Ay 🌙';
          const mWidth = font.getTextWidth(mLabel);
          const mPaint = Skia.Paint();
          mPaint.setColor(Skia.Color('#CBD5E1'));
          canvas.drawText(mLabel, pos.x - mWidth / 2, pos.y + 16, mPaint, font);
        }
      }
    });

    // ─── PASS 5: Hero Star Beacon (Kullanıcının Kendi Yıldızı) ───────
    // Always recorded into skyBackgroundPicture so it is immediately visible
    // with zero latency at all zoom levels, during fly-to, and without waiting
    // for viewport tile RPC responses from the server.
    if (myStarRa !== undefined && myStarDec !== undefined) {
      const heroPos = projectToScreen(myStarRa, myStarDec, camera, width, height);
      if (
        heroPos.x >= -OVERSCAN_PAD &&
        heroPos.x <= width + OVERSCAN_PAD &&
        heroPos.y >= -OVERSCAN_PAD &&
        heroPos.y <= height + OVERSCAN_PAD
      ) {
        // 1. Ambient Golden Halo
        const heroAura = Skia.Paint();
        heroAura.setColor(Skia.Color('rgba(245, 158, 11, 0.28)'));
        heroAura.setMaskFilter(Skia.MaskFilter.MakeBlur(0, 14, true));
        canvas.drawCircle(heroPos.x, heroPos.y, 34, heroAura);

        // 2. Focused Golden Glow
        const heroGlow = Skia.Paint();
        heroGlow.setColor(Skia.Color('rgba(251, 191, 36, 0.55)'));
        heroGlow.setMaskFilter(Skia.MaskFilter.MakeBlur(0, 6, true));
        canvas.drawCircle(heroPos.x, heroPos.y, 18, heroGlow);

        // 3. Crisp Golden Beacon Ring
        const heroRing = Skia.Paint();
        heroRing.setStyle(1); // Stroke
        heroRing.setStrokeWidth(2.0);
        heroRing.setColor(Skia.Color('#F59E0B'));
        canvas.drawCircle(heroPos.x, heroPos.y, 11, heroRing);

        // 4. White-Hot Radiant Core
        const heroCore = Skia.Paint();
        heroCore.setColor(Skia.Color('#FFFFFF'));
        canvas.drawCircle(heroPos.x, heroPos.y, 5.5, heroCore);

        // 5. Name Pill
        const activeName = myStarName || 'Bizim Yıldızımız ✨';
        const activeFont = starNameFont || font;
        if (activeFont) {
          const labelText = `⭐ ${activeName}`;
          const textW = activeFont.getTextWidth(labelText);
          const labelX = heroPos.x - textW / 2;
          const labelY = heroPos.y + 24;

          const pillBg = Skia.Paint();
          pillBg.setColor(Skia.Color('rgba(15, 23, 42, 0.94)'));
          canvas.drawRRect(
            Skia.RRectXY(Skia.XYWHRect(labelX - 8, labelY - 12, textW + 16, 20), 10, 10),
            pillBg
          );

          const pillBorder = Skia.Paint();
          pillBorder.setStyle(1);
          pillBorder.setStrokeWidth(1.2);
          pillBorder.setColor(Skia.Color('rgba(245, 158, 11, 0.75)'));
          canvas.drawRRect(
            Skia.RRectXY(Skia.XYWHRect(labelX - 8, labelY - 12, textW + 16, 20), 10, 10),
            pillBorder
          );

          const textPaint = Skia.Paint();
          textPaint.setColor(Skia.Color('#FDE68A'));
          canvas.drawText(labelText, labelX, labelY + 2, textPaint, activeFont);
        }
      }
    }

    return recorder.finishRecordingAsPicture();
  }, [pictureVersion, width, height, font, sectorFont, connections, myStarRa, myStarDec, myStarName, starNameFont]);

  // The visual transform combines gesture offsets with fly-to offsets.
  // We bake the center origin (width/2, height/2) directly into the transform array:
  // P_screen = cx + curOffsetX + curScale * (P_world - cx)
  // This guarantees zero coordinate drift, exact focal-point zooming, and
  // eliminates any reliance on Skia's internal origin prop handling.
  const transform = useDerivedValue(() => {
    const cx = width / 2;
    const cy = height / 2;
    let curOffsetX = offsetX.value;
    let curOffsetY = offsetY.value;
    let curScale = scale.value;

    if (isFlying.value) {
      const p = flightAnim.value;
      curOffsetX = flyStartX.value + (flyTargetX.value - flyStartX.value) * p;
      curOffsetY = flyStartY.value + (flyTargetY.value - flyStartY.value) * p;
      curScale   = flyStartScale.value + (flyTargetScale.value - flyStartScale.value) * p;
    }

    return [
      { translateX: cx + curOffsetX },
      { translateY: cy + curOffsetY },
      { scale: curScale },
      { translateX: -cx },
      { translateY: -cy },
    ];
  });

  if (!font || !sectorFont) {
    return (
      <View style={[styles.container, { width, height, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#FBBF24" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height }]}>
       <GestureDetector gesture={composed}>
          <Animated.View style={{ width, height }}>
             <Canvas style={{ flex: 1 }}>
                <Group transform={transform}>
                   {skyBackgroundPicture && <Picture picture={skyBackgroundPicture} />}
                   {starTilePictures.map((tile) => (
                     <Group key={tile.key} transform={[{ translateX: tile.x }, { translateY: tile.y }]}>
                       <Picture picture={tile.picture} />
                     </Group>
                   ))}
                </Group>
             </Canvas>
          </Animated.View>
       </GestureDetector>
    </View>
  );
}

function MacroSkyCanvasFallback({
  stars,
  width = 390,
  height = 844,
}: MacroSkyCanvasProps) {
  return (
    <View style={[styles.container, styles.fallbackContainer, { width, height }]}>
      <View style={styles.fallbackCard}>
        <View style={styles.fallbackIconBadge}>
          <Sparkles size={28} color="#FBBF24" />
        </View>
        <Text style={styles.fallbackTitle}>Makro Gökyüzü Haritası</Text>
        <Text style={styles.fallbackSubtitle}>Skia Graphics Engine</Text>
        <Text style={styles.fallbackDescription}>
          10.000+ yıldız ve nebulayı 60 FPS akıcılıkla çizmek için donanım hızlandırmalı Skia C++ motoru kullanılır.
        </Text>
        <View style={styles.fallbackNoticeBox}>
          <Text style={styles.fallbackNoticeTitle}>Development Build Gereklidir</Text>
          <Text style={styles.fallbackNoticeText}>
            Projenizdeki özel native modüller (RevenueCat, Ads, QuickCrypto vb.) nedeniyle bu haritayı tam performanslı görüntülemek için terminalden uygulamayı derleyin:
          </Text>
          <View style={styles.fallbackCodeBadge}>
            <Text style={styles.fallbackCodeText}>npx expo run:android</Text>
          </View>
        </View>
        <Text style={styles.fallbackMetaText}>
          Yüklü Yıldız: {stars.length} adet
        </Text>
      </View>
    </View>
  );
}

export function MacroSkyCanvas(props: MacroSkyCanvasProps) {
  if (!isSkiaAvailable) {
    return <MacroSkyCanvasFallback {...props} />;
  }
  return <MacroSkyCanvasSkia {...props} />;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#020408',
    overflow: 'hidden',
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  fallbackCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    padding: 24,
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  fallbackIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  fallbackSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FBBF24',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  fallbackDescription: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  fallbackNoticeBox: {
    backgroundColor: 'rgba(2, 6, 23, 0.75)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  fallbackNoticeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F87171',
    marginBottom: 6,
  },
  fallbackNoticeText: {
    fontSize: 12,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 10,
  },
  fallbackCodeBadge: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  fallbackCodeText: {
    color: '#FBBF24',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
  },
  fallbackMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
});

export default MacroSkyCanvas;
