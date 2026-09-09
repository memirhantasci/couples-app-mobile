/**
 * @file index.ts
 * @module modules/stars
 * @description "Bizim Yıldızımız" (Our Star) Modülü Master Dışa Aktarım Noktası
 */

// ── API Servis Katmanı ──────────────────────────────────────────────────────
export {
  starService,
  PremiumRequiredError,
  SparkCooldownException,
  fetchStarsInViewport,
  claimRandomStar,
  claimSpecificStar,
  getMyStarDetails,
  getStarExoplanets,
  getExoplanetDetails,
  createExoplanet,
  updateExoplanet,
  deleteExoplanet,
  appendMediaToExoplanet,
  removeMediaFromExoplanet,
  canAddManualExoplanet,
  createExoplanetFromMedia,
  sendSpark,
  getSectorsOverview,
  claimStarInSector,
  invalidateSectorsCache,
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

// ── Statik Sektör Yapılandırması ────────────────────────────────────────────
export {
  SKY_SECTORS,
  SKY_SECTORS_LIST,
  RA_SLICE_FALLBACK,
  getSectorByCoords,
} from './config/skySectors.data';
export type { SectorConfig, SectorBounds } from './config/skySectors.data';
export {
  CONSTELLATION_LINES,
  getConstellationLinesForSector,
  getConstellationIds,
} from './config/constellationLines.data';
export type { ConstellationSegment } from './config/constellationLines.data';

// ── Canvas Grafik Motoru ───────────────────────────────────────────────────
export * from './canvas';

// ── UI/UX Bileşenleri ───────────────────────────────────────────────────────
export * from './components';
