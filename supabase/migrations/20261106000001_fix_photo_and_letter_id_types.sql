-- ============================================================================
-- 20261106000001: Kimlik tipi uyuşmazlıklarının düzeltilmesi
-- ============================================================================
-- • delete_archived_photo(p_photo_id BIGINT): photo_archive.id UUID'dir. İstemci fotoğrafın uuid
--   kimliğini gönderdiği için çağrı her seferinde "invalid input syntax for type bigint" ile
--   düşüyordu; Fotoğraflar ve Harita ekranlarında fotoğraf silinemiyordu. Parametre UUID olur.
-- • append_letter_to_exoplanet(p_planet_id UUID, p_letter_id UUID): letters.id INTEGER'dır;
--   "integer = uuid" karşılaştırması fonksiyonu her çağrıda düşürüyordu. Parametre INTEGER olur,
--   linked_letter_ids dizisindeki biçim (metin) değişmez.
-- Gövdeler 20261104000003 ve 20260914 sürümleriyle aynıdır; yalnızca parametre tipleri değişir.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.delete_archived_photo(BIGINT);

CREATE OR REPLACE FUNCTION public.delete_archived_photo(p_photo_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_couple_id INTEGER;
BEGIN
  v_couple_id := public.get_my_couple_id();
  IF v_uid IS NULL OR v_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erişim.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.photo_archive AS p
   WHERE p.id = p_photo_id
     AND p.couple_id = v_couple_id
     AND p.user_id = v_uid;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_archived_photo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_archived_photo(UUID) TO authenticated, service_role;


DROP FUNCTION IF EXISTS public.append_letter_to_exoplanet(UUID, UUID);

CREATE OR REPLACE FUNCTION public.append_letter_to_exoplanet(p_planet_id UUID, p_letter_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_couple_id integer;
  v_record public.star_exoplanets%ROWTYPE;
BEGIN
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erişim.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_active_premium(v_caller_couple_id) THEN
    RAISE EXCEPTION 'Mektup bağlamak için aktif Premium üyelik gereklidir.' USING ERRCODE = 'P0010';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.letters AS l
    WHERE l.id = p_letter_id AND l.couple_id = v_caller_couple_id
  ) THEN
    RAISE EXCEPTION 'Mektup bulunamadı veya bu çifte ait değil.' USING ERRCODE = '42501';
  END IF;
  SELECT ep.* INTO v_record
  FROM public.star_exoplanets AS ep
  JOIN public.couple_stars AS cs ON cs.id = ep.star_id
  WHERE ep.id = p_planet_id AND cs.couple_id = v_caller_couple_id
  FOR UPDATE OF ep;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gezegen bulunamadı veya yetkiniz yok.' USING ERRCODE = '42501';
  END IF;
  IF NOT (COALESCE(v_record.custom_metadata -> 'linked_letter_ids', '[]'::jsonb) ? p_letter_id::text) THEN
    UPDATE public.star_exoplanets
    SET custom_metadata = jsonb_set(
          COALESCE(custom_metadata, '{}'::jsonb),
          '{linked_letter_ids}',
          COALESCE(custom_metadata -> 'linked_letter_ids', '[]'::jsonb) || to_jsonb(p_letter_id::text),
          true
        ),
        updated_at = statement_timestamp()
    WHERE id = p_planet_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.append_letter_to_exoplanet(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.append_letter_to_exoplanet(UUID, INTEGER) TO authenticated, service_role;

COMMIT;
