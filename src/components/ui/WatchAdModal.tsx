import { useEffect, useEffectEvent, useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, TurboModuleRegistry, Platform } from "react-native";
import { appAlert } from "@/lib/dialog";
import { DialogHost } from "@/components/ui/DialogHost";
import { X, PlayCircle, Coins } from "lucide-react-native";
import Constants from "expo-constants";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/context/ThemeContext";
import { logger } from "@/utils/logger";
import { toast } from "@/lib/toast";
import { useTranslation } from "react-i18next";
import { resolveAdUnitId, useAdsReady } from "@/lib/adsConsent";

const isExpoGo = Constants.appOwnership === 'expo';
const hasAdsModule = typeof TurboModuleRegistry?.get === 'function' && !!TurboModuleRegistry.get('RNGoogleMobileAdsModule');

let useRewardedAdReal: any = null;
let TestIds: any = null;

if (hasAdsModule && !isExpoGo) {
  try {
    const ads = require("react-native-google-mobile-ads");
    useRewardedAdReal = ads.useRewardedAd;
    TestIds = ads.TestIds;
  } catch {
    useRewardedAdReal = null;
  }
}

// Üretimde birim kimliği tanımlı değilse ödüllü reklam yüklenmez (test reklamına düşülmez)
const productionRewardedId = Platform.select({
  ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID_IOS || process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID,
  android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID_ANDROID || process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID,
  default: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID,
});

const adUnitId = resolveAdUnitId(productionRewardedId, TestIds?.REWARDED);

// Mock hook for Expo Go where native ads binary is absent
function useRewardedAdMock() {
  return {
    isLoaded: false,
    isClosed: false,
    load: () => {},
    show: () => {},
    error: null,
    isEarnedReward: false,
  };
}

const useRewardedAd = useRewardedAdReal && adUnitId ? useRewardedAdReal : useRewardedAdMock;

interface WatchAdModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function WatchAdModal({ visible, onClose, onSuccess }: WatchAdModalProps) {
  const { t } = useTranslation();
  const { refreshProfile } = useAuth();
  // useTheme: seçili açık/koyu modu da yakalar
  const { theme, isLight } = useTheme();
  const [rewarding, setRewarding] = useState(false);
  const adsReady = useAdsReady();

  const { isLoaded, isClosed, load, show, error, isEarnedReward } = useRewardedAd(adUnitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  useEffect(() => {
    if (visible && adsReady && !isLoaded) {
      load();
    }
  }, [visible, adsReady, isLoaded, load]);

  useEffect(() => {
    if (error) {
      logger.error("Ad error:", error);
      appAlert(t("common.error"), t("ads.loadFailed"));
    }
  }, [error, t]);

  // Yalnızca reklam kapandığında effect'ten çağrılır; güncel refreshProfile / onSuccess'i görür.
  // Durum güncellemeleri istek zincirinin içinde yapılır (effect gövdesinde senkron değil).
  const handleEarnReward = useEffectEvent(() => {
    void Promise.resolve()
      .then(async () => {
        setRewarding(true);
        const { error } = await supabase.rpc("earn_tokens", {
          p_reason: "ad_reward"
        });

        if (error) throw error;

        await refreshProfile();
        // Reklam modalı onSuccess ile kapanır → pil kapanışı bekleyip modalın önünde görünsün
        toast.success(t("ads.earned"), { title: t("common.congratulations"), emoji: "🪙", delay: 350 });
        onSuccess();
      })
      .catch((error: any) => {
        logger.error("Earn token error:", error);
        appAlert(t("common.error"), t("ads.addFailed"));
      })
      .finally(() => {
        setRewarding(false);
      });
  });

  useEffect(() => {
    if (isClosed) {
      if (isEarnedReward) {
        handleEarnReward();
      } else {
        // If they closed before finishing, we just reload for next time
        load();
      }
    }
  }, [isClosed, isEarnedReward, load]);

  const showAd = () => {
    if (isLoaded) {
      show();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalBox, { backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.cardBorder }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.close")} onPress={onClose} style={styles.closeBtn}>
            <X color={theme.textSecondary} size={20} />
          </TouchableOpacity>

          <View style={[styles.iconBox, { backgroundColor: "rgba(255, 215, 0, 0.1)" }]}>
            <Coins color={isLight ? "#B7791F" : "#FFD700"} size={32} />
          </View>
          
          <Text style={[styles.title, { color: theme.text }]}>{t("ads.title")}</Text>
          <Text style={[styles.desc, { color: theme.textSecondary }]}>
            {t("ads.description")}
          </Text>

          <TouchableOpacity 
            style={[
              styles.actionBtn, 
              { backgroundColor: theme.accent },
              (!isLoaded || rewarding) && { opacity: 0.6 }
            ]} 
            onPress={showAd}
            disabled={!isLoaded || rewarding}
          >
            {rewarding ? (
              <ActivityIndicator color="#fff" />
            ) : !isLoaded ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.actionBtnText}>{t("common.loading")}</Text>
              </>
            ) : (
              <>
                <PlayCircle color="#fff" size={20} />
                <Text style={styles.actionBtnText}>{t("ads.watch")}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {/* Bu modal açıkken uyarılar/diyaloglar (kök katman modalın arkasında kalır) burada çizilir */}
      <DialogHost embedded visible={visible} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    width: "100%",
    padding: 24,
    borderRadius: 24,
    alignItems: "center",
    position: "relative",
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 10,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 16,
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
