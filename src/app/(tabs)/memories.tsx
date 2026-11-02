import { StorageImage } from "@/components/common/StorageImage";
import { AnniversaryMilestoneModal } from "@/components/memories/AnniversaryMilestoneModal";
import { MemoryThread } from "@/components/memories/MemoryThread";
import { MilestoneDateCircle } from "@/components/memories/MilestoneDateCircle";
import { WashiCornerPair } from "@/components/memories/WashiTape";
import { EmptyState } from "@/components/ui/EmptyState";
import { LazyDemoActionModal, LazyPageTourModal } from "@/components/ui/lazyMount";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useDemoAction } from "@/hooks/useDemoAction";
import { usePageTour } from "@/hooks/usePageTour";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { rainConfetti } from "@/lib/confettiRain";
import { dayjs, todayString } from "@/lib/date";
import {
  DEFAULT_MEMORY_DESCRIPTIONS,
  DEFAULT_MEMORY_TITLES,
  DEFAULT_MEMORY_TITLE_LIST,
  localizeDefaultMemory,
} from "@/lib/defaultMemories";
import { appAlert } from "@/lib/dialog";
import { openForm } from "@/lib/formEntry";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { MEMORIES_PAGE_SIZE, fetchMemoriesPage, memoriesQueryKey } from "@/lib/screenQueries";
import { localizeServerError } from "@/lib/serverErrors";
import { getSpecialDayState } from "@/lib/specialDays";
import { removeStoredFiles } from "@/lib/storageImages";
import { supabase } from "@/lib/supabase";
import type { AppTheme } from "@/lib/theme";
import { toast } from "@/lib/toast";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { Pencil, PlusCircle, Trash2 } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, FadeInUp, FadeOutDown, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MemoriesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { profile, session, isDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme, isLight } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const insets = useSafeAreaInsets();
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("memories");

  const coupleId = profile?.coupleId || null;
  const PAGE_SIZE = MEMORIES_PAGE_SIZE;

  useEffect(() => {
    if (isDemoMode) return;
    async function syncAndAddDefaultMemories() {
      if (!coupleId) return;

      // 1. Veritabanındaki mevcut varsayılan kartları kontrol et
      const { data: existing } = await supabase
        .from("memories")
        .select("id, title, date")
        .eq("couple_id", coupleId)
        .in("title", DEFAULT_MEMORY_TITLE_LIST);

      const existingMap = new Map((existing || []).map((e) => [e.title, e]));
      let hasUpdated = false;

      // Eğer mevcut kartlar varsa ve tarihleri profile ile uyuşmuyorsa senkronize et
      if (profile?.relationshipStartDate && existingMap.has(DEFAULT_MEMORY_TITLES.relationship)) {
        const mem = existingMap.get(DEFAULT_MEMORY_TITLES.relationship)!;
        if (mem.date !== profile.relationshipStartDate) {
          await supabase
            .from("memories")
            .update({ date: profile.relationshipStartDate })
            .eq("id", mem.id);
          hasUpdated = true;
        }
      }

      if (profile?.meetDate && existingMap.has(DEFAULT_MEMORY_TITLES.meet)) {
        const mem = existingMap.get(DEFAULT_MEMORY_TITLES.meet)!;
        if (mem.date !== profile.meetDate) {
          await supabase
            .from("memories")
            .update({ date: profile.meetDate })
            .eq("id", mem.id);
          hasUpdated = true;
        }
      }

      // 2. İlk tohumlama (seed): daha önce bu couple için yapılmadıysa ekle
      const storageKey = `@defaults_seeded_${coupleId}`;
      const alreadySeeded = await AsyncStorage.getItem(storageKey);
      if (!alreadySeeded) {
        const memoriesToInsert: any[] = [];
        if (profile?.meetDate && !existingMap.has(DEFAULT_MEMORY_TITLES.meet)) {
          memoriesToInsert.push({
            couple_id: coupleId,
            title: DEFAULT_MEMORY_TITLES.meet,
            date: profile.meetDate,
            description: DEFAULT_MEMORY_DESCRIPTIONS.meet,
            is_default: true,
          });
        }

        if (profile?.relationshipStartDate && !existingMap.has(DEFAULT_MEMORY_TITLES.relationship)) {
          memoriesToInsert.push({
            couple_id: coupleId,
            title: DEFAULT_MEMORY_TITLES.relationship,
            date: profile.relationshipStartDate,
            description: DEFAULT_MEMORY_DESCRIPTIONS.relationship,
            is_default: true,
          });
        }

        if (memoriesToInsert.length > 0) {
          await supabase.from("memories").insert(memoriesToInsert);
          hasUpdated = true;
        }

        await AsyncStorage.setItem(storageKey, "1");
      }

      if (hasUpdated) {
        queryClient.invalidateQueries({ queryKey: ["memories"] });
      }
    }

    syncAndAddDefaultMemories();
  }, [coupleId, profile?.relationshipStartDate, profile?.meetDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: memoriesQueryKey(coupleId, isDemoMode),
    enabled: !!coupleId || isDemoMode,
    initialPageParam: 0,
    queryFn: ({ pageParam = 0 }) => fetchMemoriesPage({ coupleId, pageParam, isDemoMode }),
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
    },
    staleTime: 1000 * 60 * 5,
  });

  const { refreshing, onRefresh } = usePullToRefresh(refetch);

  const memories = useMemo(() => (data ? data.pages.flat() : []), [data]);

  // ─── Sıradaki özel gün: yıldönümüne kalan günü en az olan anı(lar) altın nabızla öne çıkar ───
  const closestUpcomingIds = useMemo(() => {
    const today = dayjs().startOf("day");
    let min = Infinity;
    const ids = new Set<number>();
    for (const memory of memories) {
      const memDay = dayjs(memory.date).startOf("day");
      if (!memDay.isValid()) continue;
      let next = memDay.year(today.year());
      if (next.isBefore(today)) next = next.add(1, "year");
      const diff = next.diff(today, "day");
      if (diff < min) {
        min = diff;
        ids.clear();
        ids.add(memory.id);
      } else if (diff === min) {
        ids.add(memory.id);
      }
    }
    return ids;
  }, [memories]);

  // ─── Zaman tüneli ipi: liste kaydırıldıkça ışık huzmesi akar ───
  const scrollY = useSharedValue(0);
  const onListScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });

  interface MilestoneData {
    title: string;
    message: string;
    years: number;
    days: number;
    key: string;
  }

  // ─── Yıldönümü / Özel Gün Karşılama Töreni (Milestone Reveal) ───
  const relationshipStartDate = profile?.relationshipStartDate;
  const anniversary = useMemo(
    () => getSpecialDayState(relationshipStartDate).anniversary,
    [relationshipStartDate]
  );
  const isFocused = useIsFocused();
  const [milestone, setMilestone] = useState<MilestoneData | null>(null);

  // Sekmeye her dönüldüğünde en güncel veriyi çek
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  useEffect(() => {
    if (!isFocused || milestone) return;

    let active = true;

    async function checkMilestoneCeremony() {
      const today = dayjs().startOf("day");
      const candidates: MilestoneData[] = [];

      // 1. Sevgililik yıldönümü kontrolü
      if (relationshipStartDate && anniversary && anniversary.daysLeft === 0) {
        const days = today.diff(dayjs(relationshipStartDate).startOf("day"), "day");
        candidates.push({
          title: t("memories.milestone.title", { years: anniversary.years }),
          message: t("memories.milestone.message", { days }),
          years: anniversary.years,
          days,
          key: `@seen_anniversary_milestone_${anniversary.years}_${todayString()}`,
        });
      }

      // 2. Anılar / özel günler listesindeki gün kontrolü (bugün veya bugünkü yıldönümleri)
      for (const mem of memories) {
        const d = dayjs(mem.date);
        const memDay = d.startOf("day");
        if (!memDay.isValid()) continue;

        let nextAnn = memDay.year(today.year());
        if (nextAnn.isBefore(today)) nextAnn = nextAnn.add(1, "year");
        const diffDays = nextAnn.diff(today, "day");
        const whichYear = nextAnn.year() - memDay.year();
        const totalDays = today.diff(memDay, "day");

        if (diffDays === 0) {
          const defaultLoc = localizeDefaultMemory(mem, t);
          const displayTitle = defaultLoc?.title ?? mem.title;

          if (whichYear > 0) {
            candidates.push({
              title: mem.is_default
                ? t("memories.milestone.title", { years: whichYear })
                : t("memories.milestone.memoryAnniversaryTitle", { title: displayTitle, years: whichYear }),
              message: t("memories.milestone.memoryAnniversaryMessage", { title: displayTitle, years: whichYear, days: totalDays }),
              years: whichYear,
              days: totalDays,
              key: `@seen_milestone_mem_${mem.id}_${whichYear}_${todayString()}`,
            });
          } else {
            candidates.push({
              title: t("memories.milestone.todaySpecialTitle", { title: displayTitle }),
              message: t("memories.milestone.todaySpecialMessage", { title: displayTitle }),
              years: 0,
              days: 0,
              key: `@seen_milestone_mem_${mem.id}_today_${todayString()}`,
            });
          }
        }
      }

      for (const c of candidates) {
        const seen = await AsyncStorage.getItem(c.key);
        if (!seen && active) {
          setMilestone(c);
          break;
        }
      }
    }

    checkMilestoneCeremony();

    return () => {
      active = false;
    };
  }, [isFocused, memories, relationshipStartDate, anniversary, milestone, t]);

  const closeMilestone = useCallback(() => {
    if (milestone) AsyncStorage.setItem(milestone.key, "1");
    setMilestone(null);
    // Modal native olarak en üstte çizilir; konfeti, tören kapanınca Anılar ekranına yağar
    rainConfetti();
  }, [milestone]);

  const handleDelete = (id: number) => {
    if (executeOrIntercept(
      () => { },
      t("memories.demo.deleteTitle"),
      t("memories.demo.deleteDescription")
    )) {
      return;
    }

    appAlert(
      t("memories.delete.title"),
      t("memories.delete.message"),
      [
        { text: t("common.cancelAction"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            setDeletingId(id);
            const imagePath = (memories.find((m) => m.id === id) as { image_path?: string | null } | undefined)?.image_path;
            const { error } = await supabase.from("memories").delete().eq("id", id);
            setDeletingId(null);
            if (!error) {
              if (imagePath) {
                removeStoredFiles("memories", [imagePath]).catch(() => { });
              }
              await queryClient.invalidateQueries({ queryKey: ["memories"] });
              toast.success(t("memories.toasts.deleted"));
            } else {
              appAlert(t("common.error"), t("memories.errors.deleteFailedWithMessage", { message: localizeServerError(error, "") }));
            }
          }
        }
      ]
    );
  };

  // Hem alt "Yeni Özel Gün Ekle" butonu hem de boş durum eylemi kullanır
  const goToAddMemory = () => {
    if (executeOrIntercept(
      () => router.push(openForm("/(tabs)/add-memory")),
      t("memories.demo.addTitle"),
      t("memories.demo.addDescription")
    )) {
      return;
    }
    router.push(openForm("/(tabs)/add-memory"));
  };

  const handleEdit = (memory: any) => {
    if (executeOrIntercept(
      () => { },
      t("memories.demo.editTitle"),
      t("memories.demo.editDescription")
    )) {
      return;
    }

    router.push(openForm("/(tabs)/add-memory", {
      id: String(memory.id),
      title: memory.title,
      date: memory.date,
      description: memory.description || "",
      image_path: memory.image_path || "",
    }));
  };

  const renderMemory = useCallback(({ item: memory, index }: { item: any, index: number }) => {
    const d = dayjs(memory.date);
    const today = dayjs().startOf("day");
    const memDay = d.startOf("day");
    const totalDays = today.diff(memDay, "day");

    let nextAnniversary = memDay.year(today.year());
    if (nextAnniversary.isBefore(today)) {
      nextAnniversary = nextAnniversary.add(1, "year");
    }
    const diffDays = nextAnniversary.diff(today, "day");
    const whichYear = nextAnniversary.year() - memDay.year();
    const canManage = isEditMode && !memory.is_default;
    // Varsayılan kartların başlığı/açıklaması veritabanında Türkçe sabit olarak durur; ekranda geçerli dilde gösterilir
    const defaultLocalized = localizeDefaultMemory(memory, t);

    return (
      <Animated.View
        key={memory.id}
        // Gecikme ilk birkaç kartla sınırlı: eskiden 15. kart 900 ms boş bekleyip sonra beliriyordu
        entering={FadeInDown.delay(Math.min(index, 5) * 45).duration(280)}
        style={styles.memoryRow}
      >
        <MilestoneDateCircle index={index} theme={theme} highlight={closestUpcomingIds.has(memory.id)} />

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.cardBg,
              borderColor: diffDays === 0 ? (isLight ? "#D97706" : "#F5C563") : theme.cardBorder,
              borderWidth: diffDays === 0 ? 1.5 : 1,
              ...theme.cardShadow,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{defaultLocalized?.title ?? memory.title}</Text>
              <Text style={[styles.cardYear, { color: theme.accent }]}>{d.locale(i18n.language).format("D MMMM YYYY")}</Text>

              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.anniversaryBadge,
                    diffDays === 0
                      ? {
                          backgroundColor: isLight ? "rgba(245, 197, 99, 0.22)" : "rgba(245, 197, 99, 0.18)",
                          borderColor: isLight ? "#D97706" : "#F5C563",
                        }
                      : {
                          backgroundColor: isLight ? "rgba(225,29,72,0.08)" : "rgba(255, 75, 110, 0.12)",
                          borderColor: isLight ? "rgba(225,29,72,0.25)" : "rgba(255, 75, 110, 0.25)",
                        },
                  ]}
                >
                  <Text style={[styles.anniversaryBadgeText, { color: diffDays === 0 ? (isLight ? "#B7791F" : "#F5C563") : theme.accent }]}>
                    {diffDays === 0
                      ? whichYear > 0
                        ? t("memories.badge.todayWithYear", { year: whichYear })
                        : `✨ ${t("memories.badge.today")} ✨`
                      : whichYear > 0
                        ? t("memories.badge.daysLeftWithYear", { year: whichYear, count: diffDays })
                        : t("memories.badge.daysLeft", { count: diffDays })}
                  </Text>
                </View>
                {totalDays > 0 && (
                  <View style={[styles.milestoneBadge, { backgroundColor: isLight ? "rgba(0,0,0,0.04)" : "rgba(255, 255, 255, 0.06)", borderColor: theme.cardBorder }]}>
                    <Text style={[styles.milestoneBadgeText, { color: theme.textMuted }]}>
                      {t("memories.badge.dayNumber", { totalDays })}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {canManage && (
              <Animated.View entering={FadeInUp.duration(150)} style={styles.actionsBox}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.edit")} onPress={() => handleEdit(memory)}>
                  <Pencil size={18} color={theme.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.delete")} onPress={() => handleDelete(memory.id)} disabled={deletingId === memory.id}>
                  {deletingId === memory.id ? (
                    <ActivityIndicator size="small" color={theme.accent} />
                  ) : (
                    <Trash2 size={18} color={theme.textMuted} />
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>

          {(defaultLocalized?.description ?? memory.description) ? (
            <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>{defaultLocalized?.description ?? memory.description}</Text>
          ) : null}

          {memory.image_path && (
            // Anı defteri: fotoğraf üst köşelerinden yarı saydam washi bantla tutturulmuş gibi durur
            <View style={styles.imageFrame}>
              <View style={styles.imageBox}>
                <StorageImage bucket="memories" path={memory.image_path} style={styles.image} contentFit="cover" />
              </View>
              <WashiCornerPair animate={false} />
            </View>
          )}
        </View>
      </Animated.View>
    );
  }, [theme, isLight, styles, isEditMode, executeOrIntercept, handleEdit, handleDelete, deletingId, t, i18n.language, closestUpcomingIds]);

  // Oturum yokken boş zemin; hook sırası bozulmasın diye tüm hook'lardan sonra kontrol edilir
  if (!session && !isDemoMode) return <View style={{ flex: 1, backgroundColor: "#080811" }} />;

  return (
    <ScreenBackground>
      <ScreenHeader
        title={t("memories.title")}
        subtitle={t("memories.subtitle")}
        onOpenTour={openTour}
        actions={
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.editBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)" }]}
            onPress={() => setIsEditMode(!isEditMode)}
          >
            <Text style={[styles.editBtnText, { color: theme.text }]}>{isEditMode ? t("memories.done") : t("common.edit")}</Text>
          </TouchableOpacity>
        }
      />

      {isLoading ? (
        <View style={{ gap: 16, marginTop: 40, paddingHorizontal: 20 }}>
          <Skeleton height={150} borderRadius={16} />
          <Skeleton height={150} borderRadius={16} />
        </View>
      ) : memories?.length === 0 ? (
        <EmptyState
          illustrationType="memories"
          title={t("empty.memoriesTitle")}
          description={t("empty.memoriesDesc")}
          ctaLabel={t("memories.empty.cta")}
          onPressCta={goToAddMemory}
          theme={theme}
          style={styles.emptyState}
        />
      ) : (
        <View style={styles.timelineContainer}>
          {/* Yaşayan zaman tüneli: degrade aşk ipi, nefes alan ışıltı ve kaydırmayla akan ışık huzmesi */}
          <MemoryThread theme={theme} scrollY={scrollY} left={36} />

          <Animated.FlatList
            data={memories}
            keyExtractor={item => item.id.toString()}
            extraData={{ theme, isLight, isEditMode, closestUpcomingIds }}
            renderItem={renderMemory}
            onScroll={onListScroll}
            scrollEventThrottle={16}
            refreshing={refreshing}
            onRefresh={onRefresh}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={7}
            contentContainerStyle={{ paddingBottom: insets.bottom + 160 }}
            showsVerticalScrollIndicator={false}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={theme.accent} style={{ margin: 20 }} /> : null}
          />
        </View>
      )}

      {/* Yeni özel gün ekleme: "Düzenle" butonuna dokunulduğunda zarifçe açılır */}
      {isEditMode && (
        <Animated.View
          entering={FadeInUp.duration(250)}
          exiting={FadeOutDown.duration(200)}
          style={[styles.addBtnContainer, { bottom: insets.bottom + 96 }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.accent }]}
            onPress={goToAddMemory}
            activeOpacity={0.8}
          >
            <PlusCircle size={20} color="#fff" />
            <Text style={styles.addBtnText}>{t("memories.addNew")}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
      <LazyPageTourModal visible={isTourVisible} guide={guide} onClose={closeTour} />
      <AnniversaryMilestoneModal
        visible={!!milestone}
        years={milestone?.years ?? 1}
        days={milestone?.days ?? 0}
        title={milestone?.title}
        message={milestone?.message}
        theme={theme}
        onClose={closeMilestone}
      />
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
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    title: {
      fontSize: 30,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.6)",
      fontSize: 14,
      fontFamily: "Inter_400Regular",
    },
    editBtn: {
      height: 40,
      justifyContent: "center",
      paddingHorizontal: 16,
      borderRadius: 20,
    },
    editBtnText: {
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.8)",
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
    },
    emptyState: {
      marginHorizontal: 20,
    },
    timelineContainer: {
      flex: 1,
      position: "relative",
      paddingVertical: 8,
      paddingHorizontal: 20,
    },
    memoryRow: {
      flexDirection: "row",
      marginBottom: 24,
      alignItems: "flex-start",
      zIndex: 1,
    },
    card: {
      flex: 1,
      borderRadius: 24,
      padding: 18,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    cardTitle: {
      color: theme.text,
      fontSize: 18,
      fontFamily: "Inter_700Bold",
    },
    cardYear: {
      fontSize: 13,
      marginTop: 4,
      fontFamily: "Inter_600SemiBold",
    },
    badgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 8,
      alignItems: "center",
    },
    anniversaryBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    anniversaryBadgeText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
    },
    milestoneBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
    },
    milestoneBadgeText: {
      fontSize: 11,
      fontFamily: "Inter_500Medium",
    },
    cardDesc: {
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.5)",
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      marginBottom: 12,
    },
    actionsBox: {
      flexDirection: "row",
      gap: 16,
    },
    imageFrame: {
      position: "relative",
      marginTop: 6,
    },
    imageBox: {
      borderRadius: 12,
      overflow: "hidden",
    },
    image: {
      width: "100%",
      height: 120,
      resizeMode: "cover",
    },
    addBtnContainer: {
      position: "absolute",
      bottom: 110,
      left: 20,
      right: 20,
      zIndex: 100,
      elevation: 10,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 18,
      borderRadius: 20,
      gap: 8,
    },
    addBtnText: {
      color: "#fff",
      fontSize: 16,
      fontFamily: "Inter_700Bold",
    },
  });
};
