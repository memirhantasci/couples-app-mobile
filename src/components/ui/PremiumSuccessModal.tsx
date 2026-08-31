import React from "react";
import { View, Text, Modal, StyleSheet, TouchableOpacity } from "react-native";
import { CheckCircle, Crown, Image as ImageIcon, Mail, Infinity } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { getTheme } from "@/lib/theme";
import { useAuth } from "@/context/AuthContext";

interface PremiumSuccessModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PremiumSuccessModal({ visible, onClose }: PremiumSuccessModalProps) {
  const { profile } = useAuth();
  const theme = getTheme(profile?.gender);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <BlurView intensity={80} tint="dark" style={styles.overlay}>
        <View style={[styles.modalBox, { backgroundColor: theme.cardBg }]}>
          
          <View style={styles.iconContainer}>
            <View style={[styles.iconBg, { backgroundColor: "rgba(200,146,42,0.2)" }]}>
              <Crown color="#FFD700" size={48} />
            </View>
            <View style={styles.checkBadge}>
              <CheckCircle color="#4ade80" size={24} fill="#111" />
            </View>
          </View>
          
          <Text style={styles.title}>Tebrikler!</Text>
          <Text style={styles.subtitle}>
            Artık Premium üyesiniz. Bütün sınırlar kalktı, aşkınızın tadını sınırsızca çıkarabilirsiniz.
          </Text>

          <View style={styles.featuresContainer}>
            <View style={styles.featureRow}>
              <View style={[styles.featureIconBg, { backgroundColor: "rgba(255,255,255,0.05)" }]}>
                <Infinity color={theme.accent} size={20} />
              </View>
              <View>
                <Text style={styles.featureTitle}>Sınırsız Kullanım</Text>
                <Text style={styles.featureDesc}>Token derdi olmadan dilediğinizi yapın.</Text>
              </View>
            </View>

            <View style={styles.featureRow}>
              <View style={[styles.featureIconBg, { backgroundColor: "rgba(255,255,255,0.05)" }]}>
                <ImageIcon color={theme.accent} size={20} />
              </View>
              <View>
                <Text style={styles.featureTitle}>Sınırsız Fotoğraf</Text>
                <Text style={styles.featureDesc}>Ortak galeriye dilediğiniz kadar anı ekleyin.</Text>
              </View>
            </View>

            <View style={styles.featureRow}>
              <View style={[styles.featureIconBg, { backgroundColor: "rgba(255,255,255,0.05)" }]}>
                <Mail color={theme.accent} size={20} />
              </View>
              <View>
                <Text style={styles.featureTitle}>Sınırsız Mektup</Text>
                <Text style={styles.featureDesc}>Geleceğe dilediğiniz kadar mektup gönderin.</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: theme.accent }]} 
            onPress={onClose}
          >
            <Text style={styles.actionBtnText}>Harika! Başla</Text>
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
