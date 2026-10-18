export interface PhotoItem {
  id: number;
  image_url: string;
  thumb_url?: string | null;
  taken_date: string;
  taken_time?: string | null;
  title?: string | null;
  description?: string | null;
  user_id: string;
  created_at?: string;
  storage_path?: string | null;
}

export type ViewMode = "grid3" | "grid2" | "single";
