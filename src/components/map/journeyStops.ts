import type { MapNote, MeetingPin, PhotoPin } from "./mapTypes";

// ─── "Aşk Rotamız": haritadaki anıların tarih sırasıyla gezilen durakları ──────

/** Tur çok uzamasın: daha fazla anı varsa ilk ve son korunarak eşit aralıklarla seçilir. */
export const MAX_JOURNEY_STOPS = 12;
/** Bu mesafeden yakın ardışık anılar tek durak sayılır (rota sıfır uzunlukta parçalarla dolmasın). */
const SAME_PLACE_METERS = 150;

export type JourneyStop =
  | { key: string; type: "photo"; latitude: number; longitude: number; time: number; photo: PhotoPin }
  | { key: string; type: "note"; latitude: number; longitude: number; time: number; note: MapNote }
  | { key: string; type: "meeting"; latitude: number; longitude: number; time: number; meeting: MeetingPin };

/** İki koordinat arası yaklaşık mesafe (m), haversine. */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Pinleri eskiden yeniye dizer. Henüz gelmemiş buluşmalar rotaya girmez (rota yaşanmış anıların yoludur);
 * tarihi okunamayan kayıtlar atlanır.
 */
export function buildJourneyStops(
  { photos, notes, meetings }: { photos: PhotoPin[]; notes: MapNote[]; meetings: MeetingPin[] },
  now: number = Date.now()
): JourneyStop[] {
  const all: JourneyStop[] = [
    ...photos.map((photo) => ({
      key: `photo-${photo.id}`,
      type: "photo" as const,
      latitude: photo.latitude,
      longitude: photo.longitude,
      time: Date.parse(photo.taken_date),
      photo,
    })),
    ...notes.map((note) => ({
      key: `note-${note.id}`,
      type: "note" as const,
      latitude: note.latitude,
      longitude: note.longitude,
      time: Date.parse(note.created_at),
      note,
    })),
    ...meetings.map((meeting) => ({
      key: `meeting-${meeting.id}`,
      type: "meeting" as const,
      latitude: meeting.latitude,
      longitude: meeting.longitude,
      time: Date.parse(meeting.meeting_datetime),
      meeting,
    })),
  ].filter((stop) => Number.isFinite(stop.time) && stop.time <= now);

  all.sort((a, b) => a.time - b.time);

  const merged: JourneyStop[] = [];
  for (const stop of all) {
    const previous = merged[merged.length - 1];
    if (!previous || distanceMeters(previous, stop) >= SAME_PLACE_METERS) merged.push(stop);
  }

  if (merged.length <= MAX_JOURNEY_STOPS) return merged;
  const picked = new Set<number>();
  for (let i = 0; i < MAX_JOURNEY_STOPS; i++) {
    picked.add(Math.round((i * (merged.length - 1)) / (MAX_JOURNEY_STOPS - 1)));
  }
  return merged.filter((_, index) => picked.has(index));
}
