import React from "react";
import { ShieldCheck, Lock, FileText, UserCheck, CreditCard } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import type { LegalDocType } from "@/constants/legalTexts";
import { ModernSection } from "./ModernSection";
import { SettingsRow } from "./SettingsRow";
import { useTranslation } from "react-i18next";

interface LegalDocsListProps {
  theme: AppTheme;
  onOpenDoc: (doc: LegalDocType) => void;
}

const LEGAL_ITEMS = [
  { id: "kvkk" as const, titleKey: "legal.docs.kvkk.title", subKey: "legal.docs.kvkk.sub", icon: ShieldCheck },
  { id: "privacy" as const, titleKey: "paywall.links.privacy", subKey: "legal.docs.privacy.sub", icon: Lock },
  { id: "terms" as const, titleKey: "paywall.links.terms", subKey: "legal.docs.terms.sub", icon: FileText },
  { id: "consent" as const, titleKey: "legal.docs.consent.title", subKey: "legal.docs.consent.sub", icon: UserCheck },
  { id: "subscription" as const, titleKey: "legal.docs.subscription.title", subKey: "legal.docs.subscription.sub", icon: CreditCard },
] as const;

/** Yasal belgeler: varsayılan kapalı, açılınca kenardan kenara satır listesi. */
export function LegalDocsList({ theme, onOpenDoc }: LegalDocsListProps) {
  const { t } = useTranslation();
  return (
    <ModernSection
      title={t("profile.legal.title")}
      icon={<ShieldCheck size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={false}
      flush
    >
      {LEGAL_ITEMS.map((item) => (
        <SettingsRow
          key={item.id}
          icon={item.icon}
          title={t(item.titleKey)}
          subtitle={t(item.subKey)}
          onPress={() => onOpenDoc(item.id)}
          theme={theme}
        />
      ))}
    </ModernSection>
  );
}
