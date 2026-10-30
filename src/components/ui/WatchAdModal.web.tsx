import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { X, PlayCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

interface WatchAdModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function WatchAdModal({ visible, onClose, onSuccess }: WatchAdModalProps) {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.close")} onPress={onClose} style={styles.closeBtn}>
            <X size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <PlayCircle size={44} color="#38BDF8" style={{ marginBottom: 12 }} />
          <Text style={styles.title}>{t('ads.webSimulation')}</Text>
          <Text style={styles.desc}>
            {t('ads.webDescription')}
          </Text>
          <TouchableOpacity
            onPress={() => {
              onSuccess();
              onClose();
            }}
            style={styles.actionBtn}
          >
            <Text style={styles.actionBtnText}>{t('ads.claim')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F0C1E',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  desc: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  actionBtn: {
    backgroundColor: '#38BDF8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  actionBtnText: {
    color: '#030207',
    fontSize: 14,
    fontWeight: '700',
  },
});
