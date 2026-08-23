import React from "react";
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
  getLoveMeter,
  dayOfYear,
  todayString,
} from "@/lib/date";
import { getQuoteForDay } from "@/lib/quotes";
import { decrypt, deterministicDecrypt } from "@/utils/crypto";
import { useRouter } from "expo-router";
import { AlignJustify } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTheme } from "@/lib/theme";

import { LoveMeter } from "@/components/home/LoveMeter";
import { MoodSelector } from "@/components/home/MoodSelector";
import { DailyNoteCard } from "@/components/home/DailyNoteCard";
import { MeetingCountdown } from "@/components/home/MeetingCountdown";
import { PendingLettersCard } from "@/components/home/PendingLettersCard";

export default function HomeScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = getTheme(profile?.gender);

  const today = todayString();
  const doy = dayOfYear();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;

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

  if (!session || (!dashboardData && isLoading)) {
    return (
      <ScreenBackground style={{ paddingTop: insets.top + 20, paddingHorizontal: 20 }}>
        <Skeleton height={80} borderRadius={16} style={{ marginBottom: 16 }} />
        <Skeleton height={100} borderRadius={20} style={{ marginBottom: 14 }} />
        <Skeleton height={90} borderRadius={20} style={{ marginBottom: 14 }} />
        <Skeleton height={140} borderRadius={20} style={{ marginBottom: 14 }} />
        <Skeleton height={120} borderRadius={20} style={{ marginBottom: 14 }} />
      </ScreenBackground>
    );
  }

  const meetDate = profile?.meetDate;
  const relDate = profile?.relationshipStartDate;
  const daysSinceMeeting = meetDate ? daysSince(dayjs(meetDate)) : 0;
  const daysSinceTogether = relDate ? daysSince(dayjs(relDate)) : 0;
  const name = profile?.displayName || "Tatlım";
  const quote = getQuoteForDay(doy);
  const loveMeter = getLoveMeter();
  const dateLabel = dayjs().format("D MMMM dddd");

  return (
    <ScreenBackground>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 16 },
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
          {/* ── HEADER ─────────────────────────────────────────────────── */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.greetingText}>Günaydın, {name} </Text>
                <Text style={{ fontSize: 20 }}>❤️</Text>
              </View>
              <Text style={styles.dateLabel}>{dateLabel}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/menu")} style={[styles.menuBtn, { backgroundColor: "rgba(255,255,255,0.05)" }]}>
              <AlignJustify color="rgba(255,255,255,0.7)" size={22} />
            </TouchableOpacity>
          </View>

          {/* ── COUNTER PILLS ──────────────────────────────────────────── */}
          <View style={[styles.pillCard, { backgroundColor: theme.cardBg }]}>
            <View style={styles.pillRow}>
              <View style={styles.pill}>
                <Text style={styles.pillValue}>{daysSinceMeeting}</Text>
                <Text style={styles.pillLabel}> gün tanışalı 🤝</Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillValue}>{daysSinceTogether}</Text>
                <Text style={styles.pillLabel}> gün sevgili ❤️</Text>
              </View>
            </View>
          </View>

          {/* ── GÜNÜN SÖZÜ ─────────────────────────────────────────────── */}
          <View style={[styles.quoteCard, { backgroundColor: theme.cardBg }]}>
            <View style={styles.quoteHeaderRow}>
              <Text style={styles.quoteStarIcon}>⭐</Text>
              <Text style={[styles.quoteTitle, { color: theme.accentLight }]}>GÜNÜN SÖZÜ</Text>
            </View>
            <Text style={styles.quoteText}>"{quote}"</Text>
          </View>

          {/* ── AŞK ÖLÇER ──────────────────────────────────────────────── */}
          <LoveMeter value={loveMeter} theme={theme} />

          {/* ── BULUŞMA GERİ SAYIMI ─────────────────────────────────────── */}
          {dashboardData?.activeMeeting && (
            <MeetingCountdown meeting={dashboardData.activeMeeting} theme={theme} />
          )}

          {/* ── MOD SEÇİMİ ─────────────────────────────────────────────── */}
          <MoodSelector
            currentMood={dashboardData?.currentMood}
            moodLocked={!!dashboardData?.currentMood}
            theme={theme}
          />

          {/* ── GÜNLÜK NOT ─────────────────────────────────────────────── */}
          <DailyNoteCard existingNote={dashboardData?.currentNote} theme={theme} />

          {/* ── BEKLEYEN MEKTUPLAR ─────────────────────────────────────── */}
          <PendingLettersCard letters={dashboardData?.pendingLetters || []} theme={theme} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 120,
  },

  // ─── Header ────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    color: "#ffffff",
  },
  dateLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  menuBtn: {
    padding: 8,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── Counter Pills ─────────────────────────────────────────────────────
  pillCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 18,
  },
  pillRow: {
    flexDirection: "row",
    gap: 12,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 50,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  pillValue: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  pillLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
  },

  // ─── Quote Card ────────────────────────────────────────────────────────
  quoteCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    borderWidth: 0,
  },
  quoteHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  quoteStarIcon: {
    fontSize: 12,
  },
  quoteTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  quoteText: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    color: "rgba(255,255,255,0.9)",
  },
});
