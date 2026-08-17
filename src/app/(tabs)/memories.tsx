import React, { useCallback,  useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, FlatList } from "react-native";
import { Image } from "expo-image";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { dayjs } from "@/lib/date";
import { Plus, Trash2, Pencil, Menu, ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MemoriesScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const insets = useSafeAreaInsets();

  const coupleId = profile?.coupleId || null;
  const PAGE_SIZE = 15;

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch
  } = useInfiniteQuery({
    queryKey: ["memories", coupleId],
    enabled: !!coupleId,
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase
        .from("memories")
        .select("id, date, title, description, image_url, is_default")
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
    Alert.alert(
      "Anıyı Sil",
      "Bu özel günü silmek istediğine emin misin?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            setDeletingId(id);
            const { error } = await supabase.from("memories").delete().eq("id", id);
            setDeletingId(null);
            if (!error) {
              queryClient.invalidateQueries({ queryKey: ["memories"] });
            } else {
              Alert.alert("Hata", "Silinirken bir hata oluştu.");
            }
          }
        }
      ]
    );
  };

  const handleEdit = (memory: any) => {
    router.push({
      pathname: "/(tabs)/add-memory",
      params: { 
        id: memory.id, 
        title: memory.title, 
        date: memory.date, 
        description: memory.description || "", 
        image_url: memory.image_url || "" 
      }
    });
  };

  if (!session) return <View style={{ flex: 1, backgroundColor: "#080811" }} />;



  const renderMemory = ({ item: memory, index }: { item: any, index: number }) => {
    const d = dayjs(memory.date);
    const canManage = isEditMode && !memory.is_default;
    
    return (
      <Animated.View 
        key={memory.id}
        entering={FadeInDown.delay(index * 60).duration(350)}
        style={styles.memoryRow}
      >
        <View style={styles.dateCircle}>
          <Text style={styles.dateDay}>{d.format("DD")}</Text>
          <Text style={styles.dateMonth}>{d.format("MMM")}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{memory.title}</Text>
              <Text style={styles.cardYear}>{d.format("YYYY")}</Text>
            </View>
            
            {canManage && (
              <Animated.View entering={FadeInUp.duration(150)} style={styles.actionsBox}>
                <TouchableOpacity onPress={() => handleEdit(memory)} style={styles.actionBtn}>
                  <Pencil size={18} color="#fff" strokeWidth={2.5} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(memory.id)} style={styles.actionBtn} disabled={deletingId === memory.id}>
                  {deletingId === memory.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Trash2 size={18} color="#fff" strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>

          {memory.image_url && (
            <View style={styles.imageBox}>
              <Image source={{ uri: memory.image_url }} style={styles.image} contentFit="cover" />
            </View>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <ScreenBackground>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
            <ChevronLeft color="#fff" size={28} />
          </TouchableOpacity>
          <Text style={[styles.title, { flex: 1, textAlign: "center" }]} numberOfLines={1}>Özel Günler ❤️</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity 
              style={[styles.editBtn, { marginRight: 8 }]}
              onPress={() => setIsEditMode(!isEditMode)}
            >
              <Text style={styles.editBtnText}>{isEditMode ? "Bitti" : "Düzenle"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, marginRight: -8 }}>
              <Menu color="#fff" size={24} />
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={{ gap: 16, marginTop: 40, paddingHorizontal: 20 }}>
            <Skeleton height={150} borderRadius={16} />
            <Skeleton height={150} borderRadius={16} />
          </View>
        ) : memories?.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 48 }}>📸</Text>
            <Text style={styles.emptyText}>Henüz anı eklenmedi</Text>
          </View>
        ) : (
          <View style={styles.timelineContainer}>
            {/* Vertical glowing line */}
            <View style={styles.timelineLine} />

            <FlatList
              data={memories}
              keyExtractor={item => item.id.toString()}
              renderItem={renderMemory}
              contentContainerStyle={{ paddingBottom: 150 }}
              showsVerticalScrollIndicator={false}
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  fetchNextPage();
                }
              }}
              onEndReachedThreshold={0.5}
              ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#E8002D" style={{ margin: 20 }} /> : null}
            />
          </View>
        )}

        {isEditMode && (
          <Animated.View entering={FadeInUp.duration(250)} style={styles.addBtnContainer}>
            <TouchableOpacity 
              style={styles.addBtn}
              onPress={() => router.push("/(tabs)/add-memory")}
              activeOpacity={0.8}
            >
              <Plus size={18} color="#fff" strokeWidth={2.5} />
              <Text style={styles.addBtnText}>Yeni Özel Gün Ekle</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
  },
  editBtn: {
    backgroundColor: "#311822",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  editBtnText: {
    color: "#E5B9C5",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.1)",
  },
  emptyText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    marginTop: 12,
  },
  timelineContainer: {
    flex: 1,
    position: "relative",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  timelineLine: {
    position: "absolute",
    left: 40,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: "#FF2D55",
    shadowColor: "#FF2D55",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 0,
  },
  memoryRow: {
    flexDirection: "row",
    marginBottom: 24,
    alignItems: "flex-start",
    zIndex: 1,
  },
  dateCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FF2D55",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderWidth: 3,
    borderColor: "#080811",
    shadowColor: "#FF2D55",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 8,
  },
  dateDay: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 20,
  },
  dateMonth: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  card: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cardYear: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  actionsBox: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 8,
    borderRadius: 12,
  },
  imageBox: {
    marginTop: 10,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  image: {
    width: "100%",
    height: 180,
    resizeMode: "cover",
  },
  addBtnContainer: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
  },
  addBtn: {
    backgroundColor: "#FF2D55",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    shadowColor: "#FF2D55",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
