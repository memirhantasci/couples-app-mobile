import React from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Modal, StyleSheet } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { FileText, X, Check, Trash2 } from "lucide-react-native";
import { dayjs } from "@/lib/date";
import type { AppTheme } from "@/lib/theme";
import { useTranslation } from "react-i18next";

interface CalendarNoteModalProps {
  visible: boolean;
  theme: AppTheme;
  isLight: boolean;
  selectedDate: string;
  noteText: string;
  /** True when the current user already has a note on `selectedDate` (edit mode). */
  hasExistingNote: boolean;
  saving: boolean;
  onChangeNoteText: (text: string) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
}

// ─── NOT EKLEME / DÜZENLEME MODALI ───────────────────────────────────────────
export function CalendarNoteModal({
  visible,
  theme,
  isLight,
  selectedDate,
  noteText,
  hasExistingNote,
  saving,
  onChangeNoteText,
  onClose,
  onSave,
  onDelete,
}: CalendarNoteModalProps) {
  const { t, i18n } = useTranslation();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
          <View style={[styles.modalHeader, { borderBottomColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <FileText size={18} color={theme.accent} />
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {hasExistingNote ? t("calendar.noteModal.editTitle") : t("calendar.noteModal.addTitle")}
              </Text>
            </View>

            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.close")}
              onPress={onClose}
              style={[styles.modalCloseBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 16, gap: 14 }}
            enableOnAndroid={true}
            extraScrollHeight={130}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.modalDateText, { color: theme.textMuted }]}>
              {dayjs(selectedDate).locale(i18n.language).format("D MMMM YYYY, dddd")}
            </Text>

            <TextInput
              style={[
                styles.modalTextInput,
                {
                  backgroundColor: theme.unitBg,
                  color: theme.text,
                  borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.08)",
                },
              ]}
              multiline
              maxLength={1000}
              value={noteText}
              onChangeText={onChangeNoteText}
              placeholder={t("calendar.noteModal.placeholder")}
              placeholderTextColor={isLight ? theme.textMuted : "rgba(255,255,255,0.3)"}
            />

            <Text style={[styles.modalCharCount, { color: theme.textMuted }]}>
              {t("calendar.noteModal.counter", { chars: noteText.length })}
            </Text>

            <View style={styles.modalActionsRow}>
              {hasExistingNote && (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.delete")}
                  onPress={onDelete}
                  disabled={saving}
                  style={styles.modalDeleteBtn}
                >
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
              )}

              <View style={{ flex: 1 }} />

              <TouchableOpacity
                onPress={onClose}
                style={[styles.modalCancelBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}
              >
                <Text style={[styles.modalCancelBtnText, { color: theme.textSecondary }]}>{t("common.cancel")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onSave}
                disabled={saving || !noteText.trim()}
                style={[styles.modalSaveBtn, { backgroundColor: theme.accent }, !noteText.trim() && { opacity: 0.5 }]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Check size={16} color="#ffffff" />
                    <Text style={styles.modalSaveBtnText}>{t("common.save")}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    padding: 18,
  },
  modalBox: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalDateText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
    marginBottom: 4,
  },
  modalTextInput: {
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#ffffff",
    minHeight: 140,
    textAlignVertical: "top",
    lineHeight: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalCharCount: {
    alignSelf: "flex-end",
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
  },
  modalActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  modalDeleteBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  modalCancelBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  modalSaveBtn: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalSaveBtnText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
  },
});
