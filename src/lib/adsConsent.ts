import { useSyncExternalStore } from "react";
import { TurboModuleRegistry } from "react-native";
import Constants from "expo-constants";
import { logger } from "@/utils/logger";

const isExpoGo = Constants.appOwnership === "expo";

/** Yerel reklam modülü Expo Go'da bulunmadığından yalnızca gerektiğinde ve korumalı biçimde yüklenir. */
function loadAdsSdk() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("react-native-google-mobile-ads");
}
const hasAdsModule = typeof TurboModuleRegistry?.get === "function" && !!TurboModuleRegistry.get("RNGoogleMobileAdsModule");

let ready = false;
let started = false;
const listeners = new Set<() => void>();

function setReady(value: boolean) {
  if (ready === value) return;
  ready = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reklam istekleri yalnızca rıza alındıktan ve reklam SDK'sı başlatıldıktan sonra yapılır. */
export function useAdsReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => false);
}

/**
 * Üretimde yalnızca tanımlı gerçek reklam birimi kullanılır; kimlik yoksa "" döner ve reklam hiç gösterilmez
 * (eskiden Google test reklamına düşüyor, gelir getirmeden test reklamı yayınlıyordu). Geliştirmede test birimi.
 */
export function resolveAdUnitId(productionId: string | undefined, testId: string | undefined): string {
  return __DEV__ ? testId ?? "" : productionId ?? "";
}

/**
 * AB / Birleşik Krallık gibi bölgelerde UMP, kullanıcıya verdiği rızayı sonradan değiştirebileceği bir
 * "gizlilik seçenekleri" girişi sunmayı şart koşar. Gerekliyse true döner (yalnızca SDK başlatıldıktan sonra anlamlıdır).
 */
export async function isAdsPrivacyOptionsRequired(): Promise<boolean> {
  if (!hasAdsModule || isExpoGo) return false;
  try {
    const { AdsConsent, AdsConsentPrivacyOptionsRequirementStatus } = loadAdsSdk();
    const info = await AdsConsent.getConsentInfo();
    return info?.privacyOptionsRequirementStatus === AdsConsentPrivacyOptionsRequirementStatus.REQUIRED;
  } catch (err) {
    logger.warn("[Ads] Gizlilik seçenekleri durumu okunamadı:", err);
    return false;
  }
}

/** Google'ın gizlilik seçenekleri formunu açar; kullanıcı rızasını değiştirebilir ya da geri çekebilir. */
export async function showAdsPrivacyOptions(): Promise<void> {
  if (!hasAdsModule || isExpoGo) return;
  try {
    const { AdsConsent } = loadAdsSdk();
    await AdsConsent.showPrivacyOptionsForm();
  } catch (err) {
    logger.warn("[Ads] Gizlilik seçenekleri formu açılamadı:", err);
  }
}

/**
 * Google UMP rıza formu (AB/UK/TR için gerekli) → reklam içerik sınırı → SDK başlatma.
 * Form yalnızca AdMob panelinde bir "Gizlilik ve mesajlaşma" mesajı yayınlandıysa gösterilir.
 */
export async function initializeAds(): Promise<void> {
  if (started || !hasAdsModule || isExpoGo) return;
  started = true;
  try {
    const { default: mobileAds, AdsConsent, MaxAdContentRating } = loadAdsSdk();

    let canRequestAds = false;
    try {
      await AdsConsent.requestInfoUpdate();
      const info = await AdsConsent.loadAndShowConsentFormIfRequired();
      canRequestAds = info.canRequestAds;
    } catch (err) {
      // Rıza servisine ulaşılamadı (ör. çevrimdışı): daha önce alınmış rıza bilgisi varsa o kullanılır
      logger.warn("[Ads] Rıza bilgisi güncellenemedi:", err);
      const info = await AdsConsent.getConsentInfo().catch(() => null);
      canRequestAds = !!info?.canRequestAds;
    }
    if (!canRequestAds) return;

    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await mobileAds().initialize();
    setReady(true);
  } catch (err) {
    started = false;
    logger.warn("[Ads] Başlatılamadı:", err);
  }
}
