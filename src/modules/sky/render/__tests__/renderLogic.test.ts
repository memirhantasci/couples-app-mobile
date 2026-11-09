/// <reference types="jest" />
import * as Astronomy from "astronomy-engine";

import { computeSky } from "../../astronomy";
import { projectHorizontal } from "../../astronomy/projection";
import { SKY_STAR_NAMES } from "../../data/skyStarNames.data";
import { CHART_BAND, CHART_CENTER, CHART_HORIZON_RADIUS, directionMarkers } from "../chartGeometry";
import { MAX_STAR_LABELS, placeStarLabels, type LabelStar } from "../labelPlacement";
import { moonShape } from "../moonShape";
import { PRINT_CANVAS, printPosterLayout, STORY_CANVAS, STORY_FOOTER_HEIGHT, storyPosterLayout } from "../posterLayout";
import { buildSegmentsPath, buildStarBatches, MAGNITUDE_BUCKETS, magnitudeBucketIndex, starColorFromBV, starToneFromBV } from "../starStyle";

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe("B−V → renk", () => {
  it("null ve geçersiz değer nötr beyazdır", () => {
    expect(starColorFromBV(null)).toBe("#FFFFFF");
    expect(starColorFromBV(NaN)).toBe("#FFFFFF");
    expect(starToneFromBV(null)).toBe("neutral");
  });

  it("uçlarda sıkıştırılır", () => {
    expect(starColorFromBV(-5)).toBe(starColorFromBV(-0.4));
    expect(starColorFromBV(9)).toBe(starColorFromBV(2));
    expect(starColorFromBV(-0.4)).toBe("#9DB8FF");
    expect(starColorFromBV(2)).toBe("#FF9F5E");
  });

  it("monotondur: B−V arttıkça kırmızı artar, mavi azalır", () => {
    let previous = channels(starColorFromBV(-0.4));
    for (let bv = -0.35; bv <= 2; bv += 0.05) {
      const current = channels(starColorFromBV(bv));
      expect(current[0]).toBeGreaterThanOrEqual(previous[0]);
      expect(current[2]).toBeLessThanOrEqual(previous[2]);
      previous = current;
    }
  });

  it("ton sınırları", () => {
    expect(starToneFromBV(0.29)).toBe("cool");
    expect(starToneFromBV(0.3)).toBe("neutral");
    expect(starToneFromBV(0.89)).toBe("neutral");
    expect(starToneFromBV(0.9)).toBe("warm");
  });
});

describe("kadir → kova", () => {
  it.each([
    [-1.44, 0],
    [0.5, 0],
    [0.51, 1],
    [1.5, 1],
    [2.5, 2],
    [3.5, 3],
    [4.5, 4],
    [4.51, 5],
    [8, 5],
  ])("kadir %d → kova %d", (mag, bucket) => {
    expect(magnitudeBucketIndex(mag)).toBe(bucket);
  });

  it("parlak kova daha büyük ve en az o kadar opaktır", () => {
    for (let i = 1; i < MAGNITUDE_BUCKETS.length; i++) {
      expect(MAGNITUDE_BUCKETS[i].radius).toBeLessThan(MAGNITUDE_BUCKETS[i - 1].radius);
      expect(MAGNITUDE_BUCKETS[i].opacity).toBeLessThanOrEqual(MAGNITUDE_BUCKETS[i - 1].opacity);
    }
  });

  it("en sönük yıldız 1080 piksellik kartta en az ~1 piksel yarıçaplıdır", () => {
    const chartPx = (storyPosterLayout({ hasPlace: true, hasNames: true }).chartSize * 1080) / STORY_CANVAS.width;
    expect((MAGNITUDE_BUCKETS[MAGNITUDE_BUCKETS.length - 1].radius * chartPx) / 1000).toBeGreaterThanOrEqual(1);
  });
});

describe("Path gruplama (gerçek gökyüzü)", () => {
  const sky = computeSky({ latitude: 41.0082, longitude: 28.9784, date: "2025-02-14", time: "22:00" });
  const batches = buildStarBatches(sky.stars);

  it("Path sayısı kova mertebesindedir", () => {
    expect(batches.length).toBeLessThanOrEqual(17);
  });

  it("her yıldız tam bir kez çizilir", () => {
    const stars = batches.filter((b) => b.key.startsWith("star:"));
    const total = stars.reduce((sum, b) => sum + (b.d.match(/M /g) ?? []).length, 0);
    expect(total).toBe(sky.stars.length);
  });

  it("sıra: önce halolar, parlak yıldız en üstte", () => {
    expect(batches[0].key.startsWith("halo:")).toBe(true);
    expect(batches[batches.length - 1].key.startsWith("star:0:")).toBe(true);
  });

  it("kenarlar tek Path'te, hepsi var", () => {
    expect((buildSegmentsPath(sky.segments).match(/M /g) ?? []).length).toBe(sky.segments.length);
    expect(buildSegmentsPath([])).toBe("");
  });

  it("gerçek gökyüzünde etiketler sınır içinde ve çakışmasız", () => {
    const labels = placeStarLabels(sky.stars, SKY_STAR_NAMES);
    expect(labels.length).toBeGreaterThan(3);
    expect(labels.length).toBeLessThanOrEqual(MAX_STAR_LABELS);
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i];
        const b = labels[j];
        expect(a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom).toBe(false);
      }
    }
  });
});

describe("yön harfleri", () => {
  const markers = Object.fromEntries(directionMarkers().map((m) => [m.direction, m]));

  it("kuzey üstte, doğu solda, güney altta, batı sağda", () => {
    expect(markers.N.y).toBeLessThan(CHART_CENTER);
    expect(markers.E.x).toBeLessThan(CHART_CENTER);
    expect(markers.S.y).toBeGreaterThan(CHART_CENTER);
    expect(markers.W.x).toBeGreaterThan(CHART_CENTER);
  });

  it("harfler ufkun dışındaki bantta ve kutunun içindedir", () => {
    expect(CHART_CENTER - markers.N.y).toBeCloseTo(CHART_HORIZON_RADIUS + CHART_BAND / 2, 6);
    expect(markers.N.y - CHART_BAND / 2).toBeGreaterThanOrEqual(0);
    expect(markers.E.x - CHART_BAND / 2).toBeGreaterThanOrEqual(0);
  });
});

describe("etiket yerleştirme", () => {
  const star = (hip: number, x: number, y: number, mag: number): LabelStar => ({ hip, x, y, mag });
  const names = { 1: "Alpha", 2: "Beta", 3: "Gamma" };

  it("çakışan iki yıldızdan yalnızca daha parlağı etiketlenir", () => {
    const labels = placeStarLabels([star(1, 0, 0, 2), star(2, 0.01, 0.01, 1)], names);
    expect(labels.map((l) => l.hip)).toEqual([2]);
  });

  it("çakışmayanların ikisi de etiketlenir", () => {
    expect(placeStarLabels([star(1, -0.5, 0, 2), star(2, 0.2, 0.5, 1)], names)).toHaveLength(2);
  });

  it("üst sınırı aşmaz", () => {
    const stars = Array.from({ length: 40 }, (_, i) => star(100 + i, -0.5 + (i % 8) * 0.13, -0.6 + Math.floor(i / 8) * 0.2, 1));
    const many = Object.fromEntries(stars.map((s) => [s.hip, "Ab"]));
    expect(placeStarLabels(stars, many)).toHaveLength(MAX_STAR_LABELS);
  });

  it("adsız, sönük ve ufuk dışı yıldız etiketlenmez", () => {
    expect(placeStarLabels([star(9, 0, 0, 1)], names)).toEqual([]);
    expect(placeStarLabels([star(1, 0, 0, 2.6)], names)).toEqual([]);
    expect(placeStarLabels([star(1, 1.1, 0, 1)], names)).toEqual([]);
  });

  it("sağa taşan etiket sola geçer, daireden çıkamaz", () => {
    const [label] = placeStarLabels([star(1, 0.9, 0, 1)], names);
    expect(label.side).toBe("left");
    expect(label.right).toBeLessThanOrEqual(0.98);
  });

  it("engelin üstüne etiket koymaz", () => {
    expect(placeStarLabels([star(1, 0, 0, 1)], names, { obstacles: [{ left: 0, right: 0.3, top: -0.1, bottom: 0.1 }] })).toEqual([]);
  });

  it("öncelikli yıldız sönük olsa da önce yerleşir ve parlağı iter", () => {
    const labels = placeStarLabels([star(1, 0, 0, 0.5), star(50, 0.01, 0, 5)], names, { priority: { hip: 50, label: "Bizim" } });
    expect(labels.map((l) => l.text)).toEqual(["Bizim"]);
  });

  it("aynı girdi aynı çıktıyı verir", () => {
    const stars = [star(1, -0.5, 0, 1), star(2, 0.2, 0.5, 1), star(3, 0.1, -0.4, 1)];
    expect(placeStarLabels([...stars].reverse(), names)).toEqual(placeStarLabels(stars, names));
  });
});

describe("Ay evresi çizimi", () => {
  it("aydınlanma 0: yalnızca karanlık disk", () => {
    expect(moonShape(0, 0, 10, 0, true)).toMatchObject({ kind: "none", litPath: null });
  });

  it("aydınlanma 1: tam disk", () => {
    expect(moonShape(0, 0, 10, 1, true)).toMatchObject({ kind: "full", litPath: null });
  });

  it("yarım evre düz sonlandırıcıdır", () => {
    const shape = moonShape(0, 0, 10, 0.5, true);
    expect(shape.kind).toBe("partial");
    expect(shape.terminatorRx).toBe(0);
    expect(shape.litPath).toContain("L 0 -10");
  });

  it("büyüyen Ay sağdan, küçülen soldan aydınlıktır", () => {
    expect(moonShape(0, 0, 10, 0.3, true).litOnRight).toBe(true);
    expect(moonShape(0, 0, 10, 0.3, false).litOnRight).toBe(false);
    expect(moonShape(0, 0, 10, 0.3, true).litPath).toBe("M 0 -10 A 10 10 0 0 1 0 10 A 4 10 0 0 0 0 -10 Z");
    expect(moonShape(0, 0, 10, 0.3, false).litPath).toBe("M 0 -10 A 10 10 0 0 0 0 10 A 4 10 0 0 1 0 -10 Z");
  });

  it("şişkin evrede sonlandırıcı karşı yana taşar", () => {
    expect(moonShape(0, 0, 10, 0.8, true).litPath).toBe("M 0 -10 A 10 10 0 0 1 0 10 A 6.000000000000001 10 0 0 1 0 -10 Z");
    expect(moonShape(0, 0, 10, 0.8, false).litPath).toBe("M 0 -10 A 10 10 0 0 0 0 10 A 6.000000000000001 10 0 0 0 0 -10 Z");
  });

  it("aydınlık yan yarım küreye bağlı değildir: imzada hemisfer yoktur", () => {
    expect(moonShape.length).toBe(5);
  });

  it("aralık dışı aydınlanma sıkıştırılır", () => {
    expect(moonShape(0, 0, 10, -1, true).kind).toBe("none");
    expect(moonShape(0, 0, 10, 2, true).kind).toBe("full");
  });
});

describe("Ay'ın aydınlık yanı Güneş'e dönüktür (astronomy-engine ile bağımsız doğrulama)", () => {
  type Vector = [number, number, number];
  const DEG = Math.PI / 180;
  const unit = (altitude: number, azimuth: number): Vector => [Math.cos(altitude * DEG) * Math.cos(azimuth * DEG), Math.cos(altitude * DEG) * Math.sin(azimuth * DEG), Math.sin(altitude * DEG)];
  const chartX = ([north, east, up]: Vector) => projectHorizontal(Math.asin(up) / DEG, Math.atan2(east, north) / DEG).x;

  const horizonOf = (body: Astronomy.Body, date: Date, observer: Astronomy.Observer) => {
    const equator = Astronomy.Equator(body, date, observer, true, true);
    return Astronomy.Horizon(date, observer, equator.ra, equator.dec);
  };

  /** Haritada Ay'dan Güneş'e giden büyük çemberin başlangıç yönünün yatay bileşeni: artıysa Güneş sağ taraftadır. */
  function towardSunX(date: Date, latitude: number, longitude: number): { x: number; moonAltitude: number } {
    const observer = new Astronomy.Observer(latitude, longitude, 0);
    const moon = horizonOf(Astronomy.Body.Moon, date, observer);
    const sun = horizonOf(Astronomy.Body.Sun, date, observer);
    const m = unit(moon.altitude, moon.azimuth);
    const s = unit(sun.altitude, sun.azimuth);
    const cos = m[0] * s[0] + m[1] * s[1] + m[2] * s[2];
    const toward: Vector = [s[0] - cos * m[0], s[1] - cos * m[1], s[2] - cos * m[2]];
    const size = Math.hypot(...toward);
    const raw: Vector = [m[0] + (0.01 * toward[0]) / size, m[1] + (0.01 * toward[1]) / size, m[2] + (0.01 * toward[2]) / size];
    const length = Math.hypot(...raw);
    return { x: chartX([raw[0] / length, raw[1] / length, raw[2] / length]) - chartX(m), moonAltitude: moon.altitude };
  }

  const PLACES = [
    { label: "İstanbul", latitude: 41.0082, longitude: 28.9784 },
    { label: "New York", latitude: 40.7128, longitude: -74.006 },
    { label: "Sidney", latitude: -33.8688, longitude: 151.2093 },
    { label: "Cape Town", latitude: -33.92, longitude: 18.42 },
    { label: "Santiago", latitude: -33.45, longitude: -70.67 },
  ];

  it.each(PLACES)("$label: büyüyen ve küçülen Ay'da gerçek motorla aydınlık yan Güneş tarafında", ({ latitude, longitude }) => {
    const seen = { waxing: 0, waning: 0 };
    // Küçülen Ay gece geç doğar: sabaha karşı da bakılır
    for (const time of ["22:00", "04:00"]) {
      for (let day = 0; day < 120; day += 2) {
        const date = new Date(Date.UTC(2025, 0, 1 + day)).toISOString().slice(0, 10);
        const sky = computeSky({ latitude, longitude, date, time });
        const { illumination, waxing, altitude } = sky.moon;
        if (altitude < 15 || illumination < 0.1 || illumination > 0.9) continue;
        const { x, moonAltitude } = towardSunX(new Date(sky.utcIso), latitude, longitude);
        expect(Math.abs(moonAltitude - altitude)).toBeLessThan(2); // iki motor aynı Ay'a bakıyor
        expect(moonShape(0, 0, 10, illumination, waxing).litOnRight).toBe(x > 0);
        seen[waxing ? "waxing" : "waning"]++;
      }
    }
    expect(seen.waxing).toBeGreaterThan(2);
    expect(seen.waning).toBeGreaterThan(2);
  });

  it("iki yıl boyunca, iki yarım kürede kural neredeyse her saatte doğrudur; eski hemisfer kuralı güneyde yanlıştı", () => {
    const score = { north: [0, 0], south: [0, 0], southOld: [0, 0] };
    const start = Date.UTC(2024, 0, 1);
    for (const { latitude, longitude } of PLACES) {
      for (let step = 0; step < 730; step++) {
        const date = new Date(start + step * 24 * 3600 * 1000 + 3 * 3600 * 1000 * (step % 8));
        const { x, moonAltitude } = towardSunX(date, latitude, longitude);
        if (moonAltitude <= 0) continue;
        const phase = Astronomy.MoonPhase(date);
        const illumination = (1 - Math.cos(phase * DEG)) / 2;
        if (illumination < 0.01 || illumination > 0.99) continue;
        const waxing = phase < 180;
        const correct = moonShape(0, 0, 10, illumination, waxing).litOnRight === x > 0;
        const bucket = latitude < 0 ? score.south : score.north;
        bucket[correct ? 0 : 1]++;
        if (latitude < 0) score.southOld[(waxing !== true) === x > 0 ? 0 : 1]++;
      }
    }
    const ratio = ([good, bad]: number[]) => good / (good + bad);
    if (process.env.SKY_REPORT) console.log(`Ay limbi: ${JSON.stringify({ north: ratio(score.north), south: ratio(score.south), southOld: ratio(score.southOld) })}`);
    expect(ratio(score.north)).toBeGreaterThan(0.95);
    expect(ratio(score.south)).toBeGreaterThan(0.95);
    expect(ratio(score.southOld)).toBeLessThan(0.1);
  });
});

describe("dikey bütçe", () => {
  const flags = [true, false];

  it("sabitler StoryCard ile aynıdır", () => {
    // Yol jest kök dizinine göredir; projede @types/node yok
    const { readFileSync } = jest.requireActual<{ readFileSync: (path: string, encoding: string) => string }>("fs");
    const source = readFileSync("src/components/share/StoryCard.tsx", "utf8");
    expect(source).toContain(`DESIGN_WIDTH = ${STORY_CANVAS.width}`);
    expect(source).toContain(`DESIGN_HEIGHT = ${STORY_CANVAS.height}`);
    expect(source).toContain(`SAFE_TOP = ${STORY_CANVAS.safeTop}`);
    expect(source).toContain(`SAFE_BOTTOM = ${STORY_CANVAS.safeBottom}`);
    expect(source).toContain(`SIDE_PADDING = ${STORY_CANVAS.sidePadding}`);
  });

  it("hikâye kartı: kullanılabilir yükseklik 409, tüm birleşimler sığar", () => {
    expect(storyPosterLayout({ hasPlace: true, hasNames: true }).available).toBe(640 - 78 - 96 - STORY_FOOTER_HEIGHT);
    expect(STORY_FOOTER_HEIGHT).toBe(57);
    for (const hasPlace of flags) {
      for (const hasNames of flags) {
        for (const hasStarLine of flags) {
          const layout = storyPosterLayout({ hasPlace, hasNames, hasStarLine });
          expect(layout.total).toBeLessThanOrEqual(layout.available);
          expect(layout.chartSize).toBeLessThanOrEqual(layout.contentWidth);
          expect(layout.chartSize).toBeGreaterThanOrEqual(245);
        }
      }
    }
  });

  it("yıldız satırı bütçeden düşer, grafik küçülür", () => {
    const base = { hasPlace: true, hasNames: true };
    expect(storyPosterLayout({ ...base, hasStarLine: true }).chartSize).toBe(storyPosterLayout(base).chartSize - 15);
    expect(printPosterLayout({ ...base, hasSubtitle: true, hasStarLine: true }).chartSize).toBe(printPosterLayout({ ...base, hasSubtitle: true }).chartSize - 13);
  });

  it("boş satırlar grafiği büyütür", () => {
    expect(storyPosterLayout({ hasPlace: true, hasNames: false }).chartSize).toBeGreaterThan(storyPosterLayout({ hasPlace: true, hasNames: true }).chartSize);
    expect(storyPosterLayout({ hasPlace: false, hasNames: true }).chartSize).toBeGreaterThan(storyPosterLayout({ hasPlace: true, hasNames: true }).chartSize);
  });

  it("baskı düzeni sığar ve hikâyeden büyük daire verir", () => {
    const story = storyPosterLayout({ hasPlace: true, hasNames: true });
    for (const hasSubtitle of flags) {
      for (const hasPlace of flags) {
        for (const hasNames of flags) {
          for (const hasStarLine of flags) {
            const layout = printPosterLayout({ hasSubtitle, hasPlace, hasNames, hasStarLine });
            expect(layout.total).toBeLessThanOrEqual(layout.available);
            expect(layout.chartSize).toBeLessThanOrEqual(layout.contentWidth);
            expect(layout.chartSize).toBeGreaterThan(story.chartSize);
          }
        }
      }
    }
    expect(PRINT_CANVAS.height / PRINT_CANVAS.width).toBeCloseTo(4 / 3, 9);
  });
});

describe("TR/EN sky.poster metinleri", () => {
  // Evre ve yön anahtarları kodda dinamik üretildiği için derleyici eksikleri yakalamaz
  const tr = require("../../../../locales/tr.json").sky.poster;
  const en = require("../../../../locales/en.json").sky.poster;
  const phases = ["new", "waxingCrescent", "firstQuarter", "waxingGibbous", "full", "waningGibbous", "lastQuarter", "waningCrescent"];

  const leaves = (node: Record<string, unknown>, prefix = ""): string[] =>
    Object.entries(node).flatMap(([key, value]) =>
      typeof value === "object" && value !== null ? leaves(value as Record<string, unknown>, `${prefix}${key}.`) : [`${prefix}${key}`]
    );

  it("iki dilin anahtarları aynıdır", () => {
    expect(leaves(tr).sort()).toEqual(leaves(en).sort());
  });

  it.each([["tr", tr], ["en", en]])("%s: evreler, yönler ve metinler dolu", (_lang, strings) => {
    for (const phase of phases) expect(strings.moonPhase[phase].trim().length).toBeGreaterThan(0);
    for (const direction of ["N", "E", "S", "W"]) expect(strings.direction[direction].trim().length).toBeGreaterThan(0);
    for (const key of ["kicker", "defaultTitle", "realSkyNote", "attribution", "moonLine"]) expect(strings[key].trim().length).toBeGreaterThan(0);
    expect(strings.moonLine).toContain("{{phase}}");
    expect(strings.moonLine).toContain("{{percent}}");
    expect(strings.attribution).toContain("HYG");
    expect(strings.attribution).toContain("Stellarium");
    expect(strings.attribution).toContain("CC BY-SA");
  });

  it("evre listesi motorun 8 adıyla örtüşür", () => {
    expect(Object.keys(tr.moonPhase).sort()).toEqual([...phases].sort());
  });
});
