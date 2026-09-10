import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { logger } from "@/utils/logger";
import { decrypt, deterministicDecrypt } from "@/utils/crypto";
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
  userId: string,
  requestPermission: boolean = false
): Promise<boolean> {
  // Never register for demo guest user
  if (!userId || userId === "demo-guest-user-id") {
    return false;
  }

  // Only real devices can get push tokens
  if (!Device.isDevice) {
    logger.log("[Push] Skipping — not a real device.");
    return false;
  }

  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Only prompt OS dialog if explicitly instructed (e.g. after a relevant user action)
    if (existingStatus !== "granted" && requestPermission) {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      logger.log("[Push] Permission not granted.");
      return false;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn("[Push] No EAS projectId found.");
      return false;
    }

    // Expo Go on Android uses host.exp.exponent as package name
    const applicationId =
      Platform.OS === "android"
        ? Application.applicationId
        : undefined;

    const isExpoGo = applicationId === "host.exp.exponent";

    const tokenOptions: any = { projectId };
    if (!isExpoGo && applicationId) {
      tokenOptions.applicationId = applicationId;
    }

    const { data: tokenData } = await Notifications.getExpoPushTokenAsync(tokenOptions);

    if (tokenData) {
      await savePushToken(userId, tokenData);
      logger.log("[Push] Token registered:", tokenData);
      return true;
    }
    return false;
  } catch (err) {
    logger.log("[Push] Registration failed silently:", err);
    return false;
  }
}

/**
 * Silently syncs push token ONLY IF permission was already granted.
 * Never displays a permission dialog to the user on startup.
 */
export async function syncPushTokenIfPermitted(userId: string): Promise<void> {
  await registerForPushNotifications(userId, false);
}

/**
 * Prompts user for notification permission with context.
 * Call this only after a relevant user action (e.g. pairing, setting medicine, letter).
 */
export async function requestPushNotificationPermission(userId: string): Promise<boolean> {
  return await registerForPushNotifications(userId, true);
}


// Foreground bildirim işleyicisi (Expo SDK 57 uyumlu)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Android kanalları kurulumu (Mektup, İlaç, Genel ve Partner kanalları)
export function configureAndroidNotificationChannel() {
  if (Platform.OS === "android") {
    // 1. Genel Kanal
    Notifications.setNotificationChannelAsync("default", {
      name: "Genel Bildirimler ❤️",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF5C77",
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // 2. Partner Mesajları & Anılar Kanalı (Öncelikli - WhatsApp tarzı)
    Notifications.setNotificationChannelAsync("partner_messages", {
      name: "Sevgilinden Mesajlar & Anılar ❤️",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#FF4D6D",
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // 3. Mektuplar Kanalı (Altın Işıltı)
    Notifications.setNotificationChannelAsync("letters_channel", {
      name: "Mektuplar 💌",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: "#F5C563",
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    // 4. İlaç & Sağlık Kanalı (Zümrüt Yeşili)
    Notifications.setNotificationChannelAsync("medicine_channel", {
      name: "İlaç & Sağlık 💊",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: "#34D399",
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

/**
 * Herhangi bir metin içinde bulunabilecek şifreli verileri (enc:... veya det:...)
 * tespit edip otomatik olarak deşifre eder.
 * Kesinlikle hiçbir bildirimde şifreli veri gitmemesini garanti eder.
 */
export function cleanNotificationText(text: string | null | undefined): string {
  if (!text) return "";

  let result = String(text);

  // 1. Dinamik AES Şifreleme: "enc:IV_HEX:CIPHERTEXT_HEX"
  result = result.replace(/enc:[a-fA-F0-9]+:[a-fA-F0-9]+/g, (match) => {
    try {
      const dec = decrypt(match);
      if (dec && !dec.startsWith("enc:")) {
        return dec;
      }
      return "";
    } catch {
      return "";
    }
  });

  // 2. Deterministik AES Şifreleme: "det:CIPHERTEXT_HEX"
  result = result.replace(/det:[a-fA-F0-9]+/g, (match) => {
    try {
      const dec = deterministicDecrypt(match);
      if (dec && !dec.startsWith("det:")) {
        return dec;
      }
      return "";
    } catch {
      return "";
    }
  });

  return result.replace(/\s+/g, " ").trim();
}

export interface FormattedPushPayload {
  title: string;
  subtitle?: string;
  body: string;
  channelId: string;
}

/**
 * Bildirimleri gerçek mesajlaşma uygulamalarındaki (WhatsApp / iMessage) gibi biçimlendirir.
 * Başlıkta partnerin adı ve ilgili emoji yer alır (ör: "Emirhan 💌").
 * Alt başlıkta kategori (ör: "Yeni Mektup" / "Ortak Galeri") yer alır.
 * Gövdede ise gereksiz robotik tekrarlar olmadan doğrudan samimi mesaj görünür.
 */
export function formatMessagingStyleNotification(
  senderName: string,
  rawTitle: string,
  rawBody: string,
  data?: any
): FormattedPushPayload {
  const type = data?.type || "";
  const name = (senderName || "Sevgilin").trim();

  // Robotik "Sevgilin" veya "{sender}" ibarelerini gönderen adı ile değiştir ve temizle
  let cleanBodyText = cleanNotificationText(rawBody)
    .replace(/\{sender\}/gi, name)
    .replace(/\b(Sevgilin|Partnerin)\b/g, name);

  // Başta "Emirhan:" veya "Emirhan " varsa temizle (başlıkta zaten adı olacağı için)
  const namePrefixRegex = new RegExp(`^${name}[,:]?\\s*`, "i");
  let trimmedBody = cleanBodyText.replace(namePrefixRegex, "").trim();
  if (trimmedBody.length > 0) {
    trimmedBody = trimmedBody.charAt(0).toUpperCase() + trimmedBody.slice(1);
  }

  let title = `${name} ❤️`;
  let subtitle = "Couples";
  let body = trimmedBody || cleanBodyText;
  let channelId = "partner_messages";

  switch (type) {
    case "letter": {
      title = `${name} 💌`;
      subtitle = "Yeni Mektup";
      channelId = "letters_channel";
      const letterTitle = data?.letterTitle ? ` "${data.letterTitle}"` : "";
      body = `Sana mühürlü bir mektup bıraktı${letterTitle} 📜`;
      break;
    }
    case "medicine":
    case "medicine_reminder": {
      title = `${name} 💊`;
      subtitle = "İlaç Takibi";
      channelId = "medicine_channel";
      const medName = data?.medicineName ? `${data.medicineName} ilacını` : "İlacını";
      if (data?.status === "DRANK") {
        body = `${medName} içti. İçin rahat olsun! 🌿`;
      } else {
        body = trimmedBody || `${medName} içme zamanı geldi! ⏰`;
      }
      break;
    }
    case "photo": {
      title = `${name} 📸`;
      subtitle = "Ortak Galeri";
      channelId = "partner_messages";
      if (trimmedBody) {
        body = trimmedBody.toLowerCase().includes("fotoğraf") || trimmedBody.toLowerCase().includes("anı")
          ? trimmedBody
          : `Yeni bir anı ekledi: ${trimmedBody}`;
      } else {
        body = "Ortak galeriye yeni bir anı fotoğrafı ekledi ✨";
      }
      break;
    }
    case "mood": {
      const emoji = data?.moodEmoji || "🥰";
      title = `${name} ${emoji}`;
      subtitle = "Ruh Hali";
      channelId = "partner_messages";
      body = trimmedBody || `Bugün kendini ${emoji} hissediyor.`;
      break;
    }
    case "map": {
      title = `${name} 📍`;
      subtitle = "Aşk Haritası";
      channelId = "partner_messages";
      body = trimmedBody || "Haritaya senin için yeni bir anı notu bıraktı 🗺️";
      break;
    }
    case "meeting": {
      title = `${name} ⏰`;
      subtitle = "Buluşma Planı";
      channelId = "partner_messages";
      body = trimmedBody || "Yeni bir buluşma planladı 🗓️";
      break;
    }
    case "period": {
      title = `${name} 🌸`;
      subtitle = "Özel Gün";
      channelId = "partner_messages";
      body = trimmedBody || "Regl dönemi başladı. Ona biraz daha özen gösterme zamanı! 💕";
      break;
    }
    default: {
      const cleanT = cleanNotificationText(rawTitle);
      title = `${name} ❤️`;
      subtitle = cleanT || "Couples";
      body = trimmedBody || cleanBodyText;
      channelId = "partner_messages";
      break;
    }
  }

  return { title, subtitle, body, channelId };
}

export async function sendPushNotification(userId: string, title: string, body: string, data?: any) {
  try {
    const cleanTitle = cleanNotificationText(title);
    const cleanBody = cleanNotificationText(body);

    if (!cleanTitle && !cleanBody) return;

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("token")
      .eq("user_id", userId);

    if (!tokens || tokens.length === 0) return;

    let channelId = "default";
    if (data?.type === "letter") channelId = "letters_channel";
    else if (data?.type === "medicine" || data?.type === "medicine_reminder") channelId = "medicine_channel";
    else if (data?.type) channelId = "partner_messages";

    for (const t of tokens) {
      const message = {
        to: t.token,
        sound: "default",
        title: cleanTitle,
        body: cleanBody,
        channelId,
        priority: "high",
        badge: 1,
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
    const cleanTitle = cleanNotificationText(title);
    const cleanBody = cleanNotificationText(body);

    // Önce aynı ID'ye sahip eski bildirimi temizle
    await cancelLocalNotification(id);
    
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: cleanTitle,
        body: cleanBody,
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
    const cleanTitle = cleanNotificationText(title);
    const cleanBody = cleanNotificationText(body);

    await cancelLocalNotification(id);
    
    // Geçmiş bir tarihse kurma
    if (triggerDate.getTime() <= Date.now()) return;

    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: cleanTitle,
        body: cleanBody,
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
 *
 * GÜVENLIK NOTU: push_tokens tablosunun RLS politikası (user_id = auth.uid())
 * nedeniyle, Partner A doğrudan Partner B'nin token'ını sorgulayamaz.
 * Bu yüzden 017_scalability_and_security_fixes.sql ile oluşturulan
 * get_partner_push_tokens(couple_id) RPC fonksiyonu kullanılır.
 * Bu fonksiyon SECURITY DEFINER yetkisiyle çalışır ve yalnızca aynı
 * çifte ait partnerin token'larını döndürür.
 */
export async function notifyPartner(coupleId: number, currentUserId: string, title: string, body: string, data?: any) {
  // Demo modunda bildirim gönderilmez
  if (coupleId === 999999 || currentUserId === "demo-guest-user-id") {
    return;
  }

  try {
    // Gönderen kullanıcının adını çek
    const { data: senderData } = await supabase
      .from("users")
      .select("display_name, username")
      .eq("id", currentUserId)
      .maybeSingle();

    // Gönderen kullanıcının adını tamamen deşifre et
    let senderName = "";
    if (senderData?.display_name) {
      senderName = cleanNotificationText(senderData.display_name);
    }
    if (!senderName && senderData?.username) {
      senderName = cleanNotificationText(senderData.username);
    }
    if (!senderName) {
      senderName = "Sevgilin";
    }

    // Mesajlaşma uygulaması tarzında (WhatsApp / iMessage) bildirim hazırla
    const formatted = formatMessagingStyleNotification(senderName, title, body, data);

    if (!formatted.title && !formatted.body) return;

    // SECURITY DEFINER RPC ile partner'ın token'larını al (RLS kalkanı aşımı)
    const { data: tokens, error } = await supabase.rpc("get_partner_push_tokens", {
      p_couple_id: coupleId,
    });

    if (error || !tokens || tokens.length === 0) return;

    const payloadData = {
      ...(data || {}),
      senderName: senderName || undefined,
    };

    for (const t of tokens) {
      if (!t.token) continue;
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: t.token,
          sound: "default",
          title: formatted.title,
          subtitle: formatted.subtitle,
          body: formatted.body,
          channelId: formatted.channelId,
          priority: "high",
          badge: 1,
          data: payloadData,
        }),
      });
    }
  } catch (error) {
    logger.error("[Push] Failed to notify partner:", error);
  }
}
