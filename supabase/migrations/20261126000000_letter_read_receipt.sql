-- ============================================================================
-- MIGRATION: 20261126000000_letter_read_receipt.sql
-- Mektup "Açıldı / Okundu" durumu (sunucu kaydı + gönderene bildirim)
-- ============================================================================
-- 1. letters tablosuna opened_by_receiver_at sütunu ekler (yalnızca ekler,
--    mağazadaki eski sürümlerle %100 geriye uyumludur).
-- 2. guard_letter_opened_at() trigger'ı ile istemcilerin opened_by_receiver_at
--    sütununu doğrudan UPDATE etmesini engeller; yalnızca mark_letter_opened
--    RPC'si oturum bayrağıyla yazabilir.
-- 3. public.my_letters görünümüne opened_by_receiver_at sütununu ekler
--    (mevcut sütun sırası ve maskeleme kuralları korunur).
-- 4. mark_letter_opened(p_letter_id BIGINT) SECURITY DEFINER RPC'sini kurar:
--    yalnızca alıcı, açılış zamanı geldikten sonra ve en fazla bir kez
--    (idempotent) açıldı damgası vurabilir.
-- 5. push_on_letter_opened trigger'ı: opened_by_receiver_at NULL → dolu
--    geçişinde invoke_push_webhook() çağırır; send-push gönderene bildirim atar.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Sütun: alıcının mektubu ilk kez fiilen açtığı an
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS opened_by_receiver_at TIMESTAMPTZ;

COMMENT ON COLUMN public.letters.opened_by_receiver_at IS
  'Alıcının mektubun mührünü kırıp ilk kez açtığı an. Yalnızca mark_letter_opened RPC tarafından bir kez yazılır.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Doğrudan UPDATE koruması: istemci opened_by_receiver_at alanını elle yazamaz
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_letter_opened_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.opened_by_receiver_at IS DISTINCT FROM OLD.opened_by_receiver_at
     AND auth.uid() IS NOT NULL
     AND COALESCE(current_setting('app.letter_mark_opened', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Mektup açılma durumu yalnızca okuma işlemiyle güncellenebilir.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_letter_opened_at ON public.letters;
CREATE TRIGGER trg_guard_letter_opened_at
  BEFORE UPDATE OF opened_by_receiver_at ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.guard_letter_opened_at();


-- ────────────────────────────────────────────────────────────────────────────
-- 3. public.my_letters görünümü: sona opened_by_receiver_at sütununu ekle
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.my_letters
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  l.id,
  l.sender_id,
  l.receiver_id,
  CASE WHEN v.is_locked THEN ''::character varying ELSE l.title END AS title,
  CASE WHEN v.is_locked THEN ''::text ELSE l.content END AS content,
  l.unlock_date,
  l.created_at,
  l.couple_id,
  l.hidden_by_sender,
  l.hidden_by_receiver,
  l.deletion_requested_at,
  l.deletion_approved_at,
  l.deletion_rejected_at,
  v.is_locked,
  l.opened_by_receiver_at
FROM public.letters AS l
CROSS JOIN LATERAL (
  SELECT (l.sender_id IS DISTINCT FROM (SELECT auth.uid())
          AND public.letter_unlock_at(l.unlock_date) > now()) AS is_locked
) AS v
WHERE l.sender_id = (SELECT auth.uid())
   OR l.receiver_id = (SELECT auth.uid());

COMMENT ON VIEW public.my_letters IS
  'Bakan kişinin mektupları; alıcı için kilitli mektupta title/content boş. İstemci okumaları buradan yapılır.';

REVOKE ALL ON public.my_letters FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.my_letters TO authenticated;
GRANT ALL ON public.my_letters TO service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. mark_letter_opened RPC: alıcı açtığında bir kez damgala (idempotent)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_letter_opened(p_letter_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_letter    public.letters%ROWTYPE;
  v_opened_at TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz işlem: oturum bulunamadı.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_letter
    FROM public.letters AS l
   WHERE l.id = p_letter_id
     AND l.receiver_id = v_uid
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mektup bulunamadı veya alıcısı siz değilsiniz.' USING ERRCODE = '42501';
  END IF;

  IF public.letter_unlock_at(v_letter.unlock_date) > NOW() THEN
    RAISE EXCEPTION 'Mektubun açılış zamanı henüz gelmedi.' USING ERRCODE = '42501';
  END IF;

  -- Idempotent: daha önce açıldıysa ilk açılma anı korunur, yeni bildirim tetiklenmez
  IF v_letter.opened_by_receiver_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'opened_at',    v_letter.opened_by_receiver_at,
      'newly_opened', FALSE
    );
  END IF;

  PERFORM set_config('app.letter_mark_opened', 'on', true);

  UPDATE public.letters AS l
     SET opened_by_receiver_at = NOW()
   WHERE l.id = v_letter.id
     AND l.opened_by_receiver_at IS NULL
  RETURNING l.opened_by_receiver_at INTO v_opened_at;

  PERFORM set_config('app.letter_mark_opened', 'off', true);

  RETURN jsonb_build_object(
    'opened_at',    COALESCE(v_opened_at, NOW()),
    'newly_opened', TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_letter_opened(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_letter_opened(BIGINT) TO authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Gönderene bildirim tetikleyicisi (yalnızca ilk açılışta: NULL → dolu)
-- ────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS push_on_letter_opened ON public.letters;
CREATE TRIGGER push_on_letter_opened
  AFTER UPDATE OF opened_by_receiver_at ON public.letters
  FOR EACH ROW
  WHEN (OLD.opened_by_receiver_at IS NULL AND NEW.opened_by_receiver_at IS NOT NULL)
  EXECUTE FUNCTION public.invoke_push_webhook();

COMMIT;
