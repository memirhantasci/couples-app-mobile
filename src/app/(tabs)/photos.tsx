import React, { useState, useMemo } from "react";
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, Alert, Modal, Dimensions, StatusBar 
} from "react-native";
import { Image } from "expo-image";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { 
  ChevronLeft, Plus, Trash2, Calendar, 
  AlignJustify, Camera, Clock, X, Maximize2,
  Grid3X3, Grid2X2, Square, ChevronRight, Sparkles, Eye, Crown, Check
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { dayjs } from "@/lib/date";
import { getTheme } from "@/lib/theme";
import { PremiumPaywall } from "@/components/ui/PremiumPaywall";

interface PhotoItem {
  id: number;
  image_url: string;
  taken_date: string;
  taken_time?: string | null;
  title?: string | null;
  description?: string | null;
  user_id: string;
  created_at?: string;
}

type ViewMode = "grid3" | "grid2" | "single";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function PhotosScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const theme = getTheme(profile?.gender);

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;
  const isPremium = profile?.isPremium ?? false;
  const [showPaywall, setShowPaywall] = useState(false);

  // Görünüm Modu: 2'li (varsayılan dengeli), 3'lü (kompakt hızlı gezinti), single (büyük kartlar)
  const [viewMode, setViewMode] = useState<ViewMode>("grid2");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const PAGE_SIZE = 30;

  // Fotoğrafları sayfalama (pagination) ile çek
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching
  } = useInfiniteQuery({
    queryKey: ["photo_archive", coupleId],
    enabled: !!coupleId,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase
        .from("photo_archive")
        .select("id, image_url, taken_date, taken_time, title, description, user_id, created_at")
        .eq("couple_id", coupleId)
        .order("taken_date", { ascending: false })
        .order("created_at", { ascending: false })
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
    router.push("/(tabs)/add-photo");
  };

  // Fotoğraf Sil
  const handleDelete = (id: number) => {
    Alert.alert("Fotoğrafı Sil", "Bu fotoğrafı galeriden kalıcı olarak silmek istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          if (currentPhoto?.id === id) {
            setSelectedIndex(null);
          }
          const { error } = await supabase.from("photo_archive").delete().eq("id", id);
          if (error) {
            Alert.alert("Hata", "Fotoğraf silinirken bir hata oluştu.");
          } else {
            queryClient.invalidateQueries({ queryKey: ["photo_archive", coupleId] });
            queryClient.invalidateQueries({ queryKey: ["calendar_data"] });
          }
        }
      }
    ]);
  };

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

  // ─── 3 SÜTUNLU KOMPAKT IZGARA RENDER ─────────────────────────────────────
  const renderGrid3Item = ({ item, index }: { item: PhotoItem; index: number }) => {
    const itemSize = (SCREEN_WIDTH - 32 - 12) / 3;
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setSelectedIndex(index)}
        style={[styles.grid3Box, { width: itemSize, height: itemSize }]}
      >
        <Image source={{ uri: item.image_url }} style={styles.grid3Img} contentFit="cover" />
      </TouchableOpacity>
    );
  };

  // ─── 2 SÜTUNLU MODERN ESTETİK KART RENDER ────────────────────────────────
  const renderGrid2Item = ({ item, index }: { item: PhotoItem; index: number }) => {
    const itemWidth = (SCREEN_WIDTH - 32 - 10) / 2;
    const isMine = item.user_id === userId;

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setSelectedIndex(index)}
        style={[
          styles.grid2Card, 
          { width: itemWidth, backgroundColor: theme.cardBg, borderColor: theme.cardBorder }
        ]}
      >
        <View style={styles.grid2ImgContainer}>
          <Image source={{ uri: item.image_url }} style={styles.grid2Img} contentFit="cover" />
          
          <View style={styles.grid2ExpandBadge}>
            <Maximize2 size={11} color="#ffffff" />
          </View>
        </View>

        <View style={styles.grid2Details}>
          <Text style={styles.grid2Date} numberOfLines={1}>
            {dayjs(item.taken_date).locale("tr").format("D MMM YYYY")}
          </Text>

          {item.title ? (
            <Text style={styles.grid2Title} numberOfLines={1}>
              {item.title}
            </Text>
          ) : (
            <Text style={styles.grid2EmptySub}>Özel Hatıra ✨</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ─── 1 SÜTUNLU BÜYÜK HİKAYE KARTI RENDER ─────────────────────────────────
  const renderSingleItem = ({ item, index }: { item: PhotoItem; index: number }) => {
    const isMine = item.user_id === userId;
    const hasInfo = Boolean(item.title?.trim() || item.description?.trim());

    return (
      <View style={[styles.singleCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        {/* Üst Bilgi Barı */}
        <View style={styles.singleHeader}>
          <View style={styles.singleDateBadge}>
            <Calendar size={13} color={theme.accent} />
            <Text style={styles.singleDateText}>
              {dayjs(item.taken_date).locale("tr").format("DD MMMM YYYY")}
            </Text>
            {item.taken_time ? (
              <>
                <Text style={styles.dotSeparator}>•</Text>
                <Clock size={12} color="rgba(255,255,255,0.6)" />
                <Text style={styles.singleTimeText}>{item.taken_time.substring(0, 5)}</Text>
              </>
            ) : null}
          </View>
          
          {isMine && (
            <TouchableOpacity 
              style={styles.deleteBtn} 
              onPress={() => handleDelete(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 color="#ff5c77" size={15} />
            </TouchableOpacity>
          )}
        </View>

        {/* Fotoğraf Görseli (Tıklanınca Tam Ekran) */}
        <TouchableOpacity 
          activeOpacity={0.92} 
          onPress={() => setSelectedIndex(index)}
          style={styles.singleTouchable}
        >
          <Image source={{ uri: item.image_url }} style={styles.singleImg} contentFit="cover" />
          <View style={styles.singleExpandBadge}>
            <Maximize2 size={13} color="#ffffff" />
          </View>
        </TouchableOpacity>

        {/* Başlık ve Açıklama Alanı */}
        {hasInfo ? (
          <View style={styles.singleInfoBox}>
            {item.title ? (
              <Text style={styles.singleTitle} numberOfLines={2}>
                {item.title}
              </Text>
            ) : null}
            {item.description ? (
              <Text style={styles.singleDescription}>
                {item.description}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const numColumns = viewMode === "grid3" ? 3 : viewMode === "grid2" ? 2 : 1;

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft color="#ffffff" size={24} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Ortak Galeri</Text>
            <Text style={styles.headerSubtitle}>
              {photos.length > 0 ? `${photos.length} Ortak Hatıra 📸` : "Aşk Arşivimiz 📸"}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity 
              onPress={goToUpload} 
              style={[styles.headerBtn, { backgroundColor: theme.cardBg }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Camera color={theme.accent} size={19} />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push("/menu")} 
              style={styles.headerBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AlignJustify color="rgba(255,255,255,0.75)" size={20} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── KONTROL ÇUBUĞU (GÖRÜNÜM SEÇİCİ & YENİ YÜKLE) ─── */}
        <View style={[styles.controlBar, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
          {/* Hızlı Yükle Butonu */}
          <TouchableOpacity 
            style={[styles.uploadQuickBtn, { backgroundColor: theme.accent }]}
            onPress={goToUpload}
            activeOpacity={0.85}
          >
            <Plus size={16} color="#ffffff" />
            <Text style={styles.uploadQuickBtnText}>Fotoğraf Ekle</Text>
          </TouchableOpacity>

          {/* Görünüm Modları: 3'lü, 2'li, 1'li */}
          <View style={styles.viewModePills}>
            <TouchableOpacity 
              style={[styles.viewModeBtn, viewMode === "grid3" && { backgroundColor: theme.unitBg }]}
              onPress={() => setViewMode("grid3")}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Grid3X3 size={16} color={viewMode === "grid3" ? theme.accent : "rgba(255,255,255,0.4)"} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.viewModeBtn, viewMode === "grid2" && { backgroundColor: theme.unitBg }]}
              onPress={() => setViewMode("grid2")}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Grid2X2 size={16} color={viewMode === "grid2" ? theme.accent : "rgba(255,255,255,0.4)"} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.viewModeBtn, viewMode === "single" && { backgroundColor: theme.unitBg }]}
              onPress={() => setViewMode("single")}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Square size={16} color={viewMode === "single" ? theme.accent : "rgba(255,255,255,0.4)"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* FOTOĞRAF LİSTESİ */}
        {!isPremium ? (
          <View style={[styles.luxuryLockCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={[styles.luxuryLockIconBox, { backgroundColor: theme.pillAccentBg }]}>
              <Crown color={theme.accent} size={32} />
            </View>

            <View style={styles.vipBadge}>
              <Sparkles size={13} color="#ffd700" />
              <Text style={styles.vipBadgeText}>VIP ÇİFT AYRICALIĞI</Text>
            </View>

            <Text style={styles.luxuryLockTitle}>Ortak Galeri ve Anı Arşivi</Text>
            <Text style={styles.luxuryLockDesc}>
              Birlikte çektiğiniz fotoğrafları ortak bir bulutta sınırsızca saklayın, tarihleriyle ölümsüzleştirin.
            </Text>

            <View style={styles.perksList}>
              <View style={styles.perkItem}>
                <View style={styles.perkBullet}>
                  <Check size={12} color="#22c55e" strokeWidth={3} />
                </View>
                <Text style={styles.perkText}>Sınırsız yüksek kaliteli ortak fotoğraf yükleme</Text>
              </View>
              <View style={styles.perkItem}>
                <View style={styles.perkBullet}>
                  <Check size={12} color="#22c55e" strokeWidth={3} />
                </View>
                <Text style={styles.perkText}>3 farklı ızgara (Grid) görünümü ve tam ekran lightbox</Text>
              </View>
              <View style={styles.perkItem}>
                <View style={styles.perkBullet}>
                  <Check size={12} color="#22c55e" strokeWidth={3} />
                </View>
                <Text style={styles.perkText}>Aşk takviminde fotoğraflı gün hatıraları</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.upgradeBtn, { backgroundColor: theme.accent }]}
              onPress={() => setShowPaywall(true)}
              activeOpacity={0.88}
            >
              <Crown color="#ffffff" size={17} />
              <Text style={styles.upgradeBtnText}>Ayrıcalıkları Keşfet ✨</Text>
            </TouchableOpacity>
          </View>
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
            keyExtractor={(item) => item.id.toString()}
            numColumns={numColumns}
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
          <View style={[styles.emptyBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Text style={{ fontSize: 42, marginBottom: 12 }}>📸</Text>
            <Text style={styles.emptyTitle}>Galeriniz Henüz Boş</Text>
            <Text style={styles.emptyText}>
              Birlikte geçirdiğiniz özel anları ölümsüzleştirmek için ilk fotoğrafınızı yükleyin.
            </Text>
            <TouchableOpacity 
              style={[styles.emptyBtn, { backgroundColor: theme.accent }]}
              onPress={goToUpload}
            >
              <Camera size={16} color="#ffffff" />
              <Text style={styles.emptyBtnText}>İlk Fotoğrafı Yükle 📸</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ─── ULTRA MODERN TAM EKRAN LIGHTBOX MODALI ─── */}
      <Modal
        visible={selectedIndex !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedIndex(null)}
      >
        <View style={styles.lightboxBackdrop}>
          <StatusBar hidden />

          {/* Lightbox Üst Bar */}
          <View style={[styles.lightboxHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity 
              onPress={() => setSelectedIndex(null)}
              style={styles.lightboxCloseBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color="#ffffff" />
            </TouchableOpacity>

            {/* Sayaç (Örn: 5 / 48) */}
            {selectedIndex !== null && (
              <View style={styles.lightboxCounterBadge}>
                <Text style={styles.lightboxCounterText}>
                  {selectedIndex + 1} / {photos.length}
                </Text>
              </View>
            )}

            {currentPhoto?.user_id === userId ? (
              <TouchableOpacity 
                onPress={() => currentPhoto && handleDelete(currentPhoto.id)}
                style={styles.lightboxDeleteBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Trash2 size={18} color="#ff5c77" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {/* Tam Ekran Fotoğraf Alanı & İleri/Geri Okları */}
          <View style={styles.lightboxMainArea}>
            {/* Önceki Fotoğraf Butonu */}
            {selectedIndex !== null && selectedIndex > 0 ? (
              <TouchableOpacity 
                style={styles.lightboxNavLeftBtn}
                onPress={handlePrevPhoto}
                activeOpacity={0.8}
              >
                <ChevronLeft size={24} color="#ffffff" />
              </TouchableOpacity>
            ) : null}

            {currentPhoto && (
              <Image 
                source={{ uri: currentPhoto.image_url }} 
                style={styles.lightboxImg} 
                contentFit="contain" 
              />
            )}

            {/* Sonraki Fotoğraf Butonu */}
            {selectedIndex !== null && selectedIndex < photos.length - 1 ? (
              <TouchableOpacity 
                style={styles.lightboxNavRightBtn}
                onPress={handleNextPhoto}
                activeOpacity={0.8}
              >
                <ChevronRight size={24} color="#ffffff" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Alt Detay Kartı (Tarih, Başlık, Açıklama) */}
          {currentPhoto && (
            <View style={[styles.lightboxFooter, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.lightboxDateRow}>
                <View style={styles.lightboxDatePill}>
                  <Calendar size={13} color={theme.accent} />
                  <Text style={[styles.lightboxDateText, { color: theme.accent }]}>
                    {dayjs(currentPhoto.taken_date).locale("tr").format("DD MMMM YYYY")}
                  </Text>
                  {currentPhoto.taken_time ? (
                    <>
                      <Text style={{ color: "rgba(255,255,255,0.4)" }}>•</Text>
                      <Clock size={12} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.lightboxTimeText}>{currentPhoto.taken_time.substring(0, 5)}</Text>
                    </>
                  ) : null}
                </View>
              </View>

              {currentPhoto.title ? (
                <Text style={styles.lightboxTitle}>{currentPhoto.title}</Text>
              ) : null}

              {currentPhoto.description ? (
                <Text style={styles.lightboxDesc}>{currentPhoto.description}</Text>
              ) : null}
            </View>
          )}
        </View>
      </Modal>

      {/* Premium Paywall */}
      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName="Fotoğraf Galerisi"
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
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
    color: "#ffffff",
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
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
  viewModePills: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
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

  /* 3 SÜTUNLU IZGARA */
  grid3Box: {
    borderRadius: 14,
    overflow: "hidden",
    margin: 3,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  grid3Img: {
    width: "100%",
    height: "100%",
  },

  /* 2 SÜTUNLU KART */
  grid2Card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 10,
    marginRight: 10,
  },
  grid2ImgContainer: {
    width: "100%",
    aspectRatio: 1,
    position: "relative",
  },
  grid2Img: {
    width: "100%",
    height: "100%",
  },
  grid2ExpandBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  grid2Details: {
    padding: 10,
  },
  grid2Date: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.5)",
  },
  grid2Title: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    marginTop: 2,
  },
  grid2EmptySub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
    marginTop: 2,
  },

  /* 1 SÜTUNLU TEK KART */
  singleCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    padding: 14,
  },
  singleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  singleDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  singleDateText: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  dotSeparator: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
  },
  singleTimeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  deleteBtn: {
    backgroundColor: "rgba(255, 92, 119, 0.12)",
    padding: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 92, 119, 0.25)",
  },
  singleTouchable: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  singleImg: {
    width: "100%",
    height: "100%",
  },
  singleExpandBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  singleInfoBox: {
    paddingTop: 12,
  },
  singleTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    marginBottom: 4,
  },
  singleDescription: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 20,
  },

  /* BOŞ DURUM */
  emptyBox: {
    margin: 20,
    padding: 30,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 18,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  emptyBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },

  /* ─── LÜKS KİLİT KARTI (PREMIUMSIZ) ─── */
  luxuryLockCard: {
    margin: 16,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  luxuryLockIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  vipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 215, 0, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 12,
  },
  vipBadgeText: {
    color: "#ffd700",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  luxuryLockTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    textAlign: "center",
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  luxuryLockDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  perksList: {
    width: "100%",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 20,
  },
  perkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  perkBullet: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  perkText: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.85)",
    flex: 1,
  },
  upgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    height: 48,
    borderRadius: 16,
  },
  upgradeBtnText: {
    color: "#ffffff",
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },

  /* ─── LIGHTBOX MODAL ─── */
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "space-between",
  },
  lightboxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 10,
    zIndex: 10,
  },
  lightboxCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxCounterBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  lightboxCounterText: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  lightboxDeleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,92,119,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxMainArea: {
    flex: 1,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxImg: {
    width: "100%",
    height: "100%",
  },
  lightboxNavLeftBtn: {
    position: "absolute",
    left: 12,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxNavRightBtn: {
    position: "absolute",
    right: 12,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    gap: 6,
  },
  lightboxDateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  lightboxDatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  lightboxDateText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  lightboxTimeText: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
  lightboxTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  lightboxDesc: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 19,
  },
});
