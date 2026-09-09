/**
 * @file StarInfoBadge.tsx
 * @module modules/stars/components
 * @description Cam efektli (glassmorphic) ve canlı rezonans nabız ışımasına sahip Star HUD rozeti.
 *
 * Özellikler:
 * - Cam morfolojisi: BlurView dinamik tint, tema uyumlu yarı saydam arka plan ve mikro-border.
 * - Astronomik Bilgi: Katalog kodu (HIP-XXXXX), RA/DEC koordinatları, tayf türü rengi.
 * - Çift Detayı: Yıldızın özel ismi ve canlı parlaklık yüzdesi (%XX).
 * - Rezonans Işıması: resonance_active açıkken Reanimated ile altın (#F59E0B) ve mor (#8B5CF6) nabız.
 * - Dokunma Etkileşimi: Sertifika veya astronomik künyeyi açmak için tıklama geri bildirimi.
 * - Tüm tema modlarıyla (Beyaz, Mavi, Pembe, Gece) tam uyumludur.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { Sparkles, Compass, Flame, Award } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import type { CoupleStarDetails } from '../types/star.types';

// ============================================================================
// SABİTLER VE YARDIMCILAR
// ============================================================================

/**
 * Morgan-Keenan tayf türü rengi (Astronomik standartlar).
 */
const SPECTRAL_COLORS: Record<string, string> = {
  O: '#9DB4FF', // Sıcak Mavi
  B: '#BBCCFF', // Mavi-Beyaz
  A: '#F8F9FF', // Parlak Beyaz
  F: '#FFFFED', // Sarı-Beyaz
  G: '#FFE494', // Güneş Sarısı
  K: '#FFAE6A', // Turuncu
  M: '#FF6B6B', // Kırmızı Cüce
};

function getSpectralColor(spectralType: string = 'G'): string {
  const primaryClass = spectralType.charAt(0).toUpperCase();
  return SPECTRAL_COLORS[primaryClass] || '#FFFFFF';
}

// ============================================================================
// BİLEŞEN PROPLARI
// ============================================================================

export interface StarInfoBadgeProps {
  /** Yıldızın veritabanı detayları */
  readonly starDetails: CoupleStarDetails | null;
  /** Anlık override edilmiş parlaklık (realtime güncellemeleri için) */
  readonly luminosityOverride?: number;
  /** Rezonansın aktif olup olmadığı (partnerin eşzamanlı girişi) */
  readonly isResonanceActive?: boolean;
  /** Hangi canvas modunda olunduğu */
  readonly viewMode?: 'micro' | 'macro';
  /** Tescil sertifikasını açma fonksiyonu */
  readonly onPressCertificate?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

// ============================================================================
// ANA BİLEŞEN
// ============================================================================

export const StarInfoBadge: React.FC<StarInfoBadgeProps> = ({
  starDetails,
  luminosityOverride,
  isResonanceActive = false,
  viewMode = 'micro',
  onPressCertificate,
  style,
}) => {
  const { theme, isLight } = useTheme();

  // Rezonans nabız animasyonu değeri (0 -> 1 -> 0)
  const pulseAnim = useSharedValue(0);

  const effectiveResonance = isResonanceActive || (starDetails?.resonance_active ?? false);

  useEffect(() => {
    if (effectiveResonance) {
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseAnim.value = withTiming(0, { duration: 400 });
    }
  }, [effectiveResonance, pulseAnim]);

  // Rezonans bordür rengi ve gölge animasyonu stili
  const animatedBorderStyle = useAnimatedStyle(() => {
    if (!effectiveResonance) {
      return {
        borderColor: isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.12)',
        shadowOpacity: isLight ? 0.1 : 0.25,
      };
    }

    const borderColor = interpolateColor(
      pulseAnim.value,
      [0, 0.5, 1],
      ['rgba(245, 158, 11, 0.5)', 'rgba(168, 85, 247, 0.8)', 'rgba(245, 158, 11, 0.9)']
    );

    const shadowColor = interpolateColor(
      pulseAnim.value,
      [0, 1],
      ['#F59E0B', '#A855F7']
    );

    return {
      borderColor,
      shadowColor,
      shadowOpacity: 0.45 + pulseAnim.value * 0.4,
      shadowRadius: 8 + pulseAnim.value * 12,
    };
  });

  if (!starDetails) {
    return null;
  }

  const luminosity = luminosityOverride ?? starDetails.luminosity_level;
  const luminosityPercent = Math.round(luminosity * 100);
  const spectralColor = getSpectralColor(starDetails.spectral_type);

  // RA ve DEC koordinatları formatı (Örn: 124.50° / +45.20°)
  const raFormatted = starDetails.ra != null ? `${Number(starDetails.ra).toFixed(2)}°` : '--';
  const decFormatted = starDetails.dec != null
    ? `${Number(starDetails.dec) >= 0 ? '+' : ''}${Number(starDetails.dec).toFixed(2)}°`
    : '--';

  return (
    <Animated.View
      style={[
        styles.outerContainer,
        {
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.88)' : 'rgba(7, 5, 18, 0.55)',
        },
        animatedBorderStyle,
        style,
      ]}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 45 : 90}
        tint={isLight ? 'light' : 'dark'}
        style={[styles.blurWrapper, viewMode === 'macro' && { paddingVertical: 7 }]}
      >
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={onPressCertificate}
          style={styles.contentContainer}
          accessibilityLabel="Yıldız bilgileri ve sertifikayı görüntüle"
        >
          {/* ÜST SATIR: Yıldız İsmi ve Canlı Rozetler */}
          <View style={styles.topRow}>
            <View style={styles.nameBlock}>
              <View style={[styles.spectralDot, { backgroundColor: spectralColor }]} />
              <Text style={[styles.starName, { color: theme.text }]} numberOfLines={1}>
                {starDetails.custom_name || 'Bizim Yıldızımız'}
              </Text>
              {starDetails.common_name ? (
                <Text style={[styles.starCommonName, { color: theme.textMuted }]} numberOfLines={1}>
                  ({starDetails.common_name})
                </Text>
              ) : null}
              {effectiveResonance && (
                <View style={styles.resonancePill}>
                  <Flame size={10} color="#F59E0B" />
                  <Text style={styles.resonancePillText}>Rezonans</Text>
                </View>
              )}
            </View>

            {/* Sertifika Butonu Kısayolu */}
            {onPressCertificate && (
              <View
                style={[
                  styles.certIconBtn,
                  {
                    backgroundColor: isLight ? 'rgba(245, 158, 11, 0.12)' : 'rgba(251, 191, 36, 0.12)',
                    borderColor: isLight ? 'rgba(245, 158, 11, 0.35)' : 'rgba(251, 191, 36, 0.3)',
                  },
                ]}
              >
                <Award size={14} color="#F59E0B" />
              </View>
            )}
          </View>

          {/* ALT SATIR: Koordinatlar, Katalog ve Parlaklık Çubuğu (Yalnızca Mikro Sistem Modunda) */}
          {viewMode === 'micro' && (
            <View style={styles.bottomRow}>
              <View style={styles.coordsBlock}>
                <Text style={[styles.catalogCode, { color: isLight ? '#0284C7' : '#38BDF8' }]}>
                  {starDetails.catalog_code}
                </Text>
                <View
                  style={[
                    styles.coordDivider,
                    { backgroundColor: isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)' },
                  ]}
                />
                <Compass
                  size={11}
                  color={theme.textMuted}
                  style={styles.compassIcon}
                />
                <Text style={[styles.coordsText, { color: theme.textSecondary }]}>
                  {raFormatted} / {decFormatted}
                </Text>
              </View>

              {/* Parlaklık Yüzdesi ve Mikro Çubuk */}
              <View style={styles.luminosityBlock}>
                <Sparkles size={11} color={luminosity >= 0.8 ? '#F59E0B' : theme.textMuted} />
                <Text style={[styles.luminosityText, { color: theme.text }]}>%{luminosityPercent}</Text>
                <View
                  style={[
                    styles.progressBarBg,
                    { backgroundColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)' },
                  ]}
                >
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${luminosityPercent}%`,
                        backgroundColor: luminosity >= 0.8 ? '#F59E0B' : '#38BDF8',
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </BlurView>
    </Animated.View>
  );
};

// ============================================================================
// STİLLER
// ============================================================================

const styles = StyleSheet.create({
  outerContainer: {
    borderRadius: 22,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  blurWrapper: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  contentContainer: {
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
    marginRight: 6,
  },
  spectralDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.8,
    shadowRadius: 4,
    flexShrink: 0,
  },
  starName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  starCommonName: {
    fontSize: 11,
    fontStyle: 'italic',
    flexShrink: 1,
  },
  resonancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 0.8,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    flexShrink: 0,
  },
  resonancePillText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  certIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  coordsBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catalogCode: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  coordDivider: {
    width: 1,
    height: 10,
  },
  compassIcon: {
    marginLeft: -2,
  },
  coordsText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  luminosityBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  luminosityText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  progressBarBg: {
    width: 38,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
});

export default StarInfoBadge;
