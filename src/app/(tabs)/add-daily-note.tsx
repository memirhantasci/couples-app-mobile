import { useState, useMemo, useEffect, useCallback } from "react";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { logger } from "@/utils/logger";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, BackHandler } from "react-native";
import { appAlert } from "@/lib/dialog";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { formEntryOf } from "@/lib/formEntry";
import { Check, Calendar as CalendarIcon, Clock, BookOpen } from "lucide-react-native";
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


/** Günlük sayfasının yerel önbellekteki (şifreli) satırı: liste ekranı bununla anında güncellenir. */
interface CachedDailyNote {
  id: number;
  date: string;
  content: string;
}

/** Eski kayıtlardaki "[Mod: ...]" ve "# başlık" önekleri editörde gösterilmez. */
const cleanPageText = (text: string) =>
  text.replace(/^\[Mod:\s*.*?\]\n?/, "").replace(/^#\s*.*?\n\n?/, "").trim();

export default function AddDailyNoteScreen() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme, isLight } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const userId = session?.user?.id ?? null;

  // Hangi günün sayfası açılıyor: günlük ekranından gelen `date` parametresi (düzenleme ya da bugünün sayfası)
  const params = useLocalSearchParams();
  const rawDate = typeof params.date === "string" ? params.date : "";
  const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : dayjs().format("YYYY-MM-DD");
  const isToday = targetDate === dayjs().format("YYYY-MM-DD");

  // O günün sayfası günlük listesinin önbelleğinde varsa ekran ilk karede dolu açılır: boş "yeni sayfa"
  // görünüp bir saniye sonra dolmaz
  const readCachedPage = (date: string): { id: number; text: string } | null => {
    const cached = queryClient
      .getQueryData<CachedDailyNote[]>(["daily_notes_history", userId, false])
      ?.find((n) => n.date === date);
    if (!cached) return null;
    const text = decrypt(cached.content);
    if (!text) return null;
    return { id: cached.id, text: cleanPageText(text) };
  };

  const [initialPage] = useState(() => readCachedPage(targetDate));
  const [content, setContent] = useState(initialPage?.text ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Bu güne ait kayıtlı sayfa varsa kimliği: doluysa ekran "devam et / düzenle" modundadır
  const [noteId, setNoteId] = useState<number | null>(initialPage?.id ?? null);
  const [isLoadingNote, setIsLoadingNote] = useState(!initialPage);

  // Ekran sekme olarak bellekte kalır: yeni bir açılışta (formEntry) sayfa baştan kurulur. Menüye girip
  // dönmek açılış sayılmaz; yazılan metin yerinde kalır.
  const entry = formEntryOf(params);
  const [seenEntry, setSeenEntry] = useState(entry);
  if (seenEntry !== entry) {
    const page = readCachedPage(targetDate);
    setSeenEntry(entry);
    setContent(page?.text ?? "");
    setNoteId(page?.id ?? null);
    setIsLoadingNote(!page);
    setIsSubmitting(false);
  }

  // Geri: her zaman Günlüklerim ekranına (ana sayfaya değil); Android geri tuşu da aynı yere gider
  const goBackToJournal = () => router.replace("/(tabs)/daily-notes");
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        router.replace("/(tabs)/daily-notes");
        return true;
      });
      return () => sub.remove();
    }, [router])
  );

  // O günün kayıtlı sayfası varsa editöre yüklenir: sıfırdan boş sayfa değil, kaldığın yerden devam edersin
  useEffect(() => {
    if (!isLoadingNote) return;
    let cancelled = false;
    (async () => {
      if (!userId) {
        if (!cancelled) setIsLoadingNote(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("daily_notes")
          .select("id, content")
          .eq("user_id", userId)
          .eq("date", targetDate)
          .maybeSingle();
        if (cancelled) return;
        if (error) throw error;
        if (data) {
          const text = decrypt(data.content);
          if (!text) {
            // Çözülemeyen notu boş sayfa sanıp ezmemek için kullanıcı uyarılır ve geri döner
            appAlert(t("common.error"), t("dailyNotes.add.readFailed"));
            router.replace("/(tabs)/daily-notes");
            return;
          }
          setNoteId(data.id);
          setContent(cleanPageText(text));
        }
      } catch (error) {
        if (!cancelled) logger.error(error);
      } finally {
        if (!cancelled) setIsLoadingNote(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, targetDate, userId]);

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

    if (!userId) return;

    setIsSubmitting(true);
    try {
      const cleanContent = sanitize(content.trim());
      if (!cleanContent) {
        appAlert(t("common.error"), t("dailyNotes.add.invalidContent"));
        setIsSubmitting(false);
        return;
      }
      if (cleanContent.length > DAILY_NOTE_MAX_CHARS) {
        appAlert(t("dailyNotes.add.pageFullTitle"), t("dailyNotes.add.pageFullMessage"));
        return;
      }
      const encrypted = encrypt(cleanContent);

      // (user_id, date) benzersiz: günde tek sayfa. Editörde sayfanın tamamı göründüğü için kayıt, mevcut
      // sayfanın yerine geçer (eklenmez); sayfa yoksa yeni satır açılır.
      let savedId = noteId;
      if (noteId) {
        const { error } = await supabase.from("daily_notes").update({ content: encrypted }).eq("id", noteId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("daily_notes")
          .insert({ user_id: userId, date: targetDate, content: encrypted })
          .select("id")
          .single();
        if (error) throw error;
        savedId = data.id;
      }

      // Liste ekranı sunucudan yeniden çekilmeyi beklemeden kaydı hemen gösterir
      queryClient.setQueryData<CachedDailyNote[]>(["daily_notes_history", userId, false], (old = []) =>
        [
          { id: savedId as number, date: targetDate, content: encrypted },
          ...old.filter((n) => n.date !== targetDate),
        ].sort((x, y) => y.date.localeCompare(x.date))
      );
      queryClient.invalidateQueries({ queryKey: ["daily_notes_history", userId] });
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
      toast.success(t("dailyNotes.add.saved"));
      // Kaydedilen not yazı alanında kalmasın (ekran bellekte duruyor)
      setContent("");
      setNoteId(null);
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
        <ScreenHeader
          title={noteId ? t("dailyNotes.add.editTitle") : t("dailyNotes.add.title")}
          subtitle={noteId ? t("dailyNotes.add.editSubtitle") : t("dailyNotes.add.subtitle")}
          onBack={goBackToJournal}
          fallbackRoute="/(tabs)/daily-notes"
          actions={
            <TouchableOpacity 
            onPress={handleSave}
            disabled={isSubmitting || isLoadingNote || !content.trim()}
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
          }
        />

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
                {dayjs(targetDate).locale(i18n.language).format("D MMMM YYYY, dddd")}
              </Text>
            </View>

            {isToday ? (
              <View style={[styles.timeBadge, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)" }]}>
                <Clock size={12} color={theme.textMuted} />
                <Text style={[styles.timeText, { color: theme.textSecondary }]}>{dayjs().format("HH:mm")}</Text>
              </View>
            ) : null}
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
                editable={!isLoadingNote}
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
            disabled={isSubmitting || isLoadingNote || !content.trim()}
            activeOpacity={0.88}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <BookOpen size={19} color="#ffffff" />
                <Text style={styles.bottomSaveBtnText}>{noteId ? t("dailyNotes.add.update") : t("dailyNotes.add.submit")}</Text>
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
      borderRadius: 22,
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
      borderRadius: 22,
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
