import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Platform, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, CalendarDays, Plus, Trash2, Edit2, X, Heart, Menu } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { dayjs } from "@/lib/date";

export default function MeetingsScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const coupleId = profile?.coupleId;
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<number | null>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: meetings, isLoading } = useQuery({
    queryKey: ["meetings", coupleId],
    enabled: !!coupleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meetings")
        .select("*")
        .eq("couple_id", coupleId)
        .order("meeting_datetime", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const newDate = new Date(meetingDate);
      newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setMeetingDate(newDate);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const newDate = new Date(meetingDate);
      newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setMeetingDate(newDate);
    }
  };

  const handleSave = async () => {
    if (!coupleId || !userId) return;

    if (meetingDate < new Date()) {
      Alert.alert("Hata", "Geçmiş bir zamana buluşma planlayamazsınız!");
      return;
    }

    setIsSubmitting(true);

    try {
      const utcDateTime = dayjs(meetingDate).toISOString();
      
      if (editingMeetingId) {
        const { error } = await supabase.from("meetings").update({
          meeting_datetime: utcDateTime,
          title: title || "Buluşma",
        }).eq("id", editingMeetingId).eq("user_id", userId);
        
        if (error) throw error;
        Alert.alert("Başarılı", "Buluşma başarıyla güncellendi!");
      } else {
        const { error } = await supabase.from("meetings").insert({
          meeting_datetime: utcDateTime,
          title: title || "Buluşma",
          is_active: true,
          couple_id: coupleId,
          user_id: userId,
        });

        if (error) throw error;
        Alert.alert("Başarılı", "Buluşma başarıyla planlandı!");
      }
      
      setTitle("");
      setMeetingDate(new Date());
      setEditingMeetingId(null);
      setShowAddModal(false);
      queryClient.invalidateQueries({ queryKey: ["meetings", coupleId] });
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
    } catch (error: any) {
      Alert.alert("Hata", error.message || "İşlem gerçekleştirilemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (m: any) => {
    if (m.user_id && m.user_id !== userId) {
      Alert.alert("Yetkisiz", "Bu buluşmayı yalnızca oluşturan kişi düzenleyebilir.");
      return;
    }
    setEditingMeetingId(m.id);
    setTitle(m.title);
    setMeetingDate(new Date(m.meeting_datetime));
    setShowAddModal(true);
  };

  const handleCancel = (m: any) => {
    if (m.user_id && m.user_id !== userId) {
      Alert.alert("Yetkisiz", "Bu buluşmayı yalnızca oluşturan kişi silebilir.");
      return;
    }

    Alert.alert("Buluşmayı İptal Et", "Bu buluşmayı iptal etmek istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      { 
        text: "İptal Et", 
        style: "destructive", 
        onPress: async () => {
          const { error } = await supabase
            .from("meetings")
            .update({ is_active: false })
            .eq("id", m.id)
            .eq("user_id", userId);
          
          if (error) {
             Alert.alert("Hata", "Sadece oluşturan kişi silebilir.");
          } else {
            queryClient.invalidateQueries({ queryKey: ["meetings", coupleId] });
            queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
          }
        }
      }
    ]);
  };

  const now = new Date();
  
  const activeMeetings = meetings?.filter(m => new Date(m.meeting_datetime) >= now) || [];
  const pastMeetings = meetings?.filter(m => new Date(m.meeting_datetime) < now) || [];

  return (
    <LinearGradient colors={["#1a1114", "#0c0c0c", "#1a1114"]} style={{ flex: 1 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color="#fff" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buluşmalar</Text>
        <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, marginRight: -8 }}>
          <Menu color="#fff" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        
        {/* AKTİF BULUŞMALAR */}
        <View style={{ gap: 16 }}>
          <Text style={styles.sectionTitle}>Aktif Buluşmalar</Text>

          {isLoading ? (
            <ActivityIndicator color="#D32F2F" />
          ) : activeMeetings.length > 0 ? (
            <View style={{ gap: 12 }}>
              {activeMeetings.map((m) => {
                const isCreator = m.user_id === userId;

                return (
                  <View 
                    key={m.id} 
                    style={[
                      styles.meetingItem, 
                      { opacity: m.is_active ? 1 : 0.5 }
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={styles.meetingTitle}>{m.title}</Text>
                        {!m.is_active && <View style={[styles.badge, { backgroundColor: "rgba(239, 68, 68, 0.2)" }]}><Text style={[styles.badgeText, { color: "#ef4444" }]}>İptal Edildi</Text></View>}
                      </View>
                      <Text style={styles.meetingDate}>
                        {dayjs(m.meeting_datetime).locale("tr").format("DD MMMM YYYY, dddd - HH:mm")}
                      </Text>
                    </View>

                    {isCreator && m.is_active && (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity onPress={() => handleEdit(m)} style={[styles.deleteBtn, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
                          <Edit2 color="#fff" size={20} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleCancel(m)} style={styles.deleteBtn}>
                          <Trash2 color="#ef4444" size={20} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconContainer}>
                <View style={styles.calendarIconBox}>
                  <View style={styles.calendarTopBar} />
                  <Text style={styles.calendarDots}>...</Text>
                </View>
                <View style={styles.heartIconWrapper}>
                  <Heart size={20} color="#ffd700" fill="#ffd700" />
                </View>
              </View>
              <Text style={styles.emptyText}>Henüz aktif bir buluşma planlanmadı.</Text>
            </View>
          )}

          <TouchableOpacity 
            style={styles.addMeetingBtn} 
            onPress={() => {
              setEditingMeetingId(null);
              setTitle("");
              setMeetingDate(new Date());
              setShowAddModal(true);
            }}
          >
            <LinearGradient 
              colors={["#b8860b", "#ffd700", "#b8860b"]} 
              start={{ x: 0, y: 0 }} 
              end={{ x: 1, y: 0 }} 
              style={styles.addMeetingBtnGradient}
            >
              <Plus color="#1a1114" size={22} />
              <Text style={styles.addMeetingBtnText}>Buluşma Ekle</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* GEÇMİŞ BULUŞMALAR */}
        {pastMeetings.length > 0 && (
          <View style={{ gap: 16, marginTop: 20 }}>
            <Text style={styles.sectionTitle}>Geçmiş Buluşmalar</Text>
            <View style={{ gap: 12 }}>
              {pastMeetings.map((m) => (
                <View 
                  key={m.id} 
                  style={[
                    styles.meetingItem, 
                    { opacity: 0.6, backgroundColor: "rgba(255,255,255,0.02)" }
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.meetingTitle}>{m.title}</Text>
                      <View style={styles.badge}><Text style={styles.badgeText}>Geçmiş</Text></View>
                      {!m.is_active && <View style={[styles.badge, { backgroundColor: "rgba(239, 68, 68, 0.2)" }]}><Text style={[styles.badgeText, { color: "#ef4444" }]}>İptal Edildi</Text></View>}
                    </View>
                    <Text style={styles.meetingDate}>
                      {dayjs(m.meeting_datetime).locale("tr").format("DD MMMM YYYY, dddd - HH:mm")}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      {/* YENİ/DÜZENLE BULUŞMA MODALI */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingMeetingId ? "Buluşmayı Düzenle" : "Yeni Buluşma Planla"}</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={{ padding: 4 }}>
                <X color="rgba(255,255,255,0.5)" size={24} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Başlık</Text>
            <TextInput
              style={styles.inputRed}
              placeholder="Akşam Yemeği 🍕"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.label}>Tarih & Saat</Text>
            <View style={styles.dateTimeContainer}>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateBtnText}>{dayjs(meetingDate).format("DD.MM.YYYY")}</Text>
              </TouchableOpacity>
              <Text style={{ color: "rgba(255,255,255,0.3)" }}>-</Text>
              <TouchableOpacity style={styles.timeBtn} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.dateBtnText}>{dayjs(meetingDate).format("HH:mm")}</Text>
              </TouchableOpacity>
              <CalendarDays color="#ffd700" size={20} style={{ position: "absolute", right: 14 }} />
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={meetingDate}
                mode="date"
                display="default"
                onChange={onDateChange}
                minimumDate={new Date()}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={meetingDate}
                mode="time"
                is24Hour={true}
                display="default"
                onChange={onTimeChange}
              />
            )}

            <TouchableOpacity 
              style={styles.submitBtnContainer} 
              onPress={handleSave} 
              disabled={isSubmitting}
            >
              <LinearGradient 
                colors={["#b8860b", "#ffd700", "#b8860b"]} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 0 }} 
                style={styles.submitBtnGradient}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#1a1114" />
                ) : (
                  <>
                    <Plus color="#1a1114" size={20} />
                    <Text style={styles.submitBtnText}>{editingMeetingId ? "Güncelle" : "Planla"}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  backBtn: {
    padding: 5,
    marginLeft: -5,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  container: {
    padding: 20,
    gap: 20,
    paddingBottom: 110,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  meetingItem: {
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    flexDirection: "row",
    alignItems: "center",
  },
  meetingTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  meetingDate: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginTop: 6,
  },
  deleteBtn: {
    padding: 10,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 10,
  },
  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.3)",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconContainer: {
    marginBottom: 16,
    position: "relative",
  },
  calendarIconBox: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: "#ffd700",
    borderRadius: 10,
    alignItems: "center",
    overflow: "hidden",
  },
  calendarTopBar: {
    width: "100%",
    height: 12,
    backgroundColor: "#ffd700",
  },
  calendarDots: {
    color: "#ffd700",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 20,
    marginTop: 2,
  },
  heartIconWrapper: {
    position: "absolute",
    top: -10,
    right: -10,
  },
  emptyText: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    fontSize: 15,
  },
  addMeetingBtn: {
    marginTop: 10,
    shadowColor: "#ffd700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  addMeetingBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  addMeetingBtnText: {
    color: "#1a1114",
    fontSize: 16,
    fontWeight: "700",
  },
  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1c1c1e",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  label: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    marginBottom: 8,
    marginTop: 12,
    fontWeight: "500",
  },
  inputRed: {
    backgroundColor: "#2c2c2e",
    borderWidth: 1,
    borderColor: "#ef4444",
    borderRadius: 12,
    padding: 16,
    color: "#fff",
    fontSize: 15,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  dateTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2c2c2e",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 40, // space for icon
  },
  dateBtn: {
    paddingVertical: 16,
    paddingRight: 10,
  },
  timeBtn: {
    paddingVertical: 16,
    paddingLeft: 10,
    flex: 1,
  },
  dateBtnText: {
    color: "#fff",
    fontSize: 15,
  },
  submitBtnContainer: {
    marginTop: 24,
    shadowColor: "#ffd700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  submitBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 14,
    gap: 8,
  },
  submitBtnText: {
    color: "#1a1114",
    fontSize: 16,
    fontWeight: "700",
  }
});
