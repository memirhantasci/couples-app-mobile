import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { DateTimePickerSheet } from "@/components/ui/DateTimePickerSheet";
import { CalendarHeart, Calendar, Heart, ChevronRight, Lock, Clock, Sparkles } from "lucide-react-native";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import type { AppTheme } from "@/lib/theme";
import { type DatesChangeStatus, daysUntilPeriodEnd } from "@/lib/relationshipDates";
import { ModernSection } from "./ModernSection";
import { profileSharedStyles } from "./profileSharedStyles";

dayjs.locale("tr");

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
  const [showMeetDatePicker, setShowMeetDatePicker] = useState(false);
  const [showRelDatePicker, setShowRelDatePicker] = useState(false);

  const isLocked = !!datesStatus?.hasDates && datesStatus.remaining <= 0;
  const periodEndText = datesStatus?.periodEndsAt ? dayjs(datesStatus.periodEndsAt).format("D MMMM YYYY") : null;

  const pickerBtnStyle = [
    styles.datePickerBtn,
    {
      backgroundColor: isLocked ? (isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.03)") : theme.unitBg,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
      opacity: isLocked ? 0.6 : 1,
    },
  ];

  return (
    <ModernSection
      title="İlişki Tarihleri"
      icon={<CalendarHeart size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={false}
    >
      {/* Çift Bazlı Kısıtlama Bilgilendirme Kartı */}
      {isLocked ? (
        <View style={[styles.lockCard, { backgroundColor: "rgba(255, 179, 0, 0.08)", borderColor: "rgba(255, 179, 0, 0.25)" }]}>
          <Lock size={16} color="#FFB300" style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.lockCardTitle, { color: "#FFB300" }]}>
              Tarihler Kilitli (Çift Bazlı Kısıtlama)
            </Text>
            <Text style={[styles.lockCardText, { color: isLight ? "#555555" : "rgba(255,255,255,0.7)" }]}>
              Bu dönemki değişiklik hakları siz veya partneriniz tarafından kullanıldı. Yeni hakkınız{" "}
              <Text style={{ fontFamily: "Inter_700Bold" }}>{daysUntilPeriodEnd(datesStatus?.periodEndsAt ?? null)} gün</Text>
              {periodEndText ? ` sonra (${periodEndText})` : " sonra"} açılacak.
            </Text>
          </View>
        </View>
      ) : datesStatus && datesStatus.remaining > 0 ? (
        <View style={[styles.freeRightCard, { backgroundColor: theme.pillAccentBg, borderColor: theme.cardBorder }]}>
          <Sparkles size={15} color={theme.accent} style={{ marginTop: 1 }} />
          <Text style={[styles.freeRightText, { color: theme.accent }]}>
            {datesStatus.hasDates
              ? `Çiftinizin bu dönem ${datesStatus.remaining} değişiklik hakkı var${periodEndText ? ` (dönem ${periodEndText} tarihinde yenilenir)` : ""}. İlk 30 günde 2, sonrasında her 30 günde 1 hak tanınır.`
              : "İlk kayıt değişiklik hakkı harcamaz. Sonrasında ilk 30 günde 2, ardından her 30 günde 1 değişiklik hakkınız olur."}
          </Text>
        </View>
      ) : (
        <View style={styles.normalHintRow}>
          <Clock size={12} color={theme.textMuted} />
          <Text style={[styles.normalHintText, { color: theme.textMuted }]}>
            İlişki tarihleri çift bazlı olarak ilk 30 günde 2, sonrasında her 30 günde 1 kez güncellenebilir.
          </Text>
        </View>
      )}

      {/* Tanışma Tarihi */}
      <View style={profileSharedStyles.inputGroup}>
        <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>
          TANIŞMA TARİHİ (İSTEĞE BAĞLI)
        </Text>
        <TouchableOpacity
          onPress={() => !isLocked && setShowMeetDatePicker(true)}
          style={pickerBtnStyle}
          activeOpacity={0.8}
          disabled={isLocked || loading}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Calendar size={18} color={theme.accent} />
            <Text style={[styles.datePickerBtnText, { color: isLocked ? theme.textMuted : theme.text }]}>
              {meetDate ? dayjs(meetDate).format("DD MMMM YYYY") : "Tarih Seçiniz"}
            </Text>
          </View>
          {!isLocked && <ChevronRight size={16} color={theme.textMuted} />}
        </TouchableOpacity>

        <DateTimePickerSheet
          visible={showMeetDatePicker}
          mode="date"
          title="Tanışma Tarihi"
          value={meetDate ? dayjs(meetDate).toDate() : new Date()}
          maximumDate={relStartDate && dayjs(relStartDate).isBefore(dayjs(), "day") ? dayjs(relStartDate).toDate() : new Date()}
          onCancel={() => setShowMeetDatePicker(false)}
          onConfirm={(selectedDate) => {
            setShowMeetDatePicker(false);
            onChangeMeetDate(dayjs(selectedDate).format("YYYY-MM-DD"));
          }}
        />
      </View>

      {/* Sevgili Olma Tarihi */}
      <View style={profileSharedStyles.inputGroup}>
        <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>
          SEVGİLİ OLMA TARİHİ
        </Text>
        <TouchableOpacity
          onPress={() => !isLocked && setShowRelDatePicker(true)}
          style={pickerBtnStyle}
          activeOpacity={0.8}
          disabled={isLocked || loading}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Heart size={18} color={theme.accent} />
            <Text style={[styles.datePickerBtnText, { color: isLocked ? theme.textMuted : theme.text }]}>
              {relStartDate ? dayjs(relStartDate).format("DD MMMM YYYY") : "Tarih Seçiniz"}
            </Text>
          </View>
          {!isLocked && <ChevronRight size={16} color={theme.textMuted} />}
        </TouchableOpacity>

        <DateTimePickerSheet
          visible={showRelDatePicker}
          mode="date"
          title="Sevgili Olma Tarihi"
          value={relStartDate ? dayjs(relStartDate).toDate() : new Date()}
          maximumDate={new Date()}
          onCancel={() => setShowRelDatePicker(false)}
          onConfirm={(selectedDate) => {
            setShowRelDatePicker(false);
            onChangeRelStartDate(dayjs(selectedDate).format("YYYY-MM-DD"));
          }}
        />
      </View>

      {/* Güncelle Butonu */}
      <TouchableOpacity
        style={[
          profileSharedStyles.actionSaveBtn,
          { backgroundColor: theme.accent },
          (isLocked || !hasChanges) && { opacity: 0.5 },
        ]}
        onPress={onSave}
        disabled={loading || isLocked || !hasChanges}
        activeOpacity={0.88}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={profileSharedStyles.actionSaveBtnText}>Tarihleri Güncelle 💕</Text>
        )}
      </TouchableOpacity>
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  datePickerBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#ffffff",
  },
  lockCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  lockCardTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    marginBottom: 3,
  },
  lockCardText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  freeRightCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  freeRightText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 16,
    flex: 1,
  },
  normalHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  normalHintText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
