import exifr from "exifr";
import * as Location from "expo-location";
import { dayjs } from "@/lib/date";

export interface ExtractedExifResult {
  takenDate: string | null;
  takenTime: string | null;
  location: {
    latitude: number;
    longitude: number;
    locationName?: string;
  } | null;
}

/**
 * Koordinatın geçerli ve mantıklı olup olmadığını doğrular.
 * (0.00000, 0.00000) Null Island ve geçersiz aralıkları kesin olarak reddeder.
 */
export function isValidCoordinate(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;

  // Null Island (0,0) okyanus ortası / geçersiz koordinat kontrolü
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) {
    return false;
  }

  return true;
}

/**
 * Çeşitli EXIF formatlarındaki (sayı, DMS dizisi, rasyonel string vb.) koordinatları ondalık dereceye çevirir.
 */
export function parseCoordinate(val: any, ref?: string | null): number | null {
  if (val == null) return null;

  let dec: number | null = null;

  if (typeof val === "number") {
    dec = val;
  } else if (Array.isArray(val)) {
    if (val.length >= 3) {
      const d = typeof val[0] === "number" ? val[0] : parseFloat(val[0]);
      const m = typeof val[1] === "number" ? val[1] : parseFloat(val[1]);
      const s = typeof val[2] === "number" ? val[2] : parseFloat(val[2]);
      if (!isNaN(d) && !isNaN(m) && !isNaN(s)) {
        dec = d + m / 60 + s / 3600;
      }
    } else if (val.length === 1 && typeof val[0] === "number") {
      dec = val[0];
    }
  } else if (typeof val === "string") {
    // "41/1, 0/1, 2952/100" veya "41.0082"
    if (val.includes("/")) {
      const parts = val.split(",").map((p) => {
        const [num, den] = p.trim().split("/").map(Number);
        return den ? num / den : num;
      });
      if (parts.length >= 3) {
        dec = parts[0] + parts[1] / 60 + parts[2] / 3600;
      } else if (parts.length === 1) {
        dec = parts[0];
      }
    } else {
      const num = parseFloat(val);
      if (!isNaN(num)) dec = num;
    }
  }

  if (dec != null && !isNaN(dec) && isFinite(dec)) {
    const cleanRef = typeof ref === "string" ? ref.trim().toUpperCase() : "";
    if (cleanRef === "S" || cleanRef === "W") {
      dec = -Math.abs(dec);
    } else if (cleanRef === "N" || cleanRef === "E") {
      dec = Math.abs(dec);
    }
    return dec;
  }

  return null;
}

/**
 * Bir koordinatı adrese (ilçe, şehir) dönüştürür.
 */
export async function reverseGeocodeLocation(lat: number, lng: number): Promise<string | undefined> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (results && results.length > 0) {
      const item = results[0];
      const parts = [
        item.district || item.subregion || item.name,
        item.city || item.region,
      ].filter(Boolean);

      return parts.join(", ") || undefined;
    }
  } catch {
    // Sessizce geç
  }
  return undefined;
}

/**
 * Hem exifr binary taraması hem de expo-image-picker EXIF sözlüğünü kullanarak
 * fotoğrafın gerçek çekim tarihi, saati ve GPS konumunu çıkarır.
 */
export async function extractPhotoExif(
  uri: string,
  nativeExif?: any
): Promise<ExtractedExifResult> {
  let finalDate: string | null = null;
  let finalTime: string | null = null;
  let finalLat: number | null = null;
  let finalLng: number | null = null;

  // 1. ADIM: exifr ile dosya binary'sinden gerçek EXIF / GPS okuma
  try {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer && arrayBuffer.byteLength > 0) {
      // exifr parse
      const parsed = await exifr.parse(arrayBuffer, {
        gps: true,
        tiff: true,
        exif: true,
      });

      if (parsed) {
        if (parsed.latitude != null && parsed.longitude != null) {
          finalLat = parsed.latitude;
          finalLng = parsed.longitude;
        }

        const dateCandidate = parsed.DateTimeOriginal || parsed.CreateDate || parsed.ModifyDate;
        if (dateCandidate instanceof Date && !isNaN(dateCandidate.getTime())) {
          finalDate = dayjs(dateCandidate).format("YYYY-MM-DD");
          finalTime = dayjs(dateCandidate).format("HH:mm");
        } else if (typeof dateCandidate === "string") {
          const parts = dateCandidate.split(" ");
          if (parts.length === 2) {
            const dParts = parts[0].split(":");
            if (dParts.length === 3) {
              finalDate = `${dParts[0]}-${dParts[1]}-${dParts[2]}`;
              finalTime = parts[1].substring(0, 5);
            }
          }
        }
      }

      // GPS ayrıntılı metot
      if (!isValidCoordinate(finalLat, finalLng)) {
        const gps = await exifr.gps(arrayBuffer);
        if (gps && gps.latitude != null && gps.longitude != null) {
          finalLat = gps.latitude;
          finalLng = gps.longitude;
        }
      }
    }
  } catch (err) {
    // exifr okuması başarısız olursa nativeExif fallback'e devam et
  }

  // 2. ADIM: Native ImagePicker asset.exif fallback'i
  if (nativeExif) {
    // Tarih fallback
    if (!finalDate && nativeExif.DateTimeOriginal) {
      const parts = String(nativeExif.DateTimeOriginal).split(" ");
      if (parts.length === 2) {
        const dParts = parts[0].split(":");
        if (dParts.length === 3) {
          finalDate = `${dParts[0]}-${dParts[1]}-${dParts[2]}`;
          finalTime = parts[1].substring(0, 5);
        }
      }
    }

    // GPS fallback (iOS ve Android farklı yapıları)
    if (!isValidCoordinate(finalLat, finalLng)) {
      const iosGps = nativeExif["{GPS}"] || nativeExif["GPS"] || {};
      const rawLat = iosGps.Latitude ?? nativeExif.GPSLatitude;
      const rawLng = iosGps.Longitude ?? nativeExif.GPSLongitude;
      const latRef = iosGps.LatitudeRef ?? nativeExif.GPSLatitudeRef;
      const lngRef = iosGps.LongitudeRef ?? nativeExif.GPSLongitudeRef;

      const parsedLat = parseCoordinate(rawLat, latRef);
      const parsedLng = parseCoordinate(rawLng, lngRef);

      if (isValidCoordinate(parsedLat, parsedLng)) {
        finalLat = parsedLat;
        finalLng = parsedLng;
      }
    }
  }

  // 3. ADIM: Koordinat Kontrolü ve Reverse Geocode
  let locationResult: ExtractedExifResult["location"] = null;

  if (isValidCoordinate(finalLat, finalLng)) {
    const lat = finalLat as number;
    const lng = finalLng as number;
    const locationName = await reverseGeocodeLocation(lat, lng);
    locationResult = {
      latitude: lat,
      longitude: lng,
      locationName: locationName || undefined,
    };
  }

  return {
    takenDate: finalDate,
    takenTime: finalTime,
    location: locationResult,
  };
}
