-- ============================================================================
-- Mektuplar: kişisel gizleme + partner onaylı silme
-- ============================================================================
-- Ürün kuralları:
--   • Gönderilen mektup açılış gününe kadar ASLA silinemez: mektubun karşı tarafa
--     ulaşması esastır.
--   • Her iki taraf da bir mektubu YALNIZCA KENDİ listesinden gizleyebilir ve dilediği
--     an geri getirebilir (ör. uygulamayı denerken yazılmış bir deneme mektubu yer
--     kaplamasın). Gizlemek partnerin görünümünü etkilemez, mektubu silmez.
--   • Açılış anından 72 saat sonra gönderen, mektubun silinmesini İSTEYEBİLİR. İstek
--     alıcının onayına düşer (alıcıya bildirim gider); alıcı onay vermeden mektup silinmez.
--   • Onaylanan mektup en erken açılıştan 5 gün sonra silinir: onay bu andan sonra
--     verilirse hemen, önce verilirse 5. gün dolunca saatlik iş tarafından silinir.
--     Silinene kadar gönderen isteğini geri çekebilir, alıcı da onayından vazgeçebilir.
--   • Reddedilen istek, alıcıyı bildirimle bunaltmamak için 72 saat sonra yeniden
--     gönderilebilir.
--   • Açılış anı: unlock_date günü 00:00 UTC — alıcının mektubu RLS ile görmeye
--     başladığı an (018: unlock_date <= CURRENT_DATE).
-- Güvenlik:
--   • 003/008'in genel döngüsünden kalan "Update own sent letters" ve "Delete own sent
--     letters" politikaları gönderenin mektubu istediği an silmesine ya da açılış
--     tarihini/içeriğini sonradan değiştirmesine izin veriyordu. İkisi de kaldırılır;
--     mektup üzerindeki tüm değişiklikler aşağıdaki SECURITY DEFINER RPC'lerinden geçer.
--   • Silme sırasında mevcut aktivite tetikleyicisi (20261021000000) mektubun puanını geri alır.
-- Bağımlılık: pg_cron (20261021000000_star_activity_brightness.sql)
-- ============================================================================

BEGIN;

-- ─── 1. Kolonlar ─────────────────────────────────────────────────────────────
ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS hidden_by_sender      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hidden_by_receiver    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_approved_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_rejected_at  TIMESTAMPTZ;

-- Saatlik iş yalnızca onaylanmış istekleri tarar
CREATE INDEX IF NOT EXISTS idx_letters_deletion_approved
  ON public.letters(unlock_date)
  WHERE deletion_approved_at IS NOT NULL;


-- ─── 2. Doğrudan güncelleme / silme kapatılır ───────────────────────────────
DROP POLICY IF EXISTS "Update own sent letters" ON public.letters;
DROP POLICY IF EXISTS "Delete own sent letters" ON public.letters;


-- ─── 3. Zaman kuralları (istemci aynı değerleri kullanır: src/lib/letterPolicy.ts) ──
CREATE OR REPLACE FUNCTION public.letter_unlock_at(p_unlock_date DATE)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT p_unlock_date::timestamp AT TIME ZONE 'UTC';
$$;

-- Gönderenin silme isteyebildiği ilk an: açılıştan 72 saat sonra
CREATE OR REPLACE FUNCTION public.letter_deletion_request_opens_at(p_unlock_date DATE)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.letter_unlock_at(p_unlock_date) + INTERVAL '72 hours';
$$;

-- Onaylı bir mektubun silinebildiği ilk an: açılıştan 5 gün sonra
CREATE OR REPLACE FUNCTION public.letter_deletable_at(p_unlock_date DATE)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT public.letter_unlock_at(p_unlock_date) + INTERVAL '5 days';
$$;


-- ─── 4. Kişisel gizleme ──────────────────────────────────────────────────────
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
  ELSIF FOUND AND v_letter.receiver_id = v_uid AND v_letter.unlock_date <= CURRENT_DATE THEN
    UPDATE public.letters SET hidden_by_receiver = COALESCE(p_hidden, FALSE) WHERE id = p_letter_id;
  ELSE
    RAISE EXCEPTION 'Mektup bulunamadı.' USING ERRCODE = '42501';
  END IF;
END;
$$;


-- ─── 5. Silme isteği (yalnızca gönderen) ─────────────────────────────────────
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

  IF now() < public.letter_deletion_request_opens_at(v_letter.unlock_date) THEN
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


-- ─── 6. İsteği geri çekme (yalnızca gönderen, silinmeden önce) ───────────────
CREATE OR REPLACE FUNCTION public.cancel_letter_deletion(p_letter_id BIGINT)
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
    RAISE EXCEPTION 'Mektup bulunamadı.' USING ERRCODE = '42501';
  END IF;

  -- Reddedilmiş bir istek bekleme süresini korur; geri çekilecek açık bir istek yok
  IF v_letter.deletion_requested_at IS NULL OR v_letter.deletion_rejected_at IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.letters
     SET deletion_requested_at = NULL,
         deletion_approved_at  = NULL
   WHERE id = p_letter_id;
END;
$$;


-- ─── 7. Onay / ret (yalnızca alıcı) ──────────────────────────────────────────
-- Dönüş: mektup bu çağrıda silindiyse TRUE.
-- Bekleyen istek onaylanabilir ya da reddedilebilir; verilmiş bir onaydan mektup
-- silinene kadar vazgeçilebilir (ret olarak kaydedilir).
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

  IF now() >= public.letter_deletable_at(v_letter.unlock_date) THEN
    DELETE FROM public.letters WHERE id = p_letter_id;
    RETURN TRUE;
  END IF;

  UPDATE public.letters SET deletion_approved_at = now() WHERE id = p_letter_id;
  RETURN FALSE;
END;
$$;


-- ─── 8. Onaylanıp vakti gelen mektupları silen saatlik iş ───────────────────
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
     AND now() >= public.letter_deletable_at(unlock_date);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ─── 9. Yetkiler ─────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.set_letter_hidden(BIGINT, BOOLEAN)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_letter_deletion(BIGINT)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_letter_deletion(BIGINT)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_letter_deletion(BIGINT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purge_approved_letter_deletions()        FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.set_letter_hidden(BIGINT, BOOLEAN)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_letter_deletion(BIGINT)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_letter_deletion(BIGINT)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_letter_deletion(BIGINT, BOOLEAN) TO authenticated;


-- ─── 10. Zamanlama: her saat başını 7 geçe ───────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'letter-deletion-purge' LIMIT 1;
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END;
$$;

SELECT cron.schedule(
  'letter-deletion-purge',
  '7 * * * *',
  $cron$ SELECT public.purge_approved_letter_deletions(); $cron$
);

COMMIT;
