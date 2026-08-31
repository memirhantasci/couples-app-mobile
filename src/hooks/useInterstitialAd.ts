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

// Global flag to suppress ads during and immediately after sign out
let isLoggingOut = false;

export function setAdLoggingOut(value: boolean) {
  isLoggingOut = value;
}

export function useInterstitialAd() {
  const { session, profile, isLoading } = useAuth();
  const isPremium = profile?.isPremium === true;
  
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // If logging out, unauthenticated, loading, or premium: never load ads
    if (isLoggingOut || !session || isLoading || !profile || isPremium) {
      setLoaded(false);
      return;
    }

    let unsubscribeLoaded: () => void;
    let unsubscribeClosed: () => void;
    let unsubscribeError: () => void;

    const loadAd = () => {
      try {
        if (isLoggingOut || !session || isPremium) return;
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
      if (!isLoggingOut && session && !isPremium) {
        setLoaded(true);
      }
    });

    unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setLoaded(false);
      lastAdShowTime = Date.now();
      // Preload next ad only if user is still logged in and not premium
      if (!isLoggingOut && session && !isPremium) {
        loadAd();
      }
    });

    // @ts-ignore
    unsubscribeError = interstitial.addAdEventListener('error', (error) => {
      logger.error("Interstitial Ad Error:", error);
      setLoaded(false);
    });

    loadAd();

    return () => {
      if (unsubscribeLoaded) unsubscribeLoaded();
      if (unsubscribeClosed) unsubscribeClosed();
      if (unsubscribeError) unsubscribeError();
    };
  }, [session, isLoading, profile, isPremium]);

  const showAdIfReady = () => {
    // If user is logging out, unauthenticated, profile is loading, or user is premium: NEVER show ad
    if (isLoggingOut || !session || isLoading || !profile || isPremium) {
      return false;
    }

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
