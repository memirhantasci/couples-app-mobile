-- ============================================================
-- 003: Supabase Auth Refactor & RLS Implementation
-- (Dynamic and Safe Version)
-- ============================================================

-- 1. Verileri Temizle (ID Tiplerini Sorunsuz Değiştirmek İçin)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    ) LOOP
        -- Sadece login_attempts dışındaki tüm tabloları temizle
        IF r.tablename != 'login_attempts' THEN
            EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
        END IF;
    END LOOP;
END $$;

-- 2. Users Tablosunu UUID & Supabase Auth Uyumlu Hale Getir
ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_pkey CASCADE;
ALTER TABLE IF EXISTS users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS users ALTER COLUMN id TYPE UUID USING gen_random_uuid();
ALTER TABLE IF EXISTS users ADD PRIMARY KEY (id);
ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE IF EXISTS users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_username_key;
ALTER TABLE IF EXISTS users ADD CONSTRAINT users_username_key UNIQUE (username);
ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS password;

-- 3. Diğer Tablolardaki user_id, sender_id, receiver_id Kolonlarını UUID Yap
DO $$ 
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id') THEN
            EXECUTE 'ALTER TABLE public.' || quote_ident(t) || ' ALTER COLUMN user_id TYPE UUID USING NULL';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'sender_id') THEN
            EXECUTE 'ALTER TABLE public.' || quote_ident(t) || ' ALTER COLUMN sender_id TYPE UUID USING NULL';
        END IF;
        
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'receiver_id') THEN
            EXECUTE 'ALTER TABLE public.' || quote_ident(t) || ' ALTER COLUMN receiver_id TYPE UUID USING NULL';
        END IF;
    END LOOP;
END $$;

-- 4. Supabase Auth'a Kayıt Olunca Otomatik Public.Users Oluşturma (Trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, display_name, gender, couple_id)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'gender',
    NULL
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- 5. Kullanıcı Adı (Username) ile Email Bulma (Giriş İçin) + Rate Limiting
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  attempt_time TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_user_id UUID;
  v_ip TEXT;
  v_count INT;
BEGIN
  v_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
  v_ip := split_part(v_ip, ',', 1);
  
  IF v_ip IS NULL OR v_ip = '' THEN
    v_ip := COALESCE(inet_client_addr()::text, 'unknown');
  END IF;

  DELETE FROM public.login_attempts 
  WHERE ip_address = v_ip AND attempt_time < now() - interval '5 minutes';

  SELECT count(*) INTO v_count 
  FROM public.login_attempts 
  WHERE ip_address = v_ip;
  
  IF v_count >= 10 THEN
    RAISE EXCEPTION 'TOO_MANY_REQUESTS';
  END IF;

  INSERT INTO public.login_attempts (ip_address) VALUES (v_ip);

  SELECT id INTO v_user_id FROM public.users WHERE username = p_username;
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION get_email_by_username(TEXT) TO anon, authenticated;

-- 6. RPC Fonksiyonlarını auth.uid() Kullanacak Şekilde Güvenli Hale Getir
-- (Var olan fonksiyonları üzerine yazıyoruz, yoksa oluşturmuyoruz)

-- 6.1: save_letter
CREATE OR REPLACE FUNCTION save_letter(
  p_receiver_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_unlock_date DATE,
  p_couple_id INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO letters (sender_id, receiver_id, title, content, unlock_date, couple_id)
  VALUES (auth.uid(), p_receiver_id, p_title, p_content, p_unlock_date, p_couple_id);
END;
$$;

-- 6.2: save_daily_note
CREATE OR REPLACE FUNCTION save_daily_note(
  p_date TEXT,
  p_content TEXT,
  p_couple_id INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO daily_notes (user_id, date, content, couple_id)
  VALUES (auth.uid(), p_date, p_content, p_couple_id)
  ON CONFLICT (user_id, date) 
  DO UPDATE SET content = EXCLUDED.content;
END;
$$;

-- 6.3: join_couple_by_code_uuid
CREATE OR REPLACE FUNCTION join_couple_by_code_uuid(p_code TEXT)
RETURNS TABLE(result_couple_id INTEGER, result_is_paired BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_couple RECORD;
  v_old_couple_id INTEGER;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_target_couple
    FROM couples
   WHERE pairing_code = UPPER(p_code)
     FOR UPDATE;

  IF v_target_couple IS NULL THEN
    RAISE EXCEPTION 'INVALID_CODE';
  END IF;

  IF v_target_couple.member_count >= 2 THEN
    RAISE EXCEPTION 'CODE_ALREADY_USED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM users
     WHERE id = v_uid
       AND couple_id = v_target_couple.id
  ) THEN
    RAISE EXCEPTION 'SELF_CODE';
  END IF;

  SELECT couple_id INTO v_old_couple_id
    FROM users
   WHERE id = v_uid;

  UPDATE users
     SET couple_id = v_target_couple.id
   WHERE id = v_uid;

  IF v_old_couple_id IS NOT NULL AND v_old_couple_id != v_target_couple.id THEN
    DELETE FROM couples
     WHERE id = v_old_couple_id
       AND NOT EXISTS (
         SELECT 1 FROM users WHERE users.couple_id = v_old_couple_id
       );
  END IF;

  RETURN QUERY SELECT v_target_couple.id, (v_target_couple.member_count + 1) >= 2;
END;
$$;

-- 6.4: log_medicine_dose
CREATE OR REPLACE FUNCTION log_medicine_dose(
  p_medicine_id INTEGER,
  p_date TEXT,
  p_time TEXT,
  p_status TEXT,
  p_couple_id INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO medicine_logs (user_id, medicine_id, date, time, status, couple_id)
  VALUES (auth.uid(), p_medicine_id, p_date, p_time, p_status, p_couple_id)
  ON CONFLICT (user_id, medicine_id, date, time)
  DO UPDATE SET status = EXCLUDED.status;
END;
$$;

-- 6.5: toggle_period_log
CREATE OR REPLACE FUNCTION toggle_period_log(
  p_date TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM period_logs WHERE user_id = auth.uid() AND date = p_date
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM period_logs WHERE user_id = auth.uid() AND date = p_date;
  ELSE
    INSERT INTO period_logs (user_id, date, type) VALUES (auth.uid(), p_date, 'period');
  END IF;
END;
$$;

-- 7. OTOMATİK ROW LEVEL SECURITY (RLS) POLİTİKALARI (Dinamik Tablo Analizi İle)
DO $$ 
DECLARE
    t TEXT;
    has_user_id BOOLEAN;
    has_couple_id BOOLEAN;
    has_sender_id BOOLEAN;
    has_receiver_id BOOLEAN;
    r RECORD;
BEGIN
    FOR t IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('login_attempts')
    LOOP
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id') INTO has_user_id;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'couple_id') INTO has_couple_id;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'sender_id') INTO has_sender_id;
        SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'receiver_id') INTO has_receiver_id;
        
        EXECUTE 'ALTER TABLE public.' || quote_ident(t) || ' ENABLE ROW LEVEL SECURITY';
        
        -- Önce var olan politikaları temizleyelim (Varsa)
        FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t)
        LOOP
            EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(t);
        END LOOP;

        IF t = 'users' THEN
            EXECUTE 'CREATE POLICY "Users can view profiles in their couple" ON public.users FOR SELECT USING (id = auth.uid() OR couple_id = (SELECT couple_id FROM users WHERE id = auth.uid()))';
            EXECUTE 'CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (id = auth.uid())';
        
        ELSIF t = 'couples' THEN
            EXECUTE 'CREATE POLICY "Couples can be viewed by their members" ON public.couples FOR SELECT USING (id = (SELECT couple_id FROM users WHERE id = auth.uid()))';
            EXECUTE 'CREATE POLICY "Couples can be updated by their members" ON public.couples FOR UPDATE USING (id = (SELECT couple_id FROM users WHERE id = auth.uid()))';
            EXECUTE 'CREATE POLICY "Anyone can create a couple" ON public.couples FOR INSERT WITH CHECK (true)';
            EXECUTE 'CREATE POLICY "Anyone can delete empty couples" ON public.couples FOR DELETE USING (true)';
        
        ELSIF has_sender_id AND has_receiver_id THEN
            -- Mektuplar vs. için Sender/Receiver RLS'i
            EXECUTE 'CREATE POLICY "View letters involved in" ON public.' || quote_ident(t) || ' FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid())';
            EXECUTE 'CREATE POLICY "Insert own sent letters" ON public.' || quote_ident(t) || ' FOR INSERT WITH CHECK (sender_id = auth.uid())';
            EXECUTE 'CREATE POLICY "Update own sent letters" ON public.' || quote_ident(t) || ' FOR UPDATE USING (sender_id = auth.uid())';
            EXECUTE 'CREATE POLICY "Delete own sent letters" ON public.' || quote_ident(t) || ' FOR DELETE USING (sender_id = auth.uid())';

        ELSE
            IF has_couple_id THEN
                EXECUTE 'CREATE POLICY "View couple data" ON public.' || quote_ident(t) || ' FOR SELECT USING (couple_id = (SELECT couple_id FROM users WHERE id = auth.uid()))';
                
                IF NOT has_user_id THEN
                    -- Sadece couple_id varsa
                    EXECUTE 'CREATE POLICY "Insert couple data" ON public.' || quote_ident(t) || ' FOR INSERT WITH CHECK (couple_id = (SELECT couple_id FROM users WHERE id = auth.uid()))';
                    EXECUTE 'CREATE POLICY "Update couple data" ON public.' || quote_ident(t) || ' FOR UPDATE USING (couple_id = (SELECT couple_id FROM users WHERE id = auth.uid()))';
                    EXECUTE 'CREATE POLICY "Delete couple data" ON public.' || quote_ident(t) || ' FOR DELETE USING (couple_id = (SELECT couple_id FROM users WHERE id = auth.uid()))';
                END IF;
            END IF;

            IF has_user_id THEN
                -- Eğer user_id varsa, yazma işlemlerini her zaman kullanıcının kendisine veriyoruz.
                EXECUTE 'CREATE POLICY "Insert own data" ON public.' || quote_ident(t) || ' FOR INSERT WITH CHECK (user_id = auth.uid())';
                EXECUTE 'CREATE POLICY "Update own data" ON public.' || quote_ident(t) || ' FOR UPDATE USING (user_id = auth.uid())';
                EXECUTE 'CREATE POLICY "Delete own data" ON public.' || quote_ident(t) || ' FOR DELETE USING (user_id = auth.uid())';
                
                IF NOT has_couple_id THEN
                    -- couple_id YOKSA ve sadece user_id varsa (örneğin push_tokens), sadece kendisi okuyabilir
                    EXECUTE 'CREATE POLICY "View own data" ON public.' || quote_ident(t) || ' FOR SELECT USING (user_id = auth.uid())';
                END IF;
            END IF;
        END IF;
    END LOOP;
END $$;
