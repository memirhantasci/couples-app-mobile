-- ============================================================
-- 020: Regl Takvimi Veri Güvenliği ve Bütünlük Doğrulama Trigger'ı
-- ============================================================
-- Bu trigger iki kritik kuralı veritabanı seviyesinde zorunlu kılar:
-- 1. Sadece 'female' (kadın) partnerler regl kaydı oluşturabilir.
-- 2. Bir kullanıcı tek bir ayda en fazla 4 gün regl kaydı ekleyebilir.
-- 3. couple_id eksikse otomatik olarak kullanıcının profilinden doldurulur.
-- ============================================================

CREATE OR REPLACE FUNCTION check_period_log_rules()
RETURNS TRIGGER AS $$
DECLARE
  v_gender TEXT;
  v_month_count INT;
BEGIN
  -- 1. Yetki Kontrolü: İstek auth oturumundan geliyorsa başkası adına kayıt atılamaz
  IF auth.uid() IS NOT NULL AND NEW.user_id != auth.uid() THEN
    RAISE EXCEPTION 'Başka bir kullanıcı adına regl kaydı ekleyemezsiniz.';
  END IF;

  -- 2. Cinsiyet Kontrolü: Yalnızca kadın kullanıcılar regl kaydı ekleyebilir
  SELECT gender INTO v_gender FROM public.users WHERE id = NEW.user_id;
  IF LOWER(COALESCE(v_gender, '')) != 'female' THEN
    RAISE EXCEPTION 'Regl takvimini yalnızca kadın partner güncelleyebilir.';
  END IF;

  -- 3. Aylık Kota Kontrolü: Aynı ay içinde en fazla 4 gün işaretlenebilir
  SELECT COUNT(*) INTO v_month_count 
  FROM public.period_logs 
  WHERE user_id = NEW.user_id 
    AND date_trunc('month', date::date) = date_trunc('month', NEW.date::date);

  IF v_month_count >= 4 THEN
    RAISE EXCEPTION 'Bir ay içerisinde en fazla 4 regl günü işaretleyebilirsiniz.';
  END IF;

  -- 4. couple_id eksikse kullanıcının mevcut çiftinden otomatik ata
  IF NEW.couple_id IS NULL THEN
    SELECT couple_id INTO NEW.couple_id FROM public.users WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eski trigger varsa temizle ve yenisini bağla
DROP TRIGGER IF EXISTS trg_check_period_log_rules ON public.period_logs;
CREATE TRIGGER trg_check_period_log_rules
  BEFORE INSERT ON public.period_logs
  FOR EACH ROW
  EXECUTE FUNCTION check_period_log_rules();
