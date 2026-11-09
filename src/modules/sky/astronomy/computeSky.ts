import { SKY_CONSTELLATIONS } from "../data/skyConstellationLines.data";
import { SKY_STARS } from "../data/skyStars.data";
import { equatorialToHorizontal } from "./coordinates";
import { lunarParallaxInAltitude, moonEcliptic, moonEquatorial, moonPhase } from "./moon";
import { applyPrecession, precessionAngles, type PrecessionAngles } from "./precession";
import { projectHorizontal } from "./projection";
import { sunPosition, twilightFromAltitude } from "./sun";
import { julianDateFromUtcMs, localSiderealTimeDeg } from "./time";
import { resolveTimeZone, wallTimeToUtc, type ResolvedTimeZone, type WallTimeConversion } from "./timezone";
import type {
  SkyHorizontalPosition,
  SkyMoon,
  SkyProjectedSegment,
  SkyProjectedStar,
  SkyRequest,
  SkyResult,
  SkyStarPosition,
} from "./types";
import { parseSkyRequest } from "./validate";

interface SkyInstant {
  latitude: number;
  zone: ResolvedTimeZone;
  conversion: WallTimeConversion;
  julianDate: number;
  localSiderealDeg: number;
  precession: PrecessionAngles;
}

function resolveInstant(request: SkyRequest): SkyInstant {
  const parsed = parseSkyRequest(request);
  const zone = resolveTimeZone(parsed.latitude, parsed.longitude, parsed.timeZone);
  const conversion = wallTimeToUtc(parsed.wallMs, zone.offsetAt);
  const julianDate = julianDateFromUtcMs(conversion.utcMs);
  return {
    latitude: parsed.latitude,
    zone,
    conversion,
    julianDate,
    localSiderealDeg: localSiderealTimeDeg(julianDate, parsed.longitude),
    precession: precessionAngles(julianDate),
  };
}

function starHorizontal(raDeg: number, decDeg: number, instant: SkyInstant): SkyHorizontalPosition {
  const precessed = applyPrecession(raDeg, decDeg, instant.precession);
  return equatorialToHorizontal(precessed.ra, precessed.dec, instant.latitude, instant.localSiderealDeg);
}

/** Ay ve Güneş doğrudan tarihin ekvatorunda hesaplanır: presesyon uygulanmaz. */
function computeMoon(instant: SkyInstant): SkyMoon {
  const ecliptic = moonEcliptic(instant.julianDate);
  const equatorial = moonEquatorial(ecliptic, instant.julianDate);
  const geocentric = equatorialToHorizontal(equatorial.ra, equatorial.dec, instant.latitude, instant.localSiderealDeg);
  const altitude = geocentric.altitude - lunarParallaxInAltitude(geocentric.altitude, ecliptic.parallaxDeg);
  const phase = moonPhase(instant.julianDate, ecliptic);
  const { x, y } = projectHorizontal(altitude, geocentric.azimuth);
  return {
    illumination: phase.illumination,
    phaseName: phase.phaseName,
    waxing: phase.waxing,
    altitude,
    azimuth: geocentric.azimuth,
    x,
    y,
    aboveHorizon: altitude > 0,
  };
}

/** Geçersiz girdide SkyInputError fırlatır. */
export function computeSky(request: SkyRequest): SkyResult {
  const instant = resolveInstant(request);

  const stars: SkyProjectedStar[] = [];
  const visibleByHip = new Map<number, SkyProjectedStar>();
  for (let i = 0; i < SKY_STARS.length; i++) {
    const row = SKY_STARS[i];
    const { altitude, azimuth } = starHorizontal(row[1], row[2], instant);
    if (altitude <= 0) continue;
    const { x, y } = projectHorizontal(altitude, azimuth);
    const star: SkyProjectedStar = { hip: row[0], x, y, mag: row[3], ci: row[4], altitude, azimuth };
    stars.push(star);
    visibleByHip.set(row[0], star);
  }

  const segments: SkyProjectedSegment[] = [];
  for (const constellation of SKY_CONSTELLATIONS) {
    for (const segment of constellation.segments) {
      const a = visibleByHip.get(segment[0]);
      const b = visibleByHip.get(segment[1]);
      if (a && b) segments.push({ constellation: constellation.iau, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
  }

  const sun = sunPosition(instant.julianDate);
  const sunAltitude = equatorialToHorizontal(sun.ra, sun.dec, instant.latitude, instant.localSiderealDeg).altitude;

  return {
    stars,
    segments,
    moon: computeMoon(instant),
    sun: { altitude: sunAltitude, twilight: twilightFromAltitude(sunAltitude) },
    utcIso: new Date(instant.conversion.utcMs).toISOString(),
    julianDate: instant.julianDate,
    localSiderealTimeDeg: instant.localSiderealDeg,
    timeZone: instant.zone.timeZone,
    timeZoneSource: instant.zone.source,
    utcOffsetMinutes: instant.conversion.offsetMs / 60000,
    timeAmbiguity: instant.conversion.ambiguity,
  };
}

let starIndexByHip: Map<number, number> | null = null;

/** Katalogdaki yıldızın o andaki konumu (ufkun altındaysa da döner); katalogda yoksa null. Geçersiz istekte SkyInputError. */
export function findStarPosition(hip: number, request: SkyRequest): SkyStarPosition | null {
  const instant = resolveInstant(request);
  if (!starIndexByHip) starIndexByHip = new Map(SKY_STARS.map((row, index) => [row[0], index]));
  const index = starIndexByHip.get(hip);
  if (index === undefined) return null;
  const row = SKY_STARS[index];
  const { altitude, azimuth } = starHorizontal(row[1], row[2], instant);
  return { altitude, azimuth, aboveHorizon: altitude > 0 };
}
