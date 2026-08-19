import React, { useCallback,  useState, useMemo, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { Image } from "expo-image";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dayjs, todayString } from "@/lib/date";
import { decrypt, deterministicDecrypt, encrypt } from "@/utils/crypto";
import { ChevronRight, Heart, FileText, Frown, Smile, Meh, AlertCircle, Sparkles, Droplet, Pill, Menu, ChevronLeft, X, Calendar as CalendarIcon, Save, Trash2, MapPin } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

LocaleConfig.locales['tr'] = {
  monthNames: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
  monthNamesShort: ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'],
  dayNames: ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'],
  dayNamesShort: ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'],
  today: 'Bugün'
};
LocaleConfig.defaultLocale = 'tr';

export default function CalendarScreen() {
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const today = todayString();
  const insets = useSafeAreaInsets();

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [showTodayModal, setShowTodayModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;

  // Fetch Data
  const { data, isLoading , refetch} = useQuery({
    queryKey: ["calendar_data", coupleId],
    enabled: !!coupleId || !!userId,
    queryFn: async () => {
      const threeMonthsAgo = dayjs().subtract(1, "month").startOf("month").format("YYYY-MM-DD");
      const twoMonthsLater = dayjs().add(2, "month").endOf("month").format("YYYY-MM-DD");

      const [notesRes, moodsRes, photosRes, usersRes] = await Promise.all([
        supabase
          .from("calendar_notes")
          .select("id, date, note, user_id")
          .eq("couple_id", coupleId)
          .gte("date", threeMonthsAgo)
          .lte("date", twoMonthsLater),
        supabase
          .from("moods")
          .select("date, mood_type, user_id")
          .eq("couple_id", coupleId)
          .gte("date", threeMonthsAgo)
          .lte("date", twoMonthsLater),
        supabase
          .from("photo_archive")
          .select("id, user_id, image_url, title, description, taken_date, taken_time")
          .eq("couple_id", coupleId)
          .gte("taken_date", threeMonthsAgo)
          .lte("taken_date", twoMonthsLater)
          .order("taken_time", { ascending: false }),
        supabase
          .from("users")
          .select("id, username, display_name")
          .eq("couple_id", coupleId),
      ]);

      const userMap = (usersRes.data || []).reduce((acc: any, u: any) => {
        acc[u.id] = u;
        return acc;
      }, {});

      return {
        notes: (notesRes.data || []).map(n => ({
          ...n,
          user: userMap[n.user_id],
        })),
        moods: (moodsRes.data || []).map(m => ({
          ...m,
          user: userMap[m.user_id],
        })),
        photos: (photosRes.data || []).map(p => ({
          ...p,
          title: p.title ? decrypt(p.title) : null,
          description: p.description ? decrypt(p.description) : null,
          uploader: userMap[p.user_id],
        })),
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  // Calculate markedDates
  const markedDates = useMemo(() => {
    if (!data) return {};
    
    const marks: Record<string, any> = {};

    const addDot = (dateStr: string, color: string, key: string) => {
      if (!marks[dateStr]) marks[dateStr] = { dots: [] };
      // avoid duplicates
      if (!marks[dateStr].dots.find((d: any) => d.key === key)) {
        marks[dateStr].dots.push({ key, color });
      }
    };

    data.notes.forEach(n => addDot(n.date, "#E8002D", "note"));
    data.moods.forEach(m => {
      const isMe = m.user_id === userId;
      addDot(m.date, isMe ? "#FFD700" : "#64b4ff", isMe ? "my-mood" : "partner-mood");
    });
    data.photos.forEach(p => addDot(p.taken_date, "#22c55e", "photo"));

    // Set selected
    if (selectedDate) {
      if (!marks[selectedDate]) marks[selectedDate] = {};
      marks[selectedDate].selected = true;
      marks[selectedDate].selectedColor = "#E8002D";
    }

    return marks;
  }, [data, selectedDate, userId]);

  // Selected Day Details
  const selectedDayNotes = useMemo(() => {
    if (!data || !selectedDate) return [];
    return data.notes.filter(n => n.date === selectedDate);
  }, [data, selectedDate]);

  const selectedDayMoods = useMemo(() => {
    if (!data || !selectedDate) return [];
    return data.moods.filter(m => m.date === selectedDate);
  }, [data, selectedDate]);

  const selectedDayPhotos = useMemo(() => {
    if (!data || !selectedDate) return [];
    return data.photos.filter(p => p.taken_date === selectedDate);
  }, [data, selectedDate]);

  const todayNote = useMemo(() => {
    if (!data) return null;
    return data.notes.find(n => n.date === today && n.user_id === userId);
  }, [data, today, userId]);

  // Handlers
  function onDayPress(day: any) {
    setSelectedDate(day.dateString);
    if (day.dateString === today) {
      setNoteText(todayNote?.note || "");
      setShowTodayModal(true);
    }
  }

  async function handleSaveNote() {
    if (!noteText.trim() || !userId) return;
    setSaving(true);

    let error;
    if (todayNote?.id) {
      const res = await supabase
        .from("calendar_notes")
        .update({ note: noteText.trim() })
        .eq("id", todayNote.id);
      error = res.error;
    } else {
      const payload: any = {
        user_id: userId,
        date: today,
        note: noteText.trim(),
      };
      if (coupleId) payload.couple_id = coupleId;
      const res = await supabase
        .from("calendar_notes")
        .insert(payload);
      error = res.error;
    }

    setSaving(false);
    if (!error) {
      setShowTodayModal(false);
      queryClient.invalidateQueries({ queryKey: ["calendar_data"] });
    }
  }

  async function handleDeleteNote() {
    if (!todayNote?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("calendar_notes")
      .delete()
      .eq("id", todayNote.id);
    
    setSaving(false);
    if (!error) {
      setShowTodayModal(false);
      queryClient.invalidateQueries({ queryKey: ["calendar_data"] });
    }
  }

  const renderSelectedDayDetails = () => {
    if (selectedDayNotes.length === 0 && selectedDayMoods.length === 0 && selectedDayPhotos.length === 0) {
      return (
        <Text style={styles.emptyText}>Bu gün için henüz bir kayıt yok.</Text>
      );
    }

    return (
      <View style={{ gap: 16 }}>
        {/* Photos */}
        {selectedDayPhotos.length > 0 && (
          <View style={{ gap: 12 }}>
            {selectedDayPhotos.map(photo => {
              const uploaderName = photo.uploader?.display_name || deterministicDecrypt(photo.uploader?.username) || photo.uploader?.username || "?";
              return (
                <View key={photo.id} style={styles.photoCard}>
                  <Image source={{ uri: photo.image_url }} style={styles.photoImg} contentFit="cover" />
                  {(photo.title || photo.description) && (
                    <View style={styles.photoCaptionBox}>
                      {!!photo.title && <Text style={styles.photoTitle}>{photo.title}</Text>}
                      {!!photo.description && <Text style={styles.photoDesc}>{photo.description}</Text>}
                    </View>
                  )}
                  <View style={styles.photoMeta}>
                    <Text style={styles.photoMetaText}>👤 {uploaderName}</Text>
                    {!!photo.taken_time && (
                      <Text style={styles.photoMetaText}>🕐 {photo.taken_time.substring(0,5)}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Notes */}
        {selectedDayNotes.length > 0 && (
          <View>
            <View style={[styles.sectionHeader, { borderLeftColor: "#E8002D" }]}>
              <Text style={styles.sectionHeaderText}>GÜNLÜK ÖZET</Text>
            </View>
            <View style={{ gap: 10 }}>
              {selectedDayNotes.map(note => {
                const authorName = note.user?.display_name || deterministicDecrypt(note.user?.username) || note.user?.username || "?";
                return (
                  <View key={note.id} style={styles.noteBox}>
                    <Text style={styles.noteText}>{note.note}</Text>
                    <Text style={styles.noteAuthor}>— {authorName}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Moods */}
        {selectedDayMoods.length > 0 && (
          <View>
            <View style={[styles.sectionHeader, { borderLeftColor: "#FFD700" }]}>
              <Text style={styles.sectionHeaderText}>RUH HALLERİ</Text>
            </View>
            <View style={{ gap: 8 }}>
              {selectedDayMoods.map((m, i) => {
                const authorName = m.user?.display_name || deterministicDecrypt(m.user?.username) || m.user?.username || "?";
                return (
                  <View key={i} style={styles.moodBox}>
                    <Text style={{ fontSize: 24 }}>{m.mood_type}</Text>
                    <Text style={styles.moodAuthor}>{authorName}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    );
  };

  if (!session) {
    return <View style={{ flex: 1, backgroundColor: "#080811" }} />;
  }



  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 10, paddingBottom: 120 }}>
        
        {/* Header */}
        <View style={[styles.header, { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8, marginRight: 8 }}>
              <ChevronLeft color="#fff" size={28} />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>Takvim</Text>
              <Text style={styles.subtitle}>Notlar, ruh halleri ve anılar</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, marginRight: -8, marginTop: -8 }}>
            <Menu color="#fff" size={24} />
          </TouchableOpacity>
        </View>

        {/* Calendar View */}
        <View style={styles.calendarContainer}>
          <Calendar
            current={today}
            onDayPress={onDayPress}
            markedDates={markedDates}
            markingType={'multi-dot'}
            theme={{
              calendarBackground: 'transparent',
              textSectionTitleColor: 'rgba(255,255,255,0.4)',
              selectedDayBackgroundColor: '#E8002D',
              selectedDayTextColor: '#ffffff',
              todayTextColor: '#E8002D',
              dayTextColor: 'rgba(255,255,255,0.85)',
              textDisabledColor: 'rgba(255,255,255,0.2)',
              dotColor: '#E8002D',
              selectedDotColor: '#ffffff',
              arrowColor: 'rgba(255,255,255,0.7)',
              monthTextColor: '#ffffff',
              textMonthFontWeight: 'bold',
              textDayFontSize: 14,
              textMonthFontSize: 17,
              textDayHeaderFontSize: 11,
              textDayHeaderFontWeight: '600'
            }}
          />
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          {[
            { color: "#E8002D", label: "Notlar" },
            { color: "#FFD700", label: "E. Ruh Hali" },
            { color: "#22c55e", label: "Fotoğraflar" },
            { color: "#64b4ff", label: "O. Ruh Hali" },
          ].map(item => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Selected Day Details */}
        {selectedDate && (
          <View style={styles.detailsCard}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsTitle}>Günün Anıları</Text>
              <Text style={styles.detailsDate}>
                {dayjs(selectedDate).format("DD MMMM YYYY")}
              </Text>
            </View>
            
            {isLoading ? (
              <View style={{ marginTop: 20, gap: 12 }}>
                <Skeleton height={100} borderRadius={16} />
                <Skeleton height={60} borderRadius={16} />
              </View>
            ) : (
              renderSelectedDayDetails()
            )}
          </View>
        )}

      </ScrollView>

      {/* TODAY MODAL */}
      <Modal visible={showTodayModal} transparent animationType="fade">
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowTodayModal(false)}>
              <X color="rgba(255,255,255,0.5)" size={20} />
            </TouchableOpacity>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <CalendarIcon color="#E8002D" size={20} />
              <Text style={styles.modalTitle}>Bugün</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              {dayjs(today).format("DD MMMM YYYY, dddd")}
            </Text>

            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Bu güne dair bir not bırak..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
              style={styles.modalInput}
              autoFocus
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              {todayNote && (
                <TouchableOpacity 
                  onPress={handleDeleteNote} 
                  disabled={saving}
                  style={styles.deleteBtn}
                >
                  <Trash2 color="rgba(255,100,100,0.8)" size={18} />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                onPress={handleSaveNote}
                disabled={saving || !noteText.trim()}
                style={[styles.saveBtn, (saving || !noteText.trim()) && { opacity: 0.5 }]}
              >
                <Save color="#fff" size={18} />
                <Text style={styles.saveBtnText}>
                  {saving ? "Kaydediliyor..." : todayNote ? "Güncelle" : "Kaydet"}
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>

    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginTop: 4,
  },
  calendarContainer: {
    backgroundColor: "#181a20",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 8,
    paddingBottom: 12,
    marginBottom: 16,
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    marginBottom: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    fontWeight: "500",
    color: "rgba(255,255,255,0.4)",
  },
  detailsCard: {
    backgroundColor: "#181a20",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 20,
  },
  detailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
  detailsDate: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  emptyText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    paddingVertical: 20,
  },
  sectionHeader: {
    paddingLeft: 10,
    borderLeftWidth: 3,
    marginBottom: 10,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 1,
  },
  noteBox: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  noteText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 20,
  },
  noteAuthor: {
    fontSize: 11,
    color: "#E8002D",
    fontWeight: "600",
    marginTop: 8,
  },
  moodBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,215,0,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.1)",
  },
  moodAuthor: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },
  photoCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  photoImg: {
    width: "100%",
    aspectRatio: 16/9,
  },
  photoCaptionBox: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  photoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
  },
  photoDesc: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  photoMeta: {
    paddingTop: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  photoMetaText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#1c1c1e",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  closeBtn: {
    position: "absolute",
    top: 20,
    right: 20,
    padding: 4,
    zIndex: 10,
  },
  modalTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 16,
  },
  modalInput: {
    width: "100%",
    minHeight: 120,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    textAlignVertical: "top",
  },
  deleteBtn: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#E8002D",
    borderRadius: 12,
    padding: 12,
  },
  saveBtnText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  }
});
