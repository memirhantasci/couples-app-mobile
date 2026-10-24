-- ============================================================================
-- Mektup silme: 72 saat, mektubun FİİLEN açıldığı andan itibaren sayılır
-- ============================================================================
-- Hata: 20261022000002, 72 saati unlock_date günü 00:00 UTC'den başlatıyordu. Açılış
-- gününde (ör. 23 Ekim 23:04'te, açılış tarihi 23 Ekim olarak) yazılan bir mektup için
-- bu, yazılmadan ~20 saat önceki bir an demekti: "72 saat" yerine ~52 saat bekleniyordu.
--
-- Düzeltme: açılış anı = GREATEST(unlock_date günü 00:00 UTC, created_at). Gelecekte
-- açılacak mektuplar değişmez (açılış günü 00:00 UTC > created_at); açılış gününde ya da
-- geçmiş bir tarihle yazılanlar yazıldıkları andan itibaren 72 saat bekler.
-- İstemci karşılığı: src/lib/letterPolicy.ts (letterOpenedAt)
-- ============================================================================

BEGIN;

-- ─── 1. Zaman fonksiyonları: created_at de hesaba katılır ───────────────────
DROP FUNCTION IF EXISTS public.letter_deletion_request_opens_at(DATE);
DROP FUNCTION IF EXISTS public.letter_deletable_at(DATE);

CREATE OR REPLACE FUNCTION public.letter_opened_at(p_unlock_date DATE, p_created_at TIMESTAMPTZ)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT GREATEST(public.letter_unlock_at(p_unlock_date), COALESCE(p_created_at, public.letter_unlock_at(p_unlock_date)));
$$;

-- Gönderenin silme isteyebildiği ilk an: açılıştan 72 saat sonra
CREATE OR REPLACE FUNCTION public.letter_deletion_request_opens_at(p_unlock_date DATE, p_created_at TIMESTAMPTZ)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.letter_opened_at(p_unlock_date, p_created_at) + INTERVAL '72 hours';
$$;

-- Onaylı bir mektubun silinebildiği ilk an: açılıştan 72 saat sonra
CREATE OR REPLACE FUNCTION public.letter_deletable_at(p_unlock_date DATE, p_created_at TIMESTAMPTZ)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.letter_opened_at(p_unlock_date, p_created_at) + INTERVAL '72 hours';
$$;


-- ─── 2. Silme isteği ─────────────────────────────────────────────────────────
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

  IF v_letter.unlock_date > CURRENT_DATE THEN
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


-- ─── 3. Onay / ret ───────────────────────────────────────────────────────────
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
  IF NOT FOUND OR v_letter.receiver_id IS DISTINCT FROM v_uid OR v_letter.unlock_date > CURRENT_DATE THEN
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


-- ─── 4. Saatlik temizlik işi ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_approved_letter_deletions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.letters
   WHERE deletion_approved_at IS NOT NULL
     AND deletion_rejected_at IS NULL
     AND now() >= public.letter_deletable_at(unlock_date, created_at);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMIT;
