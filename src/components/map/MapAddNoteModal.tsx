import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { DialogHost } from "@/components/ui/DialogHost";
import { BlurView } from "expo-blur";
import { Check, StickyNote, X } from "lucide-react-native";

interface MapAddNoteModalProps {
  visible: boolean;
  accent: string;
  /** Kayıt sürerken butonu kilitler ve spinner gösterir. */
  isSaving: boolean;
  onSave: (text: string) => void;
  onClose: () => void;
}

interface NoteFormProps {
  accent: string;
  isSaving: boolean;
  onSave: (text: string) => void;
  onClose: () => void;
}

// Metin state'i burada yaşar; modal her açıldığında form yeniden mount olur,
// bu yüzden alan her seferinde boş başlar.
function MapAddNoteForm({ accent, isSaving, onSave, onClose }: NoteFormProps) {
  const [noteText, setNoteText] = useState("");
  const hasText = noteText.trim().length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.modalBackdrop}
    >
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose}>
        <BlurView tint="dark" intensity={70} style={StyleSheet.absoluteFill} />
      </TouchableOpacity>

      <View style={[styles.modalNoteCard, { marginBottom: Platform.OS === "ios" ? 40 : 20 }]}>
        <View style={styles.modalNoteHeader}>
          <View style={[styles.modalNoteIconCircle, { backgroundColor: `${accent}20` }]}>
            <StickyNote size={20} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalNoteTitle}>Buraya Bir Aşk Notu Bırak 💌</Text>
            <Text style={styles.modalNoteSubtitle}>
              Sevgilin haritayı açtığında burada senin notunu görecek.
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.modalNoteInput}
          value={noteText}
          onChangeText={setNoteText}
          placeholder="Buraya dair özel bir hatıra veya aşk sözü yaz..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          multiline
          numberOfLines={4}
          maxLength={300}
          autoFocus
        />

        <View style={styles.charCountRow}>
          <Text style={styles.charCountText}>{noteText.length} / 300</Text>
        </View>

        <View style={styles.modalButtonsRow}>
          <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
            <Text style={styles.modalCancelBtnText}>Vazgeç</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modalSaveBtn,
              {
                backgroundColor: hasText ? accent : "rgba(255,255,255,0.15)",
                opacity: isSaving ? 0.7 : 1,
              },
            ]}
            onPress={() => onSave(noteText)}
            disabled={!hasText || isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator size={16} color="#fff" />
            ) : (
              <>
                <Check size={16} color="#fff" />
                <Text style={styles.modalSaveBtnText}>Notu Mühürle & Bırak</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── YENİ NOT EKLEME MODALI (Haritada uzun basılan konuma) ────────────────────
export function MapAddNoteModal({ visible, accent, isSaving, onSave, onClose }: MapAddNoteModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <MapAddNoteForm accent={accent} isSaving={isSaving} onSave={onSave} onClose={onClose} />
      {/* Bu modal açıkken uyarılar/diyaloglar (kök katman modalın arkasında kalır) burada çizilir */}
      <DialogHost embedded visible={visible} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalNoteCard: {
    backgroundColor: "#161224",
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  modalNoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalNoteIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  modalNoteTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  modalNoteSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalNoteInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 14,
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    minHeight: 100,
    textAlignVertical: "top",
    lineHeight: 20,
  },
  charCountRow: {
    alignItems: "flex-end",
    marginTop: -6,
  },
  charCountText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  modalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalCancelBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  modalSaveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  modalSaveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
