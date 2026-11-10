import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Dices } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { TEXT_WHITE } from "@/lib/theme";
import { weakFill } from "./wishlistTheme";

/**
 * 🎲 "Bana bir tane seç": bölüm başlığının sağında küçük, sakin düğme (ekranın vurgusu "İkimiz de"de kalır).
 * Görünen metin kısadır; seçimin nereden yapılacağı (ikinizin istedikleri / tüm açıklar) erişilebilirlik
 * etiketinde söylenir. `onAccent`: açık temada dolu vurgu zemininin ("İkimiz de" başlığı) üzerinde.
 */
export function PickButton({
  source,
  onPress,
  onAccent = false,
}: {
  source: "both" | "open";
  onPress: () => void;
  onAccent?: boolean;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const sub = source === "both" ? t("wishlist.pick.subBoth") : t("wishlist.pick.subAll");
  const color = onAccent ? TEXT_WHITE : theme.textSecondary;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${t("wishlist.pick.cta")}, ${sub}`}
      activeOpacity={0.75}
      onPress={onPress}
      style={styles.touch}
    >
      <View
        style={[
          styles.pill,
          onAccent
            ? { backgroundColor: "rgba(255,255,255,0.2)", borderColor: "transparent" }
            : { backgroundColor: weakFill(theme), borderColor: theme.isLight ? theme.cardBorder : "transparent" },
        ]}
      >
        <Dices size={15} color={onAccent ? TEXT_WHITE : theme.accent} />
        <Text numberOfLines={1} style={[styles.label, { color }]}>
          {t("wishlist.pick.button")}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touch: {
    minHeight: 44,
    justifyContent: "center",
    flexShrink: 0,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  label: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
});
