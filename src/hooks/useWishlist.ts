import { useCallback, useRef } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type Query,
  type QueryClient,
} from "@tanstack/react-query";
import {
  addWishlistItem,
  deleteWishlistItem,
  fetchWishlistDonePage,
  fetchWishlistOpen,
  setWishlistDone,
  setWishlistWant,
  updateWishlistItem,
  wishlistDoneKey,
  wishlistOpenKey,
  wishlistRootKey,
  type WishlistItemPatch,
  type WishlistNewItem,
} from "@/lib/wishlistData";
import { classifyWishlistError, type WishlistErrorKind } from "@/lib/wishlistErrors";
import {
  activeWishlistFilter,
  nextDoneOffset,
  placeDoneItem,
  placeOpenItem,
  type WishlistCategory,
  type WishlistDoneCache,
  type WishlistItem,
} from "@/lib/wishlist";

/** "ok" ya da hatanın türü (wishlistErrors.ts): ekran türe göre paywall, eşleşme ya da metin gösterir. */
export type WishlistWriteResult = "ok" | WishlistErrorKind;

const STALE_MS = 1000 * 60 * 2;
const EMPTY: WishlistItem[] = [];

/**
 * Tek maddeyi açık ve yapılanlar önbelleklerinin hepsinde yerine koyar (next null: kaldırır). İyimser güncelleme
 * ve geri alma bunu kullanır: başka maddelere ve onlardaki süren değişikliklere dokunulmaz.
 */
export function placeWishlistItem(
  queryClient: QueryClient,
  keys: { coupleId: number | null | undefined; isDemoMode: boolean },
  id: number,
  next: WishlistItem | null
): void {
  queryClient.setQueryData<WishlistItem[]>(wishlistOpenKey(keys.coupleId, keys.isDemoMode), (open) =>
    placeOpenItem(open, id, next)
  );
  for (const [key, cache] of queryClient.getQueriesData<WishlistDoneCache>({
    queryKey: wishlistDoneKey(keys.coupleId, keys.isDemoMode),
  })) {
    const category = (key[4] ?? null) as WishlistCategory | null;
    queryClient.setQueryData(key, placeDoneItem(cache, category, id, next));
  }
}

/** Önbelleklerdeki güncel hâli (açıklarda yoksa yüklenmiş yapılan sayfalarında). */
function findCachedItem(
  queryClient: QueryClient,
  keys: { coupleId: number | null | undefined; isDemoMode: boolean },
  id: number
): WishlistItem | null {
  const open = queryClient.getQueryData<WishlistItem[]>(wishlistOpenKey(keys.coupleId, keys.isDemoMode));
  const inOpen = open?.find((item) => item.id === id);
  if (inOpen) return inOpen;
  for (const [, cache] of queryClient.getQueriesData<WishlistDoneCache>({
    queryKey: wishlistDoneKey(keys.coupleId, keys.isDemoMode),
  })) {
    for (const page of cache?.pages ?? []) {
      const found = page.items.find((item) => item.id === id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * İyimser yazımdan önce iptal edilecek okumalar: yolda olan bir yenileme iyimser değişikliği ezmesin. "Daha fazla
 * göster" (fetchNextPage) iptal edilmez: kullanıcının istediği sayfa sessizce düşerdi. O sayfa iyimser değişikliği
 * kısa süre geri gösterse bile yazım bitince yapılan yenileme düzeltir.
 */
export function shouldCancelBeforeOptimistic(query: Pick<Query, "state">): boolean {
  const fetchMeta = query.state.fetchMeta as { fetchMore?: unknown } | null | undefined;
  return !(query.state.fetchStatus === "fetching" && fetchMeta?.fetchMore);
}

/**
 * Listeyi okur ve yazar. Açık maddeler tek sorguda (sayaç, sınır, 🎲 ve "ikimiz de" buradan), yapılanlar seçili
 * kategoriye göre sayfalı ve toplam sayıyla gelir (wishlistData.ts).
 *
 * 💗 ve "yaptık" anında görünsün diye iyimser günceller. Hata olursa YALNIZCA o madde eski hâline döner (aynı
 * anda süren başka maddelerin değişiklikleri ezilmez). Liste sunucudan, süren yazım kalmayınca bir kez yenilenir.
 */
export function useWishlist(params: {
  coupleId: number | null | undefined;
  userId: string | null;
  isDemoMode: boolean;
  /** Ekranda seçili kategori (null: tümü). Yapılanlar geçerli filtreye (activeWishlistFilter) göre süzülür. */
  filter: WishlistCategory | null;
}) {
  const { coupleId, userId, isDemoMode, filter } = params;
  const queryClient = useQueryClient();
  const enabled = !!coupleId || isDemoMode;
  // Aynı maddede üst üste basılınca istekler birbirini ezmesin
  const inFlight = useRef(new Set<number>());
  // Süren tüm yazımlar (ekleme, düzenleme, silme dahil): yenileme yalnızca sayaç sıfırlanınca
  const pendingWrites = useRef(0);
  // Yenilemeyi bekleyen yazımlar (ör. ekleme): o an başka yazım sürüyorsa, sürenler bitip yenileme yapılınca uyanır
  const refreshWaiters = useRef<(() => void)[]>([]);

  const openQuery = useQuery({
    queryKey: wishlistOpenKey(coupleId, isDemoMode),
    enabled,
    queryFn: () => fetchWishlistOpen({ coupleId, isDemoMode }),
    staleTime: STALE_MS,
  });

  // Hiç açık madde yokken seçili kalmış kategori uygulanmaz (ekranla aynı kural)
  const doneCategory = activeWishlistFilter(openQuery.data ?? EMPTY, filter);
  const doneQuery = useInfiniteQuery({
    queryKey: wishlistDoneKey(coupleId, isDemoMode, doneCategory),
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchWishlistDonePage({ coupleId, isDemoMode, category: doneCategory, offset: pageParam as number }),
    getNextPageParam: (_last, pages) => nextDoneOffset(pages),
    staleTime: STALE_MS,
    // Kategori değişince yeni anahtarın ilk sayfası gelene kadar önceki sayfalar görünür (bölüm boşalıp dolmaz)
    placeholderData: keepPreviousData,
  });

  /**
   * Bir yazımı sarar: bitince, başka yazım sürmüyorsa liste sunucudan yenilenir. Ekleme/düzenleme/silme yenilemeyi
   * bekler (madde ekranda belirince kutu temizlenir, fikir çipinin kilidi açılır); o an başka yazım sürüyorsa
   * onların bitip yenilemenin yapılmasını bekler. İyimser yazımlar beklemez (hata mesajı gecikmesin).
   */
  const tracked = useCallback(
    async <T,>(write: () => Promise<T>, awaitRefresh = true): Promise<T> => {
      pendingWrites.current += 1;
      try {
        return await write();
      } finally {
        pendingWrites.current -= 1;
        if (pendingWrites.current === 0) {
          const waiters = refreshWaiters.current.splice(0);
          const refresh = queryClient
            .invalidateQueries({ queryKey: wishlistRootKey(coupleId) })
            .catch(() => {})
            .finally(() => waiters.forEach((wake) => wake()));
          if (awaitRefresh) await refresh;
        } else if (awaitRefresh) {
          await new Promise<void>((wake) => refreshWaiters.current.push(wake));
        }
      }
    },
    [queryClient, coupleId]
  );

  const optimistic = useCallback(
    (
      itemId: number,
      patch: (item: WishlistItem) => WishlistItem,
      write: () => Promise<void>
    ): Promise<WishlistWriteResult> => {
      if (inFlight.current.has(itemId)) return Promise.resolve("ok");
      inFlight.current.add(itemId);
      const keys = { coupleId, isDemoMode };
      return tracked(async (): Promise<WishlistWriteResult> => {
        try {
          // Yolda olan bir okuma iyimser değişikliği ezmesin
          await queryClient.cancelQueries({ queryKey: wishlistRootKey(coupleId), predicate: shouldCancelBeforeOptimistic });
          const before = findCachedItem(queryClient, keys, itemId);
          if (before) placeWishlistItem(queryClient, keys, itemId, patch(before));
          try {
            await write();
            return "ok";
          } catch (error) {
            // Yalnızca bu madde eski hâline döner
            if (before) placeWishlistItem(queryClient, keys, itemId, before);
            // "Yaptık"ı geri almak listeyi yeniden doldurur: sunucu kapasite doluysa bunu da reddeder (limit)
            return classifyWishlistError(error);
          }
        } finally {
          inFlight.current.delete(itemId);
        }
      }, false);
    },
    [queryClient, coupleId, isDemoMode, tracked]
  );

  const toggleWant = useCallback(
    (item: WishlistItem): Promise<WishlistWriteResult> => {
      if (!userId) return Promise.resolve("denied");
      const want = !item.wants.includes(userId);
      return optimistic(
        item.id,
        (current) => ({
          ...current,
          wants: want ? [...new Set([...current.wants, userId])] : current.wants.filter((id) => id !== userId),
        }),
        () => setWishlistWant(item.id, userId, want)
      );
    },
    [optimistic, userId]
  );

  const toggleDone = useCallback(
    (item: WishlistItem): Promise<WishlistWriteResult> => {
      if (!userId) return Promise.resolve("denied");
      const done = item.status !== "done";
      return optimistic(
        item.id,
        (current) => ({
          ...current,
          status: done ? "done" : "open",
          done_at: done ? new Date().toISOString() : null,
          done_by: done ? userId : null,
        }),
        () => setWishlistDone(item.id, userId, done)
      );
    },
    [optimistic, userId]
  );

  /** Hızlı ekleme yalnızca başlık ve kategori, ayrıntılı ekleme not ve konumu da verir (boş alanlar null). */
  const addItem = useCallback(
    (item: WishlistNewItem): Promise<WishlistWriteResult> => {
      if (!coupleId || !userId) return Promise.resolve("denied");
      return tracked(async () => {
        try {
          await addWishlistItem({ coupleId, userId, item });
          return "ok";
        } catch (error) {
          return classifyWishlistError(error);
        }
      });
    },
    [coupleId, userId, tracked]
  );

  const saveItem = useCallback(
    (id: number, patch: WishlistItemPatch): Promise<WishlistWriteResult> => {
      if (!userId) return Promise.resolve("denied");
      // Reddedilen (silinmiş / başkasının) madde de yenilemeyle ekranda güncel hâliyle görünür
      return tracked(async () => {
        try {
          await updateWishlistItem(id, userId, patch);
          return "ok";
        } catch (error) {
          return classifyWishlistError(error);
        }
      });
    },
    [userId, tracked]
  );

  const removeItem = useCallback(
    (id: number): Promise<WishlistWriteResult> => {
      if (!userId) return Promise.resolve("denied");
      return tracked(async () => {
        try {
          await deleteWishlistItem(id, userId);
          return "ok";
        } catch (error) {
          return classifyWishlistError(error);
        }
      });
    },
    [userId, tracked]
  );

  const refetch = useCallback(
    () => Promise.all([openQuery.refetch(), doneQuery.refetch()]),
    [openQuery, doneQuery]
  );

  const doneItems = doneQuery.data?.pages.flatMap((page) => page.items) ?? EMPTY;
  const doneTotal = doneQuery.data?.pages[0]?.total ?? 0;

  return {
    /** Açık maddelerin tamamı; yüklenmediyse undefined */
    openItems: openQuery.data,
    /** Yapılanların yüklenmiş sayfaları (seçili kategori) */
    doneItems,
    /** Seçili kategorideki yapılanların toplamı ("Yaptıklarımız (n)") */
    doneTotal,
    doneHasMore: !!doneQuery.hasNextPage,
    loadMoreDone: doneQuery.fetchNextPage,
    isLoadingMoreDone: doneQuery.isFetchingNextPage,
    /**
     * Ekranın durumu YALNIZCA açık maddelere bağlıdır: açık liste ve çipler yapılanlar sorgusunu beklemez,
     * yapılanların hatası ya da çevrimdışı kalması açık listeyi gizlemez.
     */
    isLoaded: openQuery.data !== undefined,
    isError: openQuery.isError,
    isPaused: openQuery.fetchStatus === "paused",
    /** "Yaptıklarımız" bölümünün kendi durumu */
    done: {
      /** Hiç veri yok (ilk yükleme sürüyor ya da çevrimdışı bekliyor) */
      isInitialLoading: doneQuery.data === undefined && !doneQuery.isError,
      /** Kategori değişti: önceki kategorinin sayfaları gösteriliyor, yenisi yükleniyor */
      isSwitching: doneQuery.isPlaceholderData,
      /** Gösterilecek veri yok ve sorgu hata verdi */
      isError: doneQuery.isError && doneQuery.data === undefined,
      isPaused: doneQuery.fetchStatus === "paused",
      retry: doneQuery.refetch,
    },
    refetch,
    toggleWant,
    toggleDone,
    addItem,
    saveItem,
    removeItem,
  };
}
