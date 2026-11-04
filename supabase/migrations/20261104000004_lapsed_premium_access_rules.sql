-- ============================================================================
-- Premium bitince içerik erişimi: geçmişi görmek ve silmek serbest, yeni iz ve Premium düzenleme kilitli
-- ============================================================================
-- 20261104000003_subscription_lifecycle.sql üzerine:
--   1. Fotoğraf arşivi: çift, Premium'u bitse de fotoğraflarını görür (tam boy dahil) ve kendi yüklediğini
--      siler. Yeni fotoğraf yüklemek Premium'da kalır (INSERT politikaları değişmedi).
--   2. Özel günler: Premium'suz düzenlenemez, yalnızca silinir. Yeni özel gün fotoğrafsız eklenebilir.
--      İstisnalar: ilişki tarihleri değişince uygulamanın varsayılan özel günlerin tarihini eşitlemesi ve
--      görseli kayıttan kaldırmak (silme hakkı).
--   3. Yıldız adı Premium'suz (kış uykusunda) değiştirilemez. İsimlerin görünürlüğü ayarı serbest kalır.
--   4. Profil fotoğrafı: Premium'suz uygulamada gösterilmez (istemci); kasa süresi dolunca dosya silinir ve
--      kayıttan kaldırılır.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Fotoğraf arşivi: okuma Premium'dan bağımsız
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "View own couple photos" ON public.photo_archive;
CREATE POLICY "View own couple photos" ON public.photo_archive
  FOR SELECT TO authenticated
  USING (couple_id = public.get_my_couple_id());

DROP POLICY IF EXISTS "photos_select_couple_premium" ON storage.objects;
DROP POLICY IF EXISTS "photos_select_couple" ON storage.objects;
CREATE POLICY "photos_select_couple" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = public.get_my_couple_id()::text
);


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Özel günler: Premium'suz düzenleme ve fotoğraflı ekleme kapalı
-- ────────────────────────────────────────────────────────────────────────────
-- Sistem işleri (auth.uid() yok: kasa tasfiyesi, hesap silme) etkilenmez.
CREATE OR REPLACE FUNCTION public.enforce_memory_premium_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_my_active_premium() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.image_path IS NOT NULL THEN
      RAISE EXCEPTION 'Özel güne fotoğraf eklemek için aktif Premium üyelik gereklidir.' USING ERRCODE = 'P0010';
    END IF;
    RETURN NEW;
  END IF;

  -- Görseli kaldırmak silme hakkıdır
  IF NEW.image_path IS NULL
     AND to_jsonb(NEW) - 'image_path' = to_jsonb(OLD) - 'image_path' THEN
    RETURN NEW;
  END IF;

  -- İlişki tarihleri değişince varsayılan özel günün tarihi eşitlenir
  IF OLD.is_default
     AND to_jsonb(NEW) - 'date' = to_jsonb(OLD) - 'date' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Özel günü düzenlemek için aktif Premium üyelik gereklidir.' USING ERRCODE = 'P0010';
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_memory_premium_edits() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_memory_premium_edits ON public.memories;
CREATE TRIGGER trg_enforce_memory_premium_edits
  BEFORE INSERT OR UPDATE ON public.memories
  FOR EACH ROW EXECUTE FUNCTION public.enforce_memory_premium_edits();


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Yıldız adı: kış uykusunda değiştirilemez (20261025000002 + Premium denetimi)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rename_my_star(p_new_name VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_couple_id  INTEGER;
  v_name       TEXT := BTRIM(COALESCE(p_new_name, ''));
  v_star       public.couple_stars%ROWTYPE;
  v_next_at    TIMESTAMPTZ;
BEGIN
  v_couple_id := public.get_my_couple_id();
  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Bir çifte bağlı değilsiniz.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_active_premium(v_couple_id) THEN
    RAISE EXCEPTION 'Yıldız ismini değiştirmek için aktif Premium üyelik gereklidir.' USING ERRCODE = 'P0010';
  END IF;

  IF char_length(v_name) < 2 OR char_length(v_name) > 40 THEN
    RAISE EXCEPTION 'Yıldız ismi 2 ile 40 karakter arasında olmalıdır.' USING ERRCODE = '22023';
  END IF;

  IF public.contains_blocked_word(v_name) THEN
    RAISE EXCEPTION 'Yıldız ismi topluluk kurallarına aykırı kelimeler içeremez.' USING ERRCODE = 'P0006';
  END IF;

  SELECT * INTO v_star FROM public.couple_stars WHERE couple_id = v_couple_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Çiftin henüz bir yıldızı yok.' USING ERRCODE = 'P0013';
  END IF;

  IF v_star.name_changed_at IS NOT NULL THEN
    v_next_at := v_star.name_changed_at + INTERVAL '30 days';
    IF now() < v_next_at THEN
      RAISE EXCEPTION 'İsim değiştirme hakkı henüz yenilenmedi.'
        USING ERRCODE = 'P0012', HINT = to_char(v_next_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    END IF;
  END IF;

  IF v_name = v_star.custom_name THEN
    RAISE EXCEPTION 'Yeni isim mevcut isimle aynı; hakkınız korunuyor.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.star_rename', 'on', true);
  UPDATE public.couple_stars
     SET custom_name = v_name,
         name_changed_at = now()
   WHERE id = v_star.id;

  RETURN public.get_my_couple_star_details(v_couple_id);
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Profil fotoğrafı: kasa süresi dolunca silinir
-- ────────────────────────────────────────────────────────────────────────────
-- Avatarlar `avatars/<user_id>/...` altında durur (çift klasörü değil): kuyruk bu biçimi de kabul eder.
ALTER TABLE public.storage_purge_queue DROP CONSTRAINT IF EXISTS storage_purge_queue_bucket_id_check;
ALTER TABLE public.storage_purge_queue DROP CONSTRAINT IF EXISTS storage_purge_queue_object_name_check;
ALTER TABLE public.storage_purge_queue DROP CONSTRAINT IF EXISTS storage_purge_queue_object_check;
ALTER TABLE public.storage_purge_queue
  ADD CONSTRAINT storage_purge_queue_object_check CHECK (
    object_name !~ '(^|/)\.\.(/|$)'
    AND CASE bucket_id
      WHEN 'avatars' THEN object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
      WHEN 'photos' THEN object_name ~ '^[0-9]{1,9}/[^/]'
      WHEN 'memories' THEN object_name ~ '^[0-9]{1,9}/[^/]'
      WHEN 'couple-memories' THEN object_name ~ '^[0-9]{1,9}/[^/]'
      ELSE FALSE
    END
  );

CREATE OR REPLACE FUNCTION public.storage_object_in_use(p_bucket TEXT, p_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_couple_id INTEGER;
BEGIN
  IF p_name IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Kullanıcı yeni avatar yüklediyse aynı yol yeniden kullanılıyor demektir
  IF p_bucket = 'avatars' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.users AS u
       WHERE u.id::text = split_part(p_name, '/', 1)
         AND u.avatar_url IS NOT NULL
         AND position('/avatars/' || p_name IN u.avatar_url) > 0);
  END IF;

  IF split_part(p_name, '/', 1) !~ '^[0-9]{1,9}$' THEN
    RETURN TRUE;
  END IF;
  v_couple_id := split_part(p_name, '/', 1)::integer;

  RETURN CASE p_bucket
    WHEN 'photos' THEN EXISTS (
      SELECT 1 FROM public.photo_archive AS p
       WHERE p.couple_id = v_couple_id AND (p.storage_path = p_name OR p.thumb_path = p_name))
    WHEN 'memories' THEN EXISTS (
      SELECT 1 FROM public.memories AS m
       WHERE m.couple_id = v_couple_id AND m.image_path = p_name)
    -- Eski gezegen kayıtları yolu tam adres olarak tutabilir
    WHEN 'couple-memories' THEN EXISTS (
      SELECT 1 FROM public.star_exoplanets AS ep, unnest(ep.media_urls) AS media(ref)
       WHERE ep.couple_id = v_couple_id
         AND (media.ref = p_name OR position('/couple-memories/' || p_name IN media.ref) > 0))
    ELSE TRUE
  END;
END;
$$;

-- 20261104000003'teki tanım + 4. bölüm (profil fotoğrafları)
CREATE OR REPLACE FUNCTION public.purge_vaulted_media(p_couple_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prefix          TEXT := p_couple_id::text || '/';
  v_queued          INTEGER := 0;
  v_photos_reduced  INTEGER;
  v_photos_deleted  INTEGER;
  v_memory_images   INTEGER;
  v_planet_media    INTEGER;
  v_avatars         INTEGER;
BEGIN
  v_queued := v_queued + public.enqueue_storage_purge(
    'photos',
    ARRAY(
      SELECT o.name FROM storage.objects AS o
       WHERE o.bucket_id = 'photos' AND o.name LIKE v_prefix || '%'
      EXCEPT
      SELECT p.thumb_path FROM public.photo_archive AS p
       WHERE p.couple_id = p_couple_id AND p.thumb_path IS NOT NULL
    ),
    p_couple_id, 'vault_expired');

  v_queued := v_queued + public.enqueue_storage_purge(
    'memories',
    ARRAY(SELECT o.name FROM storage.objects AS o
           WHERE o.bucket_id = 'memories' AND o.name LIKE v_prefix || '%'),
    p_couple_id, 'vault_expired');

  v_queued := v_queued + public.enqueue_storage_purge(
    'couple-memories',
    ARRAY(SELECT o.name FROM storage.objects AS o
           WHERE o.bucket_id = 'couple-memories' AND o.name LIKE v_prefix || 'exoplanets/%'),
    p_couple_id, 'vault_expired');

  -- Profil fotoğrafları: önce kayıt (yol artık kullanılmıyor), sonra dosyalar kuyruğa
  UPDATE public.users AS u SET avatar_url = NULL
   WHERE u.couple_id = p_couple_id AND u.avatar_url IS NOT NULL;
  GET DIAGNOSTICS v_avatars = ROW_COUNT;

  INSERT INTO public.storage_purge_queue (bucket_id, object_name, couple_id, reason)
  SELECT 'avatars', o.name, p_couple_id, 'vault_expired'
    FROM storage.objects AS o
    JOIN public.users AS u ON o.name LIKE u.id::text || '/%'
   WHERE o.bucket_id = 'avatars' AND u.couple_id = p_couple_id
  ON CONFLICT ON CONSTRAINT storage_purge_queue_object_key DO NOTHING;

  -- Kayıtlar (tetikleyiciler kayıtlı yolları ayrıca kuyruğa ekler; tekrarlar yok sayılır)
  UPDATE public.photo_archive AS p
     SET storage_path = p.thumb_path
   WHERE p.couple_id = p_couple_id
     AND p.thumb_path IS NOT NULL
     AND p.storage_path IS DISTINCT FROM p.thumb_path;
  GET DIAGNOSTICS v_photos_reduced = ROW_COUNT;

  DELETE FROM public.photo_archive AS p
   WHERE p.couple_id = p_couple_id AND p.thumb_path IS NULL;
  GET DIAGNOSTICS v_photos_deleted = ROW_COUNT;

  UPDATE public.memories AS m
     SET image_path = NULL
   WHERE m.couple_id = p_couple_id AND m.image_path IS NOT NULL;
  GET DIAGNOSTICS v_memory_images = ROW_COUNT;

  UPDATE public.star_exoplanets AS ep
     SET media_urls = ARRAY[]::TEXT[]
   WHERE ep.couple_id = p_couple_id AND cardinality(ep.media_urls) > 0;
  GET DIAGNOSTICS v_planet_media = ROW_COUNT;

  INSERT INTO public.subscription_lifecycle_events (couple_id, event, details)
  VALUES (p_couple_id, 'media_purged', jsonb_build_object(
    'queued_objects', v_queued,
    'photos_reduced_to_preview', v_photos_reduced,
    'photos_deleted', v_photos_deleted,
    'memory_images_removed', v_memory_images,
    'planets_media_removed', v_planet_media,
    'avatars_removed', v_avatars
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.storage_object_in_use(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_vaulted_media(INTEGER)      FROM PUBLIC, anon, authenticated;

COMMIT;
