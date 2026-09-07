-- ============================================================
-- MIGRATION: 20260907_stage3_exoplanet_crud.sql
-- Asama 3 - Gezegen CRUD + Otomatik Olusturma
-- ============================================================
-- Bu migration:
--   1. star_exoplanets tablosuna is_auto_generated ve window_started_at kolonlari ekler
--   2. Performans indeksleri olusturur
--   3. get_or_create_auto_exoplanet  - sahiplik kontrolu + NULL-guard duzeltildi
--   4. check_manual_exoplanet_limit  - sahiplik kontrolu eklendi (guvenlik acigi kapatildi)
--   5. append_media_to_exoplanet     - sahiplik kontrollü medya ekleme
--   6. append_letter_to_exoplanet    - sahiplik kontrollü mektup baglama
--   7. GRANT EXECUTE izinleri (Claude onerisinde eksikti)
-- ============================================================
-- DIKKAT: Bu migration calistirilmadan once Supabase Dashboard
-- Storage > "couple-memories" bucket'inin olusturulmus olmasi
-- gerekir. Bucket eksikse append_media_to_exoplanet calisimaz.
-- ============================================================


-- ------------------------------------------------------------
-- 1) Yeni kolonlar
-- ------------------------------------------------------------
ALTER TABLE public.star_exoplanets
  ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS window_started_at  TIMESTAMPTZ;

COMMENT ON COLUMN public.star_exoplanets.is_auto_generated
  IS 'TRUE ise get_or_create_auto_exoplanet tarafindan otomatik olusturuldu; FALSE ise kullanici elle olusturduu.';
COMMENT ON COLUMN public.star_exoplanets.window_started_at
  IS 'Otomatik gezegen penceresinin baslangic zamani. 45 gun gectikten sonra yeni pencere acilir.';


-- ------------------------------------------------------------
-- 2) Indeksler
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_star_exoplanets_manual
  ON public.star_exoplanets(star_id)
  WHERE is_auto_generated = FALSE;

CREATE INDEX IF NOT EXISTS idx_star_exoplanets_auto_window
  ON public.star_exoplanets(star_id, window_started_at)
  WHERE is_auto_generated = TRUE;


-- ------------------------------------------------------------
-- 3) get_or_create_auto_exoplanet
-- ------------------------------------------------------------
-- Belirtilen star_id icin:
--   a) Aktif (45 gunluk) otomatik pencerede gezegen varsa geri doner (idempotent)
--   b) Yoksa yeni otomatik gezegen olusturur ve UUID doner
--
-- Guvenlik duzeltmeleri (Claude onerisine gore):
--   * v_caller_couple_id NULL kontrolu ayri IF bloguna alindi
--     (auth.uid() NULL / eslesmeyen kullanici durumunu yakalar)
--   * v_star_couple_id NULL iken <> karsilastirmasi hatali sonuc
--     vermez cunku ilk NULL OR kosulunda yakalanir
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_auto_exoplanet(
  p_star_id UUID
) RETURNS UUID AS $$
DECLARE
  v_caller_couple_id  INTEGER;
  v_star_couple_id    INTEGER;
  v_existing_id       UUID;
  v_new_id            UUID;
  v_orbit_zones       INT[]  := ARRAY[1,2,3,4,5];
  v_planet_types      TEXT[] := ARRAY[
    'terrestrial','gas_giant','ice_world',
    'ocean_world','crystal','volcanic','desert','ringed_giant'
  ];
  v_auto_count        INTEGER;
  v_next_zone         INT;
BEGIN
  -- 1. Cagiran kullanici dogrulamasi
  -- get_my_couple_id() NULL donerse: oturum acilmamis veya cifte bagli degil
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erisim: Oturumunuz gecerli degil veya bir cifte bagli degilsiniz.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Yildiz sahiplik kontrolu
  SELECT couple_id INTO v_star_couple_id
    FROM public.couple_stars
   WHERE id = p_star_id;

  IF v_star_couple_id IS NULL OR v_caller_couple_id <> v_star_couple_id THEN
    RAISE EXCEPTION 'Yetkisiz erisim: Bu yildiz size ait degil.'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Aktif pencerede otomatik gezegen var mi? (idempotent)
  SELECT id INTO v_existing_id
    FROM public.star_exoplanets
   WHERE star_id           = p_star_id
     AND is_auto_generated = TRUE
     AND window_started_at > NOW() - INTERVAL '45 days'
   ORDER BY window_started_at DESC
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  -- 4. Kacinci otomatik gezegen? (dongüsel orbit_distance)
  SELECT COUNT(*) INTO v_auto_count
    FROM public.star_exoplanets
   WHERE star_id = p_star_id AND is_auto_generated = TRUE;

  -- PostgreSQL dizileri 1-tabanlidir: (% 5 + 1) -> [1..5], (% 8 + 1) -> [1..8]
  v_next_zone := v_orbit_zones[(v_auto_count % 5) + 1];

  -- 5. Yeni otomatik gezegen olustur
  -- milestone_date belirtilmedi -> NOT NULL DEFAULT CURRENT_DATE tetiklenir.
  INSERT INTO public.star_exoplanets (
    star_id,
    title,
    orbit_distance,
    orbit_speed,
    planet_type,
    palette,
    is_auto_generated,
    window_started_at
  ) VALUES (
    p_star_id,
    'Anilarimiz — ' || TO_CHAR(NOW(), 'DD.MM.YYYY'),
    v_next_zone,
    1.00,
    v_planet_types[(v_auto_count % 8) + 1],
    ARRAY['#4facfe', '#00f2fe'],
    TRUE,
    NOW()
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ------------------------------------------------------------
-- 4) check_manual_exoplanet_limit
-- ------------------------------------------------------------
-- Manuel gezegen sayisinin 10 limitini kontrol eder.
-- TRUE  -> limit asilmamis, yeni gezegen eklenebilir
-- FALSE -> limit asilmis
--
-- GUVENLIK DUZELTMESI: Claude onerisinde sahiplik kontrolu
-- yoktu; herhangi bir authenticated kullanici baskasinin
-- star_id'sini sorgulayabilirdi. Duzeltildi.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_manual_exoplanet_limit(
  p_star_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_caller_couple_id INTEGER;
  v_star_couple_id   INTEGER;
  v_count            INTEGER;
BEGIN
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erisim.'
      USING ERRCODE = '42501';
  END IF;

  SELECT couple_id INTO v_star_couple_id
    FROM public.couple_stars
   WHERE id = p_star_id;

  IF v_star_couple_id IS NULL OR v_caller_couple_id <> v_star_couple_id THEN
    RAISE EXCEPTION 'Yetkisiz erisim: Bu yildiz size ait degil.'
      USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.star_exoplanets
   WHERE star_id           = p_star_id
     AND is_auto_generated = FALSE;

  RETURN v_count < 10;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;


-- ------------------------------------------------------------
-- 5) append_media_to_exoplanet
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.append_media_to_exoplanet(
  p_planet_id UUID,
  p_media_url TEXT
) RETURNS VOID AS $$
DECLARE
  v_caller_couple_id INTEGER;
  v_owner_couple_id  INTEGER;
BEGIN
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erisim.'
      USING ERRCODE = '42501';
  END IF;

  SELECT cs.couple_id INTO v_owner_couple_id
    FROM public.star_exoplanets se
    JOIN public.couple_stars cs ON cs.id = se.star_id
   WHERE se.id = p_planet_id;

  IF v_owner_couple_id IS NULL OR v_owner_couple_id <> v_caller_couple_id THEN
    RAISE EXCEPTION 'Yetkisiz erisim: Bu gezegen size ait degil.'
      USING ERRCODE = '42501';
  END IF;

  IF p_media_url IS NULL OR TRIM(p_media_url) = '' THEN
    RAISE EXCEPTION 'Medya URL bos olamaz.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.star_exoplanets
     SET media_urls = array_append(COALESCE(media_urls, ARRAY[]::TEXT[]), TRIM(p_media_url)),
         updated_at = NOW()
   WHERE id = p_planet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ------------------------------------------------------------
-- 6) append_letter_to_exoplanet
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.append_letter_to_exoplanet(
  p_planet_id UUID,
  p_letter_id UUID
) RETURNS VOID AS $$
DECLARE
  v_caller_couple_id INTEGER;
  v_owner_couple_id  INTEGER;
BEGIN
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erisim.'
      USING ERRCODE = '42501';
  END IF;

  SELECT cs.couple_id INTO v_owner_couple_id
    FROM public.star_exoplanets se
    JOIN public.couple_stars cs ON cs.id = se.star_id
   WHERE se.id = p_planet_id;

  IF v_owner_couple_id IS NULL OR v_owner_couple_id <> v_caller_couple_id THEN
    RAISE EXCEPTION 'Yetkisiz erisim: Bu gezegen size ait degil.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.star_exoplanets
     SET custom_metadata = jsonb_set(
           COALESCE(custom_metadata, '{}'::jsonb),
           '{linked_letter_ids}',
           (
             COALESCE(custom_metadata -> 'linked_letter_ids', '[]'::jsonb)
             || to_jsonb(p_letter_id::TEXT)
           ),
           true
         ),
         updated_at = NOW()
   WHERE id = p_planet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ------------------------------------------------------------
-- 7) GRANT EXECUTE izinleri
-- Claude onerisinde bu bolum tamamen eksikti.
-- SECURITY DEFINER fonksiyonlar GRANT olmadan cagirilamaz.
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_or_create_auto_exoplanet(UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_manual_exoplanet_limit(UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_media_to_exoplanet(UUID, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.append_letter_to_exoplanet(UUID, UUID) TO authenticated;


-- ------------------------------------------------------------
-- Not: star_exoplanets RLS politikalari (select/insert/update/delete)
-- 20260906_create_star_system.sql'de tanimlanmis; is_auto_generated
-- ayrimi yapilmiyor - bu kasitli. Otomatik gezegenler de cift
-- tarafindan silinebilir/duzenlenebilir olmali. Ek degisiklik yok.
-- ------------------------------------------------------------
