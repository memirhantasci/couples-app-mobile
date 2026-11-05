import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { CheckCircle2, ChevronDown, ChevronUp, Calendar, Pill } from "lucide-react-native";
import { dayjs } from "@/lib/date";
import type { AppTheme } from "@/lib/theme";
import type { MedicineHistoryGrouped } from "./medicineTypes";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

const getRelativeDateLabel = (dateStr: string, t: TFunction, language: string) => {
  const d = dayjs(dateStr);
  if (d.isSame(dayjs(), "day")) return t("common.today");
  if (d.isSame(dayjs().subtract(1, "day"), "day")) return t("common.yesterday");
  return d.locale(language).format("D MMMM, dddd");
};

interface MedicineHistoryListProps {
  theme: AppTheme;
  historyGrouped: MedicineHistoryGrouped;
  /** Dates in `historyGrouped`, newest first. */
  sortedDates: string[];
}

const DEFAULT_VISIBLE_DAYS = 3;

// ─── GEÇMİŞ (SON 14 GÜN) ─────────────────────────────────────────────────────
export function MedicineHistoryList({ theme, historyGrouped, sortedDates }: MedicineHistoryListProps) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isLight = theme.isLight;

  if (sortedDates.length === 0) {
    return (
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{t("medicine.history.title")}</Text>
        <Text style={[styles.historyEmptyText, { color: theme.textMuted }]}>{t("medicine.history.empty")}</Text>
      </View>
    );
  }

  const visibleDates = expanded ? sortedDates : sortedDates.slice(0, DEFAULT_VISIBLE_DAYS);
  const hasMore = sortedDates.length > DEFAULT_VISIBLE_DAYS;
  const remainingCount = sortedDates.length - DEFAULT_VISIBLE_DAYS;

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{t("medicine.history.title")}</Text>
        <Text style={[styles.daysCounter, { color: theme.textMuted }]}>
          {`${sortedDates.length} ${t("common.days", { defaultValue: "gün" })}`}
        </Text>
      </View>

      {visibleDates.map((dateStr) => {
        const meds = historyGrouped[dateStr] || [];
        const totalDrank = meds.reduce((acc, m) => acc + m.drankSlots, 0);
        const totalSlots = meds.reduce((acc, m) => acc + m.totalSlots, 0);
        const isAllTaken = totalSlots > 0 && totalDrank >= totalSlots;

        return (
          <View
            key={dateStr}
            style={[
              styles.dayCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
                ...theme.cardShadow,
              },
            ]}
          >
            {/* Gün Başlığı & Özet Rozeti */}
            <View style={styles.dayHeader}>
              <View style={styles.dayTitleGroup}>
                <Calendar size={13} color={isLight ? theme.accent : "#c084fc"} />
                <Text style={[styles.dayDateText, { color: theme.text }]}>
                  {getRelativeDateLabel(dateStr, t, i18n.language)}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  isAllTaken
                    ? {
                        backgroundColor: "rgba(34, 197, 94, 0.12)",
                        borderColor: "rgba(34, 197, 94, 0.25)",
                      }
                    : {
                        backgroundColor: "rgba(245, 158, 11, 0.12)",
                        borderColor: "rgba(245, 158, 11, 0.25)",
                      },
                ]}
              >
                {isAllTaken ? (
                  <>
                    <CheckCircle2 size={11} color="#22c55e" />
                    <Text style={styles.badgeTextSuccess}>{t("medicine.history.allTaken")}</Text>
                  </>
                ) : (
                  <Text style={styles.badgeTextPending}>
                    {t("medicine.history.dosesTaken", { taken: totalDrank, total: totalSlots })}
                  </Text>
                )}
              </View>
            </View>

            {/* O Güne Ait İlaçlar */}
            <View style={styles.medsContainer}>
              {meds.map((med, idx) => {
                const isMedComplete = med.drankSlots === med.totalSlots;
                const iconColor = isMedComplete ? "#22c55e" : "#f59e0b";

                return (
                  <View
                    key={`${dateStr}-${med.medicine_id || idx}`}
                    style={[
                      styles.medRow,
                      idx > 0 && [
                        styles.medRowBorder,
                        { borderTopColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.06)" },
                      ],
                    ]}
                  >
                    <View style={styles.medLeft}>
                      <View
                        style={[
                          styles.medIconBox,
                          {
                            backgroundColor: isMedComplete
                              ? "rgba(34, 197, 94, 0.1)"
                              : "rgba(245, 158, 11, 0.1)",
                          },
                        ]}
                      >
                        <Pill size={12} color={iconColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.medName, { color: theme.text }]} numberOfLines={1}>
                          {med.name}
                        </Text>
                        <Text style={[styles.medTimes, { color: theme.textMuted }]}>
                          {med.times.join(", ")}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.medRight}>
                      <Text
                        style={[
                          styles.doseProgressText,
                          {
                            color: isMedComplete
                              ? isLight
                                ? "#15803D"
                                : "#22c55e"
                              : isLight
                              ? "#B45309"
                              : "#f59e0b",
                          },
                        ]}
                      >
                        {med.drankSlots}/{med.totalSlots}
                      </Text>
                      <CheckCircle2 color={iconColor} size={16} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

      {/* Daha Fazla Göster / Daha Az Göster Butonu */}
      {hasMore && (
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
              ...theme.cardShadow,
            },
          ]}
          onPress={() => setExpanded((prev) => !prev)}
          activeOpacity={0.7}
        >
          <Text style={[styles.toggleBtnText, { color: theme.textSecondary }]}>
            {expanded
              ? t("medicine.history.showLess")
              : t("medicine.history.showMore", { count: remainingCount })}
          </Text>
          {expanded ? (
            <ChevronUp size={14} color={theme.textSecondary} />
          ) : (
            <ChevronDown size={14} color={theme.textSecondary} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionBlock: {
    gap: 10,
    marginTop: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.7,
  },
  daysCounter: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  historyEmptyText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    marginLeft: 4,
  },
  dayCard: {
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dayTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dayDateText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeTextSuccess: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#22c55e",
  },
  badgeTextPending: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#f59e0b",
  },
  medsContainer: {
    borderRadius: 14,
  },
  medRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
  },
  medRowBorder: {
    borderTopWidth: 1,
  },
  medLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    flex: 1,
    marginRight: 8,
  },
  medIconBox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  medName: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
  medTimes: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  medRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  doseProgressText: {
    fontSize: 11.5,
    fontFamily: "Inter_700Bold",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 2,
  },
  toggleBtnText: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
});
