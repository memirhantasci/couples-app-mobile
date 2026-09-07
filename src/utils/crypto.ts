const CryptoJS = require('crypto-js');
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

export function setSessionEncryptionKey(userId: string, coupleId: number | null, salt: string | null) {
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
  if (!text) return text;
  try {
    const iv = CryptoJS.lib.WordArray.random(16);
    const activeKey = sessionKey || key;
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
 * Dinamik IV ile şifrelenmiş metni çözme
 */
export function decrypt(text: string): string {
  if (!text) return "";
  try {
    if (!text.startsWith("enc:")) return text; // Şifrelenmemiş düz metin

    const parts = text.split(":");
    if (parts.length !== 3) return text;

    const iv = CryptoJS.enc.Hex.parse(parts[1]);
    const ciphertext = CryptoJS.enc.Hex.parse(parts[2]);
    const activeKey = sessionKey || key;

    // 1. Önce aktif anahtar ile çözmeyi dene
    let str = "";
    try {
      const decrypted = CryptoJS.AES.decrypt(
        // @ts-ignore
        { ciphertext: ciphertext },
        activeKey,
        {
          iv: iv,
          mode: CryptoJS.mode.CBC,
          padding: CryptoJS.pad.Pkcs7,
        }
      );
      str = decrypted.toString(CryptoJS.enc.Utf8);
    } catch {
      str = "";
    }

    // 2. Eğer UTF-8 hatası alındıysa ve aktif anahtar master key değilse, master key ile dene
    if (!str && sessionKey) {
      try {
        const decMaster = CryptoJS.AES.decrypt(
          // @ts-ignore
          { ciphertext: ciphertext },
          key,
          {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          }
        );
        str = decMaster.toString(CryptoJS.enc.Utf8);
      } catch {
        str = "";
      }
    }

    return str || "";
  } catch (err) {
    logger.warn("Decryption fallback:", err);
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
  try {
    if (!text.startsWith("det:")) return text;

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

    try {
      return decrypted.toString(CryptoJS.enc.Utf8) || "";
    } catch {
      return "";
    }
  } catch (err) {
    logger.warn("Deterministic decryption fallback:", err);
    return "";
  }
}
