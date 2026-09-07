-- ============================================================================
-- MIGRATION: 20260909_star_connections.sql
-- Aşama 5: Arkadaş Çift Yıldız Bağlama Mimarisi (Star Connections)
-- ============================================================================
-- 1. public.star_connections tablosu ve self-connection CHECK kısıtlaması
-- 2. LEAST / GREATEST sıralı UNIQUE INDEX (çift yönlü mükerrer bağlantı engeli)
-- 3. check_connection_limit (UI rozeti için sahiplik kontrollü helper)
-- 4. request_star_connection (Simetrik advisory lock, 3 limit zorlaması, to_jsonb)
-- 5. respond_to_star_connection (Simetrik advisory lock, FOR UPDATE, alıcı kontrolü)
-- 6. search_star_by_name (Escape'li ILIKE araması, kendi yıldızını hariç tutma)
-- 7. get_my_star_connections & get_my_pending_connections
-- 8. Strict RLS politikaları (Doğrudan INSERT/UPDATE kapalı, sadece atomik RPC)
-- 9. GRANT EXECUTE izinleri
-- ============================================================================

-- 1. BAĞLANTI TABLOSU
CREATE TABLE IF NOT EXISTS public.star_connections (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  star_a_id              UUID NOT NULL REFERENCES public.couple_stars(id) ON DELETE CASCADE,
  star_b_id              UUID NOT NULL REFERENCES public.couple_stars(id) ON DELETE CASCADE,
  status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted', 'rejected')),
  requested_by_couple_id INTEGER NOT NULL REFERENCES public.couples(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at           TIMESTAMPTZ,
  -- Kendine bağlantı isteği engeli (DB Check)
  CONSTRAINT no_self_connection CHECK (star_a_id <> star_b_id)
);

COMMENT ON TABLE  public.star_connections IS 'Çiftler arası gökyüzü yıldız bağlantıları ve takımyıldızı bağları tablosu.';
COMMENT ON COLUMN public.star_connections.requested_by_couple_id IS 'İsteği başlatan çiftin IDsi (couples.id int4).';

-- 2. SIRALI UNIQUE INDEX (Expression index ile mükerrer çift yönlü bağlantı engeli)
CREATE UNIQUE INDEX IF NOT EXISTS unique_star_connection
  ON public.star_connections (
    LEAST(star_a_id::text, star_b_id::text),
    GREATEST(star_a_id::text, star_b_id::text)
  );

-- Performans indeksleri
CREATE INDEX IF NOT EXISTS idx_star_connections_star_a ON public.star_connections(star_a_id);
CREATE INDEX IF NOT EXISTS idx_star_connections_star_b ON public.star_connections(star_b_id);
CREATE INDEX IF NOT EXISTS idx_star_connections_status ON public.star_connections(status);

-- 3. GÖSTERİM HELPER'I: check_connection_limit (Client UI Rozeti İçin)
-- DİKKAT: Bu fonksiyon yalnızca istemci gösterim amaçlıdır.
-- Asıl limit doğrulaması atomik RPC'ler içinde yürütülür.
CREATE OR REPLACE FUNCTION public.check_connection_limit(p_couple_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_my_couple_id INTEGER;
  v_count INTEGER;
  v_star_id UUID;
BEGIN
  v_my_couple_id := public.get_my_couple_id();
  IF v_my_couple_id IS NULL OR v_my_couple_id <> p_couple_id THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Yalnızca kendi çiftinizin durumunu sorgulayabilirsiniz.'
      USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_star_id
    FROM public.couple_stars WHERE couple_id = p_couple_id;

  IF v_star_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.star_connections
   WHERE (star_a_id = v_star_id OR star_b_id = v_star_id)
     AND status = 'accepted';

  RETURN v_count < 3;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 4. ATOMİK RPC: request_star_connection (İstek Gönderme)
CREATE OR REPLACE FUNCTION public.request_star_connection(
  p_target_star_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_my_couple_id     INTEGER;
  v_my_star_id       UUID;
  v_target_couple_id INTEGER;
  v_existing_status  TEXT;
  v_count_my         INTEGER;
  v_inserted_row     public.star_connections%ROWTYPE;
BEGIN
  -- 1. Kimlik doğrulama
  v_my_couple_id := public.get_my_couple_id();
  IF v_my_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz işlem.' USING ERRCODE = '42501';
  END IF;

  -- 2. Çağıran çiftin yıldızı var mı?
  SELECT id INTO v_my_star_id
    FROM public.couple_stars
   WHERE couple_id = v_my_couple_id;

  IF v_my_star_id IS NULL THEN
    RAISE EXCEPTION 'Bağlantı kurabilmek için önce bir yıldız sahiplenmelisiniz.'
      USING ERRCODE = 'P0010';
  END IF;

  -- 3. Kendine bağlantı kontrolü
  IF v_my_star_id = p_target_star_id THEN
    RAISE EXCEPTION 'Kendi yıldızınıza bağlantı kuramazsınız.'
      USING ERRCODE = '22023';
  END IF;

  -- 4. Hedef yıldız var mı ve kime ait?
  SELECT couple_id INTO v_target_couple_id
    FROM public.couple_stars
   WHERE id = p_target_star_id;

  IF v_target_couple_id IS NULL THEN
    RAISE EXCEPTION 'Hedef yıldız bulunamadı.' USING ERRCODE = 'P0003';
  END IF;

  -- 5. Simetrik Çift Kilit (Deadlock-Free Advisory Lock: LEAST ardından GREATEST)
  PERFORM pg_advisory_xact_lock(hashtext('star_conn_lock'), LEAST(v_my_couple_id, v_target_couple_id));
  PERFORM pg_advisory_xact_lock(hashtext('star_conn_lock'), GREATEST(v_my_couple_id, v_target_couple_id));

  -- 6. Çağıran çiftin aktif limit kontrolü (Maks 3)
  SELECT COUNT(*) INTO v_count_my
    FROM public.star_connections
   WHERE (star_a_id = v_my_star_id OR star_b_id = v_my_star_id)
     AND status = 'accepted';

  IF v_count_my >= 3 THEN
    RAISE EXCEPTION 'Maksimum 3 yıldız bağlantısı sınırına ulaştınız.'
      USING ERRCODE = 'P0011';
  END IF;

  -- 7. Zaten var olan bağlantı veya bekleyen istek var mı?
  SELECT status INTO v_existing_status
    FROM public.star_connections
   WHERE (
     (star_a_id = v_my_star_id AND star_b_id = p_target_star_id) OR
     (star_a_id = p_target_star_id AND star_b_id = v_my_star_id)
   );

  IF v_existing_status = 'accepted' THEN
    RAISE EXCEPTION 'Bu yıldızla zaten aktif bir bağlantınız var.' USING ERRCODE = 'P0012';
  ELSIF v_existing_status = 'pending' THEN
    RAISE EXCEPTION 'Bu yıldız için bekleyen bir bağlantı isteği zaten mevcut.' USING ERRCODE = 'P0012';
  END IF;

  -- Eski rejected kayıt varsa temizle
  DELETE FROM public.star_connections
   WHERE (
     (star_a_id = v_my_star_id AND star_b_id = p_target_star_id) OR
     (star_a_id = p_target_star_id AND star_b_id = v_my_star_id)
   ) AND status = 'rejected';

  -- 8. Atomik Ekleme ve Tam Şema Uyumlu to_jsonb Dönüşü
  INSERT INTO public.star_connections (
    star_a_id,
    star_b_id,
    status,
    requested_by_couple_id,
    created_at
  ) VALUES (
    v_my_star_id,
    p_target_star_id,
    'pending',
    v_my_couple_id,
    NOW()
  ) RETURNING * INTO v_inserted_row;

  RETURN to_jsonb(v_inserted_row);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. ATOMİK RPC: respond_to_star_connection (Kabul / Red)
CREATE OR REPLACE FUNCTION public.respond_to_star_connection(
  p_connection_id UUID,
  p_accept        BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  v_my_couple_id INTEGER;
  v_conn RECORD;
  v_couple_a INTEGER;
  v_couple_b INTEGER;
  v_count_a INTEGER;
  v_count_b INTEGER;
BEGIN
  v_my_couple_id := public.get_my_couple_id();
  IF v_my_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz işlem.' USING ERRCODE = '42501';
  END IF;

  -- Satırı kilitleyerek oku (FOR UPDATE)
  SELECT * INTO v_conn
    FROM public.star_connections
   WHERE id = p_connection_id
     FOR UPDATE;

  IF v_conn.id IS NULL THEN
    RAISE EXCEPTION 'Bağlantı isteği bulunamadı.' USING ERRCODE = 'PGRST116';
  END IF;

  -- SADECE alıcı çift (istek sahibi OLMAYAN) yanıtlayabilir!
  IF v_conn.requested_by_couple_id = v_my_couple_id THEN
    RAISE EXCEPTION 'Kendi gönderdiğiniz bağlantı isteğini yanıtlayamazsınız.' USING ERRCODE = '42501';
  END IF;

  -- Alıcı tarafın kendi yıldızını içeriyor mu?
  IF NOT EXISTS (
    SELECT 1 FROM public.couple_stars
     WHERE couple_id = v_my_couple_id AND (id = v_conn.star_a_id OR id = v_conn.star_b_id)
  ) THEN
    RAISE EXCEPTION 'Bu isteği yanıtlama yetkiniz yok.' USING ERRCODE = '42501';
  END IF;

  IF v_conn.status <> 'pending' THEN
    RAISE EXCEPTION 'Bu istek zaten yanıtlanmış.' USING ERRCODE = 'P0014';
  END IF;

  -- Her iki tarafın çift kimliklerini bul
  SELECT couple_id INTO v_couple_a FROM public.couple_stars WHERE id = v_conn.star_a_id;
  SELECT couple_id INTO v_couple_b FROM public.couple_stars WHERE id = v_conn.star_b_id;

  -- Simetrik Çift Kilit: Sayım ve onaylama öncesinde her iki çifti de kilitle!
  PERFORM pg_advisory_xact_lock(hashtext('star_conn_lock'), LEAST(v_couple_a, v_couple_b));
  PERFORM pg_advisory_xact_lock(hashtext('star_conn_lock'), GREATEST(v_couple_a, v_couple_b));

  IF p_accept THEN
    -- Her iki tarafın da 3 limitini aşmadığını doğrula
    SELECT COUNT(*) INTO v_count_a
      FROM public.star_connections
     WHERE (star_a_id = v_conn.star_a_id OR star_b_id = v_conn.star_a_id) AND status = 'accepted';

    SELECT COUNT(*) INTO v_count_b
      FROM public.star_connections
     WHERE (star_a_id = v_conn.star_b_id OR star_b_id = v_conn.star_b_id) AND status = 'accepted';

    IF v_count_a >= 3 OR v_count_b >= 3 THEN
      RAISE EXCEPTION 'Taraflardan birinin maksimum 3 bağlantı sınırı dolu.' USING ERRCODE = 'P0011';
    END IF;

    UPDATE public.star_connections
       SET status = 'accepted',
           responded_at = NOW()
     WHERE id = p_connection_id;
  ELSE
    UPDATE public.star_connections
       SET status = 'rejected',
           responded_at = NOW()
     WHERE id = p_connection_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. ARAMA FONKSİYONU: search_star_by_name (Escape Korumalı)
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
BEGIN
  -- % ve _ ve \ karakterlerini güvenle kaçışla (SQL wildcard injection koruması)
  v_escaped_query := replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_');

  RETURN QUERY
  SELECT
    cs.id,
    cs.custom_name,
    cc.catalog_code,
    cc.ra,
    cc."dec"
  FROM public.couple_stars cs
  JOIN public.celestial_catalog cc ON cc.id = cs.catalog_id
  WHERE cs.custom_name ILIKE ('%' || v_escaped_query || '%') ESCAPE '\'
    AND cs.couple_id <> public.get_my_couple_id()
  LIMIT 10;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 7. KENDİ AKTİF BAĞLANTILARINI GETİR (Canvas için)
CREATE OR REPLACE FUNCTION public.get_my_star_connections()
RETURNS TABLE (
  connection_id   UUID,
  other_star_id   UUID,
  other_star_name VARCHAR(120),
  other_star_ra   NUMERIC(8,4),
  other_star_dec  NUMERIC(8,4)
) AS $$
DECLARE
  v_my_star_id UUID;
BEGIN
  SELECT id INTO v_my_star_id
    FROM public.couple_stars
   WHERE couple_id = public.get_my_couple_id();

  IF v_my_star_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    sc.id AS connection_id,
    other_cs.id AS other_star_id,
    other_cs.custom_name AS other_star_name,
    cc.ra AS other_star_ra,
    cc."dec" AS other_star_dec
  FROM public.star_connections sc
  JOIN public.couple_stars other_cs
    ON other_cs.id = (CASE WHEN sc.star_a_id = v_my_star_id THEN sc.star_b_id ELSE sc.star_a_id END)
  JOIN public.celestial_catalog cc
    ON cc.id = other_cs.catalog_id
  WHERE (sc.star_a_id = v_my_star_id OR sc.star_b_id = v_my_star_id)
    AND sc.status = 'accepted';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 8. BEKLEYEN İSTEKLERİ GETİR
CREATE OR REPLACE FUNCTION public.get_my_pending_connections()
RETURNS TABLE (
  connection_id   UUID,
  other_star_id   UUID,
  other_star_name VARCHAR(120),
  is_incoming     BOOLEAN,
  created_at      TIMESTAMPTZ
) AS $$
DECLARE
  v_my_couple_id INTEGER;
  v_my_star_id UUID;
BEGIN
  v_my_couple_id := public.get_my_couple_id();
  SELECT id INTO v_my_star_id FROM public.couple_stars WHERE couple_id = v_my_couple_id;

  IF v_my_star_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    sc.id AS connection_id,
    other_cs.id AS other_star_id,
    other_cs.custom_name AS other_star_name,
    (sc.requested_by_couple_id <> v_my_couple_id) AS is_incoming,
    sc.created_at
  FROM public.star_connections sc
  JOIN public.couple_stars other_cs
    ON other_cs.id = (CASE WHEN sc.star_a_id = v_my_star_id THEN sc.star_b_id ELSE sc.star_a_id END)
  WHERE (sc.star_a_id = v_my_star_id OR sc.star_b_id = v_my_star_id)
    AND sc.status = 'pending'
  ORDER BY sc.created_at DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 9. STRICT RLS POLİTİKALARI
ALTER TABLE public.star_connections ENABLE ROW LEVEL SECURITY;

-- Okuma: Çift yalnızca kendi dahil olduğu bağlantıları görebilir
DROP POLICY IF EXISTS "star_connections_select_own" ON public.star_connections;
CREATE POLICY "star_connections_select_own"
  ON public.star_connections FOR SELECT TO authenticated
  USING (
    star_a_id IN (SELECT id FROM couple_stars WHERE couple_id = get_my_couple_id())
    OR
    star_b_id IN (SELECT id FROM couple_stars WHERE couple_id = get_my_couple_id())
  );

-- Silme: Her iki taraf da bağlantıyı sonlandırabilir (koparabilir)
DROP POLICY IF EXISTS "star_connections_delete_own" ON public.star_connections;
CREATE POLICY "star_connections_delete_own"
  ON public.star_connections FOR DELETE TO authenticated
  USING (
    star_a_id IN (SELECT id FROM couple_stars WHERE couple_id = get_my_couple_id())
    OR
    star_b_id IN (SELECT id FROM couple_stars WHERE couple_id = get_my_couple_id())
  );

-- NOT: Doğrudan INSERT ve UPDATE politikası verilmez; işlemler sadece
-- atomik SECURITY DEFINER RPC'ler üzerinden güvenle yürütülür!

-- 10. İZİNLER
GRANT EXECUTE ON FUNCTION public.check_connection_limit(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_star_connection(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_star_connection(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_star_by_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_star_connections() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_pending_connections() TO authenticated;
