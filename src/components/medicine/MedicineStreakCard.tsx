import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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

const FLAME = "#F97316";

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
    <View style={[styles.card, { backgroundColor: theme.cardBg, ...theme.cardShadow }]}>
      {/* Seri varken üstten turuncu bir sıcaklık parıltısı */}
      <LinearGradient
        pointerEvents="none"
        colors={[streakCount > 0 ? `${FLAME}30` : `${theme.accent}1A`, "rgba(0,0,0,0)"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <View style={[styles.flameTile, { backgroundColor: `${FLAME}22` }]}>
          <Flame size={26} color={FLAME} fill={streakCount > 0 ? FLAME : "transparent"} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>
            {streakCount > 0 ? t("medicine.streak.title", { count: streakCount }) : t("medicine.streak.habit")}
          </Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            {streakCount > 0
              ? t("medicine.streak.great")
              : activeTab === "me"
              ? t("medicine.streak.startMine")
              : t("medicine.streak.partner")}
          </Text>
        </View>
      </View>

      {/* 7 günlük uyum şeridi */}
      <View style={styles.weekRow}>
        {weeklyCompliance.map((day) => {
          const complete = day.status === "complete";
          const partial = day.status === "partial";
          const missed = day.status === "missed";

          const color = complete
            ? "#22C55E"
            : partial
            ? "#F59E0B"
            : missed
            ? isLight
              ? "#DC2626"
              : "#EF4444"
            : day.isToday
            ? theme.accent
            : theme.textMuted;
          const bg = complete
            ? "rgba(34,197,94,0.18)"
            : partial
            ? "rgba(245,158,11,0.18)"
            : missed
            ? "rgba(239,68,68,0.16)"
            : day.isToday
            ? `${theme.accent}22`
            : isLight
            ? "rgba(0,0,0,0.05)"
            : "rgba(255,255,255,0.06)";

          return (
            <View key={day.dateStr} style={styles.dayCol}>
              <Text style={[styles.dayLabel, { color: day.isToday ? theme.accent : theme.textMuted }]}>
                {day.dayLabel}
              </Text>
              <View style={[styles.dayCircle, { backgroundColor: bg }]}>
                {complete ? <Check size={16} color={color} strokeWidth={3} /> : <Pill size={15} color={color} />}
              </View>
              <Text
                style={[
                  styles.dayNum,
                  { color: day.isToday ? theme.text : theme.textSecondary },
                  day.isToday && { fontFamily: "Inter_700Bold" },
                ]}
              >
                {day.dayNumber}
              </Text>
              <View style={[styles.todayDot, { backgroundColor: day.isToday ? theme.accent : "transparent" }]} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: 18,
    gap: 18,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  flameTile: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  sub: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayCol: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  dayLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNum: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
