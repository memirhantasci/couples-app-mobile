-- ============================================================
-- 005: Storage Security (File Size & Mime Types)
-- ============================================================

DO $$ 
BEGIN

    -- 1. Memories Bucket
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'memories') THEN
        UPDATE storage.buckets
        SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'],
            file_size_limit = 5242880 -- 5 MB limit
        WHERE id = 'memories';
    END IF;

    -- 2. Photos Bucket
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'photos') THEN
        UPDATE storage.buckets
        SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'],
            file_size_limit = 5242880 -- 5 MB limit
        WHERE id = 'photos';
    END IF;

END $$;
