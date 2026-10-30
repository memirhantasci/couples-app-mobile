import { useCallback, useEffect, useRef, useState } from 'react';
import { safeStorage } from '@/lib/safeStorage';
import { starService } from '../api/starService';
import type { MakeWishResult, WishStatus } from '../types/star.types';

/** Next local midnight, ISO; the wish right renews then in demo mode. */
function nextLocalMidnightIso(): string {
  const next = new Date();
  next.setHours(24, 0, 0, 0);
  return next.toISOString();
}

const STORAGE_PREFIX = 'stars.wish.usedUntil.';

/**
 * When today's used wish renews, per owner ('local' or a user id), in epoch
 * ms. Kept for the app's lifetime and on disk, so leaving the sky and coming
 * back (or restarting the app) never hands out a second wish before the
 * status arrives from the server, or at all in local mode.
 */
const usedUntilByOwner = new Map<string, number>();

function rememberUsed(owner: string, resetsAt: string) {
  const until = Date.parse(resetsAt);
  if (!Number.isFinite(until) || until <= Date.now()) return;
  if ((usedUntilByOwner.get(owner) ?? 0) >= until) return;
  usedUntilByOwner.set(owner, until);
  safeStorage.setItem(STORAGE_PREFIX + owner, String(until)).catch(() => {});
}

function isRememberedUsed(owner: string): boolean {
  return (usedUntilByOwner.get(owner) ?? 0) > Date.now();
}

/**
 * Today's shooting-star wish (one per person per day).
 *
 * The status is asked when the sky opens; a catch before it arrives waits for
 * it (see checkUsedToday). A used wish is also remembered on the device until
 * it renews. `local` mode (demo / no session) has no server: the right is
 * kept on the device only and gives no light.
 */
export function useDailyWish(mode: 'server' | 'local', userId?: string | null) {
  const owner = mode === 'local' ? 'local' : `user.${userId ?? 'anonymous'}`;
  const [status, setStatus] = useState<WishStatus | null>(null);
  // Callbacks read the latest status without re-subscribing.
  const statusRef = useRef<WishStatus | null>(null);
  const pendingRef = useRef<Promise<WishStatus | null> | null>(null);
  /** Reading the remembered wish from disk. */
  const storedRef = useRef<Promise<void>>(Promise.resolve());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const applyStatus = useCallback(
    (next: WishStatus) => {
      if (next.used_today) rememberUsed(owner, next.resets_at);
      if (!isMountedRef.current) return;
      statusRef.current = next;
      setStatus(next);
    },
    [owner],
  );

  const refresh = useCallback((): Promise<WishStatus | null> => {
    if (mode === 'local') return Promise.resolve(null);
    const request = starService
      .getMyWishStatus()
      .then((next) => {
        applyStatus(next);
        return next;
      })
      .catch(() => null)
      .finally(() => {
        if (pendingRef.current === request) pendingRef.current = null;
      });
    pendingRef.current = request;
    return request;
  }, [mode, applyStatus]);

  useEffect(() => {
    statusRef.current = null;
    storedRef.current = usedUntilByOwner.has(owner)
      ? Promise.resolve()
      : safeStorage
          .getItem(STORAGE_PREFIX + owner)
          .then((stored) => {
            const until = Number(stored);
            if (Number.isFinite(until) && until > (usedUntilByOwner.get(owner) ?? 0)) {
              usedUntilByOwner.set(owner, until);
            }
          })
          .catch(() => {});
    refresh();
  }, [owner, refresh]);

  /** Whether today's wish is known to be used; once the day turns over the right is back. */
  const isUsedToday = useCallback(() => {
    if (isRememberedUsed(owner)) return true;
    const current = statusRef.current;
    if (!current?.used_today) return false;
    return Date.now() < Date.parse(current.resets_at);
  }, [owner]);

  /**
   * Like isUsedToday, but what is still loading (the remembered wish on disk,
   * the server's status) is waited for, or asked again if it failed, so a
   * quick catch can't slip past a used wish.
   */
  const checkUsedToday = useCallback(async () => {
    await storedRef.current;
    if (isUsedToday() || mode === 'local' || statusRef.current) return isUsedToday();
    await (pendingRef.current ?? refresh());
    return isUsedToday();
  }, [isUsedToday, mode, refresh]);

  /** Uses today's wish. The wish text is never sent. */
  const makeWish = useCallback(async (): Promise<MakeWishResult> => {
    const result: MakeWishResult =
      mode === 'local'
        ? { ok: true, points: 0, resets_at: nextLocalMidnightIso() }
        : await starService.makeWish();
    applyStatus({
      available: false,
      used_today: true,
      partner_used_today: statusRef.current?.partner_used_today ?? false,
      resets_at: result.resets_at,
    });
    return result;
  }, [mode, applyStatus]);

  return {
    partnerWishedToday: status?.partner_used_today ?? false,
    isUsedToday,
    checkUsedToday,
    makeWish,
    refresh,
  };
}
