-- ============================================================================
-- Mektup açılışı: Türkiye saatiyle gece yarısı (Europe/Istanbul, UTC+3)
-- ============================================================================
-- Önceden mektup unlock_date gününün 00:00 UTC'sinde (Türkiye'de 03:00) açılıyordu. Artık açılış anı
-- unlock_date günü 00:00 Europe/Istanbul'dur (önceki günün 21:00 UTC'si). Türkiye'de yaz saati
-- uygulaması 2016'dan beri yoktur, açılış her yıl aynı saattir.
--
-- "Bugün" artık public.app_today() = Türkiye tarihidir. Aşağıdakiler CURRENT_DATE (UTC günü) yerine bunu kullanır:
--   • letters SELECT politikası (alıcı mektubu açılış gününden itibaren görür)
--   • get_my_pending_letter_unlocks, set_letter_hidden, request_letter_deletion, respond_letter_deletion
--   • letter_unlock_at (silme/gizleme zamanlayıcılarının tabanı)
-- Fonksiyon gövdeleri mevcut en güncel tanımlarından CURRENT_DATE → public.app_today() dönüşümüyle üretilmiştir.
-- İstemci (letterPolicy, letterArrival, ana sayfa) ve send-push aynı kurala çekildi.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.app_today()
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT (now() AT TIME ZONE 'Europe/Istanbul')::date;
$$;

REVOKE ALL ON FUNCTION public.app_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_today() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.letter_unlock_at(p_unlock_date DATE)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT p_unlock_date::timestamp AT TIME ZONE 'Europe/Istanbul';
$$;

DROP POLICY IF EXISTS "View letters involved in" ON public.letters;
CREATE POLICY "View letters involved in" ON public.letters
  FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR (receiver_id = auth.uid() AND unlock_date <= public.app_today())
  );

-- get_my_pending_letter_unlocks (kaynak: 20261019000002_notification_rpc_hardening.sql)
CREATE OR REPLACE FUNCTION public.get_my_pending_letter_unlocks()
RETURNS TABLE(letter_id TEXT, unlock_date DATE)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Saat dilimi farkı için bir gün geriden başlanır; istemci geçmiş saatleri zaten eler
  RETURN QUERY
  SELECT l.id::TEXT, l.unlock_date
    FROM public.letters l
   WHERE l.receiver_id = auth.uid()
     AND l.unlock_date >= public.app_today() - 1
   ORDER BY l.unlock_date
   LIMIT 100;
END;
$$;

-- set_letter_hidden (kaynak: 20261022000002_letter_hide_and_deletion_consent.sql)
CREATE OR REPLACE FUNCTION public.set_letter_hidden(p_letter_id BIGINT, p_hidden BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_letter public.letters%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_letter FROM public.letters WHERE id = p_letter_id FOR UPDATE;

  IF FOUND AND v_letter.sender_id = v_uid THEN
    UPDATE public.letters SET hidden_by_sender = COALESCE(p_hidden, FALSE) WHERE id = p_letter_id;
  -- Kilitli mektubun varlığı alıcıya sızmasın: alıcı yalnızca açılmış mektubu gizleyebilir
  ELSIF FOUND AND v_letter.receiver_id = v_uid AND v_letter.unlock_date <= public.app_today() THEN
    UPDATE public.letters SET hidden_by_receiver = COALESCE(p_hidden, FALSE) WHERE id = p_letter_id;
  ELSE
    RAISE EXCEPTION 'Mektup bulunamadı.' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- request_letter_deletion (kaynak: 20261024000000_letter_deletion_clock_from_opening.sql)
CREATE OR REPLACE FUNCTION public.request_letter_deletion(p_letter_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_letter public.letters%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_letter FROM public.letters WHERE id = p_letter_id FOR UPDATE;
  IF NOT FOUND OR v_letter.sender_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Yalnızca kendi yazdığın mektubun silinmesini isteyebilirsin.' USING ERRCODE = '42501';
  END IF;

  IF v_letter.unlock_date > public.app_today() THEN
    RAISE EXCEPTION 'Mektup açılış gününe kadar silinemez; dilersen listenden gizleyebilirsin.';
  END IF;

  IF now() < public.letter_deletion_request_opens_at(v_letter.unlock_date, v_letter.created_at) THEN
    RAISE EXCEPTION 'Silme isteği, mektup açıldıktan 72 saat sonra gönderilebilir.';
  END IF;

  IF v_letter.deletion_approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Partnerin silmeyi zaten onayladı.';
  END IF;

  IF v_letter.deletion_requested_at IS NOT NULL AND v_letter.deletion_rejected_at IS NULL THEN
    RAISE EXCEPTION 'Silme isteğin zaten partnerinin onayını bekliyor.';
  END IF;

  IF v_letter.deletion_rejected_at IS NOT NULL
     AND now() < v_letter.deletion_rejected_at + INTERVAL '72 hours' THEN
    RAISE EXCEPTION 'Partnerin bu mektubu saklamak istedi. Yeni bir istek 72 saat sonra gönderilebilir.';
  END IF;

  UPDATE public.letters
     SET deletion_requested_at = now(),
         deletion_approved_at  = NULL,
         deletion_rejected_at  = NULL
   WHERE id = p_letter_id;
END;
$$;

-- respond_letter_deletion (kaynak: 20261024000000_letter_deletion_clock_from_opening.sql)
CREATE OR REPLACE FUNCTION public.respond_letter_deletion(p_letter_id BIGINT, p_approve BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_letter public.letters%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_letter FROM public.letters WHERE id = p_letter_id FOR UPDATE;
  IF NOT FOUND OR v_letter.receiver_id IS DISTINCT FROM v_uid OR v_letter.unlock_date > public.app_today() THEN
    RAISE EXCEPTION 'Mektup bulunamadı.' USING ERRCODE = '42501';
  END IF;

  IF v_letter.deletion_requested_at IS NULL OR v_letter.deletion_rejected_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bu mektup için bekleyen bir silme isteği yok.';
  END IF;

  IF NOT COALESCE(p_approve, FALSE) THEN
    UPDATE public.letters
       SET deletion_approved_at = NULL,
           deletion_rejected_at = now()
     WHERE id = p_letter_id;
    RETURN FALSE;
  END IF;

  IF v_letter.deletion_approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'Silmeyi zaten onayladın.';
  END IF;

  IF now() >= public.letter_deletable_at(v_letter.unlock_date, v_letter.created_at) THEN
    DELETE FROM public.letters WHERE id = p_letter_id;
    RETURN TRUE;
  END IF;

  UPDATE public.letters SET deletion_approved_at = now() WHERE id = p_letter_id;
  RETURN FALSE;
END;
$$;

COMMIT;
