import { useCallback, useState } from "react";
import {
  applyReferralCode,
  cleanReferralInput,
  isReferralCode,
  translateReferralError,
  type ReferralStatus,
} from "@/lib/referral";

/**
 * Davet kodu kutusunun durumu ve gönderimi (eşleşme ekranı ve davet penceresi ortak kullanır).
 * Sunucu kabul ederse `onApplied` davetin durumuyla çağrılır: eşleşmemiş kullanıcıda "pending",
 * eşleşmiş çiftte ödül hemen değerlendirildiği için "rewarded" ya da "rejected".
 */
export function useReferralCodeEntry(onApplied: (status: ReferralStatus) => void) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = useCallback((text: string) => {
    setValue(cleanReferralInput(text));
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    if (submitting) return;
    if (!isReferralCode(value)) {
      setError(translateReferralError("INVALID_CODE"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await applyReferralCode(value);
      if (result.status) {
        setValue("");
        onApplied(result.status);
      } else {
        setError(translateReferralError(result.error));
      }
    } catch {
      setError(translateReferralError(null));
    } finally {
      setSubmitting(false);
    }
  }, [onApplied, submitting, value]);

  return { value, change, submit, submitting, error };
}
