import React, { useState, useCallback } from "react";
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
  StyleSheet
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { encrypt, decrypt } from "@/utils/crypto";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { 
  ChevronLeft, Edit3, Trash2, AlignJustify, 
  PenLine, BookOpen, Calendar, Clock, X, Check, Sparkles 
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { usePageTour } from "@/hooks/usePageTour";
import { PageTourModal } from "@/components/tour/PageTourModal";
import { TourGuideButton } from "@/components/tour/TourGuideButton";

dayjs.locale("tr");

interface DailyNote {
  id: number;
  date: string;
  content: string;
}

const cleanContentText = (raw: string) => {
  if (!raw) return "";
  return raw
    .replace(/^\[Mod:\s*.*?\]\n?/, "")
    .replace(/^#\s*.*?\n\n?/, "")
    .trim();
};

export default function DailyNotesScreen() {
  const { session, profile } = useAuth();
  const { theme, isLight } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("daily-notes");
  const userId = session?.user?.id ? session.user.id : null;

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
        .order("date", { ascending: false })
        .limit(90); // Son ~3 ay — sınırsız yükleme engellendi

      if (error) throw error;

      return (data ?? []).map((n: any) => ({
        ...n,
        content: (() => {
          try {
            return decrypt(n.content) || n.content;
          } catch {
            return n.content;
          }
        })(),
      }));
    },
    staleTime: 1000 * 60 * 5, // 5 dk — invalidateQueries zaten yeni not eklenince günceller
  });

  const handleDelete = useCallback(async (id: number) => {
    Alert.alert("Günlüğü Sil", "Bu günlük kaydını kalıcı olarak silmek istediğinize emin misiniz?", [
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
            queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
          }
        }
      }
    ]);
  }, [queryClient, userId]);

  const handleUpdate = async () => {
    if (!editingNote) return;
    if (!editContent.trim()) {
      setEditError(true);
      return;
    }
    setIsSubmitting(true);
    try {
      const encrypted = encrypt(editContent.trim());
      const { error } = await supabase
        .from("daily_notes")
        .update({ content: encrypted })
        .eq("id", editingNote.id);
      
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["daily_notes_history", userId] });
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
      setEditingNote(null);
      setEditContent("");
      setEditError(false);
    } catch (e: any) {
      Alert.alert("Hata", "Günlük güncellenemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderNoteCard = useCallback(({ item: note }: { item: DailyNote }) => {
    const dateObj = dayjs(note.date);
    const day = dateObj.format("D");
    const month = dateObj.format("MMMM");
    const year = dateObj.format("YYYY");
    const weekday = dateObj.format("dddd");

    const displayContent = cleanContentText(note.content);

    return (
      <View style={[styles.cardContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
        <View style={styles.cardHeader}>
          <View style={styles.dateBadge}>
            <View style={[styles.dayCircle, { backgroundColor: theme.pillAccentBg }]}>
              <Text style={[styles.dayText, { color: theme.accent }]}>{day}</Text>
            </View>
            <View>
              <Text style={[styles.monthYearText, { color: theme.text }]}>{month} {year}</Text>
              <Text style={[styles.weekdayText, { color: theme.textMuted }]}>{weekday}</Text>
            </View>
          </View>

          <View style={styles.actionBtnsRow}>
            <TouchableOpacity
              onPress={() => {
                setEditingNote(note);
                setEditContent(cleanContentText(note.content));
                setEditError(false);
              }}
              style={styles.actionIconBtn}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Edit3 size={15} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleDelete(note.id)}
              style={[styles.actionIconBtn, { backgroundColor: "rgba(239, 68, 68, 0.12)" }]}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Trash2 size={15} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.noteBodyText, { color: theme.textSecondary }]}>{displayContent}</Text>
      </View>
    );
  }, [theme, handleDelete]);

  const keyExtractor = useCallback((item: DailyNote) => item.id.toString(), []);

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={[styles.headerBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)", borderColor: theme.cardBorder }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft color={theme.text} size={24} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Günlüğüm</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>Sadece senin görebildiğin notların 📓</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TourGuideButton onPress={openTour} />
            <TouchableOpacity 
              onPress={() => router.push("/(tabs)/add-daily-note")}
              style={[styles.headerBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : theme.cardBg, borderColor: theme.cardBorder }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <PenLine color={theme.accent} size={19} />
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

        {/* ÜSTTE YENİ SAYFA EKLE BUTONU */}
        <View style={styles.topActionContainer}>
          <TouchableOpacity 
            style={[styles.writeNoteActionBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
            onPress={() => router.push("/(tabs)/add-daily-note")}
            activeOpacity={0.88}
          >
            <View style={[styles.writeActionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
              <BookOpen size={20} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.writeActionTitle, { color: theme.text }]}>Günün Günlüğünü Yaz</Text>
              <Text style={[styles.writeActionSub, { color: theme.textMuted }]}>İçinden geçenleri defterine emanet et ✨</Text>
            </View>
            <PenLine size={18} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {/* GÜNLÜK LİSTESİ */}
        {isLoading ? (
          <View style={{ paddingHorizontal: 20, gap: 14, marginTop: 10 }}>
            <Skeleton height={140} borderRadius={20} />
            <Skeleton height={140} borderRadius={20} />
            <Skeleton height={140} borderRadius={20} />
          </View>
        ) : (
          <FlatList
            data={notes}
            keyExtractor={keyExtractor}
            renderItem={renderNoteCard}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={theme.accent}
              />
            }
            ListEmptyComponent={
              <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
                <Text style={{ fontSize: 40, marginBottom: 12 }}>📓</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Henüz Günlük Yazmadın</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  Bugün hissettiklerini, sevgilinle geçirdiğin güzel bir anı veya sadece aklından geçenleri buraya kaydederek başlayabilirsin.
                </Text>
                <TouchableOpacity 
                  style={[styles.emptyActionBtn, { backgroundColor: theme.accent }]}
                  onPress={() => router.push("/(tabs)/add-daily-note")}
                >
                  <Text style={styles.emptyActionBtnText}>İlk Sayfayı Yaz ✍️</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>

      {/* DÜZENLEME MODALI (Modern ve Klavye Korumalı) */}
      <Modal visible={!!editingNote} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Edit3 size={18} color={theme.accent} />
                <Text style={[styles.modalTitle, { color: theme.text }]}>Günlüğü Düzenle</Text>
              </View>

              <TouchableOpacity 
                onPress={() => setEditingNote(null)}
                style={[styles.modalCloseBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20, gap: 14 }}
              enableOnAndroid={true}
              extraScrollHeight={140}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                style={[
                  styles.modalTextInput,
                  { 
                    backgroundColor: theme.unitBg,
                    color: theme.text,
                    borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"
                  },
                  editError && styles.modalInputError
                ]}
                multiline
                maxLength={4000}
                value={editContent}
                onChangeText={(text) => {
                  setEditContent(text);
                  setEditError(false);
                }}
                placeholder="Günlüğünüz..."
                placeholderTextColor={isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)"}
              />

              <Text style={{ alignSelf: "flex-end", fontSize: 11.5, fontFamily: "Inter_400Regular", color: theme.textMuted, marginRight: 4 }}>
                {editContent.length} / 4000 harf
              </Text>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity 
                  onPress={() => setEditingNote(null)}
                  style={[styles.modalCancelBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)" }]}
                >
                  <Text style={[styles.modalCancelBtnText, { color: theme.textSecondary }]}>İptal</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={handleUpdate}
                  disabled={isSubmitting}
                  style={[styles.modalSaveBtn, { backgroundColor: theme.accent }]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Check size={17} color="#ffffff" />
                      <Text style={styles.modalSaveBtnText}>Güncelle</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>
      <PageTourModal visible={isTourVisible} guide={guide} onClose={closeTour} />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
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
  topActionContainer: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  writeNoteActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  writeActionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  writeActionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  writeActionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 130,
    gap: 14,
  },
  cardContainer: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  monthYearText: {
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  weekdayText: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
  },
  actionBtnsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  moodBadgeContainer: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  moodBadgeText: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)",
  },
  noteTitleText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  noteBodyText: {
    fontSize: 14.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
    lineHeight: 23,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    borderRadius: 22,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 18,
  },
  emptyActionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 16,
  },
  emptyActionBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },

  /* MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    padding: 18,
  },
  modalBox: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTextInput: {
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#ffffff",
    minHeight: 160,
    textAlignVertical: "top",
    lineHeight: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalInputError: {
    borderColor: "#ff5c77",
    borderWidth: 1.5,
  },
  modalActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  modalCancelBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  modalSaveBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalSaveBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
