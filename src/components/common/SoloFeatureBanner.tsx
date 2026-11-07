import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { HeartHandshake } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";
import { useSoloGate } from "@/lib/soloGate";

/**
 * Tek kalan kullanıcı eşleşme isteyen bir özelliğe (fotoğraf, mektup, özel gün, buluşma, yıldız) girdiğinde
 * ekranın üstünde görünür: neden kapalı olduğunu söyler, eski kayıtlarının durduğunu hatırlatır ve yeni
 * eşleşmeye götürür. Eşleşmiş kullanıcıda hiçbir şey çizmez.
 */
export function SoloFeatureBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { theme } = useTheme();
  const { isSolo } = useSoloGate();
  if (!isSolo) return null;

  return (
    <View
      accessibilityRole="summary"
      style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.pillAccentBorder }, theme.cardShadow, style]}
    >
      <View style={[styles.icon, { backgroundColor: theme.pillAccentBg }]}>
        <HeartHandshake size={20} color={theme.accent} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.text }]}>{t("solo.banner.title")}</Text>
        <Text style={[styles.text, { color: theme.textSecondary }]}>{t("solo.banner.body")}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/profile")}
          style={[styles.cta, { backgroundColor: theme.accent }]}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>{t("solo.partnerRequired.cta")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 6 },
  title: { fontSize: 15, fontFamily: "Inter_700Bold" },
  text: { fontSize: 13.5, lineHeight: 20, fontFamily: "Inter_400Regular" },
  cta: {
    alignSelf: "flex-start",
    marginTop: 4,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  ctaText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_700Bold" },
});
