import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { AppTheme } from "@/lib/theme";
import { fieldSurface, hairlineColor } from "./profileTokens";

interface SettingsGroupProps {
  /** Grubun üstünde küçük harfli etiket olarak görünür. */
  title?: string;
  /** Grubun altında açıklama notu olarak görünür. */
  footer?: string;
  theme: AppTheme;
  /** Açılır bir kartın içinde kullanım: kart yüzeyi yerine hafif dolgu, gölgesiz, daha küçük yarıçap. */
  inset?: boolean;
  children: React.ReactNode;
}

/** Satırları tek yüzeyde toplayan, aralarına ince ayraç koyan "inset grouped" liste kartı. */
export function SettingsGroup({ title, footer, theme, inset, children }: SettingsGroupProps) {
  const rows = React.Children.toArray(children);

  return (
    <View style={styles.wrapper}>
      {title ? <Text style={[styles.title, { color: theme.textMuted }]}>{title}</Text> : null}

      <View
        style={[
          styles.surface,
          inset
            ? { backgroundColor: fieldSurface(theme), borderRadius: 18 }
            : { backgroundColor: theme.cardBg, ...theme.cardShadow },
        ]}
      >
        {rows.map((row, index) => (
          <React.Fragment key={index}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: hairlineColor(theme) }]} /> : null}
            {row}
          </React.Fragment>
        ))}
      </View>

      {footer ? <Text style={[styles.footer, { color: theme.textMuted }]}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  title: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 8,
  },
  surface: {
    borderRadius: 24,
    overflow: "hidden",
  },
  // Ayraç ikon sütununun sağından başlar (iOS ayarlar listesi gibi)
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
  footer: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    paddingHorizontal: 8,
  },
});
