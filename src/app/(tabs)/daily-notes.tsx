import { useCallback, useMemo } from "react";
import { ActionCard } from "@/components/ui/ActionCard";
import { Reveal } from "@/components/ui/Reveal";
import { ScreenHeader, ScreenHeaderButton } from "@/components/ui/ScreenHeader";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { appAlert } from "@/lib/dialog";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { decrypt } from "@/utils/crypto";
import dayjs from "dayjs";
import { Edit3, Trash2, PenLine, BookOpen } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { openForm } from "@/lib/formEntry";
import type { AppTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { usePageTour } from "@/hooks/usePageTour";
import { DEMO_DAILY_NOTES } from "@/constants/demoData";
import { useDemoAction } from "@/hooks/useDemoAction";
import { LazyPageTourModal, LazyDemoActionModal } from "@/components/ui/lazyMount";
import { useTranslation } from "react-i18next";

interface DailyNote {
  id: number;
  date: string;
  content: string;
}

// Şifreli içeriği çözüp ekranda gösterilecek düz metne çevirir (çözme sonuçları önbellekli).
// Çözülemeyen içerik boş kalır: şifreli metin ekrana çıkmaz.
const cleanContentText = (stored: string) => {
  if (!stored) return "";
  return decrypt(stored)
    .replace(/^\[Mod:\s*.*?\]\n?/, "")
    .replace(/^#\s*.*?\n\n?/, "")
    .trim();
};

export default function DailyNotesScreen() {
  const { t, i18n } = useTranslation();
  const { session, isDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("daily-notes");
  const userId = session?.user?.id ? session.user.id : null;

  const {
    data: notes = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["daily_notes_history", userId, isDemoMode],
    enabled: !!userId || isDemoMode,
    queryFn: async (): Promise<DailyNote[]> => {
      if (isDemoMode) {
        return DEMO_DAILY_NOTES as any;
      }
      const { data, error } = await supabase
        .from("daily_notes")
        .select("id, date, content")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(90); // Son ~3 ay — sınırsız yükleme engellendi

      if (error) throw error;

      // İçerik burada çözülmez: 90 notu birden çözmek (saf JS crypto) ekranı kilitliyordu.
      // Çözme yalnızca ekranda görünen satırlar için render'da (önbellekli) yapılır.
      return (data ?? []) as DailyNote[];
    },
    staleTime: 1000 * 60 * 5, // 5 dk — invalidateQueries zaten yeni not eklenince günceller
  });

  const hasTodayNote = notes.some((n) => n.date === dayjs().format("YYYY-MM-DD"));

  const handleDelete = useCallback(async (id: number) => {
    if (executeOrIntercept(
      () => {},
      t("dailyNotes.demo.deleteTitle"),
      t("dailyNotes.demo.deleteDescription")
    )) {
      return;
    }

    appAlert(t("dailyNotes.delete.title"), t("dailyNotes.delete.message"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("daily_notes").delete().eq("id", id);
          if (error) {
            appAlert(t("common.error"), t("dailyNotes.errors.deleteFailed"));
          } else {
            queryClient.invalidateQueries({ queryKey: ["daily_notes_history", userId] });
            queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
          }
        }
      }
    ]);
  }, [queryClient, userId, executeOrIntercept, t]);

  const renderNoteCard = useCallback(({ item: note, index }: { item: DailyNote; index: number }) => {
    const dateObj = dayjs(note.date);
    const day = dateObj.format("D");
    const month = dateObj.locale(i18n.language).format("MMMM");
    const year = dateObj.format("YYYY");
    const weekday = dateObj.locale(i18n.language).format("dddd");

    const displayContent = cleanContentText(note.content);

    return (
      <Reveal scope="daily-notes" index={index}>
      <View style={[styles.cardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
        <View style={styles.cardHeader}>
          <View style={styles.dateBadge}>
            <View style={[styles.dayCircle, { backgroundColor: theme.pillAccentBg }]}>
              <Text style={[styles.dayText, { color: theme.accent }]}>{day}</Text>
            </View>
            <View>
              <Text style={[styles.monthYearText, { color: theme.text }]}>{month} {year}</Text>
              <Text style={[styles.weekdayText, { color: theme.textMuted }]}>{weekday}</Text>
            </View>
          </View>

          <View style={styles.actionBtnsRow}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.edit")}
              onPress={() => {
                if (executeOrIntercept(
                  () => {},
                  t("dailyNotes.demo.editTitle"),
                  t("dailyNotes.demo.editDescription")
                )) {
                  return;
                }
                // Düzenleme, günlük yazarkenki tam ekran sayfada o günün notuyla açılır
                router.push(openForm("/(tabs)/add-daily-note", { date: note.date }));
              }}
              style={styles.actionIconBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Edit3 size={15} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.delete")}
              onPress={() => handleDelete(note.id)}
              style={[styles.actionIconBtn, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Trash2 size={15} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.noteBodyText, { color: theme.textSecondary }]}>{displayContent}</Text>
      </View>
      </Reveal>
    );
  }, [theme, styles, executeOrIntercept, handleDelete, router, i18n.language, t]);

  const keyExtractor = useCallback((item: DailyNote) => item.id.toString(), []);

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER */}
        <ScreenHeader title={t("menu.journal.title")} subtitle={t("dailyNotes.subtitle")} onOpenTour={openTour} actions={
          <ScreenHeaderButton label={t("a11y.edit")} 
              onPress={() => {
                if (executeOrIntercept(
                  () => router.push(openForm("/(tabs)/add-daily-note", { date: dayjs().format("YYYY-MM-DD") })),
                  t("dailyNotes.demo.writeTitle"),
                  t("dailyNotes.demo.writeDescription")
                )) {
                  return;
                }
                router.push(openForm("/(tabs)/add-daily-note", { date: dayjs().format("YYYY-MM-DD") }));
              }} 
            >
              <PenLine color={theme.accent} size={19} />
            </ScreenHeaderButton>
        } />

        {/* ÜSTTE YENİ SAYFA EKLE BUTONU */}
        <View style={styles.topActionContainer}>
          <ActionCard
            icon={BookOpen}
            title={hasTodayNote ? t("dailyNotes.continueToday") : t("dailyNotes.writeToday")}
            subtitle={hasTodayNote ? t("dailyNotes.continueTodaySub") : t("dailyNotes.writeTodaySub")}
            theme={theme}
            onPress={() => {
              if (executeOrIntercept(
                () => router.push(openForm("/(tabs)/add-daily-note", { date: dayjs().format("YYYY-MM-DD") })),
                t("dailyNotes.demo.writeTitle"),
                t("dailyNotes.demo.writeDescription")
              )) {
                return;
              }
              router.push(openForm("/(tabs)/add-daily-note", { date: dayjs().format("YYYY-MM-DD") }));
            }}
          />
        </View>

        {/* GÜNLÜK LİSTESİ */}
        {isLoading ? (
          <View style={{ paddingHorizontal: 20, gap: 14, marginTop: 10 }}>
            <Skeleton height={140} borderRadius={20} />
            <Skeleton height={140} borderRadius={20} />
            <Skeleton height={140} borderRadius={20} />
          </View>
        ) : (
          <FlatList
            data={notes}
            keyExtractor={keyExtractor}
            renderItem={renderNoteCard}
            extraData={theme}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 130 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={theme.accent}
              />
            }
            ListEmptyComponent={
              <EmptyState
                emoji="📓"
                title={t("dailyNotes.empty.title")}
                description={t("dailyNotes.empty.description")}
                ctaLabel={t("dailyNotes.empty.cta")}
                onPressCta={() => {
                  if (executeOrIntercept(
                    () => router.push(openForm("/(tabs)/add-daily-note", { date: dayjs().format("YYYY-MM-DD") })),
                    t("dailyNotes.demo.writeTitle"),
                    t("dailyNotes.demo.writeDescription")
                  )) {
                    return;
                  }
                  router.push(openForm("/(tabs)/add-daily-note", { date: dayjs().format("YYYY-MM-DD") }));
                }}
                theme={theme}
              />
            }
          />
        )}
      </View>

      <LazyPageTourModal visible={isTourVisible} guide={guide} onClose={closeTour} />
      <LazyDemoActionModal
        visible={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        title={modalConfig.title}
        description={modalConfig.description}
      />
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
    headerTitleBox: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 8,
    },
    headerTitle: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      letterSpacing: -0.4,
    },
    headerSubtitle: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.55)",
      marginTop: 2,
    },
    topActionContainer: {
      paddingHorizontal: 16,
      marginBottom: 14,
    },
    writeNoteActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderRadius: 24,
      gap: 14,
    },
    writeActionIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    writeActionTitle: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      letterSpacing: -0.2,
    },
    writeActionSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.55)",
      marginTop: 2,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 130,
      gap: 14,
    },
    cardContainer: {
      borderRadius: 22,
      padding: 18,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    dateBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    dayCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    dayText: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
    },
    monthYearText: {
      fontSize: 13.5,
      fontFamily: "Inter_600SemiBold",
      color: theme.text,
    },
    weekdayText: {
      fontSize: 11.5,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.45)",
    },
    actionBtnsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    actionIconBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
      alignItems: "center",
      justifyContent: "center",
    },
    moodBadgeContainer: {
      alignSelf: "flex-start",
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
      marginBottom: 8,
    },
    moodBadgeText: {
      fontSize: 12.5,
      fontFamily: "Inter_600SemiBold",
      color: isLight ? theme.text : "rgba(255,255,255,0.85)",
    },
    noteTitleText: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      marginBottom: 6,
      letterSpacing: -0.2,
    },
    noteBodyText: {
      fontSize: 14.5,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.8)",
      lineHeight: 23,
    },

    /* MODAL */
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
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
    },
    modalTitle: {
      fontSize: 17,
      fontFamily: "Inter_700Bold",
      color: theme.text,
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)",
      alignItems: "center",
      justifyContent: "center",
    },
    modalTextInput: {
      borderRadius: 16,
      padding: 16,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: theme.text,
      minHeight: 160,
      textAlignVertical: "top",
      lineHeight: 22,
      borderWidth: 1,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
    },
    modalInputError: {
      borderColor: "#D85F78",
      borderWidth: 1.5,
    },
    modalActionsRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
      marginTop: 6,
    },
    modalCancelBtn: {
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 14,
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)",
    },
    modalCancelBtnText: {
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.7)",
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
    modalSaveBtn: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    modalSaveBtnText: {
      color: "#ffffff",
      fontSize: 14,
      fontFamily: "Inter_700Bold",
    },
  });
};
