import React, { useCallback, useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import {
  dayjs,
  daysSince,
  dayOfYear,
  todayString,
} from "@/lib/date";
import { getQuoteForDay } from "@/lib/quotes";
import { decrypt, deterministicDecrypt } from "@/utils/crypto";
import { computeLoveScore, getCachedLoveScore, LoveScoreResult } from "@/lib/loveScore";
import { scheduleDateLocalNotification, cancelLocalNotification } from "@/lib/notifications";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { 
  AlignJustify, Sparkles, Heart, Images, 
  BookOpen, Mail, MapPin, Calendar, Flame, Clock, ChevronRight
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";

import { LoveMeter } from "@/components/home/LoveMeter";
import { MoodSelector } from "@/components/home/MoodSelector";
import { DailyNoteCard } from "@/components/home/DailyNoteCard";
import { MeetingCountdown } from "@/components/home/MeetingCountdown";
import { PendingLettersCard } from "@/components/home/PendingLettersCard";
import { usePageTour } from "@/hooks/usePageTour";
import { PageTourModal } from "@/components/tour/PageTourModal";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { DEMO_HOME_DATA, DEMO_LOVE_SCORE } from "@/constants/demoData";
import { CoupleWrappedModal } from "@/components/wrapped/CoupleWrappedModal";
import { computeCoupleWrapped, CoupleWrappedData } from "@/utils/wrappedCalculator";
import { syncCoupleWidget } from "@/utils/widgetBridge";

export default function HomeScreen() {
  const { session, profile, isDemoMode } = useAuth();
  const { theme, isLight } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const today = todayString();
  const doy = dayOfYear();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;

  const [cachedScore, setCachedScore] = useState<LoveScoreResult | null>(null);
  const [isWrappedVisible, setIsWrappedVisible] = useState(false);
  const [wrappedData, setWrappedData] = useState<CoupleWrappedData | null>(null);
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("home");

  useEffect(() => {
    if (coupleId && !isDemoMode) {
      getCachedLoveScore(coupleId).then((cached) => {
        if (cached) setCachedScore(cached);
      });
    }
  }, [coupleId, isDemoMode]);

  useEffect(() => {
    computeCoupleWrapped(
      coupleId,
      profile?.relationshipStartDate || profile?.meetDate,
      isDemoMode
    ).then((data) => setWrappedData(data));
  }, [coupleId, profile?.relationshipStartDate, profile?.meetDate, isDemoMode]);

  const { data: dashboardData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["home_dashboard", coupleId, userId, today, isDemoMode],
    enabled: !!userId || isDemoMode,
    queryFn: async () => {
      if (isDemoMode) {
        return DEMO_HOME_DATA as any;
      }
      const [moodRes, noteRes, meetingRes, lettersRes, usersRes] = await Promise.all([
        supabase
          .from("moods")
          .select("mood_type")
          .eq("user_id", userId)
          .eq("date", today)
          .maybeSingle(),
        supabase
          .from("daily_notes")
          .select("content")
          .eq("user_id", userId)
          .eq("date", today)
          .maybeSingle(),
        coupleId
          ? supabase
            .from("meetings")
            .select("id, meeting_datetime, title, location_name, latitude, longitude")
            .eq("couple_id", coupleId)
            .eq("is_active", true)
            .gte("meeting_datetime", dayjs().subtract(3, "hour").toISOString())
            .order("meeting_datetime", { ascending: true })
            .limit(5)
          : Promise.resolve({ data: [] }),
        coupleId
          ? supabase
            .from("letters")
            .select("id, unlock_date, sender_id")
            .eq("couple_id", coupleId)
            .eq("receiver_id", userId)
            .gt("unlock_date", today)
            .order("unlock_date", { ascending: true })
          : Promise.resolve({ data: [] }),
        coupleId
          ? supabase
            .from("users")
            .select("id, username, display_name")
            .eq("couple_id", coupleId)
          : Promise.resolve({ data: [] }),
      ]);

      let activeMeeting = null;
      if (meetingRes.data && Array.isArray(meetingRes.data)) {
        const now = dayjs();
        const futureMeeting = meetingRes.data.find((m) =>
          dayjs(m.meeting_datetime).isAfter(now)
        );
        activeMeeting =
          futureMeeting || meetingRes.data[meetingRes.data.length - 1] || null;
      } else if (meetingRes.data) {
        activeMeeting = meetingRes.data;
      }

      const userMap = (usersRes.data || []).reduce((acc: any, u: any) => {
        acc[u.id] = {
          ...u,
          display_name: u.display_name ? decrypt(u.display_name) : null,
        };
        return acc;
      }, {});

      return {
        currentMood: moodRes.data?.mood_type || null,
        currentNote: noteRes.data?.content ? decrypt(noteRes.data.content) : null,
        activeMeeting,
        pendingLetters: (lettersRes.data || []).map((l: any) => {
          const senderObj = userMap[l.sender_id];
          return {
            ...l,
            sender: senderObj
              ? {
                ...senderObj,
                username: senderObj.username
                  ? deterministicDecrypt(senderObj.username) || senderObj.username
                  : "",
              }
              : undefined,
          };
        }),
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  // ─── Dinamik Aşk Puanı (Çift için %100 simetrik ve adil) ─────────────────────
  const { data: loveScoreData, isLoading: isLoveScoreLoading } = useQuery({
    queryKey: ["love_score", coupleId, today, isDemoMode, profile?.isPremium],
    enabled: !!coupleId || isDemoMode,
    initialData: cachedScore || undefined,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (isDemoMode) {
        return DEMO_LOVE_SCORE as any;
      }
      return computeLoveScore(coupleId!, userId, null, profile?.isPremium);
    },
  });

  // ─── Regl Yaklaşma Bildirimi (Sadece Premium Erkek İçin) ─────────────────────
  useEffect(() => {
    async function setupPeriodNotification() {
      if (isDemoMode || !profile?.isPremium || !coupleId || !userId) return;

      // Premium ise partner bilgisini ve loglarını al
      const { data: usersData } = await supabase
        .from("users")
        .select("id, gender, display_name, username")
        .eq("couple_id", coupleId)
        .neq("id", userId)
        .limit(1);
      
      const partnerData = usersData?.[0] ?? null;

      if (partnerData && partnerData.gender === "female") {
        const decName = partnerData.display_name 
          ? decrypt(partnerData.display_name) 
          : (partnerData.username ? deterministicDecrypt(partnerData.username) : "");
        const partnerName = (decName && !decName.startsWith("enc:") && !decName.startsWith("det:")) ? decName : "Partnerin";

        const { data: periodLogs } = await supabase
          .from("period_logs")
          .select("date")
          .eq("user_id", partnerData.id)
          .order("date", { ascending: false })
          .limit(1);

        if (periodLogs && periodLogs.length > 0) {
          const lastPeriodDate = dayjs(periodLogs[0].date);
          const notifyDate = lastPeriodDate.add(26, "day").hour(10).minute(0).second(0).toDate();
          
          if (notifyDate.getTime() > Date.now()) {
            scheduleDateLocalNotification(
              "period_approach_alert",
              "Regl Yaklaşıyor 🌸",
              `${partnerName} için regl dönemi yaklaşmak üzere. Ona destek olmak için harika bir zaman!`,
              notifyDate
            );
          }
        }
      }
    }
    setupPeriodNotification();
  }, [profile?.isPremium, coupleId, userId]);

  // Dinamik Selamlama
  const getGreeting = () => {
    const hour = dayjs().hour();
    if (hour >= 6 && hour < 12) return { text: "Günaydın", emoji: "☀️" };
    if (hour >= 12 && hour < 18) return { text: "Tünaydın", emoji: "🌸" };
    if (hour >= 18 && hour < 23) return { text: "İyi Akşamlar", emoji: "🌙" };
    return { text: "İyi Geceler", emoji: "✨" };
  };

  const meetDate = profile?.meetDate;
  const relDate = profile?.relationshipStartDate;
  const daysSinceMeeting = meetDate ? daysSince(dayjs(meetDate)) : 0;
  const daysSinceTogether = relDate ? daysSince(dayjs(relDate)) : 0;
  const name = profile?.displayName || "Sevgilim";
  const quote = useMemo(() => getQuoteForDay(doy), [doy]);
  const activeLoveScore = isDemoMode 
    ? { score: 96, subtitle: "Kusursuz Bir Uyum! 💖" }
    : (loveScoreData || cachedScore);
  const loveMeter = activeLoveScore?.score;
  const loveSubtitle = activeLoveScore?.subtitle;
  const dateLabel = useMemo(() => dayjs().format("D MMMM, dddd"), []);
  const greeting = useMemo(() => getGreeting(), []);

  // ─── ANA EKRAN WIDGET SENKRONİZASYONU ───
  useEffect(() => {
    if (!dashboardData) return;
    const moodMap: Record<string, { emoji: string; label: string }> = {
      happy: { emoji: "🥰", label: "Aşk Dolu" },
      calm: { emoji: "😌", label: "Huzurlu" },
      excited: { emoji: "✨", label: "Heyecanlı" },
      tired: { emoji: "😴", label: "Yorgun" },
      sad: { emoji: "🥺", label: "Şefkat İstiyor" },
      loved: { emoji: "💖", label: "Sevgi Dolu" },
    };
    const moodObj = (dashboardData.currentMood && moodMap[dashboardData.currentMood])
      ? moodMap[dashboardData.currentMood]
      : { emoji: "🥰", label: "Aşk Dolu" };

    let meetingDays: number | null = null;
    if (dashboardData.activeMeeting?.meeting_datetime) {
      meetingDays = dayjs(dashboardData.activeMeeting.meeting_datetime).diff(dayjs(), "day");
    }

    syncCoupleWidget({
      partnerName: name,
      daysTogether: daysSinceTogether || daysSinceMeeting || 142,
      moodEmoji: moodObj.emoji,
      moodLabel: moodObj.label,
      dailyNote: dashboardData.currentNote,
      nextMeetingTitle: dashboardData.activeMeeting?.title,
      nextMeetingDays: meetingDays,
      loveScore: loveMeter,
    });
  }, [dashboardData, name, daysSinceTogether, daysSinceMeeting, loveMeter]);

  if ((!session && !isDemoMode) || (!dashboardData && isLoading && !isDemoMode)) {
    return (
      <ScreenBackground style={{ paddingTop: insets.top + 20, paddingHorizontal: 20 }}>
        <Skeleton height={80} borderRadius={20} style={{ marginBottom: 16 }} />
        <Skeleton height={140} borderRadius={24} style={{ marginBottom: 14 }} />
        <Skeleton height={90} borderRadius={20} style={{ marginBottom: 14 }} />
        <Skeleton height={120} borderRadius={20} style={{ marginBottom: 14 }} />
        <Skeleton height={140} borderRadius={20} style={{ marginBottom: 14 }} />
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : undefined} 
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 140 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ─── 1. MODERN HEADER ─── */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1, marginRight: 10, minWidth: 0 }}>
              <View style={[styles.greetingRow, { flexShrink: 1 }]}>
                <Text 
                  style={[styles.greetingText, { color: theme.text, flexShrink: 1 }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {greeting.text}, {name}
                </Text>
                <Text style={[styles.greetingEmoji, { flexShrink: 0 }]}>{greeting.emoji}</Text>
              </View>
              <View style={styles.dateBadgeRow}>
                <Calendar size={13} color={theme.textMuted} />
                <Text style={[styles.dateLabel, { color: theme.textMuted }]}>{dateLabel}</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <TourGuideButton onPress={openTour} />
              <TouchableOpacity 
                onPress={() => router.push("/menu")} 
                style={[
                  styles.menuBtn, 
                  { 
                    backgroundColor: isLight ? "rgba(0,0,0,0.05)" : theme.cardBg, 
                    borderColor: theme.cardBorder 
                  }
                ]}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <AlignJustify color={theme.textSecondary} size={20} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ─── 2. HERO İLİŞKİ SAYACI KARTI ─── */}
          <View style={[styles.heroLoveCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={[styles.heroTopBadge, { backgroundColor: theme.pillAccentBg }]}>
              <Heart size={13} color={theme.accent} fill={theme.accent} />
              <Text style={[styles.heroTopBadgeText, { color: theme.accent }]}>
                AŞKIMIZIN YOLCULUĞU
              </Text>
            </View>

            <View style={styles.countersRow}>
              {/* Sevgililik Sayacı */}
              <View style={[styles.counterBox, { backgroundColor: theme.unitBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
                <View style={[styles.counterIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                  <Heart size={16} color={theme.accent} fill={theme.accent} />
                </View>
                <Text style={[styles.counterNumber, { color: theme.text }]}>{daysSinceTogether}</Text>
                <Text style={[styles.counterDesc, { color: theme.textSecondary }]}>Gündür Sevgiliyiz</Text>
              </View>

              {/* Tanışma Sayacı */}
              <View style={[styles.counterBox, { backgroundColor: theme.unitBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
                <View style={[styles.counterIconCircle, { backgroundColor: isLight ? "rgba(255, 215, 0, 0.15)" : "rgba(255,255,255,0.06)" }]}>
                  <Sparkles size={16} color="#ffd700" />
                </View>
                <Text style={[styles.counterNumber, { color: theme.text }]}>{daysSinceMeeting}</Text>
                <Text style={[styles.counterDesc, { color: theme.textSecondary }]}>Gündür Hayatımdasın</Text>
              </View>
            </View>
          </View>

          {/* ─── 3. HIZLI ERİŞİM KISAYOLLARI (QUICK ACTIONS) ─── */}
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity 
              style={[styles.actionPill, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
              onPress={() => router.push("/(tabs)/photos")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Images size={17} color={theme.accent} />
              </View>
              <Text style={[styles.actionPillText, { color: theme.textSecondary }]}>Galeri</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionPill, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
              onPress={() => router.push("/(tabs)/daily-notes")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <BookOpen size={17} color={theme.accent} />
              </View>
              <Text style={[styles.actionPillText, { color: theme.textSecondary }]}>Günlüğüm</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionPill, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
              onPress={() => router.push("/(tabs)/letters")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Mail size={17} color={theme.accent} />
              </View>
              <Text style={[styles.actionPillText, { color: theme.textSecondary }]}>Mektuplar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionPill, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
              onPress={() => router.push("/(tabs)/meetings")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <MapPin size={17} color={theme.accent} />
              </View>
              <Text style={[styles.actionPillText, { color: theme.textSecondary }]}>Buluşma</Text>
            </TouchableOpacity>
          </View>

          {/* ─── 4. GÜNÜN SÖZÜ ─── */}
          <View style={[styles.quoteCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.quoteHeaderRow}>
              <View style={[styles.quoteStarCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Sparkles size={14} color={theme.accent} />
              </View>
              <Text style={[styles.quoteTitle, { color: theme.accent }]}>GÜNÜN İLHAMI</Text>
            </View>
            <Text style={[styles.quoteText, { color: theme.text }]}>“{quote}”</Text>
          </View>

          {/* ─── 5. AŞK ÖLÇER ─── */}
          <LoveMeter 
            value={loveMeter} 
            theme={theme} 
            subtitle={loveSubtitle} 
            isLoading={!activeLoveScore && isLoveScoreLoading} 
          />

          {/* ─── COUPLE WRAPPED BANNER ─── */}
          <TouchableOpacity
            style={[styles.wrappedBanner, { borderColor: "rgba(255, 77, 109, 0.35)" }]}
            onPress={() => setIsWrappedVisible(true)}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={["#2A0E1F", "#170B18"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.wrappedGradient}
            >
              <View style={styles.wrappedLeft}>
                <View style={styles.wrappedIconBadge}>
                  <Sparkles size={16} color="#FF4D6D" />
                </View>
                <View>
                  <Text style={styles.wrappedTitle}>Couple Wrapped Hazır! ✨</Text>
                  <Text style={styles.wrappedSub}>Aşk özetini ve anılarınızı keşfedin</Text>
                </View>
              </View>
              <View style={styles.wrappedArrowCircle}>
                <ChevronRight size={18} color="#FF8FA3" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* ─── 6. BULUŞMA GERİ SAYIMI ─── */}
          {dashboardData?.activeMeeting && (
            <MeetingCountdown meeting={dashboardData.activeMeeting} theme={theme} />
          )}

          {/* ─── 7. MOD SEÇİMİ ─── */}
          <MoodSelector
            currentMood={dashboardData?.currentMood}
            moodLocked={!!dashboardData?.currentMood}
            theme={theme}
          />

          {/* ─── 8. GÜNLÜK NOT ─── */}
          <DailyNoteCard existingNote={dashboardData?.currentNote} theme={theme} />

          {/* ─── 9. BEKLEYEN MEKTUPLAR ─── */}
          <PendingLettersCard letters={dashboardData?.pendingLetters || []} theme={theme} />
        </ScrollView>
      </KeyboardAvoidingView>
      <PageTourModal visible={isTourVisible} guide={guide} onClose={closeTour} />
      <CoupleWrappedModal
        visible={isWrappedVisible}
        onClose={() => setIsWrappedVisible(false)}
        data={wrappedData}
        partnerName={name}
        theme={theme}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14,
  },

  // ─── Couple Wrapped Banner ─────────────────────────────────────────────
  wrappedBanner: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#FF4D6D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  wrappedGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  wrappedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  wrappedIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 77, 109, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  wrappedTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  wrappedSub: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  wrappedArrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },

  // ─── Header ────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  greetingText: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.4,
  },
  greetingEmoji: {
    fontSize: 22,
  },
  dateBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  dateLabel: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  menuBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── Hero Aşk Sayacı ───────────────────────────────────────────────────
  heroLoveCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  heroTopBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 14,
  },
  heroTopBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  countersRow: {
    flexDirection: "row",
    gap: 12,
  },
  counterBox: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  counterIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  counterNumber: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  counterDesc: {
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
    textAlign: "center",
  },

  // ─── Hızlı Erişim Kısayolları ──────────────────────────────────────────
  quickActionsContainer: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  actionPill: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
  },
  actionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPillText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)",
  },

  // ─── Günün Sözü ────────────────────────────────────────────────────────
  quoteCard: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
  },
  quoteHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  quoteStarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  quoteTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  quoteText: {
    fontSize: 14.5,
    lineHeight: 22,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.9)",
    fontStyle: "italic",
  },
});
