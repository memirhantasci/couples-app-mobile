-- Migration: 20261022000001_restrict_photo_delete_to_owner.sql
-- Description: Sadece fotoğrafı yükleyen kullanıcının (user_id = auth.uid()) silme yapabilmesi sağlanır.
-- Çift ortağı dahi olsa partnerin yüklediği fotoğrafı silemez.

ALTER TABLE public.photo_archive ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Delete own couple photos" ON public.photo_archive;
DROP POLICY IF EXISTS "Delete own uploaded photos" ON public.photo_archive;

CREATE POLICY "Delete own uploaded photos" ON public.photo_archive
  FOR DELETE TO authenticated
  USING (
    couple_id = public.get_my_couple_id()
    AND user_id = auth.uid()
  );
