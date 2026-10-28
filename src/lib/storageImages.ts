import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
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
 *
 * Her görsel yalnızca kendi yoluna abone olur: bir yolun URL'i değişince yalnızca o yolu gösteren
 * bileşenler yeniden çizilir. (Eskiden tek bir genel sayaç vardı; galeride kaydırırken imzalanan
 * her yeni grup, açık sekmelerdeki bütün görselleri birden yeniden çiziyordu.) Ekrandaki görsellerin
 * yeniden denenmesi ve süresi dolmadan yenilenmesi de burada, zamanlayıcılarla yapılır.
 */

export type PrivateBucket = "photos" | "memories";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
/** Süresi dolmak üzere olan URL yenilenir; görsel yüklenirken geçersizleşmesin. */
const RENEW_BEFORE_MS = 5 * 60 * 1000;
/** İmzalanamayan yol (çevrimdışı, geçici ağ hatası) önce 5 sn sonra, sonra artan aralıklarla yeniden denenir. */
const RETRY_AFTER_MS = 5 * 1000;
const MAX_RETRY_AFTER_MS = 2 * 60 * 1000;
const SIGN_BATCH_SIZE = 100;

type Entry = { uri: string; expiresAt: number; local: boolean };
type Failure = { at: number; count: number };

const entries = new Map<string, Entry>();
const failures = new Map<string, Failure>();
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAt = 0;
let renewTimer: ReturnType<typeof setTimeout> | null = null;
let renewAt = 0;
const queued = new Map<PrivateBucket, Set<string>>();
const inFlight = new Set<string>();
/** Yol (cacheKey) → o yolu gösteren bileşenlerin dinleyicileri. Anahtar varsa görsel ekrandadır. */
const keyListeners = new Map<string, Set<() => void>>();
let flushScheduled = false;
// Oturum değişince artar: önceki oturumun yanıtı gelirse önbelleğe yazılmaz
let generation = 0;

const normalizePath = (path: string) => path.trim().replace(/^\/+/, "");

const cacheKeyOf = (bucket: PrivateBucket, path: string) => `${bucket}/${normalizePath(path)}`;

/** cacheKeyOf'un tersi (bucket adlarında "/" yoktur). */
function parseCacheKey(key: string): [PrivateBucket, string] {
  const slash = key.indexOf("/");
  return [key.slice(0, slash) as PrivateBucket, key.slice(slash + 1)];
}

/** Demo verisindeki uzak URL'ler ve yerel dosyalar imzalanmadan kullanılır. */
const isDirectUri = (value: string) => /^(https?|file|data|content|ph):/i.test(value.trim());

function notifyKeys(keys: Iterable<string>) {
  for (const key of keys) keyListeners.get(key)?.forEach((listener) => listener());
}

function notifyAll() {
  keyListeners.forEach((listeners) => listeners.forEach((listener) => listener()));
}

function subscribeKey(key: string, listener: () => void) {
  let listeners = keyListeners.get(key);
  if (!listeners) {
    listeners = new Set();
    keyListeners.set(key, listeners);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && keyListeners.get(key) === listeners) keyListeners.delete(key);
  };
}

const retryDelayOf = (failure: Failure) =>
  Math.min(RETRY_AFTER_MS * 2 ** (failure.count - 1), MAX_RETRY_AFTER_MS);

/** Bekleme süresi dolan ve hâlâ ekranda olan başarısız yollar yeniden imzalatılır. */
function scheduleRetry(delayMs: number) {
  const at = Date.now() + delayMs;
  if (retryTimer && retryAt <= at) return;
  if (retryTimer) clearTimeout(retryTimer);
  retryAt = at;
  retryTimer = setTimeout(retryFailed, delayMs);
}

function retryFailed() {
  retryTimer = null;
  const now = Date.now();
  let nextMs = Number.POSITIVE_INFINITY;
  for (const [key, failure] of failures) {
    // Ekranda değilse bir sonraki görünüşünde (bileşen bağlanınca) istenir
    if (!keyListeners.has(key)) continue;
    const waitMs = failure.at + retryDelayOf(failure) - now;
    if (waitMs <= 0) requestSigning(...parseCacheKey(key));
    else nextMs = Math.min(nextMs, waitMs);
  }
  if (nextMs < Number.POSITIVE_INFINITY) scheduleRetry(nextMs);
}

/** Ekrandaki görsellerin URL'leri süreleri dolmadan yenilenir; dolarsa görsel bir an boş kalırdı. */
function scheduleRenewal(at: number) {
  if (renewTimer && renewAt <= at) return;
  if (renewTimer) clearTimeout(renewTimer);
  renewAt = at;
  renewTimer = setTimeout(renewExpiring, Math.max(0, at - Date.now()));
}

function renewExpiring() {
  renewTimer = null;
  const now = Date.now();
  let nextAt = Number.POSITIVE_INFINITY;
  for (const [key, entry] of entries) {
    if (entry.local || !keyListeners.has(key)) continue;
    const dueAt = entry.expiresAt - RENEW_BEFORE_MS;
    if (dueAt <= now) requestSigning(...parseCacheKey(key));
    else nextAt = Math.min(nextAt, dueAt);
  }
  if (nextAt < Number.POSITIVE_INFINITY) scheduleRenewal(nextAt);
}

function displayableEntry(key: string): Entry | undefined {
  const entry = entries.get(key);
  if (!entry) return undefined;
  return entry.local || entry.expiresAt > Date.now() ? entry : undefined;
}

function requestSigning(bucket: PrivateBucket, rawPath: string) {
  const path = normalizePath(rawPath);
  if (!path) return;
  const key = cacheKeyOf(bucket, path);
  if (inFlight.has(key)) return;
  const entry = entries.get(key);
  if (entry && !entry.local && entry.expiresAt - Date.now() > RENEW_BEFORE_MS) return;
  const failure = failures.get(key);
  if (failure && Date.now() - failure.at < retryDelayOf(failure)) return;

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
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item.error) {
          logger.warn(`[storageImages] ${bucket} imzalama hatası (${item.path}):`, item.error);
          continue;
        }
        if (!item.path || !item.signedUrl) continue;
        const normItemPath = normalizePath(item.path);
        const key = cacheKeyOf(bucket, normItemPath);
        entries.set(key, { uri: item.signedUrl, expiresAt, local: false });
        failures.delete(key);
        signed.add(item.path);
        signed.add(normItemPath);
      }
      if (signed.size > 0) scheduleRenewal(expiresAt - RENEW_BEFORE_MS);
    }
  } catch (err) {
    logger.warn(`[storageImages] ${bucket} imzalanamadı:`, err);
  } finally {
    paths.forEach((path) => inFlight.delete(cacheKeyOf(bucket, path)));
  }
  if (batchGeneration !== generation) return;

  // İmzalanamayanlar: diskte önbellekli kopyası varsa o gösterilir (ör. çevrimdışı açılış)
  const failed = paths.filter((path) => !signed.has(path) && !signed.has(normalizePath(path)));
  let nextRetryMs = Number.POSITIVE_INFINITY;
  for (const path of failed) {
    const key = cacheKeyOf(bucket, path);
    const failure = { at: Date.now(), count: (failures.get(key)?.count ?? 0) + 1 };
    failures.set(key, failure);
    nextRetryMs = Math.min(nextRetryMs, retryDelayOf(failure));
  }
  if (failed.length > 0) scheduleRetry(nextRetryMs);
  await Promise.all(
    failed.map(async (path) => {
      const key = cacheKeyOf(bucket, path);
      if (displayableEntry(key)) return;
      const cachedPath = await Image.getCachePathAsync(key).catch(() => null);
      if (cachedPath && batchGeneration === generation) {
        const uri = cachedPath.startsWith("file://") ? cachedPath : `file://${cachedPath}`;
        entries.set(key, { uri, expiresAt: Number.POSITIVE_INFINITY, local: true });
      }
    })
  );
  if (batchGeneration !== generation) return;
  // Yalnızca bu partideki yolları gösteren görseller yeniden çizilir
  notifyKeys(paths.map((path) => cacheKeyOf(bucket, path)));
}

/**
 * Özel bucket'taki bir görselin expo-image kaynağını verir; URL hazır olana kadar null döner.
 * `pathOrUri` bucket içindeki yoldur (demo verisinde tam URL de olabilir).
 */
export function useStorageImage(bucket: PrivateBucket, pathOrUri: string | null | undefined): ImageSource | null {
  const value = pathOrUri?.trim() || null;
  const direct = value !== null && isDirectUri(value);
  const key = value !== null && !direct ? cacheKeyOf(bucket, value) : null;

  // URL anlık görüntüden okunmalı: render içinde Map'ten okunursa React Compiler sonucu yalnızca
  // key'e göre önbelleğe alıyor, imza gelince görsel ekran yeniden açılana kadar boş kalıyordu.
  // Abonelik yalnızca bu görselin yolunadır; başka yolların imzası bu bileşeni çizdirmez.
  const subscribeToKey = useCallback(
    (listener: () => void) => (key ? subscribeKey(key, listener) : () => {}),
    [key]
  );
  const signedUri = useSyncExternalStore(subscribeToKey, () => (key ? displayableEntry(key)?.uri : undefined));

  // Bağlanınca ve bu görselin URL'i değişince (ör. süresi dolup düştüyse) imza istenir; taze URL
  // varsa requestSigning hiçbir şey yapmaz. Yeniden deneme ve yenileme zamanlayıcılarla yapılır.
  useEffect(() => {
    if (key && value) requestSigning(bucket, value);
  }, [bucket, key, value, signedUri]);

  const uri = direct ? value : signedUri;
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
  failures.clear();
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  if (renewTimer) clearTimeout(renewTimer);
  renewTimer = null;
  queued.clear();
  inFlight.clear();
  notifyAll();
  await Promise.all([
    Image.clearMemoryCache().catch(() => false),
    Image.clearDiskCache().catch(() => false),
  ]);
}
