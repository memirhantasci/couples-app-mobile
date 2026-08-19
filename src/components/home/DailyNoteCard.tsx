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

// ─── Tema Sabitleri ─────────────────────────────────────────────────────────
const PINK = "#ff4d6d";
const CARD_BG = "#231218";
const BORDER = "rgba(255,255,255,0.07)";

interface DailyNoteCardProps {
  existingNote?: string | null;
}

export function DailyNoteCard({ existingNote }: DailyNoteCardProps) {
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
    const userId = session.user.id;

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
        <View style={styles.savedBox}>
          <Text style={styles.savedContent}>{content}</Text>
          <Text style={styles.footerText}>Yarın yeni bir not yazabilirsin 🌙</Text>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/daily-notes" as any)}
            style={styles.historyBtn}
          >
            <BookOpen size={12} color={PINK} />
            <Text style={styles.historyBtnText}>Geçmiş Notlarımı Gör</Text>
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
            style={styles.input}
          />
          <TouchableOpacity
            style={[styles.saveBtn, (submitting || !content.trim()) && { opacity: 0.6 }]}
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
  savedBox: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
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
    marginTop: 10,
  },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
  },
  historyBtnText: {
    fontSize: 12,
    color: PINK,
    fontWeight: "600",
  },
  input: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
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
    backgroundColor: PINK,
    borderRadius: 50, // pill shape
    paddingVertical: 15,
  },
  saveBtnText: {
    fontWeight: "700",
    fontSize: 15,
    color: "#fff",
    letterSpacing: 0.3,
  },
});
