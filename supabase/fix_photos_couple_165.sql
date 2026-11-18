-- ==============================================================================
-- FIX COUPLE 165 PHOTOS & MEMORIES (Replace Broken Storage Paths with Direct URLs)
-- ==============================================================================

BEGIN;

-- 1. photo_archive ve memories tablolarındaki klasör kısıtlamasını esnet (URL'lere izin ver)
ALTER TABLE public.photo_archive DROP CONSTRAINT IF EXISTS photo_archive_paths_in_couple_folder;
ALTER TABLE public.photo_archive
  ADD CONSTRAINT photo_archive_paths_in_couple_folder
  CHECK (
    (split_part(storage_path, '/', 1) = couple_id::text OR storage_path ~* '^https?://')
    AND (thumb_path IS NULL OR split_part(thumb_path, '/', 1) = couple_id::text OR thumb_path ~* '^https?://')
  );

ALTER TABLE public.memories DROP CONSTRAINT IF EXISTS memories_image_in_couple_folder;
ALTER TABLE public.memories
  ADD CONSTRAINT memories_image_in_couple_folder
  CHECK (image_path IS NULL OR split_part(image_path, '/', 1) = couple_id::text OR image_path ~* '^https?://');

-- 2. photo_archive tablosundaki simsiyah olan yolları çalışan Unsplash fotoğraflarıyla güncelle
WITH numbered_photos AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY taken_date DESC, created_at DESC, id ASC) as rn
  FROM public.photo_archive
  WHERE couple_id = 165
)
UPDATE public.photo_archive p
SET 
  storage_path = CASE np.rn
    WHEN 1 THEN 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=1080&auto=format&fit=crop&q=80'
    WHEN 2 THEN 'https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=1080&auto=format&fit=crop&q=80'
    WHEN 3 THEN 'https://images.unsplash.com/photo-1527838832700-5059252407fa?w=1080&auto=format&fit=crop&q=80'
    WHEN 4 THEN 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1080&auto=format&fit=crop&q=80'
    WHEN 5 THEN 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1080&auto=format&fit=crop&q=80'
    WHEN 6 THEN 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=1080&auto=format&fit=crop&q=80'
    WHEN 7 THEN 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=1080&auto=format&fit=crop&q=80'
    WHEN 8 THEN 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=1080&auto=format&fit=crop&q=80'
    WHEN 9 THEN 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=1080&auto=format&fit=crop&q=80'
    WHEN 10 THEN 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080&auto=format&fit=crop&q=80'
    ELSE 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=1080&auto=format&fit=crop&q=80'
  END,
  thumb_path = CASE np.rn
    WHEN 1 THEN 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=400&auto=format&fit=crop&q=70'
    WHEN 2 THEN 'https://images.unsplash.com/photo-1474552226712-ac0f0961a954?w=400&auto=format&fit=crop&q=70'
    WHEN 3 THEN 'https://images.unsplash.com/photo-1527838832700-5059252407fa?w=400&auto=format&fit=crop&q=70'
    WHEN 4 THEN 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&auto=format&fit=crop&q=70'
    WHEN 5 THEN 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&auto=format&fit=crop&q=70'
    WHEN 6 THEN 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=400&auto=format&fit=crop&q=70'
    WHEN 7 THEN 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=400&auto=format&fit=crop&q=70'
    WHEN 8 THEN 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400&auto=format&fit=crop&q=70'
    WHEN 9 THEN 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=400&auto=format&fit=crop&q=70'
    WHEN 10 THEN 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&auto=format&fit=crop&q=70'
    ELSE 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=400&auto=format&fit=crop&q=70'
  END
FROM numbered_photos np
WHERE p.id = np.id;

-- 3. memories tablosundaki anı fotoğraflarını güncelle
WITH numbered_memories AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY date DESC, id ASC) as rn
  FROM public.memories
  WHERE couple_id = 165
)
UPDATE public.memories m
SET image_path = CASE nm.rn
  WHEN 1 THEN 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80'
  WHEN 2 THEN 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80'
  WHEN 3 THEN 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&auto=format&fit=crop&q=80'
  WHEN 4 THEN 'https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?w=800&auto=format&fit=crop&q=80'
  ELSE 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&auto=format&fit=crop&q=80'
END
FROM numbered_memories nm
WHERE m.id = nm.id;

COMMIT;

