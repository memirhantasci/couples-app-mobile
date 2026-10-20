import { useEffect, useState } from "react";

/**
 * Ekranın ilk karesinde görünmesi gerekmeyen (kaydırınca ortaya çıkan) bölümleri bir sonraki
 * boş ana erteler. Ağır bir sekme tek seferde mount edilince JS iş parçacığı yüzlerce ms
 * kilitleniyor ve ekran geç açılıyor; üstteki içerik önce çizilir, alttaki bölümler hemen ardından
 * eklenir. Dönen değer `false` iken ertelenen bölüm hiç render edilmez.
 */
export function useDeferredReady(delayMs = 0): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let frame: ReturnType<typeof requestAnimationFrame> | undefined;
    const timer = setTimeout(() => {
      frame = requestAnimationFrame(() => setReady(true));
    }, delayMs);
    return () => {
      clearTimeout(timer);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [delayMs]);

  return ready;
}
