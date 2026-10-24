import { useCallback, useState } from "react";

/**
 * Listelerde "çekip yenile" için durum yönetimi. Yalnızca kullanıcının başlattığı yenilemede
 * döner; arka planda (bildirim / öne gelme) yenilenen sorgular ekranda animasyon göstermez.
 */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch {
      // Hata sorgunun kendi durumunda tutulur; gösterge yine de kapanmalı
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return { refreshing, onRefresh };
}
