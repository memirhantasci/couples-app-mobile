import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";

interface ModernSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  theme: AppTheme;
  defaultOpen?: boolean;
}

// ─── Modern Grup Kartı ────────────────────────────────────────────────────────
export function ModernSection({
  title,
  icon,
  children,
  theme,
  defaultOpen = true,
}: ModernSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
      <TouchableOpacity
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
        <View style={[styles.sectionContent, { borderTopColor: theme.cardBorder }]}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitleText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
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
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    gap: 14,
  },
});
