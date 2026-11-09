export interface SkyRequest {
  /** 'YYYY-MM-DD' (yerel takvim günü) */
  date: string;
  /** 'HH:mm' (o yerdeki duvar saati) */
  time: string;
  /** Derece, kuzey + */
  latitude: number;
  /** Derece, DOĞU + (MapPickerModal'ın LocationData biçimi) */
  longitude: number;
  /** IANA saat dilimi; verilmezse konumdan bulunur */
  timeZone?: string;
}

export type MoonPhaseName =
  | "new"
  | "waxingCrescent"
  | "firstQuarter"
  | "waxingGibbous"
  | "full"
  | "waningGibbous"
  | "lastQuarter"
  | "waningCrescent";

export type SkyTwilight = "day" | "civil" | "nautical" | "astronomical" | "night";
export type SkyDirectionKey = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
export type SkyTimeZoneSource = "request" | "lookup" | "device";
export type SkyTimeAmbiguity = "gap" | "overlap" | null;

/** x, y birim dairede; y AŞAĞI. Kuzey üstte, doğu SOLDA (gökyüzüne bakarken). Tepe noktası (0,0), ufuk r=1. */
export interface SkyProjectedStar {
  hip: number;
  x: number;
  y: number;
  mag: number;
  ci: number | null;
  /** Derece, kırılmasız */
  altitude: number;
  /** Derece, kuzeyden doğuya (N=0, E=90) */
  azimuth: number;
}

export interface SkyProjectedSegment {
  /** IAU kodu (ör. 'Ori') */
  constellation: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SkyMoon {
  /** Aydınlanan kesir, 0..1 */
  illumination: number;
  phaseName: MoonPhaseName;
  waxing: boolean;
  /** Derece, gözlemci konumuna göre (paralaks düzeltmeli), kırılmasız */
  altitude: number;
  azimuth: number;
  /** Ufkun altındayken r > 1 olur: çizmeden önce aboveHorizon'a bak */
  x: number;
  y: number;
  aboveHorizon: boolean;
}

export interface SkySun {
  altitude: number;
  twilight: SkyTwilight;
}

export interface SkyResult {
  /** Yalnızca ufkun üstündekiler (altitude > 0), katalog sırasıyla (RA artan) */
  stars: SkyProjectedStar[];
  /** Yalnızca iki ucu da ufkun üstünde olan kenarlar; ufukta kırpılmaz, kenar bütünüyle düşer */
  segments: SkyProjectedSegment[];
  moon: SkyMoon;
  sun: SkySun;
  utcIso: string;
  julianDate: number;
  localSiderealTimeDeg: number;
  timeZone: string;
  timeZoneSource: SkyTimeZoneSource;
  /** O andaki UTC farkı (doğu +). 20. yy başındaki yerel ortalama zamanda tam sayı olmayabilir. */
  utcOffsetMinutes: number;
  timeAmbiguity: SkyTimeAmbiguity;
}

export interface SkyHorizontalPosition {
  altitude: number;
  azimuth: number;
}

export interface SkyStarPosition extends SkyHorizontalPosition {
  aboveHorizon: boolean;
}

export type SkyInputErrorCode = "INVALID_DATE" | "INVALID_TIME" | "INVALID_LOCATION" | "OUT_OF_RANGE";

export class SkyInputError extends Error {
  readonly code: SkyInputErrorCode;

  constructor(code: SkyInputErrorCode, message: string) {
    super(message);
    this.name = "SkyInputError";
    this.code = code;
    // Babel'in Error alt sınıfı dönüşümünde instanceof bozulmasın
    Object.setPrototypeOf(this, SkyInputError.prototype);
  }
}
