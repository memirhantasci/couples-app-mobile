-- ============================================================================
-- Ortak liste: "yaptık" zaten yapılmış maddeye dokunmaz (gözden geçirme bulgusu 13)
-- ----------------------------------------------------------------------------
-- Sorun: set_wishlist_done(p_done = true) maddenin durumuna bakmadan done_at / done_by yazıyordu. İki kişi aynı
-- maddeye arka arkaya "yaptık" deyince (ya da yanıt gecikip istemci yeniden denediğinde) ilk işaretleyenin
-- tarihi ve imzası sessizce ikincisiyle eziliyordu.
--
-- Çözüm: yalnızca status = 'open' iken yazılır. Zaten yapılmışsa hiçbir sütuna dokunulmaz ve hata da verilmez
-- (istek idempotent). Geri alma (p_done = false) davranışı aynıdır.
-- Gövde 20261109000000'daki tanımın aynısıdır; yalnızca p_done dalı değişti.
-- Test: supabase/tests/couple_wishlist_test.sql (bölüm 4).
-- ============================================================================

BEGIN;

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

  -- Satırı kilitler: aynı anda gelen iki "yaptık"tan ikincisi birincinin sonucunu görür
  v_item := public.wishlist_lock_visible_item(p_item_id);

  IF p_done THEN
    IF v_item.status = 'open' THEN
      UPDATE public.couple_wishlist_items AS i
         SET status = 'done', done_at = NOW(), done_by = auth.uid()
       WHERE i.id = v_item.id;
    END IF;
  ELSIF v_item.status = 'done' THEN
    PERFORM public.wishlist_assert_capacity(v_item.couple_id, auth.uid());
    UPDATE public.couple_wishlist_items AS i
       SET status = 'open', done_at = NULL, done_by = NULL
     WHERE i.id = v_item.id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_wishlist_done(BIGINT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_wishlist_done(BIGINT, BOOLEAN) TO authenticated;

COMMIT;
