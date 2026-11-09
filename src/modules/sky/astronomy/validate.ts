import { SkyInputError, type SkyRequest } from "./types";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export interface ParsedSkyRequest {
  /** Duvar saati, UTC gibi kodlanmış (ms) */
  wallMs: number;
  latitude: number;
  longitude: number;
  timeZone?: string;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseSkyRequest(request: SkyRequest): ParsedSkyRequest {
  const dateMatch = typeof request.date === "string" ? DATE_PATTERN.exec(request.date) : null;
  if (!dateMatch) throw new SkyInputError("INVALID_DATE", "date must be YYYY-MM-DD");
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new SkyInputError("INVALID_DATE", "date is not a real calendar day");
  }
  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new SkyInputError("OUT_OF_RANGE", `year must be between ${MIN_YEAR} and ${MAX_YEAR}`);
  }

  const timeMatch = typeof request.time === "string" ? TIME_PATTERN.exec(request.time) : null;
  if (!timeMatch) throw new SkyInputError("INVALID_TIME", "time must be HH:mm");

  const { latitude, longitude } = request;
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new SkyInputError("INVALID_LOCATION", "latitude must be within [-90, 90]");
  }
  if (typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new SkyInputError("INVALID_LOCATION", "longitude must be within [-180, 180]");
  }

  return {
    wallMs: Date.UTC(year, month - 1, day, Number(timeMatch[1]), Number(timeMatch[2])),
    latitude,
    longitude,
    timeZone: request.timeZone,
  };
}
