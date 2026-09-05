-- ============================================================
-- 018: Kritik Güvenlik, Manipülasyon Engelleme & RLS Sıkılaştırma Paketi
-- ============================================================
-- Bu migration:
-- 1. couples tablosunun yetkisiz herkes tarafından DELETE edilmesini engeller.
-- 2. couples tablosunda is_premium ve premium_expires_at kolonlarının kullanıcılarca doğrudan güncellenmesini engeller.
-- 3. users tablosunda couple_id ve token_balance kolonlarının doğrudan hacklenmesini engeller.
-- 4. letters tablosunda zaman kilitli mektupların erkenden okunmasını RLS seviyesinde engeller.
-- 5. Çift verisi tablolarında (photo_archive, calendar_notes, daily_notes, meetings, medicines)
--    kullanıcıların başka çiftlerin ID'sine veri enjekte etmesini engeller (Cross-couple IDOR koruması).
-- ============================================================

-- 1. couples tablosundaki DELETE açığını kapat
DROP POLICY IF EXISTS "Anyone can delete empty couples" ON public.couples;
DROP POLICY IF EXISTS "Only empty couples can be deleted by members" ON public.couples;

CREATE POLICY "Only empty couples can be deleted by members" ON public.couples
  FOR DELETE TO authenticated
  USING (id = get_my_couple_id() AND member_count = 0);


-- 2. couples tablosunda yetkisiz is_premium manipülasyonunu engelleyen Trigger
CREATE OR REPLACE FUNCTION check_couples_update_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Eğer is_premium veya premium_expires_at değiştirilmeye çalışılıyorsa ve sistem bayrağı yoksa engelle
  IF (NEW.is_premium IS DISTINCT FROM OLD.is_premium OR NEW.premium_expires_at IS DISTINCT FROM OLD.premium_expires_at) THEN
    IF current_setting('app.allow_premium_override', true) IS NULL THEN
      -- Sadece servis rolü (admin) veya internal güvenli RPC izin verir
      IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Premium durumu kullanıcı tarafından doğrudan güncellenemez.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_couples_premium ON public.couples;
CREATE TRIGGER trg_protect_couples_premium
  BEFORE UPDATE ON public.couples
  FOR EACH ROW EXECUTE FUNCTION check_couples_update_integrity();


-- 3. users tablosunda couple_id ve token_balance kolonlarını koruyan Trigger
CREATE OR REPLACE FUNCTION check_users_update_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- couple_id doğrudan UPDATE ile değiştirilemez (Sadece join_couple_by_code_uuid gibi RPC ile)
  IF (NEW.couple_id IS DISTINCT FROM OLD.couple_id) THEN
    IF current_setting('app.allow_couple_change', true) IS NULL THEN
      IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'couple_id doğrudan değiştirilemez. Lütfen eşleşme kodunu kullanın.';
      END IF;
    END IF;
  END IF;

  -- token_balance doğrudan UPDATE ile değiştirilemez (Sadece spend_tokens / promo RPC ile)
  IF (NEW.token_balance IS DISTINCT FROM OLD.token_balance) THEN
    IF current_setting('app.allow_token_change', true) IS NULL THEN
      IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'token_balance doğrudan değiştirilemez.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_users_columns ON public.users;
CREATE TRIGGER trg_protect_users_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION check_users_update_integrity();


-- 4. letters tablosunda kilitli mektupların vaktinden önce okunmasını engelle
DROP POLICY IF EXISTS "View letters involved in" ON public.letters;
CREATE POLICY "View letters involved in" ON public.letters
  FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid() 
    OR (receiver_id = auth.uid() AND unlock_date <= CURRENT_DATE)
  );


-- 5. Çapraz Çift (Cross-Couple) Veri Enjeksiyonunu Engelleyen RLS Kuralları
-- photo_archive
DROP POLICY IF EXISTS "Insert own data" ON public.photo_archive;
DROP POLICY IF EXISTS "Insert own couple photos" ON public.photo_archive;
CREATE POLICY "Insert own couple photos" ON public.photo_archive
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND couple_id = get_my_couple_id());

-- calendar_notes
DROP POLICY IF EXISTS "Insert own data" ON public.calendar_notes;
DROP POLICY IF EXISTS "Insert own couple calendar notes" ON public.calendar_notes;
CREATE POLICY "Insert own couple calendar notes" ON public.calendar_notes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND couple_id = get_my_couple_id());

-- daily_notes
DROP POLICY IF EXISTS "Insert own data" ON public.daily_notes;
DROP POLICY IF EXISTS "Insert own couple daily notes" ON public.daily_notes;
CREATE POLICY "Insert own couple daily notes" ON public.daily_notes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (couple_id IS NULL OR couple_id = get_my_couple_id()));

-- meetings
DROP POLICY IF EXISTS "Insert own data" ON public.meetings;
DROP POLICY IF EXISTS "Insert own couple meetings" ON public.meetings;
CREATE POLICY "Insert own couple meetings" ON public.meetings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND couple_id = get_my_couple_id());

-- medicines
DROP POLICY IF EXISTS "Insert own data" ON public.medicines;
DROP POLICY IF EXISTS "Insert own couple medicines" ON public.medicines;
CREATE POLICY "Insert own couple medicines" ON public.medicines
  FOR INSERT TO authenticated
  WITH CHECK (couple_id = get_my_couple_id());
