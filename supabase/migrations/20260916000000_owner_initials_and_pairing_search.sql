-- ============================================================================
-- MIGRATION: 20260916000000_owner_initials_and_pairing_search.sql
-- "Bizim Yıldızımız" — Tescilli yıldızlarda sahip çiftin baş harfleri +
-- yıldız aramasına çift kodu (pairing_code) desteği.
--
-- NOT: `users.display_name` / `users.username` istemci tarafında AES ile
-- şifrelenir (bkz. src/utils/crypto.ts); veritabanı bu alanları çözemez.
-- Bu yüzden baş harfler, çiftin KENDİ istemcisi tarafından (adlarını zaten
-- çözebildiği için) hesaplanıp tescil anında düz metin olarak gönderilir ve
-- `couple_stars.owner_initials` içinde saklanır (ör. "A 💕 M") — tam isim
-- değil, yalnızca 1-2 harflik baş harf, mahremiyeti korur.
-- ============================================================================

-- 1. YENİ SÜTUN: couple_stars.owner_initials
ALTER TABLE public.couple_stars
  ADD COLUMN IF NOT EXISTS owner_initials VARCHAR(16);

COMMENT ON COLUMN public.couple_stars.owner_initials IS
  'Tescil anında istemci tarafından hesaplanan çiftin baş harfleri (ör. "A 💕 M"). Düz metin; gerçek isim değildir.';

-- ============================================================================
-- 2. claim_random_available_star — p_owner_initials parametresi eklendi
-- ============================================================================
DROP FUNCTION IF EXISTS public.claim_random_available_star(INTEGER, VARCHAR, NUMERIC);

CREATE OR REPLACE FUNCTION public.claim_random_available_star(
  p_couple_id      INTEGER,
  p_custom_name    VARCHAR,
  p_mag_max        NUMERIC DEFAULT 6.50,
  p_owner_initials TEXT DEFAULT NULL
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
    last_spark_at,
    owner_initials
  ) VALUES (
    p_couple_id,
    v_catalog_id,
    TRIM(p_custom_name),
    1.00,
    NOW(),
    NULLIF(LEFT(TRIM(p_owner_initials), 16), '')
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
-- 3. claim_specific_star — p_owner_initials parametresi eklendi
-- ============================================================================
DROP FUNCTION IF EXISTS public.claim_specific_star(INTEGER, BIGINT, VARCHAR);

CREATE OR REPLACE FUNCTION public.claim_specific_star(
  p_couple_id       INTEGER,
  p_star_catalog_id BIGINT,
  p_custom_name     VARCHAR,
  p_owner_initials  TEXT DEFAULT NULL
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
    last_spark_at,
    owner_initials
  ) VALUES (
    p_couple_id,
    p_star_catalog_id,
    TRIM(p_custom_name),
    1.00,
    NOW(),
    NULLIF(LEFT(TRIM(p_owner_initials), 16), '')
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
-- 4. claim_star_in_sector — p_owner_initials parametresi eklendi
-- ============================================================================
DROP FUNCTION IF EXISTS public.claim_star_in_sector(INTEGER, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION public.claim_star_in_sector(
  p_couple_id      INTEGER,
  p_sector_id      VARCHAR(32),
  p_custom_name    VARCHAR(120),
  p_owner_initials TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_caller_couple_id INTEGER;
  v_catalog_id       BIGINT;
  v_new_star_id      UUID;
  v_code3            VARCHAR(4);
  v_min_ra           NUMERIC(8,4);
  v_max_ra           NUMERIC(8,4);
  v_min_dec          NUMERIC(8,4);
  v_max_dec          NUMERIC(8,4);
  v_rnd              NUMERIC;
  v_spec             VARCHAR(16);
  v_color            VARCHAR(9);
  v_mag              NUMERIC(4,2);
  v_gen_ra           NUMERIC(8,4);
  v_gen_dec          NUMERIC(8,4);
  v_new_code         VARCHAR(32);
BEGIN
  -- 1. Kimlik Doğrulaması
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL OR v_caller_couple_id <> p_couple_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Yalnızca üyesi olduğunuz çift adına yıldız sahiplenebilirsiniz.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Transaction-Level Advisory Lock
  PERFORM pg_advisory_xact_lock(hashtext('claim_star_lock'), p_couple_id);

  -- 3. Çiftin Zaten Yıldızı Var mı?
  IF EXISTS (SELECT 1 FROM public.couple_stars WHERE couple_id = p_couple_id) THEN
    RAISE EXCEPTION 'Çiftinizin zaten tescilli bir yıldızı bulunmaktadır.'
      USING ERRCODE = 'P0004';
  END IF;

  -- 4. Sektörün Varlığını, Geometrik Sınırlarını ve IAU code3 Kodunu DB'den Çek
  SELECT code3, min_ra, max_ra, min_dec, max_dec
    INTO v_code3, v_min_ra, v_max_ra, v_min_dec, v_max_dec
    FROM public.sky_sectors
   WHERE id = p_sector_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Geçersiz sektör kimliği: %', p_sector_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 5. Seçilen sektörde boşta gerçek katalog yıldızı ara (parlaklık sırasıyla)
  SELECT id INTO v_catalog_id
    FROM public.celestial_catalog
   WHERE is_claimed = FALSE
     AND sector_id = p_sector_id
   ORDER BY magnitude ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  -- 6. Sektörde boş katalog yıldızı kalmadıysa -> Prosedürel Sanal Yıldız Üretimi (Fallback)
  IF v_catalog_id IS NULL THEN
    v_gen_ra  := ROUND((v_min_ra + random() * (v_max_ra - v_min_ra))::numeric, 4);
    v_gen_dec := ROUND((v_min_dec + random() * (v_max_dec - v_min_dec))::numeric, 4);

    v_new_code := 'VIRT-' || v_code3 || '-' ||
                  TO_HEX(EXTRACT(EPOCH FROM clock_timestamp())::BIGINT) || '-' ||
                  UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 4));

    v_rnd := random();
    IF v_rnd < 0.10 THEN    v_spec := 'O5V';  v_color := '#8AABFF'; v_mag := ROUND((2.20 + random() * 1.50)::numeric, 2);
    ELSIF v_rnd < 0.28 THEN v_spec := 'B2V';  v_color := '#9BB5FF'; v_mag := ROUND((3.00 + random() * 1.80)::numeric, 2);
    ELSIF v_rnd < 0.50 THEN v_spec := 'A0V';  v_color := '#D6E3FF'; v_mag := ROUND((3.50 + random() * 2.00)::numeric, 2);
    ELSIF v_rnd < 0.68 THEN v_spec := 'F5V';  v_color := '#F8F9FA'; v_mag := ROUND((4.00 + random() * 2.00)::numeric, 2);
    ELSIF v_rnd < 0.84 THEN v_spec := 'G2V';  v_color := '#FFF4E8'; v_mag := ROUND((4.40 + random() * 2.00)::numeric, 2);
    ELSIF v_rnd < 0.94 THEN v_spec := 'K2V';  v_color := '#FFE5C2'; v_mag := ROUND((4.80 + random() * 1.60)::numeric, 2);
    ELSE                    v_spec := 'M0V';  v_color := '#FFCCB3'; v_mag := ROUND((5.20 + random() * 1.30)::numeric, 2);
    END IF;

    INSERT INTO public.celestial_catalog (
      catalog_code, ra, dec, magnitude, spectral_type, base_color, is_claimed, sector_id, is_virtual
    ) VALUES (
      v_new_code, v_gen_ra, v_gen_dec, v_mag, v_spec, v_color, TRUE, p_sector_id, TRUE
    ) RETURNING id INTO v_catalog_id;
  ELSE
    UPDATE public.celestial_catalog
       SET is_claimed = TRUE
     WHERE id = v_catalog_id;
  END IF;

  -- 7. couple_stars Kaydını Oluştur
  INSERT INTO public.couple_stars (
    couple_id, catalog_id, custom_name, luminosity_level, last_spark_at, owner_initials
  ) VALUES (
    p_couple_id, v_catalog_id, TRIM(p_custom_name), 1.00, NOW(),
    NULLIF(LEFT(TRIM(p_owner_initials), 16), '')
  ) RETURNING id INTO v_new_star_id;

  -- 8. Hoş Geldin Kıvılcımı
  INSERT INTO public.star_sparks (star_id, sender_id, spark_type, message)
  VALUES (v_new_star_id, auth.uid(), 'welcome_spark', 'Gökyüzündeki sonsuz aşkınız parıldamaya başladı ✨');

  -- 9. Detayları Döndür (mevcut helper RPC)
  RETURN public.get_my_couple_star_details(p_couple_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- ============================================================================
-- 5. get_stars_in_viewport — owner_initials çıktı sütunu eklendi
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_stars_in_viewport(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC);

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
  resonance_active  BOOLEAN,
  owner_initials    VARCHAR(16)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_my_couple_id INTEGER;
  v_mag_limit NUMERIC(4,2);
BEGIN
  v_my_couple_id := CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.get_my_couple_id() END;
  v_mag_limit := CASE
    WHEN zoom_level < 1.5 THEN 3.80
    WHEN zoom_level < 4.0 THEN 5.80
    ELSE 9.00
  END;

  RETURN QUERY
  SELECT
    cc.id,
    cc.catalog_code,
    cc.ra,
    cc.dec,
    cc.magnitude,
    cc.spectral_type,
    cc.base_color,
    cc.common_name,
    (cs.id IS NOT NULL) AS is_claimed,
    (cs.couple_id = v_my_couple_id) AS is_mine,
    CASE
      WHEN cs.couple_id = v_my_couple_id THEN cs.custom_name
      WHEN cs.id IS NOT NULL THEN 'Tescilli Yıldız'::VARCHAR(120)
      ELSE NULL::VARCHAR(120)
    END AS custom_name,
    COALESCE(cs.luminosity_level, 1.00)::NUMERIC(3,2),
    COALESCE(cs.resonance_until > NOW(), FALSE),
    CASE
      -- Kendi yıldızınız zaten Hero Beacon ile gösterilir; baş harfe gerek yok.
      WHEN cs.couple_id = v_my_couple_id THEN NULL::VARCHAR(16)
      WHEN cs.id IS NOT NULL THEN cs.owner_initials
      ELSE NULL::VARCHAR(16)
    END AS owner_initials
  FROM public.celestial_catalog cc
  LEFT JOIN public.couple_stars cs ON cs.catalog_id = cc.id
  WHERE
    cc.dec BETWEEN min_dec AND max_dec
    AND (
      (min_ra <= max_ra AND cc.ra BETWEEN min_ra AND max_ra)
      OR
      (min_ra > max_ra AND (cc.ra >= min_ra OR cc.ra <= max_ra))
    )
    AND (cc.is_claimed = FALSE OR cs.id IS NOT NULL)
    AND (cs.id IS NOT NULL OR cc.magnitude <= v_mag_limit)
  ORDER BY
    (cs.couple_id = v_my_couple_id) DESC,
    (cs.id IS NOT NULL) DESC,
    cc.magnitude ASC
  LIMIT 300;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stars_in_viewport(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC)
  TO authenticated, anon;

-- ============================================================================
-- 6. search_star_by_name — çift kodu (pairing_code) ile arama desteği
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_star_by_name(p_query TEXT)
RETURNS TABLE (
  star_id      UUID,
  custom_name  VARCHAR(120),
  catalog_code VARCHAR(32),
  ra           NUMERIC(8,4),
  "dec"        NUMERIC(8,4)
) AS $$
DECLARE
  v_escaped_query TEXT;
  v_trimmed_query TEXT;
  v_my_couple_id  INTEGER;
BEGIN
  v_my_couple_id := public.get_my_couple_id();
  v_trimmed_query := TRIM(p_query);
  -- % ve _ ve \ karakterlerini güvenle kaçışla (SQL wildcard injection koruması)
  v_escaped_query := replace(replace(replace(v_trimmed_query, '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  SELECT
    cs.id,
    cs.custom_name,
    cc.catalog_code,
    cc.ra,
    cc."dec"
  FROM public.couple_stars cs
  JOIN public.celestial_catalog cc ON cc.id = cs.catalog_id
  WHERE (
      cs.custom_name ILIKE ('%' || v_escaped_query || '%') ESCAPE '\'
      OR cs.couple_id IN (
        SELECT c.id FROM public.couples c
         WHERE c.pairing_code = UPPER(v_trimmed_query)
      )
    )
    AND cs.couple_id IS DISTINCT FROM v_my_couple_id
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 7. İZİNLER (GRANT EXECUTE)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.claim_random_available_star(INTEGER, VARCHAR, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_specific_star(INTEGER, BIGINT, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_star_in_sector(INTEGER, VARCHAR, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_star_by_name(TEXT) TO authenticated;
