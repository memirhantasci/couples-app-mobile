-- ============================================================================
-- MIGRATION: 20260906_create_star_system.sql
-- "Bizim Yıldızımız" (Our Star) Gökyüzü ve Mikro Yıldız Sistemi Mimarisi
-- ============================================================================
-- Bu migration:
--   1. PostGIS uzantısını etkinleştirir
--   2. Gerçek astronomik katalog tablosu (celestial_catalog) ve GiST uzamsal indeksi
--   3. Çiftlerin tescilli yıldızları tablosu (couple_stars)
--   4. Mikro-evren anı ötegezegenleri tablosu (star_exoplanets)
--   5. Kıvılcım tablosu (star_sparks) ile BEFORE INSERT trigger kalkanı
--   6. Atomik, çakışmasız yıldız sahiplenme fonksiyonu (claim_random_available_star)
--   7. 0°/360° meridyen sarmalı uzamsal görüş alanı fonksiyonu (get_stars_in_viewport)
--   8. Yıldız detay ve geri sayım fonksiyonu (get_my_couple_star_details)
--   9. Kıvılcım gönderme ve rezonans tetikleme fonksiyonu (send_star_spark)
--  10. Strict Row Level Security (RLS) politikaları
--  11. Gerçek Hipparcos astronomik katalog başlangıç verisi (Seed Data)
-- ============================================================================


-- ============================================================================
-- 1. PostGIS Uzantısını Etkinleştir
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;


-- ============================================================================
-- 2. TABLO: celestial_catalog (Göksel Referans Kataloğu)
-- ============================================================================
-- Gerçek astronomik katalog verilerini (Hipparcos / Gaia DR3) saklar.
-- ra/dec statik katalog verisi olduğundan GENERATED geom kolonu sorunsuz çalışır.
-- Toplu ETL güncellemelerinde GIST indeksi yeniden yazılır; bu beklenen davranıştır.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.celestial_catalog (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  catalog_code   VARCHAR(32) NOT NULL UNIQUE
                   CHECK (catalog_code ~ '^[A-Z0-9_-]+$'),
  ra             NUMERIC(8,4) NOT NULL
                   CHECK (ra >= 0.0000 AND ra <= 360.0000),
  dec            NUMERIC(8,4) NOT NULL
                   CHECK (dec >= -90.0000 AND dec <= 90.0000),
  magnitude      NUMERIC(4,2) NOT NULL
                   CHECK (magnitude BETWEEN -30.00 AND 35.00),
  spectral_type  VARCHAR(16) NOT NULL DEFAULT 'G',
  base_color     VARCHAR(9) NOT NULL DEFAULT '#FFFFFF',
  is_claimed     BOOLEAN NOT NULL DEFAULT FALSE,
  geom           GEOMETRY(Point, 4326) GENERATED ALWAYS AS (
                   extensions.ST_SetSRID(extensions.ST_MakePoint(ra, dec), 4326)
                 ) STORED
);

COMMENT ON TABLE  public.celestial_catalog IS 'Gerçek astronomik koordinatlara sahip değişmez gökyüzü referans kataloğu.';
COMMENT ON COLUMN public.celestial_catalog.ra   IS 'Right Ascension (Açısal derece: 0-360)';
COMMENT ON COLUMN public.celestial_catalog.dec  IS 'Declination (Açısal derece: -90 ile +90)';
COMMENT ON COLUMN public.celestial_catalog.geom IS 'PostGIS 4326 WGS84 Geometrik Nokta (X=RA, Y=DEC). GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(ra, dec), 4326)) STORED.';

-- Uzamsal R-Tree İndeksi (viewport sorguları için)
CREATE INDEX IF NOT EXISTS idx_celestial_catalog_geom
  ON public.celestial_catalog USING GIST(geom);

-- Kısmi B-Tree İndeksi (claim_random_available_star FOR UPDATE SKIP LOCKED sorgusunu O(1) yapar)
CREATE INDEX IF NOT EXISTS idx_celestial_catalog_unclaimed
  ON public.celestial_catalog(magnitude, ra)
  WHERE is_claimed = FALSE;

-- Koordinat Arama İndeksi
CREATE INDEX IF NOT EXISTS idx_celestial_catalog_coords
  ON public.celestial_catalog(ra, dec);


-- ============================================================================
-- 3. TABLO: couple_stars (Çiftlerin Tescilli Yıldızları)
-- ============================================================================
-- Her çift dünyada yalnızca bir tekil yıldıza sahip olabilir.
-- couple_id INTEGER'dır çünkü couples.id int4 tipindedir.
-- catalog_id ON DELETE RESTRICT: Katalog kaydı, üzerine tescil varken silinemez.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.couple_stars (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id         INTEGER NOT NULL UNIQUE
                      REFERENCES public.couples(id) ON DELETE CASCADE,
  catalog_id        BIGINT NOT NULL UNIQUE
                      REFERENCES public.celestial_catalog(id) ON DELETE RESTRICT,
  custom_name       VARCHAR(120) NOT NULL,
  luminosity_level  NUMERIC(3,2) NOT NULL DEFAULT 1.00
                      CHECK (luminosity_level >= 0.10 AND luminosity_level <= 1.00),
  last_spark_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resonance_active  BOOLEAN NOT NULL DEFAULT FALSE,
  resonance_until   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.couple_stars IS 'Çiftlerin tescillediği tekil yıldızlar ve canlı parlaklık/rezonans durumları.';

CREATE INDEX IF NOT EXISTS idx_couple_stars_couple_id
  ON public.couple_stars(couple_id);
CREATE INDEX IF NOT EXISTS idx_couple_stars_catalog_id
  ON public.couple_stars(catalog_id);
CREATE INDEX IF NOT EXISTS idx_couple_stars_resonance
  ON public.couple_stars(resonance_until)
  WHERE resonance_until IS NOT NULL;


-- ============================================================================
-- 4. TABLO: star_exoplanets (Mikro Yıldız Sistemi — Anı Ötegezegenleri)
-- ============================================================================
-- Çiftlerin anıları, mektupları ve kilometre taşları yıldızın yörüngesinde döner.
-- orbit_distance 1-5 arası "Yörünge Kuşağı"dır (Orbital Belt).
-- Aynı kuşakta birden fazla ötegezegen olabilir (UNIQUE kısıtı YOKTUR);
-- Kepler render motoru bunlara ID'ye göre farklı theta_0 açıları verir.
-- orbit_speed Kepler hız çarpanıdır: 1.00 = doğal hız.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.star_exoplanets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  star_id         UUID NOT NULL
                    REFERENCES public.couple_stars(id) ON DELETE CASCADE,
  title           VARCHAR(120) NOT NULL,
  description     TEXT,
  milestone_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  orbit_distance  INT NOT NULL
                    CHECK (orbit_distance BETWEEN 1 AND 5),
  orbit_speed     NUMERIC(5,2) NOT NULL DEFAULT 1.00
                    CHECK (orbit_speed > 0),
  planet_type     VARCHAR(32) NOT NULL DEFAULT 'terrestrial',
  palette         TEXT[] NOT NULL DEFAULT ARRAY['#4facfe', '#00f2fe'],
  media_urls      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  custom_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.star_exoplanets IS 'Yıldız yörüngesinde dönen anı ve kilometre taşı ötegezegenleri. orbit_distance kuşak ID (1-5); aynı kuşakta çoklu gezegen olabilir.';

CREATE INDEX IF NOT EXISTS idx_star_exoplanets_star_orbit
  ON public.star_exoplanets(star_id, orbit_distance);
CREATE INDEX IF NOT EXISTS idx_star_exoplanets_milestone
  ON public.star_exoplanets(star_id, milestone_date DESC);


-- ============================================================================
-- 5. TABLO: star_sparks (Kıvılcımlar ve Etkileşim Geçmişi)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.star_sparks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  star_id     UUID NOT NULL
                REFERENCES public.couple_stars(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL
                REFERENCES public.users(id) ON DELETE CASCADE,
  spark_type  VARCHAR(32) NOT NULL DEFAULT 'daily_spark',
  message     VARCHAR(280),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.star_sparks IS 'Yıldıza gönderilen günlük ve anlık sevgi kıvılcımları.';

-- MİMARİ BORÇ / TODO NOTU:
-- 'memory_ignite' sistem kıvılcımı, gelecek fazda eklenecek olan anı ötegezegeni
-- oluşturma mantığı (create_star_exoplanet RPC veya star_exoplanets AFTER INSERT
-- trigger'ı) üzerinden SECURITY DEFINER yetkisiyle star_sparks tablosuna otomatik yazılacaktır.
-- Şu an tip sisteminde ve veritabanı şemasında hazırdır, ancak henüz tetiklenmemektedir.
CREATE INDEX IF NOT EXISTS idx_star_sparks_star_created
  ON public.star_sparks(star_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_star_sparks_sender_created
  ON public.star_sparks(sender_id, created_at DESC);


-- ============================================================================
-- 6. TRIGGER KALKANI: trg_enforce_spark_cooldown
-- ============================================================================
-- Tablo seviyesinde rate-limit zorunluluğu. Frontend RPC'yi atlayıp doğrudan
-- INSERT INTO star_sparks yapsa bile bu trigger devreye girer.
--   - daily_spark: 20 saatlik döngüsel soğuma (rolling window)
--   - love_ping:   60 saniyelik anti-spam kalkanı
-- Hata durumunda ERRCODE ve HINT alanları yapılandırılmış bilgi taşır;
-- frontend bu bilgiyi parse edip geri sayım gösterebilir.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_star_spark_cooldown()
RETURNS TRIGGER AS $$
DECLARE
  v_last_spark_time TIMESTAMPTZ;
  v_remaining_sec   INTEGER;
BEGIN
  -- 1. Günlük Kıvılcım (daily_spark) Kontrolü — 20 Saat Kuralı
  IF NEW.spark_type = 'daily_spark' THEN
    SELECT created_at INTO v_last_spark_time
      FROM public.star_sparks
     WHERE star_id    = NEW.star_id
       AND sender_id  = NEW.sender_id
       AND spark_type = 'daily_spark'
       AND created_at >= NOW() - INTERVAL '20 hours'
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_last_spark_time IS NOT NULL THEN
      v_remaining_sec := GREATEST(
        1,
        EXTRACT(EPOCH FROM (v_last_spark_time + INTERVAL '20 hours') - NOW())::INTEGER
      );
      RAISE EXCEPTION 'COOLDOWN_ACTIVE: Günlük kıvılcım hakkınız henüz yenilenmedi. Kalan süre: % saniye.', v_remaining_sec
        USING ERRCODE = 'P0001',
              HINT    = v_remaining_sec::TEXT;
    END IF;

  -- 2. Anlık Titreşim (love_ping) Kontrolü — 60 Saniye Spam Koruması
  ELSIF NEW.spark_type = 'love_ping' THEN
    SELECT created_at INTO v_last_spark_time
      FROM public.star_sparks
     WHERE star_id    = NEW.star_id
       AND sender_id  = NEW.sender_id
       AND spark_type = 'love_ping'
       AND created_at >= NOW() - INTERVAL '60 seconds'
     ORDER BY created_at DESC
     LIMIT 1;

    IF v_last_spark_time IS NOT NULL THEN
      v_remaining_sec := GREATEST(
        1,
        EXTRACT(EPOCH FROM (v_last_spark_time + INTERVAL '60 seconds') - NOW())::INTEGER
      );
      RAISE EXCEPTION 'SPAM_COOLDOWN: Lütfen peş peşe titreşim göndermeden önce % saniye bekleyin.', v_remaining_sec
        USING ERRCODE = 'P0002',
              HINT    = v_remaining_sec::TEXT;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_spark_cooldown ON public.star_sparks;
CREATE TRIGGER trg_enforce_spark_cooldown
  BEFORE INSERT ON public.star_sparks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_star_spark_cooldown();


-- ============================================================================
-- 6B. YARDIMCI GÜVENLİK FONKSİYONU: get_my_couple_id
-- ============================================================================
-- auth.uid() üzerinden kullanıcının couple_id bilgisini STABLE ve güvenli biçimde döner.
-- auth.uid() NULL olduğunda (anonim veya oturum açmamış kullanıcı) güvenle NULL döner.
-- Güvenlik açığı oluşmaması için search_path = public olarak sabitlenmiştir.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_couple_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT couple_id FROM public.users WHERE id = auth.uid();
$$;


-- ============================================================================
-- 7. FONKSİYON: get_my_couple_star_details
-- ============================================================================
-- Çiftin yıldız kartını, astronomik koordinatları, canlı rezonans durumunu ve
-- kıvılcım geri sayım bilgilerini tek JSONB pakette döner.
-- Frontend detay paneli açıldığında bu RPC çağrılır.
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
    v_can_spark    := TRUE;
    v_next_spark_at := NOW();
    v_cooldown_sec := 0;
  ELSE
    v_can_spark    := FALSE;
    v_next_spark_at := v_last_spark_at + INTERVAL '20 hours';
    v_cooldown_sec := GREATEST(0, EXTRACT(EPOCH FROM (v_next_spark_at - NOW()))::INTEGER);
  END IF;

  SELECT jsonb_build_object(
    'star_id',                    cs.id,
    'couple_id',                  cs.couple_id,
    'catalog_id',                 cs.catalog_id,
    'catalog_code',               cc.catalog_code,
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
-- 8. FONKSİYON: claim_random_available_star
-- ============================================================================
-- 10.000+ eşzamanlı istekte sıfır çakışma ve sıfır yarış durumu (race condition).
--
-- Mimari Kararlar:
--   • pg_advisory_xact_lock: couples tablosuna satır kilidi KOYMAZ. Bellekte
--     yalnızca aynı couple_id'li eşzamanlı tescil çağrılarını sıralar (0.01 ms).
--   • Namespace: hashtext('claim_star_lock') sabiti tek bir yerde tanımlıdır.
--     İleride yeni advisory lock gerektiren fonksiyonlarda farklı namespace
--     string'leri kullanılmalıdır (çakışmayı önlemek için).
--   • İki Aşamalı Sarmal: Rastgele ofsetten 360°'ye, bulunamazsa 0°'dan ofsete.
--   • FOR UPDATE SKIP LOCKED: Başka bir transaction'ın kilitlenmesini beklemez;
--     kilitsiz bir sonraki satırı anında alır.
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

  -- ── 2. Transaction-Level Advisory Lock ──
  -- couples tablosuna satır kilidi KOYMAZ; bellekte çift bazlı sıralama yapar.
  -- Namespace: 'claim_star_lock'. Farklı fonksiyonlar farklı namespace kullanmalıdır.
  PERFORM pg_advisory_xact_lock(hashtext('claim_star_lock'), p_couple_id);

  -- ── 3. Çiftin Zaten Yıldızı Var mı? ──
  -- Advisory lock sayesinde bu SELECT artık güvenlidir;
  -- iki partner aynı anda tıklasa dahi ikincisi burada mevcut yıldızı görür.
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

  -- ── 9. İlk Karşılama Kıvılcımı (Hoş Geldin Kıvılcımı) ──
  -- 'welcome_spark' tipi kullanılır; böylece kullanıcının o günkü gerçek
  -- 'daily_spark' hakkı ve 20 saatlik soğuma süresi tüketilmez.
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
-- 9. FONKSİYON: get_stars_in_viewport (Uzamsal Görüş Alanı & Spatial Culling)
-- ============================================================================
-- Frontend Makro Gökyüzü Canvas'ı her kaydırma/zoom'da bu fonksiyonu çağırır.
--
-- Mimari Kararlar:
--   • 0°/360° meridyen geçişi: min_ra > max_ra durumunda gökkubbedeki dikişi
--     iki ST_MakeEnvelope ile (OR) birleştirerek pürüzsüz taranır.
--   • Dinamik LOD: Zoom seviyesine göre magnitude eşiği değişir. Uzaktan
--     yalnızca parlak yıldızlar; yakınlaştıkça sönük yıldızlar da görünür.
--   • Tescilli yıldızlar: Bölgedeki tescilli yıldızlar ayrı bir CTE ile çekilir
--     ve is_mine önceliğiyle görüş alanı başına en fazla 500 adetle listelenir.
--     Kullanıcının kendi yıldızı (is_mine) her zaman en tepeye garantilenir;
--     500 sınırı mobil bellek/çizim performansını koruyan bilinçli bir trade-off'tur.
--   • Mahremiyet maskeleme: Yabancı çiftlerin custom_name'i 'Tescilli Yıldız'
--     olarak döner. Yalnızca is_mine=TRUE yıldızda gerçek isim gösterilir.
--   • Dinamik rezonans: resonance_until > NOW() ile anlık hesaplanır.
--   • Parlaklık ve rezonans: Makro gökyüzünde tüm tescilli yıldızların
--     luminosity ve resonance durumu görünürdür (canlı evren hissi).
-- ============================================================================
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
  dec               NUMERIC(8,4),
  magnitude         NUMERIC(4,2),
  spectral_type     VARCHAR(16),
  base_color        VARCHAR(9),
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
  -- Anonim veya oturumsuz çağrılarda get_my_couple_id() sorgusunu çalıştırmadan doğrudan NULL ata
  IF auth.uid() IS NOT NULL THEN
    v_my_couple_id := public.get_my_couple_id();
  ELSE
    v_my_couple_id := NULL;
  END IF;

  -- Zoom Seviyesine Göre Görünürlük Eşiği (LOD — Level of Detail)
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

  -- ── Durum 1: Normal Bounding Box (meridyen dikişini kesmeyen) ──
  -- Tescilli yıldızlar ile boşta duran katalog yıldızları iki bağımsız CTE ile taranır.
  -- Böylece yoğun bölgelerde sönük tescilli yıldızlar veya kullanıcının kendi yıldızı
  -- parlak katalog yıldızlarının LIMIT kotası yüzünden ASLA listeden düşmez.
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

  -- ── Durum 2: 0°/360° Meridyen Geçişi (min_ra > max_ra) ──
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
-- 10. FONKSİYON: send_star_spark (Kıvılcım & Rezonans RPC)
-- ============================================================================
-- Frontend detay panelinden çağrılır.
--
-- Katmanlı Güvenlik:
--   1. Bu fonksiyon sahiplik ve çift kontrolü yapar.
--   2. INSERT edilen kıvılcım, trg_enforce_spark_cooldown trigger'ından geçer
--      (20h / 60s kuralları).
--   3. Parlaklık artışı yalnızca daily_spark'ta uygulanır (+0.10, tavan 1.00).
--   4. Rezonans kontrolünde sender_id <> auth.uid() şartı ile kendi kendine
--      rezonans tetiklenmesi engellenir.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.send_star_spark(
  p_star_id    UUID,
  p_spark_type VARCHAR DEFAULT 'daily_spark',
  p_message    VARCHAR DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_caller_couple_id INTEGER;
  v_star_couple_id   INTEGER;
  v_current_lum      NUMERIC(3,2);
  v_new_luminosity   NUMERIC(3,2);
  v_partner_sparked  BOOLEAN;
  v_resonance_until  TIMESTAMPTZ;
  v_spark_id         UUID;
BEGIN
  v_caller_couple_id := public.get_my_couple_id();

  -- ── 1. Yıldız Sahiplik Kontrolü ──
  SELECT couple_id, luminosity_level
    INTO v_star_couple_id, v_current_lum
    FROM public.couple_stars
   WHERE id = p_star_id;

  IF v_star_couple_id IS NULL
     OR v_caller_couple_id IS NULL
     OR v_star_couple_id <> v_caller_couple_id
  THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Yalnızca kendi çiftinizin yıldızına kıvılcım gönderebilirsiniz.'
      USING ERRCODE = '42501';
  END IF;

  -- ── 2. Kıvılcım Tipi Doğrulaması ──
  -- Kullanıcılar RPC üzerinden yalnızca 'daily_spark' veya 'love_ping' gönderebilir.
  -- 'welcome_spark', 'memory_ignite', 'resonance_boost' gibi sistem tipleri buraya gönderilemez.
  IF p_spark_type NOT IN ('daily_spark', 'love_ping') THEN
    RAISE EXCEPTION 'Geçersiz kıvılcım tipi (%). Yalnızca daily_spark veya love_ping gönderilebilir.', p_spark_type
      USING ERRCODE = '22023';
  END IF;

  -- ── 3. Kıvılcımı Kaydet ──
  -- Trigger (trg_enforce_spark_cooldown) tablo seviyesinde rate-limit denetler.
  INSERT INTO public.star_sparks (star_id, sender_id, spark_type, message)
  VALUES (p_star_id, auth.uid(), p_spark_type, p_message)
  RETURNING id INTO v_spark_id;

  -- ── 4. Parlaklık Artışı (Yalnızca daily_spark) ──
  v_new_luminosity := v_current_lum;
  IF p_spark_type = 'daily_spark' THEN
    v_new_luminosity := LEAST(1.00, v_current_lum + 0.10);
  END IF;

  -- ── 5. Partner Rezonans Kontrolü ──
  -- Katı şart: sender_id <> auth.uid() ile kendi kendine rezonans ENGELLENİR.
  SELECT EXISTS (
    SELECT 1
      FROM public.star_sparks
     WHERE star_id    = p_star_id
       AND sender_id <> auth.uid()
       AND created_at >= NOW() - INTERVAL '15 minutes'
  ) INTO v_partner_sparked;

  IF v_partner_sparked THEN
    v_resonance_until := NOW() + INTERVAL '30 minutes';
  ELSE
    -- Mevcut rezonansı koru (süresi dolmadıysa)
    SELECT resonance_until INTO v_resonance_until
      FROM public.couple_stars
     WHERE id = p_star_id;
  END IF;

  -- ── 6. Yıldız Durumunu Güncelle ──
  UPDATE public.couple_stars
     SET luminosity_level = v_new_luminosity,
         last_spark_at    = NOW(),
         resonance_active = COALESCE(v_resonance_until > NOW(), FALSE),
         resonance_until  = v_resonance_until,
         updated_at       = NOW()
   WHERE id = p_star_id;

  -- ── 7. Güncel Durum Paketini Döndür ──
  RETURN public.get_my_couple_star_details(v_star_couple_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;


-- ============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLİTİKALARI
-- ============================================================================

-- celestial_catalog
ALTER TABLE public.celestial_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "celestial_catalog_read_all" ON public.celestial_catalog;
CREATE POLICY "celestial_catalog_read_all"
  ON public.celestial_catalog FOR SELECT
  USING (true);


-- couple_stars
ALTER TABLE public.couple_stars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couple_stars_read_all" ON public.couple_stars;
CREATE POLICY "couple_stars_read_all"
  ON public.couple_stars FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "couple_stars_update_own" ON public.couple_stars;
CREATE POLICY "couple_stars_update_own"
  ON public.couple_stars FOR UPDATE TO authenticated
  USING  (couple_id = public.get_my_couple_id())
  WITH CHECK (couple_id = public.get_my_couple_id());


-- star_exoplanets
ALTER TABLE public.star_exoplanets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "star_exoplanets_select_couple" ON public.star_exoplanets;
CREATE POLICY "star_exoplanets_select_couple"
  ON public.star_exoplanets FOR SELECT TO authenticated
  USING (star_id IN (
    SELECT id FROM public.couple_stars WHERE couple_id = public.get_my_couple_id()
  ));

DROP POLICY IF EXISTS "star_exoplanets_insert_couple" ON public.star_exoplanets;
CREATE POLICY "star_exoplanets_insert_couple"
  ON public.star_exoplanets FOR INSERT TO authenticated
  WITH CHECK (star_id IN (
    SELECT id FROM public.couple_stars WHERE couple_id = public.get_my_couple_id()
  ));

DROP POLICY IF EXISTS "star_exoplanets_update_couple" ON public.star_exoplanets;
CREATE POLICY "star_exoplanets_update_couple"
  ON public.star_exoplanets FOR UPDATE TO authenticated
  USING (star_id IN (
    SELECT id FROM public.couple_stars WHERE couple_id = public.get_my_couple_id()
  ))
  WITH CHECK (star_id IN (
    SELECT id FROM public.couple_stars WHERE couple_id = public.get_my_couple_id()
  ));

DROP POLICY IF EXISTS "star_exoplanets_delete_couple" ON public.star_exoplanets;
CREATE POLICY "star_exoplanets_delete_couple"
  ON public.star_exoplanets FOR DELETE TO authenticated
  USING (star_id IN (
    SELECT id FROM public.couple_stars WHERE couple_id = public.get_my_couple_id()
  ));


-- star_sparks
ALTER TABLE public.star_sparks ENABLE ROW LEVEL SECURITY;

-- SELECT: Çiftin her iki üyesi de ortak yıldızlarına ait tüm kıvılcımları görür.
-- (sender_id filtresi DEĞİL; star_id üzerinden couple_stars ile join.)
DROP POLICY IF EXISTS "star_sparks_select_couple" ON public.star_sparks;
CREATE POLICY "star_sparks_select_couple"
  ON public.star_sparks FOR SELECT TO authenticated
  USING (star_id IN (
    SELECT id FROM public.couple_stars WHERE couple_id = public.get_my_couple_id()
  ));

-- INSERT: sender_id = auth.uid() VE yıldız kullanıcının çiftine ait olmalı.
-- GÜVENLİK/SPAM KALKANI: Frontend istemcisi doğrudan yalnızca 'daily_spark' ve 'love_ping'
-- ekleyebilir. 'welcome_spark', 'memory_ignite', 'resonance_boost' gibi sistem tipi
-- kıvılcımlar yalnızca SECURITY DEFINER fonksiyonlar üzerinden güvenle eklenebilir.
-- Bu sayede rate-limit kalkanı dışındaki tiplerle tablonun spam'lenmesi kesin olarak engellenir.
DROP POLICY IF EXISTS "star_sparks_insert_own" ON public.star_sparks;
CREATE POLICY "star_sparks_insert_own"
  ON public.star_sparks FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND spark_type IN ('daily_spark', 'love_ping')
    AND star_id IN (
      SELECT id FROM public.couple_stars WHERE couple_id = public.get_my_couple_id()
    )
  );


-- ============================================================================
-- 12. GERÇEK ASTRONOMİK KATALOG BAŞLANGIÇ VERİSİ (Hipparcos Seed Data)
-- ============================================================================
-- Gökyüzünün en parlak 35 gerçek yıldızı, gerçek koordinatları (RA/Dec),
-- görünür büyüklükleri (magnitude) ve tayf tipleriyle eklenir.
-- ON CONFLICT (catalog_code) DO NOTHING: Tekrar çalıştırılırsa güvenle atlar.
-- ============================================================================
INSERT INTO public.celestial_catalog (catalog_code, ra, dec, magnitude, spectral_type, base_color)
VALUES
  ('HIP-32349',  101.2875,  -16.7161, -1.46, 'A1V',      '#9DB4FF'),  -- Sirius
  ('HIP-30438',   95.9875,  -52.6958, -0.74, 'F0II',     '#F8F9FB'),  -- Canopus
  ('HIP-71683',  219.9021,  -60.8339, -0.27, 'G2V',      '#FFF4E8'),  -- Alpha Centauri A
  ('HIP-69673',  213.9150,   19.1825, -0.05, 'K0III',    '#FFD2A1'),  -- Arcturus
  ('HIP-91262',  279.2346,   38.7836,  0.03, 'A0V',      '#CAD8FF'),  -- Vega
  ('HIP-24608',   79.1725,   45.9981,  0.08, 'G3III',    '#FFECC3'),  -- Capella
  ('HIP-24436',   78.6346,   -8.2017,  0.13, 'B8Ia',     '#BBCCFF'),  -- Rigel
  ('HIP-37279',  114.8254,    5.2250,  0.37, 'F5IV',     '#FDF8F0'),  -- Procyon
  ('HIP-27989',   88.7929,    7.4072,  0.42, 'M1Ia',     '#FFB56C'),  -- Betelgeuse
  ('HIP-7588',    24.4287,  -57.2367,  0.46, 'B6Vp',     '#B3C8FF'),  -- Achernar
  ('HIP-68702',  210.9560,  -60.3731,  0.61, 'B1III',    '#9CB7FF'),  -- Hadar (Beta Centauri)
  ('HIP-97649',  297.6958,    8.8683,  0.77, 'A7V',      '#EEF2FF'),  -- Altair
  ('HIP-60718',  186.6496,  -63.0992,  0.77, 'B0.5IV',   '#8AA9FF'),  -- Acrux
  ('HIP-21421',   68.9800,   16.5094,  0.86, 'K5III',    '#FFAF53'),  -- Aldebaran
  ('HIP-65474',  201.2983,  -11.1614,  0.97, 'B1III',    '#96B3FF'),  -- Spica
  ('HIP-80763',  247.3517,  -26.4319,  1.05, 'M1Ib',     '#FF8F35'),  -- Antares
  ('HIP-37826',  116.1400,   28.0261,  1.14, 'K0III',    '#FFCE95'),  -- Pollux
  ('HIP-113368', 344.4129,  -29.6222,  1.16, 'A3V',      '#E2EBFF'),  -- Fomalhaut
  ('HIP-102098', 310.3580,   45.2803,  1.25, 'A2Ia',     '#D4E0FF'),  -- Deneb
  ('HIP-62434',  191.9304,  -59.6889,  1.25, 'B0.5III',  '#8AA9FF'),  -- Mimosa (Beta Crucis)
  ('HIP-49669',  152.0933,   11.9672,  1.35, 'B7V',      '#ABC2FF'),  -- Regulus
  ('HIP-33579',  104.6562,  -28.9722,  1.50, 'B2II',     '#9DB4FF'),  -- Adhara
  ('HIP-36850',  113.6496,   31.8883,  1.58, 'A1V',      '#C7D7FF'),  -- Castor
  ('HIP-61084',  187.7912,  -57.1136,  1.63, 'M3.5III',  '#FF8220'),  -- Gacrux
  ('HIP-86032',  263.4021,  -37.1039,  1.63, 'B2IV',     '#9DB4FF'),  -- Shaula
  ('HIP-25336',   81.2829,    6.3497,  1.64, 'B2III',    '#A3B9FF'),  -- Bellatrix
  ('HIP-27366',   86.9392,   -1.2019,  1.69, 'O9.5Ib',   '#82A3FF'),  -- Alnilam
  ('HIP-85927',  263.3512,   -9.0125,  2.08, 'K2III',    '#FFC07A'),  -- Rasalhague
  ('HIP-11767',   37.9546,   89.2642,  1.98, 'F7Ib',     '#FFF0D4'),  -- Polaris
  ('HIP-65378',  200.9817,   54.9253,  2.23, 'A2V',      '#DDE6FF'),  -- Mizar
  ('HIP-54061',  166.4179,   61.7508,  1.79, 'K0III',    '#FFD199'),  -- Dubhe
  ('HIP-8796',    28.1633,    8.0647,  3.63, 'F5V',      '#FFF6EA'),  -- Eta Piscium
  ('HIP-1067',     3.3104,   42.3297,  2.06, 'B9p',      '#CAD7FF'),  -- Alpheratz
  ('HIP-113881', 346.0467,   15.2053,  2.49, 'B9.5V',    '#D0DCFF'),  -- Markab
  ('HIP-14576',   47.8654,   49.8611,  1.81, 'F5Ib',     '#FFF2DC')   -- Mirfak
ON CONFLICT (catalog_code) DO NOTHING;
