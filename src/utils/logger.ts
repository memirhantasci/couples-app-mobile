/**
 * Merkezi Loglama Modülü
 * 
 * Production build'larda (__DEV__ === false) hiçbir şeyi terminale basmaz.
 * Bu sayede hassas veriler (OTP, token, kullanıcı ID vb.) log dosyalarına
 * veya üçüncü taraf izleme araçlarına sızmaz.
 * 
 * Kullanım:
 *   import { logger } from "@/utils/logger";
 *   logger.log("Bir şey oldu");     // sadece development'ta çıkar
 *   logger.error("Hata:", err);    // sadece development'ta çıkar
 *   logger.warn("Dikkat:", data);  // sadece development'ta çıkar
 */

const noop = () => {};

export const logger = {
  log: __DEV__ ? (...args: any[]) => console.log(...args) : noop,
  error: __DEV__ ? (...args: any[]) => console.error(...args) : noop,
  warn: __DEV__ ? (...args: any[]) => console.warn(...args) : noop,
  info: __DEV__ ? (...args: any[]) => console.info(...args) : noop,
};
