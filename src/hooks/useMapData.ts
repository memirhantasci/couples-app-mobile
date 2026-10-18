import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";

import type {
  MapNote,
  MapStoryPin,
  MeetingPin,
  PhotoPin,
} from "@/components/map/mapTypes";
import {
  DEMO_MAP_LOCATIONS,
  DEMO_MEETINGS,
  DEMO_PHOTOS,
} from "@/constants/demoData";
import { dayjs } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import { isValidCoordinate } from "@/utils/exifHelper";

// Veri gelmeden önce her render'da yeni dizi üretmemek için sabit boş listeler.
const NO_PHOTOS: PhotoPin[] = [];
const NO_NOTES: MapNote[] = [];
const NO_MEETINGS: MeetingPin[] = [];

interface UseMapDataArgs {
  coupleId: number | null;
  isPremium: boolean;
  isDemoMode: boolean;
}

/**
 * Harita ekranının üç veri kaynağı: fotoğraf pinleri (yalnızca Premium), aşk notları ve buluşmalar.
 * Ekran her odaklandığında üçünü de yeniler.
 */
export function useMapData({ coupleId, isPremium, isDemoMode }: UseMapDataArgs) {
  // ─── 1. Fotoğraf Pinleri (description dahil) ──────────────────────────────
  const photosQuery = useQuery<PhotoPin[]>({
    queryKey: ["map_photos", coupleId, isDemoMode],
    enabled: (!!coupleId && isPremium) || isDemoMode,
    staleTime: 1000 * 30,
    queryFn: async () => {
      if (isDemoMode) {
        return DEMO_PHOTOS.map((p) => ({
          id: p.id,
          image_url: p.image_url,
          latitude: p.latitude!,
          longitude: p.longitude!,
          location_name: p.city || "Özel Konum",
          taken_date: p.taken_date,
          title: p.title,
          description: p.description,
          user_id: p.user_id,
        })).filter((p) => isValidCoordinate(p.latitude, p.longitude));
      }
      const { data, error } = await supabase
        .from("photo_archive")
        .select(
          "id, image_url, thumb_url, latitude, longitude, location_name, taken_date, title, description, user_id",
        )
        .eq("couple_id", coupleId)
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) throw error;
      return ((data ?? []) as PhotoPin[]).filter((p) =>
        isValidCoordinate(p.latitude, p.longitude),
      );
    },
  });

  // ─── 2. Harita Notları ────────────────────────────────────────────────────
  const notesQuery = useQuery<MapNote[]>({
    queryKey: ["map_notes", coupleId, isDemoMode],
    enabled: !!coupleId || isDemoMode,
    staleTime: 1000 * 30,
    queryFn: async () => {
      if (isDemoMode) {
        return DEMO_MAP_LOCATIONS.map((loc) => ({
          id: loc.id,
          user_id: "demo",
          latitude: loc.latitude,
          longitude: loc.longitude,
          note: `${loc.title} - ${loc.description}`,
          created_at: loc.date,
        })).filter((n) => isValidCoordinate(n.latitude, n.longitude));
      }
      const { data, error } = await supabase
        .from("map_notes")
        .select("id, user_id, latitude, longitude, note, created_at")
        .eq("couple_id", coupleId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as MapNote[]).filter((n) =>
        isValidCoordinate(n.latitude, n.longitude),
      );
    },
  });

  // ─── 3. Buluşma Noktaları ─────────────────────────────────────────────────
  const meetingsQuery = useQuery<MeetingPin[]>({
    queryKey: ["map_meetings", coupleId, isDemoMode],
    enabled: !!coupleId || isDemoMode,
    staleTime: 1000 * 30,
    queryFn: async () => {
      if (isDemoMode) {
        return DEMO_MEETINGS.map((m) => ({
          id: m.id,
          title: m.title,
          location_name: m.location_name,
          latitude: m.latitude,
          longitude: m.longitude,
          meeting_datetime: m.meeting_datetime,
          is_active: m.is_active,
          user_id: "demo",
        })).filter((m) => isValidCoordinate(m.latitude, m.longitude));
      }
      const { data, error } = await supabase
        .from("meetings")
        .select(
          "id, title, location_name, latitude, longitude, meeting_datetime, is_active, user_id",
        )
        .eq("couple_id", coupleId)
        .eq("is_active", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) throw error;
      return ((data ?? []) as MeetingPin[]).filter((m) =>
        isValidCoordinate(m.latitude, m.longitude),
      );
    },
  });

  const photoPins = photosQuery.data ?? NO_PHOTOS;
  const mapNotes = notesQuery.data ?? NO_NOTES;
  const meetingPins = meetingsQuery.data ?? NO_MEETINGS;

  const { refetch: refetchPhotos } = photosQuery;
  const { refetch: refetchNotes } = notesQuery;
  const { refetch: refetchMeetings } = meetingsQuery;

  // Sayfaya her gelindiğinde güncel verileri otomatik yenile
  useFocusEffect(
    useCallback(() => {
      refetchPhotos();
      refetchNotes();
      refetchMeetings();
    }, [refetchPhotos, refetchNotes, refetchMeetings]),
  );

  // MapStoryModal için: tüm pinler, en yeni en başta (modal ilk/son durağı buna göre seçer).
  // Notların "konum adı" yoktur; şehir sayısını şişirmesin diye null bırakılır.
  const storyPins = useMemo<MapStoryPin[]>(() => {
    const items: MapStoryPin[] = [
      ...photoPins.map((p) => ({
        id: p.id,
        latitude: p.latitude,
        longitude: p.longitude,
        location_name: p.location_name ?? null,
        date: p.taken_date,
        type: "photo" as const,
      })),
      ...mapNotes.map((n) => ({
        id: n.id,
        latitude: n.latitude,
        longitude: n.longitude,
        location_name: null,
        date: n.created_at,
        type: "note" as const,
      })),
      ...meetingPins.map((m) => ({
        id: m.id,
        latitude: m.latitude,
        longitude: m.longitude,
        location_name: m.location_name || m.title,
        date: m.meeting_datetime,
        type: "meeting" as const,
      })),
    ];
    return items.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
  }, [photoPins, mapNotes, meetingPins]);

  return {
    photoPins,
    mapNotes,
    meetingPins,
    storyPins,
    isLoading: photosQuery.isLoading || notesQuery.isLoading || meetingsQuery.isLoading,
  };
}
