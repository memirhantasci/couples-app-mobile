import React, { useCallback } from "react";
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
import { computeLoveScore } from "@/lib/loveScore";
import { useRouter, useFocusEffect } from "expo-router";
import { 
  AlignJustify, Sparkles, Heart, Images, 
  BookOpen, Mail, MapPin, Calendar, Flame, Clock
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTheme } from "@/lib/theme";

import { LoveMeter } from "@/components/home/LoveMeter";
import { MoodSelector } from "@/components/home/MoodSelector";
import { DailyNoteCard } from "@/components/home/DailyNoteCard";
import { MeetingCountdown } from "@/components/home/MeetingCountdown";
import { PendingLettersCard } from "@/components/home/PendingLettersCard";
import { BannerAd } from "@/components/ui/BannerAd";
import { useInterstitialAd } from "@/hooks/useInterstitialAd";

export default function HomeScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = getTheme(profile?.gender);

  const today = todayString();
  const doy = dayOfYear();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;

  const { showAdIfReady } = useInterstitialAd();

  useFocusEffect(
    useCallback(() => {
      showAdIfReady();
    }, [showAdIfReady])
  );

  const { data: dashboardData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["home_dashboard", coupleId, userId, today],
    enabled: !!userId,
    queryFn: async () => {
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

  // ─── Dinamik Aşk Puanı ───────────────────────────────────────────────────────
  // Partner ID'yi usersRes'ten çekemediğimiz için ayrı küçük query
  const { data: loveScoreData } = useQuery({
    queryKey: ["love_score", coupleId, userId, today],
    enabled: !!coupleId && !!userId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      // Partneri bul
      const { data: usersData } = await supabase
        .from("users")
        .select("id")
        .eq("couple_id", coupleId)
        .neq("id", userId)
        .limit(1);
      const partnerId = usersData?.[0]?.id ?? null;
      return computeLoveScore(coupleId!, userId!, partnerId);
    },
  });

  // Dinamik Selamlama
  const getGreeting = () => {
    const hour = dayjs().hour();
    if (hour >= 6 && hour < 12) return { text: "Günaydın", emoji: "☀️" };
    if (hour >= 12 && hour < 18) return { text: "Tünaydın", emoji: "🌸" };
    if (hour >= 18 && hour < 23) return { text: "İyi Akşamlar", emoji: "🌙" };
    return { text: "İyi Geceler", emoji: "✨" };
  };

  if (!session || (!dashboardData && isLoading)) {
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

  const meetDate = profile?.meetDate;
  const relDate = profile?.relationshipStartDate;
  const daysSinceMeeting = meetDate ? daysSince(dayjs(meetDate)) : 0;
  const daysSinceTogether = relDate ? daysSince(dayjs(relDate)) : 0;
  const name = profile?.displayName || "Sevgilim";
  const quote = getQuoteForDay(doy);
  const loveMeter = loveScoreData?.score ?? 50;
  const loveSubtitle = loveScoreData?.subtitle;
  const dateLabel = dayjs().format("D MMMM, dddd");
  const greeting = getGreeting();

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
            <View style={{ flex: 1 }}>
              <View style={styles.greetingRow}>
                <Text style={styles.greetingText}>
                  {greeting.text}, {name}
                </Text>
                <Text style={styles.greetingEmoji}>{greeting.emoji}</Text>
              </View>
              <View style={styles.dateBadgeRow}>
                <Calendar size={13} color="rgba(255,255,255,0.5)" />
                <Text style={styles.dateLabel}>{dateLabel}</Text>
              </View>
            </View>

            <TouchableOpacity 
              onPress={() => router.push("/menu")} 
              style={[styles.menuBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AlignJustify color="rgba(255,255,255,0.85)" size={20} />
            </TouchableOpacity>
          </View>

          {/* ─── 2. HERO İLİŞKİ SAYACI KARTI ─── */}
          <View style={[styles.heroLoveCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.heroTopBadge}>
              <Heart size={13} color={theme.accent} fill={theme.accent} />
              <Text style={[styles.heroTopBadgeText, { color: theme.accent }]}>
                AŞKIMIZIN YOLCULUĞU
              </Text>
            </View>

            <View style={styles.countersRow}>
              {/* Sevgililik Sayacı */}
              <View style={[styles.counterBox, { backgroundColor: theme.unitBg }]}>
                <View style={[styles.counterIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                  <Heart size={16} color={theme.accent} fill={theme.accent} />
                </View>
                <Text style={styles.counterNumber}>{daysSinceTogether}</Text>
                <Text style={styles.counterDesc}>Gündür Sevgiliyiz</Text>
              </View>

              {/* Tanışma Sayacı */}
              <View style={[styles.counterBox, { backgroundColor: theme.unitBg }]}>
                <View style={[styles.counterIconCircle, { backgroundColor: "rgba(255,255,255,0.06)" }]}>
                  <Sparkles size={16} color="#ffd700" />
                </View>
                <Text style={styles.counterNumber}>{daysSinceMeeting}</Text>
                <Text style={styles.counterDesc}>Gündür Hayatımdasın</Text>
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
              <Text style={styles.actionPillText}>Galeri</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionPill, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
              onPress={() => router.push("/(tabs)/daily-notes")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <BookOpen size={17} color={theme.accent} />
              </View>
              <Text style={styles.actionPillText}>Günlüğüm</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionPill, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
              onPress={() => router.push("/(tabs)/letters")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Mail size={17} color={theme.accent} />
              </View>
              <Text style={styles.actionPillText}>Mektuplar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionPill, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
              onPress={() => router.push("/(tabs)/meetings")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <MapPin size={17} color={theme.accent} />
              </View>
              <Text style={styles.actionPillText}>Buluşma</Text>
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
            <Text style={styles.quoteText}>“{quote}”</Text>
          </View>

          {/* ─── 5. AŞK ÖLÇER ─── */}
          <LoveMeter value={loveMeter} theme={theme} subtitle={loveSubtitle} />

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
      <BannerAd />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14,
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
