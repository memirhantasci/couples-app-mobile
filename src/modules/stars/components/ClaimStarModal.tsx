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
  ActivityIndicator,
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
import * as Haptics from 'expo-haptics';
import {
  Sparkles,
  Compass,
  Award,
  AlertCircle,
  X,
  Radio,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react-native';
import { starService } from '../api/starService';
import type { CoupleStarDetails } from '../types/star.types';

// ============================================================================
// TİPLER VE SABİTLER
// ============================================================================

export type ClaimModalState = 'input' | 'scanning' | 'error' | 'certificate';

export type ClaimStarModalProps =
  | {
      readonly visible: boolean;
      readonly coupleId: number;
      readonly initialStar?: null;
      readonly onClose?: () => void;
      readonly onSuccess: (star: CoupleStarDetails) => void;
    }
  | {
      readonly visible: boolean;
      readonly coupleId: number;
      /** Mevcut tescilli yıldız sertifikasını salt-okunur görüntülemek için (onClose zorunludur) */
      readonly initialStar: CoupleStarDetails;
      readonly onClose: () => void;
      readonly onSuccess?: (star: CoupleStarDetails) => void;
    };

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// RADAR ANİMASYON BİLEŞENİ
// ============================================================================

const CosmicRadarSweep: React.FC<{ isSlowWarning: boolean }> = ({ isSlowWarning }) => {
  const rotation = useSharedValue(0);
  const pulse1 = useSharedValue(0);
  const pulse2 = useSharedValue(0);

  const [telemetry, setTelemetry] = useState({ ra: '184.2140', dec: '+12.4300', mag: '5.20' });

  useEffect(() => {
    // 360 derece sürekli radar süpürmesi (2.4 saniye tam tur)
    rotation.value = withRepeat(
      withTiming(360, { duration: 2400, easing: Easing.linear }),
      -1,
      false
    );

    // Eşmerkezli genişleyen dalga 1
    pulse1.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );

    // Eşmerkezli genişleyen dalga 2 (faz farkıyla)
    const timeout = setTimeout(() => {
      pulse2.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
    }, 1000);

    // Sahte telemetri koordinat kayması
    const telemetryInterval = setInterval(() => {
      setTelemetry({
        ra: (Math.random() * 360).toFixed(4),
        dec: ((Math.random() * 180) - 90).toFixed(4),
        mag: (Math.random() * 5 + 1.5).toFixed(2),
      });
    }, 120);

    return () => {
      clearTimeout(timeout);
      clearInterval(telemetryInterval);
    };
  }, [rotation, pulse1, pulse2]);

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

  return (
    <View style={styles.radarWrapper}>
      {/* Radar Çerçevesi ve Eşmerkezli Halkalar */}
      <View style={styles.radarCircle}>
        <Animated.View style={[styles.radarWave, wave1Style]} />
        <Animated.View style={[styles.radarWave, wave2Style]} />

        <View style={styles.radarRing1} />
        <View style={styles.radarRing2} />
        <View style={styles.radarCrossH} />
        <View style={styles.radarCrossV} />

        {/* Dönen Radar Işını */}
        <Animated.View style={[styles.sweepContainer, radarSweepStyle]}>
          <LinearGradient
            colors={['rgba(56, 189, 248, 0.55)', 'rgba(56, 189, 248, 0)']}
            start={{ x: 1, y: 0.5 }}
            end={{ x: 0, y: 0.5 }}
            style={styles.sweepBeam}
          />
        </Animated.View>

        {/* Merkez Odak Noktası */}
        <View style={styles.radarCenterBlip} />
      </View>

      {/* Telemetri Göstergesi */}
      <View style={styles.telemetryBox}>
        <View style={styles.telemetryRow}>
          <Radio size={12} color="#38BDF8" />
          <Text style={styles.telemetryText}>
            RA: {telemetry.ra}° | DEC: {telemetry.dec}° | MAG: {telemetry.mag}
          </Text>
        </View>
        <Text style={styles.scanningSubText}>
          {isSlowWarning
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
  onClose,
  onSuccess,
}) => {
  const [modalState, setModalState] = useState<ClaimModalState>(
    initialStar ? 'certificate' : 'input'
  );
  const [customName, setCustomName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSlowWarning, setIsSlowWarning] = useState(false);
  const [claimedStar, setClaimedStar] = useState<CoupleStarDetails | null>(
    initialStar ?? null
  );

  const slowWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal açıldığında state'i ayarla (initialStar varsa direkt sertifika aç)
  useEffect(() => {
    if (visible) {
      if (initialStar) {
        setClaimedStar(initialStar);
        setModalState('certificate');
      } else {
        setModalState('input');
        setCustomName('');
        setErrorMessage('');
        setIsSlowWarning(false);
        setClaimedStar(null);
      }
    }
    return () => {
      if (slowWarningTimerRef.current) {
        clearTimeout(slowWarningTimerRef.current);
      }
    };
  }, [visible, initialStar]);

  // Yıldız sahiplenme tetikleyicisi
  const handleStartClaim = async () => {
    const trimmed = customName.trim();
    if (trimmed.length < 2) {
      setErrorMessage('Yıldızınızın ismi en az 2 karakter olmalıdır.');
      return;
    }
    if (trimmed.length > 40) {
      setErrorMessage('Yıldızınızın ismi en fazla 40 karakter olabilir.');
      return;
    }

    setErrorMessage('');
    setModalState('scanning');
    setIsSlowWarning(false);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics desteği yoksa devam et
    }

    // 10 saniye uyarı sayacı
    slowWarningTimerRef.current = setTimeout(() => {
      setIsSlowWarning(true);
    }, 10000);

    // Minimum 1.5s sinematik bekleme garantisi
    const minDelayPromise = new Promise((resolve) => setTimeout(resolve, 1500));
    let resultStar: CoupleStarDetails | null = null;
    let errorOccurred: any = null;

    try {
      resultStar = await starService.claimRandomStar({
        coupleId,
        customName: trimmed,
      });
    } catch (err: any) {
      errorOccurred = err;
    } finally {
      if (slowWarningTimerRef.current) {
        clearTimeout(slowWarningTimerRef.current);
      }
      // Hata olsa da olmasa da en az 1.5s radar döner
      await minDelayPromise;
    }

    if (errorOccurred) {
      setModalState('error');
      setErrorMessage(
        errorOccurred.code === 'P0003'
          ? 'Gökkubbede bu parlaklıkta uygun boşta yıldız bulunamadı. Lütfen tekrar deneyin.'
          : errorOccurred.message || 'Yıldız tescil edilirken kozmik bir parazit oluştu.'
      );
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    } else if (resultStar) {
      setClaimedStar(resultStar);
      setModalState('certificate');
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
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
      <View style={styles.modalBackdrop}>
        <BlurView intensity={Platform.OS === 'ios' ? 70 : 100} tint="dark" style={StyleSheet.absoluteFill} />

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
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color="rgba(255, 255, 255, 0.7)" />
              </TouchableOpacity>
            )}

            {/* ─── DURUM 1: İSİM GİRME FORMU ─── */}
            {modalState === 'input' && (
              <View style={styles.cardContainer}>
                <LinearGradient
                  colors={['rgba(99, 102, 241, 0.15)', 'rgba(168, 85, 247, 0.05)']}
                  style={styles.cardGlowBg}
                />

                <View style={styles.headerIconCircle}>
                  <Sparkles size={28} color="#FBBF24" />
                </View>

                <Text style={styles.modalTitle}>Bizim Yıldızımız</Text>
                <Text style={styles.modalSubtitle}>
                  Gerçek astronomik katalogdan (Gaia & Hipparcos), gökyüzünde gerçek koordinatlara sahip
                  tekil bir yıldızı aşkınız adına tescil edin.
                </Text>

                {/* İSİM GİRDİSİ */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>YILDIZINIZIN İSMİ</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Örn: Sonsuz Aşkımız, Vega & Sirius..."
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    value={customName}
                    onChangeText={(text) => {
                      setCustomName(text);
                      if (errorMessage) setErrorMessage('');
                    }}
                    maxLength={40}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                  <Text style={styles.charCount}>{customName.trim().length} / 40</Text>
                </View>

                {errorMessage ? (
                  <View style={styles.errorBanner}>
                    <AlertCircle size={14} color="#EF4444" />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                {/* SAHİPLEN BUTONU */}
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
                    <Text style={styles.primaryButtonText}>Gökyüzünü Tara & Yıldızımızı Bul ✨</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.footnoteText}>
                  * Tescillenen yıldız dünyada yalnızca sizin çiftinize ait olur ve asla ölmez.
                </Text>
              </View>
            )}

            {/* ─── DURUM 2: SİNEMATİK RADAR TARAMASI ─── */}
            {modalState === 'scanning' && (
              <View style={styles.cardContainer}>
                <Text style={styles.modalTitle}>Gökkubbe Taranıyor</Text>
                <CosmicRadarSweep isSlowWarning={isSlowWarning} />
              </View>
            )}

            {/* ─── DURUM 3: HATA EKRANI ─── */}
            {modalState === 'error' && (
              <View style={styles.cardContainer}>
                <View style={[styles.headerIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <AlertCircle size={32} color="#EF4444" />
                </View>

                <Text style={styles.modalTitle}>Kozmik Bağlantı Kesintisi</Text>
                <Text style={styles.modalSubtitle}>{errorMessage}</Text>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleStartClaim}
                  style={styles.primaryButton}
                >
                  <LinearGradient
                    colors={['#4F46E5', '#7C3AED']}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.primaryButtonText}>Tekrar Dene</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}

            {/* ─── DURUM 4: TESCİL SERTİFİKASI ─── */}
            {modalState === 'certificate' && claimedStar && (
              <View style={[styles.cardContainer, styles.certificateContainer]}>
                {/* Altın Işıltı Gradyanı */}
                <LinearGradient
                  colors={['rgba(251, 191, 36, 0.18)', 'rgba(124, 58, 237, 0.08)']}
                  style={styles.cardGlowBg}
                />

                <View style={styles.certBadge}>
                  <Award size={20} color="#F59E0B" />
                  <Text style={styles.certBadgeText}>GÖKSEL TESCİL SERTİFİKASI</Text>
                </View>

                <Text style={styles.certStarName}>{claimedStar.custom_name}</Text>
                <Text style={styles.certSubText}>
                  Aşkınızın Işığı Evrende Sonsuza Kadar Parlamak Üzere Tescillendi
                </Text>

                {/* ASTRONOMİK KÜNYE TABLOSU */}
                <View style={styles.certInfoGrid}>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>KATALOG KODU</Text>
                    <Text style={styles.gridValueHighlight}>{claimedStar.catalog_code}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>TAYF SINIFI</Text>
                    <Text style={styles.gridValue}>{claimedStar.spectral_type}</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>RIGHT ASCENSION</Text>
                    <Text style={styles.gridValue}>{Number(claimedStar.ra).toFixed(4)}°</Text>
                  </View>
                  <View style={styles.gridItem}>
                    <Text style={styles.gridLabel}>DECLINATION</Text>
                    <Text style={styles.gridValue}>
                      {Number(claimedStar.dec) >= 0 ? '+' : ''}{Number(claimedStar.dec).toFixed(4)}°
                    </Text>
                  </View>
                </View>

                {/* İLK IŞIK BİLGİLENDİRMESİ */}
                <View style={styles.firstSparkNote}>
                  <CheckCircle2 size={16} color="#10B981" />
                  <Text style={styles.firstSparkText}>
                    Bugünkü İlk Işığınız Göğe Yükseldi! Yıldızınız %100 parlaklıkla parlıyor.
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
});

export default ClaimStarModal;
