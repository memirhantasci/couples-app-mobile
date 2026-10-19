import React from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { BellRing, Mail, Camera, Heart } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";

interface PermissionPrimingModalProps {
  visible: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

const PERKS = [
  { Icon: Mail, text: "Sevgilinden mektup geldiğinde anında haberin olsun" },
  { Icon: Camera, text: "Paylaştığı yeni anıları ilk sen gör" },
  { Icon: Heart, text: "Özel günleri ve hatırlatmaları kaçırma" },
];

export function PermissionPrimingModal({
  visible,
  onAccept,
  onDismiss,
}: PermissionPrimingModalProps) {
  const { theme, isLight } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <BlurView
          intensity={Platform.OS === "ios" ? 70 : 100}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />

        <View
          style={[
            styles.card,
            {
              backgroundColor: isLight ? "#FFFFFF" : "#13131F",
              borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.12)",
            },
          ]}
        >
          {/* İkon Rozeti */}
          <View style={styles.iconCircle}>
            <LinearGradient
              colors={["#FF2E63", "#FF6B8B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <BellRing size={28} color="#FFFFFF" />
            </LinearGradient>
          </View>

          <Text style={[styles.title, { color: theme.text }]}>
            Hiçbir Anı Kaçırma ✨
          </Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            Sevgilin sana bir şey bıraktığında sana hemen fısıldayalım. Bildirimleri
            istediğin zaman ayarlardan kapatabilirsin.
          </Text>

          {/* Fayda Rozetleri */}
          <View style={styles.perksContainer}>
            {PERKS.map(({ Icon, text }) => (
              <View
                key={text}
                style={[
                  styles.perkItem,
                  { backgroundColor: isLight ? "rgba(255,46,99,0.06)" : "rgba(255,46,99,0.12)" },
                ]}
              >
                <Icon size={14} color="#FF2E63" />
                <Text
                  style={[styles.perkText, { color: isLight ? "#333" : "#EEE" }]}
                >
                  {text}
                </Text>
              </View>
            ))}
          </View>

          {/* Ana CTA */}
          <TouchableOpacity
            onPress={onAccept}
            activeOpacity={0.88}
            style={styles.primaryBtn}
          >
            <LinearGradient
              colors={["#FF2E63", "#FF6B8B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryGradient}
            >
              <Text style={styles.primaryBtnText}>Bildirimleri Aç ❤️</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* İkincil: Şimdilik Değil */}
          <TouchableOpacity
            onPress={onDismiss}
            activeOpacity={0.7}
            style={styles.dismissBtn}
          >
            <Text style={[styles.dismissText, { color: theme.textMuted }]}>
              Şimdilik Değil
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    borderWidth: 1.2,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 28,
    elevation: 20,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    marginBottom: 16,
    padding: 4,
    backgroundColor: "rgba(255, 46, 99, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 8,
    paddingHorizontal: 10,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  perksContainer: {
    width: "100%",
    gap: 8,
    marginBottom: 20,
  },
  perkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  perkText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
  },
  primaryBtn: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
    marginBottom: 10,
  },
  primaryGradient: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  dismissBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dismissText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
  },
});
