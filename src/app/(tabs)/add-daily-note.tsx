import React, { useState } from "react";
import { 
  View, Text, TextInput, TouchableOpacity, 
  Platform, Alert, ActivityIndicator, StyleSheet 
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { 
  ChevronLeft, Check, Calendar as CalendarIcon, 
  Clock, BookOpen 
} from "lucide-react-native";
import { getTheme } from "@/lib/theme";
import { encrypt } from "@/utils/crypto";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

dayjs.locale("tr");

export default function AddDailyNoteScreen() {
  const { session, profile } = useAuth();
  const theme = getTheme(profile?.gender);
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert("Eksik Bilgi", "Lütfen günlüğünüze bir şeyler yazın.");
      return;
    }

    if (!session?.user?.id) return;

    setIsSubmitting(true);
    try {
      const encrypted = encrypt(content.trim());

      const { error } = await supabase.from("daily_notes").insert({
        user_id: session.user.id,
        date: dayjs().format("YYYY-MM-DD"),
        content: encrypted,
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["daily_notes_history", session.user.id] });
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
      router.replace("/(tabs)/daily-notes");
    } catch (error) {
      console.error(error);
      Alert.alert("Hata", "Günlük kaydedilirken bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity 
            onPress={() => router.replace("/(tabs)/daily-notes")} 
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft color="#ffffff" size={24} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Yeni Günlük Sayfası</Text>
            <Text style={styles.headerSubtitle}>Sadece senin görebildiğin özel notun 🔒</Text>
          </View>

          <TouchableOpacity 
            onPress={handleSave}
            disabled={isSubmitting || !content.trim()}
            style={[
              styles.saveHeaderBtn,
              { backgroundColor: theme.accent },
              !content.trim() && { opacity: 0.5 }
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Check color="#ffffff" size={18} />
            )}
          </TouchableOpacity>
        </View>

        {/* KLAVYE DUYARLI FORM ALANI */}
        <KeyboardAwareScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          extraScrollHeight={140}
          showsVerticalScrollIndicator={false}
        >
          {/* TARİH & ZAMAN KARTI */}
          <View style={[styles.dateCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[styles.dateIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <CalendarIcon size={16} color={theme.accent} />
              </View>
              <Text style={styles.dateCardText}>
                {dayjs().format("D MMMM YYYY, dddd")}
              </Text>
            </View>

            <View style={styles.timeBadge}>
              <Clock size={12} color="rgba(255,255,255,0.6)" />
              <Text style={styles.timeText}>{dayjs().format("HH:mm")}</Text>
            </View>
          </View>

          {/* GÜNLÜK METİN EDİTÖRÜ */}
          <View style={styles.sectionBlock}>
            <View style={styles.editorLabelRow}>
              <Text style={styles.sectionLabel}>GÜNLÜK NOTUN</Text>
              <Text style={[styles.charCountText, charCount >= 3800 && { color: "#f59e0b" }]}>
                {charCount} / 4000 harf ({wordCount} kelime)
              </Text>
            </View>
            
            <View style={[styles.editorContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <TextInput
                style={styles.editorInput}
                multiline
                placeholder="Sevgili günlük, bugün içimden geçenler..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={content}
                onChangeText={setContent}
                maxLength={4000}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* ALT KAYDET BUTONU */}
          <TouchableOpacity 
            style={[
              styles.bottomSaveBtn, 
              { backgroundColor: theme.accent, shadowColor: theme.accent },
              (isSubmitting || !content.trim()) && { opacity: 0.65 }
            ]}
            onPress={handleSave}
            disabled={isSubmitting || !content.trim()}
            activeOpacity={0.88}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <BookOpen size={19} color="#ffffff" />
                <Text style={styles.bottomSaveBtnText}>Günlüğü Deftere Kaydet 📖</Text>
              </>
            )}
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  saveHeaderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitleBox: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 16,
  },
  dateCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  dateIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dateCardText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.75)",
  },
  sectionBlock: {
    gap: 8,
  },
  editorLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.6,
  },
  charCountText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.45)",
  },
  editorContainer: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    minHeight: 320,
  },
  editorInput: {
    color: "#ffffff",
    fontSize: 15.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 24,
    minHeight: 290,
  },
  bottomSaveBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  bottomSaveBtnText: {
    color: "#ffffff",
    fontSize: 15.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
});
