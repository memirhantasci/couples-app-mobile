-- ============================================================
-- 20261022000003: Profil Bilgileri ve İlişki Tarihleri Değişiklik Kısıtlamaları (Cooldowns)
-- ============================================================
-- 1. Görünen İsim: 30 günde 1 (Kişi bazlı)
-- 2. Cinsiyet: 90 günde 1 (Kişi bazlı)
-- 3. İlişki Tarihleri (Tanışma & Sevgililik): 30 günde 1 (Çift / İlişki bazlı)
--
-- İlk Hak Mantığı:
-- Kolonlar DEFAULT NULL başlar. Kurulum sırasında girilen ilk verilerde
-- zaman damgası NULL kalır; böylece kullanıcı kurulum sonrası yanlış girdiyse
-- hemen kullanabileceği 1 düzeltme hakkı hazır olur.
-- ============================================================

-- 1. users tablosuna son değişiklik zaman damgaları
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS name_last_changed_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS gender_last_changed_at TIMESTAMPTZ DEFAULT NULL;


-- 2. couples tablosuna çift ortak tarih değişiklik zaman damgası
ALTER TABLE public.couples 
  ADD COLUMN IF NOT EXISTS dates_last_changed_at TIMESTAMPTZ DEFAULT NULL;


-- 3. users tablosu cooldown koruma trigger fonksiyonu
CREATE OR REPLACE FUNCTION check_users_cooldown_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Sistem / admin geçişi
  IF current_setting('app.allow_profile_override', true) IS NOT NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- A. İsim Değişikliği Kontrolü
  IF (NEW.name_last_changed_at IS DISTINCT FROM OLD.name_last_changed_at) THEN
    -- Eğer önceden bir değişiklik yapılmışsa ve üzerinden 30 gün geçmemişse engelle
    IF (OLD.name_last_changed_at IS NOT NULL AND OLD.name_last_changed_at > now() - interval '30 days') THEN
      RAISE EXCEPTION 'İsim değişikliği 30 günde bir yapılabilir. Kalan süreniz dolmadan tekrar değiştiremezsiniz.';
    END IF;
  END IF;

  -- B. Cinsiyet Değişikliği Kontrolü
  IF (NEW.gender IS DISTINCT FROM OLD.gender) THEN
    -- Eğer eski cinsiyet NULL ise (onboarding / ilk kurulum aşaması), zaman damgasını NULL tut
    IF (OLD.gender IS NULL) THEN
      NEW.gender_last_changed_at = NULL;
    ELSE
      -- Kurulum sonrası değişiklik: 90 gün kısıtı kontrol et
      IF (OLD.gender_last_changed_at IS NOT NULL AND OLD.gender_last_changed_at > now() - interval '90 days') THEN
        RAISE EXCEPTION 'Cinsiyet tercihi 90 günde bir değiştirilebilir. Kalan süreniz dolmadan tekrar değiştiremezsiniz.';
      END IF;
      -- İlk hak veya 90 gün dolmuş: yeni zaman damgası ata
      NEW.gender_last_changed_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_users_cooldown_integrity ON public.users;
CREATE TRIGGER trg_users_cooldown_integrity
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION check_users_cooldown_integrity();


-- 4. couples tablosu çift ortak tarih değişiklik trigger fonksiyonu
CREATE OR REPLACE FUNCTION check_couples_dates_cooldown_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Sistem / admin geçişi
  IF current_setting('app.allow_dates_override', true) IS NOT NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- İlişki veya tanışma tarihi değişti mi?
  IF (
    NEW.relationship_start_date IS DISTINCT FROM OLD.relationship_start_date 
    OR NEW.meet_date IS DISTINCT FROM OLD.meet_date
    OR NEW.dates_last_changed_at IS DISTINCT FROM OLD.dates_last_changed_at
  ) THEN
    -- Eğer eski ilişki tarihi NULL ise (ilk kurulum/onboarding), zaman damgasını NULL tut (çiftin 1 hakkı cepte kalsın)
    IF (OLD.relationship_start_date IS NULL) THEN
      NEW.dates_last_changed_at = NULL;
    ELSE
      -- Kurulum sonrası çift tarih değişikliği: 30 gün kısıtı
      IF (OLD.dates_last_changed_at IS NOT NULL AND OLD.dates_last_changed_at > now() - interval '30 days') THEN
        RAISE EXCEPTION 'İlişki tarihleri 30 günde bir güncellenebilir. Çift olarak bekleme süreniz henüz dolmamıştır.';
      END IF;
      NEW.dates_last_changed_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_couples_dates_cooldown ON public.couples;
CREATE TRIGGER trg_couples_dates_cooldown
  BEFORE UPDATE ON public.couples
  FOR EACH ROW EXECUTE FUNCTION check_couples_dates_cooldown_integrity();
