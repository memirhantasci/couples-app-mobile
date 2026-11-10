-- ============================================================================
-- Ortak liste (Faz 1A): yetki ve sınır senaryoları
-- ----------------------------------------------------------------------------
-- Migration'lar (20261109000000 … 20261109000003) uygulanmış bir veritabanında çalışır.
-- YALNIZCA YEREL / GEÇİCİ VERİTABANINDA ÇALIŞTIR, CANLIDA ASLA (auth.users'a kayıt ekler ve kurulumu commit eder).
--
--   psql "$YEREL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/couple_wishlist_test.sql
--
-- Her kontrol "ok - ..." bildirimi yazar. İlk başarısız kontrol "BAŞARISIZ: ..." hatasıyla betiği durdurur.
-- Kullanıcı rolüne geçiş: SET ROLE authenticated + request.jwt.claims (PostgREST'in yaptığı gibi).
--
-- Yapı:
--   A. Kurulum (commit edilir). Çiftler GERÇEK akışla kurulur: join_couple_by_code_uuid, hesap silme için
--      purge_account_data. paired_at elle yazılmaz, eşleşmenin kendisi yazar. Eşleşme anı ifade zamanıdır
--      (statement_timestamp), madde created_at'i ise işlem zamanıdır (now()); bu yüzden "eşleşmeden önce/sonra"
--      ayrımı ayrı işlemlerle kurulur (aynı işlemde eklenen madde eşleşmeden önce sayılırdı).
--        A1 ilk eşleşmeler → A2 o dönemde eklenen maddeler → A3 hesap silmeler, Premium'un bitmesi
--        → A4 ikinci eşleşmeler (yeni partner, eski maddelerle başka çifte katılma = taşıma).
--   B. Senaryolar: tek işlem, sonda ROLLBACK.
--   C. Temizlik (commit). Betik yarıda kalırsa bir sonraki çalıştırma başta aynı temizliği yapar.
--
-- Not: uygulamada çiftten ayrılmanın tek yolu hesap silmedir. "Eski partner" bu yüzden hesabı silinmiş ama
-- oturum anahtarı henüz geçerli olan kişidir (auth.users kaydını Edge Function sonradan siler).
-- ============================================================================

\set ON_ERROR_STOP 1

-- Testin oluşturduğu çiftlerin kaydı. Temizlik YALNIZCA bu kayıttaki ve test kullanıcılarının çiftlerini siler;
-- eşleşme koduna (önek) bakmaz: gerçek bir çiftin kodu aynı harflerle başlasa bile o çifte dokunulmaz.
-- Betik yarıda kalırsa kayıt durur ve bir sonraki çalıştırmanın başındaki temizlik onu kullanır; sonda silinir.
CREATE SCHEMA IF NOT EXISTS wishlist_test_registry;
CREATE TABLE IF NOT EXISTS wishlist_test_registry.couples (id INTEGER PRIMARY KEY);

-- Oturum boyunca geçerli temizlik (başta ve sonda)
CREATE FUNCTION pg_temp.wishlist_test_cleanup() RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_users   UUID[];
  v_couples INTEGER[];
BEGIN
  PERFORM set_config('app.allow_couple_change', 'on', true);
  PERFORM set_config('app.allow_premium_override', 'on', true);
  PERFORM set_config('app.suppress_push', 'on', true);
  SELECT COALESCE(array_agg(id), '{}') INTO v_users FROM auth.users WHERE email LIKE '%@wishlist-test.invalid';
  SELECT COALESCE(array_agg(DISTINCT c), '{}') INTO v_couples
    FROM (
      SELECT couple_id AS c FROM public.users WHERE id = ANY(v_users) AND couple_id IS NOT NULL
      UNION
      SELECT id FROM wishlist_test_registry.couples
    ) AS t;
  UPDATE public.users SET couple_id = NULL WHERE id = ANY(v_users);
  DELETE FROM public.couples WHERE id = ANY(v_couples);
  DELETE FROM wishlist_test_registry.couples;
  DELETE FROM public.partner_notices WHERE user_id = ANY(v_users);
  DELETE FROM public.auth_rate_limits WHERE subject IN (SELECT unnest(v_users)::text);
  DELETE FROM public.users WHERE id = ANY(v_users);
  DELETE FROM auth.users WHERE id = ANY(v_users);
END;
$$;

SELECT pg_temp.wishlist_test_cleanup();
DROP SCHEMA IF EXISTS wishlist_test CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- Yardımcılar
-- ────────────────────────────────────────────────────────────────────────────
CREATE SCHEMA wishlist_test;
GRANT USAGE ON SCHEMA wishlist_test TO anon, authenticated;

CREATE FUNCTION wishlist_test.u(p_name TEXT) RETURNS UUID
LANGUAGE sql IMMUTABLE AS $$ SELECT md5('wishlist-test-' || p_name)::uuid $$;

CREATE FUNCTION wishlist_test.logout() RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claims', '', true);
END;
$$;

CREATE FUNCTION wishlist_test.login(p_name TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', wishlist_test.u(p_name), 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

CREATE FUNCTION wishlist_test.login_anon() RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  PERFORM set_config('role', 'anon', true);
END;
$$;

CREATE FUNCTION wishlist_test.ok(p_condition BOOLEAN, p_label TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF p_condition IS NOT TRUE THEN
    RAISE EXCEPTION 'BAŞARISIZ: %', p_label;
  END IF;
  RAISE NOTICE 'ok - %', p_label;
END;
$$;

CREATE FUNCTION wishlist_test.raises(p_sql TEXT, p_state TEXT, p_label TEXT, p_message TEXT DEFAULT NULL) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_state   TEXT;
  v_message TEXT;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  IF v_state IS NULL THEN
    RAISE EXCEPTION 'BAŞARISIZ: % (hata bekleniyordu, komut çalıştı)', p_label;
  END IF;
  IF v_state <> p_state OR (p_message IS NOT NULL AND v_message <> p_message) THEN
    RAISE EXCEPTION 'BAŞARISIZ: % (beklenen %, gelen %: %)', p_label, p_state, v_state, v_message;
  END IF;
  RAISE NOTICE 'ok - %', p_label;
END;
$$;

-- Kişinin şu anki çifti (hesabı silinmişse NULL)
CREATE FUNCTION wishlist_test.c(p_name TEXT) RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER AS $$ SELECT couple_id FROM public.users WHERE id = wishlist_test.u(p_name) $$;

CREATE FUNCTION wishlist_test.code_of(p_name TEXT) RETURNS TEXT
LANGUAGE sql SECURITY DEFINER AS $$ SELECT pairing_code FROM public.couples WHERE id = wishlist_test.c(p_name) $$;

CREATE FUNCTION wishlist_test.paired_at(p_name TEXT) RETURNS TIMESTAMPTZ
LANGUAGE sql SECURITY DEFINER AS $$ SELECT paired_at FROM public.couples WHERE id = wishlist_test.c(p_name) $$;

CREATE FUNCTION wishlist_test.item(p_title TEXT) RETURNS BIGINT
LANGUAGE sql SECURITY DEFINER AS $$ SELECT id FROM public.couple_wishlist_items WHERE title = p_title $$;

CREATE FUNCTION wishlist_test.open_count(p_name TEXT) RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::integer FROM public.couple_wishlist_items
   WHERE couple_id = wishlist_test.c(p_name) AND status = 'open';
$$;

-- Yeni kayıt olmuş kişi (gerçek şemada auth.users tetikleyicisi profil satırını kendisi açar). p_code verilirse
-- kişinin kendi tek üyeli çifti ve eşleşme kodu olur (kayıt sonrası "kodunu paylaş" durumu).
CREATE FUNCTION wishlist_test.signup(
  p_name TEXT,
  p_code TEXT DEFAULT NULL,
  p_premium BOOLEAN DEFAULT FALSE,
  p_premium_expires TIMESTAMPTZ DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_couple INTEGER;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (wishlist_test.u(p_name), p_name || '@wishlist-test.invalid');
  IF p_code IS NOT NULL THEN
    INSERT INTO public.couples (pairing_code, member_count, is_premium, premium_expires_at)
    VALUES (p_code, 1, p_premium, p_premium_expires)
    RETURNING id INTO v_couple;
    INSERT INTO wishlist_test_registry.couples (id) VALUES (v_couple);
  END IF;
  INSERT INTO public.users (id, display_name, couple_id)
  VALUES (wishlist_test.u(p_name), p_name, v_couple)
  ON CONFLICT (id) DO UPDATE SET couple_id = EXCLUDED.couple_id;
END;
$$;

-- Gerçek eşleşme: katılan kendi oturumuyla kodu girer
CREATE FUNCTION wishlist_test.join(p_joiner TEXT, p_owner TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_code   TEXT := wishlist_test.code_of(p_owner);
  v_couple INTEGER;
  v_paired BOOLEAN;
  v_error  TEXT;
BEGIN
  PERFORM wishlist_test.login(p_joiner);
  SELECT j.result_couple_id, j.result_is_paired, j.result_error INTO v_couple, v_paired, v_error
    FROM public.join_couple_by_code_uuid(v_code) AS j;
  PERFORM wishlist_test.logout();
  PERFORM wishlist_test.ok(v_error IS NULL AND v_paired AND v_couple = wishlist_test.c(p_owner),
    format('kurulum: %s, %s ile join_couple_by_code_uuid akışıyla eşleşir', p_joiner, p_owner));
END;
$$;

-- Kullanıcı olarak madde ekler (gerçek istemci yolu: RLS, sütun yetkisi, tetikleyiciler)
CREATE FUNCTION wishlist_test.add(p_name TEXT, p_title TEXT) RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE
  v_id BIGINT;
BEGIN
  PERFORM wishlist_test.login(p_name);
  INSERT INTO public.couple_wishlist_items (couple_id, created_by, title)
  VALUES (wishlist_test.c(p_name), wishlist_test.u(p_name), p_title)
  RETURNING id INTO v_id;
  PERFORM wishlist_test.logout();
  RETURN v_id;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- A1. Kayıt ve ilk eşleşmeler (commit)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM set_config('app.allow_couple_change', 'on', true);
  PERFORM set_config('app.allow_premium_override', 'on', true);

  -- ayse ↔ ekrem (ekrem hesabını silecek: ayşe'nin GERÇEK eski partneri), sonra ayse ↔ burak
  PERFORM wishlist_test.signup('ayse', 'WLTAYSE');
  PERFORM wishlist_test.signup('ekrem');
  PERFORM wishlist_test.signup('burak');
  PERFORM wishlist_test.signup('cem', 'WLTCEM');      -- başka çift
  PERFORM wishlist_test.signup('deniz');
  PERFORM wishlist_test.signup('selin', 'WLTSELN');   -- partneri (sami) hesabını silince tek kalan
  PERFORM wishlist_test.signup('sami');
  PERFORM wishlist_test.signup('lale', 'WLTLALE');    -- ücretsiz sınır
  PERFORM wishlist_test.signup('levent');
  PERFORM wishlist_test.signup('bora', 'WLTBORA');    -- çok satırlı ekleme
  PERFORM wishlist_test.signup('beste');
  PERFORM wishlist_test.signup('pelin', 'WLTPELN', TRUE, NULL);                     -- süresiz Premium
  PERFORM wishlist_test.signup('mert');
  PERFORM wishlist_test.signup('can', 'WLTCAN', TRUE, NOW() + INTERVAL '30 days'); -- Premium'u bitecek
  PERFORM wishlist_test.signup('cansu');
  PERFORM wishlist_test.signup('kerem', 'WLTKERM');   -- kerem ↔ xavi; xavi silinir; kerem eski maddeleriyle nil'e katılır
  PERFORM wishlist_test.signup('xavi');
  PERFORM wishlist_test.signup('nil', 'WLTNIL');
  PERFORM wishlist_test.signup('ali', 'WLTALI');      -- hesap silme (B bölümünde)
  PERFORM wishlist_test.signup('nur');
  PERFORM wishlist_test.signup('dina', 'WLTDINA');    -- çiftten ayrılma adımı tek başına (B bölümünde)
  PERFORM wishlist_test.signup('dora');
  PERFORM wishlist_test.signup('tolga', 'WLTTOLG');   -- tolga ↔ tara; tara silinir; tolga tuna'ya katılır
  PERFORM wishlist_test.signup('tara');
  PERFORM wishlist_test.signup('tuna', 'WLTTUNA');

  PERFORM wishlist_test.join('ekrem', 'ayse');
  PERFORM wishlist_test.join('deniz', 'cem');
  PERFORM wishlist_test.join('sami', 'selin');
  PERFORM wishlist_test.join('levent', 'lale');
  PERFORM wishlist_test.join('beste', 'bora');
  PERFORM wishlist_test.join('mert', 'pelin');
  PERFORM wishlist_test.join('cansu', 'can');
  PERFORM wishlist_test.join('xavi', 'kerem');
  PERFORM wishlist_test.join('nur', 'ali');
  PERFORM wishlist_test.join('dora', 'dina');
  PERFORM wishlist_test.join('tara', 'tolga');
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- A2. İlk eşleşme döneminde eklenen maddeler (commit; created_at > ilk paired_at)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM wishlist_test.add('ayse', 'Ayşe eski madde');
  PERFORM wishlist_test.add('ekrem', 'Ekrem maddesi');
  PERFORM wishlist_test.add('cem', 'Cem maddesi');
  PERFORM wishlist_test.add('selin', 'Selin maddesi');
  PERFORM wishlist_test.add('selin', 'Selin bağlı madde');
  PERFORM wishlist_test.add('tolga', 'Tolga maddesi');
  -- Premium döneminde 18 madde (ücretsiz sınırın üstü)
  PERFORM wishlist_test.add('can', 'Can maddesi ' || g) FROM generate_series(1, 18) AS g;
  -- Kerem'in xavi dönemindeki 15 açık maddesi
  PERFORM wishlist_test.add('kerem', 'Kerem eski ' || g) FROM generate_series(1, 15) AS g;

  PERFORM wishlist_test.ok(
    (SELECT bool_and(i.created_at > wishlist_test.paired_at('ayse')) FROM public.couple_wishlist_items AS i
      WHERE i.title IN ('Ayşe eski madde', 'Ekrem maddesi')),
    'kurulum: ilk dönemin maddeleri ilk eşleşmeden sonra (gerçek paired_at) eklendi');
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- A3. Hesap silmeler ve Premium'un bitmesi (commit)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- process-account-deletions'ın yaptığı gibi (servis): partner kalır, silenin içeriği gider
  PERFORM public.purge_account_data(wishlist_test.u('ekrem'));
  PERFORM public.purge_account_data(wishlist_test.u('sami'));
  PERFORM public.purge_account_data(wishlist_test.u('xavi'));
  PERFORM public.purge_account_data(wishlist_test.u('tara'));

  PERFORM set_config('app.allow_premium_override', 'on', true);
  UPDATE public.couples SET premium_expires_at = NOW() - INTERVAL '1 day' WHERE id = wishlist_test.c('can');

  PERFORM wishlist_test.ok(wishlist_test.c('ekrem') IS NULL AND wishlist_test.c('ayse') IS NOT NULL,
    'kurulum: ekrem hesabını sildi, ayşe çiftinde tek kaldı');
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- A4. İkinci eşleşmeler (commit): yeni partner; eski maddeleriyle başka çifte katılma (taşıma)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_tolga_old INTEGER := wishlist_test.c('tolga');
BEGIN
  PERFORM wishlist_test.join('burak', 'ayse');
  PERFORM wishlist_test.join('kerem', 'nil');
  PERFORM wishlist_test.join('tolga', 'tuna');

  PERFORM wishlist_test.ok(NOT EXISTS (SELECT 1 FROM public.couples WHERE id = v_tolga_old),
    'kurulum: katılanın boşalan eski çifti silindi');
  PERFORM wishlist_test.ok(
    wishlist_test.paired_at('ayse') > (SELECT created_at FROM public.couple_wishlist_items WHERE title = 'Ayşe eski madde'),
    'kurulum: yeni eşleşme anı (gerçek akıştan) eski maddeden sonra');
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- B. SENARYOLAR (tek işlem, sonda ROLLBACK)
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Ekleme
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_pair  INTEGER := wishlist_test.c('ayse');
  v_other INTEGER := wishlist_test.c('cem');
  v_ayse  UUID    := wishlist_test.u('ayse');
  v_id    BIGINT;
BEGIN
  PERFORM wishlist_test.login('ayse');

  INSERT INTO public.couple_wishlist_items (couple_id, created_by, title, category)
  VALUES (v_pair, v_ayse, 'Kapadokya', 'travel')
  RETURNING id INTO v_id;
  PERFORM wishlist_test.ok(
    EXISTS (SELECT 1 FROM public.couple_wishlist_wants WHERE item_id = v_id AND user_id = v_ayse),
    'ekleyen için istiyorum satırı otomatik açılır');
  PERFORM wishlist_test.ok(
    (SELECT status = 'open' AND done_at IS NULL FROM public.couple_wishlist_items WHERE id = v_id),
    'yeni madde açık başlar');

  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) VALUES (%s, %L, 'sahte')$q$,
    v_pair, wishlist_test.u('burak')), '42501', 'başkası adına eklenemez');
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) VALUES (%s, %L, 'sahte')$q$,
    v_other, v_ayse), '42501', 'başka çifte eklenemez');
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title, status, done_at) VALUES (%s, %L, 'hile', 'done', now())$q$,
    v_pair, v_ayse), '42501', 'istemci yapıldı olarak ekleyemez (sınır delinmez)');
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title, created_at) VALUES (%s, %L, 'hile', now() - interval '90 days')$q$,
    v_pair, v_ayse), '42501', 'istemci created_at veremez');

  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) VALUES (%s, %L, '   ')$q$,
    v_pair, v_ayse), '23514', 'boş başlık reddedilir');
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) VALUES (%s, %L, repeat('x', 81))$q$,
    v_pair, v_ayse), '23514', '81 karakterlik başlık reddedilir');
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title, note) VALUES (%s, %L, 'not', repeat('x', 301))$q$,
    v_pair, v_ayse), '23514', '301 karakterlik not reddedilir');
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title, category) VALUES (%s, %L, 'kat', 'gift')$q$,
    v_pair, v_ayse), '23514', 'listede olmayan kategori reddedilir');

  PERFORM wishlist_test.logout();
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Görünürlük (eşleşme anı gerçek akıştan)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_new BIGINT := wishlist_test.item('Kapadokya');
  v_old BIGINT := wishlist_test.item('Ayşe eski madde');
  v_cem BIGINT := wishlist_test.item('Cem maddesi');
  v_n   BIGINT;
BEGIN
  PERFORM wishlist_test.login('burak');
  PERFORM wishlist_test.ok(EXISTS (SELECT 1 FROM public.couple_wishlist_items WHERE id = v_new),
    'partner eşleşmeden sonraki maddeyi görür');
  PERFORM wishlist_test.ok(NOT EXISTS (SELECT 1 FROM public.couple_wishlist_items WHERE id = v_old),
    'yeni partner, ayşenin eski partneriyle olduğu dönemde eklenen maddeyi göremez');
  PERFORM wishlist_test.ok(NOT EXISTS (SELECT 1 FROM public.couple_wishlist_wants WHERE item_id = v_old),
    'yeni partner o maddenin istiyorum satırını göremez');
  PERFORM wishlist_test.ok(NOT EXISTS (SELECT 1 FROM public.couple_wishlist_items WHERE id = v_cem),
    'başka çiftin maddesi okunamaz');
  INSERT INTO public.couple_wishlist_items (couple_id, created_by, title)
  VALUES (wishlist_test.c('burak'), wishlist_test.u('burak'), 'Burak yeni madde');

  PERFORM wishlist_test.login('ayse');
  PERFORM wishlist_test.ok(EXISTS (SELECT 1 FROM public.couple_wishlist_items WHERE id = v_old),
    'ekleyen kendi eski maddesini görür');
  PERFORM wishlist_test.ok(wishlist_test.item('Ekrem maddesi') IS NULL,
    'eski partnerin (hesabı silindi) maddeleri çiftte kalmadı');

  PERFORM wishlist_test.login('cem');
  SELECT count(*) INTO v_n FROM public.couple_wishlist_items WHERE couple_id = wishlist_test.c('ayse');
  PERFORM wishlist_test.ok(v_n = 0, 'başka çift, çifte göre filtreleyerek de okuyamaz');
  PERFORM wishlist_test.ok(NOT EXISTS (SELECT 1 FROM public.couple_wishlist_wants WHERE item_id = v_new),
    'başka çift istiyorum satırlarını okuyamaz');

  -- Gerçek eski partner: hesabı silindi, oturum anahtarı henüz geçerli
  PERFORM wishlist_test.login('ekrem');
  SELECT count(*) INTO v_n FROM public.couple_wishlist_items;
  PERFORM wishlist_test.ok(v_n = 0, 'eski partner (oturumu açık) eski çiftin ve yeni partnerin hiçbir maddesini göremez');
  SELECT count(*) INTO v_n FROM public.couple_wishlist_wants;
  PERFORM wishlist_test.ok(v_n = 0, 'eski partner hiçbir istiyorum satırını göremez');
  -- Profil satırı silindiği için önce tek kalan kapısı (kendi durumu, hedef çift hakkında bilgi vermez) reddeder
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) VALUES (%s, %L, 'geri dönüş')$q$,
    wishlist_test.c('ayse'), wishlist_test.u('ekrem')), 'P0020', 'eski partner eski çiftine ekleyemez');
  PERFORM wishlist_test.raises(format('SELECT public.set_wishlist_want(%s, true)', v_new),
    'P0020', 'eski partner RPC ile eski çiftin maddesine dokunamaz');

  PERFORM wishlist_test.login_anon();
  PERFORM wishlist_test.raises('SELECT 1 FROM public.couple_wishlist_items', '42501', 'anon tabloyu okuyamaz');
  PERFORM wishlist_test.raises('SELECT 1 FROM public.couple_wishlist_wants', '42501', 'anon istiyorum tablosunu okuyamaz');

  PERFORM wishlist_test.logout();
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Düzenleme ve silme yalnızca ekleyenin
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_id BIGINT := wishlist_test.item('Kapadokya');
  v_n  INTEGER;
BEGIN
  UPDATE public.couple_wishlist_items SET updated_at = NOW() - INTERVAL '1 day' WHERE id = v_id;

  PERFORM wishlist_test.login('burak');
  UPDATE public.couple_wishlist_items SET title = 'Burak değiştirdi' WHERE id = v_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM wishlist_test.ok(v_n = 0, 'partner başkasının maddesini düzenleyemez');
  DELETE FROM public.couple_wishlist_items WHERE id = v_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM wishlist_test.ok(v_n = 0, 'partner başkasının maddesini silemez');

  PERFORM wishlist_test.login('ayse');
  UPDATE public.couple_wishlist_items SET title = 'Kapadokya balon', note = 'Baharda' WHERE id = v_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM wishlist_test.ok(v_n = 1, 'ekleyen düzenler');
  PERFORM wishlist_test.ok(
    (SELECT updated_at >= NOW() FROM public.couple_wishlist_items WHERE id = v_id),
    'updated_at tetikleyiciyle yenilenir');

  PERFORM wishlist_test.raises(format(
    $q$UPDATE public.couple_wishlist_items SET status = 'done', done_at = now() WHERE id = %s$q$, v_id),
    '42501', 'status yalnızca RPC ile değişir');
  PERFORM wishlist_test.raises(format(
    $q$UPDATE public.couple_wishlist_items SET done_by = auth.uid() WHERE id = %s$q$, v_id),
    '42501', 'done_by yalnızca sunucuda yazılır');
  PERFORM wishlist_test.raises(format(
    $q$UPDATE public.couple_wishlist_items SET couple_id = %s WHERE id = %s$q$, wishlist_test.c('cem'), v_id),
    '42501', 'madde başka çifte taşınamaz');
  PERFORM wishlist_test.raises(format(
    $q$UPDATE public.couple_wishlist_items SET created_by = %L WHERE id = %s$q$, wishlist_test.u('burak'), v_id),
    '42501', 'created_by değişmez');
  PERFORM wishlist_test.raises(format(
    $q$UPDATE public.couple_wishlist_items SET created_at = now() WHERE id = %s$q$, v_id),
    '42501', 'created_at değişmez (eski madde partnere açılamaz)');
  PERFORM wishlist_test.raises(format(
    $q$UPDATE public.couple_wishlist_items SET meeting_id = 1 WHERE id = %s$q$, v_id),
    '42501', 'Faz 2 bağlantısı doğrudan yazılamaz');

  PERFORM wishlist_test.logout();
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. İstiyorum / yaptık
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_id    BIGINT := wishlist_test.item('Kapadokya balon');
  v_old   BIGINT := wishlist_test.item('Ayşe eski madde');
  v_cem   BIGINT := wishlist_test.item('Cem maddesi');
  v_burak UUID   := wishlist_test.u('burak');
  v_ayse  UUID   := wishlist_test.u('ayse');
  v_n     INTEGER;
  v_item  public.couple_wishlist_items%ROWTYPE;
BEGIN
  PERFORM wishlist_test.login('burak');

  PERFORM public.set_wishlist_want(v_id, TRUE);
  PERFORM public.set_wishlist_want(v_id, TRUE);
  SELECT count(*) INTO v_n FROM public.couple_wishlist_wants WHERE item_id = v_id;
  PERFORM wishlist_test.ok(v_n = 2, 'partner istiyorum der, tekrar çağrı çift satır açmaz');
  PERFORM public.set_wishlist_want(v_id, FALSE);
  PERFORM wishlist_test.ok(
    NOT EXISTS (SELECT 1 FROM public.couple_wishlist_wants WHERE item_id = v_id AND user_id = v_burak),
    'partner istiyorum satırını geri alır');
  DELETE FROM public.couple_wishlist_wants WHERE item_id = v_id AND user_id = v_ayse;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM wishlist_test.ok(v_n = 0, 'başkasının istiyorum satırı silinemez');

  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_wants (item_id, user_id) VALUES (%s, %L)$q$, v_id, v_ayse),
    '42501', 'başkası adına istiyorum satırı açılamaz');
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_wants (item_id, user_id) VALUES (%s, %L)$q$, v_cem, v_burak),
    '42501', 'başka çiftin maddesine istiyorum satırı açılamaz');
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_wants (item_id, user_id) VALUES (%s, %L)$q$, v_old, v_burak),
    '42501', 'göremediği eski maddeye istiyorum satırı açılamaz');

  PERFORM wishlist_test.raises(format('SELECT public.set_wishlist_want(%s, true)', v_cem),
    '42501', 'RPC: başka çiftin maddesi reddedilir (istiyorum)');
  PERFORM wishlist_test.raises(format('SELECT public.set_wishlist_done(%s, true)', v_cem),
    '42501', 'RPC: başka çiftin maddesi reddedilir (yaptık)');
  PERFORM wishlist_test.raises(format('SELECT public.set_wishlist_want(%s, true)', v_old),
    '42501', 'RPC: eşleşmeden önceki madde reddedilir (istiyorum)');
  PERFORM wishlist_test.raises(format('SELECT public.set_wishlist_done(%s, true)', v_old),
    '42501', 'RPC: eşleşmeden önceki madde reddedilir (yaptık)');
  PERFORM wishlist_test.raises(format('SELECT public.set_wishlist_done(%s, NULL)', v_id),
    '22023', 'RPC: boş değer reddedilir');

  -- İki kişi de "yaptık" işaretler; tarih ve kişi sunucuda yazılır
  PERFORM public.set_wishlist_done(v_id, TRUE);
  SELECT * INTO v_item FROM public.couple_wishlist_items WHERE id = v_id;
  PERFORM wishlist_test.ok(v_item.status = 'done' AND v_item.done_by = v_burak AND v_item.done_at IS NOT NULL,
    'partner başkasının maddesini yapıldı işaretler');

  -- Zaten yapılmış maddeye ikinci "yaptık" (20261109000003): ilk işaretleyenin tarihi ve imzası korunur
  PERFORM wishlist_test.logout();
  ALTER TABLE public.couple_wishlist_items DISABLE TRIGGER trg_wishlist_updated_at;
  UPDATE public.couple_wishlist_items
     SET done_at = NOW() - INTERVAL '2 days', updated_at = NOW() - INTERVAL '2 days'
   WHERE id = v_id;
  ALTER TABLE public.couple_wishlist_items ENABLE TRIGGER trg_wishlist_updated_at;
  PERFORM wishlist_test.login('ayse');
  PERFORM public.set_wishlist_done(v_id, TRUE);
  PERFORM wishlist_test.login('burak');
  PERFORM public.set_wishlist_done(v_id, TRUE);
  SELECT * INTO v_item FROM public.couple_wishlist_items WHERE id = v_id;
  PERFORM wishlist_test.ok(
    v_item.status = 'done' AND v_item.done_by = v_burak
    AND v_item.done_at = NOW() - INTERVAL '2 days' AND v_item.updated_at = NOW() - INTERVAL '2 days',
    'zaten yapılmış maddeye tekrar yaptık: hata yok, tarih/kişi/updated_at değişmez');

  PERFORM wishlist_test.login('ayse');
  PERFORM public.set_wishlist_done(v_id, FALSE);
  SELECT * INTO v_item FROM public.couple_wishlist_items WHERE id = v_id;
  PERFORM wishlist_test.ok(v_item.status = 'open' AND v_item.done_by IS NULL AND v_item.done_at IS NULL,
    'yaptık geri alınır, tarih ve kişi temizlenir');
  PERFORM public.set_wishlist_done(v_id, FALSE);
  PERFORM wishlist_test.ok(TRUE, 'zaten açık maddeyi geri almak hata vermez');

  PERFORM wishlist_test.ok(public.wishlist_free_limit() = 15, 'wishlist_free_limit() = 15');
  PERFORM wishlist_test.raises('SELECT public.wishlist_premium_limit()', '42501', 'iç sınır fonksiyonu istemciye kapalı');
  PERFORM wishlist_test.raises(format('SELECT public.wishlist_assert_capacity(1, %L)', v_ayse),
    '42501', 'sınır yardımcısı istemciye kapalı');
  PERFORM wishlist_test.raises(format('SELECT public.wishlist_lock_visible_item(%s)', v_id),
    '42501', 'kilit yardımcısı istemciye kapalı');

  PERFORM wishlist_test.login_anon();
  PERFORM wishlist_test.raises(format('SELECT public.set_wishlist_want(%s, true)', v_id), '42501', 'anon RPC çağıramaz (istiyorum)');
  PERFORM wishlist_test.raises(format('SELECT public.set_wishlist_done(%s, true)', v_id), '42501', 'anon RPC çağıramaz (yaptık)');

  -- Gövde de anonu reddeder; yetkinin kapalı olduğu ayrıca doğrulanır
  PERFORM wishlist_test.logout();
  PERFORM wishlist_test.ok(
    NOT has_function_privilege('anon', 'public.set_wishlist_want(bigint, boolean)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.set_wishlist_done(bigint, boolean)', 'EXECUTE'),
    'anon rolünde RPC yetkisi yok');
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Madde sınırı
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_couple INTEGER := wishlist_test.c('lale');
  v_lale   UUID    := wishlist_test.u('lale');
  v_levent UUID    := wishlist_test.u('levent');
  v_done   BIGINT;
BEGIN
  PERFORM wishlist_test.login('lale');
  INSERT INTO public.couple_wishlist_items (couple_id, created_by, title)
  SELECT v_couple, v_lale, 'Lale ' || g FROM generate_series(1, 15) AS g;
  PERFORM wishlist_test.ok(wishlist_test.open_count('lale') = 15, 'ücretsiz çift 15 açık madde ekler');

  PERFORM wishlist_test.login('levent');
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) VALUES (%s, %L, 'on altinci')$q$,
    v_couple, v_levent), 'P0022', '16. madde reddedilir (sınır iki kişiye ortak)', 'WISHLIST_LIMIT');

  -- Yapılanlar sayılmaz
  v_done := wishlist_test.item('Lale 1');
  PERFORM public.set_wishlist_done(v_done, TRUE);
  INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) VALUES (v_couple, v_levent, 'Yerine yeni');
  PERFORM wishlist_test.ok(wishlist_test.open_count('lale') = 15, 'yapılan madde sınırdan düşer, yerine yenisi eklenir');

  -- Geri açma sınırı aşamaz
  PERFORM wishlist_test.raises(format('SELECT public.set_wishlist_done(%s, false)', v_done),
    'P0022', 'sınır doluyken yapılan madde geri açılamaz', 'WISHLIST_LIMIT');
  PERFORM public.set_wishlist_done(wishlist_test.item('Lale 2'), TRUE);
  PERFORM public.set_wishlist_done(v_done, FALSE);
  PERFORM wishlist_test.ok(wishlist_test.open_count('lale') = 15, 'yer açılınca geri açılır');

  -- Çok satırlı ekleme tek tek sayılır ve bütünüyle geri alınır
  PERFORM wishlist_test.login('bora');
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) SELECT %s, %L, 'Toplu ' || g FROM generate_series(1, 16) AS g$q$,
    wishlist_test.c('bora'), wishlist_test.u('bora')), 'P0022', 'tek komutla 16 madde reddedilir', 'WISHLIST_LIMIT');
  PERFORM wishlist_test.ok(wishlist_test.open_count('bora') = 0, 'reddedilen toplu eklemeden satır kalmaz');

  -- Premium
  PERFORM wishlist_test.login('pelin');
  INSERT INTO public.couple_wishlist_items (couple_id, created_by, title)
  SELECT wishlist_test.c('pelin'), wishlist_test.u('pelin'), 'Premium ' || g FROM generate_series(1, 16) AS g;
  PERFORM wishlist_test.ok(wishlist_test.open_count('pelin') = 16, 'Premium çiftte 16. madde geçer');
  INSERT INTO public.couple_wishlist_items (couple_id, created_by, title)
  SELECT wishlist_test.c('pelin'), wishlist_test.u('pelin'), 'Premium ' || g FROM generate_series(17, 300) AS g;
  PERFORM wishlist_test.ok(wishlist_test.open_count('pelin') = 300, 'Premium çift 300 açık maddeye çıkar');
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) VALUES (%s, %L, 'fazla')$q$,
    wishlist_test.c('pelin'), wishlist_test.u('pelin')), 'P0022', 'Premium teknik üst sınırı: 301. reddedilir', 'WISHLIST_LIMIT');

  -- Premium'u biten: hiçbir şey silinmez, yeni ekleme kilitli, düzenleme ve silme serbest
  PERFORM wishlist_test.login('cansu');
  PERFORM wishlist_test.ok(wishlist_test.open_count('can') = 18, 'Premium bitince maddeler silinmez');
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) VALUES (%s, %L, 'yeni')$q$,
    wishlist_test.c('can'), wishlist_test.u('cansu')), 'P0022', 'Premium bitince sınır üstünde yeni ekleme kilitli', 'WISHLIST_LIMIT');
  PERFORM public.set_wishlist_want(wishlist_test.item('Can maddesi 1'), TRUE);
  PERFORM wishlist_test.ok(TRUE, 'Premium bitince istiyorum çalışır');

  -- Sayım ekleyenin gördüğü maddelerdir: eşleşmede taşınan eski maddeler yeni partnerin hakkından yemez
  PERFORM wishlist_test.ok(wishlist_test.open_count('nil') = 15 AND wishlist_test.c('kerem') = wishlist_test.c('nil'),
    'hazırlık: kerem nil''e katılınca 15 eski maddesi çifte taşındı (join_couple_by_code_uuid)');
  PERFORM wishlist_test.login('nil');
  PERFORM wishlist_test.ok(NOT EXISTS (SELECT 1 FROM public.couple_wishlist_items WHERE title LIKE 'Kerem eski %'),
    'yeni partner taşınan maddeleri göremez');
  INSERT INTO public.couple_wishlist_items (couple_id, created_by, title)
  VALUES (wishlist_test.c('nil'), wishlist_test.u('nil'), 'Nil maddesi');
  PERFORM wishlist_test.ok(wishlist_test.item('Nil maddesi') IS NOT NULL, 'yeni partner, göremediği eski maddeler yüzünden kilitlenmez');
  PERFORM wishlist_test.login('kerem');
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) VALUES (%s, %L, 'kerem fazla')$q$,
    wishlist_test.c('kerem'), wishlist_test.u('kerem')), 'P0022', 'taşınan maddeler sahibinin hakkından yer', 'WISHLIST_LIMIT');

  PERFORM wishlist_test.logout();
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Tek kalan (partneri hesabını sildi)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_couple  INTEGER := wishlist_test.c('selin');
  v_selin   UUID    := wishlist_test.u('selin');
  v_id      BIGINT  := wishlist_test.item('Selin maddesi');
  v_link    BIGINT  := wishlist_test.item('Selin bağlı madde');
  v_meeting BIGINT;
  v_n       INTEGER;
BEGIN
  -- Faz 2 bağı yalnızca sunucuda yazılır (servis olarak kurulur)
  INSERT INTO public.meetings (couple_id, user_id, title, meeting_datetime, is_active)
  VALUES (v_couple, v_selin, 'Eski plan', NOW() + INTERVAL '1 day', TRUE)
  RETURNING id INTO v_meeting;
  UPDATE public.couple_wishlist_items SET meeting_id = v_meeting WHERE id = v_link;

  PERFORM wishlist_test.login('selin');
  PERFORM wishlist_test.ok(EXISTS (SELECT 1 FROM public.couple_wishlist_items WHERE id = v_id), 'tek kalan kendi maddesini görür');
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) VALUES (%s, %L, 'yeni')$q$,
    v_couple, v_selin), 'P0020', 'tek kalan madde ekleyemez');
  PERFORM wishlist_test.raises(format(
    $q$UPDATE public.couple_wishlist_items SET title = 'değişti' WHERE id = %s$q$, v_id),
    'P0020', 'tek kalan maddesini düzenleyemez');
  PERFORM wishlist_test.raises(format('SELECT public.set_wishlist_want(%s, false)', v_id), 'P0020', 'tek kalan istiyorum diyemez (RPC)');
  PERFORM wishlist_test.raises(format('SELECT public.set_wishlist_done(%s, true)', v_id), 'P0020', 'tek kalan yaptık diyemez (RPC)');

  DELETE FROM public.couple_wishlist_wants WHERE item_id = v_id AND user_id = v_selin;
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_wants (item_id, user_id) VALUES (%s, %L)$q$, v_id, v_selin),
    'P0020', 'tek kalan istiyorum satırı açamaz');

  -- Silme serbest: bağlı buluşmayı silmek ON DELETE SET NULL ile kısıta takılmamalı
  DELETE FROM public.meetings WHERE id = v_meeting;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM wishlist_test.ok(v_n = 1, 'tek kalan, maddeye bağlı buluşmasını silebilir');
  PERFORM wishlist_test.ok(
    (SELECT meeting_id IS NULL FROM public.couple_wishlist_items WHERE id = v_link),
    'buluşma silinince madde kalır, bağ boşalır');

  DELETE FROM public.couple_wishlist_items WHERE id = v_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM wishlist_test.ok(v_n = 1, 'tek kalan maddesini silebilir');

  PERFORM wishlist_test.logout();
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. Hesap silme ve yeni eşleşmede taşıma
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_ali  UUID := wishlist_test.u('ali');
  v_a    BIGINT;
  v_n    BIGINT;
  v_item public.couple_wishlist_items%ROWTYPE;
BEGIN
  -- Çiftten ayrılma adımı: purge_account_data'nın genel temizliğinden bağımsız doğrulanır
  PERFORM wishlist_test.add('dina', 'Dina maddesi');
  PERFORM wishlist_test.add('dora', 'Dora maddesi');
  PERFORM public.dissolve_couple_for_leaving_member(wishlist_test.c('dina'), wishlist_test.u('dina'));
  PERFORM wishlist_test.ok(NOT EXISTS (SELECT 1 FROM public.couple_wishlist_items WHERE title = 'Dina maddesi'),
    'ayrılma adımı silenin maddesini temizler');
  PERFORM wishlist_test.ok(EXISTS (SELECT 1 FROM public.couple_wishlist_items WHERE title = 'Dora maddesi'),
    'ayrılma adımı partnerin maddesine dokunmaz');

  -- Ali siler, Nur kalır
  v_a := wishlist_test.add('ali', 'Ali maddesi');
  PERFORM wishlist_test.add('nur', 'Nur maddesi');
  PERFORM wishlist_test.login('ali');
  PERFORM public.set_wishlist_want(wishlist_test.item('Nur maddesi'), TRUE);
  PERFORM public.set_wishlist_done(wishlist_test.item('Nur maddesi'), TRUE);
  PERFORM wishlist_test.login('nur');
  PERFORM public.set_wishlist_want(v_a, TRUE);
  PERFORM wishlist_test.logout();

  PERFORM public.purge_account_data(v_ali);

  PERFORM wishlist_test.ok(NOT EXISTS (SELECT 1 FROM public.couple_wishlist_items WHERE id = v_a),
    'silenin maddesi gider');
  SELECT * INTO v_item FROM public.couple_wishlist_items WHERE title = 'Nur maddesi';
  PERFORM wishlist_test.ok(v_item.id IS NOT NULL, 'partnerin maddesi kalır');
  PERFORM wishlist_test.ok(v_item.status = 'done' AND v_item.done_at IS NOT NULL AND v_item.done_by IS NULL,
    'silenin yaptık imzası boşalır, durum ve tarih korunur');
  SELECT count(*) INTO v_n FROM public.couple_wishlist_wants WHERE user_id = v_ali;
  PERFORM wishlist_test.ok(v_n = 0, 'silenin istiyorum satırları gider');
  SELECT count(*) INTO v_n FROM public.couple_wishlist_wants WHERE item_id = v_a;
  PERFORM wishlist_test.ok(v_n = 0, 'silinen maddenin istiyorum satırları gider');

  -- Tolga (partneri hesabını sildi, tek kaldı) tuna'nın koduyla eşleşti (A4, join_couple_by_code_uuid):
  -- maddesi yeni çifte taşındı, yeni partner göremez
  PERFORM wishlist_test.ok(
    (SELECT couple_id = wishlist_test.c('tuna') FROM public.couple_wishlist_items WHERE title = 'Tolga maddesi'),
    'eşleşmede madde yeni çifte taşınır');
  PERFORM wishlist_test.login('tolga');
  PERFORM wishlist_test.ok(EXISTS (SELECT 1 FROM public.couple_wishlist_items WHERE title = 'Tolga maddesi'),
    'taşınan maddeyi sahibi görür');
  PERFORM public.set_wishlist_want(wishlist_test.item('Tolga maddesi'), TRUE);
  PERFORM wishlist_test.ok(TRUE, 'sahibi taşınan maddesinde RPC kullanabilir');
  PERFORM wishlist_test.login('tuna');
  PERFORM wishlist_test.ok(NOT EXISTS (SELECT 1 FROM public.couple_wishlist_items WHERE title = 'Tolga maddesi'),
    'taşınan maddeyi yeni partner göremez');
  PERFORM wishlist_test.raises(format('SELECT public.set_wishlist_done(%s, true)', wishlist_test.item('Tolga maddesi')),
    '42501', 'yeni partner taşınan maddeyi RPC ile de işaretleyemez');

  PERFORM wishlist_test.logout();
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 8. Başka çift adına ekleme bilgi sızdırmaz (20261109000002)
-- ────────────────────────────────────────────────────────────────────────────
-- Sınır tetikleyicisi RLS'ten önce çalışır. Kimlik kontrolü olmasaydı hedef çift doluysa P0022, değilse 42501
-- dönerdi: başka bir çiftin listesinin dolu olup olmadığı ve Premium'u dışarıdan okunurdu.
DO $$
DECLARE
  v_rls  CONSTANT TEXT := 'new row violates row-level security policy for table "couple_wishlist_items"';
  v_cem  UUID := wishlist_test.u('cem');
  v_name TEXT;
BEGIN
  PERFORM wishlist_test.ok(wishlist_test.open_count('lale') = 15, 'hazırlık: ücretsiz hedef çift dolu (15)');
  PERFORM wishlist_test.ok(wishlist_test.open_count('bora') = 0, 'hazırlık: ücretsiz hedef çift boş');
  PERFORM wishlist_test.ok(wishlist_test.open_count('pelin') = 300, 'hazırlık: Premium hedef çift üst sınırda');

  PERFORM wishlist_test.login('cem');
  FOREACH v_name IN ARRAY ARRAY['lale', 'bora', 'pelin', 'can'] LOOP
    PERFORM wishlist_test.raises(format(
      $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) VALUES (%s, %L, 'sızma')$q$,
      wishlist_test.c(v_name), v_cem), '42501',
      format('başka çifte (%s) ekleme: hedefin doluluğundan bağımsız aynı RLS hatası', v_name), v_rls);
  END LOOP;

  -- Başka çiftin üyesi adına, o çifte: yine aynı hata (sayım hiç yapılmaz)
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) VALUES (%s, %L, 'sızma')$q$,
    wishlist_test.c('lale'), wishlist_test.u('lale')), '42501', 'başkası adına başka çifte: aynı RLS hatası', v_rls);
  -- Kendi çiftine, partneri adına
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) VALUES (%s, %L, 'sızma')$q$,
    wishlist_test.c('cem'), wishlist_test.u('deniz')), '42501', 'partner adına kendi çiftine: aynı RLS hatası', v_rls);

  PERFORM wishlist_test.ok(wishlist_test.open_count('bora') = 0 AND wishlist_test.open_count('lale') = 15,
    'reddedilen eklemelerden satır kalmaz');

  -- Kendi çiftine kendi adına ekleme etkilenmez; kendi çifti doluysa sınır hatası görünür
  INSERT INTO public.couple_wishlist_items (couple_id, created_by, title)
  VALUES (wishlist_test.c('cem'), v_cem, 'Cem kendi listesine');
  PERFORM wishlist_test.ok(wishlist_test.item('Cem kendi listesine') IS NOT NULL, 'kendi çiftine ekleme çalışır');
  PERFORM wishlist_test.login('lale');
  PERFORM wishlist_test.raises(format(
    $q$INSERT INTO public.couple_wishlist_items (couple_id, created_by, title) VALUES (%s, %L, 'on altinci')$q$,
    wishlist_test.c('lale'), wishlist_test.u('lale')), 'P0022', 'kendi dolu çiftinde sınır hatası görünür', 'WISHLIST_LIMIT');

  PERFORM wishlist_test.logout();
END;
$$;

SELECT 'couple_wishlist_test: tüm kontroller geçti' AS sonuc;

ROLLBACK;

-- ════════════════════════════════════════════════════════════════════════════
-- C. Temizlik (commit)
-- ════════════════════════════════════════════════════════════════════════════
SELECT pg_temp.wishlist_test_cleanup();
DROP SCHEMA wishlist_test CASCADE;
DROP SCHEMA wishlist_test_registry CASCADE;
