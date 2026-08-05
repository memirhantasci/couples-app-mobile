import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { todayString } from "@/lib/date";
import { useQueryClient } from "@tanstack/react-query";

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
  const { session } = useAuth();
  const queryClient = useQueryClient();
  
  const [selected, setSelected] = useState<string | null>(currentMood || null);
  const [locked, setLocked] = useState(moodLocked || !!currentMood);
  const [loading, setLoading] = useState(false);

  async function handleMoodSelect(emoji: string) {
    if (locked || loading || !session?.user?.id) return;
    setLoading(true);
    
    const coupleId = session?.user?.user_metadata?.couple_id || session?.couple_id;
    const today = todayString();

    const { error } = await supabase
      .from("moods")
      .upsert(
        {
          couple_id: coupleId,
          user_id: session.user.id,
          date: today,
          mood_type: emoji,
        },
        { onConflict: "couple_id,user_id,date" }
      );

    setLoading(false);
    
    if (!error) {
      setSelected(emoji);
      setLocked(true);
      // Invalidate query to refresh dashboard data seamlessly
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
    } else {
      // toast or alert
      console.error("Mood error:", error);
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
                (locked && !isSelected) && { opacity: 0.35 }
              ]}
            >
              <Text style={styles.emoji}>{mood.emoji}</Text>
              <Text style={styles.label}>{mood.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && <ActivityIndicator color="#D84257" style={{ marginTop: 10 }} />}

      {locked && selected && (
        <Text style={styles.savedText}>Bugün için kaydedildi 💛</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#181a20",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    gap: 6,
    width: "100%",
  },
  moodBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  moodBtnNormal: {
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  moodBtnSelected: {
    borderColor: "#D84257",
    backgroundColor: "rgba(216,66,87,0.1)",
    borderWidth: 2,
  },
  emoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  label: {
    fontSize: 9,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
    textAlign: "center",
  },
  savedText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    marginTop: 10,
  },
});
