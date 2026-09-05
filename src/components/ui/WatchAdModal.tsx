import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, Alert, TurboModuleRegistry } from "react-native";
import { X, PlayCircle, Coins } from "lucide-react-native";
import Constants from "expo-constants";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { getTheme } from "@/lib/theme";
import { logger } from "@/utils/logger";

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

const adUnitId = __DEV__ ? (TestIds?.REWARDED || "") : "ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy";

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
  const { profile, refreshProfile } = useAuth();
  const theme = getTheme(profile?.gender);
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
      Alert.alert("Hata", "Reklam yüklenirken bir hata oluştu.");
    }
  }, [error]);

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

  const handleEarnReward = async () => {
    setRewarding(true);
    try {
      const { error } = await supabase.rpc("earn_tokens", {
        p_amount: 25,
        p_reason: "ad_reward"
      });
      
      if (error) throw error;
      
      await refreshProfile();
      Alert.alert("Tebrikler!", "25 Token kazandınız.");
      onSuccess();
    } catch (error: any) {
      logger.error("Earn token error:", error);
      Alert.alert("Hata", "Token eklenirken bir hata oluştu.");
    } finally {
      setRewarding(false);
    }
  };

  const showAd = () => {
    if (isLoaded) {
      show();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modalBox, { backgroundColor: theme.cardBg }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X color="rgba(255,255,255,0.7)" size={20} />
          </TouchableOpacity>

          <View style={[styles.iconBox, { backgroundColor: "rgba(255, 215, 0, 0.1)" }]}>
            <Coins color="#FFD700" size={32} />
          </View>
          
          <Text style={styles.title}>Token Kazan</Text>
          <Text style={styles.desc}>
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
