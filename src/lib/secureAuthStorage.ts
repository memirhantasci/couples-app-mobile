import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as ExpoCrypto from "expo-crypto";
import { safeStorage } from "@/lib/safeStorage";
import { logger } from "@/utils/logger";

const CryptoJS = require("crypto-js");

/**
 * Supabase oturum belirteçleri için depolama.
 *
 * Oturum JSON'u (erişim + yenileme belirteci) düz AsyncStorage'a yazılırsa cihaz yedeğinden ya da kök erişimle
 * okunabilir. Burada AES anahtarı işletim sisteminin güvenli deposunda (iOS Keychain / Android Keystore) durur,
 * şifreli oturum AsyncStorage'da. SecureStore'un tek anahtar için boyut sınırı sorunu bu yüzden yaşanmaz.
 *
 * - Eski (düz) kayıtlar ilk okumada şifreli biçime taşınır; kullanıcı oturumunu kaybetmez.
 * - SecureStore kullanılamıyorsa (web, Expo Go) önceki davranışa (düz depolama) düşülür.
 * - Anahtar kaybolursa (ör. Android'de uygulama verisi silinmiş) oturum okunamaz, kullanıcı yeniden giriş yapar.
 */

const KEY_NAME = "couples_auth_aes_key";
const PREFIX = "sec1:";

let keyPromise: Promise<string | null> | null = null;

async function loadOrCreateKey(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    if (!(await SecureStore.isAvailableAsync())) return null;
    const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
    const existing = await SecureStore.getItemAsync(KEY_NAME, options);
    if (existing && /^[0-9a-f]{64}$/.test(existing)) return existing;

    const bytes = ExpoCrypto.getRandomBytes(32);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    await SecureStore.setItemAsync(KEY_NAME, hex, options);
    return hex;
  } catch (err) {
    logger.log("[SecureAuthStorage] SecureStore kullanılamıyor, düz depolamaya düşülüyor:", err);
    return null;
  }
}

function getKey(): Promise<string | null> {
  if (!keyPromise) keyPromise = loadOrCreateKey();
  return keyPromise;
}

function encryptValue(value: string, keyHex: string): string {
  const ivBytes = ExpoCrypto.getRandomBytes(16);
  const ivHex = Array.from(ivBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const encrypted = CryptoJS.AES.encrypt(value, CryptoJS.enc.Hex.parse(keyHex), {
    iv: CryptoJS.enc.Hex.parse(ivHex),
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return `${PREFIX}${ivHex}:${encrypted.ciphertext.toString(CryptoJS.enc.Hex)}`;
}

function decryptValue(stored: string, keyHex: string): string | null {
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 2) return null;
  try {
    const plain = CryptoJS.AES.decrypt(
      { ciphertext: CryptoJS.enc.Hex.parse(parts[1]) },
      CryptoJS.enc.Hex.parse(keyHex),
      {
        iv: CryptoJS.enc.Hex.parse(parts[0]),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    ).toString(CryptoJS.enc.Utf8);
    return plain || null;
  } catch {
    return null;
  }
}

export const secureAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const stored = await safeStorage.getItem(key);
    if (stored === null) return null;

    const keyHex = await getKey();
    if (!stored.startsWith(PREFIX)) {
      // Eski sürümden kalan düz kayıt: oku ve şifreli biçime taşı
      if (keyHex) {
        try {
          await safeStorage.setItem(key, encryptValue(stored, keyHex));
        } catch {
          // Taşıma başarısızsa bir sonraki açılışta yeniden denenir
        }
      }
      return stored;
    }
    if (!keyHex) return null;
    return decryptValue(stored, keyHex);
  },

  setItem: async (key: string, value: string): Promise<void> => {
    const keyHex = await getKey();
    await safeStorage.setItem(key, keyHex ? encryptValue(value, keyHex) : value);
  },

  removeItem: async (key: string): Promise<void> => {
    await safeStorage.removeItem(key);
  },
};
