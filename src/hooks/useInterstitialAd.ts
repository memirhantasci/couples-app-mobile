import { useEffect, useState } from 'react';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { useAuth } from '@/context/AuthContext';
import { logger } from '@/utils/logger';

// Use Test ID in development, real ID in production
const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : "ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy";

// Create instance outside to reuse
const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
  requestNonPersonalizedAdsOnly: true,
});

// A simple global state to track the last time an ad was shown to prevent spamming the user
let lastAdShowTime = 0;
const AD_COOLDOWN_MS = 60 * 1000 * 2; // 2 minutes cooldown between interstitial ads

export function useInterstitialAd() {
  const { profile } = useAuth();
  const isPremium = profile?.isPremium ?? false;
  
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Premium users never load or see ads
    if (isPremium) return;

    let unsubscribeLoaded: () => void;
    let unsubscribeClosed: () => void;
    let unsubscribeError: () => void;

    const loadAd = () => {
      try {
        if (!interstitial.loaded) {
          interstitial.load();
        } else {
          setLoaded(true);
        }
      } catch (err) {
        logger.error("Error loading interstitial:", err);
      }
    };

    unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      setLoaded(true);
    });

    unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setLoaded(false);
      lastAdShowTime = Date.now();
      // Preload next ad
      loadAd();
    });

    // @ts-ignore
    unsubscribeError = interstitial.addAdEventListener('error', (error) => {
      logger.error("Interstitial Ad Error:", error);
      setLoaded(false);
      // Wait a bit before trying to load again on error
      setTimeout(() => {
        loadAd();
      }, 10000);
    });

    loadAd();

    return () => {
      if (unsubscribeLoaded) unsubscribeLoaded();
      if (unsubscribeClosed) unsubscribeClosed();
      if (unsubscribeError) unsubscribeError();
    };
  }, [isPremium]);

  const showAdIfReady = () => {
    if (isPremium) return false; // Premium users bypass

    const now = Date.now();
    if (loaded && (now - lastAdShowTime > AD_COOLDOWN_MS)) {
      try {
        interstitial.show();
        lastAdShowTime = now;
        return true;
      } catch (err) {
        logger.error("Error showing interstitial:", err);
        return false;
      }
    }
    return false;
  };

  return {
    loaded,
    showAdIfReady
  };
}
