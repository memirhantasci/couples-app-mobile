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
import { useRouter } from "expo-router";
import { Sparkles, Heart, ArrowRight, X, UserPlus, LogIn } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

interface DemoActionModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export function DemoActionModal({
  visible,
  onClose,
  title = "Sevgilinle Ortak Alanını Başlat 💖",
  description = "Bu özelliği kullanmak, kendi anılarınızı güvenle kaydetmek ve partnerinizi davet etmek için ücretsiz hesabınızı oluşturun.",
}: DemoActionModalProps) {
  const router = useRouter();
  const { exitDemoMode } = useAuth();
  const { theme, isLight } = useTheme();

  const handleRegister = () => {
    onClose();
    exitDemoMode();
    router.replace({
      pathname: "/(auth)/login",
      params: { initialMode: "register" },
    });
  };

  const handleLogin = () => {
    onClose();
    exitDemoMode();
    router.replace({
      pathname: "/(auth)/login",
      params: { initialMode: "login" },
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
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
              borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)",
            },
          ]}
        >
          {/* Kapat Butonu */}
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.closeBtn,
              { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)" },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={18} color={theme.textMuted} />
          </TouchableOpacity>

          {/* İkon Rozeti */}
          <View style={styles.iconCircle}>
            <LinearGradient
              colors={["#FF2E63", "#FF6B8B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Sparkles size={28} color="#FFFFFF" />
            </LinearGradient>
          </View>

          {/* Başlık & Açıklama */}
          <Text style={[styles.title, { color: theme.text }]}>
            {title}
          </Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {description}
          </Text>

          {/* Avantaj Rozetleri */}
          <View style={styles.perksContainer}>
            <View style={[styles.perkItem, { backgroundColor: isLight ? "rgba(255,46,99,0.06)" : "rgba(255,46,99,0.12)" }]}>
              <Heart size={14} color="#FF2E63" />
              <Text style={[styles.perkText, { color: isLight ? "#333" : "#EEE" }]}>Ortak Aşk Albümü & Harita</Text>
            </View>
            <View style={[styles.perkItem, { backgroundColor: isLight ? "rgba(255,46,99,0.06)" : "rgba(255,46,99,0.12)" }]}>
              <Sparkles size={14} color="#FF2E63" />
              <Text style={[styles.perkText, { color: isLight ? "#333" : "#EEE" }]}>Zaman Kilitli Sürpriz Mektuplar</Text>
            </View>
          </View>

          {/* Ana CTA: Kayıt Ol */}
          <TouchableOpacity
            onPress={handleRegister}
            activeOpacity={0.88}
            style={styles.primaryBtn}
          >
            <LinearGradient
              colors={["#FF2E63", "#FF6B8B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryGradient}
            >
              <UserPlus size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Ücretsiz Hesap Oluştur</Text>
              <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </LinearGradient>
          </TouchableOpacity>

          {/* İkincil CTA: Zaten Hesabım Var */}
          <TouchableOpacity
            onPress={handleLogin}
            activeOpacity={0.7}
            style={styles.secondaryBtn}
          >
            <LogIn size={15} color={theme.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.secondaryBtnText, { color: theme.accent }]}>
              Zaten bir hesabım var (Giriş Yap)
            </Text>
          </TouchableOpacity>

          {/* Vazgeç: İncelemeye Devam Et */}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={styles.dismissBtn}
          >
            <Text style={[styles.dismissText, { color: theme.textMuted }]}>
              İncelemeye Devam Et
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
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
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
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  secondaryBtnText: {
    fontSize: 13,
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
