import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useAnimatedReaction, useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import * as Haptics from 'expo-haptics';
import { Sparkles } from 'lucide-react-native';
import { playCelestialChime } from '@/lib/soundEffects';
import { Canvas, Picture, useFonts, isSkiaAvailable } from './skiaBridge';
import type {
  ActiveStarConnection,
  ViewportStarItem,
  SkyCameraState,
} from '@/modules/stars/types/star.types';
import { SkyDebugHud } from './macro/debug/SkyDebugHud';
import { SKY_DEBUG_HUD_ENABLED } from './macro/debug/skyDebugConfig';
import { createStarPaints, recordSkyFrame, type ActiveMeteor } from './macro/drawSkyFrame';
import { hitTestSky } from './macro/hitTest';
import {
  buildSkyOverlay,
  createStaticOverlayAssets,
  LABEL_FONT_FAMILY,
  LabelPictureCache,
  type SkyOverlay,
} from './macro/skyOverlay';
import {
  BASE_FOV_DEG,
  clampDec,
  clampZoom,
  normalizeRa,
  skyBoundsForCamera,
  skyBoundsForMotion,
} from './macro/skyProjection';
import { SOLAR_SYSTEM_OBJECTS } from './macro/solarSystem';
import { EMPTY_STAR_FIELD, StarFieldBuilder, type StarField } from './macro/starField';
import { starVisibility } from './macro/starStyle';
import { useSkyCamera } from './macro/useSkyCamera';

export { SOLAR_SYSTEM_OBJECTS };

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
  readonly targetCamera?: {
    readonly centerRa: number;
    readonly centerDec: number;
    readonly zoom?: number;
    /** Overrides the computed flight duration (ms), e.g. for a slower cinematic approach. */
    readonly durationMs?: number;
    readonly nonce?: number;
  };
  /** Called once a `targetCamera` flight has started, so the parent can clear it. */
  readonly onTargetCameraConsumed?: () => void;
  /** Receives `null` when empty sky is tapped. */
  readonly onSelectStar?: (star: ViewportStarItem | null) => void;
  readonly onBoundsChange?: (bounds: MacroSkyBounds) => void;
  readonly onCameraChange?: (camera: SkyCameraState) => void;
  /** A shooting star was tapped mid-flight; the caller may show a "wish made" toast. */
  readonly onWishGranted?: () => void;
  readonly connections?: ActiveStarConnection[];
  readonly myStarCoords?: { readonly ra: number; readonly dec: number; readonly name?: string };
  readonly width?: number;
  readonly height?: number;
}

/** A launch request for a shooting star; `id` changes on every new launch. */
interface MeteorRequest {
  readonly id: number;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly durationMs: number;
}

/** Random pause between shooting stars, in milliseconds (20–40s per the design). */
const METEOR_MIN_DELAY_MS = 20_000;
const METEOR_MAX_DELAY_MS = 40_000;
const METEOR_MIN_DURATION_MS = 1100;
const METEOR_MAX_DURATION_MS = 1700;
/** Generous touch target along the meteor's path, in pixels. */
const METEOR_TOUCH_RADIUS_PX = 55;

/** Shortest distance from `point` to the segment `a`–`b`. */
function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq)) : 0;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/** Star-query bounds for a camera, padded 1.5x vertically. RA wraps when minRa > maxRa. */
export function computeBounds(camera: Partial<SkyCameraState> & { centerRa: number; centerDec: number; zoom: number }): MacroSkyBounds {
  const hasViewport = Boolean(camera.viewportWidth && camera.viewportHeight);
  const width = hasViewport ? camera.viewportWidth! : 390;
  const height = hasViewport ? camera.viewportHeight! : 844;
  return skyBoundsForCamera(camera.centerRa, camera.centerDec, camera.zoom, width, height);
}

/** Prefetch window ahead of a moving camera. */
const MOTION_LOOKAHEAD_SEC = 0.35;
/** Parent camera reports while moving (it re-renders a large screen). */
const CAMERA_REPORT_INTERVAL_MS = 400;
const EMPTY_CONNECTIONS: ActiveStarConnection[] = [];
/** Label fonts; glyphs missing from Inter (emoji) fall back to system fonts. */
const LABEL_FONTS = { [LABEL_FONT_FAMILY]: [Inter_400Regular, Inter_600SemiBold] };

function toCameraState(ra: number, dec: number, zoom: number, width: number, height: number): SkyCameraState {
  const fovDec = BASE_FOV_DEG / zoom;
  return {
    centerRa: normalizeRa(ra),
    centerDec: dec,
    zoom,
    fovRa: fovDec * (width / height),
    fovDec,
    viewportWidth: width,
    viewportHeight: height,
  };
}

function heroTapTarget(ra: number, dec: number, name?: string): ViewportStarItem {
  return {
    catalog_id: 999999,
    catalog_code: 'OUR-STAR',
    common_name: name || 'Bizim Yıldızımız',
    ra,
    dec,
    magnitude: 1.5,
    spectral_type: 'G',
    base_color: '#FBBF24',
    is_claimed: true,
    is_mine: true,
    custom_name: name || 'Bizim Yıldızımız',
    luminosity_level: 1.0,
    resonance_active: false,
  };
}

/**
 * Macro sky map.
 *
 * The camera lives on the UI thread (see useSkyCamera) and every frame is
 * drawn there, stars at their exact size for the current zoom, so panning,
 * pinching, momentum and flights never wait for the JS thread or React and
 * nothing is swapped or re-recorded while zooming. The JS thread only
 * rebuilds star data when new stars arrive.
 */
function MacroSkyCanvasSkia({
  stars,
  initialCamera,
  targetCamera,
  onTargetCameraConsumed,
  onSelectStar,
  onBoundsChange,
  onCameraChange,
  onWishGranted,
  connections = EMPTY_CONNECTIONS,
  myStarCoords,
  width = 390,
  height = 844,
}: MacroSkyCanvasProps) {
  // Parents construct this prop inline; depend on its primitives only.
  const myStarRa = myStarCoords?.ra;
  const myStarDec = myStarCoords?.dec;
  const myStarName = myStarCoords?.name;

  const fontProvider = useFonts(LABEL_FONTS);

  const [initial] = useState(() => {
    const zoom = clampZoom(initialCamera?.zoom ?? 1.2);
    return { ra: initialCamera?.centerRa ?? 180, dec: clampDec(initialCamera?.centerDec ?? 0, zoom), zoom };
  });

  const starField = useSharedValue<StarField>(EMPTY_STAR_FIELD);
  const fadeClock = useSharedValue(0);
  const overlay = useSharedValue<SkyOverlay | null>(null);
  const [starFieldBuilder] = useState(() => new StarFieldBuilder(starField, fadeClock));
  const [starPaints] = useState(createStarPaints);
  const [staticAssets] = useState(() => createStaticOverlayAssets(width, height));
  const [labelCache] = useState(() => new LabelPictureCache());

  // Continuously-ticking UI-thread clock, in seconds; drives star twinkle,
  // the flowing connection lines and the shooting star (see useFrameCallback
  // below). Everything reading it stays on the UI thread.
  const animClock = useSharedValue(0);
  useFrameCallback((frameInfo) => {
    animClock.set(frameInfo.timestamp / 1000);
  });

  // Shooting stars: JS schedules a launch (screen-space corner-to-corner
  // path); the UI thread times it against its own clock so it never drifts
  // against the JS-thread Date.now() used for tap hit-testing below.
  const meteorRequest = useSharedValue<MeteorRequest | null>(null);
  const activeMeteor = useSharedValue<ActiveMeteor | null>(null);
  useAnimatedReaction(
    () => meteorRequest.get(),
    (request, previous) => {
      'worklet';
      if (!request || request.id === previous?.id) return;
      activeMeteor.set({
        fromX: request.fromX,
        fromY: request.fromY,
        toX: request.toX,
        toY: request.toY,
        durationMs: request.durationMs,
        startClock: animClock.get(),
      });
    },
  );
  const meteorIdRef = useRef(0);
  const activeMeteorJsRef = useRef<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    durationMs: number;
    launchedAt: number;
    caught: boolean;
  } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const launch = () => {
      // Diagonal corner pairs (TL↔BR, TR↔BL), nudged so it isn't always exact.
      const margin = 40;
      const corners = [
        { x: -margin, y: -margin },
        { x: width + margin, y: -margin },
        { x: -margin, y: height + margin },
        { x: width + margin, y: height + margin },
      ];
      const fromIdx = Math.floor(Math.random() * 4);
      const toIdx = 3 - fromIdx;
      const jitter = () => (Math.random() - 0.5) * height * 0.3;
      const fromX = corners[fromIdx].x;
      const fromY = corners[fromIdx].y + jitter();
      const toX = corners[toIdx].x;
      const toY = corners[toIdx].y + jitter();
      const durationMs = METEOR_MIN_DURATION_MS + Math.random() * (METEOR_MAX_DURATION_MS - METEOR_MIN_DURATION_MS);
      meteorIdRef.current += 1;
      activeMeteorJsRef.current = { fromX, fromY, toX, toY, durationMs, launchedAt: Date.now(), caught: false };
      meteorRequest.set({ id: meteorIdRef.current, fromX, fromY, toX, toY, durationMs });
    };
    const scheduleNext = () => {
      const delay = METEOR_MIN_DELAY_MS + Math.random() * (METEOR_MAX_DELAY_MS - METEOR_MIN_DELAY_MS);
      timer = setTimeout(() => {
        launch();
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => clearTimeout(timer);
  }, [width, height, meteorRequest]);

  // Latest props for callbacks fired from UI-thread notifications.
  const propsRef = useRef({
    stars,
    onBoundsChange,
    onCameraChange,
    onSelectStar,
    onTargetCameraConsumed,
    onWishGranted,
    myStarRa,
    myStarDec,
    myStarName,
  });
  useEffect(() => {
    propsRef.current = {
      stars,
      onBoundsChange,
      onCameraChange,
      onSelectStar,
      onTargetCameraConsumed,
      onWishGranted,
      myStarRa,
      myStarDec,
      myStarName,
    };
  });
  const lastCameraReportAtRef = useRef(0);

  const handleMoving = useCallback(
    (ra: number, dec: number, zoom: number, raVelocity: number, decVelocity: number) => {
      const props = propsRef.current;
      props.onBoundsChange?.(
        skyBoundsForMotion(ra, dec, zoom, raVelocity, decVelocity, MOTION_LOOKAHEAD_SEC, width, height),
      );
      const now = Date.now();
      if (now - lastCameraReportAtRef.current >= CAMERA_REPORT_INTERVAL_MS) {
        lastCameraReportAtRef.current = now;
        props.onCameraChange?.(toCameraState(ra, dec, zoom, width, height));
      }
    },
    [width, height],
  );

  const handleIdle = useCallback(
    (ra: number, dec: number, zoom: number) => {
      const props = propsRef.current;
      lastCameraReportAtRef.current = Date.now();
      props.onCameraChange?.(toCameraState(ra, dec, zoom, width, height));
      props.onBoundsChange?.(skyBoundsForCamera(ra, dec, zoom, width, height));
    },
    [width, height],
  );

  const handleTap = useCallback(
    (x: number, y: number, ra: number, dec: number, zoom: number) => {
      const props = propsRef.current;

      // A shooting star in flight takes priority over star selection: tapping
      // it grants a wish instead of opening a star card.
      const meteor = activeMeteorJsRef.current;
      if (meteor && !meteor.caught) {
        const elapsed = Date.now() - meteor.launchedAt;
        const progress = elapsed / meteor.durationMs;
        if (progress >= 0 && progress <= 1) {
          const headX = meteor.fromX + (meteor.toX - meteor.fromX) * progress;
          const headY = meteor.fromY + (meteor.toY - meteor.fromY) * progress;
          const tailProgress = Math.max(0, progress - 0.16);
          const tailX = meteor.fromX + (meteor.toX - meteor.fromX) * tailProgress;
          const tailY = meteor.fromY + (meteor.toY - meteor.fromY) * tailProgress;
          if (distanceToSegment(x, y, tailX, tailY, headX, headY) <= METEOR_TOUCH_RADIUS_PX) {
            meteor.caught = true;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            playCelestialChime().catch(() => {});
            props.onWishGranted?.();
            return;
          }
        }
      }

      if (!props.onSelectStar) return;
      // Streamed data may hold stars too faint to be drawn at this zoom.
      const candidates: ViewportStarItem[] = [
        ...SOLAR_SYSTEM_OBJECTS,
        ...props.stars.filter((star) => star.is_claimed || starVisibility(star.magnitude, star.is_claimed, zoom) > 0.05),
      ];
      if (props.myStarRa !== undefined && props.myStarDec !== undefined) {
        candidates.unshift(heroTapTarget(props.myStarRa, props.myStarDec, props.myStarName));
      }
      const hit = hitTestSky(x, y, { ra, dec, zoom }, width, height, candidates);
      if (hit) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        playCelestialChime().catch(() => {});
      }
      props.onSelectStar(hit);
    },
    [width, height],
  );

  const { camera, gesture, flightRequest } = useSkyCamera({
    width,
    height,
    initialCamera: initial,
    onMoving: handleMoving,
    onIdle: handleIdle,
    onTap: handleTap,
  });

  useEffect(() => {
    starFieldBuilder.setStars(stars);
  }, [starFieldBuilder, stars]);

  useEffect(() => {
    overlay.set(
      buildSkyOverlay({
        assets: staticAssets,
        fontProvider,
        labels: labelCache,
        myStar:
          myStarRa !== undefined && myStarDec !== undefined
            ? { ra: myStarRa, dec: myStarDec, name: myStarName }
            : null,
        connections,
        stars,
        solarObjects: SOLAR_SYSTEM_OBJECTS,
      }),
    );
  }, [overlay, staticAssets, labelCache, fontProvider, myStarRa, myStarDec, myStarName, connections, stars]);

  // First viewport report, so the parent loads stars for the initial view.
  useEffect(() => {
    const props = propsRef.current;
    props.onBoundsChange?.(skyBoundsForCamera(initial.ra, initial.dec, initial.zoom, width, height));
    props.onCameraChange?.(toCameraState(initial.ra, initial.dec, initial.zoom, width, height));
  }, [initial, width, height]);

  // A new target object starts a new flight (also to the same coordinates).
  const flightIdRef = useRef(0);
  useEffect(() => {
    if (!targetCamera) return;
    flightIdRef.current += 1;
    flightRequest.set({
      id: flightIdRef.current,
      ra: targetCamera.centerRa,
      dec: targetCamera.centerDec,
      zoom: targetCamera.zoom,
      durationMs: targetCamera.durationMs,
    });
    propsRef.current.onTargetCameraConsumed?.();
  }, [targetCamera, flightRequest]);

  // The frame is drawn on the UI thread whenever the camera, stars, overlay or
  // fade clock change; every input is read directly here so Reanimated
  // subscribes to it.
  const frame = useDerivedValue(() => {
    'worklet';
    return recordSkyFrame(
      camera.get(),
      starField.get(),
      overlay.get(),
      fadeClock.get(),
      animClock.get(),
      activeMeteor.get(),
      starPaints,
      width,
      height,
    );
  });

  const getDebugMetrics = useCallback(() => {
    const current = camera.get();
    const stats = starFieldBuilder.stats;
    return {
      zoom: current.zoom.toFixed(2),
      'ra / dec': `${normalizeRa(current.ra).toFixed(1)} / ${current.dec.toFixed(1)}`,
      'stars in view data': propsRef.current.stars.length,
      'stars drawable': stats.stars,
      'last build ms': stats.lastBuildMs.toFixed(1),
    };
  }, [camera, starFieldBuilder]);

  return (
    <View style={[styles.container, { width, height }]}>
      <GestureDetector gesture={gesture}>
        <View style={{ width, height }} collapsable={false}>
          <Canvas style={{ width, height }}>
            <Picture picture={frame} />
          </Canvas>
        </View>
      </GestureDetector>
      {SKY_DEBUG_HUD_ENABLED && <SkyDebugHud getMetrics={getDebugMetrics} />}
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
