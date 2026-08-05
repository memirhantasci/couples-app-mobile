import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { todayString } from "@/lib/date";
import { encrypt } from "@/utils/crypto";
import { useQueryClient } from "@tanstack/react-query";

interface DailyNoteCardProps {
  existingNote?: string | null;
}

export function DailyNoteCard({ existingNote }: DailyNoteCardProps) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const [content, setContent] = useState(existingNote || "");
  const [saved, setSaved] = useState(!!existingNote);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    if (saved || !content.trim() || !session?.user?.id) return;
    setSubmitting(true);
    
    const coupleId = session?.user?.user_metadata?.couple_id || session?.couple_id;
    const today = todayString();

    const encryptedContent = encrypt(content.trim());

    const { error } = await supabase
      .from("daily_notes")
      .upsert(
        {
          couple_id: coupleId,
          user_id: session.user.id,
          date: today,
          content: encryptedContent,
        },
        { onConflict: "couple_id,user_id,date" }
      );

    setSubmitting(false);

    if (!error) {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
    } else {
      console.error("Note save error:", error);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Günlük Notum</Text>

      {saved ? (
        <View style={styles.savedBox}>
          <Text style={styles.savedContent}>{content}</Text>
          <Text style={styles.footerText}>Yarın yeni bir not yazabilirsin 🌙</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Bugün nasıldı? Ne hissediyorsun?..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            multiline
            numberOfLines={4}
            maxLength={2000}
            style={styles.input}
          />
          <TouchableOpacity
            style={[styles.saveBtn, (submitting || !content.trim()) && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={submitting || !content.trim()}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Kaydet</Text>
            )}
          </TouchableOpacity>
        </View>
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
  savedBox: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: 14,
  },
  savedContent: {
    fontSize: 14,
    lineHeight: 22,
    color: "rgba(255,255,255,0.8)",
  },
  footerText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    marginTop: 12,
  },
  input: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    lineHeight: 22,
    padding: 14,
    minHeight: 100,
    textAlignVertical: "top",
  },
  saveBtn: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D84257",
    borderRadius: 12,
    padding: 13,
  },
  saveBtnText: {
    fontWeight: "700",
    fontSize: 14,
    color: "#fff",
  },
});
