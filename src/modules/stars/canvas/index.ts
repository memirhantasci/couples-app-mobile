/**
 * @file index.ts
 * @module modules/stars/canvas
 * @description "Bizim Yıldızımız" Canvas Grafik Motoru — Modüler Dışa Aktarım
 *
 * Tüm canvas bileşenleri ve tip tanımlamaları bu dosya üzerinden tüketilir.
 * Kullanım:
 *   import { MacroSkyCanvas, MicroSystemCanvas } from '@/modules/stars/canvas';
 */

// ── Makro Gökyüzü Canvas (Macro Sky Renderer) ──────────────────────────────
export { MacroSkyCanvas } from './MacroSkyCanvas';
export type { MacroSkyCanvasProps, MacroSkyBounds } from './MacroSkyCanvas';

// ── Mikro Yıldız Sistemi Canvas (Micro Star System Renderer) ───────────────
export { MicroSystemCanvas } from './MicroSystemCanvas';
export type { MicroSystemCanvasProps } from './MicroSystemCanvas';
