/**
 * "Bizim Gecemiz" gökyüzü verisi için saf mantık (dosya/ağ erişimi yok, test edilebilir).
 * Girdiler (HYG CSV, Stellarium index.json) GÜVENİLMEYEN VERİDİR: her alan burada katı doğrulamadan geçer.
 */

const MAG_LIMIT = 5.5;
const NAMED_COUNT = 60;
// Stellarium çizgi dizisinde HIP olmayan, belgelenmiş (README) çizgi ağırlığı ön ekleri
const LINE_STYLE_PREFIXES = new Set(["thin", "bold"]);
const NAME_OK = /^[\p{L}][\p{L} '-]{0,59}$/u;
const IAU_OK = /^[A-Za-z]{3}$/;
const EN_NAME_OK = /^[A-Za-z][A-Za-z '.-]{0,59}$/;

/** Tırnaklı alanları destekleyen tek satırlık CSV ayrıştırıcı. */
function parseCsvLine(line) {
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

/** HYG sağ açıklığı SAAT cinsindendir → derece. Geçersizse null. */
function hoursToDegrees(raw) {
  if (raw === "" || raw == null) return null;
  const hours = Number(raw);
  if (!Number.isFinite(hours)) return null;
  const deg = hours * 15;
  return deg >= 0 && deg < 360 ? deg : null;
}

/** Pozitif tam sayı HIP ya da null (sayı olmayan, 0, negatif, ondalık reddedilir). */
function parseHip(raw) {
  if (typeof raw === "number") return Number.isInteger(raw) && raw > 0 ? raw : null;
  if (typeof raw !== "string" || !/^[0-9]{1,7}$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return n > 0 ? n : null;
}

/** Yıldız adı: yalnızca harf, boşluk, kesme işareti, tire. Geçersizse null. */
function cleanStarName(raw) {
  const value = String(raw || "").trim().replace(/[’‘`]/g, "'");
  return NAME_OK.test(value) ? value : null;
}

function round(value, digits) {
  return Number(value.toFixed(digits));
}

/**
 * HYG CSV metninden aday satırları çıkarır.
 * @returns {{ rows: Array, rejected: { badRow: number } }}
 */
function parseHyg(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  for (const need of ["id", "hip", "proper", "ra", "dec", "mag", "ci", "comp"]) {
    if (!(need in col)) throw new Error(`HYG sütunu yok: ${need}`);
  }
  const rows = [];
  let badRow = 0;
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    const id = Number(f[col.id]);
    const hip = parseHip(f[col.hip] || "");
    if (hip === null || id === 0) continue; // HIP'siz ya da Güneş
    const ra = hoursToDegrees(f[col.ra]);
    const dec = f[col.dec] === "" ? NaN : Number(f[col.dec]);
    const mag = f[col.mag] === "" ? NaN : Number(f[col.mag]);
    if (ra === null || !Number.isFinite(dec) || dec < -90 || dec > 90 || !Number.isFinite(mag)) {
      badRow++;
      continue;
    }
    const ciRaw = f[col.ci];
    const ci = ciRaw === "" || !Number.isFinite(Number(ciRaw)) ? null : Number(ciRaw);
    const comp = f[col.comp] === "" ? 1 : Number(f[col.comp]);
    rows.push({ id, hip, ra, dec, mag, ci, comp, proper: f[col.proper] || "" });
  }
  return { rows, rejected: { badRow } };
}

/** Aynı HIP için tek kayıt: önce birincil bileşen (en küçük comp), sonra en parlak, sonra en küçük id. */
function dedupeByHip(rows) {
  const byHip = new Map();
  for (const r of rows) {
    const cur = byHip.get(r.hip);
    if (!cur || r.comp < cur.comp || (r.comp === cur.comp && (r.mag < cur.mag || (r.mag === cur.mag && r.id < cur.id)))) {
      byHip.set(r.hip, r);
    }
  }
  return byHip;
}

/**
 * Stellarium index.json → takımyıldızları. Geçersiz HIP'ler ve stil ön ekleri sayılır, kenarlar ardışık çiftlerden kurulur.
 */
function parseConstellations(index) {
  if (!index || !Array.isArray(index.constellations)) throw new Error("index.json: constellations dizisi yok");
  const report = { badHip: [], styleMarkers: 0, selfEdges: 0, duplicateEdges: 0, badConstellations: [] };
  const result = [];
  for (const c of index.constellations) {
    const iau = c && c.iau;
    if (typeof iau !== "string" || !IAU_OK.test(iau)) {
      report.badConstellations.push(String(iau));
      continue;
    }
    const english = c.common_name && typeof c.common_name.english === "string" ? c.common_name.english.trim() : "";
    const name = EN_NAME_OK.test(english) ? english : iau;
    const seen = new Set();
    const segments = [];
    for (const line of Array.isArray(c.lines) ? c.lines : []) {
      if (!Array.isArray(line)) continue;
      const hips = [];
      for (const token of line) {
        if (typeof token === "string" && LINE_STYLE_PREFIXES.has(token)) {
          report.styleMarkers++;
          continue;
        }
        const hip = parseHip(token);
        if (hip === null) {
          report.badHip.push(`${iau}:${JSON.stringify(token)}`);
          continue;
        }
        hips.push(hip);
      }
      for (let i = 0; i + 1 < hips.length; i++) {
        const a = hips[i];
        const b = hips[i + 1];
        if (a === b) {
          report.selfEdges++;
          continue;
        }
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (seen.has(key)) {
          report.duplicateEdges++;
          continue;
        }
        seen.add(key);
        segments.push([a, b]);
      }
    }
    result.push({ iau, name, segments });
  }
  result.sort((x, y) => (x.iau < y.iau ? -1 : x.iau > y.iau ? 1 : 0));
  return { constellations: result, report };
}

/**
 * Yıldız kataloğunu, adlı yıldızları ve çıkarılan çizgi kenarlarını seçer.
 * @param {Map<number, object>} hygByHip
 * @param {Array} constellations parseConstellations çıktısı
 */
function selectData(hygByHip, constellations) {
  const lineHips = new Set();
  for (const c of constellations) {
    for (const [a, b] of c.segments) {
      lineHips.add(a);
      lineHips.add(b);
    }
  }

  const missingLineHips = [...lineHips].filter((h) => !hygByHip.has(h)).sort((a, b) => a - b);
  const missing = new Set(missingLineHips);

  // Eksik uçlu kenarları çıkar (uydurma yok)
  let droppedEdges = 0;
  const cleaned = constellations.map((c) => {
    const segments = c.segments.filter(([a, b]) => {
      const ok = !missing.has(a) && !missing.has(b);
      if (!ok) droppedEdges++;
      return ok;
    });
    return { ...c, segments };
  });

  const chosen = [];
  let faintForLines = 0;
  for (const r of hygByHip.values()) {
    const inLines = lineHips.has(r.hip) && !missing.has(r.hip);
    if (r.mag <= MAG_LIMIT) chosen.push(r);
    else if (inLines) {
      chosen.push(r);
      faintForLines++;
    }
  }
  chosen.sort((a, b) => a.ra - b.ra || a.hip - b.hip);

  const stars = chosen.map((r) => [r.hip, round(r.ra, 3), round(r.dec, 3), round(r.mag, 2), r.ci === null ? null : round(r.ci, 2)]);

  // Adlı yıldızlar: en parlak NAMED_COUNT, geçersiz adlar atlanır ve sayılır
  const rejectedNames = [];
  const names = {};
  const candidates = chosen.filter((r) => r.proper).sort((a, b) => a.mag - b.mag || a.hip - b.hip);
  const used = new Set();
  let count = 0;
  for (const r of candidates) {
    if (count >= NAMED_COUNT) break;
    const name = cleanStarName(r.proper);
    if (!name) {
      rejectedNames.push(`${r.hip}:${JSON.stringify(r.proper)}`);
      continue;
    }
    if (used.has(name)) continue;
    used.add(name);
    names[r.hip] = name;
    count++;
  }

  return { stars, names, constellations: cleaned, stats: { missingLineHips, droppedEdges, faintForLines, rejectedNames } };
}

module.exports = {
  MAG_LIMIT,
  NAMED_COUNT,
  parseCsvLine,
  hoursToDegrees,
  parseHip,
  cleanStarName,
  parseHyg,
  dedupeByHip,
  parseConstellations,
  selectData,
};
