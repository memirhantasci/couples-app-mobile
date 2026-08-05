import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Image as RNImage, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dayjs } from "@/lib/date";
import { Trash2, Plus, Pencil } from "lucide-react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

export default function MemoriesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const coupleId = session?.user?.user_metadata?.couple_id || session?.couple_id;

  const { data: memories, isLoading } = useQuery({
    queryKey: ["memories", coupleId],
    enabled: !!coupleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memories")
        .select("id, date, title, description, image_url, is_default")
        .eq("couple_id", coupleId)
        .order("date", { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

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
      pathname: "/add-memory",
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

  return (
    <LinearGradient colors={["#080811", "#0A0A0C", "#080811"]} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Özel Günler ❤️</Text>
          <TouchableOpacity 
            style={styles.editBtn}
            onPress={() => setIsEditMode(!isEditMode)}
          >
            <Text style={styles.editBtnText}>{isEditMode ? "Bitti" : "Düzenle"}</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#E8002D" style={{ marginTop: 40 }} />
        ) : memories?.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 48 }}>📸</Text>
            <Text style={styles.emptyText}>Henüz anı eklenmedi</Text>
          </View>
        ) : (
          <View style={styles.timelineContainer}>
            {/* Vertical glowing line */}
            <View style={styles.timelineLine} />

            <View style={{ flex: 1 }}>
              {memories?.map((memory, index) => {
                const d = dayjs(memory.date);
                const canManage = isEditMode && !memory.is_default;
                
                return (
                  <Animated.View 
                    key={memory.id}
                    entering={FadeInDown.delay(index * 60).duration(350)}
                    style={styles.memoryRow}
                  >
                    {/* Date Circle */}
                    <View style={styles.dateCircle}>
                      <Text style={styles.dateDay}>{d.format("DD")}</Text>
                      <Text style={styles.dateMonth}>{d.format("MMM")}</Text>
                    </View>

                    {/* Card */}
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
                          <RNImage source={{ uri: memory.image_url }} style={styles.image} />
                        </View>
                      )}
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        )}

        {isEditMode && (
          <Animated.View entering={FadeInUp.duration(250)} style={styles.addBtnContainer}>
            <TouchableOpacity 
              style={styles.addBtn}
              onPress={() => router.push("/add-memory")}
              activeOpacity={0.8}
            >
              <Plus size={18} color="#fff" strokeWidth={2.5} />
              <Text style={styles.addBtnText}>Yeni Özel Gün Ekle</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 120,
    minHeight: "100%",
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  editBtn: {
    alignSelf: "flex-end",
    backgroundColor: "#311822",
    paddingVertical: 10,
    paddingHorizontal: 24,
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
  },
  timelineLine: {
    position: "absolute",
    left: 23,
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
    alignItems: "center",
    gap: 16,
    paddingVertical: 12,
  },
  dateCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0A0A0C",
    borderWidth: 2,
    borderColor: "#FF2D55",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    shadowColor: "#FF2D55",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  dateDay: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
    lineHeight: 16,
  },
  dateMonth: {
    fontSize: 11,
    fontWeight: "500",
    color: "#fff",
    lineHeight: 14,
  },
  card: {
    flex: 1,
    minHeight: 90,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#1C1C1E", // Will use gradient ideally, but solid for now
    borderWidth: 1,
    borderColor: "#FF2D55",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  cardYear: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.9)",
  },
  actionsBox: {
    flexDirection: "row",
    gap: 16,
    marginLeft: 8,
  },
  actionBtn: {
    padding: 4,
  },
  imageBox: {
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 16,
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  addBtnContainer: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FF3B30",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  }
});
