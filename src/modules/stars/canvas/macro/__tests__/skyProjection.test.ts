/// <reference types="jest" />
import type { ViewportStarItem } from '../../../types/star.types';
import { hitTestSky } from '../hitTest';
import {
  BASE_FOV_DEG,
  MIN_ZOOM,
  RA_STRETCH,
  clampZoom,
  decLimit,
  resistZoomStep,
  panStep,
  pinchStep,
  pxPerDegree,
  pxPerRaDegree,
  screenToWorld,
  skyBoundsForCamera,
  worldToScreenX,
  worldToScreenY,
  type SkyCamera,
} from '../skyProjection';

const WIDTH = 390;
const HEIGHT = 844;
const camera: SkyCamera = { ra: 100, dec: 10, zoom: 1.2 };

describe('yatayda genişletilmiş gökyüzü haritası', () => {
  it('en geniş açı 0.2: gökyüzü (kutuptan kutba 180°) ekran yüksekliğini tam doldurur', () => {
    expect(MIN_ZOOM).toBe(0.2);
    expect(BASE_FOV_DEG / MIN_ZOOM).toBeCloseTo(180, 6);
    // Ekvatora bakarken iki kutup tam ekranın üst ve alt kenarında
    const widest: SkyCamera = { ra: 0, dec: 0, zoom: MIN_ZOOM };
    expect(worldToScreenY(90, widest, HEIGHT)).toBeCloseTo(0, 6);
    expect(worldToScreenY(-90, widest, HEIGHT)).toBeCloseTo(HEIGHT, 6);
  });

  it('en geniş açıda yakınlaştırma sınırı ve lastik direnci pürüzsüz çalışır', () => {
    // Sınırın içinde uzaklaşma serbest, sınırın ötesinde giderek sönümlenir ama hiç ters yöne dönmez
    expect(resistZoomStep(1.2, Math.log(0.9))).toBeCloseTo(Math.log(0.9), 9);
    const atLimit = resistZoomStep(MIN_ZOOM, Math.log(0.9));
    const past = resistZoomStep(MIN_ZOOM / 1.15, Math.log(0.9));
    expect(atLimit).toBeCloseTo(Math.log(0.9), 9);
    expect(past).toBeLessThan(0);
    expect(Math.abs(past)).toBeLessThan(Math.abs(atLimit));
    expect(clampZoom(0.1)).toBe(MIN_ZOOM);
    expect(clampZoom(0.5)).toBe(0.5);
    // Ekran gökyüzünden uzunsa kamera ekvatorda tutulur (iki kutbun ötesindeki boşluğa kaymaz);
    // kutbun ötesine taşma sınırı yakınlaştıkça yeniden serbestleşir
    expect(decLimit(MIN_ZOOM)).toBe(0);
    expect(decLimit(0.5)).toBeGreaterThan(0);
    // Kutup taşma payı yakınlaştıkça geri gelir ama gökyüzü ekranı doldururken sıfırdır (siyah şerit yok)
    expect(decLimit(1)).toBeCloseTo(90 + 12 - BASE_FOV_DEG / 2, 6);
    for (const zoom of [MIN_ZOOM, 0.21, 0.25, 0.3]) {
      const halfFov = BASE_FOV_DEG / (2 * zoom);
      expect(decLimit(zoom) + halfFov).toBeLessThanOrEqual(Math.max(90, 180 - halfFov) + 1e-9);
    }
  });

  it('yatay ölçek dikeyin RA_STRETCH katı; dikey ölçek değişmedi', () => {
    expect(RA_STRETCH).toBeGreaterThanOrEqual(2.5);
    expect(RA_STRETCH).toBeLessThanOrEqual(3);
    expect(pxPerDegree(1, HEIGHT)).toBeCloseTo(HEIGHT / BASE_FOV_DEG);
    expect(pxPerRaDegree(1, HEIGHT)).toBeCloseTo((HEIGHT / BASE_FOV_DEG) * RA_STRETCH);
  });

  it('dünya → ekran → dünya dönüşümü tutarlı (her eksen kendi ölçeğiyle)', () => {
    for (const [ra, dec] of [
      [100, 10],
      [104.5, 3],
      [93.2, 25],
    ]) {
      const x = worldToScreenX(ra, camera, WIDTH, HEIGHT);
      const y = worldToScreenY(dec, camera, HEIGHT);
      const back = screenToWorld(x, y, camera, WIDTH, HEIGHT);
      expect(back.ra).toBeCloseTo(ra, 6);
      expect(back.dec).toBeCloseTo(dec, 6);
    }
  });

  it('yatayda 1° aralık, dikeyde 1° aralığın RA_STRETCH katı piksel tutar (yıldızlar yana açılır)', () => {
    const dx = worldToScreenX(101, camera, WIDTH, HEIGHT) - worldToScreenX(100, camera, WIDTH, HEIGHT);
    const dy = worldToScreenY(10, camera, HEIGHT) - worldToScreenY(11, camera, HEIGHT);
    expect(dx / dy).toBeCloseTo(RA_STRETCH, 6);
  });

  it('aynı parmak hareketi RA_STRETCH kat daha az derece kaydırır: tam tur daha fazla kaydırma sürer', () => {
    const swipePx = WIDTH;
    const moved = camera.ra - panStep(camera, swipePx, 0, HEIGHT).ra;
    const plainMapDegrees = swipePx / pxPerDegree(camera.zoom, HEIGHT);
    expect(moved).toBeCloseTo(plainMapDegrees / RA_STRETCH, 6);
    // En geniş açıda bir ekran genişliği artık eskisinin RA_STRETCH'te biri kadar gökyüzü
    const widest: SkyCamera = { ra: 0, dec: 0, zoom: MIN_ZOOM };
    const screensPerTurn = 360 / (camera.ra - panStep({ ...widest, ra: camera.ra }, WIDTH, 0, HEIGHT).ra);
    expect(screensPerTurn).toBeGreaterThan(5);
  });

  it('iki parmakla yakınlaştırmada parmak altındaki nokta yerinde kalır', () => {
    const fx = 300;
    const fy = 200;
    const before = screenToWorld(fx, fy, camera, WIDTH, HEIGHT);
    const next = pinchStep(camera, fx, fy, fx, fy, 1.5, WIDTH, HEIGHT);
    const after = screenToWorld(fx, fy, next, WIDTH, HEIGHT);
    expect(after.ra).toBeCloseTo(before.ra, 6);
    expect(after.dec).toBeCloseTo(before.dec, 6);
  });

  it('sorgu sınırları yatayda ekrana sığan dar RA aralığını kapsar; dikey sınırlar değişmedi', () => {
    const bounds = skyBoundsForCamera(camera.ra, camera.dec, camera.zoom, WIDTH, HEIGHT);
    const fovDec = (BASE_FOV_DEG / camera.zoom) * 1.5;
    const expectedRa = (fovDec * (WIDTH / HEIGHT)) / RA_STRETCH;
    expect(bounds.maxRa - bounds.minRa).toBeCloseTo(expectedRa, 6);
    expect(bounds.maxDec - bounds.minDec).toBeCloseTo(fovDec, 6);
    // Ekranın sağ ve sol kenarı (görünen alan) sorgu aralığının içinde
    const leftRa = screenToWorld(0, HEIGHT / 2, camera, WIDTH, HEIGHT).ra;
    const rightRa = screenToWorld(WIDTH, HEIGHT / 2, camera, WIDTH, HEIGHT).ra;
    expect(leftRa).toBeGreaterThan(bounds.minRa);
    expect(rightRa).toBeLessThan(bounds.maxRa);
  });

  it('kutup sınırları (dikey) yatay genişlemeden etkilenmez', () => {
    expect(decLimit(1)).toBeCloseTo(90 + 12 - BASE_FOV_DEG / 2, 6);
    expect(decLimit(MIN_ZOOM)).toBe(0);
  });

  it('yıldıza dokunma, yıldızın çizildiği yere isabet eder', () => {
    const star = {
      catalog_id: 1,
      catalog_code: 'HIP-1',
      ra: 104,
      dec: 12,
      magnitude: 3,
      spectral_type: 'G2V',
      base_color: '#FFFFFF',
      common_name: null,
      is_claimed: false,
      is_mine: false,
      custom_name: null,
      luminosity_level: 0.2,
      resonance_active: false,
      owner_label: null,
      is_connected: false,
    } as ViewportStarItem;
    const x = worldToScreenX(star.ra, camera, WIDTH, HEIGHT);
    const y = worldToScreenY(star.dec, camera, HEIGHT);
    expect(hitTestSky(x, y, camera, WIDTH, HEIGHT, [star])).toBe(star);
    // Eski (gerilmemiş) konumda dokunmak yıldızı bulmamalı
    const plainX = WIDTH / 2 + (star.ra - camera.ra) * pxPerDegree(camera.zoom, HEIGHT);
    expect(hitTestSky(plainX, y, camera, WIDTH, HEIGHT, [star])).toBeNull();
  });
});
