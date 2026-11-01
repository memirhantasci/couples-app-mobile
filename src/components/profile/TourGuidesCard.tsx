import React from "react";
import { Sparkles, RotateCcw } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import { resetAllPageTours } from "@/hooks/usePageTour";
import { toast } from "@/lib/toast";
import { ModernSection } from "./ModernSection";
import { SettingsRow } from "./SettingsRow";
import { useTranslation } from "react-i18next";

interface TourGuidesCardProps {
  theme: AppTheme;
  isLight: boolean;
  onOpenTour: () => void;
}

export function TourGuidesCard({ theme, onOpenTour }: TourGuidesCardProps) {
  const { t } = useTranslation();
  return (
    <ModernSection
      title={t("profile.tours.title")}
      icon={<Sparkles size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={false}
      flush
    >
      <SettingsRow icon={Sparkles} title={t("profile.tours.openGuide")} onPress={onOpenTour} theme={theme} />
      <SettingsRow
        icon={RotateCcw}
        title={t("menu.guides.restartTour")}
        onPress={async () => {
          await resetAllPageTours();
          toast.success(t("menu.guides.resetMessage"), {
            title: t("profile.tours.reset"),
            emoji: "🎉",
            duration: 4600,
          });
        }}
        theme={theme}
      />
    </ModernSection>
  );
}
