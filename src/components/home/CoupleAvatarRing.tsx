import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Heart } from "lucide-react-native";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useTheme } from "@/context/ThemeContext";
import { useTranslation } from "react-i18next";

interface CoupleAvatarRingProps {
  myName?: string | null;
  partnerName?: string | null;
  myAvatarUrl?: string | null;
  partnerAvatarUrl?: string | null;
  /** Partnerin bugünkü ruh hali emojisi (canlı rozet) */
  partnerMoodEmoji?: string | null;
  size?: number;
}

/** Ana sayfa: iç içe geçmiş iki zarif daire — [ Sen ] ❤️ [ Sevgilin ] */
export const CoupleAvatarRing = memo(function CoupleAvatarRing({
  myName,
  partnerName,
  myAvatarUrl,
  partnerAvatarUrl,
  partnerMoodEmoji,
  size = 36,
}: CoupleAvatarRingProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const heartSize = Math.round(size * 0.5);
  const moodSize = Math.round(size * 0.52);

  return (
    <View
      style={styles.row}
      accessibilityLabel={t("home.couple.a11yLabel", {
        me: myName || t("common.you"),
        partner: partnerName || t("common.partnerFallback"),
      })}
    >
      <UserAvatar uri={myAvatarUrl} name={myName} size={size} borderColor={theme.cardBg} borderWidth={2} />

      <View
        style={[
          styles.heart,
          {
            width: heartSize,
            height: heartSize,
            borderRadius: heartSize / 2,
            marginHorizontal: -Math.round(heartSize * 0.35),
            backgroundColor: theme.accent,
            borderColor: theme.cardBg,
          },
        ]}
      >
        <Heart size={Math.round(heartSize * 0.55)} color="#FFFFFF" fill="#FFFFFF" />
      </View>

      <UserAvatar
        uri={partnerAvatarUrl}
        name={partnerName}
        size={size}
        borderColor={theme.cardBg}
        borderWidth={2}
        badge={
          partnerMoodEmoji ? (
            <View
              style={[
                styles.mood,
                {
                  width: moodSize,
                  height: moodSize,
                  borderRadius: moodSize / 2,
                  backgroundColor: theme.cardBg,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text style={{ fontSize: Math.round(moodSize * 0.62) }}>{partnerMoodEmoji}</Text>
            </View>
          ) : undefined
        }
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  heart: {
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  mood: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
