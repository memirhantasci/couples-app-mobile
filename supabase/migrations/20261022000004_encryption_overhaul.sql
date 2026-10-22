-- ============================================================
-- 20261022000004: Şifreleme ve Veri Güvenliği Revizyonu
-- (ARAYUZ_GELISTIRMESI.md, Görev 4.1)
-- ============================================================
-- 1. Deneme sınırı altyapısı: auth_rate_limits + consume_auth_rate_limit()
-- 2. Kullanıcı adları düz metin: küçük harf, 3-30 karakter, a-z 0-9 _, benzersiz.
--    Eski deterministik şifreli ("det:...") değerler çözülemez → NULL (giriş e-postayla yapılır).
-- 3. Görünen isimler düz metin (RLS ile korunur); çözülemeyen eski "enc:..." değerler kullanıcı
--    adına ya da "Kullanıcı"ya döner (isim değiştirme hakkı kullanılmamış sayılır).
-- 4. handle_new_user(): kullanıcı adını ve ismi normalize eder.
-- 5. get_email_by_username ve doğrulama kodunu çağırana döndüren şifre sıfırlama RPC'leri kaldırılır.
--    Yerine: auth-gateway Edge Function + Supabase Auth'un kendi kurtarma e-postası.
--    is_username_available(): kayıt formu için IP başına sınırlı uygunluk kontrolü.
-- 6. photos ve memories bucket'ları private; okuma/yükleme yalnızca çiftin üyelerine.
-- 7. photo_archive / memories: kalıcı public URL kolonları kaldırılır, depolama yolu tek doğruluk
--    kaynağı olur (istemci süreli imzalı URL üretir).
-- 8. couples.encryption_salt: sunucuda 256-bit rastgele üretilir, sonradan değiştirilemez.
--
-- Mevcut test verisi sıfırlandığı için şifreli içerik dönüştürülmez.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Deneme sınırı (yalnızca SECURITY DEFINER fonksiyonlar ve service_role kullanır)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  subject TEXT NOT NULL,
  hit_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_rate_limits_lookup_idx
  ON public.auth_rate_limits (bucket, subject, hit_at);

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.auth_rate_limits FROM anon, authenticated;

-- Pencere içindeki deneme sayısı p_max'a ulaşmadıysa denemeyi kaydeder ve TRUE döner.
CREATE OR REPLACE FUNCTION public.consume_auth_rate_limit(
  p_bucket TEXT,
  p_subject TEXT,
  p_max INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('auth_rate_limit'), hashtext(p_bucket || ':' || p_subject));

  DELETE FROM public.auth_rate_limits
  WHERE bucket = p_bucket AND subject = p_subject
    AND hit_at < now() - make_interval(secs => p_window_seconds);

  SELECT count(*) INTO v_count
  FROM public.auth_rate_limits
  WHERE bucket = p_bucket AND subject = p_subject;

  IF v_count >= p_max THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.auth_rate_limits (bucket, subject) VALUES (p_bucket, p_subject);

  -- Başka kişilere ait eski kayıtlar da ara sıra temizlenir
  IF random() < 0.01 THEN
    DELETE FROM public.auth_rate_limits WHERE hit_at < now() - interval '1 day';
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_auth_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_auth_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;


-- ────────────────────────────────────────────────────────────
-- 2. Düz metin kullanıcı adı
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_username_format;

-- Biçime uyan eski düz metin değerler küçük harfe çekilir (çakışma yoksa)
UPDATE public.users AS u
SET username = lower(u.username)
WHERE u.username ~ '^[A-Za-z0-9_]{3,30}$'
  AND u.username <> lower(u.username)
  AND NOT EXISTS (SELECT 1 FROM public.users AS o WHERE o.username = lower(u.username));

-- "det:..." şifreli ya da biçime uymayan değerler kullanılamaz
UPDATE public.users
SET username = NULL
WHERE username IS NOT NULL AND username !~ '^[a-z0-9_]{3,30}$';

ALTER TABLE public.users
  ADD CONSTRAINT check_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,30}$');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND conname = 'users_username_key'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_username_key UNIQUE (username);
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- 3. Düz metin görünen isim
-- ────────────────────────────────────────────────────────────
UPDATE public.users
SET display_name = COALESCE(username, 'Kullanıcı')
WHERE display_name LIKE 'enc:%' OR display_name LIKE 'det:%';

UPDATE public.users
SET display_name = left(btrim(display_name), 50)
WHERE char_length(display_name) > 50;

-- Şifreli metin için 500'e çıkarılan sınır düz metin sınırına döner
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_display_name_length;
ALTER TABLE public.users
  ADD CONSTRAINT check_display_name_length
  CHECK (display_name IS NULL OR (char_length(btrim(display_name)) > 0 AND char_length(display_name) <= 50));


-- ────────────────────────────────────────────────────────────
-- 4. Kayıtta profil satırı
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT := lower(btrim(NEW.raw_user_meta_data->>'username'));
  v_display_name TEXT := left(COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data->>'name'), ''),
    'Kullanıcı'
  ), 50);
BEGIN
  -- Sosyal girişte kullanıcı adı yoktur; biçime uymayan değer de kaydedilmez.
  -- Alınmış bir kullanıcı adı benzersizlik kısıtına takılır ve kayıt başarısız olur.
  IF v_username IS NOT NULL AND v_username !~ '^[a-z0-9_]{3,30}$' THEN
    v_username := NULL;
  END IF;

  INSERT INTO public.users (id, username, display_name, gender, couple_id)
  VALUES (NEW.id, v_username, v_display_name, NEW.raw_user_meta_data->>'gender', NULL)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 5. Güvensiz kimlik RPC'leri ve yerine gelen uygunluk kontrolü
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_email_by_username(TEXT);
DROP FUNCTION IF EXISTS public.request_password_reset_otp(TEXT);
DROP FUNCTION IF EXISTS public.reset_password_with_otp(UUID, TEXT, TEXT);
DROP TABLE IF EXISTS public.otp_codes;
DROP TABLE IF EXISTS public.login_attempts;

-- Kayıt formu oturum açılmadan çalışır ve users tablosunu (RLS) okuyamaz.
CREATE OR REPLACE FUNCTION public.is_username_available(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT := lower(btrim(p_username));
  v_ip TEXT := btrim(split_part(
    COALESCE(NULLIF(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ''),
    ',', 1
  ));
BEGIN
  IF v_username IS NULL OR v_username !~ '^[a-z0-9_]{3,30}$' THEN
    RAISE EXCEPTION 'INVALID_USERNAME' USING ERRCODE = '22023';
  END IF;

  IF NOT public.consume_auth_rate_limit('username_check', COALESCE(NULLIF(v_ip, ''), 'unknown'), 30, 300) THEN
    RAISE EXCEPTION 'TOO_MANY_REQUESTS' USING ERRCODE = 'P0429';
  END IF;

  RETURN NOT EXISTS (SELECT 1 FROM public.users WHERE username = v_username);
END;
$$;

REVOKE ALL ON FUNCTION public.is_username_available(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_username_available(TEXT) TO anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 6. Private bucket'lar ve depolama RLS'i
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('photos', 'photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('memories', 'memories', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = false;

UPDATE storage.buckets SET public = false WHERE id = 'couple-memories';

-- Bu iki bucket için tanımlanmış tüm eski politikalar (dashboard'dan eklenen herkese açık okuma
-- politikaları dahil) kaldırılır; yerlerine aşağıdakiler gelir.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) ~ 'bucket_id\s*=\s*''(photos|memories)'''
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- photos: okuma ve yükleme çiftin Premium üyelerine (photo_archive RLS'iyle aynı), silme yalnızca yükleyene
CREATE POLICY "photos_select_couple_premium" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = public.get_my_couple_id()::text
  AND public.has_my_active_premium()
);

CREATE POLICY "photos_insert_couple_premium" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = public.get_my_couple_id()::text
  AND public.has_my_active_premium()
);

CREATE POLICY "photos_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = public.get_my_couple_id()::text
  AND owner_id = auth.uid()::text
);

-- memories (özel gün fotoğrafları): çift okur ve siler (anı kayıtları da çifte ortak), yükleme Premium
CREATE POLICY "memories_select_couple" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'memories'
  AND (storage.foldername(name))[1] = public.get_my_couple_id()::text
);

CREATE POLICY "memories_insert_couple_premium" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'memories'
  AND (storage.foldername(name))[1] = public.get_my_couple_id()::text
  AND public.has_my_active_premium()
);

CREATE POLICY "memories_delete_couple" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'memories'
  AND (storage.foldername(name))[1] = public.get_my_couple_id()::text
);


-- ────────────────────────────────────────────────────────────
-- 7. Depolama yolu tek doğruluk kaynağı
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.photo_archive ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.photo_archive ADD COLUMN IF NOT EXISTS thumb_path TEXT;
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS image_path TEXT;

-- Kalan eski satırların yolu public URL'den çıkarılır
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'photo_archive' AND column_name = 'image_url') THEN
    EXECUTE $sql$
      UPDATE public.photo_archive
      SET storage_path = substring(image_url FROM '/object/public/photos/(.+)$')
      WHERE storage_path IS NULL AND image_url IS NOT NULL
    $sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'photo_archive' AND column_name = 'thumb_url') THEN
    EXECUTE $sql$
      UPDATE public.photo_archive
      SET thumb_path = substring(thumb_url FROM '/object/public/photos/(.+)$')
      WHERE thumb_path IS NULL AND thumb_url IS NOT NULL
    $sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'memories' AND column_name = 'image_url') THEN
    EXECUTE $sql$
      UPDATE public.memories
      SET image_path = substring(image_url FROM '/object/public/memories/(.+)$')
      WHERE image_path IS NULL AND image_url IS NOT NULL
    $sql$;
  END IF;
END $$;

-- Dosyası bilinmeyen fotoğraf kaydı gösterilemez
DELETE FROM public.photo_archive WHERE storage_path IS NULL;

ALTER TABLE public.photo_archive DROP COLUMN IF EXISTS image_url;
ALTER TABLE public.photo_archive DROP COLUMN IF EXISTS thumb_url;
ALTER TABLE public.memories DROP COLUMN IF EXISTS image_url;

ALTER TABLE public.photo_archive ALTER COLUMN storage_path SET NOT NULL;

-- Kayıt yalnızca kendi çiftinin klasöründeki dosyayı gösterebilir
ALTER TABLE public.photo_archive DROP CONSTRAINT IF EXISTS photo_archive_paths_in_couple_folder;
ALTER TABLE public.photo_archive
  ADD CONSTRAINT photo_archive_paths_in_couple_folder
  CHECK (
    split_part(storage_path, '/', 1) = couple_id::text
    AND (thumb_path IS NULL OR split_part(thumb_path, '/', 1) = couple_id::text)
  );

ALTER TABLE public.memories DROP CONSTRAINT IF EXISTS memories_image_in_couple_folder;
ALTER TABLE public.memories
  ADD CONSTRAINT memories_image_in_couple_folder
  CHECK (image_path IS NULL OR split_part(image_path, '/', 1) = couple_id::text);


-- ────────────────────────────────────────────────────────────
-- 8. Çift şifreleme tuzu
-- ────────────────────────────────────────────────────────────
-- İstemci anahtarı PBKDF2(couple_id, encryption_salt) ile bellekte türetir. Tuz sunucuda üretilir;
-- değişirse çiftin tüm şifreli içerikleri okunamaz hale gelir, bu yüzden sonradan değiştirilemez.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- pgcrypto projeye göre "extensions" ya da "public" şemasında olabilir
SET LOCAL search_path = public, extensions;
UPDATE public.couples
SET encryption_salt = encode(gen_random_bytes(32), 'hex')
WHERE encryption_salt IS NULL OR encryption_salt = '';

CREATE OR REPLACE FUNCTION public.enforce_couple_encryption_salt()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.encryption_salt := encode(gen_random_bytes(32), 'hex');
  ELSIF NEW.encryption_salt IS DISTINCT FROM OLD.encryption_salt THEN
    RAISE EXCEPTION 'encryption_salt değiştirilemez.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_couple_encryption_salt ON public.couples;
CREATE TRIGGER trg_enforce_couple_encryption_salt
  BEFORE INSERT OR UPDATE OF encryption_salt ON public.couples
  FOR EACH ROW EXECUTE FUNCTION public.enforce_couple_encryption_salt();

ALTER TABLE public.couples ALTER COLUMN encryption_salt DROP DEFAULT;
ALTER TABLE public.couples ALTER COLUMN encryption_salt SET NOT NULL;

COMMIT;
