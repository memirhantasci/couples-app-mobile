-- ============================================================================
-- Eşleşme kodu deneme sınırı
-- ============================================================================
-- join_couple_by_code_uuid kodu tahmin etmeye açıktı: giriş yapmış herhangi biri 6 haneli kodları
-- (31^6 ≈ 887 milyon) otomatik deneyip kimsenin beklediği bir çifte katılabilirdi.
-- Kullanıcı başına 10 dakikada 20 deneme. Hata FIRLATILIRSA işlem geri alınır ve deneme kaydı da silinir;
-- bu yüzden kod tahmini belirtisi olan sonuçlar (geçersiz / dolu kod, sınır aşımı) hata yerine
-- result_error alanıyla DÖNER. Diğer hatalar (kendi kodu, zaten eşleşmiş) olduğu gibi fırlatılır.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.join_couple_by_code_uuid(TEXT);

CREATE FUNCTION public.join_couple_by_code_uuid(p_code TEXT)
RETURNS TABLE(result_couple_id INTEGER, result_is_paired BOOLEAN, result_error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT := normalize_pairing_code(p_code);
  v_target_id INTEGER;
  v_old_couple_id INTEGER;
  v_target_members INTEGER;
  v_old_members INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.consume_auth_rate_limit('pair_join', v_uid::text, 20, 10 * 60) THEN
    RETURN QUERY SELECT NULL::INTEGER, FALSE, 'TOO_MANY_REQUESTS'::TEXT;
    RETURN;
  END IF;

  IF length(v_code) < 4 THEN
    RETURN QUERY SELECT NULL::INTEGER, FALSE, 'INVALID_CODE'::TEXT;
    RETURN;
  END IF;

  -- Kilit sırası her yerde aynı: önce kullanıcı satırı, sonra çift satırları (id sırasıyla)
  SELECT u.couple_id INTO v_old_couple_id FROM users u WHERE u.id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  -- Önce birebir eşleşme; yoksa 0/O ve 1/I karışıklığını tolere eden eşleşme (yalnızca tekse)
  SELECT c.id INTO v_target_id FROM couples c WHERE c.pairing_code = v_code;
  IF v_target_id IS NULL THEN
    SELECT min(c.id) INTO v_target_id
      FROM couples c
     WHERE translate(c.pairing_code, '01', 'OI') = translate(v_code, '01', 'OI')
    HAVING count(*) = 1;
  END IF;

  -- İki taraf aynı anda birbirinin kodunu girerse kilitlenme (deadlock) yerine sıraya girer
  PERFORM 1 FROM couples c
   WHERE c.id IN (v_target_id, v_old_couple_id)
   ORDER BY c.id
     FOR UPDATE;

  IF v_old_couple_id IS NOT NULL THEN
    SELECT count(*) INTO v_old_members FROM users u WHERE u.couple_id = v_old_couple_id;
  END IF;

  IF v_old_couple_id IS NOT DISTINCT FROM v_target_id AND v_target_id IS NOT NULL THEN
    -- Kayıtta girilen kodla zaten bu çifte katılmış olabilir: tekrar denemek hata değildir
    IF v_old_members >= 2 THEN
      RETURN QUERY SELECT v_target_id, TRUE, NULL::TEXT;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SELF_CODE';
  END IF;

  IF v_old_members >= 2 THEN
    -- Kurulmuş bir çiftten başka bir koda geçmek partneri tek başına bırakır
    RAISE EXCEPTION 'ALREADY_PAIRED';
  END IF;

  IF v_target_id IS NOT NULL THEN
    SELECT count(*) INTO v_target_members FROM users u WHERE u.couple_id = v_target_id;
  END IF;

  -- Kod yok ya da sahibi artık o çiftte değil (kimse beklemiyor)
  IF v_target_id IS NULL OR COALESCE(v_target_members, 0) = 0 THEN
    RETURN QUERY SELECT NULL::INTEGER, FALSE, 'INVALID_CODE'::TEXT;
    RETURN;
  END IF;
  IF v_target_members >= 2 THEN
    RETURN QUERY SELECT NULL::INTEGER, FALSE, 'CODE_ALREADY_USED'::TEXT;
    RETURN;
  END IF;

  PERFORM set_config('app.allow_couple_change', 'true', true);
  UPDATE users u SET couple_id = v_target_id WHERE u.id = v_uid;
  PERFORM set_config('app.allow_couple_change', '', true);

  IF v_old_couple_id IS NOT NULL THEN
    DELETE FROM couples c
     WHERE c.id = v_old_couple_id
       AND NOT EXISTS (SELECT 1 FROM users u WHERE u.couple_id = v_old_couple_id);
  END IF;

  SELECT count(*) INTO v_target_members FROM users u WHERE u.couple_id = v_target_id;
  -- Sayaç tetikleyicisi bir gün kaysa bile member_count (ve is_paired) gerçeği göstersin
  UPDATE couples c SET member_count = v_target_members
   WHERE c.id = v_target_id AND c.member_count IS DISTINCT FROM v_target_members;

  RETURN QUERY SELECT v_target_id, v_target_members >= 2, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.join_couple_by_code_uuid(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_couple_by_code_uuid(TEXT) TO authenticated;

COMMIT;
