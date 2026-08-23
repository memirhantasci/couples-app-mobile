import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, FlatList } from "react-native";
import { Image } from "expo-image";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { dayjs } from "@/lib/date";
import { Plus, Trash2, Pencil, Menu, ChevronLeft, PlusCircle, AlignJustify } from "lucide-react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTheme } from "@/lib/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function MemoriesScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const insets = useSafeAreaInsets();

  const coupleId = profile?.coupleId || null;
  const theme = getTheme(profile?.gender);
  const PAGE_SIZE = 15;

  useEffect(() => {
    async function addDefaultMemories() {
      if (!coupleId) return;
      const key = `default_memories_added_${coupleId}`;
      const added = await AsyncStorage.getItem(key);
      if (added) return;

      const memoriesToInsert = [];
      if (profile?.meetDate) {
        memoriesToInsert.push({
          couple_id: coupleId,
          title: "Tanışma Yıl Dönümümüz",
          date: profile.meetDate,
          description: "Hikayemizin başladığı o güzel gün...",
          is_default: false,
        });
      }
      if (profile?.relationshipStartDate) {
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
      }
      await AsyncStorage.setItem(key, "true");
      queryClient.invalidateQueries({ queryKey: ["memories"] });
    }

    addDefaultMemories();
  }, [coupleId, profile]);

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
        <View style={[styles.dateCircle, { borderColor: theme.accent, backgroundColor: theme.cardBg }]}>
          <Text style={[styles.dateNumber, { color: theme.accent }]}>{index + 1}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{memory.title}</Text>
              <Text style={[styles.cardYear, { color: theme.accent }]}>{d.locale("tr").format("D MMMM YYYY")}</Text>
            </View>
            
            {canManage && (
              <Animated.View entering={FadeInUp.duration(150)} style={styles.actionsBox}>
                <TouchableOpacity onPress={() => handleEdit(memory)}>
                  <Pencil size={18} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(memory.id)} disabled={deletingId === memory.id}>
                  {deletingId === memory.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Trash2 size={18} color="rgba(255,255,255,0.5)" />
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>

          {memory.description ? (
            <Text style={styles.cardDesc}>{memory.description}</Text>
          ) : null}

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
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.title}>Özel Günler</Text>
              <Text style={{ fontSize: 24 }}>❤️</Text>
            </View>
            <Text style={[styles.subtitle, { marginTop: 4 }]}>En tatlı anılarımızın milatları</Text>
          </View>
          
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TouchableOpacity 
              style={[styles.editBtn, { backgroundColor: theme.cardBg }]}
              onPress={() => setIsEditMode(!isEditMode)}
            >
              <Text style={styles.editBtnText}>{isEditMode ? "Bitti" : "Düzenle"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <AlignJustify color="rgba(255,255,255,0.7)" size={22} />
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
        <View style={styles.emptyBox}>
          <Text style={{ fontSize: 48 }}>📸</Text>
          <Text style={styles.emptyText}>Henüz anı eklenmedi</Text>
        </View>
      ) : (
        <View style={styles.timelineContainer}>
          {/* Vertical line matching the screenshot (very dark burgundy or theme.unitBg with opacity) */}
          <View style={[styles.timelineLine, { backgroundColor: theme.unitBg }]} />

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
            ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color={theme.accent} style={{ margin: 20 }} /> : null}
          />
        </View>
      )}

      {/* Add Button is only visible in Edit Mode */}
      {isEditMode && (
        <Animated.View entering={FadeInUp.duration(250)} style={styles.addBtnContainer}>
          <TouchableOpacity 
            style={[styles.addBtn, { backgroundColor: theme.accent }]}
            onPress={() => router.push("/(tabs)/add-memory")}
            activeOpacity={0.8}
          >
            <PlusCircle size={20} color="#fff" />
            <Text style={styles.addBtnText}>Yeni Özel Gün Ekle</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 34,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    color: "#fff",
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  editBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  editBtnText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
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
    fontFamily: "Inter_400Regular",
    marginTop: 12,
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
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  cardYear: {
    fontSize: 13,
    marginTop: 4,
    fontFamily: "Inter_600SemiBold",
  },
  cardDesc: {
    color: "rgba(255,255,255,0.5)",
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
