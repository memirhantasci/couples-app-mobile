import * as Location from "expo-location";
import { dayjs } from "@/lib/date";
import { logger } from "@/utils/logger";
import i18n from "@/lib/i18n";

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
 * expo-location tarafından döndürülen adres bileşenlerini
 * Sokak, Mahalle, İlçe, İl, Ülke hiyerarşisinde düzenli bir metne dönüştürür.
 */
export function formatGeocodedAddress(item: Location.LocationGeocodedAddress): string {
  const parts: string[] = [];

  // Sokak / Cadde adı ve kapı no
  const streetName = item.street ? item.street.trim() : null;
  const streetNumber = item.streetNumber ? item.streetNumber.trim() : null;
  const fullStreet = streetName 
    ? (streetNumber ? `${streetName} No:${streetNumber}` : streetName)
    : null;

  // Mahalle / Semt
  const rawDistrict = item.district ? item.district.trim() : null;
  const district = rawDistrict 
    ? (rawDistrict.toLowerCase().includes("mah") ? rawDistrict : `${rawDistrict} Mah.`)
    : null;

  // İlçe / Alt bölge
  const subregion = item.subregion ? item.subregion.trim() : null;

  // İl / Şehir
  const city = item.city ? item.city.trim() : (item.region ? item.region.trim() : null);

  // Mekan / Yer ismi (sokak veya ilçeden farklı ise, örn: "Galata Kulesi", "Bebek Parkı")
  const name = item.name ? item.name.trim() : null;
  if (name && name !== streetName && name !== rawDistrict && name !== subregion && name !== city && name !== streetNumber) {
    parts.push(name);
  }

  if (fullStreet && !parts.includes(fullStreet)) {
    parts.push(fullStreet);
  }

  if (district && !parts.includes(district)) {
    if (rawDistrict !== subregion && rawDistrict !== city) {
      parts.push(district);
    }
  }

  if (subregion && !parts.includes(subregion) && subregion !== city) {
    parts.push(subregion);
  }

  if (city && !parts.includes(city)) {
    parts.push(city);
  }

  // Yurt dışı konumlar için ülke
  if (item.country && item.country !== "Turkey" && item.country !== "Türkiye" && !parts.includes(item.country)) {
    parts.push(item.country);
  }

  return parts.join(", ") || (city || subregion || i18n.t("map.customLocation"));
}

/**
 * Bir koordinatı adrese (sokak, mahalle, ilçe, il) dönüştürür.
 */
export async function reverseGeocodeLocation(lat: number, lng: number): Promise<string | undefined> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (results && results.length > 0) {
      return formatGeocodedAddress(results[0]);
    }
  } catch {
    // Sessizce geç
  }
  return undefined;
}

/**
 * Metin olarak girilen adresi (İl, ilçe, mahalle, sokak, mekan adı)
 * haritada gösterilebilir GPS koordinatlarına (enlem/boylam) çevirir (Forward Geocoding).
 */
export async function geocodeAddressString(address: string): Promise<{
  latitude: number;
  longitude: number;
  locationName: string;
} | null> {
  const cleanQuery = address.trim();
  if (!cleanQuery || cleanQuery.length < 2) return null;

  // 1. ADIM: Expo / Native OS Geocoder (iOS CLGeocoder / Android Geocoder)
  try {
    let results = await Location.geocodeAsync(cleanQuery);
    if (!results || results.length === 0) {
      // Tek kelimelik ilçe/semt isimlerinde (örn: "maltepe", "kadıköy") Türkiye bağlamıyla dene
      results = await Location.geocodeAsync(`${cleanQuery}, Türkiye`);
    }

    if (results && results.length > 0) {
      const first = results[0];
      if (isValidCoordinate(first.latitude, first.longitude)) {
        let resolvedName = cleanQuery;
        try {
          const revResults = await Location.reverseGeocodeAsync({
            latitude: first.latitude,
            longitude: first.longitude,
          });
          if (revResults && revResults.length > 0) {
            resolvedName = formatGeocodedAddress(revResults[0]);
          }
        } catch {
          // Orijinal metni koru
        }

        return {
          latitude: first.latitude,
          longitude: first.longitude,
          locationName: resolvedName,
        };
      }
    }
  } catch (err) {
    logger.warn("Native geocodeAsync error, trying OSM Nominatim fallback:", err);
  }

  // 2. ADIM: OpenStreetMap (Nominatim) Yedek Arama Servisi
  // Native geocoder'ın (Android Play Services hatası, iOS rate-limit vb.) bulamadığı
  // veya hata verdiği durumlarda il, ilçe, mahalle ve sokakları %100 doğrulukla çözer
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanQuery)}&limit=1&addressdetails=1`;
    const resp = await fetch(osmUrl, {
      headers: {
        "User-Agent": "CouplesApp/1.0",
        "Accept-Language": "tr,en",
      },
    });

    if (resp.ok) {
      const osmData = await resp.json();
      if (Array.isArray(osmData) && osmData.length > 0) {
        const item = osmData[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);

        if (isValidCoordinate(lat, lon)) {
          const addr = item.address || {};
          const mainPart = addr.road || addr.suburb || addr.quarter || addr.neighbourhood || addr.town || addr.city_district || addr.district || item.name || cleanQuery;
          const cityPart = addr.city || addr.province || addr.state || "";
          const resolvedName = [mainPart, cityPart].filter(Boolean).join(", ") || cleanQuery;

          return {
            latitude: lat,
            longitude: lon,
            locationName: resolvedName,
          };
        }
      }
    }
  } catch (osmErr) {
    logger.warn("Nominatim geocoding fallback error:", osmErr);
  }

  return null;
}

interface BinaryExifData {
  latitude: number | null;
  longitude: number | null;
  dateTime: string | null;
}

function readString(view: DataView, offset: number, maxLen: number): string | null {
  try {
    if (offset + maxLen > view.byteLength) maxLen = view.byteLength - offset;
    let str = "";
    for (let i = 0; i < maxLen; i++) {
      const charCode = view.getUint8(offset + i);
      if (charCode === 0) break;
      str += String.fromCharCode(charCode);
    }
    return str.trim() || null;
  } catch {
    return null;
  }
}

function readRationals(view: DataView, offset: number, count: number, littleEndian: boolean): number[] | null {
  try {
    const vals: number[] = [];
    for (let i = 0; i < count; i++) {
      const num = view.getUint32(offset + i * 8, littleEndian);
      const den = view.getUint32(offset + i * 8 + 4, littleEndian);
      if (den === 0) return null;
      vals.push(num / den);
    }
    return vals;
  } catch {
    return null;
  }
}

/**
 * Saf JavaScript / DataView ile JPEG dosyasının APP1 (Exif) segmentinden
 * GPS koordinatlarını ve çekim tarihini çözer. Hermes ve tüm mobil platformlarla %100 uyumludur.
 */
function parseBinaryExif(buffer: ArrayBuffer): BinaryExifData {
  const result: BinaryExifData = { latitude: null, longitude: null, dateTime: null };
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 16 || view.getUint16(0, false) !== 0xffd8) {
      return result;
    }

    let offset = 2;
    let app1Offset = -1;

    while (offset < view.byteLength - 4) {
      const marker = view.getUint16(offset, false);
      if (marker === 0xffe1) {
        app1Offset = offset;
        break;
      }
      if ((marker & 0xff00) !== 0xff00) {
        break;
      }
      const length = view.getUint16(offset + 2, false);
      offset += 2 + length;
    }

    if (app1Offset === -1) return result;

    // "Exif\0\0" (0x45786966, 0x0000)
    const exifHeader = view.getUint32(app1Offset + 4, false);
    if (exifHeader !== 0x45786966 || view.getUint16(app1Offset + 8, false) !== 0x0000) {
      return result;
    }

    const tiffStart = app1Offset + 10;
    const byteOrder = view.getUint16(tiffStart, false);
    const littleEndian = byteOrder === 0x4949; // 'II'

    if (!littleEndian && byteOrder !== 0x4d4d) {
      return result;
    }

    if (view.getUint16(tiffStart + 2, littleEndian) !== 0x002a) {
      return result;
    }

    const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
    if (firstIfdOffset < 8) return result;

    const ifd0Offset = tiffStart + firstIfdOffset;
    if (ifd0Offset >= view.byteLength) return result;

    const numEntries0 = view.getUint16(ifd0Offset, littleEndian);
    let exifIfdOffset = -1;
    let gpsIfdOffset = -1;

    for (let i = 0; i < numEntries0; i++) {
      const entryOffset = ifd0Offset + 2 + i * 12;
      if (entryOffset + 12 > view.byteLength) break;
      const tag = view.getUint16(entryOffset, littleEndian);

      if (tag === 0x8769) {
        exifIfdOffset = tiffStart + view.getUint32(entryOffset + 8, littleEndian);
      } else if (tag === 0x8825) {
        gpsIfdOffset = tiffStart + view.getUint32(entryOffset + 8, littleEndian);
      } else if (tag === 0x0132 && !result.dateTime) {
        const valOffset = tiffStart + view.getUint32(entryOffset + 8, littleEndian);
        result.dateTime = readString(view, valOffset, 20);
      }
    }

    // Exif IFD (DateTimeOriginal: 0x9003)
    if (exifIfdOffset > 0 && exifIfdOffset < view.byteLength) {
      const numExifEntries = view.getUint16(exifIfdOffset, littleEndian);
      for (let i = 0; i < numExifEntries; i++) {
        const entryOffset = exifIfdOffset + 2 + i * 12;
        if (entryOffset + 12 > view.byteLength) break;
        const tag = view.getUint16(entryOffset, littleEndian);
        if (tag === 0x9003) {
          const valOffset = tiffStart + view.getUint32(entryOffset + 8, littleEndian);
          const dt = readString(view, valOffset, 20);
          if (dt) result.dateTime = dt;
          break;
        }
      }
    }

    // GPS IFD
    if (gpsIfdOffset > 0 && gpsIfdOffset < view.byteLength) {
      const numGpsEntries = view.getUint16(gpsIfdOffset, littleEndian);
      let latRef = "N";
      let lngRef = "E";
      let rawLat: number[] | null = null;
      let rawLng: number[] | null = null;

      for (let i = 0; i < numGpsEntries; i++) {
        const entryOffset = gpsIfdOffset + 2 + i * 12;
        if (entryOffset + 12 > view.byteLength) break;
        const tag = view.getUint16(entryOffset, littleEndian);

        if (tag === 0x0001) {
          latRef = String.fromCharCode(view.getUint8(entryOffset + 8)).toUpperCase();
        } else if (tag === 0x0002) {
          const valOffset = tiffStart + view.getUint32(entryOffset + 8, littleEndian);
          rawLat = readRationals(view, valOffset, 3, littleEndian);
        } else if (tag === 0x0003) {
          lngRef = String.fromCharCode(view.getUint8(entryOffset + 8)).toUpperCase();
        } else if (tag === 0x0004) {
          const valOffset = tiffStart + view.getUint32(entryOffset + 8, littleEndian);
          rawLng = readRationals(view, valOffset, 3, littleEndian);
        }
      }

      if (rawLat && rawLat.length === 3) {
        let lat = rawLat[0] + rawLat[1] / 60 + rawLat[2] / 3600;
        if (latRef === "S") lat = -lat;
        result.latitude = lat;
      }
      if (rawLng && rawLng.length === 3) {
        let lng = rawLng[0] + rawLng[1] / 60 + rawLng[2] / 3600;
        if (lngRef === "W") lng = -lng;
        result.longitude = lng;
      }
    }
  } catch {
    // Sessizce geç
  }
  return result;
}

/** expo-image-picker EXIF sözlüğündeki GPS (iOS ve Android farklı yapılar kullanır); yoksa null. */
function nativeGpsOf(nativeExif: any): { latitude: number; longitude: number } | null {
  const iosGps = nativeExif?.["{GPS}"] || nativeExif?.["GPS"] || {};
  const latitude = parseCoordinate(
    iosGps.Latitude ?? nativeExif?.GPSLatitude,
    iosGps.LatitudeRef ?? nativeExif?.GPSLatitudeRef
  );
  const longitude = parseCoordinate(
    iosGps.Longitude ?? nativeExif?.GPSLongitude,
    iosGps.LongitudeRef ?? nativeExif?.GPSLongitudeRef
  );
  return isValidCoordinate(latitude, longitude) ? { latitude: latitude!, longitude: longitude! } : null;
}

/**
 * Hem dosya binary'sini hem de expo-image-picker EXIF sözlüğünü kullanarak
 * fotoğrafın gerçek çekim tarihi, saati ve GPS konumunu çıkarır.
 * Seçicinin EXIF'i tarih ve konumu zaten veriyorsa dosya hiç okunmaz: 25 MB'lık bir fotoğraf
 * yalnızca üstbilgisi için bütünüyle belleğe alınıyordu.
 */
export async function extractPhotoExif(
  uri: string,
  nativeExif?: any
): Promise<ExtractedExifResult> {
  let finalDate: string | null = null;
  let finalTime: string | null = null;
  let finalLat: number | null = null;
  let finalLng: number | null = null;

  const nativeComplete =
    !!nativeExif &&
    !!(nativeExif.DateTimeOriginal || nativeExif.DateTimeDigitized || nativeExif.DateTime) &&
    nativeGpsOf(nativeExif) !== null;

  // 1. ADIM: Ham dosya binary taraması (Saf JS DataView, sıfır harici bağımlılık); seçici EXIF'i yeterliyse atlanır
  try {
    const response = nativeComplete ? null : await fetch(uri);
    const arrayBuffer = response ? await response.arrayBuffer() : null;

    if (arrayBuffer && arrayBuffer.byteLength > 0) {
      const binaryData = parseBinaryExif(arrayBuffer);
      if (isValidCoordinate(binaryData.latitude, binaryData.longitude)) {
        finalLat = binaryData.latitude;
        finalLng = binaryData.longitude;
      }

      if (binaryData.dateTime) {
        const parts = binaryData.dateTime.split(" ");
        if (parts.length === 2) {
          const dParts = parts[0].split(":");
          if (dParts.length === 3) {
            finalDate = `${dParts[0]}-${dParts[1]}-${dParts[2]}`;
            finalTime = parts[1].substring(0, 5);
          }
        }
      }
    }
  } catch {
    // Native fallback'e devam et
  }

  // 2. ADIM: Native ImagePicker asset.exif fallback'i
  if (nativeExif) {
    // Tarih fallback
    if (!finalDate) {
      const rawDt = nativeExif.DateTimeOriginal || nativeExif.DateTimeDigitized || nativeExif.DateTime;
      if (rawDt) {
        const parts = String(rawDt).split(" ");
        if (parts.length === 2) {
          const dParts = parts[0].split(":");
          if (dParts.length === 3) {
            finalDate = `${dParts[0]}-${dParts[1]}-${dParts[2]}`;
            finalTime = parts[1].substring(0, 5);
          }
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

  // 3. ADIM: Sayısal GPS bulunamadıysa, metin tabanlı EXIF/IPTC etiketlerini (il, ilçe, mahalle, sokak) tara
  if (!isValidCoordinate(finalLat, finalLng) && nativeExif) {
    const textLocationCandidates: string[] = [];

    // IPTC etiketleri (City, SubLocation, ProvinceState, Country)
    const iptc = nativeExif["{IPTC}"] || nativeExif["IPTC"] || {};
    const iptcSubLoc = iptc.SubLocation || nativeExif.SubLocation;
    const iptcCity = iptc.City || nativeExif.City;
    const iptcProvince = iptc.ProvinceState || iptc.Province || nativeExif.State || nativeExif.Province;
    const iptcCountry = iptc.CountryName || iptc.Country || nativeExif.Country;

    const iptcCombined = [iptcSubLoc, iptcCity, iptcProvince, iptcCountry].filter(Boolean).join(", ");
    if (iptcCombined) {
      textLocationCandidates.push(iptcCombined);
    }
    if (iptcCity && iptcProvince && iptcCity !== iptcProvince) {
      textLocationCandidates.push(`${iptcCity}, ${iptcProvince}`);
    } else if (iptcCity) {
      textLocationCandidates.push(iptcCity);
    }

    // GPS Alan / Bölge Bilgisi
    const gpsArea = nativeExif.GPSAreaInformation || nativeExif["{GPS}"]?.GPSAreaInformation;
    if (typeof gpsArea === "string" && gpsArea.trim()) {
      textLocationCandidates.push(gpsArea.trim());
    }

    // Açıklama / Yorum içinde konum ipuçları
    const desc = nativeExif.ImageDescription || nativeExif["{TIFF}"]?.ImageDescription;
    if (typeof desc === "string" && desc.trim()) {
      textLocationCandidates.push(desc.trim());
    }

    // Aday metinlerden koordinat çıkar (Forward Geocoding)
    for (const candidate of textLocationCandidates) {
      if (!candidate || candidate.length < 2) continue;
      const geocoded = await geocodeAddressString(candidate);
      if (geocoded && isValidCoordinate(geocoded.latitude, geocoded.longitude)) {
        finalLat = geocoded.latitude;
        finalLng = geocoded.longitude;
        break;
      }
    }
  }

  // 4. ADIM: Koordinat Kontrolü ve Reverse Geocode
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
