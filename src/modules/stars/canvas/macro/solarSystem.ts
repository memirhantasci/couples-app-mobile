import type { ViewportStarItem } from '../../types/star.types';

/**
 * Güneş Sistemi cisimleri (rendered locally, never fetched from the catalog).
 *
 * Gök haritasında `computeSolarSystemLayout` kullanılır: Güneş merkezde, gezegenler
 * Güneş etrafındaki GERÇEK güncel açılarında ama sıkıştırılmış uzaklıklarda — birbirlerine
 * bitişmeyecek kadar aralıklı, yine de hafifçe uzaklaşınca tek ekrana sığacak kadar derli
 * toplu. Ay Dünya'nın yanındadır.
 *
 * Açılar uygulama açılışındaki tarih için JPL "Keplerian Elements for Approximate
 * Positions of the Major Planets" (1800–2050 tablosu) ile hesaplanır; Ay düşük
 * hassasiyetli seriyle (~1–2°). `computeSolarSystemPositions` ise cisimlerin gerçek
 * gökyüzü RA/Dec'ini verir (doğrulama ve ileride gerçek gökyüzü görünümü için).
 */

const DEG = Math.PI / 180;
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

/** Ay'ın yer merkezli ekliptik yönü (düşük hassasiyet, ~1–2°). */
function moonDirection(daysSinceJ2000: number): Vec3 {
  const meanLongitude = 218.316 + 13.176396 * daysSinceJ2000;
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

// ─── Gök haritasındaki derli toplu güneş sistemi ────────────────────────────

/** Gök haritasında Güneş'in durduğu nokta (sistemin merkezi). */
const ORRERY_CENTER = { ra: 270, dec: -8 } as const;
/**
 * Güneş'ten görsel uzaklıklar (derece). Gerçek oranlar (Merkür 0.4 AU … Plüton 39 AU)
 * sıkıştırılmıştır: bütün sistem ~38° çapında, gök kubbede tek ekranda (hafif uzaklaşılınca)
 * görülebilir. Gezegen işaretleri ekran pikseli cinsinden SABİT boyuttadır (yakınlaşınca
 * büyümez) — komşu kuşaklar arası fark bu yüzden en geniş iki işaretin (Jüpiter + Satürn,
 * ~40px parıltı) bile üst üste binmeyeceği kadar geniş tutulur.
 */
const ORRERY_RADIUS_DEG: Record<string, number> = {
  mercury: 4.2,
  venus: 6.0,
  earth: 8.1,
  mars: 10.2,
  jupiter: 12.5,
  saturn: 14.6,
  uranus: 16.4,
  neptune: 18.0,
  pluto: 19.6,
};
/** Ay'ın Dünya'ya görsel uzaklığı (derece): Dünya'nın geniş parıltısından (16px) açıkça ayrı durur. */
const MOON_OFFSET_DEG = 1.7;
/** Yörünge düzlemine hafif eğik bakış: dikey eksen bu oranda basılır. */
const ORRERY_TILT = 0.8;

/**
 * Gezegen yörüngeleri: Güneş'in etrafında, gezegenlerin durduğu kuşaklarla AYNI elips (aynı yarıçap,
 * aynı eğim ve RA boylam düzeltmesi). Gök haritasında silik birer halka olarak çizilir.
 */
export const ORRERY_ORBITS = {
  ra: ORRERY_CENTER.ra,
  dec: ORRERY_CENTER.dec,
  rings: Object.values(ORRERY_RADIUS_DEG).map((radius) => ({
    rx: radius / Math.cos((ORRERY_CENTER.dec * Math.PI) / 180),
    ry: radius * ORRERY_TILT,
  })),
} as const;

/** Dış yörüngenin (Plüton) dışında bırakılan pay: yıldızlar halkaya yapışık durmasın. */
const SOLAR_CLEARANCE = 1.06;

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

/**
 * Gök haritası için güneş sistemi yerleşimi: Güneş merkezde, her gezegen Güneş etrafındaki
 * GERÇEK güncel açısında (güneş merkezli ekliptik boylamı), ancak sıkıştırılmış uzaklıkta.
 * Ay, Dünya'nın hemen yanında gerçek yönündedir. Böylece cisimler ne düz bir sıra halinde
 * dizilir ne de bütün gökyüzüne dağılır.
 */
export function computeSolarSystemLayout(date: Date = new Date()): Record<string, { ra: number; dec: number }> {
  const days = julianDay(date) - 2451545.0;
  const centuries = days / 36525;
  const cosCenterDec = Math.cos(ORRERY_CENTER.dec * DEG);
  const place = (angleRad: number, radiusDeg: number, originRa: number = ORRERY_CENTER.ra, originDec: number = ORRERY_CENTER.dec) => ({
    ra: round4(normalizeDegrees(originRa + (Math.cos(angleRad) * radiusDeg) / cosCenterDec)),
    dec: round4(originDec + Math.sin(angleRad) * radiusDeg * ORRERY_TILT),
  });

  const layout: Record<string, { ra: number; dec: number }> = {
    'SOL-SUN': { ra: ORRERY_CENTER.ra, dec: ORRERY_CENTER.dec },
  };
  for (const name of Object.keys(ORRERY_RADIUS_DEG)) {
    const helio = heliocentricPosition(ELEMENTS[name], centuries);
    layout[`SOL-${name.toUpperCase()}`] = place(Math.atan2(helio.y, helio.x), ORRERY_RADIUS_DEG[name]);
  }
  const moon = moonDirection(days);
  const earth = layout['SOL-EARTH'];
  layout['SOL-MOON'] = place(Math.atan2(moon.y, moon.x), MOON_OFFSET_DEG, earth.ra, earth.dec);
  return layout;
}

type SolarBody = Omit<ViewportStarItem, 'ra' | 'dec'>;

const SOLAR_BODIES: readonly SolarBody[] = [
  {
    catalog_id: 999901,
    catalog_code: 'SOL-SUN',
    common_name: 'Güneş',
    magnitude: -26.74,
    spectral_type: 'G2V',
    base_color: '#FFF4E8',
    is_claimed: true,
    is_mine: false,
    custom_name: 'Güneş',
    luminosity_level: 1.0,
    resonance_active: true,
  },
  {
    catalog_id: 999905,
    catalog_code: 'SOL-MERCURY',
    common_name: 'Merkür',
    magnitude: -0.4,
    spectral_type: 'Terrestrial',
    base_color: '#CBD5E1',
    is_claimed: true,
    is_mine: false,
    custom_name: 'Merkür',
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999903,
    catalog_code: 'SOL-VENUS',
    common_name: 'Venüs',
    magnitude: -4.4,
    spectral_type: 'Terrestrial',
    base_color: '#FFE5C2',
    is_claimed: true,
    is_mine: false,
    custom_name: 'Venüs',
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999902,
    catalog_code: 'SOL-EARTH',
    common_name: 'Dünya',
    magnitude: -3.8,
    spectral_type: 'Terrestrial',
    base_color: '#38BDF8',
    is_claimed: true,
    is_mine: false,
    custom_name: 'Dünya',
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999904,
    catalog_code: 'SOL-MOON',
    common_name: 'Ay',
    magnitude: -12.74,
    spectral_type: 'Moon',
    base_color: '#E2E8F0',
    is_claimed: true,
    is_mine: false,
    custom_name: 'Ay',
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999906,
    catalog_code: 'SOL-MARS',
    common_name: 'Mars',
    magnitude: -1.5,
    spectral_type: 'Terrestrial',
    base_color: '#EF4444',
    is_claimed: true,
    is_mine: false,
    custom_name: 'Mars',
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999907,
    catalog_code: 'SOL-JUPITER',
    common_name: 'Jüpiter',
    magnitude: -2.7,
    spectral_type: 'Gas Giant',
    base_color: '#F59E0B',
    is_claimed: true,
    is_mine: false,
    custom_name: 'Jüpiter',
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999908,
    catalog_code: 'SOL-SATURN',
    common_name: 'Satürn',
    magnitude: 0.2,
    spectral_type: 'Gas Giant',
    base_color: '#FDE047',
    is_claimed: true,
    is_mine: false,
    custom_name: 'Satürn',
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999909,
    catalog_code: 'SOL-URANUS',
    common_name: 'Uranüs',
    magnitude: 5.5,
    spectral_type: 'Ice Giant',
    base_color: '#22D3EE',
    is_claimed: true,
    is_mine: false,
    custom_name: 'Uranüs',
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999910,
    catalog_code: 'SOL-NEPTUNE',
    common_name: 'Neptün',
    magnitude: 7.8,
    spectral_type: 'Ice Giant',
    base_color: '#3B82F6',
    is_claimed: true,
    is_mine: false,
    custom_name: 'Neptün',
    luminosity_level: 1.0,
    resonance_active: false,
  },
  {
    catalog_id: 999911,
    catalog_code: 'SOL-PLUTO',
    common_name: 'Plüton',
    magnitude: 14.0,
    spectral_type: 'Dwarf',
    base_color: '#C084FC',
    is_claimed: true,
    is_mine: false,
    custom_name: 'Plüton',
    luminosity_level: 1.0,
    resonance_active: false,
  },
];

const POSITIONS_AT_LAUNCH = computeSolarSystemLayout();

/** Uygulama açılışındaki gerçek dizilimle (derli toplu yerleşimde) Güneş Sistemi cisimleri. */
export const SOLAR_SYSTEM_OBJECTS: ViewportStarItem[] = SOLAR_BODIES.map((body) => ({
  ...body,
  ...POSITIONS_AT_LAUNCH[body.catalog_code],
}));
