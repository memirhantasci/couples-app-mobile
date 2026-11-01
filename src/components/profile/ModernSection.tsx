import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import { hairlineColor } from "./profileTokens";

interface ModernSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  theme: AppTheme;
  defaultOpen?: boolean;
  /** Açılan içerik kart kenarlarına kadar uzanan, ayraçlı satır listesi olur (iç boşluk yok). */
  flush?: boolean;
}

// ─── Modern Grup Kartı ────────────────────────────────────────────────────────
export function ModernSection({
  title,
  icon,
  children,
  theme,
  defaultOpen = true,
  flush = false,
}: ModernSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const divider = hairlineColor(theme);

  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, ...theme.cardShadow }]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        activeOpacity={0.78}
        onPress={() => setIsOpen(!isOpen)}
        style={styles.sectionHeader}
      >
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
            {icon}
          </View>
          <Text style={[styles.sectionTitleText, { color: theme.text }]}>{title}</Text>
        </View>

        <View style={styles.chevronWrapper}>
          {isOpen ? (
            <ChevronUp size={18} color={theme.textMuted} />
          ) : (
            <ChevronDown size={18} color={theme.textMuted} />
          )}
        </View>
      </TouchableOpacity>

      {isOpen && (
        flush ? (
          <View style={[styles.flushContent, { borderTopColor: divider }]}>
            {React.Children.toArray(children).map((child, index) => (
              <React.Fragment key={index}>
                {index > 0 ? <View style={[styles.flushDivider, { backgroundColor: divider }]} /> : null}
                {child}
              </React.Fragment>
            ))}
          </View>
        ) : (
          <View style={[styles.sectionContent, { borderTopColor: divider }]}>
            {children}
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 24,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  sectionHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginRight: 8,
  },
  sectionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitleText: {
    flex: 1,
    fontSize: 15.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.2,
  },
  chevronWrapper: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  flushContent: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  flushDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
});
