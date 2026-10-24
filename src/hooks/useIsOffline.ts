import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";

/** Cihazın internete erişemediği süre boyunca true döner. Henüz bilinmiyorsa çevrimiçi sayılır. */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return unsubscribe;
  }, []);

  return offline;
}

/**
 * React Query'yi gerçek bağlantı durumuna bağlar: çevrimdışıyken istekler boşuna denenip hata vermez,
 * bağlantı dönünce bekleyen sorgular kendiliğinden yeniden çalışır.
 */
export function bindQueryOnlineManager() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    })
  );
}
