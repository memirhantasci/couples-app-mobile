import Purchases, { PurchasesPackage, CustomerInfo, LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { logger } from '@/utils/logger';

// TODO: Replace with your actual RevenueCat Public API Keys
const API_KEYS = {
  apple: "appl_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  google: "goog_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
};

export class RevenueCatService {
  static async initialize() {
    try {
      if (API_KEYS.apple.includes("xxxx") || API_KEYS.google.includes("xxxx")) {
        logger.warn("RevenueCat API keys are not configured. Skipping initialization.");
        return;
      }

      Purchases.setLogLevel(LOG_LEVEL.DEBUG);

      if (Platform.OS === 'ios') {
        Purchases.configure({ apiKey: API_KEYS.apple });
      } else if (Platform.OS === 'android') {
        Purchases.configure({ apiKey: API_KEYS.google });
      }
    } catch (e) {
      logger.error("Error initializing RevenueCat", e);
    }
  }

  static async logIn(userId: string) {
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      await this.syncPremiumStatus(customerInfo);
      return customerInfo;
    } catch (e) {
      logger.error("Error logging in RevenueCat", e);
      return null;
    }
  }

  static async logOut() {
    try {
      await Purchases.logOut();
    } catch (e) {
      logger.error("Error logging out RevenueCat", e);
    }
  }

  static async presentCodeRedemptionSheet() {
    if (Platform.OS === 'ios') {
      try {
        await Purchases.presentCodeRedemptionSheet();
      } catch (e) {
        logger.error("Error presenting code redemption sheet", e);
      }
    }
  }

  static async getOfferings() {
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
    try {
      const { customerInfo } = await Purchases.purchasePackage(rcPackage);
      await this.syncPremiumStatus(customerInfo);
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
    try {
      const customerInfo = await Purchases.restorePurchases();
      await this.syncPremiumStatus(customerInfo);
      return customerInfo;
    } catch (e) {
      logger.error("Error restoring purchases", e);
      throw e;
    }
  }

  static async getCustomerInfo() {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (e) {
      logger.error("Error getting customer info", e);
      return null;
    }
  }

  /**
   * Reads the customerInfo from RevenueCat, checks if "Premium" entitlement is active,
   * and updates Supabase `couples.is_premium` accordingly.
   */
  static async syncPremiumStatus(customerInfo: CustomerInfo) {
    try {
      // Assuming you named your entitlement "Premium" in RevenueCat
      const isPremium = typeof customerInfo.entitlements.active['Premium'] !== "undefined";
      const expirationDateStr = isPremium 
        ? customerInfo.entitlements.active['Premium'].expirationDate 
        : null;
      
      const { error } = await supabase.rpc("set_premium_status", {
        p_is_premium: isPremium,
        p_expires_at: expirationDateStr || null
      });

      if (error) {
        logger.error("Error syncing premium status to Supabase", error);
      }
    } catch (e) {
      logger.error("Error processing syncPremiumStatus", e);
    }
  }
}
