import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Image, type ImageSource } from "expo-image";
import { supabase } from "@/lib/supabase";
import { logger } from "@/utils/logger";

/**
 * Özel (private) bucket'lardaki görseller için süreli imzalı URL'ler.
 *
 * Veritabanında yalnızca depolama yolu (`<couple_id>/...`) saklanır. Ekranlar görseli çizerken
 * yollar aynı karede toplanıp tek istekte imzalanır (`createSignedUrls`), URL'ler süreleri dolana
 * kadar bellekte tekrar kullanılır. expo-image'e `cacheKey` olarak yol verildiği için URL her
 * imzalamada değişse de disk önbelleği aynı görseli tanır: bir kez inen fotoğraf tekrar inmez,
 * imzalanamadığında (çevrimdışı) da diskteki kopyası gösterilir.
 */

export type PrivateBucket = "photos" | "memories";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
/** Süresi dolmak üzere olan URL yenilenir; görsel yüklenirken geçersizleşmesin. */
const RENEW_BEFORE_MS = 5 * 60 * 1000;
/** İmzalanamayan yol (çevrimdışı, yetki yok) bu süre dolmadan yeniden denenmez. */
const RETRY_AFTER_MS = 30 * 1000;
const SIGN_BATCH_SIZE = 100;

type Entry = { uri: string; expiresAt: number; local: boolean };

const entries = new Map<string, Entry>();
const failedAt = new Map<string, number>();
const queued = new Map<PrivateBucket, Set<string>>();
const inFlight = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;
let flushScheduled = false;
// Oturum değişince artar: önceki oturumun yanıtı gelirse önbelleğe yazılmaz
let generation = 0;

const cacheKeyOf = (bucket: PrivateBucket, path: string) => `${bucket}/${path}`;

/** Demo verisindeki uzak URL'ler ve yerel dosyalar imzalanmadan kullanılır. */
const isDirectUri = (value: string) => /^(https?|file|data|content|ph):/i.test(value);

function notify() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getVersion = () => version;

function displayableEntry(key: string): Entry | undefined {
  const entry = entries.get(key);
  if (!entry) return undefined;
  return entry.local || entry.expiresAt > Date.now() ? entry : undefined;
}

function requestSigning(bucket: PrivateBucket, path: string) {
  const key = cacheKeyOf(bucket, path);
  if (inFlight.has(key)) return;
  const entry = entries.get(key);
  if (entry && !entry.local && entry.expiresAt - Date.now() > RENEW_BEFORE_MS) return;
  const lastFailure = failedAt.get(key);
  if (lastFailure !== undefined && Date.now() - lastFailure < RETRY_AFTER_MS) return;

  let paths = queued.get(bucket);
  if (!paths) {
    paths = new Set();
    queued.set(bucket, paths);
  }
  paths.add(path);
  if (!flushScheduled) {
    flushScheduled = true;
    setTimeout(flushQueue, 0);
  }
}

function flushQueue() {
  flushScheduled = false;
  const batches = [...queued.entries()];
  queued.clear();
  for (const [bucket, paths] of batches) {
    const list = [...paths];
    for (let i = 0; i < list.length; i += SIGN_BATCH_SIZE) {
      signBatch(bucket, list.slice(i, i + SIGN_BATCH_SIZE)).catch((err) => {
        logger.warn("[storageImages] imzalama başarısız:", err);
      });
    }
  }
}

async function signBatch(bucket: PrivateBucket, paths: string[]) {
  const batchGeneration = generation;
  paths.forEach((path) => inFlight.add(cacheKeyOf(bucket, path)));

  const signed = new Set<string>();
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (error) throw error;
    if (batchGeneration !== generation) return;
    const expiresAt = Date.now() + SIGNED_URL_TTL_SECONDS * 1000;
    for (const item of data) {
      if (!item.path || !item.signedUrl || item.error) continue;
      const key = cacheKeyOf(bucket, item.path);
      entries.set(key, { uri: item.signedUrl, expiresAt, local: false });
      failedAt.delete(key);
      signed.add(item.path);
    }
  } catch (err) {
    logger.warn(`[storageImages] ${bucket} imzalanamadı:`, err);
  } finally {
    paths.forEach((path) => inFlight.delete(cacheKeyOf(bucket, path)));
  }
  if (batchGeneration !== generation) return;

  // İmzalanamayanlar: diskte önbellekli kopyası varsa o gösterilir (ör. çevrimdışı açılış)
  const failed = paths.filter((path) => !signed.has(path));
  await Promise.all(
    failed.map(async (path) => {
      const key = cacheKeyOf(bucket, path);
      failedAt.set(key, Date.now());
      if (displayableEntry(key)) return;
      const cachedPath = await Image.getCachePathAsync(key).catch(() => null);
      if (cachedPath && batchGeneration === generation) {
        const uri = cachedPath.startsWith("file://") ? cachedPath : `file://${cachedPath}`;
        entries.set(key, { uri, expiresAt: Number.POSITIVE_INFINITY, local: true });
      }
    })
  );
  notify();
}

/**
 * Özel bucket'taki bir görselin expo-image kaynağını verir; URL hazır olana kadar null döner.
 * `pathOrUri` bucket içindeki yoldur (demo verisinde tam URL de olabilir).
 */
export function useStorageImage(bucket: PrivateBucket, pathOrUri: string | null | undefined): ImageSource | null {
  const storeVersion = useSyncExternalStore(subscribe, getVersion);
  const value = pathOrUri?.trim() || null;
  const direct = value !== null && isDirectUri(value);
  const key = value !== null && !direct ? cacheKeyOf(bucket, value) : null;

  useEffect(() => {
    if (key && value) requestSigning(bucket, value);
  }, [bucket, key, value, storeVersion]);

  const uri = direct ? value : key ? displayableEntry(key)?.uri : undefined;
  return useMemo(() => {
    if (!uri) return null;
    return key ? { uri, cacheKey: key } : { uri };
  }, [uri, key]);
}

/**
 * Yeni yüklenen görseli, ağdan tekrar indirmeden gösterilebilsin diye yerel dosyadan disk
 * önbelleğine yazar (imzalı URL geldiğinde aynı `cacheKey` ile önbellekten açılır).
 */
export function seedStorageImage(bucket: PrivateBucket, path: string, localUri: string) {
  Image.writeToCacheAsync(localUri, cacheKeyOf(bucket, path)).catch(() => {});
}

/** Silinen dosyaları siler; hata kayıt silinmesini geri almaz, yalnızca loglanır. */
export async function removeStoredFiles(bucket: PrivateBucket, paths: (string | null | undefined)[]) {
  const files = paths.filter((path): path is string => !!path && !isDirectUri(path));
  if (files.length === 0) return;
  const { error } = await supabase.storage.from(bucket).remove(files);
  if (error) logger.warn(`[storageImages] ${bucket} dosyaları silinemedi:`, error.message);
}

/**
 * Çıkışta çağrılır: imzalı URL'ler ve önceki hesabın fotoğraflarını tutan görsel önbellekleri
 * (bellek + disk) temizlenir; aynı cihazda açılan başka hesap bunlara ulaşamaz.
 */
export async function clearStorageImages() {
  generation += 1;
  entries.clear();
  failedAt.clear();
  queued.clear();
  inFlight.clear();
  notify();
  await Promise.all([
    Image.clearMemoryCache().catch(() => false),
    Image.clearDiskCache().catch(() => false),
  ]);
}
