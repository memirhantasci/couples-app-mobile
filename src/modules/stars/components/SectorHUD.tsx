/**
 * @file SectorHUD.tsx
 * @module modules/stars/components
 * @description Makro gökyüzü modunda kameranın baktığı sektörü gösteren üst pusula/gösterge bileşeni.
 *
 * - getSectorByCoords() ile kamera pozisyonunu anlık sektöre çözer (DB ile birebir senkron).
 * - Dokunulduğunda SectorAtlasModal'ı açar.
 * - Glassmorphic minimal kapsül tasarımı.
 */

import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Compass } from 'lucide-react-native';
import { getSectorByCoords } from '../config/skySectors.data';

interface SectorHUDProps {
  /** Kameranın anlık merkez RA koordinatı */
  readonly centerRa: number;
  /** Kameranın anlık merkez Dec koordinatı */
  readonly centerDec: number;
  /** Dokunulduğunda SectorAtlasModal'ı açar */
  readonly onPress?: () => void;
  /** SafeArea üst boşluğu */
  readonly topInset?: number;
}

export const SectorHUD: React.FC<SectorHUDProps> = ({
  centerRa,
  centerDec,
  onPress,
  topInset = 0,
}) => {
  const sector = useMemo(
    () => getSectorByCoords(centerRa, centerDec),
    [centerRa, centerDec],
  );

  const raDisplay = Math.round(centerRa * 10) / 10;
  const decDisplay = Math.round(centerDec * 10) / 10;
  const decSign = decDisplay >= 0 ? '+' : '';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.container, { top: topInset + 8 }]}
    >
      <View style={[styles.pill, { borderColor: sector.themeColor + '60' }]}>
        <Compass size={14} color={sector.themeColor} strokeWidth={2.5} />
        <Text style={styles.sectorSymbol}>{sector.symbol}</Text>
        <Text style={[styles.sectorName, { color: sector.themeColor }]}>
          {sector.name}
        </Text>
        <View style={styles.coordSeparator} />
        <Text style={styles.coords}>
          RA {raDisplay}° / DEC {decSign}{decDisplay}°
        </Text>
      </View>
    </TouchableOpacity>
  );
};


const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 50,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 15, 25, 0.75)',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 6,
    // Glassmorphic shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sectorSymbol: {
    fontSize: 14,
  },
  sectorName: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  coordSeparator: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 2,
  },
  coords: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.55)',
    fontWeight: '400',
    letterSpacing: 0.2,
  },
});
