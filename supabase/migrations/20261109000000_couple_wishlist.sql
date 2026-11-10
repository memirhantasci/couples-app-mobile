-- ============================================================================
-- Ortak liste "Birlikte Yapacaklarımız" (Faz 1A, 1/2): tablolar, yetkiler, RPC'ler ve madde sınırı
-- ----------------------------------------------------------------------------
-- Plan: docs/ORTAK_LISTE_PLANI.md (bölüm 1 ve 4). Yetki senaryoları: supabase/tests/couple_wishlist_test.sql
--
-- Kurallar:
--   • Madde çiftindir; partnere yalnızca eşleşme anından (couples.paired_at) SONRA eklendiyse görünür,
--     ekleyen her zaman görür. Buluşma ve takvim notlarıyla aynı kural.
--   • Ekleyen düzenler ve siler. "İstiyorum" ve "yaptık" iki kişinin de işidir, RPC ile yapılır.
--   • Eşleşme şart: tek kalan yazamaz (P0020), silmek her zaman serbest.
--   • Ücretsizde 15 açık madde (P0022, 'WISHLIST_LIMIT'), Premium'da teknik üst sınır 300. Yapılanlar sayılmaz.
--     Premium biterse hiçbir şey silinmez; yalnızca sınırın üstünde yeni açık madde kilitlenir.
--   • Puan yok: activity_point_rules'a dokunulmaz.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. TABLOLAR
-- ============================================================================
-- done_by'da bilerek yabancı anahtar yok: purge_account_data users/auth.users'a bağlı her sütunda satır siler,
-- anahtar olsaydı silinen kişinin "yaptık" dediği PARTNER maddeleri de giderdi. Silme gününde
-- dissolve_couple_for_leaving_member bu sütunu boşaltır (20261109000001).
CREATE TABLE IF NOT EXISTS public.couple_wishlist_items (
  id            BIGSERIAL PRIMARY KEY,
  couple_id     INTEGER NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  created_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  note          TEXT,
  category      TEXT NOT NULL DEFAULT 'other',
  location_name TEXT,
  latitude      NUMERIC,
  longitude     NUMERIC,
  status        TEXT NOT NULL DEFAULT 'open',
  done_at       TIMESTAMPTZ,
  done_by       UUID,
  -- Faz 2 (buluşmaya / anıya çevir); yalnızca sunucu fonksiyonları yazar
  meeting_id    BIGINT REFERENCES public.meetings(id) ON DELETE SET NULL,
  memory_id     BIGINT REFERENCES public.memories(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT couple_wishlist_items_title_check
    CHECK (char_length(title) BETWEEN 1 AND 80 AND btrim(title) <> ''),
  CONSTRAINT couple_wishlist_items_note_check
    CHECK (char_length(note) <= 300),
  CONSTRAINT couple_wishlist_items_category_check
    CHECK (category IN ('place', 'film', 'food', 'experience', 'travel', 'other')),
  CONSTRAINT couple_wishlist_items_status_check
    CHECK (status IN ('open', 'done')),
  CONSTRAINT couple_wishlist_items_done_state_check
    CHECK ((status = 'done') = (done_at IS NOT NULL)),
  CONSTRAINT couple_wishlist_items_location_name_check
    CHECK (char_length(location_name) <= 500),
  CONSTRAINT couple_wishlist_items_coordinates_check
    CHECK (
      (latitude IS NULL AND longitude IS NULL)
      OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    )
);

CREATE TABLE IF NOT EXISTS public.couple_wishlist_wants (
  item_id BIGINT NOT NULL REFERENCES public.couple_wishlist_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, user_id)
);

-- Liste okuması (couple_id + created_at sırası) ve sınır sayımı
CREATE INDEX IF NOT EXISTS idx_couple_wishlist_items_couple_created
  ON public.couple_wishlist_items (couple_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_wishlist_items_couple_open
  ON public.couple_wishlist_items (couple_id) WHERE status = 'open';
-- Hesap silme ve taşıma oluşturana göre arar
CREATE INDEX IF NOT EXISTS idx_couple_wishlist_items_created_by
  ON public.couple_wishlist_items (created_by);
-- Buluşma / anı silinince ON DELETE SET NULL tüm tabloyu taramasın
CREATE INDEX IF NOT EXISTS idx_couple_wishlist_items_meeting
  ON public.couple_wishlist_items (meeting_id) WHERE meeting_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_couple_wishlist_items_memory
  ON public.couple_wishlist_items (memory_id) WHERE memory_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_couple_wishlist_wants_user
  ON public.couple_wishlist_wants (user_id);


-- ============================================================================
-- 2. SÜTUN YETKİLERİ
-- ============================================================================
-- RLS satırı korur, sütunu korumaz: ekleyen UPDATE ile status / done_by / couple_id yazabilir, INSERT ile
-- status = 'done' vererek sınırı aşabilir, created_at'i değiştirerek eşleşme anı kuralını delebilirdi.
-- İstemci yalnızca içerik sütunlarını yazar; gerisi sunucu fonksiyonlarınındır.
REVOKE ALL ON public.couple_wishlist_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.couple_wishlist_wants FROM PUBLIC, anon, authenticated;

GRANT SELECT, DELETE ON public.couple_wishlist_items TO authenticated;
GRANT INSERT (couple_id, created_by, title, note, category, location_name, latitude, longitude)
  ON public.couple_wishlist_items TO authenticated;
GRANT UPDATE (title, note, category, location_name, latitude, longitude)
  ON public.couple_wishlist_items TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.couple_wishlist_wants TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.couple_wishlist_items_id_seq TO authenticated;

GRANT ALL ON public.couple_wishlist_items TO service_role;
GRANT ALL ON public.couple_wishlist_wants TO service_role;
GRANT ALL ON SEQUENCE public.couple_wishlist_items_id_seq TO service_role;


-- ============================================================================
-- 3. GÖRÜNÜRLÜK VE YAZMA (RLS)
-- ============================================================================
ALTER TABLE public.couple_wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_wishlist_wants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS couple_wishlist_items_select_visible ON public.couple_wishlist_items;
DROP POLICY IF EXISTS couple_wishlist_items_insert_own ON public.couple_wishlist_items;
DROP POLICY IF EXISTS couple_wishlist_items_update_own ON public.couple_wishlist_items;
DROP POLICY IF EXISTS couple_wishlist_items_delete_own ON public.couple_wishlist_items;

CREATE POLICY couple_wishlist_items_select_visible ON public.couple_wishlist_items
  FOR SELECT TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR (couple_id = (SELECT public.get_my_couple_id()) AND created_at >= (SELECT public.my_couple_paired_at()))
  );
CREATE POLICY couple_wishlist_items_insert_own ON public.couple_wishlist_items
  FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()) AND couple_id = (SELECT public.get_my_couple_id()));
CREATE POLICY couple_wishlist_items_update_own ON public.couple_wishlist_items
  FOR UPDATE TO authenticated
  USING (created_by = (SELECT auth.uid()))
  WITH CHECK (created_by = (SELECT auth.uid()));
CREATE POLICY couple_wishlist_items_delete_own ON public.couple_wishlist_items
  FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Alt sorgu maddelerin RLS'iyle çalışır: "madde görünürse" kuralı tek yerde kalır
DROP POLICY IF EXISTS couple_wishlist_wants_select_visible ON public.couple_wishlist_wants;
DROP POLICY IF EXISTS couple_wishlist_wants_insert_own ON public.couple_wishlist_wants;
DROP POLICY IF EXISTS couple_wishlist_wants_delete_own ON public.couple_wishlist_wants;

CREATE POLICY couple_wishlist_wants_select_visible ON public.couple_wishlist_wants
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.couple_wishlist_items AS i WHERE i.id = item_id));
CREATE POLICY couple_wishlist_wants_insert_own ON public.couple_wishlist_wants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.couple_wishlist_items AS i
       WHERE i.id = item_id AND i.couple_id = (SELECT public.get_my_couple_id())
    )
  );
CREATE POLICY couple_wishlist_wants_delete_own ON public.couple_wishlist_wants
  FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));


-- ============================================================================
-- 4. MADDE SINIRI
-- ============================================================================
-- İstemcideki WISHLIST_FREE_LIMIT ile aynı olmalı
CREATE OR REPLACE FUNCTION public.wishlist_free_limit()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT 15 $$;

CREATE OR REPLACE FUNCTION public.wishlist_premium_limit()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT 300 $$;

-- Sayım, ekleyenin listede gördüğü açık maddelerdir (istemcideki "7/15" ile aynı sayı). Yeni eşleşmede taşınan
-- eski maddeler yeni partnere görünmez ve onun hakkından yemez; sahibinin hakkından yer.
-- Kilit: aynı anda gelen iki ekleme sınırı birlikte aşamasın. VOLATILE olmalı: çok satırlı INSERT'te önceki
-- satırları da saysın.
CREATE OR REPLACE FUNCTION public.wishlist_assert_capacity(p_couple_id INTEGER, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit     INTEGER;
  v_paired_at TIMESTAMPTZ;
  v_open      INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('couple_wishlist_limit'), p_couple_id);

  v_limit := CASE WHEN public.has_active_premium(p_couple_id)
                  THEN public.wishlist_premium_limit()
                  ELSE public.wishlist_free_limit() END;

  SELECT c.paired_at INTO v_paired_at FROM public.couples AS c WHERE c.id = p_couple_id;

  SELECT count(*)::integer INTO v_open
    FROM public.couple_wishlist_items AS i
   WHERE i.couple_id = p_couple_id
     AND i.status = 'open'
     AND (i.created_by = p_user_id OR i.created_at >= v_paired_at);

  IF v_open >= v_limit THEN
    RAISE EXCEPTION 'WISHLIST_LIMIT' USING ERRCODE = 'P0022';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_wishlist_enforce_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'open' THEN
    PERFORM public.wishlist_assert_capacity(NEW.couple_id, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

-- BEFORE tetikleyiciler ada göre sıralı çalışır: tek kalan önce trg_solo_write_guard'a takılır (P0020)
DROP TRIGGER IF EXISTS trg_wishlist_limit ON public.couple_wishlist_items;
CREATE TRIGGER trg_wishlist_limit
  BEFORE INSERT ON public.couple_wishlist_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_wishlist_enforce_limit();


-- ============================================================================
-- 5. DİĞER TETİKLEYİCİLER
-- ============================================================================

-- Tek kalan yazamaz (20261107000004'teki 'partner' listesiyle aynı kural). Mektuplarda olduğu gibi tabloya özel
-- tanım: UPDATE yalnızca içerik ve durum sütunlarında çalışır. Faz 2 sütunları bilerek yok: tek kalan bir
-- buluşmayı silince ON DELETE SET NULL bu tabloyu günceller ve silme her zaman serbest kalmalı. Faz 2'nin
-- link_wishlist_* fonksiyonları eşleşmeyi kendisi denetlemeli.
DROP TRIGGER IF EXISTS trg_solo_write_guard ON public.couple_wishlist_items;
CREATE TRIGGER trg_solo_write_guard
  BEFORE INSERT OR UPDATE OF title, note, category, location_name, latitude, longitude, status
  ON public.couple_wishlist_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_solo_write_guard('partner');

DROP TRIGGER IF EXISTS trg_solo_write_guard ON public.couple_wishlist_wants;
CREATE TRIGGER trg_solo_write_guard
  BEFORE INSERT ON public.couple_wishlist_wants
  FOR EACH ROW EXECUTE FUNCTION public.trg_solo_write_guard('partner');

CREATE OR REPLACE FUNCTION public.trg_wishlist_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wishlist_updated_at ON public.couple_wishlist_items;
CREATE TRIGGER trg_wishlist_updated_at
  BEFORE UPDATE ON public.couple_wishlist_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_wishlist_touch_updated_at();

-- Ekleyen maddeyi zaten istiyordur
CREATE OR REPLACE FUNCTION public.trg_wishlist_creator_wants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.couple_wishlist_wants (item_id, user_id)
  VALUES (NEW.id, NEW.created_by)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wishlist_creator_wants ON public.couple_wishlist_items;
CREATE TRIGGER trg_wishlist_creator_wants
  AFTER INSERT ON public.couple_wishlist_items
  FOR EACH ROW EXECUTE FUNCTION public.trg_wishlist_creator_wants();


-- ============================================================================
-- 6. "İSTİYORUM" VE "YAPTIK"
-- ============================================================================

-- RPC'lerin ortak kapısı: oturum, eşleşme ve maddeyi görebilme (RLS'teki kuralın aynısı). Satırı kilitler.
-- Yalnızca aşağıdaki SECURITY DEFINER fonksiyonlardan çağrılır.
CREATE OR REPLACE FUNCTION public.wishlist_lock_visible_item(p_item_id BIGINT)
RETURNS public.couple_wishlist_items
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_item public.couple_wishlist_items%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.my_couple_is_paired() THEN
    RAISE EXCEPTION 'PARTNER_REQUIRED: Bu özellik için bir partnerle eşleşmen gerekiyor.'
      USING ERRCODE = 'P0020';
  END IF;

  SELECT i.* INTO v_item
    FROM public.couple_wishlist_items AS i
   WHERE i.id = p_item_id
     AND i.couple_id = public.get_my_couple_id()
     AND (i.created_by = v_uid OR i.created_at >= public.my_couple_paired_at())
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Madde bulunamadı veya yetkiniz yok.' USING ERRCODE = '42501';
  END IF;

  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_wishlist_want(p_item_id BIGINT, p_want BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item public.couple_wishlist_items%ROWTYPE;
BEGIN
  IF p_want IS NULL THEN
    RAISE EXCEPTION 'Geçersiz istek.' USING ERRCODE = '22023';
  END IF;

  v_item := public.wishlist_lock_visible_item(p_item_id);

  IF p_want THEN
    INSERT INTO public.couple_wishlist_wants (item_id, user_id)
    VALUES (v_item.id, auth.uid())
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.couple_wishlist_wants AS w
     WHERE w.item_id = v_item.id AND w.user_id = auth.uid();
  END IF;
END;
$$;

-- Aynı anda iki kişi "yaptık" derse sonuncu kazanır. Geri alma yeni açık madde sayılır: aksi halde maddeleri
-- yapıldı işaretleyip yerine yenilerini eklemek ve sonra geri açmak sınırı boşa çıkarırdı.
CREATE OR REPLACE FUNCTION public.set_wishlist_done(p_item_id BIGINT, p_done BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item public.couple_wishlist_items%ROWTYPE;
BEGIN
  IF p_done IS NULL THEN
    RAISE EXCEPTION 'Geçersiz istek.' USING ERRCODE = '22023';
  END IF;

  v_item := public.wishlist_lock_visible_item(p_item_id);

  IF p_done THEN
    UPDATE public.couple_wishlist_items AS i
       SET status = 'done', done_at = NOW(), done_by = auth.uid()
     WHERE i.id = v_item.id;
  ELSIF v_item.status = 'done' THEN
    PERFORM public.wishlist_assert_capacity(v_item.couple_id, auth.uid());
    UPDATE public.couple_wishlist_items AS i
       SET status = 'open', done_at = NULL, done_by = NULL
     WHERE i.id = v_item.id;
  END IF;
END;
$$;


-- ============================================================================
-- 7. FONKSİYON YETKİLERİ
-- ============================================================================
REVOKE ALL ON FUNCTION public.wishlist_free_limit() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.wishlist_premium_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wishlist_assert_capacity(INTEGER, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wishlist_lock_visible_item(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_wishlist_enforce_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_wishlist_touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_wishlist_creator_wants() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_wishlist_want(BIGINT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_wishlist_done(BIGINT, BOOLEAN) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.wishlist_free_limit() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_wishlist_want(BIGINT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_wishlist_done(BIGINT, BOOLEAN) TO authenticated;

COMMIT;
