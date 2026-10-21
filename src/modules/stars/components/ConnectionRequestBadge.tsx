/**
 * @file ConnectionRequestBadge.tsx
 * @module modules/stars/components
 * @description OurStarScreen sağ üst köşesinde bekleyen gelen bağlantı isteklerini
 * gösteren ve doğrudan kabul/reddetme imkanı sunan bildirim rozeti.
 *
 * Tüm tema modlarıyla (Beyaz, Mavi, Pembe, Gece) tam uyumludur.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Bell, Sparkles, X, Check, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { starService } from '../api/starService';
import type { PendingConnectionDetail } from '../types/star.types';

export interface ConnectionRequestBadgeProps {
  readonly pendingRequests: PendingConnectionDetail[];
  readonly onConnectionChanged?: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export const ConnectionRequestBadge: React.FC<ConnectionRequestBadgeProps> = ({
  pendingRequests,
  onConnectionChanged,
  style,
}) => {
  const { theme, isLight } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const incomingRequests = pendingRequests.filter((p) => p.is_incoming);
  const incomingCount = incomingRequests.length;

  const handleOpen = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    setFeedbackMessage(null);
    setModalVisible(true);
  };

  const handleClose = () => {
    setModalVisible(false);
    setFeedbackMessage(null);
  };

  const handleRespond = useCallback(
    async (connectionId: string, accept: boolean, starName: string) => {
      setActionLoadingId(connectionId);
      setFeedbackMessage(null);

      try {
        await starService.respondToConnection(connectionId, accept);

        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(
            accept ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
          );
        }

        setFeedbackMessage({
          type: 'success',
          text: accept
            ? `"${starName}" ile yıldız bağınız kuruldu! Gökyüzünde parıldıyor 💫`
            : `Bağlantı isteği reddedildi.`,
        });

        onConnectionChanged?.();
      } catch (err: any) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        setFeedbackMessage({
          type: 'error',
          text: err?.message || 'İşlem sırasında bir hata oluştu.',
        });
      } finally {
        setActionLoadingId(null);
      }
    },
    [onConnectionChanged]
  );

  // Bekleyen gelen istek yoksa rozeti gösterme
  if (incomingCount === 0) {
    return null;
  }

  return (
    <>
      {/* ─── KÜÇÜK BİLDİRİM ROZETİ ─────────────────────────────────────── */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleOpen}
        style={[styles.badgeContainer, style]}
        accessibilityLabel={`${incomingCount} bekleyen yıldız bağlantı isteği`}
      >
        <LinearGradient
          colors={[theme.accent, theme.accentLight || theme.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.badgeGradient}
        >
          <Bell size={15} color="#FFFFFF" />
          <View style={styles.countPill}>
            <Text style={[styles.countText, { color: theme.accent }]}>{incomingCount}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* ─── YANITLAMA MODALI ─────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(3, 2, 7, 0.75)' },
          ]}
        >
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            {/* Modal Başlık */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Sparkles size={18} color="#FBBF24" />
                <Text style={[styles.modalTitle, { color: theme.text }]}>Bağlantı İstekleri</Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={[
                  styles.closeBtn,
                  { backgroundColor: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)' },
                ]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Bildirim / Hata Mesajı */}
            {feedbackMessage && (
              <View
                style={[
                  styles.feedbackBox,
                  feedbackMessage.type === 'error' ? styles.feedbackError : styles.feedbackSuccess,
                ]}
              >
                {feedbackMessage.type === 'error' ? (
                  <AlertCircle size={14} color="#EF4444" />
                ) : (
                  <CheckCircle2 size={14} color="#10B981" />
                )}
                <Text
                  style={[
                    styles.feedbackText,
                    feedbackMessage.type === 'error' ? styles.feedbackErrorText : styles.feedbackSuccessText,
                  ]}
                >
                  {feedbackMessage.text}
                </Text>
              </View>
            )}

            {/* İstek Listesi */}
            <ScrollView style={styles.requestList} contentContainerStyle={styles.requestListContent}>
              {incomingRequests.length === 0 ? (
                <View style={styles.emptyState}>
                  <Check size={28} color="#10B981" />
                  <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                    Bekleyen tüm istekler yanıtlandı ✨
                  </Text>
                </View>
              ) : (
                incomingRequests.map((req) => {
                  const isLoading = actionLoadingId === req.connection_id;
                  return (
                    <View
                      key={req.connection_id}
                      style={[
                        styles.requestCard,
                        {
                          backgroundColor: theme.unitBg,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                    >
                      <View style={styles.requestPromptRow}>
                        <View style={styles.starIconDot}>
                          <Sparkles size={14} color="#F59E0B" />
                        </View>
                        <Text style={[styles.requestPromptText, { color: theme.text }]}>
                          <Text style={styles.starNameBold}>“{req.other_star_name}”</Text> yıldızı bağlantı kurmak istiyor
                        </Text>
                      </View>

                      {/* Aksiyon Butonları: [Kabul Et ✨] [Reddet] */}
                      <View style={styles.actionsRow}>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          disabled={isLoading}
                          onPress={() => handleRespond(req.connection_id, true, req.other_star_name)}
                          style={styles.acceptBtn}
                        >
                          {isLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <LinearGradient
                              colors={['#F59E0B', '#D97706']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.acceptBtnGradient}
                            >
                              <Text style={styles.acceptBtnText}>Kabul Et ✨</Text>
                            </LinearGradient>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          activeOpacity={0.8}
                          disabled={isLoading}
                          onPress={() => handleRespond(req.connection_id, false, req.other_star_name)}
                          style={[
                            styles.rejectBtn,
                            {
                              backgroundColor: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)',
                              borderColor: theme.cardBorder,
                            },
                          ]}
                        >
                          <Text style={[styles.rejectBtnText, { color: theme.textSecondary }]}>Reddet</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default ConnectionRequestBadge;

const styles = StyleSheet.create({
  badgeContainer: {
    borderRadius: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
  },
  countPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    marginBottom: 12,
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  feedbackError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  feedbackText: {
    fontSize: 13,
    flex: 1,
  },
  feedbackSuccessText: {
    color: '#10B981',
  },
  feedbackErrorText: {
    color: '#EF4444',
  },
  requestList: {
    maxHeight: 320,
  },
  requestListContent: {
    gap: 12,
    paddingBottom: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  requestCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  requestPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  starIconDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestPromptText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  starNameBold: {
    color: '#FBBF24',
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  acceptBtn: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  acceptBtnGradient: {
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  rejectBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
