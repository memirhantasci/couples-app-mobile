/**
 * @file StarNameVisibilityCard.tsx
 * @module modules/stars/components
 * @description Yıldız sertifikasında "İsimlerimiz" ayarı.
 *
 * - Bağ kurulan çiftler her zaman ilk adları görür (bağ isteğinde bu söylenir).
 * - Diğer çiftler yalnızca baş harfleri görür; kişi AÇIKÇA izin verirse yalnızca onun ilk adı görünür.
 * - Rıza kişi başınadır: herkes yalnızca kendi adını açabilir, partnerin adı onun kendi ayarına bağlıdır.
 *   Varsayılan kapalıdır; açarken onay istenir, kapatmak tek dokunuştur.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { appAlert, confirmDialog } from '@/lib/dialog';
import { localizeServerError } from '@/lib/serverErrors';
import { starService } from '../api/starService';
import type { StarNameVisibilityMember } from '../types/star.types';
import { moderateStarName } from '../utils/nameModeration';

const FIRST_NAME_MAX = 20;

/** Sunucudaki star_name_initial ile aynı kural: Türkçe öncelikli (i → İ, ı → I). */
function serverInitial(text: string): string {
  const first = Array.from(text.trim())[0] ?? '';
  if (first === 'i') return 'İ';
  if (first === 'ı') return 'I';
  return first.toUpperCase();
}

/** Sunucudaki star_owner_label'ın tek üye için karşılığı (önizleme; asıl etiket sunucuda hesaplanır). */
function memberLabel(member: StarNameVisibilityMember, revealName: boolean): string {
  const display = (member.display_name ?? '').trim();
  const firstName = Array.from(display.split(' ')[0] ?? '').slice(0, FIRST_NAME_MAX).join('');
  if (revealName && firstName && moderateStarName(firstName).isValid) {
    return serverInitial(firstName) + Array.from(firstName).slice(1).join('');
  }
  return serverInitial(display || member.username || '');
}

function firstNameOf(member: StarNameVisibilityMember | undefined): string {
  return (member?.display_name ?? '').trim().split(' ')[0] || member?.username || '';
}

export function StarNameVisibilityCard() {
  const { t } = useTranslation();
  const { theme, isLight } = useTheme();
  const { session, profile, isDemoMode } = useAuth();
  const userId = session?.user?.id ?? null;
  const coupleId = profile?.coupleId ?? null;

  const [members, setMembers] = useState<StarNameVisibilityMember[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isDemoMode || !coupleId) return;
    let cancelled = false;
    starService
      .getStarNameVisibility(coupleId)
      .then((rows) => {
        if (!cancelled) setMembers(rows);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemoMode, coupleId]);

  const me = members?.find((m) => m.id === userId);
  const partner = members?.find((m) => m.id !== userId);

  const applyVisibility = useCallback(
    async (visible: boolean) => {
      if (!userId || saving) return;
      setSaving(true);
      // İyimser güncelleme: kayıt başarısız olursa eski değere döner
      setMembers((prev) => prev?.map((m) => (m.id === userId ? { ...m, show_name_on_star: visible } : m)) ?? prev);
      try {
        await starService.setMyStarNameVisibility(userId, visible);
      } catch (err) {
        setMembers((prev) => prev?.map((m) => (m.id === userId ? { ...m, show_name_on_star: !visible } : m)) ?? prev);
        // Kart sertifika modalının içinde: kök toast modalın arkasında kalır, hata diyalogla gösterilir
        appAlert(t('common.error'), localizeServerError(err, t('stars.nameVisibility.saveFailed')));
      } finally {
        setSaving(false);
      }
    },
    [saving, t, userId]
  );

  const handleToggle = async (next: boolean) => {
    if (!next) {
      applyVisibility(false);
      return;
    }
    const confirmed = await confirmDialog({
      title: t('stars.nameVisibility.consentTitle'),
      message: t('stars.nameVisibility.consentMessage', { name: firstNameOf(me) }),
      confirmText: t('stars.nameVisibility.consentConfirm'),
      tone: 'question',
    });
    if (confirmed) applyVisibility(true);
  };

  if (isDemoMode || !coupleId || !userId) return null;

  const borderColor = isLight ? 'rgba(217, 119, 6, 0.25)' : 'rgba(251, 191, 36, 0.22)';
  const preview = members && members.length > 0
    ? members.map((m) => memberLabel(m, m.show_name_on_star)).filter(Boolean).join(' 💕 ')
    : '';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isLight ? theme.unitBg : 'rgba(255, 255, 255, 0.04)', borderColor },
      ]}
    >
      <View style={styles.titleRow}>
        <Users size={15} color={isLight ? '#B45309' : '#FBBF24'} />
        <Text style={[styles.title, { color: theme.text }]}>{t('stars.nameVisibility.title')}</Text>
      </View>
      <Text style={[styles.body, { color: theme.textSecondary }]}>{t('stars.nameVisibility.description')}</Text>

      {members === null ? (
        <ActivityIndicator size="small" color={isLight ? '#B45309' : '#FBBF24'} style={styles.loader} />
      ) : me ? (
        <>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: theme.text }]}>{t('stars.nameVisibility.toggle')}</Text>
            <Switch
              value={me.show_name_on_star}
              onValueChange={handleToggle}
              disabled={saving}
              trackColor={{ false: isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.18)', true: '#F59E0B' }}
              thumbColor="#FFFFFF"
              accessibilityLabel={t('stars.nameVisibility.toggle')}
            />
          </View>
          {partner ? (
            <Text style={[styles.note, { color: theme.textMuted }]}>
              {partner.show_name_on_star
                ? t('stars.nameVisibility.partnerShown', { name: firstNameOf(partner) })
                : t('stars.nameVisibility.partnerHidden', { name: firstNameOf(partner) })}
            </Text>
          ) : null}
          {preview ? (
            <Text style={[styles.note, { color: theme.textMuted }]}>
              {t('stars.nameVisibility.preview')}{' '}
              <Text style={[styles.previewValue, { color: theme.text }]}>{preview}</Text>
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={[styles.note, { color: theme.textMuted }]}>{t('stars.nameVisibility.loadFailed')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
    marginTop: 4,
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
  },
  loader: {
    marginVertical: 6,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 2,
  },
  switchLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  note: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  previewValue: {
    fontWeight: '700',
  },
});
