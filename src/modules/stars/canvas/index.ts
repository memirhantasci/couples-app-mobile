/**
 * @file index.ts
 * @module modules/stars/canvas
 * @description "Bizim Yıldızımız" Canvas Grafik Motoru — Modüler Dışa Aktarım
 *
 * Tüm canvas bileşenleri ve tip tanımlamaları bu dosya üzerinden tüketilir.
 * Kullanım:
 *   import { MacroSkyCanvas, MicroSystemCanvas, createParticlePool } from '@/modules/stars/canvas';
 */

// ── Parçacık Havuzu (Zero-Allocation Particle Engine) ──────────────────────
export {
  ParticlePool,
  createParticlePool,
} from './ParticlePool';

export type {
  SpawnParticleOptions,
  IExtendedParticlePool,
} from './ParticlePool';

// ── Makro Gökyüzü Canvas (Macro Sky Renderer) ──────────────────────────────
export { MacroSkyCanvas } from './MacroSkyCanvas';
export type { MacroSkyCanvasProps, MacroSkyBounds } from './MacroSkyCanvas';

// ── Mikro Yıldız Sistemi Canvas (Micro Star System Renderer) ───────────────
export { MicroSystemCanvas } from './MicroSystemCanvas';
export type { MicroSystemCanvasProps } from './MicroSystemCanvas';
