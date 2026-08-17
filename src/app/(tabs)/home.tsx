import React , { useCallback } from "react";
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { dayjs, daysSince, getLoveMeter, dayOfYear, todayString, getTodayHitap } from "@/lib/date";
import { getQuoteForDay } from "@/lib/quotes";
import { decrypt, deterministicDecrypt } from "@/utils/crypto";
import { useRouter } from "expo-router";
import { PageHeader } from "@/components/ui/PageHeader";

import { LoveMeter } from "@/components/home/LoveMeter";
import { MoodSelector } from "@/components/home/MoodSelector";
import { DailyNoteCard } from "@/components/home/DailyNoteCard";
import { MeetingCountdown } from "@/components/home/MeetingCountdown";
import { PendingLettersCard } from "@/components/home/PendingLettersCard";

export default function HomeScreen() {
  const { session, profile } = useAuth();
  const router = useRouter();
  
  // Queries
  const today = todayString();
  const doy = dayOfYear();
  
  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  // React Query for Dashboard Data
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
        coupleId ? supabase
          .from("meetings")
          .select("id, meeting_datetime, title")
          .eq("couple_id", coupleId)
          .eq("is_active", true)
          .gte("meeting_datetime", dayjs().subtract(3, "hour").toISOString())
          .order("meeting_datetime", { ascending: true })
          .limit(5) : Promise.resolve({ data: [] }),
        coupleId ? supabase
          .from("letters")
          .select("id, unlock_date, sender:users!letters_sender_id_fkey(username, display_name)")
          .eq("couple_id", coupleId)
          .eq("receiver_id", userId)
          .gt("unlock_date", today)
          .order("unlock_date", { ascending: true }) : Promise.resolve({ data: [] })
      ]);

      let activeMeeting = null;
      if (meetingRes.data && Array.isArray(meetingRes.data)) {
        const now = dayjs();
        const futureMeeting = meetingRes.data.find(m => dayjs(m.meeting_datetime).isAfter(now));
        activeMeeting = futureMeeting || meetingRes.data[meetingRes.data.length - 1] || null;
      } else if (meetingRes.data) {
        activeMeeting = meetingRes.data;
      }

      return {
        currentMood: moodRes.data?.mood_type || null,
        currentNote: noteRes.data?.content ? decrypt(noteRes.data.content) : null,
        activeMeeting,
        pendingLetters: (lettersRes.data || []).map(l => {
          const senderObj = Array.isArray(l.sender) ? l.sender[0] : l.sender;
          return {
            ...l,
            sender: senderObj ? { 
              ...senderObj, 
              username: senderObj.username ? deterministicDecrypt(senderObj.username) || senderObj.username : ""
            } : undefined
          };
        })
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  if (!session || (!dashboardData && isLoading)) {
    return (
      <ScreenBackground style={{ padding: 20, paddingTop: 40 }}>
        <Skeleton height={150} borderRadius={24} style={{ marginBottom: 20 }} />
        <Skeleton height={100} borderRadius={20} style={{ marginBottom: 20 }} />
        <Skeleton height={120} borderRadius={24} style={{ marginBottom: 20 }} />
        <Skeleton height={120} borderRadius={24} style={{ marginBottom: 20 }} />
      </ScreenBackground>
    );
  }

  // Calculate Hero metrics
  const meetDate = profile?.meetDate;
  const relDate = profile?.relationshipStartDate;
  
  const daysSinceMeeting = meetDate ? daysSince(dayjs(meetDate)) : 0;
  const daysSinceTogether = relDate ? daysSince(dayjs(relDate)) : 0;
  
  const hitap = getTodayHitap();
  const quote = getQuoteForDay(doy);
  const loveMeter = getLoveMeter();
  const dateStr = dayjs().format("DD MMMM dddd").toUpperCase();



  return (
    <ScreenBackground>
      <PageHeader title="" showBack={false} />
      <ScrollView 
        contentContainerStyle={{ padding: 20, paddingTop: 10, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#E8002D" />
        }
        showsVerticalScrollIndicator={false}
      >
        
        {/* HERO CARD */}
        <View style={styles.heroCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", flex: 1 }}>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={styles.dateLabel}>{dateStr}</Text>
              <Text style={styles.greetingTitle}>
                Günaydın,{"\n"}{hitap} <Text style={{ fontSize: 20 }}>❤️</Text>
              </Text>
            </View>
          </View>
          
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={styles.counterBox}>
              <Text style={styles.counterValue}>{daysSinceMeeting}</Text>
              <Text style={styles.counterLabel}>gün tanışalı 🤝</Text>
            </View>
            <View style={[styles.counterBox, { borderColor: "#D84257", backgroundColor: "rgba(216,66,87,0.06)" }]}>
              <Text style={styles.counterValue}>{daysSinceTogether}</Text>
              <Text style={styles.counterLabel}>gün sevgili ❤️</Text>
            </View>
          </View>
        </View>

        {/* QUOTE OF THE DAY */}
        <View style={styles.quoteCard}>
          <Text style={styles.quoteTitle}>Günün Sözü</Text>
          <Text style={styles.quoteText}>"{quote}"</Text>
        </View>

        {/* LOVE METER */}
        <LoveMeter value={loveMeter} />

        {/* MEETING COUNTDOWN */}
        {dashboardData?.activeMeeting && (
          <MeetingCountdown 
            meeting={dashboardData.activeMeeting} 
          />
        )}

        {/* MOOD SELECTOR */}
        <MoodSelector 
          currentMood={dashboardData?.currentMood} 
          moodLocked={!!dashboardData?.currentMood} 
        />

        {/* DAILY NOTE */}
        <DailyNoteCard existingNote={dashboardData?.currentNote} />

        {/* PENDING LETTERS */}
        <PendingLettersCard letters={dashboardData?.pendingLetters || []} />

      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: "#181a20",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.45)",
    marginBottom: 6,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 28,
    color: "#fff",
  },
  counterBox: {
    borderWidth: 2,
    borderColor: "#C4A15A",
    backgroundColor: "rgba(196,161,90,0.06)",
    borderRadius: 14,
    minWidth: 78,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  counterValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 24,
  },
  counterLabel: {
    fontSize: 9,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginTop: 4,
  },
  quoteCard: {
    backgroundColor: "#181a20",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  quoteTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  quoteText: {
    fontSize: 13,
    lineHeight: 19.5, // 1.5
    color: "rgba(255,255,255,0.65)",
    fontStyle: "italic",
  }
});
