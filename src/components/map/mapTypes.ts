export interface PhotoPin {
  id: number;
  image_url: string;
  thumb_url?: string | null;
  latitude: number;
  longitude: number;
  location_name?: string | null;
  taken_date: string;
  title?: string | null;
  description?: string | null;
  user_id: string;
}

export interface MapNote {
  id: number;
  user_id: string;
  latitude: number;
  longitude: number;
  note: string;
  created_at: string;
}

export interface MeetingPin {
  id: number;
  title: string;
  location_name?: string | null;
  latitude: number;
  longitude: number;
  meeting_datetime: string;
  is_active: boolean;
  user_id: string;
}

export interface MapCoordinate {
  latitude: number;
  longitude: number;
}

export type MapThemeType = "romantic" | "midnight" | "silver";
export type FilterType = "all" | "photos" | "notes" | "meetings";

export type SelectedItem =
  | { type: "photo"; data: PhotoPin }
  | { type: "note"; data: MapNote }
  | { type: "meeting"; data: MeetingPin }
  | null;

/** Haritadaki tüm pinlerin `MapStoryModal` için sadeleştirilmiş hali. */
export interface MapStoryPin {
  id: number;
  latitude: number;
  longitude: number;
  location_name: string | null;
  date: string;
  type: "photo" | "note" | "meeting";
}
