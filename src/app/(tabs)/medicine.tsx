import React, { useCallback,  useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, Platform, KeyboardAvoidingView } from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pill, Trophy, Check, X, Plus, Save, ChevronLeft, Menu, Settings, Trash2, User, Users, Edit2 } from "lucide-react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { dayjs, todayString } from "@/lib/date";
import DateTimePicker from "@react-native-community/datetimepicker";

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



  return (
    <ScreenBackground style={styles.container}>
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 20 }}>
              <TouchableOpacity onPress={() => router.back()} style={{ padding: 8, marginLeft: -8 }}>
                <ChevronLeft color="#fff" size={28} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, marginRight: -8 }}>
                <Menu color="#fff" size={24} />
              </TouchableOpacity>
            </View>
            <Text style={styles.title}>İLAÇ TAKİBİ 💊</Text>
            <Text style={styles.dateText}>{dayjs().locale("tr").format("D MMMM YYYY, dddd")}</Text>
          </View>

          {/* TABS */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === "me" && styles.tabBtnActive]}
              onPress={() => setActiveTab("me")}
            >
              <Text style={[styles.tabText, activeTab === "me" && styles.tabTextActive]}>Ben</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === "partner" && styles.tabBtnActive]}
              onPress={() => setActiveTab("partner")}
            >
              <Text style={[styles.tabText, activeTab === "partner" && styles.tabTextActive]}>Sevgilim</Text>
            </TouchableOpacity>
          </View>

          {/* Medicines List */}
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>
              Bugünün İlaçları {activeTab === "partner" ? "(Sevgilimin)" : ""}
            </Text>
            
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

                return (
                  <View key={m.id} style={styles.medCard}>
                    <Text style={styles.medName}>{m.name}</Text>
                    <Text style={styles.medSubtitle}>Günde {medTimes.length} kez ({medTimes.join(", ")})</Text>

                    <View style={styles.slotsContainer}>
                      {medTimes.map((slotTime) => {
                        const key = `${m.id}_${slotTime}`;
                        const status = map[key] || "PENDING";
                        const isDrank = status === "DRANK";
                        const isMissed = status === "MISSED";
                        const isTimePassed = currentTimeStr >= slotTime;
                        const isSlotLoading = loadingSlot === key;

                        if (isSlotLoading) {
                          return (
                            <View key={slotTime} style={styles.slotLoading}>
                              <ActivityIndicator color="#fff" />
                            </View>
                          );
                        }

                        if (isDrank) {
                          return (
                            <View key={slotTime} style={[styles.statusBox, { borderColor: "#22C55E", backgroundColor: "rgba(34,197,94,0.15)" }]}>
                              <Check size={16} color="#22C55E" />
                              <Text style={[styles.statusText, { color: "#22C55E" }]}>Alındı ({slotTime})</Text>
                            </View>
                          );
                        }

                        if (isMissed) {
                          return (
                            <View key={slotTime} style={[styles.statusBox, { borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.15)" }]}>
                              <X size={16} color="#ef4444" />
                              <Text style={[styles.statusText, { color: "#ef4444" }]}>Atlandı ({slotTime})</Text>
                            </View>
                          );
                        }

                        if (!isTimePassed) {
                          return (
                            <View key={slotTime} style={[styles.statusBox, { borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.05)" }]}>
                              <Text style={[styles.statusText, { color: "rgba(255,255,255,0.5)" }]}>Bekliyor ({slotTime})</Text>
                            </View>
                          );
                        }

                        if (activeTab === "partner") {
                           return (
                            <View key={slotTime} style={[styles.statusBox, { borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.05)" }]}>
                              <Text style={[styles.statusText, { color: "rgba(255,255,255,0.5)" }]}>Bekliyor ({slotTime}) - İçilmedi</Text>
                            </View>
                          );
                        }

                        return (
                          <View key={slotTime} style={styles.actionButtonsRow}>
                            <TouchableOpacity style={styles.missBtn} onPress={() => handleLog(m.id, "MISSED", slotTime)}>
                              <Text style={styles.missBtnText}>Atla</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.drankBtn} onPress={() => handleLog(m.id, "DRANK", slotTime)}>
                              <Text style={styles.drankBtnText}>İçtim</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}

            <TouchableOpacity style={styles.addBtn} onPress={() => setShowManagerModal(true)}>
              <Settings color="#fff" size={20} />
              <Text style={styles.addBtnText}>İlaç Yönetimi</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* İLAÇ YÖNETİMİ MODALI */}
      <Modal visible={showManagerModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
            <TouchableOpacity onPress={() => setShowManagerModal(false)} style={styles.closeModalBtn}>
              <X color="rgba(255,255,255,0.5)" size={24} />
            </TouchableOpacity>
            
            <View style={styles.modalHeaderTitle}>
              <Settings color="#E8002D" size={22} />
              <Text style={styles.modalTitle}>İlaç Yönetimi</Text>
            </View>

            <ScrollView style={{ maxHeight: "85%" }} showsVerticalScrollIndicator={false}>
              {/* Mevcut İlaçlar */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 8, fontWeight: "600" }}>Mevcut İlaçlar</Text>
                {allMedicines.length === 0 && <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>Kayıtlı ilaç yok.</Text>}
                {allMedicines.map((m) => (
                  <View key={m.id} style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    padding: 12, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 12, marginBottom: 8,
                    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)"
                  }}>
                    <View>
                      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{m.name}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                        {m.user_id === userId ? "Benim İlacım" : "Sevgilimin İlacı"}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity 
                        onPress={() => handleEditMedicine(m)}
                        style={{ padding: 8, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 8 }}
                      >
                        <Edit2 size={16} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleDeleteMedicine(m.id)}
                        disabled={isDeleting === m.id}
                        style={{ padding: 8, backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 8 }}
                      >
                        {isDeleting === m.id ? <ActivityIndicator size="small" color="#ef4444" /> : <Trash2 size={16} color="#ef4444" />}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* Yeni İlaç Ekle */}
              <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 20 }}>
                <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 12, fontWeight: "600" }}>{editingMedicineId ? "İlacı Düzenle" : "Yeni İlaç Ekle"}</Text>
                
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                  <TouchableOpacity 
                    style={[styles.partnerToggleBtn, !isPartnerAdd && styles.partnerToggleBtnActive]}
                    onPress={() => setIsPartnerAdd(false)}
                  >
                    <User size={16} color={!isPartnerAdd ? "#E8002D" : "rgba(255,255,255,0.5)"} />
                    <Text style={[styles.partnerToggleText, !isPartnerAdd && { color: "#E8002D" }]}>Ben</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.partnerToggleBtn, isPartnerAdd && styles.partnerToggleBtnActive]}
                    onPress={() => setIsPartnerAdd(true)}
                  >
                    <Users size={16} color={isPartnerAdd ? "#E8002D" : "rgba(255,255,255,0.5)"} />
                    <Text style={[styles.partnerToggleText, isPartnerAdd && { color: "#E8002D" }]}>Sevgilim</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, medError && { color: "red" }]}>İlaç Adı</Text>
                  <TextInput 
                    style={[styles.input, medError && { borderColor: "red" }]} 
                    placeholder="Örn: Parol" 
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
                    <TouchableOpacity style={styles.input} onPress={() => setShowPicker("start")}>
                      <Text style={{ color: "#fff" }}>{dayjs(medStartDate).format("DD/MM/YYYY")}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Bitiş</Text>
                    <TouchableOpacity style={styles.input} onPress={() => setShowPicker("end")}>
                      <Text style={{ color: "#fff" }}>{dayjs(medEndDate).format("DD/MM/YYYY")}</Text>
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
                          medFrequency === num && styles.freqBtnActive
                        ]}
                      >
                        <Text style={[styles.freqText, medFrequency === num && styles.freqTextActive]}>{num} Kez</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  <Text style={styles.label}>Alım Saatleri</Text>
                  <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                    {medTimes.map((t, index) => (
                      <TouchableOpacity key={index} style={[styles.input, { flex: 1, minWidth: "30%" }]} onPress={() => { setActiveTimeIndex(index); setShowPicker("time"); }}>
                        <Text style={{ color: "#fff", textAlign: "center" }}>{dayjs(t).format("HH:mm")}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleAddMedicine} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Save color="#fff" size={20} />
                      <Text style={styles.saveBtnText}>{editingMedicineId ? "Güncelle" : "İlacı Kaydet"}</Text>
                    </>
                  )}
                </TouchableOpacity>
                {editingMedicineId && (
                  <TouchableOpacity 
                    style={{ marginTop: 12, paddingVertical: 12, alignItems: "center" }}
                    onPress={resetForm}
                  >
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontWeight: "600" }}>İptal</Text>
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
  header: { alignItems: "center", paddingTop: 20, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: "800", color: "#E8002D", letterSpacing: 1, marginBottom: 8 },
  dateText: { fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 8 },
  
  tabsContainer: { flexDirection: "row", marginHorizontal: 20, marginBottom: 20, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: "center" },
  tabBtnActive: { backgroundColor: "#fff" },
  tabText: { color: "rgba(255,255,255,0.5)", fontWeight: "700", fontSize: 14 },
  tabTextActive: { color: "#000" },

  listSection: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 16, color: "rgba(255,255,255,0.8)", marginBottom: 12 },
  emptyState: { alignItems: "center", paddingVertical: 40, backgroundColor: "#181a20", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", borderStyle: "dashed" },
  emptyText: { color: "rgba(255,255,255,0.5)", marginTop: 10 },
  
  medCard: { backgroundColor: "#181a20", borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 16, marginBottom: 16, alignItems: "center" },
  medName: { color: "#fff", fontSize: 18, fontWeight: "700" },
  medSubtitle: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4, marginBottom: 12 },
  slotsContainer: { width: "100%", alignItems: "center", gap: 10 },
  
  slotLoading: { paddingVertical: 12, width: 200, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, alignItems: "center" },
  statusBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, width: 220, borderRadius: 12, borderWidth: 1 },
  statusText: { fontSize: 14, fontWeight: "700" },
  actionButtonsRow: { flexDirection: "row", gap: 10, width: 230 },
  missBtn: { flex: 1, paddingVertical: 12, backgroundColor: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.3)", borderWidth: 1, borderRadius: 12, alignItems: "center" },
  missBtnText: { color: "#ef4444", fontWeight: "700" },
  drankBtn: { flex: 1, paddingVertical: 12, backgroundColor: "rgba(34,197,94,0.15)", borderColor: "rgba(34,197,94,0.3)", borderWidth: 1, borderRadius: 12, alignItems: "center" },
  drankBtnText: { color: "#22c55e", fontWeight: "700" },

  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1c1c1e", borderColor: "rgba(255,255,255,0.1)", borderWidth: 1, paddingVertical: 16, borderRadius: 16, marginTop: 10 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { width: "100%", maxWidth: 400, backgroundColor: "#1c1c1e", borderRadius: 24, padding: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  closeModalBtn: { position: "absolute", top: 16, right: 16, padding: 4, zIndex: 10 },
  modalHeaderTitle: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  formGroup: { marginBottom: 16 },
  label: { color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 6, fontWeight: "500" },
  input: { backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderRadius: 12, color: "#fff", padding: 14, fontSize: 15 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#E8002D", borderRadius: 12, paddingVertical: 16, marginTop: 10 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  
  partnerToggleBtn: { flex: 1, flexDirection: "row", paddingVertical: 12, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  partnerToggleBtnActive: { backgroundColor: "rgba(232,0,45,0.2)", borderColor: "#E8002D" },
  partnerToggleText: { color: "rgba(255,255,255,0.5)", fontWeight: "600", fontSize: 14 },
  
  freqBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  freqBtnActive: { backgroundColor: "rgba(232,0,45,0.2)", borderColor: "#E8002D" },
  freqText: { color: "rgba(255,255,255,0.5)", fontWeight: "600", fontSize: 14 },
  freqTextActive: { color: "#E8002D" }
});
