// AdMob ödüllü reklam SSV geri çağrısının imza doğrulaması. Deno'ya özgü hiçbir şey kullanmaz (WebCrypto),
// böylece Node'da da sınanabilir. Kaynak: https://developers.google.com/admob/android/ssv
//
//  • İmzalanan ileti: sorgu dizgisinin "&signature=" öncesindeki kısmı. Son iki parametre her zaman
//    signature ve key_id'dir (bu sırayla).
//  • İmza: ECDSA P-256 + SHA-256, DER kodlu, URL güvenli base64 (dolgusuz).
//  • Açık anahtarlar: https://gstatic.com/admob/reward/verifier-keys.json → { keys: [{ keyId, pem, base64 }] };
//    base64 alanı DER SubjectPublicKeyInfo'dur. Anahtarlar döner, 24 saatten uzun önbelleğe alınmaz.

export interface SsvKey {
  keyId: number;
  base64: string;
}

export interface ParsedSsvQuery {
  /** İmzalanan ham kısım ("&signature=" öncesi, yüzde kodlaması çözülmemiş). */
  message: string;
  signature: string;
  keyId: number;
  params: URLSearchParams;
}

/** Ham sorgu dizgisini (baştaki "?" olmadan) ayrıştırır; biçim beklenen gibi değilse null. */
export function parseSsvQuery(rawQuery: string): ParsedSsvQuery | null {
  const marker = "&signature=";
  const index = rawQuery.indexOf(marker);
  if (index <= 0) return null;
  const message = rawQuery.slice(0, index);
  const tail = new URLSearchParams(rawQuery.slice(index + 1));
  const signature = tail.get("signature");
  const keyId = Number(tail.get("key_id"));
  if (!signature || !Number.isSafeInteger(keyId)) return null;
  return { message, signature, keyId, params: new URLSearchParams(message) };
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * DER kodlu ECDSA imzasını (SEQUENCE { INTEGER r, INTEGER s }) WebCrypto'nun beklediği 64 baytlık r||s
 * biçimine çevirir. Biçim bozuksa null.
 */
export function derToRawP256(der: Uint8Array): Uint8Array | null {
  let offset = 0;
  if (der[offset++] !== 0x30) return null;
  let sequenceLength = der[offset++];
  if (sequenceLength & 0x80) {
    const lengthBytes = sequenceLength & 0x7f;
    if (lengthBytes !== 1) return null;
    sequenceLength = der[offset++];
  }
  if (offset + sequenceLength !== der.length) return null;

  const raw = new Uint8Array(64);
  for (let part = 0; part < 2; part += 1) {
    if (der[offset++] !== 0x02) return null;
    const length = der[offset++];
    if (length === undefined || length === 0 || length > 33 || offset + length > der.length) return null;
    let value = der.subarray(offset, offset + length);
    offset += length;
    // Baştaki 0x00 yalnızca işaret baytıdır
    while (value.length > 32 && value[0] === 0) value = value.subarray(1);
    if (value.length > 32) return null;
    raw.set(value, part * 32 + (32 - value.length));
  }
  return offset === der.length ? raw : null;
}

async function verifyOnce(spkiBase64: string, message: string, rawSignature: Uint8Array): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "spki",
    base64ToBytes(spkiBase64),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, rawSignature, new TextEncoder().encode(message));
}

/**
 * Geri çağrının imzasını verilen anahtar listesiyle doğrular. Belge imzalanan baytların ham mı yoksa yüzde
 * kodlaması çözülmüş mü olduğunu açıkça söylemez (Java örneği çözülmüş sorguyu kullanır); önce ham, uymazsa
 * çözülmüş biçim denenir. İkisi de aynı anahtarla doğrulandığı için bu bir gevşetme değildir.
 */
export async function verifySsvSignature(parsed: ParsedSsvQuery, keys: SsvKey[]): Promise<boolean> {
  const key = keys.find((candidate) => candidate.keyId === parsed.keyId);
  if (!key) return false;
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = base64ToBytes(parsed.signature);
  } catch {
    return false;
  }
  const raw = derToRawP256(signatureBytes);
  if (!raw) return false;

  try {
    if (await verifyOnce(key.base64, parsed.message, raw)) return true;
    let decoded: string;
    try {
      decoded = decodeURIComponent(parsed.message.replace(/\+/g, " "));
    } catch {
      return false;
    }
    return decoded !== parsed.message && (await verifyOnce(key.base64, decoded, raw));
  } catch {
    return false;
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: string | null | undefined): value is string => !!value && UUID_PATTERN.test(value);
