import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useDerivedValue, useSharedValue, useFrameCallback } from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';

import {
  isSkiaAvailable,
  Canvas,
  Group,
  Circle,
  Path,
  RadialGradient,
  Points,
  vec,
  DashPathEffect,
  BlurMask,
  Skia
} from './skiaBridge';

import type {
  CoupleStarDetails,
  StarSystemMapPlanet,
  OrbitZone,
  PlanetType
} from '@/modules/stars/types/star.types';
import {
  getResponsiveOrbitRadius,
  calculateOrbitalAngularVelocity,
  ORBIT_CONFIG
} from '@/modules/stars/types/star.types';
import { useParticleSystem } from './useParticleSystem';

export interface MicroSystemCanvasProps {
  readonly starDetails: CoupleStarDetails;
  readonly exoplanets: StarSystemMapPlanet[];
  readonly onSelectPlanet?: (planet: StarSystemMapPlanet) => void;
  readonly onSelectCenterStar?: (star: CoupleStarDetails) => void;
  readonly onSelectStar?: (star: CoupleStarDetails) => void;
  readonly width?: number;
  readonly height?: number;
}

const MIN_PLANET_TOUCH_RADIUS_PX = 28;
const CENTER_STAR_TOUCH_RADIUS_PX = 40;
const CENTER_STAR_BASE_RADIUS = 22;

const RESONANCE_OUTER_ANGULAR_VELOCITY = 0.6;
const RESONANCE_INNER_ANGULAR_VELOCITY = 0.4;

const CORONA_BREATH_RATE = 1.8;
const CORONA_BREATH_AMPLITUDE = 0.08;

const PLANET_RADIUS_BY_TYPE: Record<PlanetType, number> = {
  terrestrial: 8,
  gas_giant: 13,
  ice_world: 9,
  ocean_world: 9,
  crystal: 8,
  volcanic: 9,
  desert: 8,
  ringed_giant: 12,
};

function deterministicInitialPhase(planetId: string): number {
  let hash = 0;
  for (let i = 0; i < planetId.length; i++) {
    hash = (hash * 31 + planetId.charCodeAt(i)) >>> 0;
  }
  return (hash % 360) * (Math.PI / 180);
}

function hexToRgbStr(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return '200, 200, 255';
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// ----------------------------------------------------------------------------
// Planete Özel Skia Bileşeni (Matrix ve Rendering İzole Edilir)
// ----------------------------------------------------------------------------
const PlanetNode = React.memo(({ 
  planet, 
  cx, 
  cy, 
  t 
}: { 
  planet: StarSystemMapPlanet;
  cx: number; 
  cy: number; 
  t: { value: number };
}) => {
  const zone = planet.orbit_distance as OrbitZone;
  const orbitRadius = getResponsiveOrbitRadius(zone, cx * 2);
  const omega = calculateOrbitalAngularVelocity(zone, planet.orbit_speed);
  const theta0 = deterministicInitialPhase(planet.id);
  const pRadius = PLANET_RADIUS_BY_TYPE[planet.planet_type] ?? 8;

  // UI Thread Derived Transform — kesintisiz 360 derece tam tur yörünge
  const transform = useDerivedValue(() => {
    const angle = t.value * omega + theta0;
    const px = cx + Math.cos(angle) * orbitRadius;
    const py = cy + Math.sin(angle) * orbitRadius;
    return [{ translateX: px }, { translateY: py }];
  });

  const auraColor = planet.is_locked ? '#64748B' : (planet.palette[0] ?? '#4facfe');
  const gradColors = planet.is_locked
    ? ['#475569', '#94A3B8']
    : (planet.palette.length >= 2 ? planet.palette : ['#4facfe', '#00f2fe']);
  
  const isRinged = !planet.is_locked && (planet.planet_type === 'ringed_giant' || planet.planet_type === 'gas_giant');
  const ringColor = isRinged ? (planet.palette[1] ?? planet.palette[0] ?? '#FFFFFF') : '';

  return (
    <Group transform={transform}>
      {/* Aura */}
      <Circle cx={0} cy={0} r={pRadius * 2.2}>
        <RadialGradient c={vec(0, 0)} r={pRadius * 2.2} colors={[`rgba(${hexToRgbStr(auraColor)}, 0.3)`, 'rgba(0, 0, 0, 0)']} />
      </Circle>
      
      {/* Planet Body */}
      <Circle cx={0} cy={0} r={pRadius}>
        <RadialGradient c={vec(0, 0)} r={pRadius} colors={gradColors} />
      </Circle>

      {/* Rings */}
      {isRinged && (
        <Group transform={[{ scaleY: 0.3 }]}>
          <Circle cx={0} cy={0} r={pRadius * 1.8} style="stroke" strokeWidth={3} color={`rgba(${hexToRgbStr(ringColor)}, 0.5)`} />
        </Group>
      )}
    </Group>
  );
});
PlanetNode.displayName = 'PlanetNode';

// ----------------------------------------------------------------------------
// Skia Engine İçin Asıl Canvas Bileşeni
// ----------------------------------------------------------------------------
function MicroSystemCanvasSkia({
  starDetails,
  exoplanets,
  onSelectPlanet,
  onSelectCenterStar,
  onSelectStar,
  width,
  height,
}: MicroSystemCanvasProps) {
  const { width: screenW } = Dimensions.get('window');
  const canvasWidth = width ?? screenW;
  const canvasHeight = height ?? screenW;
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  const [isFocused, setIsFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  // Universal Time parameter driven by useFrameCallback
  const t = useSharedValue(0);

  // Particle System
  const { basePoints, res1Points, res2Points, triggerFirework, frameCallback } = useParticleSystem({
    centerX: cx,
    centerY: cy,
    starBaseRadius: CENTER_STAR_BASE_RADIUS,
    isResonanceActive: starDetails.resonance_active,
  });

  // Smooth continuous time accumulator: adds delta time each frame so that
  // re-renders of the parent (e.g. 1-second cooldown intervals) NEVER reset
  // the orbit or prevent exoplanets from completing full 360-degree turns!
  const timeCallback = useFrameCallback((frameInfo) => {
    'worklet';
    if (frameInfo.timeSincePreviousFrame) {
      const dt = Math.min(0.1, frameInfo.timeSincePreviousFrame / 1000);
      t.value += dt;
    }
  });

  // Battery/Perf Optimization: Pause loop only when screen focus changes
  useEffect(() => {
    frameCallback.setActive(isFocused);
    timeCallback.setActive(isFocused);
  }, [isFocused, frameCallback, timeCallback]);

  // Corona & Core
  const luminosity = starDetails.luminosity_level ?? 1.0;
  const starColor = starDetails.base_color || '#9DB4FF';

  const pulse = useDerivedValue(() => 1.0 + CORONA_BREATH_AMPLITUDE * Math.sin(t.value * CORONA_BREATH_RATE));
  const starRadius = useDerivedValue(() => CENTER_STAR_BASE_RADIUS * pulse.value);
  const coronaRadius = useDerivedValue(() => starRadius.value * 3.5);

  // Resonance Ring Angles
  const theta1 = useDerivedValue(() => (t.value * RESONANCE_OUTER_ANGULAR_VELOCITY) % (Math.PI * 2));
  const theta2 = useDerivedValue(() => (-(t.value * RESONANCE_INNER_ANGULAR_VELOCITY)) % (Math.PI * 2));
  const ringRadius = useDerivedValue(() => starRadius.value + 8 + 2 * Math.sin(t.value * 2.5));

  // Pre-calculate fixed orbit rings
  const orbitRings = useMemo(() => {
    const rings = [];
    for (let zone = 1; zone <= ORBIT_CONFIG.ZONE_COUNT; zone++) {
      const radius = getResponsiveOrbitRadius(zone as OrbitZone, canvasWidth);
      const zoneOpacity = 0.08 + (zone / ORBIT_CONFIG.ZONE_COUNT) * 0.06;
      rings.push({ radius, opacity: zoneOpacity });
    }
    return rings;
  }, [canvasWidth]);

  // Resonance Path factory
  const createArc = (start: number, sweep: number) => {
    if (!isSkiaAvailable) return Skia.Path.Make();
    if (Skia.PathBuilder) {
      const builder = Skia.PathBuilder.Make();
      builder.addArc({ x: -100, y: -100, width: 200, height: 200 }, start, sweep);
      return builder.build();
    }
    const path = Skia.Path.Make();
    path.addArc({ x: -100, y: -100, width: 200, height: 200 }, start, sweep); // scaled dynamically
    return path;
  };
  const outerArcPath = useMemo(() => createArc(0, 252 /* 1.4 PI */), []);
  const innerArcPath = useMemo(() => createArc(0, 198 /* 1.1 PI */), []);

  const res1Transform = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy },
    { rotate: theta1.value },
    { scale: ringRadius.value / 100 }
  ]);
  const res2Transform = useDerivedValue(() => [
    { translateX: cx },
    { translateY: cy },
    { rotate: theta2.value },
    { scale: (ringRadius.value - 5) / 100 }
  ]);

  // --------------------------------------------------------------------------
  // Hit-Testing in JS Thread
  // --------------------------------------------------------------------------
  const handleTap = (tx: number, ty: number) => {
    const dxCenter = tx - cx;
    const dyCenter = ty - cy;
    const distCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);

    if (distCenter <= CENTER_STAR_TOUCH_RADIUS_PX) {
      onSelectCenterStar?.(starDetails);
      onSelectStar?.(starDetails); // Alias
      // Trigger particles via worklet call from JS
      triggerFirework(cx, cy, starDetails.resonance_active);
      return;
    }

    // Find nearest planet based on deterministic math using current `t.value`
    let minDist = Infinity;
    let nearestPlanet: StarSystemMapPlanet | null = null;
    const currentT = t.value;

    for (const planet of exoplanets) {
      const zone = planet.orbit_distance as OrbitZone;
      const orbitRadius = getResponsiveOrbitRadius(zone, canvasWidth);
      const omega = calculateOrbitalAngularVelocity(zone, planet.orbit_speed);
      const theta0 = deterministicInitialPhase(planet.id);
      
      const angle = currentT * omega + theta0;
      const px = cx + Math.cos(angle) * orbitRadius;
      const py = cy + Math.sin(angle) * orbitRadius;
      
      const pRadius = PLANET_RADIUS_BY_TYPE[planet.planet_type] ?? 8;
      const touchRadius = Math.max(pRadius + 18, MIN_PLANET_TOUCH_RADIUS_PX);
      
      const dx = tx - px;
      const dy = ty - py;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= touchRadius && dist < minDist) {
        minDist = dist;
        nearestPlanet = planet;
      }
    }

    if (nearestPlanet) {
      onSelectPlanet?.(nearestPlanet);
    }
  };

  const tapGesture = Gesture.Tap().onEnd((e) => {
    runOnJS(handleTap)(e.x, e.y);
  });

  return (
    <GestureDetector gesture={tapGesture}>
      <View style={[styles.container, { width: canvasWidth, height: canvasHeight }]}>
        <Canvas style={{ width: canvasWidth, height: canvasHeight }}>
          
          {/* Background Radial Gradient */}
          <Circle cx={cx} cy={cy} r={Math.max(canvasWidth, canvasHeight) * 0.7}>
            <RadialGradient c={vec(cx, cy)} r={Math.max(canvasWidth, canvasHeight) * 0.7} colors={['#0D0B1F', '#030207']} />
          </Circle>

          {/* Cosmic Dust / Particles (Single Draw Call via Points) */}
          <Points points={basePoints} mode="points" strokeWidth={3} strokeCap="round" color="#E2C27D" />
          <Points points={res1Points} mode="points" strokeWidth={3} strokeCap="round" color="#F59E0B" />
          <Points points={res2Points} mode="points" strokeWidth={3} strokeCap="round" color="#A855F7" />

          {/* Orbit Rings */}
          {orbitRings.map((ring, i) => (
            <Circle key={i} cx={cx} cy={cy} r={ring.radius} style="stroke" strokeWidth={0.6} color={`rgba(180, 180, 255, ${ring.opacity})`}>
              <DashPathEffect intervals={[4, 8]} />
            </Circle>
          ))}

          {/* Center Star Corona Glow */}
          <Circle cx={cx} cy={cy} r={coronaRadius}>
            <RadialGradient 
              c={vec(cx, cy)} 
              r={coronaRadius} 
              colors={[`rgba(${hexToRgbStr(starColor)}, ${0.5 * luminosity})`, `rgba(${hexToRgbStr(starColor)}, ${0.15 * luminosity})`, 'rgba(0,0,0,0)']} 
              positions={[0, 0.5, 1]} 
            />
          </Circle>

          {/* Center Star Core */}
          <Circle cx={cx} cy={cy} r={starRadius}>
            <RadialGradient 
              c={vec(cx, cy)} 
              r={starRadius} 
              colors={['#FFFFFF', starColor, `rgba(${hexToRgbStr(starColor)}, 0.8)`]} 
              positions={[0, 0.3, 1]} 
            />
          </Circle>

          {/* Resonance Arcs */}
          {starDetails.resonance_active && (
            <>
              {/* Outer Amber Arc */}
              <Group transform={res1Transform}>
                <Path path={outerArcPath} style="stroke" strokeWidth={1.8} color={`rgba(245, 158, 11, ${0.7 * luminosity})`}>
                  <BlurMask blur={8} style="normal" />
                </Path>
              </Group>

              {/* Inner Purple Arc */}
              <Group transform={res2Transform}>
                <Path path={innerArcPath} style="stroke" strokeWidth={1.2} color={`rgba(168, 85, 247, ${0.6 * luminosity})`}>
                  <BlurMask blur={6} style="normal" />
                </Path>
              </Group>
            </>
          )}

          {/* Planets */}
          {exoplanets.map(planet => (
            <PlanetNode key={planet.id} planet={planet} cx={cx} cy={cy} t={t} />
          ))}

        </Canvas>
      </View>
    </GestureDetector>
  );
}

// ----------------------------------------------------------------------------
// Fallback (Expo Go vb. durumlar için)
// ----------------------------------------------------------------------------
function MicroSystemCanvasFallback({ width = 390, height = 390 }: MicroSystemCanvasProps) {
  return (
    <View style={[styles.container, styles.fallbackContainer, { width, height }]}>
      <View style={styles.fallbackCard}>
        <View style={styles.fallbackIconBadge}>
          <Sparkles size={24} color="#A855F7" />
        </View>
        <Text style={styles.fallbackTitle}>Sistem Yörüngesi</Text>
        <Text style={styles.fallbackDescription}>
          Özel native modüller içeren bu projeyi görüntülemek için uygulamayı terminalden derleyin:
        </Text>
        <View style={styles.fallbackCodeBadge}>
          <Text style={styles.fallbackCodeText}>npx expo run:android</Text>
        </View>
      </View>
    </View>
  );
}

export function MicroSystemCanvas(props: MicroSystemCanvasProps) {
  if (!isSkiaAvailable) {
    return <MicroSystemCanvasFallback {...props} />;
  }
  return <MicroSystemCanvasSkia {...props} />;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#030207',
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
    borderColor: 'rgba(168, 85, 247, 0.25)',
    padding: 24,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  fallbackIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  fallbackDescription: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  fallbackCodeBadge: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  fallbackCodeText: {
    color: '#A855F7',
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default MicroSystemCanvas;
