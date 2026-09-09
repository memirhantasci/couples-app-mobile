/**
 * @file SectorHUD.tsx
 * @module modules/stars/components
 * @description Makro gökyüzü modunda kameranın baktığı sektörü gösteren üst pusula/gösterge bileşeni.
 *
 * - getSectorByCoords() ile kamera pozisyonunu anlık sektöre çözer (DB ile birebir senkron).
 * - Dokunulduğunda SectorAtlasModal'ı açar.
 * - Glassmorphic minimal kapsül tasarımı.
 * - Tüm tema modlarıyla (Beyaz, Mavi, Pembe, Gece) tam uyumludur.
 */

import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Compass } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { getSectorByCoords } from '../config/skySectors.data';

interface SectorHUDProps {
  /** Kameranın anlık merkez RA koordinatı */
  readonly centerRa: number;
  /** Kameranın anlık merkez Dec koordinatı */
  readonly centerDec: number;
  /** Dokunulduğunda SectorAtlasModal'ı açar */
  readonly onPress?: () => void;
  /** SafeArea üst boşluğu (standalone modda) */
  readonly topInset?: number;
  /** Header bar içerisine entegre (embedded) mod */
  readonly embedded?: boolean;
}

export const SectorHUD: React.FC<SectorHUDProps> = ({
  centerRa,
  centerDec,
  onPress,
  topInset = 0,
  embedded = false,
}) => {
  const { theme, isLight } = useTheme();

  const sector = useMemo(
    () => getSectorByCoords(centerRa, centerDec),
    [centerRa, centerDec],
  );

  const raDisplay = Math.round(centerRa * 10) / 10;
  const decDisplay = Math.round(centerDec * 10) / 10;
  const decSign = decDisplay >= 0 ? '+' : '';

  const pillBg = isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(15, 15, 25, 0.85)';
  const separatorBg = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.18)';

  if (embedded) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        style={[
          styles.embeddedPill,
          {
            backgroundColor: pillBg,
            borderColor: sector.themeColor + (isLight ? '90' : '60'),
          },
        ]}
        accessibilityLabel={`${sector.name} sektörü, Atlas'ı aç`}
      >
        <Compass size={13} color={sector.themeColor} strokeWidth={2.2} />
        <Text style={styles.sectorSymbol}>{sector.symbol}</Text>
        <Text style={[styles.sectorName, { color: sector.themeColor }]} numberOfLines={1}>
          {sector.name}
        </Text>
        <View style={[styles.coordSeparator, { backgroundColor: separatorBg }]} />
        <Text style={[styles.atlasBadgeText, { color: theme.textSecondary }]}>Atlas</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.container, { top: topInset + 8 }]}
      accessibilityLabel={`${sector.name} sektörü, Atlas'ı aç`}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: pillBg,
            borderColor: sector.themeColor + (isLight ? '90' : '60'),
          },
        ]}
      >
        <Compass size={13} color={sector.themeColor} strokeWidth={2.2} />
        <Text style={styles.sectorSymbol}>{sector.symbol}</Text>
        <Text style={[styles.sectorName, { color: sector.themeColor }]}>
          {sector.name}
        </Text>
        <View style={[styles.coordSeparator, { backgroundColor: separatorBg }]} />
        <Text style={[styles.coords, { color: theme.textSecondary }]}>
          {raDisplay}° / {decSign}{decDisplay}°
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
    borderRadius: 20,
    borderWidth: 1.2,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  embeddedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1.2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
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
    height: 12,
    marginHorizontal: 2,
  },
  coords: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  atlasBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default SectorHUD;
