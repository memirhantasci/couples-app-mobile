-- ============================================================================
-- Bildirim RPC'leri: güvenlik sıkılaştırması + mektup kilidi hatırlatıcısı
-- ============================================================================
-- 1) get_partner_push_tokens (017) herhangi bir couple_id kabul ediyordu: giriş yapmış HERHANGİ
--    bir kullanıcı başka bir çiftin id'sini vererek o çiftin push token'larını okuyabilir ve
--    Expo push API'si üzerinden onlara bildirim (spam/oltalama) gönderebilirdi.
--    Artık çağıranın o çiftin üyesi olması zorunlu; search_path sabitlendi; anon erişimi kapalı.
-- 2) get_my_pending_letter_unlocks: Kilitli mektuplar RLS ile alıcıdan gizlidir (018), bu yüzden
--    alıcının cihazı "mektubumun kilidi ne zaman açılacak" bilgisini sorgulayamıyordu ve yerel
--    "Bugün bir mektubunun kilidi açıldı!" hatırlatıcısı kurulamıyordu. Bu RPC yalnızca
--    açılış TARİHİNİ döndürür; başlık/içerik/gönderen sızdırılmaz (varlığı zaten push ile bildirilir).
-- Bağımlılık: public.get_my_couple_id() (017)
-- ============================================================================

-- 1. Partner push token'ları (yalnızca kendi çiftinin partneri)
CREATE OR REPLACE FUNCTION public.get_partner_push_tokens(p_couple_id INTEGER)
RETURNS TABLE(token TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  -- Çağıran, istenen çiftin üyesi değilse boş döner
  IF p_couple_id IS NULL OR p_couple_id IS DISTINCT FROM public.get_my_couple_id() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT pt.token
    FROM public.push_tokens pt
    JOIN public.users u ON u.id = pt.user_id
   WHERE u.couple_id = p_couple_id
     AND u.id <> auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.get_partner_push_tokens(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_push_tokens(INTEGER) TO authenticated;

-- 2. Alıcıya gönderilmiş, henüz açılmamış (veya bugün açılan) mektupların açılış tarihleri
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
     AND l.unlock_date >= CURRENT_DATE - 1
   ORDER BY l.unlock_date
   LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_pending_letter_unlocks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_pending_letter_unlocks() TO authenticated;
