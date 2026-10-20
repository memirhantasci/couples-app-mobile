import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Calendar } from "react-native-calendars";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react-native";
import { dayjs } from "@/lib/date";
import type { AppTheme } from "@/lib/theme";
import { CALENDAR_COLORS } from "./calendarColors";

interface LegendEntry {
  label: string;
  color: string;
  /** "r,g,b" used for the tinted chip background and border. */
  rgb: string;
  textLight: string;
  textDark: string;
}

const LEGEND_ENTRIES: LegendEntry[] = [
  { label: "Not", color: CALENDAR_COLORS.note, rgb: "236,72,153", textLight: "#BE185D", textDark: "#F472B6" },
  { label: "Ruh Halim", color: CALENDAR_COLORS.myMood, rgb: "245,158,11", textLight: "#B45309", textDark: "#FBBF24" },
  { label: "Partnerim", color: CALENDAR_COLORS.partnerMood, rgb: "14,165,233", textLight: "#0369A1", textDark: "#38BDF8" },
  { label: "Fotoğraf", color: CALENDAR_COLORS.photo, rgb: "16,185,129", textLight: "#047857", textDark: "#34D399" },
  { label: "Buluşma", color: CALENDAR_COLORS.meeting, rgb: "139,92,246", textLight: "#7C3AED", textDark: "#A78BFA" },
];

const PERIOD_LEGEND_ENTRY: LegendEntry = {
  label: "Döngü",
  color: CALENDAR_COLORS.period,
  rgb: "225,29,72",
  textLight: "#BE123C",
  textDark: "#FB7185",
};

interface CalendarMonthViewProps {
  theme: AppTheme;
  isLight: boolean;
  currentMonth: string;
  markedDates: Record<string, any>;
  /** Period legend entry is shown only to users who can see period data. */
  canSeePeriod: boolean;
  onDayPress: (day: { dateString: string }) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

function CalendarMonthViewComponent({
  theme,
  isLight,
  currentMonth,
  markedDates,
  canSeePeriod,
  onDayPress,
  onPrevMonth,
  onNextMonth,
}: CalendarMonthViewProps) {
  const legendEntries = canSeePeriod ? [...LEGEND_ENTRIES, PERIOD_LEGEND_ENTRY] : LEGEND_ENTRIES;

  // 🚀 PERFORMANS: Takvim tema nesnesini memoize ederek her render'da stylesheet recalculation yapılmasını önlüyoruz
  const calendarTheme = useMemo(
    () => ({
      calendarBackground: "transparent",
      textSectionTitleColor: theme.textMuted,
      selectedDayBackgroundColor: theme.accent,
      selectedDayTextColor: "#ffffff",
      todayTextColor: theme.accent,
      dayTextColor: theme.text,
      textDisabledColor: isLight ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.2)",
      dotColor: theme.accent,
      selectedDotColor: "#ffffff",
      monthTextColor: theme.text,
      textDayFontSize: 14,
      textDayHeaderFontSize: 11.5,
      textDayHeaderFontWeight: "600" as const,
      ...({
        "stylesheet.calendar.header": {
          header: {
            display: "none",
          },
        },
        "stylesheet.day.multiDot": {
          base: {
            width: 36,
            height: 36,
            alignItems: "center",
            paddingTop: 4,
            borderRadius: 12,
          },
          today: {
            borderColor: theme.accent,
            borderWidth: 1.5,
            borderRadius: 12,
          },
          selected: {
            backgroundColor: theme.accent,
            borderRadius: 12,
          },
          dot: {
            width: 5,
            height: 5,
            marginTop: 2,
            marginHorizontal: 1,
            borderRadius: 2.5,
            opacity: 1,
          },
        },
      } as any),
    }),
    [theme.accent, theme.text, theme.textMuted, isLight]
  );

  return (
    <>
      {/* AY SEÇİCİ ÇUBUĞU */}
      <View style={[styles.monthNavCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
        <TouchableOpacity onPress={onPrevMonth} style={[styles.monthArrowBtn, { backgroundColor: isLight ? theme.unitBg : "rgba(255,255,255,0.06)" }]} activeOpacity={0.75}>
          <ChevronLeft color={theme.text} size={20} />
        </TouchableOpacity>

        <View style={styles.monthTextBox}>
          <CalendarIcon size={16} color={theme.accent} />
          <Text style={[styles.monthText, { color: theme.text }]}>
            {dayjs(currentMonth).format("MMMM YYYY")}
          </Text>
        </View>

        <TouchableOpacity onPress={onNextMonth} style={[styles.monthArrowBtn, { backgroundColor: isLight ? theme.unitBg : "rgba(255,255,255,0.06)" }]} activeOpacity={0.75}>
          <ChevronRight color={theme.text} size={20} />
        </TouchableOpacity>
      </View>

      {/* TAKVİM BİLEŞENİ */}
      <View style={[styles.calendarCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
        <Calendar
          current={currentMonth}
          // Ay anahtarda OLMALI: react-native-calendars `current` değişince gösterdiği ayı kendiliğinden
          // güncellemez. Anahtardan çıkınca başlık Eylül yazarken ızgara Ekim'de kalıyor, Eylül'ün günlerine
          // basınca da Ekim'in tarihleri seçiliyordu.
          key={`${currentMonth.slice(0, 7)}_${theme.id}`}
          firstDay={1}
          onDayPress={onDayPress}
          markedDates={markedDates}
          markingType={"multi-dot"}
          theme={calendarTheme}
        />

        {/* LEJANT (RENK KILAVUZU) */}
        <View style={[styles.legendRow, { borderTopColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)" }]}>
          {legendEntries.map((entry) => (
            <View
              key={entry.label}
              style={[
                styles.legendItem,
                {
                  backgroundColor: `rgba(${entry.rgb},${isLight ? 0.08 : 0.14})`,
                  borderColor: `rgba(${entry.rgb},0.3)`,
                },
              ]}
            >
              <View style={[styles.legendDot, { backgroundColor: entry.color }]} />
              <Text style={[styles.legendText, { color: isLight ? entry.textLight : entry.textDark }]}>
                {entry.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

export const CalendarMonthView = React.memo(CalendarMonthViewComponent);

const styles = StyleSheet.create({
  /* AY GEZGİNİ */
  monthNavCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  monthArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  monthTextBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  monthText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.2,
  },

  /* TAKVİM KARTI */
  calendarCard: {
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    marginTop: 10,
    borderTopWidth: 1,
    flexWrap: "wrap",
    gap: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
});
