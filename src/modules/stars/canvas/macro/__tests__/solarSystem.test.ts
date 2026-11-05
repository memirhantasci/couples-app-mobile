/// <reference types="jest" />
import { MIN_ZOOM, RA_STRETCH, pxPerDegree } from '../skyProjection';
import {
  MOON_OFFSET_DEG,
  ORRERY_CENTER_DEC,
  ORRERY_CENTER_RA,
  ORRERY_BODIES,
  ORRERY_EPOCH_MS,
  ORRERY_MARKER_GLOW_PX,
  ORRERY_RADIUS_DEG,
  ORRERY_SECONDS_PER_YEAR,
  ORRERY_SPACING_HEIGHT_PX,
  ORRERY_SPACING_ZOOM,
  ORRERY_TILT,
  SOLAR_CLEARANCE,
  SOLAR_SYSTEM_OBJECTS,
  SUN_CORONA_SCALE,
  heliocentricLongitudeRad,
  isInsideSolarSystem,
  orbitalPeriodDays,
  orreryBodyPosition,
  orreryIndexOf,
  orreryMarkerScale,
  orrerySunRadiusPx,
  solarSystemObjectsAt,
} from '../solarSystem';

// Adlar i18n'e (ve onun depolamasına) bağlı; konum testleri için gerekmez (jest.mock en üste taşınır)
jest.mock('../../../utils/solarNames', () => ({ solarBodyName: (code: string) => code }));

const PLANETS = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;
const TAU = Math.PI * 2;
const angleDiff = (a: number, b: number) => Math.abs(((((a - b) % TAU) + TAU * 1.5) % TAU) - Math.PI);

describe('güneş sistemi: gerçek konum ve hızlar', () => {
  it('açılar yapay olarak sabitlenmez: her gezegen açılış anındaki gerçek güneş merkezli boylamında', () => {
    for (const name of PLANETS) {
      const body = ORRERY_BODIES[orreryIndexOf(`SOL-${name.toUpperCase()}`)];
      expect(angleDiff(body.angle0, heliocentricLongitudeRad(name, new Date(ORRERY_EPOCH_MS)))).toBeLessThan(1e-9);
    }
  });

  it('periyotlar JPL verisinden gerçek değerlerde', () => {
    const expected: Record<string, number> = {
      mercury: 87.97,
      venus: 224.7,
      earth: 365.26,
      mars: 686.98,
      jupiter: 4332.6,
      saturn: 10759,
      uranus: 30685,
      neptune: 60190,
      pluto: 90560,
    };
    for (const name of PLANETS) {
      expect(Math.abs(orbitalPeriodDays(name) - expected[name]) / expected[name]).toBeLessThan(0.005);
    }
  });

  it('dönüş hızları gerçek periyotlarla orantılı (Merkür Dünya’dan ~4,15 kat hızlı, Jüpiter ~11,9 kat yavaş)', () => {
    const speed = (code: string) => ORRERY_BODIES[orreryIndexOf(code)].radPerSec;
    for (const name of PLANETS) {
      const ratio = speed('SOL-EARTH') / speed(`SOL-${name.toUpperCase()}`);
      expect(ratio).toBeCloseTo(orbitalPeriodDays(name) / orbitalPeriodDays('earth'), 6);
    }
    // Dünya bir turunu ORRERY_SECONDS_PER_YEAR saniyede tamamlar
    expect(TAU / speed('SOL-EARTH')).toBeCloseTo(ORRERY_SECONDS_PER_YEAR, 0);
    // Ay, Dünya'nın etrafında ~27,3 günlük yıldızıl periyotla
    const moonDays = (TAU / speed('SOL-MOON') / ORRERY_SECONDS_PER_YEAR) * 365.256363;
    expect(moonDays).toBeCloseTo(27.32, 1);
  });

  it('gezegenler zamanla gerçekten döner; bir Dünya yılı sonra Dünya aynı yerdedir', () => {
    const earth = orreryIndexOf('SOL-EARTH');
    const mercury = orreryIndexOf('SOL-MERCURY');
    const start = orreryBodyPosition(earth, ORRERY_EPOCH_MS);
    const quarter = orreryBodyPosition(earth, ORRERY_EPOCH_MS + (ORRERY_SECONDS_PER_YEAR * 1000) / 4);
    const full = orreryBodyPosition(earth, ORRERY_EPOCH_MS + ORRERY_SECONDS_PER_YEAR * 1000);
    expect(Math.hypot(quarter.ra - start.ra, quarter.dec - start.dec)).toBeGreaterThan(1);
    expect(full.ra).toBeCloseTo(start.ra, 2);
    expect(full.dec).toBeCloseTo(start.dec, 2);
    const m0 = orreryBodyPosition(mercury, ORRERY_EPOCH_MS);
    const m1 = orreryBodyPosition(mercury, ORRERY_EPOCH_MS + 10_000);
    expect(Math.hypot(m1.ra - m0.ra, m1.dec - m0.dec)).toBeGreaterThan(0.05);
  });

  it('Ay, Dünya ile birlikte hareket eder ve ona hep aynı (görsel) uzaklıkta kalır', () => {
    const earth = orreryIndexOf('SOL-EARTH');
    const moon = orreryIndexOf('SOL-MOON');
    for (const dt of [0, 7_000, 60_000, 333_000]) {
      const e = orreryBodyPosition(earth, ORRERY_EPOCH_MS + dt);
      const m = orreryBodyPosition(moon, ORRERY_EPOCH_MS + dt);
      // Ekran uzaklığı (yatay genişleme dahil) orrery derecesine çevrilir: sabit kalmalı
      const dxDeg = ((m.ra - e.ra) * Math.cos((-8 * Math.PI) / 180)) ;
      const dyDeg = (m.dec - e.dec) / ORRERY_TILT;
      expect(Math.hypot(dxDeg, dyDeg)).toBeCloseTo(MOON_OFFSET_DEG, 3);
    }
  });

  it('dokunma/arama için verilen konumlar çizimle aynı anı kullanır', () => {
    const at = ORRERY_EPOCH_MS + 42_000;
    const objects = solarSystemObjectsAt(at);
    const mars = objects.find((o) => o.catalog_code === 'SOL-MARS');
    const drawn = orreryBodyPosition(orreryIndexOf('SOL-MARS'), at);
    expect(mars?.ra).toBeCloseTo(drawn.ra, 3);
    expect(mars?.dec).toBeCloseTo(drawn.dec, 3);
    // Güneş merkezde sabit
    const sunNow = objects.find((o) => o.catalog_code === 'SOL-SUN');
    const sunAtLaunch = SOLAR_SYSTEM_OBJECTS.find((o) => o.catalog_code === 'SOL-SUN');
    expect(sunNow?.ra).toBe(sunAtLaunch?.ra);
    expect(sunNow?.dec).toBe(sunAtLaunch?.dec);
  });
});

describe('güneş sistemi: açı kilitlemeden üst üste binmeme', () => {
  // Referans telefon (740 dp) ve referans zoom (0.8); daha yakın zoom'da aralık büyür.
  // En kötü hiza dikeydir: yatay eksen RA_STRETCH kat geniş olduğundan dikey en dar eksendir.
  const pxPerOrreryDegVertical = pxPerDegree(ORRERY_SPACING_ZOOM, ORRERY_SPACING_HEIGHT_PX) * ORRERY_TILT;
  const pxPerOrreryDegHorizontal = pxPerDegree(ORRERY_SPACING_ZOOM, ORRERY_SPACING_HEIGHT_PX) * RA_STRETCH;
  const worst = Math.min(pxPerOrreryDegVertical, pxPerOrreryDegHorizontal);
  type Body = keyof typeof ORRERY_MARKER_GLOW_PX;
  /** İki işaretin merkezleri arasında gereken en az mesafe (parıltıların dörtte üçü + 2 px). */
  const needPx = (a: Body, b: Body) => 0.75 * (ORRERY_MARKER_GLOW_PX[a] + ORRERY_MARKER_GLOW_PX[b]) + 2;

  it('komşu halkalardaki gezegenler aynı yöne hizalansa bile işaretleri ayrı kalır', () => {
    for (let i = 1; i < PLANETS.length; i += 1) {
      const inner = PLANETS[i - 1];
      const outer = PLANETS[i];
      const gapPx = (ORRERY_RADIUS_DEG[outer] - ORRERY_RADIUS_DEG[inner]) * worst;
      expect({ pair: `${inner}-${outer}`, ok: gapPx >= needPx(inner, outer) }).toEqual({ pair: `${inner}-${outer}`, ok: true });
    }
  });

  it('Ay, Dünya’dan ve Dünya’nın komşu halkalarından (Venüs, Mars) her konumda ayrı kalır', () => {
    expect(MOON_OFFSET_DEG * worst).toBeGreaterThanOrEqual(needPx('earth', 'moon'));
    expect((ORRERY_RADIUS_DEG.earth - MOON_OFFSET_DEG - ORRERY_RADIUS_DEG.venus) * worst).toBeGreaterThanOrEqual(
      needPx('venus', 'moon'),
    );
    expect((ORRERY_RADIUS_DEG.mars - ORRERY_RADIUS_DEG.earth - MOON_OFFSET_DEG) * worst).toBeGreaterThanOrEqual(
      needPx('mars', 'moon'),
    );
  });

  it('Merkür Güneş’in parlak koronasının dışında kalır', () => {
    const coronaPx = orrerySunRadiusPx(ORRERY_SPACING_ZOOM) * SUN_CORONA_SCALE;
    expect(ORRERY_RADIUS_DEG.mercury * worst).toBeGreaterThanOrEqual(coronaPx / 2 + ORRERY_MARKER_GLOW_PX.mercury);
  });

  it('uzaklaştıkça işaretler orantılı küçüldüğü için ayrışma en geniş açıda (0.2) da korunur', () => {
    for (const zoom of [MIN_ZOOM, 0.3, 0.45]) {
      const scale = orreryMarkerScale(zoom);
      const vertical = pxPerDegree(zoom, ORRERY_SPACING_HEIGHT_PX) * ORRERY_TILT;
      for (let i = 1; i < PLANETS.length; i += 1) {
        const gapPx = (ORRERY_RADIUS_DEG[PLANETS[i]] - ORRERY_RADIUS_DEG[PLANETS[i - 1]]) * vertical;
        expect(gapPx).toBeGreaterThanOrEqual(needPx(PLANETS[i - 1], PLANETS[i]) * scale - 1e-9);
      }
    }
    expect(orreryMarkerScale(ORRERY_SPACING_ZOOM)).toBe(1);
    expect(orreryMarkerScale(3)).toBe(1);
  });

  it('halkalar içten dışa sıralı', () => {
    for (let i = 1; i < PLANETS.length; i += 1) {
      expect(ORRERY_RADIUS_DEG[PLANETS[i]]).toBeGreaterThan(ORRERY_RADIUS_DEG[PLANETS[i - 1]]);
    }
  });
});

describe('güneş sistemi bölgesi', () => {
  it('sunucudaki is_in_solar_system_zone istemciyle aynı elipsi kullanır', () => {
    // Jest proje kökünde çalışır; Node tipleri projede olmadığından fs Jest üzerinden alınır
    const nodeFs = jest.requireActual('fs') as { readFileSync(file: string, encoding: 'utf8'): string };
    const sql = nodeFs.readFileSync(`${process.cwd()}/supabase/migrations/20261106000000_solar_system_zone.sql`, 'utf8');
    const ra =
      /p_ra - (\d+(?:\.\d+)?)\) % 360\) \+ 540\) % 360\) - 180\)::float8\) \/ \(([\d.]+)::float8 \/ cos\(radians\((\d+)::float8\)\) \* ([\d.]+)\)/.exec(
        sql,
      );
    const dec = /\(p_dec::float8 \+ (\d+)\) \/ \(([\d.]+)::float8 \* ([\d.]+) \* ([\d.]+)\)/.exec(sql);
    expect(ra).not.toBeNull();
    expect(dec).not.toBeNull();
    expect(Number(ra![1])).toBe(ORRERY_CENTER_RA);
    expect(Number(ra![2])).toBe(ORRERY_RADIUS_DEG.pluto);
    expect(-Number(ra![3])).toBe(ORRERY_CENTER_DEC);
    expect(Number(ra![4])).toBe(SOLAR_CLEARANCE);
    expect(-Number(dec![1])).toBe(ORRERY_CENTER_DEC);
    expect(Number(dec![2])).toBe(ORRERY_RADIUS_DEG.pluto);
    expect(Number(dec![3])).toBe(ORRERY_TILT);
    expect(Number(dec![4])).toBe(SOLAR_CLEARANCE);
  });

  it('çevredeki tescilli yıldızlar (MyLove, Love) sistemin dışında kalır; merkez içeride', () => {
    expect(isInsideSolarSystem(250.8417, -18.4556)).toBe(false);
    expect(isInsideSolarSystem(286.4271, -21.1114)).toBe(false);
    expect(isInsideSolarSystem(ORRERY_CENTER_RA, ORRERY_CENTER_DEC)).toBe(true);
  });
});
