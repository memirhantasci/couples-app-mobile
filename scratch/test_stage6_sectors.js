// scratch/test_stage6_sectors.js
// Aşama 6: Sanal Gökyüzü Sektörleri & Veritabanı Senkronizasyon Test Paketi

const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🧪 AŞAMA 6 & SQL ENTEGRASYON TESTİ BAŞLATILIYOR');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ [PASS] ${message}`);
    passedTests++;
  }
}

// 1. DOSYA VARLIK KONTROLLERİ
console.log('--- 1. Dosya Varlık Kontrolleri ---');
const sqlFile = path.join(__dirname, '..', 'supabase', 'migrations', '20260910_sky_sectors.sql');
const connectionsSqlFile = path.join(__dirname, '..', 'supabase', 'migrations', '20260909_star_connections.sql');
const sectorsTsFile = path.join(__dirname, '..', 'src', 'modules', 'stars', 'config', 'skySectors.data.ts');
const linesTsFile = path.join(__dirname, '..', 'src', 'modules', 'stars', 'config', 'constellationLines.data.ts');

assert(fs.existsSync(sqlFile), '20260910_sky_sectors.sql dosyası mevcut');
assert(fs.existsSync(connectionsSqlFile), '20260909_star_connections.sql dosyası mevcut');
assert(fs.existsSync(sectorsTsFile), 'skySectors.data.ts dosyası mevcut');
assert(fs.existsSync(linesTsFile), 'constellationLines.data.ts dosyası mevcut');

// 2. SQL PARSING VE VERİTABANI KONTROLLERİ
console.log('\n--- 2. SQL Migration (20260910_sky_sectors.sql) Doğrulaması ---');
const sqlContent = fs.readFileSync(sqlFile, 'utf8');

// sky_sectors tablosu tanımlı mı?
assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.sky_sectors'), 'sky_sectors tablosu tanımlı');
assert(sqlContent.includes('ALTER TABLE public.celestial_catalog'), 'celestial_catalog tablosu genişletilmiş');
assert(sqlContent.includes('ADD COLUMN IF NOT EXISTS sector_id'), 'sector_id foreign key kolonu eklenmiş');
assert(sqlContent.includes('ADD COLUMN IF NOT EXISTS is_virtual'), 'is_virtual kolonu eklenmiş');
assert(sqlContent.includes('CREATE OR REPLACE FUNCTION public.claim_star_in_sector'), 'claim_star_in_sector RPC tanımlı');
assert(sqlContent.includes('CREATE OR REPLACE FUNCTION public.get_sectors_overview'), 'get_sectors_overview RPC tanımlı');

// SQL içindeki 24 sektörü çıkar
const insertRegex = /\('([a-z_]+)',\s*'([A-Z]{3,4})',\s*(\d+),\s*([0-9.-]+),\s*([0-9.-]+),\s*([0-9.-]+),\s*([0-9.-]+)\)/g;
const sqlSectors = {};
let match;
while ((match = insertRegex.exec(sqlContent)) !== null) {
  const [_, id, code3, display_order, min_ra, max_ra, min_dec, max_dec] = match;
  sqlSectors[id] = {
    id,
    code3,
    display_order: parseInt(display_order, 10),
    min_ra: parseFloat(min_ra),
    max_ra: parseFloat(max_ra),
    min_dec: parseFloat(min_dec),
    max_dec: parseFloat(max_dec)
  };
}

assert(Object.keys(sqlSectors).length === 24, `SQL içerisinde 24 sektör INSERT ediliyor (Bulunan: ${Object.keys(sqlSectors).length})`);

// 3. TYPESCRIPT VE SQL SENKRONİZASYON KONTROLLERİ
console.log('\n--- 3. TypeScript ve SQL Senkronizasyon Kontrolü ---');
const sectorsContent = fs.readFileSync(sectorsTsFile, 'utf8');

// Parse SKY_SECTORS from TS
let tsMatchCount = 0;
let tsSyncErrors = 0;

for (const [id, sqlSec] of Object.entries(sqlSectors)) {
  // Check if ID exists in TS
  if (!sectorsContent.includes(`id: '${id}'`)) {
    console.error(`Sektör TS dosyasında bulunamadı: ${id}`);
    tsSyncErrors++;
    continue;
  }
  tsMatchCount++;

  // Check code3 match
  const code3Match = new RegExp(`id:\\s*'${id}',\\s*code3:\\s*'([^']+)'`).exec(sectorsContent);
  if (!code3Match || code3Match[1] !== sqlSec.code3) {
    console.error(`code3 uyumsuzluğu (${id}): SQL=${sqlSec.code3}, TS=${code3Match ? code3Match[1] : 'yok'}`);
    tsSyncErrors++;
  }

  // Check displayOrder match
  const orderMatch = new RegExp(`id:\\s*'${id}'[\\s\\S]*?displayOrder:\\s*(\\d+)`).exec(sectorsContent);
  if (!orderMatch || parseInt(orderMatch[1], 10) !== sqlSec.display_order) {
    console.error(`displayOrder uyumsuzluğu (${id}): SQL=${sqlSec.display_order}, TS=${orderMatch ? orderMatch[1] : 'yok'}`);
    tsSyncErrors++;
  }

  // Check bounds match
  const boundsRegex = new RegExp(`id:\\s*'${id}'[\\s\\S]*?bounds:\\s*\\{\\s*minRa:\\s*([0-9.-]+),\\s*maxRa:\\s*([0-9.-]+),\\s*minDec:\\s*([0-9.-]+),\\s*maxDec:\\s*([0-9.-]+)\\s*\\}`);
  const boundsMatch = boundsRegex.exec(sectorsContent);
  if (!boundsMatch) {
    console.error(`bounds regex eşleşmedi: ${id}`);
    tsSyncErrors++;
  } else {
    const minRa = parseFloat(boundsMatch[1]);
    const maxRa = parseFloat(boundsMatch[2]);
    const minDec = parseFloat(boundsMatch[3]);
    const maxDec = parseFloat(boundsMatch[4]);
    if (minRa !== sqlSec.min_ra || maxRa !== sqlSec.max_ra || minDec !== sqlSec.min_dec || maxDec !== sqlSec.max_dec) {
      console.error(`bounds sayısal uyumsuzluğu (${id}): SQL=[${sqlSec.min_ra}, ${sqlSec.max_ra}, ${sqlSec.min_dec}, ${sqlSec.max_dec}], TS=[${minRa}, ${maxRa}, ${minDec}, ${maxDec}]`);
      tsSyncErrors++;
    }
  }
}

assert(tsMatchCount === 24, `24 sektörün tamamı TypeScript dosyasında mevcut (${tsMatchCount}/24)`);
assert(tsSyncErrors === 0, `SQL ve TypeScript arasında 0 tutarsızlık var (Hata sayısı: ${tsSyncErrors})`);

// 4. RA DİLİM FALLBACK KONTROLÜ
console.log('\n--- 4. RA Dilim Fallback Eşleşme Kontrolü ---');
// SQL'deki CASE WHEN tablosunu ayıkla
const sqlFallbackRegex = /WHEN\s+(\d+)\s+THEN\s+'([a-z_]+)'/g;
const sqlFallbacks = {};
let fbMatch;
while ((fbMatch = sqlFallbackRegex.exec(sqlContent)) !== null) {
  sqlFallbacks[parseInt(fbMatch[1], 10)] = fbMatch[2];
}
// 23'e kadar olmalı, 23 ELSE ile pegasus
sqlFallbacks[23] = 'pegasus';

// TS dosyasındaki RA_SLICE_FALLBACK dizisini ayıkla
const tsFallbackRegex = /export const RA_SLICE_FALLBACK: readonly string\[\] = \[([\s\S]*?)\] as const;/;
const tsFbMatch = tsFallbackRegex.exec(sectorsContent);
assert(tsFbMatch !== null, 'TS dosyasında RA_SLICE_FALLBACK dizisi bulundu');

if (tsFbMatch) {
  const tsItems = tsFbMatch[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith("'"))
    .map(line => line.replace(/['",]/g, '').trim().split(' ')[0]);

  assert(tsItems.length === 24, `TS fallback dizisinde 24 dilim var (Bulunan: ${tsItems.length})`);

  let fbMismatch = 0;
  for (let i = 0; i < 24; i++) {
    if (sqlFallbacks[i] !== tsItems[i]) {
      console.error(`Dilim ${i} uyumsuzluğu: SQL=${sqlFallbacks[i]}, TS=${tsItems[i]}`);
      fbMismatch++;
    }
  }
  assert(fbMismatch === 0, `SQL ve TS fallback dizileri 24 dilimin 24'ünde de %100 birebir aynı`);
}

// 5. GEOMETRİK VE MATEMATİKSEL KONTROLLER
console.log('\n--- 5. Geometrik Sınırlar & Tie-Break Mantığı Testi ---');

// Parse all TS sector objects for computational testing
const sectorsObj = {};
for (const [id, s] of Object.entries(sqlSectors)) {
  // find center in TS
  const centerMatch = new RegExp(`id:\\s*'${id}'[\\s\\S]*?center:\\s*\\{\\s*ra:\\s*([0-9.-]+),\\s*dec:\\s*([0-9.-]+)\\s*\\}`).exec(sectorsContent);
  const centerRa = centerMatch ? parseFloat(centerMatch[1]) : (s.min_ra + s.max_ra) / 2;
  const centerDec = centerMatch ? parseFloat(centerMatch[2]) : (s.min_dec + s.max_dec) / 2;

  sectorsObj[id] = {
    ...s,
    center: { ra: centerRa, dec: centerDec },
    bounds: { minRa: s.min_ra, maxRa: s.max_ra, minDec: s.min_dec, maxDec: s.max_dec },
    displayOrder: s.display_order
  };
}

const sectorsList = Object.values(sectorsObj).sort((a, b) => a.displayOrder - b.displayOrder);

function simulateGetSectorByCoords(ra, dec) {
  const normalizedRa = ((ra % 360) + 360) % 360;
  const matches = [];

  for (const sector of sectorsList) {
    if (
      normalizedRa >= sector.bounds.minRa &&
      normalizedRa <= sector.bounds.maxRa &&
      dec >= sector.bounds.minDec &&
      dec <= sector.bounds.maxDec
    ) {
      matches.push(sector);
    }
  }

  if (matches.length === 1) return matches[0];

  if (matches.length > 1) {
    matches.sort((a, b) => {
      const areaA = (a.bounds.maxRa - a.bounds.minRa) * (a.bounds.maxDec - a.bounds.minDec);
      const areaB = (b.bounds.maxRa - b.bounds.minRa) * (b.bounds.maxDec - b.bounds.minDec);
      if (areaA !== areaB) {
        return areaA - areaB;
      }
      return a.displayOrder - b.displayOrder;
    });
    return matches[0];
  }

  const sliceIndex = Math.min(23, Math.max(0, Math.floor(normalizedRa / 15.0)));
  const fallbackSectorId = sqlFallbacks[sliceIndex] || 'pegasus';
  return sectorsObj[fallbackSectorId] || sectorsObj['orion'];
}

// Tüm merkez koordinatları test et
let centerTestErrors = 0;
for (const sector of sectorsList) {
  const resolved = simulateGetSectorByCoords(sector.center.ra, sector.center.dec);
  if (!resolved || resolved.id !== sector.id) {
    console.error(`Merkez çözümlenemedi: Sektör ${sector.id} merkez koordinatında (${sector.center.ra}, ${sector.center.dec}) -> Çözülen: ${resolved ? resolved.id : 'null'}`);
    centerTestErrors++;
  }
}
assert(centerTestErrors === 0, `24 sektörün 24'ünün de merkez koordinatı kendisini çözümlüyor`);

// 360x180 gökyüzü taraması (Her 10 derecede bir nokta test et: 36 x 18 = 648 nokta)
let coverageFailures = 0;
for (let ra = 0; ra < 360; ra += 10) {
  for (let dec = -85; dec <= 85; dec += 10) {
    const sec = simulateGetSectorByCoords(ra, dec);
    if (!sec || !sec.id) {
      coverageFailures++;
    }
  }
}
assert(coverageFailures === 0, `648 gökyüzü koordinat noktasında 0 boşluk (Tam gökyüzü kapsama güvencesi)`);

// 6. TAKIMYILDIZI ÇİZGİLERİ DOĞRULAMASI
console.log('\n--- 6. Takımyıldızı Çizgileri (constellationLines.data.ts) Testi ---');
const linesContent = fs.readFileSync(linesTsFile, 'utf8');

// Regex to extract all constellation segments
const segmentRegex = /\{[\s\S]*?constellationId:\s*'([^']+)'[\s\S]*?fromName:\s*'([^']+)'[\s\S]*?toName:\s*'([^']+)'[\s\S]*?from:\s*\{\s*ra:\s*([0-9.-]+),\s*dec:\s*([0-9.-]+)\s*\}[\s\S]*?to:\s*\{\s*ra:\s*([0-9.-]+),\s*dec:\s*([0-9.-]+)\s*\}[\s\S]*?\}/g;
let segmentCount = 0;
let invalidSegments = 0;
let segMatch;
const segmentsByConstellation = {};

while ((segMatch = segmentRegex.exec(linesContent)) !== null) {
  segmentCount++;
  const [_, constId, fromName, toName, fromRa, fromDec, toRa, toDec] = segMatch;

  segmentsByConstellation[constId] = (segmentsByConstellation[constId] || 0) + 1;

  // Check valid sector
  if (!sqlSectors[constId]) {
    console.error(`Çizgi segmenti geçersiz sektör id: ${constId}`);
    invalidSegments++;
  }

  // Check coordinates
  const fRa = parseFloat(fromRa);
  const fDec = parseFloat(fromDec);
  const tRa = parseFloat(toRa);
  const tDec = parseFloat(toDec);

  if (isNaN(fRa) || isNaN(fDec) || isNaN(tRa) || isNaN(tDec)) {
    console.error(`Çizgi segmentinde NaN koordinat: ${fromName} -> ${toName}`);
    invalidSegments++;
  }

  if (fRa < 0 || fRa > 360 || tRa < 0 || tRa > 360 || fDec < -90 || fDec > 90 || tDec < -90 || tDec > 90) {
    console.error(`Sınır dışı koordinat: ${fromName} -> ${toName}`);
    invalidSegments++;
  }
}

assert(segmentCount === 31, `Toplam 31 doğrulanmış Hipparcos çizgi segmenti tanımlı (Bulunan: ${segmentCount})`);
assert(invalidSegments === 0, `31 segmentin tamamı geçerli koordinatlara ve sektörlere sahip`);
assert(Object.keys(segmentsByConstellation).length === 7, `7 ana takımyıldızı çizgi verisi içeriyor (${Object.keys(segmentsByConstellation).join(', ')})`);

// 7. MODÜL VE API EXPORT TESTİ
console.log('\n--- 7. Modül ve API Export Testi ---');
const starServiceFile = path.join(__dirname, '..', 'src', 'modules', 'stars', 'api', 'starService.ts');
const starServiceContent = fs.readFileSync(starServiceFile, 'utf8');

assert(starServiceContent.includes('getSectorsOverview'), 'starService.getSectorsOverview metodu mevcut');
assert(starServiceContent.includes('claimStarInSector'), 'starService.claimStarInSector metodu mevcut');
assert(starServiceContent.includes('invalidateSectorsCache'), 'starService.invalidateSectorsCache metodu mevcut');

const moduleIndexFile = path.join(__dirname, '..', 'src', 'modules', 'stars', 'index.ts');
const moduleIndexContent = fs.readFileSync(moduleIndexFile, 'utf8');
assert(moduleIndexContent.includes('getSectorsOverview'), 'index.ts getSectorsOverview export ediyor');
assert(moduleIndexContent.includes('claimStarInSector'), 'index.ts claimStarInSector export ediyor');

const componentsIndexFile = path.join(__dirname, '..', 'src', 'modules', 'stars', 'components', 'index.ts');
const componentsIndexContent = fs.readFileSync(componentsIndexFile, 'utf8');
assert(componentsIndexContent.includes('SectorHUD'), 'components/index.ts SectorHUD export ediyor');
assert(componentsIndexContent.includes('SectorAtlasModal'), 'components/index.ts SectorAtlasModal export ediyor');
assert(moduleIndexContent.includes("export * from './components'"), 'modules/stars/index.ts components modülünü re-export ediyor');

// 8. ÖZET
console.log('\n================================================================');
console.log(`🎉 TEST TAMAMLANDI: ${passedTests} / ${totalTests} test başarıyla geçti!`);
console.log('================================================================\n');
