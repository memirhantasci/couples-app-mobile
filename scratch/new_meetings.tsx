import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Platform, Linking } from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, MapPin, AlignJustify } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { dayjs } from "@/lib/date";
import { getTheme } from "@/lib/theme";
import { MapPickerModal } from "@/components/MapPickerModal";

export default function MeetingsScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const theme = getTheme(profile?.gender);
  
  const coupleId = profile?.coupleId;
  const userId = session?.user?.id ? session.user.id : null;

  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

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

  const handleSave = async () => {
    if (!coupleId || !userId) return;

    if (meetingDate < new Date()) {
      Alert.alert("Hata", "Geçmiş bir zamana buluşma planlayamazsınız!");
      return;
    }

    if (!title.trim()) {
      Alert.alert("Hata", "Lütfen bir başlık girin.");
      return;
    }

    setIsSubmitting(true);

    try {
      const utcDateTime = dayjs(meetingDate).toISOString();

      const { error } = await supabase.from("meetings").insert({
        meeting_datetime: utcDateTime,
        title: title || "Buluşma",
        location_name: locationName.trim() || null,
        latitude: latitude,
        longitude: longitude,
        is_active: true,
        couple_id: coupleId,
        user_id: userId,
      });

      if (error) throw error;
      Alert.alert("Başarılı", "Buluşma başarıyla planlandı!");

      setTitle("");
      setMeetingDate(new Date());
      setLocationName("");
      setLatitude(null);
      setLongitude(null);
      queryClient.invalidateQueries({ queryKey: ["meetings", coupleId] });
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
    } catch (error: any) {
      Alert.alert("Hata", "İşlem gerçekleştirilemedi. Lütfen daha sonra tekrar deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (m: any) => {
    if (m.user_id && m.user_id !== userId) {
      Alert.alert("Yetkisiz", "Bu buluşmayı yalnızca oluşturan kişi silebilir.");
      return;
    }

    Alert.alert("Buluşmayı Sil", "Bu buluşmayı silmek istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("meetings")
            .delete()
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
  const activeMeetings = meetings?.filter(m => new Date(m.meeting_datetime) >= now && m.is_active) || [];

  return (
    <ScreenBackground>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={{ width: 38 }} />
        <Text style={styles.headerTitle}>Buluşmalar 📍</Text>
        <TouchableOpacity onPress={() => router.push("/menu")} style={[styles.menuBtn, { backgroundColor: "rgba(0,0,0,0.3)" }]}>
          <AlignJustify color="rgba(255,255,255,0.7)" size={22} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* AKTİF BULUŞMALAR */}
        <View style={{ gap: 12 }}>
          <Text style={styles.sectionTitle}>AKTİF BULUŞMALAR</Text>

          {isLoading ? (
            <Skeleton height={140} borderRadius={16} />
          ) : activeMeetings.length > 0 ? (
            activeMeetings.map((m) => {
              const isCreator = m.user_id === userId;
              return (
                <View key={m.id} style={[styles.meetingCard, { backgroundColor: theme.cardBg }]}>
                  <View style={styles.meetingHeader}>
                    <Text style={styles.meetingTitle}>{m.title}</Text>
                    {isCreator && (
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <TouchableOpacity style={{ opacity: 0.6 }} onPress={() => {/* Edit could be handled but not in design */}}>
                          {/* Design only has delete and something else maybe edit icon but faded? Actually design shows a tag icon and a delete icon. Let's just use Trash2 */}
                          {/* Actually design shows a Tag (or Paint) icon and a Trash icon. */}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDelete(m)}>
                          <Trash2 color="#ef4444" size={20} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  <Text style={styles.meetingDate}>
                    {dayjs(m.meeting_datetime).locale("tr").format("D MMMM YYYY, dddd - HH:mm")}
                  </Text>
                  
                  {m.location_name ? (
                    <View style={styles.locationRow}>
                      <MapPin color="rgba(255,255,255,0.6)" size={14} />
                      <Text style={styles.locationText}>Seçili Konum: {m.location_name}</Text>
                    </View>
                  ) : null}

                  {(m.latitude && m.longitude) || m.location_name ? (
                    <TouchableOpacity
                      style={styles.directionsBtn}
                      onPress={() => {
                        if (m.latitude && m.longitude) {
                          const url = Platform.select({
                            ios: `maps://app?daddr=${m.latitude},${m.longitude}`,
                            android: `google.navigation:q=${m.latitude},${m.longitude}`
                          }) || `https://www.google.com/maps/dir/?api=1&destination=${m.latitude},${m.longitude}`;
                          Linking.openURL(url);
                        }
                      }}
                    >
                      <Text style={styles.directionsBtnText}>Yol Tarifi Al 🗺️</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })
          ) : null}

          {/* Add Meeting Button */}
          <TouchableOpacity
            style={[styles.addMeetingBtn, { backgroundColor: theme.accent }]}
            onPress={() => {
              // Can scroll to form if needed
            }}
          >
            <Text style={styles.addMeetingBtnText}>+ Buluşma Ekle</Text>
          </TouchableOpacity>
        </View>

        {/* YENİ BULUŞMA PLANLA (Form inline) */}
        <View style={[styles.planCard, { backgroundColor: theme.cardBg }]}>
          <View style={styles.planCardHeader}>
            <View style={styles.planCardHeaderLine} />
            <Text style={styles.planCardTitle}>Yeni Buluşma Planla</Text>
          </View>

          <Text style={styles.label}>Başlık</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg }]}
            placeholder="Buluşma adını girin..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={title}
            onChangeText={setTitle}
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.label}>Tarih & Saat</Text>
              <TouchableOpacity style={[styles.input, { backgroundColor: theme.inputBg, flexDirection: 'row', alignItems: 'center' }]} onPress={() => setShowDatePicker(true)}>
                <View style={{ marginRight: 8 }}>
                  <Text style={{ fontSize: 16 }}>🗓️</Text>
                </View>
                <Text style={styles.inputText}>{dayjs(meetingDate).format("DD.MM.YYYY")}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Saat</Text>
              <TouchableOpacity style={[styles.input, { backgroundColor: theme.inputBg, justifyContent: 'center' }]} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.inputText}>{dayjs(meetingDate).format("HH:mm")}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.label}>Konum (İsteğe Bağlı)</Text>
          <View style={styles.locationInputWrapper}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, paddingRight: 80 }]}
              placeholder="Konum arayın..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={locationName}
              onChangeText={setLocationName}
            />
            <TouchableOpacity style={[styles.mapSelectBtn, { backgroundColor: theme.unitBg }]} onPress={() => setShowMapModal(true)}>
              <Text style={styles.mapSelectBtnText}>Harita</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: theme.accent }]}
            onPress={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>+ Planla</Text>
            )}
          </TouchableOpacity>
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
      </ScrollView>

      <MapPickerModal 
        visible={showMapModal} 
        onClose={() => setShowMapModal(false)}
        initialLocation={latitude && longitude ? { latitude, longitude } : undefined}
        onSelectLocation={(loc) => {
          setLatitude(loc.latitude);
          setLongitude(loc.longitude);
          if (!locationName) setLocationName(loc.locationName || "");
        }}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  menuBtn: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 28,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    textAlign: "center",
  },
  container: {
    padding: 16,
    gap: 20,
    paddingBottom: 110,
  },
  sectionTitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
    letterSpacing: 1,
  },
  meetingCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  meetingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  meetingTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  meetingDate: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginTop: 6,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  locationText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },
  directionsBtn: {
    backgroundColor: "#4ADE80",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  directionsBtnText: {
    color: "#1c1c1e",
    fontSize: 15,
    fontWeight: "700",
  },
  addMeetingBtn: {
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
  },
  addMeetingBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  planCard: {
    borderRadius: 20,
    padding: 20,
    marginTop: 10,
  },
  planCardHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  planCardHeaderLine: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    marginBottom: 12,
  },
  planCardTitle: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    textAlign: "left",
    alignSelf: "flex-start",
  },
  label: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    color: "#fff",
    fontSize: 15,
  },
  inputText: {
    color: "#fff",
    fontSize: 15,
  },
  row: {
    flexDirection: "row",
  },
  locationInputWrapper: {
    position: "relative",
    justifyContent: "center",
  },
  mapSelectBtn: {
    position: "absolute",
    right: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mapSelectBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  submitBtn: {
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
