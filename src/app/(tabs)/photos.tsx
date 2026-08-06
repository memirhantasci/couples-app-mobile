import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { ChevronLeft, Plus, Image as ImageIcon, Trash2, Calendar, Menu } from "lucide-react-native";
import { useRouter } from "expo-router";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { dayjs, todayString } from "@/lib/date";

export default function PhotosScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  // Fotoğrafları çek
  const { data: photos, isLoading } = useQuery({
    queryKey: ["photo_archive", coupleId],
    enabled: !!coupleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("photo_archive")
        .select("id, image_url, taken_date, user_id")
        .eq("couple_id", coupleId)
        .order("taken_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

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
        <Image source={{ uri: item.image_url }} style={styles.photo} />
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
    <LinearGradient colors={["#0a0a0f", "#0A0A0C", "#080811"]} style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color="#fff" size={28} />
        </TouchableOpacity>
        <Text style={styles.title}>Ortak Galeri 📸</Text>
        <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8 }}>
          <Menu color="#fff" size={24} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#E8002D" size="large" />
        </View>
      ) : photos && photos.length > 0 ? (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={{ padding: 10, paddingBottom: 130 }}
          renderItem={renderPhoto}
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backBtn: {
    marginRight: 15,
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
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
