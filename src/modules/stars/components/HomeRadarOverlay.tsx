/**
 * @file HomeRadarOverlay.tsx
 * @module modules/stars/components
 * @description Makro gökyüzünden kullanıcının kendi yıldız sistemine dönüşte
 * gösterilen fütüristik kozmik radar intikal ve kilitlenme ekranı (HUD).
 *
 * Tüm tema modlarıyla (Beyaz, Mavi, Pembe, Gece) tam uyumludur.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Radio, Crosshair, Sparkles, Navigation, X, Orbit } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { getSectorByCoords } from '../config/skySectors.data';
import type { CoupleStarDetails } from '../types/star.types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const RADAR_SIZE = Math.min(SCREEN_WIDTH - 64, 300);

export interface HomeRadarOverlayProps {
  visible: boolean;
  starDetails: CoupleStarDetails | null;
  onComplete: () => void;
  onClose?: () => void;
}

export const HomeRadarOverlay: React.FC<HomeRadarOverlayProps> = ({
  visible,
  starDetails,
  onComplete,
  onClose,
}) => {
  const { theme, isLight } = useTheme();
  const [phaseText, setPhaseText] = useState('Kozmik koordinatlar taranıyor...');
  const [phaseStep, setPhaseStep] = useState(1);

  // Animations
  const sweepAngle = useSharedValue(0);
  const pulse1 = useSharedValue(0);
  const pulse2 = useSharedValue(0);
  const lockScale = useSharedValue(1.8);
  const lockOpacity = useSharedValue(0);
  const travelProgress = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      sweepAngle.value = 0;
      pulse1.value = 0;
      pulse2.value = 0;
      lockScale.value = 1.8;
      lockOpacity.value = 0;
      travelProgress.value = 0;
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}

    // 1. Radar Dönen Işın
    sweepAngle.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );

    // 2. Nabız Dalgaları
    pulse1.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );

    const pulseTimeout = setTimeout(() => {
      pulse2.value = withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
    }, 700);

    // 3. Hedefe Kilitlenme Animasyonu
    lockScale.value = withTiming(1.0, { duration: 1000, easing: Easing.out(Easing.back(1.5)) });
    lockOpacity.value = withTiming(1.0, { duration: 400 });

    // 4. İntikal İlerleme Çubuğu (2.0 saniye)
    travelProgress.value = withTiming(1.0, { duration: 2000, easing: Easing.inOut(Easing.cubic) });

    // Aşamalar ve Haptik Geri Bildirimler
    const t1 = setTimeout(() => {
      setPhaseStep(2);
      setPhaseText('Kozmik çekim alanına kilitlenildi ⚡');
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
    }, 700);

    const t2 = setTimeout(() => {
      setPhaseStep(3);
      setPhaseText('Gök Kubbede yıldızımıza yaklaşıldı ✨');
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }, 1400);

    const tComplete = setTimeout(() => {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      onComplete();
    }, 2100);

    return () => {
      clearTimeout(pulseTimeout);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(tComplete);
    };
  }, [visible, onComplete]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sweepAngle.value}deg` }],
  }));

  const wave1Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse1.value, [0, 1], [0.2, 1.2]) }],
    opacity: interpolate(pulse1.value, [0, 0.7, 1], [0.8, 0.35, 0]),
  }));

  const wave2Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse2.value, [0, 1], [0.2, 1.2]) }],
    opacity: interpolate(pulse2.value, [0, 0.7, 1], [0.8, 0.35, 0]),
  }));

  const lockReticleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: lockScale.value }],
    opacity: lockOpacity.value,
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${travelProgress.value * 100}%`,
  }));

  if (!visible) return null;

  const starName = starDetails?.custom_name || 'Bizim Yıldızımız';
  const starRa = starDetails ? Number(starDetails.ra).toFixed(4) : '0.0000';
  const starDec = starDetails
    ? (Number(starDetails.dec) >= 0 ? '+' : '') + Number(starDetails.dec).toFixed(4)
    : '+0.0000';
  const sectorInfo = starDetails
    ? getSectorByCoords(Number(starDetails.ra), Number(starDetails.dec))
    : null;
  const sector = sectorInfo ? `${sectorInfo.symbol} ${sectorInfo.name}` : 'Merkez Sektör';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose || onComplete}
    >
      <View
        style={[
          styles.backdrop,
          { backgroundColor: isLight ? 'rgba(0, 0, 0, 0.55)' : 'rgba(2, 6, 23, 0.88)' },
        ]}
      >
        {/* Üst HUD Çubuğu */}
        <View style={styles.topHud}>
          <View style={styles.radarStatusPill}>
            <Radio size={14} color="#10B981" />
            <Text style={styles.radarStatusText}>EVE DÖNÜŞ RADARI AKTİF</Text>
          </View>
          {onClose && (
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeBtn,
                { backgroundColor: isLight ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.08)' },
              ]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Ana Radar Ekranı */}
        <View style={styles.radarContainer}>
          <View style={styles.radarCircle}>
            {/* Nabız Dalgaları */}
            <Animated.View style={[styles.radarWave, wave1Style]} />
            <Animated.View style={[styles.radarWave, wave2Style]} />

            {/* İç Eşmerkezli Halka Kılavuzları */}
            <View style={[styles.concentricRing, { width: RADAR_SIZE * 0.75, height: RADAR_SIZE * 0.75 }]} />
            <View style={[styles.concentricRing, { width: RADAR_SIZE * 0.5, height: RADAR_SIZE * 0.5 }]} />
            <View style={[styles.concentricRing, { width: RADAR_SIZE * 0.25, height: RADAR_SIZE * 0.25 }]} />

            {/* Kesişim Kılavuzları */}
            <View style={styles.crossH} />
            <View style={styles.crossV} />

            {/* Dönen Radar Işını */}
            <Animated.View style={[styles.sweepContainer, sweepStyle]}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.6)', 'rgba(16, 185, 129, 0.0)']}
                start={{ x: 1, y: 0.5 }}
                end={{ x: 0, y: 0.5 }}
                style={styles.sweepBeam}
              />
            </Animated.View>

            {/* Hedef Kilit Noktası & Reticle */}
            <Animated.View style={[styles.lockReticle, lockReticleStyle]}>
              <Crosshair size={32} color="#10B981" strokeWidth={1.75} />
              <View style={styles.lockCenterDot} />
            </Animated.View>
          </View>
        </View>

        {/* Telemetri & Bilgi Kartı */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: theme.cardBg,
              borderColor: isLight ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.3)',
            },
          ]}
        >
          <View style={styles.targetHeader}>
            <View style={styles.targetBadge}>
              <Navigation size={12} color="#10B981" />
              <Text style={styles.targetBadgeText}>HEDEF KİLİTLENDİ</Text>
            </View>
            <Text style={[styles.sectorText, { color: theme.textSecondary }]}>{sector}</Text>
          </View>

          <Text style={[styles.starNameText, { color: theme.text }]} numberOfLines={1}>
            {starName} ✨
          </Text>

          {/* Koordinat Grid */}
          <View
            style={[
              styles.coordsGrid,
              { backgroundColor: theme.unitBg },
            ]}
          >
            <View style={styles.coordItem}>
              <Text style={[styles.coordLabel, { color: theme.textMuted }]}>SAĞ AÇIKLIK (RA)</Text>
              <Text style={[styles.coordValue, { color: isLight ? '#0284C7' : '#38BDF8' }]}>{starRa}°</Text>
            </View>
            <View
              style={[
                styles.coordDivider,
                { backgroundColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)' },
              ]}
            />
            <View style={styles.coordItem}>
              <Text style={[styles.coordLabel, { color: theme.textMuted }]}>DİK AÇIKLIK (DEC)</Text>
              <Text style={[styles.coordValue, { color: isLight ? '#0284C7' : '#38BDF8' }]}>{starDec}°</Text>
            </View>
          </View>

          {/* İlerleme ve Aşama Durumu */}
          <View style={styles.progressContainer}>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)' },
              ]}
            >
              <Animated.View style={[styles.progressBar, progressBarStyle]} />
            </View>
            <View style={styles.phaseRow}>
              <Text style={[styles.phaseText, { color: theme.textSecondary }]}>{phaseText}</Text>
              <Text style={styles.phasePercent}>%{Math.round(phaseStep * 33.3)}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  topHud: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  radarStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  radarStatusText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarContainer: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCircle: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    backgroundColor: 'rgba(6, 78, 59, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  radarWave: {
    position: 'absolute',
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  concentricRing: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  crossH: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  crossV: {
    position: 'absolute',
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  sweepContainer: {
    position: 'absolute',
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  sweepBeam: {
    width: RADAR_SIZE / 2,
    height: RADAR_SIZE / 2,
    borderTopRightRadius: RADAR_SIZE / 2,
  },
  lockReticle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockCenterDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  infoCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  targetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  targetBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.8,
  },
  sectorText: {
    fontSize: 11,
    fontWeight: '500',
  },
  starNameText: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  coordsGrid: {
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  coordItem: {
    flex: 1,
  },
  coordLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  coordValue: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  coordDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 10,
  },
  progressContainer: {
    gap: 8,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  phaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phaseText: {
    fontSize: 12,
    fontWeight: '500',
  },
  phasePercent: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
  },
});

export default HomeRadarOverlay;
