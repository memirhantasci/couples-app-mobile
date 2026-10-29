import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Camera, FileText, Smile, MapPin, Droplet } from "lucide-react-native";
import { CALENDAR_COLORS } from "./calendarColors";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";

export type DaySectionVariant = "photo" | "note" | "mood" | "meeting" | "period";

interface VariantConfig {
  Icon: typeof Camera;
  color: string;
  labelKey: ParseKeys;
  /** "r,g,b" used for the tinted badge background and border. */
  rgb: string;
  textLight: string;
  textDark: string;
  /** Vertical gap between the badge and the section's cards. */
  gap: number;
}

const VARIANTS: Record<DaySectionVariant, VariantConfig> = {
  photo: {
    Icon: Camera,
    color: CALENDAR_COLORS.photo,
    labelKey: "calendar.sections.photos",
    rgb: "16,185,129",
    textLight: "#047857",
    textDark: "#34D399",
    gap: 12,
  },
  note: {
    Icon: FileText,
    color: CALENDAR_COLORS.note,
    labelKey: "calendar.sections.notes",
    rgb: "236,72,153",
    textLight: "#BE185D",
    textDark: "#F472B6",
    gap: 10,
  },
  mood: {
    Icon: Smile,
    color: CALENDAR_COLORS.myMood,
    labelKey: "calendar.sections.moods",
    rgb: "245,158,11",
    textLight: "#B45309",
    textDark: "#FBBF24",
    gap: 10,
  },
  meeting: {
    Icon: MapPin,
    color: CALENDAR_COLORS.meeting,
    labelKey: "calendar.sections.meetings",
    rgb: "139,92,246",
    textLight: "#7C3AED",
    textDark: "#A78BFA",
    gap: 10,
  },
  period: {
    Icon: Droplet,
    color: CALENDAR_COLORS.period,
    labelKey: "calendar.sections.period",
    rgb: "225,29,72",
    textLight: "#BE123C",
    textDark: "#FB7185",
    gap: 10,
  },
};

/** Coloured left edge shared by the cards inside a section. */
export function dayItemAccent(variant: DaySectionVariant) {
  return { borderLeftWidth: 3.5, borderLeftColor: VARIANTS[variant].color };
}

interface DaySectionCardProps {
  variant: DaySectionVariant;
  isLight: boolean;
  children: React.ReactNode;
}

export function DaySectionCard({ variant, isLight, children }: DaySectionCardProps) {
  const { t } = useTranslation();
  const { Icon, color, labelKey, rgb, textLight, textDark, gap } = VARIANTS[variant];

  return (
    <View style={{ gap }}>
      <View
        style={[
          styles.sectionHeaderBadge,
          {
            backgroundColor: `rgba(${rgb},${isLight ? 0.1 : 0.16})`,
            borderColor: `rgba(${rgb},0.3)`,
          },
        ]}
      >
        <Icon size={15} color={color} />
        <Text style={[styles.sectionHeaderText, { color: isLight ? textLight : textDark }]}>{t(labelKey)}</Text>
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeaderBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
});
