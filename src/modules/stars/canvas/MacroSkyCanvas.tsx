import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Sparkles } from 'lucide-react-native';
import { playCelestialChime, hapticSuccess, hapticStamp } from '@/lib/soundEffects';
import { Canvas, Picture, useFonts, isSkiaAvailable } from './skiaBridge';
import type {
  ActiveStarConnection,
  ViewportStarItem,
  SkyCameraState,
} from '@/modules/stars/types/star.types';
import { SkyDebugHud } from './macro/debug/SkyDebugHud';
import { SKY_DEBUG_HUD_ENABLED } from './macro/debug/skyDebugConfig';
import { createStarPaints, METEOR_CATCH_BURST_MS, recordSkyFrame } from './macro/drawSkyFrame';
import { hitTestSky } from './macro/hitTest';
import { hitTestMeteor, type CaughtMeteor } from './macro/meteorSchedule';
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
import { SOLAR_SYSTEM_OBJECTS, isInsideSolarSystem } from './macro/solarSystem';
import { EMPTY_STAR_FIELD, StarFieldBuilder, type StarField } from './macro/starField';
import { starVisibility, UNCLAIMED_STAR_BRIGHTNESS } from './macro/starStyle';
import { useSkyCamera } from './macro/useSkyCamera';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';

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
  /** A shooting star was tapped mid-flight (each meteor can be caught once); the caller opens the wish flow. */
  readonly onMeteorCaught?: () => void;
  readonly connections?: ActiveStarConnection[];
  readonly myStarCoords?: {
    readonly ra: number;
    readonly dec: number;
    readonly name?: string;
    readonly luminosity?: number;
    readonly base_color?: string;
    readonly spectral_type?: string;
    readonly catalog_id?: number;
    readonly catalog_code?: string;
    readonly resonance_active?: boolean;
  };
  readonly width?: number;
  readonly height?: number;
  /**
   * The sky stands still while something covers it (a window, the wish
   * screen) and is redrawn only when the camera or its data changes. It also
   * stands still while its screen is out of focus.
   */
  readonly paused?: boolean;
}

/** Generous touch target along the meteor's path, in pixels. */
const METEOR_TOUCH_RADIUS_PX = 55;

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

function heroTapTarget(
  ra: number,
  dec: number,
  name?: string,
  extra?: {
    luminosity?: number;
    base_color?: string;
    spectral_type?: string;
    catalog_id?: number;
    catalog_code?: string;
    resonance_active?: boolean;
  },
): ViewportStarItem {
  return {
    catalog_id: extra?.catalog_id ?? 999999,
    catalog_code: extra?.catalog_code ?? 'OUR-STAR',
    common_name: name || i18n.t('stars.defaultName'),
    ra,
    dec,
    magnitude: 1.5,
    spectral_type: extra?.spectral_type ?? 'G',
    base_color: extra?.base_color ?? '#FBBF24',
    is_claimed: true,
    is_mine: true,
    custom_name: name || i18n.t('stars.defaultName'),
    luminosity_level: extra?.luminosity ?? UNCLAIMED_STAR_BRIGHTNESS,
    resonance_active: extra?.resonance_active ?? false,
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
  stars: allStars,
  initialCamera,
  targetCamera,
  onTargetCameraConsumed,
  onSelectStar,
  onBoundsChange,
  onCameraChange,
  onMeteorCaught,
  connections = EMPTY_CONNECTIONS,
  myStarCoords,
  width = 390,
  height = 844,
  paused = false,
}: MacroSkyCanvasProps) {
  const { t } = useTranslation();
  // Parents construct this prop inline; depend on its primitives only.
  const myStarRa = myStarCoords?.ra;
  const myStarDec = myStarCoords?.dec;
  const myStarName = myStarCoords?.name;
  const myStarLuminosity = myStarCoords?.luminosity;
  const myStarColor = myStarCoords?.base_color;

  // Güneş sisteminin içinde gezegenlerden başka yıldız bulunmaz (kullanıcının kendi yıldızı hariç).
  // Çizim, dokunma ve etiketler aynı süzülmüş listeyi kullanır.
  const stars = useMemo(() => {
    const filtered = allStars.filter((star) => star.is_mine || !isInsideSolarSystem(star.ra, star.dec));
    const myIndex = filtered.findIndex((star) => star.is_mine);
    if (myIndex >= 0) {
      if (
        myStarCoords?.luminosity !== undefined &&
        filtered[myIndex].luminosity_level !== myStarCoords.luminosity
      ) {
        const copy = [...filtered];
        copy[myIndex] = {
          ...copy[myIndex],
          luminosity_level: myStarCoords.luminosity,
          base_color: myStarCoords.base_color ?? copy[myIndex].base_color,
          custom_name: myStarName ?? copy[myIndex].custom_name,
        };
        return copy;
      }
      return filtered;
    }
    // Eşleşen karo henüz yüklenmediyse bile kullanıcının kendi yıldızı makro haritada eksiksiz yer alır
    if (myStarRa !== undefined && myStarDec !== undefined) {
      filtered.push({
        catalog_id: myStarCoords?.catalog_id ?? 999999,
        catalog_code: myStarCoords?.catalog_code ?? 'OUR-STAR',
        common_name: myStarName || t('stars.defaultName'),
        ra: myStarRa,
        dec: myStarDec,
        magnitude: 2.0,
        spectral_type: myStarCoords?.spectral_type ?? 'G',
        base_color: myStarCoords?.base_color ?? '#FBBF24',
        is_claimed: true,
        is_mine: true,
        custom_name: myStarName || t('stars.defaultName'),
        luminosity_level: myStarCoords?.luminosity ?? UNCLAIMED_STAR_BRIGHTNESS,
        resonance_active: myStarCoords?.resonance_active ?? false,
      });
    }
    return filtered;
  }, [allStars, myStarRa, myStarDec, myStarName, myStarCoords, t]);

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

  // Continuously-ticking UI-thread clocks, read only on the UI thread:
  // `animClock` (seconds, monotonic) drives star twinkle and the flowing
  // connection lines; `skyNowMs` is the wall clock that places shooting stars.
  // Meteors are derived from the wall clock alone (see meteorSchedule), so
  // every device shows the same meteor in the same part of the sky.
  const animClock = useSharedValue(0);
  const skyNowMs = useSharedValue(0);
  const skyClock = useFrameCallback((frameInfo) => {
    animClock.set(frameInfo.timestamp / 1000);
    skyNowMs.set(Date.now());
  });

  // The last caught meteor (for its burst) and every caught id, so one
  // meteor grants a single catch.
  const caughtMeteor = useSharedValue<CaughtMeteor | null>(null);
  const caughtMeteorIdsRef = useRef(new Set<number>());
  const lastCatchAtRef = useRef(0);

  // The clocks redraw the sky every frame, so they stop while nobody can see
  // it: while something covers it (`paused`) or its screen is out of focus.
  // A catch burst still plays out first, so it never freezes half-open behind
  // the wish screen. Both clocks read the time itself, so on resume the sky
  // is exactly where it would have been.
  const [isFocused, setIsFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );
  const isRunning = isFocused && !paused;
  useEffect(() => {
    if (isRunning) {
      skyClock.setActive(true);
      return;
    }
    const burstLeftMs = lastCatchAtRef.current + METEOR_CATCH_BURST_MS - Date.now();
    if (burstLeftMs <= 0) {
      skyClock.setActive(false);
      return;
    }
    const timer = setTimeout(() => skyClock.setActive(false), burstLeftMs);
    return () => clearTimeout(timer);
  }, [isRunning, skyClock]);

  // Latest props for callbacks fired from UI-thread notifications.
  const propsRef = useRef({
    stars,
    onBoundsChange,
    onCameraChange,
    onSelectStar,
    onTargetCameraConsumed,
    onMeteorCaught,
    myStarRa,
    myStarDec,
    myStarName,
    myStarCoords,
  });
  useEffect(() => {
    propsRef.current = {
      stars,
      onBoundsChange,
      onCameraChange,
      onSelectStar,
      onTargetCameraConsumed,
      onMeteorCaught,
      myStarRa,
      myStarDec,
      myStarName,
      myStarCoords,
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

      // A shooting star in flight takes priority over star selection: catching
      // it opens the wish flow instead of a star card. The camera is the one
      // the tap landed on, so the meteor is found where the user saw it.
      const now = Date.now();
      const meteor = hitTestMeteor(
        x,
        y,
        now,
        { ra, dec, zoom },
        width,
        height,
        METEOR_TOUCH_RADIUS_PX,
        caughtMeteorIdsRef.current,
      );
      if (meteor) {
        caughtMeteorIdsRef.current.add(meteor.id);
        caughtMeteor.set({ event: meteor, atMs: now });
        lastCatchAtRef.current = now;
        hapticSuccess();
        playCelestialChime().catch(() => {});
        props.onMeteorCaught?.();
        return;
      }

      if (!props.onSelectStar) return;
      // Streamed data may hold stars too faint to be drawn at this zoom.
      const candidates: ViewportStarItem[] = [
        ...SOLAR_SYSTEM_OBJECTS,
        ...props.stars.filter((star) => star.is_claimed || starVisibility(star.magnitude, star.is_claimed, zoom) > 0.05),
      ];
      if (props.myStarRa !== undefined && props.myStarDec !== undefined) {
        const existingMine = props.stars.find((s) => s.is_mine);
        candidates.unshift(
          existingMine ??
            heroTapTarget(props.myStarRa, props.myStarDec, props.myStarName, props.myStarCoords),
        );
      }
      const hit = hitTestSky(x, y, { ra, dec, zoom }, width, height, candidates);
      // Yıldız seçimi yalnızca dokunsal geri bildirim verir (ses yok).
      if (hit) {
        hapticStamp();
      }
      props.onSelectStar(hit);
    },
    [width, height, caughtMeteor],
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
            ? {
                ra: myStarRa,
                dec: myStarDec,
                name: myStarName,
                luminosity: myStarLuminosity,
                color: myStarColor,
              }
            : null,
        connections,
        stars,
        solarObjects: SOLAR_SYSTEM_OBJECTS,
      }),
    );
    // `t` dil değişince yenilenir; Güneş Sistemi etiketleri geçerli dilde yeniden çizilsin.
  }, [overlay, staticAssets, labelCache, fontProvider, myStarRa, myStarDec, myStarName, myStarLuminosity, myStarColor, connections, stars, t]);

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
      { nowMs: skyNowMs.get(), caught: caughtMeteor.get() },
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
  const { t } = useTranslation();
  return (
    <View style={[styles.container, styles.fallbackContainer, { width, height }]}>
      <View style={styles.fallbackCard}>
        <View style={styles.fallbackIconBadge}>
          <Sparkles size={28} color="#FBBF24" />
        </View>
        <Text style={styles.fallbackTitle}>{t('stars.macro.fallbackTitle')}</Text>
        <Text style={styles.fallbackSubtitle}>Skia Graphics Engine</Text>
        <Text style={styles.fallbackDescription}>
          {t('stars.macro.fallbackDescription')}
        </Text>
        <View style={styles.fallbackNoticeBox}>
          <Text style={styles.fallbackNoticeTitle}>{t('stars.macro.noticeTitle')}</Text>
          <Text style={styles.fallbackNoticeText}>
            {t('stars.macro.noticeText')}
          </Text>
          <View style={styles.fallbackCodeBadge}>
            <Text style={styles.fallbackCodeText}>npx expo run:android</Text>
          </View>
        </View>
        <Text style={styles.fallbackMetaText}>
          {t('stars.macro.loadedStars', { starCount: stars.length })}
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
