-- ============================================================================
-- MIGRATION: 20261105000000_letters_insert_and_update_hardening.sql
--
-- Üç küçük sertleştirme (denetim raporu G-02, G-08, G-07):
--
-- 1. letters: 003/008'in genel döngüsünden kalan "Insert own sent letters" politikası ve tablo INSERT
--    yetkisi duruyordu. İstemci mektubu yalnızca `save_letter` RPC'siyle yazar (SECURITY DEFINER, tablo
--    sahibi olarak çalışır; token/Premium kapısı, alıcı ve couple_id doğrulaması orada). Politika açık
--    kaldıkça PostgREST'e doğrudan POST atan biri bu kapıların hepsini atlayabiliyordu.
--
-- 2. meetings, calendar_notes: INSERT politikaları 018'de couple_id'yi doğrulayacak şekilde sıkılaştırıldı
--    ama 008'den kalan "Update own data" yalnızca USING (user_id = auth.uid()) içeriyordu; WITH CHECK
--    olmadığından USING yeni satıra da uygulanır ve kendi satırının couple_id'sini başka bir çiftinkiyle
--    değiştiren kişi o çiftin takvimine / buluşma listesine kayıt düşürebiliyordu. 20261029000003 aynı
--    düzeltmeyi yalnızca daily_notes, moods, medicines, medicine_logs, period_logs için yapmıştı.
--    Politika yalnızca zaten varsa yeniden yazılır (olmayan bir politika eklenip erişimi genişletilmez).
--
-- 3. earn_tokens: günlük 25 reklam sınırı COUNT ile okunuyor, kilit yoktu; paralel çağrıların hepsi
--    sınırın altında görüp geçebiliyordu. Aynı kullanıcının çağrıları artık bir danışma kilidiyle
--    sıraya girer. Gövde 023'teki sürümle aynıdır; tek fark kilit satırıdır.
--
-- Uygulamadan önce (canlıda elle değişmiş olabilir):
--   select polname from pg_policy where polrelid = 'public.letters'::regclass;
--   select polname, polcmd from pg_policy where polrelid in ('public.meetings'::regclass, 'public.calendar_notes'::regclass);
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. letters: doğrudan INSERT kapalı, yalnızca save_letter RPC'si
-- ────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Insert own sent letters" ON public.letters;
REVOKE INSERT ON public.letters FROM anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. meetings, calendar_notes: UPDATE sonrası couple_id de kendi çifti olmalı
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['meetings', 'calendar_notes']
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = t AND policyname = 'Update own data'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = t AND column_name = 'couple_id'
    ) THEN
      EXECUTE format('DROP POLICY "Update own data" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "Update own data" ON public.%I FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()) AND couple_id = (SELECT public.get_my_couple_id()))',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. earn_tokens: günlük sınır eşzamanlı çağrıyla aşılamasın
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.earn_tokens(p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_amount integer;
  v_new_balance integer;
  v_today_count integer;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Aynı kullanıcının eşzamanlı çağrıları sırayla işlenir: sayım ile INSERT arasına başka çağrı giremez
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('earn_tokens:' || v_user_id::text, 0));

  -- Güvenlik: Ödül miktarı sunucuda sabittir, istemciden parametre alınmaz!
  IF p_reason = 'ad_reward' THEN
    v_amount := 25;

    -- Günlük maksimum 25 reklam izleme limiti (spam / bot engeli)
    SELECT COUNT(*) INTO v_today_count
    FROM public.token_transactions
    WHERE user_id = v_user_id
      AND reason = 'ad_reward'
      AND created_at >= (statement_timestamp() - interval '24 hours');

    IF v_today_count >= 25 THEN
      RAISE EXCEPTION 'Günlük reklam izleme sınırına ulaştınız. Lütfen daha sonra tekrar deneyin.'
        USING ERRCODE = 'P0003';
    END IF;
  ELSE
    RAISE EXCEPTION 'Geçersiz ödül sebebi' USING ERRCODE = '22023';
  END IF;

  -- Migration 018 trigger'ı için bayrağı set et
  PERFORM set_config('app.allow_token_change', 'true', true);

  UPDATE public.users
  SET token_balance = COALESCE(token_balance, 0) + v_amount
  WHERE id = v_user_id
  RETURNING token_balance INTO v_new_balance;

  INSERT INTO public.token_transactions (user_id, amount, reason)
  VALUES (v_user_id, v_amount, p_reason);

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.earn_tokens(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.earn_tokens(text) TO authenticated;

COMMIT;
