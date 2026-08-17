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

// ─── Tema Sabitleri ─────────────────────────────────────────────────────────
const PINK = "#ff4d6d";
const CARD_BG = "#231218";
const BORDER = "rgba(255,255,255,0.07)";

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
}

export function MoodSelector({ currentMood, moodLocked = false }: MoodSelectorProps) {
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
    const userId = parseInt(session.user.id, 10);

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

      // Push — non-blocking
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
    <View style={styles.card}>
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
                isSelected ? styles.moodBtnSelected : styles.moodBtnNormal,
                locked && !isSelected && { opacity: 0.3 },
              ]}
            >
              <Text style={styles.emoji}>{mood.emoji}</Text>
              <Text style={[styles.label, isSelected && styles.labelSelected]}>
                {mood.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && <ActivityIndicator color={PINK} style={{ marginTop: 10 }} />}

      {locked && selected && (
        <Text style={styles.savedText}>Bugün için kaydedildi 💛</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    gap: 6,
  },
  moodBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 14,
    borderWidth: 2,
  },
  moodBtnNormal: {
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  moodBtnSelected: {
    borderColor: PINK,
    backgroundColor: "rgba(255,77,109,0.1)",
  },
  emoji: {
    fontSize: 22,
    marginBottom: 5,
  },
  label: {
    fontSize: 9,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "500",
    textAlign: "center",
  },
  labelSelected: {
    color: PINK,
    fontWeight: "700",
  },
  savedText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    marginTop: 12,
  },
});
