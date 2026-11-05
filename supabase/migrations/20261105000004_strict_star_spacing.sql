-- ============================================================================
-- MIGRATION: 20261105000004_strict_star_spacing.sql
-- Yıldızlar KESİNLİKLE dip dibe gelmesin: sanal yıldız konumunda gevşetme yok
-- ============================================================================
-- Önceki sürüm (20261105000003) sanal yıldız için "1°, olmazsa 0.5°, o da olmazsa son nokta" diyordu. Artık:
--   • star_min_gap_deg(): tek kaynak aralık (1.0°); değiştirmek için bu fonksiyonu güncelleyin
--   • find_free_sky_position(): hiçbir yıldıza aralıktan yakın olmayan, küre üzerinde düzgün dağılmış bir nokta bulur
--     (en fazla 200 rastgele deneme; sektör sınırı verilebilir). Güneş Sistemi nesneleri aralık hesabına girmez.
--   • claim_random_available_star ve claim_star_in_sector yalnızca bu noktaları kullanır; uygun nokta yoksa P0003 verir,
--     aralık HİÇBİR ZAMAN gevşetilmez.
-- Kapasite: 1° aralıkla gökyüzü rastgele yerleştirmede yaklaşık 25-28 bin yıldıza kadar dolabilir (kalan boşluk
-- sürekli daralır); bundan sonrası için aralığı küçültmek (ör. 0.75° ≈ 50 bin) ya da yerleşimi sistematikleştirmek gerekir.
-- Gerçek (katalog) yıldızlarının konumuna dokunulmaz; bu migration yalnızca YENİ sanal yıldızların yerini belirler.
-- Gövdeler 20261105000003'teki sürümlerin kopyasıdır; yalnızca konum seçimi değişir.
-- ============================================================================

BEGIN;

-- Konum aramasını hızlı tutar (dec penceresi): sanal yıldız sayısı arttıkça gerekir
CREATE INDEX IF NOT EXISTS idx_celestial_catalog_dec ON public.celestial_catalog ("dec");

CREATE OR REPLACE FUNCTION public.star_min_gap_deg()
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT 1.0::numeric $$;

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
    IF NOT EXISTS (
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

REVOKE ALL ON FUNCTION public.star_min_gap_deg() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.find_free_sky_position(NUMERIC, NUMERIC, NUMERIC, NUMERIC, INTEGER) FROM PUBLIC, anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- claim_random_available_star
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

-- ────────────────────────────────────────────────────────────────────────────
-- claim_star_in_sector (canlı tanımın kopyası; yalnızca konum seçimi değişir)
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

COMMIT;
