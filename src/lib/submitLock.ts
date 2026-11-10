/**
 * Tek seferde tek gönderim: aynı işlem sürerken gelen ikinci çağrı hiç başlamaz.
 *
 * Kilit bir değişkende (React'te ref) tutulur, state'te değil: state bir sonraki çizime kadar güncellenmez,
 * bu yüzden aynı karede gelen iki olay (klavyedeki "gönder" + düğmeye dokunma, hızlı çift dokunma) state'e
 * bakan bir kontrolden ikisi birden geçer. React sarmalı: src/hooks/useSubmitLock.ts.
 */
export interface SubmitLock {
  /** İşlem sürüyor mu (anlık, ref değeri) */
  isBusy(): boolean;
  /** Kilit boşsa işlemi başlatır ve sonucunu döner; doluysa hiçbir şey yapmadan `undefined` döner. */
  run<T>(task: () => Promise<T>): Promise<T | undefined>;
}

export function createSubmitLock(onChange?: (busy: boolean) => void, busy: { current: boolean } = { current: false }): SubmitLock {
  return {
    isBusy: () => busy.current,
    async run<T>(task: () => Promise<T>): Promise<T | undefined> {
      if (busy.current) return undefined;
      busy.current = true;
      onChange?.(true);
      try {
        return await task();
      } finally {
        busy.current = false;
        onChange?.(false);
      }
    },
  };
}
