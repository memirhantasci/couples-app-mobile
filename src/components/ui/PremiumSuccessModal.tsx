import React from "react";
import { View, Text, Modal, StyleSheet, TouchableOpacity } from "react-native";
import { CheckCircle, Crown, Image as ImageIcon, Mail, Infinity } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { useTheme } from "@/context/ThemeContext";

interface PremiumSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  /** Varsayılan metin yerine gösterilecek açıklama (ör. partner satın aldığında) */
  subtitle?: string;
}

export function PremiumSuccessModal({ visible, onClose, subtitle }: PremiumSuccessModalProps) {
  // useTheme: seçili açık/koyu modu da yakalar (getTheme(profile?.gender) açık temada koyu stilde kalıyordu)
  const { theme, isLight } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={80} tint="dark" style={styles.overlay}>
        <View style={[styles.modalBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          
          <View style={styles.iconContainer}>
            <View style={[styles.iconBg, { backgroundColor: "rgba(200,146,42,0.2)" }]}>
              <Crown color={isLight ? "#B7791F" : "#FFD700"} size={48} />
            </View>
            <View style={styles.checkBadge}>
              <CheckCircle color="#4ade80" size={24} fill="#111" />
            </View>
          </View>
          
          <Text style={[styles.title, { color: theme.text }]}>Tebrikler!</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {subtitle ?? "Artık Premium üyesiniz. Bütün sınırlar kalktı, aşkınızın tadını sınırsızca çıkarabilirsiniz."}
          </Text>

          <View style={styles.featuresContainer}>
            <View style={styles.featureRow}>
              <View style={[styles.featureIconBg, { backgroundColor: isLight ? theme.unitBg : "rgba(255,255,255,0.05)" }]}>
                <Infinity color={theme.accent} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.featureTitle, { color: theme.text }]}>Sınırsız Kullanım</Text>
                <Text style={[styles.featureDesc, { color: theme.textMuted }]}>Token derdi olmadan dilediğinizi yapın.</Text>
              </View>
            </View>

            <View style={styles.featureRow}>
              <View style={[styles.featureIconBg, { backgroundColor: isLight ? theme.unitBg : "rgba(255,255,255,0.05)" }]}>
                <ImageIcon color={theme.accent} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.featureTitle, { color: theme.text }]}>Sınırsız Fotoğraf</Text>
                <Text style={[styles.featureDesc, { color: theme.textMuted }]}>Ortak galeriye dilediğiniz kadar anı ekleyin.</Text>
              </View>
            </View>

            <View style={styles.featureRow}>
              <View style={[styles.featureIconBg, { backgroundColor: isLight ? theme.unitBg : "rgba(255,255,255,0.05)" }]}>
                <Mail color={theme.accent} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.featureTitle, { color: theme.text }]}>Sınırsız Mektup</Text>
                <Text style={[styles.featureDesc, { color: theme.textMuted }]}>Geleceğe dilediğiniz kadar mektup gönderin.</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: theme.accent }]} 
            onPress={onClose}
          >
            <Text style={[styles.actionBtnText, { color: "#FFFFFF" }]}>Harika! Başla</Text>
          </TouchableOpacity>

        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    width: "100%",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 10,
  },
  iconContainer: {
    position: "relative",
    marginBottom: 20,
    marginTop: 10,
  },
  iconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#111",
    borderRadius: 20,
    padding: 2,
  },
  title: {
    fontSize: 28,
    color: "#fff",
    marginBottom: 8,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  featuresContainer: {
    width: "100%",
    gap: 16,
    marginBottom: 32,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  featureIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  featureDesc: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },
  actionBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#111",
    fontSize: 16,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
});
