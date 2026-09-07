/**
 * @file SectorAtlasModal.tsx
 * @module modules/stars/components
 * @description 24 Gökyüzü Sektörünün Atlas Modalı.
 *
 * - Sektör kartları: isim, sembol, doluluk barı, enerji seviyesi, arkadaş rozeti.
 * - "Oraya Uç 🚀" butonu: Modalı kapatır, kamerayı sektör merkezine uçurur.
 * - "Bu Sektörden Yıldız Seç ✨" butonu: ClaimStarModal'a sektör seçili olarak yönlendirir.
 * - getSectorsOverview() çağrısı yalnızca modal açıldığında yapılır (5 dk cache).
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Rocket, Sparkles, Users, Zap } from 'lucide-react-native';
import { SKY_SECTORS_LIST, type SectorConfig } from '../config/skySectors.data';
import { starService } from '../api/starService';
import type { SectorDynamicOverview, FlyToTarget } from '../types/star.types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SectorAtlasModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  /** Sektör merkezine sinematik uçuş başlatır */
  readonly onFlyTo?: (target: FlyToTarget) => void;
  /** Sektörden yıldız tescil akışına yönlendirir */
  readonly onClaimFromSector?: (sectorId: string) => void;
  /** Kullanıcının çifti yıldız sahiplenmiş mi (tescil butonu gösterilmesin) */
  readonly hasOwnStar?: boolean;
}

export const SectorAtlasModal: React.FC<SectorAtlasModalProps> = ({
  visible,
  onClose,
  onFlyTo,
  onClaimFromSector,
  hasOwnStar = false,
}) => {
  const [dynamicData, setDynamicData] = useState<SectorDynamicOverview[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modal açıldığında sektör verilerini çek
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    const loadOverview = async () => {
      setIsLoading(true);
      try {
        const data = await starService.getSectorsOverview();
        if (!cancelled) setDynamicData(data);
      } catch {
        if (!cancelled) setDynamicData([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadOverview();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const getDynamic = useCallback(
    (sectorId: string): SectorDynamicOverview | undefined =>
      dynamicData.find((d) => d.sector_id === sectorId),
    [dynamicData],
  );

  const handleFlyTo = useCallback(
    (sector: SectorConfig) => {
      onClose();
      // Kısa bir gecikme ile modal kapandıktan sonra uçuş başlasın
      setTimeout(() => {
        onFlyTo?.({
          centerRa: sector.center.ra,
          centerDec: sector.center.dec,
          zoom: 1.8,
        });
      }, 200);
    },
    [onClose, onFlyTo],
  );

  const handleClaimFromSector = useCallback(
    (sectorId: string) => {
      onClose();
      setTimeout(() => {
        onClaimFromSector?.(sectorId);
      }, 200);
    },
    [onClose, onClaimFromSector],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalContainer}>
          {/* Başlık */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🌌 Gökyüzü Atlası</Text>
            <Text style={styles.headerSubtitle}>24 Astronomik Sektör</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          {/* İçerik */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#A78BFA" />
              <Text style={styles.loadingText}>Sektörler taranıyor...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {SKY_SECTORS_LIST.map((sector) => {
                const dyn = getDynamic(sector.id);
                const claimed = dyn?.claimed_stars_count ?? 0;
                const available = dyn?.available_stars_count ?? 0;
                const total = claimed + available;
                const fillPercent = total > 0 ? Math.round((claimed / total) * 100) : 0;
                const energy = dyn?.sector_energy ?? 0;
                const hasFriends = dyn?.has_friends_here ?? false;

                return (
                  <View key={sector.id} style={styles.sectorCard}>
                    <LinearGradient
                      colors={[sector.nebulaPalette[0] + '40', 'rgba(15, 15, 25, 0.9)']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cardGradient}
                    >
                      {/* Üst kısım: İsim ve Sembol */}
                      <View style={styles.cardHeader}>
                        <View style={styles.cardTitleRow}>
                          <Text style={styles.sectorSymbol}>{sector.symbol}</Text>
                          <View style={styles.cardTitleBlock}>
                            <Text style={[styles.sectorName, { color: sector.themeColor }]}>
                              {sector.name}
                            </Text>
                            <Text style={styles.sectorLatin}>{sector.latinName}</Text>
                          </View>
                        </View>

                        {/* Rozetler */}
                        <View style={styles.badgesRow}>
                          {hasFriends && (
                            <View style={styles.friendBadge}>
                              <Users size={11} color="#34D399" />
                              <Text style={styles.friendBadgeText}>Arkadaş</Text>
                            </View>
                          )}
                          {energy > 0 && (
                            <View style={styles.energyBadge}>
                              <Zap size={11} color="#FACC15" />
                              <Text style={styles.energyBadgeText}>{energy}</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Açıklama */}
                      <Text style={styles.sectorDesc} numberOfLines={2}>
                        {sector.description}
                      </Text>

                      {/* Doluluk barı */}
                      <View style={styles.fillBarContainer}>
                        <View style={styles.fillBarTrack}>
                          <View
                            style={[
                              styles.fillBarFill,
                              {
                                width: `${Math.min(100, fillPercent)}%`,
                                backgroundColor: sector.themeColor,
                              },
                            ]}
                          />
                        </View>
                        <Text style={styles.fillBarLabel}>
                          {claimed} / {total} yıldız • %{fillPercent}
                        </Text>
                      </View>

                      {/* Butonlar */}
                      <View style={styles.cardActions}>
                        <TouchableOpacity
                          onPress={() => handleFlyTo(sector)}
                          style={[styles.actionButton, styles.flyToButton]}
                          activeOpacity={0.7}
                        >
                          <Rocket size={14} color="#FFF" />
                          <Text style={styles.actionButtonText}>Oraya Uç</Text>
                        </TouchableOpacity>

                        {!hasOwnStar && (
                          <TouchableOpacity
                            onPress={() => handleClaimFromSector(sector.id)}
                            style={[styles.actionButton, { backgroundColor: sector.themeColor + '30', borderColor: sector.themeColor + '60' }]}
                            activeOpacity={0.7}
                          >
                            <Sparkles size={14} color={sector.themeColor} />
                            <Text style={[styles.actionButtonText, { color: sector.themeColor }]}>
                              Yıldız Seç
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </LinearGradient>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};


const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0D0D1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 34,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 2,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 18,
    padding: 6,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 12,
  },
  sectorCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sectorSymbol: {
    fontSize: 24,
  },
  cardTitleBlock: {
    flex: 1,
  },
  sectorName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectorLatin: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.35)',
    fontStyle: 'italic',
    marginTop: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  friendBadgeText: {
    fontSize: 10,
    color: '#34D399',
    fontWeight: '600',
  },
  energyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(250, 204, 21, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  energyBadgeText: {
    fontSize: 10,
    color: '#FACC15',
    fontWeight: '600',
  },
  sectorDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    lineHeight: 17,
    marginBottom: 10,
  },
  fillBarContainer: {
    marginBottom: 12,
  },
  fillBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  fillBarFill: {
    height: '100%',
    borderRadius: 2,
    opacity: 0.8,
  },
  fillBarLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.3)',
    letterSpacing: 0.2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  flyToButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    letterSpacing: 0.2,
  },
});
