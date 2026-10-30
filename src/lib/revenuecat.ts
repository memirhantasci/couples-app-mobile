import Purchases, { PurchasesPackage, LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';
import { logger } from '@/utils/logger';

// RevenueCat genel (public) API anahtarları EAS ortam değişkenlerinden gelir (bkz. .env.example)
const API_KEYS = {
  apple: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || "appl_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  google: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || "goog_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
};

/**
 * Premium durumu yalnızca sunucuda yazılır: RevenueCat webhook'u (supabase/functions/revenuecat-webhook)
 * çiftin Premium'unu günceller. İstemci durumu sunucuya bildirmez; yalnızca profili yeniler.
 */
export class RevenueCatService {
  static isInitialized = false;
  private static initPromise: Promise<void> | null = null;

  /**
   * Tek seferlik başlatma. AuthContext açılışta JS iş parçacığını yormamak için 2 sn gecikmeyle
   * çağırıyor; bu sürede açılan paywall ya da girişte çağrılan logIn sessizce boş dönmesin diye her
   * genel metot önce bunu bekler. configure iki kez çalışmaz.
   */
  static initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.configure().then(() => {
        // Başarısız başlatma kalıcı sayılmaz; sonraki çağrı yeniden dener
        if (!this.isInitialized) this.initPromise = null;
      });
    }
    return this.initPromise;
  }

  private static async configure() {
    try {
      if (API_KEYS.apple.includes("xxxx") || API_KEYS.google.includes("xxxx")) {
        logger.warn("RevenueCat API keys are not configured. Skipping initialization.");
        return;
      }

      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);

      if (Platform.OS === 'ios') {
        Purchases.configure({ apiKey: API_KEYS.apple });
      } else if (Platform.OS === 'android') {
        Purchases.configure({ apiKey: API_KEYS.google });
      }
      this.isInitialized = true;
    } catch (e) {
      logger.error("Error initializing RevenueCat", e);
    }
  }

  static async logIn(userId: string) {
    await this.initialize();
    if (!this.isInitialized) return null;
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      return customerInfo;
    } catch (e) {
      logger.error("Error logging in RevenueCat", e);
      return null;
    }
  }

  static async logOut() {
    if (!this.isInitialized) return;
    try {
      await Purchases.logOut();
    } catch (e) {
      logger.error("Error logging out RevenueCat", e);
    }
  }

  static async presentCodeRedemptionSheet() {
    await this.initialize();
    if (!this.isInitialized) return;
    if (Platform.OS === 'ios') {
      try {
        await Purchases.presentCodeRedemptionSheet();
      } catch (e) {
        logger.error("Error presenting code redemption sheet", e);
      }
    }
  }

  static async getOfferings() {
    await this.initialize();
    if (!this.isInitialized) return [];
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null) {
        return offerings.current.availablePackages;
      }
      return [];
    } catch (e) {
      logger.error("Error getting offerings", e);
      return [];
    }
  }

  static async purchasePackage(rcPackage: PurchasesPackage) {
    await this.initialize();
    if (!this.isInitialized) return null;
    try {
      const { customerInfo } = await Purchases.purchasePackage(rcPackage);
      return customerInfo;
    } catch (e: any) {
      if (!e.userCancelled) {
        logger.error("Error purchasing package", e);
        throw e;
      }
      return null;
    }
  }

  static async restorePurchases() {
    await this.initialize();
    if (!this.isInitialized) return null;
    try {
      const customerInfo = await Purchases.restorePurchases();
      return customerInfo;
    } catch (e) {
      logger.error("Error restoring purchases", e);
      throw e;
    }
  }

  static async getCustomerInfo() {
    await this.initialize();
    if (!this.isInitialized) return null;
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (e) {
      logger.error("Error getting customer info", e);
      return null;
    }
  }
}
