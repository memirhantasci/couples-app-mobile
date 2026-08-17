import React, { useCallback,  useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Image } from "expo-image";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { ChevronLeft, Plus, Image as ImageIcon, Trash2, Calendar, Menu } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { dayjs, todayString } from "@/lib/date";

export default function PhotosScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;

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
      <View style={styles.photoWrapper}>
        <Image source={{ uri: item.image_url }} style={styles.photo} contentFit="cover" />
        {isMine && (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
            <Trash2 color="#fff" size={16} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!session) return <View style={{ flex: 1, backgroundColor: "#0a0a0f" }} />;



  return (
    <ScreenBackground>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color="#fff" size={28} />
        </TouchableOpacity>
        <Text style={styles.title}>Ortak Galeri 📸</Text>
        <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8 }}>
          <Menu color="#fff" size={24} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
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
          numColumns={2}
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

      {/* Floating Add Button */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={goToUpload}
      >
        <Plus color="#fff" size={20} />
        <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}>Fotoğraf Yükle</Text>
      </TouchableOpacity>
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
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  photoWrapper: {
    flex: 1,
    margin: 5,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  photo: {
    width: "100%",
    aspectRatio: 1,
  },
  deleteBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 6,
    borderRadius: 20,
  },
  fab: {
    position: "absolute",
    bottom: 110,
    right: 20,
    height: 50,
    paddingHorizontal: 20,
    flexDirection: "row",
    borderRadius: 25,
    backgroundColor: "#E8002D",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#E8002D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
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
});
