import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Sparkles } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import { resetAllPageTours } from "@/hooks/usePageTour";
import { toast } from "@/lib/toast";
import { ModernSection } from "./ModernSection";
import { profileSharedStyles } from "./profileSharedStyles";
import { useTranslation } from "react-i18next";

interface TourGuidesCardProps {
  theme: AppTheme;
  isLight: boolean;
  onOpenTour: () => void;
}

export function TourGuidesCard({ theme, isLight, onOpenTour }: TourGuidesCardProps) {
  const { t } = useTranslation();
  return (
    <ModernSection
      title={t("profile.tours.title")}
      icon={<Sparkles size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={false}
    >
      <Text style={[profileSharedStyles.sessionHintText, { color: theme.textMuted }]}>
        {t("profile.tours.description")}
      </Text>

      <View style={{ gap: 10 }}>
        <TouchableOpacity
          onPress={onOpenTour}
          style={[
            profileSharedStyles.logoutBtn,
            {
              backgroundColor: theme.pillAccentBg,
              borderColor: theme.pillAccentBorder,
            },
          ]}
          activeOpacity={0.8}
        >
          <Sparkles size={16} color={theme.accent} />
          <Text style={[profileSharedStyles.logoutBtnText, { color: theme.accent }]}>{t("profile.tours.openGuide")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={async () => {
            await resetAllPageTours();
            toast.success(
              t("menu.guides.resetMessage"),
              { title: t("profile.tours.reset"), emoji: "🎉", duration: 4600 }
            );
          }}
          style={[
            profileSharedStyles.logoutBtn,
            {
              backgroundColor: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
              borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.1)",
            },
          ]}
          activeOpacity={0.8}
        >
          <Text style={[profileSharedStyles.logoutBtnText, { color: theme.text }]}>{t("menu.guides.restartTour")}</Text>
        </TouchableOpacity>
      </View>
    </ModernSection>
  );
}
