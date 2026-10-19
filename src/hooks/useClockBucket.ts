import { useEffect, useState } from "react";
import { AppState } from "react-native";

const TICK_MS = 60_000;

function currentBucket(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}T${d.getHours()}`;
}

/**
 * Saat veya gün değiştiğinde (ve uygulama arka plandan öne gelince) değişen bir anahtar döner.
 * Selamlama / özel gün gibi "saate bağlı" ekranlar bunu bağımlılık yaparak, uygulama gece
 * yarısını geçse bile yeniden hesaplanır; anahtar yalnızca saatte bir değiştiği için gereksiz
 * render üretmez.
 */
export function useClockBucket(): string {
  const [bucket, setBucket] = useState(currentBucket);

  useEffect(() => {
    const update = () => setBucket(currentBucket());
    const timer = setInterval(update, TICK_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  return bucket;
}
