import { useEffect } from 'react';
import { useSharedValue, useFrameCallback } from 'react-native-reanimated';
import { vec, Vector } from '@shopify/react-native-skia';

export interface ParticleState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  colorType: 'base' | 'resonance1' | 'resonance2';
}

export interface UseParticleSystemProps {
  centerX: number;
  centerY: number;
  starBaseRadius: number;
  isResonanceActive: boolean;
}

export function useParticleSystem(props: UseParticleSystemProps) {
  // Props'ları SharedValue'ya senkronize ederek useFrameCallback worklet closure bayatlamasını önlüyoruz
  const centerXVal = useSharedValue(props.centerX);
  const centerYVal = useSharedValue(props.centerY);
  const starBaseRadiusVal = useSharedValue(props.starBaseRadius);
  const isResonanceActiveVal = useSharedValue(props.isResonanceActive);

  useEffect(() => {
    centerXVal.value = props.centerX;
    centerYVal.value = props.centerY;
    starBaseRadiusVal.value = props.starBaseRadius;
    isResonanceActiveVal.value = props.isResonanceActive;
  }, [props.centerX, props.centerY, props.starBaseRadius, props.isResonanceActive, centerXVal, centerYVal, starBaseRadiusVal, isResonanceActiveVal]);

  // We use standard React refs/shared values for managing the particles.
  // We will maintain the physics array inside a SharedValue to be mutable in worklets.
  const particles = useSharedValue<ParticleState[]>([]);
  
  // Output vec arrays for Skia <Points>
  const basePoints = useSharedValue<Vector[]>([]);
  const res1Points = useSharedValue<Vector[]>([]);
  const res2Points = useSharedValue<Vector[]>([]);

  // We need a deterministic or pseudo-random generator inside the worklet
  // since Math.random() is fine in worklets but we can also use custom if needed.
  // Math.random() is supported in Reanimated 3 worklets.

  const lastDustEmitRef = useSharedValue(0);
  const particleIdCounter = useSharedValue(0);

  // Trigger firework explosion
  const triggerFirework = (cx: number, cy: number, isResonance: boolean) => {
    'worklet';
    const newParticles: ParticleState[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      newParticles.push({
        id: particleIdCounter.value++,
        x: cx,
        y: cy,
        vx: Math.cos(angle) * (40 + Math.random() * 30),
        vy: Math.sin(angle) * (40 + Math.random() * 30),
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        colorType: isResonance ? 'resonance1' : 'base'
      });
    }
    particles.value = [...particles.value, ...newParticles];
  };

  const frameCallback = useFrameCallback((frameInfo) => {
    if (!frameInfo.timeSincePreviousFrame) return;
    
    const dt = Math.min(0.05, frameInfo.timeSincePreviousFrame / 1000);
    const t = frameInfo.timeSinceFirstFrame / 1000;

    // Ambient Dust Emission (every 0.18s)
    if (t - lastDustEmitRef.value > 0.18) {
      lastDustEmitRef.value = t;
      const angle = Math.random() * Math.PI * 2;
      const spawnDist = starBaseRadiusVal.value + Math.random() * 10;
      const spawnX = centerXVal.value + Math.cos(angle) * spawnDist;
      const spawnY = centerYVal.value + Math.sin(angle) * spawnDist;

      let colorType: ParticleState['colorType'] = 'base';
      if (isResonanceActiveVal.value) {
        colorType = Math.random() > 0.5 ? 'resonance1' : 'resonance2';
      }

      particles.value = [
        ...particles.value,
        {
          id: particleIdCounter.value++,
          x: spawnX,
          y: spawnY,
          vx: Math.cos(angle) * (5 + Math.random() * 12),
          vy: Math.sin(angle) * (5 + Math.random() * 12) - 8,
          life: 1.2 + Math.random() * 0.8,
          maxLife: 2.0,
          colorType
        }
      ];
    }

    // Update Physics
    const nextParticles: ParticleState[] = [];
    const bPoints: Vector[] = [];
    const r1Points: Vector[] = [];
    const r2Points: Vector[] = [];

    const gravityY = -6; // float upwards
    const drag = 0.96;
    const decayRate = 1.0;

    for (let i = 0; i < particles.value.length; i++) {
      const p = particles.value[i];
      const newLife = p.life - dt * decayRate;
      
      if (newLife > 0) {
        const nvx = (p.vx + 0 /* gravityX */ * dt) * drag;
        const nvy = (p.vy + gravityY * dt) * drag;
        const nx = p.x + nvx * dt;
        const ny = p.y + nvy * dt;

        nextParticles.push({
          ...p,
          x: nx,
          y: ny,
          vx: nvx,
          vy: nvy,
          life: newLife
        });

        const v = vec(nx, ny);
        if (p.colorType === 'base') bPoints.push(v);
        else if (p.colorType === 'resonance1') r1Points.push(v);
        else r2Points.push(v);
      }
    }

    particles.value = nextParticles;
    basePoints.value = bPoints;
    res1Points.value = r1Points;
    res2Points.value = r2Points;
  });

  return {
    basePoints,
    res1Points,
    res2Points,
    triggerFirework,
    frameCallback
  };
}
