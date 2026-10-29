import React from 'react';
import { View, StyleSheet, TurboModuleRegistry } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '@/context/AuthContext';
import { logger } from '@/utils/logger';

const isExpoGo = Constants.appOwnership === 'expo';
const hasAdsModule = typeof TurboModuleRegistry?.get === 'function' && !!TurboModuleRegistry.get('RNGoogleMobileAdsModule');

let GoogleBannerAd: any = null;
let BannerAdSize: any = null;
let TestIds: any = null;

if (hasAdsModule && !isExpoGo) {
  try {
    const ads = require('react-native-google-mobile-ads');
    GoogleBannerAd = ads.BannerAd;
    BannerAdSize = ads.BannerAdSize;
    TestIds = ads.TestIds;
  } catch {
    GoogleBannerAd = null;
  }
}

const adUnitId = __DEV__ ? (TestIds?.BANNER || "") : (process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || TestIds?.BANNER || "");

export function BannerAd() {
  const { profile, session, isLoading } = useAuth();
  
  // Expo Go veya native reklam modülü yoksa reklam render etme
  if (isExpoGo || !hasAdsModule || !GoogleBannerAd) {
    return null;
  }

  // Premium users, unauthenticated users, or loading states do not see banners
  if (!session || isLoading || !profile || profile?.isPremium) {
    return null;
  }

  return (
    <View style={styles.container}>
      <GoogleBannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error: any) => {
          logger.error("Banner Ad Failed to load: ", error);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 4,
  }
});
