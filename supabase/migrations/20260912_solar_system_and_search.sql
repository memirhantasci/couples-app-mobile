-- A. Collation ve Klavye Bağımsız Deterministik Normalizasyon: normalize_search_text
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.normalize_search_text(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  v_res TEXT;
BEGIN
  IF input_text IS NULL OR length(trim(input_text)) = 0 THEN
    RETURN '';
  END IF;
  
  -- 1. Adım: Türkçe Dotted/Dotless I eşlemesi (İ, I, ı -> i)
  v_res := replace(replace(replace(input_text, 'İ', 'i'), 'I', 'i'), 'ı', 'i');
  
  -- 2. Adım: Standart lower() (diğer tüm Latin karakterler küçük harfe çekilir)
  v_res := lower(v_res);
  
  -- 3. Adım: Türkçe temel harf dönüşümü ve yaygın aksanlı karakterlerin temizlenmesi
  -- unaccent eklentisi bağımlılığını (ve 42883 hatasını) ortadan kaldırmak için tam kapsamlı translate
  v_res := translate(v_res, 'çğöşüâêîôûáéíóúàèìòùäëïöüñ', 'cgosuaeiouaeiouaeiouaeioun');
  
  RETURN v_res;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- B. Fonksiyonel GIN Trigram İndeksleri
CREATE INDEX IF NOT EXISTS idx_trgm_couple_stars_custom_name
  ON public.couple_stars USING gin (public.normalize_search_text(custom_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_trgm_celestial_catalog_code
  ON public.celestial_catalog USING gin (public.normalize_search_text(catalog_code) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_trgm_celestial_catalog_common_name
  ON public.celestial_catalog USING gin (public.normalize_search_text(common_name) gin_trgm_ops)
  WHERE common_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trgm_star_exoplanets_title
  ON public.star_exoplanets USING gin (public.normalize_search_text(title) gin_trgm_ops);

-- C. Güneş Sistemi Gerçek Astronomik Koordinatları (J2000.0 Epoch)
-- 1. Güneş (Sun)
-- NASA JPL Horizons J2000.0 Epoch (2000-01-01 12:00 TT) standart Güneş koordinatları: RA=280.4600, DEC=-23.4400
INSERT INTO public.celestial_catalog (catalog_code, common_name, ra, dec, magnitude, spectral_type, base_color, is_claimed)
VALUES ('SOL-SUN', 'Güneş', 280.4600, -23.4400, -26.74, 'G2V', '#FFF4E8', TRUE)
ON CONFLICT (catalog_code) DO UPDATE
SET common_name = 'Güneş', ra = 280.4600, dec = -23.4400, magnitude = -26.74;

-- 2. Venüs (Venus)
-- NASA JPL Horizons J2000.0 Epoch (2000-01-01 12:00 TT) standart Venüs jeosentrik koordinatları: RA=243.6000, DEC=-19.9000
INSERT INTO public.celestial_catalog (catalog_code, common_name, ra, dec, magnitude, spectral_type, base_color, is_claimed)
VALUES ('SOL-VENUS', 'Venüs', 243.6000, -19.9000, -4.40, 'Terrestrial', '#FFE5C2', TRUE)
ON CONFLICT (catalog_code) DO UPDATE
SET common_name = 'Venüs', ra = 243.6000, dec = -19.9000, magnitude = -4.40;

-- 3. Dünya (Earth)
-- J2000.0 Epoch heliosentrik Dünya vektör izdüşümü (Güneş 180° karşıt vektörü): RA=100.4600, DEC=+23.4400
INSERT INTO public.celestial_catalog (catalog_code, common_name, ra, dec, magnitude, spectral_type, base_color, is_claimed)
VALUES ('SOL-EARTH', 'Dünya', 100.4600, 23.4400, -3.80, 'Terrestrial', '#38BDF8', TRUE)
ON CONFLICT (catalog_code) DO UPDATE
SET common_name = 'Dünya', ra = 100.4600, dec = 23.4400, magnitude = -3.80;

-- D. İki Ayrı Arama Fonksiyonu (Dual Search Architecture)

-- 1. Sosyal Bağlantı Araması: search_star_by_name(p_query TEXT)
DROP FUNCTION IF EXISTS public.search_star_by_name(TEXT);

CREATE OR REPLACE FUNCTION public.search_star_by_name(p_query TEXT)
RETURNS TABLE (
  star_id      UUID,
  custom_name  VARCHAR(120),
  catalog_code VARCHAR(32),
  ra           NUMERIC(8,4),
  "dec"        NUMERIC(8,4)
) AS $$
DECLARE
  v_norm_query    TEXT;
  v_escaped_query TEXT;
BEGIN
  IF p_query IS NULL OR length(trim(p_query)) < 2 THEN
    RETURN;
  END IF;

  -- SQL wildcard escape koruması (önce backslash, sonra % ve _)
  v_escaped_query := replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_');
  v_norm_query := public.normalize_search_text(v_escaped_query);

  RETURN QUERY
  SELECT
    cs.id AS star_id,
    cs.custom_name,
    cc.catalog_code,
    cc.ra,
    cc."dec"
  FROM public.couple_stars cs
  JOIN public.celestial_catalog cc ON cc.id = cs.catalog_id
  WHERE public.normalize_search_text(cs.custom_name) LIKE ('%' || v_norm_query || '%') ESCAPE '\'
    AND cs.couple_id <> public.get_my_couple_id()
  ORDER BY
    (public.normalize_search_text(cs.custom_name) = v_norm_query) DESC,
    (public.normalize_search_text(cs.custom_name) LIKE (v_norm_query || '%') ESCAPE '\') DESC,
    similarity(public.normalize_search_text(cs.custom_name), v_norm_query) DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.search_star_by_name(TEXT) TO authenticated;

-- 2. Genel Harita / Evren Araması: search_celestial_universe(p_query TEXT)
CREATE OR REPLACE FUNCTION public.search_celestial_universe(p_query TEXT)
RETURNS TABLE (
  entity_id    TEXT,
  entity_type  TEXT,
  display_name TEXT,
  catalog_code VARCHAR(32),
  ra           NUMERIC(8,4),
  "dec"        NUMERIC(8,4),
  is_own_star  BOOLEAN
) AS $$
DECLARE
  v_norm_query    TEXT;
  v_escaped_query TEXT;
  v_my_couple_id  INTEGER;
  v_is_real_user  BOOLEAN;
BEGIN
  IF p_query IS NULL OR length(trim(p_query)) < 2 THEN
    RETURN;
  END IF;

  v_my_couple_id := public.get_my_couple_id();
  v_is_real_user := COALESCE(auth.jwt() ->> 'is_anonymous', 'false') = 'false';
  -- SQL wildcard escape koruması
  v_escaped_query := replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_');
  v_norm_query := public.normalize_search_text(v_escaped_query);

  RETURN QUERY
  WITH raw_results AS (
    -- 1. Yaygın İsimler (Örn: Güneş, Venüs, Dünya, Vega, Sirius)
    SELECT
      cc.id::TEXT AS r_entity_id,
      'common'::TEXT AS r_entity_type,
      cc.common_name::TEXT AS r_display_name,
      cc.catalog_code AS r_catalog_code,
      cc.ra AS r_ra,
      cc."dec" AS r_dec,
      FALSE AS r_is_own_star,
      public.normalize_search_text(cc.common_name) AS r_norm_text
    FROM public.celestial_catalog cc
    WHERE cc.common_name IS NOT NULL
      AND public.normalize_search_text(cc.common_name) LIKE ('%' || v_norm_query || '%') ESCAPE '\'

    UNION ALL

    -- 2. Çiftlerin Tescilli Yıldızları
    SELECT
      cs.id::TEXT AS r_entity_id,
      'custom'::TEXT AS r_entity_type,
      cs.custom_name::TEXT AS r_display_name,
      cc.catalog_code AS r_catalog_code,
      cc.ra AS r_ra,
      cc."dec" AS r_dec,
      (cs.couple_id = v_my_couple_id) AS r_is_own_star,
      public.normalize_search_text(cs.custom_name) AS r_norm_text
    FROM public.couple_stars cs
    JOIN public.celestial_catalog cc ON cc.id = cs.catalog_id
    WHERE v_is_real_user
      AND public.normalize_search_text(cs.custom_name) LIKE ('%' || v_norm_query || '%') ESCAPE '\'

    UNION ALL

    -- 3. Katalog Kodları (Örn: HIP-26727, SOL-SUN)
    SELECT
      cc.id::TEXT AS r_entity_id,
      'catalog'::TEXT AS r_entity_type,
      COALESCE(cc.common_name, cc.catalog_code)::TEXT AS r_display_name,
      cc.catalog_code AS r_catalog_code,
      cc.ra AS r_ra,
      cc."dec" AS r_dec,
      FALSE AS r_is_own_star,
      public.normalize_search_text(cc.catalog_code) AS r_norm_text
    FROM public.celestial_catalog cc
    WHERE public.normalize_search_text(cc.catalog_code) LIKE ('%' || v_norm_query || '%') ESCAPE '\'

    UNION ALL

    -- 4. Ötegezegenler (Anı Gezegenleri)
    SELECT
      se.id::TEXT AS r_entity_id,
      'exoplanet'::TEXT AS r_entity_type,
      se.title::TEXT AS r_display_name,
      cc.catalog_code AS r_catalog_code,
      cc.ra AS r_ra,
      cc."dec" AS r_dec,
      (cs.couple_id = v_my_couple_id) AS r_is_own_star,
      public.normalize_search_text(se.title) AS r_norm_text
    FROM public.star_exoplanets se
    JOIN public.couple_stars cs ON cs.id = se.star_id
    JOIN public.celestial_catalog cc ON cc.id = cs.catalog_id
    WHERE v_is_real_user
      AND public.normalize_search_text(se.title) LIKE ('%' || v_norm_query || '%') ESCAPE '\'
  ),
  ranked_results AS (
    SELECT
      r.*,
      ROW_NUMBER() OVER (
        PARTITION BY r.r_entity_id
        ORDER BY
          -- 1. Tam eşleşme (kullanıcının yazdığı isimle birebir uyuşan)
          (r.r_norm_text = v_norm_query) DESC,
          -- 2. Kategori Önceliği: Aynı cisim hem common hem catalog ile gelirse 'common' KESİNLİKLE KAZANSIN
          CASE r.r_entity_type
            WHEN 'common' THEN 1
            WHEN 'custom' THEN 2
            WHEN 'catalog' THEN 3
            WHEN 'exoplanet' THEN 4
            ELSE 5
          END ASC,
          -- 3. Prefix ve similarity
          (r.r_norm_text LIKE (v_norm_query || '%') ESCAPE '\') DESC,
          similarity(r.r_norm_text, v_norm_query) DESC
      ) AS rn
    FROM raw_results r
  )
  SELECT
    r.r_entity_id,
    r.r_entity_type,
    r.r_display_name,
    r.r_catalog_code,
    r.r_ra,
    r.r_dec,
    r.r_is_own_star
  FROM ranked_results r
  WHERE r.rn = 1
  ORDER BY
    (r.r_norm_text = v_norm_query) DESC,
    (r.r_norm_text LIKE (v_norm_query || '%') ESCAPE '\') DESC,
    similarity(r.r_norm_text, v_norm_query) DESC,
    CASE r.r_entity_type
      WHEN 'common' THEN 1
      WHEN 'custom' THEN 2
      WHEN 'catalog' THEN 3
      WHEN 'exoplanet' THEN 4
      ELSE 5
    END ASC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.search_celestial_universe(TEXT) TO authenticated;
