/**
 * @file StarConnectionModal.tsx
 * @module modules/stars/components
 * @description Çiftler arası gökyüzü yıldız bağlantıları yönetim modalı.
 *
 * İki Ana Sekme:
 * 1. Yıldız Adıyla Ara:
 *    🔍 [Yıldız adı girin...]
 *    → Sonuçlar: custom_name + catalog_code
 *    → Her sonuçta "Bağlantı Öner" butonu
 *    → Limit doluysa (3/3): "Maksimum 3 bağlantı limitine ulaştınız"
 *
 * 2. Gökyüzünde Seç:
 *    Gök kubbe haritası üzerinden doğrudan tescilli yıldız seçimi için rehber
 *    ve "Gökyüzüne Git 🌌" yönlendirmesi.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
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
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { starService } from '../api/starService';
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

type TabType = 'search' | 'sky';

export const StarConnectionModal: React.FC<StarConnectionModalProps> = ({
  visible,
  coupleId,
  onClose,
  onConnectionChanged,
  onNavigateToSky,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Veri durumları
  const [activeConnections, setActiveConnections] = useState<ActiveStarConnection[]>([]);
  const [pendingConnections, setPendingConnections] = useState<PendingConnectionDetail[]>([]);
  const [canConnect, setCanConnect] = useState(true);

  // Arama durumu
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<StarSearchResult[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Tekil işlem yükleniyor durumu
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // ─── VERİ YÜKLEME ──────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!visible) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [connections, pending, limitOk] = await Promise.all([
        starService.getMyStarConnections(),
        starService.getPendingConnections(),
        starService.checkConnectionLimit(coupleId).catch(() => true),
      ]);
      setActiveConnections(connections);
      setPendingConnections(pending);
      setCanConnect(limitOk);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Bağlantı bilgileri yüklenirken hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  }, [visible, coupleId]);

  useEffect(() => {
    if (visible) {
      void loadData();
    } else {
      setSearchQuery('');
      setSearchResults([]);
      setSearchPerformed(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      setActiveTab('search');
    }
  }, [visible, loadData]);

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
  const handleSendRequest = useCallback(
    async (target: StarSearchResult) => {
      if (!canConnect || activeConnections.length >= 3) {
        setErrorMessage('Maksimum 3 bağlantı limitine ulaştınız.');
        return;
      }
      setActionLoadingId(target.star_id);
      setErrorMessage(null);
      setSuccessMessage(null);
      try {
        await starService.requestStarConnection(target.star_id);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setSuccessMessage(`"${target.custom_name}" yıldızına bağlantı isteği gönderildi ✨`);
        await loadData();
        onConnectionChanged?.();
      } catch (err: any) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setErrorMessage(err?.message || 'İstek gönderilemedi.');
      } finally {
        setActionLoadingId(null);
      }
    },
    [canConnect, activeConnections.length, loadData, onConnectionChanged]
  );

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
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        Alert.alert(
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

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* ─── BAŞLIK ─────────────────────────────────────────────── */}
          <View style={styles.headerRow}>
            <View style={styles.titleBlock}>
              <View style={styles.titleRow}>
                <Share2 size={18} color="#EC4899" />
                <Text style={styles.title}>Kozmik Bağlar</Text>
              </View>
              <Text style={styles.subtitle}>
                Takımyıldızı arkadaşlıkları • ({activeConnections.length}/3 aktif bağ)
              </Text>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={20} color="rgba(255, 255, 255, 0.7)" />
            </TouchableOpacity>
          </View>

          {/* ─── 2 SEKME BUTONLARI ──────────────────────────────────── */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              onPress={() => {
                setActiveTab('search');
                setErrorMessage(null);
              }}
              style={[styles.tabButton, activeTab === 'search' && styles.tabButtonActive]}
            >
              <Search size={14} color={activeTab === 'search' ? '#EC4899' : 'rgba(255, 255, 255, 0.5)'} />
              <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
                Yıldız Adıyla Ara
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setActiveTab('sky');
                setErrorMessage(null);
              }}
              style={[styles.tabButton, activeTab === 'sky' && styles.tabButtonActive]}
            >
              <Compass size={14} color={activeTab === 'sky' ? '#EC4899' : 'rgba(255, 255, 255, 0.5)'} />
              <Text style={[styles.tabText, activeTab === 'sky' && styles.tabTextActive]}>
                Gökyüzünde Seç
              </Text>
            </TouchableOpacity>
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
          <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer}>
            {isLoading && !searchPerformed ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#EC4899" />
                <Text style={styles.loadingText}>Yıldız bağları yükleniyor...</Text>
              </View>
            ) : activeTab === 'search' ? (
              /* ─── SEKME 1: YILDIZ ADIYLA ARA ─────────────────────── */
              <View style={styles.searchSection}>
                <View style={styles.searchInputRow}>
                  <View style={styles.searchBox}>
                    <Search size={16} color="rgba(255, 255, 255, 0.5)" />
                    <TextInput
                      style={styles.input}
                      placeholder="Yıldız adı girin..."
                      placeholderTextColor="rgba(255, 255, 255, 0.35)"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      onSubmitEditing={handleSearch}
                      returnKeyType="search"
                      autoCapitalize="none"
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <X size={14} color="rgba(255, 255, 255, 0.4)" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={handleSearch}
                    disabled={isSearching}
                    style={styles.searchButton}
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
                      <Text style={styles.emptyResultsText}>
                        "{searchQuery}" adında tescilli başka bir çift yıldızı bulunamadı.
                      </Text>
                    </View>
                  )}

                  {searchResults.map((star) => {
                    const isAlreadyConnected = activeConnections.some(
                      (c) => c.other_star_id === star.star_id
                    );
                    const isPending = pendingConnections.some(
                      (p) => p.other_star_id === star.star_id
                    );
                    const isActionLoading = actionLoadingId === star.star_id;

                    return (
                      <View key={star.star_id} style={styles.starResultCard}>
                        <View style={styles.starResultInfo}>
                          <View style={styles.starNameRow}>
                            <Sparkles size={14} color="#F59E0B" />
                            <Text style={styles.resultStarName}>{star.custom_name}</Text>
                          </View>
                          <Text style={styles.resultCatalogCode}>{star.catalog_code}</Text>
                        </View>

                        {isAlreadyConnected ? (
                          <View style={styles.connectedBadge}>
                            <Text style={styles.connectedBadgeText}>Bağlı ✨</Text>
                          </View>
                        ) : isPending ? (
                          <View style={styles.pendingBadge}>
                            <Text style={styles.pendingBadgeText}>İstek Gönderildi</Text>
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
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <LinearGradient
                                colors={
                                  isLimitReached
                                    ? ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                                    : ['#EC4899', '#8B5CF6']
                                }
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.proposeBtnGradient}
                              >
                                <Text
                                  style={[
                                    styles.proposeBtnText,
                                    isLimitReached && styles.proposeBtnTextDisabled,
                                  ]}
                                >
                                  {isLimitReached ? 'Limit Dolu (3/3)' : 'Bağlantı Öner ✨'}
                                </Text>
                              </LinearGradient>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              /* ─── SEKME 2: GÖKYÜZÜNDE SEÇ ───────────────────────── */
              <View style={styles.skySection}>
                <View style={styles.skyGuideCard}>
                  <View style={styles.skyGuideHeader}>
                    <Globe size={24} color="#38BDF8" />
                    <Text style={styles.skyGuideTitle}>Gök Kubbe Üzerinden Seçim</Text>
                  </View>

                  <Text style={styles.skyGuideDescription}>
                    Evrende parıldayan diğer çiftlerin tescilli yıldızlarını gökyüzü haritasında keşfedebilir
                    ve doğrudan yıldız kartından bağlantı isteği gönderebilirsiniz.
                  </Text>

                  <View style={styles.stepList}>
                    <View style={styles.stepItem}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>1</Text>
                      </View>
                      <Text style={styles.stepItemText}>
                        Aşağıdaki butonla <Text style={styles.stepHighlight}>Gök Kubbe (Makro Görünüm)</Text> moduna geçin.
                      </Text>
                    </View>

                    <View style={styles.stepItem}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>2</Text>
                      </View>
                      <Text style={styles.stepItemText}>
                        Başka bir çifte ait <Text style={styles.stepHighlight}>tescilli bir yıldıza</Text> dokunun.
                      </Text>
                    </View>

                    <View style={styles.stepItem}>
                      <View style={styles.stepNumberBadge}>
                        <Text style={styles.stepNumberText}>3</Text>
                      </View>
                      <Text style={styles.stepItemText}>
                        Açılan yıldız kartındaki <Text style={styles.stepHighlight}>"Yıldızımızı Bağla ✨"</Text> butonuna basın.
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
            <View style={styles.activeConnectionsSection}>
              <View style={styles.sectionHeaderRow}>
                <Link2 size={15} color="#EC4899" />
                <Text style={styles.sectionTitle}>
                  Mevcut Bağlantılarımız ({activeConnections.length}/3)
                </Text>
              </View>

              {activeConnections.length === 0 ? (
                <View style={styles.emptyActiveBox}>
                  <Text style={styles.emptyActiveText}>
                    Henüz başka bir çiftin yıldızıyla takımyıldızı bağınız bulunmuyor.
                  </Text>
                </View>
              ) : (
                activeConnections.map((conn) => {
                  const isActionLoading = actionLoadingId === conn.connection_id;
                  return (
                    <View key={conn.connection_id} style={styles.activeConnCard}>
                      <View style={styles.activeConnInfo}>
                        <View style={styles.starNameRow}>
                          <Sparkles size={14} color="#EC4899" />
                          <Text style={styles.activeStarName}>{conn.other_star_name}</Text>
                        </View>
                        <Text style={styles.activeCoordsText}>
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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// Geriye dönük uyumluluk için StarConnectionsModal adıyla da dışa aktar
export const StarConnectionsModal = StarConnectionModal;
export default StarConnectionModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 2, 7, 0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F0B1E',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    maxHeight: '90%',
    paddingBottom: 24,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.3,
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
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    borderColor: 'rgba(236, 72, 153, 0.4)',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
    color: 'rgba(255, 255, 255, 0.6)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  searchButton: {
    backgroundColor: '#EC4899',
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
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    textAlign: 'center',
  },
  starResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  resultCatalogCode: {
    color: 'rgba(255, 255, 255, 0.45)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  pendingBadgeText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '600',
  },
  skySection: {
    gap: 12,
  },
  skyGuideCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    gap: 14,
  },
  skyGuideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  skyGuideTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  skyGuideDescription: {
    color: 'rgba(255, 255, 255, 0.7)',
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
    color: 'rgba(255, 255, 255, 0.8)',
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
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  emptyActiveBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  emptyActiveText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    textAlign: 'center',
  },
  activeConnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  activeConnInfo: {
    gap: 2,
  },
  activeStarName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  activeCoordsText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  disconnectBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
});
