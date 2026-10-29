import React from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Pill, CheckCircle2, Clock, AlertCircle } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import type { MedicineItem, MedicineTab } from "./medicineTypes";
import { useTranslation } from "react-i18next";

interface MedicineDoseCardProps {
  medicine: MedicineItem;
  theme: AppTheme;
  activeTab: MedicineTab;
  /** `${medicineId}_${HH:mm}` → "DRANK" | "MISSED" | "PENDING" */
  statusMap: Record<string, string>;
  /** `${medicineId}_${HH:mm}` of the slot currently being saved, if any. */
  loadingSlot: string | null;
  /** Current time as "HH:mm", used to tell upcoming doses from due ones. */
  currentHMS: string;
  onLog: (medicineId: number, status: "DRANK" | "MISSED", timeSlot: string) => void;
}

// ─── BUGÜNÜN İLACI: DOZ SLOTLARI ─────────────────────────────────────────────
function MedicineDoseCardBase({
  medicine: m,
  theme,
  activeTab,
  statusMap,
  loadingSlot,
  currentHMS,
  onLog,
}: MedicineDoseCardProps) {
  const { t } = useTranslation();
  const times = Array.isArray(m.times) && m.times.length > 0
    ? m.times.map((t) => t.substring(0, 5))
    : [m.time ? m.time.substring(0, 5) : "08:00"];

  return (
    <View style={[styles.medCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
      <View style={styles.medCardHeader}>
        <View style={[styles.medIconBox, { backgroundColor: theme.pillAccentBg }]}>
          <Pill color={theme.accent} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.medName, { color: theme.text }]}>{m.name}</Text>
          <Text style={[styles.medSub, { color: theme.textMuted }]}>{t("medicine.dose.perDay", { count: times.length, times: times.join(", ") })}</Text>
        </View>
      </View>

      {/* Dozaj Slotları */}
      <View style={styles.slotsContainer}>
        {times.map((slotTime, slotIdx) => {
          const key = `${m.id}_${slotTime}`;
          const itemKey = `${m.id}_${slotTime}_${slotIdx}`;
          const status = statusMap[key] || "PENDING";
          const isDrank = status === "DRANK";
          const isMissed = status === "MISSED";
          const isSlotLoading = loadingSlot === key;
          const isTimePassed = currentHMS >= slotTime;

          if (isSlotLoading) {
            return (
              <View key={itemKey} style={[styles.slotStateBox, { backgroundColor: theme.unitBg }]}>
                <ActivityIndicator color={theme.accent} size="small" />
              </View>
            );
          }

          if (isDrank) {
            return (
              <View key={itemKey} style={[styles.slotStateBox, styles.drankStateBox]}>
                <CheckCircle2 size={16} color={theme.isLight ? "#15803D" : "#22c55e"} />
                <Text style={[styles.drankStateText, theme.isLight && { color: "#15803D" }]}>{t("medicine.dose.taken", { time: slotTime })}</Text>
              </View>
            );
          }

          if (isMissed) {
            return (
              <View key={itemKey} style={[styles.slotStateBox, { backgroundColor: theme.unitBg }]}>
                <Text style={[styles.missedStateText, { color: theme.textMuted }]}>{t("medicine.dose.skipped", { time: slotTime })}</Text>
              </View>
            );
          }

          if (!isTimePassed) {
            return (
              <View key={itemKey} style={[styles.slotStateBox, { backgroundColor: theme.unitBg }]}>
                <Clock size={13} color={theme.textMuted} />
                <Text style={[styles.waitingStateText, { color: theme.textSecondary }]}>{t("medicine.dose.pending", { time: slotTime })}</Text>
              </View>
            );
          }

          if (activeTab === "partner") {
            return (
              <View key={itemKey} style={[styles.slotStateBox, { backgroundColor: theme.unitBg }]}>
                <AlertCircle size={14} color={theme.isLight ? "#B45309" : "#f59e0b"} />
                <Text style={[styles.waitingStateText, { color: theme.textSecondary }]}>{t("medicine.dose.notTaken", { time: slotTime })}</Text>
              </View>
            );
          }

          // Kullanıcının kendi ilacı için aksiyon butonları
          return (
            <View key={itemKey} style={styles.actionSlotRow}>
              <TouchableOpacity
                style={[styles.skipBtn, { backgroundColor: theme.unitBg }]}
                onPress={() => onLog(m.id, "MISSED", slotTime)}
                activeOpacity={0.8}
              >
                <Text style={[styles.skipBtnText, { color: theme.textSecondary }]}>{t("medicine.dose.skip", { time: slotTime })}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.takeBtn, { backgroundColor: theme.accent }]}
                onPress={() => onLog(m.id, "DRANK", slotTime)}
                activeOpacity={0.85}
              >
                <CheckCircle2 size={16} color="#ffffff" />
                <Text style={styles.takeBtnText}>{t("medicine.dose.took", { time: slotTime })}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export const MedicineDoseCard = React.memo(MedicineDoseCardBase);

const styles = StyleSheet.create({
  medCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  medCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  medIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  medName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  medSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  slotsContainer: {
    gap: 8,
  },
  slotStateBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  drankStateBox: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  drankStateText: {
    color: "#22c55e",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  missedStateText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
  },
  waitingStateText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
  },
  actionSlotRow: {
    flexDirection: "row",
    gap: 10,
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  skipBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  takeBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  takeBtnText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
  },
});
