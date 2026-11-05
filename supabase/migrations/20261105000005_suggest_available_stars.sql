-- ============================================================================
-- MIGRATION: 20261105000005_suggest_available_stars.sql
-- Boşta bir yıldız ÖNER (gökyüzü kalabalıklaşınca elle aramak yorucu olmasın)
-- ============================================================================
-- Gökyüzü dolunca kullanıcı boş bir yıldız bulmak için tek tek yıldıza dokunmak zorunda kalır. Bu fonksiyon boşta
-- (sahipsiz) gerçek yıldızlardan rastgele birkaçını önerir; uygulama kamerayı o yıldıza uçurup kartını açar. Öneri
-- bağlayıcı değildir: kullanıcı beğenmezse başkasını ister ya da gökyüzünden kendi yıldızını seçer. Tescil, her zamanki
-- gibi claim_specific_star ile yapılır (başkası aynı anda alırsa P0004 verir).
--
--   p_limit   : kaç öneri (1-5, varsayılan 1)
--   p_exclude : zaten gösterilen yıldızların catalog_id listesi (tekrar önerilmez; en fazla 200 kullanılır)
--
-- Güneş Sistemi nesneleri (SOL-*) ve kadiri 6.5'ten sönük satırlar önerilmez. Boşta gerçek yıldız kalmadıysa sonuç
-- boştur; arayüz bu durumda "yeni yıldız doğur" yolunu (claim_random_available_star, sanal yıldız) sunar.
-- Yalnızca oturum açmış kullanıcı çağırabilir. Yalnızca okuma yapar, hiçbir yıldızı ayırmaz/kilitlemez.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.suggest_available_stars(
  p_limit   INTEGER DEFAULT 1,
  p_exclude BIGINT[] DEFAULT ARRAY[]::BIGINT[]
)
RETURNS TABLE (
  catalog_id    BIGINT,
  catalog_code  VARCHAR(32),
  ra            NUMERIC,
  "dec"         NUMERIC,
  magnitude     NUMERIC,
  spectral_type VARCHAR(16),
  base_color    VARCHAR(9),
  common_name   TEXT
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_limit   INTEGER := LEAST(GREATEST(COALESCE(p_limit, 1), 1), 5);
  v_exclude BIGINT[] := COALESCE(p_exclude, ARRAY[]::BIGINT[]);
  v_offset  NUMERIC;
  v_id      BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Oturum gerekli.' USING ERRCODE = '42501';
  END IF;

  -- İstemci çok uzun bir dışlama listesi yollayıp sorguyu şişirmesin
  IF cardinality(v_exclude) > 200 THEN
    v_exclude := v_exclude[1:200];
  END IF;

  FOR v_i IN 1..v_limit LOOP
    v_id := NULL;
    v_offset := ROUND((random() * 360.0)::numeric, 4);

    -- Rastgele sağ açıklıktan başlayıp sıradaki boşta yıldız (claim_random_available_star ile aynı sarmal arama)
    SELECT c.id INTO v_id
      FROM public.celestial_catalog AS c
     WHERE c.is_claimed = FALSE
       AND c.catalog_code NOT LIKE 'SOL-%'
       AND c.magnitude <= 6.5
       AND c.ra >= v_offset
       AND NOT (c.id = ANY (v_exclude))
     ORDER BY c.ra ASC
     LIMIT 1;

    IF v_id IS NULL THEN
      SELECT c.id INTO v_id
        FROM public.celestial_catalog AS c
       WHERE c.is_claimed = FALSE
         AND c.catalog_code NOT LIKE 'SOL-%'
         AND c.magnitude <= 6.5
         AND c.ra < v_offset
         AND NOT (c.id = ANY (v_exclude))
       ORDER BY c.ra ASC
       LIMIT 1;
    END IF;

    -- Dışlananlar dışında boşta yıldız kalmadı
    EXIT WHEN v_id IS NULL;

    v_exclude := v_exclude || v_id;
    RETURN QUERY
      SELECT c.id, c.catalog_code, c.ra, c."dec", c.magnitude, c.spectral_type, c.base_color, c.common_name
        FROM public.celestial_catalog AS c
       WHERE c.id = v_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.suggest_available_stars(INTEGER, BIGINT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_available_stars(INTEGER, BIGINT[]) TO authenticated;

COMMIT;
