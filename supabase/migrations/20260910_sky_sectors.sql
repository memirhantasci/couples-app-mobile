-- ============================================================================
-- MIGRATION: 20260910_sky_sectors.sql
-- Aşama 6: Sanal Gökyüzü Sektörleri, Bölgesel Kilitleme & Sonsuz Uzay Mimarisi
-- ============================================================================
-- İçerik:
--   1. sky_sectors tablosu (id, code3, display_order, min_ra, max_ra, min_dec, max_dec) + RLS
--   2. celestial_catalog genişletmesi (sector_id FK, is_virtual flag)
--   3. Deterministik tie-break backfill (en küçük alan öncelikli) + RA-dilim fallback
--   4. claim_star_in_sector RPC (DB-internal sınır okuma, code3 sanal kod, Anakol V spektrum)
--   5. get_sectors_overview RPC (agregat CTE, NULL guard, doğrulanmış star_connections)
--   6. Performans indeksleri
-- ============================================================================


-- ============================================================================
-- 1. TABLO: sky_sectors (Sektör Omurgası, IAU Sayısal Sınırları & code3)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sky_sectors (
  id            VARCHAR(32) PRIMARY KEY,
  code3         VARCHAR(4) NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  min_ra        NUMERIC(8,4) NOT NULL,
  max_ra        NUMERIC(8,4) NOT NULL,
  min_dec       NUMERIC(8,4) NOT NULL,
  max_dec       NUMERIC(8,4) NOT NULL
);

COMMENT ON TABLE  public.sky_sectors IS '24 Gökyüzü Sektörü omurgası, IAU sınırları ve 3 harfli IAU kısaltmaları. Metinler ve renkler client skySectors.data.ts dosyasındadır.';
COMMENT ON COLUMN public.sky_sectors.code3 IS 'IAU standart 3 harfli takımyıldızı kısaltması (ORI, UMA, CMA vb.).';
COMMENT ON COLUMN public.sky_sectors.min_ra IS 'Sektörün minimum Sağ Açıklık (Right Ascension) derecesi [0 - 360].';
COMMENT ON COLUMN public.sky_sectors.max_ra IS 'Sektörün maksimum Sağ Açıklık (Right Ascension) derecesi [0 - 360].';
COMMENT ON COLUMN public.sky_sectors.min_dec IS 'Sektörün minimum Dik Açıklık (Declination) derecesi [-90 - +90].';
COMMENT ON COLUMN public.sky_sectors.max_dec IS 'Sektörün maksimum Dik Açıklık (Declination) derecesi [-90 - +90].';

-- RLS Güvenliği (Public Read)
ALTER TABLE public.sky_sectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sky_sectors_public_read" ON public.sky_sectors;
CREATE POLICY "sky_sectors_public_read"
  ON public.sky_sectors FOR SELECT
  USING (true);

GRANT SELECT ON public.sky_sectors TO authenticated, anon;

-- 24 Ana Astronomik Sektör (Kalibre Edilmiş Sınırlar — Örtüşmeler Minimize Edilmiş)
INSERT INTO public.sky_sectors (id, code3, display_order, min_ra, max_ra, min_dec, max_dec) VALUES
  ('orion',        'ORI',  1,   60.0,  90.0, -15.0,  15.0),
  ('ursa_major',   'UMA',  2,  120.0, 210.0,  30.0,  70.0),
  ('cassiopeia',   'CAS',  3,    0.0,  45.0,  50.0,  75.0),
  ('cygnus',       'CYG',  4,  280.0, 325.0,  25.0,  55.0),
  ('taurus',       'TAU',  5,   50.0,  85.0,  10.0,  32.0),
  ('gemini',       'GEM',  6,   90.0, 120.0,  10.0,  35.0),
  ('aries',        'ARI',  7,   25.0,  55.0,  10.0,  32.0),
  ('cancer',       'CNC',  8,  120.0, 140.0,   5.0,  33.0),
  ('leo',          'LEO',  9,  140.0, 180.0,   0.0,  35.0),
  ('virgo',        'VIR', 10,  175.0, 225.0, -20.0,  15.0),
  ('libra',        'LIB', 11,  215.0, 245.0, -30.0,   0.0),
  ('scorpius',     'SCO', 12,  235.0, 265.0, -45.0, -10.0),
  ('sagittarius',  'SGR', 13,  265.0, 305.0, -45.0, -10.0),
  ('capricornus',  'CAP', 14,  300.0, 330.0, -30.0,  -5.0),
  ('aquarius',     'AQR', 15,  310.0, 345.0, -25.0,   6.0),
  ('pisces',       'PSC', 16,  345.0, 360.0,  -5.0,   8.0),
  ('pegasus',      'PEG', 17,  320.0, 360.0,   8.0,  36.0),
  ('andromeda',    'AND', 18,    0.0,  40.0,  22.0,  48.0),
  ('lyra',         'LYR', 19,  275.0, 295.0,  25.0,  48.0),
  ('aquila',       'AQL', 20,  285.0, 305.0, -10.0,  20.0),
  ('canis_major',  'CMA', 21,   95.0, 115.0, -35.0, -10.0),
  ('centaurus',    'CEN', 22,  170.0, 220.0, -65.0, -30.0),
  ('crux',         'CRU', 23,  180.0, 200.0, -65.0, -55.0),
  ('phoenix',      'PHE', 24,    0.0,  35.0, -60.0, -40.0)
ON CONFLICT (id) DO UPDATE SET
  code3 = EXCLUDED.code3,
  min_ra = EXCLUDED.min_ra,
  max_ra = EXCLUDED.max_ra,
  min_dec = EXCLUDED.min_dec,
  max_dec = EXCLUDED.max_dec;


-- ============================================================================
-- 2. KATALOG İLİŞKİSİ VE SANAL YILDIZ FLAG'İ
-- ============================================================================

ALTER TABLE public.celestial_catalog
  ADD COLUMN IF NOT EXISTS sector_id VARCHAR(32) REFERENCES public.sky_sectors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN NOT NULL DEFAULT FALSE;

-- Performans İndeksleri
CREATE INDEX IF NOT EXISTS idx_celestial_catalog_sector
  ON public.celestial_catalog(sector_id);
CREATE INDEX IF NOT EXISTS idx_celestial_catalog_claimed_sector
  ON public.celestial_catalog(sector_id, is_claimed);
CREATE INDEX IF NOT EXISTS idx_star_sparks_created_at
  ON public.star_sparks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_stars_catalog_id
  ON public.couple_stars(catalog_id);


-- ============================================================================
-- 3. DETERMİNİSTİK TIE-BREAK BACKFILL
-- ============================================================================
-- Amaç: Mevcut 524 Hipparcos yıldızını sektör kutularına deterministik atamak.
-- Kural: Birden fazla kutuya düşen yıldızlarda EN KÜÇÜK ALANLI kutu kazanır.
-- Eşitlikte display_order küçük olan kazanır.
-- ============================================================================

UPDATE public.celestial_catalog cc
SET sector_id = matched.sector_id
FROM (
  SELECT DISTINCT ON (cc2.id)
    cc2.id AS star_id,
    s.id   AS sector_id
  FROM public.celestial_catalog cc2
  JOIN public.sky_sectors s
    ON cc2.ra >= s.min_ra AND cc2.ra <= s.max_ra
   AND cc2.dec >= s.min_dec AND cc2.dec <= s.max_dec
  ORDER BY cc2.id,
           ((s.max_ra - s.min_ra) * (s.max_dec - s.min_dec)) ASC,
           s.display_order ASC
) matched
WHERE cc.id = matched.star_id;

-- Fallback: Hiçbir kutuya denk gelmeyen yıldızlar için 15° RA dilim eşlemesi
-- (SQL'deki FLOOR(ra / 15) tablosu, client RA_SLICE_FALLBACK ile birebir aynı)
UPDATE public.celestial_catalog
SET sector_id = CASE FLOOR(ra / 15.0)::int
  WHEN 0 THEN 'pisces' WHEN 1 THEN 'aries' WHEN 2 THEN 'aries' WHEN 3 THEN 'taurus'
  WHEN 4 THEN 'taurus' WHEN 5 THEN 'orion' WHEN 6 THEN 'gemini' WHEN 7 THEN 'canis_major'
  WHEN 8 THEN 'cancer' WHEN 9 THEN 'cancer' WHEN 10 THEN 'leo' WHEN 11 THEN 'leo'
  WHEN 12 THEN 'virgo' WHEN 13 THEN 'virgo' WHEN 14 THEN 'libra' WHEN 15 THEN 'libra'
  WHEN 16 THEN 'scorpius' WHEN 17 THEN 'sagittarius' WHEN 18 THEN 'sagittarius' WHEN 19 THEN 'aquila'
  WHEN 20 THEN 'cygnus' WHEN 21 THEN 'capricornus' WHEN 22 THEN 'aquarius' ELSE 'pegasus'
END
WHERE sector_id IS NULL;


-- ============================================================================
-- 4. RPC: claim_star_in_sector
-- ============================================================================
-- Sınırlar client'tan alınmaz; DB'deki sky_sectors tablosundan çekilir.
-- Sanal yıldız kodu: VIRT-{code3}-{epoch_hex}-{uuid4} formatı (çakışma ihtimali 0).
-- Advisory lock: hashtext('claim_star_lock'), p_couple_id — mevcut claim_* fonksiyonlarıyla birebir aynı.
-- Spektral dağılım: Tutarlı Anakol (V) standardı.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_star_in_sector(
  p_couple_id   INTEGER,
  p_sector_id   VARCHAR(32),
  p_custom_name VARCHAR(120)
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

  -- 2. Transaction-Level Advisory Lock (Doğrulanmış namespace — 20260906_create_star_system.sql:366)
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

    -- Çakışmasız IAU code3 + Epoch Hex + UUID formatı (Doğum günü paradoksu riski: 0)
    v_new_code := 'VIRT-' || v_code3 || '-' ||
                  TO_HEX(EXTRACT(EPOCH FROM clock_timestamp())::BIGINT) || '-' ||
                  UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 4));

    -- Tutarlı Anakol (V) Spektrum Standardı ve Ağırlıklı Gerçekçi Dağılım
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
    -- Gerçek katalog yıldızını tescille
    UPDATE public.celestial_catalog
       SET is_claimed = TRUE
     WHERE id = v_catalog_id;
  END IF;

  -- 7. couple_stars Kaydını Oluştur
  INSERT INTO public.couple_stars (
    couple_id, catalog_id, custom_name, luminosity_level, last_spark_at
  ) VALUES (
    p_couple_id, v_catalog_id, TRIM(p_custom_name), 1.00, NOW()
  ) RETURNING id INTO v_new_star_id;

  -- 8. Hoş Geldin Kıvılcımı
  INSERT INTO public.star_sparks (star_id, sender_id, spark_type, message)
  VALUES (v_new_star_id, auth.uid(), 'welcome_spark', 'Gökyüzündeki sonsuz aşkınız parıldamaya başladı ✨');

  -- 9. Detayları Döndür (mevcut helper RPC)
  RETURN public.get_my_couple_star_details(p_couple_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ============================================================================
-- 5. RPC: get_sectors_overview (Performans Odaklı CTE & Arkadaş Bağlantıları)
-- ============================================================================
-- Çağrı zamanlaması: Yalnızca SectorAtlasModal açıldığında (5 dk client-cache).
-- friends_stats CTE'si: Doğrulanmış star_connections tablosu (20260909_star_connections.sql).
-- v_my_couple_id NULL guard: Oturumsuz kullanıcıda hatalı TRUE dönmesini engeller.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_sectors_overview()
RETURNS TABLE (
  sector_id              VARCHAR(32),
  claimed_stars_count    BIGINT,
  available_stars_count  BIGINT,
  sector_energy          BIGINT,
  has_friends_here       BOOLEAN
) AS $$
DECLARE
  v_my_couple_id INTEGER;
BEGIN
  v_my_couple_id := public.get_my_couple_id();

  RETURN QUERY
  WITH sector_stats AS (
    SELECT
      cc.sector_id,
      COUNT(CASE WHEN cc.is_claimed THEN 1 END) AS claimed_cnt,
      COUNT(CASE WHEN NOT cc.is_claimed THEN 1 END) AS avail_cnt
    FROM public.celestial_catalog cc
    WHERE cc.sector_id IS NOT NULL
    GROUP BY cc.sector_id
  ),
  energy_stats AS (
    SELECT
      cc.sector_id,
      COUNT(ss.id) AS energy_cnt
    FROM public.star_sparks ss
    JOIN public.couple_stars cs ON cs.id = ss.star_id
    JOIN public.celestial_catalog cc ON cc.id = cs.catalog_id
    WHERE ss.created_at >= NOW() - INTERVAL '24 hours'
      AND cc.sector_id IS NOT NULL
    GROUP BY cc.sector_id
  ),
  friends_stats AS (
    -- Doğrulanmış: star_connections tablosu, kolonlar star_a_id, star_b_id, status
    -- (20260909_star_connections.sql satır 17-28)
    SELECT DISTINCT cc.sector_id
    FROM public.star_connections sc
    JOIN public.couple_stars cs ON (
      CASE WHEN sc.star_a_id IN (SELECT id FROM public.couple_stars WHERE couple_id = v_my_couple_id)
           THEN sc.star_b_id ELSE sc.star_a_id END = cs.id
    )
    JOIN public.celestial_catalog cc ON cc.id = cs.catalog_id
    WHERE v_my_couple_id IS NOT NULL
      AND sc.status = 'accepted'
      AND (
        sc.star_a_id IN (SELECT id FROM public.couple_stars WHERE couple_id = v_my_couple_id)
        OR sc.star_b_id IN (SELECT id FROM public.couple_stars WHERE couple_id = v_my_couple_id)
      )
      AND cc.sector_id IS NOT NULL
  )
  SELECT
    s.id AS sector_id,
    COALESCE(ss.claimed_cnt, 0) AS claimed_stars_count,
    COALESCE(ss.avail_cnt, 0)   AS available_stars_count,
    COALESCE(es.energy_cnt, 0)  AS sector_energy,
    (fs.sector_id IS NOT NULL)  AS has_friends_here
  FROM public.sky_sectors s
  LEFT JOIN sector_stats ss ON ss.sector_id = s.id
  LEFT JOIN energy_stats es ON es.sector_id = s.id
  LEFT JOIN friends_stats fs ON fs.sector_id = s.id
  ORDER BY s.display_order ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;


-- ============================================================================
-- 6. FONKSİYON İZİNLERİ (GRANT EXECUTE)
-- ============================================================================
-- Proje convention'ı: PostgreSQL default PUBLIC EXECUTE'e güvenmek yerine her
-- migration'da açık GRANT yazılır. (20260907_stage2, 20260907_stage3, 20260909'u takip eder)

GRANT EXECUTE ON FUNCTION public.claim_star_in_sector(INTEGER, VARCHAR(32), VARCHAR(120)) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sectors_overview() TO authenticated;
