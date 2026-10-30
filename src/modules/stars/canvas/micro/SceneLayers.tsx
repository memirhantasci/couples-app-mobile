/**
 * @file SceneLayers.tsx
 * @module modules/stars/canvas/micro
 * @description Mikro sahnenin Skia katmanları: uzay fonu, yörünge düzlemi,
 * kuyruk izleri, merkez yıldız, çiftin "iki ruhu" ve kıvılcım şok dalgası.
 * Tüm animasyonlar UI thread'deki ortak saat (`clock`) ve paylaşılan
 * değerlerden türetilir; React yeniden çizimi gerektirmez.
 */

import React, { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import {
  BlurMask,
  Circle,
  DashPathEffect,
  Group,
  LinearGradient,
  Path,
  Points,
  RadialGradient,
  Rect,
  SweepGradient,
  vec,
} from '../skiaBridge';
import type { SkPath } from '@shopify/react-native-skia';
import {
  B_ALPHA,
  B_ANGLE,
  B_DEPTH,
  B_SCALE,
  B_X,
  B_Y,
  BODY_STRIDE,
  MICRO_PALETTE,
  STAR_CORE_RADIUS,
  clamp,
  introOrbitFactor,
  makeArcPath,
  makeSpikePath,
  rgba,
  shade,
  type OrbitLayout,
  type StarfieldLayers,
} from './microScene';

/** İki parmakla yakınlaştırma/kaydırma kamerası (sistem merkezi etrafında). */
export interface SceneCamera {
  readonly zoom: SharedValue<number>;
  readonly panX: SharedValue<number>;
  readonly panY: SharedValue<number>;
}

// ============================================================================
// UZAY FONU
// ============================================================================

export interface SpaceBackdropProps {
  readonly width: number;
  readonly height: number;
  readonly layout: OrbitLayout;
  readonly starColor: string;
  readonly starfield: StarfieldLayers;
  readonly clock: SharedValue<number>;
  readonly spin: SharedValue<number>;
}

export const SpaceBackdrop = React.memo(function SpaceBackdrop({
  width: w,
  height: h,
  layout,
  starColor,
  starfield,
  clock,
  spin,
}: SpaceBackdropProps) {
  const reach = Math.max(w, h);

  // Yıldız alanı çok yavaş döner; sistemi sürüklemek hafif bir paralaks verir.
  const drift = useDerivedValue(() => [{ rotate: clock.value * 0.006 + spin.value * 0.12 }]);
  const nebulaBreath = useDerivedValue(() => 0.82 + 0.18 * Math.sin(clock.value * 0.22));
  const twinkleA = useDerivedValue(() => 0.75 + 0.25 * Math.sin(clock.value * 1.3));
  const twinkleB = useDerivedValue(() => 0.7 + 0.3 * Math.sin(clock.value * 0.9 + 2.1));
  const twinkleC = useDerivedValue(() => 0.72 + 0.28 * Math.sin(clock.value * 1.7 + 4.2));

  return (
    <Group>
      {/* Koyu, birbirine yakın renkler: dither olmadan merkez etrafında halka halka bantlaşır */}
      <Rect x={0} y={0} width={w} height={h} dither>
        <RadialGradient
          c={vec(layout.cx, layout.cy)}
          r={reach * 0.9}
          colors={['#160E36', '#090619', '#030209']}
          positions={[0, 0.5, 1]}
        />
      </Rect>

      {/* Bulutsular: mor (sol üst), gül (sağ alt), buz mavisi (sağ üst) */}
      <Group opacity={nebulaBreath}>
        <Circle cx={w * 0.06} cy={h * 0.2} r={w * 0.78} dither>
          <RadialGradient
            c={vec(w * 0.06, h * 0.2)}
            r={w * 0.78}
            colors={['rgba(124, 58, 237, 0.17)', 'rgba(124, 58, 237, 0.05)', 'rgba(124, 58, 237, 0)']}
            positions={[0, 0.45, 1]}
          />
        </Circle>
        <Circle cx={w * 0.98} cy={h * 0.82} r={w * 0.8} dither>
          <RadialGradient
            c={vec(w * 0.98, h * 0.82)}
            r={w * 0.8}
            colors={['rgba(219, 39, 119, 0.14)', 'rgba(219, 39, 119, 0.04)', 'rgba(219, 39, 119, 0)']}
            positions={[0, 0.45, 1]}
          />
        </Circle>
        <Circle cx={w * 0.9} cy={h * 0.08} r={w * 0.56} dither>
          <RadialGradient
            c={vec(w * 0.9, h * 0.08)}
            r={w * 0.56}
            colors={['rgba(14, 165, 233, 0.08)', 'rgba(14, 165, 233, 0.02)', 'rgba(14, 165, 233, 0)']}
            positions={[0, 0.5, 1]}
          />
        </Circle>
      </Group>

      {/* Yıldızın renginde hafif bir pus */}
      <Circle cx={layout.cx} cy={layout.cy} r={w * 0.95} dither>
        <RadialGradient
          c={vec(layout.cx, layout.cy)}
          r={w * 0.95}
          colors={[rgba(starColor, 0.15), rgba(starColor, 0.04), rgba(starColor, 0)]}
          positions={[0, 0.4, 1]}
        />
      </Circle>

      <Group transform={drift} origin={vec(w / 2, h / 2)}>
        <Points points={starfield.dust} mode="points" strokeWidth={1.1} strokeCap="round" color="rgba(226, 232, 255, 0.5)" opacity={twinkleA} />
        <Points points={starfield.small} mode="points" strokeWidth={1.8} strokeCap="round" color="rgba(240, 240, 255, 0.78)" opacity={twinkleB} />
        <Points points={starfield.bright} mode="points" strokeWidth={7} strokeCap="round" color="rgba(196, 210, 255, 0.1)" />
        <Points points={starfield.bright} mode="points" strokeWidth={2.6} strokeCap="round" color="#FFFFFF" opacity={twinkleC} />
      </Group>
    </Group>
  );
});

// ============================================================================
// YÖRÜNGE DÜZLEMİ (halkalar + ışık diski)
// ============================================================================

export interface OrbitPlaneProps {
  readonly layout: OrbitLayout;
  readonly zones: readonly { readonly radius: number; readonly occupied: boolean }[];
  readonly tilt: SharedValue<number>;
  readonly intro: SharedValue<number>;
  readonly camera: SceneCamera;
}

export const OrbitPlane = React.memo(function OrbitPlane({ layout, zones, tilt, intro, camera }: OrbitPlaneProps) {
  const { cx, cy, maxTilt, outer } = layout;
  const { zoom, panX, panY } = camera;
  const transform = useDerivedValue(() => [
    { translateX: cx + panX.value },
    { translateY: cy + panY.value },
    { scaleY: Math.min(tilt.value, maxTilt) },
    { scale: introOrbitFactor(intro.value) * zoom.value },
  ]);
  const opacity = useDerivedValue(() => intro.value);
  const discRadius = outer * 1.12;

  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={discRadius} dither>
        <RadialGradient
          c={vec(0, 0)}
          r={discRadius}
          colors={['rgba(167, 139, 250, 0.1)', 'rgba(167, 139, 250, 0.035)', 'rgba(167, 139, 250, 0)']}
          positions={[0, 0.62, 1]}
        />
      </Circle>
      {zones.map(({ radius, occupied }) => (
        <Circle key={radius} cx={0} cy={0} r={radius} style="stroke" strokeWidth={occupied ? 1.2 : 0.9}>
          {/* Arka (üst) yarı soluk, ön (alt) yarı parlak: derinlik hissi */}
          <LinearGradient
            start={vec(0, -radius)}
            end={vec(0, radius)}
            colors={
              occupied
                ? ['rgba(196, 181, 253, 0.1)', 'rgba(253, 230, 138, 0.42)']
                : ['rgba(196, 181, 253, 0.05)', 'rgba(196, 181, 253, 0.2)']
            }
          />
          {!occupied && <DashPathEffect intervals={[2, 7]} />}
        </Circle>
      ))}
    </Group>
  );
});

// ============================================================================
// KUYRUK İZİ (gezegen ve ruhlar için)
// ============================================================================

export interface OrbitTrailProps {
  readonly index: number;
  readonly motion: SharedValue<number[]>;
  readonly path: SkPath;
  readonly color: string;
  readonly alpha: number;
  readonly sweepDeg: number;
  readonly strokeWidth: number;
  readonly layout: OrbitLayout;
  readonly tilt: SharedValue<number>;
  readonly intro: SharedValue<number>;
  readonly camera: SceneCamera;
}

/**
 * Yörünge boyunca gövdenin arkasında sönümlenen ışık izi. Yol, açı 0'da biten
 * sabit bir yaydır; grup gövdenin anlık açısına döndürülür ve eğik düzleme basılır.
 */
export const OrbitTrail = React.memo(function OrbitTrail({
  index,
  motion,
  path,
  color,
  alpha,
  sweepDeg,
  strokeWidth,
  layout,
  tilt,
  intro,
  camera,
}: OrbitTrailProps) {
  const base = index * BODY_STRIDE;
  const { cx, cy, maxTilt } = layout;
  const { zoom, panX, panY } = camera;
  const transform = useDerivedValue(() => [
    { translateX: cx + panX.value },
    { translateY: cy + panY.value },
    { scaleY: Math.min(tilt.value, maxTilt) },
    { scale: introOrbitFactor(intro.value) * zoom.value },
    { rotate: motion.value[base + B_ANGLE] ?? 0 },
  ]);
  const opacity = useDerivedValue(() => intro.value);

  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={path} style="stroke" strokeWidth={strokeWidth} strokeCap="round">
        <SweepGradient c={vec(0, 0)} start={360 - sweepDeg} end={360} colors={[rgba(color, 0), rgba(color, alpha)]} />
      </Path>
    </Group>
  );
});

// ============================================================================
// İKİ RUH (çiftin yıldız etrafında dans eden ışıkları)
// ============================================================================

export interface SoulBodyProps {
  readonly index: number;
  readonly souls: SharedValue<number[]>;
  readonly color: string;
  readonly layer: 'back' | 'front';
  readonly resonance: boolean;
}

export const SoulBody = React.memo(function SoulBody({ index, souls, color, layer, resonance }: SoulBodyProps) {
  const base = index * BODY_STRIDE;
  const transform = useDerivedValue(() => {
    const m = souls.value;
    return [
      { translateX: m[base + B_X] ?? 0 },
      { translateY: m[base + B_Y] ?? 0 },
      { scale: m[base + B_SCALE] ?? 1 },
    ];
  });
  const opacity = useDerivedValue(() => {
    const m = souls.value;
    const inFront = (m[base + B_DEPTH] ?? 0) > 0;
    const visible = layer === 'front' ? inFront : !inFront;
    return visible ? m[base + B_ALPHA] ?? 0 : 0;
  });
  const glow = resonance ? 16 : 11;

  return (
    <Group transform={transform} opacity={opacity}>
      <Circle cx={0} cy={0} r={glow} dither>
        <RadialGradient
          c={vec(0, 0)}
          r={glow}
          colors={[rgba(color, resonance ? 0.9 : 0.75), rgba(color, 0.2), rgba(color, 0)]}
          positions={[0, 0.4, 1]}
        />
      </Circle>
      <Circle cx={0} cy={0} r={3.8} color={shade(color, 0.55)} />
      <Circle cx={0} cy={0} r={1.9} color="#FFFFFF" />
    </Group>
  );
});

// ============================================================================
// MERKEZ YILDIZ
// ============================================================================

export interface StarCoreProps {
  readonly layout: OrbitLayout;
  readonly color: string;
  readonly luminosity: number;
  readonly resonance: boolean;
  readonly clock: SharedValue<number>;
  readonly intro: SharedValue<number>;
  readonly wave: SharedValue<number>;
  readonly camera: SceneCamera;
}

const WHITE_0 = 'rgba(255, 255, 255, 0)';

export const StarCore = React.memo(function StarCore({
  layout,
  color,
  luminosity,
  resonance,
  clock,
  intro,
  wave,
  camera,
}: StarCoreProps) {
  const R = STAR_CORE_RADIUS;
  const { cx, cy } = layout;
  const { zoom, panX, panY } = camera;
  // Parlaklık [0.1, 1] → ışıma gücü [0.5, 1]
  const lum = 0.45 + 0.55 * clamp(luminosity, 0.1, 1);
  const spikeLength = R * 4.6 * lum;
  const minorSpikeLength = R * 2.1 * lum;

  const transform = useDerivedValue(() => {
    const pulse = 1 + 0.045 * Math.sin(clock.value * 1.7);
    return [
      { translateX: cx + panX.value },
      { translateY: cy + panY.value },
      { scale: (0.55 + 0.45 * intro.value) * pulse * zoom.value },
    ];
  });
  const spikeTransform = useDerivedValue(() => [
    { rotate: 0.035 * Math.sin(clock.value * 0.35) },
    { scale: 0.94 + 0.08 * Math.sin(clock.value * 1.1 + 1.3) },
  ]);
  const plasmaA = useDerivedValue(() => [{ rotate: clock.value * 0.22 }]);
  const plasmaB = useDerivedValue(() => [{ rotate: 1 - clock.value * 0.15 }]);
  const flash = useDerivedValue(() => (wave.value < 1 ? Math.max(0, 1 - wave.value * 2.6) * 0.85 : 0));
  const resOuter = useDerivedValue(() => [{ rotate: clock.value * 0.6 }]);
  const resInner = useDerivedValue(() => [{ rotate: -clock.value * 0.42 }]);
  const resPulse = useDerivedValue(() => 0.75 + 0.25 * Math.sin(clock.value * 2.4));

  const spikes = useMemo(() => makeSpikePath(spikeLength, 1.6, [0, 60, 120]), [spikeLength]);
  const minorSpikes = useMemo(() => makeSpikePath(minorSpikeLength, 1.1, [30, 90, 150]), [minorSpikeLength]);
  const resArcOuter = useMemo(() => makeArcPath(R * 2.3, 0, 250), [R]);
  const resArcInner = useMemo(() => makeArcPath(R * 1.85, 0, 200), [R]);

  return (
    <Group transform={transform}>
      {/* Geniş ışıma */}
      <Circle cx={0} cy={0} r={R * 6} dither>
        <RadialGradient
          c={vec(0, 0)}
          r={R * 6}
          colors={[rgba(color, 0.3 * lum), rgba(color, 0.1 * lum), rgba(color, 0)]}
          positions={[0, 0.35, 1]}
        />
      </Circle>

      {/* Kırınım hüzmeleri */}
      <Group transform={spikeTransform}>
        <Path path={spikes} dither>
          <RadialGradient
            c={vec(0, 0)}
            r={spikeLength}
            colors={['rgba(255, 255, 255, 0.92)', rgba(color, 0.45), rgba(color, 0)]}
            positions={[0, 0.22, 1]}
          />
        </Path>
        <Path path={minorSpikes} dither>
          <RadialGradient
            c={vec(0, 0)}
            r={minorSpikeLength}
            colors={['rgba(255, 255, 255, 0.55)', rgba(color, 0.2), rgba(color, 0)]}
            positions={[0, 0.3, 1]}
          />
        </Path>
      </Group>

      {/* Korona */}
      <Circle cx={0} cy={0} r={R * 2.6} dither>
        <RadialGradient
          c={vec(0, 0)}
          r={R * 2.6}
          colors={[`rgba(255, 255, 255, ${(0.8 * lum).toFixed(3)})`, rgba(color, 0.42 * lum), rgba(color, 0)]}
          positions={[0, 0.4, 1]}
        />
      </Circle>

      {/* Çekirdek */}
      <Circle cx={0} cy={0} r={R} dither>
        <RadialGradient
          c={vec(-R * 0.18, -R * 0.22)}
          r={R * 1.25}
          colors={['#FFFFFF', '#FFF8EC', shade(color, 0.35), color]}
          positions={[0, 0.35, 0.78, 1]}
        />
      </Circle>

      {/* Plazma: zıt yönlerde dönen iki ışık dokusu */}
      <Group transform={plasmaA}>
        <Circle cx={0} cy={0} r={R}>
          <SweepGradient
            c={vec(0, 0)}
            colors={[WHITE_0, 'rgba(255, 255, 255, 0.2)', WHITE_0, 'rgba(255, 255, 255, 0.13)', WHITE_0, 'rgba(255, 255, 255, 0.17)', WHITE_0]}
          />
        </Circle>
      </Group>
      <Group transform={plasmaB}>
        <Circle cx={0} cy={0} r={R * 0.82}>
          <SweepGradient
            c={vec(0, 0)}
            colors={[WHITE_0, rgba(shade(color, 0.5), 0.22), WHITE_0, rgba(shade(color, 0.5), 0.16), WHITE_0]}
          />
        </Circle>
      </Group>

      {/* Kenar parıltısı */}
      <Circle cx={0} cy={0} r={R} style="stroke" strokeWidth={1.4} color="rgba(255, 255, 255, 0.45)">
        <BlurMask blur={2.5} style="solid" />
      </Circle>

      {/* Kıvılcım anındaki parlama */}
      <Circle cx={0} cy={0} r={R * 3.4} opacity={flash} dither>
        <RadialGradient
          c={vec(0, 0)}
          r={R * 3.4}
          colors={['rgba(255, 255, 255, 0.95)', rgba(color, 0.4), rgba(color, 0)]}
          positions={[0, 0.3, 1]}
        />
      </Circle>

      {/* Rezonans: ikiniz aynı anda buradayken dönen altın ve mor yaylar */}
      {resonance && (
        <Group opacity={resPulse}>
          <Group transform={resOuter}>
            <Path path={resArcOuter} style="stroke" strokeWidth={4} strokeCap="round" color="rgba(245, 158, 11, 0.5)">
              <BlurMask blur={6} style="normal" />
            </Path>
            <Path path={resArcOuter} style="stroke" strokeWidth={1.3} strokeCap="round" color="rgba(253, 230, 138, 0.95)" />
          </Group>
          <Group transform={resInner}>
            <Path path={resArcInner} style="stroke" strokeWidth={3.5} strokeCap="round" color="rgba(168, 85, 247, 0.5)">
              <BlurMask blur={5} style="normal" />
            </Path>
            <Path path={resArcInner} style="stroke" strokeWidth={1.1} strokeCap="round" color="rgba(221, 214, 254, 0.95)" />
          </Group>
        </Group>
      )}
    </Group>
  );
});

// ============================================================================
// ŞOK DALGASI (kıvılcım gönderildiğinde yörünge düzleminde yayılır)
// ============================================================================

export interface ShockWaveProps {
  readonly layout: OrbitLayout;
  readonly tilt: SharedValue<number>;
  readonly wave: SharedValue<number>;
  readonly camera: SceneCamera;
}

export const ShockWave = React.memo(function ShockWave({ layout, tilt, wave, camera }: ShockWaveProps) {
  const { cx, cy, maxTilt, outer } = layout;
  const { zoom, panX, panY } = camera;
  const reach = outer * 1.15 - STAR_CORE_RADIUS;

  const transform = useDerivedValue(() => [
    { translateX: cx + panX.value },
    { translateY: cy + panY.value },
    { scaleY: Math.min(tilt.value, maxTilt) },
    { scale: zoom.value },
  ]);
  const leadRadius = useDerivedValue(() => STAR_CORE_RADIUS + (1 - Math.pow(1 - wave.value, 3)) * reach);
  const leadOpacity = useDerivedValue(() => (wave.value < 1 ? Math.pow(1 - wave.value, 1.3) * 0.85 : 0));
  const leadWidth = useDerivedValue(() => 0.8 + 3.2 * (1 - wave.value));
  const trailProgress = useDerivedValue(() => clamp((wave.value - 0.18) / 0.82, 0, 1));
  const trailRadius = useDerivedValue(() => STAR_CORE_RADIUS + (1 - Math.pow(1 - trailProgress.value, 3)) * reach * 0.85);
  const trailOpacity = useDerivedValue(() =>
    wave.value < 1 && wave.value > 0.18 ? Math.pow(1 - trailProgress.value, 1.4) * 0.6 : 0
  );

  return (
    <Group transform={transform}>
      <Circle cx={0} cy={0} r={leadRadius} style="stroke" strokeWidth={leadWidth} color={MICRO_PALETTE.goldSoft} opacity={leadOpacity}>
        <BlurMask blur={3} style="solid" />
      </Circle>
      <Circle cx={0} cy={0} r={trailRadius} style="stroke" strokeWidth={1.6} color={MICRO_PALETTE.rose} opacity={trailOpacity}>
        <BlurMask blur={2} style="solid" />
      </Circle>
    </Group>
  );
});
