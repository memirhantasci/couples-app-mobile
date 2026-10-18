import React, { useState, useMemo } from "react";
import { 
  View, Text, ScrollView, StyleSheet, TouchableOpacity, 
  ActivityIndicator, Alert, Modal 
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dayjs, todayString } from "@/lib/date";
import { logger } from "@/utils/logger";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { 
  X, Check, ChevronLeft, AlignJustify, Lock, Crown, 
  Heart, Sparkles, Droplet, Coffee, MessageCircleHeart, Info, Gift
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { notifyPartner } from "@/lib/notifications";
import { PremiumPaywall } from "@/components/ui/PremiumPaywall";
import { usePageTour } from "@/hooks/usePageTour";
import { PageTourModal } from "@/components/tour/PageTourModal";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { useDemoAction } from "@/hooks/useDemoAction";
import { DemoActionModal } from "@/components/demo/DemoActionModal";
import {
  DEFAULT_CYCLE_LENGTH, MAX_STARTS_PER_MONTH, MIN_DAYS_BETWEEN_STARTS,
  getPeriodStarts, getPeriodDays,
} from "@/lib/periodCycle";

LocaleConfig.locales['tr'] = {
  monthNames: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
  monthNamesShort: ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'],
  dayNames: ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'],
  dayNamesShort: ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'],
  today: 'Bugün'
};
LocaleConfig.defaultLocale = 'tr';

export default function PeriodTrackerScreen() {
  const { session, profile, isDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme, isLight } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = todayString();
  const insets = useSafeAreaInsets();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;
  
  // Cinsiyet doğrudan profil önbelleğinden okunur — ekstra DB sorgusu atilmaz
  const isFemale = profile?.gender === "female";
  const isPremium = profile?.isPremium ?? false;
  const [showPaywall, setShowPaywall] = useState(false);
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("period-tracker");

  // Erkek ve premium değilse kilitli görünüm
  const isMaleLocked = !isFemale && !isPremium;

  const { data: logs, isLoading } = useQuery({
    queryKey: ["period_logs", coupleId, isFemale ? userId : "partner", isDemoMode],
    enabled: (!!coupleId && !isMaleLocked) || isDemoMode,
    queryFn: async () => {
      if (isDemoMode) {
        return [
          { id: 1, date: dayjs().subtract(18, "day").format("YYYY-MM-DD"), user_id: "demo-partner" },
          { id: 2, date: dayjs().subtract(46, "day").format("YYYY-MM-DD"), user_id: "demo-partner" },
        ];
      }
      let query = supabase.from("period_logs").select("id, date, user_id").eq("couple_id", coupleId).order("date", { ascending: false });
      
      if (isFemale && userId) {
        query = query.eq("user_id", userId);
      } else {
        // Erkekse partnerin logları — couple_id filtresiyle güvenli şekilde çek
        query = query.neq("user_id", userId);
      }

      const { data } = await query;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  // Regl başlangıç günleri (eskiden → yeniye); eski ardışık günlük kayıtlar tek başlangıca indirilir
  const periodStarts = useMemo(() => getPeriodStarts((logs ?? []).map(l => l.date)), [logs]);

  const latestStart = periodStarts.length > 0 ? periodStarts[periodStarts.length - 1] : null;

  // Sonraki döngü tahmini: 2+ başlangıçta aralarındaki farkların ortalaması, tek kayıtta 28 gün
  const cycleInfo = useMemo(() => {
    if (!latestStart) return null;
    const cycleLength = periodStarts.length >= 2
      ? Math.round(dayjs(latestStart).diff(dayjs(periodStarts[0]), "day") / (periodStarts.length - 1))
      : DEFAULT_CYCLE_LENGTH;
    const nextPeriodDate = dayjs(latestStart).add(cycleLength, "day");
    // İkisi de gün başına sabitlenir; saat farkı yüzünden bir gün şaşmaz
    const daysLeft = nextPeriodDate.diff(dayjs(today), "day");

    let countdownText: string;
    if (daysLeft > 0) {
      countdownText = `Sonraki Döngü: ${daysLeft} Gün Kaldı (${nextPeriodDate.locale("tr").format("D MMMM")}) 🌸`;
    } else if (daysLeft === 0) {
      countdownText = "Bugün yeni döngü günü bekleniyor 🌸";
    } else {
      countdownText = `${Math.abs(daysLeft)} gün gecikti ⏳`;
    }
    return { cycleLength, nextPeriodDate, daysLeft, countdownText };
  }, [periodStarts, latestStart, today]);

  // Her başlangıçtan itibaren 5 günlük süreç (başlangıç günü dahil) otomatik boyanır
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    periodStarts.forEach(startStr => {
      getPeriodDays(startStr).forEach((dayStr, i) => {
        marks[dayStr] = {
          customStyles: {
            container: {
              backgroundColor: i === 0 ? '#FF3366' : 'rgba(255, 77, 106, 0.75)',
              borderRadius: 18,
            },
            text: {
              color: '#ffffff',
              fontWeight: i === 0 ? 'bold' : '600',
            },
          },
        };
      });
    });
    return marks;
  }, [periodStarts]);

  const startedToday = !!logs?.some(l => l.date === today);

  // Yeni başlangıç eklenmeden önce manipülasyon kontrolleri (DB trigger'ı da aynı kuralları uygular)
  function validateNewStart(dateStr: string): boolean {
    if (dayjs(dateStr).isAfter(dayjs(today), "day")) {
      Alert.alert("Geçersiz Tarih", "Gelecekteki bir günü regl başlangıcı olarak işaretleyemezsiniz.");
      return false;
    }

    const currentMonthStr = dateStr.substring(0, 7);
    const monthLogs = logs?.filter(l => l.date.startsWith(currentMonthStr)) || [];
    if (monthLogs.length >= MAX_STARTS_PER_MONTH) {
      Alert.alert("Sınır 🌸", "Biyolojik olarak bir ay içerisinde en fazla 2 ayrı regl başlangıcı kaydedebilirsiniz.");
      return false;
    }

    const targetDate = dayjs(dateStr);
    const tooClose = logs?.some(l => Math.abs(targetDate.diff(dayjs(l.date), "day")) < MIN_DAYS_BETWEEN_STARTS);
    if (tooClose) {
      Alert.alert("Biyolojik Aralık 🌸", "İki regl başlangıcı arasında en az 16 gün ara bulunmalıdır.");
      return false;
    }
    return true;
  }

  async function savePeriodStart(dateStr: string) {
    if (!userId) return;
    const { error } = await supabase.from("period_logs").insert({
      user_id: userId,
      date: dateStr,
      couple_id: coupleId,
    });
    if (error) throw error;

    // Geçmişe dönük girişte "regl başladı" bildirimi yanıltıcı olur; yalnızca bugün başlayanlar haber verilir
    if (isPremium && coupleId && dateStr === today) {
      const senderName = profile?.displayName || "Partnerin";
      notifyPartner(coupleId, userId, "Regl Dönemi 🌸", `${senderName} için regl dönemi başladı. Ona biraz daha özen gösterme zamanı!`, {
        type: "period",
        route: "/(tabs)/period-tracker",
        actionLabel: "Yanındayım 🌸",
      });
    }
    queryClient.invalidateQueries({ queryKey: ["period_logs"] });
  }

  function handleDateClick(day: any) {
    if (executeOrIntercept(
      () => {},
      "Döngü Takibini Başlatmak İçin Kayıt Olun 🌸",
      "Kişisel döngünüzü kaydetmek, bilimsel tahminler almak ve partnerinizle paylaşmak için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }
    if (!isFemale) {
      Alert.alert("Bilgi 🌸", "Regl takvimini yalnızca kadın partner güncelleyebilir.");
      return;
    }

    const dateStr = day.dateString;
    const exists = logs?.some(l => l.date === dateStr);

    // Silme her zaman serbest; kurallar yalnızca yeni başlangıç eklerken geçerli
    if (!exists && !validateNewStart(dateStr)) return;

    setSelectedDate(dateStr);
    setIsAdding(!exists);
  }

  // "Bugün Reglim Başladı" — onay penceresi olmadan tek dokunuşla bugünü başlangıç olarak kaydeder
  async function handleQuickStart() {
    if (executeOrIntercept(
      () => {},
      "Döngü Takibini Başlatmak İçin Kayıt Olun 🌸",
      "Kişisel döngünüzü kaydetmek, bilimsel tahminler almak ve partnerinizle paylaşmak için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }
    if (!isFemale || !userId || startedToday || loading) return;
    if (!validateNewStart(today)) return;

    setLoading(true);
    try {
      await savePeriodStart(today);
    } catch (error: any) {
      logger.error("Period quick start error:", error);
      Alert.alert("Hata", error?.message || "İşlem sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle() {
    if (executeOrIntercept(
      () => {},
      "Döngü Takibini Başlatmak İçin Kayıt Olun 🌸",
      "Kişisel döngünüzü kaydetmek, bilimsel tahminler almak ve partnerinizle paylaşmak için ücretsiz hesabınızı oluşturun."
    )) {
      setSelectedDate(null);
      return;
    }
    if (!selectedDate || !userId) return;
    setLoading(true);

    try {
      if (isAdding) {
        await savePeriodStart(selectedDate);
      } else {
        const { error } = await supabase
          .from("period_logs")
          .delete()
          .eq("user_id", userId)
          .eq("date", selectedDate);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["period_logs"] });
      }

      setSelectedDate(null);
    } catch (error: any) {
      logger.error("Period save error:", error);
      Alert.alert("Hata", error?.message || "İşlem sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity 
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
            <Text style={[styles.headerTitle, { color: theme.text }]}>Döngü & Regl Takvimi</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
              {isFemale ? "Kişisel Döngü & Sağlık Takibi 🌸" : "Sevgilinin Döngüsü & Destek Rehberi 💕"}
            </Text>
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
          {/* ─── PREMIUM OLMAYAN HESAPLAR İÇİN ULTRA LÜKS KİLİT KARTI ─── */}
          {isMaleLocked ? (
            <View style={[styles.luxuryLockCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
              <View style={styles.luxuryLockGlow}>
                <View style={[styles.luxuryLockIconBox, { backgroundColor: "rgba(255, 77, 106, 0.15)", borderColor: "rgba(255, 77, 106, 0.35)" }]}>
                  <Crown color="#ff4d6a" size={32} />
                </View>
              </View>

              <View style={styles.vipBadge}>
                <Sparkles size={13} color="#ffd700" />
                <Text style={styles.vipBadgeText}>VIP ÇİFT AYRICALIĞI</Text>
              </View>

              <Text style={styles.luxuryLockTitle}>
                Sevgilinin Döngüsünü Birlikte Takip Edin 💕
              </Text>
              
              <Text style={styles.luxuryLockDesc}>
                Partnerinizin hassas dönemlerinden haberdar olarak ona en doğru zamanda anlayış ve şefkatle yaklaşabilirsiniz.
              </Text>

              {/* Avantaj Maddeleri */}
              <View style={styles.perksList}>
                <View style={styles.perkItem}>
                  <View style={styles.perkBullet}>
                    <Check size={13} color="#22c55e" strokeWidth={3} />
                  </View>
                  <Text style={styles.perkText}>Hassas günlerinde sevgiline şefkatle destek ol</Text>
                </View>

                <View style={styles.perkItem}>
                  <View style={styles.perkBullet}>
                    <Check size={13} color="#22c55e" strokeWidth={3} />
                  </View>
                  <Text style={[styles.perkText, { color: theme.text }]}>Özel günleri ve tatil planlarını rahatça organize et</Text>
                </View>

                <View style={styles.perkItem}>
                  <View style={styles.perkBullet}>
                    <Check size={13} color="#22c55e" strokeWidth={3} />
                  </View>
                  <Text style={[styles.perkText, { color: theme.text }]}>Duygu durum değişimlerini önceden fark et ve anlayış göster</Text>
                </View>
              </View>

              {/* Lüks CTA Butonu */}
              <TouchableOpacity
                onPress={() => setShowPaywall(true)}
                activeOpacity={0.88}
                style={[styles.upgradeBtn, { backgroundColor: theme.accent }]}
              >
                <Crown color="#ffffff" size={18} />
                <Text style={styles.upgradeBtnText}>Ayrıcalıkları Keşfet ✨</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* ─── KADIN YA DA PREMIUM ERKEK İÇİN DURUM ÖZETİ KARTI ─── */}
              <View style={[styles.statusHeroCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                <View style={[styles.statusHeroIconBox, { backgroundColor: "rgba(255, 77, 106, 0.15)" }]}>
                  <Droplet size={24} color="#ff4d6a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusHeroTitle, { color: theme.text }]}>
                    {isFemale ? "Döngü Takibi Aktif 🌸" : "Sevgilinin Döngüsü Takipte 💕"}
                  </Text>
                  <Text style={[styles.statusHeroSubtitle, { color: theme.textMuted }]}>
                    {latestStart
                      ? `Son başlangıç: ${dayjs(latestStart).locale("tr").format("D MMMM YYYY")}`
                      : "Henüz bir regl başlangıcı kaydedilmedi."
                    }
                  </Text>
                  {cycleInfo && (
                    <Text style={styles.statusHeroCountdown}>{cycleInfo.countdownText}</Text>
                  )}
                </View>
              </View>

              {/* ─── KADIN KULLANICI İÇİN TEK DOKUNUŞLUK BAŞLANGIÇ BUTONU ─── */}
              {isFemale && (
                <TouchableOpacity
                  onPress={handleQuickStart}
                  disabled={loading || startedToday}
                  activeOpacity={0.88}
                  style={[
                    styles.quickStartBtn,
                    startedToday
                      ? { backgroundColor: "rgba(255, 77, 106, 0.12)", borderWidth: 1, borderColor: "rgba(255, 77, 106, 0.35)" }
                      : { backgroundColor: "#ff4d6a" },
                    loading && { opacity: 0.7 },
                  ]}
                >
                  {loading && !selectedDate ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : startedToday ? (
                    <>
                      <Check color="#ff4d6a" size={18} strokeWidth={3} />
                      <Text style={[styles.quickStartBtnText, { color: "#ff4d6a" }]}>Bugün Kaydedildi</Text>
                    </>
                  ) : (
                    <>
                      <Droplet color="#ffffff" size={18} />
                      <Text style={styles.quickStartBtnText}>Bugün Reglim Başladı 🌸</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* ─── ERKEK KULLANICI İÇİN ŞEFKAT & DESTEK REHBERİ ─── */}
              {!isFemale && (
                <View style={[styles.gentleGuideCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                  <View style={styles.guideHeader}>
                    <MessageCircleHeart size={18} color="#ff4d6a" />
                    <Text style={[styles.guideTitle, { color: theme.text }]}>Sevgiline Destek Olma İpuçları</Text>
                  </View>
                  <View style={styles.guideItemsBox}>
                    <View style={styles.guideItemRow}>
                      <Text style={{ fontSize: 16 }}>🍫</Text>
                      <Text style={[styles.guideItemText, { color: theme.textSecondary }]}>Ona en sevdiği çikolatayı veya tatlıyı hediye edebilirsin.</Text>
                    </View>
                    <View style={styles.guideItemRow}>
                      <Text style={{ fontSize: 16 }}>☕</Text>
                      <Text style={[styles.guideItemText, { color: theme.textSecondary }]}>Sıcak bir bitki çayı hazırlayıp rahatlamasına yardımcı ol.</Text>
                    </View>
                    <View style={styles.guideItemRow}>
                      <Text style={{ fontSize: 16 }}>🫂</Text>
                      <Text style={[styles.guideItemText, { color: theme.textSecondary }]}>Ekstra anlayışlı davranıp onu sımsıkı kucakla.</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* ─── KADIN KULLANICI İÇİN İPUCU KARTI ─── */}
              {isFemale && (
                <View style={[styles.femaleTipsCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                  <View style={styles.guideHeader}>
                    <Sparkles size={17} color={theme.accent} />
                    <Text style={[styles.guideTitle, { color: theme.text }]}>Günün Kendine Bakım Notu</Text>
                  </View>
                  <Text style={[styles.femaleTipsText, { color: theme.textSecondary }]}>
                    Her gün işaretlemene gerek yok; yalnızca reglinin başladığı günü seç ya da yukarıdaki butona dokun. 5 günlük süreci ve sonraki döngüyü biz hesaplarız. Bol su içmeyi ve kendini dinlendirmeyi unutma tatlım 🌸
                  </Text>
                </View>
              )}

              {/* ─── MODERN TAKVİM ─── */}
              <View style={[styles.calendarBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                {isLoading ? (
                  <View style={{ padding: 20, gap: 12 }}>
                    <Skeleton height={260} borderRadius={18} />
                  </View>
                ) : (
                  <Calendar
                    key={`${theme.id}_${theme.gender}`}
                    current={today}
                    onDayPress={handleDateClick}
                    markedDates={markedDates}
                    markingType={'custom'}
                    theme={{
                      calendarBackground: 'transparent',
                      textSectionTitleColor: theme.textMuted,
                      todayTextColor: '#ff4d6a',
                      selectedDayBackgroundColor: '#ff4d6a',
                      selectedDayTextColor: '#ffffff',
                      dayTextColor: theme.text,
                      textDisabledColor: isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.2)',
                      arrowColor: theme.accent,
                      monthTextColor: theme.text,
                      textMonthFontWeight: '700',
                      textDayFontSize: 14.5,
                      textMonthFontSize: 16.5,
                      textDayHeaderFontSize: 11,
                      textDayHeaderFontWeight: '600'
                    }}
                  />
                )}
              </View>

              {/* ─── GEÇMİŞ DÖNGÜ KAYITLARI ─── */}
              <View style={styles.pastRecordsSection}>
                <Text style={[styles.pastSectionTitle, { color: theme.textMuted }]}>GEÇMİŞ KAYITLAR</Text>

                {!logs || logs.length === 0 ? (
                  <View style={[styles.emptyBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>🌸</Text>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Henüz kayıtlı bir döngü günü bulunmuyor.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {logs.map(log => {
                      const logDate = dayjs(log.date);
                      return (
                        <View key={log.id} style={[styles.logCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                          <View style={styles.logLeftCol}>
                            <View style={[styles.logDropBadge, { backgroundColor: "rgba(255, 77, 106, 0.15)" }]}>
                              <Droplet size={18} color="#ff4d6a" />
                            </View>
                            <View>
                              <Text style={[styles.logDateText, { color: theme.text }]}>{logDate.locale("tr").format("DD MMMM YYYY")}</Text>
                              <Text style={[styles.logDayText, { color: theme.textMuted }]}>{logDate.locale("tr").format("dddd")}</Text>
                            </View>
                          </View>
                          <View style={styles.logRightTag}>
                            <Text style={styles.logRightTagText}>{logDate.locale("tr").format("MMMM")}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {/* ─── TARİH KAYIT / SİLME MODALI ─── */}
      <Modal visible={!!selectedDate} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={[styles.modalIconCircle, { backgroundColor: "rgba(255, 77, 106, 0.15)" }]}>
              <Droplet size={28} color="#ff4d6a" />
            </View>

            <Text style={[styles.modalDateTitle, { color: theme.text }]}>
              {selectedDate ? dayjs(selectedDate).locale("tr").format("DD MMMM YYYY, dddd") : ""}
            </Text>
            
            <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
              {isAdding 
                ? "Bu günü regl başlangıcı olarak işaretlemek istiyor musunuz?" 
                : "Bu tarihteki regl kaydını kaldırmak istiyor musunuz?"
              }
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: theme.unitBg, borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)" }]}
                disabled={loading}
                onPress={() => setSelectedDate(null)}
              >
                <Text style={[styles.modalCancelBtnText, { color: theme.textSecondary }]}>Vazgeç</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn, 
                  { backgroundColor: isAdding ? "#ff4d6a" : "rgba(239, 68, 68, 0.85)" }, 
                  loading && { opacity: 0.7 }
                ]}
                disabled={loading}
                onPress={handleToggle}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Check color="#ffffff" size={16} />
                    <Text style={styles.modalConfirmBtnText}>
                      {isAdding ? "İşaretle" : "Kaydı Sil"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── PREMIUM PAYWALL MODALI ─── */}
      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName="Döngü & Regl Takvimi"
        featureDescription="Sevgilinizin döngüsünü birlikte takip edin, hassas dönemlerinde ona en doğru şekilde destek olun."
        gender={profile?.gender}
      />
      <PageTourModal visible={isTourVisible} guide={guide} onClose={closeTour} />
      <DemoActionModal
        visible={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        title={modalConfig.title}
        description={modalConfig.description}
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
    fontSize: 21,
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

  /* ─── LÜKS KİLİT KARTI (PREMIUMSIZ) ─── */
  luxuryLockCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  luxuryLockGlow: {
    marginBottom: 16,
  },
  luxuryLockIconBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  vipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 215, 0, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 12,
  },
  vipBadgeText: {
    color: "#ffd700",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  luxuryLockTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    textAlign: "center",
    letterSpacing: -0.2,
    marginBottom: 8,
  },
  luxuryLockDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  perksList: {
    width: "100%",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 22,
  },
  perkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  perkBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  perkText: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.85)",
    flex: 1,
  },
  upgradeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    height: 48,
    borderRadius: 16,
  },
  upgradeBtnText: {
    color: "#ffffff",
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },

  /* ─── DURUM HERO KARTI ─── */
  statusHeroCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
  },
  statusHeroIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  statusHeroTitle: {
    fontSize: 15.5,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  statusHeroSubtitle: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },

  statusHeroCountdown: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
    color: "#ff4d6a",
    marginTop: 4,
  },
  quickStartBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 18,
  },
  quickStartBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },

  /* ─── ŞEFKAT & DESTEK REHBERİ ─── */
  gentleGuideCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  guideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  guideTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
  },
  guideItemsBox: {
    gap: 8,
  },
  guideItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 10,
    borderRadius: 12,
  },
  guideItemText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    flex: 1,
  },

  /* KADIN İPUCU KARTI */
  femaleTipsCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  femaleTipsText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 18,
  },

  /* MODERN TAKVİM KUTUSU */
  calendarBox: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    paddingVertical: 8,
  },

  /* GEÇMİŞ KAYITLAR */
  pastRecordsSection: {
    gap: 10,
  },
  pastSectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  emptyBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
  logCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  logLeftCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logDropBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  logDateText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  logDayText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  logRightTag: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  logRightTagText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.75)",
  },

  /* MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: {
    width: "100%",
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    alignItems: "center",
    gap: 12,
  },
  modalIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  modalDateTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    textAlign: "center",
  },
  modalDescription: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  modalConfirmBtn: {
    flex: 1.3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 44,
    borderRadius: 14,
  },
  modalConfirmBtnText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
  },
});
