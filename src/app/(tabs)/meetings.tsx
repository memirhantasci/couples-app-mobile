import React, { useState } from "react";
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, 
  TextInput, ActivityIndicator, Alert, Platform, Linking, Modal 
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Trash2, MapPin, AlignJustify, Edit2, ChevronLeft, 
  Plus, Calendar, Clock, Navigation, Check, X, Sparkles, Heart 
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { notifyPartner } from "@/lib/notifications";
import { dayjs } from "@/lib/date";
import { getTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { MapPickerModal } from "@/components/MapPickerModal";
import { usePageTour } from "@/hooks/usePageTour";
import { PageTourModal } from "@/components/tour/PageTourModal";
import { TourGuideButton } from "@/components/tour/TourGuideButton";

export default function MeetingsScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const { theme, isLight } = useTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  
  const coupleId = profile?.coupleId;
  const userId = session?.user?.id ? session.user.id : null;
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("meetings");

  const [showFormModal, setShowFormModal] = useState(false);
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);

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
    staleTime: 1000 * 60 * 5,
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

  const handleEdit = (m: any) => {
    setEditingMeetingId(m.id);
    setTitle(m.title);
    setMeetingDate(new Date(m.meeting_datetime));
    setLocationName(m.location_name || "");
    setLatitude(m.latitude || null);
    setLongitude(m.longitude || null);
    setShowFormModal(true);
  };

  const handleCancelEdit = () => {
    setEditingMeetingId(null);
    setTitle("");
    setMeetingDate(new Date());
    setLocationName("");
    setLatitude(null);
    setLongitude(null);
    setShowFormModal(false);
  };

  const handleSave = async () => {
    if (!coupleId || !userId) return;

    if (meetingDate < new Date() && !editingMeetingId) {
      Alert.alert("Hata", "Geçmiş bir zamana buluşma planlayamazsınız!");
      return;
    }

    if (!title.trim()) {
      Alert.alert("Eksik Bilgi", "Lütfen buluşma için bir başlık girin.");
      return;
    }

    setIsSubmitting(true);

    try {
      const utcDateTime = dayjs(meetingDate).toISOString();

      if (editingMeetingId) {
        const { error } = await supabase.from("meetings").update({
          meeting_datetime: utcDateTime,
          title: title.trim() || "Buluşma",
          location_name: locationName.trim() || null,
          latitude: latitude,
          longitude: longitude,
        }).eq("id", editingMeetingId);
        
        if (error) throw error;
        Alert.alert("Başarılı 🎉", "Buluşma başarıyla güncellendi!");
      } else {
        const { error } = await supabase.from("meetings").insert({
          meeting_datetime: utcDateTime,
          title: title.trim() || "Buluşma",
          location_name: locationName.trim() || null,
          latitude: latitude,
          longitude: longitude,
          is_active: true,
          couple_id: coupleId,
          user_id: userId,
        });

        if (error) throw error;

        if (coupleId && userId) {
          const senderName = profile?.displayName || "Sevgilin";
          const meetingTitle = title.trim() || "Buluşma";
          notifyPartner(
            coupleId, 
            userId, 
            "Buluşma Planlandı! 📅", 
            `${senderName} yeni bir buluşma planladı: ${meetingTitle}`
          );
        }

        Alert.alert("Başarılı 🎉", "Buluşma başarıyla planlandı!");
      }

      handleCancelEdit();
      queryClient.invalidateQueries({ queryKey: ["meetings", coupleId] });
      queryClient.invalidateQueries({ queryKey: ["map_meetings", coupleId] });
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
    } catch (error: any) {
      Alert.alert("Hata", "İşlem gerçekleştirilemedi. Lütfen daha sonra tekrar deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (m: any) => {
    Alert.alert("Buluşmayı Sil", "Bu buluşmayı silmek istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("meetings")
            .delete()
            .eq("id", m.id);

          if (error) {
            Alert.alert("Hata", "Buluşma silinemedi.");
          } else {
            queryClient.invalidateQueries({ queryKey: ["meetings", coupleId] });
            queryClient.invalidateQueries({ queryKey: ["map_meetings", coupleId] });
            queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
          }
        }
      }
    ]);
  };

  const now = new Date();
  const activeMeetings = meetings?.filter(m => new Date(m.meeting_datetime) >= now && m.is_active) || [];
  const pastMeetings = meetings?.filter(m => new Date(m.meeting_datetime) < now || !m.is_active) || [];

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
            <Text style={[styles.headerTitle, { color: theme.text }]}>Buluşmalar</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>Randevular & Özel Anlar 📍</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TourGuideButton onPress={openTour} />
            <TouchableOpacity 
              onPress={() => router.push("/menu")} 
              style={[styles.headerBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)", borderColor: theme.cardBorder }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AlignJustify color={theme.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 140 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* HIZLI BULUŞMA EKLE BUTONU */}
          <TouchableOpacity 
            style={[styles.quickPlanBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
            onPress={() => {
              handleCancelEdit();
              setShowFormModal(true);
            }}
            activeOpacity={0.88}
          >
            <View style={[styles.quickPlanIconCircle, { backgroundColor: theme.pillAccentBg }]}>
              <Plus size={20} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.quickPlanTitle, { color: theme.text }]}>Yeni Bir Buluşma Planla</Text>
              <Text style={[styles.quickPlanSub, { color: theme.textMuted }]}>Tarih, saat ve haritadan konum belirleyin ✨</Text>
            </View>
            <MapPin size={18} color={theme.textMuted} />
          </TouchableOpacity>

          {/* AKTİF BULUŞMALAR BÖLÜMÜ */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>YAKLAŞAN BULUŞMALAR</Text>
              {activeMeetings.length > 0 && (
                <Text style={styles.sectionBadgeText}>{activeMeetings.length} Randevu</Text>
              )}
            </View>

            {isLoading ? (
              <View style={{ gap: 12 }}>
                <Skeleton height={140} borderRadius={20} />
                <Skeleton height={140} borderRadius={20} />
              </View>
            ) : activeMeetings.length > 0 ? (
              activeMeetings.map((m) => {
                const isMyMeeting = m.user_id === userId;
                const formattedDate = dayjs(m.meeting_datetime).locale("tr").format("D MMMM YYYY, dddd");
                const formattedTime = dayjs(m.meeting_datetime).format("HH:mm");

                return (
                  <View key={m.id} style={[styles.meetingCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                    {/* Kart Üst Bilgisi */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.titleWithIcon}>
                        <View style={[styles.cardIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                          <Heart size={16} color={theme.accent} fill={theme.accent} />
                        </View>
                        <Text style={styles.cardTitle}>{m.title}</Text>
                      </View>

                      {isMyMeeting && (
                        <View style={styles.cardActionBtns}>
                          <TouchableOpacity 
                            onPress={() => handleEdit(m)}
                            style={styles.cardActionBtn}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Edit2 color="rgba(255,255,255,0.7)" size={15} />
                          </TouchableOpacity>

                          <TouchableOpacity 
                            onPress={() => handleDelete(m)}
                            style={[styles.cardActionBtn, { backgroundColor: "rgba(239,68,68,0.12)" }]}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Trash2 color="#ef4444" size={15} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* Zaman Rozeti */}
                    <View style={styles.timeBadgeRow}>
                      <View style={styles.timePill}>
                        <Calendar size={13} color={theme.accent} />
                        <Text style={styles.timePillText}>{formattedDate}</Text>
                      </View>
                      <View style={[styles.timePill, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)" }]}>
                        <Clock size={13} color={theme.accent} />
                        <Text style={[styles.timePillText, { color: theme.text }]}>{formattedTime}</Text>
                      </View>
                    </View>

                    {/* Konum Satırı */}
                    {m.location_name ? (
                      <View style={styles.locationContainer}>
                        <MapPin color={theme.accent} size={14} />
                        <Text style={[styles.locationText, { color: theme.textSecondary }]} numberOfLines={1}>
                          {m.location_name}
                        </Text>
                      </View>
                    ) : null}

                    {/* Yol Tarifi Butonu */}
                    {(m.latitude && m.longitude) || m.location_name ? (
                      <TouchableOpacity
                        style={[styles.directionsBtn, { backgroundColor: theme.unitBg }]}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (m.latitude && m.longitude) {
                            const url = Platform.select({
                              ios: `maps://app?daddr=${m.latitude},${m.longitude}`,
                              android: `google.navigation:q=${m.latitude},${m.longitude}`
                            }) || `https://www.google.com/maps/dir/?api=1&destination=${m.latitude},${m.longitude}`;
                            Linking.openURL(url);
                          } else if (m.location_name) {
                            const encoded = encodeURIComponent(m.location_name);
                            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
                          }
                        }}
                      >
                        <Navigation size={14} color={theme.accent} />
                        <Text style={[styles.directionsBtnText, { color: theme.accent }]}>
                          Haritada Yol Tarifi Al 🗺️
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
                <MapPin size={36} color={theme.textMuted} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Aktif Buluşma Yok</Text>
                <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                  Birlikte romantik bir akşam yemeği veya kahve molası planlamak için hemen yeni bir buluşma oluşturun.
                </Text>
                <TouchableOpacity 
                  style={[styles.emptyAddBtn, { backgroundColor: theme.accent }]}
                  onPress={() => {
                    handleCancelEdit();
                    setShowFormModal(true);
                  }}
                >
                  <Plus size={15} color="#ffffff" />
                  <Text style={styles.emptyAddBtnText}>Buluşma Planla</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* GEÇMİŞ BULUŞMALAR BÖLÜMÜ */}
          {pastMeetings.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>GEÇMİŞ BULUŞMALAR</Text>
              {pastMeetings.map((m) => {
                const formattedDate = dayjs(m.meeting_datetime).locale("tr").format("D MMMM YYYY");

                return (
                  <View key={m.id} style={[styles.pastMeetingCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pastCardTitle, { color: theme.text }]}>{m.title}</Text>
                      <Text style={[styles.pastCardDate, { color: theme.textMuted }]}>{formattedDate}</Text>
                      {m.location_name ? (
                        <Text style={[styles.pastLocationText, { color: theme.textSecondary }]} numberOfLines={1}>
                          📍 {m.location_name}
                        </Text>
                      ) : null}
                    </View>
                    <Check size={18} color={theme.textMuted} />
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>

      {/* ─── YENİ BULUŞMA EKLEME / DÜZENLEME MODALI ─── */}
      <Modal visible={showFormModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MapPin size={18} color={theme.accent} />
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {editingMeetingId ? "Buluşmayı Düzenle" : "Yeni Buluşma Planla"}
                </Text>
              </View>

              <TouchableOpacity 
                onPress={handleCancelEdit}
                style={[styles.modalCloseBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16, gap: 14 }}
              enableOnAndroid={true}
              extraScrollHeight={130}
              keyboardShouldPersistTaps="handled"
            >
              {/* Buluşma Başlığı */}
              <View style={{ gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>BULUŞMA BAŞLIĞI</Text>
                <TextInput
                  style={[
                    styles.textInput, 
                    { 
                      backgroundColor: theme.unitBg,
                      color: theme.text,
                      borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"
                    }
                  ]}
                  placeholder="Örn: Yıldönümü Yemeği, Kahve Randevusu..."
                  placeholderTextColor={isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)"}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={60}
                />
              </View>

              {/* Tarih & Saat Seçicileri */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>TARİH</Text>
                  <TouchableOpacity 
                    style={[
                      styles.pickerBtn, 
                      { 
                        backgroundColor: theme.unitBg,
                        borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"
                      }
                    ]} 
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Calendar size={14} color={theme.accent} />
                    <Text style={[styles.pickerBtnText, { color: theme.text }]}>{dayjs(meetingDate).format("DD.MM.YYYY")}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>SAAT</Text>
                  <TouchableOpacity 
                    style={[
                      styles.pickerBtn, 
                      { 
                        backgroundColor: theme.unitBg,
                        borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"
                      }
                    ]} 
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Clock size={14} color={theme.accent} />
                    <Text style={[styles.pickerBtnText, { color: theme.text }]}>{dayjs(meetingDate).format("HH:mm")}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Konum Belirleme */}
              <View style={{ gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>BULUŞMA YERİ / KONUM</Text>
                <View style={[styles.locationInputBox, { backgroundColor: theme.unitBg, borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)" }]}>
                  <TextInput
                    style={[
                      styles.locationTextInput, 
                      { 
                        backgroundColor: theme.unitBg,
                        color: theme.text,
                      }
                    ]}
                    placeholder="Buluşulacak mekan veya adres..."
                    placeholderTextColor={isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)"}
                    value={locationName}
                    onChangeText={setLocationName}
                  />
                  <TouchableOpacity 
                    style={[styles.mapOpenBtn, { backgroundColor: theme.pillAccentBg }]} 
                    onPress={() => setShowMapModal(true)}
                    activeOpacity={0.8}
                  >
                    <MapPin size={15} color={theme.accent} />
                    <Text style={[styles.mapOpenBtnText, { color: theme.accent }]}>Harita</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Kaydet / Güncelle Butonu */}
              <TouchableOpacity
                style={[
                  styles.saveBtn, 
                  { backgroundColor: theme.accent },
                  (!title.trim() || isSubmitting) && { opacity: 0.6 }
                ]}
                onPress={handleSave}
                disabled={isSubmitting || !title.trim()}
                activeOpacity={0.88}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Check size={18} color="#ffffff" />
                    <Text style={styles.saveBtnText}>
                      {editingMeetingId ? "Buluşmayı Güncelle" : "Randevuyu Kaydet ✨"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      {/* TARİH & SAAT PICKER MODALLARI */}
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

      {/* HARİTA SEÇİCİ MODALI */}
      <MapPickerModal 
        visible={showMapModal} 
        onClose={() => setShowMapModal(false)}
        title="Buluşma Noktası"
        initialLocation={latitude && longitude ? { latitude, longitude } : undefined}
        onSelectLocation={(loc) => {
          setLatitude(loc.latitude);
          setLongitude(loc.longitude);
          if (!locationName) setLocationName(loc.locationName || "");
        }}
      />
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
    paddingBottom: 12,
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 18,
  },

  /* HIZLI PLANLA KARTI */
  quickPlanBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  quickPlanIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  quickPlanTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  quickPlanSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },

  /* BÖLÜM YAPISI */
  sectionBlock: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginLeft: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.8,
  },
  sectionBadgeText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.45)",
  },

  /* BULUŞMA KARTI */
  meetingCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  cardIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  cardActionBtns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  timeBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  timePillText: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.85)",
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 2,
  },
  locationText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    borderRadius: 14,
    marginTop: 2,
  },
  directionsBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },

  /* GEÇMİŞ BULUŞMA KARTI */
  pastMeetingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    opacity: 0.65,
  },
  pastCardTitle: {
    fontSize: 14.5,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  pastCardDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  pastLocationText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
    marginTop: 2,
  },

  /* BOŞ DURUM */
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    marginTop: 4,
  },
  emptySub: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 18,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 6,
  },
  emptyAddBtnText: {
    color: "#ffffff",
    fontSize: 13,
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
    maxHeight: "88%",
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
    fontSize: 16.5,
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
  fieldLabel: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.5,
  },
  textInput: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 14.5,
    fontFamily: "Inter_400Regular",
  },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  pickerBtnText: {
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  locationInputBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  locationTextInput: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 14.5,
    fontFamily: "Inter_400Regular",
  },
  mapOpenBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
  },
  mapOpenBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
    marginTop: 8,
  },
  saveBtnText: {
    color: "#ffffff",
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },
});
