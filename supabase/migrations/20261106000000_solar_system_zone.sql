-- ============================================================================
-- MIGRATION: 20261106000000_solar_system_zone.sql
-- Güneş sistemi bölgesindeki yıldızlar önerilmez, verilmez, oraya sanal yıldız doğmaz
-- ============================================================================
-- Gök haritası Güneş Sistemi'ni (orrery) RA 270°, Dec -8° çevresinde yerel olarak çizer ve bu elipsin
-- içindeki yıldızları göstermez (gezegenlerin arasında yıldız görünmesin diye; istemci isInsideSolarSystem).
-- Sunucu bunu bilmediği için:
--   • suggest_available_stars bu bölgedeki bir yıldızı önerebiliyordu: kamera uçuyor ama yıldız çizilmiyordu
--   • claim_random_available_star / claim_star_in_sector oradaki gerçek bir yıldızı verebiliyordu; tescilli
--     yıldız sahibine görünür ama gezegenlerin arasında durur, başkalarına hiç görünmez
--   • find_free_sky_position oraya yeni sanal yıldız doğurabiliyordu
-- Artık hepsi bu bölgeyi atlar; claim_specific_star bölgedeki yıldız için 22023 verir.
--
-- is_in_solar_system_zone istemcideki isInsideSolarSystem ile AYNI elipstir:
--   merkez (270°, -8°), yarı eksenler: RA 20 / cos(8°) × 1.06, Dec 20 × 0.8 × 1.06
--   (20° = Plüton halkası, 0.8 = ORRERY_TILT, 1.06 = SOLAR_CLEARANCE). Biri değişirse ikisi
--   birlikte değişmelidir (solarSystem testi bu dosyadaki değerleri istemciyle karşılaştırır).
-- Mevcut tescilli yıldızlara dokunulmaz (bölgede tescilli yıldız yok). Gövdeler önceki migration'lardaki
-- sürümlerin kopyasıdır; yalnızca bölge koşulu eklenmiştir.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_in_solar_system_zone(p_ra NUMERIC, p_dec NUMERIC)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    power(((((((p_ra - 270) % 360) + 540) % 360) - 180)::float8) / (20::float8 / cos(radians(8::float8)) * 1.06), 2)
    + power((p_dec::float8 + 8) / (20::float8 * 0.8 * 1.06), 2) <= 1;
$$;

REVOKE ALL ON FUNCTION public.is_in_solar_system_zone(NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.find_free_sky_position(
  p_min_ra   NUMERIC DEFAULT 0,
  p_max_ra   NUMERIC DEFAULT 359.9999,
  p_min_dec  NUMERIC DEFAULT -90,
  p_max_dec  NUMERIC DEFAULT 90,
  p_attempts INTEGER DEFAULT 200
)
RETURNS TABLE (out_ra NUMERIC, out_dec NUMERIC)
LANGUAGE plpgsql
VOLATILE
SET search_path = public, extensions
AS $$
DECLARE
  v_gap    NUMERIC := public.star_min_gap_deg();
  v_ra     NUMERIC;
  v_dec    NUMERIC;
  v_sin_lo DOUBLE PRECISION := sin(radians(GREATEST(-90, p_min_dec)::float8));
  v_sin_hi DOUBLE PRECISION := sin(radians(LEAST(90, p_max_dec)::float8));
BEGIN
  FOR v_try IN 1..LEAST(GREATEST(COALESCE(p_attempts, 1), 1), 1000) LOOP
    -- Küre üzerinde düzgün dağılım: sin(dec) aralıkta düzgün seçilir
    v_ra  := ROUND((p_min_ra + random() * (p_max_ra - p_min_ra))::numeric, 4);
    v_dec := ROUND(degrees(asin(v_sin_lo + random() * (v_sin_hi - v_sin_lo)))::numeric, 4);
    IF NOT public.is_in_solar_system_zone(v_ra, v_dec) AND NOT EXISTS (
      SELECT 1
        FROM public.celestial_catalog AS s
       WHERE s.catalog_code NOT LIKE 'SOL-%'
         AND s."dec" BETWEEN v_dec - v_gap AND v_dec + v_gap
         AND degrees(acos(least(1::float8, greatest(-1::float8,
               sin(radians(s."dec"::float8)) * sin(radians(v_dec::float8)) +
               cos(radians(s."dec"::float8)) * cos(radians(v_dec::float8)) *
               cos(radians((s.ra - v_ra)::float8)))))) < v_gap
    ) THEN
      out_ra  := v_ra;
      out_dec := v_dec;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;
  -- Uygun nokta yok: boş sonuç (çağıran P0003 verir)
END;
$$;

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
  -- Sanal yıldız üretimi
  v_gen_ra           NUMERIC;
  v_gen_dec          NUMERIC;
  v_sector_id        VARCHAR(32);
  v_code3            VARCHAR(4);
  v_new_code         VARCHAR(32);
  v_rnd              NUMERIC;
  v_spec             VARCHAR(16);
  v_color            VARCHAR(9);
  v_mag              NUMERIC(4,2);
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
     AND catalog_code NOT LIKE 'SOL-%'
     AND NOT public.is_in_solar_system_zone(ra, "dec")
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
       AND catalog_code NOT LIKE 'SOL-%'
     AND NOT public.is_in_solar_system_zone(ra, "dec")
       AND magnitude <= p_mag_max
       AND ra < v_random_ra
     ORDER BY ra ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED;
  END IF;

  -- ── 6. Gökkubbede boşta gerçek yıldız kalmadıysa: sanal yıldız üret (hata verme) ──
  IF v_catalog_id IS NULL THEN
    -- Yıldızlar KESİNLİKLE dip dibe gelmesin: konum, hiçbir yıldıza star_min_gap_deg() (1°) den yakın olmayacak
    -- biçimde seçilir. Gevşetme yoktur; uygun nokta bulunamazsa (gökyüzü bu aralıkla doymuşsa) P0003 verilir.
    SELECT p.out_ra, p.out_dec INTO v_gen_ra, v_gen_dec FROM public.find_free_sky_position() AS p;
    IF v_gen_ra IS NULL THEN
      RAISE EXCEPTION 'Gökyüzünde yıldızların birbirine yeterince uzak kalacağı boş bir yer kalmadı.'
        USING ERRCODE = 'P0003';
    END IF;
    v_sector_id := public.sky_sector_for_position(v_gen_ra, v_gen_dec);
    SELECT code3 INTO v_code3 FROM public.sky_sectors WHERE id = v_sector_id;

    -- Çakışmasız kod: sektör kodu + epoch hex + UUID parçası (claim_star_in_sector ile aynı biçim)
    v_new_code := 'VIRT-' || COALESCE(v_code3, 'SKY') || '-' ||
                  UPPER(TO_HEX(EXTRACT(EPOCH FROM clock_timestamp())::BIGINT)) || '-' ||
                  UPPER(SUBSTRING(gen_random_uuid()::text FROM 1 FOR 4));

    -- Tutarlı Anakol (V) spektrum standardı ve ağırlıklı gerçekçi dağılım (claim_star_in_sector ile aynı)
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
      v_new_code, v_gen_ra, v_gen_dec, v_mag, v_spec, v_color, TRUE, v_sector_id, TRUE
    ) RETURNING id INTO v_catalog_id;
  ELSE
    -- ── 7. Gerçek yıldızı tescille ──
    UPDATE public.celestial_catalog
       SET is_claimed = TRUE
     WHERE id = v_catalog_id;
  END IF;

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

CREATE OR REPLACE FUNCTION public.claim_star_in_sector(p_couple_id integer, p_sector_id character varying, p_custom_name character varying, p_owner_initials text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
     AND NOT public.is_in_solar_system_zone(ra, "dec")
   ORDER BY magnitude ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  -- 6. Sektörde boş katalog yıldızı kalmadıysa -> Prosedürel Sanal Yıldız Üretimi (Fallback)
  IF v_catalog_id IS NULL THEN
    -- Yıldızlar KESİNLİKLE dip dibe gelmesin: sektör sınırları içinde, hiçbir yıldıza star_min_gap_deg() den yakın olmayan nokta
    SELECT p.out_ra, p.out_dec INTO v_gen_ra, v_gen_dec
      FROM public.find_free_sky_position(v_min_ra, v_max_ra, v_min_dec, v_max_dec) AS p;
    IF v_gen_ra IS NULL THEN
      RAISE EXCEPTION 'Bu sektörde yıldızların birbirine yeterince uzak kalacağı boş bir yer kalmadı.'
        USING ERRCODE = 'P0003';
    END IF;

    v_new_code := 'VIRT-' || v_code3 || '-' ||
                  UPPER(TO_HEX(EXTRACT(EPOCH FROM clock_timestamp())::BIGINT)) || '-' ||
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
$function$;

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
  v_catalog_code     VARCHAR(32);
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
  SELECT is_claimed, catalog_code INTO v_is_claimed, v_catalog_code
    FROM public.celestial_catalog
   WHERE id = p_star_catalog_id
   FOR UPDATE;

  IF v_is_claimed IS NULL OR v_catalog_code LIKE 'SOL-%'
     OR EXISTS (SELECT 1 FROM public.celestial_catalog AS z
                 WHERE z.id = p_star_catalog_id AND public.is_in_solar_system_zone(z.ra, z."dec")) THEN
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
       AND NOT public.is_in_solar_system_zone(c.ra, c."dec")
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
       AND NOT public.is_in_solar_system_zone(c.ra, c."dec")
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

COMMIT;
