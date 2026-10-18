/** A photo as shown in the calendar's selected-day list and lightbox. */
export interface CalendarPhotoItem {
  id: number;
  user_id: string;
  image_url: string;
  title?: string | null;
  description?: string | null;
  taken_date: string;
  taken_time?: string | null;
}
