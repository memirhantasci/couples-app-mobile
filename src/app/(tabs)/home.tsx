import React, { useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
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
  getTodayHitap,
} from "@/lib/date";
import { getQuoteForDay } from "@/lib/quotes";
import { decrypt, deterministicDecrypt } from "@/utils/crypto";
import { useRouter } from "expo-router";
import { AlignJustify, Star } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LoveMeter } from "@/components/home/LoveMeter";
import { MoodSelector } from "@/components/home/MoodSelector";
import { DailyNoteCard } from "@/components/home/DailyNoteCard";
import { MeetingCountdown } from "@/components/home/MeetingCountdown";
import { PendingLettersCard } from "@/components/home/PendingLettersCard";

// ─── Tema Sabitleri ─────────────────────────────────────────────────────────
const PINK = "#ff4d6d";
const CARD_BG = "#231218";
const BORDER = "rgba(255,255,255,0.07)";

export default function HomeScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const today = todayString();
  const doy = dayOfYear();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  const { data: dashboardData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["home_dashboard", coupleId, userId, today],
    enabled: !!userId,
    queryFn: async () => {
      const [moodRes, noteRes, meetingRes, lettersRes] = await Promise.all([
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
              .select("id, meeting_datetime, title")
              .eq("couple_id", coupleId)
              .eq("is_active", true)
              .gte("meeting_datetime", dayjs().subtract(3, "hour").toISOString())
              .order("meeting_datetime", { ascending: true })
              .limit(5)
          : Promise.resolve({ data: [] }),
        coupleId
          ? supabase
              .from("letters")
              .select(
                "id, unlock_date, sender:users!letters_sender_id_fkey(username, display_name)"
              )
              .eq("couple_id", coupleId)
              .eq("receiver_id", userId)
              .gt("unlock_date", today)
              .order("unlock_date", { ascending: true })
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

      return {
        currentMood: moodRes.data?.mood_type || null,
        currentNote: noteRes.data?.content ? decrypt(noteRes.data.content) : null,
        activeMeeting,
        pendingLetters: (lettersRes.data || []).map((l) => {
          const senderObj = Array.isArray(l.sender) ? l.sender[0] : l.sender;
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

  // ─── Hesaplanan Veriler ─────────────────────────────────────────────────
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
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16 },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={PINK} />
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
          <TouchableOpacity onPress={() => router.push("/menu")} style={styles.menuBtn}>
            <AlignJustify color="rgba(255,255,255,0.7)" size={22} />
          </TouchableOpacity>
        </View>

        {/* ── COUNTER PILLS ──────────────────────────────────────────── */}
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Text style={styles.pillValue}>{daysSinceMeeting}</Text>
            <Text style={styles.pillLabel}> gün tanışalı 🤝</Text>
          </View>
          <View style={[styles.pill, styles.pillPink]}>
            <Text style={[styles.pillValue, { color: PINK }]}>{daysSinceTogether}</Text>
            <Text style={styles.pillLabel}> gün sevgili ❤️</Text>
          </View>
        </View>

        {/* ── GÜNÜN SÖZÜ ─────────────────────────────────────────────── */}
        <View style={styles.quoteCard}>
          <View style={styles.quoteHeaderRow}>
            <Star size={13} color="#f59e0b" fill="#f59e0b" />
            <Text style={styles.quoteTitle}>GÜNÜN SÖZÜ</Text>
          </View>
          <Text style={styles.quoteText}>"{quote}"</Text>
        </View>

        {/* ── AŞK ÖLÇER ──────────────────────────────────────────────── */}
        <LoveMeter value={loveMeter} />

        {/* ── BULUŞMA GERİ SAYIMI ─────────────────────────────────────── */}
        {dashboardData?.activeMeeting && (
          <MeetingCountdown meeting={dashboardData.activeMeeting} />
        )}

        {/* ── MOD SEÇİMİ ─────────────────────────────────────────────── */}
        <MoodSelector
          currentMood={dashboardData?.currentMood}
          moodLocked={!!dashboardData?.currentMood}
        />

        {/* ── GÜNLÜK NOT ─────────────────────────────────────────────── */}
        <DailyNoteCard existingNote={dashboardData?.currentNote} />

        {/* ── BEKLEYEN MEKTUPLAR ─────────────────────────────────────── */}
        <PendingLettersCard letters={dashboardData?.pendingLetters || []} />
      </ScrollView>
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
    marginBottom: 16,
  },
  greetingText: {
    fontSize: 26,
    fontWeight: "700",
    color: "#ffffff",
    fontStyle: "italic",
    letterSpacing: -0.3,
  },
  dateLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    marginTop: 4,
    fontWeight: "400",
  },
  menuBtn: {
    padding: 6,
    marginTop: 4,
  },

  // ─── Counter Pills ─────────────────────────────────────────────────────
  pillRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 50,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  pillPink: {
    borderColor: "rgba(255,77,109,0.25)",
    backgroundColor: "rgba(255,77,109,0.06)",
  },
  pillValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  pillLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "400",
  },

  // ─── Quote Card ────────────────────────────────────────────────────────
  quoteCard: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  quoteHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  quoteTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#f59e0b",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.75)",
    fontStyle: "italic",
  },
});
