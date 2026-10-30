// Yıldız haritası sesleri: dokunma "çınlaması" ve döngüsel arka plan.
// Kullanım: node scripts/generateStarSounds.js  (assets/sounds/ altına yazar)
const fs = require('fs');
const path = require('path');

const SOUNDS_DIR = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(SOUNDS_DIR, { recursive: true });

function createWavBuffer(samples, sampleRate) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
  }
  return buffer;
}

function normalize(samples, peak) {
  let max = 0;
  for (const v of samples) max = Math.max(max, Math.abs(v));
  const g = max > 0 ? peak / max : 1;
  for (let i = 0; i < samples.length; i++) samples[i] *= g;
}

// ─── 1. CELESTIAL CHIME ─────────────────────────────────────────────────────
// Yıldıza dokununca: yukarı doğru dört notalık yumuşak, cam gibi bir "pırıltı" + hafif yankı.
// (Önceki ses 200-1000 Hz'de yoğunlaşmış, üst harmoniği olmayan donuk bir tondu.)
function generateCelestialChime() {
  const sr = 44100;
  const duration = 2.2;
  const n = Math.floor(sr * duration);
  const dry = new Float64Array(n);

  // G5 - C6 - E6 - G6 (pentatonik, huzurlu ve parlak)
  const notes = [
    { f: 783.99, start: 0.0, amp: 0.8 },
    { f: 1046.5, start: 0.09, amp: 0.85 },
    { f: 1318.51, start: 0.18, amp: 0.9 },
    { f: 1567.98, start: 0.28, amp: 1.0 },
  ];
  // Cam/çan benzeri kısmi sesler: oran, genlik, sönüm süresi (sn)
  const partials = [
    { r: 1.0, a: 1.0, tau: 0.55 },
    { r: 2.0, a: 0.32, tau: 0.34 },
    { r: 2.76, a: 0.2, tau: 0.22 },
    { r: 5.4, a: 0.08, tau: 0.1 },
  ];

  for (const note of notes) {
    const s0 = Math.floor(note.start * sr);
    for (let i = s0; i < n; i++) {
      const t = (i - s0) / sr;
      const attack = 1 - Math.exp(-t / 0.004); // ~4 ms yumuşak atak (tık yok)
      let v = 0;
      for (const p of partials) {
        v += p.a * Math.exp(-t / p.tau) * Math.sin(2 * Math.PI * note.f * p.r * t);
      }
      dry[i] += note.amp * 0.3 * attack * v;
    }
  }

  // Schroeder yankısı: 4 paralel comb (alçak geçirgen sönümlü) + 2 ardışık allpass
  const wet = new Float64Array(n);
  const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((d) => ({
    buf: new Float64Array(Math.floor(d * sr)),
    idx: 0,
    lp: 0,
  }));
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (const c of combs) {
      const y = c.buf[c.idx];
      c.lp = y * 0.65 + c.lp * 0.35; // yüksek frekansları sönümle
      c.buf[c.idx] = dry[i] + c.lp * 0.8;
      c.idx = (c.idx + 1) % c.buf.length;
      acc += y;
    }
    wet[i] = acc * 0.25;
  }
  for (const d of [0.005, 0.0017]) {
    const buf = new Float64Array(Math.floor(d * sr));
    let idx = 0;
    for (let i = 0; i < n; i++) {
      const bufOut = buf[idx];
      const x = wet[i] - 0.7 * bufOut;
      buf[idx] = x;
      wet[i] = bufOut + 0.7 * x;
      idx = (idx + 1) % buf.length;
    }
  }

  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = dry[i] * 0.75 + wet[i] * 0.55;

  // Son 250 ms kosinüs ile sönsün (kesilme tıkı olmasın)
  const fade = Math.floor(sr * 0.25);
  for (let i = 0; i < fade; i++) {
    out[n - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fade);
  }
  normalize(out, 0.6);
  return createWavBuffer(out, sr);
}

// ─── 2. COSMIC AMBIENT ──────────────────────────────────────────────────────
// Döngüsel, yumuşak "pad": Dsus2/A akoru, hafif kayık (chorus) sinüsler + çok hafif yüksek parıltı.
// (Önceki ses %96 oranında 200 Hz altındaydı: telefon hoparlöründe duyulmayan bir uğultu.)
// Döngü kusursuzdur: tüm frekanslar ve LFO'lar k/16 Hz olduğundan 16 sn'de tam sayıda periyot tamamlanır.
function generateCosmicAmbient() {
  const sr = 22050;
  const loopSec = 16;
  const n = sr * loopSec;
  const out = new Float64Array(n);

  // f (k/16 Hz), genlik, genlik-LFO (m/16 Hz), LFO fazı
  const voices = [
    { f: 110.0, a: 0.3, lfo: 1, ph: 0.0 }, // A2
    { f: 164.8125, a: 0.55, lfo: 2, ph: 1.3 }, // E3
    { f: 220.0, a: 0.6, lfo: 3, ph: 2.6 }, // A3
    { f: 246.9375, a: 0.4, lfo: 1, ph: 4.1 }, // B3 (sus2)
    { f: 329.625, a: 0.4, lfo: 2, ph: 0.7 }, // E4
    { f: 987.75, a: 0.07, lfo: 3, ph: 3.3 }, // B5 parıltı
    { f: 1318.5, a: 0.05, lfo: 2, ph: 5.2 }, // E6 parıltı
  ];
  const detune = 0.125; // = 2/16 Hz → 0.25 Hz'lik yavaş "dalgalanma" (chorus)
  const twoPi = 2 * Math.PI;

  for (const v of voices) {
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const lfo = 0.65 + 0.35 * Math.sin(twoPi * (v.lfo / loopSec) * t + v.ph);
      // İkinci sinüs zayıf ve her seste farklı fazda: tüm seslerin zarfı aynı anda sıfırlanıp
      // "pompalama" yapmasın (eşit genlikte olsaydı vuru zarfı 2 sn'de topluca sıfıra inerdi).
      const tone =
        Math.sin(twoPi * (v.f - detune) * t + v.ph) +
        0.55 * Math.sin(twoPi * (v.f + detune) * t - v.ph) +
        0.22 * Math.sin(twoPi * v.f * 2 * t); // 2. harmonik: küçük hoparlörde gövde
      out[i] += v.a * lfo * tone;
    }
  }
  // Çok yavaş genel "nefes" (16 sn'de tam 1 periyot)
  for (let i = 0; i < n; i++) {
    out[i] *= 0.8 + 0.2 * Math.sin(twoPi * (i / n) - 1.0);
  }
  normalize(out, 0.5);
  return createWavBuffer(out, sr);
}

fs.writeFileSync(path.join(SOUNDS_DIR, 'celestial_chime.wav'), generateCelestialChime());
// Not: yayınlanan cosmic_ambient.wav bu çıktının 22,05 kHz mono'ya indirilmiş halidir (3,2 MB → 0,8 MB)
fs.writeFileSync(path.join(SOUNDS_DIR, 'cosmic_ambient.wav'), generateCosmicAmbient());
console.log('Yazıldı: celestial_chime.wav, cosmic_ambient.wav');
