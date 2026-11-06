/// <reference types="jest" />
import { MAX_ZOOM, MIN_ZOOM } from '../skyProjection';
import { MAGNITUDE_FADE, MAGNITUDE_LIMIT_KNOTS, starVisibility, visibleMagnitudeLimit } from '../starStyle';
import { SKY_TILE_LEVELS, tileLevelForZoom } from '../../../utils/skyTiles';

describe('kademeli yıldız görünürlüğü (level of detail)', () => {
  it('en geniş açıda yalnız en parlak yıldızlar (kadir ≈ 4.1, canlı katalogda ~560 yıldız) görünür', () => {
    expect(visibleMagnitudeLimit(MIN_ZOOM)).toBeCloseTo(4.1, 6);
    expect(starVisibility(1.5, false, MIN_ZOOM)).toBe(1);
    expect(starVisibility(4.0, false, MIN_ZOOM)).toBe(1);
    expect(starVisibility(4.6, false, MIN_ZOOM)).toBe(0);
    expect(starVisibility(5.5, false, MIN_ZOOM)).toBe(0);
  });

  it('yakınlaştıkça sınır kesintisiz ve hiç geri gitmeden sönük yıldızlara açılır', () => {
    let previous = -Infinity;
    for (let zoom = MIN_ZOOM; zoom <= MAX_ZOOM; zoom *= 1.03) {
      const limit = visibleMagnitudeLimit(zoom);
      expect(limit).toBeGreaterThanOrEqual(previous);
      // Küçük bir pinch adımı sınırı en fazla birkaç onda bir kadir kaydırır: yıldızlar pat diye belirmez
      if (previous > -Infinity) expect(limit - previous).toBeLessThan(0.25);
      previous = limit;
    }
    // Düğümler sıralı ve artan
    for (let i = 1; i < MAGNITUDE_LIMIT_KNOTS.length; i += 1) {
      expect(MAGNITUDE_LIMIT_KNOTS[i][0]).toBeGreaterThan(MAGNITUDE_LIMIT_KNOTS[i - 1][0]);
      expect(MAGNITUDE_LIMIT_KNOTS[i][1]).toBeGreaterThan(MAGNITUDE_LIMIT_KNOTS[i - 1][1]);
    }
  });

  it('sönük bir yıldız yakınlaştıkça yumuşakça (ara opaklıklardan geçerek) belirir', () => {
    const magnitude = 5.0;
    const seen: number[] = [];
    for (let zoom = MIN_ZOOM; zoom <= 2; zoom *= 1.02) seen.push(starVisibility(magnitude, false, zoom));
    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBe(1);
    expect(seen.some((v) => v > 0.2 && v < 0.8)).toBe(true);
    expect(MAGNITUDE_FADE).toBeGreaterThan(0.2);
  });

  it('en yakına gelindiğinde katalogdaki her yıldız (sanal yıldızlar en fazla 6.5) tam görünür', () => {
    for (const zoom of [2.5, 3, 4, 7, 15, MAX_ZOOM]) {
      for (let magnitude = -1.5; magnitude <= 6.5; magnitude += 0.25) {
        expect(starVisibility(magnitude, false, zoom)).toBe(1);
      }
    }
    // Gerçek yıldızların en sönüğü (5.76) varsayılan açılış yakınlığının biraz ötesinde tam görünür
    expect(starVisibility(5.76, false, 1.6)).toBe(1);
  });

  it('tescilli yıldızlar (kendi ve partnerin yıldızı dahil) her yakınlıkta %100 görünür', () => {
    for (const zoom of [MIN_ZOOM, 0.3, 0.8, 1.2, MAX_ZOOM]) {
      expect(starVisibility(5.7, true, zoom)).toBe(1);
      expect(starVisibility(14, true, zoom)).toBe(1);
    }
  });
});

describe('gökyüzü karoları', () => {
  it('uzakta geniş, yakında küçük karo kullanır', () => {
    expect(SKY_TILE_LEVELS[tileLevelForZoom(1.0)].sizeDeg).toBe(30);
    expect(SKY_TILE_LEVELS[tileLevelForZoom(1.49)].sizeDeg).toBe(30);
    expect(SKY_TILE_LEVELS[tileLevelForZoom(MIN_ZOOM)].sizeDeg).toBe(30);
    expect(SKY_TILE_LEVELS[tileLevelForZoom(1.5)].sizeDeg).toBe(15);
    expect(SKY_TILE_LEVELS[tileLevelForZoom(MAX_ZOOM)].sizeDeg).toBe(15);
  });

  it('her kademe, kadir süzen eski sunucu sürümünden de tüm yıldızları ister (zoom_level >= 4)', () => {
    for (const level of SKY_TILE_LEVELS) {
      expect(level.rpcZoom).toBeGreaterThanOrEqual(4);
    }
  });
});
