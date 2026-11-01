import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { DateTimePickerSheet } from "@/components/ui/DateTimePickerSheet";
import { CalendarHeart, Calendar, Heart, ChevronRight, Lock, Clock, Sparkles } from "lucide-react-native";
import dayjs from "dayjs";
import type { AppTheme } from "@/lib/theme";
import { type DatesChangeStatus, daysUntilPeriodEnd } from "@/lib/relationshipDates";
import { ModernSection } from "./ModernSection";
import { SettingsButton } from "./SettingsButton";
import { AMBER, fieldSurface } from "./profileTokens";
import { profileSharedStyles } from "./profileSharedStyles";
import { Trans, useTranslation } from "react-i18next";

interface RelationshipDatesCardProps {
  theme: AppTheme;
  isLight: boolean;
  meetDate: string;
  relStartDate: string;
  loading: boolean;
  /** Sunucudaki çift bazlı değişiklik hakları (ilk 30 günde 2, sonra her 30 günde 1) */
  datesStatus?: DatesChangeStatus | null;
  hasChanges?: boolean;
  onChangeMeetDate: (value: string) => void;
  onChangeRelStartDate: (value: string) => void;
  onSave: () => void;
}

export function RelationshipDatesCard({
  theme,
  isLight,
  meetDate,
  relStartDate,
  loading,
  datesStatus,
  hasChanges = true,
  onChangeMeetDate,
  onChangeRelStartDate,
  onSave,
}: RelationshipDatesCardProps) {
  const { t, i18n } = useTranslation();
  const [showMeetDatePicker, setShowMeetDatePicker] = useState(false);
  const [showRelDatePicker, setShowRelDatePicker] = useState(false);

  const isLocked = !!datesStatus?.hasDates && datesStatus.remaining <= 0;
  const periodEndText = datesStatus?.periodEndsAt ? dayjs(datesStatus.periodEndsAt).locale(i18n.language).format("D MMMM YYYY") : null;

  /** Etiketli, dokununca tarih seçici açan dolgulu alan. */
  const renderDateField = (
    label: string,
    value: string,
    Icon: typeof Calendar,
    onOpen: () => void,
  ) => (
    <View style={profileSharedStyles.inputGroup}>
      <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={isLocked || loading}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.dateField,
          { backgroundColor: fieldSurface(theme) },
          isLocked && { opacity: 0.55 },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Icon size={18} color={theme.accent} />
        <Text style={[styles.dateText, { color: isLocked || !value ? theme.textMuted : theme.text }]}>
          {value ? dayjs(value).format("DD MMMM YYYY") : t("profile.dates.selectDate")}
        </Text>
        {isLocked ? (
          <Lock size={15} color={theme.textMuted} />
        ) : (
          <ChevronRight size={18} color={theme.textMuted} />
        )}
      </Pressable>
    </View>
  );

  return (
    <ModernSection
      title={t("profile.dates.title")}
      icon={<CalendarHeart size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={false}
    >
      {/* Çift Bazlı Kısıtlama Bilgilendirme Kartı */}
      {isLocked ? (
        <View style={[styles.notice, { backgroundColor: "rgba(255, 179, 0, 0.12)" }]}>
          <Lock size={16} color={AMBER} style={styles.noticeIcon} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.noticeTitle, { color: AMBER }]}>{t("profile.dates.lockedCardTitle")}</Text>
            <Text style={[styles.noticeText, { color: isLight ? "#555555" : "rgba(255,255,255,0.7)" }]}>
              <Trans
                i18nKey={periodEndText ? "profile.dates.lockWithDate" : "profile.dates.lockNoDate"}
                count={daysUntilPeriodEnd(datesStatus?.periodEndsAt ?? null)}
                values={{ periodEndText }}
                components={{ b: <Text style={{ fontFamily: "Inter_700Bold" }} /> }}
              />
            </Text>
          </View>
        </View>
      ) : datesStatus && datesStatus.remaining > 0 ? (
        <View style={[styles.notice, { backgroundColor: theme.pillAccentBg }]}>
          <Sparkles size={16} color={theme.accent} style={styles.noticeIcon} />
          <Text style={[styles.noticeText, styles.noticeTextFlex, { color: theme.accent, fontFamily: "Inter_500Medium" }]}>
            {datesStatus.hasDates
              ? periodEndText
                ? t("profile.dates.rightsWithRenewal", { count: datesStatus.remaining, periodEndText })
                : t("profile.dates.rightsNoRenewal", { count: datesStatus.remaining })
              : t("profile.dates.firstSaveHint")}
          </Text>
        </View>
      ) : (
        <View style={styles.hintRow}>
          <Clock size={12} color={theme.textMuted} style={styles.hintIcon} />
          <Text style={[styles.hintText, { color: theme.textMuted }]}>{t("profile.dates.hint")}</Text>
        </View>
      )}

      {renderDateField(t("profile.dates.meetLabel"), meetDate, Calendar, () => setShowMeetDatePicker(true))}
      {renderDateField(t("profile.dates.relationshipLabel"), relStartDate, Heart, () => setShowRelDatePicker(true))}

      <DateTimePickerSheet
        visible={showMeetDatePicker}
        mode="date"
        title={t("setup.dates.meetPickerTitle")}
        value={meetDate ? dayjs(meetDate).toDate() : new Date()}
        maximumDate={relStartDate && dayjs(relStartDate).isBefore(dayjs(), "day") ? dayjs(relStartDate).toDate() : new Date()}
        onCancel={() => setShowMeetDatePicker(false)}
        onConfirm={(selectedDate) => {
          setShowMeetDatePicker(false);
          onChangeMeetDate(dayjs(selectedDate).format("YYYY-MM-DD"));
        }}
      />
      <DateTimePickerSheet
        visible={showRelDatePicker}
        mode="date"
        title={t("setup.dates.relationshipPickerTitle")}
        value={relStartDate ? dayjs(relStartDate).toDate() : new Date()}
        maximumDate={new Date()}
        onCancel={() => setShowRelDatePicker(false)}
        onConfirm={(selectedDate) => {
          setShowRelDatePicker(false);
          onChangeRelStartDate(dayjs(selectedDate).format("YYYY-MM-DD"));
        }}
      />

      <SettingsButton
        label={t("profile.dates.update")}
        onPress={onSave}
        theme={theme}
        loading={loading}
        disabled={isLocked || !hasChanges}
      />
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  dateText: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 16,
  },
  noticeIcon: {
    marginTop: 1,
  },
  noticeTitle: {
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
  },
  noticeText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  noticeTextFlex: {
    flex: 1,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  hintIcon: {
    marginTop: 3,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },
});
