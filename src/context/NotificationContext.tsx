import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { InAppNotificationData, NotificationType } from "@/types/notification";
import { logger } from "@/utils/logger";
import { clearNotificationBadge } from "@/lib/notifications";
import { InAppNotificationBanner } from "@/components/notifications/InAppNotificationBanner";

interface NotificationContextType {
  currentNotification: InAppNotificationData | null;
  showNotification: (notification: Partial<InAppNotificationData> & { title: string; body: string; type?: NotificationType }) => void;
  dismissNotification: () => void;
  triggerDemoNotification: (type: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentNotification, setCurrentNotification] = useState<InAppNotificationData | null>(null);
  const router = useRouter();

  const dismissNotification = useCallback(() => {
    setCurrentNotification(null);
  }, []);

  const showNotification = useCallback(
    (notif: Partial<InAppNotificationData> & { title: string; body: string; type?: NotificationType }) => {
      const fullNotification: InAppNotificationData = {
        id: notif.id || `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        type: notif.type || "general",
        title: notif.title,
        body: notif.body,
        senderName: notif.senderName,
        avatarUrl: notif.avatarUrl,
        timestamp: notif.timestamp || new Date().toISOString(),
        route: notif.route,
        actionLabel: notif.actionLabel,
        metadata: notif.metadata || {},
      };

      setCurrentNotification(fullNotification);
    },
    []
  );

  // Quick demo generator for testing and showcase
  const triggerDemoNotification = useCallback(
    (type: NotificationType) => {
      switch (type) {
        case "letter":
          showNotification({
            type: "letter",
            title: "Gelecekten Bir Mektup 💌",
            body: "Sevgilin senin için kalpten bir mektup mühürledi. Açmak için dokun!",
            senderName: "Sevgilin",
            route: "/(tabs)/letters",
            actionLabel: "Mektuplara Git 💌",
            metadata: {
              letterTitle: "Birlikte Yaşlanacağımız Günlere...",
            },
          });
          break;

        case "medicine":
          showNotification({
            type: "medicine",
            title: "İlacını İçti! 💊✨",
            body: "Sevgilin sabah vitaminini içti. İçin rahat olsun, sağlığına dikkat ediyor! 🌿",
            senderName: "Sevgilin",
            route: "/(tabs)/medicine",
            actionLabel: "İlaç Takibine Git 💊",
            metadata: {
              medicineName: "B12 & Omega Vitamini",
            },
          });
          break;

        case "medicine_reminder":
          showNotification({
            type: "medicine_reminder",
            title: "İlaç Vakti 💧",
            body: "Günün sağlık dozu vakti geldi. Bir bardak suyla almayı unutma!",
            route: "/(tabs)/medicine",
            actionLabel: "İlaç Takibine Git 💊",
            metadata: {
              medicineName: "Günlük Vitamin",
            },
          });
          break;

        case "photo":
          showNotification({
            type: "photo",
            title: "Yeni Bir Anı 📸",
            body: "Sevgilin albümünüze yeni bir fotoğraf ekledi. Anının detaylarına göz at!",
            senderName: "Sevgilin",
            route: "/(tabs)/memories",
            actionLabel: "Anılara Git 📸",
          });
          break;

        case "map":
          showNotification({
            type: "map",
            title: "Haritada Yeni Bir Aşk Notu 💌",
            body: "Sevgilin Kadıköy Sahili'ne gizli bir aşk notu bıraktı: 'Seni ilk gördüğüm yer...'",
            senderName: "Sevgilin",
            route: "/(tabs)/map",
            actionLabel: "Haritaya Git 🗺️",
          });
          break;

        case "period":
          showNotification({
            type: "period",
            title: "Regl Dönemi Başladı 🌸",
            body: "Sevgilinin döngüsü başladı. Ona biraz daha özen gösterme zamanı!",
            senderName: "Sevgilin",
            route: "/(tabs)/period-tracker",
            actionLabel: "Döngü Takibine Git 🌸",
          });
          break;

        case "mood":
          showNotification({
            type: "mood",
            title: "Ruh Hali Güncellendi 🥰",
            body: "Sevgilin 'Seni Çok Özledim' modunu seçti! Günün anını birlikte paylaşın.",
            senderName: "Sevgilin",
            route: "/(tabs)/home",
            actionLabel: "Ana Sayfaya Git ✨",
          });
          break;

        case "meeting":
          showNotification({
            type: "meeting",
            title: "Yeni Bir Buluşma Planı 🗓️",
            body: "Hafta sonu için romantik akşam yemeği planı oluşturuldu!",
            senderName: "Sevgilin",
            route: "/(tabs)/meetings",
            actionLabel: "Buluşmalara Git 🗓️",
          });
          break;

        default:
          showNotification({
            type: "general",
            title: "Seni Çok Seviyorum ❤️",
            body: "Günün her anında aklımdasın!",
            senderName: "Sevgilin",
          });
          break;
      }
    },
    [showNotification]
  );

  // Listen to Expo Push notifications when foregrounded
  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      try {
        const { title, body, data } = notification.request.content;
        const payloadData = (data as any) || {};

        let deducedType: NotificationType = "general";
        if (payloadData.type) {
          deducedType = payloadData.type as NotificationType;
        } else if (title?.toLowerCase().includes("mektup") || body?.toLowerCase().includes("mektup")) {
          deducedType = "letter";
        } else if (title?.toLowerCase().includes("ilaç") || body?.toLowerCase().includes("ilaç") || title?.toLowerCase().includes("vitamin")) {
          deducedType = "medicine";
        } else if (title?.toLowerCase().includes("anı") || title?.toLowerCase().includes("fotoğraf")) {
          deducedType = "photo";
        } else if (title?.toLowerCase().includes("harita")) {
          deducedType = "map";
        } else if (title?.toLowerCase().includes("regl")) {
          deducedType = "period";
        }

        showNotification({
          type: deducedType,
          title: title || "Bildirim",
          body: body || "",
          senderName: payloadData.senderName,
          route: payloadData.route,
          actionLabel: payloadData.actionLabel,
          metadata: payloadData,
        });
      } catch (err) {
        logger.error("[InAppNotification] Error processing incoming notification:", err);
      }
    });

    return () => {
      receivedSubscription.remove();
    };
  }, [showNotification]);

  // Bildirime dokunma: hook hem çalışan uygulamadaki dokunuşları hem de uygulama kapalıyken
  // bildirimle açılışı (cold start) yakalar. Aynı dokunuş iki kez yönlendirmesin diye işlenenler hatırlanır.
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponseRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const key = `${lastResponse.notification.request.identifier}:${lastResponse.notification.date}`;
    if (handledResponseRef.current === key) return;
    handledResponseRef.current = key;

    const route = (lastResponse.notification.request.content.data as any)?.route;
    if (typeof route !== "string" || !route.startsWith("/")) return;

    // Soğuk açılışta gezinti ağacı henüz hazır olmayabilir; kısa bir gecikmeyle dene
    const timer = setTimeout(() => {
      try {
        router.push(route as any);
      } catch (err) {
        logger.error("[InAppNotification] Error responding to notification tap:", err);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [lastResponse, router]);

  // Uygulama açılınca / öne gelince ikon rozetini ve bildirim merkezini temizle
  useEffect(() => {
    clearNotificationBadge();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") clearNotificationBadge();
    });
    return () => sub.remove();
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        currentNotification,
        showNotification,
        dismissNotification,
        triggerDemoNotification,
      }}
    >
      {children}
      <InAppNotificationBanner
        notification={currentNotification}
        onDismiss={dismissNotification}
        onAction={(notif) => {
          if (notif.route) {
            router.push(notif.route as any);
          }
        }}
      />
    </NotificationContext.Provider>
  );
};

export function useCustomNotification(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useCustomNotification must be used within a NotificationProvider");
  }
  return context;
}
