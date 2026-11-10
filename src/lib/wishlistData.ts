import { supabase } from "@/lib/supabase";
import { DEMO_WISHLIST } from "@/constants/demoData";
import {
  WISHLIST_DONE_PAGE_SIZE,
  WISHLIST_OPEN_FETCH_LIMIT,
  normalizeWishlistCategory,
  openWishlistItems,
  pageDoneItems,
  type WishlistCategory,
  type WishlistDonePage,
  type WishlistItem,
} from "@/lib/wishlist";
import { wishlistMock } from "@/lib/wishlistMock";
import { WISHLIST_SERVER_READY as SERVER_READY } from "@/lib/wishlistAvailability";
import { WISHLIST_WRITE_DENIED } from "@/lib/wishlistErrors";

export { WISHLIST_WRITE_DENIED };

/**
 * Ortak listenin veri katmanı: ekran yalnızca buradaki işlevleri bilir.
 * Sözleşme: docs/ORTAK_LISTE_PLANI.md bölüm 4.
 *
 * Bayrak wishlistAvailability.ts'te: Faz 1A (migration) canlıya çıkınca orada true yapılır; wishlistMock.ts silinir.
 *
 * Okuma iki ayrı sorgudur (yapılanlar biriktikçe açık maddeler okuma sınırının dışına düşmesin):
 *   • açık maddeler: tamamı, en çok WISHLIST_OPEN_FETCH_LIMIT (300 = Premium üst sınırı). Sunucu sınırı KİŞİ
 *     BAŞINA sayar (her kişinin gördüğü açık maddeler): önceki eşleşmeden taşınan maddeleri olan biri, partnerinin
 *     eklemeleriyle 300'den fazla açık madde görebilir; o çok nadir durumda en eski açıklar bu okumaya girmez.
 *     Sayaç, sınır, 🎲 ve "ikimiz de" buradan beslenir.
 *   • yapılanlar: seçili kategoriye göre sunucuda süzülür, WISHLIST_DONE_PAGE_SIZE'lık sayfalarla ve toplam sayıyla
 *     ("Yaptıklarımız (n)") gelir.
 * Demo verisi ve wishlistMock aynı arayüzü sürdürür.
 */

const ITEM_SELECT = "*, couple_wishlist_wants(user_id)";

/**
 * İstemcinin yazabildiği sütunlar: migration 20261109000000'daki sütun yetkileriyle (GRANT INSERT / GRANT UPDATE)
 * birebir aynı olmalı (wishlistColumns.test.ts karşılaştırır). status, done_*, created_at, meeting_id, memory_id
 * sunucunundur; buraya eklenirse test kırılır, sunucu da 42501 ile reddeder.
 */
export const WISHLIST_INSERT_COLUMNS = [
  "couple_id",
  "created_by",
  "title",
  "note",
  "category",
  "location_name",
  "latitude",
  "longitude",
] as const;
export const WISHLIST_UPDATE_COLUMNS = ["title", "note", "category", "location_name", "latitude", "longitude"] as const;

type InsertColumn = (typeof WISHLIST_INSERT_COLUMNS)[number];
type UpdateColumn = (typeof WISHLIST_UPDATE_COLUMNS)[number];

/** Yalnızca izinli sütunları gönderir: tip dışından gelen bir alan (ör. status) istek gövdesine hiç girmez. */
function onlyColumns<K extends string>(row: Record<string, unknown>, columns: readonly K[]): Partial<Record<K, unknown>> {
  const out: Partial<Record<K, unknown>> = {};
  for (const column of columns) if (column in row) out[column] = row[column];
  return out;
}

/** Tüm ortak liste sorgularının öneki: yazımdan sonra hepsi birlikte yenilenir. */
export const wishlistRootKey = (coupleId: number | null | undefined) => ["wishlist", coupleId ?? null] as const;

export const wishlistOpenKey = (coupleId: number | null | undefined, isDemoMode: boolean) =>
  ["wishlist", coupleId ?? null, isDemoMode, "open"] as const;

/** Yapılanların önbelleği kategoriye göre ayrıdır; kategori verilmezse (önek) hepsine ulaşılır. */
export function wishlistDoneKey(
  coupleId: number | null | undefined,
  isDemoMode: boolean,
  category?: WishlistCategory | null
) {
  const prefix = ["wishlist", coupleId ?? null, isDemoMode, "done"] as const;
  return category === undefined ? prefix : ([...prefix, category] as const);
}

function toWishlistItem(row: any): WishlistItem {
  const { couple_wishlist_wants: wants, ...rest } = row;
  return {
    ...rest,
    category: normalizeWishlistCategory(row.category),
    wants: (wants ?? []).map((want: { user_id: string }) => want.user_id),
  };
}

const demoItems = () => DEMO_WISHLIST.map((item) => ({ ...item, wants: [...item.wants] }));

/** Açık maddelerin tamamı (en yeniden eskiye). */
export async function fetchWishlistOpen(params: {
  coupleId: number | null | undefined;
  isDemoMode: boolean;
}): Promise<WishlistItem[]> {
  const { coupleId, isDemoMode } = params;
  if (isDemoMode) return openWishlistItems(demoItems());
  if (!coupleId) return [];
  if (!SERVER_READY) return wishlistMock.listOpen(coupleId);

  const { data, error } = await supabase
    .from("couple_wishlist_items")
    .select(ITEM_SELECT)
    .eq("couple_id", coupleId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(WISHLIST_OPEN_FETCH_LIMIT);
  if (error) throw error;
  return (data ?? []).map(toWishlistItem);
}

/** Yapılanlardan bir sayfa (yapılma tarihine göre en yeniden), seçili kategoriye göre, toplam sayıyla. */
export async function fetchWishlistDonePage(params: {
  coupleId: number | null | undefined;
  isDemoMode: boolean;
  category: WishlistCategory | null;
  offset: number;
  limit?: number;
}): Promise<WishlistDonePage> {
  const { coupleId, isDemoMode, category, offset, limit = WISHLIST_DONE_PAGE_SIZE } = params;
  if (isDemoMode) return pageDoneItems(demoItems(), category, offset, limit);
  if (!coupleId) return { items: [], total: 0, offset };
  if (!SERVER_READY) return wishlistMock.listDone(coupleId, { category, offset, limit });

  let query = supabase
    .from("couple_wishlist_items")
    .select(ITEM_SELECT, { count: "exact" })
    .eq("couple_id", coupleId)
    .eq("status", "done");
  if (category) query = query.eq("category", category);
  const { data, error, count } = await query
    .order("done_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const items = (data ?? []).map(toWishlistItem);
  return { items, total: count ?? offset + items.length, offset };
}

export async function addWishlistItem(input: {
  coupleId: number;
  userId: string;
  title: string;
  category: WishlistCategory;
}): Promise<void> {
  if (!SERVER_READY) return wishlistMock.add(input);

  // "İstiyorum" satırı ekleyen için sunucudaki tetikleyiciyle yazılır
  const row: Partial<Record<InsertColumn, unknown>> = {
    couple_id: input.coupleId,
    created_by: input.userId,
    title: input.title,
    category: input.category,
  };
  const { error } = await supabase.from("couple_wishlist_items").insert(onlyColumns(row, WISHLIST_INSERT_COLUMNS));
  if (error) throw error;
}

/** Düzenlenebilir alanlar: WISHLIST_UPDATE_COLUMNS'tan türetilir (ayrı bir liste tutulmaz). */
export type WishlistItemPatch = Pick<WishlistItem, UpdateColumn>;

/** Yalnızca ekleyen düzenler; RLS aynı kuralı uygular, 0 satır sessiz başarı sayılmasın diye doğrulanır. */
export async function updateWishlistItem(id: number, userId: string, patch: WishlistItemPatch): Promise<void> {
  if (!SERVER_READY) return wishlistMock.update(id, userId, patch);

  const { data, error } = await supabase
    .from("couple_wishlist_items")
    .update(onlyColumns(patch, WISHLIST_UPDATE_COLUMNS))
    .eq("id", id)
    .eq("created_by", userId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(WISHLIST_WRITE_DENIED);
}

export async function deleteWishlistItem(id: number, userId: string): Promise<void> {
  if (!SERVER_READY) return wishlistMock.remove(id, userId);

  const { data, error } = await supabase
    .from("couple_wishlist_items")
    .delete()
    .eq("id", id)
    .eq("created_by", userId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error(WISHLIST_WRITE_DENIED);
}

export async function setWishlistWant(id: number, userId: string, want: boolean): Promise<void> {
  if (!SERVER_READY) return wishlistMock.setWant(id, userId, want);

  const { error } = await supabase.rpc("set_wishlist_want", { p_item_id: id, p_want: want });
  if (error) throw error;
}

export async function setWishlistDone(id: number, userId: string, done: boolean): Promise<void> {
  if (!SERVER_READY) return wishlistMock.setDone(id, userId, done);

  const { error } = await supabase.rpc("set_wishlist_done", { p_item_id: id, p_done: done });
  if (error) throw error;
}
