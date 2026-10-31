import { METEOR_SLOT_MS, activeMeteorsInView, meteorForSlot, meteorSegment } from '../meteorSchedule';

const BASE_SLOT = Math.floor(1.7e12 / METEOR_SLOT_MS);

describe('meteorSchedule', () => {
  it('launches one meteor per slot, about 0.42 per second', () => {
    expect(meteorForSlot(BASE_SLOT)).not.toBeNull();
    expect(1000 / METEOR_SLOT_MS).toBeCloseTo(0.42, 2);
  });

  it('flies about 25% faster than the old 26–32 s fall', () => {
    let total = 0;
    const count = 2000;
    for (let i = 0; i < count; i++) total += meteorForSlot(BASE_SLOT + i)!.durationMs;
    expect(total / count / 1000).toBeCloseTo(29 / 1.25, 0);
  });

  it('spreads launches evenly over the whole map (RA)', () => {
    const bins = new Array(12).fill(0);
    const count = 6000;
    for (let i = 0; i < count; i++) bins[Math.floor(meteorForSlot(BASE_SLOT + i)!.startRa / 30)]++;
    for (const n of bins) expect(Math.abs(n - count / 12)).toBeLessThan((count / 12) * 0.1);
  });

  it('never starts two consecutive meteors close together', () => {
    for (let i = 0; i < 3000; i++) {
      const a = meteorForSlot(BASE_SLOT + i)!.startRa;
      const b = meteorForSlot(BASE_SLOT + i + 1)!.startRa;
      const gap = Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
      expect(gap).toBeGreaterThan(60);
    }
  });

  it('is the same for every device (pure function of the slot)', () => {
    expect(meteorForSlot(BASE_SLOT + 5)).toEqual(meteorForSlot(BASE_SLOT + 5));
  });

  it('rarely shows two meteors on screen at once', () => {
    const camera = { ra: 120, dec: 10, zoom: 3 };
    const t0 = 1.7e12;
    let samples = 0;
    let multiple = 0;
    for (let ms = 0; ms < 60 * 60 * 1000; ms += 1000) {
      const visible = activeMeteorsInView(t0 + ms, camera, 390, 844).filter((e) => {
        const s = meteorSegment(e, t0 + ms, camera, 390, 844);
        return s && s.alpha > 0.15;
      });
      samples++;
      if (visible.length >= 2) multiple++;
    }
    expect(multiple / samples).toBeLessThan(0.005);
  });
});
