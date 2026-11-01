import { View } from "react-native";
import { Gift } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import type { useDemoAction } from "@/hooks/useDemoAction";
import { ModernSection } from "./ModernSection";
import { PromoCodeForm } from "./PromoCodeForm";
import { useTranslation } from "react-i18next";

interface PromoCodeCardProps {
  theme: AppTheme;
  isLight: boolean;
  executeOrIntercept: ReturnType<typeof useDemoAction>["executeOrIntercept"];
  refreshProfile: () => Promise<unknown>;
  onPremiumSuccess: () => void;
}

export function PromoCodeCard({
  theme,
  isLight,
  executeOrIntercept,
  refreshProfile,
  onPremiumSuccess,
}: PromoCodeCardProps) {
  const { t } = useTranslation();

  return (
    <ModernSection
      title={t("profile.promo.title")}
      icon={<Gift size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={false}
    >
      {/* Form kendi üst boşluklarını taşır (modalla ortak); kartın iç boşluğuyla çift saymamak için yukarı çekilir */}
      <View style={{ marginTop: -10 }}>
        <PromoCodeForm
          theme={theme}
          isLight={isLight}
          executeOrIntercept={executeOrIntercept}
          refreshProfile={refreshProfile}
          onPremiumSuccess={onPremiumSuccess}
        />
      </View>
    </ModernSection>
  );
}
