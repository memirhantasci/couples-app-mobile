import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from "react-native";
import { appAlert } from "@/lib/dialog";
import { StorageImage } from "@/components/common/StorageImage";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { removeStoredFiles } from "@/lib/storageImages";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { dayjs } from "@/lib/date";
import { Plus, Trash2, Pencil, Menu, ChevronLeft, PlusCircle, AlignJustify } from "lucide-react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { usePageTour } from "@/hooks/usePageTour";
import { PageTourModal } from "@/components/tour/PageTourModal";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { useDemoAction } from "@/hooks/useDemoAction";
import { DemoActionModal } from "@/components/demo/DemoActionModal";
import { DEMO_PROFILE } from "@/constants/demoData";

export default function MemoriesScreen() {
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
  const PAGE_SIZE = 15;

  useEffect(() => {
    if (isDemoMode) return;
    async function syncAndAddDefaultMemories() {
      if (!coupleId) return;

      // 1. Veritabanındaki mevcut varsayılan kartları kontrol et
      const { data: existing } = await supabase
        .from("memories")
        .select("id, title, date")
        .eq("couple_id", coupleId)
        .in("title", ["Tanışma Yıl Dönümümüz", "Sevgili Olma Yıl Dönümümüz"]);

      const existingMap = new Map((existing || []).map((e) => [e.title, e]));
      let hasUpdated = false;

      // Eğer mevcut kartlar varsa ve tarihleri profile ile uyuşmuyorsa senkronize et
      if (profile?.relationshipStartDate && existingMap.has("Sevgili Olma Yıl Dönümümüz")) {
        const mem = existingMap.get("Sevgili Olma Yıl Dönümümüz")!;
        if (mem.date !== profile.relationshipStartDate) {
          await supabase
            .from("memories")
            .update({ date: profile.relationshipStartDate })
            .eq("id", mem.id);
          hasUpdated = true;
        }
      }

      if (profile?.meetDate && existingMap.has("Tanışma Yıl Dönümümüz")) {
        const mem = existingMap.get("Tanışma Yıl Dönümümüz")!;
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
        if (profile?.meetDate && !existingMap.has("Tanışma Yıl Dönümümüz")) {
          memoriesToInsert.push({
            couple_id: coupleId,
            title: "Tanışma Yıl Dönümümüz",
            date: profile.meetDate,
            description: "Hikayemizin başladığı o güzel gün...",
            is_default: false,
          });
        }

        if (profile?.relationshipStartDate && !existingMap.has("Sevgili Olma Yıl Dönümümüz")) {
          memoriesToInsert.push({
            couple_id: coupleId,
            title: "Sevgili Olma Yıl Dönümümüz",
            date: profile.relationshipStartDate,
            description: "Aşkımızın resmi olarak başladığı gün...",
            is_default: false,
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
    queryKey: ["memories", coupleId, isDemoMode],
    enabled: !!coupleId || isDemoMode,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (isDemoMode) {
        return [
          {
            id: 1,
            title: "Sevgili Olduğumuz İlk Gün 💖",
            date: DEMO_PROFILE.relationshipStartDate ?? dayjs().subtract(365, "day").format("YYYY-MM-DD"),
            description: "Birlikte el ele tutuşup geleceğe söz verdiğimiz o an...",
          },
          {
            id: 2,
            title: "İlk Tanıştığımız Gün ☕",
            date: DEMO_PROFILE.meetDate ?? dayjs().subtract(428, "day").format("YYYY-MM-DD"),
            description: "Gözlerinin içindeki parıltıyı ilk fark ettiğim gün.",
          },
        ];
      }
      const { data, error } = await supabase
        .from("memories")
        .select("id, date, title, description, image_path, is_default")
        .eq("couple_id", coupleId)
        .order("date", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      return data || [];
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
    },
    staleTime: 1000 * 60 * 5,
  });

  const memories = data ? data.pages.flat() : [];

  const handleDelete = (id: number) => {
    if (executeOrIntercept(
      () => {},
      "Özel Günü Silmek İçin Kayıt Olun 🗑️",
      "Kaydettiğiniz özel günleri ve anıları yönetmek için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }

    appAlert(
      "Anıyı Sil",
      "Bu özel günü silmek istediğine emin misin?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            setDeletingId(id);
            const imagePath = (memories.find((m) => m.id === id) as { image_path?: string | null } | undefined)?.image_path;
            const { error } = await supabase.from("memories").delete().eq("id", id);
            setDeletingId(null);
            if (!error) {
              // Kayıt silindikten sonra fotoğrafı depoda sahipsiz kalmasın
              removeStoredFiles("memories", [imagePath]).catch(() => {});
              queryClient.invalidateQueries({ queryKey: ["memories"] });
            } else {
              appAlert("Hata", "Silinirken bir hata oluştu.");
            }
          }
        }
      ]
    );
  };

  // Hem alt "Yeni Özel Gün Ekle" butonu hem de boş durum eylemi kullanır
  const goToAddMemory = () => {
    if (executeOrIntercept(
      () => router.push("/(tabs)/add-memory"),
      "Özel Gün ve Anı Eklemek İçin Kayıt Olun 💖",
      "İlişkinizin dönüm noktalarını kaydetmek ve yıldönümü bildirimleri almak için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }
    router.push("/(tabs)/add-memory");
  };

  const handleEdit = (memory: any) => {
    if (executeOrIntercept(
      () => {},
      "Özel Günü Düzenlemek İçin Kayıt Olun ✏️",
      "Anılarınızı ve özel günlerinizi düzenlemek için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }

    router.push({
      pathname: "/(tabs)/add-memory",
      params: { 
        id: memory.id, 
        title: memory.title, 
        date: memory.date, 
        description: memory.description || "", 
        image_path: memory.image_path || ""
      }
    });
  };

  if (!session && !isDemoMode) return <View style={{ flex: 1, backgroundColor: "#080811" }} />;



  const renderMemory = ({ item: memory, index }: { item: any, index: number }) => {
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

    return (
      <Animated.View 
        key={memory.id}
        // Gecikme ilk birkaç kartla sınırlı: eskiden 15. kart 900 ms boş bekleyip sonra beliriyordu
        entering={FadeInDown.delay(Math.min(index, 5) * 45).duration(280)}
        style={styles.memoryRow}
      >
        <View style={[styles.dateCircle, { borderColor: theme.accent, backgroundColor: theme.cardBg }]}>
          <Text style={[styles.dateNumber, { color: theme.accent }]}>{index + 1}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1, ...theme.cardShadow }]}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>{memory.title}</Text>
              <Text style={[styles.cardYear, { color: theme.accent }]}>{d.locale("tr").format("D MMMM YYYY")}</Text>

              <View style={styles.badgeRow}>
                <View style={[styles.anniversaryBadge, { backgroundColor: isLight ? "rgba(225,29,72,0.08)" : "rgba(255, 75, 110, 0.12)", borderColor: isLight ? "rgba(225,29,72,0.25)" : "rgba(255, 75, 110, 0.25)" }]}>
                  <Text style={[styles.anniversaryBadgeText, { color: theme.accent }]}>
                    {diffDays === 0
                      ? `🎉 Bugün ${whichYear > 0 ? `${whichYear}. ` : ""}Yıl Dönümümüz!`
                      : `⏳ ${whichYear > 0 ? `${whichYear}. Yılımıza ` : ""}${diffDays} Gün Kaldı`}
                  </Text>
                </View>
                {totalDays > 0 && (
                  <View style={[styles.milestoneBadge, { backgroundColor: isLight ? "rgba(0,0,0,0.04)" : "rgba(255, 255, 255, 0.06)", borderColor: theme.cardBorder }]}>
                    <Text style={[styles.milestoneBadgeText, { color: theme.textMuted }]}>
                      ✨ {totalDays}. Gün
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {canManage && (
              <Animated.View entering={FadeInUp.duration(150)} style={styles.actionsBox}>
                <TouchableOpacity onPress={() => handleEdit(memory)}>
                  <Pencil size={18} color={theme.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(memory.id)} disabled={deletingId === memory.id}>
                  {deletingId === memory.id ? (
                    <ActivityIndicator size="small" color={theme.accent} />
                  ) : (
                    <Trash2 size={18} color={theme.textMuted} />
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>

          {memory.description ? (
            <Text style={[styles.cardDesc, { color: theme.textSecondary }]}>{memory.description}</Text>
          ) : null}

          {memory.image_path && (
            <View style={styles.imageBox}>
              <StorageImage bucket="memories" path={memory.image_path} style={styles.image} contentFit="cover" />
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <ScreenBackground>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[styles.title, { color: theme.text }]}>Özel Günler</Text>
              <Text style={{ fontSize: 24 }}>❤️</Text>
            </View>
            <Text style={[styles.subtitle, { color: theme.textMuted, marginTop: 4 }]}>En tatlı anılarımızın milatları</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TourGuideButton onPress={openTour} />
            <TouchableOpacity 
              style={[styles.editBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1, ...theme.cardShadow }]}
              onPress={() => setIsEditMode(!isEditMode)}
            >
              <Text style={[styles.editBtnText, { color: theme.text }]}>{isEditMode ? "Bitti" : "Düzenle"}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push("/menu")} 
              style={{ 
                padding: 8, 
                backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)", 
                borderRadius: 20, 
                width: 40, 
                height: 40, 
                alignItems: "center", 
                justifyContent: "center",
                borderColor: theme.cardBorder,
                borderWidth: 1
              }}
            >
              <AlignJustify color={theme.textSecondary} size={22} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={{ gap: 16, marginTop: 40, paddingHorizontal: 20 }}>
          <Skeleton height={150} borderRadius={16} />
          <Skeleton height={150} borderRadius={16} />
        </View>
      ) : memories?.length === 0 ? (
        <EmptyState
          emoji="🎞️"
          title="Anı defteriniz henüz bembeyaz"
          description="Tanıştığınız günü, ilk buluşmanızı, size özel her şeyi ekleyin; yıllar sonra ilk sayfa sizi gülümsetsin."
          ctaLabel="İlk Özel Günü Ekle ✨"
          onPressCta={goToAddMemory}
          theme={theme}
          style={styles.emptyState}
        />
      ) : (
        <View style={styles.timelineContainer}>
          {/* Vertical line matching the screenshot (very dark burgundy or theme.unitBg with opacity) */}
          <View style={[styles.timelineLine, { backgroundColor: theme.unitBg }]} />

          <FlatList
            data={memories}
            keyExtractor={item => item.id.toString()}
            renderItem={renderMemory}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={7}
            contentContainerStyle={{ paddingBottom: 150 }}
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

      {/* Add Button is only visible in Edit Mode */}
      {isEditMode && (
        <Animated.View entering={FadeInUp.duration(250)} style={styles.addBtnContainer}>
          <TouchableOpacity 
            style={[styles.addBtn, { backgroundColor: theme.accent }]}
            onPress={goToAddMemory}
            activeOpacity={0.8}
          >
            <PlusCircle size={20} color="#fff" />
            <Text style={styles.addBtnText}>Yeni Özel Gün Ekle</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
      <PageTourModal visible={isTourVisible} guide={guide} onClose={closeTour} />
      <DemoActionModal
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
      paddingVertical: 8,
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
    timelineLine: {
      position: "absolute",
      left: 36,
      top: 0,
      bottom: 0,
      width: 2,
      zIndex: 0,
    },
    memoryRow: {
      flexDirection: "row",
      marginBottom: 24,
      alignItems: "flex-start",
      zIndex: 1,
    },
    dateCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 20,
      zIndex: 2,
    },
    dateNumber: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
    },
    card: {
      flex: 1,
      borderRadius: 20,
      padding: 16,
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
