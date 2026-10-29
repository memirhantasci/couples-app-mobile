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
 * - Anahtar geçici olarak okunamıyorsa (ör. yeniden başlatma sonrası ilk kilit açılmadan arka planda
 *   uyanma) şifreli kayda dokunulmaz ve oturum diske düz yazılmaz; anahtar bir sonraki erişimde yeniden denenir.
 */

const KEY_NAME = "couples_auth_aes_key";
const PREFIX = "sec1:";
const KEY_LOAD_ATTEMPTS = 3;

let keyPromise: Promise<string | null> | null = null;

// Anahtar geçici olarak okunamazken yazılan oturumlar: diske düz yazılmaz, bellekte tutulur ve
// anahtar okunabildiği ilk erişimde şifrelenip diske aktarılır
const pendingWrites = new Map<string, string>();

/**
 * `null`: güvenli depo bu ortamda hiç yok (web, Expo Go) — kalıcı durum, düz depolamaya düşülür.
 * Keychain / Keystore'un geçici hatası ise fırlatılır; çağıran bunu kalıcı sanmamalı.
 */
async function loadOrCreateKey(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  let available = false;
  try {
    available = await SecureStore.isAvailableAsync();
  } catch {
    available = false;
  }
  if (!available) return null;

  const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
  const existing = await SecureStore.getItemAsync(KEY_NAME, options);
  if (existing && /^[0-9a-f]{64}$/.test(existing)) return existing;

  const bytes = ExpoCrypto.getRandomBytes(32);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  await SecureStore.setItemAsync(KEY_NAME, hex, options);
  return hex;
}

function getKeyOnce(): Promise<string | null> {
  if (!keyPromise) {
    keyPromise = loadOrCreateKey().catch((err) => {
      // Geçici hata önbelleğe alınmaz: aksi halde uygulama kapanana kadar oturum çözülemiyor ve
      // yeni belirteçler şifresiz yazılıyordu
      keyPromise = null;
      throw err;
    });
  }
  return keyPromise;
}

async function getKey(): Promise<string | null> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await getKeyOnce();
    } catch (err) {
      if (attempt >= KEY_LOAD_ATTEMPTS) throw err;
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
  }
}

async function flushPendingWrite(key: string, keyHex: string | null): Promise<void> {
  const pending = pendingWrites.get(key);
  if (pending === undefined) return;
  try {
    await safeStorage.setItem(key, keyHex ? encryptValue(pending, keyHex) : pending);
    if (pendingWrites.get(key) === pending) pendingWrites.delete(key);
  } catch {
    // Bir sonraki erişimde yeniden denenir
  }
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
    // Bu süreçte yazılmış ama anahtar yokluğundan diske aktarılamamış oturum diskteki eski kayıttan önce gelir
    const pending = pendingWrites.get(key);
    const stored = pending === undefined ? await safeStorage.getItem(key) : null;
    if (pending === undefined && stored === null) return null;

    let keyHex: string | null;
    try {
      keyHex = await getKey();
    } catch (err) {
      logger.log("[SecureAuthStorage] Anahtar şu an okunamıyor, şifreli oturuma dokunulmadı:", err);
      if (pending !== undefined) return pending;
      // Eski düz kayıt anahtarsız da okunur; şifreli kayıt silinmez, bir sonraki erişimde yeniden denenir
      return stored !== null && !stored.startsWith(PREFIX) ? stored : null;
    }

    if (pending !== undefined) {
      await flushPendingWrite(key, keyHex);
      return pending;
    }
    if (stored === null) return null;

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
    let keyHex: string | null;
    try {
      keyHex = await getKey();
    } catch (err) {
      // Belirteçler diske şifresiz yazılmaz; anahtar okunabildiğinde şifrelenip aktarılır
      logger.log("[SecureAuthStorage] Anahtar şu an okunamıyor, oturum bellekte bekletiliyor:", err);
      pendingWrites.set(key, value);
      return;
    }
    pendingWrites.delete(key);
    await safeStorage.setItem(key, keyHex ? encryptValue(value, keyHex) : value);
  },

  removeItem: async (key: string): Promise<void> => {
    pendingWrites.delete(key);
    await safeStorage.removeItem(key);
  },
};
