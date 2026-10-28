import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Modal,
  StyleSheet,
} from "react-native";
import { appAlert } from "@/lib/dialog";
import { DialogHost } from "@/components/ui/DialogHost";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { DateTimePickerSheet } from "@/components/ui/DateTimePickerSheet";
import { Settings, X, Edit2, Trash2, Clock, Calendar, Check } from "lucide-react-native";
import { dayjs } from "@/lib/date";
import type { AppTheme } from "@/lib/theme";
import type {
  MedicineFormInitialData,
  MedicineFormValues,
  MedicineItem,
  MedicineSubmitResult,
} from "./medicineTypes";

/** Prefill for editing an existing medicine in the manager modal. */
export function medicineToFormData(med: MedicineItem, currentUserId: string | null): MedicineFormInitialData {
  const toDate = (hhmm: string) => {
    const [h, m] = hhmm.split(":");
    const d = new Date();
    d.setHours(parseInt(h, 10));
    d.setMinutes(parseInt(m, 10));
    return d;
  };

  let times: Date[] | undefined;
  if (med.times && Array.isArray(med.times) && med.times.length > 0) {
    times = med.times.map(toDate).slice(0, 3);
  } else if (med.time) {
    times = [toDate(med.time)];
  }

  return {
    id: med.id,
    name: med.name,
    // "YYYY-MM-DD" yerel gün olarak çözülür (new Date(string) UTC varsayıp günü kaydırabilir)
    startDate: dayjs(med.start_date).toDate(),
    endDate: dayjs(med.end_date).toDate(),
    isPartnerAdd: med.user_id !== currentUserId,
    times,
  };
}

type PickerKind = "start" | "end" | "time";

function defaultDoseTime() {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
}

interface MedicineManagerModalProps {
  visible: boolean;
  theme: AppTheme;
  isLight: boolean;
  userId: string | null;
  /** Registered medicines shown above the form while adding a new one. */
  medicines: MedicineItem[];
  /** Id of the medicine currently being deleted, for its spinner. */
  deletingId: number | null;
  /** Prefill (also decides edit vs. add); read each time the modal opens. */
  initialData?: MedicineFormInitialData | null;
  onSubmit: (values: MedicineFormValues) => Promise<MedicineSubmitResult>;
  onClose: () => void;
  onDelete: (id: number) => void;
  /** Return `false` to block switching a registered medicine into edit mode (e.g. demo mode). */
  onBeforeEdit?: () => boolean;
}

/**
 * The form lives in `MedicineManagerForm`, which React Native's Modal only
 * mounts while visible. Its state is therefore local to the modal and fresh on
 * every open, and typing never re-renders the medicine screen.
 */
export function MedicineManagerModal({ visible, onClose, ...formProps }: MedicineManagerModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <MedicineManagerForm onClose={onClose} {...formProps} />
      {/* Bu modal açıkken uyarılar/diyaloglar (kök katman modalın arkasında kalır) burada çizilir */}
      <DialogHost embedded visible={visible} />
    </Modal>
  );
}

type FormProps = Omit<MedicineManagerModalProps, "visible">;

function MedicineManagerForm({
  theme,
  isLight,
  userId,
  medicines,
  deletingId,
  initialData,
  onSubmit,
  onClose,
  onDelete,
  onBeforeEdit,
}: FormProps) {
  const [medName, setMedName] = useState(initialData?.name ?? "");
  const [medError, setMedError] = useState(false);
  const [medStartDate, setMedStartDate] = useState(initialData?.startDate ?? new Date());
  const [medEndDate, setMedEndDate] = useState(initialData?.endDate ?? new Date());
  const [medTimes, setMedTimes] = useState<Date[]>(
    initialData?.times && initialData.times.length > 0 ? initialData.times : [defaultDoseTime()]
  );
  const [medFrequency, setMedFrequency] = useState<1 | 2 | 3>(
    Math.min(3, Math.max(1, initialData?.times?.length ?? 1)) as 1 | 2 | 3
  );
  const [activeTimeIndex, setActiveTimeIndex] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState<PickerKind | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMedicineId, setEditingMedicineId] = useState<number | null>(initialData?.id ?? null);
  const [isPartnerAdd, setIsPartnerAdd] = useState(initialData?.isPartnerAdd ?? false);

  const fieldBorder = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";

  const handleFrequencyChange = (freq: 1 | 2 | 3) => {
    setMedFrequency(freq);
    const defaults = ["09:00", "14:00", "20:00"];
    const newTimes: Date[] = [];
    for (let i = 0; i < freq; i++) {
      const d = new Date();
      const [h, m] = defaults[i].split(":");
      d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
      newTimes.push(medTimes[i] || d);
    }
    const seen = new Set<string>();
    const finalTimes = newTimes.map((t, idx) => {
      const f = dayjs(t).format("HH:mm");
      if (seen.has(f)) {
        const d = new Date();
        const [h, m] = defaults[idx].split(":");
        d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
        seen.add(defaults[idx]);
        return d;
      }
      seen.add(f);
      return t;
    });
    setMedTimes(finalTimes);
  };

  const pickerValue =
    showPicker === "start"
      ? medStartDate
      : showPicker === "end"
      ? medEndDate
      : medTimes[activeTimeIndex ?? 0] ?? new Date();

  const openPicker = (kind: PickerKind, timeIndex = 0) => {
    Keyboard.dismiss();
    if (kind === "time") setActiveTimeIndex(timeIndex);
    setShowPicker(kind);
  };

  const closePicker = () => setShowPicker(null);

  /** Seçilen değeri forma işler. `false` dönerse (aynı saat) seçici açık kalmalı. */
  const commitPicker = (kind: PickerKind, date: Date): boolean => {
    if (kind === "start") {
      setMedStartDate(date);
    } else if (kind === "end") {
      setMedEndDate(date);
    } else if (activeTimeIndex !== null) {
      const newTimeStr = dayjs(date).format("HH:mm");
      const isDuplicate = medTimes.some(
        (t, i) => i !== activeTimeIndex && dayjs(t).format("HH:mm") === newTimeStr
      );
      if (isDuplicate) {
        appAlert("Uyarı", "Bu ilaç için bu saati zaten seçtiniz. Lütfen farklı bir saat belirleyin.");
        return false;
      }
      const updated = [...medTimes];
      updated[activeTimeIndex] = date;
      setMedTimes(updated);
    }
    return true;
  };

  const handleEditRegistered = (med: MedicineItem) => {
    if (onBeforeEdit && !onBeforeEdit()) return;
    const data = medicineToFormData(med, userId);
    setEditingMedicineId(med.id);
    setMedName(med.name);
    setMedStartDate(data.startDate ?? new Date());
    setMedEndDate(data.endDate ?? new Date());
    setIsPartnerAdd(data.isPartnerAdd ?? false);
    if (data.times) {
      setMedFrequency(Math.min(3, data.times.length) as 1 | 2 | 3);
      setMedTimes(data.times);
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    let result: MedicineSubmitResult;
    try {
      result = await onSubmit({
        name: medName,
        startDate: medStartDate,
        endDate: medEndDate,
        times: medTimes,
        isPartnerAdd,
        editingId: editingMedicineId,
      });
    } finally {
      setIsSubmitting(false);
    }

    if (result === "success" || result === "demo") {
      onClose();
    } else if (result === "name-error") {
      setMedError(true);
    }
  };

  return (
    <View style={styles.modalBackdrop}>
      <View style={[styles.modalBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
        {/* Modal Header */}
        <View style={[styles.modalHeader, { borderBottomColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Settings size={18} color={theme.accent} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {editingMedicineId ? "İlacı Düzenle" : "İlaç Yönetimi & Ekle"}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.modalCloseBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <KeyboardAwareScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20, gap: 16 }}
          enableOnAndroid={true}
          extraScrollHeight={130}
          keyboardShouldPersistTaps="handled"
        >
          {/* Mevcut İlaçlar Listesi */}
          {!editingMedicineId && medicines.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={[styles.modalSectionSub, { color: theme.textMuted }]}>KAYITLI İLAÇLAR</Text>
              {medicines.map((m) => (
                <View key={m.id} style={[styles.registeredMedCard, { backgroundColor: theme.unitBg, borderColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)", borderWidth: 1 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.registeredMedName, { color: theme.text }]}>{m.name}</Text>
                    <Text style={[styles.registeredMedSub, { color: theme.textMuted }]}>
                      {m.user_id === userId ? "Benim" : "Sevgilimin"} • Günde {Array.isArray(m.times) ? m.times.length : 1} kez
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity onPress={() => handleEditRegistered(m)} style={[styles.medActionBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)" }]}>
                      <Edit2 size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(m.id)} style={[styles.medActionBtn, { backgroundColor: "rgba(239,68,68,0.15)" }]}>
                      {deletingId === m.id ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <Trash2 size={16} color="#ef4444" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Form Alanı */}
          <View style={{ gap: 12, marginTop: 4 }}>
            <Text style={[styles.modalSectionSub, { color: theme.textMuted }]}>
              {editingMedicineId ? "İLAÇ DETAYLARI" : "YENİ İLAÇ FORMU"}
            </Text>

            {/* Kimin İçin? */}
            <View style={[styles.segmentedContainer, { backgroundColor: theme.unitBg }]}>
              <TouchableOpacity
                style={[styles.segmentedBtn, !isPartnerAdd && { backgroundColor: theme.cardBg }]}
                onPress={() => setIsPartnerAdd(false)}
              >
                <Text style={[styles.segmentedText, { color: !isPartnerAdd ? theme.accent : theme.textSecondary }, !isPartnerAdd && { fontFamily: "Inter_700Bold" }]}>Ben</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentedBtn, isPartnerAdd && { backgroundColor: theme.cardBg }]}
                onPress={() => setIsPartnerAdd(true)}
              >
                <Text style={[styles.segmentedText, { color: isPartnerAdd ? theme.accent : theme.textSecondary }, isPartnerAdd && { fontFamily: "Inter_700Bold" }]}>Sevgilim</Text>
              </TouchableOpacity>
            </View>

            {/* İlaç Adı */}
            <View style={{ gap: 6 }}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>İLAÇ ADI</Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.unitBg,
                    color: theme.text,
                    borderColor: fieldBorder,
                  },
                  medError && styles.inputError,
                ]}
                placeholder="Örn: Aspirin, B12 Vitamini..."
                placeholderTextColor={isLight ? theme.textMuted : "rgba(255,255,255,0.3)"}
                value={medName}
                onChangeText={(text) => {
                  setMedName(text);
                  setMedError(false);
                }}
                maxLength={50}
              />
            </View>

            {/* Günlük Doz Sıklığı (1, 2, 3) */}
            <View style={{ gap: 6 }}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>GÜNLÜK DOZ SIKLIĞI</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {([1, 2, 3] as const).map((freq) => {
                  const isSelected = medFrequency === freq;
                  return (
                    <TouchableOpacity
                      key={freq}
                      onPress={() => handleFrequencyChange(freq)}
                      style={[
                        styles.freqBtn,
                        {
                          backgroundColor: theme.unitBg,
                          borderColor: fieldBorder,
                        },
                        isSelected && { borderColor: theme.accent, backgroundColor: theme.pillAccentBg, borderWidth: 1.5 },
                      ]}
                    >
                      <Text style={[styles.freqBtnText, { color: isSelected ? theme.accent : theme.textSecondary }, isSelected && { fontFamily: "Inter_700Bold" }]}>
                        {freq} Kez
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Saat Seçicileri */}
            <View style={{ gap: 6 }}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>DOZ SAATLERİ</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {medTimes.map((time, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => openPicker("time", idx)}
                    style={[
                      styles.timePickerBox,
                      {
                        backgroundColor: theme.unitBg,
                        borderColor: fieldBorder,
                      },
                    ]}
                  >
                    <Clock size={14} color={theme.accent} />
                    <Text style={[styles.timePickerText, { color: theme.text }]}>{dayjs(time).format("HH:mm")}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Başlangıç & Bitiş Tarihleri */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>BAŞLANGIÇ</Text>
                <TouchableOpacity
                  onPress={() => openPicker("start")}
                  style={[
                    styles.datePickerBtn,
                    {
                      backgroundColor: theme.unitBg,
                      borderColor: fieldBorder,
                    },
                  ]}
                >
                  <Calendar size={14} color={theme.accent} />
                  <Text style={[styles.datePickerText, { color: theme.text }]}>{dayjs(medStartDate).format("DD.MM.YYYY")}</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>BİTİŞ</Text>
                <TouchableOpacity
                  onPress={() => openPicker("end")}
                  style={[
                    styles.datePickerBtn,
                    {
                      backgroundColor: theme.unitBg,
                      borderColor: fieldBorder,
                    },
                  ]}
                >
                  <Calendar size={14} color={theme.accent} />
                  <Text style={[styles.datePickerText, { color: theme.text }]}>{dayjs(medEndDate).format("DD.MM.YYYY")}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Kaydet Butonu */}
            <TouchableOpacity
              style={[styles.saveMedBtn, { backgroundColor: theme.accent }]}
              onPress={handleSave}
              disabled={isSubmitting}
              activeOpacity={0.88}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Check size={17} color="#ffffff" />
                  <Text style={styles.saveMedBtnText}>
                    {editingMedicineId ? "Güncellemeyi Kaydet" : "İlacı Listeye Ekle"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAwareScrollView>
      </View>

      {/* TARİH & SAAT SEÇİCİ (uygulama genelinde ortak bileşen) */}
      <DateTimePickerSheet
        visible={showPicker !== null}
        mode={showPicker === "time" ? "time" : "date"}
        value={pickerValue}
        title={showPicker === "time" ? "Doz Saati" : showPicker === "start" ? "Başlangıç Tarihi" : "Bitiş Tarihi"}
        onCancel={closePicker}
        onConfirm={(date) => {
          if (showPicker && commitPicker(showPicker, date)) {
            closePicker();
            return;
          }
          // Aynı saat seçildiyse seçici açık kalır
          return false;
        }}
      />
    </View>
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
    maxHeight: "88%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    fontSize: 16.5,
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
  modalSectionSub: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.6,
  },
  registeredMedCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
  },
  registeredMedName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  registeredMedSub: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  medActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentedContainer: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 16,
  },
  segmentedBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  segmentedText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
  },
  fieldLabel: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.5,
  },
  textInput: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 14.5,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  inputError: {
    borderColor: "#ff4d6a",
    borderWidth: 1.5,
  },
  freqBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  freqBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
  },
  timePickerBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  timePickerText: {
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  datePickerText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#ffffff",
  },
  saveMedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
    marginTop: 6,
  },
  saveMedBtnText: {
    color: "#ffffff",
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },
});
