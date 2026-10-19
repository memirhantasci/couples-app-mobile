import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Sparkles } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import { resetAllPageTours } from "@/hooks/usePageTour";
import { toast } from "@/lib/toast";
import { ModernSection } from "./ModernSection";
import { profileSharedStyles } from "./profileSharedStyles";

interface TourGuidesCardProps {
  theme: AppTheme;
  isLight: boolean;
  onOpenTour: () => void;
}

export function TourGuidesCard({ theme, isLight, onOpenTour }: TourGuidesCardProps) {
  return (
    <ModernSection
      title="Tanıtımlar & Özellik Rehberleri"
      icon={<Sparkles size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={false}
    >
      <Text style={[profileSharedStyles.sessionHintText, { color: theme.textMuted }]}>
        Uygulamadaki tüm sayfaların ve özelliklerin ne işe yaradığını dilediğiniz an baştan inceleyebilirsiniz.
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
          <Text style={[profileSharedStyles.logoutBtnText, { color: theme.accent }]}>Bu Sayfanın Rehberini Aç 💡</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={async () => {
            await resetAllPageTours();
            toast.success(
              "Ana Sayfa'ya döndüğünüzde kısa tanıtım turu yeniden gösterilecek. Diğer sayfaların rehberine sağ üstteki ? butonundan ulaşabilirsiniz.",
              { title: "Sıfırlandı", emoji: "🎉", duration: 4600 }
            );
          }}
          style={[
            profileSharedStyles.logoutBtn,
            {
              backgroundColor: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
              borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)",
            },
          ]}
          activeOpacity={0.8}
        >
          <Text style={[profileSharedStyles.logoutBtnText, { color: theme.text }]}>Ana Sayfa Turunu Yeniden Başlat 🔄</Text>
        </TouchableOpacity>
      </View>
    </ModernSection>
  );
}
