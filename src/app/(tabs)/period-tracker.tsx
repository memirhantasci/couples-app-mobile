import { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from "react-native";
import { appAlert } from "@/lib/dialog";
import { DialogHost } from "@/components/ui/DialogHost";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dayjs, todayString } from "@/lib/date";
import { logger } from "@/utils/logger";
import { Calendar } from "react-native-calendars";
import "@/lib/calendarLocale";
import { Check, ChevronLeft, AlignJustify, Crown, Sparkles, Droplet, MessageCircleHeart } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { usePageTour } from "@/hooks/usePageTour";
import { useDeferredReady } from "@/hooks/useDeferredReady";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { useDemoAction } from "@/hooks/useDemoAction";
import { LazyPremiumPaywall, LazyPageTourModal, LazyDemoActionModal } from "@/components/ui/lazyMount";
import {
  MAX_REASONABLE_DELAY_DAYS, MAX_STARTS_PER_MONTH, MIN_DAYS_BETWEEN_STARTS,
  estimateCycleLength, getPeriodStarts, getPeriodDays,
} from "@/lib/periodCycle";
import { useTranslation } from "react-i18next";
import { localizeServerError } from "@/lib/serverErrors";

export default function PeriodTrackerScreen() {
  const { t, i18n } = useTranslation();
  const { session, profile, isDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme, isLight } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const goldColor = isLight ? "#A16207" : "#ffd700";
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = todayString();
  const insets = useSafeAreaInsets();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;

  // Cinsiyet doğrudan profil önbelleğinden okunur — ekstra DB sorgusu atilmaz
  const isFemale = profile?.gender === "female";
  // Demo modunda premium kilitleri yoktur: tüm özellikler açık
  const isPremium = (profile?.isPremium ?? false) || isDemoMode;
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

      // Döngü tahmini son birkaç kayda dayanır: tüm geçmişi indirmeye gerek yok
      const { data } = await query.limit(240);
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

  // Sonraki döngü tahmini: son aralıklardan yalnızca 21–35 günlük olanların ortalaması, yoksa standart 28 gün
  const cycleInfo = useMemo(() => {
    if (!latestStart) return null;
    const cycleLength = estimateCycleLength(periodStarts);
    const nextPeriodDate = dayjs(latestStart).add(cycleLength, "day");
    // İkisi de gün başına sabitlenir; saat farkı yüzünden bir gün şaşmaz
    const daysLeft = nextPeriodDate.diff(dayjs(today), "day");

    let countdownText: string;
    if (daysLeft > 0) {
      countdownText = t("period.countdown.next", { count: daysLeft, date: nextPeriodDate.locale(i18n.language).format("D MMMM") });
    } else if (daysLeft === 0) {
      countdownText = t("period.countdown.today");
    } else if (-daysLeft <= MAX_REASONABLE_DELAY_DAYS) {
      countdownText = t("period.countdown.late", { count: -daysLeft });
    } else {
      // Çok uzun süredir kayıt yok: gecikme değil, büyük olasılıkla yeni başlangıç işaretlenmemiş
      countdownText = t("period.countdown.waiting");
    }
    return { cycleLength, nextPeriodDate, daysLeft, countdownText };
  }, [periodStarts, latestStart, today, t, i18n.language]);

  // Takvime verilen tema nesnesi sabit kalmalı: her render'da yeni nesne gelirse react-native-calendars
  // stil sayfasını ve 42 gün hücresini baştan oluşturuyordu
  const calendarTheme = useMemo(() => ({
    calendarBackground: "transparent",
    textSectionTitleColor: theme.textMuted,
    todayTextColor: "#ff4d6a",
    selectedDayBackgroundColor: "#ff4d6a",
    selectedDayTextColor: "#ffffff",
    dayTextColor: theme.text,
    textDisabledColor: isLight ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.2)",
    arrowColor: theme.accent,
    monthTextColor: theme.text,
    textMonthFontWeight: "700" as const,
    textDayFontSize: 14.5,
    textMonthFontSize: 16.5,
    textDayHeaderFontSize: 11,
    textDayHeaderFontWeight: "600" as const,
  }), [theme.textMuted, theme.text, theme.accent, isLight]);

  // Geçmiş kayıt listesi takvimin altında kalır: ilk karede çizilmez, hemen ardından eklenir
  const showPastRecords = useDeferredReady();

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
      appAlert(t("period.errors.invalidDateTitle"), t("period.errors.futureStart"));
      return false;
    }

    const currentMonthStr = dateStr.substring(0, 7);
    const monthLogs = logs?.filter(l => l.date.startsWith(currentMonthStr)) || [];
    if (monthLogs.length >= MAX_STARTS_PER_MONTH) {
      appAlert(t("period.errors.limitTitle"), t("period.errors.limitMessage"));
      return false;
    }

    const targetDate = dayjs(dateStr);
    const tooClose = logs?.some(l => Math.abs(targetDate.diff(dayjs(l.date), "day")) < MIN_DAYS_BETWEEN_STARTS);
    if (tooClose) {
      appAlert(t("period.errors.intervalTitle"), t("period.errors.intervalMessage"));
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

    // Regl başladı bilgisi partnere push olarak GÖNDERİLMEZ (gizlilik); erkek partner yalnızca
    // home.tsx'teki yerel "Özel Gün Yaklaşıyor" hatırlatıcısını alır.
    queryClient.invalidateQueries({ queryKey: ["period_logs"] });
  }

  function handleDateClick(day: any) {
    if (executeOrIntercept(
      () => {},
      t("demo.prompts.cycle.title"),
      t("demo.prompts.cycle.description")
    )) {
      return;
    }
    if (!isFemale) {
      appAlert(t("period.info.title"), t("period.info.femaleOnly"));
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
      t("demo.prompts.cycle.title"),
      t("demo.prompts.cycle.description")
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
      appAlert(t("common.error"), localizeServerError(error, t("errors.actionFailed")));
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle() {
    if (executeOrIntercept(
      () => {},
      t("demo.prompts.cycle.title"),
      t("demo.prompts.cycle.description")
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
      appAlert(t("common.error"), localizeServerError(error, t("errors.actionFailed")));
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
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
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
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t("menu.cycle.title")}</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
              {isFemale ? t("period.subtitle.female") : t("period.subtitle.male")}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TourGuideButton onPress={openTour} />
            <TouchableOpacity 
              accessibilityRole="button"
              accessibilityLabel={t("common.openMenu")}
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
            <View style={[styles.luxuryLockCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
              <View style={styles.luxuryLockGlow}>
                <View style={[styles.luxuryLockIconBox, { backgroundColor: "rgba(255, 77, 106, 0.15)", borderColor: "rgba(255, 77, 106, 0.35)" }]}>
                  <Crown color="#ff4d6a" size={32} />
                </View>
              </View>

              <View style={styles.vipBadge}>
                <Sparkles size={13} color={goldColor} />
                <Text style={styles.vipBadgeText}>{t("paywall.vipBadge")}</Text>
              </View>

              <Text style={styles.luxuryLockTitle}>
                {t("period.lock.title")}
              </Text>

              <Text style={styles.luxuryLockDesc}>
                {t("period.lock.description")}
              </Text>

              {/* Avantaj Maddeleri */}
              <View style={styles.perksList}>
                <View style={styles.perkItem}>
                  <View style={styles.perkBullet}>
                    <Check size={13} color="#22c55e" strokeWidth={3} />
                  </View>
                  <Text style={styles.perkText}>{t("period.lock.bullet1")}</Text>
                </View>

                <View style={styles.perkItem}>
                  <View style={styles.perkBullet}>
                    <Check size={13} color="#22c55e" strokeWidth={3} />
                  </View>
                  <Text style={[styles.perkText, { color: theme.text }]}>{t("period.lock.bullet2")}</Text>
                </View>

                <View style={styles.perkItem}>
                  <View style={styles.perkBullet}>
                    <Check size={13} color="#22c55e" strokeWidth={3} />
                  </View>
                  <Text style={[styles.perkText, { color: theme.text }]}>{t("period.lock.bullet3")}</Text>
                </View>
              </View>

              {/* Lüks CTA Butonu */}
              <TouchableOpacity
                onPress={() => setShowPaywall(true)}
                activeOpacity={0.88}
                style={[styles.upgradeBtn, { backgroundColor: theme.accent }]}
              >
                <Crown color="#ffffff" size={18} />
                <Text style={styles.upgradeBtnText}>{t("paywall.discoverPerks")}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* ─── KADIN YA DA PREMIUM ERKEK İÇİN DURUM ÖZETİ KARTI ─── */}
              <View style={[styles.statusHeroCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
                <View style={[styles.statusHeroIconBox, { backgroundColor: "rgba(255, 77, 106, 0.15)" }]}>
                  <Droplet size={24} color="#ff4d6a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusHeroTitle, { color: theme.text }]}>
                    {isFemale ? t("period.status.activeFemale") : t("period.status.activeMale")}
                  </Text>
                  <Text style={[styles.statusHeroSubtitle, { color: theme.textMuted }]}>
                    {latestStart
                      ? t("period.status.lastStart", { date: dayjs(latestStart).locale(i18n.language).format("D MMMM YYYY") })
                      : t("period.status.none")
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
                      <Text style={[styles.quickStartBtnText, { color: "#ff4d6a" }]}>{t("period.today.logged")}</Text>
                    </>
                  ) : (
                    <>
                      <Droplet color="#ffffff" size={18} />
                      <Text style={styles.quickStartBtnText}>{t("period.today.start")}</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {/* ─── ERKEK KULLANICI İÇİN ŞEFKAT & DESTEK REHBERİ ─── */}
              {!isFemale && (
                <View style={[styles.gentleGuideCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
                  <View style={styles.guideHeader}>
                    <MessageCircleHeart size={18} color="#ff4d6a" />
                    <Text style={[styles.guideTitle, { color: theme.text }]}>{t("period.tips.title")}</Text>
                  </View>
                  <View style={styles.guideItemsBox}>
                    <View style={styles.guideItemRow}>
                      <Text style={{ fontSize: 16 }}>🍫</Text>
                      <Text style={[styles.guideItemText, { color: theme.textSecondary }]}>{t("period.tips.tip1")}</Text>
                    </View>
                    <View style={styles.guideItemRow}>
                      <Text style={{ fontSize: 16 }}>☕</Text>
                      <Text style={[styles.guideItemText, { color: theme.textSecondary }]}>{t("period.tips.tip2")}</Text>
                    </View>
                    <View style={styles.guideItemRow}>
                      <Text style={{ fontSize: 16 }}>🫂</Text>
                      <Text style={[styles.guideItemText, { color: theme.textSecondary }]}>{t("period.tips.tip3")}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* ─── KADIN KULLANICI İÇİN İPUCU KARTI ─── */}
              {isFemale && (
                <View style={[styles.femaleTipsCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
                  <View style={styles.guideHeader}>
                    <Sparkles size={17} color={theme.accent} />
                    <Text style={[styles.guideTitle, { color: theme.text }]}>{t("period.selfCare.title")}</Text>
                  </View>
                  <Text style={[styles.femaleTipsText, { color: theme.textSecondary }]}>
                    {t("period.selfCare.text")}
                  </Text>
                </View>
              )}

              {/* ─── MODERN TAKVİM ─── */}
              <View style={[styles.calendarBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
                {isLoading ? (
                  <View style={{ padding: 20, gap: 12 }}>
                    <Skeleton height={260} borderRadius={18} />
                  </View>
                ) : (
                  <Calendar
                    key={`${theme.id}_${theme.gender}_${i18n.language}`}
                    current={today}
                    onDayPress={handleDateClick}
                    markedDates={markedDates}
                    markingType={'custom'}
                    theme={calendarTheme}
                  />
                )}
              </View>

              {/* ─── GEÇMİŞ DÖNGÜ KAYITLARI ─── */}
              <View style={styles.pastRecordsSection}>
                <Text style={[styles.pastSectionTitle, { color: theme.textMuted }]}>{t("period.history.title")}</Text>

                {!showPastRecords ? null : !logs || logs.length === 0 ? (
                  <View style={[styles.emptyBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1, ...theme.cardShadow }]}>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>🌸</Text>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t("period.history.empty")}</Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {logs.map(log => {
                      const logDate = dayjs(log.date);
                      return (
                        <View key={log.id} style={[styles.logCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
                          <View style={styles.logLeftCol}>
                            <View style={[styles.logDropBadge, { backgroundColor: "rgba(255, 77, 106, 0.15)" }]}>
                              <Droplet size={18} color="#ff4d6a" />
                            </View>
                            <View>
                              <Text style={[styles.logDateText, { color: theme.text }]}>{logDate.locale(i18n.language).format("DD MMMM YYYY")}</Text>
                              <Text style={[styles.logDayText, { color: theme.textMuted }]}>{logDate.locale(i18n.language).format("dddd")}</Text>
                            </View>
                          </View>
                          <View style={styles.logRightTag}>
                            <Text style={styles.logRightTagText}>{logDate.locale(i18n.language).format("MMMM")}</Text>
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
      <Modal visible={!!selectedDate} transparent animationType="fade" onRequestClose={() => setSelectedDate(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
            <View style={[styles.modalIconCircle, { backgroundColor: "rgba(255, 77, 106, 0.15)" }]}>
              <Droplet size={28} color="#ff4d6a" />
            </View>

            <Text style={[styles.modalDateTitle, { color: theme.text }]}>
              {selectedDate ? dayjs(selectedDate).locale(i18n.language).format("DD MMMM YYYY, dddd") : ""}
            </Text>

            <Text style={[styles.modalDescription, { color: theme.textSecondary }]}>
              {isAdding 
                ? t("period.modal.addQuestion") 
                : t("period.modal.removeQuestion")
              }
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: theme.unitBg, borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.08)" }]}
                disabled={loading}
                onPress={() => setSelectedDate(null)}
              >
                <Text style={[styles.modalCancelBtnText, { color: theme.textSecondary }]}>{t("common.cancel")}</Text>
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
                      {isAdding ? t("period.modal.mark") : t("period.modal.delete")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {/* Bu modal açıkken uyarılar/diyaloglar (kök katman modalın arkasında kalır) burada çizilir */}
        <DialogHost embedded visible={!!selectedDate} />
      </Modal>

      {/* ─── PREMIUM PAYWALL MODALI ─── */}
      <LazyPremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName={t("menu.cycle.title")}
        featureDescription={t("period.premium.featureDescription")}
        gender={profile?.gender}
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
      fontSize: 21,
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

    /* ─── LÜKS KİLİT KARTI (PREMIUMSIZ) ─── */
    luxuryLockCard: {
      borderRadius: 24,
      borderWidth: 1,
      padding: 24,
      alignItems: "center",
      marginTop: 10,
      ...(isLight
        ? theme.cardShadow
        : {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 6,
          }),
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
      backgroundColor: isLight ? "rgba(202, 138, 4, 0.12)" : "rgba(255, 215, 0, 0.12)",
      borderWidth: 1,
      borderColor: isLight ? "rgba(161, 98, 7, 0.40)" : "rgba(255, 215, 0, 0.3)",
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 12,
      marginBottom: 12,
    },
    vipBadgeText: {
      color: isLight ? "#A16207" : "#ffd700",
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      letterSpacing: 0.8,
    },
    luxuryLockTitle: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      textAlign: "center",
      letterSpacing: -0.2,
      marginBottom: 8,
    },
    luxuryLockDesc: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.6)",
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 20,
      paddingHorizontal: 8,
    },
    perksList: {
      width: "100%",
      gap: 12,
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.03)",
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.06)",
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
      color: isLight ? theme.text : "rgba(255,255,255,0.85)",
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
      ...theme.cardShadow,
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
      color: theme.text,
      letterSpacing: -0.2,
    },
    statusHeroSubtitle: {
      fontSize: 12.5,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.6)",
      marginTop: 2,
    },

    statusHeroCountdown: {
      fontSize: 12.5,
      fontFamily: "Inter_600SemiBold",
      color: isLight ? "#E11D48" : "#ff4d6a",
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
      ...theme.cardShadow,
    },
    guideHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    guideTitle: {
      fontSize: 14,
      fontFamily: "Inter_700Bold",
      color: theme.text,
    },
    guideItemsBox: {
      gap: 8,
    },
    guideItemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.03)",
      padding: 10,
      borderRadius: 12,
    },
    guideItemText: {
      fontSize: 12.5,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.75)",
      flex: 1,
    },

    /* KADIN İPUCU KARTI */
    femaleTipsCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
      gap: 8,
      ...theme.cardShadow,
    },
    femaleTipsText: {
      fontSize: 12.5,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.75)",
      lineHeight: 18,
    },

    /* MODERN TAKVİM KUTUSU */
    calendarBox: {
      borderRadius: 22,
      borderWidth: 1,
      overflow: "hidden",
      paddingVertical: 8,
      ...theme.cardShadow,
    },

    /* GEÇMİŞ KAYITLAR */
    pastRecordsSection: {
      gap: 10,
    },
    pastSectionTitle: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.5)",
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
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.5)",
      textAlign: "center",
    },
    logCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      ...theme.cardShadow,
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
      color: theme.text,
    },
    logDayText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.55)",
      marginTop: 2,
    },
    logRightTag: {
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    logRightTagText: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.75)",
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
      color: theme.text,
      textAlign: "center",
    },
    modalDescription: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.65)",
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
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.7)",
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
};
