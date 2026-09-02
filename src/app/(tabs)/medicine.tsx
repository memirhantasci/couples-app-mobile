import React, { useState } from "react";
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Alert, Modal, TextInput, Platform 
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Pill, CheckCircle2, Check, X, Settings, Trash2, 
  Edit2, ChevronLeft, AlignJustify, Plus, Clock, 
  Calendar, AlertCircle, Sparkles, ChevronRight
} from "lucide-react-native";
import { getTheme } from "@/lib/theme";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { dayjs, todayString } from "@/lib/date";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

const getRelativeDateLabel = (dateStr: string) => {
  const d = dayjs(dateStr);
  if (d.isSame(dayjs(), "day")) return "Bugün";
  if (d.isSame(dayjs().subtract(1, "day"), "day")) return "Dün";
  return d.locale("tr").format("D MMMM");
};

export default function MedicineScreen() {
  const { profile, session } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const coupleId = profile?.coupleId;
  const userId = session?.user?.id ? session.user.id : null;
  const theme = getTheme(profile?.gender);

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

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["medicine_data", coupleId],
    enabled: !!coupleId && !!userId,
    queryFn: async () => {
      const [medsRes, todayLogsRes, historicalLogsRes] = await Promise.all([
        supabase
          .from("medicines")
          .select("id, name, time, times, start_date, end_date, is_active, user_id")
          .eq("couple_id", coupleId)
          .eq("is_active", true)
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
      const safeCoupleId = coupleId ?? null;

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
            date: todayStr,
            time: timeSlot,
            status,
            user_id: userId,
          });
        }
        return { ...old, todayLogs: newLogs };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["medicine_data", coupleId], context.previousData);
      }
      Alert.alert("Hata", "Durum güncellenirken bir sorun oluştu.");
    },
    onSettled: () => {
      setLoadingSlot(null);
      queryClient.invalidateQueries({ queryKey: ["medicine_data", coupleId] });
    },
  });

  const handleLog = (medicineId: number, status: string, timeSlot: string) => {
    updateLogMutation.mutate({ medicineId, status, timeSlot });
  };

  const handleFrequencyChange = (freq: 1 | 2 | 3) => {
    setMedFrequency(freq);
    const defaults = ["09:00", "14:00", "20:00"];
    const newTimes: Date[] = [];
    for (let i = 0; i < freq; i++) {
      const d = new Date();
      const [h, m] = defaults[i].split(":");
      d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
      newTimes.push(medTimes[i] || d);
    }
    const seen = new Set<string>();
    const finalTimes = newTimes.map((t, idx) => {
      const f = dayjs(t).format("HH:mm");
      if (seen.has(f)) {
        const d = new Date();
        const [h, m] = defaults[idx].split(":");
        d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
        seen.add(defaults[idx]);
        return d;
      }
      seen.add(f);
      return t;
    });
    setMedTimes(finalTimes);
  };

  const handleSaveMedicine = async () => {
    if (!medName.trim()) {
      setMedError(true);
      return;
    }
    if (!coupleId || !userId) return;

    const formattedTimes = medTimes.map(t => dayjs(t).format("HH:mm"));
    const uniqueTimes = new Set(formattedTimes);
    if (uniqueTimes.size !== formattedTimes.length) {
      Alert.alert("Uyarı", "Aynı ilaç için birden fazla aynı saat seçilemez. Lütfen farklı doz saatleri belirleyin.");
      return;
    }

    setIsSubmitting(true);
    try {
      let targetUserId = userId;
      if (isPartnerAdd) {
        const { data: partnerData } = await supabase
          .from("users")
          .select("id")
          .eq("couple_id", coupleId)
          .neq("id", userId)
          .maybeSingle();

        if (!partnerData?.id) {
          Alert.alert("Bilgi", "Partneriniz henüz eşleşmemiş.");
          setIsSubmitting(false);
          return;
        }
        targetUserId = partnerData.id;
      }

      const payload: any = {
        name: medName.trim(),
        start_date: dayjs(medStartDate).format("YYYY-MM-DD"),
        end_date: dayjs(medEndDate).format("YYYY-MM-DD"),
        time: formattedTimes[0],
        times: formattedTimes,
        user_id: targetUserId,
        couple_id: coupleId,
        is_active: true,
      };

      if (editingMedicineId) {
        const { error } = await supabase.from("medicines").update(payload).eq("id", editingMedicineId);
        if (error) throw error;
        Alert.alert("Başarılı 🎉", "İlaç bilgisi güncellendi.");
      } else {
        const { error } = await supabase.from("medicines").insert(payload);
        if (error) throw error;
        Alert.alert("Başarılı 🎉", "Yeni ilaç kaydedildi.");
      }

      resetForm();
      setShowManagerModal(false);
      refetch();
    } catch (err: any) {
      Alert.alert("Hata", err?.message || "Beklenmeyen bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setMedName("");
    setMedStartDate(new Date());
    setMedEndDate(new Date());
    setMedFrequency(1);
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    setMedTimes([d]);
    setMedError(false);
    setEditingMedicineId(null);
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
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil", 
        style: "destructive", 
        onPress: async () => {
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
  const todayMedicines = allMedicines.filter(m => m.start_date <= todayStr && m.end_date >= todayStr);
  const filteredMedicines = todayMedicines.filter(m => activeTab === "me" ? m.user_id === userId : m.user_id !== userId);
  const todayLogs = data?.todayLogs || [];
  
  const map: Record<string, string> = {};
  todayLogs.forEach((log) => {
    const timeKey = log.time ? log.time.substring(0, 5) : "";
    if (timeKey) map[`${log.medicine_id}_${timeKey}`] = log.status;
  });
  
  filteredMedicines.forEach((m) => {
    const times = Array.isArray(m.times) && m.times.length > 0 ? m.times.map((t) => t.substring(0, 5)) : [m.time ? m.time.substring(0, 5) : "08:00"];
    times.forEach((t) => {
      const key = `${m.id}_${t}`;
      if (!map[key]) {
        const legacyLog = todayLogs.find((l) => l.medicine_id === m.id && (!l.time || l.time === ""));
        map[key] = legacyLog ? legacyLog.status : "PENDING";
      }
    });
  });

  const now = new Date();
  const currentHMS = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  // Geçmiş logları grupla
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
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft color="#ffffff" size={24} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>İlaç Takibi</Text>
            <Text style={styles.headerSubtitle}>Günlük Sağlık Hatırlatıcısı 💊</Text>
          </View>

          <TouchableOpacity 
            onPress={() => router.push("/menu")} 
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AlignJustify color="rgba(255,255,255,0.75)" size={20} />
          </TouchableOpacity>
        </View>

        {/* SCROLLABLE İÇERİK */}
        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 140 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* HIZLI İLAÇ EKLE / YÖNET KARTI */}
          <TouchableOpacity 
            style={[styles.quickActionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
            onPress={() => {
              resetForm();
              setShowManagerModal(true);
            }}
            activeOpacity={0.88}
          >
            <View style={[styles.quickActionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
              <Plus size={20} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quickActionTitle}>Yeni İlaç Ekle veya Yönet</Text>
              <Text style={styles.quickActionSub}>Günlük dozları ve saatleri planlayın ✨</Text>
            </View>
            <ChevronRight size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>

          {/* BEN / SEVGİLİM SEGMENTED CONTROL */}
          <View style={[styles.segmentedContainer, { backgroundColor: theme.cardBg }]}>
            <TouchableOpacity 
              style={[styles.segmentedBtn, activeTab === "me" && { backgroundColor: theme.unitBg }]}
              onPress={() => setActiveTab("me")}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentedText, activeTab === "me" && { color: theme.accent, fontFamily: "Inter_700Bold" }]}>
                Benim İlaçlarım
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.segmentedBtn, activeTab === "partner" && { backgroundColor: theme.unitBg }]}
              onPress={() => setActiveTab("partner")}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentedText, activeTab === "partner" && { color: theme.accent, fontFamily: "Inter_700Bold" }]}>
                Sevgilimin İlaçları 💕
              </Text>
            </TouchableOpacity>
          </View>

          {/* BUGÜNÜN İLAÇLARI BÖLÜMÜ */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>BUGÜNÜN DOZLARI</Text>
              <Text style={styles.sectionDateSub}>{dayjs().locale("tr").format("D MMMM, dddd")}</Text>
            </View>

            {isLoading ? (
              <View style={{ gap: 12, marginTop: 6 }}>
                <Skeleton height={110} borderRadius={20} />
                <Skeleton height={110} borderRadius={20} />
              </View>
            ) : filteredMedicines.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                <Pill size={36} color="rgba(255,255,255,0.25)" />
                <Text style={styles.emptyCardTitle}>Bugün İçin İlaç Yok</Text>
                <Text style={styles.emptyCardSub}>
                  {activeTab === "partner" ? "Sevgilinizin bugün alması gereken bir ilaç bulunmuyor." : "Bugün almanız gereken herhangi bir ilaç planlanmamış."}
                </Text>
                <TouchableOpacity 
                  style={[styles.emptyBtn, { backgroundColor: theme.accent }]}
                  onPress={() => {
                    resetForm();
                    setIsPartnerAdd(activeTab === "partner");
                    setShowManagerModal(true);
                  }}
                >
                  <Plus size={15} color="#ffffff" />
                  <Text style={styles.emptyBtnText}>İlaç Ekle</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredMedicines.map((m) => {
                const times = Array.isArray(m.times) && m.times.length > 0 
                  ? m.times.map((t) => t.substring(0, 5)) 
                  : [m.time ? m.time.substring(0, 5) : "08:00"];

                return (
                  <View key={m.id} style={[styles.medCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                    <View style={styles.medCardHeader}>
                      <View style={[styles.medIconBox, { backgroundColor: theme.pillAccentBg }]}>
                        <Pill color={theme.accent} size={20} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.medName}>{m.name}</Text>
                        <Text style={styles.medSub}>Günde {times.length} doz ({times.join(", ")})</Text>
                      </View>
                    </View>

                    {/* Dozaj Slotları */}
                    <View style={styles.slotsContainer}>
                      {times.map((slotTime, slotIdx) => {
                        const key = `${m.id}_${slotTime}`;
                        const itemKey = `${m.id}_${slotTime}_${slotIdx}`;
                        const status = map[key] || "PENDING";
                        const isDrank = status === "DRANK";
                        const isMissed = status === "MISSED";
                        const isSlotLoading = loadingSlot === key;
                        const isTimePassed = currentHMS >= slotTime;

                        if (isSlotLoading) {
                          return (
                            <View key={itemKey} style={[styles.slotStateBox, { backgroundColor: theme.unitBg }]}>
                              <ActivityIndicator color={theme.accent} size="small" />
                            </View>
                          );
                        }

                        if (isDrank) {
                          return (
                            <View key={itemKey} style={[styles.slotStateBox, styles.drankStateBox]}>
                              <CheckCircle2 size={16} color="#22c55e" />
                              <Text style={styles.drankStateText}>Alındı ({slotTime}) ✔️</Text>
                            </View>
                          );
                        }

                        if (isMissed) {
                          return (
                            <View key={itemKey} style={[styles.slotStateBox, { backgroundColor: theme.unitBg }]}>
                              <Text style={styles.missedStateText}>Atlandı ({slotTime})</Text>
                            </View>
                          );
                        }

                        if (!isTimePassed) {
                          return (
                            <View key={itemKey} style={[styles.slotStateBox, { backgroundColor: theme.unitBg }]}>
                              <Clock size={13} color="rgba(255,255,255,0.5)" />
                              <Text style={styles.waitingStateText}>Bekliyor ({slotTime})</Text>
                            </View>
                          );
                        }

                        if (activeTab === "partner") {
                          return (
                            <View key={itemKey} style={[styles.slotStateBox, { backgroundColor: theme.unitBg }]}>
                              <AlertCircle size={14} color="#f59e0b" />
                              <Text style={styles.waitingStateText}>Henüz Alınmadı ({slotTime})</Text>
                            </View>
                          );
                        }

                        // Kullanıcının kendi ilacı için aksiyon butonları
                        return (
                          <View key={itemKey} style={styles.actionSlotRow}>
                            <TouchableOpacity 
                              style={[styles.skipBtn, { backgroundColor: theme.unitBg }]} 
                              onPress={() => handleLog(m.id, "MISSED", slotTime)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.skipBtnText}>Atla ({slotTime})</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                              style={[styles.takeBtn, { backgroundColor: theme.accent }]} 
                              onPress={() => handleLog(m.id, "DRANK", slotTime)}
                              activeOpacity={0.88}
                            >
                              <Check size={16} color="#ffffff" />
                              <Text style={styles.takeBtnText}>İçtim ({slotTime}) ✨</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* GEÇMİŞ (SON 14 GÜN) */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>GEÇMİŞ GÜNLÜK TAKİP (SON 14 GÜN)</Text>
            {sortedDates.length === 0 ? (
              <Text style={styles.historyEmptyText}>Geçmiş ilaç kaydı bulunmuyor.</Text>
            ) : (
              sortedDates.map((dateStr) => (
                <React.Fragment key={dateStr}>
                  {historyGrouped[dateStr].map((med, idx) => {
                    const isAllDrank = med.drankSlots === med.totalSlots;
                    const iconColor = isAllDrank ? "#22c55e" : "#f59e0b";

                    return (
                      <View key={`${dateStr}-${idx}`} style={[styles.historyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyDate}>{getRelativeDateLabel(dateStr)}</Text>
                          <Text style={styles.historyMedSub}>
                            {med.name} • {med.drankSlots}/{med.totalSlots} Alındı ({med.times.join(", ")})
                          </Text>
                        </View>
                        <CheckCircle2 color={iconColor} size={20} />
                      </View>
                    );
                  })}
                </React.Fragment>
              ))
            )}
          </View>
        </ScrollView>
      </View>

      {/* ─── İLAÇ YÖNETİMİ & EKLEME MODALI ─── */}
      <Modal visible={showManagerModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Settings size={18} color={theme.accent} />
                <Text style={styles.modalTitle}>
                  {editingMedicineId ? "İlacı Düzenle" : "İlaç Yönetimi & Ekle"}
                </Text>
              </View>

              <TouchableOpacity 
                onPress={() => setShowManagerModal(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20, gap: 16 }}
              enableOnAndroid={true}
              extraScrollHeight={130}
              keyboardShouldPersistTaps="handled"
            >
              {/* Mevcut İlaçlar Listesi */}
              {!editingMedicineId && allMedicines.length > 0 && (
                <View style={{ gap: 8 }}>
                  <Text style={styles.modalSectionSub}>KAYITLI İLAÇLAR</Text>
                  {allMedicines.map((m) => (
                    <View key={m.id} style={[styles.registeredMedCard, { backgroundColor: theme.unitBg }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.registeredMedName}>{m.name}</Text>
                        <Text style={styles.registeredMedSub}>
                          {m.user_id === userId ? "Benim" : "Sevgilimin"} • Günde {Array.isArray(m.times) ? m.times.length : 1} kez
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <TouchableOpacity onPress={() => handleEditMedicine(m)} style={styles.medActionBtn}>
                          <Edit2 size={16} color="rgba(255,255,255,0.7)" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteMedicine(m.id)} style={[styles.medActionBtn, { backgroundColor: "rgba(239,68,68,0.15)" }]}>
                          {isDeleting === m.id ? (
                            <ActivityIndicator size="small" color="#ef4444" />
                          ) : (
                            <Trash2 size={16} color="#ef4444" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Form Alanı */}
              <View style={{ gap: 12, marginTop: 4 }}>
                <Text style={styles.modalSectionSub}>
                  {editingMedicineId ? "İLAÇ DETAYLARI" : "YENİ İLAÇ FORMU"}
                </Text>

                {/* Kimin İçin? */}
                <View style={[styles.segmentedContainer, { backgroundColor: theme.unitBg }]}>
                  <TouchableOpacity 
                    style={[styles.segmentedBtn, !isPartnerAdd && { backgroundColor: theme.cardBg }]}
                    onPress={() => setIsPartnerAdd(false)}
                  >
                    <Text style={[styles.segmentedText, !isPartnerAdd && { color: theme.accent, fontFamily: "Inter_700Bold" }]}>Ben</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.segmentedBtn, isPartnerAdd && { backgroundColor: theme.cardBg }]}
                    onPress={() => setIsPartnerAdd(true)}
                  >
                    <Text style={[styles.segmentedText, isPartnerAdd && { color: theme.accent, fontFamily: "Inter_700Bold" }]}>Sevgilim</Text>
                  </TouchableOpacity>
                </View>

                {/* İlaç Adı */}
                <View style={{ gap: 6 }}>
                  <Text style={styles.fieldLabel}>İLAÇ ADI</Text>
                  <TextInput 
                    style={[
                      styles.textInput, 
                      { backgroundColor: theme.unitBg }, 
                      medError && styles.inputError
                    ]} 
                    placeholder="Örn: Aspirin, B12 Vitamini..." 
                    placeholderTextColor="rgba(255,255,255,0.3)" 
                    value={medName} 
                    onChangeText={(text) => {
                      setMedName(text);
                      setMedError(false);
                    }} 
                  />
                </View>

                {/* Günlük Doz Sıklığı (1, 2, 3) */}
                <View style={{ gap: 6 }}>
                  <Text style={styles.fieldLabel}>GÜNLÜK DOZ SIKLIĞI</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {([1, 2, 3] as const).map((freq) => {
                      const isSelected = medFrequency === freq;
                      return (
                        <TouchableOpacity
                          key={freq}
                          onPress={() => handleFrequencyChange(freq)}
                          style={[
                            styles.freqBtn,
                            { backgroundColor: theme.unitBg },
                            isSelected && { borderColor: theme.accent, backgroundColor: theme.pillAccentBg, borderWidth: 1.5 }
                          ]}
                        >
                          <Text style={[styles.freqBtnText, isSelected && { color: "#ffffff", fontFamily: "Inter_700Bold" }]}>
                            {freq} Kez
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Saat Seçicileri */}
                <View style={{ gap: 6 }}>
                  <Text style={styles.fieldLabel}>DOZ SAATLERİ</Text>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    {medTimes.map((time, idx) => (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => {
                          setActiveTimeIndex(idx);
                          setShowPicker("time");
                        }}
                        style={[styles.timePickerBox, { backgroundColor: theme.unitBg }]}
                      >
                        <Clock size={14} color={theme.accent} />
                        <Text style={styles.timePickerText}>{dayjs(time).format("HH:mm")}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Başlangıç & Bitiş Tarihleri */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.fieldLabel}>BAŞLANGIÇ</Text>
                    <TouchableOpacity
                      onPress={() => setShowPicker("start")}
                      style={[styles.datePickerBtn, { backgroundColor: theme.unitBg }]}
                    >
                      <Calendar size={14} color={theme.accent} />
                      <Text style={styles.datePickerText}>{dayjs(medStartDate).format("DD.MM.YYYY")}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={styles.fieldLabel}>BİTİŞ</Text>
                    <TouchableOpacity
                      onPress={() => setShowPicker("end")}
                      style={[styles.datePickerBtn, { backgroundColor: theme.unitBg }]}
                    >
                      <Calendar size={14} color={theme.accent} />
                      <Text style={styles.datePickerText}>{dayjs(medEndDate).format("DD.MM.YYYY")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Kaydet Butonu */}
                <TouchableOpacity 
                  style={[styles.saveMedBtn, { backgroundColor: theme.accent }]} 
                  onPress={handleSaveMedicine}
                  disabled={isSubmitting}
                  activeOpacity={0.88}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <Check size={17} color="#ffffff" />
                      <Text style={styles.saveMedBtnText}>
                        {editingMedicineId ? "Güncellemeyi Kaydet" : "İlacı Listeye Ekle"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      {/* TARİH & SAAT PICKER MODALLARI */}
      {showPicker === "start" && (
        <DateTimePicker
          value={medStartDate}
          mode="date"
          display="default"
          onChange={(_, date) => {
            setShowPicker(null);
            if (date) setMedStartDate(date);
          }}
        />
      )}

      {showPicker === "end" && (
        <DateTimePicker
          value={medEndDate}
          mode="date"
          display="default"
          onChange={(_, date) => {
            setShowPicker(null);
            if (date) setMedEndDate(date);
          }}
        />
      )}

      {showPicker === "time" && activeTimeIndex !== null && (
        <DateTimePicker
          value={medTimes[activeTimeIndex] || new Date()}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={(_, date) => {
            setShowPicker(null);
            if (date && activeTimeIndex !== null) {
              const newTimeStr = dayjs(date).format("HH:mm");
              const isDuplicate = medTimes.some((t, i) => i !== activeTimeIndex && dayjs(t).format("HH:mm") === newTimeStr);
              if (isDuplicate) {
                Alert.alert("Uyarı", "Bu ilaç için bu saati zaten seçtiniz. Lütfen farklı bir saat belirleyin.");
                return;
              }
              const updated = [...medTimes];
              updated[activeTimeIndex] = date;
              setMedTimes(updated);
            }
          }}
        />
      )}
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
    gap: 16,
  },

  /* HIZLI İLAÇ EKLE KARTI */
  quickActionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
  },
  quickActionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  quickActionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },

  /* SEGMENTED CONTROL */
  segmentedContainer: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 16,
  },
  segmentedBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  segmentedText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
  },

  /* BÖLÜMLER */
  sectionBlock: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.7,
  },
  sectionDateSub: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
  },

  /* İLAÇ KARTI */
  medCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  medCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  medIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  medName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  medSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  slotsContainer: {
    gap: 8,
  },
  slotStateBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  drankStateBox: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  drankStateText: {
    color: "#22c55e",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  missedStateText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
  },
  waitingStateText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
  },
  actionSlotRow: {
    flexDirection: "row",
    gap: 10,
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  skipBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  takeBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  takeBtnText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
  },

  /* GEÇMİŞ KARTLARI */
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  historyDate: {
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  historyMedSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  historyEmptyText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    marginLeft: 4,
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
  emptyCardTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    marginTop: 4,
  },
  emptyCardSub: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 18,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 6,
  },
  emptyBtnText: {
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
  modalSectionSub: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.6,
  },
  registeredMedCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
  },
  registeredMedName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  registeredMedSub: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  medActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
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
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  inputError: {
    borderColor: "#ff4d6a",
    borderWidth: 1.5,
  },
  freqBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  freqBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
  },
  timePickerBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  timePickerText: {
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  datePickerText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#ffffff",
  },
  saveMedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 14,
    marginTop: 6,
  },
  saveMedBtnText: {
    color: "#ffffff",
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },
});
