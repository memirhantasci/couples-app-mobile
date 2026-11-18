-- ============================================================================
-- MIGRATION: 20261119000000_solar_gift_system.sql
-- Güneş Sistemi gök cisimlerini yönetici hediyesi olarak tescilleme sistemi
-- ============================================================================
-- 1. celestial_catalog tablosuna eksik Güneş Sistemi cisimlerini (Ay, Merkür,
--    Mars, Jüpiter, Satürn, Uranüs, Neptün, Plüton) ekler / günceller.
-- 2. guard_star_rename trigger'ı ve rename_my_star RPC'sine SOL-% cisimleri
--    için isim değiştirme yasağı koyar (astronomik adlar sabittir).
-- 3. enforce_premium_star_claim trigger'ına admin_gift oturum ayarı kontrolü
--    ekler (yönetici hediyesi için Premium zorunluluğu bypass edilir).
-- 4. admin_gift_solar_star(p_couple_id, p_solar_code, p_owner_initials)
--    fonksiyonunu kurar (çift başına tek yıldız, tekil gezegen kilidi).
-- 5. release_lapsed_star fonksiyonundan SOL-% cisimlerini muaf tutar (çiftin
--    Premium'u bitse bile hediye edilen gezegen asla silinmez).
-- 6. get_solar_system_claims() RPC'sini kurar (mobil haritaya 11 gezegenin
--    canlı sahiplik ve gizlilik durumunu hafifçe döndürür).
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Eksik Güneş Sistemi cisimlerini kataloğa ekle
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO public.celestial_catalog
  (catalog_code, common_name, ra, dec, magnitude, spectral_type, base_color, is_claimed)
VALUES
  ('SOL-SUN',     'Güneş',   280.4600, -23.4400, -26.74, 'G2V',         '#FFF4E8', FALSE),
  ('SOL-EARTH',   'Dünya',   100.4600,  23.4400,  -3.80, 'Terrestrial', '#38BDF8', FALSE),
  ('SOL-VENUS',   'Venüs',   243.6000, -19.9000,  -4.40, 'Terrestrial', '#FFE5C2', FALSE),
  ('SOL-MOON',    'Ay',      218.3160,  28.0000, -12.74, 'Moon',        '#E2E8F0', FALSE),
  ('SOL-MERCURY', 'Merkür',  252.2500, -20.0000,  -0.40, 'Terrestrial', '#CBD5E1', FALSE),
  ('SOL-MARS',    'Mars',    355.4500, -11.0000,  -1.50, 'Terrestrial', '#EF4444', FALSE),
  ('SOL-JUPITER', 'Jüpiter',  34.4000,   7.0000,  -2.70, 'Gas Giant',   '#F59E0B', FALSE),
  ('SOL-SATURN',  'Satürn',   49.9500,  17.0000,   0.20, 'Gas Giant',   '#FDE047', FALSE),
  ('SOL-URANUS',  'Uranüs',  313.2400, -18.0000,   5.50, 'Ice Giant',   '#22D3EE', FALSE),
  ('SOL-NEPTUNE', 'Neptün',  304.8800, -15.0000,   7.80, 'Ice Giant',   '#3B82F6', FALSE),
  ('SOL-PLUTO',   'Plüton',  238.9300, -14.0000,  14.00, 'Dwarf',       '#C084FC', FALSE)
ON CONFLICT (catalog_code) DO UPDATE
SET common_name = EXCLUDED.common_name;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. İsim değiştirme koruması: SOL-% cisimlerinin adı kesinlikle değiştirilemez
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_star_rename()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_code VARCHAR(32);
BEGIN
  -- Güneş Sistemi cisimlerinin adı hiçbir şekilde değiştirilemez
  SELECT cc.catalog_code INTO v_code
    FROM public.celestial_catalog AS cc
   WHERE cc.id = NEW.catalog_id;

  IF v_code LIKE 'SOL-%' THEN
    RAISE EXCEPTION 'Güneş Sistemi cisimlerinin isimleri değiştirilemez.'
      USING ERRCODE = '22023';
  END IF;

  IF auth.uid() IS NOT NULL
     AND COALESCE(current_setting('app.star_rename', true), '') <> 'on'
     AND (NEW.custom_name IS DISTINCT FROM OLD.custom_name
          OR NEW.name_changed_at IS DISTINCT FROM OLD.name_changed_at) THEN
    RAISE EXCEPTION 'Yıldız ismi yalnızca isim değiştirme işlemiyle güncellenebilir.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rename_my_star(p_new_name VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_couple_id  INTEGER;
  v_name       TEXT := BTRIM(COALESCE(p_new_name, ''));
  v_star       public.couple_stars%ROWTYPE;
  v_catalog_code VARCHAR(32);
  v_next_at    TIMESTAMPTZ;
BEGIN
  v_couple_id := public.get_my_couple_id();
  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Bir çifte bağlı değilsiniz.' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_name) < 2 OR char_length(v_name) > 40 THEN
    RAISE EXCEPTION 'Yıldız ismi 2 ile 40 karakter arasında olmalıdır.' USING ERRCODE = '22023';
  END IF;

  IF public.contains_blocked_word(v_name) THEN
    RAISE EXCEPTION 'Yıldız ismi topluluk kurallarına aykırı kelimeler içeremez.' USING ERRCODE = 'P0006';
  END IF;

  SELECT * INTO v_star FROM public.couple_stars WHERE couple_id = v_couple_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Çiftin henüz bir yıldızı yok.' USING ERRCODE = 'P0013';
  END IF;

  -- Güneş Sistemi cismi kontrolü
  SELECT catalog_code INTO v_catalog_code
    FROM public.celestial_catalog
   WHERE id = v_star.catalog_id;

  IF v_catalog_code LIKE 'SOL-%' THEN
    RAISE EXCEPTION 'Güneş Sistemi cisimlerinin isimleri değiştirilemez.' USING ERRCODE = '22023';
  END IF;

  IF v_star.name_changed_at IS NOT NULL THEN
    v_next_at := v_star.name_changed_at + INTERVAL '30 days';
    IF now() < v_next_at THEN
      RAISE EXCEPTION 'İsim değiştirme hakkı henüz yenilenmedi.'
        USING ERRCODE = 'P0012', HINT = to_char(v_next_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    END IF;
  END IF;

  IF v_name = v_star.custom_name THEN
    RAISE EXCEPTION 'Yeni isim mevcut isimle aynı; hakkınız korunuyor.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.star_rename', 'on', true);
  UPDATE public.couple_stars
     SET custom_name = v_name,
         name_changed_at = now()
   WHERE id = v_star.id;

  RETURN public.get_my_couple_star_details(v_couple_id);
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. enforce_premium_star_claim trigger güncellemesi: admin_gift bypass
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_premium_star_claim()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Yönetici hediyesi oturumunda Premium kısıtı aranmaz
  IF COALESCE(current_setting('app.admin_gift', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NOT public.has_active_premium(NEW.couple_id) THEN
    RAISE EXCEPTION 'Yıldız sahiplenmek için aktif Premium üyelik gereklidir.'
      USING ERRCODE = 'P0010';
  END IF;
  RETURN NEW;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. admin_gift_solar_star RPC: Yönetici tarafından gezegen hediye etme
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_gift_solar_star(
  p_couple_id      INTEGER,
  p_solar_code     VARCHAR,
  p_owner_initials TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_catalog_id   BIGINT;
  v_common_name  VARCHAR(120);
  v_is_claimed   BOOLEAN;
  v_new_star_id  UUID;
  v_sender_id    UUID;
BEGIN
  -- 1. Çift var mı?
  IF NOT EXISTS (SELECT 1 FROM public.couples WHERE id = p_couple_id) THEN
    RAISE EXCEPTION 'Belirtilen çift bulunamadı (ID: %).' USING ERRCODE = '22023';
  END IF;

  -- 2. Çiftin zaten bir yıldızı var mı? (Her çiftin yalnızca 1 yıldızı/gezegeni olabilir)
  IF EXISTS (SELECT 1 FROM public.couple_stars WHERE couple_id = p_couple_id) THEN
    RAISE EXCEPTION 'Bu çiftin zaten bir yıldızı var. Her çift yalnızca tek bir yıldıza sahip olabilir.'
      USING ERRCODE = 'P0005';
  END IF;

  -- 3. Belirtilen Güneş Sistemi kodunu kilitle ve oku
  SELECT id, common_name, is_claimed
    INTO v_catalog_id, v_common_name, v_is_claimed
    FROM public.celestial_catalog
   WHERE catalog_code = UPPER(TRIM(p_solar_code))
     AND catalog_code LIKE 'SOL-%'
   FOR UPDATE;

  IF v_catalog_id IS NULL THEN
    RAISE EXCEPTION 'Geçersiz Güneş Sistemi kodu: %. Geçerli kodlar: SOL-SUN, SOL-MERCURY, SOL-VENUS, SOL-EARTH, SOL-MOON, SOL-MARS, SOL-JUPITER, SOL-SATURN, SOL-URANUS, SOL-NEPTUNE, SOL-PLUTO', p_solar_code
      USING ERRCODE = '22023';
  END IF;

  -- 4. Gezegen daha önce başka bir çifte verilmiş mi?
  IF EXISTS (SELECT 1 FROM public.couple_stars WHERE catalog_id = v_catalog_id) THEN
    RAISE EXCEPTION 'Bu gök cismi (%) zaten başka bir çifte verilmiş!' , UPPER(TRIM(p_solar_code))
      USING ERRCODE = 'P0004';
  END IF;

  -- 5. Kataloğu tescillendi olarak güncelle
  UPDATE public.celestial_catalog
     SET is_claimed = TRUE
   WHERE id = v_catalog_id;

  -- 6. couple_stars kaydını aç (app.admin_gift oturum bayrağı ile Premium kontrolü atlanır)
  PERFORM set_config('app.admin_gift', 'on', true);

  INSERT INTO public.couple_stars (
    couple_id,
    catalog_id,
    custom_name,
    luminosity_level,
    last_spark_at,
    owner_initials,
    name_changed_at
  ) VALUES (
    p_couple_id,
    v_catalog_id,
    v_common_name,
    1.00,
    NOW(),
    NULLIF(LEFT(TRIM(p_owner_initials), 16), ''),
    NOW() + INTERVAL '999 years'
  ) RETURNING id INTO v_new_star_id;

  -- 7. Hoş geldin kıvılcımı ekle
  SELECT id INTO v_sender_id
    FROM public.users
   WHERE couple_id = p_couple_id
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_sender_id IS NOT NULL THEN
    INSERT INTO public.star_sparks (star_id, sender_id, spark_type, message)
    VALUES (
      v_new_star_id,
      v_sender_id,
      'welcome_spark',
      '🌟 Güneş Sistemi’nin eşsiz bir parçası aşkınıza tescillendi! ✨'
    );
  END IF;

  -- 8. Güncel çift yıldız detayını döndür
  RETURN public.get_my_couple_star_details(p_couple_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_gift_solar_star(INTEGER, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. release_lapsed_star: SOL-% gök cisimlerini Premium lapse'den koru
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.release_lapsed_star(p_couple_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_star_id      UUID;
  v_catalog_id   BIGINT;
  v_catalog_code VARCHAR(32);
  v_expired_at   TIMESTAMPTZ;
BEGIN
  IF p_couple_id IS NULL THEN
    RETURN FALSE;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('couple_activity_lock'), p_couple_id);

  IF NOT public.is_star_lapsed(p_couple_id) THEN
    RETURN FALSE;
  END IF;

  SELECT cs.id, cs.catalog_id, cc.catalog_code
    INTO v_star_id, v_catalog_id, v_catalog_code
    FROM public.couple_stars AS cs
    JOIN public.celestial_catalog AS cc ON cc.id = cs.catalog_id
   WHERE cs.couple_id = p_couple_id;

  IF v_star_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Güneş Sistemi gezegenleri (özel yönetici armağanı) lapse ile asla serbest bırakılmaz
  IF v_catalog_code LIKE 'SOL-%' THEN
    RETURN FALSE;
  END IF;

  SELECT c.premium_expires_at INTO v_expired_at FROM public.couples AS c WHERE c.id = p_couple_id;

  -- Yıldız bağlantıları (iki yönlü) ve bu çiftin gönderdiği istekler
  DELETE FROM public.star_connections AS sc
   WHERE sc.requested_by_couple_id = p_couple_id
      OR sc.star_a_id = v_star_id
      OR sc.star_b_id = v_star_id;

  -- Katalog kaydı yeniden sahiplenilebilir olur
  UPDATE public.celestial_catalog AS cc SET is_claimed = FALSE WHERE cc.id = v_catalog_id;

  -- Yıldız satırı: anı gezegenleri ve kıvılcımlar ON DELETE CASCADE ile silinir
  DELETE FROM public.couple_stars AS cs WHERE cs.id = v_star_id;

  -- Işıltı skoru ve günlük döküm sıfırlanır
  DELETE FROM public.couple_activity_score AS s WHERE s.couple_id = p_couple_id;
  DELETE FROM public.couple_daily_activity AS d WHERE d.couple_id = p_couple_id;

  INSERT INTO public.star_lapse_releases (couple_id, catalog_id, premium_expired_at)
  VALUES (p_couple_id, v_catalog_id, v_expired_at);

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_lapsed_stars(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (couple_id INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT cs.couple_id
    FROM public.couple_stars AS cs
    JOIN public.celestial_catalog AS cc ON cc.id = cs.catalog_id
   WHERE public.is_star_lapsed(cs.couple_id)
     AND cc.catalog_code NOT LIKE 'SOL-%'
   ORDER BY cs.couple_id
   LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 6. get_solar_system_claims: Mobil harita için 11 gezegenin sahiplik bilgisi
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_solar_system_claims()
RETURNS TABLE (
  catalog_id       BIGINT,
  catalog_code     VARCHAR(32),
  couple_id        INTEGER,
  custom_name      VARCHAR(120),
  is_claimed       BOOLEAN,
  is_mine          BOOLEAN,
  owner_label      TEXT,
  is_connected     BOOLEAN,
  luminosity_level NUMERIC(3,2),
  resonance_active BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid             UUID := auth.uid();
  v_my_couple_id    INTEGER;
  v_my_star_id      UUID;
  v_friend_star_ids UUID[] := ARRAY[]::UUID[];
  v_reported_ids    UUID[] := ARRAY[]::UUID[];
BEGIN
  v_my_couple_id := CASE WHEN v_uid IS NULL THEN NULL ELSE public.get_my_couple_id() END;

  IF v_my_couple_id IS NOT NULL THEN
    SELECT cs.id INTO v_my_star_id FROM public.couple_stars AS cs WHERE cs.couple_id = v_my_couple_id;
  END IF;
  IF v_my_star_id IS NOT NULL THEN
    v_friend_star_ids := ARRAY(
      SELECT CASE WHEN sc.star_a_id = v_my_star_id THEN sc.star_b_id ELSE sc.star_a_id END
        FROM public.star_connections AS sc
       WHERE sc.status = 'accepted'
         AND (sc.star_a_id = v_my_star_id OR sc.star_b_id = v_my_star_id)
    );
  END IF;
  IF v_uid IS NOT NULL THEN
    v_reported_ids := ARRAY(
      SELECT r.star_id FROM public.star_reports AS r WHERE r.reporter_id = v_uid
    );
  END IF;

  RETURN QUERY
  SELECT
    cc.id AS catalog_id,
    cc.catalog_code,
    cs.couple_id,
    CASE
      WHEN cs.id IS NULL THEN NULL::VARCHAR(120)
      WHEN cs.couple_id = v_my_couple_id THEN cs.custom_name
      WHEN cs.id = ANY (v_reported_ids) THEN NULL::VARCHAR(120)
      WHEN cs.name_hidden_at IS NOT NULL AND NOT (cs.id = ANY (v_friend_star_ids)) THEN NULL::VARCHAR(120)
      ELSE cs.custom_name
    END AS custom_name,
    (cs.id IS NOT NULL) AS is_claimed,
    (cs.couple_id = v_my_couple_id) AS is_mine,
    CASE
      WHEN cs.id IS NULL THEN NULL::TEXT
      WHEN cs.couple_id = v_my_couple_id
           OR (cs.id = ANY (v_friend_star_ids) AND NOT (cs.id = ANY (v_reported_ids)))
        THEN COALESCE(public.star_owner_label(cs.couple_id, TRUE, TRUE), cs.owner_initials::TEXT)
      ELSE COALESCE(
        public.star_owner_label(
          cs.couple_id,
          FALSE,
          cs.name_hidden_at IS NULL AND NOT (cs.id = ANY (v_reported_ids))
        ),
        cs.owner_initials::TEXT
      )
    END AS owner_label,
    COALESCE(cs.id = ANY (v_friend_star_ids), FALSE) AS is_connected,
    COALESCE(cs.luminosity_level, 1.00)::NUMERIC(3,2) AS luminosity_level,
    COALESCE(cs.resonance_until > NOW(), FALSE) AS resonance_active
  FROM public.celestial_catalog cc
  LEFT JOIN public.couple_stars cs ON cs.catalog_id = cc.id
  WHERE cc.catalog_code LIKE 'SOL-%'
  ORDER BY cc.catalog_code ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_solar_system_claims() TO authenticated, anon;

COMMIT;
