import { useEffect, useState } from 'react';
import { TurboModuleRegistry } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '@/context/AuthContext';
import { logger } from '@/utils/logger';
import { resolveAdUnitId, useAdsReady } from '@/lib/adsConsent'; // 2 minutes cooldown between interstitial ads

import { setAdLoggingOut, getIsAdLoggingOut } from '../utils/adFlags';

const isExpoGo = Constants.appOwnership === 'expo';
const hasAdsModule = typeof TurboModuleRegistry?.get === 'function' && !!TurboModuleRegistry.get('RNGoogleMobileAdsModule');

let InterstitialAd: any = null;
let AdEventType: any = null;
let TestIds: any = null;
let interstitial: any = null;

if (hasAdsModule && !isExpoGo) {
  try {
    const ads = require('react-native-google-mobile-ads');
    InterstitialAd = ads.InterstitialAd;
    AdEventType = ads.AdEventType;
    TestIds = ads.TestIds;

    // Üretimde birim kimliği tanımlı değilse reklam hiç oluşturulmaz (test reklamına düşülmez)
    const adUnitId = resolveAdUnitId(process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID, TestIds?.INTERSTITIAL);
    if (adUnitId) {
      interstitial = InterstitialAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });
    }
  } catch {
    interstitial = null;
  }
}

// A simple global state to track the last time an ad was shown to prevent spamming the user
let lastAdShowTime = 0;
const AD_COOLDOWN_MS = 60 * 1000 * 2;
export { setAdLoggingOut, getIsAdLoggingOut };

export function useInterstitialAd() {
  const { session, profile, isLoading } = useAuth();
  const isPremium = profile?.isPremium === true;
  const adsReady = useAdsReady();

  const [adLoaded, setLoaded] = useState(false);
  // Uygunluk bitince (premium, çıkış, oturum yok, rıza alınmadı) reklam hazır sayılmaz
  const canShowAds = adsReady && !!session && !isLoading && !!profile && !isPremium;
  const loaded = adLoaded && canShowAds;

  useEffect(() => {
    if (isExpoGo || !interstitial) return;
    // If logging out, unauthenticated, loading, or premium: never load ads
    if (!adsReady || getIsAdLoggingOut() || !session || isLoading || !profile || isPremium) {
      return;
    }

    let unsubscribeLoaded: () => void;
    let unsubscribeClosed: () => void;
    let unsubscribeError: () => void;

    const loadAd = () => {
      try {
        if (getIsAdLoggingOut() || !session || isPremium) return;
        if (!interstitial.loaded) {
          setLoaded(false);
          interstitial.load();
        } else {
          setLoaded(true);
        }
      } catch (err) {
        logger.error("Error loading interstitial:", err);
      }
    };

    unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      if (!getIsAdLoggingOut() && session && !isPremium) {
        setLoaded(true);
      }
    });

    unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setLoaded(false);
      lastAdShowTime = Date.now();
      // Preload next ad only if user is still logged in and not premium
      if (!getIsAdLoggingOut() && session && !isPremium) {
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
  }, [adsReady, session, isLoading, profile, isPremium]);

  const showAdIfReady = () => {
    // If user is logging out, unauthenticated, profile is loading, or user is premium: NEVER show ad
    if (!adsReady || getIsAdLoggingOut() || !session || isLoading || !profile || isPremium) {
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
