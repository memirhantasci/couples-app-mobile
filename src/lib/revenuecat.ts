import Purchases, { PurchasesPackage, LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';
import { logger } from '@/utils/logger';

// RevenueCat genel (public) API anahtarları EAS ortam değişkenlerinden gelir (bkz. .env.example)
const API_KEYS = {
  apple: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_KEY || "appl_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  google: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY || "goog_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
};

/** Bu hesabın mağaza aboneliğinden okunan Premium ayrıntıları. */
export interface PremiumEntitlement {
  /** Mevcut dönemin bitişi (ISO); süresiz hak için null */
  expirationDate: string | null;
  /** false: kullanıcı iptal etti, dönem sonunda bitecek */
  willRenew: boolean;
  isTrial: boolean;
  /** "PLAY_STORE" | "APP_STORE" | "PROMOTIONAL" ... */
  store: string;
  productIdentifier: string;
  hasBillingIssue: boolean;
  /** Mağazanın abonelik yönetim sayfası (RevenueCat verir); yoksa null */
  managementUrl: string | null;
}

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
      // Yalnızca ÇALIŞILAN platformun anahtarı gerekir. Eskiden iki anahtar da tanımlı olmalıydı: iOS
      // anahtarı henüz yokken Android derlemesinde de başlatma atlanıyor, paywall boş kalıyordu.
      const apiKey =
        Platform.OS === 'ios' ? API_KEYS.apple : Platform.OS === 'android' ? API_KEYS.google : null;
      if (!apiKey || apiKey.includes("xxxx")) {
        logger.warn(`RevenueCat API key is not configured for ${Platform.OS}. Skipping initialization.`);
        return;
      }

      Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
      Purchases.configure({ apiKey });
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

  /**
   * Mağaza satın almalarını kullanıcıya göstermeden RevenueCat'e iletir (geri yükleme penceresi açmaz).
   * Hesabını silip aynı Apple/Google hesabıyla yeniden kayıt olan kişinin aboneliği böylece yeni hesaba
   * aktarılır; hakkı sunucu doğrular (bkz. src/lib/premiumContinuity.ts).
   */
  static async syncPurchases(): Promise<boolean> {
    await this.initialize();
    if (!this.isInitialized) return false;
    try {
      await Purchases.syncPurchases();
      return true;
    } catch (e) {
      logger.warn("Error syncing purchases", e);
      return false;
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

  /**
   * Bu hesabın kendi mağaza aboneliğinin ayrıntıları (Premium ekranı için). Hak başka bir kişiden
   * (partner) ya da promosyondan geliyorsa bu hesabın aktif hakkı yoktur ve null döner.
   */
  static async getPremiumEntitlement(): Promise<PremiumEntitlement | null> {
    const info = await this.getCustomerInfo();
    if (!info) return null;
    const active = info.entitlements.active;
    const entitlement = active["Premium"] ?? active["couples_app_pro"];
    if (!entitlement) return null;
    return {
      expirationDate: entitlement.expirationDate,
      willRenew: entitlement.willRenew,
      isTrial: entitlement.periodType === "TRIAL",
      store: entitlement.store,
      productIdentifier: entitlement.productIdentifier,
      hasBillingIssue: !!entitlement.billingIssueDetectedAt,
      managementUrl: info.managementURL,
    };
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
