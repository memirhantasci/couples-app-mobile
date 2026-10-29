-- ============================================================================
-- MIGRATION: 20261029000002_couples_rls_and_universe_search_leak.sql
--
-- 1. public.couples (denetim 6.1):
--    - 003 / 008'deki "Anyone can delete empty couples" (FOR DELETE USING (true)) politikası
--      018'de kaldırılmıştı; canlı veritabanında kalmış olma ihtimaline karşı (ve elle eklenmiş
--      olabilecek başka DELETE / INSERT politikalarıyla birlikte) yeniden ve koşulsuz kaldırılır.
--      Neredeyse tüm çift tabloları couples(id) ON DELETE CASCADE ile bağlı olduğundan bu
--      politika tek bir istekle bütün verinin silinmesine izin veriyordu.
--    - İstemci çifti hiçbir zaman doğrudan oluşturmaz / silmez (get_or_create_my_couple,
--      join_couple_by_code_uuid ve hesap silme RPC'leri SECURITY DEFINER'dır): INSERT, DELETE
--      ve TRUNCATE yetkileri anon / authenticated rollerinden alınır.
--    - "Couples can be viewed by their members or if empty" politikası boş (member_count = 0)
--      tüm çiftlerin eşleşme kodlarını herkese açıyordu. Bekleyen kullanıcının çifti zaten
--      get_my_couple_id() ile eşleştiği için okuma yalnızca kendi çiftiyle sınırlanır.
--    - anon rolünün couples tablosunda hiçbir yetkisi kalmaz.
--
-- 2. search_celestial_universe (denetim 6.2):
--    - Ötegezegen (anı gezegeni) dalında çift filtresi yoktu: herkes iki harf yazarak bütün
--      çiftlerin anı gezegeni başlıklarını okuyabiliyordu. Artık yalnızca çağıranın kendi
--      yıldızının gezegenleri, ve get_my_star_exoplanets ile aynı kuralla yalnızca aktif
--      Premium'da döner (aksi halde başlık zaten "Kilitli anı gezegeni" olarak gizleniyor).
--    - v_is_real_user anon anahtarıyla yapılan çağrıda da true oluyordu (anon JWT'de
--      is_anonymous alanı yok). Çift verisi içeren dallar artık gerçek bir oturum ister;
--      oturumsuz (demo) arama yalnızca herkese açık katalog verisini görür.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. couples RLS
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r record;
BEGIN
  -- Ad farkı ne olursa olsun yazma / silme politikaları (ve onları da kapsayan ALL) kaldırılır
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'couples'
      AND cmd IN ('DELETE', 'INSERT', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.couples', r.policyname);
  END LOOP;
END $$;

REVOKE INSERT, DELETE, TRUNCATE ON public.couples FROM anon, authenticated;

DROP POLICY IF EXISTS "Couples can be viewed by their members or if empty" ON public.couples;
DROP POLICY IF EXISTS "Couples can be viewed by their members" ON public.couples;
CREATE POLICY "Couples can be viewed by their members"
  ON public.couples
  FOR SELECT
  TO authenticated
  USING (id = public.get_my_couple_id());

REVOKE ALL ON public.couples FROM anon;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. search_celestial_universe
-- ────────────────────────────────────────────────────────────────────────────
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
  -- anon anahtarıyla yapılan çağrıda is_anonymous alanı yoktur; gerçek oturum auth.uid() ile doğrulanır
  v_is_real_user := auth.uid() IS NOT NULL
    AND COALESCE(auth.jwt() ->> 'is_anonymous', 'false') = 'false';
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

    -- 4. Ötegezegenler (Anı Gezegenleri): yalnızca çağıranın kendi yıldızınınkiler ve aktif Premium'da
    SELECT
      se.id::TEXT AS r_entity_id,
      'exoplanet'::TEXT AS r_entity_type,
      se.title::TEXT AS r_display_name,
      cc.catalog_code AS r_catalog_code,
      cc.ra AS r_ra,
      cc."dec" AS r_dec,
      TRUE AS r_is_own_star,
      public.normalize_search_text(se.title) AS r_norm_text
    FROM public.star_exoplanets se
    JOIN public.couple_stars cs ON cs.id = se.star_id
    JOIN public.celestial_catalog cc ON cc.id = cs.catalog_id
    WHERE v_is_real_user
      AND v_my_couple_id IS NOT NULL
      AND cs.couple_id = v_my_couple_id
      AND public.has_active_premium(v_my_couple_id)
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

-- Varsayılan PUBLIC yetkisi yerine roller açıkça verilir. Oturumsuz (demo) arama katalog
-- dallarıyla çalışmaya devam eder; çift verisi içeren dallar yukarıda gerçek oturum ister.
REVOKE ALL ON FUNCTION public.search_celestial_universe(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_celestial_universe(TEXT) TO anon, authenticated;

COMMIT;
