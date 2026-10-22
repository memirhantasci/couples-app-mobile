/**
 * @file StarConnectionModal.tsx
 * @module modules/stars/components
 * @description Çiftler arası gökyüzü yıldız bağlantıları yönetim modalı.
 *
 * Üç Ana Sekme:
 * 1. Çift Kodu:
 *    Kendi çift kodumuz (kopyalanabilir) + arkadaşın 6 haneli çift kodunu girip
 *    "Bağlantı Kur" ile o çiftin yıldızına tek adımda bağlantı isteği gönderme.
 *    Karşı çift daha önce istek göndermişse aynı buton isteği onaylar.
 *
 * 2. Yıldız Adı:
 *    🔍 [Yıldız adı girin...]
 *    → Sonuçlar: custom_name + catalog_code
 *    → Her sonuçta "Bağlantı Öner" butonu
 *    → Limit doluysa (3/3): "Maksimum 3 bağlantı limitine ulaştınız"
 *
 * 3. Gökyüzü:
 *    Gök kubbe haritası üzerinden doğrudan tescilli yıldız seçimi için rehber
 *    ve "Gökyüzüne Git 🌌" yönlendirmesi.
 *
 * Aktif bağlar ve onay bekleyen (giden) istekler sekmelerin altında listelenir.
 * Tüm tema modlarıyla (Beyaz, Mavi, Pembe, Gece) tam uyumludur.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { appAlert } from '@/lib/dialog';
import { DialogHost } from '@/components/ui/DialogHost';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { hapticSuccess, hapticError, hapticSelection } from '@/lib/soundEffects';
import * as Clipboard from 'expo-clipboard';
import {
  X,
  Share2,
  Search,
  Sparkles,
  AlertCircle,
  Link2,
  Trash2,
  Globe,
  Compass,
  CheckCircle2,
  Copy,
  KeyRound,
  Clock,
  ClipboardPaste,
  type LucideIcon,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { starService } from '../api/starService';
import {
  PAIRING_CODE_LENGTH,
  extractPairingCode,
  isCompletePairingCode,
  normalizePairingCode,
} from '../utils/pairingCode';
import type {
  ActiveStarConnection,
  PendingConnectionDetail,
  StarSearchResult,
} from '../types/star.types';

export interface StarConnectionModalProps {
  readonly visible: boolean;
  readonly coupleId: number;
  readonly onClose: () => void;
  /** Bağlantı eklendiğinde / silindiğinde üst bileşeni bilgilendirir (canvas güncelleme). */
  readonly onConnectionChanged?: () => void;
  /** Kullanıcı gökyüzünde seç sekmesinden doğrudan haritaya gitmek istediğinde tetiklenir. */
  readonly onNavigateToSky?: () => void;
}

type TabType = 'code' | 'search' | 'sky';

const TABS: readonly { key: TabType; label: string; Icon: LucideIcon }[] = [
  { key: 'code', label: 'Çift Kodu', Icon: KeyRound },
  { key: 'search', label: 'Yıldız Adı', Icon: Search },
  { key: 'sky', label: 'Gökyüzü', Icon: Compass },
];

const CODE_CELL_INDEXES = Array.from({ length: PAIRING_CODE_LENGTH }, (_, index) => index);

export const StarConnectionModal: React.FC<StarConnectionModalProps> = ({
  visible,
  coupleId,
  onClose,
  onConnectionChanged,
  onNavigateToSky,
}) => {
  const { theme, isLight } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('code');
  const [isLoading, setIsLoading] = useState(false);
  /** İlk yükleme bitince true olur; sonraki yenilemeler (istek sonrası) içeriği yükleme ekranına çevirmez. */
  const [hasLoaded, setHasLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Veri durumları
  const [activeConnections, setActiveConnections] = useState<ActiveStarConnection[]>([]);
  const [pendingConnections, setPendingConnections] = useState<PendingConnectionDetail[]>([]);
  const [canConnect, setCanConnect] = useState(true);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  // Arama durumu
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<StarSearchResult[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Arkadaşın çift koduyla bağlanma durumu
  const [friendCode, setFriendCode] = useState('');
  const [isCodeFocused, setIsCodeFocused] = useState(false);
  const [isConnectingByCode, setIsConnectingByCode] = useState(false);
  /** Kodla değil yalnızca adıyla eşleşen (çok nadir) yıldızlar: kullanıcı elle seçer. */
  const [codeCandidates, setCodeCandidates] = useState<StarSearchResult[]>([]);
  const codeInputRef = useRef<TextInput>(null);

  // Tekil işlem yükleniyor durumu
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // ─── VERİ YÜKLEME ──────────────────────────────────────────────────
  // Yükleme durumunu çağıran açar (açılışta render sırasında, eylem sonrası loadData içinde);
  // sonuç ve hata her zaman istek bittikten sonra yazılır.
  const fetchData = useCallback(
    () =>
      Promise.all([
        starService.getMyStarConnections(),
        starService.getPendingConnections(),
        starService.checkConnectionLimit(coupleId).catch(() => true),
        supabase.from('couples').select('pairing_code').eq('id', coupleId).maybeSingle(),
      ])
        .then(([connections, pending, limitOk, coupleRow]) => {
          setActiveConnections(connections);
          setPendingConnections(pending);
          setCanConnect(limitOk);
          setPairingCode(coupleRow.data?.pairing_code ?? null);
          setHasLoaded(true);
        })
        .catch((err: any) => {
          setErrorMessage(err?.message || 'Bağlantı bilgileri yüklenirken hata oluştu.');
        })
        .finally(() => {
          setIsLoading(false);
        }),
    [coupleId]
  );

  const loadData = useCallback(async () => {
    if (!visible) return;
    setIsLoading(true);
    setErrorMessage(null);
    await fetchData();
  }, [visible, fetchData]);

  // Açılışta yükleme başlar; kapanınca ekran sıfırlanır (bir sonraki açılış temiz başlasın)
  const [wasVisible, setWasVisible] = useState(false);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) {
      setIsLoading(true);
      setErrorMessage(null);
    } else {
      setSearchQuery('');
      setSearchResults([]);
      setSearchPerformed(false);
      setFriendCode('');
      setCodeCandidates([]);
      setIsCodeFocused(false);
      setHasLoaded(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      setActiveTab('code');
      setCodeCopied(false);
    }
  }

  useEffect(() => {
    if (visible) void fetchData();
  }, [visible, fetchData]);

  // ─── ÇİFT KODUNU KOPYALA ─────────────────────────────────────────────
  const handleCopyPairingCode = useCallback(async () => {
    if (!pairingCode) return;
    try {
      await Clipboard.setStringAsync(pairingCode);
      if (Platform.OS !== 'web') {
        hapticSuccess();
      }
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2200);
    } catch {
      setErrorMessage('Kod kopyalanamadı.');
    }
  }, [pairingCode]);

  // ─── ARAMA ─────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setErrorMessage('En az 2 karakter giriniz.');
      return;
    }
    setIsSearching(true);
    setErrorMessage(null);
    setSearchPerformed(true);
    try {
      const results = await starService.searchStarByName(trimmed);
      setSearchResults(results);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Arama sırasında hata oluştu.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // ─── BAĞLANTI İSTEĞİ GÖNDER ─────────────────────────────────────────
  // Hem arama sonuçlarındaki "Bağlantı Öner" hem de çift koduyla "Bağlantı Kur" bu akışı kullanır.
  // Karşı çift zaten bize istek göndermişse yeni istek açmak yerine o istek onaylanır.
  const sendConnectionRequest = useCallback(
    async (target: StarSearchResult): Promise<boolean> => {
      if (!canConnect || activeConnections.length >= 3) {
        setErrorMessage('Maksimum 3 bağlantı limitine ulaştınız.');
        return false;
      }
      if (activeConnections.some((c) => c.other_star_id === target.star_id)) {
        setErrorMessage(`"${target.custom_name}" yıldızıyla zaten bağlısınız ✨`);
        return false;
      }
      const existing = pendingConnections.find((p) => p.other_star_id === target.star_id);
      if (existing && !existing.is_incoming) {
        setErrorMessage(`"${target.custom_name}" yıldızına zaten bir istek gönderdiniz; onay bekleniyor.`);
        return false;
      }

      setActionLoadingId(target.star_id);
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        if (existing) {
          await starService.respondToConnection(existing.connection_id, true);
          setSuccessMessage(`"${target.custom_name}" ile kozmik bağ kuruldu ✨`);
        } else {
          await starService.requestStarConnection(target.star_id);
          setSuccessMessage(`"${target.custom_name}" yıldızına bağlantı isteği gönderildi ✨`);
        }
        if (Platform.OS !== 'web') {
          hapticSuccess();
        }
        await loadData();
        onConnectionChanged?.();
        return true;
      } catch (err: any) {
        if (Platform.OS !== 'web') {
          hapticError();
        }
        setErrorMessage(err?.message || 'İstek gönderilemedi.');
        return false;
      } finally {
        setActionLoadingId(null);
      }
    },
    [canConnect, activeConnections, pendingConnections, loadData, onConnectionChanged]
  );

  const handleSendRequest = useCallback(
    (target: StarSearchResult) => {
      void sendConnectionRequest(target);
    },
    [sendConnectionRequest]
  );

  // ─── ARKADAŞIN ÇİFT KODUYLA BAĞLAN ──────────────────────────────────
  const handleFriendCodeChange = useCallback((text: string) => {
    setFriendCode(normalizePairingCode(text));
    setErrorMessage(null);
    setCodeCandidates([]);
  }, []);

  const handlePasteFriendCode = useCallback(async () => {
    try {
      const code = extractPairingCode(await Clipboard.getStringAsync());
      if (!code) {
        setErrorMessage('Panoda bir çift kodu bulunamadı.');
        return;
      }
      if (Platform.OS !== 'web') {
        hapticSelection();
      }
      setFriendCode(code);
      setErrorMessage(null);
      setCodeCandidates([]);
    } catch {
      setErrorMessage('Pano okunamadı.');
    }
  }, []);

  const handleConnectByCode = useCallback(async () => {
    if (isConnectingByCode) return;
    const code = friendCode;
    if (!isCompletePairingCode(code)) {
      setErrorMessage(`Çift kodu ${PAIRING_CODE_LENGTH} haneli olmalıdır.`);
      return;
    }
    if (pairingCode && code === pairingCode.toUpperCase()) {
      setErrorMessage('Bu sizin kendi çift kodunuz. Bağ kurmak istediğiniz çiftin kodunu girin.');
      return;
    }
    if (!canConnect || activeConnections.length >= 3) {
      setErrorMessage('Maksimum 3 bağlantı limitine ulaştınız.');
      return;
    }

    setIsConnectingByCode(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setCodeCandidates([]);
    try {
      const { star, similar } = await starService.findStarByPairingCode(code);
      if (!star) {
        if (Platform.OS !== 'web') {
          hapticError();
        }
        if (similar.length > 0) {
          setCodeCandidates(similar);
          setErrorMessage('Bu kodla eşleşen bir çift bulunamadı. Adı benzeyen yıldızlar aşağıda listelendi.');
        } else {
          setErrorMessage(
            'Bu koda ait bir yıldız bulunamadı. Kodu kontrol edin; karşı çiftin de bir yıldız tescil etmiş olması gerekir.'
          );
        }
        return;
      }
      if (await sendConnectionRequest(star)) {
        setFriendCode('');
        codeInputRef.current?.blur();
      }
    } catch (err: any) {
      if (Platform.OS !== 'web') {
        hapticError();
      }
      setErrorMessage(err?.message || 'Çift koduyla arama sırasında hata oluştu.');
    } finally {
      setIsConnectingByCode(false);
    }
  }, [
    isConnectingByCode,
    friendCode,
    pairingCode,
    canConnect,
    activeConnections.length,
    sendConnectionRequest,
  ]);

  // ─── BAĞLANTIYI KOPAR / İSTEĞİ İPTAL ET ──────────────────────────
  const handleRemove = useCallback(
    (connectionId: string, starName: string, isPending: boolean) => {
      const doRemove = async () => {
        setActionLoadingId(connectionId);
        setErrorMessage(null);
        setSuccessMessage(null);
        try {
          await starService.removeStarConnection(connectionId);
          if (Platform.OS !== 'web') {
            hapticSuccess();
          }
          setSuccessMessage(
            isPending
              ? 'Bağlantı isteği iptal edildi.'
              : `"${starName}" ile olan kozmik bağ sonlandırıldı.`
          );
          await loadData();
          onConnectionChanged?.();
        } catch (err: any) {
          setErrorMessage(err?.message || 'İşlem gerçekleştirilemedi.');
        } finally {
          setActionLoadingId(null);
        }
      };

      if (Platform.OS === 'web') {
        const msg = isPending
          ? 'Bu bağlantı isteğini iptal etmek istediğinize emin misiniz?'
          : `"${starName}" ile aranızdaki yıldız bağını koparmak istiyor musunuz?`;
        if (window.confirm(msg)) doRemove();
      } else {
        appAlert(
          isPending ? 'İsteği İptal Et' : 'Bağlantıyı Kopar',
          isPending
            ? 'Bu bağlantı isteğini iptal etmek istediğinize emin misiniz?'
            : `"${starName}" ile aranızdaki yıldız bağını koparmak istiyor musunuz?`,
          [
            { text: 'Vazgeç', style: 'cancel' },
            { text: isPending ? 'İptal Et' : 'Kopar', style: 'destructive', onPress: doRemove },
          ]
        );
      }
    },
    [loadData, onConnectionChanged]
  );

  const isLimitReached = activeConnections.length >= 3;
  /** Karşı çiftin onayını bekleyen, bizim gönderdiğimiz istekler (gelenler üst çubuktaki rozetten yönetilir). */
  const outgoingPending = pendingConnections.filter((p) => !p.is_incoming);
  const canSubmitCode = isCompletePairingCode(friendCode) && !isLimitReached && !isConnectingByCode;

  /** Yıldız sonuç kartı: ad + katalog kodu + duruma göre (Bağlı / İstek Gönderildi / Bağlantı Öner|Onayla) eylem. */
  const renderStarResultCard = (star: StarSearchResult) => {
    const isAlreadyConnected = activeConnections.some((c) => c.other_star_id === star.star_id);
    const pendingEntry = pendingConnections.find((p) => p.other_star_id === star.star_id);
    const isRequestSent = pendingEntry !== undefined && !pendingEntry.is_incoming;
    const isRequestReceived = pendingEntry?.is_incoming === true;
    const isActionLoading = actionLoadingId === star.star_id;

    return (
      <View
        key={star.star_id}
        style={[
          styles.starResultCard,
          {
            backgroundColor: theme.unitBg,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <View style={styles.starResultInfo}>
          <View style={styles.starNameRow}>
            <Sparkles size={14} color="#F59E0B" />
            <Text style={[styles.resultStarName, { color: theme.text }]}>{star.custom_name}</Text>
          </View>
          <Text style={[styles.resultCatalogCode, { color: theme.textMuted }]}>{star.catalog_code}</Text>
        </View>

        {isAlreadyConnected ? (
          <View style={styles.connectedBadge}>
            <Text style={styles.connectedBadgeText}>Bağlı ✨</Text>
          </View>
        ) : isRequestSent ? (
          <View
            style={[
              styles.pendingBadge,
              { backgroundColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255, 255, 255, 0.08)' },
            ]}
          >
            <Text style={[styles.pendingBadgeText, { color: theme.textSecondary }]}>İstek Gönderildi</Text>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={isLimitReached || isActionLoading}
            onPress={() => handleSendRequest(star)}
            style={[
              styles.proposeBtn,
              isLimitReached && styles.proposeBtnDisabled,
            ]}
          >
            {isActionLoading ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <LinearGradient
                colors={
                  isLimitReached
                    ? isLight
                      ? ['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.05)']
                      : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                    : [theme.accent, theme.accentLight || theme.accent]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.proposeBtnGradient}
              >
                <Text
                  style={[
                    styles.proposeBtnText,
                    isLimitReached && (isLight ? { color: theme.textMuted } : styles.proposeBtnTextDisabled),
                  ]}
                >
                  {isLimitReached
                    ? 'Limit Dolu (3/3)'
                    : isRequestReceived
                      ? 'Bağı Onayla ✨'
                      : 'Bağlantı Öner ✨'}
                </Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* iOS: klavye açılınca sayfa yukarı itilir; Android: içerikteki KeyboardAwareScrollView odaktaki alanı görünür tutar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.overlay, { backgroundColor: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(3, 2, 7, 0.85)' }]}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
              shadowColor: theme.accent,
            },
          ]}
        >
          {/* ─── BAŞLIK ─────────────────────────────────────────────── */}
          <View
            style={[
              styles.headerRow,
              { borderBottomColor: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)' },
            ]}
          >
            <View style={styles.titleBlock}>
              <View style={styles.titleRow}>
                <Share2 size={18} color={theme.accent} />
                <Text style={[styles.title, { color: theme.text }]}>Kozmik Bağlar</Text>
              </View>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Takımyıldızı arkadaşlıkları • ({activeConnections.length}/3 aktif bağ)
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeButton,
                { backgroundColor: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)' },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* ─── 3 SEKME BUTONLARI ──────────────────────────────────── */}
          <View style={styles.tabBar}>
            {TABS.map(({ key, label, Icon }) => {
              const isActive = activeTab === key;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => {
                    setActiveTab(key);
                    setErrorMessage(null);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  style={[
                    styles.tabButton,
                    {
                      backgroundColor: isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.04)',
                      borderColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)',
                    },
                    isActive && {
                      backgroundColor: theme.pillAccentBg,
                      borderColor: theme.accent,
                    },
                  ]}
                >
                  <Icon size={14} color={isActive ? theme.accent : theme.textSecondary} />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.tabText,
                      { color: theme.textSecondary },
                      isActive && [styles.tabTextActive, { color: theme.text }],
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ─── GERİ BİLDİRİM BANNERLARI ───────────────────────────── */}
          {errorMessage && (
            <View style={styles.errorBanner}>
              <AlertCircle size={14} color="#EF4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {successMessage && (
            <View style={styles.successBanner}>
              <CheckCircle2 size={14} color="#10B981" />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          )}

          {/* ─── LİMİT UYARISI BANNERI (3/3) ────────────────────────── */}
          {isLimitReached && (
            <View style={styles.limitWarningBanner}>
              <Sparkles size={14} color="#FBBF24" />
              <Text style={styles.limitWarningText}>
                Maksimum 3 bağlantı limitine ulaştınız. Yeni bir bağ kurmak için mevcut bağlarınızdan birini sonlandırabilirsiniz.
              </Text>
            </View>
          )}

          {/* ─── SEKME İÇERİKLERİ ───────────────────────────────────── */}
          <KeyboardAwareScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.contentContainer}
            enableOnAndroid
            extraScrollHeight={24}
            keyboardShouldPersistTaps="handled"
          >
            {isLoading && !hasLoaded ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={theme.accent} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Yıldız bağları yükleniyor...</Text>
              </View>
            ) : activeTab === 'code' ? (
              /* ─── SEKME 1: ÇİFT KODU ─────────────────────────────── */
              <View style={styles.codeSection}>
                {/* Kendi kodumuz: arkadaşa vermek için dokununca kopyalanır */}
                {pairingCode && (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={handleCopyPairingCode}
                    accessibilityLabel={`Bizim çift kodumuz ${pairingCode}, kopyalamak için dokunun`}
                    style={[
                      styles.pairingCodeCard,
                      {
                        backgroundColor: isLight ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.12)',
                        borderColor: isLight ? 'rgba(99, 102, 241, 0.35)' : 'rgba(129, 140, 248, 0.35)',
                      },
                    ]}
                  >
                    <View style={styles.pairingCodeIconBadge}>
                      <KeyRound size={15} color={isLight ? '#4F46E5' : '#818CF8'} />
                    </View>
                    <View style={styles.pairingCodeTextBlock}>
                      <Text style={[styles.pairingCodeLabel, { color: theme.textSecondary }]}>
                        Bizim Çift Kodumuz • arkadaşına ver
                      </Text>
                      <Text style={[styles.pairingCodeValue, { color: theme.text }]}>{pairingCode}</Text>
                    </View>
                    {codeCopied ? (
                      <CheckCircle2 size={18} color="#10B981" />
                    ) : (
                      <Copy size={18} color={theme.textSecondary} />
                    )}
                  </TouchableOpacity>
                )}

                {/* Arkadaşın kodunu gir → Bağlantı Kur */}
                <View
                  style={[
                    styles.friendCodeCard,
                    { backgroundColor: theme.unitBg, borderColor: theme.cardBorder },
                  ]}
                >
                  <View style={styles.friendCodeHeader}>
                    <View
                      style={[
                        styles.friendCodeIconBadge,
                        { backgroundColor: theme.pillAccentBg, borderColor: theme.pillAccentBorder },
                      ]}
                    >
                      <Link2 size={16} color={theme.accent} />
                    </View>
                    <View style={styles.friendCodeTextBlock}>
                      <Text style={[styles.friendCodeTitle, { color: theme.text }]}>Arkadaşının Çift Kodu</Text>
                      <Text style={[styles.friendCodeHint, { color: theme.textSecondary }]}>
                        Bağ kurmak istediğiniz çiftin {PAIRING_CODE_LENGTH} haneli kodunu girin; yıldızlarınız gökyüzünde
                        bir takımyıldızı çizgisiyle birleşsin.
                      </Text>
                    </View>
                  </View>

                  {/* 6 hücreli kod göstergesi; gerçek giriş üstteki şeffaf TextInput'tur (yapıştırma ve otomatik doldurma çalışır) */}
                  <View style={styles.codeInputWrap}>
                    <View style={styles.codeCells} pointerEvents="none">
                      {CODE_CELL_INDEXES.map((index) => {
                        const char = friendCode[index] ?? '';
                        const isCurrentCell =
                          isCodeFocused && index === Math.min(friendCode.length, PAIRING_CODE_LENGTH - 1);
                        return (
                          <View
                            key={index}
                            style={[
                              styles.codeCell,
                              {
                                backgroundColor: theme.inputBg,
                                borderColor: char ? theme.accent : theme.inputBorder,
                              },
                              isCurrentCell && {
                                borderColor: theme.accent,
                                borderWidth: 2,
                                backgroundColor: theme.pillAccentBg,
                              },
                            ]}
                          >
                            <Text style={[styles.codeCellText, { color: theme.text }]}>{char}</Text>
                          </View>
                        );
                      })}
                    </View>
                    <TextInput
                      ref={codeInputRef}
                      value={friendCode}
                      onChangeText={handleFriendCodeChange}
                      onFocus={() => setIsCodeFocused(true)}
                      onBlur={() => setIsCodeFocused(false)}
                      onSubmitEditing={handleConnectByCode}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      spellCheck={false}
                      autoComplete="off"
                      returnKeyType="go"
                      caretHidden
                      selectionColor="transparent"
                      underlineColorAndroid="transparent"
                      accessibilityLabel="Arkadaşının çift kodu"
                      style={styles.codeHiddenInput}
                    />
                  </View>

                  <View style={styles.codeMetaRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handlePasteFriendCode}
                      accessibilityLabel="Panodaki kodu yapıştır"
                      style={[
                        styles.pasteBtn,
                        { backgroundColor: theme.pillAccentBg, borderColor: theme.pillAccentBorder },
                      ]}
                    >
                      <ClipboardPaste size={14} color={theme.accent} />
                      <Text style={[styles.pasteBtnText, { color: theme.accent }]}>Yapıştır</Text>
                    </TouchableOpacity>
                    <Text style={[styles.codeCounter, { color: theme.textMuted }]}>
                      {friendCode.length}/{PAIRING_CODE_LENGTH}
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={!canSubmitCode}
                    onPress={handleConnectByCode}
                    accessibilityLabel="Bağlantı Kur"
                    accessibilityState={{ disabled: !canSubmitCode }}
                    style={styles.connectBtn}
                  >
                    <LinearGradient
                      colors={
                        canSubmitCode || isConnectingByCode
                          ? [theme.accent, theme.accentLight || theme.accent]
                          : isLight
                            ? ['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.05)']
                            : ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.06)']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.connectBtnGradient}
                    >
                      {isConnectingByCode ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Link2 size={16} color={canSubmitCode ? '#FFFFFF' : theme.textMuted} />
                          <Text
                            style={[
                              styles.connectBtnText,
                              { color: canSubmitCode ? '#FFFFFF' : theme.textMuted },
                            ]}
                          >
                            {isLimitReached ? 'Limit Dolu (3/3)' : 'Bağlantı Kur ✨'}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <Text style={[styles.connectNote, { color: theme.textMuted }]}>
                    Karşı çift isteğinizi onayladığında yıldızlarınız birbirine bağlanır.
                  </Text>
                </View>

                {/* Nadir durum: kodla değil yalnızca adla eşleşen yıldızlar */}
                {codeCandidates.length > 0 && (
                  <View style={styles.resultsContainer}>{codeCandidates.map(renderStarResultCard)}</View>
                )}
              </View>
            ) : activeTab === 'search' ? (
              /* ─── SEKME 2: YILDIZ ADIYLA ARA ─────────────────────── */
              <View style={styles.searchSection}>
                <View style={styles.searchInputRow}>
                  <View
                    style={[
                      styles.searchBox,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: theme.inputBorder,
                      },
                    ]}
                  >
                    <Search size={16} color={theme.textMuted} />
                    <TextInput
                      style={[styles.input, { color: theme.text }]}
                      placeholder="Yıldız adı girin..."
                      placeholderTextColor={theme.textMuted}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      onSubmitEditing={handleSearch}
                      returnKeyType="search"
                      autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <X size={14} color={theme.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={handleSearch}
                    disabled={isSearching}
                    style={[styles.searchButton, { backgroundColor: theme.accent }]}
                  >
                    {isSearching ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.searchButtonText}>Ara</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Sonuçlar Listesi */}
                <View style={styles.resultsContainer}>
                  {searchPerformed && searchResults.length === 0 && !isSearching && (
                    <View style={styles.emptyResults}>
                      <Text style={[styles.emptyResultsText, { color: theme.textSecondary }]}>
                        “{searchQuery}” adında tescilli başka bir çift yıldızı bulunamadı.
                      </Text>
                    </View>
                  )}

                  {searchResults.map(renderStarResultCard)}
                </View>
              </View>
            ) : (
              /* ─── SEKME 3: GÖKYÜZÜ ──────────────────────────────── */
              <View style={styles.skySection}>
                <View
                  style={[
                    styles.skyGuideCard,
                    {
                      backgroundColor: theme.unitBg,
                      borderColor: isLight ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.2)',
                    },
                  ]}
                >
                  <View style={styles.skyGuideHeader}>
                    <Globe size={24} color="#38BDF8" />
                    <Text style={[styles.skyGuideTitle, { color: theme.text }]}>Gök Kubbe Üzerinden Seçim</Text>
                  </View>

                  <Text style={[styles.skyGuideDescription, { color: theme.textSecondary }]}>
                    Evrende parıldayan diğer çiftlerin tescilli yıldızlarını gökyüzü haritasında keşfedebilir
                    ve doğrudan yıldız kartından bağlantı isteği gönderebilirsiniz.
                  </Text>

                  <View style={styles.stepList}>
                    <View style={styles.stepItem}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>1</Text>
                      </View>
                      <Text style={[styles.stepItemText, { color: theme.textSecondary }]}>
                        Aşağıdaki butonla <Text style={styles.stepHighlight}>Gök Kubbe (Makro Görünüm)</Text> moduna geçin.
                      </Text>
                    </View>

                    <View style={styles.stepItem}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>2</Text>
                      </View>
                      <Text style={[styles.stepItemText, { color: theme.textSecondary }]}>
                        Başka bir çifte ait <Text style={styles.stepHighlight}>tescilli bir yıldıza</Text> dokunun.
                      </Text>
                    </View>

                    <View style={styles.stepItem}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>3</Text>
                      </View>
                      <Text style={[styles.stepItemText, { color: theme.textSecondary }]}>
                        Açılan yıldız kartındaki <Text style={styles.stepHighlight}>“Yıldızımızı Bağla ✨”</Text> butonuna basın.
                      </Text>
                    </View>
                  </View>

                  {/* Gökyüzüne Git Butonu */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      onClose();
                      onNavigateToSky?.();
                    }}
                    style={styles.goToSkyBtn}
                  >
                    <LinearGradient
                      colors={['#38BDF8', '#6366F1']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.goToSkyBtnGradient}
                    >
                      <Globe size={16} color="#FFFFFF" />
                      <Text style={styles.goToSkyBtnText}>Gökyüzüne Git 🌌</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ─── ALT KISIM: MEVCUT AKTİF BAĞLANTILAR ────────────────── */}
            <View
              style={[
                styles.activeConnectionsSection,
                { borderTopColor: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)' },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <Link2 size={15} color={theme.accent} />
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                  Mevcut Bağlantılarımız ({activeConnections.length}/3)
                </Text>
              </View>

              {activeConnections.length === 0 ? (
                <View
                  style={[
                    styles.emptyActiveBox,
                    { backgroundColor: theme.unitBg, borderColor: theme.cardBorder, borderWidth: 1 },
                  ]}
                >
                  <Text style={[styles.emptyActiveText, { color: theme.textMuted }]}>
                    Henüz başka bir çiftin yıldızıyla takımyıldızı bağınız bulunmuyor.
                  </Text>
                </View>
              ) : (
                activeConnections.map((conn) => {
                  const isActionLoading = actionLoadingId === conn.connection_id;
                  return (
                    <View
                      key={conn.connection_id}
                      style={[
                        styles.activeConnCard,
                        {
                          backgroundColor: theme.unitBg,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                    >
                      <View style={styles.activeConnInfo}>
                        <View style={styles.starNameRow}>
                          <Sparkles size={14} color={theme.accent} />
                          <Text style={[styles.activeStarName, { color: theme.text }]}>{conn.other_star_name}</Text>
                        </View>
                        <Text style={[styles.activeCoordsText, { color: theme.textMuted }]}>
                          RA: {conn.other_star_ra.toFixed(1)}° • Dec: {conn.other_star_dec.toFixed(1)}°
                        </Text>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        disabled={isActionLoading}
                        onPress={() => handleRemove(conn.connection_id, conn.other_star_name, false)}
                        style={styles.disconnectBtn}
                      >
                        {isActionLoading ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <Trash2 size={16} color="#EF4444" />
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>

            {/* ─── ONAY BEKLEYEN GİDEN İSTEKLER ───────────────────────── */}
            {outgoingPending.length > 0 && (
              <View style={styles.pendingSection}>
                <View style={styles.sectionHeaderRow}>
                  <Clock size={15} color={isLight ? '#B45309' : '#FBBF24'} />
                  <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                    Onay Bekleyen İsteklerimiz ({outgoingPending.length})
                  </Text>
                </View>

                {outgoingPending.map((request) => {
                  const isActionLoading = actionLoadingId === request.connection_id;
                  return (
                    <View
                      key={request.connection_id}
                      style={[
                        styles.activeConnCard,
                        { backgroundColor: theme.unitBg, borderColor: theme.cardBorder },
                      ]}
                    >
                      <View style={styles.activeConnInfo}>
                        <View style={styles.starNameRow}>
                          <Sparkles size={14} color="#F59E0B" />
                          <Text style={[styles.activeStarName, { color: theme.text }]}>
                            {request.other_star_name}
                          </Text>
                        </View>
                        <Text style={[styles.pendingHintText, { color: theme.textMuted }]}>
                          Karşı çiftin onayı bekleniyor…
                        </Text>
                      </View>

                      <TouchableOpacity
                        activeOpacity={0.7}
                        disabled={isActionLoading}
                        onPress={() => handleRemove(request.connection_id, request.other_star_name, true)}
                        accessibilityLabel="İsteği iptal et"
                        style={styles.disconnectBtn}
                      >
                        {isActionLoading ? (
                          <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                          <X size={16} color={isLight ? '#DC2626' : '#EF4444'} />
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </KeyboardAwareScrollView>
        </View>
      </KeyboardAvoidingView>
      {/* Bu modal açıkken uyarılar/diyaloglar (kök katman modalın arkasında kalır) burada çizilir */}
      <DialogHost embedded />
    </Modal>
  );
};

// Geriye dönük uyumluluk için StarConnectionsModal adıyla da dışa aktar
export const StarConnectionsModal = StarConnectionModal;
export default StarConnectionModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    // Sabit yükseklik: sekmeler arasında geçerken sayfa zıplamaz (içerik kendi içinde kayar)
    height: '90%',
    paddingBottom: 24,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  titleBlock: {
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  pairingCodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  pairingCodeIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(129, 140, 248, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairingCodeTextBlock: {
    flex: 1,
    gap: 1,
  },
  pairingCodeLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  pairingCodeValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  codeSection: {
    gap: 12,
  },
  friendCodeCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  friendCodeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  friendCodeIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendCodeTextBlock: {
    flex: 1,
    gap: 3,
  },
  friendCodeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  friendCodeHint: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  codeInputWrap: {
    height: 58,
  },
  codeCells: {
    flexDirection: 'row',
    gap: 8,
    height: 58,
  },
  codeCell: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCellText: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Hücrelerin üstünü kaplayan şeffaf gerçek giriş: dokunuş, yapıştırma ve klavye ona gider
  codeHiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    color: 'transparent',
    backgroundColor: 'transparent',
    fontSize: 16,
  },
  codeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  pasteBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  codeCounter: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  connectBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  connectBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
  },
  connectBtnText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  connectNote: {
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
  },
  pendingSection: {
    gap: 10,
  },
  pendingHintText: {
    fontSize: 11.5,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  successText: {
    color: '#10B981',
    fontSize: 12,
    flex: 1,
  },
  limitWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  limitWarningText: {
    color: '#FBBF24',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 16,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  searchSection: {
    gap: 12,
  },
  searchInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  searchButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  resultsContainer: {
    gap: 8,
  },
  emptyResults: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyResultsText: {
    fontSize: 13,
    textAlign: 'center',
  },
  starResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  starResultInfo: {
    flex: 1,
    gap: 2,
    marginRight: 10,
  },
  starNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultStarName: {
    fontSize: 14,
    fontWeight: '700',
  },
  resultCatalogCode: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  proposeBtn: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  proposeBtnDisabled: {
    opacity: 0.6,
  },
  proposeBtnGradient: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  proposeBtnTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  connectedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  connectedBadgeText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  pendingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  skySection: {
    gap: 12,
  },
  skyGuideCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  skyGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  skyGuideTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  skyGuideDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  stepList: {
    gap: 10,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNumberBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  stepItemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  stepHighlight: {
    color: '#38BDF8',
    fontWeight: '600',
  },
  goToSkyBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 6,
  },
  goToSkyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  goToSkyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  activeConnectionsSection: {
    gap: 10,
    marginTop: 10,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  emptyActiveBox: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  emptyActiveText: {
    fontSize: 12,
    textAlign: 'center',
  },
  activeConnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  activeConnInfo: {
    gap: 2,
  },
  activeStarName: {
    fontSize: 13,
    fontWeight: '600',
  },
  activeCoordsText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  disconnectBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
});
