import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Sparkles, ArrowRight, UserPlus } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DemoActionModal } from "./DemoActionModal";

export function DemoModeBanner() {
  const { isDemoMode } = useAuth();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(false);

  if (!isDemoMode) return null;

  return (
    <>
      <View
        style={[
          styles.container,
          {
            top: Platform.OS === "ios" ? Math.max(insets.top, 20) + 4 : insets.top + 8,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          activeOpacity={0.88}
          style={styles.pill}
        >
          <LinearGradient
            colors={["rgba(30, 20, 45, 0.94)", "rgba(20, 15, 35, 0.96)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pillGradient}
          >
            <View style={styles.leftContent}>
              <View style={styles.sparkleBadge}>
                <Sparkles size={12} color="#FF2E63" />
              </View>
              <View>
                <Text style={styles.badgeTitle}>Demo Sürümü</Text>
                <Text style={styles.badgeSubtitle}>Kayıt olmadan inceliyorsunuz</Text>
              </View>
            </View>

            <View style={styles.ctaButton}>
              <LinearGradient
                colors={["#FF2E63", "#FF6B8B"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaGradient}
              >
                <UserPlus size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                <Text style={styles.ctaText}>Kayıt Ol</Text>
              </LinearGradient>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <DemoActionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Kendi Çift Alanınızı Başlatın ✨"
        description="Demo modundan çıkıp partnerinizle ortak anılarınızı biriktirmek, aşk mektupları mühürlemek ve özel günlerinizi saymak için ücretsiz hesap oluşturun."
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 20,
    alignItems: "center",
  },
  pill: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.2,
    borderColor: "rgba(255, 46, 99, 0.35)",
    shadowColor: "#FF2E63",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  pillGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  leftContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sparkleBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 46, 99, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  badgeTitle: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.1,
  },
  badgeSubtitle: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 9.5,
    fontFamily: "Inter_400Regular",
  },
  ctaButton: {
    borderRadius: 13,
    overflow: "hidden",
  },
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
});
