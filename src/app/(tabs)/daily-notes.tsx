import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { encrypt, decrypt } from "@/utils/crypto";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { ChevronLeft, Edit3, Trash2, Menu, Check, AlignJustify } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getTheme } from "@/lib/theme";

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
  const userId = session?.user?.id ? session.user.id : null;
  const theme = getTheme(profile?.gender);
  const insets = useSafeAreaInsets();

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingNote, setEditingNote] = useState<DailyNote | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editError, setEditError] = useState(false);

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
    if (!editingNote) return;
    if (!editContent.trim()) {
      setEditError(true);
      return;
    }
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
      setEditError(false);
    } catch (e: any) {
      Alert.alert("Hata", "Günlük güncellenemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenBackground style={{ padding: 20, paddingTop: 120 }}>
        <Skeleton height={200} borderRadius={16} style={{ marginBottom: 20 }} />
        <Skeleton height={200} borderRadius={16} style={{ marginBottom: 20 }} />
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      
      {/* HEADER */}
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, paddingTop: insets.top + 16, paddingHorizontal: 20 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: 28, fontFamily: "PlayfairDisplay_400Regular_Italic", color: "#fff" }}>
              Günlüğüm 📓
            </Text>
          </View>
          <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
            Sadece senin görebildiğin notların
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity 
            style={{ backgroundColor: theme.cardBg, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 }}
            onPress={() => setIsEditMode(!isEditMode)}
          >
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
              {isEditMode ? "Bitti" : "Düzenle"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" }}>
            <AlignJustify color="rgba(255,255,255,0.7)" size={22} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id.toString()}
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
        ListHeaderComponent={
          <>
            {/* ─── Add Note Button (When Not Empty) ─── */}
            {notes.length > 0 && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={{
                  backgroundColor: theme.accent,
                  paddingVertical: 14,
                  borderRadius: 20,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                  marginBottom: 24,
                }}
                onPress={() => router.push("/(tabs)/add-daily-note")}
              >
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
                  ⊕ Yeni Sayfa Ekle ✍️
                </Text>
              </TouchableOpacity>
            )}

            {/* ─── Empty State ─── */}
            {notes.length === 0 && (
              <View style={{ gap: 20 }}>
                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 50,
                    paddingHorizontal: 20,
                    borderRadius: 24,
                    backgroundColor: theme.cardBg,
                  }}
                >
                  <Text style={{ fontSize: 36, marginBottom: 20 }}>📓</Text>
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 12, textAlign: "center" }}>
                    Henüz günlüğüne hiçbir şey yazmadın.
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "center", lineHeight: 20, paddingHorizontal: 10 }}>
                    Bugün hissettiklerini ya da sevgilinle geçirdiğin güzel bir anı buraya kaydederek başlayabilirsin.
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: theme.accent,
                    paddingVertical: 16,
                    borderRadius: 30,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                  }}
                  onPress={() => router.push("/(tabs)/add-daily-note")}
                >
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                    ⊕ İlk Sayfayı Yaz ✍️
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        renderItem={({ item: note, index }) => {
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
                        setEditError(false);
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
        }}
      />

      {/* DÜZENLEME MODALI */}
      <Modal visible={!!editingNote} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
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
                borderColor: editError ? "red" : "rgba(255,255,255,0.1)",
              }}
              multiline
              value={editContent}
              onChangeText={(text) => {
                setEditContent(text);
                setEditError(false);
              }}
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
        </KeyboardAvoidingView>
      </Modal>

    </ScreenBackground>
  );
}
