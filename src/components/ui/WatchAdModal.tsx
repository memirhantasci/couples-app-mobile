import React, { useEffect, useEffectEvent, useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, TurboModuleRegistry } from "react-native";
import { appAlert } from "@/lib/dialog";
import { DialogHost } from "@/components/ui/DialogHost";
import { X, PlayCircle, Coins } from "lucide-react-native";
import Constants from "expo-constants";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/context/ThemeContext";
import { logger } from "@/utils/logger";
import { toast } from "@/lib/toast";

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

const adUnitId = __DEV__ ? (TestIds?.REWARDED || "") : (process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || TestIds?.REWARDED || "");

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

const useRewardedAd = useRewardedAdReal || useRewardedAdMock;

interface WatchAdModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function WatchAdModal({ visible, onClose, onSuccess }: WatchAdModalProps) {
  const { refreshProfile } = useAuth();
  // useTheme: seçili açık/koyu modu da yakalar
  const { theme, isLight } = useTheme();
  const [rewarding, setRewarding] = useState(false);
  
  const { isLoaded, isClosed, load, show, error, isEarnedReward } = useRewardedAd(adUnitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  useEffect(() => {
    if (visible && !isLoaded) {
      load();
    }
  }, [visible, isLoaded, load]);

  useEffect(() => {
    if (error) {
      logger.error("Ad error:", error);
      appAlert("Hata", "Reklam yüklenirken bir hata oluştu.");
    }
  }, [error]);

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
        toast.success("25 Token kazandın!", { title: "Tebrikler!", emoji: "🪙", delay: 350 });
        onSuccess();
      })
      .catch((error: any) => {
        logger.error("Earn token error:", error);
        appAlert("Hata", "Token eklenirken bir hata oluştu.");
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
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X color={theme.textSecondary} size={20} />
          </TouchableOpacity>

          <View style={[styles.iconBox, { backgroundColor: "rgba(255, 215, 0, 0.1)" }]}>
            <Coins color={isLight ? "#B7791F" : "#FFD700"} size={32} />
          </View>
          
          <Text style={[styles.title, { color: theme.text }]}>Token Kazan</Text>
          <Text style={[styles.desc, { color: theme.textSecondary }]}>
            Kısa bir reklam izleyerek 25 Token kazanabilirsin.
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
                <Text style={styles.actionBtnText}>Yükleniyor...</Text>
              </>
            ) : (
              <>
                <PlayCircle color="#fff" size={20} />
                <Text style={styles.actionBtnText}>Reklamı İzle (+25)</Text>
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
