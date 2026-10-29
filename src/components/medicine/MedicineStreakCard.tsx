import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Pill, Check, Flame } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import type { MedicineTab, WeeklyComplianceDay } from "./medicineTypes";
import { useTranslation } from "react-i18next";

interface MedicineStreakCardProps {
  theme: AppTheme;
  isLight: boolean;
  activeTab: MedicineTab;
  weeklyCompliance: WeeklyComplianceDay[];
  streakCount: number;
}

// ─── HAFTALIK UYUM VE SERİ (STREAK) KARTI ────────────────────────────────────
export function MedicineStreakCard({
  theme,
  isLight,
  activeTab,
  weeklyCompliance,
  streakCount,
}: MedicineStreakCardProps) {
  const { t } = useTranslation();
  return (
    <View style={[styles.streakCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1, ...theme.cardShadow }]}>
      <View style={styles.streakHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={[styles.streakIconCircle, { backgroundColor: isLight ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.18)" }]}>
            <Flame size={20} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.streakTitle, { color: theme.text }]}>
              {streakCount > 0 ? t("medicine.streak.title", { count: streakCount }) : t("medicine.streak.habit")}
            </Text>
            <Text style={[styles.streakSub, { color: theme.textMuted }]}>
              {streakCount > 0
                ? t("medicine.streak.great")
                : (activeTab === "me" ? t("medicine.streak.startMine") : t("medicine.streak.partner"))}
            </Text>
          </View>
        </View>
      </View>

      {/* 7 GÜNLÜK HAP MATRİSİ */}
      <View style={styles.matrixRow}>
        {weeklyCompliance.map((dayItem) => {
          const isComplete = dayItem.status === "complete";
          const isPartial = dayItem.status === "partial";
          const isMissed = dayItem.status === "missed";
          const isToday = dayItem.isToday;

          const pillColor = isComplete
            ? "#22C55E"
            : isPartial
            ? "#F59E0B"
            : isMissed
            ? (isLight ? "#DC2626" : "#EF4444")
            : isToday
            ? theme.accent
            : (isLight ? "#9CA3AF" : "#6B7280");

          const pillBg = isComplete
            ? (isLight ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.2)")
            : isPartial
            ? (isLight ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.2)")
            : isMissed
            ? (isLight ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.18)")
            : isToday
            ? (isLight ? "rgba(225,29,72,0.08)" : "rgba(255,75,110,0.15)")
            : (isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)");

          return (
            <View
              key={dayItem.dateStr}
              style={[
                styles.matrixCol,
                isToday && {
                  borderColor: theme.accent,
                  borderWidth: 1,
                  borderRadius: 14,
                  backgroundColor: isLight ? "rgba(225,29,72,0.03)" : "rgba(255,75,110,0.05)",
                },
              ]}
            >
              <Text style={[styles.matrixDayLabel, { color: isToday ? theme.accent : theme.textMuted }]}>
                {dayItem.dayLabel}
              </Text>
              <View style={[styles.matrixPillCircle, { backgroundColor: pillBg }]}>
                {isComplete ? (
                  <Check size={14} color={pillColor} strokeWidth={3} />
                ) : (
                  <Pill size={14} color={pillColor} />
                )}
              </View>
              <Text style={[styles.matrixDayNum, { color: isToday ? theme.text : theme.textSecondary }]}>
                {dayItem.dayNumber}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  streakCard: {
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  streakHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  streakIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  streakTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  streakSub: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  matrixRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  matrixCol: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    flex: 1,
  },
  matrixDayLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  matrixPillCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  matrixDayNum: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
});
