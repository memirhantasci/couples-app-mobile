import { useState } from "react";
import { createSubmitLock } from "@/lib/submitLock";

/**
 * Gönderim düğmeleri için ortak kilit (src/lib/submitLock.ts). `run` kilidin kendi bayrağına bakar (state'e değil):
 * aynı karede gelen ikinci dokunuş da durur. `isBusy` kilidin anlık durumudur (gönderim sürerken başka bir eylemi,
 * ör. ayrıntılı eklemeyi, başlatmamak için). `pending` yalnızca görünüm içindir (düğmeyi pasif/yükleniyor göstermek).
 */
export function useSubmitLock() {
  const [pending, setPending] = useState(false);
  // Kilit bileşen ömrü boyunca tek: bayrağı çizimler arasında korunur
  const [lock] = useState(() => createSubmitLock(setPending));
  return { run: lock.run, isBusy: lock.isBusy, pending };
}
