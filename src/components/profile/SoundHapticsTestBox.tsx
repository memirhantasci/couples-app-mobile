import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Switch, StyleSheet } from "react-native";
import { Volume2, VolumeX, Vibrate } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import {
  getSoundEffectsEnabled,
  setSoundEffectsEnabled,
  getHapticFeedbackEnabled,
  setHapticFeedbackEnabled,
  triggerHaptic,
  playBubblePop,
  playLetterSend,
  playSuccessChime,
  playStampDrop,
  playCameraClick,
  playCelebration,
} from "@/lib/soundEffects";
import { ModernSection } from "./ModernSection";
import { profileSharedStyles } from "./profileSharedStyles";
import { useTranslation } from "react-i18next";

interface SoundHapticsTestBoxProps {
  theme: AppTheme;
  isLight: boolean;
}

export function SoundHapticsTestBox({ theme, isLight }: SoundHapticsTestBoxProps) {
  const { t } = useTranslation();
  // Ses & Titreşim Ayarları
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);

  useEffect(() => {
    getSoundEffectsEnabled().then(setSoundEnabled);
    getHapticFeedbackEnabled().then(setHapticEnabled);
  }, []);

  const toggleSound = async (val: boolean) => {
    setSoundEnabled(val);
    await setSoundEffectsEnabled(val);
    if (val) playBubblePop();
  };

  const toggleHaptic = async (val: boolean) => {
    setHapticEnabled(val);
    await setHapticFeedbackEnabled(val);
    if (val) triggerHaptic("bubble_pop");
  };

  const cardBorder = isLight ? theme.cardBorder : "rgba(255,255,255,0.08)";

  return (
    <ModernSection
      title={t("profile.sound.title")}
      icon={<Volume2 size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={false}
    >
      <Text style={[profileSharedStyles.sessionHintText, { color: theme.textMuted }]}>
        {t("profile.sound.description")}
      </Text>

      <View style={{ gap: 12 }}>
        {/* Ses Efektleri Toggle */}
        <View style={[styles.settingToggleCard, { backgroundColor: theme.unitBg, borderColor: cardBorder }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            <View style={[styles.settingIconBox, { backgroundColor: theme.pillAccentBg }]}>
              {soundEnabled ? <Volume2 size={18} color={theme.accent} /> : <VolumeX size={18} color={theme.textMuted} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingToggleTitle, { color: theme.text }]}>{t("profile.sound.inApp")}</Text>
              <Text style={[styles.settingToggleSub, { color: theme.textMuted }]}>{t("profile.sound.inAppSub")}</Text>
            </View>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={toggleSound}
            trackColor={{ false: isLight ? "#d1d5db" : "#374151", true: theme.accent }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Haptic Titreşim Toggle */}
        <View style={[styles.settingToggleCard, { backgroundColor: theme.unitBg, borderColor: cardBorder }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            <View style={[styles.settingIconBox, { backgroundColor: theme.pillAccentBg }]}>
              <Vibrate size={18} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingToggleTitle, { color: theme.text }]}>{t("profile.sound.haptics")}</Text>
              <Text style={[styles.settingToggleSub, { color: theme.textMuted }]}>{t("profile.sound.hapticsSub")}</Text>
            </View>
          </View>
          <Switch
            value={hapticEnabled}
            onValueChange={toggleHaptic}
            trackColor={{ false: isLight ? "#d1d5db" : "#374151", true: theme.accent }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Sesleri Önizle & Dene */}
        <View style={{ marginTop: 4 }}>
          <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary, marginBottom: 8 }]}>
            {t("profile.sound.tryTitle")}
          </Text>
          <View style={styles.soundTestGrid}>
            <TouchableOpacity
              onPress={() => playBubblePop()}
              style={[styles.soundTestBtn, { backgroundColor: theme.unitBg, borderColor: cardBorder }]}
              activeOpacity={0.7}
            >
              <Text style={styles.soundTestEmoji}>🥰</Text>
              <Text style={[styles.soundTestLabel, { color: theme.text }]}>{t("notifications.push.mood.subtitle")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => playLetterSend()}
              style={[styles.soundTestBtn, { backgroundColor: theme.unitBg, borderColor: cardBorder }]}
              activeOpacity={0.7}
            >
              <Text style={styles.soundTestEmoji}>💌</Text>
              <Text style={[styles.soundTestLabel, { color: theme.text }]}>{t("profile.sound.letter")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => playSuccessChime()}
              style={[styles.soundTestBtn, { backgroundColor: theme.unitBg, borderColor: cardBorder }]}
              activeOpacity={0.7}
            >
              <Text style={styles.soundTestEmoji}>💊</Text>
              <Text style={[styles.soundTestLabel, { color: theme.text }]}>{t("profile.sound.medicine")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => playStampDrop()}
              style={[styles.soundTestBtn, { backgroundColor: theme.unitBg, borderColor: cardBorder }]}
              activeOpacity={0.7}
            >
              <Text style={styles.soundTestEmoji}>📍</Text>
              <Text style={[styles.soundTestLabel, { color: theme.text }]}>{t("tabs.map.label")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => playCameraClick()}
              style={[styles.soundTestBtn, { backgroundColor: theme.unitBg, borderColor: cardBorder }]}
              activeOpacity={0.7}
            >
              <Text style={styles.soundTestEmoji}>📸</Text>
              <Text style={[styles.soundTestLabel, { color: theme.text }]}>{t("calendar.legend.photo")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => playCelebration()}
              style={[styles.soundTestBtn, { backgroundColor: theme.unitBg, borderColor: cardBorder }]}
              activeOpacity={0.7}
            >
              <Text style={styles.soundTestEmoji}>💖</Text>
              <Text style={[styles.soundTestLabel, { color: theme.text }]}>{t("profile.sound.loveMeter")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  settingToggleCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  settingIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  settingToggleTitle: {
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  settingToggleSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  soundTestGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  soundTestBtn: {
    width: "31.5%",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  soundTestEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  soundTestLabel: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
});
