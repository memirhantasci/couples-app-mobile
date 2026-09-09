import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from "react-native";
import { Crown, Sparkles, X, Zap } from "lucide-react-native";
import { getTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import type { PremiumFeatureSource, PremiumPaywallProps as BasePremiumPaywallProps } from "./PremiumPaywall.types";

interface PremiumPaywallProps extends BasePremiumPaywallProps {
  featureName?: string;         // "Mektup Yaz", "Fotoğraf Galerisi" vb.
  featureDescription?: string; // Opsiyonel açıklama
  featureSource?: PremiumFeatureSource;
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
  featureSource = "general",
  gender,
  tokenOption,
  onWatchAd,
}: PremiumPaywallProps) {
  const theme = getTheme(gender);
  const router = useRouter();

  const featureCopy: Record<PremiumFeatureSource, { name: string; description: string; cta: string }> = {
    general: {
      name: "Bu özellik",
      description: "Premium ile birlikte tüm özel anı alanlarına erişin.",
      cta: "Premium'a Geç",
    },
    star_claim: {
      name: "Yıldız sahiplenme",
      description: "Yıldızınızı sahiplenin ve gökyüzünde birlikte parlatın.",
      cta: "Yıldızımızı Aç",
    },
    exoplanet_create: {
      name: "Anı gezegeni oluşturma",
      description: "Anılarınızı yıldızınızın yörüngesine yerleştirmek için Premium gerekli.",
      cta: "Anı Gezegenlerini Aç",
    },
    exoplanet_view: {
      name: "Anı gezegeni içeriği",
      description: "Fotoğraflarınız, mektuplarınız ve anı ayrıntılarınız Premium ile korunur.",
      cta: "Anılarımı Aç",
    },
    exoplanet_auto: {
      name: "Otomatik anı gezegenleri",
      description: "45 günlük anı döngüsünü devam ettirmek için Premium gerekli.",
      cta: "Otomatik Anıları Aç",
    },
  };
  const resolvedFeature = featureCopy[featureSource];
  const resolvedFeatureName = featureName ?? resolvedFeature.name;
  const resolvedFeatureDescription = featureDescription ?? resolvedFeature.description;

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
            <Text style={{ fontWeight: "700", color: theme.accent }}>{resolvedFeatureName}</Text>
            {" "}özelliği Premium abonelere özeldir.
          </Text>

          <Text style={styles.description}>{resolvedFeatureDescription}</Text>

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
            onPress={() => {
              onClose();
              router.push("/paywall");
            }}
            activeOpacity={0.8}
          >
            <Crown color="#fff" size={20} />
            <Text style={styles.ctaBtnText}>{resolvedFeature.cta}</Text>
          </TouchableOpacity>

          <Text style={styles.trialText}>14 gün ücretsiz dene • İstediğin zaman iptal et</Text>
          <TouchableOpacity 
            onPress={() => {
              onClose();
              router.push("/paywall");
            }}
            style={{ marginTop: 6 }}
          >
            <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", textDecorationLine: "underline" }}>
              Abonelik & Kullanım Koşulları (EULA)
            </Text>
          </TouchableOpacity>

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
                  ({tokenOption.currentBalance} token{`'`}ın var)
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
