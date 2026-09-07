/**
 * @file OurStarScreen.tsx
 * @module modules/stars/components
 * @description "Bizim Yıldızımız" modülü master ekran konteyneri.
 *
 * Sorumluluklar:
 * 1. Yıldız Sahipliği Denetimi: Yıldız yoksa ClaimStarModal açar, varsa MicroSystemCanvas başlatır.
 * 2. Focus vs. Realtime Çakışma Önleme (LWW 5000ms pencere kuralı):
 *    Partner sinyalleri anlık işlenir; useFocusEffect arkada sessizce veriyi tazelerken
 *    taze realtime kıvılcımlarını ezmez.
 * 3. Canlı İstemci Sayacı ve İlk Tescil Rozeti:
 *    Cooldown aktifse buton "Bugünkü İlk Işığınız Göğe Yükseldi ✨" rozetine ve canlı sayaca dönüşür.
 * 4. Etkileşim ve Kıvılcım / Ping Yönetimi:
 *    Yıldıza dokunulduğunda yerel haptik + StarSparkManager (günlük hak varsa spark, yoksa love ping).
 * 5. Realtime Işıma Dalgası:
 *    Partner kıvılcım yolladığında ekranda yumuşak 1.8s altın/cyan kozmik ışıma dalgası patlar.
 * 6. Makro / Mikro Görünüm Geçişi:
 *    Sağ alttaki FAB ile Gök Kubbe (MacroSkyCanvas) ve Mikro Sistem arasında pürüzsüz geçiş.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Orbit,
  Globe,
  Plus,
  Share2,
  Zap,
  Clock,
  ArrowLeft,
  Sparkles,
  X,
  AlertCircle,
  Radio,
  Search,
} from 'lucide-react-native';

import { useAuth } from '@/context/AuthContext';
import { DEMO_STAR_DETAILS, DEMO_STAR_EXOPLANETS } from '@/constants/demoData';
import { starService, SparkCooldownException } from '../api/starService';
import { StarSparkManager } from '../services/StarSparkManager';
import { MicroSystemCanvas } from '../canvas/MicroSystemCanvas';
import { MacroSkyCanvas, MacroSkyBounds } from '../canvas/MacroSkyCanvas';
import { StarInfoBadge } from './StarInfoBadge';
import { ClaimStarModal } from './ClaimStarModal';
import { StarDemoAuthModal } from './StarDemoAuthModal';
import { ExoplanetModal } from './ExoplanetModal';
import { StarConnectionModal, StarConnectionsModal } from './StarConnectionModal';
import { ConnectionRequestBadge } from './ConnectionRequestBadge';
import { SectorHUD } from './SectorHUD';
import { SectorAtlasModal } from './SectorAtlasModal';
import { SearchStarModal } from './SearchStarModal';

import type {
  ActiveStarConnection,
  PendingConnectionDetail,
  CoupleStarDetails,
  FlyToTarget,
  StarExoplanetRecord,
  ViewportStarItem,
  SparkBroadcastPayload,
  ResonanceEvent,
} from '../types/star.types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Realtime güncellemeleri koruma penceresi (5 saniye)
const REALTIME_RECONCILIATION_WINDOW_MS = 5000;

export const OurStarScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, session, isDemoMode } = useAuth();
  const coupleId = profile?.coupleId ?? null;
  const currentUserId = session?.user?.id ?? '';
  const currentUserName = profile?.displayName || profile?.username || 'Partner';

  // ─── TEMEL DURUMLAR (STATE) ────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'micro' | 'macro'>('micro');
  const [starDetails, setStarDetails] = useState<CoupleStarDetails | null>(null);
  const [exoplanets, setExoplanets] = useState<StarExoplanetRecord[]>([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [viewportStars, setViewportStars] = useState<ViewportStarItem[]>([]);
  const [selectedMacroStar, setSelectedMacroStar] = useState<ViewportStarItem | null>(null);

  // Güvenli Geri Dönüş Fonksiyonu (Navigation Stack boşsa ana ekrana döner)
  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home');
    }
  }, [router]);

  // Realtime & Rezonans State
  const [luminosityOverride, setLuminosityOverride] = useState<number | undefined>(undefined);
  const [isResonanceActive, setIsResonanceActive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Canlı Geri Sayım Sayacı (Saniye)
  const [liveCooldownSec, setLiveCooldownSec] = useState<number>(0);

  // Modallar
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimTargetStar, setClaimTargetStar] = useState<ViewportStarItem | null>(null);
  const [isDemoAuthModalOpen, setIsDemoAuthModalOpen] = useState(false);
  const [demoTargetStar, setDemoTargetStar] = useState<ViewportStarItem | null>(null);
  const [exoplanetModalMode, setExoplanetModalMode] = useState<'view' | 'edit' | 'create' | null>(null);
  const [selectedPlanet, setSelectedPlanet] = useState<StarExoplanetRecord | null>(null);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState(false);

  // Yıldız bağlantıları (canvas takımyıldızı çizgileri için)
  const [starConnections, setStarConnections] = useState<ActiveStarConnection[]>([]);
  // Bekleyen bağlantı istekleri listesi
  const [pendingRequests, setPendingRequests] = useState<PendingConnectionDetail[]>([]);
  // Gelen bekleyen isteklerin sayısı (Kozmik Bağlar butonu üzerindeki bildirim rozeti için)
  const [pendingIncomingCount, setPendingIncomingCount] = useState<number>(0);
  // Gökyüzünde seçilen yıldıza istek gönderme yükleniyor durumu
  const [isConnectingStar, setIsConnectingStar] = useState<boolean>(false);

  // ─── AŞAMA 6: SEKTÖR DURUMU ────────────────────────────────────
  const [isAtlasModalOpen, setIsAtlasModalOpen] = useState(false);
  const [claimSectorId, setClaimSectorId] = useState<string | null>(null);
  const [cameraRa, setCameraRa] = useState(180);
  const [cameraDec, setCameraDec] = useState(0);
  const [flyToTarget, setFlyToTarget] = useState<FlyToTarget | undefined>(undefined);
  const [showInstructionBanner, setShowInstructionBanner] = useState(true);


  // ─── REFERANSLAR (LWW & MANAGER) ───────────────────────────────────
  const sparkManagerRef = useRef<StarSparkManager | null>(null);
  const lastRealtimeSparkAtRef = useRef<number>(0);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── IŞIMA DALGASI ANİMASYONU ──────────────────────────────────────
  const glowWaveOpacity = useSharedValue(0);

  const triggerGlowWave = () => {
    glowWaveOpacity.value = withSequence(
      withTiming(0.5, { duration: 350, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 1450, easing: Easing.in(Easing.cubic) })
    );
  };

  const glowWaveStyle = useAnimatedStyle(() => ({
    opacity: glowWaveOpacity.value,
  }));

  // Toast Bildirimi Gösterici
  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3800);
  }, []);

  // ─── CANLI COOLDOWN SAYACI (TICKER) ────────────────────────────────
  useEffect(() => {
    if (liveCooldownSec <= 0) return;

    const timer = setInterval(() => {
      setLiveCooldownSec((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [liveCooldownSec]);

  // Saniyeyi HH:MM:SS formatına çevirici
  const formatCooldownTime = (totalSec: number): string => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // ─── VERİ YÜKLEME VE RECONCILIATION ────────────────────────────────
  const loadStarData = useCallback(
    async (isSilent: boolean = false) => {
      // 0. Demo Modu: Misafir kullanıcı için zengin örnek yıldız verisi
      if (isDemoMode) {
        setStarDetails(DEMO_STAR_DETAILS);
        setExoplanets(DEMO_STAR_EXOPLANETS);
        setLuminosityOverride(DEMO_STAR_DETAILS.luminosity_level);
        setIsResonanceActive(DEMO_STAR_DETAILS.resonance_active);
        setLiveCooldownSec(DEMO_STAR_DETAILS.cooldown_remaining_seconds || 0);
        setIsLoading(false);
        return;
      }

      if (!coupleId) {
        setStarDetails(null);
        setIsLoading(false);
        // Otomatik modal açma: kullanıcı macro kanvasta yıldız seçerek akışı başlatır
        setViewMode('macro');
        return;
      }

      if (!isSilent) {
        setIsLoading(true);
      }

      try {
        const details = await starService.getMyStarDetails(coupleId);
        if (!details) {
          setStarDetails(null);
          setViewMode('macro');
          setIsClaimModalOpen(true);
          return;
        }

        // LWW (Last-Write-Wins) State Reconciliation:
        // Son 5 saniye içinde taze realtime kıvılcımı geldiyse, HTTP cevabı bu parlaklığı ezemez.
        const now = Date.now();
        const isRecentRealtime = now - lastRealtimeSparkAtRef.current < REALTIME_RECONCILIATION_WINDOW_MS;

        setStarDetails((prev) => {
          if (isRecentRealtime && prev) {
            return {
              ...details,
              luminosity_level: prev.luminosity_level,
              resonance_active: prev.resonance_active,
            };
          }
          return details;
        });

        if (!isRecentRealtime) {
          setLuminosityOverride(details.luminosity_level);
          setIsResonanceActive(details.resonance_active);
        }
        setLiveCooldownSec(details.cooldown_remaining_seconds || 0);

        // Anı ötegezegenlerini çek
        const planets = await starService.getStarExoplanets(details.star_id);
        setExoplanets(planets);

        // Aktif bağlantıları ve bekleyen istekleri çek
        const [connections, pending] = await Promise.all([
          starService.getMyStarConnections(),
          starService.getPendingConnections(),
        ]);
        setStarConnections(connections);
        setPendingRequests(pending);
        setPendingIncomingCount(pending.filter((p) => p.is_incoming).length);
      } catch {
        // Yıldız henüz tescilli değilse macro kanvasa yönlendir (otomatik modal yok)
        setStarDetails(null);
        setViewMode('macro');
      } finally {
        if (!isSilent) {
          setIsLoading(false);
        }
      }
    },
    [coupleId, isDemoMode]
  );

  const isInitialMountRef = useRef(true);

  // Ekran Her Focus Olduğunda Sessizce (ilk açılışta loading ile) Tazele
  useFocusEffect(
    useCallback(() => {
      const isInitial = isInitialMountRef.current;
      isInitialMountRef.current = false;
      loadStarData(!isInitial);
    }, [loadStarData])
  );

  const currentStarId = starDetails?.star_id;
  const currentStarLum = starDetails?.luminosity_level;

  // ─── REALTIME RESONANCE & SPARK SUBSCRIPTION ────────────────────────
  // StarSparkManager Realtime WebSocket kanalı yalnızca yıldız veya kullanıcı
  // kimliği değiştiğinde yeniden kurulur. Canlı parlaklık güncellemeleri aşağıdaki
  // ayrı effect tarafından WebSocket koparılmadan güncellenir.
  useEffect(() => {
    if (!currentStarId) return;

    const manager = new StarSparkManager({
      starId: currentStarId,
      senderId: currentUserId,
      senderName: currentUserName,
      initialLuminosity: currentStarLum,
    });
    sparkManagerRef.current = manager;

    manager.subscribeToResonance({
      onPartnerSpark: (spark: SparkBroadcastPayload) => {
        lastRealtimeSparkAtRef.current = Date.now();

        // Anlık Işıma ve Haptic
        triggerGlowWave();
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}

        // Parlaklığı anında güncelle
        setLuminosityOverride(spark.newLuminosity);
        setStarDetails((prev) =>
          prev ? { ...prev, luminosity_level: spark.newLuminosity } : null
        );

        // Toast Bildirimi
        const partnerTitle = spark.senderName || 'Sevgilin';
        if (spark.sparkType === 'daily_spark') {
          showToast(`${partnerTitle} yıldızınıza günlük ışığını gönderdi! ✨`);
        } else {
          showToast(`${partnerTitle} yıldızınıza dokunarak sevgi titreşimi gönderdi! 💫`);
        }
      },
      onResonanceChange: (event: ResonanceEvent) => {
        setIsResonanceActive(event.active);
        setStarDetails((prev) => (prev ? { ...prev, resonance_active: event.active } : null));
        if (event.active) {
          showToast('Eşzamanlı rezonans başladı! Yıldızınız çift korona ile parlıyor 🌌');
        }
      },
    });

    return () => {
      manager.unsubscribe();
      sparkManagerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStarId, currentUserId, currentUserName, showToast]);

  // Canlı parlaklık değiştiğinde manager'ın iç değerini güncelle
  useEffect(() => {
    if (sparkManagerRef.current && currentStarLum != null) {
      sparkManagerRef.current.setLuminosity(currentStarLum);
    }
  }, [currentStarLum]);

  // ─── MERKEZ YILDIZA DOKUNMA & KIVILCIM / PING YÖNETİMİ ──────────────
  const handleCenterStarTouch = async () => {
    if (isDemoMode) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {}
      triggerGlowWave();
      setLuminosityOverride(1.0);
      setIsResonanceActive(true);
      if (liveCooldownSec <= 0) {
        setLiveCooldownSec(72000);
        showToast('Bugünkü ışığınız göğe yükseldi! Yıldızınız parladı ✨');
      } else {
        showToast('Yıldıza dokundun; sevgi titreşimi eşine iletildi 💫');
      }
      return;
    }

    if (!starDetails || !sparkManagerRef.current) return;

    // 1. Günlük hak varsa Daily Spark dene
    if (liveCooldownSec <= 0) {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        triggerGlowWave();

        const updated = await sparkManagerRef.current.triggerDailySpark();
        setStarDetails(updated);
        setLuminosityOverride(updated.luminosity_level);
        setLiveCooldownSec(updated.cooldown_remaining_seconds || 72000); // 20 saat
        showToast('Bugünkü ışığınız göğe yükseldi! Yıldızınız parladı ✨');
      } catch (err: any) {
        // P0001 cooldown hatası yakalanırsa sessizce yerel süreyi güncelle ve Love Ping'e düş
        if (err instanceof SparkCooldownException || err?.code === 'P0001') {
          const remaining = err.remainingSeconds || 72000;
          setLiveCooldownSec(remaining);
          // Sessiz Love Ping Fallback
          sparkManagerRef.current.queueLovePing().catch(() => {});
          showToast('Günlük ışık kotası dolu, sevgi titreşimi iletildi 💫');
        } else {
          showToast('Kıvılcım gönderilemedi, lütfen tekrar deneyin.');
        }
      }
    } else {
      // 2. Cooldown aktifse: Anında Love Ping
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
      triggerGlowWave();
      sparkManagerRef.current.queueLovePing().catch(() => {});
      showToast('Yıldıza dokundun; sevgi titreşimi eşine iletildi 💫');
    }
  };

  // ─── MAKRO GÖKYÜZÜ VIEWPORT GÜNCELLEMESİ ────────────────────────────
  const handleMacroBoundsChange = useCallback(async (bounds: MacroSkyBounds) => {
    try {
      const stars = await starService.fetchStarsInViewport({
        minRa: bounds.minRa,
        maxRa: bounds.maxRa,
        minDec: bounds.minDec,
        maxDec: bounds.maxDec,
        zoomLevel: bounds.zoomLevel,
      });
      setViewportStars(stars);
    } catch {
      // Sessiz geç
    }
  }, []);

  // ─── TESCİL BAŞARISI (Claim Callback) ──────────────────────────────
  const handleClaimSuccess = (claimed: CoupleStarDetails) => {
    setStarDetails(claimed);
    setLuminosityOverride(claimed.luminosity_level);
    setLiveCooldownSec(claimed.cooldown_remaining_seconds || 72000);
    setIsClaimModalOpen(false);
    setViewMode('micro');
    // Anı gezegenlerini sıfırdan çek
    loadStarData(true);
    showToast('Yıldızınız gökyüzüne tescillendi! Hoş geldiniz ✨');
  };

  // ─── ANİ GEZEGENİ HANDLER'LARI ─────────────────────────────────────
  const handlePlanetCreated = (newPlanet: StarExoplanetRecord) => {
    setExoplanets((prev) => [newPlanet, ...prev]);
    showToast(`"${newPlanet.title}" anı gezegeni yörüngede dönmeye başladı! 🪐`);
  };

  const handlePlanetUpdated = (updatedPlanet: StarExoplanetRecord) => {
    setExoplanets((prev) =>
      prev.map((p) => (p.id === updatedPlanet.id ? updatedPlanet : p))
    );
    setSelectedPlanet(updatedPlanet);
    showToast(`"${updatedPlanet.title}" gezegeni güncellendi! ✨`);
  };

  const handlePlanetDeleted = (planetId: string) => {
    setExoplanets((prev) => prev.filter((p) => p.id !== planetId));
    setSelectedPlanet(null);
    showToast('Anı gezegeni yörüngeden kaldırıldı.');
  };

  // ─── GÖKYÜZÜNDE SEÇİLEN YILDIZA BAĞLANTI İSTEĞİ GÖNDER ───────────────
  const handleConnectSelectedMacroStar = async () => {
    if (!selectedMacroStar || !starDetails) return;
    if (starConnections.length >= 3) {
      showToast('Maksimum 3 bağlantı limitine ulaştınız (3/3).');
      return;
    }
    setIsConnectingStar(true);
    try {
      const targetStarId = await starService.getStarIdByCatalogId(selectedMacroStar.catalog_id);
      if (!targetStarId) {
        showToast('Hedef yıldız bilgisi alınamadı.');
        return;
      }
      await starService.requestStarConnection(targetStarId);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      showToast(
        `"${selectedMacroStar.custom_name || selectedMacroStar.catalog_code}" yıldızına bağlantı isteği gönderildi ✨`
      );
      const [connections, pending] = await Promise.all([
        starService.getMyStarConnections(),
        starService.getPendingConnections(),
      ]);
      setStarConnections(connections);
      setPendingRequests(pending);
      setPendingIncomingCount(pending.filter((p) => p.is_incoming).length);
    } catch (err: any) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      showToast(err?.message || 'Bağlantı isteği gönderilemedi.');
    } finally {
      setIsConnectingStar(false);
    }
  };

  // ─── YÜKLENİYOR EKRANI ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator size="large" color="#38BDF8" />
        <Text style={styles.loadingText}>Kozmik Harita Yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ─── REALTIME IŞIMA DALGASI (GLOW WAVE OVERLAY) ─────────────── */}
      <Animated.View style={[styles.glowWaveOverlay, glowWaveStyle]} pointerEvents="none">
        <LinearGradient
          colors={['rgba(245, 158, 11, 0.45)', 'rgba(56, 189, 248, 0.25)', 'transparent']}
          start={{ x: 0.5, y: 0.4 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ─── TOAST BİLDİRİM BANNERI ──────────────────────────────────── */}
      {toastMessage && (
        <View style={[styles.toastContainer, { top: insets.top + 74 }]}>
          <View style={styles.toastInner}>
            <Sparkles size={14} color="#F59E0B" />
            <Text style={styles.toastText} numberOfLines={2}>
              {toastMessage}
            </Text>
          </View>
        </View>
      )}

      {/* ─── ÜST HUD BAR: GERİ DÖN, STAR INFO BADGE VE KOZMİK BAĞLAR ─── */}
      <View style={[styles.hudTopBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Geri Dön"
        >
          <ArrowLeft size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.badgeWrapper}>
          {starDetails ? (
            <StarInfoBadge
              starDetails={starDetails}
              luminosityOverride={luminosityOverride}
              isResonanceActive={isResonanceActive}
              viewMode={viewMode}
              onPressCertificate={() => setIsCertificateModalOpen(true)}
            />
          ) : viewMode === 'macro' ? (
            <SectorHUD
              centerRa={cameraRa}
              centerDec={cameraDec}
              onPress={() => setIsAtlasModalOpen(true)}
              embedded
            />
          ) : null}
        </View>

        <View style={styles.topRightActions}>
          {/* Gelen Bağlantı İstekleri Rozeti */}
          {starDetails && !isDemoMode && (
            <ConnectionRequestBadge
              pendingRequests={pendingRequests}
              onConnectionChanged={() => {
                Promise.all([
                  starService.getMyStarConnections(),
                  starService.getPendingConnections(),
                ])
                  .then(([connections, pending]) => {
                    setStarConnections(connections);
                    setPendingRequests(pending);
                    setPendingIncomingCount(pending.filter((p) => p.is_incoming).length);
                  })
                  .catch(() => {});
              }}
            />
          )}

          {/* KOZMİK BAĞLAR BUTONU — yalnızca tescilli yıldız varsa göster */}
          {starDetails && !isDemoMode && (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => setIsConnectionsModalOpen(true)}
              style={styles.cosmicBagBtn}
              accessibilityLabel="Kozmik Bağlar"
            >
              <Share2 size={16} color="#EC4899" />
              {pendingIncomingCount > 0 && (
                <View style={styles.cosmicBagBadge}>
                  <Text style={styles.cosmicBagBadgeText}>{pendingIncomingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => setIsSearchModalOpen(true)}
            style={styles.cosmicBagBtn}
            accessibilityLabel="Yıldız Ara"
          >
            <Search size={16} color="#38BDF8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── ANA CANVAS SAHNESİ: MİKRO VEYA MAKRO ───────────────────── */}
      <View style={styles.canvasContainer}>
        {viewMode === 'micro' && starDetails ? (
          <MicroSystemCanvas
            starDetails={starDetails}
            exoplanets={exoplanets}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            onSelectCenterStar={handleCenterStarTouch}
            onSelectPlanet={(planet) => {
              setSelectedPlanet(planet);
              setExoplanetModalMode('view');
            }}
          />
        ) : (
          <MacroSkyCanvas
            stars={viewportStars}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            connections={starConnections}
            myStarCoords={
              starDetails
                ? { ra: Number(starDetails.ra), dec: Number(starDetails.dec) }
                : undefined
            }
            initialCamera={{
              centerRa: starDetails ? Number(starDetails.ra) : 180,
              centerDec: starDetails ? Number(starDetails.dec) : 0,
              zoom: 1.2,
            }}
            targetCamera={flyToTarget}
            onBoundsChange={handleMacroBoundsChange}
            onCameraChange={(cam) => {
              setCameraRa(cam.centerRa);
              setCameraDec(cam.centerDec);
            }}
            onSelectStar={(star) => {
              if (isDemoMode) {
                // Demo / misafir modu: ClaimStarModal (radar/sertifika) AÇILMAZ!
                if (star.is_claimed) {
                  // Tescilli yabancı yıldız: sadece bilgi kartı
                  setSelectedMacroStar(star);
                } else {
                  // Boşta olan yıldıza tıklandı: Yönlendirme kartını aç
                  setDemoTargetStar(star);
                  setSelectedMacroStar(null);
                  setIsDemoAuthModalOpen(true);
                }
                return;
              }

              if (star.is_mine) {
                // Kendi yıldızı: mikro sisteme dön
                setViewMode('micro');
                setSelectedMacroStar(null);
                showToast(`"${starDetails?.custom_name || star.custom_name}" mikro sistemine girildi 🪐`);
              } else if (star.is_claimed) {
                // Başka çiftin tescilli yıldızı: bilgi kartı, sahiplenme YOK
                setSelectedMacroStar(star);
              } else if (starDetails !== null) {
                // Kullanıcının zaten yıldızı var, boş yıldıza tıklandı:
                // Bilgi kartını aç (yıldız detaylarını inceler, kart altında kural uyarısı verilir)
                setSelectedMacroStar(star);
              } else {
                // Kullanıcının yıldızı yok, boş yıldız: sahiplenme akışı
                setClaimTargetStar(star);
                setSelectedMacroStar(null);
                setIsClaimModalOpen(true);
              }
            }}
          />
        )}
      </View>

      {/* ─── MAKRO MOD: SEKTÖR HUD (Yalnızca tescilli yıldızı olan kullanıcı makro moddayken standalone gösterilir) ─── */}
      {viewMode === 'macro' && starDetails !== null && (
        <SectorHUD
          centerRa={cameraRa}
          centerDec={cameraDec}
          topInset={insets.top + 54}
          onPress={() => setIsAtlasModalOpen(true)}
        />
      )}

      {/* ─── MAKRO MOD: SEÇİLEN YILDIZ BİLGİ VE SAHİPLENME KARTI ──────── */}
      {viewMode === 'macro' && selectedMacroStar && (
        <View style={[styles.macroStarCard, { bottom: insets.bottom + 80 }]}>
          <View style={styles.macroStarHeader}>
            <View style={styles.macroStarTitleRow}>
              <View
                style={[
                  styles.macroStarColorDot,
                  { backgroundColor: selectedMacroStar.base_color || '#9DB4FF' },
                ]}
              />
              <Text style={styles.macroStarTitle}>
                {selectedMacroStar.custom_name ||
                  (selectedMacroStar.common_name
                    ? `${selectedMacroStar.common_name} (${selectedMacroStar.catalog_code})`
                    : selectedMacroStar.catalog_code)}
              </Text>
              {selectedMacroStar.is_claimed ? (
                <View style={styles.claimedBadge}>
                  <Text style={styles.claimedBadgeText}>Tescilli</Text>
                </View>
              ) : (
                <View style={styles.availableBadge}>
                  <Text style={styles.availableBadgeText}>Boşta</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setSelectedMacroStar(null)}
              style={styles.macroStarCloseBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color="rgba(255, 255, 255, 0.7)" />
            </TouchableOpacity>
          </View>

          <View style={styles.macroStarDetailsRow}>
            <Text style={styles.macroStarDetailText}>
              Tayf: <Text style={styles.macroStarHighlight}>{selectedMacroStar.spectral_type}</Text>
            </Text>
            <Text style={styles.macroStarDetailText}>
              Parlaklık: <Text style={styles.macroStarHighlight}>{selectedMacroStar.magnitude} mag</Text>
            </Text>
            <Text style={styles.macroStarDetailText}>
              RA/DEC: <Text style={styles.macroStarHighlight}>{Number(selectedMacroStar.ra).toFixed(1)}° / {Number(selectedMacroStar.dec).toFixed(1)}°</Text>
            </Text>
          </View>

          {/* Aksiyon */}
          {!selectedMacroStar.is_claimed && isDemoMode ? (
            // Demo modu: Yönlendirme kartını aç
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                setDemoTargetStar(selectedMacroStar);
                setIsDemoAuthModalOpen(true);
              }}
              style={styles.claimThisStarBtn}
            >
              <Sparkles size={14} color="#030207" />
              <Text style={styles.claimThisStarBtnText}>Bu Yıldızı Seç 💫</Text>
            </TouchableOpacity>
          ) : !selectedMacroStar.is_claimed && starDetails === null ? (
            // Kullanıcının yıldızı yok ve yıldız boşta: sahiplenme butonu
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                setClaimTargetStar(selectedMacroStar);
                setSelectedMacroStar(null);
                setIsClaimModalOpen(true);
              }}
              style={styles.claimThisStarBtn}
            >
              <Sparkles size={14} color="#030207" />
              <Text style={styles.claimThisStarBtnText}>Bu Yıldızı Seç 💫</Text>
            </TouchableOpacity>
          ) : !selectedMacroStar.is_claimed && starDetails !== null ? (
            // Kullanıcının zaten yıldızı var ama boş yıldıza tıklandı: yıldız bilgisi + nazik bilgilendirme
            <View style={styles.alreadyOwnedBanner}>
              <Sparkles size={13} color="#FBBF24" />
              <Text style={styles.alreadyOwnedText}>
                Zaten bir yıldızınız var — her çift yalnızca bir yıldıza sahip olabilir ✨
              </Text>
            </View>
          ) : isDemoMode ? (
            // Başkasının tescilli yıldızı (Demo modu)
            <Text style={styles.claimedInfoText}>
              🔒 Bu yıldız başka bir çift tarafından gökyüzüne tescillenmiştir.
            </Text>
          ) : starDetails === null ? (
            // Başkasının tescilli yıldızı ama kullanıcının kendi yıldızı henüz yok
            <View style={styles.alreadyOwnedBanner}>
              <Sparkles size={13} color="#FBBF24" />
              <Text style={styles.alreadyOwnedText}>
                Bağlantı kurabilmek için önce aşkınıza ait bir yıldız tescil etmelisiniz ✨
              </Text>
            </View>
          ) : starConnections.some(
              (c) =>
                c.other_star_name === selectedMacroStar.custom_name ||
                (Math.abs(c.other_star_ra - Number(selectedMacroStar.ra)) < 0.001 &&
                  Math.abs(c.other_star_dec - Number(selectedMacroStar.dec)) < 0.001)
            ) ? (
            // Zaten bağlı yıldız
            <View style={styles.alreadyConnectedBanner}>
              <Sparkles size={13} color="#EC4899" />
              <Text style={styles.alreadyConnectedText}>
                ✨ Bu yıldızla zaten parıldayan bir takımyıldızı bağınız var.
              </Text>
            </View>
          ) : pendingRequests.some(
              (p) => p.other_star_name === selectedMacroStar.custom_name
            ) ? (
            // Onay bekleyen istek
            <View style={styles.alreadyConnectedBanner}>
              <Clock size={13} color="#FBBF24" />
              <Text style={styles.alreadyConnectedText}>
                ⏳ Bu yıldıza bağlantı isteği gönderildi; onay bekleniyor.
              </Text>
            </View>
          ) : starConnections.length >= 3 ? (
            // Limit dolu (3/3)
            <View style={styles.limitReachedBanner}>
              <AlertCircle size={13} color="#FBBF24" />
              <Text style={styles.limitReachedText}>
                Maksimum 3 bağlantı limitine ulaştınız (3/3).
              </Text>
            </View>
          ) : (
            // Tescilli yıldıza doğrudan bağlantı kur
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={isConnectingStar}
              onPress={handleConnectSelectedMacroStar}
              style={styles.connectStarBtn}
            >
              {isConnectingStar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <LinearGradient
                  colors={['#EC4899', '#8B5CF6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.connectStarBtnGradient}
                >
                  <Sparkles size={14} color="#FFFFFF" />
                  <Text style={styles.connectStarBtnText}>Yıldızımızı Bağla ✨</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Instruction Banner Removed to prevent overlap */}

      {/* ─── ALT KONTROL BAR VE AKSİYON BUTONLARI ─────────────────────── */}
      <View style={[styles.bottomControlBar, { paddingBottom: insets.bottom + 16 }]}>
        {/* YILDIZI OLMAYAN KULLANICI İÇİN: KOZMİK RADAR BUTONU */}
        {starDetails === null && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              setClaimTargetStar(null);
              setClaimSectorId(null);
              setIsClaimModalOpen(true);
            }}
            style={styles.radarLaunchBtn}
            accessibilityLabel="Kozmik Radarla Yıldız Bul"
          >
            <LinearGradient
              colors={['#0284C7', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.radarLaunchGradient}
            >
              <Radio size={16} color="#FFFFFF" />
              <Text style={styles.radarLaunchBtnText}>Kozmik Radarla Yıldız Bul ✨</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* SOL/ORTA AKSİYON 1: YENİ ANİ GEZEGENİ EKLE (Sadece Mikro Modda) */}
        {viewMode === 'micro' && starDetails && (
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => {
              setSelectedPlanet(null);
              setExoplanetModalMode('create');
            }}
            style={styles.actionPillBtn}
          >
            <Plus size={16} color="#38BDF8" />
            <Text style={styles.actionPillBtnText}>Anı Gezegeni Ekle</Text>
          </TouchableOpacity>
        )}

        {/* ORTA AKSİYON 2: GÜNLÜK KIVILCIM / COOLDOWN ROZETİ */}
        {viewMode === 'micro' && starDetails && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleCenterStarTouch}
            style={[
              styles.sparkActionBtn,
              liveCooldownSec > 0 && styles.sparkCooldownBadge,
            ]}
          >
            {liveCooldownSec <= 0 ? (
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sparkBtnGradient}
              >
                <Zap size={16} color="#FFFFFF" />
                <Text style={styles.sparkBtnText}>Yıldızımızı Aydınlat ✨</Text>
              </LinearGradient>
            ) : (
              <View style={styles.cooldownBadgeContent}>
                <View style={styles.cooldownHeaderRow}>
                  <Sparkles size={11} color="#FBBF24" />
                  <Text style={styles.cooldownBadgeTitle}>İlk Işığınız Göğe Yükseldi ✨</Text>
                </View>
                <View style={styles.cooldownTimerRow}>
                  <Clock size={11} color="rgba(255, 255, 255, 0.6)" />
                  <Text style={styles.cooldownTimerText}>{formatCooldownTime(liveCooldownSec)}</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* SAĞ ALT FAB: MAKRO / MİKRO MOD GEÇİŞİ */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            const nextMode = viewMode === 'micro' ? 'macro' : 'micro';
            setViewMode(nextMode);
            setSelectedMacroStar(null);
            showToast(
              nextMode === 'macro'
                ? 'Gök Kubbeye çıkıldı; tüm evreni keşfedebilirsiniz 🌌'
                : 'Yıldızınızın mikro çekim alanına girildi 🪐'
            );
          }}
          style={styles.modeSwitchFab}
          accessibilityLabel="Görünüm Modunu Değiştir"
        >
          {viewMode === 'micro' ? (
            <Globe size={20} color="#38BDF8" />
          ) : (
            <Orbit size={20} color="#FBBF24" />
          )}
        </TouchableOpacity>
      </View>

      {/* ─── MODALLAR ────────────────────────────────────────────────── */}

      {/* 1. YILDIZ SAHİPLENME MODALI (Yalnızca Kayıtlı Kullanıcılar İçin) */}
      {coupleId && !isDemoMode && (
        <ClaimStarModal
          visible={isClaimModalOpen}
          coupleId={coupleId}
          preSelectedStar={claimTargetStar ?? undefined}
          preSelectedSectorId={claimSectorId ?? undefined}
          onClose={() => {
            setIsClaimModalOpen(false);
            setClaimTargetStar(null);
            setClaimSectorId(null);
          }}
          onSuccess={handleClaimSuccess}
        />
      )}

      {/* 1.1 DEMO MODU YÖNLENDİRME KARTI */}
      {isDemoMode && (
        <StarDemoAuthModal
          visible={isDemoAuthModalOpen}
          targetStar={demoTargetStar}
          onClose={() => {
            setIsDemoAuthModalOpen(false);
            setDemoTargetStar(null);
          }}
        />
      )}

      {/* 2. ANİ ÖTEGEZEGENİ MODALI (VIEW / CREATE) */}
      {starDetails && (coupleId || isDemoMode) && (
        <ExoplanetModal
          visible={exoplanetModalMode !== null}
          mode={exoplanetModalMode || 'view'}
          starId={starDetails.star_id}
          coupleId={coupleId || 999999}
          selectedPlanet={selectedPlanet}
          onClose={() => setExoplanetModalMode(null)}
          onPlanetCreated={handlePlanetCreated}
          onPlanetUpdated={handlePlanetUpdated}
          onPlanetDeleted={handlePlanetDeleted}
        />
      )}

      {/* 3. TESCİL SERTİFİKASI İNCELEME MODALI */}
      {starDetails && (
        <ClaimStarModal
          visible={isCertificateModalOpen}
          coupleId={coupleId || 999999}
          initialStar={starDetails}
          onClose={() => setIsCertificateModalOpen(false)}
          onSuccess={() => setIsCertificateModalOpen(false)}
        />
      )}

      {/* 4. KOZMİK BAĞLAR MODALI */}
      {starDetails && coupleId && !isDemoMode && (
        <StarConnectionModal
          visible={isConnectionsModalOpen}
          coupleId={coupleId}
          onClose={() => setIsConnectionsModalOpen(false)}
          onNavigateToSky={() => {
            setViewMode('macro');
            showToast('Gök Kubbede tescilli bir yıldıza dokunarak bağ kurabilirsiniz 🌌');
          }}
          onConnectionChanged={() => {
            // Aktif bağlantıları ve rozeti yenile (canvas güncellemesi için)
            Promise.all([
              starService.getMyStarConnections(),
              starService.getPendingConnections(),
            ])
              .then(([connections, pending]) => {
                setStarConnections(connections);
                setPendingRequests(pending);
                setPendingIncomingCount(pending.filter((p) => p.is_incoming).length);
              })
              .catch(() => {});
          }}
        />
      )}

      {/* 5. GÖKYÜZÜ ATLASI MODALI */}
      <SectorAtlasModal
        visible={isAtlasModalOpen}
        onClose={() => setIsAtlasModalOpen(false)}
        hasOwnStar={starDetails !== null}
        onFlyTo={(target) => {
          setFlyToTarget(target);
          setViewMode('macro');
        }}
        onClaimFromSector={(sectorId) => {
          if (!coupleId || isDemoMode) return;
          setClaimSectorId(sectorId);
          setClaimTargetStar(null);
          setIsClaimModalOpen(true);
        }}
      />
      {/* ─── ARAMA MODAL'I ────────────────────────────────────────────── */}
      <SearchStarModal
        visible={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectStar={(catalogId) => {
          setIsSearchModalOpen(false);
          // Makro moduna geç ve seçilen yıldızı tescil hedefine al veya oraya git
          setViewMode('macro');
          // TODO: If we want to focus on the selected star, we can set target RA/DEC or open claim modal
          setClaimTargetStar(null); // Just resetting it so user can claim
          setClaimSectorId(null);
          setIsClaimModalOpen(true);
        }}
      />
    </View>
  );
};

// ============================================================================
// STİLLER
// ============================================================================

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#030207',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#030207',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  glowWaveOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  hudTopBar: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(7, 5, 18, 0.65)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  badgeWrapper: {
    flex: 1,
  },
  cosmicBagBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(7, 5, 18, 0.65)',
    borderWidth: 1.2,
    borderColor: 'rgba(236, 72, 153, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EC4899',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  cosmicBagBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cosmicBagBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFF',
  },
  canvasContainer: {
    flex: 1,
  },
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 30,
    alignItems: 'center',
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(15, 12, 30, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  bottomControlBar: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: 'rgba(7, 5, 18, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionPillBtnText: {
    color: '#38BDF8',
    fontSize: 12.5,
    fontWeight: '700',
  },
  sparkActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  sparkBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  sparkBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sparkCooldownBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1.2,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  cooldownBadgeContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cooldownHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cooldownBadgeTitle: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cooldownTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cooldownTimerText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  modeSwitchFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(7, 5, 18, 0.8)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  macroStarCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 25,
    backgroundColor: 'rgba(10, 8, 24, 0.94)',
    borderWidth: 1.2,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
    gap: 10,
  },
  macroStarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  macroStarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  macroStarColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  macroStarTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  claimedBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 0.8,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  claimedBadgeText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '700',
  },
  availableBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 0.8,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  availableBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  macroStarCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroStarDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  macroStarDetailText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '500',
  },
  macroStarHighlight: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  claimThisStarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 10,
  },
  claimThisStarBtnText: {
    color: '#030207',
    fontSize: 13,
    fontWeight: '700',
  },
  claimedInfoText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  alreadyOwnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 0.8,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  alreadyOwnedText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectStarBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  connectStarBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  connectStarBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  alreadyConnectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    borderWidth: 0.8,
    borderColor: 'rgba(236, 72, 153, 0.35)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  alreadyConnectedText: {
    color: '#EC4899',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  limitReachedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 0.8,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  limitReachedText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  radarLaunchBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  radarLaunchGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  radarLaunchBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  instructionBanner: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 12, 30, 0.90)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  instructionBannerText: {
    color: '#FCD34D',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginHorizontal: 8,
  },
  instructionCloseBtn: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});

export default OurStarScreen;
