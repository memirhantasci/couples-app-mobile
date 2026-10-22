import React, { useState, memo } from "react";
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
import { useDemoAction } from "@/hooks/useDemoAction";
import { DemoActionModal } from "@/components/demo/DemoActionModal";
import { toast } from "@/lib/toast";

interface DailyNoteCardProps {
  existingNote?: string | null;
  theme: AppTheme;
}

export const DailyNoteCard = memo(function DailyNoteCard({ existingNote, theme }: DailyNoteCardProps) {
  const { session, profile } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const queryClient = useQueryClient();
  const router = useRouter();

  const [content, setContent] = useState(existingNote || "");
  const [saved, setSaved] = useState(!!existingNote);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    if (executeOrIntercept(
      () => {},
      "Günün Notunu Kaydetmek İçin Kayıt Olun 📖",
      "Gününüzü, hislerinizi ve sadece size özel kişisel günlüğünüzü güvenle saklamak için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }
    if (saved || !content.trim() || !session?.user?.id) return;
    setSubmitting(true);

    const coupleId = profile?.coupleId ?? null;
    const today = todayString();
    const cleanContent = sanitize(content.trim());
    if (!cleanContent) {
      setSubmitting(false);
      return;
    }
    let encryptedContent: string;
    try {
      encryptedContent = encrypt(cleanContent);
    } catch (err) {
      setSubmitting(false);
      toast.error(err instanceof Error ? err.message : "Bilinmeyen hata", { title: "Not kaydedilemedi" });
      return;
    }

    const { error } = await supabase.rpc("save_daily_note", {
      p_date: today,
      p_content: encryptedContent,
      p_couple_id: coupleId,
    });

    setSubmitting(false);

    if (!error) {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
      toast.success("Günlük notun kaydedildi ✨");
    } else {
      logger.error("Note save error:", JSON.stringify(error, null, 2));
      toast.error(error?.message || "Bilinmeyen hata", { title: "Not kaydedilemedi" });
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
      <Text style={[styles.title, { color: theme.text }]}>Günlük Notum</Text>

      {saved ? (
        <View style={[styles.savedBox, { backgroundColor: theme.unitBg, borderColor: theme.cardBorder }]}>
          <Text style={[styles.savedContent, { color: theme.text }]}>{content}</Text>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>Yarın yeni bir not yazabilirsin 🌙</Text>
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
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={4}
            maxLength={4500}
            style={[
              styles.input, 
              { 
                backgroundColor: theme.unitBg, 
                color: theme.text,
                borderColor: theme.isLight ? theme.cardBorder : "rgba(255,255,255,0.08)" 
              }
            ]}
          />
          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: theme.accent },
              (submitting || !content.trim()) && { opacity: 0.6 },
            ]}
            onPress={handleSave}
            disabled={submitting || !content.trim()}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Kaydet</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <DemoActionModal
        visible={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        title={modalConfig.title}
        description={modalConfig.description}
      />
    </View>
  );
});

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
  savedBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  savedContent: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    marginBottom: 10,
  },
  footerText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  historyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
  },
  historyBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  input: {
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    minHeight: 90,
    textAlignVertical: "top",
  },
  saveBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
