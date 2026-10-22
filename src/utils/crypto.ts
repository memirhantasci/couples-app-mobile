const CryptoJS = require('crypto-js');
import * as ExpoCrypto from 'expo-crypto';
import { logger } from '@/utils/logger';

/**
 * Çifte özel içeriklerin (mektup içeriği, günlük notu) simetrik şifrelenmesi.
 *
 * Kodda ya da diskte hiçbir anahtar durmaz. Anahtar, oturum açıkken yalnızca çiftin üyelerinin
 * (RLS ile) okuyabildiği `couples.encryption_salt` ve çift kimliğinden bellekte türetilir; oturum
 * kapanınca silinir. Yeni bir cihazda e-posta ve şifreyle giriş yapmak aynı anahtarı yeniden
 * ürettiği için kurtarma kelimesi gerekmez, eski içerikler kayıpsız çözülür.
 *
 * Kullanıcı adı ve görünen isim gibi profil alanları şifrelenmez (RLS ile korunur).
 *
 * Format: "enc:IV_HEX:CIPHERTEXT_HEX" — AES-256-CBC, her şifrelemede rastgele IV.
 */

const ENC_PREFIX = "enc:";
const KEY_DERIVATION_ITERATIONS = 1000;

let coupleKey: any = null;
// Aynı çift için profil her yenilendiğinde PBKDF2'yi ve çözme önbelleğini boşa harcamamak için
let coupleKeyFingerprint: string | null = null;
const keyListeners = new Set<() => void>();

// crypto-js saf JS olduğu için Hermes'te yavaş (mektup/günlük başına onlarca ms). Aynı şifreli metin
// sorgu yenilemelerinde, ekranlar arası geçişlerde ve her render'da tekrar tekrar çözülüyordu;
// sonuçlar sınırlı bir önbellekte tutulur. Anahtar değişince (giriş/eşleşme/çıkış) boşaltılır.
const DECRYPT_CACHE_LIMIT = 600;
const decryptCache = new Map<string, string>();

function rememberDecrypted(cipherText: string, plain: string) {
  if (!plain) return; // Başarısız çözümler önbelleğe alınmaz: anahtar sonradan gelebilir
  if (decryptCache.size >= DECRYPT_CACHE_LIMIT) {
    const oldest = decryptCache.keys().next().value;
    if (oldest !== undefined) decryptCache.delete(oldest);
  }
  decryptCache.set(cipherText, plain);
}

function notifyKeyChange() {
  keyListeners.forEach((listener) => listener());
}

/** Anahtar hazır değilken şifreleme yapılmaz: içerik asla düz metin olarak yazılmamalı. */
export class EncryptionKeyUnavailableError extends Error {
  constructor() {
    super("Şifreleme anahtarı henüz hazır değil. Lütfen birkaç saniye sonra tekrar dene.");
    this.name = "EncryptionKeyUnavailableError";
  }
}

/**
 * Çiftin anahtarını bellekte türetir. Çifti olmayan (eşleşme bekleyen) kullanıcıda anahtar yoktur;
 * şifreli içerik yazan ekranlar yalnızca eşleşmiş kullanıcılara açıktır.
 * Anahtar değiştiyse true döner.
 */
export function setCoupleEncryptionKey(coupleId: number | null, salt: string | null): boolean {
  if (!coupleId || !salt) return clearEncryptionKey();

  const fingerprint = CryptoJS.SHA256(`${coupleId}:${salt}`).toString(CryptoJS.enc.Hex);
  if (fingerprint === coupleKeyFingerprint) return false;

  try {
    coupleKey = CryptoJS.PBKDF2(String(coupleId), salt, {
      keySize: 256 / 32,
      iterations: KEY_DERIVATION_ITERATIONS,
      hasher: CryptoJS.algo.SHA256,
    });
    coupleKeyFingerprint = fingerprint;
  } catch (err) {
    logger.error("Failed to derive couple encryption key:", err);
    coupleKey = null;
    coupleKeyFingerprint = null;
  }
  decryptCache.clear();
  notifyKeyChange();
  return true;
}

/** Oturum kapanınca anahtarı ve çözülmüş içerik önbelleğini bellekten siler. Anahtar vardıysa true döner. */
export function clearEncryptionKey(): boolean {
  const hadKey = coupleKey !== null;
  coupleKey = null;
  coupleKeyFingerprint = null;
  decryptCache.clear();
  if (hadKey) notifyKeyChange();
  return hadKey;
}

export function hasEncryptionKey(): boolean {
  return coupleKey !== null;
}

/** Anahtar türetildiğinde, değiştiğinde ya da silindiğinde haber verir. */
export function onEncryptionKeyChange(listener: () => void): () => void {
  keyListeners.add(listener);
  return () => {
    keyListeners.delete(listener);
  };
}

/**
 * CryptoJS.lib.WordArray.random, Hermes'te global crypto.getRandomValues olmadığı için
 * "Native crypto module could not be used" hatası verir. Güvenli rastgele byte'ları
 * expo-crypto'dan alıp CryptoJS WordArray formatına çeviriyoruz.
 */
function getRandomBytesWordArray(byteCount: number) {
  const bytes = ExpoCrypto.getRandomBytes(byteCount);
  const words: number[] = [];
  for (let i = 0; i < byteCount; i += 4) {
    words.push(
      ((bytes[i] || 0) << 24) |
      ((bytes[i + 1] || 0) << 16) |
      ((bytes[i + 2] || 0) << 8) |
      (bytes[i + 3] || 0)
    );
  }
  return CryptoJS.lib.WordArray.create(words, byteCount);
}

/**
 * Çiftin anahtarıyla, her seferinde farklı IV ile şifreler.
 * Anahtar yoksa EncryptionKeyUnavailableError fırlatır.
 */
export function encrypt(text: string): string {
  if (!text) return text;
  if (!coupleKey) throw new EncryptionKeyUnavailableError();

  const iv = getRandomBytesWordArray(16);
  const encrypted = CryptoJS.AES.encrypt(text, coupleKey, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return `${ENC_PREFIX}${iv.toString(CryptoJS.enc.Hex)}:${encrypted.ciphertext.toString(CryptoJS.enc.Hex)}`;
}

/**
 * Şifreli metni çözer (aynı şifreli metin için sonuç önbellekten gelir). Şifresiz metni olduğu
 * gibi döner; çözülemeyen metin (anahtar yok ya da başka çiftin anahtarı) için "" döner —
 * şifreli metin hiçbir zaman ekrana çıkmaz.
 */
export function decrypt(text: string): string {
  if (!text) return "";
  if (!text.startsWith(ENC_PREFIX)) return text;
  const cached = decryptCache.get(text);
  if (cached !== undefined) return cached;
  if (!coupleKey) return "";
  const plain = decryptWithKey(text, coupleKey);
  rememberDecrypted(text, plain);
  return plain;
}

function decryptWithKey(text: string, key: any): string {
  const parts = text.split(":");
  if (parts.length !== 3) return "";
  try {
    const decrypted = CryptoJS.AES.decrypt(
      // @ts-ignore
      { ciphertext: CryptoJS.enc.Hex.parse(parts[2]) },
      key,
      {
        iv: CryptoJS.enc.Hex.parse(parts[1]),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch {
    // Yanlış anahtar geçersiz UTF-8 üretir; bu bir hata değil, çözülemeyen içeriktir
    return "";
  }
}
