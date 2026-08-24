import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, Lock, Sparkles, X, Zap } from "lucide-react-native";
import { getTheme, AppTheme } from "@/lib/theme";

const { width } = Dimensions.get("window");

interface PremiumPaywallProps {
  visible: boolean;
  onClose: () => void;
  featureName: string;         // "Mektup Yaz", "Fotoğraf Galerisi" vb.
  featureDescription?: string; // Opsiyonel açıklama
  gender?: string | null;
  tokenOption?: {              // Token ile açılabilecekse
    cost: number;
    currentBalance: number;
    onUseTokens: () => void;
  };
  onWatchAd?: () => void;      // Reklam izle butonu (ileride)
}

export function PremiumPaywall({
  visible,
  onClose,
  featureName,
  featureDescription,
  gender,
  tokenOption,
  onWatchAd,
}: PremiumPaywallProps) {
  const theme = getTheme(gender);

  const features = [
    "💌 Sınırsız Mektup Yaz",
    "📸 Fotoğraf Galerisi & Yükleme",
    "🩸 Regl Takvimi (Erkek Görünümü)",
    "📅 Fotoğraflı Özel Günler",
    "🚫 Reklamsız Deneyim",
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.cardBg }]}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <View style={styles.closeBtnCircle}>
              <X color="rgba(255,255,255,0.6)" size={18} />
            </View>
          </TouchableOpacity>

          {/* Crown Icon */}
          <View style={[styles.crownCircle, { backgroundColor: `${theme.accent}20` }]}>
            <Crown color={theme.accent} size={32} />
          </View>

          {/* Title */}
          <Text style={styles.title}>Premium Gerekli</Text>
          <Text style={styles.subtitle}>
            <Text style={{ fontWeight: "700", color: theme.accent }}>{featureName}</Text>
            {" "}özelliği Premium abonelere özeldir.
          </Text>

          {featureDescription && (
            <Text style={styles.description}>{featureDescription}</Text>
          )}

          {/* Premium Features List */}
          <View style={styles.featuresList}>
            {features.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Sparkles color={theme.accent} size={14} />
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          {/* CTA Button */}
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: theme.accent }]}
            onPress={onClose} // İleride RevenueCat satın alma ekranını açacak
            activeOpacity={0.8}
          >
            <Crown color="#fff" size={20} />
            <Text style={styles.ctaBtnText}>Premium'a Geç</Text>
          </TouchableOpacity>

          <Text style={styles.trialText}>14 gün ücretsiz dene • İstediğin zaman iptal et</Text>

          {/* Token Option */}
          {tokenOption && (
            <View style={styles.tokenSection}>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>veya</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[
                  styles.tokenBtn,
                  tokenOption.currentBalance < tokenOption.cost && { opacity: 0.4 },
                ]}
                disabled={tokenOption.currentBalance < tokenOption.cost}
                onPress={tokenOption.onUseTokens}
                activeOpacity={0.7}
              >
                <Zap color="#FFD700" size={18} />
                <Text style={styles.tokenBtnText}>
                  {tokenOption.cost} Token ile Kullan
                </Text>
                <Text style={styles.tokenBalance}>
                  ({tokenOption.currentBalance} token'ın var)
                </Text>
              </TouchableOpacity>

              {onWatchAd && (
                <TouchableOpacity
                  style={styles.adBtn}
                  onPress={onWatchAd}
                  activeOpacity={0.7}
                >
                  <Text style={styles.adBtnText}>🎬 Reklam İzleyerek +50 Token Kazan</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
  },
  closeBtnCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    justifyContent: "center",
    alignItems: "center",
  },
  crownCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginBottom: 16,
  },
  featuresList: {
    width: "100%",
    gap: 10,
    marginBottom: 24,
    marginTop: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
    fontWeight: "500",
  },
  ctaBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    borderRadius: 16,
  },
  ctaBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  trialText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    marginTop: 10,
    textAlign: "center",
  },
  tokenSection: {
    width: "100%",
    marginTop: 16,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  dividerText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
  },
  tokenBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,215,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.15)",
  },
  tokenBtnText: {
    color: "#FFD700",
    fontWeight: "700",
    fontSize: 14,
  },
  tokenBalance: {
    color: "rgba(255,215,0,0.5)",
    fontSize: 11,
  },
  adBtn: {
    width: "100%",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginTop: 10,
  },
  adBtnText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "600",
  },
});
