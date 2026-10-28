import { useCallback, useEffect, useRef, useState } from 'react';
import { starService } from '../api/starService';
import type { MakeWishResult, WishStatus } from '../types/star.types';

/** Next local midnight, ISO; the wish right renews then in demo mode. */
function nextLocalMidnightIso(): string {
  const next = new Date();
  next.setHours(24, 0, 0, 0);
  return next.toISOString();
}

/**
 * Today's shooting-star wish (one per person per day).
 *
 * The status is asked once when the sky opens, so catching a meteor decides
 * at once whether the wish screen opens. `local` mode (demo / no session) has
 * no server: the right is kept in memory for this session and gives no light.
 */
export function useDailyWish(mode: 'server' | 'local') {
  const [status, setStatus] = useState<WishStatus | null>(null);
  // Callbacks read the latest status without re-subscribing.
  const statusRef = useRef<WishStatus | null>(null);

  const applyStatus = useCallback((next: WishStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const refresh = useCallback(() => {
    if (mode === 'local') return;
    starService.getMyWishStatus().then(applyStatus).catch(() => {});
  }, [mode, applyStatus]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Whether today's wish is known to be used; once the day turns over the right is back. */
  const isUsedToday = useCallback(() => {
    const current = statusRef.current;
    if (!current?.used_today) return false;
    return Date.now() < Date.parse(current.resets_at);
  }, []);

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
    makeWish,
    refresh,
  };
}
