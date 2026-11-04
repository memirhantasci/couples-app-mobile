/**
 * @file ClaimStarModal.tsx
 * @module modules/stars/components
 * @description Çiftlerin gökyüzünden gerçek bir yıldızı sahiplendiği sinematik tescil modalı.
 *
 * Akış:
 * 1. 'input': İsim belirleme formu ve tescil başlatma.
 * 2. 'scanning': Sinematik radar animasyonu (min 1.5s garanti, >10s gecikme uyarısı).
 * 3. 'error': Hata durumu (anlaşılır mesaj ve tekrar dene butonu).
 * 4. 'certificate': Altın mühürlü dijital tescil sertifikası ve sisteme geçiş.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
  cancelAnimation,
} from 'react-native-reanimated';
import { hapticStamp, hapticSuccess, hapticError } from '@/lib/soundEffects';
import { dayjs } from '@/lib/date';
import {
  Sparkles,
  AlertCircle,
  Radio,
  CheckCircle2,
  Pencil,
  Share2,
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { starService, StarRenameCooldownError } from '../api/starService';
import { moderateStarName } from '../utils/nameModeration';
import { computeOwnCoupleInitials } from '../utils/ownerInitials';
import { StarNameVisibilityCard } from './StarNameVisibilityCard';
import { DialogHost } from '@/components/ui/DialogHost';
import type { CoupleStarDetails, ViewportStarItem } from '../types/star.types';
import { SKY_SECTORS, type SectorConfig } from '../config/skySectors.data';
import { UNCLAIMED_STAR_BRIGHTNESS } from '../canvas/macro/starStyle';
import { useTranslation } from 'react-i18next';
import { localizeServerError } from '@/lib/serverErrors';
import { requestReviewAtMoment } from '@/lib/storeReview';
import { StorySharePreview } from '@/components/share/StorySharePreview';
import { StarCertificateStoryCard } from '@/components/share/StarCertificateStoryCard';
import { FoilSeal, GOLD, GoldRule, Monogram, unitScale } from '@/components/share/storyDecor';
import { useStoryCouple } from '@/hooks/useStoryCouple';

// ============================================================================
// TİPLER VE SABİTLER
// ============================================================================

export type ClaimModalState = 'input' | 'scanning' | 'error' | 'certificate';

export interface ClaimStarModalProps {
  readonly visible: boolean;
  readonly coupleId: number;
  /**
   * Mevcut tescilli yıldız sertifikasını salt-okunur görüntülemek için.
   * Sağlanmışsa modal doğrudan 'certificate' durumunda açılır.
   */
  readonly initialStar?: CoupleStarDetails | null;
  /**
   * MacroSkyCanvas üzerinde seçilen belirli bir yıldız.
   * Sağlanmışsa modal 'input' modunda açılır ve claim_specific_star RPC kullanılır.
   */
  readonly preSelectedStar?: ViewportStarItem;
  /**
   * SectorAtlasModal'dan gelen sektör ID'si.
   * Sağlanmışsa modal 'input' modunda açılır ve claim_star_in_sector RPC kullanılır.
   */
  readonly preSelectedSectorId?: string;
  /** UI guard only; the claim RPC independently enforces this entitlement. */
  readonly isPremium?: boolean;
  readonly onPremiumRequired?: () => void;
  readonly onClose?: () => void;
  /**
   * Tescil sunucuda tamamlandığı AN çağrılır (sertifika henüz açıkken): ekran yıldızı hemen tanısın.
   * `onSuccess` ise sertifikadaki son düğmeye basılınca çağrılır; sertifika X / geri tuşuyla kapatılırsa hiç çağrılmaz.
   */
  readonly onClaimed?: (star: CoupleStarDetails) => void;
  readonly onSuccess?: (star: CoupleStarDetails) => void;
  /** Sertifika görünümünde "İsmi düzenle" gösterilsin mi (demo hesapta kapalı). */
  readonly canRename?: boolean;
  /** İsim değiştirildi: güncel yıldız detayı (ekran durumunu ve önbelleği tazelemek için). */
  readonly onRenamed?: (star: CoupleStarDetails) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Sertifikanın iç altın çerçevesinin köşelerindeki baklavalar
const CERT_CORNERS = [
  { key: 'tl', style: { top: 5, left: 5 } },
  { key: 'tr', style: { top: 5, right: 5 } },
  { key: 'bl', style: { bottom: 5, left: 5 } },
  { key: 'br', style: { bottom: 5, right: 5 } },
] as const;

// ============================================================================
// RADAR ANİMASYON BİLEŞENİ
// ============================================================================

const CosmicRadarSweep: React.FC<{ isSlowWarning: boolean; isConfirming?: boolean; confirmedRa?: number; confirmedDec?: number }> = ({
  isSlowWarning,
  isConfirming = false,
  confirmedRa,
  confirmedDec,
}) => {
  const { t } = useTranslation();
  const { theme, isLight } = useTheme();
  const rotation = useSharedValue(0);
  const pulse1 = useSharedValue(0);
  const pulse2 = useSharedValue(0);

  // Rastgele telemetri — yalnızca tarama modunda gösterilir
  const [telemetry, setTelemetry] = useState({ ra: '184.2140', dec: '+12.4300', mag: '5.20' });

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2400, easing: Easing.linear }),
      -1,
      false
    );

    pulse1.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );

    const timeout = setTimeout(() => {
      pulse2.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
    }, 1000);

    // Rastgele telemetri yalnızca tarama (rastgele) modunda çalışır
    if (!isConfirming) {
      const interval = setInterval(() => {
        const fakeRa = (180 + Math.random() * 8).toFixed(4);
        const fakeDec = (Math.random() > 0.5 ? '+' : '-') + (10 + Math.random() * 15).toFixed(4);
        const fakeMag = (4.5 + Math.random() * 2.5).toFixed(2);
        setTelemetry({ ra: fakeRa, dec: fakeDec, mag: fakeMag });
      }, 180);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
        cancelAnimation(rotation);
        cancelAnimation(pulse1);
        cancelAnimation(pulse2);
      };
    }

    return () => {
      clearTimeout(timeout);
      cancelAnimation(rotation);
      cancelAnimation(pulse1);
      cancelAnimation(pulse2);
    };
  }, [isConfirming]);

  const radarSweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const wave1Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse1.value, [0, 1], [0.2, 1.25]) }],
    opacity: interpolate(pulse1.value, [0, 0.7, 1], [0.8, 0.4, 0]),
  }));

  const wave2Style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse2.value, [0, 1], [0.2, 1.25]) }],
    opacity: interpolate(pulse2.value, [0, 0.7, 1], [0.8, 0.4, 0]),
  }));

  // Onay modu: sabit gerçek koordinatlar | Tarama modu: rastgele akan telemetri
  const displayRa = isConfirming && confirmedRa != null
    ? Number(confirmedRa).toFixed(4)
    : telemetry.ra;
  const displayDec = isConfirming && confirmedDec != null
    ? (Number(confirmedDec) >= 0 ? '+' : '') + Number(confirmedDec).toFixed(4)
    : telemetry.dec;

  return (
    <View style={styles.radarWrapper}>
      <View style={[styles.radarCircle, isLight && { backgroundColor: 'rgba(224, 242, 254, 0.75)', borderColor: 'rgba(2, 132, 199, 0.35)' }]}>
        <Animated.View style={[styles.radarWave, wave1Style, isLight && { borderColor: '#0284C7' }]} />
        <Animated.View style={[styles.radarWave, wave2Style, isLight && { borderColor: '#0284C7' }]} />

        <View style={[styles.radarRing1, isLight && { borderColor: 'rgba(2, 132, 199, 0.2)' }]} />
        <View style={[styles.radarRing2, isLight && { borderColor: 'rgba(2, 132, 199, 0.25)' }]} />
        <View style={[styles.radarCrossH, isLight && { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]} />
        <View style={[styles.radarCrossV, isLight && { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]} />

        <Animated.View style={[styles.sweepContainer, radarSweepStyle]}>
          <LinearGradient
            colors={[
              isConfirming ? 'rgba(251, 191, 36, 0.55)' : isLight ? 'rgba(2, 132, 199, 0.55)' : 'rgba(74, 140, 179, 0.55)',
              isConfirming ? 'rgba(251, 191, 36, 0)' : isLight ? 'rgba(2, 132, 199, 0)' : 'rgba(74, 140, 179, 0)',
            ]}
            start={{ x: 1, y: 0.5 }}
            end={{ x: 0, y: 0.5 }}
            style={styles.sweepBeam}
          />
        </Animated.View>

        <View style={[styles.radarCenterBlip, isConfirming && styles.radarCenterBlipGold, isLight && !isConfirming && { backgroundColor: '#0284C7' }]} />
      </View>

      <View style={styles.telemetryBox}>
        <View style={[styles.telemetryRow, isLight && { backgroundColor: 'rgba(2, 132, 199, 0.1)', borderColor: 'rgba(2, 132, 199, 0.25)' }]}>
          <Radio size={12} color={isConfirming ? '#FBBF24' : isLight ? '#0284C7' : '#4A8CB3'} />
          <Text style={[styles.telemetryText, isConfirming && styles.telemetryTextGold, isLight && !isConfirming && { color: '#0284C7' }]}>
            RA: {displayRa}° | DEC: {displayDec}°
          </Text>
        </View>
        <Text style={[styles.scanningSubText, { color: theme.textMuted }]}>
          {isConfirming
            ? t('stars.claim.radar.engraving')
            : isSlowWarning
            ? t('stars.claim.radar.scanning')
            : t('stars.claim.radar.catalogScan')}
        </Text>
      </View>
    </View>
  );
};

// ============================================================================
// ANA MODAL BİLEŞENİ
// ============================================================================

export const ClaimStarModal: React.FC<ClaimStarModalProps> = ({
  visible,
  coupleId,
  initialStar,
  preSelectedStar,
  preSelectedSectorId,
  isPremium = false,
  onPremiumRequired,
  onClose,
  onClaimed,
  onSuccess,
  canRename = false,
  onRenamed,
}) => {
  const { t, i18n } = useTranslation();
  const { theme, isLight } = useTheme();
  const [modalState, setModalState] = useState<ClaimModalState>(
    initialStar ? 'certificate' : 'input'
  );
  const [customName, setCustomName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isP0005Error, setIsP0005Error] = useState(false); // zaten yıldızı var hatası
  const [isSlowWarning, setIsSlowWarning] = useState(false);
  const [claimedStar, setClaimedStar] = useState<CoupleStarDetails | null>(
    initialStar ?? null
  );
  // Sertifikanın Instagram hikâyesi önizlemesi ve karttaki çift monogramı / isimleri
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const couple = useStoryCouple(visible && modalState === 'certificate');

  // preSelectedStar varken scanning süresi kısaltılır (0.8s vs 1.5s)
  const isSpecificMode = preSelectedStar != null;
  const isSectorMode = preSelectedSectorId != null && !isSpecificMode;
  const sectorConfig: SectorConfig | undefined = isSectorMode
    ? SKY_SECTORS[preSelectedSectorId]
    : undefined;

  const slowWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── İsim değiştirme (sertifika görünümü; çift başına 30 günde bir) ───
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);

  // ─── Android klavye payı ──────────────────────────────────────────
  // KeyboardAvoidingView('height') Android'de, pencere klavyeyle zaten küçülen cihazlarda payı ikinci kez
  // düşüyor: kart klavyenin üstünde dar bir şeride sıkışıp üstten kesiliyordu. Pencerenin klavyeyle GERÇEKTEN
  // çakışan kısmı ölçülür ve yalnızca o kadar boşluk bırakılır: pencere küçüldüyse 0, küçülmediyse klavye boyu.
  const rootRef = useRef<View>(null);
  const keyboardTopRef = useRef<number | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const updateKeyboardInset = useCallback(() => {
    const keyboardTop = keyboardTopRef.current;
    if (keyboardTop === null) {
      setKeyboardInset(0);
      return;
    }
    rootRef.current?.measureInWindow((_x, y, _w, height) => {
      // Klavye hâlâ açıksa sonucu uygula (ölçüm asenkron döner)
      if (keyboardTopRef.current === null) return;
      setKeyboardInset(Math.max(0, Math.round(y + height - keyboardTopRef.current)));
    });
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTopRef.current = event.endCoordinates.screenY;
      updateKeyboardInset();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTopRef.current = null;
      setKeyboardInset(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [updateKeyboardInset]);
  const [renameLockedUntil, setRenameLockedUntil] = useState<string | null>(null);

  const nameLockedUntil = renameLockedUntil ?? claimedStar?.name_change_available_at ?? null;
  // Render sırasında Date.now() çağrılmaz: "şimdi" modal her açıldığında tazelenir
  const [nowMs, setNowMs] = useState(() => Date.now());
  const isNameLocked = !!nameLockedUntil && Date.parse(nameLockedUntil) > nowMs;

  const startRename = () => {
    setRenameValue(claimedStar?.custom_name ?? '');
    setRenameError('');
    setIsRenaming(true);
  };

  const cancelRename = () => {
    if (renameBusy) return;
    setIsRenaming(false);
    setRenameError('');
  };

  const submitRename = async () => {
    if (renameBusy || !claimedStar) return;
    const trimmed = renameValue.trim();
    if (trimmed.length < 2) return setRenameError(t('stars.claim.errors.nameTooShort'));
    if (trimmed.length > 40) return setRenameError(t('stars.claim.errors.nameTooLong'));
    if (trimmed === claimedStar.custom_name) return setRenameError(t('stars.claim.errors.nameSame'));
    const modResult = moderateStarName(trimmed);
    if (!modResult.isValid) return setRenameError(modResult.message || t('stars.errors.nameModeration'));

    setRenameBusy(true);
    setRenameError('');
    try {
      const updated = await starService.renameMyStar(trimmed);
      setClaimedStar(updated);
      setRenameLockedUntil(updated.name_change_available_at ?? null);
      setIsRenaming(false);
      onRenamed?.(updated);
      await hapticSuccess();
    } catch (err: any) {
      if (err instanceof StarRenameCooldownError) {
        setRenameLockedUntil(err.availableAt);
        setIsRenaming(false);
      } else {
        setRenameError(localizeServerError(err, t('stars.claim.errors.renameFailed')));
      }
      await hapticError();
    } finally {
      setRenameBusy(false);
    }
  };

  // Modal açıldığında state'i senkronize et (initialStar varsa direkt sertifika aç)
  useEffect(() => {
    if (visible) {
      // Modal açılışında state'i prop'lara eşitlemek bilinçli: sertifika doğrudan açılır
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNowMs(Date.now());
      setIsRenaming(false);
      setRenameError('');
      if (initialStar) {
        setClaimedStar(initialStar);
        setModalState('certificate');
      } else {
        setModalState('input');
        setCustomName('');
        setErrorMessage('');
        setIsSlowWarning(false);
        setIsP0005Error(false);
        setClaimedStar(null);
      }
    }
  }, [visible, initialStar?.star_id]);

  // Unmount anında slow warning timer'ını temizle
  useEffect(() => {
    return () => {
      if (slowWarningTimerRef.current) {
        clearTimeout(slowWarningTimerRef.current);
      }
    };
  }, []);

  // Yıldız sahiplenme tetikleyicisi
  const handleStartClaim = async () => {
    if (!isPremium) {
      onPremiumRequired?.();
      return;
    }
    const trimmed = customName.trim();
    if (trimmed.length < 2) {
      setErrorMessage(t('stars.claim.errors.nameTooShort'));
      return;
    }
    if (trimmed.length > 40) {
      setErrorMessage(t('stars.claim.errors.nameTooLong'));
      return;
    }

    const modResult = moderateStarName(trimmed);
    if (!modResult.isValid) {
      setErrorMessage(modResult.message || t('stars.errors.nameModeration'));
      return;
    }

    setErrorMessage('');
    setIsP0005Error(false);
    setModalState('scanning');
    setIsSlowWarning(false);

    await hapticStamp();

    // Yavaş bağlantı uyarısı — yalnızca rastgele tescil modunda (10s)
    if (!isSpecificMode) {
      slowWarningTimerRef.current = setTimeout(() => {
        setIsSlowWarning(true);
      }, 10000);
    }

    // Minimum bekleme: spesifik modda 0.8s, rastgele modda 1.5s
    const minMs = isSpecificMode ? 800 : 1500;
    const minDelayPromise = new Promise((resolve) => setTimeout(resolve, minMs));

    let resultStar: CoupleStarDetails | null = null;
    let errorOccurred: any = null;

    try {
      // Çiftin baş harfleri (ör. "A 💕 M") — başarısız olursa tescili engellemez.
      const ownerInitials = await computeOwnCoupleInitials(coupleId).catch(() => null);

      if (isSpecificMode && preSelectedStar) {
        // Belirli yıldız tescili (claim_specific_star RPC)
        resultStar = await starService.claimSpecificStar({
          coupleId,
          starCatalogId: preSelectedStar.catalog_id,
          customName: trimmed,
          ownerInitials,
        });
      } else if (isSectorMode && preSelectedSectorId) {
        // Sektör bazlı tescil (claim_star_in_sector RPC)
        resultStar = await starService.claimStarInSector({
          coupleId,
          sectorId: preSelectedSectorId,
          customName: trimmed,
          ownerInitials,
        });
        // Tescil sonrası sektör cache'ini temizle
        starService.invalidateSectorsCache();
      } else {
        // Rastgele yıldız tescili (claim_random_available_star RPC)
        resultStar = await starService.claimRandomStar({
          coupleId,
          customName: trimmed,
          ownerInitials,
        });
      }
    } catch (err: any) {
      errorOccurred = err;
    } finally {
      if (slowWarningTimerRef.current) {
        clearTimeout(slowWarningTimerRef.current);
      }
      await minDelayPromise;
    }

    if (errorOccurred) {
      const errCode = errorOccurred?.code;
      const isAlreadyOwnedErr =
        errCode === 'P0005' ||
        (errorOccurred?.message || '').includes('zaten bir yıldızınız var');

      setIsP0005Error(isAlreadyOwnedErr);
      setModalState('error');
      setErrorMessage(
        errCode === 'P0004'
          ? t('stars.errors.starTaken')
          : isAlreadyOwnedErr
          ? t('stars.errors.alreadyHasStar')
          : errCode === 'P0003'
          ? t('stars.claim.errors.noFreeStar')
          : errorOccurred.message || t('stars.claim.errors.cosmicGlitch')
      );
      await hapticError();
    } else if (resultStar) {
      setClaimedStar(resultStar);
      setModalState('certificate');
      onClaimed?.(resultStar);
      // En özel an: sertifika ekrandayken (kısa gecikmeyle) sistemin değerlendirme penceresi istenir
      void requestReviewAtMoment('star_claimed');
      await hapticSuccess();
    }
  };

  const handleFinish = () => {
    if (claimedStar) {
      onSuccess?.(claimedStar);
    }
  };

  // Sertifika: açık temada altın parşömen, koyu temada koyu kadife; her ikisinde çift katmanlı altın varak
  const certInk = isLight ? '#4A3214' : '#FFF1D6';
  const certInkSoft = isLight ? '#7A5A33' : 'rgba(255, 241, 214, 0.72)';
  const certGold = isLight ? '#9A6B1F' : GOLD.ink;
  const certGoldLine = isLight ? 'rgba(184, 134, 46, 0.55)' : 'rgba(245, 158, 11, 0.42)';
  const certCellBg = isLight ? 'rgba(184, 134, 46, 0.08)' : 'rgba(226, 184, 92, 0.07)';

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={modalState === 'scanning' ? undefined : onClose}
    >
      <View
        ref={rootRef}
        collapsable={false}
        onLayout={Platform.OS === 'android' ? updateKeyboardInset : undefined}
        style={[styles.modalBackdrop, { backgroundColor: isLight ? 'rgba(0, 0, 0, 0.55)' : 'rgba(3, 2, 7, 0.88)' }]}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 70 : 100}
          tint={isLight ? 'light' : 'dark'}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* iOS: KeyboardAvoidingView; Android: ölçülen klavye payı (yukarıya bakın) */}
        <KeyboardAvoidingView
          enabled={Platform.OS === 'ios'}
          behavior="padding"
          style={[styles.keyboardContainer, Platform.OS === 'android' && { paddingBottom: keyboardInset }]}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              modalState === 'input' && styles.scrollContentInput,
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            removeClippedSubviews={false}
            bounces={false}
          >
            {/* KAPATMA BUTONU (Scanning esnasında gizli) */}
            {modalState !== 'scanning' && onClose && (
              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.closeButton,
                  {
                    backgroundColor: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)',
                    borderColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.15)',
                  },
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            )}

            {/* ─── DURUM 1: İSİM GİRME FORMU ─── */}
            {modalState === 'input' && (
              <View
                style={[
                  styles.cardContainer,
                  {
                    backgroundColor: isLight ? '#FFFFFF' : theme.cardBg,
                    borderColor: isLight ? 'rgba(0, 0, 0, 0.08)' : theme.cardBorder,
                    shadowColor: isLight ? '#000' : theme.accent,
                  },
                ]}
              >
                <LinearGradient
                  colors={isLight ? ['rgba(99, 102, 241, 0.06)', 'rgba(168, 85, 247, 0.02)'] : ['rgba(99, 102, 241, 0.15)', 'rgba(168, 85, 247, 0.05)']}
                  style={styles.cardGlowBg}
                />

                <View style={styles.headerIconCircle}>
                  <Sparkles size={28} color="#FBBF24" />
                </View>

                <Text style={[styles.modalTitle, { color: theme.text }]}>{t('stars.defaultName')}</Text>

                {/* Seçili yıldız önizleme kartı (preSelectedStar varsa) */}
                {preSelectedStar ? (
                  <View
                    style={[
                      styles.preSelectedStarCard,
                      {
                        backgroundColor: isLight ? theme.unitBg : 'rgba(74, 140, 179, 0.08)',
                        borderColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(74, 140, 179, 0.25)',
                      },
                    ]}
                  >
                    <View style={[styles.preSelectedStarDot, { backgroundColor: preSelectedStar.base_color || '#9DB4FF' }]} />
                    <View style={styles.preSelectedStarInfo}>
                      <Text style={styles.preSelectedStarCode}>
                        {preSelectedStar.catalog_code}
                      </Text>
                      {preSelectedStar.common_name ? (
                        <Text style={[styles.preSelectedStarCommon, { color: theme.text }]}>
                          {preSelectedStar.common_name}
                        </Text>
                      ) : null}
                      <Text style={[styles.preSelectedStarCoords, { color: theme.textMuted }]}>
                        {t('stars.claim.preSelectedCoords', {
                          ra: Number(preSelectedStar.ra).toFixed(2),
                          dec: `${Number(preSelectedStar.dec) >= 0 ? '+' : ''}${Number(preSelectedStar.dec).toFixed(2)}`,
                          light: Math.round(UNCLAIMED_STAR_BRIGHTNESS * 100),
                        })}
                      </Text>
                    </View>
                    <View style={[styles.preSelectedStarSpectral, isLight && { backgroundColor: 'rgba(0,0,0,0.04)', borderColor: 'rgba(0,0,0,0.08)' }]}>
                      <Text style={[styles.preSelectedStarSpectralText, isLight && { color: theme.text }]}>{preSelectedStar.spectral_type.charAt(0)}</Text>
                    </View>
                  </View>
                ) : isSectorMode && sectorConfig ? (
                  <View
                    style={[
                      styles.preSelectedStarCard,
                      {
                        backgroundColor: isLight ? theme.unitBg : 'rgba(255, 255, 255, 0.04)',
                        borderColor: sectorConfig.themeColor + '50',
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 24 }}>{sectorConfig.symbol}</Text>
                    <View style={styles.preSelectedStarInfo}>
                      <Text style={[styles.preSelectedStarCode, { color: sectorConfig.themeColor }]}>
                        {t(sectorConfig.nameKey)}
                      </Text>
                      <Text style={[styles.preSelectedStarCommon, { color: theme.text }]}>
                        {sectorConfig.latinName} • {sectorConfig.code3}
                      </Text>
                      <Text style={[styles.preSelectedStarCoords, { color: theme.textMuted }]}>
                        {t(sectorConfig.descriptionKey)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                    {t('stars.claim.intro')}
                  </Text>
                )}

                {/* İSİM GİRDİSİ */}
                <View style={styles.inputWrapper}>
                  <Text style={[styles.inputLabel, { color: theme.textMuted }]}>{t('stars.claim.nameLabel')}</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: isLight ? theme.inputBg : 'rgba(255, 255, 255, 0.06)',
                        borderColor: isLight ? theme.inputBorder : 'rgba(255, 255, 255, 0.16)',
                        color: theme.text,
                      },
                    ]}
                    placeholder={t('stars.claim.namePlaceholder')}
                    placeholderTextColor={isLight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.3)'}
                    value={customName}
                    onChangeText={(text) => {
                      setCustomName(text);
                      if (errorMessage) setErrorMessage('');
                    }}
                    maxLength={40}
                    autoCapitalize="words"
                    autoCorrect={false}
                    blurOnSubmit={false}
                    returnKeyType="done"
                  />
                  <Text style={[styles.charCount, { color: theme.textMuted }]}>{customName.trim().length} / 40</Text>
                </View>

                {errorMessage ? (
                  <View style={styles.errorBanner}>
                    <AlertCircle size={14} color="#EF4444" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                {/* SAHIPLEN BUTONU */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleStartClaim}
                  style={styles.primaryButton}
                >
                  <LinearGradient
                    colors={['#4F46E5', '#7C3AED', '#DB2777']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.buttonGradient}
                  >
                    <Sparkles size={18} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>
                      {preSelectedStar
                        ? t('stars.claim.registerThis')
                        : isSectorMode
                        ? t('stars.claim.findInSector', { sector: sectorConfig ? t(sectorConfig.nameKey) : t('stars.claim.sectorFallback') })
                        : t('stars.claim.scanSky')}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={[styles.footnoteText, { color: theme.textMuted }]}>
                  {t('stars.claim.footnote')}
                </Text>
                {/* Yıldız adı herkese görünür: ad konmadan önce bilinsin */}
                <Text style={[styles.footnoteText, { color: theme.textMuted }]}>
                  {t('stars.claim.publicNameNote')}
                </Text>
              </View>
            )}

            {/* ─── DURUM 2: SİNEMATİK RADAR TARAMASI ─── */}
            {modalState === 'scanning' && (
              <View
                style={[
                  styles.cardContainer,
                  {
                    backgroundColor: isLight ? '#FFFFFF' : theme.cardBg,
                    borderColor: isLight ? 'rgba(0, 0, 0, 0.08)' : theme.cardBorder,
                    shadowColor: isLight ? '#000' : theme.accent,
                  },
                ]}
              >
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {isSpecificMode ? t('stars.claim.registering') : t('stars.claim.scanningDome')}
                </Text>
                <CosmicRadarSweep
                  isSlowWarning={isSlowWarning}
                  isConfirming={isSpecificMode}
                  confirmedRa={preSelectedStar?.ra}
                  confirmedDec={preSelectedStar?.dec}
                />
              </View>
            )}

            {/* ─── DURUM 3: HATA EKRANI ─── */}
            {modalState === 'error' && (
              <View
                style={[
                  styles.cardContainer,
                  {
                    backgroundColor: isLight ? '#FFFFFF' : theme.cardBg,
                    borderColor: isLight ? 'rgba(0, 0, 0, 0.08)' : theme.cardBorder,
                    shadowColor: isLight ? '#000' : theme.accent,
                  },
                ]}
              >
                <View style={[styles.headerIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <AlertCircle size={32} color="#EF4444" />
                </View>

                <Text style={[styles.modalTitle, { color: theme.text }]}>{t('stars.claim.errorTitle')}</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>{errorMessage}</Text>

                {/* P0005 hatası: tekrar deneme anlamsız, sadece kapat */}
                {isP0005Error ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={onClose}
                    style={styles.primaryButton}
                  >
                    <LinearGradient
                      colors={['#374151', '#4B5563']}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.primaryButtonText}>{t('common.close')}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={isSpecificMode ? onClose : handleStartClaim}
                    style={styles.primaryButton}
                  >
                    <LinearGradient
                      colors={['#4F46E5', '#7C3AED']}
                      style={styles.buttonGradient}
                    >
                      <Text style={styles.primaryButtonText}>
                        {isSpecificMode ? t('stars.claim.chooseAnother') : t('common.tryAgain')}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ─── DURUM 4: TESCİL SERTİFİKASI ─── */}
            {modalState === 'certificate' && claimedStar && (
              <View
                style={[
                  styles.cardContainer,
                  styles.certificateContainer,
                  { backgroundColor: isLight ? '#FBF3E0' : '#140C16' },
                ]}
              >
                {/* Altın parşömen (açık tema) / koyu kadife (koyu tema) zemin */}
                <LinearGradient
                  colors={isLight ? ['#FFF8EA', '#F6E6C2', '#EED7A3'] : ['#22131F', '#140B16', '#23160F']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardGlowBg}
                />
                {/* Çift katmanlı altın çerçeve: dış kenarın içinde ikinci ince varak ve köşe baklavaları */}
                <View pointerEvents="none" style={[styles.certInnerFrame, { borderColor: certGoldLine }]} />
                {CERT_CORNERS.map((corner) => (
                  <View key={corner.key} pointerEvents="none" style={[styles.certCorner, corner.style, { backgroundColor: certGold }]} />
                ))}

                <Text style={[styles.certTitle, { color: certGold }]}>{t('stars.claim.certTitle')}</Text>
                <GoldRule s={unitScale} width={150} style={styles.certRule} />

                {/* Çiftin baş harfleri */}
                {couple.initials ? (
                  <View style={styles.certMonogram}>
                    <Monogram s={unitScale} initials={couple.initials} size={46} ink={certGold} ring={isLight ? GOLD.deep : GOLD.base} />
                  </View>
                ) : null}

                <Text style={[styles.certStarName, { color: certGold }]}>{claimedStar.custom_name}</Text>
                {/* İsim düzenleme: yalnızca mevcut sertifikayı görüntülerken; çift başına 30 günde bir hak */}
                {canRename && initialStar ? (
                  isRenaming ? (
                    <View style={styles.renameBox}>
                      <TextInput
                        value={renameValue}
                        onChangeText={(v) => {
                          setRenameValue(v);
                          if (renameError) setRenameError('');
                        }}
                        maxLength={40}
                        autoFocus
                        editable={!renameBusy}
                        placeholder={t('stars.claim.renamePlaceholder')}
                        placeholderTextColor={theme.textMuted}
                        selectionColor="#F59E0B"
                        returnKeyType="done"
                        onSubmitEditing={submitRename}
                        style={[
                          styles.renameInput,
                          {
                            color: theme.text,
                            borderColor: renameError ? '#F87171' : isLight ? 'rgba(217, 119, 6, 0.45)' : 'rgba(251, 191, 36, 0.45)',
                            backgroundColor: isLight ? theme.unitBg : 'rgba(255, 255, 255, 0.05)',
                          },
                        ]}
                      />
                      <Text style={[styles.renameHint, { color: renameError ? '#F87171' : theme.textMuted }]}>
                        {renameError || t('stars.claim.renameNote')}
                      </Text>
                      <View style={styles.renameActions}>
                        <TouchableOpacity onPress={cancelRename} disabled={renameBusy} style={styles.renameCancelBtn} activeOpacity={0.8}>
                          <Text style={[styles.renameCancelText, { color: theme.textSecondary }]}>{t('common.cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={submitRename} disabled={renameBusy} style={[styles.renameSaveBtn, renameBusy && { opacity: 0.6 }]} activeOpacity={0.85}>
                          <Text style={styles.renameSaveText}>{renameBusy ? t('stars.claim.saving') : t('common.save')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : !isPremium ? (
                    // Kış uykusunda isim değişmez; isimlerin görünürlüğü (aşağıdaki kart) değiştirilebilir
                    <Text style={[styles.renameLockedText, { color: theme.textMuted }]}>
                      {t('stars.claim.renameHibernating')}
                    </Text>
                  ) : isNameLocked ? (
                    <Text style={[styles.renameLockedText, { color: theme.textMuted }]}>
                      {t('stars.claim.renameLocked', { date: dayjs(nameLockedUntil as string).locale(i18n.language).format('D MMMM') })}
                    </Text>
                  ) : (
                    <TouchableOpacity
                      onPress={startRename}
                      activeOpacity={0.8}
                      style={[
                        styles.renameLink,
                        { borderColor: isLight ? 'rgba(217, 119, 6, 0.35)' : 'rgba(251, 191, 36, 0.35)' },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={t('stars.claim.editNameA11y')}
                    >
                      <Pencil size={12} color={isLight ? '#B45309' : '#FBBF24'} />
                      <Text style={[styles.renameLinkText, { color: isLight ? '#B45309' : '#FBBF24' }]}>{t('stars.claim.editName')}</Text>
                    </TouchableOpacity>
                  )
                ) : null}
                {/* Gerçek astronomi adı — yalnızca doluysa göster */}
                {claimedStar.common_name ? (
                  <Text style={[styles.certCommonName, { color: certInkSoft }]}>({claimedStar.common_name})</Text>
                ) : null}
                <Text style={[styles.certSubText, { color: certInkSoft }]}>
                  {t('stars.claim.certSubtitle')}
                </Text>

                {/* İSİMLERİMİZ: yalnızca kendi tescilli yıldızımızın sertifikasında (demo hariç) */}
                {canRename && initialStar ? <StarNameVisibilityCard /> : null}

                {/* ASTRONOMİK KÜNYE TABLOSU: altın varaklı kutucuklar */}
                <View style={styles.certInfoGrid}>
                  {[
                    { label: t('stars.claim.catalogCode'), value: claimedStar.catalog_code },
                    { label: t('stars.claim.spectralClass'), value: claimedStar.spectral_type },
                    { label: 'RIGHT ASCENSION', value: `${Number(claimedStar.ra).toFixed(4)}°` },
                    {
                      label: 'DECLINATION',
                      value: `${Number(claimedStar.dec) >= 0 ? '+' : ''}${Number(claimedStar.dec).toFixed(4)}°`,
                    },
                  ].map((cell) => (
                    <View key={cell.label} style={[styles.gridItem, { backgroundColor: certCellBg, borderColor: certGoldLine }]}>
                      <Text style={[styles.gridLabel, { color: certGold }]}>{cell.label}</Text>
                      <Text style={[styles.gridValue, { color: certInk }]}>{cell.value}</Text>
                    </View>
                  ))}
                </View>

                {/* İLK IŞIK BİLGİLENDİRMESİ */}
                <View style={[styles.firstSparkNote, { backgroundColor: certCellBg, borderColor: certGoldLine }]}>
                  <CheckCircle2 size={16} color={certGold} />
                  <Text style={[styles.firstSparkText, { color: certInk }]}>
                    {t('stars.claim.certBody')}
                  </Text>
                </View>

                {/* Tescil tarihi ve altın folyo mühür */}
                <View style={styles.certSealRow}>
                  <View style={styles.certSealText}>
                    <Text style={[styles.certRegistryLabel, { color: certGold }]}>CELESTIAL REGISTRY</Text>
                    <Text style={[styles.certRegistered, { color: certInkSoft }]}>
                      {t('stars.claim.story.registeredOn', {
                        date: dayjs(claimedStar.created_at).locale(i18n.language).format('D MMMM YYYY'),
                      })}
                    </Text>
                  </View>
                  <FoilSeal s={unitScale} size={66} text="COUPLESKY ✦ OFFICIALLY SEALED ✦ " rotate={-12} ink={certGold} />
                </View>

                {/* BİRİNCİL: 9:16 Instagram hikâyesi kartı */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setIsStoryOpen(true)}
                  style={[styles.primaryButton, styles.goldButton]}
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={[GOLD.light, GOLD.base, GOLD.deep]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.buttonGradient}
                  >
                    <Share2 size={17} color="#2A1A08" />
                    <Text style={[styles.primaryButtonText, styles.goldButtonText]}>{t('stars.claim.shareCertStory')}</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* İKİNCİL: mikro sisteme adım at / sertifikayı kapat */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={initialStar ? (onClose ?? (() => {})) : handleFinish}
                  style={[styles.secondaryButton, { borderColor: certGoldLine }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.secondaryButtonText, { color: certGold }]}>
                    {initialStar ? t('stars.claim.closeCert') : t('stars.claim.enterMicro')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
      {claimedStar ? (
        <StorySharePreview
          visible={isStoryOpen}
          onClose={() => setIsStoryOpen(false)}
          dialogTitle={t('stars.claim.story.shareTitle')}
          fallbackMessage={t('stars.claim.story.fallbackMessage', { name: claimedStar.custom_name })}
          shareLabel={t('stars.claim.shareCertStory')}
          renderCard={(width, cardRef) => (
            <StarCertificateStoryCard width={width} cardRef={cardRef} star={claimedStar} names={couple.names} />
          )}
        />
      ) : null}
      {/* Modal açıkken diyaloglar (ör. isim görünürlüğü onayı) kök host'un değil bu modalın içinde çizilir */}
      <DialogHost embedded visible={visible} />
    </Modal>
  );
};

// ============================================================================
// STİLLER
// ============================================================================

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 2, 7, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardContainer: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  scrollContentInput: {
    justifyContent: 'center',
    paddingTop: Platform.OS === 'android' ? 24 : 40,
    paddingBottom: Platform.OS === 'android' ? 24 : 40,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  cardContainer: {
    width: Math.min(SCREEN_WIDTH - 40, 380),
    borderRadius: 28,
    backgroundColor: 'rgba(15, 12, 30, 0.85)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  certificateContainer: {
    borderColor: 'rgba(245, 158, 11, 0.6)',
    borderWidth: 1.5,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.25,
    paddingTop: 30,
  },
  // Dış kenarın içindeki ikinci ince altın varak
  certInnerFrame: {
    position: 'absolute',
    top: 9,
    left: 9,
    right: 9,
    bottom: 9,
    borderRadius: 21,
    borderWidth: 0.8,
  },
  certCorner: {
    position: 'absolute',
    width: 7,
    height: 7,
    transform: [{ rotate: '45deg' }],
  },
  certTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 15,
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  certRule: {
    marginTop: 10,
    marginBottom: 14,
  },
  certMonogram: {
    marginBottom: 10,
  },
  certSealRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  certSealText: {
    flex: 1,
  },
  certRegistryLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  certRegistered: {
    marginTop: 3,
    fontSize: 12.5,
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
  },
  goldButton: {
    shadowColor: '#D97706',
  },
  goldButtonText: {
    color: '#2A1A08',
  },
  secondaryButton: {
    width: '100%',
    height: 46,
    borderRadius: 23,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardGlowBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  headerIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  modalSubtitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 14,
  },
  inputLabel: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginLeft: 4,
  },
  textInput: {
    width: '100%',
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  charCount: {
    alignSelf: 'flex-end',
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 10,
    marginTop: 4,
    marginRight: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: 14,
    width: '100%',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    flex: 1,
  },
  primaryButton: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginTop: 6,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  footnoteText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 15,
  },

  // RADAR STİLLERİ
  radarWrapper: {
    alignItems: 'center',
    paddingVertical: 20,
    width: '100%',
  },
  radarCircle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1.5,
    borderColor: 'rgba(74, 140, 179, 0.35)',
    backgroundColor: 'rgba(6, 12, 28, 0.7)',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 18,
  },
  radarWave: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1.5,
    borderColor: '#4A8CB3',
  },
  radarRing1: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    borderColor: 'rgba(74, 140, 179, 0.2)',
    borderStyle: 'dashed',
  },
  radarRing2: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: 'rgba(74, 140, 179, 0.25)',
  },
  radarCrossH: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(74, 140, 179, 0.15)',
  },
  radarCrossV: {
    position: 'absolute',
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(74, 140, 179, 0.15)',
  },
  sweepContainer: {
    position: 'absolute',
    width: 190,
    height: 190,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sweepBeam: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 95,
    height: 95,
    borderTopRightRadius: 95,
  },
  radarCenterBlip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4A8CB3',
    shadowColor: '#4A8CB3',
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  telemetryBox: {
    alignItems: 'center',
    gap: 4,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(74, 140, 179, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 140, 179, 0.25)',
  },
  telemetryText: {
    color: '#4A8CB3',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  scanningSubText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
  },

  // SERTİFİKA STİLLERİ
  certStarName: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 38,
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    textAlign: 'center',
    marginBottom: 4,
  },
  renameLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  renameLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  renameLockedText: {
    fontSize: 11.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  renameBox: {
    width: '100%',
    marginBottom: 10,
  },
  renameInput: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  renameHint: {
    marginTop: 8,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 10,
  },
  renameCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  renameCancelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  renameSaveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: '#D97706',
  },
  renameSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  certSubText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13.5,
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  certInfoGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  gridItem: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  gridLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  gridValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  firstSparkNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 18,
    width: '100%',
  },
  firstSparkText: {
    color: '#A7F3D0',
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  certCommonName: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 8,
    marginTop: -2,
  },
  // Seçili yıldız önizleme kartı (preSelectedStar)
  preSelectedStarCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(74, 140, 179, 0.08)',
    borderRadius: 22,
    padding: 12,
    marginBottom: 16,
  },
  preSelectedStarDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowOpacity: 0.8,
    shadowRadius: 5,
    flexShrink: 0,
  },
  preSelectedStarInfo: {
    flex: 1,
    gap: 2,
  },
  preSelectedStarCode: {
    color: '#4A8CB3',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.3,
  },
  preSelectedStarCommon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  preSelectedStarCoords: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  preSelectedStarSpectral: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  preSelectedStarSpectralText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '700',
  },
  radarCenterBlipGold: {
    backgroundColor: '#FBBF24',
    shadowColor: '#FBBF24',
  },
  telemetryTextGold: {
    color: '#FBBF24',
  },
});

export default ClaimStarModal;
