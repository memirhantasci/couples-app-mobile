import type { ViewportStarItem } from '../../types/star.types';
import { solarBodyName } from '../../utils/solarNames';

/**
 * Güneş Sistemi cisimleri (rendered locally, never fetched from the catalog).
 *
 * Gök haritasında derli toplu bir "orrery" çizilir: Güneş merkezde, her gezegen kendi halkasında.
 *   • Açılar: uygulama açıldığı anda her gezegenin GERÇEK güneş merkezli ekliptik boylamı (JPL
 *     "Keplerian Elements for Approximate Positions of the Major Planets", 1800–2050 tablosu). Hiçbir
 *     açı yapay olarak sabitlenmez.
 *   • Hareket: her gezegen kendi GERÇEK yörünge periyoduyla orantılı hızda döner (periyot JPL ortalama
 *     boylam değişim hızından türetilir: Merkür ~88 gün, Venüs ~225, Dünya ~365, Mars ~687, Jüpiter
 *     ~11,9 yıl …). Gerçek hızda hareket görünmeyeceği için zaman hızlandırılır: Dünya'nın bir yılı
 *     ORRERY_SECONDS_PER_YEAR saniye sürer; oranlar değişmez. Ay, Dünya'nın etrafında kendi gerçek
 *     (yıldızıl) periyoduyla döner.
 *   • Üst üste binmeme: açılar kilitlenmez; halkaların radyal aralıkları (ORRERY_RADIUS_DEG), bakış
 *     eğimi (ORRERY_TILT) ve işaret parıltı boyutları (ORRERY_MARKER_GLOW_PX) birlikte seçilir: en
 *     geniş açıda (MIN_ZOOM) bile komşu iki cisim aynı yöne hizalandığında işaretleri ayrı kalır.
 *
 * Konum her karede duvar saatinden hesaplanır (`orreryBodyPosition`); çizim, dokunma ve aramadan uçuş
 * aynı fonksiyonu kullandığından gezegene dokunulan yer ile çizildiği yer hep aynıdır.
 * `computeSolarSystemPositions` ise cisimlerin gerçek gökyüzü RA/Dec'ini verir (doğrulama için).
 */

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const OBLIQUITY_J2000 = 23.43928 * DEG;

/** [a (AU), e, I, L, ϖ (enberi boylamı), Ω (düğüm boylamı)] ve yüzyıllık değişim hızları. */
type Elements = readonly [number, number, number, number, number, number];
interface OrbitalElements {
  readonly base: Elements;
  readonly rate: Elements;
}

const ELEMENTS: Record<string, OrbitalElements> = {
  mercury: {
    base: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  },
  venus: {
    base: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    rate: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  },
  earth: {
    base: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
    rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  },
  mars: {
    base: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  },
  jupiter: {
    base: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  },
  saturn: {
    base: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    rate: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  },
  uranus: {
    base: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503],
    rate: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  },
  neptune: {
    base: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    rate: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
  },
  pluto: {
    base: [39.48211675, 0.2488273, 17.14001206, 238.92903833, 224.06891629, 110.30393684],
    rate: [-0.00031596, 0.0000517, 0.00004818, 145.20780515, -0.04062942, -0.01183482],
  },
};

type Vec3 = { x: number; y: number; z: number };

function julianDay(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function normalizeDegrees(value: number): number {
  return ((value % 360) + 360) % 360;
}

/** Güneş merkezli ekliptik konum (AU), J2000 ekliptiği. */
function heliocentricPosition(elements: OrbitalElements, centuries: number): Vec3 {
  const [a, e, inclination, meanLongitude, perihelionLongitude, nodeLongitude] = elements.base.map(
    (value, i) => value + elements.rate[i] * centuries
  );
  const argPerihelion = (perihelionLongitude - nodeLongitude) * DEG;
  const node = nodeLongitude * DEG;
  const incl = inclination * DEG;
  let meanAnomaly = normalizeDegrees(meanLongitude - perihelionLongitude);
  if (meanAnomaly > 180) meanAnomaly -= 360;
  const M = meanAnomaly * DEG;

  // Kepler denklemi: E - e·sinE = M (Newton yöntemi)
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 8; i++) {
    const delta = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= delta;
    if (Math.abs(delta) < 1e-9) break;
  }

  const xOrbit = a * (Math.cos(E) - e);
  const yOrbit = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cosW = Math.cos(argPerihelion);
  const sinW = Math.sin(argPerihelion);
  const cosN = Math.cos(node);
  const sinN = Math.sin(node);
  const cosI = Math.cos(incl);
  const sinI = Math.sin(incl);
  return {
    x: (cosW * cosN - sinW * sinN * cosI) * xOrbit + (-sinW * cosN - cosW * sinN * cosI) * yOrbit,
    y: (cosW * sinN + sinW * cosN * cosI) * xOrbit + (-sinW * sinN + cosW * cosN * cosI) * yOrbit,
    z: sinW * sinI * xOrbit + cosW * sinI * yOrbit,
  };
}

/** Ekliptik yön vektörü → ekvatoral RA/Dec (derece). */
function eclipticToEquatorial({ x, y, z }: Vec3): { ra: number; dec: number } {
  const yEq = y * Math.cos(OBLIQUITY_J2000) - z * Math.sin(OBLIQUITY_J2000);
  const zEq = y * Math.sin(OBLIQUITY_J2000) + z * Math.cos(OBLIQUITY_J2000);
  return {
    ra: normalizeDegrees(Math.atan2(yEq, x) / DEG),
    dec: Math.atan2(zEq, Math.sqrt(x * x + yEq * yEq)) / DEG,
  };
}

/** Ay'ın ortalama boylamındaki günlük değişim (derece/gün): yıldızıl ay ≈ 27,32 gün. */
const MOON_LONGITUDE_RATE_DEG_PER_DAY = 13.176396;

/** Ay'ın yer merkezli ekliptik yönü (düşük hassasiyet, ~1–2°). */
function moonDirection(daysSinceJ2000: number): Vec3 {
  const meanLongitude = 218.316 + MOON_LONGITUDE_RATE_DEG_PER_DAY * daysSinceJ2000;
  const meanAnomaly = (134.963 + 13.064993 * daysSinceJ2000) * DEG;
  const latitudeArgument = (93.272 + 13.22935 * daysSinceJ2000) * DEG;
  const longitude = (meanLongitude + 6.289 * Math.sin(meanAnomaly)) * DEG;
  const latitude = 5.128 * Math.sin(latitudeArgument) * DEG;
  return {
    x: Math.cos(latitude) * Math.cos(longitude),
    y: Math.cos(latitude) * Math.sin(longitude),
    z: Math.sin(latitude),
  };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Verilen an için Güneş, Ay, Dünya (antisolar) ve gezegenlerin gerçek gökyüzü RA/Dec'i. */
export function computeSolarSystemPositions(date: Date = new Date()): Record<string, { ra: number; dec: number }> {
  const jd = julianDay(date);
  const days = jd - 2451545.0;
  const centuries = days / 36525;
  const earth = heliocentricPosition(ELEMENTS.earth, centuries);
  const geocentric = (body: Vec3): Vec3 => ({ x: body.x - earth.x, y: body.y - earth.y, z: body.z - earth.z });

  const positions: Record<string, { ra: number; dec: number }> = {};
  const sun = eclipticToEquatorial({ x: -earth.x, y: -earth.y, z: -earth.z });
  positions['SOL-SUN'] = sun;
  positions['SOL-EARTH'] = { ra: normalizeDegrees(sun.ra + 180), dec: -sun.dec };
  positions['SOL-MOON'] = eclipticToEquatorial(moonDirection(days));
  for (const name of ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']) {
    positions[`SOL-${name.toUpperCase()}`] = eclipticToEquatorial(geocentric(heliocentricPosition(ELEMENTS[name], centuries)));
  }
  for (const code of Object.keys(positions)) {
    positions[code] = { ra: round4(positions[code].ra), dec: round4(positions[code].dec) };
  }
  return positions;
}

/** Bir gezegenin gerçek yörünge periyodu (gün), JPL ortalama boylam değişim hızından. */
export function orbitalPeriodDays(planet: string): number {
  return 360 / (ELEMENTS[planet].rate[3] / 36525);
}

/** Uygulama açılışındaki gerçek güneş merkezli ekliptik boylam (radyan). */
export function heliocentricLongitudeRad(planet: string, date: Date): number {
  const centuries = (julianDay(date) - 2451545.0) / 36525;
  const helio = heliocentricPosition(ELEMENTS[planet], centuries);
  return Math.atan2(helio.y, helio.x);
}

// ─── Gök haritasındaki derli toplu güneş sistemi (orrery) ───────────────────

/** Gök haritasında Güneş'in durduğu nokta (sistemin merkezi). */
export const ORRERY_CENTER_RA = 270;
export const ORRERY_CENTER_DEC = -8;

/** Yörünge düzlemine eğik bakış: dikey eksen bu oranda basılır (1 = tam tepeden). */
export const ORRERY_TILT = 0.8;

/**
 * Dünya'nın bir yılının kaç saniyede geçtiği. Bütün cisimler aynı hızlandırmayı paylaşır, yani gerçek
 * hız oranları korunur: Merkür ~2,4 dk, Ay ~45 sn, Mars ~19 dk, Jüpiter ~2 sa, Plüton ~41 sa'de bir tur.
 */
export const ORRERY_SECONDS_PER_YEAR = 600;
const SIDEREAL_YEAR_DAYS = 365.256363;

/** Gezegen işaretlerinin ekran pikseli cinsinden parıltı yarıçapı (yakınlaşınca büyümez). */
export const ORRERY_MARKER_GLOW_PX = {
  mercury: 5,
  venus: 6,
  earth: 12,
  moon: 5,
  mars: 9,
  jupiter: 16,
  saturn: 14,
  uranus: 11,
  neptune: 11,
  pluto: 4,
} as const;

/**
 * Güneş'ten görsel uzaklıklar ("orrery derecesi": ekranda dikey 1° ile aynı uzunluk). Gerçek oranlar
 * (Merkür 0.4 AU … Plüton 39 AU) sıkıştırılmıştır. Aralıklar işaret boyutlarından hesaplanmıştır:
 * en geniş açıda (MIN_ZOOM) ve referans telefon yüksekliğinde, komşu iki halkadaki cisimler aynı yöne
 * hizalandığında (en kötü durum: dikey hiza, ORRERY_TILT ile basık eksen) işaretleri ayrı kalır.
 * Dünya ile komşuları arasında Ay'ın yörüngesi için ayrıca pay bırakılır. Bkz. solarSystem testi.
 */
export const ORRERY_RADIUS_DEG = {
  mercury: 3.3,
  venus: 4.4,
  earth: 7.0,
  mars: 9.8,
  jupiter: 12.0,
  saturn: 14.5,
  uranus: 16.7,
  neptune: 18.6,
  pluto: 20.0,
} as const;

/**
 * Aralıkların hesaplandığı referans zoom ve ekran yüksekliği. Bu zoom'un altında işaretler ve Güneş
 * zoom ile ORANTILI küçülür (orreryMarkerScale), aralıklar da aynı oranda küçüldüğünden ayrılma
 * garantisi en geniş açıya (MIN_ZOOM) kadar korunur. Üstünde işaretler sabit boyutta, aralıklar büyür.
 * Sistemin gökyüzündeki ayak izi (Plüton 20°) çevredeki tescilli yıldızları yutmayacak kadar küçüktür.
 */
export const ORRERY_SPACING_ZOOM = 0.6;

/**
 * İşaretlerin ve Güneş'in en küçük çizim ölçeği. Daha da uzaklaşınca gezegenler küçülmeyi bırakır:
 * en geniş açıda (0.2) bile renkleri ve Satürn'ün halkasıyla tanınır kalır, toz tanesine dönmez.
 * Bu ölçekte yatay hizadaki komşular yine ayrıdır; yalnız tam dikey hizadaki (seyrek, geçici)
 * komşuların parıltıları birbirine değebilir. Bkz. solarSystem testi.
 */
export const ORRERY_MIN_MARKER_SCALE = 0.6;

/**
 * İşaretlerin ve Güneş'in çizim ölçeği: referans zoom'un altında zoom ile orantılı küçülür, ama
 * ORRERY_MIN_MARKER_SCALE'in altına inmez.
 */
export function orreryMarkerScale(zoom: number): number {
  'worklet';
  return Math.max(ORRERY_MIN_MARKER_SCALE, Math.min(1, zoom / ORRERY_SPACING_ZOOM));
}
export const ORRERY_SPACING_HEIGHT_PX = 740;

/** Güneş işaretinin ölçeği (piksel): yakınlaştıkça hafifçe büyür. Korona bunun 2,8 katına uzanır. */
export function orrerySunRadiusPx(zoom: number): number {
  'worklet';
  return Math.max(16, 20 * Math.min(3, 1 + (zoom - 1) * 0.12));
}
/** Güneş koronasının işaret ölçeğine oranı (skyOverlay sunMarker ile aynı). */
export const SUN_CORONA_SCALE = 2.8;

/** Ay'ın Dünya'ya görsel uzaklığı (orrery derecesi): Dünya'nın parıltısından açıkça ayrı durur. */
export const MOON_OFFSET_DEG = 1.5;

/**
 * Orrery de haritayla birlikte yatayda RA_STRETCH kat geniştir: halkalar geniş, yatay duran elipslerdir
 * (ekranda yatay 1 orrery derecesi = RA_STRETCH × dikey 1°). Dikey hiza en dar eksen olduğundan ayrılma
 * garantisi dikeye göre verilir.
 */
const RA_PER_ORRERY_DEG = 1 / Math.cos(ORRERY_CENTER_DEC * DEG);

type OrreryPlanet = keyof typeof ORRERY_RADIUS_DEG;
const ORRERY_PLANETS = Object.keys(ORRERY_RADIUS_DEG) as OrreryPlanet[];

export interface OrreryBody {
  readonly code: string;
  /** Merkezden (Güneş ya da Ay için Dünya) uzaklık, orrery derecesi. */
  readonly radiusDeg: number;
  /** ORRERY_EPOCH_MS anındaki gerçek açı (radyan). */
  readonly angle0: number;
  /** Açısal hız (radyan / gerçek saniye), gerçek periyotla orantılı. */
  readonly radPerSec: number;
  /** Ay: Dünya'nın etrafında döner. */
  readonly aroundEarth: boolean;
}

/** Açıların gerçek olduğu an: uygulamanın açıldığı an (her iki iş parçacığında aynı sabit). */
export const ORRERY_EPOCH_MS = Date.now();

function buildOrreryBodies(epochMs: number): OrreryBody[] {
  const date = new Date(epochMs);
  const days = julianDay(date) - 2451545.0;
  const secondsPerDay = ORRERY_SECONDS_PER_YEAR / SIDEREAL_YEAR_DAYS;
  const bodies: OrreryBody[] = ORRERY_PLANETS.map((name) => ({
    code: `SOL-${name.toUpperCase()}`,
    radiusDeg: ORRERY_RADIUS_DEG[name],
    angle0: heliocentricLongitudeRad(name, date),
    radPerSec: TAU / (orbitalPeriodDays(name) * secondsPerDay),
    aroundEarth: false,
  }));
  const moon = moonDirection(days);
  bodies.push({
    code: 'SOL-MOON',
    radiusDeg: MOON_OFFSET_DEG,
    angle0: Math.atan2(moon.y, moon.x),
    radPerSec: TAU / ((360 / MOON_LONGITUDE_RATE_DEG_PER_DAY) * secondsPerDay),
    aroundEarth: true,
  });
  return bodies;
}

/** Hareketli cisimler (Güneş hariç). Sırası `orreryIndexOf` ile bulunur. */
export const ORRERY_BODIES: readonly OrreryBody[] = buildOrreryBodies(ORRERY_EPOCH_MS);
const EARTH_INDEX = ORRERY_BODIES.findIndex((body) => body.code === 'SOL-EARTH');

/** Cismin ORRERY_BODIES içindeki sırası; Güneş ve bilinmeyen kodlar için -1 (sabit). */
export function orreryIndexOf(code: string): number {
  return ORRERY_BODIES.findIndex((body) => body.code === code);
}

/**
 * Bir orrery cisminin verilen duvar saati anındaki (ms) gök haritası konumu. UI thread'de her karede
 * ve JS thread'de (dokunma, arama) aynı sonucu verir.
 */
export function orreryBodyPosition(index: number, nowMs: number): { ra: number; dec: number } {
  'worklet';
  const body = ORRERY_BODIES[index];
  const t = (nowMs - ORRERY_EPOCH_MS) / 1000;
  let originRa = ORRERY_CENTER_RA;
  let originDec = ORRERY_CENTER_DEC;
  if (body.aroundEarth) {
    const earth = ORRERY_BODIES[EARTH_INDEX];
    const earthAngle = earth.angle0 + earth.radPerSec * t;
    originRa += Math.cos(earthAngle) * earth.radiusDeg * RA_PER_ORRERY_DEG;
    originDec += Math.sin(earthAngle) * earth.radiusDeg * ORRERY_TILT;
  }
  const angle = body.angle0 + body.radPerSec * t;
  const ra = originRa + Math.cos(angle) * body.radiusDeg * RA_PER_ORRERY_DEG;
  return {
    ra: ((ra % 360) + 360) % 360,
    dec: originDec + Math.sin(angle) * body.radiusDeg * ORRERY_TILT,
  };
}

/**
 * Gezegen yörüngeleri: Güneş'in etrafında, gezegenlerin döndüğü halkalarla AYNI elips (aynı yarıçap,
 * aynı eğim ve yatay düzeltme). Gök haritasında silik birer halka olarak çizilir.
 */
export const ORRERY_ORBITS = {
  ra: ORRERY_CENTER_RA,
  dec: ORRERY_CENTER_DEC,
  rings: Object.values(ORRERY_RADIUS_DEG).map((radius) => ({
    rx: radius * RA_PER_ORRERY_DEG,
    ry: radius * ORRERY_TILT,
  })),
} as const;

/**
 * Dış yörüngenin (Plüton) dışında bırakılan pay: yıldızlar halkaya yapışık durmasın. Sunucudaki
 * is_in_solar_system_zone aynı elipsi kullanır (bölgedeki yıldızlar önerilmez/verilmez); biri
 * değişirse ikisi birlikte değişmeli (solarSystem testi karşılaştırır).
 */
export const SOLAR_CLEARANCE = 1.06;

/**
 * Nokta, güneş sisteminin (en dış yörüngenin) içinde mi? Bu alanda gezegenlerden başka hiçbir yıldız
 * çizilmez/seçilmez; aksi halde sistem içinde sanki başka yıldızlar varmış gibi görünür.
 */
export function isInsideSolarSystem(ra: number, dec: number): boolean {
  const outer = ORRERY_ORBITS.rings[ORRERY_ORBITS.rings.length - 1];
  const dRa = ((((ra - ORRERY_ORBITS.ra) % 360) + 540) % 360) - 180;
  const dDec = dec - ORRERY_ORBITS.dec;
  const x = dRa / (outer.rx * SOLAR_CLEARANCE);
  const y = dDec / (outer.ry * SOLAR_CLEARANCE);
  return x * x + y * y <= 1;
}

/** Verilen andaki gök haritası yerleşimi: Güneş merkezde, gezegenler ve Ay o anki açılarında. */
export function computeSolarSystemLayout(nowMs: number = Date.now()): Record<string, { ra: number; dec: number }> {
  const layout: Record<string, { ra: number; dec: number }> = {
    'SOL-SUN': { ra: ORRERY_CENTER_RA, dec: ORRERY_CENTER_DEC },
  };
  ORRERY_BODIES.forEach((body, index) => {
    const position = orreryBodyPosition(index, nowMs);
    layout[body.code] = { ra: round4(position.ra), dec: round4(position.dec) };
  });
  return layout;
}

// Görünen adlar (common_name / custom_name) tanımda tutulmaz; nesne oluşturulurken dile göre canlı çözülür
type SolarBody = Omit<ViewportStarItem, 'ra' | 'dec' | 'common_name' | 'custom_name'>;

const SOLAR_BODIES: readonly SolarBody[] = [
  {
    catalog_id: 999901,
    catalog_code: 'SOL-SUN',
    magnitude: -26.74,
    spectral_type: 'G2V',
    base_color: '#FFF4E8',
    is_claimed: true,
    is_mine: false,
    luminosity_level: 1.0,
    resonance_active: true,
  },
  {
    catalog_id: 999905,
    catalog_code: 'SOL-MERCURY',
    magnitude: -0.4,
    spectral_type: 'Terrestrial',
    base_color: '#CBD5E1',
    is_claimed: true,
    is_mine: false,
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999903,
    catalog_code: 'SOL-VENUS',
    magnitude: -4.4,
    spectral_type: 'Terrestrial',
    base_color: '#FFE5C2',
    is_claimed: true,
    is_mine: false,
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999902,
    catalog_code: 'SOL-EARTH',
    magnitude: -3.8,
    spectral_type: 'Terrestrial',
    base_color: '#38BDF8',
    is_claimed: true,
    is_mine: false,
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999904,
    catalog_code: 'SOL-MOON',
    magnitude: -12.74,
    spectral_type: 'Moon',
    base_color: '#E2E8F0',
    is_claimed: true,
    is_mine: false,
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999906,
    catalog_code: 'SOL-MARS',
    magnitude: -1.5,
    spectral_type: 'Terrestrial',
    base_color: '#EF4444',
    is_claimed: true,
    is_mine: false,
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999907,
    catalog_code: 'SOL-JUPITER',
    magnitude: -2.7,
    spectral_type: 'Gas Giant',
    base_color: '#F59E0B',
    is_claimed: true,
    is_mine: false,
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999908,
    catalog_code: 'SOL-SATURN',
    magnitude: 0.2,
    spectral_type: 'Gas Giant',
    base_color: '#FDE047',
    is_claimed: true,
    is_mine: false,
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999909,
    catalog_code: 'SOL-URANUS',
    magnitude: 5.5,
    spectral_type: 'Ice Giant',
    base_color: '#22D3EE',
    is_claimed: true,
    is_mine: false,
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999910,
    catalog_code: 'SOL-NEPTUNE',
    magnitude: 7.8,
    spectral_type: 'Ice Giant',
    base_color: '#3B82F6',
    is_claimed: true,
    is_mine: false,
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999911,
    catalog_code: 'SOL-PLUTO',
    magnitude: 14.0,
    spectral_type: 'Dwarf',
    base_color: '#C084FC',
    is_claimed: true,
    is_mine: false,
    luminosity_level: 1.0,
    resonance_active: false,
  },
];

function makeSolarObject(body: SolarBody, position: { ra: number; dec: number }): ViewportStarItem {
  const item = { ...body, ...position } as ViewportStarItem;
  // Adlar her okunduğunda geçerli dilde çözülür (kopyalama anında geçerli dil kullanılır)
  Object.defineProperties(item, {
    common_name: { get: () => solarBodyName(body.catalog_code), enumerable: true, configurable: true },
    custom_name: { get: () => solarBodyName(body.catalog_code) ?? '', enumerable: true, configurable: true },
  });
  return item;
}

/** Verilen andaki konumlarıyla Güneş Sistemi cisimleri (dokunma ve aramadan uçuş için). */
export function solarSystemObjectsAt(nowMs: number = Date.now()): ViewportStarItem[] {
  const layout = computeSolarSystemLayout(nowMs);
  return SOLAR_BODIES.map((body) => makeSolarObject(body, layout[body.catalog_code]));
}

/**
 * Uygulama açılışındaki konumlarıyla Güneş Sistemi cisimleri (kimlik, ad, renk kaynağı). Gezegenler
 * hareket ettiğinden güncel konum gereken yerde `solarSystemObjectsAt` kullanılır.
 */
export const SOLAR_SYSTEM_OBJECTS: ViewportStarItem[] = solarSystemObjectsAt(ORRERY_EPOCH_MS);
