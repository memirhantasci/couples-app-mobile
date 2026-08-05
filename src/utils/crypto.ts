import crypto from 'react-native-quick-crypto';
import Constants from 'expo-constants';
import { Buffer } from '@craftzdog/react-native-buffer';

// Fallback logic, same as web
const ENCRYPTION_KEY = Constants.expoConfig?.extra?.encryptionKey || "couples-website-secret-key-12345";
const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);

const ALGORITHM = "aes-256-cbc";

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  // Format: "enc:IV:EncryptedText"
  return `enc:${iv.toString("hex")}:${encrypted}`;
}

export function decrypt(text: string): string {
  try {
    if (!text.startsWith("enc:")) return text; // Not encrypted

    const parts = text.split(":");
    if (parts.length !== 3) return text;

    const iv = Buffer.from(parts[1], "hex");
    const encryptedText = Buffer.from(parts[2], "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encryptedText, undefined, "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (err) {
    console.error("Decryption error:", err);
    return "";
  }
}

// Generate a static IV for deterministic encryption
const STATIC_IV = crypto.createHash("md5").update(key).digest();

export function deterministicEncrypt(text: string): string {
  if (!text) return text;
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, STATIC_IV);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  return `det:${encrypted}`;
}

export function deterministicDecrypt(text: string): string {
  try {
    if (!text || !text.startsWith("det:")) return text;

    const encryptedText = Buffer.from(text.substring(4), "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, STATIC_IV);
    
    let decrypted = decipher.update(encryptedText, undefined, "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (err) {
    console.error("Deterministic decryption error:", err);
    return "";
  }
}
