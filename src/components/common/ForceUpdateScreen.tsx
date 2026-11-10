import { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/ui/EmptyState";
import { APP_NAME } from "@/constants/brand";
import { useTheme } from "@/context/ThemeContext";

interface ForceUpdateScreenProps {
  /** Mağaza adresi (karar modülü doğrulamış olur). */
  storeUrl: string;
  /** Sunucudan gelen metin; null ise yerel metin gösterilir. */
  serverMessage: string | null;
  /** Cihazdaki görünen sürüm (destek yazışmalarında işe yarar); yoksa satır gizlenir. */
  installedVersion: string | null;
}

/**
 * Zorunlu güncelleme ekranı: uygulamanın yerine çizilir (navigator yoktur), kapatma / geri düğmesi yoktur.
 * Yalnızca AppTheme token'larıyla boyanır; boş durum kartlarıyla (EmptyState) aynı ailedendir.
 * Expo Router'a bağlı bileşen kullanmaz (ScreenBackground useIsFocused ister, burada navigator yok).
 */
export function ForceUpdateScreen({ storeUrl, serverMessage, installedVersion }: ForceUpdateScreenProps) {
  const { theme, isLight } = useTheme();
  const { t } = useTranslation();
  const [storeFailed, setStoreFailed] = useState(false);

  const openStore = async () => {
    try {
      await Linking.openURL(storeUrl);
      setStoreFailed(false);
    } catch {
      setStoreFailed(true);
    }
  };

  return (
    <LinearGradient colors={theme.bgGradient} style={styles.root} testID="force-update-screen">
      <StatusBar style={isLight ? "dark" : "light"} />
      <View style={styles.content} accessibilityViewIsModal>
        <EmptyState
          emoji="💫"
          title={t("forceUpdate.title")}
          description={serverMessage ?? t("forceUpdate.message", { app: APP_NAME })}
          ctaLabel={t("forceUpdate.cta")}
          onPressCta={openStore}
          theme={theme}
          style={styles.card}
        />
        {storeFailed ? (
          <Text style={[styles.note, { color: theme.textSecondary }]} accessibilityLiveRegion="polite">
            {t("forceUpdate.storeError", { app: APP_NAME })}
          </Text>
        ) : null}
        {installedVersion ? (
          <Text style={[styles.note, { color: theme.textMuted }]}>
            {t("forceUpdate.installedVersion", { version: installedVersion })}
          </Text>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: { marginTop: 0, width: "100%", maxWidth: 420, alignSelf: "center" },
  note: {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
