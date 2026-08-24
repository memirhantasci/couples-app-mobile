import React, { useCallback,  useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Image } from "expo-image";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { ChevronLeft, Plus, Image as ImageIcon, Trash2, Calendar, Menu, AlignJustify, Camera } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { dayjs, todayString } from "@/lib/date";
import { getTheme } from "@/lib/theme";
import { PremiumPaywall } from "@/components/ui/PremiumPaywall";

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

  const PAGE_SIZE = 20;

  // Fotoğrafları sayfalama (pagination) ile çek
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ["photo_archive", coupleId],
    enabled: !!coupleId,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase
        .from("photo_archive")
        .select("id, image_url, taken_date, user_id")
        .eq("couple_id", coupleId)
        .order("taken_date", { ascending: false })
        .order("created_at", { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      return data || [];
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
    },
    staleTime: 1000 * 60 * 5,
  });

  const photos = data ? data.pages.flat() : [];

  // Fotoğraf Yükle sayfasına yönlendir
  const goToUpload = () => {
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    router.push("/(tabs)/add-photo");
  };

  // Fotoğraf Sil
  const handleDelete = (id: number) => {
    Alert.alert("Fotoğrafı Sil", "Bu fotoğrafı silmek istediğine emin misin?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
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

  const renderPhoto = ({ item }: { item: any }) => {
    const isMine = item.user_id === userId;
    return (
      <View style={[styles.photoWrapper, { backgroundColor: theme.cardBg }]}>
        <View style={styles.photoHeader}>
          <Text style={styles.photoDate}>{dayjs(item.taken_date).locale("tr").format("DD MMMM YYYY")}</Text>
          {isMine && (
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
              <Trash2 color="#fff" size={16} />
            </TouchableOpacity>
          )}
        </View>
        <Image source={{ uri: item.image_url }} style={styles.photo} contentFit="cover" />
      </View>
    );
  };

  if (!session) return <View style={{ flex: 1, backgroundColor: "#0a0a0f" }} />;



  return (
    <ScreenBackground>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, paddingTop: insets.top + 16, paddingHorizontal: 20 }}>
        <View style={{ width: 40 }} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ fontSize: 28, fontFamily: "PlayfairDisplay_400Regular_Italic", color: "#fff" }}>
            Ortak Galeri 📸
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={goToUpload} style={{ padding: 8, borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: theme.cardBg }}>
            <Camera color="rgba(255,255,255,0.7)" size={20} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" }}>
            <AlignJustify color="rgba(255,255,255,0.7)" size={22} />
          </TouchableOpacity>
        </View>
      </View>

      {!isPremium ? (
        <View style={styles.premiumOverlay}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🔒</Text>
          <Text style={styles.premiumTitle}>Premium Özellik</Text>
          <Text style={styles.premiumDesc}>
            Ortak Galeri'ye erişmek ve anılarınızı saklamak için Premium'a geçmelisiniz.
          </Text>
          <TouchableOpacity 
            style={[styles.premiumBtn, { backgroundColor: theme.accent }]}
            onPress={() => setShowPaywall(true)}
          >
            <Text style={styles.premiumBtnText}>Detayları Gör</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 10, justifyContent: 'space-between' }}>
          <Skeleton height={200} borderRadius={16} style={{ width: '48%', marginBottom: 10 }} />
          <Skeleton height={200} borderRadius={16} style={{ width: '48%', marginBottom: 10 }} />
          <Skeleton height={200} borderRadius={16} style={{ width: '48%', marginBottom: 10 }} />
          <Skeleton height={200} borderRadius={16} style={{ width: '48%', marginBottom: 10 }} />
        </View>
      ) : photos && photos.length > 0 ? (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id.toString()}
          numColumns={1}
          contentContainerStyle={{ padding: 10, paddingBottom: 130 }}
          renderItem={renderPhoto}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#E8002D" style={{ margin: 20 }} /> : null}
        />
      ) : (
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 40, marginBottom: 10 }}>📸</Text>
          <Text style={styles.emptyText}>Henüz hiç fotoğraf yüklemediniz.</Text>
        </View>
      )}

      {/* Premium Paywall */}
      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName="Fotoğraf Galerisi"
        featureDescription="Fotoğraflarınızı birlikte yükleyin, düzenleyin ve saklayın."
        gender={profile?.gender}
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
    paddingBottom: 20,
  },
  backBtn: {
    padding: 5,
    marginLeft: -5,
  },
  title: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    color: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  photoWrapper: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
    padding: 16,
    paddingBottom: 20,
  },
  photoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  photoDate: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
  },
  photo: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
  },
  deleteBtn: {
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 6,
    borderRadius: 20,
  },
  fab: {
    position: "absolute",
    bottom: 110,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  emptyBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  premiumOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  premiumTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  premiumDesc: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  premiumBtn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  premiumBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  }
});
