-- ============================================================
-- 006: Admin Kullanıcısını Yeniden Oluşturma
-- ============================================================

DO $$
DECLARE
    admin_uid uuid := gen_random_uuid();
    admin_email text := 'admin@couples.app';
    admin_pass text := 'adminadmin';
BEGIN
    -- Eğer önceden eklenmemişse auth.users'a ekle
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
            recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, 
            created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', admin_uid, 'authenticated', 'authenticated', admin_email, 
            crypt(admin_pass, gen_salt('bf')), now(), 
            now(), now(), '{"provider":"email","providers":["email"]}', '{"username":"adminadmin", "display_name": "Yönetici"}', 
            now(), now(), '', '', '', ''
        );
        
        -- public.users tablosu handle_new_user trigger'ı ile anında oluşturulur.
        -- O yüzden direk rolünü ADMIN yapıyoruz.
        UPDATE public.users
        SET role = 'ADMIN'
        WHERE id = admin_uid;
    ELSE
        -- Varsa sadece şifresini ve rolünü güncelle (emin olmak için)
        UPDATE auth.users
        SET encrypted_password = crypt(admin_pass, gen_salt('bf'))
        WHERE email = admin_email;
        
        UPDATE public.users
        SET role = 'ADMIN'
        WHERE email = admin_email;
    END IF;
END $$;
