/**
 * @file StellarHibernationModal.tsx
 * @module modules/stars/components
 * @description Premium'u biten çiftin yıldızı 14 günlük kış uykusundayken (grace_period) yıldızın içine
 * girilmek istendiğinde açılan kart. Kapıyı kapatmaz: yıldızın enerjisini korumak için uyuduğunu, anıların
 * güvende olduğunu ve uyanması için kalan süreyi anlatır; "Yıldızımızı Uyandır" ödeme ekranını açar.
 */

import React, { useEffect } from 'react';
import { Dimensions, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MoonStar, ShieldCheck, Sparkles, X } from 'lucide-react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';

export interface StellarHibernationModalProps {
  readonly visible: boolean;
  readonly starName: string;
  /** Uyanmak için kalan gün (bilinmiyorsa null) */
  readonly daysLeft: number | null;
  readonly onWake: () => void;
  readonly onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Uyuyan yıldızın soluk nefesi: yavaş, düşük genlikli bir parıltı */
function SleepingStarHalo({ isLight }: { readonly isLight: boolean }) {
  const breath = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    breath.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(breath);
  }, [breath, reduceMotion]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + breath.value * 0.3,
    transform: [{ scale: 1 + breath.value * 0.08 }],
  }));

  return (
    <View style={styles.haloBox}>
      <Animated.View
        style={[
          styles.halo,
          { backgroundColor: isLight ? 'rgba(99, 102, 241, 0.18)' : 'rgba(165, 180, 252, 0.16)' },
          haloStyle,
        ]}
      />
      <LinearGradient
        colors={isLight ? ['#6366F1', '#A78BFA'] : ['#312E81', '#6D28D9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconCircle}
      >
        <MoonStar size={28} color="#E0E7FF" />
      </LinearGradient>
    </View>
  );
}

export const StellarHibernationModal: React.FC<StellarHibernationModalProps> = ({
  visible,
  starName,
  daysLeft,
  onWake,
  onClose,
}) => {
  const { t } = useTranslation();
  const { theme, isLight } = useTheme();
  const accent = isLight ? '#4F46E5' : '#A5B4FC';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: isLight ? 'rgba(15, 23, 42, 0.35)' : 'rgba(3, 2, 7, 0.72)' }]}>
        <BlurView intensity={Platform.OS === 'ios' ? 60 : 90} tint={isLight ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: isLight ? '#FFFFFF' : theme.cardBg,
              borderColor: isLight ? 'rgba(79, 70, 229, 0.14)' : 'rgba(165, 180, 252, 0.18)',
              shadowColor: isLight ? '#1E1B4B' : '#6366F1',
            },
          ]}
          accessibilityViewIsModal
        >
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)' }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={t('common.close')}
          >
            <X size={18} color={theme.text} />
          </TouchableOpacity>

          {visible && <SleepingStarHalo isLight={isLight} />}

          <Text style={[styles.eyebrow, { color: accent }]}>{starName}</Text>
          <Text style={[styles.title, { color: theme.text }]}>{t('stars.hibernation.title')}</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>{t('stars.hibernation.description')}</Text>

          <View
            style={[
              styles.safeRow,
              { backgroundColor: isLight ? 'rgba(16, 185, 129, 0.08)' : 'rgba(52, 211, 153, 0.08)' },
            ]}
          >
            <ShieldCheck size={15} color={isLight ? '#047857' : '#6EE7B7'} />
            <Text style={[styles.safeText, { color: isLight ? '#065F46' : '#A7F3D0' }]}>{t('stars.hibernation.memoriesSafe')}</Text>
          </View>

          {daysLeft !== null && (
            <Text style={[styles.daysText, { color: theme.textMuted }]}>
              {t('stars.hibernation.daysLeft', { count: daysLeft })}
            </Text>
          )}

          <TouchableOpacity onPress={onWake} activeOpacity={0.88} style={styles.wakeBtn} accessibilityRole="button">
            <LinearGradient
              colors={['#F59E0B', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.wakeGradient}
            >
              <Sparkles size={17} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.wakeBtnText}>{t('stars.hibernation.wake')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} activeOpacity={0.65} style={styles.dismissBtn} accessibilityRole="button">
            <Text style={[styles.dismissBtnText, { color: theme.textMuted }]}>{t('stars.hibernation.stayInSky')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 48, 360),
    borderRadius: 26,
    borderWidth: 1.2,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  haloBox: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  halo: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  iconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
    textAlign: 'center',
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 10,
  },
  description: {
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  safeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 12,
  },
  safeText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  daysText: {
    fontSize: 12.5,
    textAlign: 'center',
    marginBottom: 16,
  },
  wakeBtn: {
    width: '100%',
    height: 48,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  wakeGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wakeBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dismissBtn: {
    width: '100%',
    height: 40,
    marginTop: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
