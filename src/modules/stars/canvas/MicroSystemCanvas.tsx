/**
 * @file MicroSystemCanvas.tsx
 * @module modules/stars/canvas
 * @description "Yıldızın İçi" — çiftin yıldızının etrafındaki anı gezegenleri sistemi.
 *
 * Sahne (arkadan öne):
 *   uzay fonu + dönen yıldız alanı → eğik yörünge düzlemi → kuyruk izleri →
 *   yıldızın arkasındaki gövdeler → merkez yıldız (korona, kırınım hüzmeleri,
 *   plazma) → kıvılcım şok dalgası + toz → yıldızın önündeki gövdeler →
 *   RN katmanları (gezegen isimleri, çiftin fotoğrafları, ipuçları).
 *
 * Etkileşim: yıldıza dokun → kıvılcım; gezegene dokun → anıyı aç;
 * yatay sürükle → sistemi döndür (ataletli); dikey sürükle → bakış eğikliği.
 * Görünen konum, dokunma testi ve RN katmanları aynı UI-thread durum
 * dizilerinden (`motion`, `souls`) okunur.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Easing,
  cancelAnimation,
  runOnJS,
  runOnUI,
  useDerivedValue,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withDecay,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient as RNLinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';

import { isSkiaAvailable, Canvas, Points } from './skiaBridge';
import type { CoupleStarDetails, StarSystemMapPlanet } from '@/modules/stars/types/star.types';
import { ORBIT_CONFIG } from '@/modules/stars/types/star.types';
import { useParticleSystem } from './useParticleSystem';
import {
  B_DEPTH,
  B_SCALE,
  B_X,
  B_Y,
  BODY_STRIDE,
  CENTER_TOUCH_RADIUS,
  DEFAULT_TILT,
  MICRO_PALETTE,
  MIN_PLANET_TOUCH_RADIUS,
  MIN_TILT,
  PLANET_TRAIL_DEG,
  SOUL_ANGULAR_VELOCITY,
  SOUL_TRAIL_DEG,
  SPIN_PX_PER_RADIAN,
  STAR_CORE_RADIUS,
  TILT_PX_PER_UNIT,
  buildPlanetSpecs,
  clamp,
  computeOrbitLayout,
  createStarfield,
  deterministicPhase,
  makeArcPath,
  planetColors,
  rgba,
  writeBodyState,
  zoneRadius,
} from './micro/microScene';
import { PlanetBody } from './micro/PlanetBody';
import { OrbitPlane, OrbitTrail, ShockWave, SoulBody, SpaceBackdrop, StarCore } from './micro/SceneLayers';
import { SceneOverlays } from './micro/SceneOverlays';
import { MiniPlanet } from '../components/micro/MiniPlanet';

export interface MicroSystemCanvasProps {
  readonly starDetails: CoupleStarDetails;
  readonly exoplanets: StarSystemMapPlanet[];
  readonly onSelectPlanet?: (planet: StarSystemMapPlanet) => void;
  readonly onSelectCenterStar?: (star: CoupleStarDetails) => void;
  readonly onSelectStar?: (star: CoupleStarDetails) => void;
  readonly width?: number;
  readonly height?: number;
  /** Üst başlığın alt kenarı (px): sistem bu çizginin altına yerleşir. */
  readonly viewportTop?: number;
  /** Alt panelin üst kenarı (px): sistem bu çizginin üstüne yerleşir. */
  readonly viewportBottom?: number;
  /** Canlı parlaklık (realtime); verilmezse starDetails kullanılır. */
  readonly luminosity?: number;
  /** Canlı rezonans durumu; verilmezse starDetails kullanılır. */
  readonly resonanceActive?: boolean;
  /** Altın hedef halkasıyla vurgulanan gezegen. */
  readonly highlightPlanetId?: string | null;
  /** Her artışta yıldızdan kıvılcım şok dalgası ve toz patlaması yayılır. */
  readonly sparkSignal?: number;
  /** Çiftin fotoğrafları (Premium): yıldız etrafındaki iki ruhun ucunda dolaşır. */
  readonly myAvatarUrl?: string | null;
  readonly partnerAvatarUrl?: string | null;
}

/** Ben → altın, sevgilim → gül. */
const SOUL_COLORS: readonly [string, string] = [MICRO_PALETTE.goldSoft, MICRO_PALETTE.rose];

// ============================================================================
// SKIA SAHNESİ
// ============================================================================

function MicroSystemCanvasSkia({
  starDetails,
  exoplanets,
  onSelectPlanet,
  onSelectCenterStar,
  onSelectStar,
  width,
  height,
  viewportTop,
  viewportBottom,
  luminosity: luminosityProp,
  resonanceActive,
  highlightPlanetId,
  sparkSignal = 0,
  myAvatarUrl,
  partnerAvatarUrl,
}: MicroSystemCanvasProps) {
  const screen = Dimensions.get('window');
  const canvasWidth = width ?? screen.width;
  const canvasHeight = height ?? screen.height;
  const reduceMotion = useReducedMotion();

  const layout = useMemo(
    () => computeOrbitLayout(canvasWidth, canvasHeight, viewportTop, viewportBottom),
    [canvasWidth, canvasHeight, viewportTop, viewportBottom]
  );
  const { cx, cy, maxTilt, soulRadius } = layout;

  const luminosity = luminosityProp ?? starDetails.luminosity_level ?? 1;
  const resonance = resonanceActive ?? starDetails.resonance_active;
  const starColor = starDetails.base_color || '#9DB4FF';

  // ─── Odak: ekran arkadayken animasyon döngüsü durur (pil) ──────────────
  const [isFocused, setIsFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  // ─── UI-thread durumu ──────────────────────────────────────────────────
  const clock = useSharedValue(0);
  const intro = useSharedValue(reduceMotion ? 1 : 0);
  const tilt = useSharedValue(DEFAULT_TILT);
  const spin = useSharedValue(0);
  const wave = useSharedValue(1);
  const panStartSpin = useSharedValue(0);
  const panStartTilt = useSharedValue(DEFAULT_TILT);

  const particles = useParticleSystem({
    centerX: cx,
    centerY: cy,
    starBaseRadius: STAR_CORE_RADIUS,
    isResonanceActive: resonance,
  });
  const { frameCallback: particleCallback, triggerFirework } = particles;

  // Sürekli saat: üst bileşenin yeniden çizimleri yörüngeyi asla sıfırlamaz.
  const clockCallback = useFrameCallback((frameInfo) => {
    'worklet';
    if (frameInfo.timeSincePreviousFrame) {
      clock.value += Math.min(0.1, frameInfo.timeSincePreviousFrame / 1000);
    }
  });

  useEffect(() => {
    particleCallback.setActive(isFocused);
    clockCallback.setActive(isFocused);
  }, [isFocused, particleCallback, clockCallback]);

  // Açılış: yörüngeler merkezden açılır, gövdeler yerine süzülür.
  useEffect(() => {
    if (reduceMotion) {
      intro.value = 1;
      return;
    }
    intro.value = withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) });
  }, [intro, reduceMotion]);

  // ─── Gezegen yörünge parametreleri ─────────────────────────────────────
  const specs = useMemo(() => buildPlanetSpecs(exoplanets, layout), [exoplanets, layout]);
  const flatSpecs = useMemo(() => specs.flatMap((s) => [s.orbitRadius, s.omega, s.phase]), [specs]);
  const radii = useMemo(() => specs.map((s) => s.radius), [specs]);
  const planetCount = specs.length;

  const motion = useDerivedValue(() => {
    const out: number[] = new Array(planetCount * BODY_STRIDE);
    const time = clock.value;
    const spinOffset = spin.value;
    const tl = Math.min(tilt.value, maxTilt);
    const it = intro.value;
    for (let i = 0; i < planetCount; i++) {
      const s = i * 3;
      writeBodyState(out, i * BODY_STRIDE, cx, cy, flatSpecs[s], time * flatSpecs[s + 1] + flatSpecs[s + 2] + spinOffset, tl, it);
    }
    return out;
  });

  const soulPhase = useMemo(() => deterministicPhase(starDetails.star_id), [starDetails.star_id]);
  const souls = useDerivedValue(() => {
    const out: number[] = new Array(2 * BODY_STRIDE);
    const time = clock.value;
    const tl = Math.min(tilt.value, maxTilt);
    const it = intro.value;
    const lead = time * SOUL_ANGULAR_VELOCITY + soulPhase + spin.value;
    // İki ruh birbirinin karşısında ama hiç durmadan yakınlaşıp uzaklaşarak dans eder.
    const separation = Math.PI * (0.84 + 0.16 * Math.sin(time * 0.4));
    writeBodyState(out, 0, cx, cy, soulRadius, lead, tl, it);
    writeBodyState(out, BODY_STRIDE, cx, cy, soulRadius, lead + separation, tl, it);
    return out;
  });

  // ─── Statik geometri ───────────────────────────────────────────────────
  const starfield = useMemo(
    () => createStarfield(starDetails.star_id, canvasWidth, canvasHeight),
    [starDetails.star_id, canvasWidth, canvasHeight]
  );
  const zones = useMemo(() => {
    const occupied = new Set(exoplanets.map((p) => zoneRadius(layout, p.orbit_distance)));
    return Array.from({ length: ORBIT_CONFIG.ZONE_COUNT }, (_, i) => {
      const radius = zoneRadius(layout, i + 1);
      return { radius, occupied: occupied.has(radius) };
    });
  }, [exoplanets, layout]);
  const trailPaths = useMemo(() => {
    const paths = new Map<number, ReturnType<typeof makeArcPath>>();
    for (const zone of zones) {
      paths.set(zone.radius, makeArcPath(zone.radius, 360 - PLANET_TRAIL_DEG, PLANET_TRAIL_DEG));
    }
    return paths;
  }, [zones]);
  const soulTrailPath = useMemo(() => makeArcPath(soulRadius, 360 - SOUL_TRAIL_DEG, SOUL_TRAIL_DEG), [soulRadius]);
  const highlightIndex = highlightPlanetId ? exoplanets.findIndex((p) => p.id === highlightPlanetId) : -1;

  // ─── Kıvılcım: şok dalgası + toz patlaması ─────────────────────────────
  const lastSparkRef = useRef(sparkSignal);
  useEffect(() => {
    if (sparkSignal === lastSparkRef.current) return;
    lastSparkRef.current = sparkSignal;
    if (!reduceMotion) {
      wave.value = 0;
      wave.value = withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) });
    }
    runOnUI(triggerFirework)(cx, cy, resonance);
  }, [sparkSignal, reduceMotion, wave, triggerFirework, cx, cy, resonance]);

  // ─── Dokunma ve sürükleme ──────────────────────────────────────────────
  // Hareketler her çizimde yeniden kurulur (sahne memo'lu olduğundan nadiren), bu yüzden
  // UI thread'den çağrılan işleyiciler her zaman güncel prop'ları görür.
  const handleStarHit = () => {
    onSelectCenterStar?.(starDetails);
    onSelectStar?.(starDetails);
  };
  const handlePlanetHit = (index: number) => {
    const planet = exoplanets[index];
    if (planet) onSelectPlanet?.(planet);
  };

  const pan = Gesture.Pan()
    .minDistance(12)
    .onStart(() => {
      'worklet';
      cancelAnimation(spin);
      panStartSpin.value = spin.value;
      panStartTilt.value = Math.min(tilt.value, maxTilt);
    })
    .onUpdate((event) => {
      'worklet';
      // Öndeki (alttaki) gövdeler parmağı takip eder.
      spin.value = panStartSpin.value - event.translationX / SPIN_PX_PER_RADIAN;
      tilt.value = clamp(panStartTilt.value + event.translationY / TILT_PX_PER_UNIT, MIN_TILT, maxTilt);
    })
    .onEnd((event) => {
      'worklet';
      spin.value = withDecay({ velocity: -event.velocityX / SPIN_PX_PER_RADIAN, deceleration: 0.995 });
    });

  const tap = Gesture.Tap()
    .maxDuration(450)
    .onEnd((event, success) => {
      'worklet';
      if (!success) return;
      const m = motion.value;
      let best = -1;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let i = 0; i < planetCount; i++) {
        const b = i * BODY_STRIDE;
        const dx = event.x - m[b + B_X];
        const dy = event.y - m[b + B_Y];
        const dist = Math.sqrt(dx * dx + dy * dy);
        const touch = Math.max(radii[i] * m[b + B_SCALE] + 16, MIN_PLANET_TOUCH_RADIUS);
        if (dist <= touch) {
          // Üst üste binen gezegenlerde izleyiciye yakın olan kazanır.
          const score = dist - m[b + B_DEPTH] * 10;
          if (score < bestScore) {
            bestScore = score;
            best = i;
          }
        }
      }
      const sdx = event.x - cx;
      const sdy = event.y - cy;
      const starHit = sdx * sdx + sdy * sdy <= CENTER_TOUCH_RADIUS * CENTER_TOUCH_RADIUS;
      // Yıldızın önünden geçen gezegen yıldızdan önce seçilir; arkadaki seçilmez.
      if (best >= 0 && (!starHit || m[best * BODY_STRIDE + B_DEPTH] > 0)) {
        runOnJS(handlePlanetHit)(best);
      } else if (starHit) {
        runOnJS(handleStarHit)();
      }
    });

  const gesture = Gesture.Race(pan, tap);

  const hintTop = (viewportTop ?? canvasHeight * 0.2) + 4;
  const emptyCaptionTop = cy + layout.inner * DEFAULT_TILT + 34;

  return (
    <GestureDetector gesture={gesture}>
      <View style={[styles.container, { width: canvasWidth, height: canvasHeight }]}>
        <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
          <SpaceBackdrop
            width={canvasWidth}
            height={canvasHeight}
            layout={layout}
            starColor={starColor}
            starfield={starfield}
            clock={clock}
            spin={spin}
          />
          <OrbitPlane layout={layout} zones={zones} tilt={tilt} intro={intro} />

          {/* Kuyruk izleri */}
          {exoplanets.map((planet, index) => {
            const path = trailPaths.get(specs[index]?.orbitRadius ?? 0);
            if (!path) return null;
            return (
              <OrbitTrail
                key={`trail-${planet.id}`}
                index={index}
                motion={motion}
                path={path}
                color={planetColors(planet).primary}
                alpha={planet.is_locked ? 0.22 : 0.55}
                sweepDeg={PLANET_TRAIL_DEG}
                strokeWidth={2.2}
                layout={layout}
                tilt={tilt}
                intro={intro}
              />
            );
          })}
          {SOUL_COLORS.map((color, index) => (
            <OrbitTrail
              key={`soul-trail-${index}`}
              index={index}
              motion={souls}
              path={soulTrailPath}
              color={color}
              alpha={resonance ? 0.85 : 0.6}
              sweepDeg={SOUL_TRAIL_DEG}
              strokeWidth={1.6}
              layout={layout}
              tilt={tilt}
              intro={intro}
            />
          ))}

          {/* Yıldızın arkasındaki gövdeler */}
          {exoplanets.map((planet, index) => (
            <PlanetBody
              key={`back-${planet.id}`}
              index={index}
              planet={planet}
              radius={radii[index] ?? 10}
              motion={motion}
              clock={clock}
              layer="back"
              highlighted={index === highlightIndex}
            />
          ))}
          {SOUL_COLORS.map((color, index) => (
            <SoulBody key={`soul-back-${index}`} index={index} souls={souls} color={color} layer="back" resonance={resonance} />
          ))}

          <StarCore
            layout={layout}
            color={starColor}
            luminosity={luminosity}
            resonance={resonance}
            clock={clock}
            intro={intro}
            wave={wave}
          />
          <ShockWave layout={layout} tilt={tilt} wave={wave} />

          {/* Yıldız tozu ve kıvılcım parçacıkları */}
          <Points points={particles.basePoints} mode="points" strokeWidth={2.6} strokeCap="round" color={rgba(MICRO_PALETTE.goldSoft, 0.85)} />
          <Points points={particles.res1Points} mode="points" strokeWidth={2.6} strokeCap="round" color={MICRO_PALETTE.gold} />
          <Points points={particles.res2Points} mode="points" strokeWidth={2.6} strokeCap="round" color={MICRO_PALETTE.violet} />

          {/* Yıldızın önündeki gövdeler */}
          {SOUL_COLORS.map((color, index) => (
            <SoulBody key={`soul-front-${index}`} index={index} souls={souls} color={color} layer="front" resonance={resonance} />
          ))}
          {exoplanets.map((planet, index) => (
            <PlanetBody
              key={`front-${planet.id}`}
              index={index}
              planet={planet}
              radius={radii[index] ?? 10}
              motion={motion}
              clock={clock}
              layer="front"
              highlighted={index === highlightIndex}
            />
          ))}
        </Canvas>

        <SceneOverlays
          planets={exoplanets}
          radii={radii}
          motion={motion}
          souls={souls}
          intro={intro}
          soulColors={SOUL_COLORS}
          myAvatarUrl={myAvatarUrl}
          partnerAvatarUrl={partnerAvatarUrl}
          hintTop={hintTop}
          emptyCaptionTop={emptyCaptionTop}
          showHint
        />
      </View>
    </GestureDetector>
  );
}

// ============================================================================
// YEDEK (Skia'sız ortamlar: Expo Go, web önizleme)
// ============================================================================

function MicroSystemCanvasFallback({
  starDetails,
  exoplanets,
  onSelectPlanet,
  onSelectCenterStar,
  width,
  height,
  viewportTop,
  viewportBottom,
}: MicroSystemCanvasProps) {
  const screen = Dimensions.get('window');
  const canvasWidth = width ?? screen.width;
  const canvasHeight = height ?? screen.height;
  const layout = computeOrbitLayout(canvasWidth, canvasHeight, viewportTop, viewportBottom);
  const tilt = Math.min(DEFAULT_TILT, layout.maxTilt);
  const starColor = starDetails.base_color || '#9DB4FF';
  const specs = buildPlanetSpecs(exoplanets, layout);

  return (
    <View style={[styles.container, { width: canvasWidth, height: canvasHeight }]}>
      <RNLinearGradient colors={['#120B2C', '#07051A', '#030209']} style={StyleSheet.absoluteFill} />

      {Array.from({ length: ORBIT_CONFIG.ZONE_COUNT }, (_, i) => {
        const radius = zoneRadius(layout, i + 1);
        return (
          <View
            key={radius}
            pointerEvents="none"
            style={[
              styles.fallbackOrbit,
              {
                left: layout.cx - radius,
                top: layout.cy - radius * tilt,
                width: radius * 2,
                height: radius * 2 * tilt,
                borderRadius: radius,
              },
            ]}
          />
        );
      })}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onSelectCenterStar?.(starDetails)}
        style={[
          styles.fallbackStar,
          {
            left: layout.cx - STAR_CORE_RADIUS,
            top: layout.cy - STAR_CORE_RADIUS,
            shadowColor: starColor,
          },
        ]}
        accessibilityLabel="Yıldıza ışık gönder"
      >
        <RNLinearGradient
          colors={['#FFFFFF', '#FFF8EC', starColor]}
          start={{ x: 0.3, y: 0.2 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.fallbackStarCore}
        />
      </TouchableOpacity>

      {exoplanets.map((planet, index) => {
        const spec = specs[index];
        if (!spec) return null;
        const size = spec.radius * 2;
        const x = layout.cx + Math.cos(spec.phase) * spec.orbitRadius;
        const y = layout.cy + Math.sin(spec.phase) * spec.orbitRadius * tilt;
        return (
          <TouchableOpacity
            key={planet.id}
            activeOpacity={0.8}
            onPress={() => onSelectPlanet?.(planet)}
            style={[styles.fallbackPlanet, { left: x - size / 2 - 10, top: y - size / 2 - 10 }]}
            accessibilityLabel={planet.is_locked ? 'Kilitli anı gezegeni' : planet.display_title}
          >
            <MiniPlanet planet={planet} size={size} />
          </TouchableOpacity>
        );
      })}

      <Text style={[styles.fallbackNote, { top: (viewportTop ?? canvasHeight * 0.2) + 4 }]}>
        Canlı yörünge animasyonları cihaz derlemesinde çalışır
      </Text>
    </View>
  );
}

/** Üst ekranın saniyelik geri sayım çizimleri sahneyi yeniden kurmasın diye memo'lanır. */
export const MicroSystemCanvas = React.memo(function MicroSystemCanvas(props: MicroSystemCanvasProps) {
  if (!isSkiaAvailable) {
    return <MicroSystemCanvasFallback {...props} />;
  }
  return <MicroSystemCanvasSkia {...props} />;
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#030209',
  },
  fallbackOrbit: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.22)',
  },
  fallbackStar: {
    position: 'absolute',
    width: STAR_CORE_RADIUS * 2,
    height: STAR_CORE_RADIUS * 2,
    borderRadius: STAR_CORE_RADIUS,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 28,
  },
  fallbackStarCore: {
    flex: 1,
    borderRadius: STAR_CORE_RADIUS,
  },
  fallbackPlanet: {
    position: 'absolute',
    padding: 10,
  },
  fallbackNote: {
    position: 'absolute',
    left: 24,
    right: 24,
    textAlign: 'center',
    color: 'rgba(203, 213, 225, 0.5)',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
});

export default MicroSystemCanvas;
