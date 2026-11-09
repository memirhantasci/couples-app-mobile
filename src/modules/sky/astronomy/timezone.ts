import tzlookup from "tz-lookup";

import type { SkyTimeAmbiguity, SkyTimeZoneSource } from "./types";

const MS_PER_DAY = 86400000;
const MAX_PLAUSIBLE_OFFSET_MS = 16 * 3600000;
const PROBE_INSTANT_MS = Date.UTC(2000, 0, 1);

/** Verilen UTC anındaki saat dilimi farkı (ms, doğu +). */
export type OffsetAt = (utcMs: number) => number;

export interface ResolvedTimeZone {
  timeZone: string;
  source: SkyTimeZoneSource;
  offsetAt: OffsetAt;
}

export interface WallTimeConversion {
  utcMs: number;
  offsetMs: number;
  ambiguity: SkyTimeAmbiguity;
}

/** `Intl` ile o tarihteki (tarihî yaz saati dahil) farkı okuyan fonksiyon; bölge kullanılamıyorsa null. */
function createIntlOffsetReader(timeZone: string): OffsetAt | null {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    const offsetAt: OffsetAt = (utcMs) => {
      const wholeSecondMs = Math.floor(utcMs / 1000) * 1000;
      const fields: Record<string, number> = {};
      for (const part of formatter.formatToParts(new Date(wholeSecondMs))) {
        if (part.type !== "literal") fields[part.type] = Number(part.value);
      }
      // Bazı motorlar gece yarısını "24" yazar
      const hour = fields.hour === 24 ? 0 : fields.hour;
      return Date.UTC(fields.year, fields.month - 1, fields.day, hour, fields.minute, fields.second) - wholeSecondMs;
    };
    const probe = offsetAt(PROBE_INSTANT_MS);
    return Number.isFinite(probe) && Math.abs(probe) <= MAX_PLAUSIBLE_OFFSET_MS ? offsetAt : null;
  } catch {
    return null;
  }
}

function resolveDeviceTimeZone(): ResolvedTimeZone {
  let name: string | undefined;
  try {
    name = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    name = undefined;
  }
  const reader = name ? createIntlOffsetReader(name) : null;
  // Intl hiç çalışmıyorsa son çare: JS Date'in cihaz farkı
  const offsetAt = reader ?? ((utcMs: number) => -new Date(utcMs).getTimezoneOffset() * 60000);
  return { timeZone: name || "UTC", source: "device", offsetAt };
}

/** Sıra: istekteki bölge, yoksa konumdan arama; bölge kullanılamıyorsa cihazın saat dilimi. */
export function resolveTimeZone(latitude: number, longitude: number, requested?: string): ResolvedTimeZone {
  let timeZone: string | null = requested || null;
  const source: SkyTimeZoneSource = requested ? "request" : "lookup";
  if (!requested) {
    try {
      timeZone = tzlookup(latitude, longitude);
    } catch {
      timeZone = null;
    }
  }
  const offsetAt = timeZone ? createIntlOffsetReader(timeZone) : null;
  return timeZone && offsetAt ? { timeZone, source, offsetAt } : resolveDeviceTimeZone();
}

/**
 * Duvar saatini (UTC gibi kodlanmış ms) gerçek UTC'ye çevirir.
 * Düz sabit nokta yinelemesi çakışmayı göremez; bu yüzden geçişin iki yanındaki fark örneklenir ve
 * her aday kendi farkıyla doğrulanır. ±24 saat yeterlidir: farklar −12..+14 saat arasındadır.
 *  - İki aday da tutarsa saat iki kez yaşanmıştır ('overlap'): İLK oluşum alınır.
 *  - Hiçbiri tutmazsa saat yoktur ('gap'): geçiş öncesi farkla çevrilir, yani atlama kadar ileri kayar
 *    (New York 02:30 → 03:30 EDT; Temporal 'compatible' ve java.time ile aynı).
 */
export function wallTimeToUtc(wallMs: number, offsetAt: OffsetAt): WallTimeConversion {
  const offsetBefore = offsetAt(wallMs - MS_PER_DAY);
  const offsetAfter = offsetAt(wallMs + MS_PER_DAY);
  const candidateBefore = wallMs - offsetBefore;
  const candidateAfter = wallMs - offsetAfter;
  const beforeHolds = offsetAt(candidateBefore) === offsetBefore;
  const afterHolds = offsetAt(candidateAfter) === offsetAfter;

  if (beforeHolds && afterHolds && candidateBefore !== candidateAfter) {
    const utcMs = Math.min(candidateBefore, candidateAfter);
    return { utcMs, offsetMs: wallMs - utcMs, ambiguity: "overlap" };
  }
  if (beforeHolds) return { utcMs: candidateBefore, offsetMs: offsetBefore, ambiguity: null };
  if (afterHolds) return { utcMs: candidateAfter, offsetMs: offsetAfter, ambiguity: null };
  return { utcMs: candidateBefore, offsetMs: offsetAt(candidateBefore), ambiguity: "gap" };
}
