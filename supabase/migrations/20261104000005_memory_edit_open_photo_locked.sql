-- Özel günler: Premium'suz kullanıcı metni ve tarihi düzenleyebilir; yalnızca fotoğraf kilitli
--
-- 20261104000004 özel günün her türlü düzenlemesini Premium'a bağlamıştı. Yeni kural: başlık, açıklama ve tarih
-- herkese açıktır. Kilitli olan tek şey fotoğraftır: Premium'suz kullanıcı özel güne fotoğraf ekleyemez ve
-- Premium iken yüklenmiş fotoğrafı başka bir fotoğrafla değiştiremez. Fotoğrafı kaldırmak silme hakkıdır, serbest.
-- Sistem işleri (auth.uid() yok: kasa tasfiyesi, hesap silme) etkilenmez.

CREATE OR REPLACE FUNCTION public.enforce_memory_premium_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_my_active_premium() THEN
    RETURN NEW;
  END IF;

  IF NEW.image_path IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.image_path IS DISTINCT FROM OLD.image_path) THEN
    RAISE EXCEPTION 'Özel güne fotoğraf eklemek veya değiştirmek için aktif Premium üyelik gereklidir.'
      USING ERRCODE = 'P0010';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_memory_premium_edits() FROM PUBLIC, anon, authenticated;
