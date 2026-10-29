import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { dayjs } from "@/lib/date";
import type { AppTheme } from "@/lib/theme";
import type { MedicineHistoryGrouped } from "./medicineTypes";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

// t ve dil parametre olarak alınır: bileşen render sırasında çağırır, dil değişince etiket yenilenir
const getRelativeDateLabel = (dateStr: string, t: TFunction, language: string) => {
  const d = dayjs(dateStr);
  if (d.isSame(dayjs(), "day")) return t("common.today");
  if (d.isSame(dayjs().subtract(1, "day"), "day")) return t("common.yesterday");
  return d.locale(language).format("D MMMM");
};

interface MedicineHistoryListProps {
  theme: AppTheme;
  historyGrouped: MedicineHistoryGrouped;
  /** Dates in `historyGrouped`, newest first. */
  sortedDates: string[];
}

// ─── GEÇMİŞ (SON 14 GÜN) ─────────────────────────────────────────────────────
export function MedicineHistoryList({ theme, historyGrouped, sortedDates }: MedicineHistoryListProps) {
  const { t, i18n } = useTranslation();
  return (
    <View style={styles.sectionBlock}>
      <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{t("medicine.history.title")}</Text>
      {sortedDates.length === 0 ? (
        <Text style={[styles.historyEmptyText, { color: theme.textMuted }]}>{t("medicine.history.empty")}</Text>
      ) : (
        sortedDates.map((dateStr) => (
          <React.Fragment key={dateStr}>
            {historyGrouped[dateStr].map((med, idx) => {
              const isAllDrank = med.drankSlots === med.totalSlots;
              const iconColor = isAllDrank ? "#22c55e" : "#f59e0b";

              return (
                <View key={`${dateStr}-${idx}`} style={[styles.historyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historyDate, { color: theme.text }]}>{getRelativeDateLabel(dateStr, t, i18n.language)}</Text>
                    <Text style={[styles.historyMedSub, { color: theme.textSecondary }]}>
                      {t("medicine.history.entry", { name: med.name, taken: med.drankSlots, total: med.totalSlots, times: med.times.join(", ") })}
                    </Text>
                  </View>
                  <CheckCircle2 color={iconColor} size={20} />
                </View>
              );
            })}
          </React.Fragment>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionBlock: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.7,
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  historyDate: {
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  historyMedSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  historyEmptyText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    marginLeft: 4,
  },
});
