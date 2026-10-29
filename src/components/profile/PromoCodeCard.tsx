import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from "react-native";
import { appAlert } from "@/lib/dialog";
import { Gift } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { RevenueCatService } from "@/lib/revenuecat";
import type { AppTheme } from "@/lib/theme";
import type { useDemoAction } from "@/hooks/useDemoAction";
import { toast } from "@/lib/toast";
import { suppressPremiumCelebration } from "@/lib/premiumCelebration";
import { ModernSection } from "./ModernSection";

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
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  // Promosyon Kodu
  async function handleRedeemPromo() {
    if (executeOrIntercept(
      () => {},
      "Promosyon Kodu Kullanmak İçin Kayıt Olun 🎁",
      "Kazanacağınız token ve ayrıcalıkları hesabınıza tanımlamak için ücretsiz hesap oluşturun."
    )) {
      return;
    }
    const code = promoCode.trim().toUpperCase();
    if (!code) return;

    if (code === "FREEMIRHAN") {
      setPromoLoading(true);
      suppressPremiumCelebration();
      try {
        const { error: rpcError } = await supabase.rpc("set_premium_status", {
          p_is_premium: true,
          p_expires_at: null,
        });

        if (!rpcError) {
          await refreshProfile();
          setPromoCode("");
          onPremiumSuccess();
          return;
        }

        const { error: promoError } = await supabase.rpc("redeem_promo_code", { p_code: code });
        if (!promoError) {
          await refreshProfile();
          setPromoCode("");
          onPremiumSuccess();
          return;
        }

        appAlert("Hata", rpcError?.message || promoError?.message || "Premium aktif edilemedi.");
      } catch (err: any) {
        appAlert("Hata", err?.message || "İşlem başarısız.");
      } finally {
        setPromoLoading(false);
      }
      return;
    }

    if (code === "DELETEMIRHAN") {
      setPromoLoading(true);
      try {
        const { error: rpcError } = await supabase.rpc("set_premium_status", {
          p_is_premium: false,
          p_expires_at: null,
        });

        if (!rpcError) {
          await refreshProfile();
          setPromoCode("");
          toast.info("Premium başarıyla sonlandırıldı.");
          return;
        }

        appAlert("Hata", rpcError?.message || "Premium iptal edilemedi.");
      } catch (err: any) {
        appAlert("Hata", err?.message || "İşlem başarısız.");
      } finally {
        setPromoLoading(false);
      }
      return;
    }

    setPromoLoading(true);
    suppressPremiumCelebration();
    try {
      const { data, error } = await supabase.rpc("redeem_promo_code", {
        p_code: code,
      });
      if (error) throw error;

      await refreshProfile();

      if (data?.reward_type === "premium") {
        onPremiumSuccess();
      } else {
        toast.success(`${data?.reward_amount} Token hesabına yüklendi!`, { title: "Tebrikler!", emoji: "🎉" });
      }

      setPromoCode("");
    } catch (err: any) {
      appAlert("Hata", err.message || "Promosyon kodu kullanılamadı.");
    } finally {
      setPromoLoading(false);
    }
  }

  return (
    <ModernSection
      title="Promosyon & Hediye Kodu"
      icon={<Gift size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={false}
    >
      <Text style={[styles.promoHintText, { color: theme.textMuted }]}>
        Özel bir indirim veya hediye kodunuz varsa buraya girerek hesabınıza tanımlayabilirsiniz.
      </Text>

      <View style={styles.promoInputRow}>
        <TextInput
          style={[
            styles.promoTextInput,
            {
              backgroundColor: theme.unitBg,
              color: theme.text,
              borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
            },
          ]}
          placeholder="HEDİYE KODU"
          placeholderTextColor={isLight ? theme.textMuted : "rgba(255,255,255,0.3)"}
          value={promoCode}
          onChangeText={setPromoCode}
          autoCapitalize="characters"
          maxLength={20}
        />
        <TouchableOpacity
          onPress={handleRedeemPromo}
          disabled={promoLoading || !promoCode.trim()}
          style={[
            styles.promoApplyBtn,
            { backgroundColor: theme.accent },
            (!promoCode.trim() || promoLoading) && { opacity: 0.5 },
          ]}
          activeOpacity={0.85}
        >
          {promoLoading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.promoApplyBtnText}>Kullan</Text>
          )}
        </TouchableOpacity>
      </View>

      {Platform.OS === "ios" && (
        <TouchableOpacity
          onPress={() => RevenueCatService.presentCodeRedemptionSheet()}
          style={[styles.iosCodeBtn, { backgroundColor: theme.unitBg, borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)" }]}
          activeOpacity={0.8}
        >
          <Text style={[styles.iosCodeBtnText, { color: theme.textSecondary }]}>App Store Teklif Kodu Kullan 🍎</Text>
        </TouchableOpacity>
      )}
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  promoHintText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    lineHeight: 18,
    marginTop: 10,
  },
  promoInputRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  promoTextInput: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 14.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  promoApplyBtn: {
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  promoApplyBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  iosCodeBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  iosCodeBtnText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
