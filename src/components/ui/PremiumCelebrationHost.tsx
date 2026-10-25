import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { PremiumSuccessModal } from "@/components/ui/PremiumSuccessModal";
import { isPremiumCelebrationSuppressed, premiumSeenKey } from "@/lib/premiumCelebration";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";

/**
 * Kökte bir kez bağlanır. Çiftin Premium'u, bu cihazın son gördüğü duruma göre "yok"tan "var"a geçtiyse
 * (partner satın aldı) "Tebrikler" ekranını gösterir: uygulama açıkken anında (couples satırı canlı
 * dinlenir), kapalıyken bir sonraki açılışta. Bildirim gönderilmez. Satın alan kişinin kendi cihazında
 * (kendi akışı kutlamayı gösterir) ve ilk kurulumda (zaten Premium bir çift) çıkmaz.
 */
export function PremiumCelebrationHost() {
  const { session, profile, isDemoMode } = useAuth();
  const [visible, setVisible] = useState(false);

  const userId = session?.user?.id;
  const coupleId = profile?.coupleId;
  const isPremium = profile?.isPremium;

  useEffect(() => {
    if (isDemoMode || !userId || !coupleId || isPremium === undefined) return;
    let cancelled = false;
    const key = premiumSeenKey(userId, coupleId);

    (async () => {
      try {
        const last = await AsyncStorage.getItem(key);
        const now = isPremium ? "1" : "0";
        if (cancelled) return;
        // last === null: bu cihaz ilk kez görüyor → sadece kaydet (var olan Premium kutlama sayılmaz)
        if (last === "0" && isPremium && !isPremiumCelebrationSuppressed()) setVisible(true);
        if (last !== now) await AsyncStorage.setItem(key, now);
      } catch {
        // depolama yoksa kutlama atlanır; yanlış yere göstermektense sessiz kalmak daha güvenli
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDemoMode, userId, coupleId, isPremium]);

  if (!visible) return null;
  return (
    <PremiumSuccessModal
      visible
      subtitle="Partnerin Premium'a geçti! Artık ikiniz de Premium üyesiniz; bütün sınırlar kalktı, aşkınızın tadını sınırsızca çıkarabilirsiniz."
      onClose={() => setVisible(false)}
    />
  );
}
