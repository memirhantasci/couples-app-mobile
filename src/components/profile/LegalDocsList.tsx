import React, { useEffect, useState } from "react";
import { Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import { ShieldCheck, Lock, FileText, UserCheck, CreditCard, Mail, SlidersHorizontal } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import type { LegalDocType } from "@/constants/legalTexts";
import { ModernSection } from "./ModernSection";
import { SettingsRow } from "./SettingsRow";
import { useTranslation } from "react-i18next";
import { SUPPORT_EMAIL } from "@/constants/brand";
import { toast } from "@/lib/toast";
import { isAdsPrivacyOptionsRequired, showAdsPrivacyOptions } from "@/lib/adsConsent";

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
  const { t, i18n } = useTranslation();

  // Reklam rızası geri alma girişi: yalnızca UMP bunu zorunlu tuttuğu bölgelerde (AB / Birleşik Krallık) görünür
  const [adsPrivacyRequired, setAdsPrivacyRequired] = useState(false);
  useEffect(() => {
    let active = true;
    isAdsPrivacyOptionsRequired().then((required) => {
      if (active) setAdsPrivacyRequired(required);
    });
    return () => {
      active = false;
    };
  }, []);

  /** Destek / içerik ve telif bildirimi: posta uygulaması açılamazsa adres panoya kopyalanır. */
  const openSupport = async () => {
    const email = i18n.language === "en" ? SUPPORT_EMAIL.en : SUPPORT_EMAIL.tr;
    try {
      await Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(t("legal.supportMail.subject"))}`);
    } catch {
      await Clipboard.setStringAsync(email).catch(() => {});
      toast.info(t("legal.supportMail.copied", { email }));
    }
  };

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
      {adsPrivacyRequired ? (
        <SettingsRow
          icon={SlidersHorizontal}
          title={t("legal.docs.adsPrivacy.title")}
          subtitle={t("legal.docs.adsPrivacy.sub")}
          onPress={showAdsPrivacyOptions}
          theme={theme}
        />
      ) : null}
      <SettingsRow
        icon={Mail}
        title={t("legal.docs.support.title")}
        subtitle={t("legal.docs.support.sub")}
        onPress={openSupport}
        theme={theme}
      />
    </ModernSection>
  );
}
