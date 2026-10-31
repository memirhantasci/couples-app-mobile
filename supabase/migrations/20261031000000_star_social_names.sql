-- ============================================================================
-- MIGRATION: 20261031000000_star_social_names.sql
--
-- Gökyüzünü sosyal hâle getirir; kişisel veri yalnızca rızayla açılır.
--
-- 1. Yıldız adları: başka çiftlerin yıldız adı artık sabit "Tescilli Yıldız" yerine gerçek adıyla
--    döner (gerçek oturum gerekir; oturumsuz demo yalnızca baş harfleri görür). Adlar zaten
--    contains_blocked_word tetikleyicisiyle denetleniyor (20261029000004).
--
-- 2. Sahip etiketi (owner_label), sunucuda canlı hesaplanır, istemcinin gönderdiği metne dayanmaz:
--      • kendi yıldızımız ve kabul edilmiş bağ (arkadaş) yıldızları → ilk adlar: "Ahmet 💕 Elif"
--      • diğer yıldızlar → baş harfler: "A 💕 E"; bir üye users.show_name_on_star ile AÇIKÇA izin
--        verdiyse yalnızca onun ilk adı görünür: "Ahmet 💕 E". Rıza kişi başınadır: bir partner
--        diğerinin adını yayınlayamaz. Varsayılan kapalıdır.
--    Yalnızca ilk ad (görünen adın ilk kelimesi, en fazla 20 karakter) kullanılır; uygunsuz kelime
--    içeren ad yerine baş harf gösterilir. Soyad, kullanıcı adı ve e-posta hiçbir koşulda dönmez.
--
-- 3. Bildirme (App Store 1.2 kullanıcı içeriği kuralı): report_star ile bir yıldız bildirilir.
--      • Bildiren kişi o yıldızın adını ve isimlerini hemen görmez olur (yalnızca baş harfler).
--      • 3 farklı çiftten bildirim gelince ad herkes için gizlenir (sahibi ve bağlı çiftler hariç).
--      • Yıldız yeniden adlandırılınca bildirimler ve gizleme sıfırlanır (ad yine denetimden geçer).
--
-- 4. get_my_star_connections / get_my_pending_connections: diğer yıldızın katalog kimliği
--    (istemci bağ/istek eşleşmesini adla değil kimlikle yapsın) ve sahip etiketi eklenir.
--
-- Yeni dönüş sütunu eklenen fonksiyonlar DROP + CREATE ile yeniden oluşturulduğundan yetkileri
-- aşağıda açıkça yeniden verilir.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Şema
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS show_name_on_star BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.show_name_on_star IS
  'Kullanıcının açık rızası: ilk adı, bağ kurmadığı çiftlere de yıldız kartında gösterilir. Varsayılan kapalı.';

ALTER TABLE public.couple_stars
  ADD COLUMN IF NOT EXISTS name_hidden_at TIMESTAMPTZ;

COMMENT ON COLUMN public.couple_stars.name_hidden_at IS
  'Yeterli bildirim gelince dolar: yıldız adı ve isimler sahibi ve bağlı çiftler dışında gizlenir.';

CREATE TABLE IF NOT EXISTS public.star_reports (
  star_id            UUID NOT NULL REFERENCES public.couple_stars(id) ON DELETE CASCADE,
  reporter_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reporter_couple_id INTEGER REFERENCES public.couples(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (star_id, reporter_id)
);

COMMENT ON TABLE public.star_reports IS
  'Yıldız adı / sahip adı bildirimleri. Yalnızca report_star ve yıldız RPC''leri üzerinden okunur / yazılır.';

CREATE INDEX IF NOT EXISTS idx_star_reports_reporter ON public.star_reports(reporter_id);

ALTER TABLE public.star_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.star_reports FROM PUBLIC, anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Yardımcılar (istemciye kapalı)
-- ────────────────────────────────────────────────────────────────────────────

-- Türkçe öncelikli ilk harf büyütme: i → İ, ı → I
CREATE OR REPLACE FUNCTION public.star_name_initial(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE left(btrim(p_text), 1)
    WHEN 'i' THEN 'İ'
    WHEN 'ı' THEN 'I'
    ELSE upper(left(btrim(p_text), 1))
  END;
$$;

-- Bir çiftin yıldız kartındaki sahip etiketi. Üyeler katılım sırasıyla (created_at) dizilir.
--   p_reveal_names : TRUE → tüm üyelerin ilk adı (kendi çiftimiz / bağlı çiftler)
--   p_allow_opt_in : TRUE → show_name_on_star açık olan üyenin ilk adı, diğerlerinin baş harfi
-- SECURITY INVOKER: yalnızca SECURITY DEFINER yıldız RPC'lerinin içinden çağrılır; istemci yetkisi yok.
CREATE OR REPLACE FUNCTION public.star_owner_label(
  p_couple_id    INTEGER,
  p_reveal_names BOOLEAN,
  p_allow_opt_in BOOLEAN
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT string_agg(m.part, ' 💕 ' ORDER BY m.created_at NULLS LAST, m.id)
  FROM (
    SELECT
      u.id,
      u.created_at,
      CASE
        WHEN (p_reveal_names OR (p_allow_opt_in AND u.show_name_on_star))
             AND n.first_name IS NOT NULL
             AND NOT public.contains_blocked_word(n.first_name)
          THEN public.star_name_initial(n.first_name) || substr(n.first_name, 2)
        ELSE public.star_name_initial(n.base_name)
      END AS part
    FROM public.users AS u
    CROSS JOIN LATERAL (
      SELECT
        NULLIF(left(split_part(btrim(COALESCE(u.display_name, '')), ' ', 1), 20), '') AS first_name,
        NULLIF(btrim(COALESCE(NULLIF(btrim(u.display_name), ''), u.username, '')), '') AS base_name
    ) AS n
    WHERE p_couple_id IS NOT NULL
      AND u.couple_id = p_couple_id
  ) AS m
  WHERE m.part IS NOT NULL
    AND m.part <> '';
$$;

REVOKE ALL ON FUNCTION public.star_name_initial(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.star_owner_label(INTEGER, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Yeniden adlandırma bildirimleri sıfırlar
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_star_reports_on_rename()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.custom_name IS DISTINCT FROM OLD.custom_name THEN
    NEW.name_hidden_at := NULL;
    DELETE FROM public.star_reports WHERE star_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_star_reports_on_rename() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reset_star_reports_on_rename ON public.couple_stars;
CREATE TRIGGER trg_reset_star_reports_on_rename
  BEFORE UPDATE OF custom_name ON public.couple_stars
  FOR EACH ROW EXECUTE FUNCTION public.reset_star_reports_on_rename();


-- ────────────────────────────────────────────────────────────────────────────
-- 4. report_star
-- Hatalar: 42501 oturum yok, 22023 yıldız bulunamadı / kendi yıldızı
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.report_star(p_catalog_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid               UUID := auth.uid();
  v_my_couple_id      INTEGER;
  v_star_id           UUID;
  v_star_couple_id    INTEGER;
  v_reporting_parties INTEGER;
BEGIN
  IF v_uid IS NULL OR COALESCE(auth.jwt() ->> 'is_anonymous', 'false') <> 'false' THEN
    RAISE EXCEPTION 'Bildirim için giriş yapmalısınız.' USING ERRCODE = '42501';
  END IF;

  SELECT cs.id, cs.couple_id
    INTO v_star_id, v_star_couple_id
    FROM public.couple_stars AS cs
   WHERE cs.catalog_id = p_catalog_id;

  IF v_star_id IS NULL THEN
    RAISE EXCEPTION 'Bildirilecek tescilli yıldız bulunamadı.' USING ERRCODE = '22023';
  END IF;

  v_my_couple_id := public.get_my_couple_id();
  IF v_my_couple_id IS NOT NULL AND v_star_couple_id = v_my_couple_id THEN
    RAISE EXCEPTION 'Kendi yıldızınızı bildiremezsiniz.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.star_reports (star_id, reporter_id, reporter_couple_id)
  VALUES (v_star_id, v_uid, v_my_couple_id)
  ON CONFLICT (star_id, reporter_id) DO NOTHING;

  -- Aynı çiftin iki partneri tek taraf sayılır; tek bir çift bir yıldızı herkes için gizleyemez
  SELECT COUNT(DISTINCT COALESCE(r.reporter_couple_id::TEXT, r.reporter_id::TEXT))
    INTO v_reporting_parties
    FROM public.star_reports AS r
   WHERE r.star_id = v_star_id;

  IF v_reporting_parties >= 3 THEN
    UPDATE public.couple_stars
       SET name_hidden_at = NOW()
     WHERE id = v_star_id
       AND name_hidden_at IS NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.report_star(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_star(BIGINT) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. get_stars_in_viewport — gerçek yıldız adları + owner_label (owner_initials'ın yerine)
--    Parlaklık, sıralama ve sınırlar 20261021000000 ile aynıdır.
-- ────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_stars_in_viewport(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC);

CREATE FUNCTION public.get_stars_in_viewport(
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
  v_is_real_user    BOOLEAN;
  v_my_couple_id    INTEGER;
  v_my_star_id      UUID;
  v_friend_star_ids UUID[] := ARRAY[]::UUID[];
  v_reported_ids    UUID[] := ARRAY[]::UUID[];
  v_mag_limit       NUMERIC(4,2);
  v_today           DATE := public.activity_local_date(NOW());
BEGIN
  -- anon anahtarıyla yapılan çağrıda is_anonymous alanı yoktur; gerçek oturum auth.uid() ile doğrulanır
  v_is_real_user := v_uid IS NOT NULL
    AND COALESCE(auth.jwt() ->> 'is_anonymous', 'false') = 'false';
  v_my_couple_id := CASE WHEN v_uid IS NULL THEN NULL ELSE public.get_my_couple_id() END;
  v_mag_limit := CASE
    WHEN zoom_level < 1.5 THEN 3.80
    WHEN zoom_level < 4.0 THEN 5.80
    ELSE 9.00
  END;

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
      WHEN NOT v_is_real_user THEN NULL::VARCHAR(120)
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
          v_is_real_user AND cs.name_hidden_at IS NULL AND NOT (cs.id = ANY (v_reported_ids))
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
    AND (cs.id IS NOT NULL OR cc.magnitude <= v_mag_limit)
  ORDER BY
    (cs.couple_id = v_my_couple_id) DESC,
    (cs.id IS NOT NULL) DESC,
    cc.magnitude ASC
  LIMIT 300;
END;
$$;

REVOKE ALL ON FUNCTION public.get_stars_in_viewport(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stars_in_viewport(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC)
  TO authenticated, anon;


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Bağlantı listeleri: katalog kimliği + sahip etiketi
-- ────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_my_star_connections();

CREATE FUNCTION public.get_my_star_connections()
RETURNS TABLE (
  connection_id     UUID,
  other_star_id     UUID,
  other_star_name   VARCHAR(120),
  other_star_ra     NUMERIC(8,4),
  other_star_dec    NUMERIC(8,4),
  other_catalog_id  BIGINT,
  other_owner_label TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_star_id UUID;
BEGIN
  SELECT cs.id INTO v_my_star_id
    FROM public.couple_stars AS cs
   WHERE cs.couple_id = public.get_my_couple_id();

  IF v_my_star_id IS NULL THEN
    RETURN;
  END IF;

  -- Bağ kabul edilmiş: iki çift birbirinin ilk adlarını görür
  RETURN QUERY
  SELECT
    sc.id,
    other_cs.id,
    other_cs.custom_name,
    cc.ra,
    cc."dec",
    cc.id,
    COALESCE(public.star_owner_label(other_cs.couple_id, TRUE, TRUE), other_cs.owner_initials::TEXT)
  FROM public.star_connections AS sc
  JOIN public.couple_stars AS other_cs
    ON other_cs.id = (CASE WHEN sc.star_a_id = v_my_star_id THEN sc.star_b_id ELSE sc.star_a_id END)
  JOIN public.celestial_catalog AS cc
    ON cc.id = other_cs.catalog_id
  WHERE (sc.star_a_id = v_my_star_id OR sc.star_b_id = v_my_star_id)
    AND sc.status = 'accepted';
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_star_connections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_star_connections() TO authenticated;


DROP FUNCTION IF EXISTS public.get_my_pending_connections();

CREATE FUNCTION public.get_my_pending_connections()
RETURNS TABLE (
  connection_id     UUID,
  other_star_id     UUID,
  other_star_name   VARCHAR(120),
  is_incoming       BOOLEAN,
  created_at        TIMESTAMPTZ,
  other_catalog_id  BIGINT,
  other_owner_label TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_couple_id INTEGER;
  v_my_star_id   UUID;
BEGIN
  v_my_couple_id := public.get_my_couple_id();
  SELECT cs.id INTO v_my_star_id FROM public.couple_stars AS cs WHERE cs.couple_id = v_my_couple_id;

  IF v_my_star_id IS NULL THEN
    RETURN;
  END IF;

  -- Henüz bağ yok: yalnızca baş harfler, ilk adını açıkça paylaşan üyenin adı
  RETURN QUERY
  SELECT
    sc.id,
    other_cs.id,
    other_cs.custom_name,
    (sc.requested_by_couple_id <> v_my_couple_id),
    sc.created_at,
    other_cs.catalog_id,
    COALESCE(
      public.star_owner_label(other_cs.couple_id, FALSE, other_cs.name_hidden_at IS NULL),
      other_cs.owner_initials::TEXT
    )
  FROM public.star_connections AS sc
  JOIN public.couple_stars AS other_cs
    ON other_cs.id = (CASE WHEN sc.star_a_id = v_my_star_id THEN sc.star_b_id ELSE sc.star_a_id END)
  WHERE (sc.star_a_id = v_my_star_id OR sc.star_b_id = v_my_star_id)
    AND sc.status = 'pending'
  ORDER BY sc.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_pending_connections() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_pending_connections() TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. Aramalar: gizlenmiş ya da bildirdiğiniz yıldızlar adla bulunmaz
--    (imzalar aynı: CREATE OR REPLACE mevcut yetkileri korur)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_star_by_name(p_query TEXT)
RETURNS TABLE (
  star_id      UUID,
  custom_name  VARCHAR(120),
  catalog_code VARCHAR(32),
  ra           NUMERIC(8,4),
  "dec"        NUMERIC(8,4)
) AS $$
DECLARE
  v_escaped_query TEXT;
  v_trimmed_query TEXT;
  v_my_couple_id  INTEGER;
BEGIN
  v_my_couple_id := public.get_my_couple_id();
  v_trimmed_query := TRIM(p_query);
  -- % ve _ ve \ karakterlerini güvenle kaçışla (SQL wildcard injection koruması)
  v_escaped_query := replace(replace(replace(v_trimmed_query, '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  SELECT
    cs.id,
    cs.custom_name,
    cc.catalog_code,
    cc.ra,
    cc."dec"
  FROM public.couple_stars cs
  JOIN public.celestial_catalog cc ON cc.id = cs.catalog_id
  WHERE (
      (
        cs.custom_name ILIKE ('%' || v_escaped_query || '%') ESCAPE '\'
        AND cs.name_hidden_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.star_reports r
           WHERE r.star_id = cs.id AND r.reporter_id = auth.uid()
        )
      )
      -- Çift kodu karşı çiftten alınır: kodla arama gizlemeden etkilenmez
      OR cs.couple_id IN (
        SELECT c.id FROM public.couples c
         WHERE c.pairing_code = UPPER(v_trimmed_query)
      )
    )
    AND cs.couple_id IS DISTINCT FROM v_my_couple_id
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;


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

    -- 2. Çiftlerin Tescilli Yıldızları (gizlenmiş / bildirdiğiniz yıldızlar hariç; kendi yıldızınız her zaman)
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
      AND (
        cs.couple_id = v_my_couple_id
        OR (
          cs.name_hidden_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.star_reports r
             WHERE r.star_id = cs.id AND r.reporter_id = auth.uid()
          )
        )
      )

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

COMMIT;
