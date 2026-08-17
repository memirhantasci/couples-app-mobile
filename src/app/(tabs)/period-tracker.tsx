import React, { useCallback,  useState, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal } from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dayjs, todayString } from "@/lib/date";
import { deterministicDecrypt } from "@/utils/crypto";
import { logger } from "@/utils/logger";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { X, Check, ChevronLeft, Menu } from "lucide-react-native";
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

export default function PeriodTrackerScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = todayString();
  const insets = useSafeAreaInsets();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;
  
  // Checking if the current user is Female
  const { data: userData , refetch: refetch_0} = useQuery({
    queryKey: ["user_gender", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("gender")
        .eq("id", userId)
        .single();
      return data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const isFemale = userData?.gender === "female";

  const { data: logs, isLoading , refetch: refetch_1} = useQuery({
    queryKey: ["period_logs", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("period_logs")
        .select("id, date")
        .eq("user_id", userId)
        .order("date", { ascending: false });
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  const markedDates = useMemo(() => {
    if (!logs) return {};
    const marks: Record<string, any> = {};

    logs.forEach(log => {
      marks[log.date] = {
        customStyles: {
          container: {
            backgroundColor: 'rgba(200, 0, 30, 0.75)',
            borderRadius: 20
          },
          text: {
            color: 'white',
            fontWeight: 'bold'
          }
        }
      };
    });

    return marks;
  }, [logs]);

  function handleDateClick(day: any) {
    if (!isFemale) {
      Alert.alert("Erişim Engellendi", "Bu tabloyu sadece kadınlar güncelleyebilir.");
      return;
    }

    const dateStr = day.dateString;
    const exists = logs?.some(l => l.date === dateStr);

    if (!exists) {
      // Check max 2 logs per month
      const currentMonthStr = dateStr.substring(0, 7);
      const monthLogsCount = logs?.filter(l => l.date.startsWith(currentMonthStr)).length || 0;
      if (monthLogsCount >= 2) {
        Alert.alert("Sınır Aşıldı", "Bir ay içerisinde en fazla 2 gün seçebilirsiniz.");
        return;
      }
    }

    setSelectedDate(dateStr);
    setIsAdding(!exists);
  }

  async function handleToggle() {
    if (!selectedDate || !userId) return;
    setLoading(true);

    try {
      // RPC to bypass PostgREST identity DEFAULT issue
      const { error } = await supabase.rpc("toggle_period_log", {
        p_user_id: userId,
        p_date: selectedDate
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["period_logs"] });
      setSelectedDate(null);
    } catch (error: any) {
      logger.error("Period save error:", error);
      Alert.alert("Hata", "İşlem sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }



  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 10 }]}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color="#fff" size={28} />
          </TouchableOpacity>
          <Text style={styles.title}>REGL TAKVİMİ 🩸</Text>
          <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, marginRight: -8 }}>
            <Menu color="#fff" size={24} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={{ gap: 16, marginTop: 40, paddingHorizontal: 20 }}>
            <Skeleton height={350} borderRadius={20} />
            <Skeleton height={100} borderRadius={16} />
          </View>
        ) : (
          <>
            {/* Calendar View */}
            <View style={styles.calendarContainer}>
              <Calendar
                current={today}
                onDayPress={handleDateClick}
                markedDates={markedDates}
                markingType={'custom'}
                theme={{
                  calendarBackground: 'transparent',
                  textSectionTitleColor: 'rgba(255,255,255,0.4)',
                  todayTextColor: '#E8002D',
                  dayTextColor: 'rgba(255,255,255,0.85)',
                  textDisabledColor: 'rgba(255,255,255,0.2)',
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

            {/* Past Records */}
            <View style={styles.pastRecordsBox}>
              <Text style={styles.pastRecordsTitle}>Geçmiş Kayıtlar</Text>

              {!logs || logs.length === 0 ? (
                <Text style={styles.emptyText}>Henüz hiç regl kaydı bulunmuyor.</Text>
              ) : (
                <View style={{ gap: 10 }}>
                  {logs.map(log => {
                    const logDate = dayjs(log.date);
                    return (
                      <View key={log.id} style={styles.logCard}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <View style={styles.dropIconBox}>
                            <Text style={{ fontSize: 20 }}>🩸</Text>
                          </View>
                          <View>
                            <Text style={styles.logDateText}>{logDate.format("DD MMMM YYYY")}</Text>
                            <Text style={styles.logDayText}>{logDate.format("dddd")}</Text>
                          </View>
                        </View>
                        <Text style={styles.logMonthText}>{logDate.format("MMMM")}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}

      </ScrollView>

      {/* Modal */}
      <Modal visible={!!selectedDate} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalIconBox}>
              <Text style={{ fontSize: 28 }}>🩸</Text>
            </View>

            <Text style={styles.modalDateText}>
              {selectedDate ? dayjs(selectedDate).format("DD MMMM YYYY") : ""}
            </Text>
            
            <Text style={styles.modalSubtitle}>
              {isAdding ? "Sıkıntılı günler başladı mı?" : "Bu günkü kaydı silmek istediğine emin misin?"}
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                disabled={loading}
                onPress={() => setSelectedDate(null)}
              >
                <Text style={styles.modalCancelBtnText}>İptal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalActionBtn, loading && { opacity: 0.7 }]}
                disabled={loading}
                onPress={handleToggle}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : isAdding ? (
                  <>
                    <Check color="#fff" size={16} />
                    <Text style={styles.modalActionBtnText}>Evet</Text>
                  </>
                ) : (
                  <>
                    <X color="#fff" size={16} />
                    <Text style={styles.modalActionBtnText}>Kaydı Sil</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 120,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backBtn: {
    padding: 4,
    marginLeft: -4,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#E8002D",
    letterSpacing: 1,
  },
  calendarContainer: {
    backgroundColor: "#1c1c1e",
    borderRadius: 20,
    padding: 8,
    marginBottom: 28,
  },
  pastRecordsBox: {
    marginTop: 8,
  },
  pastRecordsTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 14,
  },
  emptyText: {
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    paddingVertical: 24,
    fontSize: 14,
  },
  logCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1c1c1e",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dropIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(200,0,30,0.15)",
    borderWidth: 1,
    borderColor: "rgba(200,0,30,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  logDateText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "rgba(255,255,255,0.9)",
  },
  logDayText: {
    fontSize: 13,
    color: "#E8002D",
    fontWeight: "500",
  },
  logMonthText: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#c8922a",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#1c1c1e",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  modalIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#B5001F",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#E8002D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 5,
  },
  modalDateText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    fontSize: 15,
  },
  modalActionBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#E8002D",
  },
  modalActionBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  }
});
