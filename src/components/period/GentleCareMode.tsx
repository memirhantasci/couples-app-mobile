import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Check, HeartHandshake } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";
import { toast } from "@/lib/toast";
import { logger } from "@/utils/logger";
import {
  feelingSharedToday,
  getLastGentleCareShare,
  isGentleCareCoolingDown,
  shareGentleCare,
  type GentleCareFeeling,
  type GentleCareShare,
} from "@/lib/gentleCare";
import type { AppTheme } from "@/lib/theme";

interface GentleCareModeProps {
  theme: AppTheme;
  coupleId: number | null;
  userId: string | null;
  /** Premium çift bazındadır: partner de aynı durumdadır */
  partnerHasPremium: boolean;
  /** Demo modunda paylaşımı yakalar (true dönerse gönderim yapılmaz) */
  interceptDemo: () => boolean;
}

const OPTIONS: { feeling: GentleCareFeeling; emoji: string; titleKey: ParseKeys; hintKey: ParseKeys }[] = [
  {
    feeling: "low_energy",
    emoji: "☕",
    titleKey: "period.gentleCare.options.lowEnergy.title",
    hintKey: "period.gentleCare.options.lowEnergy.hint",
  },
  {
    feeling: "emotional",
    emoji: "🤍",
    titleKey: "period.gentleCare.options.emotional.title",
    hintKey: "period.gentleCare.options.emotional.hint",
  },
  {
    feeling: "resting",
    emoji: "🌸",
    titleKey: "period.gentleCare.options.resting.title",
    hintKey: "period.gentleCare.options.resting.hint",
  },
];

/** Kadın, nasıl hissettiğini tek dokunuşla partnerine iletir. Döngünün kendisi asla paylaşılmaz. */
export function GentleCareMode({ theme, coupleId, userId, partnerHasPremium, interceptDemo }: GentleCareModeProps) {
  const { t } = useTranslation();
  const [lastShare, setLastShare] = useState<GentleCareShare | null>(null);
  const [sending, setSending] = useState<GentleCareFeeling | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    getLastGentleCareShare(userId).then((share) => {
      if (alive) setLastShare(share);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const sharedToday = feelingSharedToday(lastShare);

  async function handleSelect(feeling: GentleCareFeeling) {
    if (sending) return;
    if (interceptDemo()) return;
    if (!coupleId || !userId) return;
    if (isGentleCareCoolingDown(lastShare)) {
      toast.info(t("period.gentleCare.cooldown"), { emoji: "⏳" });
      return;
    }

    setSending(feeling);
    try {
      setLastShare(await shareGentleCare({ coupleId, userId, feeling, partnerHasPremium }));
      toast.success(t("period.gentleCare.sent"), { emoji: "🤍" });
    } catch (error) {
      logger.error("[GentleCare] share failed:", error);
      toast.error(t("errors.actionFailed"));
    } finally {
      setSending(null);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
      <View style={styles.header}>
        <HeartHandshake size={18} color={theme.accent} />
        <Text style={[styles.title, { color: theme.text }]}>{t("period.gentleCare.title")}</Text>
      </View>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t("period.gentleCare.subtitle")}</Text>

      <View style={styles.options}>
        {OPTIONS.map((option) => {
          const isShared = sharedToday === option.feeling;
          const isSending = sending === option.feeling;
          return (
            <TouchableOpacity
              key={option.feeling}
              activeOpacity={0.85}
              disabled={!!sending}
              onPress={() => handleSelect(option.feeling)}
              style={[
                styles.option,
                {
                  backgroundColor: isShared ? theme.pillAccentBg : theme.unitBg,
                  borderColor: isShared ? theme.accent : theme.cardBorder,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isShared, busy: isSending }}
            >
              <View style={[styles.emojiCircle, { backgroundColor: theme.isLight ? "#FFFFFF" : "rgba(255,255,255,0.06)" }]}>
                <Text style={styles.emoji}>{option.emoji}</Text>
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, { color: theme.text }]}>{t(option.titleKey)}</Text>
                <Text style={[styles.optionHint, { color: theme.textMuted }]}>{t(option.hintKey)}</Text>
              </View>
              {isSending ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : isShared ? (
                <View style={[styles.sentBadge, { backgroundColor: theme.accent }]}>
                  <Check size={12} color="#FFFFFF" strokeWidth={3} />
                  <Text style={styles.sentBadgeText}>{t("period.gentleCare.sentBadge")}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.privacyNote, { color: theme.textMuted }]}>{t("period.gentleCare.privacyNote")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    marginBottom: 6,
  },
  options: {
    gap: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  emojiCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 19,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  optionHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  sentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sentBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  privacyNote: {
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginTop: 6,
  },
});
