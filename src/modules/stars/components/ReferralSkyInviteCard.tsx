/**
 * @file ReferralSkyInviteCard.tsx
 * @module modules/stars/components
 * @description Yıldızı olmayan çifte Gökkubbe'de, davetle bağlı arkadaş çiftin yıldızını gösteren kart
 * (bkz. get_referral_star_invite). "Yıldızlarını göster" kamerayı arkadaş yıldızına uçurur; çift yanındaki boş
 * bir yıldızı seçince iki yıldız arasındaki ışık bağı sunucuda kendiliğinden kurulur.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Telescope } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import type { ReferralStarInvite } from '@/lib/referral';

export interface ReferralSkyInviteCardProps {
  readonly invite: ReferralStarInvite;
  /** Bizi davet eden çiftin yıldızı ve Premium hediyemiz sürüyor: metin hediyeyi anar */
  readonly showGift: boolean;
  readonly rewardDays: number;
  readonly onFlyTo: () => void;
}

export const ReferralSkyInviteCard: React.FC<ReferralSkyInviteCardProps> = ({ invite, showGift, rewardDays, onFlyTo }) => {
  const { t } = useTranslation();
  const { theme, isLight } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(15, 12, 30, 0.93)',
          borderColor: isLight ? 'rgba(236, 72, 153, 0.3)' : 'rgba(244, 114, 182, 0.35)',
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Sparkles size={16} color="#F472B6" />
        </View>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {t('referral.sky.title')}
        </Text>
      </View>

      {invite.friendLabel && (
        <Text style={[styles.friend, { color: isLight ? '#BE185D' : '#F9A8D4' }]} numberOfLines={1}>
          💫 {invite.friendLabel}
        </Text>
      )}
      {invite.friendStarName && (
        <Text style={[styles.starName, { color: theme.textMuted }]} numberOfLines={1}>
          {t('referral.sky.friendStar', { star: invite.friendStarName })}
        </Text>
      )}

      <Text style={[styles.body, { color: theme.textSecondary }]}>
        {showGift ? t('referral.sky.bodyGift', { days: rewardDays }) : t('referral.sky.bodyPlain')}
      </Text>

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onFlyTo}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel={t('referral.sky.flyToA11y')}
      >
        <LinearGradient colors={['#EC4899', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient}>
          <Telescope size={15} color="#FFFFFF" />
          <Text style={styles.buttonText}>{t('referral.sky.flyTo')}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(244, 114, 182, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 114, 182, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  friend: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  starName: {
    fontSize: 11.5,
    fontWeight: '500',
    marginBottom: 6,
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    marginBottom: 12,
  },
  button: {
    width: '100%',
    height: 42,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
