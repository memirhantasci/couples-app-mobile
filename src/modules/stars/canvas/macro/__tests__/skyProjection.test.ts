/// <reference types="jest" />
import type { ViewportStarItem } from '../../../types/star.types';
import { hitTestSky } from '../hitTest';
import {
  BASE_FOV_DEG,
  MIN_ZOOM,
  RA_STRETCH,
  decLimit,
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
  it('en geniş açı eski esnekliğinde (0.6): kullanıcı özgürce uzaklaşabilir', () => {
    expect(MIN_ZOOM).toBe(0.6);
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
    expect(screensPerTurn).toBeGreaterThan(18);
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
    expect(decLimit(MIN_ZOOM)).toBeCloseTo(90 + 12 - BASE_FOV_DEG / (2 * MIN_ZOOM), 6);
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
