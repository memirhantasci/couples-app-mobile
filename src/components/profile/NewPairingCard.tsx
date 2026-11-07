import { useState } from "react";
import { ActivityIndicator, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Copy, HeartHandshake, KeyRound, Share2 } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import type { AppTheme } from "@/lib/theme";

/** Kodu sunucudan okur (partner silinince yenilenmiş kod; yoksa sunucu üretir) */
async function fetchMyPairingCode(): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_or_create_my_couple");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.result_pairing_code ?? null;
}

/**
 * Ayarlar'ın en üstünde, partneri hesabını silen (tek kalan) kullanıcıya görünür: yenilenen eşleşme kodunu
 * gösterir / paylaştırır ve kod girme akışına (eşleşme ekranı) götürür. Yeni kişi bu kodla katılınca mevcut
 * eşleşme akışı çalışır (docs/HESAP_SILME_VE_PREMIUM_TASARIMI.md madde 3).
 */
export function NewPairingCard({ theme, userId }: { theme: AppTheme; userId: string | undefined }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const { data: code, isLoading } = useQuery({
    queryKey: ["new-pairing-code", userId],
    queryFn: fetchMyPairingCode,
    enabled: !!userId,
    staleTime: 60_000,
  });

  async function handleShare() {
    if (!code) return;
    const inviteLink = `couplesapp://invite?code=${code}`;
    const message = [
      t("setup.pairing.share.greeting"),
      "",
      t("setup.pairing.share.codeLabel"),
      code,
      "",
      t("setup.pairing.share.howTitle"),
      t("setup.pairing.share.step1"),
      t("setup.pairing.share.step2"),
      t("setup.pairing.share.step3"),
      inviteLink,
      "",
      t("setup.pairing.share.closing"),
    ].join("\n");
    try {
      await Share.share({ title: t("setup.pairing.share.title"), message, url: inviteLink });
    } catch {
      // Paylaşım penceresi açılamadı: kod ekranda, kopyalanabilir
    }
  }

  async function handleCopy() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.accent }, theme.cardShadow]}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: theme.pillAccentBg }]}>
          <HeartHandshake size={22} color={theme.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>{t("solo.newPairing.title")}</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>{t("solo.newPairing.body")}</Text>
        </View>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t("setup.pairing.copyCode")}
        onPress={handleCopy}
        activeOpacity={0.85}
        style={[styles.codeBox, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
      >
        <Text style={[styles.codeLabel, { color: theme.textMuted }]}>{t("solo.newPairing.yourCode")}</Text>
        {isLoading ? (
          <ActivityIndicator color={theme.accent} />
        ) : (
          <Text style={[styles.code, { color: theme.text }]}>{code ?? "—"}</Text>
        )}
        <View style={styles.copyRow}>
          {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} color={theme.textMuted} />}
          <Text style={[styles.copyText, { color: copied ? "#10B981" : theme.textMuted }]}>
            {copied ? t("common.copied") : t("setup.pairing.tapToCopy")}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={handleShare}
          disabled={!code}
          activeOpacity={0.85}
          style={[styles.primary, { backgroundColor: theme.accent, opacity: code ? 1 : 0.5 }]}
        >
          <Share2 size={16} color="#FFFFFF" />
          <Text style={styles.primaryText}>{t("solo.newPairing.share")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.push("/(setup)/pairing")}
          activeOpacity={0.85}
          style={[styles.secondary, { borderColor: theme.accent }]}
        >
          <KeyRound size={16} color={theme.accent} />
          <Text style={[styles.secondaryText, { color: theme.accent }]}>{t("solo.newPairing.enterCode")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1.5, padding: 18, gap: 14 },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 4 },
  body: { fontSize: 13.5, lineHeight: 20, fontFamily: "Inter_400Regular" },
  codeBox: { borderRadius: 18, borderWidth: 1, paddingVertical: 14, alignItems: "center", gap: 6 },
  codeLabel: { fontSize: 11.5, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  code: { fontSize: 30, fontFamily: "Inter_700Bold", letterSpacing: 7 },
  copyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  copyText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  actions: { flexDirection: "row", gap: 10 },
  primary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 13,
  },
  primaryText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_700Bold" },
  secondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 12,
  },
  secondaryText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
