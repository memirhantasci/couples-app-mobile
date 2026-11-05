-- ============================================================================
-- MIGRATION: 20261105000006_sky_all_stars_and_owner_photos.sql
--
-- 1. Uzaktan bakınca da TÜM yıldızlar görünür. get_stars_in_viewport artık yakınlığa göre kadir sınırı
--    uygulamaz (eskiden uzakta yalnızca kadir <= 3.8, ortada <= 5.8 yükleniyordu; 2.024 yıldızın 1.621'i
--    ancak yakınlaşınca çıkıyordu). zoom_level parametresi eski istemciler için korunur ama yok sayılır.
--    En kalabalık 30°'lik karoda 68 yıldız var (300 satır sınırının çok altında). Katalog ~10 bini aşarsa
--    uzak görünüm için yeniden bir sınır düşünülmeli.
--
-- 2. Demo (oturumsuz) ziyaretçiler de, sahibinin izin verdiği her şeyi görür: yıldız adı (bildirimle
--    gizlenmemişse) ve show_name_on_star açık olan üyenin ilk adı. Eskiden demo yalnızca baş harfleri
--    görüyor, yıldız adını hiç görmüyordu.
--
-- 3. Yıldız kartında sahiplerin profil fotoğrafı (PP), AÇIK RIZAYLA:
--      • users.show_avatar_on_star (varsayılan kapalı): kişi başına rıza; partner diğerinin fotoğrafını açamaz
--      • get_star_owner_photos(p_catalog_id): kendi çiftimiz → üyelerin fotoğrafları; diğer herkes (bağlı
--        çiftler ve demo dahil) → yalnızca rıza veren üyelerin fotoğrafı. Yıldız sahibi çiftin Premium'u
--        aktif değilse fotoğraf dönmez (uygulamanın geri kalanıyla aynı kural).
--      • Moderasyon isimlerle aynı: bildiren kişi o yıldızın fotoğraflarını görmez; 3 farklı çiftten
--        bildirimle (name_hidden_at) fotoğraflar sahibi ve bağlı çiftler dışında herkesten gizlenir.
--      • URL değil yalnızca depolama yolu (+ önbellek sürümü) döner; istemci adresi kendi Supabase
--        depolamasından kurar. avatar_url doğrulaması alan adını denetlemediğinden yabancıların cihazına
--        keyfi bir dış adres yüklettirilemez.
--
-- Parlaklık kuralları değişmez: sahipsiz yıldızlar sabit ışık; başkalarının yıldızı günlük gizemli ışık;
-- kendi yıldızımız ve bağlı (arkadaş) yıldızlar gerçek ışık.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Şema: fotoğraf rızası
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS show_avatar_on_star BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.show_avatar_on_star IS
  'Kullanıcının açık rızası: profil fotoğrafı, kendi çifti dışındaki herkese yıldız kartında gösterilir. Varsayılan kapalı.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. get_stars_in_viewport: kadir sınırı yok + demo izin verilen adları görür
--    (imza ve dönüş tipi aynı: CREATE OR REPLACE mevcut yetkileri korur)
-- ────────────────────────────────────────────────────────────────────────────
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
  resonance_active  BOOLEAN,
  owner_label       TEXT,
  is_connected      BOOLEAN
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
  v_today           DATE := public.activity_local_date(NOW());
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
      WHEN cs.id IS NULL THEN NULL::VARCHAR(120)
      WHEN cs.couple_id = v_my_couple_id THEN cs.custom_name
      WHEN cs.id = ANY (v_reported_ids) THEN NULL::VARCHAR(120)
      WHEN cs.name_hidden_at IS NOT NULL AND NOT (cs.id = ANY (v_friend_star_ids)) THEN NULL::VARCHAR(120)
      ELSE cs.custom_name
    END AS custom_name,
    CASE
      WHEN cs.id IS NULL THEN public.calculate_star_brightness(0)
      WHEN cs.couple_id = v_my_couple_id OR cs.id = ANY (v_friend_star_ids)
        THEN COALESCE(cas.brightness, public.calculate_star_brightness(0))
      ELSE public.star_mystery_brightness(cc.id, COALESCE(v_my_couple_id, 0), v_today)
    END::NUMERIC(3,2) AS luminosity_level,
    COALESCE(cs.resonance_until > NOW(), FALSE),
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
    COALESCE(cs.id = ANY (v_friend_star_ids), FALSE) AS is_connected
  FROM public.celestial_catalog cc
  LEFT JOIN public.couple_stars cs ON cs.catalog_id = cc.id
  LEFT JOIN public.couple_activity_score cas
    ON cas.couple_id = cs.couple_id
   AND (cs.couple_id = v_my_couple_id OR cs.id = ANY (v_friend_star_ids))
  WHERE
    cc.dec BETWEEN min_dec AND max_dec
    AND (
      (min_ra <= max_ra AND cc.ra BETWEEN min_ra AND max_ra)
      OR
      (min_ra > max_ra AND (cc.ra >= min_ra OR cc.ra <= max_ra))
    )
    AND (cc.is_claimed = FALSE OR cs.id IS NOT NULL)
  ORDER BY
    (cs.couple_id = v_my_couple_id) DESC,
    (cs.id IS NOT NULL) DESC,
    cc.magnitude ASC
  LIMIT 300;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. get_star_owner_photos: yıldız kartındaki sahip fotoğrafları (rızayla)
--    Dönüş: üye katılım sırasıyla (sahip etiketiyle aynı sıra) depolama yolu + önbellek sürümü
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_star_owner_photos(p_catalog_id BIGINT)
RETURNS TABLE (
  avatar_path    TEXT,
  avatar_version TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid            UUID := auth.uid();
  v_my_couple_id   INTEGER;
  v_my_star_id     UUID;
  v_star_id        UUID;
  v_star_couple_id INTEGER;
  v_name_hidden    BOOLEAN;
  v_own            BOOLEAN := FALSE;
BEGIN
  SELECT cs.id, cs.couple_id, cs.name_hidden_at IS NOT NULL
    INTO v_star_id, v_star_couple_id, v_name_hidden
    FROM public.couple_stars AS cs
   WHERE cs.catalog_id = p_catalog_id;

  IF v_star_id IS NULL OR v_star_couple_id IS NULL THEN
    RETURN;
  END IF;

  -- Profil fotoğrafı Premium özelliğidir: Premium'u aktif olmayan çiftin fotoğrafı gösterilmez
  IF NOT public.has_active_premium(v_star_couple_id) THEN
    RETURN;
  END IF;

  v_my_couple_id := CASE WHEN v_uid IS NULL THEN NULL ELSE public.get_my_couple_id() END;
  v_own := v_my_couple_id IS NOT NULL AND v_my_couple_id = v_star_couple_id;

  IF NOT v_own THEN
    -- Bildiren kişi bu yıldızın fotoğraflarını görmez
    IF v_uid IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.star_reports AS r WHERE r.star_id = v_star_id AND r.reporter_id = v_uid
    ) THEN
      RETURN;
    END IF;

    -- Yeterli bildirimle gizlenen yıldız: yalnızca bağlı (arkadaş) çiftler görmeye devam eder
    IF v_name_hidden THEN
      IF v_my_couple_id IS NULL THEN
        RETURN;
      END IF;
      SELECT cs.id INTO v_my_star_id FROM public.couple_stars AS cs WHERE cs.couple_id = v_my_couple_id;
      IF v_my_star_id IS NULL OR NOT EXISTS (
        SELECT 1
          FROM public.star_connections AS sc
         WHERE sc.status = 'accepted'
           AND ((sc.star_a_id = v_my_star_id AND sc.star_b_id = v_star_id)
             OR (sc.star_b_id = v_my_star_id AND sc.star_a_id = v_star_id))
      ) THEN
        RETURN;
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    u.id::TEXT || '/avatar.jpg',
    substring(u.avatar_url FROM '[?&]v=([0-9]{1,20})')
  FROM public.users AS u
  WHERE u.couple_id = v_star_couple_id
    AND u.avatar_url IS NOT NULL
    AND (v_own OR u.show_avatar_on_star)
  ORDER BY u.created_at NULLS LAST, u.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_star_owner_photos(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_star_owner_photos(BIGINT) TO anon, authenticated;

COMMIT;
