import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { logger } from "@/utils/logger";
import dayjs from "dayjs";

/**
 * Saves or updates a push token in Supabase for the given user.
 * Uses upsert on (user_id, platform) to prevent duplicates.
 */
async function savePushToken(userId: string, token: string): Promise<void> {
  const platform = Platform.OS === "ios" ? "ios" : "android";

  await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
      token,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );
}

/**
 * Registers the device for push notifications.
 *
 * Flow:
 * 1. Check it's a real device (not simulator/emulator)
 * 2. Request permission (iOS asks, Android 13+ asks via expo-notifications)
 * 3. Get Expo Push Token
 * 4. Save to Supabase push_tokens table
 *
 * Does NOT throw on failure — push notification registration is NEVER
 * a blocking gate per Apple Guideline 4.5.4.
 */
export async function registerForPushNotifications(
  userId: string
): Promise<void> {
  // Only real devices can get push tokens
  if (!Device.isDevice) {
    logger.log("[Push] Skipping — not a real device.");
    return;
  }

  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      logger.log("[Push] Permission denied by user.");
      return;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn("[Push] No EAS projectId found.");
      return;
    }

    // Expo Go on Android uses host.exp.exponent as package name
    // We must pass the applicationId explicitly so it uses Expo's own Firebase project
    const applicationId =
      Platform.OS === "android"
        ? Application.applicationId
        : undefined;

    const isExpoGo = applicationId === "host.exp.exponent";

    const tokenOptions: any = { projectId };
    // For Expo Go, do NOT pass applicationId — let Expo handle it internally
    if (!isExpoGo && applicationId) {
      tokenOptions.applicationId = applicationId;
    }

    const { data: tokenData } = await Notifications.getExpoPushTokenAsync(tokenOptions);

    if (tokenData) {
      await savePushToken(userId, tokenData);
      logger.log("[Push] Token registered:", tokenData);
    }
  } catch (err) {
    logger.log("[Push] Registration failed silently:", err);
  }
}

// Android channel setup (required for notifications to appear on Android)
export function configureAndroidNotificationChannel() {
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync("default", {
      name: "Genel Bildirimler",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#E8002D",
    });
  }
}

export async function sendPushNotification(userId: string, title: string, body: string, data?: any) {
  try {
    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId);

    if (!tokens || tokens.length === 0) return;

    for (const t of tokens) {
      const message = {
        to: t.token,
        sound: "default",
        title,
        body,
        data: data || {},
      };

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
    }
  } catch (error) {
    logger.log("[Push] Error sending push:", error);
  }
}

/**
 * Sunucuyu yormadan, yerel cihaz üzerinde günlük tekrarlanan bir bildirim kurar.
 * Özellikle ilaç hatırlatıcıları için kullanılır.
 */
export async function scheduleDailyLocalNotification(id: string, title: string, body: string, hour: number, minute: number) {
  try {
    // Önce aynı ID'ye sahip eski bildirimi temizle
    await cancelLocalNotification(id);
    
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body,
        sound: true,
      },
      trigger: {
        hour,
        minute,
        repeats: true,
      } as any,
    });
    logger.log(`[LocalPush] Scheduled daily notification ${id} at ${hour}:${minute}`);
  } catch (error) {
    logger.error("[LocalPush] Failed to schedule daily notification:", error);
  }
}

/**
 * Belirli bir gelecekteki tarihte çalışacak yerel bildirim kurar.
 * Regl yaklaşma hatırlatıcıları için kullanılır (Sunucu yormaz).
 */
export async function scheduleDateLocalNotification(id: string, title: string, body: string, triggerDate: Date) {
  try {
    await cancelLocalNotification(id);
    
    // Geçmiş bir tarihse kurma
    if (triggerDate.getTime() <= Date.now()) return;

    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body,
        sound: true,
      },
      trigger: triggerDate as any,
    });
    logger.log(`[LocalPush] Scheduled date notification ${id} for ${triggerDate.toISOString()}`);
  } catch (error) {
    logger.error("[LocalPush] Failed to schedule date notification:", error);
  }
}

/**
 * ID'si verilen yerel bildirimi iptal eder.
 */
export async function cancelLocalNotification(id: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (error) {
    // Sessizce yut, henüz kurulmamış olabilir
  }
}

/**
 * Mevcut kullanıcının partnerine bildirim gönderir.
 * Performans: İlgili partner ID'sini tek bir optimize sorguyla bulur.
 */
export async function notifyPartner(coupleId: number, currentUserId: string, title: string, body: string, data?: any) {
  try {
    const { data: partnerData } = await supabase
      .from("users")
      .select("id")
      .eq("couple_id", coupleId)
      .neq("id", currentUserId)
      .maybeSingle();

    if (partnerData?.id) {
      await sendPushNotification(partnerData.id, title, body, data);
    }
  } catch (error) {
    logger.error("[Push] Failed to notify partner:", error);
  }
}
