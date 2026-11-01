import React from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";

const DESTRUCTIVE = "#ff4d6a";

interface SettingsRowProps {
  icon?: LucideIcon;
  /** İkon yerine karoda gösterilen özel öğe (örn. bayrak emojisi). */
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Sağda, ok işaretinin yanında gösterilen kısa değer. */
  value?: string;
  /** Ok yerine gösterilecek özel sağ öğe (onay işareti, anahtar vb.). */
  trailing?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  loading?: boolean;
  theme: AppTheme;
}

/** İkon karolu, başlık/alt başlıklı tek ayar satırı. SettingsGroup içinde kullanılır. */
export function SettingsRow({
  icon: Icon,
  leading,
  title,
  subtitle,
  value,
  trailing,
  onPress,
  destructive,
  loading,
  theme,
}: SettingsRowProps) {
  const tint = destructive ? DESTRUCTIVE : theme.accent;
  const pressedBg = theme.isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)";

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      disabled={!onPress || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: pressedBg }]}
    >
      <View style={[styles.iconTile, { backgroundColor: `${tint}22` }]}>
        {leading ?? (Icon ? <Icon size={18} color={tint} /> : null)}
      </View>

      <View style={styles.texts}>
        <Text style={[styles.title, { color: destructive ? DESTRUCTIVE : theme.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <>
          {value ? <Text style={[styles.value, { color: theme.textMuted }]}>{value}</Text> : null}
          {trailing ?? (onPress && !destructive ? <ChevronRight size={18} color={theme.textMuted} /> : null)}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  value: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
