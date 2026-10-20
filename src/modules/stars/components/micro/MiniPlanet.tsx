/**
 * @file MiniPlanet.tsx
 * @module modules/stars/components/micro
 * @description Skia gerektirmeyen küçük gezegen küresi (alt paneldeki anı
 * kartları ve Skia'sız ortam yedeği için). Sahnedeki gezegenle aynı paleti,
 * aynı ışık yönünü (sol üst) ve halkalı tiplerde aynı eğik halkayı kullanır.
 */

import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock } from 'lucide-react-native';

import { isRingedPlanet, planetColors, rgba, shade, type PlanetLook } from '../../canvas/micro/microScene';

export interface MiniPlanetProps {
  readonly planet: PlanetLook;
  readonly size: number;
  readonly glow?: boolean;
}

export const MiniPlanet = memo(function MiniPlanet({ planet, size, glow = true }: MiniPlanetProps) {
  const { primary, secondary } = planetColors(planet);
  const ringed = !planet.is_locked && isRingedPlanet(planet);
  const radius = size / 2;

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <View
        style={[
          styles.shadowShell,
          { width: size, height: size, borderRadius: radius },
          glow && { shadowColor: primary, shadowOpacity: planet.is_locked ? 0.2 : 0.65, shadowRadius: size * 0.28 },
        ]}
      >
        <View style={[styles.sphere, { borderRadius: radius }]}>
          <LinearGradient
            colors={[shade(primary, 0.5), primary, secondary, shade(secondary, -0.72)]}
            locations={[0, 0.34, 0.74, 1]}
            start={{ x: 0.15, y: 0.08 }}
            end={{ x: 0.92, y: 0.96 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.38)', 'rgba(255, 255, 255, 0)']}
            start={{ x: 0.12, y: 0.06 }}
            end={{ x: 0.5, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>

      {ringed && (
        <View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: size * 1.72,
              height: size * 0.46,
              borderRadius: size,
              borderColor: rgba(shade(secondary, 0.3), 0.8),
            },
          ]}
        />
      )}

      {planet.is_locked && <Lock size={Math.round(size * 0.4)} color="rgba(226, 232, 240, 0.9)" style={styles.lock} />}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadowShell: {
    shadowOffset: { width: 0, height: 0 },
    backgroundColor: 'transparent',
  },
  sphere: {
    flex: 1,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    transform: [{ rotate: '-16deg' }],
  },
  lock: {
    position: 'absolute',
  },
});

export default MiniPlanet;
