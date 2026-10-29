import { useEffect, useState } from "react";
import { restoreSavedLanguage } from "@/lib/i18n";

/**
 * Kayıtlı dil tercihi okunup uygulanana kadar false döner.
 * Kök layout, splash'ı bu süreyi bekleterek yanlış dilde bir an görünen ekranı önler.
 */
export function useLanguageReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    restoreSavedLanguage().finally(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return ready;
}
