import React, { useCallback,  useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Platform, KeyboardAvoidingView } from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pill, CheckCircle2, Check, X, Settings, Trash2, User, Users, Edit2, ChevronLeft, Menu, Save } from "lucide-react-native";
import { getTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { dayjs, todayString } from "@/lib/date";
import DateTimePicker from "@react-native-community/datetimepicker";

const getRelativeDateLabel = (dateStr: string) => {
  const d = dayjs(dateStr);
  if (d.isSame(dayjs(), "day")) return "Bugün";
  if (d.isSame(dayjs().subtract(1, "day"), "day")) return "Dün";
  return d.format("D MMM");
};

export default function MedicineScreen() {
  const { profile, session } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const coupleId = profile?.coupleId;
  const userId = session?.user?.id ? session.user.id : null;

  const todayStr = todayString();
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null);
  const [showManagerModal, setShowManagerModal] = useState(false);

  // Form State
  const [medName, setMedName] = useState("");
  const [medError, setMedError] = useState(false);
  const [medStartDate, setMedStartDate] = useState(new Date());
  const [medEndDate, setMedEndDate] = useState(new Date());
  const [medFrequency, setMedFrequency] = useState<1 | 2 | 3>(1);
  const [medTimes, setMedTimes] = useState<Date[]>([new Date()]);
  const [activeTimeIndex, setActiveTimeIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [editingMedicineId, setEditingMedicineId] = useState<number | null>(null);

  const [activeTab, setActiveTab] = useState<"me" | "partner">("me");
  const [isPartnerAdd, setIsPartnerAdd] = useState(false);

  // Picker State
  const [showPicker, setShowPicker] = useState<"start" | "end" | "time" | null>(null);

  const fourteenDaysAgo = dayjs().subtract(14, "day").format("YYYY-MM-DD");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["medicine_data", coupleId],
    enabled: !!coupleId && !!userId,
    queryFn: async () => {
      const [medsRes, todayLogsRes, historicalLogsRes] = await Promise.all([
        supabase
          .from("medicines")
          .select("id, name, time, times, start_date, end_date, is_active, user_id")
          .eq("couple_id", coupleId)
          .eq("is_active", true)
          .lte("start_date", todayStr)
          .gte("end_date", todayStr)
          .order("time"),
        supabase
          .from("medicine_logs")
          .select("medicine_id, status, date, time, user_id")
          .eq("couple_id", coupleId)
          .eq("date", todayStr),
        supabase
          .from("medicine_logs")
          .select("medicine_id, status, date, time, user_id")
          .eq("couple_id", coupleId)
          .gte("date", fourteenDaysAgo)
          .lt("date", todayStr)
          .order("date", { ascending: false }),
      ]);

      if (medsRes.error) throw medsRes.error;
      if (todayLogsRes.error) throw todayLogsRes.error;
      if (historicalLogsRes.error) throw historicalLogsRes.error;

      return {
        medicines: medsRes.data || [],
        todayLogs: todayLogsRes.data || [],
        historicalLogs: historicalLogsRes.data || [],
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const updateLogMutation = useMutation({
    mutationFn: async ({ medicineId, status, timeSlot }: { medicineId: number; status: string; timeSlot: string }) => {
      const safeTimeSlot = (timeSlot && timeSlot.trim() !== "") ? timeSlot.trim() : "08:00";
      const safeUserId = userId;
      const safeCoupleId = coupleId ?? null;

      // Use RPC to atomically upsert — avoids all PostgREST DEFAULT issues
      const { error } = await supabase.rpc("log_medicine_dose", {
        p_medicine_id: medicineId,
        p_date: todayStr,
        p_time: safeTimeSlot,
        p_status: status,
        p_couple_id: safeCoupleId,
      });

      if (error) throw error;
    },
    onMutate: async ({ medicineId, status, timeSlot }) => {
      setLoadingSlot(`${medicineId}_${timeSlot}`);
      
      await queryClient.cancelQueries({ queryKey: ["medicine_data", coupleId] });
      const previousData = queryClient.getQueryData(["medicine_data", coupleId]);
      
      queryClient.setQueryData(["medicine_data", coupleId], (old: any) => {
        if (!old) return old;
        const newLogs = [...old.todayLogs];
        const idx = newLogs.findIndex((l: any) => l.medicine_id === medicineId && l.time === timeSlot && l.user_id === userId);
        
        if (idx >= 0) {
          newLogs[idx] = { ...newLogs[idx], status };
        } else {
          newLogs.push({
            medicine_id: medicineId,
            status,
            date: todayStr,
            time: timeSlot,
            user_id: userId
          });
        }
        return { ...old, todayLogs: newLogs };
      });
      
      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicine_data"] });
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
    },
    onError: (error, newLog, context: any) => {
      Alert.alert("Hata", "İşlem başarısız oldu. Lütfen tekrar deneyin.");
      if (context?.previousData) {
        queryClient.setQueryData(["medicine_data", coupleId], context.previousData);
      }
    },
    onSettled: () => {
      setLoadingSlot(null);
    },
  });

  const handleLog = (medicineId: number, status: string, timeSlot: string) => {
    updateLogMutation.mutate({ medicineId, status, timeSlot });
  };

  const handleAddMedicine = async () => {
    if (!medName.trim()) {
      setMedError(true);
      Alert.alert("Hata", "Lütfen ilaç adını girin.");
      return;
    }

    const now = new Date();
    const formattedStart = dayjs(medStartDate).format("YYYY-MM-DD");
    const todayStrFormat = dayjs().format("YYYY-MM-DD");
    const isToday = formattedStart === todayStrFormat;
    
    if (dayjs(formattedStart).isBefore(dayjs(todayStrFormat))) {
       Alert.alert("Hata", "Geçmiş bir tarihe ilaç ekleyemezsiniz!");
       return;
    }
    
    if (isToday) {
       const allPast = medTimes.every(t => {
           const timeDate = new Date();
           timeDate.setHours(t.getHours(), t.getMinutes(), 0, 0);
           return timeDate < now;
       });
       if (allPast) {
           Alert.alert("Hata", "Seçtiğiniz saatler geçmişte. Lütfen ileri bir saat seçin veya tarihi yarına alın.");
           return;
       }
    }

    setIsSubmitting(true);
    
    let targetUserId = userId;
    if (isPartnerAdd) {
      const { data: partner } = await supabase.from("users").select("id").eq("couple_id", coupleId).neq("id", userId).single();
      if (partner) targetUserId = partner.id;
    }

    const formattedEnd = dayjs(medEndDate).format("YYYY-MM-DD");
    const formattedTimes = medTimes.map(t => dayjs(t).format("HH:mm"));

    if (editingMedicineId) {
      const { error } = await supabase.from("medicines").update({
        name: medName,
        start_date: formattedStart,
        end_date: formattedEnd,
        time: formattedTimes[0],
        times: formattedTimes,
      }).eq("id", editingMedicineId).eq("couple_id", coupleId);
      
      setIsSubmitting(false);
      
      if (error) {
        Alert.alert("Hata", "İlaç güncellenirken hata oluştu.");
      } else {
        resetForm();
        refetch();
      }
    } else {
      const medInsertPayload: any = {
        name: medName,
        start_date: formattedStart,
        end_date: formattedEnd,
        time: formattedTimes[0],
        times: formattedTimes,
        user_id: targetUserId,
        is_active: true,
      };
      if (coupleId) medInsertPayload.couple_id = coupleId;
      const { error } = await supabase.from("medicines").insert(medInsertPayload);

      setIsSubmitting(false);

      if (error) {
        Alert.alert("Hata", "İlaç eklenirken hata oluştu.");
      } else {
        resetForm();
        refetch();
      }
    }
  };

  const resetForm = () => {
    setMedName("");
    setMedStartDate(new Date());
    setMedEndDate(new Date());
    setMedFrequency(1);
    setMedTimes([new Date()]);
    setMedError(false);
    setEditingMedicineId(null);
    queryClient.invalidateQueries({ queryKey: ["medicine_data"] });
  };

  const handleEditMedicine = (med: any) => {
    setEditingMedicineId(med.id);
    setMedName(med.name);
    setMedStartDate(new Date(med.start_date));
    setMedEndDate(new Date(med.end_date));
    
    setIsPartnerAdd(med.user_id !== userId);
    
    if (med.times && Array.isArray(med.times) && med.times.length > 0) {
      setMedFrequency(Math.min(3, med.times.length) as 1 | 2 | 3);
      const timesArr = med.times.map((t: string) => {
        const [h, m] = t.split(":");
        const d = new Date();
        d.setHours(parseInt(h, 10));
        d.setMinutes(parseInt(m, 10));
        return d;
      });
      setMedTimes(timesArr.slice(0, 3));
    } else if (med.time) {
      setMedFrequency(1);
      const [h, m] = med.time.split(":");
      const d = new Date();
      d.setHours(parseInt(h, 10));
      d.setMinutes(parseInt(m, 10));
      setMedTimes([d]);
    }
  };

  const handleDeleteMedicine = async (id: number) => {
    Alert.alert("İlacı Sil", "Bu ilacı silmek istediğinize emin misiniz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil", style: "destructive", onPress: async () => {
          setIsDeleting(id);
          const { error } = await supabase.from("medicines").delete().eq("id", id).eq("couple_id", coupleId);
          setIsDeleting(null);
          if (error) {
            Alert.alert("Hata", "Silinirken hata oluştu.");
          } else {
            refetch();
          }
        }
      }
    ]);
  };

  const allMedicines = data?.medicines || [];
  const filteredMedicines = allMedicines.filter(m => activeTab === "me" ? m.user_id === userId : m.user_id !== userId);
  const todayLogs = data?.todayLogs || [];
  
  const map: Record<string, string> = {};
  todayLogs.forEach((log) => {
    const timeKey = log.time ? log.time.substring(0, 5) : "";
    if (timeKey) map[`${log.medicine_id}_${timeKey}`] = log.status;
  });
  
  filteredMedicines.forEach((m) => {
    const medTimes = Array.isArray(m.times) && m.times.length > 0 ? m.times.map((t) => t.substring(0, 5)) : [m.time ? m.time.substring(0, 5) : "08:00"];
    medTimes.forEach((t) => {
      const key = `${m.id}_${t}`;
      if (!map[key]) {
        const legacyLog = todayLogs.find((l) => l.medicine_id === m.id && (!l.time || l.time === ""));
        map[key] = legacyLog ? legacyLog.status : "PENDING";
      }
    });
  });

  const now = new Date();
  const currentTimeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const theme = getTheme(profile?.gender);

  // Group history logs
  const historyGrouped: Record<string, any[]> = {};
  data?.historicalLogs?.forEach(log => {
    if (activeTab === "me" && log.user_id !== userId) return;
    if (activeTab === "partner" && log.user_id === userId) return;
    
    if (!historyGrouped[log.date]) historyGrouped[log.date] = [];
    
    const med = allMedicines.find(m => m.id === log.medicine_id);
    if (med) {
      let entry = historyGrouped[log.date].find(e => e.medicine_id === log.medicine_id);
      if (!entry) {
        const timesArr = Array.isArray(med.times) ? med.times : [med.time];
        entry = {
          medicine_id: med.id,
          name: med.name,
          totalSlots: timesArr.length,
          drankSlots: 0,
          times: timesArr.map(t => t.substring(0, 5)),
        };
        historyGrouped[log.date].push(entry);
      }
      if (log.status === "DRANK") {
        entry.drankSlots += 1;
      }
    }
  });

  const sortedDates = Object.keys(historyGrouped).sort((a, b) => b.localeCompare(a));

  return (
    <ScreenBackground style={styles.container}>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>İlaç Takibi</Text>
              <Text style={styles.titleEmoji}>💊</Text>
            </View>
            <Text style={styles.dateText}>Sağlığınız bizim için çok önemli</Text>
          </View>

          {/* Segmented Control */}
          <View style={[styles.tabsContainer, { backgroundColor: theme.cardBg }]}>
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === "me" && { backgroundColor: theme.unitBg }]}
              onPress={() => setActiveTab("me")}
            >
              <Text style={[styles.tabText, activeTab === "me" && { color: theme.accent }]}>Ben</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === "partner" && { backgroundColor: theme.unitBg }]}
              onPress={() => setActiveTab("partner")}
            >
              <Text style={[styles.tabText, activeTab === "partner" && { color: theme.accent }]}>Sevgilim</Text>
            </TouchableOpacity>
          </View>

          {/* Today's Medicines */}
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>Bugünün İlaçları</Text>
            
            {isLoading ? (
              <View style={{ gap: 16, marginTop: 20 }}>
                <Skeleton height={140} borderRadius={16} />
                <Skeleton height={140} borderRadius={16} />
              </View>
            ) : filteredMedicines.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 40 }}>💊</Text>
                <Text style={styles.emptyText}>
                  {activeTab === "partner" ? "Sevgilinin aktif ilacı yok" : "Bugün için aktif ilaç yok"}
                </Text>
              </View>
            ) : (
              filteredMedicines.map((m) => {
                const medTimes = Array.isArray(m.times) && m.times.length > 0 ? m.times.map((t) => t.substring(0, 5)) : [m.time ? m.time.substring(0, 5) : "08:00"];
                const firstTime = medTimes[0];
                const firstTimeKey = `${m.id}_${firstTime}`;
                const firstTimeStatus = map[firstTimeKey] || "PENDING";

                return (
                  <View key={m.id} style={[styles.medCard, { backgroundColor: theme.cardBg }]}>
                    <View style={styles.medCardTopRow}>
                      <View style={styles.medIconBox}>
                        <Pill color="#E8002D" size={24} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.medName}>{m.name}</Text>
                        <Text style={styles.medSubtitle}>Günde {medTimes.length} kez ({medTimes.join(", ")})</Text>
                      </View>
                      {firstTimeStatus === "DRANK" && (
                        <View style={styles.drankBadge}>
                          <Text style={styles.drankBadgeText}>Sabah İçildi</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.slotsContainer}>
                      {medTimes.map((slotTime) => {
                        const key = `${m.id}_${slotTime}`;
                        const status = map[key] || "PENDING";
                        const isDrank = status === "DRANK";
                        const isMissed = status === "MISSED";
                        const isSlotLoading = loadingSlot === key;
                        
                        const now = new Date();
                        const currentHour = now.getHours().toString().padStart(2, "0");
                        const currentMin = now.getMinutes().toString().padStart(2, "0");
                        const currentHMS = `${currentHour}:${currentMin}`;
                        const isTimePassed = currentHMS >= slotTime;

                        if (isSlotLoading) {
                          return (
                            <View key={slotTime} style={[styles.slotLoading, { width: "100%" }]}>
                              <ActivityIndicator color="#fff" />
                            </View>
                          );
                        }

                        if (isDrank) {
                          return (
                            <View key={slotTime} style={[styles.statusBox, { width: "100%", backgroundColor: "#22C55E", borderColor: "#22C55E" }]}>
                              <CheckCircle2 size={16} color="#fff" />
                              <Text style={[styles.statusText, { color: "#fff" }]}>Alındı ({slotTime})</Text>
                            </View>
                          );
                        }

                        if (isMissed) {
                          return (
                            <View key={slotTime} style={[styles.statusBox, { width: "100%", backgroundColor: theme.unitBg, borderColor: theme.unitBg }]}>
                              <Text style={[styles.statusText, { color: "rgba(255,255,255,0.6)" }]}>Atlandı ({slotTime})</Text>
                            </View>
                          );
                        }
                        
                        if (!isTimePassed) {
                          return (
                            <View key={slotTime} style={[styles.statusBox, { width: "100%", backgroundColor: theme.unitBg, borderColor: theme.unitBg }]}>
                              <Text style={[styles.statusText, { color: "rgba(255,255,255,0.6)" }]}>Bekliyor ({slotTime})</Text>
                            </View>
                          );
                        }

                        if (activeTab === "partner") {
                           return (
                            <View key={slotTime} style={[styles.statusBox, { width: "100%", backgroundColor: theme.unitBg, borderColor: theme.unitBg }]}>
                              <Text style={[styles.statusText, { color: "rgba(255,255,255,0.6)" }]}>İçilmedi ({slotTime})</Text>
                            </View>
                          );
                        }

                        return (
                          <View key={slotTime} style={{ flexDirection: "row", gap: 8, width: "100%" }}>
                            <TouchableOpacity style={[styles.missBtn, { backgroundColor: theme.unitBg }]} onPress={() => handleLog(m.id, "MISSED", slotTime)}>
                              <Text style={styles.missBtnText}>Atla</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.drankBtn, { borderColor: theme.accent }]} onPress={() => handleLog(m.id, "DRANK", slotTime)}>
                              <Text style={[styles.drankBtnText, { color: theme.accent }]}>İçtim</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}

            {/* History Section */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Geçmiş (Son 14 Gün)</Text>
            {sortedDates.length === 0 ? (
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 10 }}>Kayıt bulunamadı.</Text>
            ) : (
              sortedDates.map((dateStr) => (
                <React.Fragment key={dateStr}>
                  {historyGrouped[dateStr].map((med, idx) => {
                    const isAllDrank = med.drankSlots === med.totalSlots;
                    const iconColor = isAllDrank ? "#22C55E" : "#EAB308";
                    return (
                      <View key={`${dateStr}-${idx}`} style={[styles.historyCard, { backgroundColor: theme.cardBg }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyDate}>{getRelativeDateLabel(dateStr)}</Text>
                          <Text style={styles.historySubtitle}>
                            {med.name} ({med.drankSlots}/{med.totalSlots} Alındı) • {med.times.join(" & ")}
                          </Text>
                        </View>
                        <CheckCircle2 color={iconColor} size={22} />
                      </View>
                    );
                  })}
                </React.Fragment>
              ))
            )}

            <TouchableOpacity style={[styles.addBtn, { borderColor: theme.accent }]} onPress={() => setShowManagerModal(true)}>
              <Settings color={theme.accent} size={18} />
              <Text style={[styles.addBtnText, { color: theme.accent }]}>İlaç Yönetimi</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* İLAÇ YÖNETİMİ MODALI */}
      <Modal visible={showManagerModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
              {/* Header Title */}
              <View style={styles.modalHeaderTitle}>
                <Text style={styles.modalTitle}>İlaç Yönetimi</Text>
                <TouchableOpacity onPress={() => setShowManagerModal(false)} style={styles.closeModalBtn}>
                  <X color="rgba(255,255,255,0.6)" size={16} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: "85%" }} showsVerticalScrollIndicator={false}>
                {/* Mevcut İlaçlar */}
                <View style={{ marginBottom: 24 }}>
                  <Text style={styles.modalSectionLabel}>MEVCUT İLAÇLAR</Text>
                  {allMedicines.length === 0 && <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Kayıtlı ilaç yok.</Text>}
                  {allMedicines.map((m) => (
                    <View key={m.id} style={[styles.modalMedCard, { backgroundColor: theme.unitBg }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalMedName}>{m.name}</Text>
                        <Text style={styles.modalMedSubtitle}>
                          {m.user_id === userId ? "Ben" : "Sevgilim"} • Günde {Array.isArray(m.times) ? m.times.length : 1} Kez
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                        <TouchableOpacity onPress={() => handleEditMedicine(m)}>
                          <Edit2 size={18} color="rgba(255,255,255,0.6)" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteMedicine(m.id)} disabled={isDeleting === m.id}>
                          {isDeleting === m.id ? <ActivityIndicator size="small" color="#E8002D" /> : <Trash2 size={18} color="#FF5252" />}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Yeni İlaç Ekle */}
                <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 20 }}>
                  <Text style={styles.modalSectionLabel}>{editingMedicineId ? "İLACI DÜZENLE" : "YENİ İLAÇ EKLE"}</Text>
                  
                  {/* Segmented Control for Who */}
                  <View style={[styles.tabsContainer, { backgroundColor: theme.unitBg, marginBottom: 16 }]}>
                    <TouchableOpacity 
                      style={[styles.tabBtn, !isPartnerAdd && { backgroundColor: theme.cardBg }]}
                      onPress={() => setIsPartnerAdd(false)}
                    >
                      <Text style={[styles.tabText, !isPartnerAdd && { color: theme.accent }]}>Ben</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.tabBtn, isPartnerAdd && { backgroundColor: theme.cardBg }]}
                      onPress={() => setIsPartnerAdd(true)}
                    >
                      <Text style={[styles.tabText, isPartnerAdd && { color: theme.accent }]}>Sevgilim</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={[styles.label, medError && { color: "red" }]}>İlaç Adı</Text>
                    <TextInput 
                      style={[styles.input, { backgroundColor: theme.unitBg }, medError && { borderColor: "red" }]} 
                      placeholder="Parol" 
                      placeholderTextColor="rgba(255,255,255,0.3)" 
                      value={medName} 
                      onChangeText={(text) => {
                        setMedName(text);
                        setMedError(false);
                      }} 
                    />
                  </View>

                  <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Başlangıç</Text>
                      <TouchableOpacity style={[styles.input, { backgroundColor: theme.unitBg }]} onPress={() => setShowPicker("start")}>
                        <Text style={{ color: "#fff" }}>{dayjs(medStartDate).format("DD.MM.YYYY")}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label}>Bitiş</Text>
                      <TouchableOpacity style={[styles.input, { backgroundColor: theme.unitBg }]} onPress={() => setShowPicker("end")}>
                        <Text style={{ color: "#fff" }}>{dayjs(medEndDate).format("DD.MM.YYYY")}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Günde Kaç Kez?</Text>
                    <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                      {[1, 2, 3].map((num) => (
                        <TouchableOpacity 
                          key={num}
                          onPress={() => {
                            setMedFrequency(num as 1|2|3);
                            const newTimes = [...medTimes];
                            if (newTimes.length < num) {
                              while(newTimes.length < num) newTimes.push(new Date());
                            } else if (newTimes.length > num) {
                              newTimes.splice(num);
                            }
                            setMedTimes(newTimes);
                          }}
                          style={[
                            styles.freqBtn, 
                            { backgroundColor: medFrequency === num ? theme.accent : "transparent", borderColor: medFrequency === num ? theme.accent : "rgba(255,255,255,0.1)" }
                          ]}
                        >
                          <Text style={[styles.freqText, medFrequency === num && { color: "#fff", fontFamily: "Inter_700Bold" }]}>{num} Kez</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    
                    {medTimes.length > 0 && (
                      <>
                        <Text style={styles.label}>Alım Saatleri</Text>
                        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                          {medTimes.map((t, index) => (
                            <TouchableOpacity key={index} style={[styles.input, { backgroundColor: theme.unitBg, flex: 1, minWidth: "30%" }]} onPress={() => { setActiveTimeIndex(index); setShowPicker("time"); }}>
                              <Text style={{ color: "#fff", textAlign: "center" }}>{dayjs(t).format("HH:mm")}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}
                  </View>

                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.accent }]} onPress={handleAddMedicine} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.saveBtnText}>{editingMedicineId ? "Güncelle" : "Kaydet"}</Text>
                    )}
                  </TouchableOpacity>
                  
                  {editingMedicineId && (
                    <TouchableOpacity 
                      style={{ marginTop: 12, paddingVertical: 12, alignItems: "center" }}
                      onPress={resetForm}
                    >
                      <Text style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Inter_600SemiBold" }}>İptal</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* DateTime Picker */}
      {showPicker && (
        <DateTimePicker
          value={showPicker === "start" ? medStartDate : showPicker === "end" ? medEndDate : (activeTimeIndex !== null ? medTimes[activeTimeIndex] : new Date())}
          mode={showPicker === "time" ? "time" : "date"}
          is24Hour={true}
          display="default"
          onChange={(event, selectedDate) => {
            const currentMode = showPicker;
            const currentIdx = activeTimeIndex;
            setShowPicker(Platform.OS === 'ios' ? currentMode : null);
            if (selectedDate) {
              if (currentMode === "start") setMedStartDate(selectedDate);
              else if (currentMode === "end") setMedEndDate(selectedDate);
              else if (currentMode === "time" && currentIdx !== null) {
                const newTimes = [...medTimes];
                newTimes[currentIdx] = selectedDate;
                setMedTimes(newTimes);
              }
            }
          }}
        />
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  header: { alignItems: "center", paddingTop: 40, paddingBottom: 20 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 },
  title: { fontSize: 34, fontFamily: "PlayfairDisplay_400Regular_Italic", color: "#fff" },
  titleEmoji: { fontSize: 28 },
  dateText: { fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular" },
  
  tabsContainer: { flexDirection: "row", marginHorizontal: 20, marginBottom: 24, borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  tabText: { color: "rgba(255,255,255,0.4)", fontFamily: "Inter_600SemiBold", fontSize: 14 },

  listSection: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 24, fontFamily: "PlayfairDisplay_400Regular_Italic", color: "#fff", marginBottom: 14 },
  emptyState: { alignItems: "center", paddingVertical: 40, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderStyle: "dashed" },
  emptyText: { color: "rgba(255,255,255,0.5)", marginTop: 10, fontFamily: "Inter_400Regular" },
  
  medCard: { borderRadius: 20, padding: 16, marginBottom: 16 },
  medCardTopRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16 },
  medIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(232,0,45,0.15)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  medName: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 2 },
  medSubtitle: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "Inter_400Regular" },
  drankBadge: { backgroundColor: "rgba(34,197,94,0.15)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  drankBadgeText: { color: "#22c55e", fontSize: 11, fontFamily: "Inter_600SemiBold" },

  slotsContainer: { width: "100%", flexDirection: "column", gap: 8 },
  slotLoading: { paddingVertical: 14, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, alignItems: "center" },
  statusBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 12 },
  statusText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  
  missBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  missBtnText: { color: "rgba(255,255,255,0.6)", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  drankBtn: { flex: 1, paddingVertical: 14, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  drankBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14 },

  historyCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, marginBottom: 8 },
  historyDate: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
  historySubtitle: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "Inter_400Regular" },

  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, paddingVertical: 16, borderRadius: 20, marginTop: 10 },
  addBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 16 },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { width: "100%", maxWidth: 450, borderRadius: 30, padding: 24, paddingBottom: 30, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  modalHeaderTitle: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 24, position: "relative" },
  modalTitle: { color: "#fff", fontSize: 24, fontFamily: "PlayfairDisplay_400Regular_Italic" },
  closeModalBtn: { position: "absolute", right: 0, padding: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16 },
  
  modalSectionLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, marginBottom: 12 },
  modalMedCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 16, marginBottom: 12 },
  modalMedName: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
  modalMedSubtitle: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "Inter_400Regular" },

  formGroup: { marginBottom: 16 },
  label: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 8, fontFamily: "Inter_500Medium" },
  input: { borderRadius: 12, color: "#fff", padding: 14, fontSize: 15, fontFamily: "Inter_400Regular" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16, paddingVertical: 16, marginTop: 16 },
  saveBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  
  freqBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  freqText: { color: "rgba(255,255,255,0.6)", fontFamily: "Inter_500Medium", fontSize: 14 },
});
