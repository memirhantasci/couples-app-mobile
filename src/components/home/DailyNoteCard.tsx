import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { todayString } from "@/lib/date";
import { encrypt } from "@/utils/crypto";
import { sanitize } from "@/utils/sanitize";
import { logger } from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { BookOpen } from "lucide-react-native";
import { AppTheme } from "@/lib/theme";

interface DailyNoteCardProps {
  existingNote?: string | null;
  theme: AppTheme;
}

export function DailyNoteCard({ existingNote, theme }: DailyNoteCardProps) {
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [content, setContent] = useState(existingNote || "");
  const [saved, setSaved] = useState(!!existingNote);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    if (saved || !content.trim() || !session?.user?.id) return;
    setSubmitting(true);

    const coupleId = profile?.coupleId ?? null;
    const today = todayString();
    const cleanContent = sanitize(content.trim());
    if (!cleanContent) return;
    const encryptedContent = encrypt(cleanContent);

    const { error } = await supabase.rpc("save_daily_note", {
      p_date: today,
      p_content: encryptedContent,
      p_couple_id: coupleId,
    });

    setSubmitting(false);

    if (!error) {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
    } else {
      logger.error("Note save error:", JSON.stringify(error, null, 2));
      alert("Not kaydedilemedi: " + (error?.message || "Bilinmeyen hata"));
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Günlük Notum</Text>

      {saved ? (
        <View style={[styles.savedBox, { borderColor: theme.cardBorder }]}>
          <Text style={styles.savedContent}>{content}</Text>
          <Text style={styles.footerText}>Yarın yeni bir not yazabilirsin 🌙</Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/daily-notes" as any)}
            style={styles.historyBtn}
          >
            <BookOpen size={12} color={theme.accent} />
            <Text style={[styles.historyBtnText, { color: theme.accent }]}>Geçmiş Notlarımı Gör</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Bugün nasıldı? Ne hissediyorsun?..."
            placeholderTextColor="rgba(255,255,255,0.25)"
            multiline
            numberOfLines={4}
            maxLength={4500}
            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.cardBorder }]}
          />
          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: theme.accent },
              (submitting || !content.trim()) && { opacity: 0.6 },
            ]}
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
    borderWidth: 0,
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    backgroundColor: "#4A152B",
  },
  title: {
    fontSize: 18,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    color: "#fff",
    marginBottom: 16,
  },
  savedBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  savedContent: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.9)",
  },
  footerText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    marginTop: 10,
  },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 12,
  },
  historyBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  input: {
    width: "100%",
    borderWidth: 0,
    borderRadius: 14,
    color: "rgba(255,255,255,0.9)",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    padding: 16,
    minHeight: 110,
    textAlignVertical: "top",
  },
  saveBtn: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 50,
    paddingVertical: 16,
  },
  saveBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
    letterSpacing: 0.3,
  },
});
