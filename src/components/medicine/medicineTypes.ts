export interface MedicineItem {
  id: number;
  name: string;
  time?: string | null;
  times?: string[] | null;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  user_id: string | null;
}

export type MedicineTab = "me" | "partner";

/** One medicine's aggregated intake for a past day. */
export interface MedicineHistoryEntry {
  medicine_id: number;
  name: string;
  totalSlots: number;
  drankSlots: number;
  times: string[];
}

export type MedicineHistoryGrouped = Record<string, MedicineHistoryEntry[]>;

export type ComplianceStatus = "complete" | "partial" | "missed" | "pending" | "empty";

export interface WeeklyComplianceDay {
  dateStr: string;
  dayLabel: string;
  dayNumber: string;
  isToday: boolean;
  status: ComplianceStatus;
}

/** Values the manager modal hands to the parent when the form is saved. */
export interface MedicineFormValues {
  name: string;
  startDate: Date;
  endDate: Date;
  times: Date[];
  isPartnerAdd: boolean;
  /** `null` when adding a new medicine. */
  editingId: number | null;
}

/** Optional prefill for the manager modal; every field falls back to a sensible default. */
export interface MedicineFormInitialData {
  id?: number;
  name?: string;
  startDate?: Date;
  endDate?: Date;
  times?: Date[];
  isPartnerAdd?: boolean;
}

/**
 * Outcome of saving, so the modal can react without owning the business logic:
 * - success: saved, close the modal
 * - demo: intercepted for demo mode, just close the modal
 * - name-error: highlight the name field
 * - error: stay open (the parent already told the user why)
 */
export type MedicineSubmitResult = "success" | "demo" | "name-error" | "error";
