import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { MapThemeType } from "./mapTypes";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";

interface MapThemePickerProps {
  accent: string;
  isLight: boolean;
  mapTheme: MapThemeType;
  onSelect: (theme: MapThemeType) => void;
}

const THEME_OPTIONS: { id: MapThemeType; labelKey: ParseKeys; descKey: ParseKeys }[] = [
  { id: "romantic", labelKey: "map.theme.romantic", descKey: "map.theme.romanticDesc" },
  { id: "midnight", labelKey: "map.theme.midnight", descKey: "map.theme.midnightDesc" },
  { id: "silver", labelKey: "map.theme.silver", descKey: "map.theme.silverDesc" },
];

// ─── TEMA SEÇİCİ AÇILIR MENÜ ──────────────────────────────────────────────────
export function MapThemePicker({ accent, isLight, mapTheme, onSelect }: MapThemePickerProps) {
  const { t } = useTranslation();
  return (
    <View style={[styles.themePickerMenu, { backgroundColor: isLight ? "#FFFFFF" : "#1A1626" }]}>
      <Text style={[styles.themeMenuHeader, { color: isLight ? "#333" : "#fff" }]}>
        {t("map.theme.title")}
      </Text>
      <View style={styles.themeOptionsRow}>
        {THEME_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.themeOptionBtn,
              { borderColor: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.12)" },
              mapTheme === option.id && {
                borderColor: accent,
                backgroundColor: `${accent}15`,
              },
            ]}
            onPress={() => onSelect(option.id)}
          >
            <Text
              style={[
                styles.themeOptionTitle,
                { color: isLight ? "#444" : "#FFFFFF" },
                mapTheme === option.id && { color: accent },
              ]}
            >
              {t(option.labelKey)}
            </Text>
            <Text
              style={[
                styles.themeOptionDesc,
                { color: isLight ? "#888" : "rgba(255,255,255,0.7)" },
              ]}
            >
              {t(option.descKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  themePickerMenu: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  themeMenuHeader: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  themeOptionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  themeOptionBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
  },
  themeOptionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#444",
  },
  themeOptionDesc: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#888",
    marginTop: 2,
  },
});
