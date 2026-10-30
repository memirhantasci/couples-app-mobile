import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { appAlert } from "@/lib/dialog";
import { logger } from "@/utils/logger";

interface PartnerNotice {
  id: number;
  kind: "deletion_requested" | "deletion_cancelled" | "couple_dissolved";
  scheduled_for: string | null;
}

const QUERY_KEY = "partner_notices";

/**
 * Kökte bir kez bağlanır. Partner hesabını silmek istediğinde, bundan vazgeçtiğinde ya da hesabı silinip
 * çift dağıldığında sunucu `partner_notices` satırı bırakır (bkz. migration 20261030000002); bu bileşen
 * okunmamış bildirimi, neyin değiştiğini ve ortak verilere ne olduğunu anlatan bir diyalogla gösterir.
 * "Anladım" ile kayıt görüldü işaretlenir; sıradaki bildirim (varsa) ardından gösterilir.
 */
export function PartnerNoticeHost() {
  const { t, i18n } = useTranslation();
  const { session, isSignedIn, isDemoMode } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;
  const enabled = isSignedIn && !isDemoMode && !!userId;

  const { data } = useQuery({
    queryKey: [QUERY_KEY, userId],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<PartnerNotice[]> => {
      const { data: rows, error } = await supabase
        .from("partner_notices")
        .select("id, kind, scheduled_for")
        .is("seen_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (rows ?? []) as PartnerNotice[];
    },
  });

  // Uygulama öne gelince yeni bildirim var mı bak
  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }).catch(() => {});
    });
    return () => subscription.remove();
  }, [enabled, queryClient]);

  const shownIdRef = useRef<number | null>(null);
  const notice = enabled ? data?.[0] : undefined;

  useEffect(() => {
    if (!notice || shownIdRef.current === notice.id) return;
    shownIdRef.current = notice.id;

    const acknowledge = () => {
      Promise.resolve(supabase.rpc("ack_partner_notice", { p_id: notice.id }))
        .catch((err) => logger.warn("[PartnerNotice] işaretlenemedi:", err))
        .finally(() => {
          queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }).catch(() => {});
        });
    };

    let title: string;
    let message: string;
    let emoji: string;
    let tone: "warning" | "info";
    if (notice.kind === "deletion_requested") {
      const date = notice.scheduled_for ? dayjs(notice.scheduled_for).locale(i18n.language).format("D MMMM YYYY") : "";
      title = t("partnerNotice.requested.title");
      message = t("partnerNotice.requested.body", { date });
      emoji = "💔";
      tone = "warning";
    } else if (notice.kind === "deletion_cancelled") {
      title = t("partnerNotice.cancelled.title");
      message = t("partnerNotice.cancelled.body");
      emoji = "💞";
      tone = "info";
    } else {
      title = t("partnerNotice.dissolved.title");
      message = t("partnerNotice.dissolved.body");
      emoji = "🕊️";
      tone = "warning";
    }

    appAlert(title, message, [{ text: t("partnerNotice.ok"), onPress: acknowledge }], {
      cancelable: false,
      forceDialog: true,
      tone,
      emoji,
    });
  }, [notice, queryClient, t, i18n.language]);

  return null;
}
