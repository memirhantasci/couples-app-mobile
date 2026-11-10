-- ============================================================================
-- Zorunlu güncelleme kapısı (20261111000000): yetki, kısıt ve RPC senaryoları
-- ----------------------------------------------------------------------------
-- Migration uygulanmış bir veritabanında çalışır. Tamamı tek işlemdir ve sonda ROLLBACK olur (iz bırakmaz);
-- yine de YALNIZCA YEREL / GEÇİCİ VERİTABANINDA ÇALIŞTIR.
--
--   psql "$YEREL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/app_version_gate_test.sql
--
-- Supabase rolleri (anon, authenticated) veritabanında bulunmalı. Her kontrol "ok - ..." yazar; ilk başarısız
-- kontrol "BAŞARISIZ: ..." hatasıyla betiği durdurur.
-- ============================================================================

\set ON_ERROR_STOP 1

BEGIN;

-- ─── 1. Başlangıç değerleri hiçbir sürümü engellemez ─────────────────────────
DO $$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM public.app_version_requirements;
  IF n <> 2 THEN RAISE EXCEPTION 'BAŞARISIZ: 2 platform satırı beklendi, % var', n; END IF;
  SELECT count(*) INTO n FROM public.app_version_requirements WHERE min_version IS NOT NULL OR min_build IS NOT NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'BAŞARISIZ: başlangıçta asgari sürüm dolu'; END IF;
  RAISE NOTICE 'ok - başlangıç: iki platform, asgari sürüm boş';
END $$;

-- ─── 2. Fonksiyon güvenlik ayarları ───────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  SELECT p.prosecdef, p.provolatile, p.proconfig INTO r
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_app_version_requirement';
  IF NOT r.prosecdef THEN RAISE EXCEPTION 'BAŞARISIZ: SECURITY DEFINER değil'; END IF;
  IF r.provolatile <> 's' THEN RAISE EXCEPTION 'BAŞARISIZ: STABLE değil'; END IF;
  IF NOT (r.proconfig @> ARRAY['search_path=""']) THEN RAISE EXCEPTION 'BAŞARISIZ: search_path sabit değil: %', r.proconfig; END IF;
  IF has_function_privilege('public', 'public.get_app_version_requirement(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'BAŞARISIZ: PUBLIC çalıştırabiliyor';
  END IF;
  IF NOT has_function_privilege('anon', 'public.get_app_version_requirement(text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_app_version_requirement(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'BAŞARISIZ: anon/authenticated çalıştıramıyor';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.app_version_requirements'::regclass) THEN
    RAISE EXCEPTION 'BAŞARISIZ: RLS kapalı';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_version_requirements') THEN
    RAISE EXCEPTION 'BAŞARISIZ: tabloda politika olmamalı';
  END IF;
  RAISE NOTICE 'ok - SECURITY DEFINER, STABLE, search_path sabit, yalnızca anon/authenticated çalıştırır, RLS açık, politika yok';
END $$;

-- ─── 3. İstemci rolleri tabloya dokunamaz, RPC'yi çağırabilir ────────────────
SET LOCAL ROLE anon;
DO $$
DECLARE j JSONB;
BEGIN
  j := public.get_app_version_requirement('ios');
  IF j IS NULL OR j->>'platform' <> 'ios' OR j->'min_version' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'BAŞARISIZ: anon ios yanıtı beklenmedik: %', j;
  END IF;
  IF j->>'store_url' <> 'https://apps.apple.com/app/id6829036716' THEN RAISE EXCEPTION 'BAŞARISIZ: ios mağaza adresi: %', j; END IF;
  j := public.get_app_version_requirement('android');
  IF j->>'store_url' <> 'https://play.google.com/store/apps/details?id=app.couplesky.mobile' THEN
    RAISE EXCEPTION 'BAŞARISIZ: android mağaza adresi: %', j;
  END IF;
  IF public.get_app_version_requirement('web') IS NOT NULL OR public.get_app_version_requirement(NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'BAŞARISIZ: bilinmeyen platform NULL dönmeli';
  END IF;
  RAISE NOTICE 'ok - anon: RPC çalışıyor, bilinmeyen platform NULL';

  BEGIN
    PERFORM 1 FROM public.app_version_requirements;
    RAISE EXCEPTION 'BAŞARISIZ: anon tabloyu okuyabildi';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.app_version_requirements SET min_version = '0.0.1';
    RAISE EXCEPTION 'BAŞARISIZ: anon güncelleyebildi';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.app_version_requirements (platform) VALUES ('ios');
    RAISE EXCEPTION 'BAŞARISIZ: anon ekleyebildi';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.app_version_requirements;
    RAISE EXCEPTION 'BAŞARISIZ: anon silebildi';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'ok - anon: tabloyu okuyamaz / yazamaz / silemez';
END $$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
DO $$
BEGIN
  IF public.get_app_version_requirement('android') IS NULL THEN RAISE EXCEPTION 'BAŞARISIZ: authenticated RPC NULL'; END IF;
  BEGIN
    PERFORM 1 FROM public.app_version_requirements;
    RAISE EXCEPTION 'BAŞARISIZ: authenticated tabloyu okuyabildi';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.app_version_requirements SET min_version = '99.0.0' WHERE platform = 'ios';
    RAISE EXCEPTION 'BAŞARISIZ: authenticated güncelleyebildi';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.app_version_requirements (platform, min_version) VALUES ('ios', '99.0.0')
      ON CONFLICT (platform) DO UPDATE SET min_version = EXCLUDED.min_version;
    RAISE EXCEPTION 'BAŞARISIZ: authenticated upsert yapabildi';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'ok - authenticated: RPC çalışıyor, tabloyu okuyamaz / yazamaz';
END $$;
RESET ROLE;

-- ─── 4. Kısıtlar bozuk değeri kabul etmez ────────────────────────────────────
DO $$
DECLARE bad TEXT;
BEGIN
  FOREACH bad IN ARRAY ARRAY['1.0.0-beta', 'v1.1.0', '', ' 1.1.0', '1..0', '1.0.0.0.0', '1234567.0'] LOOP
    BEGIN
      UPDATE public.app_version_requirements SET min_version = bad WHERE platform = 'ios';
      RAISE EXCEPTION 'BAŞARISIZ: bozuk sürüm kabul edildi: "%"', bad;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  BEGIN
    UPDATE public.app_version_requirements SET min_build = 10 WHERE platform = 'ios';
    RAISE EXCEPTION 'BAŞARISIZ: min_version olmadan min_build kabul edildi';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.app_version_requirements SET min_version = '1.1.0', min_build = 0 WHERE platform = 'ios';
    RAISE EXCEPTION 'BAŞARISIZ: min_build = 0 kabul edildi';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.app_version_requirements SET store_url = 'http://example.com' WHERE platform = 'ios';
    RAISE EXCEPTION 'BAŞARISIZ: https olmayan adres kabul edildi';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.app_version_requirements SET message_tr = '' WHERE platform = 'ios';
    RAISE EXCEPTION 'BAŞARISIZ: boş mesaj kabul edildi';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.app_version_requirements (platform) VALUES ('web');
    RAISE EXCEPTION 'BAŞARISIZ: bilinmeyen platform kabul edildi';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE 'ok - kısıtlar: bozuk sürüm, sürümsüz build, build 0, http adres, boş mesaj, bilinmeyen platform reddedildi';
END $$;

-- ─── 5. Yönetici yükseltir → RPC yansıtır; geri alır → boş döner ──────────────
-- (docs/ZORUNLU_GUNCELLEME.md'deki tek satırların aynısı)
UPDATE public.app_version_requirements SET min_version = '1.1.0', updated_at = now() WHERE platform IN ('ios', 'android');
UPDATE public.app_version_requirements SET message_tr = 'Yeni sürüm hazır.', message_en = 'A new version is ready.' WHERE platform = 'ios';
SET LOCAL ROLE anon;
DO $$
DECLARE j JSONB;
BEGIN
  j := public.get_app_version_requirement('ios');
  IF j->>'min_version' <> '1.1.0' OR j->>'message_tr' <> 'Yeni sürüm hazır.' OR j->>'message_en' <> 'A new version is ready.' THEN
    RAISE EXCEPTION 'BAŞARISIZ: yükseltme yansımadı: %', j;
  END IF;
  IF (public.get_app_version_requirement('android'))->>'min_version' <> '1.1.0' THEN RAISE EXCEPTION 'BAŞARISIZ: android yükseltme'; END IF;
  RAISE NOTICE 'ok - yükseltme RPC''de görünüyor';
END $$;
RESET ROLE;
UPDATE public.app_version_requirements SET min_version = NULL, min_build = NULL, updated_at = now() WHERE platform IN ('ios', 'android');
DO $$
BEGIN
  IF (public.get_app_version_requirement('ios'))->'min_version' <> 'null'::jsonb THEN RAISE EXCEPTION 'BAŞARISIZ: geri alma'; END IF;
  RAISE NOTICE 'ok - geri alma (min_version = NULL) kapıyı açıyor';
END $$;

ROLLBACK;

\echo 'app_version_gate_test: tüm kontroller geçti'
