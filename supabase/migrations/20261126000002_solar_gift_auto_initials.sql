-- ============================================================================
-- MIGRATION: 20261126000002_solar_gift_auto_initials.sql
-- Güneş Sistemi hediyesinde otomatik çift baş harfleri + get_solar_system_claims
-- is_mine NULL koruması + mevcut SOL-% kayıtlarının owner_initials tamamlaması
-- ============================================================================
-- 1. admin_gift_solar_star: p_owner_initials verilmezse (NULL/boş), çiftin
--    gerçek kullanıcı adlarından otomatik baş harf üretir (star_owner_label
--    gizli mod: 'E 💕 Ö'). Canlı görünümde get_solar_system_claims zaten
--    star_owner_label ile kullanıcının show_name_on_star rızasına göre canlı
--    isim/baş harf gösterir; owner_initials güvenli yedektir.
-- 2. get_solar_system_claims: anon/demo oturumlarında is_mine NULL yerine
--    FALSE döner.
-- 3. Mevcut owner_initials IS NULL olan SOL-% kayıtlarını otomatik doldurur.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_gift_solar_star(
  p_couple_id      INTEGER,
  p_solar_code     VARCHAR,
  p_owner_initials TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_catalog_id     BIGINT;
  v_catalog_code   VARCHAR(32);
  v_common_name    VARCHAR(120);
  v_new_star_id    UUID;
  v_created_at     TIMESTAMPTZ;
  v_owner_initials TEXT := NULLIF(LEFT(TRIM(COALESCE(p_owner_initials, '')), 16), '');
  v_sender_id      UUID;
BEGIN
  -- 1. Çift var mı?
  IF NOT EXISTS (SELECT 1 FROM public.couples WHERE id = p_couple_id) THEN
    RAISE EXCEPTION 'Belirtilen çift bulunamadı (ID: %).', p_couple_id USING ERRCODE = '22023';
  END IF;

  -- 2. Çiftin zaten bir yıldızı var mı? (Yalnızca yıldızı olmayan çifte verilir)
  IF EXISTS (SELECT 1 FROM public.couple_stars WHERE couple_id = p_couple_id) THEN
    RAISE EXCEPTION 'Bu çiftin zaten bir yıldızı var. Her çift yalnızca tek bir yıldıza sahip olabilir.'
      USING ERRCODE = 'P0005';
  END IF;

  -- 3. Belirtilen Güneş Sistemi kodunu kilitle ve oku
  SELECT id, catalog_code, common_name
    INTO v_catalog_id, v_catalog_code, v_common_name
    FROM public.celestial_catalog
   WHERE catalog_code = UPPER(TRIM(p_solar_code))
     AND catalog_code LIKE 'SOL-%'
   FOR UPDATE;

  IF v_catalog_id IS NULL THEN
    RAISE EXCEPTION 'Geçersiz Güneş Sistemi kodu: %. Geçerli kodlar: SOL-SUN, SOL-MERCURY, SOL-VENUS, SOL-EARTH, SOL-MOON, SOL-MARS, SOL-JUPITER, SOL-SATURN, SOL-URANUS, SOL-NEPTUNE, SOL-PLUTO', p_solar_code
      USING ERRCODE = '22023';
  END IF;

  -- 4. Gezegen daha önce başka bir çifte verilmiş mi?
  IF EXISTS (SELECT 1 FROM public.couple_stars WHERE catalog_id = v_catalog_id) THEN
    RAISE EXCEPTION 'Bu gök cismi (%) zaten başka bir çifte verilmiş!', v_catalog_code
      USING ERRCODE = 'P0004';
  END IF;

  -- 5. Baş harf verilmediyse çiftin mevcut kullanıcı adlarından otomatik üret
  IF v_owner_initials IS NULL THEN
    v_owner_initials := NULLIF(
      LEFT(TRIM(COALESCE(public.star_owner_label(p_couple_id, FALSE, FALSE), '')), 16),
      ''
    );
  END IF;

  -- 6. Kataloğu tescillendi olarak güncelle
  UPDATE public.celestial_catalog
     SET is_claimed = TRUE
   WHERE id = v_catalog_id;

  -- 7. couple_stars kaydını aç (app.admin_gift oturum bayrağı ile Premium kontrolü atlanır)
  PERFORM set_config('app.admin_gift', 'on', true);

  INSERT INTO public.couple_stars (
    couple_id,
    catalog_id,
    custom_name,
    luminosity_level,
    last_spark_at,
    owner_initials,
    name_changed_at
  ) VALUES (
    p_couple_id,
    v_catalog_id,
    v_common_name,
    1.00,
    NOW(),
    v_owner_initials,
    NOW() + INTERVAL '999 years'
  ) RETURNING id, created_at INTO v_new_star_id, v_created_at;

  -- 8. Hoş geldin kıvılcımı ekle
  SELECT id INTO v_sender_id
    FROM public.users
   WHERE couple_id = p_couple_id
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_sender_id IS NOT NULL THEN
    INSERT INTO public.star_sparks (star_id, sender_id, spark_type, message)
    VALUES (
      v_new_star_id,
      v_sender_id,
      'welcome_spark',
      '🌟 Güneş Sistemi’nin eşsiz bir parçası aşkınıza tescillendi! ✨'
    );
  END IF;

  -- 9. Özet JSONB döndür
  RETURN jsonb_build_object(
    'star_id',        v_new_star_id,
    'couple_id',      p_couple_id,
    'catalog_id',     v_catalog_id,
    'catalog_code',   v_catalog_code,
    'common_name',    v_common_name,
    'custom_name',    v_common_name,
    'owner_initials', v_owner_initials,
    'owner_label',    public.star_owner_label(p_couple_id, TRUE, TRUE),
    'created_at',     v_created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_gift_solar_star(INTEGER, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;

-- get_solar_system_claims: is_mine NULL yerine FALSE dönsün (anon/demo uyumu)
CREATE OR REPLACE FUNCTION public.get_solar_system_claims()
RETURNS TABLE (
  catalog_id       BIGINT,
  catalog_code     VARCHAR(32),
  couple_id        INTEGER,
  custom_name      VARCHAR(120),
  is_claimed       BOOLEAN,
  is_mine          BOOLEAN,
  owner_label      TEXT,
  is_connected     BOOLEAN,
  luminosity_level NUMERIC(3,2),
  resonance_active BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid             UUID := auth.uid();
  v_my_couple_id    INTEGER;
  v_my_star_id      UUID;
  v_friend_star_ids UUID[] := ARRAY[]::UUID[];
  v_reported_ids    UUID[] := ARRAY[]::UUID[];
  v_today           DATE := public.activity_local_date(NOW());
BEGIN
  v_my_couple_id := CASE WHEN v_uid IS NULL THEN NULL ELSE public.get_my_couple_id() END;

  IF v_my_couple_id IS NOT NULL THEN
    SELECT cs.id INTO v_my_star_id FROM public.couple_stars AS cs WHERE cs.couple_id = v_my_couple_id;
  END IF;
  IF v_my_star_id IS NOT NULL THEN
    v_friend_star_ids := ARRAY(
      SELECT CASE WHEN sc.star_a_id = v_my_star_id THEN sc.star_b_id ELSE sc.star_a_id END
        FROM public.star_connections AS sc
       WHERE sc.status = 'accepted'
         AND (sc.star_a_id = v_my_star_id OR sc.star_b_id = v_my_star_id)
    );
  END IF;
  IF v_uid IS NOT NULL THEN
    v_reported_ids := ARRAY(
      SELECT r.star_id FROM public.star_reports AS r WHERE r.reporter_id = v_uid
    );
  END IF;

  RETURN QUERY
  SELECT
    cc.id AS catalog_id,
    cc.catalog_code,
    cs.couple_id,
    CASE
      WHEN cs.id IS NULL THEN NULL::VARCHAR(120)
      WHEN cs.couple_id = v_my_couple_id THEN cs.custom_name
      WHEN cs.id = ANY (v_reported_ids) THEN NULL::VARCHAR(120)
      WHEN cs.name_hidden_at IS NOT NULL AND NOT (cs.id = ANY (v_friend_star_ids)) THEN NULL::VARCHAR(120)
      ELSE cs.custom_name
    END AS custom_name,
    (cs.id IS NOT NULL) AS is_claimed,
    COALESCE(cs.couple_id = v_my_couple_id, FALSE) AS is_mine,
    CASE
      WHEN cs.id IS NULL THEN NULL::TEXT
      WHEN cs.couple_id = v_my_couple_id
           OR (cs.id = ANY (v_friend_star_ids) AND NOT (cs.id = ANY (v_reported_ids)))
        THEN COALESCE(public.star_owner_label(cs.couple_id, TRUE, TRUE), cs.owner_initials::TEXT)
      ELSE COALESCE(
        public.star_owner_label(
          cs.couple_id,
          FALSE,
          cs.name_hidden_at IS NULL AND NOT (cs.id = ANY (v_reported_ids))
        ),
        cs.owner_initials::TEXT
      )
    END AS owner_label,
    COALESCE(cs.id = ANY (v_friend_star_ids), FALSE) AS is_connected,
    CASE
      WHEN cs.id IS NULL THEN 1.00::NUMERIC(3,2)
      WHEN cs.couple_id = v_my_couple_id OR cs.id = ANY (v_friend_star_ids)
        THEN COALESCE(cas.brightness, public.calculate_star_brightness(0))
      ELSE public.star_mystery_brightness(cc.id, COALESCE(v_my_couple_id, 0), v_today)
    END::NUMERIC(3,2) AS luminosity_level,
    COALESCE(cs.resonance_until > NOW(), FALSE) AS resonance_active
  FROM public.celestial_catalog cc
  LEFT JOIN public.couple_stars cs ON cs.catalog_id = cc.id
  LEFT JOIN public.couple_activity_score cas
    ON cas.couple_id = cs.couple_id
   AND (cs.couple_id = v_my_couple_id OR cs.id = ANY (v_friend_star_ids))
  WHERE cc.catalog_code LIKE 'SOL-%'
  ORDER BY cc.catalog_code ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_solar_system_claims() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_solar_system_claims() TO authenticated, anon;

-- Mevcut owner_initials alanı boş kalmış SOL-% kayıtlarını otomatik doldur
UPDATE public.couple_stars AS cs
   SET owner_initials = NULLIF(
     LEFT(TRIM(COALESCE(public.star_owner_label(cs.couple_id, FALSE, FALSE), '')), 16),
     ''
   )
  FROM public.celestial_catalog AS cc
 WHERE cc.id = cs.catalog_id
   AND cc.catalog_code LIKE 'SOL-%'
   AND cs.owner_initials IS NULL;

COMMIT;
