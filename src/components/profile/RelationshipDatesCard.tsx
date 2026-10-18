import React, { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Platform, StyleSheet } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { CalendarHeart, Calendar, Heart, ChevronRight } from "lucide-react-native";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import type { AppTheme } from "@/lib/theme";
import { ModernSection } from "./ModernSection";
import { profileSharedStyles } from "./profileSharedStyles";

dayjs.locale("tr");

interface RelationshipDatesCardProps {
  theme: AppTheme;
  isLight: boolean;
  meetDate: string;
  relStartDate: string;
  loading: boolean;
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
  onChangeMeetDate,
  onChangeRelStartDate,
  onSave,
}: RelationshipDatesCardProps) {
  const [showMeetDatePicker, setShowMeetDatePicker] = useState(false);
  const [showRelDatePicker, setShowRelDatePicker] = useState(false);

  const pickerBtnStyle = [
    styles.datePickerBtn,
    { backgroundColor: theme.unitBg, borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)" },
  ];

  return (
    <ModernSection
      title="İlişki Tarihleri"
      icon={<CalendarHeart size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={false}
    >
      <View style={profileSharedStyles.inputGroup}>
        <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>TANIŞMA TARİHİ (İSTEĞE BAĞLI)</Text>
        <TouchableOpacity
          onPress={() => setShowMeetDatePicker(true)}
          style={pickerBtnStyle}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Calendar size={18} color={theme.accent} />
            <Text style={[styles.datePickerBtnText, { color: theme.text }]}>
              {meetDate ? dayjs(meetDate).format("DD MMMM YYYY") : "Tarih Seçiniz"}
            </Text>
          </View>
          <ChevronRight size={16} color={theme.textMuted} />
        </TouchableOpacity>

        {showMeetDatePicker && (
          <DateTimePicker
            value={meetDate ? new Date(meetDate) : new Date()}
            mode="date"
            display="default"
            onChange={(_, selectedDate) => {
              setShowMeetDatePicker(Platform.OS === "ios");
              if (selectedDate) {
                onChangeMeetDate(dayjs(selectedDate).format("YYYY-MM-DD"));
              }
            }}
          />
        )}
      </View>

      <View style={profileSharedStyles.inputGroup}>
        <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>SEVGİLİ OLMA TARİHİ</Text>
        <TouchableOpacity
          onPress={() => setShowRelDatePicker(true)}
          style={pickerBtnStyle}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Heart size={18} color={theme.accent} />
            <Text style={[styles.datePickerBtnText, { color: theme.text }]}>
              {relStartDate ? dayjs(relStartDate).format("DD MMMM YYYY") : "Tarih Seçiniz"}
            </Text>
          </View>
          <ChevronRight size={16} color={theme.textMuted} />
        </TouchableOpacity>

        {showRelDatePicker && (
          <DateTimePicker
            value={relStartDate ? new Date(relStartDate) : new Date()}
            mode="date"
            display="default"
            onChange={(_, selectedDate) => {
              setShowRelDatePicker(Platform.OS === "ios");
              if (selectedDate) {
                onChangeRelStartDate(dayjs(selectedDate).format("YYYY-MM-DD"));
              }
            }}
          />
        )}
      </View>

      <TouchableOpacity
        style={[profileSharedStyles.actionSaveBtn, { backgroundColor: theme.accent }]}
        onPress={onSave}
        disabled={loading}
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
});
