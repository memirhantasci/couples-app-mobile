import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { fetchArrivedLetters, markLettersSeen, type ArrivedLetters } from "@/lib/letterArrival";
import { IncomingLetterBird } from "./IncomingLetterBird";

// Uygulama kabuğu (yazı tipleri, ilk ekran) otursun diye açılıştan sonra kısa bir bekleme
const FIRST_CHECK_DELAY_MS = 1500;
const RESUME_CHECK_DELAY_MS = 900;
// Uygulamalar arası hızlı geçişlerde (öne/arkaya) her seferinde sorgu atmamak için alt sınır
const MIN_CHECK_INTERVAL_MS = 20_000;

/**
 * Kökte bir kez bağlanır. Kullanıcı uygulamaya girdiğinde (ya da arka plandan öne geldiğinde)
 * partnerinden, kendisi görmeden gelmiş bir mektup varsa kuşlu "mektup geldi" karşılamasını oynatır.
 * Misafir (demo) modunda ve eşleşme yokken çalışmaz.
 */
export function LetterArrivalHost() {
  const { session, profile, isDemoMode } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [arrival, setArrival] = useState<ArrivedLetters | null>(null);

  const userId = session?.user?.id ?? null;
  const coupleId = profile?.coupleId ?? null;
  const enabled = !!userId && !!coupleId && !isDemoMode;

  // Zamanlayıcıdan okunan en güncel yol (yeniden abonelik gerektirmesin)
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  const checkingRef = useRef(false);
  const lastCheckAtRef = useRef(0);

  const check = useCallback(async () => {
    if (!userId || !coupleId || checkingRef.current) return;
    const now = Date.now();
    if (now - lastCheckAtRef.current < MIN_CHECK_INTERVAL_MS) return;
    lastCheckAtRef.current = now;

    checkingRef.current = true;
    try {
      const result = await fetchArrivedLetters(userId, coupleId);
      if (!result) return;

      // Kullanıcı zaten mektuplar ekranındaysa listeyi görüyordur: sessizce görüldü say
      await markLettersSeen(userId, result.newestCreatedAt);
      if (pathnameRef.current.includes("/letters")) return;

      setArrival(result);
    } finally {
      checkingRef.current = false;
    }
  }, [userId, coupleId]);

  useEffect(() => {
    if (!enabled) return;

    // Hesap / eşleşme değişince kısıtlama sıfırlanır: yeni kullanıcının ilk kontrolü gecikmesin
    lastCheckAtRef.current = 0;
    const first = setTimeout(check, FIRST_CHECK_DELAY_MS);
    let resume: ReturnType<typeof setTimeout> | null = null;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      if (resume) clearTimeout(resume);
      resume = setTimeout(check, RESUME_CHECK_DELAY_MS);
    });

    return () => {
      clearTimeout(first);
      if (resume) clearTimeout(resume);
      subscription.remove();
    };
  }, [enabled, check]);

  const handleOpen = useCallback(() => {
    router.push("/(tabs)/letters");
  }, [router]);

  const handleDismiss = useCallback(() => setArrival(null), []);

  if (!enabled || !arrival) return null;

  return (
    // key: yeni bir mektup grubu gelirse karşılama baştan oynar
    <IncomingLetterBird
      key={arrival.newestCreatedAt}
      arrival={arrival}
      onOpen={handleOpen}
      onDismiss={handleDismiss}
    />
  );
}
