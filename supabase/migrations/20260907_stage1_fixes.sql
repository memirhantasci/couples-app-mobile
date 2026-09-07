-- ============================================================================
-- MIGRATION: 20260907_stage1_fixes.sql
-- Aşama 1 — Kritik Bug Düzeltmeleri (Yıldız Sahiplenme Akışı)
-- ============================================================================
-- Bu migration:
--   1. celestial_catalog tablosuna common_name sütunu ekler
--   2. 35 parlak yıldız için common_name seed güncellemesi yapar
--   3. claim_specific_star RPC'sini oluşturur (P0004, P0005 hata kalkanlarıyla)
--   4. get_stars_in_viewport fonksiyonunu common_name ile günceller
--   5. get_my_couple_star_details fonksiyonunu common_name ile günceller
-- ============================================================================


-- ============================================================================
-- 1. celestial_catalog: common_name TEXT NULL sütunu ekle
-- ============================================================================
ALTER TABLE public.celestial_catalog
  ADD COLUMN IF NOT EXISTS common_name TEXT NULL;

COMMENT ON COLUMN public.celestial_catalog.common_name
  IS 'Yıldızın yaygın/populer adı (Sirius, Vega, Polaris vb.). Yalnızca tanınan parlak yıldızlar için dolu; diğerleri NULL.';


-- ============================================================================
-- 2. Seed: 35 parlak yıldız için common_name güncelleme
-- ============================================================================
UPDATE public.celestial_catalog SET common_name = 'Sirius'           WHERE catalog_code = 'HIP-32349';
UPDATE public.celestial_catalog SET common_name = 'Canopus'          WHERE catalog_code = 'HIP-30438';
UPDATE public.celestial_catalog SET common_name = 'Alpha Centauri A' WHERE catalog_code = 'HIP-71683';
UPDATE public.celestial_catalog SET common_name = 'Arcturus'         WHERE catalog_code = 'HIP-69673';
UPDATE public.celestial_catalog SET common_name = 'Vega'             WHERE catalog_code = 'HIP-91262';
UPDATE public.celestial_catalog SET common_name = 'Capella'          WHERE catalog_code = 'HIP-24608';
UPDATE public.celestial_catalog SET common_name = 'Rigel'            WHERE catalog_code = 'HIP-24436';
UPDATE public.celestial_catalog SET common_name = 'Procyon'          WHERE catalog_code = 'HIP-37279';
UPDATE public.celestial_catalog SET common_name = 'Betelgeuse'       WHERE catalog_code = 'HIP-27989';
UPDATE public.celestial_catalog SET common_name = 'Achernar'         WHERE catalog_code = 'HIP-7588';
UPDATE public.celestial_catalog SET common_name = 'Hadar'            WHERE catalog_code = 'HIP-68702';
UPDATE public.celestial_catalog SET common_name = 'Altair'           WHERE catalog_code = 'HIP-97649';
UPDATE public.celestial_catalog SET common_name = 'Acrux'            WHERE catalog_code = 'HIP-60718';
UPDATE public.celestial_catalog SET common_name = 'Aldebaran'        WHERE catalog_code = 'HIP-21421';
UPDATE public.celestial_catalog SET common_name = 'Spica'            WHERE catalog_code = 'HIP-65474';
UPDATE public.celestial_catalog SET common_name = 'Antares'          WHERE catalog_code = 'HIP-80763';
UPDATE public.celestial_catalog SET common_name = 'Pollux'           WHERE catalog_code = 'HIP-37826';
UPDATE public.celestial_catalog SET common_name = 'Fomalhaut'        WHERE catalog_code = 'HIP-113368';
UPDATE public.celestial_catalog SET common_name = 'Deneb'            WHERE catalog_code = 'HIP-102098';
UPDATE public.celestial_catalog SET common_name = 'Mimosa'           WHERE catalog_code = 'HIP-62434';
UPDATE public.celestial_catalog SET common_name = 'Regulus'          WHERE catalog_code = 'HIP-49669';
UPDATE public.celestial_catalog SET common_name = 'Adhara'           WHERE catalog_code = 'HIP-33579';
UPDATE public.celestial_catalog SET common_name = 'Castor'           WHERE catalog_code = 'HIP-36850';
UPDATE public.celestial_catalog SET common_name = 'Gacrux'           WHERE catalog_code = 'HIP-61084';
UPDATE public.celestial_catalog SET common_name = 'Shaula'           WHERE catalog_code = 'HIP-86032';
UPDATE public.celestial_catalog SET common_name = 'Bellatrix'        WHERE catalog_code = 'HIP-25336';
UPDATE public.celestial_catalog SET common_name = 'Alnilam'          WHERE catalog_code = 'HIP-27366';
UPDATE public.celestial_catalog SET common_name = 'Rasalhague'       WHERE catalog_code = 'HIP-85927';
UPDATE public.celestial_catalog SET common_name = 'Polaris'          WHERE catalog_code = 'HIP-11767';
UPDATE public.celestial_catalog SET common_name = 'Mizar'            WHERE catalog_code = 'HIP-65378';
UPDATE public.celestial_catalog SET common_name = 'Dubhe'            WHERE catalog_code = 'HIP-54061';
UPDATE public.celestial_catalog SET common_name = 'Eta Piscium'      WHERE catalog_code = 'HIP-8796';
UPDATE public.celestial_catalog SET common_name = 'Alpheratz'        WHERE catalog_code = 'HIP-1067';
UPDATE public.celestial_catalog SET common_name = 'Markab'           WHERE catalog_code = 'HIP-113881';
UPDATE public.celestial_catalog SET common_name = 'Mirfak'           WHERE catalog_code = 'HIP-14576';


-- ============================================================================
-- 3. FONKSIYON: claim_specific_star
-- ============================================================================
-- Kullanıcının MacroSkyCanvas üzerinde seçtiği belirli bir yıldızı atomik
-- olarak tesciller. claim_random_available_star'ın aksine rastgele değil,
-- belirli catalog_id'ye özel kilit alır.
--
-- Mimari Kararlar:
--   • FOR UPDATE (SKIP LOCKED yok): Belirli satır isteniyor; başka bir TX
--     aynı yıldızı kilitlemişse burada beklenir ve sonra P0004 alır.
--   • P0004: Yıldız zaten alınmış (race condition — başkası kapti).
--   • P0005: Bu çiftin zaten bir yıldızı var (frontend engelini atlatma/race).
--   • common_name: get_my_couple_star_details üzerinden otomatik gelir.
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

  -- ── 2. Transaction-Level Advisory Lock (couple_id bazlı) ──
  -- Aynı çiftten eşzamanlı tescil çağrılarını sıraya alır.
  PERFORM pg_advisory_xact_lock(hashtext('claim_star_lock'), p_couple_id);

  -- ── 3. Çiftin Zaten Yıldızı Var mı? (P0005) ──
  -- Frontend zaten bu durumu engeller; bu DB seviyesinde ikinci savunma katmanı.
  SELECT id INTO v_existing_star_id
    FROM public.couple_stars
   WHERE couple_id = p_couple_id;

  IF v_existing_star_id IS NOT NULL THEN
    RAISE EXCEPTION 'Bu çiftin zaten bir yıldızı var — her çift yalnızca bir yıldıza sahip olabilir.'
      USING ERRCODE = 'P0005';
  END IF;

  -- ── 4. Hedef Yıldızı Kilitle ve Durumunu Kontrol Et ──
  -- FOR UPDATE: bu satırı kesin kilitler; başka TX beklenir → serbest kalınca kontrol.
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
  -- 'welcome_spark' tipi kullanılır; kullanıcının o günkü 'daily_spark'
  -- hakkı ve 20 saatlik soğuma süresi tüketilmez.
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
-- 4. FONKSIYON: get_my_couple_star_details — common_name eklendi
-- ============================================================================
-- Mevcut fonksiyonu common_name alanını içerecek şekilde günceller.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_couple_star_details(p_couple_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_caller_couple_id INTEGER;
  v_last_spark_at    TIMESTAMPTZ;
  v_next_spark_at    TIMESTAMPTZ;
  v_can_spark        BOOLEAN;
  v_cooldown_sec     INTEGER;
  v_result           JSONB;
BEGIN
  -- Güvenlik: Sadece kendi çiftinin detayını alabilir
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL OR v_caller_couple_id <> p_couple_id THEN
    RAISE EXCEPTION 'Yetkisiz erişim: Yalnızca kendi çiftinize ait yıldız detaylarını görüntüleyebilirsiniz.'
      USING ERRCODE = '42501';
  END IF;

  -- Kullanıcının son daily_spark zamanını bul
  SELECT created_at INTO v_last_spark_at
    FROM public.star_sparks
   WHERE sender_id  = auth.uid()
     AND spark_type = 'daily_spark'
     AND created_at >= NOW() - INTERVAL '20 hours'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_last_spark_at IS NULL THEN
    v_can_spark     := TRUE;
    v_next_spark_at := NOW();
    v_cooldown_sec  := 0;
  ELSE
    v_can_spark     := FALSE;
    v_next_spark_at := v_last_spark_at + INTERVAL '20 hours';
    v_cooldown_sec  := GREATEST(0, EXTRACT(EPOCH FROM (v_next_spark_at - NOW()))::INTEGER);
  END IF;

  SELECT jsonb_build_object(
    'star_id',                    cs.id,
    'couple_id',                  cs.couple_id,
    'catalog_id',                 cs.catalog_id,
    'catalog_code',               cc.catalog_code,
    'common_name',                cc.common_name,
    'custom_name',                cs.custom_name,
    'ra',                         cc.ra,
    'dec',                        cc.dec,
    'magnitude',                  cc.magnitude,
    'spectral_type',              cc.spectral_type,
    'base_color',                 cc.base_color,
    'luminosity_level',           cs.luminosity_level,
    'last_spark_at',              cs.last_spark_at,
    'resonance_active',           (cs.resonance_until IS NOT NULL AND cs.resonance_until > NOW()),
    'resonance_until',            cs.resonance_until,
    'created_at',                 cs.created_at,
    'can_spark_daily',            v_can_spark,
    'daily_spark_available_at',   v_next_spark_at,
    'cooldown_remaining_seconds', v_cooldown_sec,
    'exoplanet_count',            (SELECT COUNT(*) FROM public.star_exoplanets WHERE star_id = cs.id),
    'total_sparks_count',         (SELECT COUNT(*) FROM public.star_sparks WHERE star_id = cs.id)
  ) INTO v_result
  FROM public.couple_stars cs
  JOIN public.celestial_catalog cc ON cc.id = cs.catalog_id
  WHERE cs.couple_id = p_couple_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions;


-- ============================================================================
-- 5. FONKSIYON: get_stars_in_viewport — common_name eklendi
-- ============================================================================
-- PostgreSQL kuralı: RETURNS TABLE sütunları değiştiğinde (yeni common_name)
-- CREATE OR REPLACE tek başına çalışmaz; önce fonksiyon DROP edilmelidir.
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
        CASE
          WHEN cs.couple_id = v_my_couple_id THEN cs.custom_name
          ELSE 'Tescilli Yıldız'::VARCHAR(120)
        END              AS custom_name,
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
        CASE
          WHEN cs.couple_id = v_my_couple_id THEN cs.custom_name
          ELSE 'Tescilli Yıldız'::VARCHAR(120)
        END              AS custom_name,
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
-- 6. Fonksiyon İzinleri (GRANT EXECUTE)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_stars_in_viewport(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_specific_star(INTEGER, BIGINT, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_couple_star_details(INTEGER) TO authenticated;

-- ============================================================================
-- 7. Storage: couple-memories Private Yapılandırması ve RLS
-- ============================================================================
-- Bucket'ı varsa public=false yap, yoksa private olarak oluştur.
INSERT INTO storage.buckets (id, name, public)
VALUES ('couple-memories', 'couple-memories', false)
ON CONFLICT (id) DO UPDATE SET public = false;


-- Eski policy varsa sil
DROP POLICY IF EXISTS "Çiftler kendi anılarını yönetebilir" ON storage.objects;

-- Yeni Policy: Yalnızca kendi couple_id'siyle başlayan dosyalara erişim ve işlem izni
CREATE POLICY "Çiftler kendi anılarını yönetebilir" ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'couple-memories' AND 
  (storage.foldername(name))[1] = public.get_my_couple_id()::text
)
WITH CHECK (
  bucket_id = 'couple-memories' AND 
  (storage.foldername(name))[1] = public.get_my_couple_id()::text
);

