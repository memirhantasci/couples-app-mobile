/**
 * @file index.ts
 * @module modules/stars
 * @description "Bizim Yıldızımız" (Our Star) Modülü Master Dışa Aktarım Noktası
 */

// ── API Servis Katmanı ──────────────────────────────────────────────────────
export {
  starService,
  SparkCooldownException,
  fetchStarsInViewport,
  claimRandomStar,
  claimSpecificStar,
  getMyStarDetails,
  getStarExoplanets,
  createExoplanet,
  updateExoplanet,
  deleteExoplanet,
  canAddManualExoplanet,
  createExoplanetFromMedia,
  sendSpark,
} from './api/starService';

// ── Gerçek Zamanlı Rezonans ve Etkileşim Yöneticisi ─────────────────────────
export {
  StarSparkManager,
} from './services/StarSparkManager';
export type {
  ResonanceCallbacks,
  StarSparkManagerOptions,
} from './services/StarSparkManager';

// ── Tip Sistemi ─────────────────────────────────────────────────────────────
export * from './types/star.types';

// ── Canvas Grafik Motoru ───────────────────────────────────────────────────
export * from './canvas';

// ── UI/UX Bileşenleri ───────────────────────────────────────────────────────
export * from './components';
