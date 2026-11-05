/// <reference types="jest" />
import { LABEL_GAP_PX, placeSolarLabels, type LabelBody } from '../solarLabels';

const LABEL = { width: 40, top: -10, bottom: 3 };
const body = (x: number, y: number, radius = 6, always = false): LabelBody => ({ x, y, radius, label: LABEL, always });

type Box = [number, number, number, number];
const labelBox = (p: { x: number; y: number }): Box => [p.x - LABEL.width / 2, p.y + LABEL.top, p.x + LABEL.width / 2, p.y + LABEL.bottom];
const markerBox = (b: LabelBody): Box => [b.x - b.radius, b.y - b.radius, b.x + b.radius, b.y + b.radius];
const overlap = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

describe('güneş sistemi etiketleri', () => {
  it('yalnız bir cismin etiketi altına yerleşir', () => {
    const [placement] = placeSolarLabels([body(100, 100)]);
    expect(placement).toEqual({ x: 100, y: 100 + 6 + LABEL_GAP_PX - LABEL.top });
  });

  it('alttaki yer doluysa etiket yukarı, sonra yana kayar (ekrandaki Uranüs / Ay / Dünya ve Güneş / Mars örnekleri)', () => {
    // Uranüs, Ay ve Dünya dikeyde üst üste
    const stacked = [body(200, 100), body(200, 125), body(204, 150)];
    const placements = placeSolarLabels(stacked);
    expect(placements.every((p) => p !== null)).toBe(true);
    // Mars, Güneş'in hemen altında; Güneş'in etiketi önce yerleşir ve Mars ondan kaçar
    const sunAndMars = [body(300, 300, 18, true), body(300, 330, 7)];
    const [sun, mars] = placeSolarLabels(sunAndMars);
    expect(sun).not.toBeNull();
    expect(mars).not.toBeNull();
    expect(overlap(labelBox(sun!), labelBox(mars!))).toBe(false);
  });

  it('hiçbir etiket bir işaretin ya da başka bir etiketin üstüne binmez (rastgele yerleşimler)', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let round = 0; round < 200; round += 1) {
      const bodies = Array.from({ length: 11 }, (_, i) => body(random() * 380, random() * 300, 3 + random() * 10, i === 0));
      const placements = placeSolarLabels(bodies);
      const placedBoxes: Box[] = [];
      placements.forEach((p, i) => {
        if (!p) return;
        const box = labelBox(p);
        bodies.forEach((other, j) => {
          if (j !== i && !(i === 0 && bodies[0].always && placedBoxes.length === 0)) {
            // Güneş her koşulda gösterildiğinden yalnızca onun zorunlu yedeği çakışabilir
            if (!(bodies[i].always)) expect(overlap(box, markerBox(other))).toBe(false);
          }
        });
        if (!bodies[i].always) for (const placed of placedBoxes) expect(overlap(box, placed)).toBe(false);
        placedBoxes.push(box);
      });
    }
  });

  it('dört yanı dolu gezegenin etiketi gizlenir; aynı yerdeki Güneş’inki her zaman gösterilir', () => {
    const blocker = (x: number, y: number, radius: number): LabelBody => ({ x, y, radius, label: null, always: false });
    const walls = [blocker(100, 125, 16), blocker(100, 75, 16), blocker(140, 100, 26), blocker(60, 100, 26)];
    const planet = placeSolarLabels([...walls, body(100, 100, 5)]);
    expect(planet[4]).toBeNull();
    const sun = placeSolarLabels([...walls, body(100, 100, 5, true)]);
    expect(sun[4]).not.toBeNull();
    // Etiketi olmayan cisim için yerleşim yok
    expect(placeSolarLabels([blocker(0, 0, 5)])[0]).toBeNull();
  });

  it('aynı noktadaki cisimlerin etiketleri farklı yönlere dağılır, üst üste binmez', () => {
    const placements = placeSolarLabels([body(100, 100, 30, true), body(100, 100, 30), body(100, 100, 30)]);
    const boxes = placements.filter((p): p is { x: number; y: number } => p !== null).map(labelBox);
    expect(boxes.length).toBe(3);
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) expect(overlap(boxes[i], boxes[j])).toBe(false);
    }
  });
});
