-- ============================================================
-- 008: RLS Infinite Recursion Fix
-- ============================================================

-- 1. Create a SECURITY DEFINER function to fetch the user's couple_id safely without triggering RLS
CREATE OR REPLACE FUNCTION get_my_couple_id()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT couple_id FROM public.users WHERE id = auth.uid();
$$;

-- 2. Update all RLS policies to use this function instead of a subquery
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
        
        -- Önce var olan politikaları temizleyelim (Varsa)
        FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t)
        LOOP
            EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.' || quote_ident(t);
        END LOOP;

        IF t = 'users' THEN
            EXECUTE 'CREATE POLICY "Users can view profiles in their couple" ON public.users FOR SELECT USING (id = auth.uid() OR couple_id = get_my_couple_id())';
            EXECUTE 'CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (id = auth.uid())';
        
        ELSIF t = 'couples' THEN
            EXECUTE 'CREATE POLICY "Couples can be viewed by their members" ON public.couples FOR SELECT USING (id = get_my_couple_id())';
            EXECUTE 'CREATE POLICY "Couples can be updated by their members" ON public.couples FOR UPDATE USING (id = get_my_couple_id())';
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
                EXECUTE 'CREATE POLICY "View couple data" ON public.' || quote_ident(t) || ' FOR SELECT USING (couple_id = get_my_couple_id())';
                
                IF NOT has_user_id THEN
                    -- Sadece couple_id varsa
                    EXECUTE 'CREATE POLICY "Insert couple data" ON public.' || quote_ident(t) || ' FOR INSERT WITH CHECK (couple_id = get_my_couple_id())';
                    EXECUTE 'CREATE POLICY "Update couple data" ON public.' || quote_ident(t) || ' FOR UPDATE USING (couple_id = get_my_couple_id())';
                    EXECUTE 'CREATE POLICY "Delete couple data" ON public.' || quote_ident(t) || ' FOR DELETE USING (couple_id = get_my_couple_id())';
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
