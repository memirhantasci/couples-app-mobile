const fs = require('fs');
const path = require('path');

const SOUNDS_DIR = path.join(__dirname, '..', 'assets', 'sounds');

if (!fs.existsSync(SOUNDS_DIR)) {
  fs.mkdirSync(SOUNDS_DIR, { recursive: true });
}

function createWavBuffer(samples, sampleRate = 44100) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // audio format (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write samples
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buffer.writeInt16LE(Math.floor(val), 44 + i * 2);
  }

  return buffer;
}

const sampleRate = 44100;

// 1. BUBBLE POP (Mood / Ruh Hali - 90ms soft rising bubble)
function generateBubblePop() {
  const duration = 0.09;
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = i / numSamples;
    // Frequency sweeps from 320Hz up to 780Hz
    const freq = 320 + Math.sin(progress * Math.PI * 0.5) * 460;
    const phase = 2 * Math.PI * freq * t;
    // Soft pluck envelope
    const envelope = Math.sin(progress * Math.PI) * Math.exp(-progress * 4.5);
    samples[i] = Math.sin(phase) * envelope * 0.75;
  }
  return createWavBuffer(samples, sampleRate);
}

// 2. SUCCESS CHIME (İlaç İçildi / Görev Başarısı - 420ms crystal chord)
function generateSuccessChime() {
  const duration = 0.42;
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  // Dual tone major bell: 880Hz (A5) + 1320Hz (E6) + 1760Hz (A6)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env1 = Math.exp(-t * 9);
    const env2 = Math.exp(-t * 11);
    const env3 = Math.exp(-t * 14);

    const s1 = Math.sin(2 * Math.PI * 880 * t) * env1 * 0.4;
    const s2 = Math.sin(2 * Math.PI * 1318.5 * t) * env2 * 0.3;
    const s3 = Math.sin(2 * Math.PI * 1760 * t) * env3 * 0.2;

    samples[i] = (s1 + s2 + s3);
  }
  return createWavBuffer(samples, sampleRate);
}

// 3. LETTER SEND (Mektup Gönderimi - 360ms whoosh & light sparkle)
function generateLetterSend() {
  const duration = 0.38;
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = i / numSamples;

    // Airy flutter & soft whoosh
    const whooshFreq = 400 + Math.sin(progress * Math.PI) * 700;
    const whoosh = Math.sin(2 * Math.PI * whooshFreq * t) * Math.sin(progress * Math.PI) * 0.3;

    // High harp sparkle at peak
    const sparkleEnv = Math.pow(progress, 2) * Math.exp(-progress * 5) * 2;
    const sparkle1 = Math.sin(2 * Math.PI * 1046.5 * t) * sparkleEnv * 0.25; // C6
    const sparkle2 = Math.sin(2 * Math.PI * 1567.98 * t) * sparkleEnv * 0.2; // G6
    const sparkle3 = Math.sin(2 * Math.PI * 2093.0 * t) * sparkleEnv * 0.15; // C7

    samples[i] = (whoosh + sparkle1 + sparkle2 + sparkle3) * 0.8;
  }
  return createWavBuffer(samples, sampleRate);
}

// 4. STAMP DROP (Harita Anı / Not Mührü - 110ms soft wooden tap)
function generateStampDrop() {
  const duration = 0.11;
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const progress = i / numSamples;

    // Quick snap attack
    const attack = Math.exp(-progress * 25) * (Math.random() * 2 - 1) * 0.35;
    // Resonant wooden body
    const bodyFreq = 160 * Math.exp(-progress * 4);
    const body = Math.sin(2 * Math.PI * bodyFreq * t) * Math.exp(-progress * 16) * 0.55;

    samples[i] = (attack + body);
  }
  return createWavBuffer(samples, sampleRate);
}

// 5. CAMERA CLICK (Fotoğraf Çekimi / Kaydetme - 130ms subtle shutter)
function generateCameraClick() {
  const duration = 0.13;
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  // Click 1 at t=0, Click 2 at t=0.04
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let s = 0;

    // Click 1 (Curtain open)
    if (t < 0.035) {
      const p1 = t / 0.035;
      s += (Math.random() * 2 - 1) * Math.exp(-p1 * 18) * 0.45;
      s += Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-p1 * 22) * 0.3;
    }

    // Click 2 (Curtain close)
    if (t >= 0.045 && t < 0.11) {
      const t2 = t - 0.045;
      const p2 = t2 / 0.065;
      s += (Math.random() * 2 - 1) * Math.exp(-p2 * 20) * 0.5;
      s += Math.sin(2 * Math.PI * 2200 * t2) * Math.exp(-p2 * 24) * 0.35;
    }

    samples[i] = s;
  }
  return createWavBuffer(samples, sampleRate);
}

// 6. CELEBRATION (Aşk Ölçer Zirve / Tebrik - 600ms romantic glissando)
function generateCelebration() {
  const duration = 0.55;
  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  // 4 notes: F#5 (740Hz), A#5 (932Hz), C#6 (1108Hz), F#6 (1480Hz)
  const notes = [
    { freq: 739.99, delay: 0.0 },
    { freq: 932.33, delay: 0.08 },
    { freq: 1108.73, delay: 0.16 },
    { freq: 1479.98, delay: 0.24 },
  ];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let s = 0;

    for (const note of notes) {
      if (t >= note.delay) {
        const noteT = t - note.delay;
        const env = Math.exp(-noteT * 7);
        s += Math.sin(2 * Math.PI * note.freq * noteT) * env * 0.22;
        // subtle soft harmonic
        s += Math.sin(2 * Math.PI * (note.freq * 2) * noteT) * (env * 0.5) * 0.08;
      }
    }

    samples[i] = s;
  }
  return createWavBuffer(samples, sampleRate);
}

fs.writeFileSync(path.join(SOUNDS_DIR, 'bubble_pop.wav'), generateBubblePop());
fs.writeFileSync(path.join(SOUNDS_DIR, 'success_chime.wav'), generateSuccessChime());
fs.writeFileSync(path.join(SOUNDS_DIR, 'letter_send.wav'), generateLetterSend());
fs.writeFileSync(path.join(SOUNDS_DIR, 'stamp_drop.wav'), generateStampDrop());
fs.writeFileSync(path.join(SOUNDS_DIR, 'camera_click.wav'), generateCameraClick());
fs.writeFileSync(path.join(SOUNDS_DIR, 'celebration.wav'), generateCelebration());

console.log('Successfully generated 6 high-quality micro sound files in assets/sounds/');
