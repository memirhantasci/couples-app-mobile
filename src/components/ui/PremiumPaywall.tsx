import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Platform,
} from "react-native";
import { Crown, Sparkles, X, Zap } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
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
  tokenOption,
  onWatchAd,
}: PremiumPaywallProps) {
  const { theme, isLight } = useTheme();
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
      <View style={[styles.overlay, { backgroundColor: isLight ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.8)" }]}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.cardBg,
              borderColor: isLight ? "rgba(0,0,0,0.08)" : theme.cardBorder,
              shadowColor: isLight ? "#000" : theme.accent,
            },
          ]}
        >
          {/* Close Button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <View
              style={[
                styles.closeBtnCircle,
                {
                  backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)",
                  borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)",
                },
              ]}
            >
              <X color={theme.text} size={18} />
            </View>
          </TouchableOpacity>

          {/* Crown Icon */}
          <View style={[styles.crownCircle, { backgroundColor: `${theme.accent}18` }]}>
            <Crown color={theme.accent} size={32} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.text }]}>Premium Gerekli</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            <Text style={{ fontWeight: "700", color: theme.accent }}>{resolvedFeatureName}</Text>
            {" "}özelliği Premium abonelere özeldir.
          </Text>

          <Text style={[styles.description, { color: theme.textMuted }]}>{resolvedFeatureDescription}</Text>

          {/* Premium Features List */}
          <View style={styles.featuresList}>
            {features.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Sparkles color={theme.accent} size={14} />
                <Text style={[styles.featureText, { color: theme.text }]}>{f}</Text>
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

          <Text style={[styles.trialText, { color: theme.textMuted }]}>
            14 gün ücretsiz dene • İstediğin zaman iptal et
          </Text>
          <TouchableOpacity 
            onPress={() => {
              onClose();
              router.push("/paywall");
            }}
            style={{ marginTop: 6 }}
          >
            <Text style={[styles.eulaLink, { color: theme.accent }]}>
              Abonelik & Kullanım Koşulları (EULA)
            </Text>
          </TouchableOpacity>

          {/* Token Option */}
          {tokenOption && (
            <View style={styles.tokenSection}>
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)" }]} />
                <Text style={[styles.dividerText, { color: theme.textMuted }]}>veya</Text>
                <View style={[styles.dividerLine, { backgroundColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)" }]} />
              </View>

              <TouchableOpacity
                style={[
                  styles.tokenBtn,
                  {
                    backgroundColor: isLight ? "rgba(234, 179, 8, 0.12)" : "rgba(255,215,0,0.08)",
                    borderColor: isLight ? "rgba(234, 179, 8, 0.3)" : "rgba(255,215,0,0.18)",
                  },
                  tokenOption.currentBalance < tokenOption.cost && { opacity: 0.4 },
                ]}
                disabled={tokenOption.currentBalance < tokenOption.cost}
                onPress={tokenOption.onUseTokens}
                activeOpacity={0.7}
              >
                <Zap color={isLight ? "#B45309" : "#FFD700"} size={18} />
                <Text style={[styles.tokenBtnText, { color: isLight ? "#B45309" : "#FFD700" }]}>
                  {tokenOption.cost} Token ile Kullan
                </Text>
                <Text style={[styles.tokenBalance, { color: isLight ? "rgba(180, 83, 9, 0.7)" : "rgba(255,215,0,0.6)" }]}>
                  ({tokenOption.currentBalance} token{`'`}ın var)
                </Text>
              </TouchableOpacity>

              {onWatchAd && (
                <TouchableOpacity
                  style={[
                    styles.adBtn,
                    {
                      backgroundColor: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)",
                      borderColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)",
                    },
                  ]}
                  onPress={onWatchAd}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.adBtnText, { color: theme.textSecondary }]}>🎬 Reklam İzleyerek +50 Token Kazan</Text>
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
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    padding: 26,
    alignItems: "center",
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
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
    borderWidth: 1,
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
    marginTop: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  featuresList: {
    width: "100%",
    gap: 10,
    marginBottom: 22,
    marginTop: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    fontSize: 13.5,
    fontWeight: "600",
  },
  ctaBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 15,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: -0.2,
  },
  trialText: {
    fontSize: 11,
    marginTop: 10,
    textAlign: "center",
  },
  eulaLink: {
    fontSize: 11,
    textDecorationLine: "underline",
    fontWeight: "600",
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
  },
  dividerText: {
    fontSize: 12,
    fontWeight: "500",
  },
  tokenBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  tokenBtnText: {
    fontWeight: "700",
    fontSize: 14,
  },
  tokenBalance: {
    fontSize: 11,
    fontWeight: "500",
  },
  adBtn: {
    width: "100%",
    alignItems: "center",
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  adBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
});
