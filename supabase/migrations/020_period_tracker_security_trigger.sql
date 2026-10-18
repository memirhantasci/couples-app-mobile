-- ============================================================
-- 020: Regl Takvimi Veri Güvenliği ve Bütünlük Doğrulama Trigger'ı
-- ============================================================
-- Bu trigger iki kritik kuralı veritabanı seviyesinde zorunlu kılar:
-- 1. Sadece 'female' (kadın) partnerler regl kaydı oluşturabilir.
-- 2. Gelecekteki bir gün başlangıç olarak işaretlenemez (saat dilimi için 1 gün tolerans).
-- 3. Bir kullanıcı tek bir ayda en fazla 2 regl BAŞLANGICI ekleyebilir.
-- 4. İki başlangıç tarihi arasında en az 16 gün olmalıdır.
-- 5. couple_id eksikse otomatik olarak kullanıcının profilinden doldurulur.
-- (Kayıtlar yalnızca reglin başladığı günü tutar; 5 günlük süreç uygulamada hesaplanır.
--  Uygulanmış veritabanları için aynı kurallar 20261018000002_period_start_only_rules.sql ile güncellenir.)
-- ============================================================

CREATE OR REPLACE FUNCTION check_period_log_rules()
RETURNS TRIGGER AS $$
DECLARE
  v_gender TEXT;
  v_month_count INT;
  v_too_close BOOLEAN;
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

  -- 3. Gelecek Tarih Kontrolü: CURRENT_DATE UTC'dir, ileri saat dilimlerindeki kullanıcılar için 1 gün tolerans
  IF NEW.date::date > CURRENT_DATE + 1 THEN
    RAISE EXCEPTION 'Gelecekteki bir günü regl başlangıcı olarak işaretleyemezsiniz.';
  END IF;

  -- 4. Aylık Kota Kontrolü: Aynı ay içinde en fazla 2 başlangıç
  SELECT COUNT(*) INTO v_month_count
  FROM public.period_logs
  WHERE user_id = NEW.user_id
    AND date_trunc('month', date::date) = date_trunc('month', NEW.date::date);

  IF v_month_count >= 2 THEN
    RAISE EXCEPTION 'Bir ay içerisinde en fazla 2 regl başlangıcı kaydedebilirsiniz.';
  END IF;

  -- 5. Biyolojik Aralık Kontrolü: İki başlangıç arasında en az 16 gün
  SELECT EXISTS (
    SELECT 1
    FROM public.period_logs pl
    WHERE pl.user_id = NEW.user_id
      AND ABS(pl.date::date - NEW.date::date) < 16
  ) INTO v_too_close;

  IF v_too_close THEN
    RAISE EXCEPTION 'İki regl başlangıcı arasında en az 16 gün ara bulunmalıdır.';
  END IF;

  -- 6. couple_id eksikse kullanıcının mevcut çiftinden otomatik ata
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
