-- ============================================================
-- 014: Map Features — Photo Locations & Map Notes
-- ============================================================

-- 1. photo_archive tablosuna konum sütunları ekle
ALTER TABLE public.photo_archive
  ADD COLUMN IF NOT EXISTS latitude  NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS location_name TEXT;

-- 2. map_notes tablosunu oluştur
CREATE TABLE IF NOT EXISTS public.map_notes (
  id          BIGSERIAL PRIMARY KEY,
  couple_id   INTEGER NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  latitude    NUMERIC NOT NULL,
  longitude   NUMERIC NOT NULL,
  note        TEXT    NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. RLS aç
ALTER TABLE public.map_notes ENABLE ROW LEVEL SECURITY;

-- 4. RLS Politikaları: Okuma — aynı çiftteki herkes görebilir
CREATE POLICY "map_notes_select_couple"
  ON public.map_notes FOR SELECT
  USING (couple_id = get_my_couple_id());

-- 5. RLS Politikaları: Ekleme — sadece kendi kullanıcısı
CREATE POLICY "map_notes_insert_own"
  ON public.map_notes FOR INSERT
  WITH CHECK (
    user_id   = auth.uid()
    AND couple_id = get_my_couple_id()
  );

-- 6. RLS Politikaları: Silme — sadece notu ekleyen kişi
CREATE POLICY "map_notes_delete_own"
  ON public.map_notes FOR DELETE
  USING (user_id = auth.uid());

-- 7. Performans indeksi
CREATE INDEX IF NOT EXISTS idx_map_notes_couple ON public.map_notes(couple_id);
CREATE INDEX IF NOT EXISTS idx_photo_archive_location ON public.photo_archive(couple_id) WHERE latitude IS NOT NULL;
