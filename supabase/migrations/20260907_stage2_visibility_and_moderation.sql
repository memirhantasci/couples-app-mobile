-- ============================================================================
-- MIGRATION: Aşama 2 - Yıldız İsmi Görünürlüğü ve İçerik Moderasyonu
-- ============================================================================
-- 1. contains_blocked_word fonksiyonu (Server-side moderasyon)
-- 2. claim_random_available_star (P0006 kontrolü)
-- 3. claim_specific_star (P0006 kontrolü)
-- 4. get_stars_in_viewport (custom_name herkes için görünür)
-- ============================================================================

-- ============================================================================
-- 1. FONKSİYON: contains_blocked_word (İçerik Moderasyonu)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.contains_blocked_word(p_text TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_word TEXT;
  v_blocked_words TEXT[] := ARRAY[
    'amk', 'aq', 'sik', 'sok', 'oç', 'yarak', 'yarrak', 'piç', 'ibne', 'orospu', 'gavat',
    'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'whore', 'slut', 'fag'
  ];
BEGIN
  FOREACH v_word IN ARRAY v_blocked_words
  LOOP
    -- \y kelime sınırı (word boundary) anlamına gelir. Case-insensitive (~*) eşleşme.
    IF p_text ~* ('\y' || v_word || '\y') THEN
      RETURN TRUE;
    END IF;
  END LOOP;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 2. FONKSİYON: claim_random_available_star (Moderasyon Güncellemesi)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.claim_random_available_star(
  p_couple_id   INTEGER,
  p_custom_name VARCHAR,
  p_mag_max     NUMERIC DEFAULT 6.50
)
RETURNS JSONB AS $$
DECLARE
  v_caller_couple_id INTEGER;
  v_existing_star_id UUID;
  v_random_ra        NUMERIC;
  v_catalog_id       BIGINT;
  v_new_star_id      UUID;
BEGIN
  -- ── 1. Kimlik ve Çift Doğrulaması ──
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL OR v_caller_couple_id <> p_couple_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Yalnızca üyesi olduğunuz çift adına yıldız sahiplenebilirsiniz.'
      USING ERRCODE = '42501';
  END IF;

  -- ── 1.5 İçerik Moderasyonu (P0006) ──
  IF public.contains_blocked_word(p_custom_name) THEN
    RAISE EXCEPTION 'Yıldız ismi topluluk kurallarına aykırı kelimeler içeremez.'
      USING ERRCODE = 'P0006';
  END IF;

  -- ── 2. Transaction-Level Advisory Lock ──
  PERFORM pg_advisory_xact_lock(hashtext('claim_star_lock'), p_couple_id);

  -- ── 3. Çiftin Zaten Yıldızı Var mı? ──
  SELECT id INTO v_existing_star_id
    FROM public.couple_stars
   WHERE couple_id = p_couple_id;

  IF v_existing_star_id IS NOT NULL THEN
    RETURN public.get_my_couple_star_details(p_couple_id);
  END IF;

  -- ── 4. Rastgele Açısal Ofset Üretimi ──
  v_random_ra := ROUND((random() * 360.0)::numeric, 4);

  -- ── 5A. Sarmal Aşama 1: [v_random_ra .. 360.0000] ──
  SELECT id INTO v_catalog_id
    FROM public.celestial_catalog
   WHERE is_claimed = FALSE
     AND magnitude <= p_mag_max
     AND ra >= v_random_ra
   ORDER BY ra ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  -- ── 5B. Sarmal Aşama 2 (Wrap-around): [0.0000 .. v_random_ra) ──
  IF v_catalog_id IS NULL THEN
    SELECT id INTO v_catalog_id
      FROM public.celestial_catalog
     WHERE is_claimed = FALSE
       AND magnitude <= p_mag_max
       AND ra < v_random_ra
     ORDER BY ra ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED;
  END IF;

  -- ── 6. Tüm Gökkubbede Boşta Yıldız Kalmadıysa ──
  IF v_catalog_id IS NULL THEN
    RAISE EXCEPTION 'Katalogda aranan parlaklık kriterine (magnitude <= %) uygun boşta yıldız kalmadı.', p_mag_max
      USING ERRCODE = 'P0003';
  END IF;

  -- ── 7. Yıldızı Tescille ──
  UPDATE public.celestial_catalog
     SET is_claimed = TRUE
   WHERE id = v_catalog_id;

  -- ── 8. couple_stars Kaydını Oluştur ──
  INSERT INTO public.couple_stars (
    couple_id,
    catalog_id,
    custom_name,
    luminosity_level,
    last_spark_at
  ) VALUES (
    p_couple_id,
    v_catalog_id,
    TRIM(p_custom_name),
    1.00,
    NOW()
  ) RETURNING id INTO v_new_star_id;

  -- ── 9. İlk Karşılama Kıvılcımı ──
  INSERT INTO public.star_sparks (
    star_id,
    sender_id,
    spark_type,
    message
  ) VALUES (
    v_new_star_id,
    auth.uid(),
    'welcome_spark',
    'Bizim Yıldızımız tescil edildi! ✨'
  );

  -- ── 10. Tam Tescil Detayını Döndür ──
  RETURN public.get_my_couple_star_details(p_couple_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================================
-- 3. FONKSİYON: claim_specific_star (Moderasyon Güncellemesi)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.claim_specific_star(
  p_couple_id       INTEGER,
  p_star_catalog_id BIGINT,
  p_custom_name     VARCHAR
)
RETURNS JSONB AS $$
DECLARE
  v_caller_couple_id INTEGER;
  v_existing_star_id UUID;
  v_is_claimed       BOOLEAN;
  v_new_star_id      UUID;
BEGIN
  -- ── 1. Kimlik ve Çift Doğrulaması ──
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL OR v_caller_couple_id <> p_couple_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Yalnızca üyesi olduğunuz çift adına yıldız sahiplenebilirsiniz.'
      USING ERRCODE = '42501';
  END IF;

  -- ── 1.5 İçerik Moderasyonu (P0006) ──
  IF public.contains_blocked_word(p_custom_name) THEN
    RAISE EXCEPTION 'Yıldız ismi topluluk kurallarına aykırı kelimeler içeremez.'
      USING ERRCODE = 'P0006';
  END IF;

  -- ── 2. Transaction-Level Advisory Lock (couple_id bazlı) ──
  PERFORM pg_advisory_xact_lock(hashtext('claim_star_lock'), p_couple_id);

  -- ── 3. Çiftin Zaten Yıldızı Var mı? (P0005) ──
  SELECT id INTO v_existing_star_id
    FROM public.couple_stars
   WHERE couple_id = p_couple_id;

  IF v_existing_star_id IS NOT NULL THEN
    RAISE EXCEPTION 'Bu çiftin zaten bir yıldızı var — her çift yalnızca bir yıldıza sahip olabilir.'
      USING ERRCODE = 'P0005';
  END IF;

  -- ── 4. Hedef Yıldızı Kilitle ve Durumunu Kontrol Et ──
  SELECT is_claimed INTO v_is_claimed
    FROM public.celestial_catalog
   WHERE id = p_star_catalog_id
   FOR UPDATE;

  IF v_is_claimed IS NULL THEN
    RAISE EXCEPTION 'Belirtilen yıldız kataloğda bulunamadı.'
      USING ERRCODE = '22023';
  END IF;

  -- ── 5. Yıldız Zaten Tescillenmiş mi? (P0004 — Race Condition) ──
  IF v_is_claimed = TRUE THEN
    RAISE EXCEPTION 'Bu yıldız az önce başka bir çift tarafından seçildi, lütfen başka bir yıldız seçin.'
      USING ERRCODE = 'P0004';
  END IF;

  -- ── 6. Yıldızı Tescille ──
  UPDATE public.celestial_catalog
     SET is_claimed = TRUE
   WHERE id = p_star_catalog_id;

  -- ── 7. couple_stars Kaydını Oluştur ──
  INSERT INTO public.couple_stars (
    couple_id,
    catalog_id,
    custom_name,
    luminosity_level,
    last_spark_at
  ) VALUES (
    p_couple_id,
    p_star_catalog_id,
    TRIM(p_custom_name),
    1.00,
    NOW()
  ) RETURNING id INTO v_new_star_id;

  -- ── 8. İlk Karşılama Kıvılcımı (welcome_spark) ──
  INSERT INTO public.star_sparks (
    star_id,
    sender_id,
    spark_type,
    message
  ) VALUES (
    v_new_star_id,
    auth.uid(),
    'welcome_spark',
    'Bizim Yıldızımız tescil edildi! ✨'
  );

  -- ── 9. Tam Tescil Detayını Döndür ──
  RETURN public.get_my_couple_star_details(p_couple_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================================
-- 4. FONKSIYON: get_stars_in_viewport (Görünürlük Güncellemesi)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_stars_in_viewport(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.get_stars_in_viewport(NUMERIC, NUMERIC, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION public.get_stars_in_viewport(
  min_ra      NUMERIC,
  max_ra      NUMERIC,
  min_dec     NUMERIC,
  max_dec     NUMERIC,
  zoom_level  NUMERIC DEFAULT 1.0
)
RETURNS TABLE (
  catalog_id        BIGINT,
  catalog_code      VARCHAR(32),
  ra                NUMERIC(8,4),
  "dec"             NUMERIC(8,4),
  magnitude         NUMERIC(4,2),
  spectral_type     VARCHAR(16),
  base_color        VARCHAR(9),
  common_name       TEXT,
  is_claimed        BOOLEAN,
  is_mine           BOOLEAN,
  custom_name       VARCHAR(120),
  luminosity_level  NUMERIC(3,2),
  resonance_active  BOOLEAN
) AS $$
DECLARE
  v_my_couple_id INTEGER;
  v_mag_limit    NUMERIC(4,2);
  v_item_limit   INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    v_my_couple_id := public.get_my_couple_id();
  ELSE
    v_my_couple_id := NULL;
  END IF;

  IF zoom_level < 2.0 THEN
    v_mag_limit  := 3.80;
    v_item_limit := 400;
  ELSIF zoom_level < 4.0 THEN
    v_mag_limit  := 5.80;
    v_item_limit := 800;
  ELSE
    v_mag_limit  := 9.00;
    v_item_limit := 1500;
  END IF;

  IF min_ra <= max_ra THEN
    RETURN QUERY
    WITH claimed_stars AS (
      SELECT
        cc.id            AS catalog_id,
        cc.catalog_code,
        cc.ra,
        cc.dec,
        cc.magnitude,
        cc.spectral_type,
        cc.base_color,
        cc.common_name,
        TRUE             AS is_claimed,
        (cs.couple_id IS NOT NULL AND cs.couple_id = v_my_couple_id) AS is_mine,
        cs.custom_name   AS custom_name,
        COALESCE(cs.luminosity_level, 1.00) AS luminosity_level,
        COALESCE(cs.resonance_until > NOW(), FALSE) AS resonance_active
      FROM public.celestial_catalog cc
      JOIN public.couple_stars cs ON cs.catalog_id = cc.id
      WHERE cc.geom && extensions.ST_MakeEnvelope(min_ra, min_dec, max_ra, max_dec, 4326)
      ORDER BY
        (cs.couple_id = v_my_couple_id) DESC,
        cc.magnitude ASC
      LIMIT 500
    ),
    unclaimed_stars AS (
      SELECT
        cc.id            AS catalog_id,
        cc.catalog_code,
        cc.ra,
        cc.dec,
        cc.magnitude,
        cc.spectral_type,
        cc.base_color,
        cc.common_name,
        FALSE            AS is_claimed,
        FALSE            AS is_mine,
        NULL::VARCHAR(120) AS custom_name,
        1.00::NUMERIC(3,2) AS luminosity_level,
        FALSE            AS resonance_active
      FROM public.celestial_catalog cc
      WHERE cc.geom && extensions.ST_MakeEnvelope(min_ra, min_dec, max_ra, max_dec, 4326)
        AND cc.is_claimed = FALSE
        AND cc.magnitude <= v_mag_limit
      ORDER BY cc.magnitude ASC
      LIMIT v_item_limit
    )
    SELECT * FROM claimed_stars
    UNION ALL
    SELECT * FROM unclaimed_stars
    ORDER BY is_mine DESC, is_claimed DESC, magnitude ASC;

  ELSE
    RETURN QUERY
    WITH claimed_stars AS (
      SELECT
        cc.id            AS catalog_id,
        cc.catalog_code,
        cc.ra,
        cc.dec,
        cc.magnitude,
        cc.spectral_type,
        cc.base_color,
        cc.common_name,
        TRUE             AS is_claimed,
        (cs.couple_id IS NOT NULL AND cs.couple_id = v_my_couple_id) AS is_mine,
        cs.custom_name   AS custom_name,
        COALESCE(cs.luminosity_level, 1.00) AS luminosity_level,
        COALESCE(cs.resonance_until > NOW(), FALSE) AS resonance_active
      FROM public.celestial_catalog cc
      JOIN public.couple_stars cs ON cs.catalog_id = cc.id
      WHERE (
          cc.geom && extensions.ST_MakeEnvelope(min_ra, min_dec, 360.0000, max_dec, 4326)
          OR
          cc.geom && extensions.ST_MakeEnvelope(0.0000, min_dec, max_ra, max_dec, 4326)
      )
      ORDER BY
        (cs.couple_id = v_my_couple_id) DESC,
        cc.magnitude ASC
      LIMIT 500
    ),
    unclaimed_stars AS (
      SELECT
        cc.id            AS catalog_id,
        cc.catalog_code,
        cc.ra,
        cc.dec,
        cc.magnitude,
        cc.spectral_type,
        cc.base_color,
        cc.common_name,
        FALSE            AS is_claimed,
        FALSE            AS is_mine,
        NULL::VARCHAR(120) AS custom_name,
        1.00::NUMERIC(3,2) AS luminosity_level,
        FALSE            AS resonance_active
      FROM public.celestial_catalog cc
      WHERE (
          cc.geom && extensions.ST_MakeEnvelope(min_ra, min_dec, 360.0000, max_dec, 4326)
          OR
          cc.geom && extensions.ST_MakeEnvelope(0.0000, min_dec, max_ra, max_dec, 4326)
      )
      AND cc.is_claimed = FALSE
      AND cc.magnitude <= v_mag_limit
      ORDER BY cc.magnitude ASC
      LIMIT v_item_limit
    )
    SELECT * FROM claimed_stars
    UNION ALL
    SELECT * FROM unclaimed_stars
    ORDER BY is_mine DESC, is_claimed DESC, magnitude ASC;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================================
-- 5. İzinler (GRANT)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.contains_blocked_word(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_random_available_star(INTEGER, VARCHAR, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_specific_star(INTEGER, BIGINT, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stars_in_viewport(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated, anon;
