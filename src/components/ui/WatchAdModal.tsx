import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { X, PlayCircle, Coins } from "lucide-react-native";
import { RewardedAd, RewardedAdEventType, TestIds } from "react-native-google-mobile-ads";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { getTheme } from "@/lib/theme";
import { logger } from "@/utils/logger";

const adUnitId = __DEV__ ? TestIds.REWARDED : "ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy";

// Create rewarded ad instance outside component to avoid recreation issues
const rewarded = RewardedAd.createForAdRequest(adUnitId, {
  requestNonPersonalizedAdsOnly: true,
});

interface WatchAdModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function WatchAdModal({ visible, onClose, onSuccess }: WatchAdModalProps) {
  const { profile, refetchProfile } = useAuth();
  const theme = getTheme(profile?.gender);
  
  const [loaded, setLoaded] = useState(false);
  const [loadingAd, setLoadingAd] = useState(false);
  const [rewarding, setRewarding] = useState(false);

  useEffect(() => {
    let unsubscribeLoaded: () => void;
    let unsubscribeEarned: () => void;
    let unsubscribeClosed: () => void;
    let unsubscribeError: () => void;

    if (visible) {
      setLoadingAd(true);
      
      // Load ad
      rewarded.load();

      unsubscribeLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        setLoaded(true);
        setLoadingAd(false);
      });

      unsubscribeEarned = rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        async (reward) => {
          console.log("User earned reward of ", reward);
          await handleEarnReward();
        }
      );

      unsubscribeClosed = rewarded.addAdEventListener(RewardedAdEventType.CLOSED, () => {
        setLoaded(false);
        rewarded.load(); // preload next
      });

      // Temporary error handler
      // @ts-ignore
      unsubscribeError = rewarded.addAdEventListener("error", (error: any) => {
        logger.error("Ad error:", error);
        setLoadingAd(false);
        setLoaded(false);
        Alert.alert("Hata", "Reklam yüklenirken bir hata oluştu.");
      });
    }

    return () => {
      if (unsubscribeLoaded) unsubscribeLoaded();
      if (unsubscribeEarned) unsubscribeEarned();
      if (unsubscribeClosed) unsubscribeClosed();
      if (unsubscribeError) unsubscribeError();
    };
  }, [visible]);

  const handleEarnReward = async () => {
    setRewarding(true);
    try {
      const { error } = await supabase.rpc("earn_tokens", {
        p_amount: 50,
        p_reason: "ad_reward"
      });
      
      if (error) throw error;
      
      await refetchProfile();
      Alert.alert("Tebrikler!", "50 Token kazandınız.");
      onSuccess();
    } catch (error: any) {
      logger.error("Earn token error:", error);
      Alert.alert("Hata", "Token eklenirken bir hata oluştu.");
    } finally {
      setRewarding(false);
    }
  };

  const showAd = () => {
    if (loaded) {
      rewarded.show();
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
            Kısa bir reklam izleyerek 50 Token kazanabilirsin.
          </Text>

          <TouchableOpacity 
            style={[
              styles.actionBtn, 
              { backgroundColor: theme.accent },
              (!loaded || rewarding) && { opacity: 0.6 }
            ]} 
            onPress={showAd}
            disabled={!loaded || rewarding}
          >
            {rewarding ? (
              <ActivityIndicator color="#fff" />
            ) : loadingAd && !loaded ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.actionBtnText}>Yükleniyor...</Text>
              </>
            ) : (
              <>
                <PlayCircle color="#fff" size={20} />
                <Text style={styles.actionBtnText}>Reklamı İzle (+50)</Text>
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
