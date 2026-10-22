-- ============================================================================
-- MIGRATION: 20261022000005_memories_rls_and_auto_exoplanet_fix.sql
-- 1. memories tablosunda eksik olan DELETE ve UPDATE RLS politikalarının eklenmesi
-- 2. Otomatik anı gezegeni oluşumunda ilk gün boş gezegen üretiminin engellenmesi
--    (en az 45 günlük aktif ilişki ve en az 1 anı kaydı kuralı)
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. MEMORIES TABLOSU RLS POLİTİKALARI (Silme ve Güncelleme)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "memories_delete_couple" ON public.memories;
CREATE POLICY "memories_delete_couple" ON public.memories
  FOR DELETE TO authenticated
  USING (
    couple_id = (SELECT u.couple_id FROM public.users AS u WHERE u.id = auth.uid())
  );

DROP POLICY IF EXISTS "memories_update_couple" ON public.memories;
CREATE POLICY "memories_update_couple" ON public.memories
  FOR UPDATE TO authenticated
  USING (
    couple_id = (SELECT u.couple_id FROM public.users AS u WHERE u.id = auth.uid())
  )
  WITH CHECK (
    couple_id = (SELECT u.couple_id FROM public.users AS u WHERE u.id = auth.uid())
  );

DROP POLICY IF EXISTS "memories_select_couple" ON public.memories;
CREATE POLICY "memories_select_couple" ON public.memories
  FOR SELECT TO authenticated
  USING (
    couple_id = (SELECT u.couple_id FROM public.users AS u WHERE u.id = auth.uid())
  );

DROP POLICY IF EXISTS "memories_insert_couple" ON public.memories;
CREATE POLICY "memories_insert_couple" ON public.memories
  FOR INSERT TO authenticated
  WITH CHECK (
    couple_id = (SELECT u.couple_id FROM public.users AS u WHERE u.id = auth.uid())
  );


-- ────────────────────────────────────────────────────────────────────────────
-- 2. OTOMATİK GEZEGEN ÜRETİMİ (İLK GÜN BOŞ GEZEGEN OLUŞMASININ ENGELLENMESİ)
-- ────────────────────────────────────────────────────────────────────────────

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
  v_star_created_at timestamptz;
  v_memories_count integer;
  v_new_id uuid;
  v_planet_types text[] := ARRAY['terrestrial','gas_giant','ice_world','ocean_world','crystal','volcanic','desert','ringed_giant'];
BEGIN
  SELECT cs.couple_id, cs.created_at INTO v_couple_id, v_star_created_at
  FROM public.couple_stars AS cs
  WHERE cs.id = p_star_id
  FOR UPDATE;

  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yıldız bulunamadı.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_active_premium(v_couple_id) THEN
    RETURN NULL;
  END IF;

  -- KURAL 1: Yıldız tescil edileli en az 45 gün geçmemişse otomatik gezegen üretilmez!
  -- Bu kural, çiftin sisteme girdiği ilk gün boş bir gezegenle karşılaşmasını engeller.
  IF v_star_created_at IS NULL OR v_star_created_at > statement_timestamp() - interval '45 days' THEN
    RETURN NULL;
  END IF;

  -- KURAL 2: Son otomatik gezegen penceresinden bu yana en az 45 gün geçmiş olmalıdır.
  SELECT max(ep.window_started_at), count(*)
    INTO v_last_window, v_auto_count
  FROM public.star_exoplanets AS ep
  WHERE ep.star_id = p_star_id AND ep.is_auto_generated = true;

  IF v_last_window IS NOT NULL AND v_last_window > statement_timestamp() - interval '45 days' THEN
    RETURN NULL;
  END IF;

  -- KURAL 3: Çiftin ortak anısı yoksa içi boş anı gezegeni açılmaz.
  SELECT count(*) INTO v_memories_count
  FROM public.memories
  WHERE couple_id = v_couple_id;

  IF v_memories_count = 0 THEN
    RETURN NULL;
  END IF;

  -- Belirlenen kuralları sağlayan aktif çift için otomatik dönüm noktası gezegeni üretilir
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


-- ────────────────────────────────────────────────────────────────────────────
-- 3. PERİYODİK CRON İŞİ KONTROLÜ
-- ────────────────────────────────────────────────────────────────────────────

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
      AND cs.created_at <= statement_timestamp() - interval '45 days'
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
      NULL;
    END;
  END LOOP;

  RETURN v_created_count;
END;
$$;

COMMIT;
