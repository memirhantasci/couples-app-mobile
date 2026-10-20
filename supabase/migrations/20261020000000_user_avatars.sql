-- ============================================================
-- Profil fotoğrafı (PP) — Premium'a özel avatar sistemi
-- ------------------------------------------------------------
-- * users.avatar_url: public 'avatars' bucket'ındaki kendi dosyasının URL'si (?v= cache-bust)
-- * Avatar SET etmek yalnızca aktif Premium çiftlerde mümkün; kaldırmak (NULL) her zaman serbest
-- * Storage: her kullanıcı yalnızca kendi `${auth.uid()}/avatar.jpg` dosyasına yazabilir
-- ============================================================

BEGIN;

-- 1. Sütun
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. DB katmanı koruması: Premium'suz avatar atanamaz, başka birinin / harici bir URL atanamaz
CREATE OR REPLACE FUNCTION public.check_user_avatar_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.avatar_url IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.avatar_url IS NOT DISTINCT FROM OLD.avatar_url THEN
    RETURN NEW;
  END IF;

  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Başka bir kullanıcının profil fotoğrafı değiştirilemez.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_active_premium(NEW.couple_id) THEN
    RAISE EXCEPTION 'Profil fotoğrafı yüklemek için aktif Premium üyelik gereklidir.' USING ERRCODE = 'P0010';
  END IF;

  IF length(NEW.avatar_url) > 512
     OR NEW.avatar_url NOT LIKE 'https://%'
     OR position(('/storage/v1/object/public/avatars/' || NEW.id::text || '/avatar.jpg') IN NEW.avatar_url) = 0 THEN
    RAISE EXCEPTION 'Geçersiz profil fotoğrafı adresi.' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_user_avatar_integrity() FROM PUBLIC, authenticated, anon;

DROP TRIGGER IF EXISTS trg_check_user_avatar ON public.users;
CREATE TRIGGER trg_check_user_avatar
  BEFORE INSERT OR UPDATE OF avatar_url ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.check_user_avatar_integrity();

-- 3. Bucket (public okuma; 1 MB, yalnızca JPEG/WebP)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 1048576, ARRAY['image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4. Storage RLS — yalnızca kendi klasörü; yazma Premium şartlı, silme her zaman serbest
DROP POLICY IF EXISTS "avatars_select_own" ON storage.objects;
CREATE POLICY "avatars_select_own" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_insert_own_premium" ON storage.objects;
CREATE POLICY "avatars_insert_own_premium" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND name = auth.uid()::text || '/avatar.jpg'
  AND public.has_my_active_premium()
);

DROP POLICY IF EXISTS "avatars_update_own_premium" ON storage.objects;
CREATE POLICY "avatars_update_own_premium" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND name = auth.uid()::text || '/avatar.jpg'
)
WITH CHECK (
  bucket_id = 'avatars'
  AND name = auth.uid()::text || '/avatar.jpg'
  AND public.has_my_active_premium()
);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

COMMIT;
