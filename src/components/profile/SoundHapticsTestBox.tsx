import { useEffect, useState } from "react";
import { View, Text, Pressable, Switch, StyleSheet } from "react-native";
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
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { fieldSurface } from "./profileTokens";
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

  const switchTrack = { false: isLight ? "#d1d5db" : "#374151", true: theme.accent };

  // Önizleme düğmeleri: emoji, etiket ve çalınacak ses
  const samples = [
    { emoji: "🥰", label: t("notifications.push.mood.subtitle"), play: playBubblePop },
    { emoji: "💌", label: t("profile.sound.letter"), play: playLetterSend },
    { emoji: "💊", label: t("profile.sound.medicine"), play: playSuccessChime },
    { emoji: "📍", label: t("tabs.map.label"), play: playStampDrop },
    { emoji: "📸", label: t("calendar.legend.photo"), play: playCameraClick },
    { emoji: "💖", label: t("profile.sound.loveMeter"), play: playCelebration },
  ];

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

      <SettingsGroup inset theme={theme}>
        <SettingsRow
          icon={soundEnabled ? Volume2 : VolumeX}
          title={t("profile.sound.inApp")}
          subtitle={t("profile.sound.inAppSub")}
          trailing={
            <Switch value={soundEnabled} onValueChange={toggleSound} trackColor={switchTrack} thumbColor="#ffffff" />
          }
          theme={theme}
        />
        <SettingsRow
          icon={Vibrate}
          title={t("profile.sound.haptics")}
          subtitle={t("profile.sound.hapticsSub")}
          trailing={
            <Switch value={hapticEnabled} onValueChange={toggleHaptic} trackColor={switchTrack} thumbColor="#ffffff" />
          }
          theme={theme}
        />
      </SettingsGroup>

      {/* Sesleri Önizle & Dene */}
      <View style={profileSharedStyles.inputGroup}>
        <Text style={[profileSharedStyles.fieldLabel, { color: theme.textSecondary }]}>
          {t("profile.sound.tryTitle")}
        </Text>
        <View style={styles.grid}>
          {samples.map((sample) => (
            <Pressable
              key={sample.label}
              accessibilityRole="button"
              accessibilityLabel={sample.label}
              onPress={() => sample.play()}
              style={({ pressed }) => [
                styles.sample,
                { backgroundColor: pressed ? theme.pillAccentBg : fieldSurface(theme) },
              ]}
            >
              <Text style={styles.sampleEmoji}>{sample.emoji}</Text>
              <Text style={[styles.sampleLabel, { color: theme.text }]} numberOfLines={1}>
                {sample.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sample: {
    width: "31.6%",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 16,
  },
  sampleEmoji: {
    fontSize: 24,
  },
  sampleLabel: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
});
