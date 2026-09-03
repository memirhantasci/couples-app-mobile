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
import { notifyPartner } from "@/lib/notifications";
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

      if (coupleId && userId) {
        const moodLabel = MOODS.find((m) => m.emoji === emoji)?.label || "güncelledi";
        const myName = profile?.displayName || "Partnerin";
        notifyPartner(
          coupleId,
          userId,
          "Mod Güncellemesi 💭",
          `${myName} bugün kendini ${moodLabel} ${emoji} hissediyor.`
        );
      }
    } else {
      logger.error("Mood error:", JSON.stringify(error, null, 2));
      alert("Ruh hali kaydedilemedi: " + (error?.message || "Bilinmeyen hata"));
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
      <Text style={[styles.title, { color: theme.text }]}>Bugün nasılsın?</Text>

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
                  ? { backgroundColor: theme.pillAccentBg, borderColor: theme.accent, borderWidth: 1.5 }
                  : { 
                      backgroundColor: "transparent", 
                      borderColor: theme.isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)", 
                      borderWidth: 1 
                    },
                locked && !isSelected && { opacity: 0.35 },
              ]}
            >
              <Text style={styles.emoji}>{mood.emoji}</Text>
              <Text 
                style={[
                  styles.label, 
                  { color: isSelected ? theme.accent : theme.textSecondary },
                  isSelected && { fontFamily: "Inter_700Bold" }
                ]}
                numberOfLines={1}
              >
                {mood.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={theme.accent} size="small" />
        </View>
      )}

      {locked && (
        <Text style={[styles.lockedText, { color: theme.textMuted }]}>
          Bugünkü modun kilitlendi ✨
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  moodBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 14,
    marginHorizontal: 3,
  },
  emoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  loadingRow: {
    alignItems: "center",
    marginTop: 10,
  },
  lockedText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 12,
  },
});
