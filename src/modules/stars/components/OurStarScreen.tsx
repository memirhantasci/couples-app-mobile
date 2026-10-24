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
 * 3. Yıldızın Işığı:
 *    Parlaklık çiftin uygulamadaki aktivitesinden gelir (couple_activity_score); günlük ışık ritüeli yoktur.
 * 4. Etkileşim ve Sevgi Titreşimi:
 *    Yıldıza dokunulduğunda yerel haptik + StarSparkManager üzerinden partnere love ping.
 * 5. Realtime Işıma Dalgası:
 *    Partner yıldıza dokunduğunda ekranda yumuşak 1.8s altın/cyan kozmik ışıma dalgası patlar.
 * 6. Makro / Mikro Görünüm Geçişi:
 *    Gök kubbede sağ alttaki FAB, yıldızın içinde cam paneldeki küre düğmesi ile
 *    Gök Kubbe (MacroSkyCanvas) ve Mikro Sistem arasında pürüzsüz geçiş.
 * 7. Yıldızın İçi: MicroSystemCanvas (sahne) + MicroStarHeader (başlık) + MicroSystemDock
 *    (anı gezegenleri). HUD burada temadan bağımsız koyu camdır.
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  StatusBar,
  BackHandler,
  type LayoutChangeEvent,
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
import {
  Orbit,
  Globe,
  Share2,
  Clock,
  ArrowLeft,
  Sparkles,
  X,
  AlertCircle,
  Radio,
  Search,
  Award,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react-native';

import {
  startCosmicAmbient,
  stopCosmicAmbient,
  getSoundEffectsEnabled,
  hapticTap,
  hapticStamp,
  hapticSelection,
  hapticSuccess,
  hapticError,
} from '@/lib/soundEffects';
import { safeStorage as AsyncStorage } from '@/lib/safeStorage';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { DEMO_STAR_DETAILS, DEMO_STAR_EXOPLANETS } from '@/constants/demoData';
import { starService, PremiumRequiredError } from '../api/starService';
import { StarSparkManager } from '../services/StarSparkManager';
import { MicroSystemCanvas } from '../canvas/MicroSystemCanvas';
import { MacroSkyCanvas, SOLAR_SYSTEM_OBJECTS, computeBounds } from '../canvas/MacroSkyCanvas';
import { UNCLAIMED_STAR_BRIGHTNESS } from '../canvas/macro/starStyle';
import { StarInfoBadge } from './StarInfoBadge';
import { ClaimStarModal } from './ClaimStarModal';
import { StarDemoAuthModal } from './StarDemoAuthModal';
import { ExoplanetModal } from './ExoplanetModal';
import { StarConnectionModal } from './StarConnectionModal';
import { ConnectionRequestBadge } from './ConnectionRequestBadge';
import { SectorHUD } from './SectorHUD';
import { SectorAtlasModal } from './SectorAtlasModal';
import { SearchStarModal } from './SearchStarModal';
import { SKY_SECTORS } from '../config/skySectors.data';
import { MicroStarHeader } from './micro/MicroStarHeader';
import { MicroSystemDock } from './micro/MicroSystemDock';
import { PremiumPaywall } from '@/components/ui/PremiumPaywall';
import type { PremiumFeatureSource } from '@/components/ui/PremiumPaywall.types';
import { useCoupleAvatars } from '@/hooks/useCoupleAvatars';
import { useSkyTileStream } from '../hooks/useSkyTileStream';

import type {
  ActiveStarConnection,
  PendingConnectionDetail,
  CoupleStarDetails,
  FlyToTarget,
  MyStarBrightness,
  StarBrightnessInfo,
  StarExoplanetRecord,
  StarSystemMapPlanet,
  ViewportStarItem,
  SparkBroadcastPayload,
  ResonanceEvent,
  SkyCameraState,
} from '../types/star.types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Realtime güncellemeleri koruma penceresi (5 saniye)
const REALTIME_RECONCILIATION_WINDOW_MS = 5000;

// Yıldız ekranının açılış sahnesi: önce geniş gökyüzü (uzayın ihtişamı), sonra yıldızın
// parıltılı dış görünümüne süzülüş. İçeri girmek kullanıcının "Yıldızın İçine Gir" seçimidir.
const SKY_OVERVIEW_ZOOM = 1.2;
const STAR_EXTERIOR_ZOOM = 3.0;
const STAR_INTRO_FLIGHT_MS = 2400;

// Yıldızın içi (mikro) yerleşimi: başlık üst çubuğun altında, cam panel en altta.
// Ölçümler gelene kadar (onLayout) yörünge sistemi bu tahminlere göre ortalanır.
const MICRO_HEADER_OFFSET = 60;
const MICRO_HEADER_ESTIMATED_HEIGHT = 130;
const MICRO_DOCK_ESTIMATED_HEIGHT = 190;
/** Kapatılan anı gezegeninin hedef halkası bu kadar süre daha görünür kalır. */
const PLANET_HIGHLIGHT_LINGER_MS = 2600;

const SOLAR_DESCRIPTIONS: Record<string, string> = {
  'SOL-SUN': 'Güneş Sistemimizin kalbi, tüm evrenin yaşam kaynağı.',
  'SOL-MERCURY': 'Güneşe en yakın, kalbimizin en sıcak ve tutkulu köşesi.',
  'SOL-VENUS': 'Aşkın ve güzelliğin simgesi, gökyüzünün en parlak Çoban Yıldızı.',
  'SOL-EARTH': 'Tüm anılarımızın ve sevgimizin filizlendiği biricik mavi gezegen.',
  'SOL-MOON': 'Gecelerimizin aydınlatıcısı, sadık ve zarif uydumuz Ay.',
  'SOL-MARS': 'Aşkımızın sönmeyen ateşi ve cesareti, Kızıl Gezegen.',
  'SOL-JUPITER': 'Tüm zorluklara karşı bizi koruyan dev kalkan, sevgimizin koruyucusu.',
  'SOL-SATURN': 'Zamanın ötesindeki bağlılığımızın ve sadakatimizin sonsuz halkası.',
  'SOL-URANUS': 'Gökyüzünün dingin, masmavi ve büyüleyici buz gülü.',
  'SOL-NEPTUNE': 'Aşkımızın derinliği gibi dipsiz ve huzurlu okyanuslar diyarı.',
  'SOL-PLUTO': 'Evrenin ucunda bile olsa birbirini asla unutmayan kalplerin simgesi.',
};

/** Ayrıntılar gelene kadar anı penceresinde gösterilen, harita verisinden kurulan önizleme kaydı. */
function toPlanetPreview(planet: StarSystemMapPlanet, starId: string): StarExoplanetRecord {
  return {
    id: planet.id,
    star_id: starId,
    title: planet.display_title,
    description: null,
    milestone_date: null,
    orbit_distance: planet.orbit_distance,
    orbit_speed: planet.orbit_speed,
    planet_type: planet.planet_type,
    palette: planet.palette,
    media_urls: [],
    custom_metadata: {},
    is_auto_generated: false,
    window_started_at: null,
    created_at: '',
    updated_at: '',
  };
}

function toMapPlanet(planet: StarExoplanetRecord): StarSystemMapPlanet {
  return {
    id: planet.id,
    orbit_distance: planet.orbit_distance,
    orbit_speed: planet.orbit_speed,
    planet_type: planet.planet_type,
    palette: planet.palette,
    is_locked: false,
    display_title: planet.title,
  };
}

const formatLightPercent = (value: number) => `%${Math.round(Math.max(0, Math.min(1, value)) * 100)}`;

/**
 * Seçilen yıldız kartındaki "Parlaklık" değeri. Yıldızlarda katalog kadiri (mag)
 * gösterilmez: sahipsiz yıldızların hepsi aynı sabit, sönük ışıkla parlar;
 * tescilli bir yıldızın ışığı yalnızca çiftin aktivitesiyle artar. Gök cisimleri
 * (Güneş Sistemi) yıldız sahiplenmenin parçası olmadığı için gerçek kadirini korur.
 */
function describeStarLightValue(
  star: ViewportStarItem,
  myLight: number | null,
  friendLight: StarBrightnessInfo | null
): string {
  if (star.catalog_code?.startsWith('SOL-')) return `${star.magnitude} mag`;
  if (!star.is_claimed) return formatLightPercent(UNCLAIMED_STAR_BRIGHTNESS);
  if (star.is_mine) return formatLightPercent(myLight ?? star.luminosity_level);
  if (friendLight?.visibility === 'friend') return formatLightPercent(friendLight.brightness);
  if (star.is_connected === true) return formatLightPercent(star.luminosity_level);
  return 'Gizemli ✨';
}

/**
 * Seçilen yıldız kartındaki ışık açıklaması (yüzde, üstteki "Parlaklık"
 * değerinde); gösterilecek bir şey yoksa null.
 * Gece işi 5. hareketsiz günün sonunda ışığı azaltmaya başlar.
 */
function describeStarLight(
  star: ViewportStarItem,
  myBrightness: MyStarBrightness | null,
  friendLight: StarBrightnessInfo | null
): string | null {
  if (star.catalog_code?.startsWith('SOL-')) return null;

  if (star.is_mine) {
    if (!myBrightness) return null;
    let text = `${myBrightness.cumulative_score} aktivite puanı`;
    if (myBrightness.points_today > 0) text += ` · bugün +${myBrightness.points_today}`;
    const idleDays = myBrightness.days_inactive ?? 0;
    if (idleDays >= 6) text += ' · ışık sönüyor, bugün bir anı paylaşın';
    else if (idleDays === 5) text += ' · bugün aktivite olmazsa ışık azalmaya başlar';
    return text;
  }

  if (!star.is_claimed) {
    return 'Sahipsiz yıldızların hepsi aynı sönük ışıkla parlar · tescillenince aşkınızla parlamaya başlar';
  }
  if (friendLight?.visibility === 'friend') return `${friendLight.cumulative_score ?? 0} aktivite puanı`;
  // Bağlı yıldızın ışığı üstte yazar; eski sunucu bağlantı bilgisini göndermiyorsa da söylenecek bir şey yok
  if (star.is_connected !== false) return null;
  return 'Yıldızlarınızı bağlayınca gerçek ışığını görürsünüz';
}

export const OurStarScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, session, isDemoMode, isLoading: isAuthLoading } = useAuth();
  const { theme, isLight } = useTheme();
  const coupleId = profile?.coupleId ?? null;
  const isPremium = isDemoMode || profile?.isPremium === true;
  const currentUserId = session?.user?.id ?? '';
  const currentUserName = profile?.displayName || profile?.username || 'Partner';

  // ─── TEMEL DURUMLAR (STATE) ────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  // Ekran her zaman yıldızın DIŞ görünümüyle (gök kubbe) açılır; mikro sisteme kullanıcı kendisi girer.
  // Demo modu da aynı akışı izler.
  const [viewMode, setViewMode] = useState<'micro' | 'macro'>('macro');
  const [starDetails, setStarDetails] = useState<CoupleStarDetails | null>(null);
  const [exoplanets, setExoplanets] = useState<StarSystemMapPlanet[]>([]);
  const [demoPlanetDetails, setDemoPlanetDetails] = useState<StarExoplanetRecord[]>([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  // Other couples' stars stream in by sky tile while the camera moves. Only
  // the user's own star keeps a realtime subscription.
  const skyTiles = useSkyTileStream();
  const { prefetch: prefetchSkyTiles, refresh: refreshSkyTiles } = skyTiles;
  const [selectedMacroStar, setSelectedMacroStar] = useState<ViewportStarItem | null>(null);
  // Aktivite puanından gelen yıldız ışığı (yalnızca kendi çiftimizin gerçek puanı).
  const [myBrightness, setMyBrightness] = useState<MyStarBrightness | null>(null);
  // Gök kubbede seçilen bağlı (arkadaş) yıldızın gerçek ışığı ve puanı.
  const [selectedStarLight, setSelectedStarLight] = useState<{
    catalogId: number;
    info: StarBrightnessInfo;
  } | null>(null);

  // ─── YILDIZIN İÇİ (MİKRO) DURUMU ───────────────────────────────────
  // Her artış mikro sahnede yıldızdan kıvılcım şok dalgası yayar (dokunma, düğme, partner).
  const [sparkSignal, setSparkSignal] = useState(0);
  const [highlightPlanetId, setHighlightPlanetId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [microHeroBottom, setMicroHeroBottom] = useState<number | null>(null);

  // Güvenli Geri Dönüş Fonksiyonu: Yıldızın içindeyse gök kubbeye döner; gök kubbedeyse ana ekrana döner
  const handleBack = useCallback(() => {
    if (viewMode === 'micro') {
      setViewMode('macro');
      setSelectedMacroStar(null);
      setHighlightPlanetId(null);
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/home');
    }
  }, [viewMode, router]);

  // Android donanım geri tuşu: Yıldızın içindeyse gök kubbeye döner
  useEffect(() => {
    const onBackPress = () => {
      if (viewMode === 'micro') {
        setViewMode('macro');
        setSelectedMacroStar(null);
        setHighlightPlanetId(null);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [viewMode]);

  // Realtime & Rezonans State
  const [luminosityOverride, setLuminosityOverride] = useState<number | undefined>(undefined);
  const [isResonanceActive, setIsResonanceActive] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modallar
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimTargetStar, setClaimTargetStar] = useState<ViewportStarItem | null>(null);
  const [isDemoAuthModalOpen, setIsDemoAuthModalOpen] = useState(false);
  const [demoTargetStar, setDemoTargetStar] = useState<ViewportStarItem | null>(null);
  const [exoplanetModalMode, setExoplanetModalMode] = useState<'view' | 'edit' | 'create' | null>(null);
  const [selectedPlanet, setSelectedPlanet] = useState<StarExoplanetRecord | null>(null);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [isConnectionsModalOpen, setIsConnectionsModalOpen] = useState(false);
  const [premiumPaywallSource, setPremiumPaywallSource] = useState<PremiumFeatureSource | null>(null);

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

  // Eve Dönüş Radarı Hesaplaması
  const myStarRa = starDetails ? Number(starDetails.ra) : 0;
  const myStarDec = starDetails ? Number(starDetails.dec) : 0;
  const deltaRa = ((myStarRa - cameraRa + 540) % 360) - 180;
  const deltaDec = myStarDec - cameraDec;
  const angularDistance = Math.sqrt(deltaRa * deltaRa + deltaDec * deltaDec);
  const showHomeRadar = viewMode === 'macro' && starDetails !== null && angularDistance > 1.5;

  // ─── REFERANSLAR (LWW & MANAGER) ───────────────────────────────────
  const sparkManagerRef = useRef<StarSparkManager | null>(null);
  const lastRealtimeSparkAtRef = useRef<number>(0);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ortam sesi kalıcılık anahtarı
  const STORAGE_KEY_STAR_AMBIENT_MUTED = '@star_ambient_muted';
  const ambientMutedRef = useRef(false);
  const [isAmbientMuted, setIsAmbientMuted] = useState(false);

  // Kalıcı ses kapatma tercihini ilk açılışta yükle
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_STAR_AMBIENT_MUTED).then((val) => {
      if (val !== null) {
        const isMuted = val === 'true';
        ambientMutedRef.current = isMuted;
        setIsAmbientMuted(isMuted);
      }
    });
  }, []);

  const [microDockTop, setMicroDockTop] = useState<number | null>(null);
  // Anı penceresi anında açılır; ayrıntılar (fotoğraf, hikâye) gelene kadar yükleniyor durumundadır.
  const [isPlanetLoading, setIsPlanetLoading] = useState(false);
  const planetRequestRef = useRef<string | null>(null);
  // Premium çiftin fotoğrafları yıldız etrafındaki iki ruhun ucunda dolaşır (Premium değilse boş).
  const { myAvatarUrl, partnerAvatarUrl } = useCoupleAvatars();

  // ─── IŞIMA DALGASI ANİMASYONU ──────────────────────────────────────
  const glowWaveOpacity = useSharedValue(0);

  const triggerGlowWave = () => {
    glowWaveOpacity.value = withSequence(
      withTiming(0.5, { duration: 350, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 1450, easing: Easing.in(Easing.cubic) })
    );
    setSparkSignal((signal) => signal + 1);
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

  const handlePremiumAction = useCallback((source: PremiumFeatureSource, action: () => void) => {
    // A cached profile can be temporarily stale while AuthContext refreshes it.
    // Do not present a false paywall during that loading interval.
    if (isDemoMode) {
      action();
      return;
    }
    if (isAuthLoading || !profile) return;
    if (!isPremium) {
      setPremiumPaywallSource(source);
      return;
    }
    action();
  }, [isAuthLoading, isDemoMode, isPremium, profile]);

  // ─── AÇILIŞ SAHNESİ ────────────────────────────────────────────────
  // Tescilli yıldızı olan kullanıcıda (demo dahil) ekran, geniş gökyüzünden yıldızın parıltılı dış
  // görünümüne yavaşça süzülerek açılır; kamera doğrudan yıldızın içine dalmaz. Uçuş, gök kubbe
  // canvas'ı bağlandığında kendiliğinden başlar (canvas hedefi alınca tüketir) ve ekran başına bir kez kurulur.
  const introQueuedRef = useRef(false);
  const queueStarIntro = useCallback(
    (ra: number, dec: number) => {
      if (introQueuedRef.current) return;
      introQueuedRef.current = true;
      // Varış karoları uçuş sırasında hazır olsun
      prefetchSkyTiles(
        computeBounds({
          centerRa: ra,
          centerDec: dec,
          zoom: STAR_EXTERIOR_ZOOM,
          viewportWidth: SCREEN_WIDTH,
          viewportHeight: SCREEN_HEIGHT,
        })
      );
      setFlyToTarget({
        centerRa: ra,
        centerDec: dec,
        zoom: STAR_EXTERIOR_ZOOM,
        durationMs: STAR_INTRO_FLIGHT_MS,
        nonce: Date.now(),
      });
    },
    [prefetchSkyTiles]
  );

  // Puanı veritabanı trigger'ları verir; ekran yalnızca güncel ışığı okur. Hata sessizdir,
  // son bilinen değer (ya da yıldızın kendi luminosity değeri) gösterilmeye devam eder.
  const refreshMyBrightness = useCallback(() => {
    if (isDemoMode || !coupleId) return;
    starService.getMyStarBrightness().then(setMyBrightness).catch(() => {});
  }, [isDemoMode, coupleId]);

  // ─── VERİ YÜKLEME VE RECONCILIATION ────────────────────────────────
  const loadStarData = useCallback(
    async (isSilent: boolean = false) => {
      // 0. Demo Modu: Misafir kullanıcı için zengin örnek yıldız verisi
      if (isDemoMode) {
        setStarDetails(DEMO_STAR_DETAILS);
        setExoplanets(DEMO_STAR_EXOPLANETS.map(toMapPlanet));
        setDemoPlanetDetails(DEMO_STAR_EXOPLANETS);
        setLuminosityOverride(DEMO_STAR_DETAILS.luminosity_level);
        setIsResonanceActive(DEMO_STAR_DETAILS.resonance_active);
        queueStarIntro(Number(DEMO_STAR_DETAILS.ra), Number(DEMO_STAR_DETAILS.dec));
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
        queueStarIntro(Number(details.ra), Number(details.dec));
        refreshMyBrightness();

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
      } catch (error) {
        // Yıldız gerçekten yoksa macro kanvasa yönlendir; network/RPC errors
        // stay visible rather than being mistaken for an unclaimed star.
        if (error instanceof PremiumRequiredError) {
          setPremiumPaywallSource('exoplanet_view');
          return;
        }
        showToast('Yıldız verileri yüklenemedi. Lütfen bağlantınızı kontrol edip tekrar deneyin.');
        setStarDetails(null);
        setViewMode('macro');
      } finally {
        if (!isSilent) {
          setIsLoading(false);
        }
      }
    },
    [coupleId, isDemoMode, showToast, queueStarIntro, refreshMyBrightness]
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

  // Kozmik Ambiyans: ekran odaktayken ve hem genel ayarlarda ses açık hem de bu ekranda sessize
  // alınmamışsa çalar. Odak kaybedildiğinde (sekme değişimi, geri gitme) pürüzsüzce söner.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [soundEnabled, savedMute] = await Promise.all([
          getSoundEffectsEnabled(),
          AsyncStorage.getItem(STORAGE_KEY_STAR_AMBIENT_MUTED),
        ]);
        const isMuted = savedMute !== null ? savedMute === 'true' : ambientMutedRef.current;
        ambientMutedRef.current = isMuted;
        if (active) {
          setIsAmbientMuted(isMuted);
        }
        if (active && !isMuted && soundEnabled) {
          startCosmicAmbient().catch(() => {});
        }
      })();
      return () => {
        active = false;
        stopCosmicAmbient();
      };
    }, [])
  );

  // Expiration must discard any previously downloaded detail object and its
  // signed URLs. The next map fetch contains only locked marker payloads.
  useEffect(() => {
    if (isDemoMode || isAuthLoading || !starDetails || isPremium) return;

    // Defer state disposal one task so the effect remains an external-state
    // synchronization point. The modal also receives isPremium=false and never
    // renders its prior content during this transition.
    const disposeTimer = setTimeout(() => {
      setSelectedPlanet(null);
      setExoplanetModalMode(null);
    }, 0);
    starService.getStarExoplanets(starDetails.star_id)
      .then(setExoplanets)
      .catch(() => showToast('Kilitli gezegenler yenilenemedi. Lütfen tekrar deneyin.'));
    return () => clearTimeout(disposeTimer);
  }, [isAuthLoading, isDemoMode, isPremium, showToast, starDetails]);

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

        // Anlık Işıma ve Haptic. Parlaklık değişmez: yıldızın ışığı çiftin aktivitesinden gelir
        // (eski sürümlerden gelen daily_spark da yalnızca sevgi titreşimi olarak karşılanır).
        triggerGlowWave();
        hapticSuccess();

        const partnerTitle = spark.senderName || 'Sevgilin';
        showToast(`${partnerTitle} yıldızınıza dokunarak sevgi titreşimi gönderdi! 💫`);
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

  // ─── MERKEZ YILDIZA DOKUNMA: SEVGİ TİTREŞİMİ ───────────────────────
  // Yıldıza dokunmak partnere anlık titreşim gönderir; parlaklığı değiştirmez.
  const handleCenterStarTouch = async () => {
    if (!isDemoMode && (!starDetails || !sparkManagerRef.current)) return;

    await hapticTap();
    triggerGlowWave();
    sparkManagerRef.current?.queueLovePing().catch(() => {});
    showToast('Yıldıza dokundun; sevgi titreşimi eşine iletildi 💫');
  };

  // Mikro sahne memo'lu: geri çağrıları kimliği değişmeyen sarmalayıcılarla verilir,
  // böylece üst bileşenin yeniden çizimleri sahneyi yeniden kurmaz.
  const centerStarTouchRef = useRef(handleCenterStarTouch);
  useLayoutEffect(() => {
    centerStarTouchRef.current = handleCenterStarTouch;
  });
  const handleMicroStarTouch = useCallback(() => {
    centerStarTouchRef.current();
  }, []);

  const clearPlanetHighlightTimer = useCallback(() => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
  }, []);
  useEffect(() => clearPlanetHighlightTimer, [clearPlanetHighlightTimer]);

  // Anı gezegenini aç (sahneden veya alt paneldeki karttan).
  // Pencere ayrıntıları beklemeden ANINDA açılır: elimizdeki başlık/renk/türle başlar,
  // fotoğraf ve hikâye sunucudan gelince dolar. Bu sırada düzenle/sil kapalıdır.
  const handleOpenPlanet = useCallback(
    (planet: StarSystemMapPlanet) => {
      handlePremiumAction('exoplanet_view', () => {
        if (planet.is_locked) {
          setPremiumPaywallSource('exoplanet_view');
          return;
        }
        clearPlanetHighlightTimer();
        setHighlightPlanetId(planet.id);
        hapticSelection();
        if (isDemoMode) {
          const details = demoPlanetDetails.find((item) => item.id === planet.id);
          if (details) {
            setSelectedPlanet(details);
            setExoplanetModalMode('view');
          }
          return;
        }
        if (!starDetails) return;

        planetRequestRef.current = planet.id;
        setSelectedPlanet(toPlanetPreview(planet, starDetails.star_id));
        setIsPlanetLoading(true);
        setExoplanetModalMode('view');

        starService.getExoplanetDetails(planet.id)
          .then((details) => {
            // Kullanıcı bu arada pencereyi kapattıysa veya başka gezegen açtıysa yok say.
            if (planetRequestRef.current !== planet.id) return;
            setSelectedPlanet(details);
            setIsPlanetLoading(false);
          })
          .catch((error) => {
            if (planetRequestRef.current !== planet.id) return;
            planetRequestRef.current = null;
            setIsPlanetLoading(false);
            setExoplanetModalMode(null);
            setSelectedPlanet(null);
            setHighlightPlanetId(null);
            if (error instanceof PremiumRequiredError) {
              setPremiumPaywallSource('exoplanet_view');
              return;
            }
            showToast(error?.message || 'Gezegen ayrıntıları yüklenemedi.');
          });
      });
    },
    [clearPlanetHighlightTimer, demoPlanetDetails, handlePremiumAction, isDemoMode, showToast, starDetails]
  );

  const handleCreatePlanet = useCallback(() => {
    handlePremiumAction('exoplanet_create', () => {
      setSelectedPlanet(null);
      setExoplanetModalMode('create');
    });
  }, [handlePremiumAction]);

  const handleCloseExoplanetModal = useCallback(() => {
    planetRequestRef.current = null;
    setIsPlanetLoading(false);
    setExoplanetModalMode(null);
    // Kapatılan gezegen bir süre daha işaretli kalır: kullanıcı hangi anıya baktığını görür.
    clearPlanetHighlightTimer();
    highlightTimerRef.current = setTimeout(() => {
      highlightTimerRef.current = null;
      setHighlightPlanetId(null);
    }, PLANET_HIGHLIGHT_LINGER_MS);
  }, [clearPlanetHighlightTimer]);

  const handleOpenCertificate = useCallback(() => setIsCertificateModalOpen(true), []);

  const handleMicroHeroLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    setMicroHeroBottom(Math.round(y + height));
  }, []);
  const handleMicroDockLayout = useCallback((event: LayoutChangeEvent) => {
    setMicroDockTop(Math.round(event.nativeEvent.layout.y));
  }, []);

  const handleFocusMyStar = useCallback(() => {
    hapticStamp();
    setFlyToTarget({ centerRa: myStarRa, centerDec: myStarDec, zoom: STAR_EXTERIOR_ZOOM, nonce: Date.now() });
    // Warm the destination tiles so they arrive during the flight.
    prefetchSkyTiles(computeBounds({
      centerRa: myStarRa,
      centerDec: myStarDec,
      zoom: STAR_EXTERIOR_ZOOM,
      fovDec: 20,
      fovRa: 20 * (SCREEN_WIDTH / SCREEN_HEIGHT),
    }));
    if (starDetails) {
      const myStarItem: ViewportStarItem = {
        catalog_id: starDetails.catalog_id,
        catalog_code: starDetails.catalog_code,
        common_name: starDetails.common_name ?? null,
        ra: Number(starDetails.ra),
        dec: Number(starDetails.dec),
        magnitude: starDetails.magnitude,
        spectral_type: starDetails.spectral_type,
        base_color: starDetails.base_color,
        is_claimed: true,
        is_mine: true,
        custom_name: starDetails.custom_name,
        luminosity_level: starDetails.luminosity_level,
        resonance_active: starDetails.resonance_active,
      };
      setSelectedMacroStar(myStarItem);
    }
    showToast('Yıldızımıza süzülüyoruz ✨');
  }, [myStarRa, myStarDec, starDetails, showToast, prefetchSkyTiles]);

  // Makro (Gök Kubbe) / Mikro (yıldızın içi) geçişi
  const handleToggleViewMode = useCallback(() => {
    if (!starDetails && viewMode === 'macro') {
      return;
    }
    const nextMode = viewMode === 'micro' ? 'macro' : 'micro';
    hapticStamp();
    setViewMode(nextMode);
    setSelectedMacroStar(null);
    setHighlightPlanetId(null);
    // İçeri girişi sahnenin kendi açılış animasyonu ve ipucu karşılar; yalnızca çıkışta bildirim.
    if (nextMode === 'macro') {
      showToast('Gök Kubbeye çıkıldı; tüm evreni keşfedebilirsiniz 🌌');
    }
  }, [viewMode, starDetails, showToast]);

  // Ortam sesini aç/kapat (Kalıcı tercih + Genel ses ayarı denetimi)
  const handleToggleAmbient = useCallback(async () => {
    hapticTap();
    const nextMuted = !ambientMutedRef.current;
    ambientMutedRef.current = nextMuted;
    setIsAmbientMuted(nextMuted);
    await AsyncStorage.setItem(STORAGE_KEY_STAR_AMBIENT_MUTED, nextMuted ? 'true' : 'false');
    if (nextMuted) {
      stopCosmicAmbient();
    } else {
      const soundEnabled = await getSoundEffectsEnabled();
      if (soundEnabled) {
        startCosmicAmbient().catch(() => {});
      } else {
        showToast('Uygulama sesleri ayarlardan kapalı (Profil > Ses & Dokunsal Efektler).');
      }
    }
  }, [showToast]);

  // Kamera değiştiğinde koordinatları sadece anlamlı değişimlerde güncelle (re-render döngüsünü önler)
  const handleCameraChange = useCallback((cam: SkyCameraState) => {
    setCameraRa((prevRa) => (Math.abs(prevRa - cam.centerRa) > 0.08 ? cam.centerRa : prevRa));
    setCameraDec((prevDec) => (Math.abs(prevDec - cam.centerDec) > 0.08 ? cam.centerDec : prevDec));
  }, []);

  // ─── TESCİL BAŞARISI (Claim Callback) ──────────────────────────────
  const handleClaimSuccess = (claimed: CoupleStarDetails) => {
    setStarDetails(claimed);
    setLuminosityOverride(claimed.luminosity_level);
    setIsClaimModalOpen(false);
    setViewMode('micro');
    // Anı gezegenlerini sıfırdan çek
    loadStarData(true);
    showToast('Yıldızınız gökyüzüne tescillendi! Hoş geldiniz ✨');
  };

  // ─── ANİ GEZEGENİ HANDLER'LARI ─────────────────────────────────────
  // Kimlikleri sabit: memo'lu ExoplanetModal saniyelik geri sayım çizimlerinde yeniden çizilmez.
  const handlePlanetCreated = useCallback((newPlanet: StarExoplanetRecord) => {
    if (isDemoMode) {
      setDemoPlanetDetails((prev) => [newPlanet, ...prev]);
    }
    setExoplanets((prev) => [toMapPlanet(newPlanet), ...prev]);
    showToast(`"${newPlanet.title}" anı gezegeni yörüngede dönmeye başladı! 🪐`);
    refreshMyBrightness();
  }, [isDemoMode, showToast, refreshMyBrightness]);

  const handlePlanetUpdated = useCallback((updatedPlanet: StarExoplanetRecord) => {
    if (isDemoMode) {
      setDemoPlanetDetails((prev) => prev.map((p) => (p.id === updatedPlanet.id ? updatedPlanet : p)));
    }
    setExoplanets((prev) =>
      prev.map((p) => (p.id === updatedPlanet.id ? toMapPlanet(updatedPlanet) : p))
    );
    setSelectedPlanet(updatedPlanet);
    showToast(`"${updatedPlanet.title}" gezegeni güncellendi! ✨`);
  }, [isDemoMode, showToast]);

  const handlePlanetDeleted = useCallback((planetId: string) => {
    if (isDemoMode) {
      setDemoPlanetDetails((prev) => prev.filter((p) => p.id !== planetId));
    }
    setExoplanets((prev) => prev.filter((p) => p.id !== planetId));
    setSelectedPlanet(null);
    showToast('Anı gezegeni yörüngeden kaldırıldı.');
    // Silinen gezegenin puanı geri alınır; ışık buna göre güncellenir.
    refreshMyBrightness();
  }, [isDemoMode, showToast, refreshMyBrightness]);

  const handleExoplanetPremiumRequired = useCallback(() => {
    handlePremiumAction('exoplanet_view', () => {});
  }, [handlePremiumAction]);

  // ─── SEÇİLEN BAĞLI YILDIZIN GERÇEK IŞIĞI ────────────────────────────
  // Gök kubbe karosu bağlı yıldızın ışığını zaten taşır; puanı ayrıca sorulur.
  // Bağlı olmayan yıldızlar için sunucu gerçek değeri hiç vermez (gizemli ışık).
  const selectedCatalogId = selectedMacroStar?.catalog_id;
  const selectedIsFriend =
    !!selectedMacroStar &&
    selectedMacroStar.is_connected === true &&
    selectedMacroStar.is_claimed &&
    !selectedMacroStar.is_mine;
  useEffect(() => {
    if (isDemoMode || !selectedIsFriend || selectedCatalogId == null) return;
    let cancelled = false;
    starService
      .getStarBrightness(selectedCatalogId)
      .then((info) => {
        if (!cancelled && info) setSelectedStarLight({ catalogId: selectedCatalogId, info });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isDemoMode, selectedIsFriend, selectedCatalogId]);

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
        hapticSuccess();
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
        hapticError();
      }
      showToast(err?.message || 'Bağlantı isteği gönderilemedi.');
    } finally {
      setIsConnectingStar(false);
    }
  };

  // Yıldızın ışığı aktivite puanından gelir (gök kubbede başkalarının gördüğü değerle aynı).
  // Kıvılcım ışıma dalgası ve rezonansla hissedilir; yüklenene kadar ve demoda eski değer kullanılır.
  const starLight = myBrightness?.brightness ?? luminosityOverride;
  const selectedFriendLight =
    selectedMacroStar && selectedStarLight?.catalogId === selectedMacroStar.catalog_id ? selectedStarLight.info : null;
  const selectedStarLightText = selectedMacroStar
    ? describeStarLight(selectedMacroStar, myBrightness, selectedFriendLight)
    : null;
  const selectedStarLightValue = selectedMacroStar
    ? describeStarLightValue(selectedMacroStar, starLight ?? null, selectedFriendLight)
    : null;

  // Yıldızın içinde HUD her zaman koyu cam (uzay karanlıktır); gök kubbede tema izlenir.
  const isMicroScene = viewMode === 'micro' && starDetails !== null;
  const hudLight = isLight && !isMicroScene;
  const microViewportTop = microHeroBottom ?? insets.top + MICRO_HEADER_OFFSET + MICRO_HEADER_ESTIMATED_HEIGHT;
  const microViewportBottom = microDockTop ?? SCREEN_HEIGHT - insets.bottom - 10 - MICRO_DOCK_ESTIMATED_HEIGHT;

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
        <View
          style={[
            styles.toastContainer,
            // Yıldızın içinde başlığı örtmemesi için cam panelin hemen üstünde belirir.
            isMicroScene
              ? { bottom: SCREEN_HEIGHT - microViewportBottom + 12 }
              : { top: insets.top + (viewMode === 'macro' && starDetails !== null ? 98 : 64) },
            { zIndex: 999 },
          ]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.toastInner,
              {
                backgroundColor: hudLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 12, 30, 0.92)',
                borderColor: hudLight ? 'rgba(245, 158, 11, 0.5)' : 'rgba(245, 158, 11, 0.4)',
              },
            ]}
          >
            <Sparkles size={14} color="#F59E0B" />
            <Text
              style={[
                styles.toastText,
                { color: hudLight ? '#92400E' : '#FCD34D' },
              ]}
              numberOfLines={2}
            >
              {toastMessage}
            </Text>
          </View>
        </View>
      )}

      {/* ─── ÜST HUD BAR: GERİ DÖN, STAR INFO BADGE VE KOZMİK BAĞLAR ─── */}
      <View style={[styles.hudTopBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={[
            styles.backButton,
            {
              backgroundColor: hudLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(7, 5, 18, 0.65)',
              borderColor: hudLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.14)',
            },
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Geri Dön"
        >
          <ArrowLeft size={18} color={hudLight ? theme.text : '#FFFFFF'} />
        </TouchableOpacity>

        <View style={styles.badgeWrapper}>
          {/* Yıldızın içinde yıldız bilgisi aşağıdaki büyük başlıkta (MicroStarHeader) yer alır */}
          {isMicroScene ? null : starDetails ? (
            <StarInfoBadge
              starDetails={starDetails}
              luminosityOverride={starLight}
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
          {/* Gelen Bağlantı İstekleri Rozeti (Yalnızca makro sahnede) */}
          {!isMicroScene && starDetails && !isDemoMode && (
            <ConnectionRequestBadge
              pendingRequests={pendingRequests}
              onConnectionChanged={() => {
                // Yeni bağlanan yıldızın gerçek ışığı için gök kubbe karolarını tazele
                refreshSkyTiles();
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

          {/* KOZMİK BAĞLAR BUTONU — yalnızca tescilli yıldız varsa ve makro sahnede göster */}
          {!isMicroScene && starDetails && !isDemoMode && (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => setIsConnectionsModalOpen(true)}
              style={[
                styles.cosmicBagBtn,
                {
                  backgroundColor: hudLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(7, 5, 18, 0.65)',
                  borderColor: hudLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(236, 72, 153, 0.35)',
                },
              ]}
              accessibilityLabel="Kozmik Bağlar"
            >
              <Share2 size={16} color={theme.accent} />
              {pendingIncomingCount > 0 && (
                <View style={[styles.cosmicBagBadge, { backgroundColor: theme.accent }]}>
                  <Text style={styles.cosmicBagBadgeText}>{pendingIncomingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* ORTAM SESİ AÇ / KAPAT */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleToggleAmbient}
            style={[
              styles.cosmicBagBtn,
              {
                backgroundColor: hudLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(7, 5, 18, 0.65)',
                borderColor: hudLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.2)',
              },
            ]}
            accessibilityLabel={isAmbientMuted ? 'Sesi Aç' : 'Sesi Kapat'}
          >
            {isAmbientMuted ? (
              <VolumeX size={16} color={hudLight ? '#6B7280' : 'rgba(255, 255, 255, 0.65)'} />
            ) : (
              <Volume2 size={16} color={hudLight ? '#0284C7' : '#38BDF8'} />
            )}
          </TouchableOpacity>

          {/* Arama gök kubbeye aittir; yıldızın içinde gizlenir */}
          {!isMicroScene && (
            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => setIsSearchModalOpen(true)}
              style={[
                styles.cosmicBagBtn,
                {
                  backgroundColor: hudLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(7, 5, 18, 0.65)',
                  borderColor: hudLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(56, 189, 248, 0.35)',
                },
              ]}
              accessibilityLabel="Yıldız Ara"
            >
              <Search size={16} color={hudLight ? '#0284C7' : '#38BDF8'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─── ANA CANVAS SAHNESİ: MİKRO VEYA MAKRO ───────────────────── */}
      <View style={styles.canvasContainer}>
        {isMicroScene && starDetails ? (
          <MicroSystemCanvas
            starDetails={starDetails}
            exoplanets={exoplanets}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            viewportTop={microViewportTop}
            viewportBottom={microViewportBottom}
            luminosity={starLight}
            resonanceActive={isResonanceActive}
            highlightPlanetId={highlightPlanetId}
            sparkSignal={sparkSignal}
            myAvatarUrl={myAvatarUrl}
            partnerAvatarUrl={partnerAvatarUrl}
            onSelectCenterStar={handleMicroStarTouch}
            onSelectPlanet={handleOpenPlanet}
            paused={
              exoplanetModalMode !== null ||
              isCertificateModalOpen ||
              isConnectionsModalOpen ||
              premiumPaywallSource !== null
            }
          />
        ) : (
          <MacroSkyCanvas
            stars={skyTiles.stars}
            width={SCREEN_WIDTH}
            height={SCREEN_HEIGHT}
            connections={starConnections}
            myStarCoords={
              starDetails
                ? {
                    ra: Number(starDetails.ra),
                    dec: Number(starDetails.dec),
                    name: starDetails.custom_name || 'Bizim Yıldızımız',
                    luminosity: starLight ?? starDetails.luminosity_level ?? UNCLAIMED_STAR_BRIGHTNESS,
                    base_color: starDetails.base_color,
                    spectral_type: starDetails.spectral_type,
                    catalog_id: starDetails.catalog_id,
                    catalog_code: starDetails.catalog_code,
                    resonance_active: isResonanceActive,
                  }
                : undefined
            }
            initialCamera={{
              centerRa: starDetails ? Number(starDetails.ra) : 180,
              centerDec: starDetails ? Number(starDetails.dec) : 0,
              zoom: SKY_OVERVIEW_ZOOM,
            }}
            targetCamera={flyToTarget}
            onTargetCameraConsumed={() => setFlyToTarget(undefined)}
            onBoundsChange={skyTiles.onBoundsChange}
            onCameraChange={handleCameraChange}
            onWishGranted={() => showToast('Dileğin gökyüzüne yazıldı 🌠')}
            onSelectStar={(star) => {
              if (!star) {
                setSelectedMacroStar(null);
                return;
              }
              if (typeof star !== 'object' || !('is_claimed' in star)) return;
              if (isDemoMode) {
                // Demo / misafir modu: ClaimStarModal (radar/sertifika) AÇILMAZ!
                if (star.is_claimed) {
                  // Tescilli yabancı yıldız: sadece bilgi kartı
                  setSelectedMacroStar(star);
                } else {
                  // Boşta olan yıldıza tıklandı: Bilgi kartını aç (kart içinde yönlendirme butonu var)
                  setDemoTargetStar(star);
                  setSelectedMacroStar(star);
                }
                return;
              }

              if (star.is_mine) {
                // Kendi yıldızı: Bilgi kartını aç (kullanıcı kart içinden mikro sisteme veya sertifikaya gidebilir)
                setSelectedMacroStar(star);
              } else if (star.is_claimed) {
                // Başka çiftin tescilli yıldızı: bilgi kartı, sahiplenme YOK
                setSelectedMacroStar(star);
              } else if (starDetails !== null) {
                // Kullanıcının zaten yıldızı var, boş yıldıza tıklandı:
                // Bilgi kartını aç (yıldız detaylarını inceler, kart altında kural uyarısı verilir)
                setSelectedMacroStar(star);
              } else {
                // Kullanıcının yıldızı yok, boş yıldıza tıklandı: Bilgi kartını aç (kart içinde 'Bu Yıldızı Seç 💫' butonu yer alır)
                setClaimTargetStar(star);
                setSelectedMacroStar(star);
              }
            }}
          />
        )}
      </View>

      {/* ─── YILDIZIN İÇİ: BAŞLIK VE CAM PANEL ───────────────────────── */}
      {isMicroScene && starDetails && (
        <MicroStarHeader
          starDetails={starDetails}
          luminosity={starLight ?? starDetails.luminosity_level}
          resonanceActive={isResonanceActive}
          planetCount={exoplanets.length}
          top={insets.top + MICRO_HEADER_OFFSET}
          onPressCertificate={handleOpenCertificate}
          onLayout={handleMicroHeroLayout}
        />
      )}
      {isMicroScene && (
        <MicroSystemDock
          planets={exoplanets}
          isPremium={isPremium}
          bottomInset={insets.bottom}
          highlightPlanetId={highlightPlanetId}
          onOpenPlanet={handleOpenPlanet}
          onCreatePlanet={handleCreatePlanet}
          onExitToSky={handleToggleViewMode}
          onLayout={handleMicroDockLayout}
        />
      )}

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
        <View
          style={[
            styles.macroStarCard,
            {
              bottom: insets.bottom + 16,
              backgroundColor: isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(10, 8, 24, 0.94)',
              borderColor: selectedMacroStar.is_mine
                ? 'rgba(245, 158, 11, 0.6)'
                : isLight
                ? 'rgba(0, 0, 0, 0.1)'
                : 'rgba(56, 189, 248, 0.35)',
            },
            selectedMacroStar.is_mine && (isLight ? { backgroundColor: '#FFFDF7' } : styles.macroStarCardMine),
          ]}
        >
          <View style={styles.macroStarHeader}>
            <View style={styles.macroStarTitleRow}>
              <View
                style={[
                  styles.macroStarColorDot,
                  {
                    backgroundColor:
                      selectedMacroStar.base_color || starDetails?.base_color || '#F59E0B',
                  },
                ]}
              />
              <Text
                style={[
                  styles.macroStarTitle,
                  { color: theme.text },
                  selectedMacroStar.is_mine && [styles.macroStarTitleMine, isLight && { color: '#B45309' }],
                ]}
              >
                {selectedMacroStar.is_mine
                  ? `⭐ ${selectedMacroStar.custom_name || starDetails?.custom_name || 'Bizim Yıldızımız'}`
                  : (selectedMacroStar.custom_name ||
                    (selectedMacroStar.common_name
                      ? `${selectedMacroStar.common_name} (${selectedMacroStar.catalog_code})`
                      : selectedMacroStar.catalog_code))}
              </Text>
              {selectedMacroStar.is_mine ? (
                <View style={styles.myStarBadge}>
                  <Text style={styles.myStarBadgeText}>Bizim Yıldızımız 💫</Text>
                </View>
              ) : selectedMacroStar.is_claimed ? (
                <View style={styles.claimedBadge}>
                  <Text style={styles.claimedBadgeText}>
                    🔒 Tescilli{selectedMacroStar.owner_initials ? ` • (${selectedMacroStar.owner_initials})` : ''}
                  </Text>
                </View>
              ) : (
                <View style={styles.availableBadge}>
                  <Text style={styles.availableBadgeText}>Boşta</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => setSelectedMacroStar(null)}
              style={[
                styles.macroStarCloseBtn,
                { backgroundColor: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)' },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.macroStarDetailsRow,
              { backgroundColor: isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)' },
            ]}
          >
            <Text style={[styles.macroStarDetailText, { color: theme.textSecondary }]}>
              Tayf: <Text style={styles.macroStarHighlight}>{selectedMacroStar.spectral_type}</Text>
            </Text>
            <Text style={[styles.macroStarDetailText, { color: theme.textSecondary }]}>
              Parlaklık: <Text style={styles.macroStarHighlight}>{selectedStarLightValue}</Text>
            </Text>
            <Text style={[styles.macroStarDetailText, { color: theme.textSecondary }]}>
              RA/DEC: <Text style={styles.macroStarHighlight}>{Number(selectedMacroStar.ra).toFixed(1)}° / {Number(selectedMacroStar.dec).toFixed(1)}°</Text>
            </Text>
          </View>

          {/* Işık açıklaması: kendi/bağlı yıldızda puan, sahipsizde sabit ışık, diğerlerinde gizemli */}
          {selectedStarLightText && (
            <View
              style={[
                styles.macroStarLightRow,
                { backgroundColor: isLight ? 'rgba(245, 158, 11, 0.08)' : 'rgba(251, 191, 36, 0.08)' },
              ]}
            >
              <Sparkles size={12} color={isLight ? '#B45309' : '#FBBF24'} />
              <Text style={[styles.macroStarLightText, { color: isLight ? '#92400E' : '#FDE68A' }]}>
                {selectedStarLightText}
              </Text>
            </View>
          )}

          {/* Aksiyon */}
          {selectedMacroStar.is_mine ? (
            <View style={styles.myStarActionsRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  hapticStamp();
                  setViewMode('micro');
                  setSelectedMacroStar(null);
                }}
                style={styles.enterMicroBtn}
              >
                <Orbit size={15} color="#030207" />
                <Text style={styles.enterMicroBtnText}>Yıldızın İçine Gir 🪐</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  setIsCertificateModalOpen(true);
                }}
                style={styles.viewCertBtn}
              >
                <Award size={15} color="#FBBF24" />
                <Text style={styles.viewCertBtnText}>Sertifika 📜</Text>
              </TouchableOpacity>
            </View>
          ) : !selectedMacroStar.is_claimed && isDemoMode ? (
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
          ) : selectedMacroStar.catalog_code?.startsWith('SOL-') ? (
            // Güneş Sistemi Referans Cismi
            <View
              style={[
                styles.solarObjectBanner,
                isLight && {
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  borderColor: 'rgba(217, 119, 6, 0.35)',
                },
              ]}
            >
              <Sun size={14} color={isLight ? '#B45309' : '#FBBF24'} />
              <Text
                style={[
                  styles.solarObjectText,
                  isLight && { color: '#92400E' },
                ]}
              >
                {SOLAR_DESCRIPTIONS[selectedMacroStar.catalog_code] || 'Güneş Sistemimizin kadim bir yolcusu ✨'}
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

      {/* ─── ALT KONTROL BAR VE AKSİYON BUTONLARI (Gök Kubbe) ──────────── */}
      {/* Yıldızın içinde bu çubuğun yerini MicroSystemDock alır. */}
      {!isMicroScene && !selectedMacroStar && (
        <View
          style={[
            styles.bottomControlBar,
            { paddingBottom: insets.bottom + 16 },
            starDetails !== null && !showHomeRadar && { justifyContent: 'flex-end' },
          ]}
        >
          {/* YILDIZI OLMAYAN KULLANICI İÇİN: GÖK KUBBE REHBER KARTI */}
          {starDetails === null && (
            <View
              style={[
                styles.onboardingGuideCard,
                {
                  backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 12, 30, 0.92)',
                  borderColor: isLight ? 'rgba(245, 158, 11, 0.35)' : 'rgba(251, 191, 36, 0.3)',
                },
              ]}
            >
              <View style={styles.onboardingGuideHeader}>
                <View style={styles.onboardingGuideIconWrap}>
                  <Sparkles size={16} color="#FBBF24" />
                </View>
                <Text style={[styles.onboardingGuideTitle, { color: theme.text }]}>
                  Aşkınızın Yıldızını Seçin ✨
                </Text>
              </View>

              <Text style={[styles.onboardingGuideSubtitle, { color: theme.textSecondary, marginBottom: 0 }]}>
                Gökyüzünde özgürce gezinin; aşkınıza layık boşta parıldayan bir yıldıza dokunup &quot;Bu Yıldızı Seç&quot; ile çiftinize tescil edin.
              </Text>
            </View>
          )}

          {/* YILDIZI OLAN KULLANICI: YALNIZCA YILDIZDAN UZAKLAŞTIĞINDA TEK BİR 'YILDIZIMIZA DÖN' BUTONU */}
          {starDetails !== null && showHomeRadar && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleFocusMyStar}
              style={styles.returnHomeBtn}
              accessibilityLabel="Yıldızımıza Dön"
            >
              <LinearGradient
                colors={['#10B981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.returnHomeGradient}
              >
                <Sparkles size={15} color="#FFFFFF" />
                <Text style={styles.returnHomeBtnText}>Yıldızımıza Dön ✨</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* SAĞ ALT FAB: MAKRO / MİKRO MOD GEÇİŞİ (Yalnızca yıldızı olan kullanıcılar için, tekil ve sade) */}
          {starDetails !== null && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleToggleViewMode}
              style={[
                styles.modeSwitchFab,
                {
                  backgroundColor: isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(15, 12, 30, 0.88)',
                  borderColor: isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(251, 191, 36, 0.35)',
                },
              ]}
              accessibilityLabel={viewMode === 'micro' ? 'Gök Kubbeye Çık' : 'Yıldızın İçine Gir'}
            >
              {viewMode === 'micro' ? (
                <Globe size={20} color="#38BDF8" />
              ) : (
                <Orbit size={20} color="#FBBF24" />
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

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
          isPremium={isPremium}
          onPremiumRequired={() => handlePremiumAction('star_claim', () => {})}
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
          isLoadingDetails={isPlanetLoading}
          onClose={handleCloseExoplanetModal}
          onPlanetCreated={handlePlanetCreated}
          onPlanetUpdated={handlePlanetUpdated}
          onPlanetDeleted={handlePlanetDeleted}
          isPremium={isPremium}
          onPremiumRequired={handleExoplanetPremiumRequired}
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
            // Aktif bağlantıları ve rozeti yenile (canvas güncellemesi için); bağlantı
            // değişince yıldızların gerçek/gizemli ışığı da değişir
            refreshSkyTiles();
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
          const sec = SKY_SECTORS[sectorId];
          if (sec) {
            setFlyToTarget({
              centerRa: sec.center.ra,
              centerDec: sec.center.dec,
              zoom: 1.8,
            });
            setViewMode('macro');
            showToast(`${sec.name} sektörüne yönlendirildiniz. Boş bir yıldıza dokunarak seçebilirsiniz ✨`);
          }
        }}
      />
      {/* ─── ARAMA MODAL'I ────────────────────────────────────────────── */}

      <SearchStarModal
        visible={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelectStar={(item) => {
          setIsSearchModalOpen(false);
          setViewMode('macro');

          // 1. Check if it matches a solar system body (Güneş, gezegenler, Ay)
          const solarObj = SOLAR_SYSTEM_OBJECTS.find(
            (s) => s.catalog_code === item.catalog_code
          );
          // 2. Check if already loaded in the streamed sky tiles
          const existing = skyTiles.stars.find(
            (s) => s.catalog_code === item.catalog_code
          );

          const starItem: ViewportStarItem =
            solarObj ||
            existing || {
              catalog_id: Number(item.entity_id) || 0,
              catalog_code: item.catalog_code,
              common_name: item.display_name,
              ra: Number(item.ra),
              dec: Number(item.dec),
              magnitude: 2.0,
              spectral_type: 'G' as const,
              base_color: '#FDE68A',
              is_claimed: true,
              is_mine: item.is_own_star,
              custom_name: item.display_name,
              luminosity_level: 1.0,
              resonance_active: false,
            };

          setSelectedMacroStar(starItem);

          setFlyToTarget({
            centerRa: Number(item.ra),
            centerDec: Number(item.dec),
            // Güneş Sistemi cisminde daha uzaktan bak: ~38° çapındaki tüm sistem ekrana sığsın.
            zoom: solarObj ? 1.3 : 2.5,
            nonce: Date.now(),
          });
        }}
      />
      <PremiumPaywall
        visible={premiumPaywallSource !== null}
        onClose={() => setPremiumPaywallSource(null)}
        featureSource={premiumPaywallSource ?? undefined}
        gender={profile?.gender}
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
    minWidth: 0,
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
    zIndex: 999,
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
  returnHomeBtn: {
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  returnHomeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 44,
  },
  returnHomeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
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
  macroStarCardMine: {
    borderColor: 'rgba(245, 158, 11, 0.6)',
    backgroundColor: 'rgba(18, 14, 5, 0.95)',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.25,
  },
  macroStarTitleMine: {
    color: '#FDE68A',
  },
  myStarBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 0.8,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  myStarBadgeText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '700',
  },
  myStarActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  enterMicroBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 10,
  },
  enterMicroBtnText: {
    color: '#030207',
    fontSize: 13,
    fontWeight: '700',
  },
  viewCertBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  viewCertBtnText: {
    color: '#FDE68A',
    fontSize: 13,
    fontWeight: '700',
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
  macroStarLightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  macroStarLightText: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
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
  solarObjectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.45)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  solarObjectText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
    lineHeight: 16,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
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
  onboardingGuideCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  onboardingGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  onboardingGuideIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardingGuideTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  onboardingGuideSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    marginBottom: 12,
  },
  onboardingRadarBtn: {
    width: '100%',
    height: 42,
    borderRadius: 12,
    overflow: 'hidden',
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
