import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";

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
    console.log("[Push] Skipping — not a real device.");
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
      console.log("[Push] Permission denied by user.");
      return; // Non-blocking — user said no, that's fine
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn(
        "[Push] No EAS projectId found in app.json. Push token cannot be fetched."
      );
      return;
    }

    const { data: tokenData } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    if (tokenData) {
      await savePushToken(userId, tokenData);
    }
  } catch (err) {
    // Never crash the app — just log
    console.log("[Push] Registration failed silently:", err);
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
