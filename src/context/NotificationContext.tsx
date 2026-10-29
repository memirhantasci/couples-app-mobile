import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { invalidateForNotification, invalidateOnResume } from "@/lib/notificationQueries";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { InAppNotificationData, NotificationType } from "@/types/notification";
import { logger } from "@/utils/logger";
import { clearNotificationBadge } from "@/lib/notifications";
import { markLettersSeen, requestLetterArrivalCheck } from "@/lib/letterArrival";
import { useAuth } from "@/context/AuthContext";
import { InAppNotificationBanner } from "@/components/notifications/InAppNotificationBanner";
import { useTranslation } from "react-i18next";

interface NotificationContextType {
  currentNotification: InAppNotificationData | null;
  showNotification: (notification: Partial<InAppNotificationData> & { title: string; body: string; type?: NotificationType }) => void;
  dismissNotification: () => void;
  triggerDemoNotification: (type: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Bildirim türü, `data.type` yoksa başlık/gövdedeki anahtar sözcüklerden tahmin edilir.
 * Bildirim göndericinin diliyle yazıldığından Türkçe ve İngilizce sözcükler birlikte aranır.
 */
function mentionsAny(title: string | null | undefined, body: string | null | undefined, words: string[]): boolean {
  const haystacks = [title, body].filter((s): s is string => typeof s === "string").map((s) => s.toLowerCase());
  return words.some((word) => haystacks.some((h) => h.includes(word)));
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [currentNotification, setCurrentNotification] = useState<InAppNotificationData | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

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
            title: t("notifications.demo.letter.title"),
            body: t("notifications.demo.letter.body"),
            senderName: t("common.partnerFallback"),
            route: "/(tabs)/letters",
            actionLabel: t("notifications.actions.goToLetters"),
            metadata: {
              letterTitle: t("notifications.demo.letter.letterTitle"),
            },
          });
          break;

        case "medicine":
          showNotification({
            type: "medicine",
            title: t("notifications.demo.medicine.title"),
            body: t("notifications.demo.medicine.body"),
            senderName: t("common.partnerFallback"),
            route: "/(tabs)/medicine",
            actionLabel: t("notifications.actions.goToMedicine"),
            metadata: {
              medicineName: t("notifications.demo.medicine.medicineName"),
            },
          });
          break;

        case "medicine_reminder":
          showNotification({
            type: "medicine_reminder",
            title: t("notifications.local.medicineTitle"),
            body: t("notifications.demo.medicineReminder.body"),
            route: "/(tabs)/medicine",
            actionLabel: t("notifications.actions.goToMedicine"),
            metadata: {
              medicineName: t("notifications.demo.medicineReminder.medicineName"),
            },
          });
          break;

        case "photo":
          showNotification({
            type: "photo",
            title: t("notifications.demo.photo.title"),
            body: t("notifications.demo.photo.body"),
            senderName: t("common.partnerFallback"),
            route: "/(tabs)/memories",
            actionLabel: t("notifications.actions.goToMemories"),
          });
          break;

        case "map":
          showNotification({
            type: "map",
            title: t("notifications.demo.map.title"),
            body: t("notifications.demo.map.body"),
            senderName: t("common.partnerFallback"),
            route: "/(tabs)/map",
            actionLabel: t("notifications.actions.goToMap"),
          });
          break;

        case "period":
          showNotification({
            type: "period",
            title: t("notifications.demo.period.title"),
            body: t("notifications.demo.period.body"),
            senderName: t("common.partnerFallback"),
            route: "/(tabs)/period-tracker",
            actionLabel: t("notifications.actions.goToCycle"),
          });
          break;

        case "mood":
          showNotification({
            type: "mood",
            title: t("notifications.demo.mood.title"),
            body: t("notifications.demo.mood.body"),
            senderName: t("common.partnerFallback"),
            route: "/(tabs)/home",
            actionLabel: t("notifications.actions.goToHome"),
          });
          break;

        case "meeting":
          showNotification({
            type: "meeting",
            title: t("notifications.demo.meeting.title"),
            body: t("notifications.demo.meeting.body"),
            senderName: t("common.partnerFallback"),
            route: "/(tabs)/meetings",
            actionLabel: t("notifications.actions.goToMeetings"),
          });
          break;

        default:
          showNotification({
            type: "general",
            title: t("notifications.demo.general.title"),
            body: t("notifications.demo.general.body"),
            senderName: t("common.partnerFallback"),
          });
          break;
      }
    },
    [showNotification, t]
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
        } else if (mentionsAny(title, body, ["mektup", "letter"])) {
          deducedType = "letter";
        } else if (mentionsAny(title, body, ["ilaç", "medicine", "medication"]) || mentionsAny(title, null, ["vitamin"])) {
          deducedType = "medicine";
        } else if (mentionsAny(title, null, ["anı", "fotoğraf", "memory", "photo"])) {
          deducedType = "photo";
        } else if (mentionsAny(title, null, ["harita", "map"])) {
          deducedType = "map";
        } else if (mentionsAny(title, null, ["regl", "period"])) {
          deducedType = "period";
        }

        // Mektupta üstten inen uygulama içi kart gösterilmez: uçan güvercin (LetterArrivalHost) bildirimin
        // yerini tutar, kart onu kapatıp/örtüp güvercini engelliyordu. Telefonun bildirim çubuğuna yine düşer.
        if (deducedType !== "letter") {
          showNotification({
            type: deducedType,
            title: title || t("notifications.fallbackTitle"),
            body: body || "",
            senderName: payloadData.senderName,
            route: payloadData.route,
            actionLabel: payloadData.actionLabel,
            metadata: payloadData,
          });
        }

        // Partnerin yaptığı değişiklik (mektup, anı, ruh hali…) ekranlara önbellek süresi dolmadan yansısın:
        // yalnızca bu bildirim türünün verisi yenilenir (bkz. notificationQueries).
        invalidateForNotification(queryClient, deducedType);

        // Uygulama açıkken mektup bildirimi gelirse kuş karşılaması hemen oynar (LetterArrivalHost);
        // mektuplar ekranındaysa o sessizce "görüldü" sayar.
        if (deducedType === "letter") requestLetterArrivalCheck();
      } catch (err) {
        logger.error("[InAppNotification] Error processing incoming notification:", err);
      }
    });

    return () => {
      receivedSubscription.remove();
    };
  }, [showNotification, userId, queryClient, t]);

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

    const responseData = lastResponse.notification.request.content.data as any;
    invalidateForNotification(queryClient, responseData?.type);
    // Mektup bildirimine dokunan kullanıcı mektuplar ekranına gidiyor: kuş karşılaması gerekmez
    if (responseData?.type === "letter" && userId) markLettersSeen(userId);

    const route = responseData?.route;
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
  }, [lastResponse, router, userId, queryClient]);

  // Uygulama açılınca / öne gelince ikon rozetini ve bildirim merkezini temizle.
  // Arka planda bir süre kaldıysa partnerin verileri de yenilenir (anlık bağlantı yalnızca profil/yıldızda var).
  useEffect(() => {
    clearNotificationBadge();
    let backgroundedAt: number | null = null;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        if (backgroundedAt === null) backgroundedAt = Date.now();
        return;
      }
      if (state !== "active") return;
      clearNotificationBadge();
      if (backgroundedAt !== null && Date.now() - backgroundedAt > 30 * 1000) {
        invalidateOnResume(queryClient);
      }
      backgroundedAt = null;
    });
    return () => sub.remove();
  }, [queryClient]);

  // Değer sabit tutulur: bildirimi kullanan her ekran, ilgisiz bir yeniden render'da baştan çizilmesin
  const contextValue = useMemo(() => ({
    currentNotification,
    showNotification,
    dismissNotification,
    triggerDemoNotification,
  }), [currentNotification, showNotification, dismissNotification, triggerDemoNotification]);

  return (
    <NotificationContext.Provider value={contextValue}>
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
