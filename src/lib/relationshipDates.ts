import { supabase } from "@/lib/supabase";
import i18n from "@/lib/i18n";

/**
 * İlişki tarihleri yalnızca sunucu RPC'leriyle yazılır:
 * - set_initial_relationship_dates: kurulumda ilk kaydeden kazanır, partnerin sonraki kaydı ezmez.
 * - change_relationship_dates: tarihler ilk kaydedildikten sonraki ilk 30 günde 2, ardından her
 *   30 günlük dönemde 1 değişiklik hakkı (çift bazlı; kullanılmayan hak devretmez).
 */
export interface DatesChangeStatus {
  /** Tarihler en az bir kez kaydedildi mi? İlk kayıt hak harcamaz. */
  hasDates: boolean;
  allowance: number;
  used: number;
  remaining: number;
  /** Mevcut dönemin bittiği, yeni hakkın açılacağı an */
  periodEndsAt: string | null;
}

export function parseDatesChangeStatus(data: unknown): DatesChangeStatus | null {
  const row: any = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    hasDates: !!row.result_has_dates,
    allowance: row.result_allowance ?? 0,
    used: row.result_used ?? 0,
    remaining: row.result_remaining ?? 0,
    periodEndsAt: row.result_period_ends_at ?? null,
  };
}

export async function fetchDatesChangeStatus(): Promise<DatesChangeStatus | null> {
  const { data, error } = await supabase.rpc("get_my_dates_change_status");
  if (error) return null;
  return parseDatesChangeStatus(data);
}

/** Yeni hakkın açılmasına kalan gün (küsurat yukarı yuvarlanır, en az 1) */
export function daysUntilPeriodEnd(periodEndsAt: string | null): number {
  if (!periodEndsAt) return 0;
  const diffMs = new Date(periodEndsAt).getTime() - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

export function translateDatesError(msg: string | undefined): string {
  if (!msg) return i18n.t("setup.errors.datesSaveFailed");
  if (msg.includes("NOT_PAIRED")) return i18n.t("setup.errors.pairingInfoMissing");
  if (msg.includes("FUTURE_DATE")) return i18n.t("setup.errors.futureDate");
  if (msg.includes("MEET_AFTER_RELATIONSHIP")) return i18n.t("setup.errors.meetAfterRelationship");
  if (msg.includes("RELATIONSHIP_DATE_REQUIRED")) return i18n.t("setup.errors.relationshipDateRequired");
  if (msg.includes("DATES_CHANGE_LIMIT")) return i18n.t("setup.errors.datesChangeLimit");
  return i18n.t("setup.errors.datesSaveFailedWithMessage", { message: msg });
}
