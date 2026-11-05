#!/usr/bin/env node
/**
 * HYG Database'ten gerçek yıldız seçip `celestial_catalog` için SQL migration üretir.
 *
 *   node scripts/build-hyg-catalog-migration.js \
 *     --hyg      <hygdata_v42.csv>            (https://www.astronexus.com/downloads/catalogs/hygdata_v42.csv.gz)
 *     --existing <canlı katalog dışa aktarımı.json>   ([{ catalog_code, ra, dec }, ...])
 *     --count    1500
 *     --out      supabase/migrations/<dosya>.sql
 *
 * Seçim kuralı (deterministik, aynı girdiyle aynı çıktı):
 *   1. Hipparcos numarası (HIP) olan, çok yıldızlı sistemin birincil bileşeni, kadiri <= 6.5, spektral türü bilinen yıldızlar
 *   2. Katalogda `HIP-<numara>` kodu zaten var olanlar atlanır
 *   3. En parlaktan başlanır; zaten kataloğda olan ya da seçilmiş bir yıldızın 0.05° yakınındaki yıldız atlanır
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
const mode = arg("mode", "expand"); // expand: yeni yıldız ekle | repair: mevcut yanlış verili yıldızları düzelt
const outPath = arg("out");
if (!hygPath || !existingPath || !outPath || !Number.isInteger(count) || count < 1 || !["expand", "repair"].includes(mode)) {
  console.error("Kullanım: --hyg <csv> --existing <json> --out <sql> [--mode expand --count <n> | --mode repair]");
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
const existingCodes = new Set(existing.map((row) => row.catalog_code));
const existingPoints = existing.map((row) => ({ ra: Number(row.ra), dec: Number(row.dec) }));

// Aynı yıldız sayılma eşiği: bu mesafeden yakın iki satır aynı yıldız kabul edilir
const MIN_SEPARATION_DEG = 0.05;

// ─── Onarım modu: mevcut HIP satırlarının verisini HYG'den düzelt ─────────────────
// Kod (HIP numarası) kimliktir; konum, kadir, spektral tür ve renk yetkili kaynaktan alınır. Tescilli satırlara dokunulmaz.
if (mode === "repair") {
  const truthByHip = new Map();
  for (let i = 1; i < lines.length; i++) {
    const f = parseLine(lines[i]);
    const hip = f[col.hip] ? Number(f[col.hip]) : null;
    if (!Number.isInteger(hip) || hip <= 0 || truthByHip.has(hip)) continue;
    const mag = Number(f[col.mag]);
    const ra = Number(f[col.ra]) * 15;
    const dec = Number(f[col.dec]);
    if (![mag, ra, dec].every(Number.isFinite) || ra < 0 || ra >= 360 || dec < -90 || dec > 90) continue;
    truthByHip.set(hip, { mag, ra, dec, spect: cleanSpect(f[col.spect]) });
  }
  const fixes = [];
  const skippedClaimed = [];
  let notInHyg = 0;
  let correct = 0;
  for (const row of existing) {
    const match = /^HIP-(\d+)$/.exec(row.catalog_code);
    if (!match) continue;
    const truth = truthByHip.get(Number(match[1]));
    if (!truth) {
      notInHyg++;
      continue;
    }
    const moved = angularSeparation({ ra: Number(row.ra), dec: Number(row.dec) }, truth);
    const wrong = moved > MIN_SEPARATION_DEG || Math.abs(Number(row.mag) - truth.mag) > 0.15;
    if (!wrong) {
      correct++;
      continue;
    }
    if (row.is_claimed) {
      skippedClaimed.push(row.catalog_code);
      continue;
    }
    const spect = truth.spect || cleanSpect(row.spectral_type) || "G2V";
    fixes.push({ code: row.catalog_code, ...truth, spect, moved });
  }
  fixes.sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true }));
  const quote = (text) => `'${String(text).replace(/'/g, "''")}'`;
  const repairRows = fixes.map(
    (s) => `  (${quote(s.code)}, ${s.ra.toFixed(4)}, ${s.dec.toFixed(4)}, ${s.mag.toFixed(2)}, ${quote(s.spect)}, ${quote(colorFor(s.spect))})`
  );
  const REPAIR_ROW_OK = /^ {2}\('HIP-\d+', \d{1,3}\.\d{4}, -?\d{1,2}\.\d{4}, -?\d{1,2}\.\d{2}, '[A-Za-z0-9.+/:()\- ]{1,16}', '#[0-9A-F]{6}'\)$/;
  for (const row of repairRows) if (!REPAIR_ROW_OK.test(row)) throw new Error(`Beklenmeyen satır biçimi: ${row}`);
  const moves = fixes.map((s) => s.moved).sort((a, b) => a - b);
  const median = moves[Math.floor(moves.length / 2)] || 0;
  const repairSql = `-- ============================================================================
-- İSTEĞE BAĞLI ONARIM (migration klasöründe DEĞİLDİR, kendiliğinden uygulanmaz): ${path.basename(outPath)}
-- Kataloğdaki yanlış verili ${fixes.length} yıldızın konum, kadir, spektral tür ve rengini HYG'den düzeltir
-- ============================================================================
-- Sorun: Mevcut ${correct + fixes.length + skippedClaimed.length} HIP kodlu yıldızdan ${correct} tanesi HYG Database ile uyuşuyor (konum <= ${MIN_SEPARATION_DEG}°, kadir farkı <= 0.15);
-- ${fixes.length + skippedClaimed.length} tanesinin konumu ya da parlaklığı o HIP numarasının gerçek yıldızından farklı (medyan konum farkı ${median.toFixed(1)}°, en büyük ${(moves[moves.length - 1] || 0).toFixed(1)}°).
-- Çözüm: HIP numarası kimlik kabul edilir; veri HYG'deki o numaralı yıldızdan alınır. Satır kimliği (id), kodu ve sektör dışındaki
-- hiçbir alan değişmez; sektör yeniden hesaplanır. Tescilli yıldızlara dokunulmaz (${skippedClaimed.length} yıldız atlandı: ${skippedClaimed.join(", ") || "-"}).
-- Önkoşul: 20261105000002_catalog_expansion_hyg_1500.sql (public.sky_sector_for_position).
-- Veri kaynağı ve lisans: HYG Database v4.2 — https://www.astronexus.com/projects/hyg — CC BY-SA 4.0
--
-- Dikkat: Bu işlem yıldızların haritadaki yerini değiştirir (yalnızca sahipsiz olanlar). Uygulamadan önce katalog yedeği alın.
-- ============================================================================

BEGIN;

UPDATE public.celestial_catalog AS c
   SET ra = v.ra,
       "dec" = v.dec,
       magnitude = v.mag,
       spectral_type = v.spect,
       base_color = v.color,
       sector_id = public.sky_sector_for_position(v.ra, v.dec)
  FROM (VALUES
${repairRows.join(",\n")}
  ) AS v(code, ra, dec, mag, spect, color)
 WHERE c.catalog_code = v.code
   AND c.is_claimed = FALSE;

COMMIT;
`;
  fs.writeFileSync(outPath, repairSql);
  console.log(`Yazıldı: ${outPath}`);
  console.log(`  doğru: ${correct}  düzeltilecek: ${fixes.length}  tescilli (atlandı): ${skippedClaimed.length}  HYG'de olmayan: ${notInHyg}  medyan kayma: ${median.toFixed(1)}°`);
  process.exit(0);
}

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
const chosen = [];
let skippedClose = 0;
for (const star of candidates) {
  if (chosen.length >= count) break;
  const tooClose =
    existingPoints.some((p) => Math.abs(p.dec - star.dec) < MIN_SEPARATION_DEG && angularSeparation(p, star) < MIN_SEPARATION_DEG) ||
    chosen.some((p) => Math.abs(p.dec - star.dec) < MIN_SEPARATION_DEG && angularSeparation(p, star) < MIN_SEPARATION_DEG);
  if (tooClose) {
    skippedClose++;
    continue;
  }
  chosen.push(star);
}
if (chosen.length < count) throw new Error(`Yeterli aday yok: ${chosen.length}/${count}`);
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
-- HIP-<numara> kodu zaten olanlar ve kataloktaki bir yıldıza 0.05° içindekiler atlandı; en parlaktan başlanarak
-- ${chosen.length} yıldız alındı. Kadir aralığı: ${magMin.toFixed(2)} – ${magMax.toFixed(2)}; adlı yıldız: ${named}.
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
console.log(`  yıldız: ${chosen.length}  kadir: ${magMin.toFixed(2)}–${magMax.toFixed(2)}  adlı: ${named}  yakınlık nedeniyle atlanan: ${skippedClose}  aday havuzu: ${candidates.length}`);
