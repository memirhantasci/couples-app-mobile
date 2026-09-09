-- Premium entitlement, protected exoplanet RPCs, and 45-day automation.
-- `premium_expires_at IS NULL` represents a non-expiring entitlement.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_couple_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.couple_id
  FROM public.users AS u
  WHERE u.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_active_premium(p_couple_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.couples AS c
    WHERE c.id = p_couple_id
      AND c.is_premium = true
      AND (
        c.premium_expires_at IS NULL
        OR c.premium_expires_at > statement_timestamp()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.has_my_active_premium()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.has_active_premium(public.get_my_couple_id());
$$;

REVOKE ALL ON FUNCTION public.get_my_couple_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_active_premium(integer) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.has_my_active_premium() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_couple_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_my_active_premium() TO authenticated;

-- A table-level guard makes every claim path (current and future) enforce the
-- same entitlement rule. The three claim RPCs below keep their own ownership
-- checks and are restricted to authenticated callers.
CREATE OR REPLACE FUNCTION public.enforce_premium_star_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_active_premium(NEW.couple_id) THEN
    RAISE EXCEPTION 'Yıldız sahiplenmek için aktif Premium üyelik gereklidir.'
      USING ERRCODE = 'P0010';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_premium_star_claim ON public.couple_stars;
CREATE TRIGGER trg_enforce_premium_star_claim
  BEFORE INSERT ON public.couple_stars
  FOR EACH ROW EXECUTE FUNCTION public.enforce_premium_star_claim();

ALTER FUNCTION public.claim_random_available_star(integer, varchar, numeric) SET search_path TO '';
ALTER FUNCTION public.claim_specific_star(integer, bigint, varchar) SET search_path TO '';
ALTER FUNCTION public.claim_star_in_sector(integer, varchar, varchar) SET search_path TO '';
REVOKE ALL ON FUNCTION public.claim_random_available_star(integer, varchar, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_specific_star(integer, bigint, varchar) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_star_in_sector(integer, varchar, varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_random_available_star(integer, varchar, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_specific_star(integer, bigint, varchar) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_star_in_sector(integer, varchar, varchar) TO authenticated;

-- The original schema declares this column NOT NULL. The product contract now
-- explicitly allows a cleared milestone date in a patch, so make that state
-- representable instead of accepting JSON null and failing at UPDATE time.
ALTER TABLE public.star_exoplanets
  ALTER COLUMN milestone_date DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.get_star_system_map(p_star_id uuid)
RETURNS TABLE (
  id uuid,
  orbit_distance integer,
  orbit_speed numeric,
  planet_type varchar,
  palette text[],
  is_locked boolean,
  display_title text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_couple_id integer;
  v_star_couple_id integer;
  v_is_premium boolean;
BEGIN
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erişim.' USING ERRCODE = '42501';
  END IF;

  SELECT cs.couple_id INTO v_star_couple_id
  FROM public.couple_stars AS cs
  WHERE cs.id = p_star_id;

  IF v_star_couple_id IS NULL OR v_star_couple_id <> v_caller_couple_id THEN
    RAISE EXCEPTION 'Bu yıldız size ait değil.' USING ERRCODE = '42501';
  END IF;

  v_is_premium := public.has_active_premium(v_caller_couple_id);

  RETURN QUERY
  SELECT
    ep.id,
    ep.orbit_distance,
    ep.orbit_speed,
    ep.planet_type,
    ep.palette,
    NOT v_is_premium,
    CASE
      WHEN v_is_premium THEN ep.title::text
      ELSE 'Kilitli anı gezegeni'::text
    END
  FROM public.star_exoplanets AS ep
  WHERE ep.star_id = p_star_id
  ORDER BY ep.milestone_date DESC NULLS LAST, ep.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_exoplanet_details(p_exoplanet_id uuid)
RETURNS public.star_exoplanets
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
    RAISE EXCEPTION 'Gezegen içeriğini görüntülemek için aktif Premium üyelik gereklidir.'
      USING ERRCODE = 'P0010';
  END IF;

  SELECT ep.* INTO v_record
  FROM public.star_exoplanets AS ep
  JOIN public.couple_stars AS cs ON cs.id = ep.star_id
  WHERE ep.id = p_exoplanet_id
    AND cs.couple_id = v_caller_couple_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gezegen bulunamadı veya yetkiniz yok.' USING ERRCODE = '42501';
  END IF;
  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_exoplanet(
  p_star_id uuid,
  p_title text,
  p_description text,
  p_milestone_date date,
  p_orbit_distance integer,
  p_orbit_speed numeric,
  p_planet_type text,
  p_palette text[]
)
RETURNS public.star_exoplanets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_couple_id integer;
  v_star_couple_id integer;
  v_manual_count integer;
  v_record public.star_exoplanets%ROWTYPE;
  v_title text;
  v_description text;
BEGIN
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erişim.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_active_premium(v_caller_couple_id) THEN
    RAISE EXCEPTION 'Gezegen oluşturmak için aktif Premium üyelik gereklidir.'
      USING ERRCODE = 'P0010';
  END IF;

  SELECT cs.couple_id INTO v_star_couple_id
  FROM public.couple_stars AS cs
  WHERE cs.id = p_star_id
  FOR UPDATE;
  IF v_star_couple_id IS NULL OR v_star_couple_id <> v_caller_couple_id THEN
    RAISE EXCEPTION 'Bu yıldız size ait değil.' USING ERRCODE = '42501';
  END IF;

  v_title := trim(p_title);
  v_description := NULLIF(trim(p_description), '');
  IF v_title IS NULL OR length(v_title) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Gezegen adı 1-100 karakter arasında olmalıdır.' USING ERRCODE = '22023';
  END IF;
  IF v_description IS NOT NULL AND length(v_description) > 2000 THEN
    RAISE EXCEPTION 'Açıklama 2000 karakterden uzun olamaz.' USING ERRCODE = '22023';
  END IF;
  IF p_milestone_date IS NULL THEN
    RAISE EXCEPTION 'Anı tarihi zorunludur.' USING ERRCODE = '22023';
  END IF;
  IF p_orbit_distance IS NULL OR p_orbit_distance NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Geçersiz yörünge mesafesi (1-5).' USING ERRCODE = '22023';
  END IF;
  IF p_orbit_speed IS NULL OR p_orbit_speed <= 0 THEN
    RAISE EXCEPTION 'Yörünge hızı 0''dan büyük olmalıdır.' USING ERRCODE = '22023';
  END IF;
  IF p_planet_type IS NULL
     OR p_planet_type NOT IN ('terrestrial','gas_giant','ice_world','ocean_world','crystal','volcanic','desert','ringed_giant') THEN
    RAISE EXCEPTION 'Geçersiz gezegen tipi.' USING ERRCODE = '22023';
  END IF;
  IF p_palette IS NULL
     OR cardinality(p_palette) NOT BETWEEN 2 AND 5 OR EXISTS (
    SELECT 1 FROM unnest(p_palette) AS c(color) WHERE c.color !~* '^#[0-9A-F]{6}$'
  ) THEN
    RAISE EXCEPTION 'Palet 2-5 geçerli HEX renk içermelidir.' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_manual_count
  FROM public.star_exoplanets AS ep
  WHERE ep.star_id = p_star_id
    AND ep.is_auto_generated = false;
  IF v_manual_count >= 10 THEN
    RAISE EXCEPTION 'Maksimum 10 manuel gezegen oluşturabilirsiniz.' USING ERRCODE = 'P0007';
  END IF;

  INSERT INTO public.star_exoplanets (
    star_id, title, description, milestone_date, orbit_distance, orbit_speed,
    planet_type, palette, media_urls, custom_metadata, is_auto_generated
  ) VALUES (
    p_star_id, v_title, v_description, p_milestone_date, p_orbit_distance,
    p_orbit_speed, p_planet_type, p_palette, ARRAY[]::text[], '{}'::jsonb, false
  ) RETURNING * INTO v_record;
  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_exoplanet(p_planet_id uuid, p_patch jsonb)
RETURNS public.star_exoplanets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_couple_id integer;
  v_record public.star_exoplanets%ROWTYPE;
  v_text text;
  v_integer integer;
  v_numeric numeric;
  v_palette text[];
BEGIN
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erişim.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_active_premium(v_caller_couple_id) THEN
    RAISE EXCEPTION 'Gezegen düzenlemek için aktif Premium üyelik gereklidir.'
      USING ERRCODE = 'P0010';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'Patch bir JSON nesnesi olmalıdır.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_patch) AS keys(key)
    WHERE keys.key NOT IN ('title', 'description', 'milestone_date', 'orbit_distance', 'orbit_speed', 'planet_type', 'palette')
  ) THEN
    RAISE EXCEPTION 'Patch desteklenmeyen alan içeriyor.' USING ERRCODE = '22023';
  END IF;

  SELECT ep.* INTO v_record
  FROM public.star_exoplanets AS ep
  JOIN public.couple_stars AS cs ON cs.id = ep.star_id
  WHERE ep.id = p_planet_id
    AND cs.couple_id = v_caller_couple_id
  FOR UPDATE OF ep;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gezegen bulunamadı veya yetkiniz yok.' USING ERRCODE = '42501';
  END IF;

  IF p_patch ? 'title' THEN
    IF p_patch->'title' = 'null'::jsonb OR jsonb_typeof(p_patch->'title') <> 'string' THEN
      RAISE EXCEPTION 'Gezegen adı geçerli bir metin olmalıdır.' USING ERRCODE = '22023';
    END IF;
    v_text := trim(p_patch->>'title');
    IF length(v_text) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'Gezegen adı 1-100 karakter arasında olmalıdır.' USING ERRCODE = '22023';
    END IF;
    v_record.title := v_text;
  END IF;

  IF p_patch ? 'description' THEN
    IF p_patch->'description' = 'null'::jsonb THEN
      v_record.description := NULL;
    ELSIF jsonb_typeof(p_patch->'description') <> 'string' THEN
      RAISE EXCEPTION 'Açıklama bir metin olmalıdır.' USING ERRCODE = '22023';
    ELSE
      v_text := NULLIF(trim(p_patch->>'description'), '');
      IF v_text IS NOT NULL AND length(v_text) > 2000 THEN
        RAISE EXCEPTION 'Açıklama 2000 karakterden uzun olamaz.' USING ERRCODE = '22023';
      END IF;
      v_record.description := v_text;
    END IF;
  END IF;

  IF p_patch ? 'milestone_date' THEN
    IF p_patch->'milestone_date' = 'null'::jsonb THEN
      v_record.milestone_date := NULL;
    ELSIF jsonb_typeof(p_patch->'milestone_date') <> 'string' THEN
      RAISE EXCEPTION 'Anı tarihi geçerli bir tarih olmalıdır.' USING ERRCODE = '22023';
    ELSE
      BEGIN
        v_record.milestone_date := (p_patch->>'milestone_date')::date;
      EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
        RAISE EXCEPTION 'Geçersiz anı tarihi.' USING ERRCODE = '22023';
      END;
    END IF;
  END IF;

  IF p_patch ? 'orbit_distance' THEN
    IF p_patch->'orbit_distance' = 'null'::jsonb OR jsonb_typeof(p_patch->'orbit_distance') <> 'number'
       OR (p_patch->>'orbit_distance') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Yörünge mesafesi tam sayı olmalıdır.' USING ERRCODE = '22023';
    END IF;
    v_integer := (p_patch->>'orbit_distance')::integer;
    IF v_integer NOT BETWEEN 1 AND 5 THEN
      RAISE EXCEPTION 'Geçersiz yörünge mesafesi (1-5).' USING ERRCODE = '22023';
    END IF;
    v_record.orbit_distance := v_integer;
  END IF;

  IF p_patch ? 'orbit_speed' THEN
    IF p_patch->'orbit_speed' = 'null'::jsonb OR jsonb_typeof(p_patch->'orbit_speed') <> 'number' THEN
      RAISE EXCEPTION 'Yörünge hızı bir sayı olmalıdır.' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_numeric := (p_patch->>'orbit_speed')::numeric;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Yörünge hızı bir sayı olmalıdır.' USING ERRCODE = '22023';
    END;
    IF v_numeric <= 0 THEN
      RAISE EXCEPTION 'Yörünge hızı 0''dan büyük olmalıdır.' USING ERRCODE = '22023';
    END IF;
    v_record.orbit_speed := v_numeric;
  END IF;

  IF p_patch ? 'planet_type' THEN
    IF p_patch->'planet_type' = 'null'::jsonb OR jsonb_typeof(p_patch->'planet_type') <> 'string'
       OR p_patch->>'planet_type' NOT IN ('terrestrial','gas_giant','ice_world','ocean_world','crystal','volcanic','desert','ringed_giant') THEN
      RAISE EXCEPTION 'Geçersiz gezegen tipi.' USING ERRCODE = '22023';
    END IF;
    v_record.planet_type := p_patch->>'planet_type';
  END IF;

  IF p_patch ? 'palette' THEN
    IF p_patch->'palette' = 'null'::jsonb OR jsonb_typeof(p_patch->'palette') <> 'array'
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_patch->'palette') AS c(color) WHERE jsonb_typeof(c.color) <> 'string') THEN
      RAISE EXCEPTION 'Palet bir renk dizisi olmalıdır.' USING ERRCODE = '22023';
    END IF;
    SELECT array_agg(c.color) INTO v_palette
    FROM jsonb_array_elements_text(p_patch->'palette') AS c(color);
    IF v_palette IS NULL OR cardinality(v_palette) NOT BETWEEN 2 AND 5
       OR EXISTS (SELECT 1 FROM unnest(v_palette) AS c(color) WHERE c.color !~* '^#[0-9A-F]{6}$') THEN
      RAISE EXCEPTION 'Palet 2-5 geçerli HEX renk içermelidir.' USING ERRCODE = '22023';
    END IF;
    v_record.palette := v_palette;
  END IF;

  UPDATE public.star_exoplanets
  SET title = v_record.title,
      description = v_record.description,
      milestone_date = v_record.milestone_date,
      orbit_distance = v_record.orbit_distance,
      orbit_speed = v_record.orbit_speed,
      planet_type = v_record.planet_type,
      palette = v_record.palette,
      updated_at = statement_timestamp()
  WHERE id = p_planet_id
  RETURNING * INTO v_record;
  RETURN v_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_exoplanet(p_exoplanet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_couple_id integer;
BEGIN
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erişim.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.star_exoplanets AS ep
  USING public.couple_stars AS cs
  WHERE ep.id = p_exoplanet_id
    AND cs.id = ep.star_id
    AND cs.couple_id = v_caller_couple_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gezegen bulunamadı veya yetkiniz yok.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.append_media_to_exoplanet(p_planet_id uuid, p_media_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_couple_id integer;
  v_media_path text := trim(p_media_url);
  v_record public.star_exoplanets%ROWTYPE;
BEGIN
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erişim.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_active_premium(v_caller_couple_id) THEN
    RAISE EXCEPTION 'Medya eklemek için aktif Premium üyelik gereklidir.' USING ERRCODE = 'P0010';
  END IF;
  IF v_media_path IS NULL OR v_media_path = ''
     OR (storage.foldername(v_media_path))[1] IS DISTINCT FROM v_caller_couple_id::text
     OR (storage.foldername(v_media_path))[2] IS DISTINCT FROM 'exoplanets'
     OR NOT EXISTS (
       SELECT 1 FROM storage.objects AS o
       WHERE o.bucket_id = 'couple-memories' AND o.name = v_media_path
     ) THEN
    RAISE EXCEPTION 'Medya dosyası bu çifte ait geçerli bir exoplanets yolu değil.' USING ERRCODE = '42501';
  END IF;

  SELECT ep.* INTO v_record
  FROM public.star_exoplanets AS ep
  JOIN public.couple_stars AS cs ON cs.id = ep.star_id
  WHERE ep.id = p_planet_id AND cs.couple_id = v_caller_couple_id
  FOR UPDATE OF ep;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gezegen bulunamadı veya yetkiniz yok.' USING ERRCODE = '42501';
  END IF;
  IF NOT (v_media_path = ANY(v_record.media_urls)) THEN
    UPDATE public.star_exoplanets
    SET media_urls = array_append(COALESCE(media_urls, ARRAY[]::text[]), v_media_path),
        updated_at = statement_timestamp()
    WHERE id = p_planet_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_media_from_exoplanet(p_planet_id uuid, p_media_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_couple_id integer;
BEGIN
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erişim.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_active_premium(v_caller_couple_id) THEN
    RAISE EXCEPTION 'Medya düzenlemek için aktif Premium üyelik gereklidir.' USING ERRCODE = 'P0010';
  END IF;
  UPDATE public.star_exoplanets AS ep
  SET media_urls = array_remove(ep.media_urls, trim(p_media_url)),
      updated_at = statement_timestamp()
  FROM public.couple_stars AS cs
  WHERE ep.id = p_planet_id
    AND cs.id = ep.star_id
    AND cs.couple_id = v_caller_couple_id
    AND trim(p_media_url) = ANY(ep.media_urls);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Medya veya gezegen bulunamadı ya da yetkiniz yok.' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.append_letter_to_exoplanet(p_planet_id uuid, p_letter_id uuid)
RETURNS void
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

CREATE OR REPLACE FUNCTION public.create_due_auto_exoplanet_internal(p_star_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_couple_id integer;
  v_last_window timestamptz;
  v_auto_count integer;
  v_new_id uuid;
  v_planet_types text[] := ARRAY['terrestrial','gas_giant','ice_world','ocean_world','crystal','volcanic','desert','ringed_giant'];
BEGIN
  SELECT cs.couple_id INTO v_couple_id
  FROM public.couple_stars AS cs
  WHERE cs.id = p_star_id
  FOR UPDATE;
  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yıldız bulunamadı.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_active_premium(v_couple_id) THEN
    RETURN NULL;
  END IF;
  SELECT max(ep.window_started_at), count(*)
    INTO v_last_window, v_auto_count
  FROM public.star_exoplanets AS ep
  WHERE ep.star_id = p_star_id AND ep.is_auto_generated = true;
  IF v_last_window IS NOT NULL AND v_last_window > statement_timestamp() - interval '45 days' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.star_exoplanets (
    star_id, title, milestone_date, orbit_distance, orbit_speed, planet_type,
    palette, media_urls, custom_metadata, is_auto_generated, window_started_at
  ) VALUES (
    p_star_id,
    'Anılarımız — ' || to_char(statement_timestamp(), 'DD.MM.YYYY'),
    current_date,
    (v_auto_count % 5) + 1,
    1.00,
    v_planet_types[(v_auto_count % array_length(v_planet_types, 1)) + 1],
    ARRAY['#4facfe', '#00f2fe'], ARRAY[]::text[], '{}'::jsonb, true, statement_timestamp()
  ) RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_auto_exoplanet(p_star_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_couple_id integer;
  v_star_couple_id integer;
  v_existing_id uuid;
BEGIN
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erişim.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_active_premium(v_caller_couple_id) THEN
    RAISE EXCEPTION 'Otomatik gezegen oluşturmak için aktif Premium üyelik gereklidir.' USING ERRCODE = 'P0010';
  END IF;
  SELECT cs.couple_id INTO v_star_couple_id
  FROM public.couple_stars AS cs
  WHERE cs.id = p_star_id;
  IF v_star_couple_id IS NULL OR v_star_couple_id <> v_caller_couple_id THEN
    RAISE EXCEPTION 'Bu yıldız size ait değil.' USING ERRCODE = '42501';
  END IF;
  SELECT ep.id INTO v_existing_id
  FROM public.star_exoplanets AS ep
  WHERE ep.star_id = p_star_id
    AND ep.is_auto_generated = true
    AND ep.window_started_at > statement_timestamp() - interval '45 days'
  ORDER BY ep.window_started_at DESC
  LIMIT 1;
  RETURN COALESCE(v_existing_id, public.create_due_auto_exoplanet_internal(p_star_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.process_due_auto_exoplanets(p_batch_size integer DEFAULT 50)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_star record;
  v_new_id uuid;
  v_created_count integer := 0;
BEGIN
  IF p_batch_size IS NULL OR p_batch_size NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Batch boyutu 1-500 arasında olmalıdır.' USING ERRCODE = '22023';
  END IF;
  FOR v_star IN
    SELECT cs.id
    FROM public.couple_stars AS cs
    LEFT JOIN LATERAL (
      SELECT max(ep.window_started_at) AS last_window
      FROM public.star_exoplanets AS ep
      WHERE ep.star_id = cs.id AND ep.is_auto_generated = true
    ) AS auto_window ON true
    WHERE public.has_active_premium(cs.couple_id)
      AND (auto_window.last_window IS NULL OR auto_window.last_window <= statement_timestamp() - interval '45 days')
    ORDER BY COALESCE(auto_window.last_window, cs.created_at) ASC
    LIMIT p_batch_size
    FOR UPDATE OF cs SKIP LOCKED
  LOOP
    BEGIN
      v_new_id := public.create_due_auto_exoplanet_internal(v_star.id);
      IF v_new_id IS NOT NULL THEN
        v_created_count := v_created_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- A broken couple must not interrupt the rest of the cron batch.
      NULL;
    END;
  END LOOP;
  RETURN v_created_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_manual_exoplanet_limit(p_star_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_couple_id integer;
  v_star_couple_id integer;
BEGIN
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erişim.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_active_premium(v_caller_couple_id) THEN
    RAISE EXCEPTION 'Gezegen oluşturmak için aktif Premium üyelik gereklidir.' USING ERRCODE = 'P0010';
  END IF;
  SELECT cs.couple_id INTO v_star_couple_id FROM public.couple_stars AS cs WHERE cs.id = p_star_id;
  IF v_star_couple_id IS NULL OR v_star_couple_id <> v_caller_couple_id THEN
    RAISE EXCEPTION 'Bu yıldız size ait değil.' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT count(*) < 10 FROM public.star_exoplanets AS ep WHERE ep.star_id = p_star_id AND ep.is_auto_generated = false);
END;
$$;

DROP POLICY IF EXISTS "Çiftler kendi anılarını yönetebilir" ON storage.objects;
DROP POLICY IF EXISTS "couple_memories_access_policy" ON storage.objects;
CREATE POLICY "couple_memories_access_policy" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'couple-memories'
  AND (storage.foldername(name))[1] = public.get_my_couple_id()::text
  AND (
    (storage.foldername(name))[2] IS DISTINCT FROM 'exoplanets'
    OR public.has_my_active_premium()
  )
)
WITH CHECK (
  bucket_id = 'couple-memories'
  AND (storage.foldername(name))[1] = public.get_my_couple_id()::text
  AND (storage.foldername(name))[2] IN ('exoplanets', 'photos', 'letters')
  AND (
    (storage.foldername(name))[2] IS DISTINCT FROM 'exoplanets'
    OR public.has_my_active_premium()
  )
);

REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLE public.star_exoplanets FROM authenticated, anon;

REVOKE ALL ON FUNCTION public.get_star_system_map(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exoplanet_details(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_exoplanet(uuid, text, text, date, integer, numeric, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_exoplanet(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_exoplanet(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_media_to_exoplanet(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_media_from_exoplanet(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.append_letter_to_exoplanet(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_auto_exoplanet(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_manual_exoplanet_limit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_due_auto_exoplanet_internal(uuid) FROM PUBLIC, authenticated, anon;
REVOKE ALL ON FUNCTION public.process_due_auto_exoplanets(integer) FROM PUBLIC, authenticated, anon;

GRANT EXECUTE ON FUNCTION public.get_star_system_map(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_exoplanet_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_exoplanet(uuid, text, text, date, integer, numeric, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_exoplanet(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_exoplanet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_media_to_exoplanet(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_media_from_exoplanet(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_letter_to_exoplanet(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_auto_exoplanet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_manual_exoplanet_limit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_auto_exoplanets(integer) TO service_role;

COMMIT;
-- pg_cron uzantısını aktifleştir
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  -- Aynı isimli eski bir job varsa (duplicate schedule oluşmaması için) bul
  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'process-due-auto-exoplanets'
  LIMIT 1;

  -- Varsa iptal et
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END;
$$;

-- Saatte bir çalışacak job'ı kur
SELECT cron.schedule(
  'process-due-auto-exoplanets',
  '0 * * * *',
  $cron$
    SELECT public.process_due_auto_exoplanets(50);
  $cron$
);
