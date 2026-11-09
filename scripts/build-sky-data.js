#!/usr/bin/env node
/**
 * "Bizim Gecemiz" için gerçek-konumlu yıldız ve takımyıldızı çizgisi verisi üretir. Ağ erişimi YAPMAZ.
 *
 *   node scripts/build-sky-data.js \
 *     --hyg        <hygdata_v42.csv>       (https://www.astronexus.com/downloads/catalogs/hygdata_v42.csv.gz)
 *     --skyculture <western_index.json>    (https://raw.githubusercontent.com/Stellarium/stellarium-skycultures/master/western/index.json)
 *     --outdir     src/modules/sky/data
 *
 * Aynı girdiyle aynı çıktıyı verir (sıralama sabit, tarih/saat yazılmaz). Mantık: scripts/lib/skyDataBuilder.js
 */
/* global Buffer */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const B = require("./lib/skyDataBuilder");

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}
const hygPath = arg("hyg");
const skyPath = arg("skyculture");
const outDir = arg("outdir");
if (!hygPath || !skyPath || !outDir) {
  console.error("Kullanım: --hyg <csv> --skyculture <json> --outdir <klasör>");
  process.exit(1);
}

const sha = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const hygSha = sha(hygPath);
const skySha = sha(skyPath);

const { rows, rejected } = B.parseHyg(fs.readFileSync(hygPath, "utf8"));
const hygByHip = B.dedupeByHip(rows);
const { constellations, report } = B.parseConstellations(JSON.parse(fs.readFileSync(skyPath, "utf8")));
const { stars, names, constellations: lines, stats } = B.selectData(hygByHip, constellations);

const edgeCount = lines.reduce((n, c) => n + c.segments.length, 0);
const namedCount = Object.keys(names).length;

// ─── Başlık yorumu ────────────────────────────────────────────────────────────
const header = (what) => `/**
 * ELLE DÜZENLEME: bu dosya scripts/build-sky-data.js ile üretilir (aynı girdiyle aynı çıktı).
 *
 * ${what}
 *
 * Kaynaklar:
 *  - HYG Database v4.2 (Hipparcos, Yale Bright Star, Gliese) — https://www.astronexus.com/projects/hyg
 *    (güncel adres: https://codeberg.org/astronexus/hyg). Lisans: CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/
 *    Girdi SHA-256: ${hygSha}
 *  - Stellarium western sky culture (takımyıldızı çizgileri) — https://github.com/Stellarium/stellarium-skycultures (western/index.json)
 *    Lisans (western/description.md): "Text and data: CC BY-SA" (sürüm belirtilmemiş).
 *    Girdi SHA-256: ${skySha}
 *
 * Yapılan değişiklikler: sağ açıklık saatten dereceye çevrildi (x15); kadiri <= ${B.MAG_LIMIT} olan HIP'li yıldızlar ve takımyıldızı
 * çizgi uçları süzüldü; ra/dec 3, kadir ve renk indeksi 2 ondalığa yuvarlandı; çizgi dizileri ardışık kenar çiftlerine bölündü.
 *
 * Bu veri dosyası türetilmiş eserdir: CC BY-SA lisansıyla, kaynak atfıyla birlikte kalır. Uygulama kodundan ayrı tutulur.
 * Bu veri uygulamadaki Gökkubbe (src/modules/stars) konumlarından bağımsızdır: gerçek gökyüzü konumlarıdır.
 */
`;

const starRows = stars.map((s) => `  [${s[0]}, ${s[1]}, ${s[2]}, ${s[3]}, ${s[4] === null ? "null" : s[4]}],`).join("\n");
const starsTs = `${header("Gerçek-konumlu yıldız kataloğu: [hip, ra (derece, J2000), dec (derece), kadir, renk indeksi B-V | null], ra'ya göre sıralı.")}
export const SKY_STARS: readonly (readonly [hip: number, ra: number, dec: number, mag: number, ci: number | null])[] = [
${starRows}
];
`;

const nameRows = Object.keys(names)
  .map(Number)
  .sort((a, b) => a - b)
  .map((hip) => `  ${hip}: ${JSON.stringify(names[hip])},`)
  .join("\n");
const namesTs = `${header("Adlı yıldızlar: HIP numarası → ad (HYG 'proper' alanı, kadire göre en parlak " + namedCount + ").")}
export const SKY_STAR_NAMES: Readonly<Record<number, string>> = {
${nameRows}
};
`;

const conRows = lines
  .map((c) => `  { iau: ${JSON.stringify(c.iau)}, name: ${JSON.stringify(c.name)}, segments: ${JSON.stringify(c.segments)} },`)
  .join("\n");
const linesTs = `${header("Takımyıldızı çizgileri: her kenar iki HIP numarasıdır (uçlar SKY_STARS içinde bulunur).")}
export const SKY_CONSTELLATIONS: readonly { iau: string; name: string; segments: readonly (readonly [number, number])[] }[] = [
${conRows}
];
`;

fs.mkdirSync(outDir, { recursive: true });
const files = [
  ["skyStars.data.ts", starsTs],
  ["skyStarNames.data.ts", namesTs],
  ["skyConstellationLines.data.ts", linesTs],
];
let total = 0;
for (const [name, text] of files) {
  fs.writeFileSync(path.join(outDir, name), text);
  const bytes = Buffer.byteLength(text);
  total += bytes;
  console.log(`  ${name}: ${bytes} bayt`);
}

// Özet (belirlenimcilik kontrolü için)
const digest = crypto.createHash("sha256").update(files.map((f) => f[1]).join("\u0000")).digest("hex");
console.log(`Toplam: ${total} bayt (${(total / 1024).toFixed(1)} KB)`);
console.log(
  `yıldız: ${stars.length} (çizgi için eklenen sönük: ${stats.faintForLines})  adlı: ${namedCount}  takımyıldızı: ${lines.length}  kenar: ${edgeCount}`
);
console.log(
  `reddedilen: HYG bozuk satır ${rejected.badRow}; geçersiz HIP ${report.badHip.length}${report.badHip.length ? " " + report.badHip.join(",") : ""}; ` +
    `stil ön eki (thin/bold) ${report.styleMarkers}; kendine kenar ${report.selfEdges}; yinelenen kenar ${report.duplicateEdges}; ` +
    `HYG'de olmayan çizgi ucu ${stats.missingLineHips.length}${stats.missingLineHips.length ? " [" + stats.missingLineHips.join(",") + "]" : ""} ` +
    `(çıkarılan kenar ${stats.droppedEdges}); geçersiz ad ${stats.rejectedNames.length}${stats.rejectedNames.length ? " " + stats.rejectedNames.join(",") : ""}`
);
console.log(`çıktı özeti (sha256): ${digest}`);
