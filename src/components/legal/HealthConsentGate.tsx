import { useState, type ReactNode } from "react";
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeartPulse } from "lucide-react-native";
import { Trans, useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { useHealthConsent } from "@/lib/consent";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { ConsentCheckbox } from "@/components/ui/ConsentCheckbox";
import { LegalModal } from "./LegalModal";

/**
 * Regl / ilaç gibi sağlık verisi işleyen ekranları saran kapı (KVKK m.6: özel nitelikli kişisel veri).
 * Açık rıza; kayıttaki koşul onayından ayrı, işaretlenmemiş başlayan bir kutuyla ve ekranın ilk
 * kullanımında alınır. Rıza verilmezse ekran açılmaz, kullanıcı geri döner.
 */
export function HealthConsentGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { theme, isLight } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status, grant } = useHealthConsent();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [legalVisible, setLegalVisible] = useState(false);

  if (status === "granted") return <>{children}</>;

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  const handleGrant = async () => {
    if (!checked || saving) return;
    setSaving(true);
    try {
      await grant();
    } finally {
      setSaving(false);
    }
  };

  const points = [
    t("legal.healthConsent.point1"),
    t("legal.healthConsent.point2"),
    t("legal.healthConsent.point3"),
    t("legal.healthConsent.point4"),
  ];

  return (
    <ScreenBackground>
      {status === "loading" ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.iconCircle, { backgroundColor: `${theme.accent}22` }]}>
            <HeartPulse color={theme.accent} size={40} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>{t("legal.healthConsent.title")}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t("legal.healthConsent.subtitle")}</Text>

          <View
            style={[
              styles.card,
              { backgroundColor: isLight ? theme.unitBg : "rgba(255,255,255,0.06)", borderColor: theme.cardBorder },
            ]}
          >
            {points.map((point) => (
              <View key={point} style={styles.pointRow}>
                <Text style={[styles.bullet, { color: theme.accent }]}>•</Text>
                <Text style={[styles.pointText, { color: theme.text }]}>{point}</Text>
              </View>
            ))}
          </View>

          <View style={styles.checkboxWrap}>
            <ConsentCheckbox
              checked={checked}
              onToggle={() => setChecked((v) => !v)}
              accentColor={theme.accent}
              borderColor={theme.textMuted}
              accessibilityLabel={t("legal.healthConsent.checkboxA11y")}
            >
              <Text style={[styles.checkboxText, { color: theme.textSecondary }]}>
                <Trans
                  i18nKey="legal.healthConsent.checkbox"
                  components={{
                    consent: (
                      <Text style={[styles.link, { color: theme.accent }]} onPress={() => setLegalVisible(true)} />
                    ),
                  }}
                />
              </Text>
            </ConsentCheckbox>
          </View>

          <TouchableOpacity
            onPress={handleGrant}
            disabled={!checked || saving}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: !checked || saving }}
            style={[styles.cta, { backgroundColor: theme.accent, opacity: checked && !saving ? 1 : 0.4 }]}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{t("legal.healthConsent.accept")}</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleBack} disabled={saving} activeOpacity={0.7} style={styles.secondary}>
            <Text style={[styles.secondaryText, { color: theme.textMuted }]}>{t("legal.healthConsent.decline")}</Text>
          </TouchableOpacity>

          <Text style={[styles.footnote, { color: theme.textMuted }]}>{t("legal.healthConsent.withdrawNote")}</Text>
        </ScrollView>
      )}

      <LegalModal
        visible={legalVisible}
        onClose={() => setLegalVisible(false)}
        initialDoc="consent"
        accentColor={theme.accent}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { paddingHorizontal: 24, alignItems: "center" },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center", letterSpacing: -0.4, marginBottom: 8 },
  subtitle: { fontSize: 14.5, lineHeight: 21, textAlign: "center", marginBottom: 22 },
  card: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 18, gap: 12, marginBottom: 22 },
  pointRow: { flexDirection: "row", gap: 10 },
  bullet: { fontSize: 16, lineHeight: 21, fontFamily: "Inter_700Bold" },
  pointText: { flex: 1, fontSize: 14, lineHeight: 21 },
  checkboxWrap: { width: "100%", marginBottom: 22 },
  checkboxText: { fontSize: 13.5, lineHeight: 20 },
  link: { fontFamily: "Inter_700Bold", textDecorationLine: "underline" },
  cta: { width: "100%", paddingVertical: 17, borderRadius: 26, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  secondary: { paddingVertical: 14, marginTop: 6 },
  secondaryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  footnote: { fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 6 },
});
