import { memo, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { letterUnlockAt } from "@/lib/letterPolicy";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { ChevronRight, Mail } from "lucide-react-native";
import { dayjs } from "@/lib/date";
import { AppTheme } from "@/lib/theme";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useCoupleAvatars } from "@/hooks/useCoupleAvatars";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

export interface PendingLetter {
  id: number;
  unlock_date: string;
  sender_id?: string | null;
  sender?: { display_name?: string | null; username?: string | null };
}

/** Henüz açılmamış mektuplar: açılış anı (unlock_date günü 00:00 UTC, bkz. letterUnlockAt) gelmemiş olanlar. */
export function getUpcomingLetters(letters: PendingLetter[] | null | undefined): PendingLetter[] {
  if (!letters || letters.length === 0) return [];
  const now = Date.now();
  return letters.filter((letter) => letterUnlockAt(letter) > now);
}

// `t` parametre olarak alınır: bileşenler render sırasında çağırır, dil değişince metin yenilenir
function senderLabel(letter: PendingLetter, t: TFunction): string {
  return letter.sender?.display_name?.trim() || letter.sender?.username?.trim() || t("common.partnerFallback");
}

function daysLeftLabel(daysLeft: number, t: TFunction): string {
  if (daysLeft <= 0) return t("home.pending.opensToday");
  if (daysLeft === 1) return t("home.pending.opensTomorrow");
  return t("home.pending.opensInDays", { daysLeft });
}

// ─── ÜST ROZET ───────────────────────────────────────────────────────────────
// Ana sayfanın en üstünde, bekleyen mektup varsa dikkat çeken yumuşak nabız atan bildirim.

export const PendingLettersBadge = memo(function PendingLettersBadge({
  letters,
  theme,
}: {
  letters: PendingLetter[] | null | undefined;
  theme: AppTheme;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  const count = getUpcomingLetters(letters).length;

  useEffect(() => {
    if (count === 0 || reduceMotion) return;
    pulse.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 1100, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      )
    );
    return () => cancelAnimation(pulse);
  }, [count, reduceMotion, pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.55 - pulse.value * 0.55,
    transform: [{ scale: 1 + pulse.value * 0.9 }],
  }));

  if (count === 0) return null;

  const first = getUpcomingLetters(letters)[0];
  const daysLeft = dayjs(first.unlock_date).diff(dayjs().startOf("day"), "day");

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push("/(tabs)/letters" as any)}
      accessibilityRole="button"
      accessibilityLabel={t("home.pending.a11y", { count })}
      style={[styles.badgeWrap, { borderColor: theme.pillAccentBorder }]}
    >
      <LinearGradient
        colors={[theme.pillAccentBg, "rgba(255,255,255,0.02)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.badgeGradient}
      >
        <View style={styles.badgeIconWrap}>
          <Animated.View style={[styles.badgeHalo, { backgroundColor: theme.accent }, haloStyle]} />
          <View style={[styles.badgeIcon, { backgroundColor: theme.accent }]}>
            <Mail size={14} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.badgeTextBlock}>
          <Text style={[styles.badgeTitle, { color: theme.text }]} numberOfLines={1}>
            {count === 1 ? t("home.pending.sealedOne") : t("home.pending.sealedMany", { count })}
          </Text>
          <Text style={[styles.badgeSub, { color: theme.textSecondary }]} numberOfLines={1}>
            {senderLabel(first, t)} · {daysLeftLabel(daysLeft, t)}
          </Text>
        </View>

        <ChevronRight size={18} color={theme.accent} />
      </LinearGradient>
    </TouchableOpacity>
  );
});

// ─── KART ────────────────────────────────────────────────────────────────────

export const PendingLettersCard = memo(function PendingLettersCard({
  letters,
  theme,
}: {
  letters: PendingLetter[];
  theme: AppTheme;
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { getAvatarUrl } = useCoupleAvatars();
  const pendingLetters = getUpcomingLetters(letters);
  if (pendingLetters.length === 0) return null;

  const today = dayjs().startOf("day");

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
      {/* Başlık + Tümünü Gör */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIcon, { backgroundColor: theme.pillAccentBg }]}>
            <Mail size={15} color={theme.accent} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>{t("home.pending.title")}</Text>
          <View style={[styles.countPill, { backgroundColor: theme.accent }]}>
            <Text style={styles.countPillText}>{pendingLetters.length}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/letters" as any)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
        >
          <Text style={[styles.viewAll, { color: theme.accent }]}>{t("common.seeAll")}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {pendingLetters.map((letter) => {
          const unlockDate = dayjs(letter.unlock_date);
          const daysLeft = unlockDate.diff(today, "day");
          const name = senderLabel(letter, t);
          const senderAvatarUrl = getAvatarUrl(letter.sender_id);

          return (
            <View
              key={letter.id}
              style={[styles.letterItem, { backgroundColor: theme.unitBg, borderColor: theme.cardBorder }]}
            >
              {/* Mühür — gönderenin fotoğrafı varsa pul olarak fotoğraf, köşesinde mum mühür */}
              {senderAvatarUrl ? (
                <UserAvatar
                  uri={senderAvatarUrl}
                  name={name}
                  size={44}
                  badge={
                    <LinearGradient
                      colors={[theme.accent, theme.accentLight]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[styles.miniSeal, { borderColor: theme.unitBg }]}
                    >
                      <Text style={styles.miniSealEmoji}>💌</Text>
                    </LinearGradient>
                  }
                />
              ) : (
                <LinearGradient
                  colors={[theme.accent, theme.accentLight]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.seal}
                >
                  <Text style={styles.sealEmoji}>💌</Text>
                </LinearGradient>
              )}

              {/* İsim + önizleme + tarih */}
              <View style={styles.textBlock}>
                <Text style={[styles.senderName, { color: theme.text }]} numberOfLines={1}>
                  {t("home.pending.letterFrom", { name })}
                </Text>
                <Text style={[styles.previewText, { color: theme.textMuted }]} numberOfLines={1}>
                  {t("home.pending.closeEyes")}
                </Text>
                <Text style={[styles.dateText, { color: theme.textSecondary }]}>
                  {t("home.pending.opensOn", { date: unlockDate.locale(i18n.language).format("D MMMM") })}
                </Text>
              </View>

              {/* Geri sayım */}
              <View style={[styles.daysBox, { backgroundColor: theme.pillAccentBg, borderColor: theme.pillAccentBorder }]}>
                {daysLeft <= 0 ? (
                  <Text style={[styles.daysToday, { color: theme.accent }]}>{t("common.today")}</Text>
                ) : (
                  <>
                    <Text style={[styles.daysNumber, { color: theme.accent }]}>{daysLeft}</Text>
                    <Text style={[styles.daysUnit, { color: theme.accent }]}>{t("home.pending.daysUnit", { count: daysLeft })}</Text>
                  </>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // ─── Rozet ───
  badgeWrap: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  badgeGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
  },
  badgeIconWrap: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeHalo: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  badgeIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTextBlock: {
    flex: 1,
  },
  badgeTitle: {
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
  },
  badgeSub: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },

  // ─── Kart ───
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginRight: 8,
  },
  headerIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flexShrink: 1,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  countPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  viewAll: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    gap: 10,
  },
  letterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  seal: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sealEmoji: {
    fontSize: 20,
  },
  miniSeal: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  miniSealEmoji: {
    fontSize: 10,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  senderName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  previewText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  dateText: {
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
  },
  daysBox: {
    minWidth: 50,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  daysNumber: {
    fontSize: 18,
    lineHeight: 21,
    fontFamily: "Inter_700Bold",
  },
  daysUnit: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  daysToday: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
});
