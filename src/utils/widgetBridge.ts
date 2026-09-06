import { NativeModules, Platform } from "react-native";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { logger } from "@/utils/logger";

export interface CoupleWidgetData {
  partnerName: string;
  daysTogether: number;
  moodEmoji: string;
  moodLabel: string;
  dailyNote?: string | null;
  nextMeetingTitle?: string | null;
  nextMeetingDays?: number | null;
  loveScore?: number | null;
  updatedAt?: string;
}

const WIDGET_STORAGE_KEY = "@couple_widget_data";

/**
 * Ana ekran widget'ına gönderilecek verileri senkronize eder.
 * Android üzerinde yerel AppWidget'ı günceller, iOS ve Web'de güvenle fallback yapar.
 */
export async function syncCoupleWidget(data: CoupleWidgetData): Promise<boolean> {
  try {
    const payload = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    const jsonStr = JSON.stringify(payload);

    // Her zaman yerel depolamaya kaydet
    await AsyncStorage.setItem(WIDGET_STORAGE_KEY, jsonStr);

    // Android Native Modülü kontrol et ve çalıştır
    if (Platform.OS === "android") {
      const { CoupleWidgetModule } = NativeModules;
      if (CoupleWidgetModule && typeof CoupleWidgetModule.updateWidget === "function") {
        await CoupleWidgetModule.updateWidget(jsonStr);
        logger.log("[WidgetBridge] Android widget successfully refreshed.");
        return true;
      } else {
        logger.log("[WidgetBridge] CoupleWidgetModule not linked or running in managed Expo Go.");
      }
    }

    // iOS WidgetKit (expo-widgets) kontrol et ve çalıştır
    if (Platform.OS === "ios") {
      try {
        const { coupleWidget } = require("../../widgets/CoupleWidget");
        if (coupleWidget && typeof coupleWidget.updateSnapshot === "function") {
          coupleWidget.updateSnapshot({
            partnerName: data.partnerName,
            daysTogether: data.daysTogether,
            moodEmoji: data.moodEmoji,
            moodLabel: data.moodLabel,
            dailyNote: data.dailyNote || undefined,
            nextMeetingTitle: data.nextMeetingTitle || undefined,
            nextMeetingDays: data.nextMeetingDays ?? undefined,
          });
          logger.log("[WidgetBridge] iOS widget snapshot updated successfully.");
        }
      } catch (iosErr) {
        logger.log("[WidgetBridge] iOS widget snapshot error (or running in Expo Go):", iosErr);
      }
    }

    return true;
  } catch (error) {
    logger.error("[WidgetBridge] Error updating widget:", error);
    return false;
  }
}

/**
 * En son kaydedilmiş widget verilerini okur.
 */
export async function getStoredWidgetData(): Promise<CoupleWidgetData | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (error) {
    logger.error("[WidgetBridge] Error reading widget data:", error);
  }
  return null;
}
