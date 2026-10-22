import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { appAlert } from "@/lib/dialog";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, Plus, AlignJustify, Camera,
  Grid3X3, Grid2X2, Square, ArrowUpDown,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { AppTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { PremiumPaywall } from "@/components/ui/PremiumPaywall";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePageTour } from "@/hooks/usePageTour";
import { PageTourModal } from "@/components/tour/PageTourModal";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { DEMO_PHOTOS } from "@/constants/demoData";
import { useDemoAction } from "@/hooks/useDemoAction";
import { DemoActionModal } from "@/components/demo/DemoActionModal";
import { PhotoGrid3Cell } from "@/components/photos/PhotoGrid3Cell";
import { PhotoGrid2Cell } from "@/components/photos/PhotoGrid2Cell";
import { PhotoSingleCell } from "@/components/photos/PhotoSingleCell";
import { PhotosLockCard } from "@/components/photos/PhotosLockCard";
import { PhotoLightboxModal } from "@/components/photos/PhotoLightboxModal";
import type { PhotoItem, ViewMode } from "@/components/photos/photoTypes";

export default function PhotosScreen() {
  const router = useRouter();
  const { session, profile, isDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme, isLight } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;
  // Demo modunda premium kilitleri yoktur: tüm özellikler açık
  const isPremium = (profile?.isPremium ?? false) || isDemoMode;
  const [showPaywall, setShowPaywall] = useState(false);
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("photos");

  // Görünüm Modu: 2'li (varsayılan dengeli), 3'lü (kompakt hızlı gezinti), single (büyük kartlar)
  const [viewMode, setViewMode] = useState<ViewMode>("grid2");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const PAGE_SIZE = 30;

  // Fotoğrafları sayfalama (pagination) ile çek
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["photo_archive", coupleId, isDemoMode, sortOrder],
    enabled: (!!coupleId && isPremium) || isDemoMode,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      if (isDemoMode) {
        const sorted = [...(DEMO_PHOTOS as any[])].sort((a, b) => {
          const diff = new Date(a.taken_date).getTime() - new Date(b.taken_date).getTime();
          return sortOrder === "asc" ? diff : -diff;
        });
        return sorted as any;
      }
      const asc = sortOrder === "asc";
      const { data, error } = await supabase
        .from("photo_archive")
        .select("id, image_url, thumb_url, taken_date, taken_time, title, description, user_id, created_at, storage_path")
        .eq("couple_id", coupleId)
        .order("taken_date", { ascending: asc })
        .order("created_at", { ascending: asc })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      return (data || []) as PhotoItem[];
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
    },
    staleTime: 1000 * 60 * 5,
  });

  const photos = useMemo(() => {
    return data ? data.pages.flat() : [];
  }, [data]);

  const currentPhoto = selectedIndex !== null && photos[selectedIndex] ? photos[selectedIndex] : null;

  const goToUpload = () => {
    if (executeOrIntercept(
      () => router.push("/(tabs)/add-photo"),
      "Ortak Fotoğraf Eklemek İçin Kayıt Olun 📸",
      "Sevgilinizle ortak anı albümü oluşturmak ve fotoğraflarınızın çekildiği yerleri haritada görmek için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    router.push("/(tabs)/add-photo");
  };

  // Fotoğraf Sil
  const handleDelete = useCallback((id: number) => {
    if (executeOrIntercept(
      () => {},
      "Fotoğrafı Silmek İçin Kayıt Olun 🗑️",
      "Fotoğraf arşivinizi yönetmek ve silmek için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }

    // Silinecek fotoğrafı bul
    const photoToDelete = photos.find((p) => p.id === id);
    if (!photoToDelete) return;

    // Yalnızca fotoğrafı yükleyen kullanıcı silebilir
    if (photoToDelete.user_id && userId && photoToDelete.user_id !== userId) {
      appAlert("Yetkisiz İşlem", "Sadece kendi yüklediğiniz fotoğrafları silebilirsiniz.");
      return;
    }

    appAlert("Fotoğrafı Sil", "Bu fotoğrafı galeriden kalıcı olarak silmek istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          if (currentPhoto?.id === id) {
            setSelectedIndex(null);
          }
          // 1. Önce Storage'dan dosyaları sil (ana görsel + küçük resim orphan temizliği)
          if (photoToDelete?.storage_path) {
            const filesToRemove: string[] = [photoToDelete.storage_path];
            if (photoToDelete.thumb_url) {
              const urlParts = photoToDelete.thumb_url.split("/photos/");
              if (urlParts.length > 1) {
                filesToRemove.push(decodeURIComponent(urlParts[1]));
              }
            }
            await supabase.storage.from("photos").remove(filesToRemove).catch(() => {});
          }
          // 2. Sonra veritabanı kaydını sil (hem id hem user_id doğrulaması ile)
          let query = supabase.from("photo_archive").delete().eq("id", id);
          if (userId) {
            query = query.eq("user_id", userId);
          }
          const { error } = await query;
          if (error) {
            appAlert("Hata", "Fotoğraf silinirken bir hata oluştu.");
          } else {
            queryClient.invalidateQueries({ queryKey: ["photo_archive", coupleId] });
            queryClient.invalidateQueries({ queryKey: ["map_photos", coupleId] });
            queryClient.invalidateQueries({ queryKey: ["calendar_data"] });
          }
        }
      }
    ]);
  }, [executeOrIntercept, photos, currentPhoto, queryClient, coupleId, userId]);

  // Tam ekranda sonraki / önceki fotoğrafa geç
  const handleNextPhoto = () => {
    if (selectedIndex !== null && selectedIndex < photos.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const handlePrevPhoto = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const renderGrid3Item = useCallback(({ item, index }: { item: PhotoItem; index: number }) => (
    <PhotoGrid3Cell item={item} index={index} onPress={setSelectedIndex} />
  ), []);

  const renderGrid2Item = useCallback(({ item, index }: { item: PhotoItem; index: number }) => (
    <PhotoGrid2Cell item={item} index={index} theme={theme} onPress={setSelectedIndex} />
  ), [theme]);

  const renderSingleItem = useCallback(({ item, index }: { item: PhotoItem; index: number }) => (
    <PhotoSingleCell
      item={item}
      index={index}
      isMine={Boolean(userId && item.user_id && item.user_id === userId)}
      theme={theme}
      isLight={isLight}
      onPress={setSelectedIndex}
      onDelete={handleDelete}
    />
  ), [theme, isLight, userId, handleDelete]);

  const keyExtractor = useCallback((item: PhotoItem) => item.id.toString(), []);

  const numColumns = viewMode === "grid3" ? 3 : viewMode === "grid2" ? 2 : 1;

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/home");
              }
            }}
            style={[styles.headerBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)", borderColor: theme.cardBorder }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft color={theme.text} size={24} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Ortak Galeri</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
              {photos.length > 0 ? `${photos.length} Ortak Hatıra 📸` : "Aşk Arşivimiz 📸"}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TourGuideButton onPress={openTour} />
            <TouchableOpacity
              onPress={goToUpload}
              style={[styles.headerBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : theme.cardBg, borderColor: theme.cardBorder }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Camera color={theme.accent} size={19} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/menu")}
              style={[styles.headerBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)", borderColor: theme.cardBorder }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AlignJustify color={theme.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── KONTROL ÇUBUĞU (GÖRÜNÜM SEÇİCİ & YENİ YÜKLE) ─── */}
        {isPremium && (
          <View style={[styles.controlBar, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
            {/* Hızlı Yükle Butonu */}
            <TouchableOpacity
              style={[styles.uploadQuickBtn, { backgroundColor: theme.accent }]}
              onPress={goToUpload}
              activeOpacity={0.85}
            >
              <Plus size={16} color="#ffffff" />
              <Text style={styles.uploadQuickBtnText}>Fotoğraf Ekle</Text>
            </TouchableOpacity>

            {/* Tarih Sıralama Toggleu */}
            <TouchableOpacity
              style={[styles.sortBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)" }]}
              onPress={() => setSortOrder(s => s === "desc" ? "asc" : "desc")}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <ArrowUpDown size={14} color={theme.accent} />
              <Text style={[styles.sortBtnText, { color: theme.textSecondary }]}>
                {sortOrder === "desc" ? "Yeniden Eskiye" : "Eskiden Yeniye"}
              </Text>
            </TouchableOpacity>

            {/* Görünüm Modları: 3'lü, 2'li, 1'li */}
            <View style={styles.viewModePills}>
              <TouchableOpacity
                style={[styles.viewModeBtn, viewMode === "grid3" && { backgroundColor: theme.unitBg }]}
                onPress={() => setViewMode("grid3")}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Grid3X3 size={16} color={viewMode === "grid3" ? theme.accent : theme.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.viewModeBtn, viewMode === "grid2" && { backgroundColor: theme.unitBg }]}
                onPress={() => setViewMode("grid2")}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Grid2X2 size={16} color={viewMode === "grid2" ? theme.accent : theme.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.viewModeBtn, viewMode === "single" && { backgroundColor: theme.unitBg }]}
                onPress={() => setViewMode("single")}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Square size={16} color={viewMode === "single" ? theme.accent : theme.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* FOTOĞRAF LİSTESİ */}
        {!isPremium ? (
          <PhotosLockCard theme={theme} isLight={isLight} onUpgrade={() => setShowPaywall(true)} />
        ) : isLoading ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10, justifyContent: 'space-between' }}>
            <Skeleton height={160} borderRadius={18} style={{ width: '48%' }} />
            <Skeleton height={160} borderRadius={18} style={{ width: '48%' }} />
            <Skeleton height={160} borderRadius={18} style={{ width: '48%' }} />
            <Skeleton height={160} borderRadius={18} style={{ width: '48%' }} />
          </View>
        ) : photos.length > 0 ? (
          <FlatList
            key={viewMode} // Re-render when layout columns change
            data={photos}
            keyExtractor={keyExtractor}
            numColumns={numColumns}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 140 },
              viewMode === "grid3" && styles.grid3ListGap,
              viewMode === "grid2" && styles.grid2ListGap,
              viewMode === "single" && styles.singleListGap,
            ]}
            showsVerticalScrollIndicator={false}
            renderItem={
              viewMode === "grid3"
                ? renderGrid3Item
                : viewMode === "grid2"
                ? renderGrid2Item
                : renderSingleItem
            }
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isFetchingNextPage ? (
                <ActivityIndicator color={theme.accent} style={{ margin: 20 }} />
              ) : null
            }
          />
        ) : (
          <EmptyState
            emoji="📸"
            title="Ortak anı duvarınız henüz bembeyaz"
            description="Birlikte çekildiğiniz en sevdiğiniz fotoğrafı ekleyerek başlayın."
            ctaLabel="İlk Fotoğrafı Seç 📸"
            onPressCta={goToUpload}
            theme={theme}
            style={styles.emptyState}
          />
        )}
      </View>

      {/* ─── ULTRA MODERN TAM EKRAN LIGHTBOX MODALI ─── */}
      <PhotoLightboxModal
        selectedIndex={selectedIndex}
        photos={photos}
        userId={userId}
        theme={theme}
        onClose={() => setSelectedIndex(null)}
        onPrev={handlePrevPhoto}
        onNext={handleNextPhoto}
        onDelete={handleDelete}
      />

      {/* Premium Paywall */}
      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName="Fotoğraf Galerisi"
      />
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 12,
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

    /* KONTROL ÇUBUĞU */
    controlBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginHorizontal: 16,
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 18,
      borderWidth: 1,
    },
    uploadQuickBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
    },
    uploadQuickBtnText: {
      color: "#ffffff",
      fontSize: 13,
      fontFamily: "Inter_700Bold",
    },
    sortBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 12,
    },
    sortBtnText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
    },
    viewModePills: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
      padding: 3,
      borderRadius: 14,
      gap: 4,
    },
    viewModeBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },

    /* LİSTE BOŞLUKLARI */
    listContent: {
      paddingHorizontal: 16,
    },
    grid3ListGap: {
      gap: 6,
    },
    grid2ListGap: {
      gap: 10,
    },
    singleListGap: {
      gap: 16,
    },

    /* BOŞ DURUM */
    emptyState: {
      marginHorizontal: 20,
    },
  });
};
