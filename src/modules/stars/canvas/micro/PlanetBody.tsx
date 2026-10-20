/**
 * @file PlanetBody.tsx
 * @module modules/stars/canvas/micro
 * @description Tek bir anı gezegeninin Skia çizimi (yerel koordinatlar, merkez 0,0).
 *
 * Gezegen merkezdeki yıldızdan aydınlanır: parlak yüz her karede yıldıza döner,
 * karşı yüz gece gölgesinde kalır. Halkalı gezegenlerde halkanın arka yarısı
 * gövdenin arkasında, ön yarısı önünde çizilir. Aynı bileşen iki katmanda
 * (yıldızın arkası / önü) render edilir; derinliğe göre yalnızca biri görünür.
 */

import React, { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { BlurMask, Circle, DashPathEffect, Group, Oval, Path, RadialGradient, Rect, Skia, vec } from '../skiaBridge';
import type { StarSystemMapPlanet } from '../../types/star.types';
import {
  B_ALPHA,
  B_DEPTH,
  B_LIGHT_X,
  B_LIGHT_Y,
  B_SCALE,
  B_X,
  B_Y,
  BODY_STRIDE,
  MICRO_PALETTE,
  isRingedPlanet,
  makeOvalArcPath,
  makeSparklePath,
  planetColors,
  rgba,
  shade,
} from './microScene';

export interface PlanetBodyProps {
  readonly index: number;
  readonly planet: StarSystemMapPlanet;
  readonly radius: number;
  readonly motion: SharedValue<number[]>;
  readonly clock: SharedValue<number>;
  readonly layer: 'back' | 'front';
  readonly highlighted: boolean;
}

const NIGHT_SIDE = 'rgba(3, 2, 10, 0.8)';
const CLEAR = 'rgba(0, 0, 0, 0)';

/** Gezegen tipine özgü yüzey dokusu (gövde çemberiyle kırpılır). */
function SurfaceDetail({ planet, r, primary }: { planet: StarSystemMapPlanet; r: number; primary: string }) {
  const sparkle = useMemo(
    () => (planet.planet_type === 'crystal' ? makeSparklePath(r * 0.42) : null),
    [planet.planet_type, r]
  );

  switch (planet.planet_type) {
    case 'gas_giant':
    case 'ringed_giant':
      return (
        <>
          <Rect x={-r} y={-r * 0.64} width={r * 2} height={r * 0.2} color="rgba(255, 255, 255, 0.16)" />
          <Rect x={-r} y={-r * 0.2} width={r * 2} height={r * 0.13} color="rgba(0, 0, 0, 0.2)" />
          <Rect x={-r} y={r * 0.18} width={r * 2} height={r * 0.24} color="rgba(255, 255, 255, 0.12)" />
          <Rect x={-r} y={r * 0.58} width={r * 2} height={r * 0.12} color="rgba(0, 0, 0, 0.16)" />
          <Oval x={r * 0.05} y={r * 0.2} width={r * 0.52} height={r * 0.24} color={rgba(shade(primary, 0.35), 0.6)} />
        </>
      );
    case 'terrestrial':
      return (
        <>
          <Circle cx={-r * 0.35} cy={-r * 0.15} r={r * 0.42} color="rgba(255, 255, 255, 0.13)" />
          <Circle cx={r * 0.42} cy={r * 0.36} r={r * 0.32} color="rgba(0, 0, 0, 0.18)" />
          <Circle cx={r * 0.12} cy={-r * 0.62} r={r * 0.2} color="rgba(255, 255, 255, 0.1)" />
          <Circle cx={-r * 0.5} cy={r * 0.5} r={r * 0.18} color="rgba(0, 0, 0, 0.14)" />
        </>
      );
    case 'ocean_world':
      return (
        <>
          <Oval x={-r * 0.85} y={-r * 0.42} width={r * 1.15} height={r * 0.22} color="rgba(255, 255, 255, 0.24)" />
          <Oval x={-r * 0.1} y={r * 0.22} width={r * 0.95} height={r * 0.18} color="rgba(255, 255, 255, 0.18)" />
          <Oval x={-r * 0.6} y={r * 0.58} width={r * 0.7} height={r * 0.14} color="rgba(255, 255, 255, 0.12)" />
        </>
      );
    case 'ice_world':
      return (
        <>
          <Oval x={-r * 0.78} y={-r * 1.14} width={r * 1.56} height={r * 0.64} color="rgba(255, 255, 255, 0.82)" />
          <Oval x={-r * 0.56} y={r * 0.66} width={r * 1.12} height={r * 0.5} color="rgba(255, 255, 255, 0.55)" />
          <Rect x={-r} y={-r * 0.1} width={r * 2} height={r * 0.1} color="rgba(255, 255, 255, 0.12)" />
        </>
      );
    case 'crystal':
      return (
        <>
          <Circle cx={0} cy={0} r={r * 0.62} style="stroke" strokeWidth={0.7} color="rgba(255, 255, 255, 0.22)" />
          {sparkle && (
            <Group transform={[{ translateX: -r * 0.28 }, { translateY: -r * 0.26 }]}>
              <Path path={sparkle} color="rgba(255, 255, 255, 0.9)" />
            </Group>
          )}
          <Circle cx={r * 0.38} cy={r * 0.3} r={r * 0.09} color="rgba(255, 255, 255, 0.75)" />
        </>
      );
    case 'volcanic':
      return (
        <>
          <Circle cx={r * 0.26} cy={r * 0.12} r={r * 0.22} color="rgba(253, 186, 116, 0.85)">
            <BlurMask blur={1.4} style="solid" />
          </Circle>
          <Circle cx={-r * 0.36} cy={r * 0.42} r={r * 0.14} color="rgba(251, 146, 60, 0.85)">
            <BlurMask blur={1.2} style="solid" />
          </Circle>
          <Circle cx={-r * 0.1} cy={-r * 0.46} r={r * 0.1} color="rgba(253, 230, 138, 0.75)" />
          <Rect x={-r} y={-r * 0.05} width={r * 2} height={r * 0.06} color="rgba(251, 146, 60, 0.45)" />
        </>
      );
    case 'desert':
      return (
        <>
          <Oval x={-r} y={-r * 0.34} width={r * 2} height={r * 0.16} color="rgba(0, 0, 0, 0.14)" />
          <Oval x={-r} y={r * 0.12} width={r * 2} height={r * 0.13} color="rgba(255, 255, 255, 0.15)" />
          <Oval x={-r} y={r * 0.5} width={r * 2} height={r * 0.1} color="rgba(0, 0, 0, 0.12)" />
        </>
      );
    default:
      return null;
  }
}

export const PlanetBody = React.memo(function PlanetBody({
  index,
  planet,
  radius: r,
  motion,
  clock,
  layer,
  highlighted,
}: PlanetBodyProps) {
  const base = index * BODY_STRIDE;
  const locked = planet.is_locked;
  const ringed = !locked && isRingedPlanet(planet);
  const { primary, secondary } = planetColors(planet);

  const transform = useDerivedValue(() => {
    const m = motion.value;
    return [
      { translateX: m[base + B_X] ?? 0 },
      { translateY: m[base + B_Y] ?? 0 },
      { scale: m[base + B_SCALE] ?? 1 },
    ];
  });

  const opacity = useDerivedValue(() => {
    const m = motion.value;
    const inFront = (m[base + B_DEPTH] ?? 0) > 0;
    const visible = layer === 'front' ? inFront : !inFront;
    return visible ? m[base + B_ALPHA] ?? 0 : 0;
  });

  // Yıldıza bakan parlak yüzün merkezi (gövde yarıçapına göre)
  const lightCenter = useDerivedValue(() => {
    const m = motion.value;
    return { x: (m[base + B_LIGHT_X] ?? 0) * r * 0.55, y: (m[base + B_LIGHT_Y] ?? -1) * r * 0.55 };
  });
  const specular = useDerivedValue(() => {
    const m = motion.value;
    return { x: (m[base + B_LIGHT_X] ?? 0) * r * 0.48, y: (m[base + B_LIGHT_Y] ?? -1) * r * 0.48 };
  });

  const reticleOpacity = useDerivedValue(() => (highlighted ? 0.6 + 0.4 * Math.sin(clock.value * 4) : 0));
  const reticlePhase = useDerivedValue(() => -((clock.value * 16) % 22));

  const clip = useMemo(() => Skia.RRectXY(Skia.XYWHRect(-r, -r, r * 2, r * 2), r, r), [r]);
  const ringBack = useMemo(() => (ringed ? makeOvalArcPath(r * 2.05, r * 0.58, 180, 180) : null), [ringed, r]);
  const ringFront = useMemo(() => (ringed ? makeOvalArcPath(r * 2.05, r * 0.58, 0, 180) : null), [ringed, r]);

  const bodyColors = locked
    ? ['#CBD5E1', primary, secondary, '#0B1120']
    : [shade(primary, 0.55), primary, secondary, shade(secondary, -0.82)];
  const ringWide = rgba(secondary, 0.24);
  const ringThin = rgba(shade(secondary, 0.3), 0.7);

  return (
    <Group transform={transform} opacity={opacity}>
      {/* Atmosfer ışıması */}
      <Circle cx={0} cy={0} r={r * 2.2}>
        <RadialGradient
          c={vec(0, 0)}
          r={r * 2.2}
          colors={[rgba(primary, locked ? 0.14 : 0.34), rgba(primary, locked ? 0.04 : 0.1), rgba(primary, 0)]}
          positions={[0, 0.45, 1]}
        />
      </Circle>

      {/* Halkanın arka yarısı */}
      {ringBack && (
        <Group transform={[{ rotate: -0.28 }]}>
          <Path path={ringBack} style="stroke" strokeWidth={r * 0.32} color={ringWide} />
          <Path path={ringBack} style="stroke" strokeWidth={r * 0.08} color={ringThin} />
        </Group>
      )}

      {/* Gövde: yıldıza bakan yüz parlak, karşı yüz koyu */}
      <Circle cx={0} cy={0} r={r}>
        <RadialGradient c={lightCenter} r={r * 1.7} colors={bodyColors} positions={[0, 0.3, 0.72, 1]} />
      </Circle>

      {!locked && (
        <Group clip={clip}>
          <SurfaceDetail planet={planet} r={r} primary={primary} />
        </Group>
      )}

      {/* Gece yüzü gölgesi */}
      <Circle cx={0} cy={0} r={r}>
        <RadialGradient c={lightCenter} r={r * 2.1} colors={[CLEAR, CLEAR, NIGHT_SIDE]} positions={[0, 0.46, 1]} />
      </Circle>

      {/* Parlak yansıma ve kenar ışığı */}
      <Circle c={specular} r={r * 0.26} color="rgba(255, 255, 255, 0.4)">
        <BlurMask blur={r * 0.3} style="normal" />
      </Circle>
      <Circle cx={0} cy={0} r={r} style="stroke" strokeWidth={0.9} color={rgba(shade(primary, 0.45), 0.5)} />

      {/* Halkanın ön yarısı */}
      {ringFront && (
        <Group transform={[{ rotate: -0.28 }]}>
          <Path path={ringFront} style="stroke" strokeWidth={r * 0.32} color={ringWide} />
          <Path path={ringFront} style="stroke" strokeWidth={r * 0.08} color={ringThin} />
        </Group>
      )}

      {/* Kilitli anı: kesikli gri peçe */}
      {locked && (
        <Circle cx={0} cy={0} r={r * 1.55} style="stroke" strokeWidth={0.9} color="rgba(148, 163, 184, 0.55)">
          <DashPathEffect intervals={[2.5, 3.5]} />
        </Circle>
      )}

      {/* Seçili gezegen: dönen altın hedef halkası */}
      {highlighted && (
        <Circle cx={0} cy={0} r={r * 1.9} style="stroke" strokeWidth={1.3} color={MICRO_PALETTE.gold} opacity={reticleOpacity}>
          <DashPathEffect intervals={[6, 5]} phase={reticlePhase} />
        </Circle>
      )}
    </Group>
  );
});
