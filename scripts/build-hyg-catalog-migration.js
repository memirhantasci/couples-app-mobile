#!/usr/bin/env node
/**
 * HYG Database'ten gerçek yıldız seçip `celestial_catalog` için SQL migration üretir.
 *
 *   node scripts/build-hyg-catalog-migration.js \
 *     --hyg            <hygdata_v42.csv>                (https://www.astronexus.com/downloads/catalogs/hygdata_v42.csv.gz)
 *     --existing       <canlı katalog dışa aktarımı.json>  ([{ catalog_code, ra, dec }, ...])
 *     --count          1500
 *     --min-separation 1.0                              (derece; varsayılan 1.0)
 *     --out            supabase/migrations/<dosya>.sql
 *
 * Seçim kuralı (deterministik, aynı girdiyle aynı çıktı):
 *   1. Hipparcos numarası (HIP) olan, çok yıldızlı sistemin birincil bileşeni, kadiri <= 6.5, spektral türü bilinen yıldızlar
 *   2. Katalogda `HIP-<numara>` kodu zaten var olanlar atlanır
 *   3. En parlaktan başlanır; kataloğdaki ya da seçilmiş herhangi bir yıldıza `--min-separation` dereceden yakın olan atlanır
 *      (haritada yıldızlar dip dibe gelmesin: mevcut yıldızların konumu bilerek ayarlıdır, onlara dokunulmaz)
 *   4. İstenen sayıya ulaşınca durur
 *
 * CSV içeriği güvenilmeyen VERİ olarak ele alınır: SQL'e yazılan her alan katı bir karakter listesinden geçer.
 * Veri kaynağı HYG Database, Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0) lisanslıdır:
 * kaynak ve lisans, üretilen migration'ın başlığına ve uygulamanın yasal metinlerine yazılır.
 */
const fs = require("fs");
const path = require("path");

// ─── Argümanlar ───────────────────────────────────────────────────────────────
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const hygPath = arg("hyg");
const existingPath = arg("existing");
const count = Number(arg("count", "1500"));
const minSeparation = Number(arg("min-separation", "1.0"));
const outPath = arg("out");
if (!hygPath || !existingPath || !outPath || !Number.isInteger(count) || count < 1 || !(minSeparation > 0)) {
  console.error("Kullanım: --hyg <csv> --existing <json> --out <sql> [--count <n>] [--min-separation <derece>]");
  process.exit(1);
}

// ─── CSV okuma (tırnaklı alanlar dahil) ───────────────────────────────────────
function parseLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const lines = fs.readFileSync(hygPath, "utf8").split(/\r?\n/).filter(Boolean);
const header = parseLine(lines[0]);
const col = Object.fromEntries(header.map((h, i) => [h, i]));
for (const need of ["hip", "proper", "ra", "dec", "mag", "spect", "comp"]) {
  if (!(need in col)) throw new Error(`HYG sütunu yok: ${need}`);
}

// ─── Temizleme (SQL'e giren her metin burada doğrulanır) ──────────────────────
const SPECT_OK = /^[A-Za-z0-9.+/:()\- ]{1,16}$/;
const NAME_OK = /^[A-Za-z0-9 .'-]{1,60}$/;

function cleanSpect(raw) {
  const value = String(raw || "").trim().slice(0, 16).trim();
  return SPECT_OK.test(value) ? value : null;
}
function cleanName(raw) {
  const value = String(raw || "").trim().replace(/’/g, "'");
  return NAME_OK.test(value) ? value : null;
}

// Mevcut katalogla aynı kural: spektral sınıf harfi → renk
const COLOR_BY_CLASS = { O: "#8AABFF", B: "#A5C3FF", A: "#DCE6FF", F: "#F8F9FB", G: "#FFECC3", K: "#FFD2A1", M: "#FF8F35" };
const CLASS_ALIAS = { W: "O", C: "M", S: "M", R: "K", N: "M", D: "A" };
function colorFor(spect) {
  const letter = spect[0].toUpperCase();
  return COLOR_BY_CLASS[letter] || COLOR_BY_CLASS[CLASS_ALIAS[letter]] || "#FFF4E8";
}

function angularSeparation(a, b) {
  const r = Math.PI / 180;
  const x = Math.sin(a.dec * r) * Math.sin(b.dec * r) + Math.cos(a.dec * r) * Math.cos(b.dec * r) * Math.cos((a.ra - b.ra) * r);
  return Math.acos(Math.min(1, Math.max(-1, x))) / r;
}

// ─── Aday havuzu ──────────────────────────────────────────────────────────────
const existing = JSON.parse(fs.readFileSync(existingPath, "utf8"));
// Güneş Sistemi nesneleri (SOL-*) harita üzerinde ayrı çizilir; yıldız aralığı hesabına girmez
const existingCodes = new Set(existing.map((row) => row.catalog_code));
const existingPoints = existing
  .filter((row) => !String(row.catalog_code).startsWith("SOL-"))
  .map((row) => ({ ra: Number(row.ra), dec: Number(row.dec) }));

const candidates = [];
for (let i = 1; i < lines.length; i++) {
  const f = parseLine(lines[i]);
  const hip = f[col.hip] ? Number(f[col.hip]) : null;
  if (!Number.isInteger(hip) || hip <= 0) continue;
  const comp = f[col.comp] === "" ? 1 : Number(f[col.comp]);
  if (comp !== 1) continue; // çok yıldızlı sistemlerin ikincil bileşenleri aynı noktada üst üste biner
  const mag = Number(f[col.mag]);
  const ra = Number(f[col.ra]) * 15; // HYG sağ açıklığı SAAT cinsinden verir
  const dec = Number(f[col.dec]);
  if (![mag, ra, dec].every(Number.isFinite) || mag > 6.5 || ra < 0 || ra >= 360 || dec < -90 || dec > 90) continue;
  const spect = cleanSpect(f[col.spect]);
  if (!spect) continue;
  if (existingCodes.has(`HIP-${hip}`)) continue;
  candidates.push({ hip, mag, ra, dec, spect, name: cleanName(f[col.proper]) });
}
candidates.sort((a, b) => a.mag - b.mag || a.hip - b.hip);

// ─── Seçim ────────────────────────────────────────────────────────────────────
const isTooClose = (star, points) =>
  points.some((p) => Math.abs(p.dec - star.dec) < minSeparation && angularSeparation(p, star) < minSeparation);

const chosen = [];
let skippedClose = 0;
for (const star of candidates) {
  if (chosen.length >= count) break;
  if (isTooClose(star, existingPoints) || isTooClose(star, chosen)) {
    skippedClose++;
    continue;
  }
  chosen.push(star);
}
if (chosen.length < count) throw new Error(`Yeterli aday yok: ${chosen.length}/${count}`);

// Kendi kendini doğrula: hiçbir seçilmiş yıldız bir başkasına ya da mevcut bir yıldıza eşikten yakın olamaz
let nearestChosen = Infinity;
for (let i = 0; i < chosen.length; i++) {
  for (const p of existingPoints) nearestChosen = Math.min(nearestChosen, angularSeparation(chosen[i], p));
  for (let j = i + 1; j < chosen.length; j++) nearestChosen = Math.min(nearestChosen, angularSeparation(chosen[i], chosen[j]));
}
if (nearestChosen < minSeparation) throw new Error(`Aralık kuralı ihlal edildi: ${nearestChosen}`);
chosen.sort((a, b) => a.hip - b.hip);

// ─── SQL ──────────────────────────────────────────────────────────────────────
const q = (text) => `'${String(text).replace(/'/g, "''")}'`;
const rows = chosen.map((s) => {
  const ra = s.ra.toFixed(4);
  const dec = s.dec.toFixed(4);
  const mag = s.mag.toFixed(2);
  const name = s.name ? q(s.name) : "NULL";
  return `  (${q("HIP-" + s.hip)}, ${ra}, ${dec}, ${mag}, ${q(s.spect)}, ${q(colorFor(s.spect))}, ${name})`;
});
// Son güvenlik: üretilen satırlar yalnızca beklenen biçimde olmalı
const ROW_OK = /^ {2}\('HIP-\d+', \d{1,3}\.\d{4}, -?\d{1,2}\.\d{4}, -?\d{1,2}\.\d{2}, '[A-Za-z0-9.+/:()\- ]{1,16}', '#[0-9A-F]{6}', (NULL|'[A-Za-z0-9 .'\-]{1,60}')\)$/;
const named = chosen.filter((s) => s.name).length;
for (const row of rows) {
  if (!ROW_OK.test(row.replace(/''/g, "'"))) throw new Error(`Beklenmeyen satır biçimi: ${row}`);
}

const magMin = Math.min(...chosen.map((s) => s.mag));
const magMax = Math.max(...chosen.map((s) => s.mag));
const sql = `-- ============================================================================
-- MIGRATION: ${path.basename(outPath)}
-- Gökyüzü kataloğuna ${chosen.length} gerçek yıldız eklenir (kapasite genişletmesi, Faz 0)
-- ============================================================================
-- Veri kaynağı: HYG Database v4.2 (Hipparcos, Yale Bright Star, Gliese) — https://www.astronexus.com/projects/hyg
-- Lisans: Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0) — https://creativecommons.org/licenses/by-sa/4.0/
-- Yapılan değişiklikler: ${chosen.length} satır seçildi, sağ açıklık saatten dereceye çevrildi, spektral sınıf harfi renge eşlendi.
-- Bu migration'ı üreten betik: scripts/build-hyg-catalog-migration.js (aynı girdiyle aynı çıktıyı verir).
--
-- Seçim: Hipparcos numarası olan, birincil bileşen, kadiri <= 6.5, spektral türü bilinen yıldızlar; katalogda
-- HIP-<numara> kodu zaten olanlar atlandı; en parlaktan başlanarak, kataloğdaki ya da seçilmiş herhangi bir yıldıza
-- ${minSeparation}° den yakın olanlar atlanarak ${chosen.length} yıldız alındı (yıldızlar dip dibe gelmesin; mevcut yıldızların
-- konumuna dokunulmaz). Gerçekleşen en yakın komşu mesafesi: ${nearestChosen.toFixed(2)}°.
-- Kadir aralığı: ${magMin.toFixed(2)} – ${magMax.toFixed(2)}; adlı yıldız: ${named}.
-- Her yıldız gökyüzünün tamamından gelir (sektör kutularının dışı dahil); sektör, 20260910_sky_sectors ile
-- aynı kuralla atanır (en küçük kutu, yoksa 15° sağ açıklık dilimi).
--
-- Geri alma (eklenen yıldızlar tescil edilmeden önce): bu dosyadaki HIP kodlarını ve is_claimed = FALSE koşulunu
-- kullanarak DELETE; ayrıca: DROP FUNCTION public.sky_sector_for_position(NUMERIC, NUMERIC).
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Yardımcı: bir koordinatın sektörü (20260910_sky_sectors.sql adım 3 ile birebir aynı kural)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sky_sector_for_position(p_ra NUMERIC, p_dec NUMERIC)
RETURNS VARCHAR(32)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT s.id
        FROM public.sky_sectors AS s
       WHERE p_ra >= s.min_ra AND p_ra <= s.max_ra
         AND p_dec >= s.min_dec AND p_dec <= s.max_dec
       ORDER BY ((s.max_ra - s.min_ra) * (s.max_dec - s.min_dec)) ASC, s.display_order ASC
       LIMIT 1
    ),
    CASE FLOOR(p_ra / 15.0)::int
      WHEN 0 THEN 'pisces' WHEN 1 THEN 'aries' WHEN 2 THEN 'aries' WHEN 3 THEN 'taurus'
      WHEN 4 THEN 'taurus' WHEN 5 THEN 'orion' WHEN 6 THEN 'gemini' WHEN 7 THEN 'canis_major'
      WHEN 8 THEN 'cancer' WHEN 9 THEN 'cancer' WHEN 10 THEN 'leo' WHEN 11 THEN 'leo'
      WHEN 12 THEN 'virgo' WHEN 13 THEN 'virgo' WHEN 14 THEN 'libra' WHEN 15 THEN 'libra'
      WHEN 16 THEN 'scorpius' WHEN 17 THEN 'sagittarius' WHEN 18 THEN 'sagittarius' WHEN 19 THEN 'aquila'
      WHEN 20 THEN 'cygnus' WHEN 21 THEN 'capricornus' WHEN 22 THEN 'aquarius' ELSE 'pegasus'
    END
  )::VARCHAR(32);
$$;

REVOKE ALL ON FUNCTION public.sky_sector_for_position(NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Yıldızlar
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.celestial_catalog
  (catalog_code, ra, "dec", magnitude, spectral_type, base_color, common_name, is_claimed, is_virtual, sector_id)
SELECT v.code, v.ra, v.dec, v.mag, v.spect, v.color, v.name, FALSE, FALSE, public.sky_sector_for_position(v.ra, v.dec)
  FROM (VALUES
${rows.join(",\n")}
  ) AS v(code, ra, dec, mag, spect, color, name)
ON CONFLICT (catalog_code) DO NOTHING;

COMMIT;
`;

fs.writeFileSync(outPath, sql);
console.log(`Yazıldı: ${outPath}`);
console.log(
  `  yıldız: ${chosen.length}  kadir: ${magMin.toFixed(2)}–${magMax.toFixed(2)}  adlı: ${named}  en yakın komşu: ${nearestChosen.toFixed(2)}°  aralık nedeniyle atlanan: ${skippedClose}  aday havuzu: ${candidates.length}`
);
