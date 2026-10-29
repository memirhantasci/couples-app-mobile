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
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
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
import { Minimize2 } from 'lucide-react-native';

import { isSkiaAvailable, Canvas, Group, Points } from './skiaBridge';
import type { CoupleStarDetails, StarSystemMapPlanet } from '@/modules/stars/types/star.types';
import { useParticleSystem } from './useParticleSystem';
import {
  B_DEPTH,
  B_SCALE,
  B_X,
  B_Y,
  BODY_STRIDE,
  CENTER_TOUCH_RADIUS,
  DEFAULT_TILT,
  MAX_ZOOM,
  MICRO_PALETTE,
  MIN_PLANET_TOUCH_RADIUS,
  MIN_TILT,
  MIN_ZOOM_FACTOR,
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
  laneRadius,
  makeArcPath,
  planetColors,
  rgba,
  writeBodyState,
} from './micro/microScene';
import { PlanetBody } from './micro/PlanetBody';
import { OrbitPlane, OrbitTrail, ShockWave, SoulBody, SpaceBackdrop, StarCore } from './micro/SceneLayers';
import { SceneOverlays } from './micro/SceneOverlays';
import { MiniPlanet } from '../components/micro/MiniPlanet';
import { useTranslation } from 'react-i18next';

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
  /**
   * Üstte bir pencere (anı, sertifika, paywall) açıkken sahne donar: arkadaki 60 FPS
   * çizim ve bulanıklık durur, pencere açılış/kapanış animasyonları akıcı kalır.
   */
  readonly paused?: boolean;
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
  paused = false,
}: MicroSystemCanvasProps) {
  const { t } = useTranslation();
  const screen = Dimensions.get('window');
  const canvasWidth = width ?? screen.width;
  const canvasHeight = height ?? screen.height;
  const reduceMotion = useReducedMotion();

  const planetTotal = exoplanets.length;
  const layout = useMemo(
    () => computeOrbitLayout(canvasWidth, canvasHeight, viewportTop, viewportBottom, planetTotal),
    [canvasWidth, canvasHeight, viewportTop, viewportBottom, planetTotal]
  );
  const { cx, cy, maxTilt, soulRadius, fitZoom } = layout;

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

  // Kamera: iki parmakla yakınlaştırma (odak noktası sabit kalır) ve kaydırma.
  // Ölçek sığdırma ölçeğine göre çarpan olarak tutulur: gezegen sayısı/yerleşim değişince
  // sistem kendiliğinden yeniden sığar, ayrıca sıfırlamaya gerek kalmaz.
  const zoomFactor = useSharedValue(1);
  const zoom = useDerivedValue(() => fitZoom * zoomFactor.value);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const pinchStartZoom = useSharedValue(fitZoom);
  const pinchStartPanX = useSharedValue(0);
  const pinchStartPanY = useSharedValue(0);
  const pinchFocalX = useSharedValue(0);
  const pinchFocalY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchPointers = useSharedValue(0);
  // Bu dokunuşta iki parmak hareketi başladıysa tek parmak sürüklemesi parmaklar kalkana dek susar.
  const pinchEngaged = useSharedValue(false);
  // React Compiler bu nesneyi kendisi memoize eder (paylaşılan değerler kimlik olarak sabittir).
  const camera = { zoom, panX, panY };
  const minZoom = fitZoom * MIN_ZOOM_FACTOR;

  // "Tümünü gör" düğmesi yalnızca yakınlaştırılmış/kaydırılmışken görünür (iki parmak hareketi bitince güncellenir).
  const [isCameraMoved, setIsCameraMoved] = useState(false);

  const resetCamera = () => {
    zoomFactor.set(withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }));
    panX.set(withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));
    panY.set(withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) }));
    setIsCameraMoved(false);
  };

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
      clock.set(clock.get() + Math.min(0.1, frameInfo.timeSincePreviousFrame / 1000));
    }
  });

  useEffect(() => {
    const running = isFocused && !paused;
    particleCallback.setActive(running);
    clockCallback.setActive(running);
  }, [isFocused, paused, particleCallback, clockCallback]);

  // Açılış: yörüngeler merkezden açılır, gövdeler yerine süzülür.
  useEffect(() => {
    if (reduceMotion) {
      intro.set(1);
      return;
    }
    intro.set(withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }));
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
    const z = zoom.value;
    const ox = cx + panX.value;
    const oy = cy + panY.value;
    for (let i = 0; i < planetCount; i++) {
      const s = i * 3;
      writeBodyState(out, i * BODY_STRIDE, ox, oy, flatSpecs[s], time * flatSpecs[s + 1] + flatSpecs[s + 2] + spinOffset, tl, it, z);
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
    const z = zoom.value;
    const ox = cx + panX.value;
    const oy = cy + panY.value;
    writeBodyState(out, 0, ox, oy, soulRadius, lead, tl, it, z);
    writeBodyState(out, BODY_STRIDE, ox, oy, soulRadius, lead + separation, tl, it, z);
    return out;
  });

  // ─── Statik geometri ───────────────────────────────────────────────────
  const starfield = useMemo(
    () => createStarfield(starDetails.star_id, canvasWidth, canvasHeight),
    [starDetails.star_id, canvasWidth, canvasHeight]
  );
  // Her şerit bir halka: dolu şeritler altın, boşlar kesikli.
  const zones = useMemo(() => {
    const occupied = new Set(specs.map((spec) => spec.lane));
    return Array.from({ length: layout.lanes }, (_, lane) => ({
      radius: laneRadius(layout, lane),
      occupied: occupied.has(lane),
    }));
  }, [specs, layout]);
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
      wave.set(0);
      wave.set(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }));
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

  // Tek parmak: sistemi döndür (yatay) ve eğ (dikey). Hassasiyet yakınlaştırmaya bölünür;
  // böylece her ölçekte öndeki (alttaki) gövdeler parmağı aynı hızla takip eder, yakındayken savrulmaz.
  const pan = Gesture.Pan()
    .minDistance(12)
    .maxPointers(1)
    .onBegin(() => {
      'worklet';
      pinchEngaged.set(false);
    })
    .onStart(() => {
      'worklet';
      cancelAnimation(spin);
    })
    .onChange((event) => {
      'worklet';
      // iOS'ta ikinci parmak gelince de ilk parmağın sürüklemesi sürer; sahneyi yalnızca pinch yönetir.
      if (pinchEngaged.value) return;
      const k = zoomFactor.value;
      spin.set(spin.value - event.changeX / (SPIN_PX_PER_RADIAN * k));
      tilt.set(clamp(Math.min(tilt.value, maxTilt) + event.changeY / (TILT_PX_PER_UNIT * k), MIN_TILT, maxTilt));
    })
    .onEnd((event, success) => {
      'worklet';
      // İkinci parmak gelince iptal edilen sürükleme fırlatılmaz.
      if (!success || pinchEngaged.value) return;
      spin.set(withDecay({ velocity: -event.velocityX / (SPIN_PX_PER_RADIAN * zoomFactor.value), deceleration: 0.995 }));
    });

  // Pinch'in mutlak hesabının dayanağı: o anki kamera, odak, ölçek ve parmak sayısı.
  const anchorPinch = (focalX: number, focalY: number, scale: number, pointers: number) => {
    'worklet';
    pinchStartZoom.set(fitZoom * zoomFactor.value);
    pinchStartPanX.set(panX.value);
    pinchStartPanY.set(panY.value);
    pinchFocalX.set(focalX);
    pinchFocalY.set(focalY);
    pinchStartScale.set(scale);
    pinchPointers.set(pointers);
  };

  // İki parmak: parmakların arasındaki nokta sabit kalarak yakınlaş/uzaklaş; parmakları
  // birlikte kaydırınca sahne de kayar.
  const pinch = Gesture.Pinch()
    .onStart((event) => {
      'worklet';
      cancelAnimation(zoomFactor);
      cancelAnimation(panX);
      cancelAnimation(panY);
      // Süren dönme ataleti yakınlaştırılan gezegeni parmakların altından kaydırmasın.
      cancelAnimation(spin);
      pinchEngaged.set(true);
      anchorPinch(event.focalX, event.focalY, event.scale, event.numberOfPointers);
    })
    .onUpdate((event) => {
      'worklet';
      // Bir parmak kalkınca pinch bitmez (iOS ve Android), odak kalan parmağa sıçrar; üçüncü
      // parmakta da yeni ağırlık merkezine. Sıçramayı uygulamak yerine yeni düzene tutturulur.
      if (event.numberOfPointers !== pinchPointers.value) {
        anchorPinch(event.focalX, event.focalY, event.scale, event.numberOfPointers);
        return;
      }
      // Tek parmak kaldıysa sahne donar; ikinci parmak gelince kaldığı yerden sürer.
      if (event.numberOfPointers < 2) return;
      const nextZoom = clamp(pinchStartZoom.value * (event.scale / pinchStartScale.value), minZoom, MAX_ZOOM);
      const ratio = nextZoom / pinchStartZoom.value;
      // Başlangıç odağının altındaki dünya noktası, parmakların şu anki odağının altında kalır.
      const anchorX = pinchFocalX.value - cx - pinchStartPanX.value;
      const anchorY = pinchFocalY.value - cy - pinchStartPanY.value;
      const limitX = layout.outer * nextZoom;
      const limitY = layout.outer * maxTilt * nextZoom + 80;
      zoomFactor.set(nextZoom / fitZoom);
      panX.set(clamp(event.focalX - cx - anchorX * ratio, -limitX, limitX));
      panY.set(clamp(event.focalY - cy - anchorY * ratio, -limitY, limitY));
    })
    .onEnd(() => {
      'worklet';
      // Neredeyse sığdırma ölçeğine dönüldüyse sistemi yumuşakça ortala.
      if (zoomFactor.value <= 1.04) {
        zoomFactor.set(withTiming(1, { duration: 350 }));
        panX.set(withTiming(0, { duration: 350 }));
        panY.set(withTiming(0, { duration: 350 }));
        runOnJS(setIsCameraMoved)(false);
      } else {
        runOnJS(setIsCameraMoved)(true);
      }
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
      const sdx = event.x - (cx + panX.value);
      const sdy = event.y - (cy + panY.value);
      const starTouch = CENTER_TOUCH_RADIUS * clamp(zoom.value, 0.7, 2);
      const starHit = sdx * sdx + sdy * sdy <= starTouch * starTouch;
      // Yıldızın önünden geçen gezegen yıldızdan önce seçilir; arkadaki seçilmez.
      if (best >= 0 && (!starHit || m[best * BODY_STRIDE + B_DEPTH] > 0)) {
        runOnJS(handlePlanetHit)(best);
      } else if (starHit) {
        runOnJS(handleStarHit)();
      }
    });

  // Race olsaydı ikinci parmak inmeden önce kayan ilk parmak sürüklemeyi kazanır, pinch o dokunuşta
  // hiç başlamazdı; eşzamanlıyken ikinci parmak gelince pinch devralır.
  const gesture = Gesture.Race(Gesture.Simultaneous(pinch, pan), tap);

  // Yıldız tozu dünya koordinatında üretilir; kamerayla birlikte taşınır ve ölçeklenir.
  const particleTransform = useDerivedValue(() => [
    { translateX: cx + panX.value },
    { translateY: cy + panY.value },
    { scale: zoom.value },
    { translateX: -cx },
    { translateY: -cy },
  ]);

  const hintTop = (viewportTop ?? canvasHeight * 0.2) + 4;
  const emptyCaptionTop = cy + layout.inner * DEFAULT_TILT * fitZoom + 34;
  const resetButtonTop = (viewportTop ?? canvasHeight * 0.2) + 6;

  return (
    <View style={{ width: canvasWidth, height: canvasHeight }}>
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
            <OrbitPlane layout={layout} zones={zones} tilt={tilt} intro={intro} camera={camera} />

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
                  camera={camera}
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
                camera={camera}
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
              camera={camera}
            />
            <ShockWave layout={layout} tilt={tilt} wave={wave} camera={camera} />

            {/* Yıldız tozu ve kıvılcım parçacıkları */}
            <Group transform={particleTransform}>
              <Points points={particles.basePoints} mode="points" strokeWidth={2.6} strokeCap="round" color={rgba(MICRO_PALETTE.goldSoft, 0.85)} />
              <Points points={particles.res1Points} mode="points" strokeWidth={2.6} strokeCap="round" color={MICRO_PALETTE.gold} />
              <Points points={particles.res2Points} mode="points" strokeWidth={2.6} strokeCap="round" color={MICRO_PALETTE.violet} />
            </Group>

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

      {/* Yakınlaştırılmış/kaydırılmışken: tüm sistemi yeniden sığdır */}
      {isCameraMoved && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={[styles.resetWrap, { top: resetButtonTop }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={resetCamera}
            style={styles.resetButton}
            accessibilityRole="button"
            accessibilityLabel={t('stars.micro.showAllA11y')}
          >
            <Minimize2 size={14} color="#FDE68A" />
            <Text style={styles.resetText}>{t('stars.micro.showAll')}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
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
  const { t } = useTranslation();
  const screen = Dimensions.get('window');
  const canvasWidth = width ?? screen.width;
  const canvasHeight = height ?? screen.height;
  const layout = computeOrbitLayout(canvasWidth, canvasHeight, viewportTop, viewportBottom, exoplanets.length);
  const tilt = Math.min(DEFAULT_TILT, layout.maxTilt);
  const k = layout.fitZoom;
  const starColor = starDetails.base_color || '#9DB4FF';
  const specs = buildPlanetSpecs(exoplanets, layout);

  return (
    <View style={[styles.container, { width: canvasWidth, height: canvasHeight }]}>
      <RNLinearGradient colors={['#120B2C', '#07051A', '#030209']} style={StyleSheet.absoluteFill} />

      {Array.from({ length: layout.lanes }, (_, lane) => {
        const radius = laneRadius(layout, lane) * k;
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
        accessibilityLabel={t('stars.micro.sendLightA11y')}
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
        const size = spec.radius * 2 * k;
        const x = layout.cx + Math.cos(spec.phase) * spec.orbitRadius * k;
        const y = layout.cy + Math.sin(spec.phase) * spec.orbitRadius * tilt * k;
        return (
          <TouchableOpacity
            key={planet.id}
            activeOpacity={0.8}
            onPress={() => onSelectPlanet?.(planet)}
            style={[styles.fallbackPlanet, { left: x - size / 2 - 10, top: y - size / 2 - 10 }]}
            accessibilityLabel={planet.is_locked ? t('stars.micro.lockedPlanetA11y') : planet.display_title}
          >
            <MiniPlanet planet={planet} size={size} />
          </TouchableOpacity>
        );
      })}

      <Text style={[styles.fallbackNote, { top: (viewportTop ?? canvasHeight * 0.2) + 4 }]}>
        {t('stars.micro.fallbackNote')}
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
  resetWrap: {
    position: 'absolute',
    right: 16,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 8, 26, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(253, 230, 138, 0.4)',
  },
  resetText: {
    color: '#FDE68A',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
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
