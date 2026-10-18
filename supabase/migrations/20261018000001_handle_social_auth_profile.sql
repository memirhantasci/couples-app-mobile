-- ============================================================
-- 20261018000001: Sosyal Giriş (Google / Apple) Profil Tetikleyicisi & Username Koruması
-- ============================================================
-- Bu migration:
-- 1. users tablosundaki eski check_username_format kısıtını tamamen kaldırır.
--    (Çünkü kullanıcı adları artık istemcide "det:HEX" şeklinde AES ile şifrelendiğinden
--     düz metin regex kısıtları veritabanında hataya yol açmaktadır).
-- 2. users.username kolonundaki olası NOT NULL kısıtını kaldırarak NULL güvenli yapar.
-- 3. handle_new_user() fonksiyonunu günceller:
--    Google ve Apple ile giren kullanıcılarda display_name'i otomatik full_name veya name'den alır.
-- ============================================================

DO $$
BEGIN
  -- 1. Eski regex format kısıtlamasını tamamen kaldır (Şifreli "det:..." metinleriyle uyum için)
  ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_username_format;

  -- 2. Olası NOT NULL kısıtını kaldır (Sosyal girişte username boş kalabilir)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'username'
  ) THEN
    ALTER TABLE public.users ALTER COLUMN username DROP NOT NULL;
  END IF;
END $$;

-- 3. Trigger Fonksiyonunu Güncelle
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, display_name, gender, couple_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      'Kullanıcı'
    ),
    NEW.raw_user_meta_data->>'gender',
    NULL
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
