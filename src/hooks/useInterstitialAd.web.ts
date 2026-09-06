import { setAdLoggingOut, getIsAdLoggingOut } from '../utils/adFlags';
export { setAdLoggingOut, getIsAdLoggingOut };

export function useInterstitialAd() {
  return {
    loaded: false,
    showAdIfReady: () => false,
  };
}
