// ─── Mektup gizleme ve silme kuralları ──────────────────────────────────────────
// Sunucudaki karşılığı: supabase/migrations/20261022000002_letter_hide_and_deletion_consent.sql
// Kuralları sunucu uygular; buradaki hesaplar arayüzün doğru düğmeyi ve tarihi göstermesi içindir.
//
//  • Gönderilen mektup açılış gününe kadar silinemez; iki taraf da yalnızca kendi listesinden gizleyebilir.
//  • Açılıştan 72 saat sonra gönderen silme isteyebilir; alıcı onay vermeden mektup silinmez.
//  • Onaylanan mektup en erken açılıştan 72 saat sonra silinir.
//  • Reddedilen istek 72 saat sonra yeniden gönderilebilir.

const HOUR_MS = 60 * 60 * 1000;

/** Açılıştan sonra gönderenin silme isteyebilmesi için geçmesi gereken süre. */
export const DELETION_REQUEST_DELAY_MS = 72 * HOUR_MS;
/** Onaylanan bir mektubun en erken silindiği an: açılıştan bu kadar sonra (72 saat). */
export const DELETION_DELAY_MS = 72 * HOUR_MS;
/** Reddedilen bir isteğin yeniden gönderilebilmesi için beklenen süre. */
export const DELETION_RETRY_DELAY_MS = 72 * HOUR_MS;

export interface LetterPolicyFields {
  unlock_date: string;
  hidden_by_sender?: boolean | null;
  hidden_by_receiver?: boolean | null;
  deletion_requested_at?: string | null;
  deletion_approved_at?: string | null;
  deletion_rejected_at?: string | null;
}

export type LetterDeletionState = "none" | "pending" | "approved" | "rejected";

/** Açılış anı: unlock_date günü 00:00 UTC, alıcının mektubu görmeye başladığı an. */
export function letterUnlockAt(letter: LetterPolicyFields): number {
  return Date.parse(`${letter.unlock_date.substring(0, 10)}T00:00:00Z`);
}

export function deletionRequestOpensAt(letter: LetterPolicyFields): number {
  return letterUnlockAt(letter) + DELETION_REQUEST_DELAY_MS;
}

export function letterDeletableAt(letter: LetterPolicyFields): number {
  return letterUnlockAt(letter) + DELETION_DELAY_MS;
}

export function letterDeletionState(letter: LetterPolicyFields): LetterDeletionState {
  if (!letter.deletion_requested_at) return "none";
  if (letter.deletion_rejected_at) return "rejected";
  if (letter.deletion_approved_at) return "approved";
  return "pending";
}

/** Reddedilen bir isteğin yeniden gönderilebildiği an; ret yoksa null. */
export function deletionRetryAt(letter: LetterPolicyFields): number | null {
  return letter.deletion_rejected_at ? Date.parse(letter.deletion_rejected_at) + DELETION_RETRY_DELAY_MS : null;
}

/** Onaylanmış ve silinme vakti gelmiş: saatlik iş silene kadar listede gösterilmez. */
export function isAwaitingPurge(letter: LetterPolicyFields, now: number): boolean {
  return letterDeletionState(letter) === "approved" && now >= letterDeletableAt(letter);
}

/** Mektup, bakan kişinin kendi listesinden gizlenmiş mi (partnerin görünümünü etkilemez). */
export function isHiddenBy(letter: LetterPolicyFields, role: "sent" | "received"): boolean {
  return role === "sent" ? !!letter.hidden_by_sender : !!letter.hidden_by_receiver;
}
