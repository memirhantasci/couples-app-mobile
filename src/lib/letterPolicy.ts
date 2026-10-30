// ─── Mektup gizleme ve silme kuralları ──────────────────────────────────────────
// Sunucudaki karşılığı: supabase/migrations/20261022000002_letter_hide_and_deletion_consent.sql
// Kuralları sunucu uygular; buradaki hesaplar arayüzün doğru düğmeyi ve tarihi göstermesi içindir.
//
//  • Gönderilen mektup açılış gününe kadar silinemez; iki taraf da yalnızca kendi listesinden gizleyebilir.
//  • Açılıştan 72 saat sonra gönderen silme isteyebilir; alıcı onay vermeden mektup silinmez.
//    Açılış anı: mektubun alıcıya fiilen ulaştığı an (açılış günü 00:00 Türkiye saati ile yazıldığı an, hangisi sonraysa).
//  • Onaylanan mektup en erken açılıştan 72 saat sonra silinir.
//  • Reddedilen istek 72 saat sonra yeniden gönderilebilir.

const HOUR_MS = 60 * 60 * 1000;

/**
 * Mektuplar unlock_date gününün 00:00'ında, Türkiye saatiyle (Europe/Istanbul, UTC+3) açılır; sunucudaki
 * public.app_today() / letter_unlock_at ile aynı kural (bkz. migration 20261030000003). Türkiye'de yaz saati yoktur.
 */
export const LETTER_TZ_OFFSET = "+03:00";

/** Şu anki Türkiye tarihi (YYYY-MM-DD): sunucudaki public.app_today() ile aynı gün. */
export function istanbulToday(now: number = Date.now()): string {
  return new Date(now + 3 * HOUR_MS).toISOString().substring(0, 10);
}

/** Açılıştan sonra gönderenin silme isteyebilmesi için geçmesi gereken süre. */
export const DELETION_REQUEST_DELAY_MS = 72 * HOUR_MS;
/** Onaylanan bir mektubun en erken silindiği an: açılıştan bu kadar sonra (72 saat). */
export const DELETION_DELAY_MS = 72 * HOUR_MS;
/** Reddedilen bir isteğin yeniden gönderilebilmesi için beklenen süre. */
export const DELETION_RETRY_DELAY_MS = 72 * HOUR_MS;

export interface LetterPolicyFields {
  unlock_date: string | null | undefined;
  created_at?: string | null;
  hidden_by_sender?: boolean | null;
  hidden_by_receiver?: boolean | null;
  deletion_requested_at?: string | null;
  deletion_approved_at?: string | null;
  deletion_rejected_at?: string | null;
}

export type LetterDeletionState = "none" | "pending" | "approved" | "rejected";

/** Açılış anı: unlock_date günü 00:00 Türkiye saati, alıcının mektubu görmeye başladığı an. */
export function letterUnlockAt(letter: LetterPolicyFields): number {
  if (!letter || typeof letter.unlock_date !== "string" || letter.unlock_date.length < 10) {
    return Number.POSITIVE_INFINITY;
  }
  const parsed = Date.parse(`${letter.unlock_date.substring(0, 10)}T00:00:00${LETTER_TZ_OFFSET}`);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

/**
 * Mektubun alıcıya fiilen açıldığı an. Açılış gününde (ya da geçmiş bir günde) yazılan mektup
 * yazıldığı anda açılır; yoksa 72 saatlik sayaç yazılmadan önceki bir andan başlardı.
 */
export function letterOpenedAt(letter: LetterPolicyFields): number {
  const unlockAt = letterUnlockAt(letter);
  const createdAt = letter.created_at ? Date.parse(letter.created_at) : NaN;
  return Number.isFinite(createdAt) ? Math.max(unlockAt, createdAt) : unlockAt;
}

export function deletionRequestOpensAt(letter: LetterPolicyFields): number {
  return letterOpenedAt(letter) + DELETION_REQUEST_DELAY_MS;
}

export function letterDeletableAt(letter: LetterPolicyFields): number {
  return letterOpenedAt(letter) + DELETION_DELAY_MS;
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
