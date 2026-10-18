/**
 * Android bildirim çubuğu (küçük) ikonunu üretir: assets/images/notification-icon.png
 *
 * Android bildirim ikonları, şeffaf zemin üzerinde TEK RENK (beyaz) olmalıdır; sistem alfa
 * kanalını boyar. Renkli uygulama ikonu (icon.png) verilirse bildirimde düz beyaz/gri bir kare
 * görünür. expo-notifications dokümanı: 96x96, beyaz, şeffaf arka planlı PNG.
 *
 * Kullanım: node scripts/generateNotificationIcon.js
 * Harici bağımlılık yoktur (PNG elle kodlanır).
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZE = 96;
const SUPERSAMPLE = 4; // kenar yumuşatma için 4x4 örnekleme

/** Klasik kalp eğrisi: (x²+y²-1)³ - x²y³ <= 0 */
function insideHeart(x, y) {
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y <= 0;
}

/** Piksel kapsama oranı (0..1) */
function coverage(px, py) {
  let hits = 0;
  for (let sy = 0; sy < SUPERSAMPLE; sy++) {
    for (let sx = 0; sx < SUPERSAMPLE; sx++) {
      const u = (px + (sx + 0.5) / SUPERSAMPLE) / SIZE; // 0..1
      const v = (py + (sy + 0.5) / SUPERSAMPLE) / SIZE;
      // Kalbi kenarlardan ~%20 boşlukla ortala (Android ikonu zaten küçük çizer); y ekseni yukarı doğru
      const x = (u - 0.5) * 2 * 1.5;
      const y = -((v - 0.5) * 2 * 1.5) + 0.1;
      if (insideHeart(x, y)) hits++;
    }
  }
  return hits / (SUPERSAMPLE * SUPERSAMPLE);
}

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

// RGBA satırları (her satırın başında filtre baytı 0)
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  const rowStart = y * (SIZE * 4 + 1);
  raw[rowStart] = 0;
  for (let x = 0; x < SIZE; x++) {
    const o = rowStart + 1 + x * 4;
    raw[o] = 255; // R
    raw[o + 1] = 255; // G
    raw[o + 2] = 255; // B
    raw[o + 3] = Math.round(coverage(x, y) * 255); // A
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit derinliği
ihdr[9] = 6; // RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = path.join(__dirname, "..", "assets", "images", "notification-icon.png");
fs.writeFileSync(out, png);
console.log(`Yazıldı: ${out} (${png.length} bayt, ${SIZE}x${SIZE})`);
