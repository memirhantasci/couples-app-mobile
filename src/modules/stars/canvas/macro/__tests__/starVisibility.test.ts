/// <reference types="jest" />
import { MAX_ZOOM, MIN_ZOOM } from '../skyProjection';
import { starVisibility } from '../starStyle';
import { SKY_TILE_LEVELS, tileLevelForZoom } from '../../../utils/skyTiles';

describe('tüm yıldızlar uzaktan da görünür', () => {
  const zooms = [MIN_ZOOM, 0.8, 1, 1.4, 1.5, 2, 3, 4, 7, 15, MAX_ZOOM];

  it('katalogdaki her kadirdeki (sanal yıldızlar en fazla 6.5) sahipsiz yıldız her yakınlıkta tam görünür', () => {
    for (const zoom of zooms) {
      for (let magnitude = -1.5; magnitude <= 6.5; magnitude += 0.25) {
        expect(starVisibility(magnitude, false, zoom)).toBe(1);
      }
    }
  });

  it('tescilli yıldız her zaman görünür', () => {
    expect(starVisibility(14, true, MIN_ZOOM)).toBe(1);
  });
});

describe('en geniş açı', () => {
  it('harita eskisinden (0.6) en az 2.5 kat büyük: tam tur 5-6 kaydırma sürer', () => {
    expect(MIN_ZOOM / 0.6).toBeGreaterThanOrEqual(2.5);
  });
});

describe('gökyüzü karoları', () => {
  it('uzakta geniş, yakında küçük karo kullanır', () => {
    expect(SKY_TILE_LEVELS[tileLevelForZoom(1.0)].sizeDeg).toBe(30);
    expect(SKY_TILE_LEVELS[tileLevelForZoom(1.49)].sizeDeg).toBe(30);
    // En geniş açı (MIN_ZOOM) bile ekrana az gökyüzü sığdırır: küçük karolar yeterli
    expect(SKY_TILE_LEVELS[tileLevelForZoom(MIN_ZOOM)].sizeDeg).toBe(15);
    expect(SKY_TILE_LEVELS[tileLevelForZoom(1.5)].sizeDeg).toBe(15);
    expect(SKY_TILE_LEVELS[tileLevelForZoom(MAX_ZOOM)].sizeDeg).toBe(15);
  });

  it('her kademe, kadir süzen eski sunucu sürümünden de tüm yıldızları ister (zoom_level >= 4)', () => {
    for (const level of SKY_TILE_LEVELS) {
      expect(level.rpcZoom).toBeGreaterThanOrEqual(4);
    }
  });
});
