/**
 * @file MicroStarHeader.tsx
 * @module modules/stars/components/micro
 * @description Yıldızın içindeyken üstte duran başlık: üst yazı (rezonans
 * varsa canlı rezonans rozeti), yıldızın adı (dokununca tescil sertifikası),
 * katalog künyesi ve yıldızın hayat belirtileri (ışık, anı, kıvılcım, gün).
 */

import React, { memo, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, Heart, Orbit, Sparkles, Zap } from 'lucide-react-native';

import { dayjs, daysSince } from '@/lib/date';
import type { CoupleStarDetails } from '../../types/star.types';
import { rgba } from '../../canvas/micro/microScene';
import { useTranslation } from 'react-i18next';

export interface MicroStarHeaderProps {
  readonly starDetails: CoupleStarDetails;
  readonly luminosity: number;
  readonly resonanceActive: boolean;
  readonly planetCount: number;
  /** Başlığın ekranın üstünden uzaklığı (px) */
  readonly top: number;
  readonly onPressCertificate: () => void;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
}

/** İstatistik şeridinin bir bölmesi: ikon + değer, altında küçük başlık. */
function Stat({ icon, value, label, children }: { icon: React.ReactNode; value: string; label: string; children?: React.ReactNode }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        {icon}
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      {children}
    </View>
  );
}

/** Rezonans anında nabız gibi atan nokta. */
function PulseDot() {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.45 + pulse.value * 0.55,
    transform: [{ scale: 0.8 + pulse.value * 0.4 }],
  }));
  return <Animated.View style={[styles.pulseDot, style]} />;
}

export const MicroStarHeader = memo(function MicroStarHeader({
  starDetails,
  luminosity,
  resonanceActive,
  planetCount,
  top,
  onPressCertificate,
  onLayout,
}: MicroStarHeaderProps) {
  const { t } = useTranslation();
  const starColor = starDetails.base_color || '#9DB4FF';
  const luminosityPercent = Math.round(Math.max(0, Math.min(1, luminosity)) * 100);
  const daysInSky = daysSince(dayjs(starDetails.created_at));
  const meta = [
    starDetails.catalog_code,
    starDetails.common_name || null,
    starDetails.spectral_type ? t('stars.micro.spectralClass', { spectral_type: starDetails.spectral_type }) : null,
  ]
    .filter(Boolean)
    .join('  ·  ');

  return (
    <Animated.View
      entering={FadeInDown.duration(700).delay(200)}
      style={[styles.container, { top }]}
      onLayout={onLayout}
      pointerEvents="box-none"
    >
      {/* Üst yazı */}
      <View style={styles.eyebrowRow} pointerEvents="none">
        <LinearGradient
          colors={['rgba(253, 230, 138, 0)', 'rgba(253, 230, 138, 0.55)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.eyebrowLine}
        />
        {resonanceActive ? (
          <View style={styles.resonanceRow}>
            <PulseDot />
            <Text style={[styles.eyebrow, styles.eyebrowResonance]}>{t('stars.micro.resonanceBanner')}</Text>
          </View>
        ) : (
          <Text style={styles.eyebrow}>{t('stars.micro.heartOfStar')}</Text>
        )}
        <LinearGradient
          colors={['rgba(253, 230, 138, 0.55)', 'rgba(253, 230, 138, 0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.eyebrowLine}
        />
      </View>

      {/* Yıldızın adı → tescil sertifikası */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPressCertificate}
        style={styles.titleRow}
        accessibilityRole="button"
        accessibilityLabel={t('stars.micro.certificateA11y', { name: starDetails.custom_name || t('stars.defaultName') })}
      >
        <Text style={[styles.title, { textShadowColor: rgba(starColor, 0.85) }]} numberOfLines={1}>
          {starDetails.custom_name || t('stars.defaultName')}
        </Text>
        <View style={styles.certBadge}>
          <Award size={13} color="#FBBF24" />
        </View>
      </TouchableOpacity>

      <Text style={styles.meta} numberOfLines={1}>
        {meta}
      </Text>

      {/* Hayat belirtileri: tek satırlık cam şerit */}
      <View style={styles.statStrip} pointerEvents="none">
        <Stat icon={<Sparkles size={11} color="#FBBF24" />} value={`%${luminosityPercent}`} label={t('stars.micro.statLight')}>
          <View style={styles.meter}>
            <LinearGradient
              colors={luminosity >= 0.8 ? ['#FDE68A', '#F59E0B'] : ['#7DD3FC', '#38BDF8']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.meterFill, { width: `${luminosityPercent}%` }]}
            />
          </View>
        </Stat>
        <View style={styles.statDivider} />
        <Stat icon={<Orbit size={11} color="#C4B5FD" />} value={String(planetCount)} label={t('stars.micro.statMemories')} />
        <View style={styles.statDivider} />
        <Stat icon={<Zap size={11} color="#FDE68A" />} value={String(starDetails.total_sparks_count ?? 0)} label={t('stars.micro.statSparks')} />
        <View style={styles.statDivider} />
        <Stat icon={<Heart size={11} color="#F472B6" fill="#F472B6" />} value={String(daysInSky)} label={t('home.meeting.days')} />
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 18,
    alignItems: 'center',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  eyebrowLine: {
    width: 30,
    height: 1,
  },
  eyebrow: {
    color: 'rgba(253, 230, 138, 0.88)',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.6,
  },
  eyebrowResonance: {
    color: '#FCD34D',
    letterSpacing: 1.6,
  },
  resonanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  title: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 23,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.4,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  certBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  meta: {
    marginTop: 3,
    color: 'rgba(203, 213, 225, 0.62)',
    fontSize: 11.5,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.4,
  },
  statStrip: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  stat: {
    minWidth: 62,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 2,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: 'rgba(203, 213, 225, 0.55)',
    fontSize: 8.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.3,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  meter: {
    width: 28,
    height: 2,
    marginTop: 2,
    borderRadius: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  meterFill: {
    height: '100%',
    borderRadius: 2,
  },
});

export default MicroStarHeader;
