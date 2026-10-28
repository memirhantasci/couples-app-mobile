import React, { useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { appAlert } from "@/lib/dialog";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Pill, ChevronLeft, AlignJustify, Plus, ChevronRight
} from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { cancelLocalNotification, notifyPartner } from "@/lib/notifications";
import { scheduleMedicineReminder, medicineReminderId, syncLocalReminders } from "@/lib/reminderSync";
import { useNotificationPriming } from "@/hooks/useNotificationPriming";
import { useDeferredReady } from "@/hooks/useDeferredReady";
import { useCustomNotification } from "@/context/NotificationContext";
import { dayjs, todayString } from "@/lib/date";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePageTour } from "@/hooks/usePageTour";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { DEMO_MEDICINES } from "@/constants/demoData";
import { useDemoAction } from "@/hooks/useDemoAction";
import { sanitizeStrict } from "@/utils/sanitize";
import { playSuccessChime } from "@/lib/soundEffects";
import { toast } from "@/lib/toast";
import { MedicineStreakCard } from "@/components/medicine/MedicineStreakCard";
import { MedicineDoseCard } from "@/components/medicine/MedicineDoseCard";
import { MedicineHistoryList } from "@/components/medicine/MedicineHistoryList";
import { MedicineManagerModal } from "@/components/medicine/MedicineManagerModal";
import { LazyPageTourModal, LazyDemoActionModal, LazyPermissionPrimingModal } from "@/components/ui/lazyMount";
import type {
  MedicineFormInitialData,
  MedicineFormValues,
  MedicineHistoryEntry,
  MedicineHistoryGrouped,
  MedicineItem,
  MedicineSubmitResult,
  MedicineTab,
  WeeklyComplianceDay,
} from "@/components/medicine/medicineTypes";

export default function MedicineScreen() {
  const { profile, session, isDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme, isLight } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { showNotification } = useCustomNotification();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const coupleId = profile?.coupleId;
  const userId = session?.user?.id ? session.user.id : null;

  const todayStr = todayString();
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [managerInitialData, setManagerInitialData] = useState<MedicineFormInitialData | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("medicine");

  const [activeTab, setActiveTab] = useState<MedicineTab>("me");

  // Hatırlatıcılar bildirim izni olmadan çalmaz: ilk ilaç kaydından sonra ön-onay kartı gösterilir.
  const priming = useNotificationPriming(userId);
  // 14 günlük geçmiş listesi ekranın en altında: ilk karede çizilmez, hemen ardından eklenir
  const showHistory = useDeferredReady();
  const primeAfterCloseRef = useRef(false);

  const closeManagerModal = () => {
    setShowManagerModal(false);
    if (primeAfterCloseRef.current) {
      primeAfterCloseRef.current = false;
      // Yönetim modalının kapanış animasyonu bitmeden ikinci bir Modal açılırsa iOS bunu yutar
      setTimeout(() => { priming.maybePrompt(); }, 450);
    }
  };

  const fourteenDaysAgo = dayjs().subtract(14, "day").format("YYYY-MM-DD");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["medicine_data", coupleId, isDemoMode],
    enabled: (!!coupleId && !!userId) || isDemoMode,
    queryFn: async () => {
      if (isDemoMode) {
        return {
          medicines: DEMO_MEDICINES.map((m) => ({
            id: m.id,
            name: m.name,
            time: m.time,
            times: [m.time],
            start_date: dayjs().subtract(10, "day").format("YYYY-MM-DD"),
            end_date: dayjs().add(20, "day").format("YYYY-MM-DD"),
            is_active: true,
            user_id: userId,
          })),
          todayLogs: [
            { medicine_id: 601, status: "DRANK", date: todayStr, time: "09:00", user_id: userId }
          ],
          historicalLogs: [],
        };
      }
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

  // Sorgunun tam anahtarı: setQueryData / getQueryData anahtarı birebir eşleşmeden çalışmaz
  const medicineQueryKey = ["medicine_data", coupleId, isDemoMode] as const;

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
      await queryClient.cancelQueries({ queryKey: medicineQueryKey });
      const previousData = queryClient.getQueryData(medicineQueryKey);

      queryClient.setQueryData(medicineQueryKey, (old: any) => {
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
    onSuccess: (_, variables) => {
      const { medicineId, status } = variables;
      if (status === "DRANK") {
        playSuccessChime();
        const med = data?.medicines?.find((m: any) => m.id === medicineId);
        const medName = med?.name || "İlaç";
        const senderName = profile?.displayName || "Sevgilin";

        // Gerçek hesapta partner bildirimi sunucudaki tetikleyiciden (send-push) gelir; çift bildirim olmasın diye yalnızca demo gösterilir.
        if (isDemoMode || !coupleId || !userId) {
          showNotification({
            type: "medicine",
            title: "İlacını İçti! 💊✨",
            body: `${senderName}, ${medName} ilacını içti. İçin rahat olsun! 🌿`,
            senderName,
            route: "/(tabs)/medicine",
            actionLabel: "İlaç Takibine Git 💊",
            metadata: {
              medicineName: medName,
            },
          });
        }
      }
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(medicineQueryKey, context.previousData);
      }
      appAlert("Hata", "Durum güncellenirken bir sorun oluştu.");
    },
    onSettled: () => {
      setLoadingSlot(null);
      queryClient.invalidateQueries({ queryKey: medicineQueryKey });
    },
  });

  const handleLog = (medicineId: number, status: string, timeSlot: string) => {
    if (executeOrIntercept(
      () => {},
      "İlaç Takibini Kullanmak İçin Kayıt Olun 💊",
      "Günlük ilaç ve vitaminlerinizi kaydetmek ve partnerinizle eşleşmek için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }
    updateLogMutation.mutate({ medicineId, status, timeSlot });
  };

  // İlaç ekleme/düzenleme formu modalın kendi state'inde tutulur; burada yalnızca kaydetme mantığı var.
  const handleSubmitMedicine = async (values: MedicineFormValues): Promise<MedicineSubmitResult> => {
    if (executeOrIntercept(
      () => {},
      "İlaç Eklemek İçin Kayıt Olun 💊",
      "İlaç ve vitaminlerinizi düzenli takip etmek ve bildirim almak için ücretsiz hesabınızı oluşturun."
    )) {
      return "demo";
    }

    if (!values.name.trim()) return "name-error";
    if (!coupleId || !userId) return "error";

    const cleanMedName = sanitizeStrict(values.name.trim());
    if (!cleanMedName) return "name-error";

    const formattedTimes = values.times.map(t => dayjs(t).format("HH:mm"));
    const uniqueTimes = new Set(formattedTimes);
    if (uniqueTimes.size !== formattedTimes.length) {
      appAlert("Uyarı", "Aynı ilaç için birden fazla aynı saat seçilemez. Lütfen farklı doz saatleri belirleyin.");
      return "error";
    }

    const editingMedicineId = values.editingId;

    try {
      let targetUserId = userId;
      if (values.isPartnerAdd) {
        const { data: partnerData } = await supabase
          .from("users")
          .select("id")
          .eq("couple_id", coupleId)
          .neq("id", userId)
          .maybeSingle();

        if (!partnerData?.id) {
          appAlert("Bilgi", "Partneriniz henüz eşleşmemiş.");
          return "error";
        }
        targetUserId = partnerData.id;
      }

      const payload: any = {
        name: cleanMedName,
        start_date: dayjs(values.startDate).format("YYYY-MM-DD"),
        end_date: dayjs(values.endDate).format("YYYY-MM-DD"),
        time: formattedTimes[0],
        times: formattedTimes,
        user_id: targetUserId,
        couple_id: coupleId,
        is_active: true,
      };

      if (editingMedicineId) {
        // Eski bildirimleri silmek için mevcut ilacı bul
        const oldMed = data?.medicines?.find((m: any) => m.id === editingMedicineId);
        // Eski saatlerin bildirimleri (kayıt "HH:mm" ya da "HH:mm:ss" tutabilir) iptal edilir.
        // Not: ilaç sevgiliye eklendiyse onun cihazındaki hatırlatıcıyı useReminderSync kurar/günceller;
        // hatırlatıcı yalnızca ilacın sahibine çalar, partnere "ilacını kaçırdı" bildirimi gönderilmez.
        if (oldMed?.times && oldMed.user_id === userId) {
          oldMed.times.forEach((t: string) => cancelLocalNotification(medicineReminderId(editingMedicineId, t.substring(0, 5))));
        }

        const { error } = await supabase.from("medicines").update(payload).eq("id", editingMedicineId);
        if (error) throw error;

        if (targetUserId === userId) {
          formattedTimes.forEach((t: string) => scheduleMedicineReminder(editingMedicineId, payload.name, t));
        }

        // İlaç formu modalı sonuç döndükten sonra kapanır → pil kapanışı bekler
        toast.success("İlaç bilgisi güncellendi 🎉", { delay: 350 });
      } else {
        const { data: newMed, error } = await supabase.from("medicines").insert(payload).select("id").single();
        if (error) throw error;

        if (newMed && targetUserId === userId) {
          formattedTimes.forEach((t: string) => scheduleMedicineReminder(newMed.id, payload.name, t));
        }

        notifyPartner(
          coupleId,
          userId,
          "Yeni İlaç Eklendi 💊",
          values.isPartnerAdd
            ? `Sevgilin senin için yeni bir ilaç ekledi: ${cleanMedName}`
            : `Sevgilin yeni bir ilaç ekledi: ${cleanMedName}`,
          {
            type: "medicine",
            medicineName: cleanMedName,
            route: "/(tabs)/medicine",
            actionLabel: "İlaç Takibine Git 💊",
          }
        );

        toast.success("Yeni ilaç kaydedildi 🎉", { delay: 350 });
      }

      refetch();
      // Hatırlatıcıların çalabilmesi için bildirim izni gerekir; ön-onay kartı modal kapanınca açılır
      primeAfterCloseRef.current = true;
      return "success";
    } catch (err: any) {
      appAlert("Hata", err?.message || "Beklenmeyen bir hata oluştu.");
      return "error";
    }
  };

  // Kayıtlı bir ilacı düzenleme moduna almadan önce demo kontrolü (false = engelle)
  const handleBeforeEditMedicine = () => {
    return !executeOrIntercept(
      () => {},
      "İlacı Düzenlemek İçin Kayıt Olun 💊",
      "İlaç bilgilerinizi ve saatlerinizi güncellemek için ücretsiz hesabınızı oluşturun."
    );
  };

  const handleDeleteMedicine = async (id: number) => {
    if (executeOrIntercept(
      () => {},
      "İlacı Silmek İçin Kayıt Olun 🗑️",
      "İlaç takviminizi yönetmek için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }

    appAlert("İlacı Sil", "Bu ilacı silmek istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          setIsDeleting(id);

          // Yerel bildirimleri temizle
          const med = data?.medicines?.find((m: any) => m.id === id);
          if (med?.times && med.user_id === userId) {
            med.times.forEach((t: string) => cancelLocalNotification(medicineReminderId(id, t.substring(0, 5))));
          }

          const { error } = await supabase.from("medicines").delete().eq("id", id).eq("couple_id", coupleId);
          setIsDeleting(null);
          if (error) {
            appAlert("Hata", "Silinirken hata oluştu.");
          } else {
            refetch();
          }
        }
      }
    ]);
  };

  const openManagerModal = (initialData: MedicineFormInitialData | null) => {
    setManagerInitialData(initialData);
    setShowManagerModal(true);
  };

  const allMedicines = useMemo<MedicineItem[]>(() => (data?.medicines || []) as MedicineItem[], [data?.medicines]);
  const todayMedicines = useMemo(
    () => allMedicines.filter((m) => m.start_date <= todayStr && m.end_date >= todayStr),
    [allMedicines, todayStr]
  );
  const filteredMedicines = useMemo(
    () => todayMedicines.filter((m) => activeTab === "me" ? m.user_id === userId : m.user_id !== userId),
    [todayMedicines, activeTab, userId]
  );
  const todayLogs = useMemo(() => data?.todayLogs || [], [data?.todayLogs]);

  const statusMap = useMemo<Record<string, string>>(() => {
    const res: Record<string, string> = {};
    todayLogs.forEach((log: any) => {
      const timeKey = log.time ? log.time.substring(0, 5) : "";
      if (timeKey) res[`${log.medicine_id}_${timeKey}`] = log.status;
    });

    filteredMedicines.forEach((m) => {
      const times = Array.isArray(m.times) && m.times.length > 0 ? m.times.map((t: string) => t.substring(0, 5)) : [m.time ? m.time.substring(0, 5) : "08:00"];
      times.forEach((t: string) => {
        const key = `${m.id}_${t}`;
        if (!res[key]) {
          const legacyLog = todayLogs.find((l: any) => l.medicine_id === m.id && (!l.time || l.time === ""));
          res[key] = legacyLog ? legacyLog.status : "PENDING";
        }
      });
    });
    return res;
  }, [todayLogs, filteredMedicines]);

  const now = new Date();
  const currentHMS = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  // Geçmiş logları grupla (Memoized)
  const historyGrouped = useMemo<MedicineHistoryGrouped>(() => {
    const grouped: MedicineHistoryGrouped = {};
    data?.historicalLogs?.forEach((log: any) => {
      if (activeTab === "me" && log.user_id !== userId) return;
      if (activeTab === "partner" && log.user_id === userId) return;

      if (!grouped[log.date]) grouped[log.date] = [];

      const med = allMedicines.find((m) => m.id === log.medicine_id);
      if (med) {
        let entry = grouped[log.date].find((e) => e.medicine_id === log.medicine_id);
        if (!entry) {
          const timesArr = (Array.isArray(med.times) ? med.times : [med.time]) as string[];
          entry = {
            medicine_id: med.id,
            name: med.name,
            totalSlots: timesArr.length,
            drankSlots: 0,
            times: timesArr.map((t: string) => t.substring(0, 5)),
          } as MedicineHistoryEntry;
          grouped[log.date].push(entry);
        }
        if (log.status === "DRANK") {
          entry.drankSlots += 1;
        }
      }
    });
    return grouped;
  }, [data?.historicalLogs, activeTab, userId, allMedicines]);

  const sortedDates = useMemo(() => Object.keys(historyGrouped).sort((a, b) => b.localeCompare(a)), [historyGrouped]);

  // 7 Günlük Uyum Matrisi ve Seri (Streak)
  const { weeklyCompliance, streakCount } = useMemo(() => {
    const days: WeeklyComplianceDay[] = [];

    // Son 7 gün (6 gün önce -> bugün)
    for (let i = 6; i >= 0; i--) {
      const d = dayjs().subtract(i, "day");
      const dateStr = d.format("YYYY-MM-DD");
      const dayLabel = d.locale("tr").format("dd");
      const dayNumber = d.format("D");
      const isToday = i === 0;

      // İlgili gündeki aktif ilaçlar
      const medsOnDay = filteredMedicines.filter((m) => {
        const start = m.start_date || "2000-01-01";
        const end = m.end_date || "2099-12-31";
        return dateStr >= start && dateStr <= end;
      });

      if (medsOnDay.length === 0) {
        days.push({ dateStr, dayLabel, dayNumber, isToday, status: "empty" });
        continue;
      }

      let totalSlots = 0;
      let drankSlots = 0;

      if (isToday) {
        medsOnDay.forEach((m) => {
          const times = Array.isArray(m.times) && m.times.length > 0 ? m.times : [m.time || "08:00"];
          times.forEach((t: string) => {
            totalSlots++;
            const key = `${m.id}_${t.substring(0, 5)}`;
            if (statusMap[key] === "DRANK") {
              drankSlots++;
            }
          });
        });
        if (drankSlots === totalSlots && totalSlots > 0) {
          days.push({ dateStr, dayLabel, dayNumber, isToday, status: "complete" });
        } else if (drankSlots > 0) {
          days.push({ dateStr, dayLabel, dayNumber, isToday, status: "partial" });
        } else {
          days.push({ dateStr, dayLabel, dayNumber, isToday, status: "pending" });
        }
      } else {
        // O günün TÜM aktif ilaçları sayılır; hiç kaydı olmayan ilaç da eksik doz demektir
        // (yalnızca kaydı olanlar sayılırsa, içilmeyen ilaçlar seriyi bozmadan "tamam" görünürdü)
        const histDay = historyGrouped[dateStr] || [];
        medsOnDay.forEach((m) => {
          const times = Array.isArray(m.times) && m.times.length > 0 ? m.times : [m.time || "08:00"];
          totalSlots += times.length;
          drankSlots += histDay.find((entry) => entry.medicine_id === m.id)?.drankSlots ?? 0;
        });
        if (totalSlots > 0 && drankSlots >= totalSlots) {
          days.push({ dateStr, dayLabel, dayNumber, isToday, status: "complete" });
        } else if (drankSlots > 0) {
          days.push({ dateStr, dayLabel, dayNumber, isToday, status: "partial" });
        } else {
          days.push({ dateStr, dayLabel, dayNumber, isToday, status: "missed" });
        }
      }
    }

    // Seri (Streak) hesapla
    let streak = 0;
    const todayComplete = days[6]?.status === "complete";
    if (todayComplete) {
      streak++;
    }

    for (let i = 5; i >= 0; i--) {
      if (days[i].status === "complete") {
        streak++;
      } else if (days[i].status === "empty") {
        continue;
      } else {
        break;
      }
    }

    return { weeklyCompliance: days, streakCount: streak };
  }, [filteredMedicines, statusMap, historyGrouped]);

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Geri"
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/home");
              }
            }}
            style={[styles.headerBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)", borderColor: theme.cardBorder }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft color={theme.text} size={24} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>İlaç Takibi</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]} numberOfLines={1}>Günlük Sağlık Hatırlatıcısı 💊</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TourGuideButton onPress={openTour} />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Menüyü aç"
              onPress={() => router.push("/menu")}
              style={[styles.headerBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)", borderColor: theme.cardBorder }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AlignJustify color={theme.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
        </View>

        {/* SCROLLABLE İÇERİK */}
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 140 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* HIZLI İLAÇ EKLE / YÖNET KARTI */}
          <TouchableOpacity
            style={[styles.quickActionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}
            onPress={() => {
              if (executeOrIntercept(
                () => {},
                "Yeni İlaç ve Hatırlatıcı Eklemek İçin Kayıt Olun 💊",
                "Günlük ilaçlarınızı planlamak ve partnerinizle birbirinizi takip etmek için ücretsiz hesabınızı oluşturun."
              )) {
                return;
              }
              openManagerModal(null);
            }}
            activeOpacity={0.88}
          >
            <View style={[styles.quickActionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
              <Plus size={20} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.quickActionTitle, { color: theme.text }]}>Yeni İlaç Ekle veya Yönet</Text>
              <Text style={[styles.quickActionSub, { color: theme.textMuted }]}>Günlük dozları ve saatleri planlayın ✨</Text>
            </View>
            <ChevronRight size={18} color={theme.textMuted} />
          </TouchableOpacity>

          {/* BEN / SEVGİLİM SEGMENTED CONTROL */}
          <View style={[styles.segmentedContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1, ...theme.cardShadow }]}>
            <TouchableOpacity
              style={[styles.segmentedBtn, activeTab === "me" && { backgroundColor: theme.unitBg }]}
              onPress={() => setActiveTab("me")}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentedText, { color: activeTab === "me" ? theme.accent : theme.textSecondary }, activeTab === "me" && { fontFamily: "Inter_700Bold" }]}>
                Benim İlaçlarım
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentedBtn, activeTab === "partner" && { backgroundColor: theme.unitBg }]}
              onPress={() => setActiveTab("partner")}
              activeOpacity={0.8}
            >
              <Text style={[styles.segmentedText, { color: activeTab === "partner" ? theme.accent : theme.textSecondary }, activeTab === "partner" && { fontFamily: "Inter_700Bold" }]}>
                Sevgilimin İlaçları 💕
              </Text>
            </TouchableOpacity>
          </View>

          {/* HAFTALIK UYUM VE SERİ (STREAK) KARTI */}
          <MedicineStreakCard
            theme={theme}
            isLight={isLight}
            activeTab={activeTab}
            weeklyCompliance={weeklyCompliance}
            streakCount={streakCount}
          />

          {/* BUGÜNÜN İLAÇLARI BÖLÜMÜ */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>BUGÜNÜN DOZLARI</Text>
              <Text style={[styles.sectionDateSub, { color: theme.textMuted }]}>{dayjs().locale("tr").format("D MMMM, dddd")}</Text>
            </View>

            {isLoading ? (
              <View style={{ gap: 12, marginTop: 6 }}>
                <Skeleton height={110} borderRadius={20} />
                <Skeleton height={110} borderRadius={20} />
              </View>
            ) : filteredMedicines.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1, ...theme.cardShadow }]}>
                <Pill size={36} color={theme.textMuted} />
                <Text style={[styles.emptyCardTitle, { color: theme.text }]}>Bugün İçin İlaç Yok</Text>
                <Text style={[styles.emptyCardSub, { color: theme.textSecondary }]}>
                  {activeTab === "partner" ? "Sevgilinizin bugün alması gereken bir ilaç bulunmuyor." : "Bugün almanız gereken herhangi bir ilaç planlanmamış."}
                </Text>
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: theme.accent }]}
                  onPress={() => openManagerModal({ isPartnerAdd: activeTab === "partner" })}
                >
                  <Plus size={15} color="#ffffff" />
                  <Text style={styles.emptyBtnText}>İlaç Ekle</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredMedicines.map((m) => (
                <MedicineDoseCard
                  key={m.id}
                  medicine={m}
                  theme={theme}
                  activeTab={activeTab}
                  statusMap={statusMap}
                  loadingSlot={loadingSlot}
                  currentHMS={currentHMS}
                  onLog={handleLog}
                />
              ))
            )}
          </View>

          {/* GEÇMİŞ (SON 14 GÜN) */}
          {showHistory && (
            <MedicineHistoryList theme={theme} historyGrouped={historyGrouped} sortedDates={sortedDates} />
          )}
        </ScrollView>
      </View>

      {/* ─── İLAÇ YÖNETİMİ & EKLEME MODALI ─── */}
      <MedicineManagerModal
        visible={showManagerModal}
        theme={theme}
        isLight={isLight}
        userId={userId}
        medicines={allMedicines}
        deletingId={isDeleting}
        initialData={managerInitialData}
        onSubmit={handleSubmitMedicine}
        onClose={closeManagerModal}
        onDelete={handleDeleteMedicine}
        onBeforeEdit={handleBeforeEditMedicine}
      />

      <LazyPermissionPrimingModal
        visible={priming.isVisible}
        onAccept={async () => {
          const granted = await priming.accept();
          // İzin yeni verildiyse bu cihazdaki tüm hatırlatıcıları hemen eşitle
          if (granted && coupleId && userId) syncLocalReminders(userId, coupleId, { force: true });
        }}
        onDismiss={priming.dismiss}
      />

      <LazyPageTourModal visible={isTourVisible} guide={guide} onClose={closeTour} />
      <LazyDemoActionModal
        visible={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        title={modalConfig.title}
        description={modalConfig.description}
      />
    </ScreenBackground>
  );
}

const createStyles = (theme: AppTheme) => {
  const isLight = theme.isLight;

  return StyleSheet.create({
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
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
      borderWidth: 1,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
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
      color: theme.text,
      letterSpacing: -0.4,
    },
    headerSubtitle: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.55)",
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
      color: theme.text,
      letterSpacing: -0.2,
    },
    quickActionSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.55)",
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
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.6)",
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
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.5)",
      letterSpacing: 0.7,
    },
    sectionDateSub: {
      fontSize: 11.5,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.4)",
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
      color: theme.text,
      marginTop: 4,
    },
    emptyCardSub: {
      fontSize: 12.5,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.5)",
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
  });
};
