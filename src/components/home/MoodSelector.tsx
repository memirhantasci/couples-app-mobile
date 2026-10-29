import React, { useState, useEffect, useRef, memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  AppState,
} from "react-native";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { todayString } from "@/lib/date";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "@/utils/logger";
import { AppTheme } from "@/lib/theme";
import { useDemoAction } from "@/hooks/useDemoAction";
import { DemoActionModal } from "@/components/demo/DemoActionModal";
import { playBubblePop } from "@/lib/soundEffects";
import { toast } from "@/lib/toast";
import { useTranslation } from "react-i18next";

// emoji, veritabanına yazılan ruh hali değeridir (moods.mood_type) ve değişmez; yalnızca etiket çevrilir
export const MOODS = [
  { emoji: "😍", labelKey: "moods.veryHappy" },
  { emoji: "😊", labelKey: "moods.happy" },
  { emoji: "😐", labelKey: "moods.okay" },
  { emoji: "😢", labelKey: "moods.sad" },
  { emoji: "😡", labelKey: "moods.angry" },
  { emoji: "😴", labelKey: "moods.tired" },
] as const;

const COOLDOWN_SECONDS = 60; // Değişiklikler arası 60 saniye bekleme süresi
const MAX_DAILY_MOOD_UPDATES = 5; // Günde en fazla 5 kez değiştirme hakkı

interface MoodSelectorProps {
  currentMood?: string | null;
  theme: AppTheme;
}

export const MoodSelector = memo(function MoodSelector({ currentMood, theme }: MoodSelectorProps) {
  const { t } = useTranslation();
  const { session, profile } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<string | null>(currentMood || null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState<number>(0);
  const [updateCount, setUpdateCount] = useState<number>(0);

  const lastUpdateTimestampRef = useRef<number>(0);

  const userId = session?.user?.id;
  const today = todayString();

  // Kullanıcıya özel anahtarlar: Çoklu hesap kullanan cihazlarda çakışmayı önler
  const lastTimeKey = userId ? `@mood_last_time_${userId}_${today}` : null;
  const countKey = userId ? `@mood_count_${userId}_${today}` : null;

  // Günlük kota ve son güncelleme zamanını oku
  const checkRateLimit = React.useCallback(async () => {
    if (!lastTimeKey || !countKey) return;
    try {
      const [lastTimeStr, countStr] = await Promise.all([
        AsyncStorage.getItem(lastTimeKey),
        AsyncStorage.getItem(countKey),
      ]);
      if (countStr) {
        setUpdateCount(parseInt(countStr, 10) || 0);
      }
      if (lastTimeStr) {
        const lastTime = parseInt(lastTimeStr, 10) || 0;
        lastUpdateTimestampRef.current = lastTime;
        const diffSeconds = Math.floor((Date.now() - lastTime) / 1000);
        if (diffSeconds < COOLDOWN_SECONDS) {
          setCooldown(COOLDOWN_SECONDS - diffSeconds);
        } else {
          setCooldown(0);
        }
      }
    } catch (e) {
      logger.error("Rate limit state load error:", e);
    }
  }, [lastTimeKey, countKey]);

  useEffect(() => {
    setSelected(currentMood || null);
    checkRateLimit();
  }, [currentMood, checkRateLimit]);

  // Uygulama arka plandan öne geldiğinde cooldown süresini gerçek zamana göre güncelle
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        checkRateLimit();
      }
    });
    return () => sub.remove();
  }, [checkRateLimit]);

  // Cooldown geri sayımı
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  async function handleMoodSelect(emoji: string) {
    if (selected === emoji) return;

    // Gerçek zamanlı timestamp kontrolü (arka planda interval dursa bile bypass edilemez)
    if (lastUpdateTimestampRef.current > 0) {
      const elapsed = Math.floor((Date.now() - lastUpdateTimestampRef.current) / 1000);
      if (elapsed < COOLDOWN_SECONDS) {
        const remaining = COOLDOWN_SECONDS - elapsed;
        setCooldown(remaining);
        toast.info(t("home.mood.cooldownToast", { count: remaining }), {
          title: t("home.mood.cooldownTitle"),
          emoji: "⏳",
        });
        return;
      }
    }

    if (updateCount >= MAX_DAILY_MOOD_UPDATES) {
      toast.info(t("home.mood.dailyLimitToast"), {
        title: t("home.mood.dailyLimitTitle"),
        emoji: "🌸",
      });
      return;
    }

    // Ruh hali değişimi: akıcı tekerlek tıkı (selectionAsync) + yumuşak baloncuk sesi
    playBubblePop();
    if (executeOrIntercept(
      () => {},
      t("home.mood.demoTitle"),
      t("home.mood.demoDescription")
    )) {
      return;
    }
    if (loading || !userId) return;
    setLoading(true);

    const coupleId = profile?.coupleId || null;

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
      const now = Date.now();
      setSelected(emoji);
      const nextCount = updateCount + 1;
      setUpdateCount(nextCount);
      setCooldown(COOLDOWN_SECONDS);
      lastUpdateTimestampRef.current = now;

      // Spam koruma zaman damgasını kullanıcıya özel kaydet
      try {
        if (lastTimeKey) await AsyncStorage.setItem(lastTimeKey, now.toString());
        if (countKey) await AsyncStorage.setItem(countKey, nextCount.toString());
      } catch (e) {
        logger.error("Rate limit save error:", e);
      }

      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["calendar_data"] });
      // Partner bildirimi sunucudaki moods tetikleyicisinden (send-push) gider; burada ayrıca göndermek çift bildirim yapıyordu.
    } else {
      logger.error("Mood error:", JSON.stringify(error, null, 2));
      toast.error(error?.message || t("errors.unknown"), { title: t("home.mood.saveFailed") });
    }
  }

  const isRateLimited = cooldown > 0 || updateCount >= MAX_DAILY_MOOD_UPDATES;

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
      <Text style={[styles.title, { color: theme.text }]}>{t("home.mood.question")}</Text>

      <View style={styles.row}>
        {MOODS.map((mood) => {
          const isSelected = selected === mood.emoji;
          return (
            <TouchableOpacity
              key={mood.emoji}
              onPress={() => handleMoodSelect(mood.emoji)}
              disabled={loading || isRateLimited}
              activeOpacity={0.7}
              style={[
                styles.moodBtn,
                isSelected
                  ? { backgroundColor: theme.pillAccentBg, borderColor: theme.accent, borderWidth: 1.5 }
                  : { 
                      backgroundColor: "transparent", 
                      borderColor: theme.isLight ? theme.inputBorder : "rgba(255,255,255,0.1)", 
                      borderWidth: 1 
                    },
                isRateLimited && !isSelected && { opacity: 0.35 },
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
                {t(mood.labelKey)}
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

      {cooldown > 0 ? (
        <Text style={[styles.lockedText, { color: theme.textMuted }]}>
          {t("home.mood.updatedCooldown", { cooldown })}
        </Text>
      ) : updateCount >= MAX_DAILY_MOOD_UPDATES ? (
        <Text style={[styles.lockedText, { color: theme.textMuted }]}>
          {t("home.mood.limitReached")}
        </Text>
      ) : selected ? (
        <Text style={[styles.lockedText, { color: theme.textMuted }]}>
          {t("home.mood.canUpdateAnytime")}
        </Text>
      ) : (
        <Text style={[styles.lockedText, { color: theme.textMuted }]}>
          {t("home.mood.pickPrompt")}
        </Text>
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
