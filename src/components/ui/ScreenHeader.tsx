import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlignJustify, ChevronLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { TourGuideButton } from "@/components/tour/TourGuideButton";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Verilirse sağda rehber (?) butonu görünür. */
  onOpenTour?: () => void;
  /** Rehber ile menü butonu arasına eklenen ekrana özel butonlar. */
  actions?: React.ReactNode;
  /** Varsayılan: önceki ekrana, yoksa ana sayfaya dön. */
  onBack?: () => void;
  /** Verilirse geri her zaman bu ekrana döner (varsayılan: önceki ekran, yoksa ana sayfa). */
  fallbackRoute?: Href;
}

/** Tüm ekranların ortak üst alanı: yuvarlak butonlar satırı ve altında sola hizalı büyük başlık. */
export function ScreenHeader({ title, subtitle, onOpenTour, actions, onBack, fallbackRoute }: ScreenHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, isLight } = useTheme();

  const buttonStyle = [
    styles.button,
    { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)" },
  ];

  const goBack = () => {
    if (onBack) return onBack();
    // Form ekranları (ekle/düzenle) kendi liste ekranını verir: geri her zaman oraya döner
    if (fallbackRoute) return router.navigate(fallbackRoute);
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };

  return (
    <View style={{ paddingTop: insets.top + 14 }}>
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={goBack}
          style={buttonStyle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft color={theme.text} size={24} />
        </TouchableOpacity>

        <View style={styles.actions}>
          {onOpenTour ? <TourGuideButton onPress={onOpenTour} /> : null}
          {actions}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("common.openMenu")}
            onPress={() => router.push("/menu")}
            style={buttonStyle}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AlignJustify color={theme.textSecondary} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Ekrana özel ek butonlar için ScreenHeader ile aynı görünümde yuvarlak buton. */
export function ScreenHeaderButton({
  onPress,
  label,
  children,
}: {
  onPress: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const { isLight } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.button, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)" }]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  buttonsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleBlock: {
    paddingHorizontal: 24,
    paddingBottom: 14,
  },
  title: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
