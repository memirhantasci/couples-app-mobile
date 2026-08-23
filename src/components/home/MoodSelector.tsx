import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { todayString } from "@/lib/date";
import { useQueryClient } from "@tanstack/react-query";
import { sendPushNotification } from "@/lib/notifications";
import { logger } from "@/utils/logger";
import { AppTheme } from "@/lib/theme";

const MOODS = [
  { emoji: "😍", label: "Çok Mutlu" },
  { emoji: "😊", label: "Mutlu" },
  { emoji: "😐", label: "Normal" },
  { emoji: "😢", label: "Üzgün" },
  { emoji: "😡", label: "Kızgın" },
  { emoji: "😴", label: "Yorgun" },
] as const;

interface MoodSelectorProps {
  currentMood?: string | null;
  moodLocked?: boolean;
  theme: AppTheme;
}

export function MoodSelector({ currentMood, moodLocked = false, theme }: MoodSelectorProps) {
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<string | null>(currentMood || null);
  const [locked, setLocked] = useState(moodLocked || !!currentMood);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setSelected(currentMood || null);
    setLocked(moodLocked || !!currentMood);
  }, [currentMood, moodLocked]);

  async function handleMoodSelect(emoji: string) {
    if (locked || loading || !session?.user?.id) return;
    setLoading(true);

    const coupleId = profile?.coupleId || null;
    const today = todayString();
    const userId = session.user.id;

    const { data: existing } = await supabase
      .from("moods")
      .select("id")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle();

    let error;
    if (existing) {
      const payload: any = { mood_type: emoji };
      if (coupleId) payload.couple_id = coupleId;
      const res = await supabase.from("moods").update(payload).eq("id", existing.id);
      error = res.error;
    } else {
      const payload: any = { user_id: userId, date: today, mood_type: emoji };
      if (coupleId) payload.couple_id = coupleId;
      const res = await supabase.from("moods").insert(payload);
      error = res.error;
    }

    setLoading(false);

    if (!error) {
      setSelected(emoji);
      setLocked(true);
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["calendar_data"] });

      if (coupleId) {
        supabase
          .from("users")
          .select("id")
          .eq("couple_id", coupleId)
          .neq("id", userId)
          .maybeSingle()
          .then(({ data: partnerData }) => {
            if (partnerData) {
              const moodLabel = MOODS.find((m) => m.emoji === emoji)?.label || "güncelledi";
              const myName = profile?.displayName || "Partnerin";
              sendPushNotification(
                partnerData.id.toString(),
                "Mod Güncellemesi 💭",
                `${myName} bugün kendini ${moodLabel} ${emoji} hissediyor.`
              );
            }
          }, (err) => logger.log("Push error:", err));
      }
    } else {
      logger.error("Mood error:", JSON.stringify(error, null, 2));
      alert("Ruh hali kaydedilemedi: " + (error?.message || "Bilinmeyen hata"));
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
      <Text style={styles.title}>Bugün nasılsın?</Text>

      <View style={styles.row}>
        {MOODS.map((mood) => {
          const isSelected = selected === mood.emoji;
          return (
            <TouchableOpacity
              key={mood.emoji}
              onPress={() => handleMoodSelect(mood.emoji)}
              disabled={loading || locked}
              activeOpacity={0.7}
              style={[
                styles.moodBtn,
                isSelected
                  ? { backgroundColor: "rgba(77,156,255,0.1)", borderColor: theme.accent, borderWidth: 1 }
                  : { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.1)", borderWidth: 1 },
                locked && !isSelected && { opacity: 0.3 },
              ]}
            >
              <Text style={styles.emoji}>{mood.emoji}</Text>
              <Text style={[styles.label, isSelected && { color: theme.accent, fontFamily: "Inter_600SemiBold" }]}>
                {mood.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && <ActivityIndicator color={theme.accent} style={{ marginTop: 10 }} />}

      {locked && selected && (
        <Text style={styles.savedText}>Bugün için kaydedildi 💛</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    color: "#fff",
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    gap: 6,
  },
  moodBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  emoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
  },
  savedText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginTop: 14,
  },
});
