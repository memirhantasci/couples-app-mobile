import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, runOnJS, useDerivedValue } from 'react-native-reanimated';
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
  readonly myStarCoords?: { readonly ra: number; readonly dec: number };
  readonly width?: number;
  readonly height?: number;
}

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 35.0;
const OVERSCAN_PAD = 1200;
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

  return {
    lowPaint,
    lowRingPaint,
    resonanceGoldPaint,
    resonancePurplePaint,
    mediumGlowPaint: Skia.Paint(),
    mediumCorePaint: Skia.Paint(),
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

function computeBounds(camera: SkyCameraState): MacroSkyBounds {
  const fovDec = (60 / camera.zoom) * 1.5;
  const fovRa = fovDec * (camera.viewportWidth / camera.viewportHeight);
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
  lod: Exclude<RenderLod, 'high'>,
  paintPool: PaintPool,
  font: any,
) {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(-30000, -30000, 60000, 60000));
  const pixelsPerDegree = height / (60 / camera.zoom);

  for (const star of tileStars) {
    const localX = (star.ra - tileCenter.ra) * pixelsPerDegree;
    const localY = -(star.dec - tileCenter.dec) * pixelsPerDegree;
    const radius = magnitudeToRadius(star.magnitude, star.spectral_type || 'G', camera.zoom);
    const baseColor = star.base_color || '#FFFFFF';
    const alpha = magnitudeToAlpha(star.magnitude, star.luminosity_level ?? 1);

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

    // Medium LOD intentionally uses only concentric solid circles. Do not add
    // MaskFilter.MakeBlur here: it is measurably expensive during map browsing.
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

  // pictureVersion: the ONLY state that triggers SkPicture rebuild
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

  // Debounce timers
  const pictureTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const boundsTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request debounced picture rebuild (150ms after last gesture)
  const requestPictureRebuild = React.useCallback(() => {
    if (pictureTimerRef.current) clearTimeout(pictureTimerRef.current);
    pictureTimerRef.current = setTimeout(() => {
      setPictureVersion((v) => v + 1);
    }, 60);
  }, []);

  const beginCanvasGesture = useCallback(() => {
    activeGestureCountRef.current += 1;
    // A delayed rebuild from a previous gesture must never fire mid-gesture.
    if (pictureTimerRef.current) clearTimeout(pictureTimerRef.current);
  }, []);

  const endCanvasGesture = useCallback(() => {
    activeGestureCountRef.current = Math.max(0, activeGestureCountRef.current - 1);
    if (activeGestureCountRef.current > 0) return;

    const pendingStars = pendingStarsRef.current;
    pendingStarsRef.current = null;
    if (pendingStars) {
      setPictureStars((current) => (current === pendingStars ? current : pendingStars));
    }
    // Camera commit has already reached JS at this point; now it is safe to
    // record one picture and reset the transient UI-thread transform.
    requestPictureRebuild();
  }, [requestPictureRebuild]);

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
      if (pictureTimerRef.current) clearTimeout(pictureTimerRef.current);
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
  const committedX = useSharedValue(0);
  const committedY = useSharedValue(0);
  const scale = useSharedValue(1);
  const focalX = useSharedValue(width / 2);
  const focalY = useSharedValue(height / 2);
  const lastRunTimeRef = useSharedValue(0);

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
  // FLY-TO TARGET: immediate camera jump + rebuild
  // ═══════════════════════════════════════════════════════════════════════
  React.useEffect(() => {
    if (!targetCamera) return;
    const prev = cameraRef.current;
    cameraRef.current = {
      ...prev,
      centerRa: ((targetCamera.centerRa % 360) + 360) % 360,
      centerDec: Math.max(-90, Math.min(90, targetCamera.centerDec)),
      zoom: targetCamera.zoom ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetCamera.zoom)) : prev.zoom,
    };
    // Reset gesture offsets
    offsetX.value = 0;
    offsetY.value = 0;
    committedX.value = 0;
    committedY.value = 0;
    scale.value = 1;
    focalX.value = width / 2;
    focalY.value = height / 2;
    // Immediate rebuild (no debounce for fly-to)
    setPictureVersion((v) => v + 1);
    notifyCameraChange();
    requestBoundsChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetCamera?.centerRa, targetCamera?.centerDec, targetCamera?.zoom, targetCamera?.nonce]);

  // ═══════════════════════════════════════════════════════════════════════
  // COMMIT HANDLERS: update cameraRef (NO re-render), schedule rebuild
  // ═══════════════════════════════════════════════════════════════════════
  const commitPanDelta = useCallback((dx: number, dy: number) => {
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    const prev = cameraRef.current;
    const fovDec = 60 / prev.zoom;
    const fovRa = fovDec * (width / height);
    const dRa = -(dx / width) * fovRa;
    const dDec = (dy / height) * fovDec;
    cameraRef.current = {
      ...prev,
      centerRa: ((prev.centerRa + dRa) % 360 + 360) % 360,
      centerDec: Math.max(-85, Math.min(85, prev.centerDec + dDec)),
    };
    notifyCameraChange();
    requestPictureRebuild();
    requestBoundsChange();
  }, [width, height, notifyCameraChange, requestPictureRebuild, requestBoundsChange]);

  // Called at most 30 times/second from the worklet. It deliberately does not
  // rebuild SkPicture: the Group transform owns every in-flight frame.
  const latestPanTranslationRef = useRef({ x: 0, y: 0 });
  const recordPanDeltaLive = useCallback((translationX: number, translationY: number) => {
    latestPanTranslationRef.current = { x: translationX, y: translationY };
  }, []);

  const commitPinch = useCallback((scaleFactor: number, fx: number, fy: number) => {
    if (!scaleFactor || scaleFactor <= 0) return;
    const prev = cameraRef.current;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * scaleFactor));
    if (Math.abs(newZoom - prev.zoom) < 0.005) return;

    // ⚠️ ÖNEMLİ: Pinch sırasında henüz commit edilmemiş pan varsa onu da telafi et
    const currentPanX = offsetX.value - committedX.value;
    const currentPanY = offsetY.value - committedY.value;
    const adjustedFx = fx - currentPanX;
    const adjustedFy = fy - currentPanY;

    const fovDec_old = 60 / prev.zoom;
    const fovRa_old = fovDec_old * (width / height);
    const fovDec_new = 60 / newZoom;
    const fovRa_new = fovDec_new * (width / height);

    const dRa = ((adjustedFx - width / 2) / width) * (fovRa_old - fovRa_new);
    const dDec = -((adjustedFy - height / 2) / height) * (fovDec_old - fovDec_new);

    cameraRef.current = {
      ...prev,
      centerRa: ((prev.centerRa + dRa) % 360 + 360) % 360,
      centerDec: Math.max(-85, Math.min(85, prev.centerDec + dDec)),
      zoom: newZoom,
    };
    notifyCameraChange();
    requestPictureRebuild();
    requestBoundsChange();
  }, [width, height, offsetX, committedX, offsetY, committedY, notifyCameraChange, requestPictureRebuild, requestBoundsChange]);

  // ═══════════════════════════════════════════════════════════════════════
  // SYNC TRANSFORM AFTER PICTURE MOUNTS: Prevents visual snapping
  // ═══════════════════════════════════════════════════════════════════════
  React.useEffect(() => {
    if (pictureVersion > 0) {
      committedX.value = offsetX.value;
      committedY.value = offsetY.value;
      scale.value = 1;
      focalX.value = width / 2;
      focalY.value = height / 2;
    }
  }, [pictureVersion, committedX, offsetX, committedY, offsetY, scale, focalX, focalY, width, height]);

  // ═══════════════════════════════════════════════════════════════════════
  // HIT-TESTING: tap → find nearest star (reads cameraRef directly)
  // ═══════════════════════════════════════════════════════════════════════
  const handleTap = useCallback((tx: number, ty: number) => {
    if (!onSelectStar) return;
    const camera = cameraRef.current;
    let minDist = Infinity;
    let nearest: ViewportStarItem | null = null;
    const MIN_TOUCH_RADIUS = 46;

    // Adjust for current visual pan displacement
    const currentTx = offsetX.value - committedX.value;
    const currentTy = offsetY.value - committedY.value;
    const effectiveTx = tx - currentTx;
    const effectiveTy = ty - currentTy;

    const allTargets = [...SOLAR_SYSTEM_OBJECTS, ...stars];
    for (const star of allTargets) {
      const pos = projectToScreen(star.ra, star.dec, camera, width, height);
      const isMine = star.is_mine;
      const isSun = star.catalog_code === 'SOL-SUN';
      const baseRadius = magnitudeToRadius(star.magnitude, star.spectral_type || 'G', camera.zoom);
      const r = baseRadius * (isSun ? 3.0 : (isMine ? 1.6 : 1.0));
      const touchRadius = Math.max(r + 30, MIN_TOUCH_RADIUS);
      const dx = effectiveTx - pos.x;
      const dy = effectiveTy - pos.y;
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
  }, [stars, width, height, onSelectStar, offsetX, committedX, offsetY, committedY]);

  // ═══════════════════════════════════════════════════════════════════════
  // GESTURE DEFINITIONS
  // ═══════════════════════════════════════════════════════════════════════
  const tap = Gesture.Tap()
    .maxDuration(350)
    .maxDistance(25)
    .onEnd((e) => {
      runOnJS(handleTap)(e.x, e.y);
    });

  const pan = Gesture.Pan()
    .minDistance(6)
    .onStart(() => {
      startX.value = offsetX.value;
      startY.value = offsetY.value;
      runOnJS(beginCanvasGesture)();
    })
    .onUpdate((e) => {
      offsetX.value = startX.value + e.translationX;
      offsetY.value = startY.value + e.translationY;
      // Hermes/Reanimated worklets expose performance.now(). Keep a monotonic
      // shared-value fallback for older runtimes that do not.
      const now = typeof performance !== 'undefined'
        ? performance.now()
        : lastRunTimeRef.value + 34;
      if (now - lastRunTimeRef.value > 33) {
        lastRunTimeRef.value = now;
        runOnJS(recordPanDeltaLive)(e.translationX, e.translationY);
      }
    })
    .onEnd(() => {
      const dx = offsetX.value - committedX.value;
      const dy = offsetY.value - committedY.value;
      runOnJS(commitPanDelta)(dx, dy);
    })
    .onFinalize(() => {
      runOnJS(endCanvasGesture)();
    });

  const pinch = Gesture.Pinch()
    .onStart((e) => {
      focalX.value = e.focalX;
      focalY.value = e.focalY;
      scale.value = 1;
      runOnJS(beginCanvasGesture)();
    })
    .onUpdate((e) => {
      focalX.value = e.focalX;
      focalY.value = e.focalY;
      scale.value = e.scale;
    })
    .onEnd((e) => {
      runOnJS(commitPinch)(e.scale, e.focalX, e.focalY);
    })
    .onFinalize(() => {
      runOnJS(endCanvasGesture)();
    });

  const panOrTap = Gesture.Exclusive(pan, tap);
  const composed = Gesture.Simultaneous(panOrTap, pinch);

  // Dynamic stars are never recorded into the background picture at LOW/MEDIUM
  // detail. Each tile stays as an independent native SkPicture, so receiving a
  // neighbouring tile cannot replace or flash the sky already on screen.
  const starTilePictures = useMemo<StarTilePicture[]>(() => {
    const camera = cameraRef.current;
    const lod = getRenderLod(camera.zoom);
    if (!font || camera.zoom < 0.5 || lod === 'high') return [];

    const tileGroups = new Map<string, ViewportStarItem[]>();
    for (const star of pictureStars) {
      const pos = projectToScreen(star.ra, star.dec, camera, width, height);
      if (!isInFrustum(pos.x, pos.y, width, height)) continue;
      const key = tileKeyForStar(star);
      const group = tileGroups.get(key);
      if (group) group.push(star);
      else tileGroups.set(key, [star]);
    }

    const tiles: StarTilePicture[] = [];
    for (const [tileKey, tileStars] of tileGroups) {
      const center = tileCenterFromKey(tileKey);
      const cacheKey = `${tileKey}@${lod}@${camera.zoom.toFixed(3)}@${tileContentSignature(tileStars)}`;
      let entry = tilePictureCacheRef.current.get(cacheKey);

      if (entry) {
        tilePictureCacheRef.current.delete(cacheKey);
        tilePictureCacheRef.current.set(cacheKey, entry);
      } else {
        if (tilePictureCacheRef.current.size >= MAX_TILE_PICTURES) {
          const oldestKey = tilePictureCacheRef.current.keys().next().value as string | undefined;
          if (oldestKey) {
            const oldest = tilePictureCacheRef.current.get(oldestKey);
            tilePictureCacheRef.current.delete(oldestKey);
            disposePicture(oldest?.picture);
          }
        }
        entry = {
          picture: buildLodTilePicture(tileStars, center, camera, width, height, lod, paintPoolRef.current!, starNameFont || font),
        };
        tilePictureCacheRef.current.set(cacheKey, entry);
      }

      const anchor = projectToScreen(center.ra, center.dec, camera, width, height);
      tiles.push({ key: cacheKey, picture: entry.picture, x: anchor.x, y: anchor.y });
    }

    return tiles;
  }, [pictureVersion, pictureStars, width, height, font, starNameFont]);

  // Star input only belongs to the base picture at clustering/HIGH detail.
  // At LOW/MEDIUM the base picture remains byte-for-byte independent from
  // network tile responses.
  const starsForBasePicture = cameraRef.current.zoom < 0.5 || getRenderLod(cameraRef.current.zoom) === 'high'
    ? pictureStars
    : EMPTY_STARS;

  // ═══════════════════════════════════════════════════════════════════════
  // SkPicture: Rebuilt only on pictureVersion / star data changes
  // During gestures, Group transform handles ALL visual movement (60fps)
  // ═══════════════════════════════════════════════════════════════════════
  const picture = useMemo(() => {
    const camera = cameraRef.current;
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

    // ─── PASS 4: Active Star Connection Lines ─────────────────────────
    if (myStarCoords && connections.length > 0) {
      const p1 = projectToScreen(myStarCoords.ra, myStarCoords.dec, camera, width, height);
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
      });
    }

    const lod = getRenderLod(camera.zoom);

    // ─── PASS 5: Cached low/medium tile pictures ──────────────────────
    // A tile picture is recorded around its world-space centre and translated
    // into place. Panning at the same zoom therefore reuses native SkPictures.
    // MIN_ZOOM remains 0.6 by product requirement. The cluster branch is kept
    // at the specified <0.5 threshold for any future expanded map mode.
    if (camera.zoom < 0.5) {
      const clusterPaint = paintPoolRef.current!.lowPaint;
      const clusterTextPaint = paintPoolRef.current!.labelPaint;
      clusterPaint.setColor(Skia.Color('#7DD3FC'));
      clusterTextPaint.setColor(Skia.Color('#E0F2FE'));
      for (const cluster of clusterVisibleStars(starsForBasePicture, camera, width, height)) {
        canvas.drawCircle(cluster.x, cluster.y, Math.min(12, 4 + Math.log2(cluster.count + 1) * 2), clusterPaint);
        if (font) canvas.drawText(`● ${cluster.count}`, cluster.x + 10, cluster.y + 4, clusterTextPaint, font);
      }
    } else if (lod === 'high') {
    // ─── PASS 5: Claimed Stars Glowing Halos (HIGH only) ──────────────
    starsForBasePicture.forEach((star) => {
      if (!star.is_claimed) return;
      const pos = projectToScreen(star.ra, star.dec, camera, width, height);
      if (!isInFrustum(pos.x, pos.y, width, height)) return;

      const r = magnitudeToRadius(star.magnitude, star.spectral_type || 'G', camera.zoom);
      const baseColor = star.base_color || '#9DB4FF';
      const lum = star.luminosity_level ?? 1.0;

      if (star.resonance_active) {
        // Double resonance halo: Golden outer + Purple inner
        const resOuterPaint = Skia.Paint();
        resOuterPaint.setColor(hexToRgba('#F59E0B', 0.35 * lum));
        const b1 = Skia.MaskFilter.MakeBlur(0, 12, true);
        if (b1) resOuterPaint.setMaskFilter(b1);
        canvas.drawCircle(pos.x, pos.y, r + 20, resOuterPaint);

        const resInnerPaint = Skia.Paint();
        resInnerPaint.setColor(hexToRgba('#A855F7', 0.45 * lum));
        const b2 = Skia.MaskFilter.MakeBlur(0, 6, true);
        if (b2) resInnerPaint.setMaskFilter(b2);
        canvas.drawCircle(pos.x, pos.y, r + 10, resInnerPaint);
      } else {
        const claimGlowPaint = Skia.Paint();
        claimGlowPaint.setColor(hexToRgba(baseColor, 0.35 * lum));
        const b = Skia.MaskFilter.MakeBlur(0, 10, true);
        if (b) claimGlowPaint.setMaskFilter(b);
        canvas.drawCircle(pos.x, pos.y, r + 14, claimGlowPaint);
      }
    });

    // ─── PASS 6: Star Cores & Vivid Spectral Colors (Matching Web Exactly) ───
    starsForBasePicture.forEach((star) => {
      const pos = projectToScreen(star.ra, star.dec, camera, width, height);
      if (!isInFrustum(pos.x, pos.y, width, height)) return;

      const isMine = star.is_mine;
      const baseRadius = magnitudeToRadius(star.magnitude, star.spectral_type || 'G', camera.zoom);
      const r = baseRadius * (isMine ? 1.6 : 1.0);
      const alpha = magnitudeToAlpha(star.magnitude, star.luminosity_level ?? 1.0);
      const baseColor = star.base_color || '#FFFFFF';

      // 1. Soft atmospheric colored aura using star's real spectral color
      const glowPaint = Skia.Paint();
      glowPaint.setColor(hexToRgba(baseColor, alpha * 0.45));
      canvas.drawCircle(pos.x, pos.y, r * 2.2, glowPaint);

      // 2. Star core with radial gradient: Pure white center, vibrant spectral color edge (Web exact parity)
      const coreShader = Skia.Shader.MakeRadialGradient(
        Skia.Point(pos.x, pos.y),
        r,
        [
          hexToRgba('#FFFFFF', Math.min(1, alpha * 1.2)),
          hexToRgba(baseColor, alpha),
          hexToRgba(baseColor, alpha * 0.6)
        ],
        [0, 0.4, 1.0],
        3
      );
      const corePaint = Skia.Paint();
      if (coreShader) {
        corePaint.setShader(coreShader);
      } else {
        corePaint.setColor(hexToRgba(baseColor, alpha));
      }
      canvas.drawCircle(pos.x, pos.y, r, corePaint);

      // 3. Bright white-hot center pinpoint
      if (star.magnitude <= 3.5 || isMine) {
        const hotCenterPaint = Skia.Paint();
        hotCenterPaint.setColor(hexToRgba('#FFFFFF', Math.min(1, alpha * 1.2)));
        canvas.drawCircle(pos.x, pos.y, Math.max(1, r * 0.35), hotCenterPaint);
      }
    });

    // ─── PASS 7: My Own Star (Golden Focus Ring & Halo) ───────────────
    starsForBasePicture.forEach((star) => {
      if (!star.is_mine) return;
      const pos = projectToScreen(star.ra, star.dec, camera, width, height);
      if (!isInFrustum(pos.x, pos.y, width, height)) return;

      const r = magnitudeToRadius(star.magnitude, star.spectral_type || 'G', camera.zoom) * 1.5;

      // Golden glow halo
      const myGlow = Skia.Paint();
      myGlow.setColor(Skia.Color('rgba(245, 158, 11, 0.45)'));
      const b = Skia.MaskFilter.MakeBlur(0, 10, true);
      if (b) myGlow.setMaskFilter(b);
      canvas.drawCircle(pos.x, pos.y, r + 14, myGlow);

      // Dashed golden focus ring
      const ringPaint = Skia.Paint();
      ringPaint.setColor(Skia.Color('#F59E0B'));
      ringPaint.setStyle(1); // Stroke
      ringPaint.setStrokeWidth(1.8);
      const dash = Skia.PathEffect.MakeDash([4, 4], 0);
      if (dash) ringPaint.setPathEffect(dash);
      canvas.drawCircle(pos.x, pos.y, r + 6, ringPaint);
    });

    // ─── PASS 8: My Own Star Custom Name Tag ──────────────────────────
    starsForBasePicture.forEach((star) => {
      if (!star.is_mine || !star.custom_name) return;
      const pos = projectToScreen(star.ra, star.dec, camera, width, height);
      if (!isInFrustum(pos.x, pos.y, width, height)) return;

      const r = magnitudeToRadius(star.magnitude, star.spectral_type || 'G', camera.zoom) * 1.5;
      const activeFont = starNameFont || font;
      if (!activeFont) return;

      const labelText = `⭐ ${star.custom_name}`;
      const textWidth = activeFont.getTextWidth(labelText);
      const labelX = pos.x - textWidth / 2;
      const labelY = pos.y + r + 20;

      // Dark glass pill backing
      const pillBgPaint = Skia.Paint();
      pillBgPaint.setColor(Skia.Color('rgba(15, 23, 42, 0.9)'));
      canvas.drawRRect(
        Skia.RRectXY(
          Skia.XYWHRect(labelX - 8, labelY - 12, textWidth + 16, 20),
          10,
          10
        ),
        pillBgPaint
      );

      // Golden border on pill
      const pillBorderPaint = Skia.Paint();
      pillBorderPaint.setColor(Skia.Color('rgba(245, 158, 11, 0.7)'));
      pillBorderPaint.setStyle(1);
      pillBorderPaint.setStrokeWidth(1.2);
      canvas.drawRRect(
        Skia.RRectXY(
          Skia.XYWHRect(labelX - 8, labelY - 12, textWidth + 16, 20),
          10,
          10
        ),
        pillBorderPaint
      );

      // Text itself
      const textPaint = Skia.Paint();
      textPaint.setColor(Skia.Color('#FDE68A'));
      canvas.drawText(labelText, labelX, labelY + 2, textPaint, activeFont);
    });

    // ─── PASS 8.1: Connected Star Name Tags ───────────────────────────
    if (connections.length > 0 && font) {
      connections.forEach((conn) => {
        if (!conn.other_star_ra || !conn.other_star_dec) return;
        const pos = projectToScreen(conn.other_star_ra, conn.other_star_dec, camera, width, height);
        if (
          pos.x < -OVERSCAN_PAD || pos.x > width + OVERSCAN_PAD ||
          pos.y < -OVERSCAN_PAD || pos.y > height + OVERSCAN_PAD
        ) return;

        const labelText = `🔗 ${conn.other_star_name}`;
        const textWidth = font.getTextWidth(labelText);
        const labelX = pos.x - textWidth / 2;
        const labelY = pos.y + 22;

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
      });
    }

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

    return recorder.finishRecordingAsPicture();
  }, [pictureVersion, starsForBasePicture, width, height, font, starNameFont, sectorFont, connections, myStarCoords]);

  const transform = useDerivedValue(() => [
    { translateX: offsetX.value - committedX.value },
    { translateY: offsetY.value - committedY.value },
    { scale: scale.value },
  ]);

  const originPoint = useDerivedValue(() => ({
    x: focalX.value,
    y: focalY.value,
  }));

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
                <Group origin={originPoint} transform={transform}>
                   {picture && <Picture picture={picture} />}
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

