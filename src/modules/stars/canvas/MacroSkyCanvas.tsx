import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import * as Haptics from 'expo-haptics';
import { Sparkles } from 'lucide-react-native';
import { Canvas, Picture, useFont, isSkiaAvailable } from './skiaBridge';
import type {
  ActiveStarConnection,
  ViewportStarItem,
  SkyCameraState,
} from '@/modules/stars/types/star.types';
import { SkyDebugHud } from './macro/debug/SkyDebugHud';
import { SKY_DEBUG_HUD_ENABLED } from './macro/debug/skyDebugConfig';
import { recordSkyFrame } from './macro/drawSkyFrame';
import { hitTestSky } from './macro/hitTest';
import {
  buildSkyOverlay,
  createStaticOverlayAssets,
  LabelPictureCache,
  type SkyOverlay,
} from './macro/skyOverlay';
import {
  bandForZoom,
  BASE_FOV_DEG,
  clampDec,
  clampZoom,
  normalizeRa,
  skyBoundsForCamera,
  skyBoundsForMotion,
} from './macro/skyProjection';
import { SOLAR_SYSTEM_OBJECTS } from './macro/solarSystem';
import { EMPTY_STAR_SCENE, StarSceneManager, type StarScene } from './macro/starTileScene';
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
  readonly targetCamera?: { readonly centerRa: number; readonly centerDec: number; readonly zoom?: number; readonly nonce?: number };
  /** Called once a `targetCamera` flight has started, so the parent can clear it. */
  readonly onTargetCameraConsumed?: () => void;
  /** Receives `null` when empty sky is tapped. */
  readonly onSelectStar?: (star: ViewportStarItem | null) => void;
  readonly onBoundsChange?: (bounds: MacroSkyBounds) => void;
  readonly onCameraChange?: (camera: SkyCameraState) => void;
  readonly connections?: ActiveStarConnection[];
  readonly myStarCoords?: { readonly ra: number; readonly dec: number; readonly name?: string };
  readonly width?: number;
  readonly height?: number;
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
 * The camera lives on the UI thread (see useSkyCamera); every frame is drawn
 * there from pictures recorded ahead of time in world space, so panning,
 * pinching, momentum and flights never wait for the JS thread or React.
 * The JS thread records star tiles only when data or the zoom band changes.
 */
function MacroSkyCanvasSkia({
  stars,
  initialCamera,
  targetCamera,
  onTargetCameraConsumed,
  onSelectStar,
  onBoundsChange,
  onCameraChange,
  connections = EMPTY_CONNECTIONS,
  myStarCoords,
  width = 390,
  height = 844,
}: MacroSkyCanvasProps) {
  // Parents construct this prop inline; depend on its primitives only.
  const myStarRa = myStarCoords?.ra;
  const myStarDec = myStarCoords?.dec;
  const myStarName = myStarCoords?.name;

  const labelFont = useFont(Inter_400Regular, 10);
  const nameFont = useFont(Inter_600SemiBold, 12);
  const sectorFont = useFont(Inter_600SemiBold, 14);

  const [initial] = useState(() => {
    const zoom = clampZoom(initialCamera?.zoom ?? 1.2);
    return { ra: initialCamera?.centerRa ?? 180, dec: clampDec(initialCamera?.centerDec ?? 0, zoom), zoom };
  });

  const starScene = useSharedValue<StarScene>(EMPTY_STAR_SCENE);
  const fadeClock = useSharedValue(0);
  const overlay = useSharedValue<SkyOverlay | null>(null);
  const [sceneManager] = useState(() => new StarSceneManager(height, starScene, fadeClock));
  const [staticAssets] = useState(() => createStaticOverlayAssets(width, height));
  const [labelCache] = useState(() => new LabelPictureCache());

  // Latest props for callbacks fired from UI-thread notifications.
  const propsRef = useRef({
    stars,
    onBoundsChange,
    onCameraChange,
    onSelectStar,
    onTargetCameraConsumed,
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

  const handleBandChange = useCallback((band: number) => sceneManager.setBand(band), [sceneManager]);

  const handleTap = useCallback(
    (x: number, y: number, ra: number, dec: number, zoom: number) => {
      const props = propsRef.current;
      if (!props.onSelectStar) return;
      // Streamed data may hold fainter stars than the current band draws.
      const magnitudeLimit = sceneManager.magnitudeLimit;
      const candidates: ViewportStarItem[] = [
        ...SOLAR_SYSTEM_OBJECTS,
        ...props.stars.filter((star) => star.is_claimed || star.magnitude <= magnitudeLimit),
      ];
      if (props.myStarRa !== undefined && props.myStarDec !== undefined) {
        candidates.unshift(heroTapTarget(props.myStarRa, props.myStarDec, props.myStarName));
      }
      const hit = hitTestSky(x, y, { ra, dec, zoom }, width, height, candidates);
      if (hit) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      props.onSelectStar(hit);
    },
    [width, height, sceneManager],
  );

  const { camera, gesture, flightRequest } = useSkyCamera({
    width,
    height,
    initialCamera: initial,
    onMoving: handleMoving,
    onIdle: handleIdle,
    onBandChange: handleBandChange,
    onTap: handleTap,
  });

  useEffect(() => {
    sceneManager.setBand(bandForZoom(initial.zoom));
    return () => sceneManager.dispose();
  }, [sceneManager, initial]);

  useEffect(() => {
    sceneManager.setStars(stars);
  }, [sceneManager, stars]);

  useEffect(() => {
    overlay.set(
      buildSkyOverlay({
        assets: staticAssets,
        fonts: { label: labelFont, name: nameFont, sector: sectorFont },
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
  }, [overlay, staticAssets, labelCache, labelFont, nameFont, sectorFont, myStarRa, myStarDec, myStarName, connections, stars]);

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
    });
    propsRef.current.onTargetCameraConsumed?.();
  }, [targetCamera, flightRequest]);

  const frame = useDerivedValue(() => {
    'worklet';
    return recordSkyFrame(camera.get(), starScene.get(), overlay.get(), fadeClock.get(), width, height);
  });

  const getDebugMetrics = useCallback(() => {
    const current = camera.get();
    const stats = sceneManager.stats;
    return {
      zoom: current.zoom.toFixed(2),
      'ra / dec': `${normalizeRa(current.ra).toFixed(1)} / ${current.dec.toFixed(1)}`,
      band: bandForZoom(current.zoom),
      'stars in view data': propsRef.current.stars.length,
      'tile entries': stats.entries,
      'pictures recorded': stats.records,
      'last rebuild ms': stats.lastRebuildMs.toFixed(1),
    };
  }, [camera, sceneManager]);

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
