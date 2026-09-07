-- ============================================================================
-- 20260913: Macro sky viewport query hard limit
--
-- The mobile client requests fixed 30-degree tiles and keeps an LRU of 50
-- tiles. This RPC remains safe when called directly: it uses the coordinate
-- predicate/indexes and can never return more than 300 rows.
-- ============================================================================

-- The GiST index on celestial_catalog.geom and the existing (ra, dec) B-tree
-- index serve the spatial predicate below. This partial index keeps the common
-- unclaimed branch compact as the catalog grows.
CREATE INDEX IF NOT EXISTS idx_celestial_catalog_unclaimed_viewport
  ON public.celestial_catalog (ra, dec, magnitude)
  WHERE is_claimed = FALSE;

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
    COALESCE(cs.resonance_until > NOW(), FALSE)
  FROM public.celestial_catalog cc
  LEFT JOIN public.couple_stars cs ON cs.catalog_id = cc.id
  WHERE
    -- x / y spatial query: RA is x and declination is y.
    cc.dec BETWEEN min_dec AND max_dec
    AND (
      (min_ra <= max_ra AND cc.ra BETWEEN min_ra AND max_ra)
      OR
      (min_ra > max_ra AND (cc.ra >= min_ra OR cc.ra <= max_ra))
    )
    -- Catalog-only special objects are rendered locally by MacroSkyCanvas.
    AND (cc.is_claimed = FALSE OR cs.id IS NOT NULL)
    -- Never hide claimed stars in the viewport; use LOD for unclaimed stars.
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
