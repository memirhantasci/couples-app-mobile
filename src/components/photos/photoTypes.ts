export interface PhotoItem {
  id: number;
  /** "photos" bucket'ındaki tam boy görselin yolu (`<couple_id>/...`); demo verisinde tam URL. */
  storage_path: string;
  /** Galeri ızgarası için küçük resmin yolu; yoksa tam boy görsel kullanılır. */
  thumb_path?: string | null;
  taken_date: string;
  taken_time?: string | null;
  title?: string | null;
  description?: string | null;
  user_id: string;
  created_at?: string;
}

export type ViewMode = "grid3" | "grid2" | "single";
