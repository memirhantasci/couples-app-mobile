import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  Modal,
  TextInput
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { encrypt, decrypt } from "@/utils/crypto";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { ChevronLeft, Edit3, Trash2, BookOpen, Menu, Check } from "lucide-react-native";
import { useRouter } from "expo-router";

dayjs.locale("tr");

interface DailyNote {
  id: number;
  date: string;
  content: string;
}

export default function DailyNotesScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingNote, setEditingNote] = useState<DailyNote | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: notes = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["daily_notes_history", userId],
    enabled: !!userId,
    queryFn: async (): Promise<DailyNote[]> => {
      const { data, error } = await supabase
        .from("daily_notes")
        .select("id, date, content")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      if (error) throw error;

      return (data ?? []).map((n: any) => ({
        ...n,
        content: (() => {
          try {
            return decrypt(n.content);
          } catch {
            return n.content;
          }
        })(),
      }));
    },
  });

  const handleDelete = async (id: number) => {
    Alert.alert("Günlüğü Sil", "Bu günlük kaydını silmek istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("daily_notes").delete().eq("id", id);
          if (error) {
            Alert.alert("Hata", "Günlük silinirken hata oluştu.");
          } else {
            queryClient.invalidateQueries({ queryKey: ["daily_notes_history", userId] });
          }
        }
      }
    ]);
  };

  const handleUpdate = async () => {
    if (!editingNote || !editContent) return;
    setIsSubmitting(true);
    try {
      const encrypted = encrypt(editContent);
      const { error } = await supabase
        .from("daily_notes")
        .update({ content: encrypted })
        .eq("id", editingNote.id);
      
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["daily_notes_history", userId] });
      setEditingNote(null);
      setEditContent("");
    } catch (e: any) {
      Alert.alert("Hata", "Günlük güncellenemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <LinearGradient colors={["#080811", "#0A0A0C", "#080811"]} style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#E8002D" size="large" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#0c0c0c", "#120508", "#0c0c0c"]} style={{ flex: 1 }}>
      
      {/* HEADER */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: Platform.OS === "ios" ? 60 : 40,
        paddingHorizontal: 20,
        paddingBottom: 15,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 5, marginLeft: -5 }}>
          <ChevronLeft color="#fff" size={28} />
        </TouchableOpacity>
        
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity 
            style={{ backgroundColor: "#311822", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 }}
            onPress={() => setIsEditMode(!isEditMode)}
          >
            <Text style={{ color: "#E8002D", fontWeight: "700", fontSize: 13 }}>
              {isEditMode ? "Bitti" : "Düzenle"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 5, marginRight: -5 }}>
            <Menu color="#fff" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: 10,
          paddingHorizontal: 20,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#E8002D"
          />
        }
      >
        {/* ─── TITLE ─── */}
        <View style={{ marginBottom: 28, alignItems: "center" }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: "rgba(232,0,45,0.12)",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <BookOpen size={24} color="#E8002D" />
          </View>
          <Text
            style={{
              fontSize: 26,
              fontWeight: "800",
              color: "#fff",
              textAlign: "center",
              letterSpacing: 0.5,
            }}
          >
            GÜNLÜĞÜM 📓
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.35)",
              fontSize: 14,
              marginTop: 6,
              textAlign: "center",
            }}
          >
            Sadece senin görebildiğin notların
          </Text>
        </View>

        {/* ─── Empty State ─── */}
        {notes.length === 0 && (
          <View
            style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 80,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.03)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.06)",
              borderStyle: "dashed",
            }}
          >
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📓</Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
              Henüz günlüğüne hiçbir şey yazmadın.
            </Text>
          </View>
        )}

        {/* ─── Timeline ─── */}
        {notes.map((note, index) => {
          const dateObj = dayjs(note.date);
          const day = dateObj.format("D");
          const monthYear = dateObj.format("MMMM YYYY").toUpperCase();
          const weekday = dateObj.format("dddd");
          const isLast = index === notes.length - 1;

          return (
            <View
              key={note.id}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                paddingBottom: isLast ? 0 : 20,
              }}
            >
              {/* ── Date Column ── */}
              <View
                style={{
                  width: 64,
                  alignItems: "center",
                  paddingTop: 4,
                  flexShrink: 0,
                }}
              >
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: "800",
                    color: "#ffffff",
                    lineHeight: 36,
                  }}
                >
                  {day}
                </Text>
                <Text
                  style={{
                    fontSize: 9,
                    color: "#c8922a",
                    letterSpacing: 0.5,
                    fontWeight: "600",
                    textAlign: "center",
                    marginTop: 2,
                    lineHeight: 12,
                  }}
                >
                  {monthYear}
                </Text>
                <Text
                  style={{
                    fontSize: 9,
                    color: "rgba(255,255,255,0.3)",
                    marginTop: 2,
                    textAlign: "center",
                  }}
                >
                  {weekday}
                </Text>
              </View>

              {/* ── Connector Line ── */}
              <View
                style={{
                  width: 16,
                  paddingTop: 18,
                  flexShrink: 0,
                }}
              >
                <View
                  style={{
                    height: 1,
                    backgroundColor: "rgba(255,255,255,0.12)",
                  }}
                />
              </View>

              {/* ── Note Card ── */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: "#1a1a1e",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.07)",
                  borderRadius: 14,
                  padding: 16,
                  position: "relative",
                }}
              >
                {isEditMode && (
                  <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginBottom: 12 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingNote(note);
                        setEditContent(note.content);
                      }}
                      style={{ padding: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 8 }}
                    >
                      <Edit3 size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDelete(note.id)}
                      style={{ padding: 6, backgroundColor: "rgba(239, 68, 68, 0.15)", borderRadius: 8 }}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
                
                <Text
                  style={{
                    fontSize: 13.5,
                    color: "rgba(255,255,255,0.75)",
                    lineHeight: 22,
                  }}
                >
                  {note.content}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* DÜZENLEME MODALI */}
      <Modal visible={!!editingNote} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", padding: 20 }}>
          <View style={{ backgroundColor: "#1c1c1e", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 16 }}>Günlüğü Düzenle</Text>
            <TextInput
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                color: "#fff",
                borderRadius: 12,
                padding: 16,
                fontSize: 15,
                minHeight: 120,
                textAlignVertical: "top",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
              }}
              multiline
              value={editContent}
              onChangeText={setEditContent}
              placeholder="Günlüğünüz..."
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
              <TouchableOpacity 
                onPress={() => setEditingNote(null)}
                style={{ paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.1)" }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleUpdate}
                disabled={isSubmitting}
                style={{ paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: "#E8002D", flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : <Check size={18} color="#fff" />}
                <Text style={{ color: "#fff", fontWeight: "700" }}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </LinearGradient>
  );
}
