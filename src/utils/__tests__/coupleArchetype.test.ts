/// <reference types="jest" />
import {
  ARCHETYPE_EMOJI,
  MEETING_WEIGHT,
  MIN_ARCHETYPE_ACTIVITY,
  MIN_TIMED_ENTRIES,
  computeCoupleArchetype,
  isMorningHour,
  isNightHour,
  type ArchetypeInput,
} from "../coupleArchetype";

const base: ArchetypeInput = {
  lettersCount: 0,
  dailyNotesCount: 0,
  photosCount: 0,
  meetingsCount: 0,
  moodEntriesCount: 0,
  entryHours: [],
};

const hoursOf = (hour: number, count: number) => Array.from({ length: count }, () => hour);

describe("saat sınırları", () => {
  it("gece 22:00-04:59, sabah 05:00-09:59", () => {
    expect([21, 22, 23, 0, 4, 5].map(isNightHour)).toEqual([false, true, true, true, true, false]);
    expect([4, 5, 9, 10].map(isMorningHour)).toEqual([false, true, true, false]);
  });
});

describe("computeCoupleArchetype", () => {
  it("çok az kayıtta nazik başlangıç tipi (starlight) verir", () => {
    const result = computeCoupleArchetype({ ...base, lettersCount: MIN_ARCHETYPE_ACTIVITY - 1 });
    expect(result).toEqual({ id: "starlight", evidence: { key: "none", value: 0 } });
  });

  it("hiç veri yoksa da starlight", () => {
    expect(computeCoupleArchetype(base).id).toBe("starlight");
  });

  it("yalnızca ruh hali kaydı varsa (içerik yok) starlight", () => {
    expect(computeCoupleArchetype({ ...base, moodEntriesCount: 20 }).id).toBe("starlight");
  });

  it("kayıtların çoğu geceyse nightOwls ve yüzdeyi kanıt olarak verir", () => {
    const result = computeCoupleArchetype({
      ...base,
      lettersCount: 6,
      dailyNotesCount: 4,
      entryHours: [...hoursOf(23, 7), ...hoursOf(1, 1), ...hoursOf(14, 2)],
    });
    expect(result).toEqual({ id: "nightOwls", evidence: { key: "night", value: 80 } });
  });

  it("kayıtların çoğu sabahsa earlyBirds", () => {
    const result = computeCoupleArchetype({
      ...base,
      dailyNotesCount: 10,
      entryHours: [...hoursOf(7, 9), ...hoursOf(20, 1)],
    });
    expect(result).toEqual({ id: "earlyBirds", evidence: { key: "morning", value: 90 } });
  });

  it("saatli kayıt azsa saat tabanlı tip seçilmez (içerik tipine düşer)", () => {
    const result = computeCoupleArchetype({
      ...base,
      lettersCount: 5,
      entryHours: hoursOf(23, MIN_TIMED_ENTRIES - 1),
    });
    expect(result.id).toBe("letterPoets");
  });

  it("gece payı eşiğin altındaysa (%50) içerik tipine düşer", () => {
    const result = computeCoupleArchetype({
      ...base,
      photosCount: 6,
      entryHours: [...hoursOf(23, 5), ...hoursOf(15, 5)],
    });
    expect(result.id).toBe("memoryHunters");
  });

  it("içerik tipi: en çok mektup → letterPoets", () => {
    expect(computeCoupleArchetype({ ...base, lettersCount: 9, dailyNotesCount: 3, photosCount: 2 })).toEqual({
      id: "letterPoets",
      evidence: { key: "letters", value: 9 },
    });
  });

  it("içerik tipi: en çok fotoğraf → memoryHunters", () => {
    expect(computeCoupleArchetype({ ...base, lettersCount: 2, photosCount: 12 })).toEqual({
      id: "memoryHunters",
      evidence: { key: "photos", value: 12 },
    });
  });

  it("içerik tipi: en çok günlük not → journalists", () => {
    expect(computeCoupleArchetype({ ...base, lettersCount: 1, dailyNotesCount: 15 })).toEqual({
      id: "journalists",
      evidence: { key: "notes", value: 15 },
    });
  });

  it(`bir buluşma ${MEETING_WEIGHT} mektup kadar sayılır → explorers`, () => {
    const result = computeCoupleArchetype({ ...base, lettersCount: 5, meetingsCount: 2 });
    expect(result).toEqual({ id: "explorers", evidence: { key: "meetings", value: 2 } });
    // Eşitlikte (3 mektup = 1 buluşma) sabit sıra: mektup önce gelir
    expect(computeCoupleArchetype({ ...base, lettersCount: MEETING_WEIGHT, meetingsCount: 1, moodEntriesCount: 2 }).id).toBe(
      "letterPoets"
    );
  });

  it("aynı girdi her zaman aynı tipi verir (kararlı)", () => {
    const input = { ...base, lettersCount: 4, photosCount: 4, dailyNotesCount: 4, meetingsCount: 0 };
    const ids = Array.from({ length: 5 }, () => computeCoupleArchetype(input).id);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBe("letterPoets");
  });

  it("bozuk saatleri ve negatif sayıları yok sayar", () => {
    const result = computeCoupleArchetype({
      ...base,
      lettersCount: 6,
      entryHours: [NaN, -1, 24, 3.5, ...hoursOf(23, MIN_TIMED_ENTRIES - 1)],
    });
    // Geçerli saat sayısı eşiğin altında kaldığı için saat tabanlı tip seçilmez
    expect(result.id).toBe("letterPoets");
    expect(computeCoupleArchetype({ ...base, lettersCount: -5, dailyNotesCount: 9 }).id).toBe("journalists");
  });

  it("her tipin simgesi var", () => {
    const ids = ["nightOwls", "earlyBirds", "letterPoets", "memoryHunters", "explorers", "journalists", "starlight"] as const;
    for (const id of ids) expect(ARCHETYPE_EMOJI[id]).toBeTruthy();
  });
});

describe("çift tipi metinleri (TR/EN)", () => {
  // Anahtarlar kodda dinamik üretildiği için derleyici eksikleri yakalamaz: burada doğrulanır
  const tr = require("../../locales/tr.json").wrapped.archetype;
  const en = require("../../locales/en.json").wrapped.archetype;
  const ids = ["nightOwls", "earlyBirds", "letterPoets", "memoryHunters", "explorers", "journalists", "starlight"] as const;

  it.each(["tr", "en"] as const)("%s: her tipin adı, cümlesi ve üç özelliği dolu", (lang) => {
    const strings = lang === "tr" ? tr : en;
    for (const id of ids) {
      for (const field of ["name", "line", "trait1", "trait2", "trait3"] as const) {
        expect(typeof strings[id][field]).toBe("string");
        expect(strings[id][field].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it.each(["tr", "en"] as const)("%s: kanıt satırları (çoğul biçimleriyle) tam", (lang) => {
    const evidence = (lang === "tr" ? tr : en).evidence;
    for (const key of ["night", "morning", "none"]) expect(evidence[key]).toBeTruthy();
    for (const key of ["letters", "photos", "meetings", "notes"]) {
      expect(evidence[`${key}_one`]).toBeTruthy();
      expect(evidence[`${key}_other`]).toBeTruthy();
    }
    expect(evidence.night).toContain("{{percent}}");
    expect(evidence.morning).toContain("{{percent}}");
    expect(evidence.letters_other).toContain("{{count}}");
  });
});
