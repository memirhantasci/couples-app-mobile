import { useState, useMemo } from "react";
import { logger } from "@/utils/logger";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { appAlert } from "@/lib/dialog";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useRouter, useLocalSearchParams } from "expo-router";
import { formEntryOf } from "@/lib/formEntry";
import { 
  ChevronLeft, Check, Calendar as CalendarIcon, 
  Clock, BookOpen 
} from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { encrypt, decrypt } from "@/utils/crypto";
import { sanitize } from "@/utils/sanitize";
import { useDemoAction } from "@/hooks/useDemoAction";
import { toast } from "@/lib/toast";
import { DAILY_NOTE_MAX_CHARS } from "@/lib/dailyNote";
import dayjs from "dayjs";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { LazyDemoActionModal } from "@/components/ui/lazyMount";
import { useTranslation } from "react-i18next";


export default function AddDailyNoteScreen() {
  const { t, i18n } = useTranslation();
  const { session, profile } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme, isLight } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ekran sekme olarak bellekte kalır: yeni bir açılışta (formEntry) yazı alanı boş başlar. Menüye girip
  // dönmek açılış sayılmaz; yazılan metin yerinde kalır.
  const entry = formEntryOf(useLocalSearchParams());
  const [seenEntry, setSeenEntry] = useState(entry);
  if (seenEntry !== entry) {
    setSeenEntry(entry);
    setContent("");
    setIsSubmitting(false);
  }

  const handleSave = async () => {
    if (executeOrIntercept(
      () => {},
      t("dailyNotes.demo.createTitle"),
      t("dailyNotes.demo.createDescription")
    )) {
      return;
    }

    if (!content.trim()) {
      toast.warning(t("dailyNotes.add.writeSomething"), { title: t("common.missingInformation") });
      return;
    }

    if (!session?.user?.id) return;

    setIsSubmitting(true);
    try {
      const cleanContent = sanitize(content.trim());
      if (!cleanContent) {
        appAlert(t("common.error"), t("dailyNotes.add.invalidContent"));
        setIsSubmitting(false);
        return;
      }
      const today = dayjs().format("YYYY-MM-DD");

      // (user_id, date) benzersiz: günde tek günlük sayfası var. Bugünün notu zaten varsa
      // üzerine yazmak (upsert) onu silerdi; bunun yerine yeni yazıyı mevcut notun sonuna ekliyoruz.
      const { data: existing, error: fetchError } = await supabase
        .from("daily_notes")
        .select("id, content")
        .eq("user_id", session.user.id)
        .eq("date", today)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let error;
      if (existing) {
        const previous = decrypt(existing.content);
        if (!previous) {
          // Çözülemeyen notu ezmemek için işlemi durdur
          appAlert(t("common.error"), t("dailyNotes.add.readFailed"));
          return;
        }
        const merged = `${previous}\n\n${cleanContent}`;
        if (merged.length > DAILY_NOTE_MAX_CHARS) {
          appAlert(t("dailyNotes.add.pageFullTitle"), t("dailyNotes.add.pageFullMessage"));
          return;
        }
        ({ error } = await supabase
          .from("daily_notes")
          .update({ content: encrypt(merged) })
          .eq("id", existing.id));
      } else {
        ({ error } = await supabase.from("daily_notes").insert({
          user_id: session.user.id,
          date: today,
          content: encrypt(cleanContent),
        }));
      }

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["daily_notes_history", session.user.id] });
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
      toast.success(t("dailyNotes.add.saved"));
      // Kaydedilen not yazı alanında kalmasın (ekran bellekte duruyor)
      setContent("");
      router.replace("/(tabs)/daily-notes");
    } catch (error) {
      logger.error(error);
      appAlert(t("common.error"), t("dailyNotes.add.saveFailed"));
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
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={() => router.replace("/(tabs)/daily-notes")} 
            style={[
              styles.headerBtn,
              { 
                backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
                borderColor: theme.cardBorder 
              }
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft color={theme.text} size={24} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t("dailyNotes.add.title")}</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]} numberOfLines={1}>{t("dailyNotes.add.subtitle")}</Text>
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
          // Düz nesne: kütüphane Android'de dizi stilindeki paddingBottom'u sıfırlıyordu
          contentContainerStyle={StyleSheet.flatten([styles.scrollContent, { paddingBottom: insets.bottom + 40 }])}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          extraScrollHeight={140}
          showsVerticalScrollIndicator={false}
        >
          {/* TARİH & ZAMAN KARTI */}
          <View style={[styles.dateCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={[styles.dateIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <CalendarIcon size={16} color={theme.accent} />
              </View>
              <Text style={[styles.dateCardText, { color: theme.text }]}>
                {dayjs().locale(i18n.language).format("D MMMM YYYY, dddd")}
              </Text>
            </View>

            <View style={[styles.timeBadge, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)" }]}>
              <Clock size={12} color={theme.textMuted} />
              <Text style={[styles.timeText, { color: theme.textSecondary }]}>{dayjs().format("HH:mm")}</Text>
            </View>
          </View>

          {/* GÜNLÜK METİN EDİTÖRÜ */}
          <View style={styles.sectionBlock}>
            <View style={styles.editorLabelRow}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t("dailyNotes.add.label")}</Text>
              <Text style={[styles.charCountText, { color: theme.textMuted }, charCount >= 1800 && { color: "#f59e0b" }]}>
                {t("dailyNotes.add.counter", { chars: charCount, max: DAILY_NOTE_MAX_CHARS, count: wordCount })}
              </Text>
            </View>

            <View style={[styles.editorContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
              <TextInput
                style={[styles.editorInput, { color: theme.text }]}
                multiline
                placeholder={t("dailyNotes.add.placeholder")}
                placeholderTextColor={isLight ? theme.textMuted : "rgba(255,255,255,0.3)"}
                value={content}
                onChangeText={setContent}
                maxLength={DAILY_NOTE_MAX_CHARS}
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
                <Text style={styles.bottomSaveBtnText}>{t("dailyNotes.add.submit")}</Text>
              </>
            )}
          </TouchableOpacity>
        </KeyboardAwareScrollView>

        <LazyDemoActionModal
          visible={isDemoModalOpen}
          onClose={() => setIsDemoModalOpen(false)}
          title={modalConfig.title}
          description={modalConfig.description}
        />
      </View>
    </ScreenBackground>
  );
}

const createStyles = (theme: AppTheme) => {
  const isLight = theme.isLight;

  return StyleSheet.create({
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
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
      borderWidth: 1,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
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
      color: theme.text,
      letterSpacing: -0.3,
    },
    headerSubtitle: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.55)",
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
      color: theme.text,
    },
    timeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    timeText: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.75)",
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
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.6)",
      letterSpacing: 0.6,
    },
    charCountText: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.45)",
    },
    editorContainer: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 16,
      minHeight: 320,
    },
    editorInput: {
      color: theme.text,
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
};
