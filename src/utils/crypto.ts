const CryptoJS = require('crypto-js');
import * as ExpoCrypto from 'expo-crypto';
import { logger } from '@/utils/logger';

// Sabit şifreleme anahtarı (EXPO_PUBLIC_ENCRYPTION_KEY ile scryptSync türevi)
// scryptSync("super-secret-encryption-key-for-couples-app", "salt", 32)
const KEY_HEX = "3586ea4b5cd90cdb13366ae400da5f29463a257598515ca486615356de7283c3";
// MD5(KEY) ile türetilen sabit IV
const STATIC_IV_HEX = "02febf2c962068a78e99631707c8ef9d";

const key = CryptoJS.enc.Hex.parse(KEY_HEX);
const staticIv = CryptoJS.enc.Hex.parse(STATIC_IV_HEX);

// Uygulama çalışma zamanında çifte özel türetilen dinamik oturum anahtarı
let sessionKey: any = null;

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

export function setSessionEncryptionKey(userId: string, coupleId: number | null, salt: string | null) {
  decryptCache.clear();
  try {
    if (coupleId && salt) {
      // Çifte özel anahtar türetimi (256-bit)
      sessionKey = CryptoJS.PBKDF2(coupleId.toString(), salt, { keySize: 256 / 32, iterations: 1000 });
      logger.info(`Session encryption key set for couple ${coupleId}`);
    } else {
      // Çifti olmayan kullanıcılar için kendi ID'si üzerinden fallback anahtar
      sessionKey = CryptoJS.PBKDF2(userId, "solo-fallback-salt", { keySize: 256 / 32, iterations: 1000 });
      logger.info(`Session encryption key set for solo user`);
    }
  } catch (err) {
    logger.error("Failed to set session encryption key:", err);
    sessionKey = null;
  }
}

/**
 * Dinamik IV ile rastgele şifreleme (Her seferinde farklı IV)
 * Format: "enc:IV_HEX:CIPHERTEXT_HEX"
 */
export function encrypt(text: string): string {
  return encryptWithKey(text, sessionKey || key);
}

/**
 * Oturum anahtarından bağımsız, sabit anahtarla şifreler (format `encrypt` ile aynı).
 * Kullanıcının kendi profil alanları (display_name) için: bu alanlar çift anahtarı
 * değişse bile (eşleşme sonrası) decrypt()'in statik anahtar fallback'iyle çözülebilmeli.
 * Klasik kayıt formu da oturum yokken tam olarak bu anahtarla şifreler.
 */
export function encryptStatic(text: string): string {
  return encryptWithKey(text, key);
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

function encryptWithKey(text: string, activeKey: any): string {
  if (!text) return text;
  try {
    const iv = getRandomBytesWordArray(16);
    const encrypted = CryptoJS.AES.encrypt(text, activeKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    
    return `enc:${iv.toString(CryptoJS.enc.Hex)}:${encrypted.ciphertext.toString(CryptoJS.enc.Hex)}`;
  } catch (err) {
    logger.error("Encryption error:", err);
    return text;
  }
}

/**
 * Dinamik IV ile şifrelenmiş metni çözme (aynı şifreli metin için sonuç önbellekten gelir)
 */
export function decrypt(text: string): string {
  if (!text || !text.startsWith("enc:")) return decryptUncached(text);
  const cached = decryptCache.get(text);
  if (cached !== undefined) return cached;
  const plain = decryptUncached(text);
  rememberDecrypted(text, plain);
  return plain;
}

function decryptUncached(text: string): string {
  if (!text) return "";
  try {
    // Deterministik şifrelenmişse doğrudan deterministik çözücüye yönlendir
    if (text.startsWith("det:")) {
      return deterministicDecrypt(text);
    }

    if (!text.startsWith("enc:")) return text; // Şifrelenmemiş düz metin

    const parts = text.split(":");
    if (parts.length !== 3) return "";

    const iv = CryptoJS.enc.Hex.parse(parts[1]);
    const ciphertext = CryptoJS.enc.Hex.parse(parts[2]);

    // 1. Önce aktif anahtarla (varsa sessionKey, yoksa statik key) dene
    const primaryKey = sessionKey || key;
    let decryptedText = "";

    try {
      const decrypted = CryptoJS.AES.decrypt(
        // @ts-ignore
        { ciphertext: ciphertext },
        primaryKey,
        {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        }
      );
      decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
    } catch (_) {}

    // 2. Eğer sessionKey kullanıldıysa ve çözüm başarısız olduysa, statik key ile fallback yap
    if (!decryptedText && sessionKey) {
      try {
        const fallbackDecrypted = CryptoJS.AES.decrypt(
          // @ts-ignore
          { ciphertext: ciphertext },
          key,
          {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          }
        );
        decryptedText = fallbackDecrypted.toString(CryptoJS.enc.Utf8);
      } catch (_) {}
    }

    return decryptedText;
  } catch (err) {
    logger.error("Decryption error:", err);
    return "";
  }
}

/**
 * Deterministik şifreleme (Aynı metin her zaman aynı şifreli çıktıyı verir)
 * Kullanıcı adı, e-posta gibi veritabanında tam eşleşme aranacak alanlar için kullanılır.
 * Format: "det:CIPHERTEXT_HEX"
 */
export function deterministicEncrypt(text: string): string {
  if (!text) return text;
  try {
    const encrypted = CryptoJS.AES.encrypt(text, key, {
      iv: staticIv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    return `det:${encrypted.ciphertext.toString(CryptoJS.enc.Hex)}`;
  } catch (err) {
    logger.error("Deterministic encryption error:", err);
    return text;
  }
}

/**
 * Deterministik şifrelenmiş metni çözme
 */
export function deterministicDecrypt(text: string): string {
  if (!text) return "";
  if (!text.startsWith("det:")) return text;
  const cached = decryptCache.get(text);
  if (cached !== undefined) return cached;
  const plain = deterministicDecryptUncached(text);
  // Hata durumunda fonksiyon şifreli metni aynen döndürür; bu başarı sayılmaz, önbelleğe alınmaz
  if (plain !== text) rememberDecrypted(text, plain);
  return plain;
}

function deterministicDecryptUncached(text: string): string {
  try {
    const ciphertext = CryptoJS.enc.Hex.parse(text.substring(4));

    const decrypted = CryptoJS.AES.decrypt(
      // @ts-ignore
      { ciphertext: ciphertext },
      key,
      {
        iv: staticIv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );

    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (err) {
    logger.error("Deterministic decryption error:", err);
    return text;
  }
}
