-- ============================================================
-- 019: photo_archive tablosuna thumb_url kolonu ekleme
-- ============================================================
-- Thumbnail Pipeline mimarisi için:
-- thumb_url: 300x300 WebP küçük resim (galeriye hızlı yükleme için ~15-25 KB)
-- image_url: 1600px tam boy görsel (tam ekran görüntüleme için)
-- ============================================================

ALTER TABLE public.photo_archive
  ADD COLUMN IF NOT EXISTS thumb_url TEXT;

-- İndeks: Yeni fotoğraflarda thumb_url sorgularını hızlandırır
CREATE INDEX IF NOT EXISTS idx_photo_archive_couple_date_thumb
  ON public.photo_archive(couple_id, taken_date DESC, thumb_url);
