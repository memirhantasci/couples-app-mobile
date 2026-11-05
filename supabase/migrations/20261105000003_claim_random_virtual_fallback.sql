-- ============================================================================
-- MIGRATION: 20261105000003_claim_random_virtual_fallback.sql
-- Kapasite genişletmesi (Faz 0): "yıldız kalmadı" duvarı kalkar, Güneş Sistemi nesneleri tescil edilemez
-- ============================================================================
-- 1. claim_random_available_star
--    • Eskiden gökkubbede (kadir <= p_mag_max) boşta yıldız kalmayınca P0003 hatası veriyordu: o noktadan sonra yeni
--      çift hiç yıldız alamıyordu. Artık önce gerçek katalog yıldızı aranır (öncekiyle aynı sarmal arama); bulunamazsa
--      tüm gökyüzünde rastgele bir noktada prosedürel "sanal" yıldız üretilir (claim_star_in_sector ile aynı üretim
--      kuralı: VIRT-<sektör>-<epoch>-<uuid> kodu, ağırlıklı Anakol dağılımı; konum, yıldızlar dip dibe gelmesin diye başka yıldızlara en az
--      1° (olmazsa 0.5°) uzakta seçilir). Sanal yıldız da diğerleri gibi sahiplenilir,
--      Premium biterse serbest kalır ve başka çift tarafından yeniden alınabilir.
--    • Güneş Sistemi nesneleri (SOL-*) rastgele tescil adayı olamaz. Canlı veritabanında bu satırlar is_claimed = FALSE
--      ve kadirleri <= 6.5 olduğundan, bir çifte rastgele "Güneş" ya da "Ay" tescil edilebiliyordu.
-- 2. claim_specific_star: SOL-* nesneleri seçilemez (arayüz bunları zaten claim edilebilir göstermez; sunucu da reddeder).
-- 3. claim_star_in_sector: sanal yıldız kodu küçük harf üretiyordu, katalog kısıtı yalnızca büyük harfe izin veriyor; yedek yol
--    hiçbir zaman çalışmamıştı. Kod artık büyük harfle üretilir.
--
-- Gövdeler canlı veritabanındaki tanımların (pg_get_functiondef) kopyasıdır; yalnızca yukarıdaki adımlar değişir.
-- İmzalar aynı kaldığı için yetkiler (GRANT) korunur.
-- Bağımlılık: 20261105000002_catalog_expansion_hyg_1500.sql (public.sky_sector_for_position).
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. claim_random_available_star
-- ────────────────────────────────────────────────────────────────────────────
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
  v_try              INTEGER;
  v_min_gap          NUMERIC;
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
       AND magnitude <= p_mag_max
       AND ra < v_random_ra
     ORDER BY ra ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED;
  END IF;

  -- ── 6. Gökkubbede boşta gerçek yıldız kalmadıysa: sanal yıldız üret (hata verme) ──
  IF v_catalog_id IS NULL THEN
    -- Küre üzerinde düzgün dağılım (dec = asin(2u - 1)). Yıldızlar dip dibe gelmesin: önce herhangi bir yıldıza en az 1°,
    -- bulunamazsa 0.5° uzaklıkta bir nokta aranır (12 + 12 deneme); hepsi başarısız olursa son nokta kullanılır.
    FOR v_try IN 1..24 LOOP
      v_gen_ra  := ROUND((random() * 359.9999)::numeric, 4);
      v_gen_dec := ROUND(degrees(asin(2 * random() - 1))::numeric, 4);
      v_min_gap := CASE WHEN v_try <= 12 THEN 1.0 ELSE 0.5 END;
      EXIT WHEN NOT EXISTS (
        SELECT 1
          FROM public.celestial_catalog AS near_star
         WHERE near_star.catalog_code NOT LIKE 'SOL-%'
           AND near_star."dec" BETWEEN v_gen_dec - v_min_gap AND v_gen_dec + v_min_gap
           AND degrees(acos(least(1::float8, greatest(-1::float8,
                 sin(radians(near_star."dec"::float8)) * sin(radians(v_gen_dec::float8)) +
                 cos(radians(near_star."dec"::float8)) * cos(radians(v_gen_dec::float8)) *
                 cos(radians((near_star.ra - v_gen_ra)::float8)))))) < v_min_gap
      );
    END LOOP;
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

-- ────────────────────────────────────────────────────────────────────────────
-- 2. claim_specific_star: Güneş Sistemi nesneleri seçilemez
-- ────────────────────────────────────────────────────────────────────────────
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

  IF v_is_claimed IS NULL OR v_catalog_code LIKE 'SOL-%' THEN
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

-- ────────────────────────────────────────────────────────────────────────────
-- 3. claim_star_in_sector: sanal yıldız kodu büyük harfle üretilir
--    Mevcut sürüm kodu TO_HEX() ile KÜÇÜK harf üretiyordu; celestial_catalog_catalog_code_check kısıtı
--    (^[A-Z0-9_-]+$) yalnızca büyük harfe izin verdiğinden sektörde boş yıldız kalmayınca sanal yıldız eklemek
--    her zaman hata veriyordu. Gövde canlı tanımın kopyasıdır; tek fark UPPER(TO_HEX(...)).
-- ────────────────────────────────────────────────────────────────────────────
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
   ORDER BY magnitude ASC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  -- 6. Sektörde boş katalog yıldızı kalmadıysa -> Prosedürel Sanal Yıldız Üretimi (Fallback)
  IF v_catalog_id IS NULL THEN
    v_gen_ra  := ROUND((v_min_ra + random() * (v_max_ra - v_min_ra))::numeric, 4);
    v_gen_dec := ROUND((v_min_dec + random() * (v_max_dec - v_min_dec))::numeric, 4);

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

COMMIT;
