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

import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
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
} from 'react-native-reanimated';
import { hapticStamp, hapticSuccess, hapticError } from '@/lib/soundEffects';
import {
  Sparkles,
  Award,
  AlertCircle,
  Radio,
  CheckCircle2,
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { starService } from '../api/starService';
import { moderateStarName } from '../utils/nameModeration';
import { computeOwnCoupleInitials } from '../utils/ownerInitials';
import type { CoupleStarDetails, ViewportStarItem } from '../types/star.types';
import { SKY_SECTORS, type SectorConfig } from '../config/skySectors.data';

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
  readonly onSuccess?: (star: CoupleStarDetails) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// RADAR ANİMASYON BİLEŞENİ
// ============================================================================

const CosmicRadarSweep: React.FC<{ isSlowWarning: boolean; isConfirming?: boolean; confirmedRa?: number; confirmedDec?: number }> = ({
  isSlowWarning,
  isConfirming = false,
  confirmedRa,
  confirmedDec,
}) => {
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
      };
    }

    return () => {
      clearTimeout(timeout);
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
              isConfirming ? 'rgba(251, 191, 36, 0.55)' : isLight ? 'rgba(2, 132, 199, 0.55)' : 'rgba(56, 189, 248, 0.55)',
              isConfirming ? 'rgba(251, 191, 36, 0)' : isLight ? 'rgba(2, 132, 199, 0)' : 'rgba(56, 189, 248, 0)',
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
          <Radio size={12} color={isConfirming ? '#FBBF24' : isLight ? '#0284C7' : '#38BDF8'} />
          <Text style={[styles.telemetryText, isConfirming && styles.telemetryTextGold, isLight && !isConfirming && { color: '#0284C7' }]}>
            RA: {displayRa}° | DEC: {displayDec}°
          </Text>
        </View>
        <Text style={[styles.scanningSubText, { color: theme.textMuted }]}>
          {isConfirming
            ? 'Yıldızınız evrene kazınıyor...'
            : isSlowWarning
            ? 'Kozmik sinyal taranıyor, derin uzay katalogları inceleniyor...'
            : 'Gaia DR3 ve Hipparcos kataloğunda boşta duran yıldızlar taranıyor...'}
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
  onSuccess,
}) => {
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

  // preSelectedStar varken scanning süresi kısaltılır (0.8s vs 1.5s)
  const isSpecificMode = preSelectedStar != null;
  const isSectorMode = preSelectedSectorId != null && !isSpecificMode;
  const sectorConfig: SectorConfig | undefined = isSectorMode
    ? SKY_SECTORS[preSelectedSectorId]
    : undefined;

  const slowWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal açıldığında state'i senkronize et (initialStar varsa direkt sertifika aç)
  const [prevProps, setPrevProps] = useState({ visible, initialStar });
  if (visible !== prevProps.visible || initialStar !== prevProps.initialStar) {
    setPrevProps({ visible, initialStar });
    if (visible) {
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
  }

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
      setErrorMessage('Yıldızınızın ismi en az 2 karakter olmalıdır.');
      return;
    }
    if (trimmed.length > 40) {
      setErrorMessage('Yıldızınızın ismi en fazla 40 karakter olabilir.');
      return;
    }

    const modResult = moderateStarName(trimmed);
    if (!modResult.isValid) {
      setErrorMessage(modResult.message || 'Yıldız ismi topluluk kurallarına aykırı kelimeler içeremez.');
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
          ? 'Bu yıldız az önce başka bir çift tarafından seçildi, lütfen başka bir yıldız seçin.'
          : isAlreadyOwnedErr
          ? 'Zaten bir yıldızınız var — her çift yalnızca bir yıldıza sahip olabilir.'
          : errCode === 'P0003'
          ? 'Gökkubbede bu parlaklıkta uygun boşta yıldız bulunamadı. Lütfen tekrar deneyin.'
          : errorOccurred.message || 'Yıldız tescil edilirken kozmik bir parazit oluştu.'
      );
      await hapticError();
    } else if (resultStar) {
      setClaimedStar(resultStar);
      setModalState('certificate');
      await hapticSuccess();
    }
  };

  const handleFinish = () => {
    if (claimedStar) {
      onSuccess?.(claimedStar);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={modalState === 'scanning' ? undefined : onClose}
    >
      <View style={[styles.modalBackdrop, { backgroundColor: isLight ? 'rgba(0, 0, 0, 0.55)' : 'rgba(3, 2, 7, 0.88)' }]}>
        <BlurView intensity={Platform.OS === 'ios' ? 70 : 100} tint={isLight ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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

                <Text style={[styles.modalTitle, { color: theme.text }]}>Bizim Yıldızımız</Text>

                {/* Seçili yıldız önizleme kartı (preSelectedStar varsa) */}
                {preSelectedStar ? (
                  <View
                    style={[
                      styles.preSelectedStarCard,
                      {
                        backgroundColor: isLight ? theme.unitBg : 'rgba(56, 189, 248, 0.08)',
                        borderColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(56, 189, 248, 0.25)',
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
                        RA {Number(preSelectedStar.ra).toFixed(2)}° / DEC {Number(preSelectedStar.dec) >= 0 ? '+' : ''}{Number(preSelectedStar.dec).toFixed(2)}° • {preSelectedStar.magnitude} mag
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
                        {sectorConfig.name}
                      </Text>
                      <Text style={[styles.preSelectedStarCommon, { color: theme.text }]}>
                        {sectorConfig.latinName} • {sectorConfig.code3}
                      </Text>
                      <Text style={[styles.preSelectedStarCoords, { color: theme.textMuted }]}>
                        {sectorConfig.description}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                    Gerçek astronomik katalogdan (Gaia &amp; Hipparcos), gökyüzünde gerçek koordinatlara sahip
                    tekil bir yıldızı aşkınız adına tescil edin.
                  </Text>
                )}

                {/* İSİM GİRDİSİ */}
                <View style={styles.inputWrapper}>
                  <Text style={[styles.inputLabel, { color: theme.textMuted }]}>YILDIZINIZIN İSMİ</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: isLight ? theme.inputBg : 'rgba(255, 255, 255, 0.06)',
                        borderColor: isLight ? theme.inputBorder : 'rgba(255, 255, 255, 0.16)',
                        color: theme.text,
                      },
                    ]}
                    placeholder="Örn: Sonsuz Aşkımız, Vega & Sirius..."
                    placeholderTextColor={isLight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.3)'}
                    value={customName}
                    onChangeText={(text) => {
                      setCustomName(text);
                      if (errorMessage) setErrorMessage('');
                    }}
                    maxLength={40}
                    autoCapitalize="words"
                    autoCorrect={false}
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
                        ? 'Bu Yıldızı Tescille ✨'
                        : isSectorMode
                        ? `${sectorConfig?.name ?? 'Sektör'}'den Yıldız Bul ✨`
                        : 'Gökyüzünü Tara & Yıldızımızı Bul ✨'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={[styles.footnoteText, { color: theme.textMuted }]}>
                  * Tescillenen yıldız dünyada yalnızca sizin çiftinize ait olur ve asla ölmez.
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
                  {isSpecificMode ? 'Tescil Ediliyor' : 'Gökkubbe Taranıyor'}
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

                <Text style={[styles.modalTitle, { color: theme.text }]}>Kozmik Bağlantı Kesintisi</Text>
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
                      <Text style={styles.primaryButtonText}>Kapat</Text>
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
                        {isSpecificMode ? 'Başka Yıldız Seç' : 'Tekrar Dene'}
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
                  {
                    backgroundColor: isLight ? '#FFFFFF' : theme.cardBg,
                    borderColor: isLight ? 'rgba(217, 119, 6, 0.5)' : 'rgba(251, 191, 36, 0.4)',
                    shadowColor: isLight ? '#D97706' : '#F59E0B',
                  },
                ]}
              >
                {/* Altın Işıltı Gradyanı */}
                <LinearGradient
                  colors={isLight ? ['rgba(245, 158, 11, 0.08)', 'rgba(217, 119, 6, 0.02)'] : ['rgba(251, 191, 36, 0.18)', 'rgba(124, 58, 237, 0.08)']}
                  style={styles.cardGlowBg}
                />

                <View
                  style={[
                    styles.certBadge,
                    {
                      backgroundColor: isLight ? 'rgba(245, 158, 11, 0.12)' : 'rgba(251, 191, 36, 0.15)',
                      borderColor: isLight ? 'rgba(217, 119, 6, 0.35)' : 'rgba(251, 191, 36, 0.4)',
                    },
                  ]}
                >
                  <Award size={20} color={isLight ? '#D97706' : '#F59E0B'} />
                  <Text style={[styles.certBadgeText, { color: isLight ? '#B45309' : '#FBBF24' }]}>GÖKSEL TESCİL SERTİFİKASI</Text>
                </View>

                <Text style={[styles.certStarName, { color: theme.text }]}>{claimedStar.custom_name}</Text>
                {/* Gerçek astronomi adı — yalnızca doluysa göster */}
                {claimedStar.common_name ? (
                  <Text style={[styles.certCommonName, { color: theme.textSecondary }]}>({claimedStar.common_name})</Text>
                ) : null}
                <Text style={[styles.certSubText, { color: theme.textMuted }]}>
                  Aşkınızın Işığı Evrende Sonsuza Kadar Parlamak Üzere Tescillendi
                </Text>

                {/* ASTRONOMİK KÜNYE TABLOSU */}
                <View style={styles.certInfoGrid}>
                  <View style={[styles.gridItem, { backgroundColor: isLight ? theme.unitBg : 'rgba(255, 255, 255, 0.05)', borderColor: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.1)' }]}>
                    <Text style={[styles.gridLabel, { color: theme.textMuted }]}>KATALOG KODU</Text>
                    <Text style={[styles.gridValueHighlight, { color: isLight ? '#D97706' : '#38BDF8' }]}>{claimedStar.catalog_code}</Text>
                  </View>
                  <View style={[styles.gridItem, { backgroundColor: isLight ? theme.unitBg : 'rgba(255, 255, 255, 0.05)', borderColor: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.1)' }]}>
                    <Text style={[styles.gridLabel, { color: theme.textMuted }]}>TAYF SINIFI</Text>
                    <Text style={[styles.gridValue, { color: theme.text }]}>{claimedStar.spectral_type}</Text>
                  </View>
                  <View style={[styles.gridItem, { backgroundColor: isLight ? theme.unitBg : 'rgba(255, 255, 255, 0.05)', borderColor: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.1)' }]}>
                    <Text style={[styles.gridLabel, { color: theme.textMuted }]}>RIGHT ASCENSION</Text>
                    <Text style={[styles.gridValue, { color: theme.text }]}>{Number(claimedStar.ra).toFixed(4)}°</Text>
                  </View>
                  <View style={[styles.gridItem, { backgroundColor: isLight ? theme.unitBg : 'rgba(255, 255, 255, 0.05)', borderColor: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.1)' }]}>
                    <Text style={[styles.gridLabel, { color: theme.textMuted }]}>DECLINATION</Text>
                    <Text style={[styles.gridValue, { color: theme.text }]}>
                      {Number(claimedStar.dec) >= 0 ? '+' : ''}{Number(claimedStar.dec).toFixed(4)}°
                    </Text>
                  </View>
                </View>

                {/* İLK IŞIK BİLGİLENDİRMESİ */}
                <View style={[styles.firstSparkNote, { backgroundColor: isLight ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.12)', borderColor: isLight ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.3)' }]}>
                  <CheckCircle2 size={16} color="#10B981" />
                  <Text style={[styles.firstSparkText, { color: isLight ? '#065F46' : '#A7F3D0' }]}>
                    Yıldızınız gökyüzünde! Birlikte paylaştığınız her anı onu daha da parlatacak.
                  </Text>
                </View>

                {/* MİKRO SİSTEME ADIM AT VEYA SERTİFİKAYI KAPAT BUTONU */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={initialStar ? (onClose ?? (() => {})) : handleFinish}
                  style={styles.primaryButton}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#D97706', '#B45309']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.primaryButtonText}>
                      {initialStar ? 'Sertifikayı Kapat ✨' : 'Mikro Evrenimize Adım At 🚀'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
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
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  certificateContainer: {
    borderColor: 'rgba(251, 191, 36, 0.4)',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.35,
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
    shadowOpacity: 0.4,
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
    borderColor: 'rgba(56, 189, 248, 0.35)',
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
    borderColor: '#38BDF8',
  },
  radarRing1: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    borderStyle: 'dashed',
  },
  radarRing2: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  radarCrossH: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  radarCrossV: {
    position: 'absolute',
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
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
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.9,
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
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  telemetryText: {
    color: '#38BDF8',
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
  certBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    marginBottom: 12,
  },
  certBadgeText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  certStarName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  certSubText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 17,
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
  gridValueHighlight: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 14,
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
    color: '#38BDF8',
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
