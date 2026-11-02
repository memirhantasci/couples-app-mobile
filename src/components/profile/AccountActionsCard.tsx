import React from "react";
import { Text } from "react-native";
import { LogOut, Trash2 } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import { ModernSection } from "./ModernSection";
import { SettingsButton } from "./SettingsButton";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { profileSharedStyles } from "./profileSharedStyles";
import { useTranslation } from "react-i18next";

interface AccountActionsCardProps {
  theme: AppTheme;
  deleting: boolean;
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

/** Ekranın en altı: açılır "Hesabı sil" kartı ve onun altında "Çıkış yap". */
export function AccountActionsCard({ theme, deleting, onSignOut, onDeleteAccount }: AccountActionsCardProps) {
  const { t } = useTranslation();
  return (
    <>
      <ModernSection
        title={t("profile.danger.delete")}
        icon={<Trash2 size={18} color="#E5546F" />}
        theme={theme}
        defaultOpen={false}
      >
        <Text style={[profileSharedStyles.sessionHintText, { color: theme.textMuted }]}>
          <Text style={{ fontFamily: "Inter_700Bold", color: "#E5546F" }}>{t("profile.danger.noticeTitle")} </Text>
          {t("profile.danger.noticeText")}
        </Text>
        <SettingsButton
          label={t("profile.danger.delete")}
          variant="danger"
          loading={deleting}
          onPress={onDeleteAccount}
          theme={theme}
        />
      </ModernSection>

      <SettingsGroup theme={theme}>
        <SettingsRow icon={LogOut} title={t("auth.signOut")} onPress={onSignOut} theme={theme} />
      </SettingsGroup>
    </>
  );
}
