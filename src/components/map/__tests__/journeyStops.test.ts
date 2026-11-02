/// <reference types="jest" />
import { MAX_JOURNEY_STOPS, buildJourneyStops, distanceMeters } from "../journeyStops";
import type { MapNote, MeetingPin, PhotoPin } from "../mapTypes";

const NOW = Date.parse("2026-06-01T12:00:00Z");

const photo = (id: number, date: string, latitude: number, longitude: number): PhotoPin => ({
  id,
  storage_path: `p/${id}.jpg`,
  latitude,
  longitude,
  taken_date: date,
  user_id: "u1",
});

const note = (id: number, date: string, latitude: number, longitude: number): MapNote => ({
  id,
  user_id: "u1",
  latitude,
  longitude,
  note: "Seni seviyorum",
  created_at: date,
});

const meeting = (id: number, date: string, latitude: number, longitude: number): MeetingPin => ({
  id,
  title: "Buluşma",
  latitude,
  longitude,
  meeting_datetime: date,
  is_active: true,
  user_id: "u1",
});

describe("buildJourneyStops", () => {
  it("tüm pin türlerini eskiden yeniye dizer", () => {
    const stops = buildJourneyStops(
      {
        photos: [photo(1, "2026-03-01T10:00:00Z", 41.0, 29.0)],
        notes: [note(2, "2026-01-15T10:00:00Z", 39.9, 32.8)],
        meetings: [meeting(3, "2026-02-10T10:00:00Z", 38.4, 27.1)],
      },
      NOW
    );
    expect(stops.map((s) => s.key)).toEqual(["note-2", "meeting-3", "photo-1"]);
  });

  it("gelecekteki buluşmaları ve tarihi okunamayan kayıtları rotaya almaz", () => {
    const stops = buildJourneyStops(
      {
        photos: [photo(1, "geçersiz", 41.0, 29.0)],
        notes: [note(2, "2026-01-15T10:00:00Z", 39.9, 32.8)],
        meetings: [meeting(3, "2026-12-31T10:00:00Z", 38.4, 27.1)],
      },
      NOW
    );
    expect(stops.map((s) => s.key)).toEqual(["note-2"]);
  });

  it("aynı yerdeki ardışık anıları tek durakta birleştirir", () => {
    const stops = buildJourneyStops(
      {
        photos: [photo(1, "2026-01-01T10:00:00Z", 41.0, 29.0), photo(2, "2026-01-02T10:00:00Z", 41.0005, 29.0005)],
        notes: [note(3, "2026-01-03T10:00:00Z", 39.9, 32.8)],
        meetings: [],
      },
      NOW
    );
    expect(stops.map((s) => s.key)).toEqual(["photo-1", "note-3"]);
  });

  it("çok durak varsa ilk ve sonu koruyarak en fazla MAX_JOURNEY_STOPS seçer", () => {
    const photos = Array.from({ length: 40 }, (_, i) =>
      photo(i, new Date(Date.parse("2025-01-01T00:00:00Z") + i * 86400000).toISOString(), 36 + i * 0.2, 28 + i * 0.2)
    );
    const stops = buildJourneyStops({ photos, notes: [], meetings: [] }, NOW);
    expect(stops).toHaveLength(MAX_JOURNEY_STOPS);
    expect(stops[0].key).toBe("photo-0");
    expect(stops[stops.length - 1].key).toBe("photo-39");
  });
});

describe("distanceMeters", () => {
  it("İstanbul–Ankara arasını yaklaşık doğru ölçer", () => {
    const km = distanceMeters({ latitude: 41.0082, longitude: 28.9784 }, { latitude: 39.9334, longitude: 32.8597 }) / 1000;
    expect(km).toBeGreaterThan(340);
    expect(km).toBeLessThan(360);
  });
});
