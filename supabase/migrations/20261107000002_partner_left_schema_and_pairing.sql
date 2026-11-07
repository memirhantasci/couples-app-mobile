-- ============================================================================
-- Hesap silme v2 (1/4): şema, eşleşme anı ve yeni eşleşmede verinin taşınması
-- ----------------------------------------------------------------------------
-- Tasarım: docs/HESAP_SILME_VE_PREMIUM_TASARIMI.md
--
-- Bir kişi hesabını silince partneri (B) hesabıyla ve KENDİ içeriğiyle kalır; yeni biriyle eşleşebilir.
-- Bunun için:
--   • couples.paired_at        : ikinci üyenin katıldığı an. Partnerin görebileceği ortak veri yalnızca bu
--                                andan sonra kaydedilendir (görünürlük kuralı 3/4'te).
--   • couples.premium_owner_id : Premium'u kimin aldığı (apply_revenuecat_event yazar, 4/4).
--   • memories.created_by,
--     star_exoplanets.created_by: oluşturan (yeni kayıtlarda otomatik, istemci değiştiremez).
--   • users.last_seen_at,
--     users.protected_from_cleanup: hareketsiz hesap temizliği (2/4).
--
-- Eşleşme koduyla katılan kişinin önceki çifti silinir (tek üyeli olmalı). Eskiden bu çiftteki her şey
-- (ruh hali, günlük, fotoğraf...) cascade ile siliniyordu. Artık katılanın KENDİ kayıtları yeni çifte taşınır;
-- şifreli metinler (günlük, mektup) eski çiftin anahtarından yenisine sunucuda yeniden şifrelenir. Taşınan
-- kayıtları yeni partner göremez (oluşturulma anı paired_at'tan önce), sahibi görmeye devam eder.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. SÜTUNLAR
-- ============================================================================
ALTER TABLE public.couples ADD COLUMN IF NOT EXISTS paired_at TIMESTAMPTZ;
ALTER TABLE public.couples ADD COLUMN IF NOT EXISTS premium_owner_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'couples_premium_owner_id_fkey') THEN
    ALTER TABLE public.couples
      ADD CONSTRAINT couples_premium_owner_id_fkey
      FOREIGN KEY (premium_owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END;
$$;

ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.star_exoplanets ADD COLUMN IF NOT EXISTS created_by UUID;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memories_created_by_fkey') THEN
    ALTER TABLE public.memories
      ADD CONSTRAINT memories_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_exoplanets_created_by_fkey') THEN
    ALTER TABLE public.star_exoplanets
      ADD CONSTRAINT star_exoplanets_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END;
$$;
CREATE INDEX IF NOT EXISTS idx_memories_created_by ON public.memories (created_by);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS protected_from_cleanup BOOLEAN NOT NULL DEFAULT FALSE;
-- Mevcut hesaplar migration anında "görülmüş" sayılır: hiçbiri hemen temizliğe düşmez
UPDATE public.users SET last_seen_at = NOW() WHERE last_seen_at IS NULL;
ALTER TABLE public.users ALTER COLUMN last_seen_at SET DEFAULT NOW();

-- Mağaza inceleme / demo hesapları ve geliştirici hesapları hareketsizlik silmesinden muaf
-- (src/utils/demo.ts: @couplesky.app adresleri)
UPDATE public.users AS u
   SET protected_from_cleanup = TRUE
  FROM auth.users AS au
 WHERE au.id = u.id
   AND lower(au.email) LIKE '%@couplesky.app';

-- Mevcut (eşleşmiş) çiftlerin ortak verisi görünür kalsın: eşleşme anı = çiftin oluşturulduğu an
UPDATE public.couples AS c
   SET paired_at = COALESCE(c.created_at, NOW())
 WHERE c.paired_at IS NULL
   AND (SELECT count(*) FROM public.users AS u WHERE u.couple_id = c.id) >= 2;

-- Sayaç kaymış olabilir (ör. 2 üyeli çiftte 3): gerçek sayı yazılır
UPDATE public.couples AS c
   SET member_count = m.cnt
  FROM (SELECT c2.id, (SELECT count(*) FROM public.users AS u WHERE u.couple_id = c2.id)::smallint AS cnt
          FROM public.couples AS c2) AS m
 WHERE m.id = c.id AND c.member_count IS DISTINCT FROM m.cnt;

-- Dosya yolu → kayıt aramaları (depolama erişimi ve silme kuyruğu yol üzerinden bakar)
CREATE INDEX IF NOT EXISTS idx_photo_archive_storage_path ON public.photo_archive (storage_path);
CREATE INDEX IF NOT EXISTS idx_photo_archive_thumb_path ON public.photo_archive (thumb_path) WHERE thumb_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_memories_image_path ON public.memories (image_path) WHERE image_path IS NOT NULL;


-- ============================================================================
-- 2. OLUŞTURAN: yeni kayıtta oturumdaki kullanıcı, sonradan değiştirilemez
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_force_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Sistem işleri (auth.uid() yok: cron, servis, hesap silinirken yabancı anahtarın SET NULL eylemi)
  -- kendi verdiği değeri korur
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSE
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memories_created_by ON public.memories;
CREATE TRIGGER trg_memories_created_by
  BEFORE INSERT OR UPDATE ON public.memories
  FOR EACH ROW EXECUTE FUNCTION public.trg_force_created_by();

DROP TRIGGER IF EXISTS trg_star_exoplanets_created_by ON public.star_exoplanets;
CREATE TRIGGER trg_star_exoplanets_created_by
  BEFORE INSERT OR UPDATE ON public.star_exoplanets
  FOR EACH ROW EXECUTE FUNCTION public.trg_force_created_by();

REVOKE ALL ON FUNCTION public.trg_force_created_by() FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- 3. KORUNAN SÜTUNLAR
-- ============================================================================
-- paired_at istemciden geriye çekilirse yeni partner eski verileri görürdü; premium_owner_id Premium'un
-- kimde kalacağını belirler. İkisi de yalnızca sunucu fonksiyonlarıyla (bayrakla) değişir.
CREATE OR REPLACE FUNCTION public.check_couples_update_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Eğer is_premium veya premium_expires_at değiştirilmeye çalışılıyorsa ve sistem bayrağı yoksa engelle
  IF (NEW.is_premium IS DISTINCT FROM OLD.is_premium OR NEW.premium_expires_at IS DISTINCT FROM OLD.premium_expires_at) THEN
    -- Sadece servis rolü (admin) veya internal güvenli RPC izin verir
    IF NOT app_flag_on('app.allow_premium_override') AND auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'Premium durumu kullanıcı tarafından doğrudan güncellenemez.';
    END IF;
  END IF;

  IF NEW.premium_owner_id IS DISTINCT FROM OLD.premium_owner_id THEN
    IF NOT app_flag_on('app.allow_premium_override') AND auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'Premium sahibi doğrudan değiştirilemez.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.paired_at IS DISTINCT FROM OLD.paired_at THEN
    IF NOT app_flag_on('app.allow_couple_change') AND auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'Eşleşme anı doğrudan değiştirilemez.' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_users_update_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- couple_id doğrudan UPDATE ile değiştirilemez (Sadece join_couple_by_code_uuid gibi RPC ile)
  IF (NEW.couple_id IS DISTINCT FROM OLD.couple_id) THEN
    IF NOT app_flag_on('app.allow_couple_change') AND auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'couple_id doğrudan değiştirilemez. Lütfen eşleşme kodunu kullanın.';
    END IF;
  END IF;

  -- token_balance doğrudan UPDATE ile değiştirilemez (Sadece spend_tokens / promo RPC ile)
  IF (NEW.token_balance IS DISTINCT FROM OLD.token_balance) THEN
    IF NOT app_flag_on('app.allow_token_change') AND auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'token_balance doğrudan değiştirilemez.';
    END IF;
  END IF;

  -- Temizlik muafiyeti yalnızca yönetici (service_role / SQL) tarafından verilir
  IF (NEW.protected_from_cleanup IS DISTINCT FROM OLD.protected_from_cleanup) THEN
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'protected_from_cleanup doğrudan değiştirilemez.' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- users tetikleyicileri tabloları şemasız adla anar ve search_path'leri yoktu: search_path = '' olan bir
-- fonksiyondan (purge_account_data) kullanıcı çiftten çıkarılınca "relation couples does not exist" hatası
-- veriyordu (hesap silme hattı partner varken hiç tamamlanamazdı).
ALTER FUNCTION public.update_couple_member_count() SET search_path = public;
ALTER FUNCTION public.enforce_couple_max_members() SET search_path = public;


-- ============================================================================
-- 4. YARDIMCILAR
-- ============================================================================

-- Çift gerçekten iki kişi mi (member_count kayabilir; gerçek üye sayısı esas)
CREATE OR REPLACE FUNCTION public.couple_is_paired(p_couple_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_couple_id IS NOT NULL
     AND (SELECT count(*) FROM public.users AS u WHERE u.couple_id = p_couple_id) >= 2;
$$;

CREATE OR REPLACE FUNCTION public.my_couple_is_paired()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.couple_is_paired(public.get_my_couple_id());
$$;

-- Ortak görünürlüğün başladığı an (eşleşmemiş / hiç eşleşmemiş çiftte NULL: yalnızca kendi kayıtları görünür)
CREATE OR REPLACE FUNCTION public.my_couple_paired_at()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.paired_at FROM public.couples AS c WHERE c.id = public.get_my_couple_id();
$$;

REVOKE ALL ON FUNCTION public.couple_is_paired(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.couple_is_paired(INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.my_couple_is_paired() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_couple_paired_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_couple_is_paired() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_couple_paired_at() TO authenticated, service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- Çift anahtarı (istemcideki src/utils/crypto.ts ile birebir): PBKDF2-HMAC-SHA256(couple_id, salt, 1000, 32)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.couple_encryption_key(p_couple_id INTEGER)
RETURNS BYTEA
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_salt TEXT;
  v_pw   BYTEA;
  v_u    BYTEA;
  v_h    TEXT;
  t1 BIGINT; t2 BIGINT; t3 BIGINT; t4 BIGINT;
BEGIN
  SELECT c.encryption_salt INTO v_salt FROM public.couples AS c WHERE c.id = p_couple_id;
  IF v_salt IS NULL THEN
    RETURN NULL;
  END IF;

  v_pw := convert_to(p_couple_id::text, 'UTF8');
  v_u  := extensions.hmac(convert_to(v_salt, 'UTF8') || '\x00000001'::bytea, v_pw, 'sha256');
  v_h  := encode(v_u, 'hex');
  t1 := ('x' || substr(v_h, 1, 16))::bit(64)::bigint;
  t2 := ('x' || substr(v_h, 17, 16))::bit(64)::bigint;
  t3 := ('x' || substr(v_h, 33, 16))::bit(64)::bigint;
  t4 := ('x' || substr(v_h, 49, 16))::bit(64)::bigint;
  FOR i IN 2..1000 LOOP
    v_u := extensions.hmac(v_u, v_pw, 'sha256');
    v_h := encode(v_u, 'hex');
    t1 := t1 # ('x' || substr(v_h, 1, 16))::bit(64)::bigint;
    t2 := t2 # ('x' || substr(v_h, 17, 16))::bit(64)::bigint;
    t3 := t3 # ('x' || substr(v_h, 33, 16))::bit(64)::bigint;
    t4 := t4 # ('x' || substr(v_h, 49, 16))::bit(64)::bigint;
  END LOOP;

  RETURN decode(lpad(to_hex(t1), 16, '0') || lpad(to_hex(t2), 16, '0')
             || lpad(to_hex(t3), 16, '0') || lpad(to_hex(t4), 16, '0'), 'hex');
END;
$$;

-- "enc:IV_HEX:CT_HEX" (AES-256-CBC, PKCS7) metnini bir anahtardan diğerine taşır. Şifresiz ya da eski anahtarla
-- çözülemeyen metin olduğu gibi döner (asla düz metne dönüştürülüp yazılmaz).
CREATE OR REPLACE FUNCTION public.reencrypt_couple_text(p_text TEXT, p_from_key BYTEA, p_to_key BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plain BYTEA;
  v_iv    BYTEA;
BEGIN
  IF p_text IS NULL OR p_from_key IS NULL OR p_to_key IS NULL
     OR p_text !~ '^enc:[0-9a-fA-F]{32}:[0-9a-fA-F]+$' THEN
    RETURN p_text;
  END IF;

  BEGIN
    v_plain := extensions.decrypt_iv(
      decode(split_part(p_text, ':', 3), 'hex'),
      p_from_key,
      decode(split_part(p_text, ':', 2), 'hex'),
      'aes-cbc/pad:pkcs'
    );
    -- Yanlış anahtar çoğunlukla dolgu hatası verir; vermezse geçersiz UTF-8 üretir
    PERFORM convert_from(v_plain, 'UTF8');
  EXCEPTION WHEN OTHERS THEN
    RETURN p_text;
  END;

  v_iv := extensions.gen_random_bytes(16);
  RETURN 'enc:' || encode(v_iv, 'hex') || ':'
      || encode(extensions.encrypt_iv(v_plain, p_to_key, v_iv, 'aes-cbc/pad:pkcs'), 'hex');
END;
$$;

REVOKE ALL ON FUNCTION public.couple_encryption_key(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reencrypt_couple_text(TEXT, BYTEA, BYTEA) FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- 5. TAŞINAN ÇİFTLER (dosya yolu öneki için)
-- ============================================================================
-- Taşınan fotoğraf / anı görsellerinin depodaki yolu eski çiftin klasöründe kalır (<eski_couple_id>/...). Silme
-- kuyruğu, kaydın çiftine ait olmayan klasördeki dosyayı kabul etmez (başkasının dosyasını silme girişimi);
-- buradaki kayıt, eski klasörün bu çifte taşındığını kanıtlar.
CREATE TABLE IF NOT EXISTS public.couple_merges (
  old_couple_id INTEGER NOT NULL,
  new_couple_id INTEGER NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id       UUID,
  merged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (old_couple_id, new_couple_id)
);
CREATE INDEX IF NOT EXISTS idx_couple_merges_new ON public.couple_merges (new_couple_id);
ALTER TABLE public.couple_merges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.couple_merges FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- 6. PUSH SUSTURMA
-- ============================================================================
-- Kayıt taşıma (UPDATE couple_id) ruh hali / ilaç tetikleyicilerinde "güncellendi" bildirimi doğurmasın.
CREATE OR REPLACE FUNCTION public.invoke_push_webhook()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
  payload  jsonb;
BEGIN
  IF public.app_flag_on('app.suppress_push') THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'PUSH_WEBHOOK_SECRET'
    LIMIT 1;

    IF v_secret IS NULL THEN
      RAISE WARNING 'Push gönderilemedi (%.% %): PUSH_WEBHOOK_SECRET Vault içinde bulunamadı',
        TG_TABLE_NAME, TG_OP, TG_WHEN;
      RETURN NEW;
    END IF;

    payload := jsonb_build_object(
      'type',       TG_OP,
      'table',      TG_TABLE_NAME,
      'record',     row_to_json(NEW),
      'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD) END
    );

    PERFORM net.http_post(
      url     := 'https://vjnzoomngpwlkxwvixqs.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type',     'application/json',
        'x-webhook-secret', v_secret
      ),
      body    := payload
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Push gönderilemedi (%.% %): %', TG_TABLE_NAME, TG_OP, TG_WHEN, SQLERRM;
  END;

  RETURN NEW;
END;
$$;


-- ============================================================================
-- 7. PREMIUM BİRLEŞTİRME (eşleşmede taşıma ve mağaza doğrulaması ortak kuralı)
-- ============================================================================
-- Çifte bir kişinin Premium hakkını yazar: süresiz hak her zaman kazanır, aksi halde daha geç biten süre.
-- Sahip, çiftin Premium'unun dayandığı kişidir (bitişi en geç olan). Hak bitmişse dokunulmaz.
CREATE OR REPLACE FUNCTION public.merge_premium_into_couple(
  p_couple_id  INTEGER,
  p_owner      UUID,
  p_expires_at TIMESTAMPTZ,
  p_lifetime   BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_couple   public.couples%ROWTYPE;
  v_active   BOOLEAN;
  v_lifetime BOOLEAN;
  v_result   TEXT;
BEGIN
  IF p_couple_id IS NULL THEN
    RETURN 'no_couple';
  END IF;
  IF NOT COALESCE(p_lifetime, FALSE) AND (p_expires_at IS NULL OR p_expires_at <= statement_timestamp()) THEN
    RETURN 'not_active';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('couple_activity_lock'), p_couple_id);
  SELECT * INTO v_couple FROM public.couples AS c WHERE c.id = p_couple_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'no_couple';
  END IF;

  v_active   := public.premium_entitlement_active(v_couple.is_premium, v_couple.premium_expires_at);
  v_lifetime := v_active AND v_couple.premium_expires_at IS NULL;

  PERFORM set_config('app.allow_premium_override', 'on', true);
  IF v_lifetime THEN
    -- Sahipsiz süresiz hak (eski kayıt) bu kişiye bağlanır; sahibi olan süresiz hak değişmez
    IF COALESCE(p_lifetime, FALSE) AND v_couple.premium_owner_id IS NULL THEN
      UPDATE public.couples AS c SET premium_owner_id = p_owner WHERE c.id = p_couple_id;
    END IF;
    v_result := 'kept_lifetime';
  ELSIF COALESCE(p_lifetime, FALSE) THEN
    UPDATE public.couples AS c
       SET is_premium = TRUE, premium_expires_at = NULL, premium_owner_id = p_owner
     WHERE c.id = p_couple_id;
    v_result := 'granted';
  ELSIF NOT v_active OR p_expires_at > v_couple.premium_expires_at THEN
    UPDATE public.couples AS c
       SET is_premium = TRUE, premium_expires_at = p_expires_at, premium_owner_id = p_owner
     WHERE c.id = p_couple_id;
    v_result := 'granted';
  ELSE
    v_result := 'kept';
  END IF;
  PERFORM set_config('app.allow_premium_override', 'off', true);

  PERFORM public.sync_subscription_lifecycle(p_couple_id);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_premium_into_couple(INTEGER, UUID, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_premium_into_couple(INTEGER, UUID, TIMESTAMPTZ, BOOLEAN) TO service_role;


-- ============================================================================
-- 8. KİŞİNİN İÇERİĞİNİ BİR ÇİFTTEN DİĞERİNE TAŞIMA
-- ============================================================================
-- Yalnızca join_couple_by_code_uuid içinden (kişi eski çiftinde tek başınayken) çağrılır.
CREATE OR REPLACE FUNCTION public.move_member_content(p_user_id UUID, p_from INTEGER, p_to INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_from_key BYTEA;
  v_to_key   BYTEA;
  v_rows     BIGINT;
  v_total    BIGINT := 0;
  v_target   TEXT;
  v_table    TEXT;
  v_column   TEXT;
BEGIN
  IF p_user_id IS NULL OR p_from IS NULL OR p_to IS NULL OR p_from = p_to THEN
    RETURN jsonb_build_object('moved', 0);
  END IF;

  -- Koruma tetikleyicileri (tek kalan yazma kısıtı) ve push bildirimleri bu taşıma için devre dışı
  PERFORM set_config('app.allow_couple_change', 'true', true);
  PERFORM set_config('app.suppress_push', 'on', true);

  v_from_key := public.couple_encryption_key(p_from);
  v_to_key   := public.couple_encryption_key(p_to);

  -- Şifreli metin taşıyan tablolar
  UPDATE public.daily_notes AS dn
     SET couple_id = p_to,
         content = public.reencrypt_couple_text(dn.content, v_from_key, v_to_key)
   WHERE dn.couple_id = p_from AND dn.user_id = p_user_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;

  UPDATE public.letters AS l
     SET couple_id = p_to,
         title = public.reencrypt_couple_text(l.title, v_from_key, v_to_key),
         content = public.reencrypt_couple_text(l.content, v_from_key, v_to_key)
   WHERE l.couple_id = p_from AND l.sender_id = p_user_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;

  -- İlaç dozları: kişinin işaretledikleri ve kişinin ilaçlarına ait olanlar
  UPDATE public.medicine_logs AS ml
     SET couple_id = p_to
   WHERE ml.couple_id = p_from
     AND (ml.user_id = p_user_id
          OR ml.medicine_id IN (SELECT m.id FROM public.medicines AS m WHERE m.user_id = p_user_id));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_total := v_total + v_rows;

  -- Diğer kişisel / oluşturana ait kayıtlar
  FOREACH v_target IN ARRAY ARRAY[
    'calendar_notes.user_id', 'map_notes.user_id', 'medicines.user_id', 'meetings.user_id',
    'memories.created_by', 'moods.user_id', 'period_logs.user_id', 'photo_archive.user_id',
    'star_wishes.user_id'
  ] LOOP
    v_table  := split_part(v_target, '.', 1);
    v_column := split_part(v_target, '.', 2);
    EXECUTE format('UPDATE public.%I SET couple_id = $1 WHERE couple_id = $2 AND %I = $3', v_table, v_column)
      USING p_to, p_from, p_user_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_total := v_total + v_rows;
  END LOOP;

  -- Eski klasördeki dosyalar artık bu çiftin kayıtlarınca gösterilir (silme kuyruğu öneki kabul etsin).
  -- Daha önce eski çifte taşınmış klasörler de devralınır.
  INSERT INTO public.couple_merges (old_couple_id, new_couple_id, user_id)
  SELECT m.old_couple_id, p_to, p_user_id FROM public.couple_merges AS m WHERE m.new_couple_id = p_from
  UNION
  SELECT p_from, p_to, p_user_id
  ON CONFLICT DO NOTHING;

  PERFORM set_config('app.suppress_push', '', true);
  RETURN jsonb_build_object('moved', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.move_member_content(UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- 9. EŞLEŞME: katılanın verisi taşınır, eşleşme anı yazılır
-- ============================================================================
CREATE OR REPLACE FUNCTION public.join_couple_by_code_uuid(p_code TEXT)
RETURNS TABLE(result_couple_id INTEGER, result_is_paired BOOLEAN, result_error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT := normalize_pairing_code(p_code);
  v_target_id INTEGER;
  v_old_couple_id INTEGER;
  v_target_members INTEGER;
  v_old_members INTEGER;
  v_old couples%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.consume_auth_rate_limit('pair_join', v_uid::text, 20, 10 * 60) THEN
    RETURN QUERY SELECT NULL::INTEGER, FALSE, 'TOO_MANY_REQUESTS'::TEXT;
    RETURN;
  END IF;

  IF length(v_code) < 4 THEN
    RETURN QUERY SELECT NULL::INTEGER, FALSE, 'INVALID_CODE'::TEXT;
    RETURN;
  END IF;

  -- Kilit sırası her yerde aynı: önce kullanıcı satırı, sonra çift satırları (id sırasıyla)
  SELECT u.couple_id INTO v_old_couple_id FROM users u WHERE u.id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  -- Silinmek üzere olan hesap yeni bir çifte katılamaz (silme gününde çift dağılır)
  IF EXISTS (SELECT 1 FROM public.account_deletion_requests AS r WHERE r.user_id = v_uid) THEN
    RAISE EXCEPTION 'DELETION_PENDING';
  END IF;

  -- Önce birebir eşleşme; yoksa 0/O ve 1/I karışıklığını tolere eden eşleşme (yalnızca tekse)
  SELECT c.id INTO v_target_id FROM couples c WHERE c.pairing_code = v_code;
  IF v_target_id IS NULL THEN
    SELECT min(c.id) INTO v_target_id
      FROM couples c
     WHERE translate(c.pairing_code, '01', 'OI') = translate(v_code, '01', 'OI')
    HAVING count(*) = 1;
  END IF;

  -- İki taraf aynı anda birbirinin kodunu girerse kilitlenme (deadlock) yerine sıraya girer
  PERFORM 1 FROM couples c
   WHERE c.id IN (v_target_id, v_old_couple_id)
   ORDER BY c.id
     FOR UPDATE;

  IF v_old_couple_id IS NOT NULL THEN
    SELECT count(*) INTO v_old_members FROM users u WHERE u.couple_id = v_old_couple_id;
  END IF;

  IF v_old_couple_id IS NOT DISTINCT FROM v_target_id AND v_target_id IS NOT NULL THEN
    -- Kayıtta girilen kodla zaten bu çifte katılmış olabilir: tekrar denemek hata değildir
    IF v_old_members >= 2 THEN
      RETURN QUERY SELECT v_target_id, TRUE, NULL::TEXT;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SELF_CODE';
  END IF;

  IF v_old_members >= 2 THEN
    -- Kurulmuş bir çiftten başka bir koda geçmek partneri tek başına bırakır
    RAISE EXCEPTION 'ALREADY_PAIRED';
  END IF;

  IF v_target_id IS NOT NULL THEN
    SELECT count(*) INTO v_target_members FROM users u WHERE u.couple_id = v_target_id;
  END IF;

  -- Kod yok ya da sahibi artık o çiftte değil (kimse beklemiyor)
  IF v_target_id IS NULL OR COALESCE(v_target_members, 0) = 0 THEN
    RETURN QUERY SELECT NULL::INTEGER, FALSE, 'INVALID_CODE'::TEXT;
    RETURN;
  END IF;
  IF v_target_members >= 2 THEN
    RETURN QUERY SELECT NULL::INTEGER, FALSE, 'CODE_ALREADY_USED'::TEXT;
    RETURN;
  END IF;

  -- Kodun sahibi silinmek üzereyse yeni bir partnerle eşleşemez
  IF EXISTS (
    SELECT 1 FROM public.account_deletion_requests AS r
      JOIN users AS u ON u.id = r.user_id
     WHERE u.couple_id = v_target_id
  ) THEN
    RETURN QUERY SELECT NULL::INTEGER, FALSE, 'INVALID_CODE'::TEXT;
    RETURN;
  END IF;

  -- Katılanın kendi kayıtları (tek kaldığı / hiç eşleşmediği dönemden) yeni çifte taşınır
  IF v_old_couple_id IS NOT NULL THEN
    SELECT * INTO v_old FROM couples c WHERE c.id = v_old_couple_id;
    PERFORM public.move_member_content(v_uid, v_old_couple_id, v_target_id);
  END IF;

  PERFORM set_config('app.allow_couple_change', 'true', true);
  UPDATE users u SET couple_id = v_target_id WHERE u.id = v_uid;

  IF v_old_couple_id IS NOT NULL THEN
    -- Eski çiftte bu kişinin aldığı Premium onunla gelir
    IF v_old.premium_owner_id = v_uid
       AND public.premium_entitlement_active(v_old.is_premium, v_old.premium_expires_at) THEN
      PERFORM public.merge_premium_into_couple(
        v_target_id, v_uid, v_old.premium_expires_at, v_old.premium_expires_at IS NULL
      );
    END IF;

    -- Silmeyi engelleyen (cascade olmayan) bağlar
    DELETE FROM public.star_connections AS sc WHERE sc.requested_by_couple_id = v_old_couple_id;
    UPDATE public.promo_redemptions AS pr SET couple_id = v_target_id WHERE pr.couple_id = v_old_couple_id;

    DELETE FROM couples c
     WHERE c.id = v_old_couple_id
       AND NOT EXISTS (SELECT 1 FROM users u WHERE u.couple_id = v_old_couple_id);
  END IF;

  SELECT count(*) INTO v_target_members FROM users u WHERE u.couple_id = v_target_id;
  -- Sayaç tetikleyicisi bir gün kaysa bile member_count (ve is_paired) gerçeği göstersin.
  -- İkinci üye katıldığı an, partnerlerin ortak görünürlüğünün başlangıcıdır.
  UPDATE couples c
     SET member_count = v_target_members,
         paired_at = CASE WHEN v_target_members >= 2 THEN statement_timestamp() ELSE c.paired_at END
   WHERE c.id = v_target_id;
  PERFORM set_config('app.allow_couple_change', '', true);

  RETURN QUERY SELECT v_target_id, v_target_members >= 2, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.join_couple_by_code_uuid(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_couple_by_code_uuid(TEXT) TO authenticated;


-- ============================================================================
-- 10. DEPOLAMA: dosya kullanımı yol üzerinden, taşınan klasörler kabul edilir
-- ============================================================================
CREATE OR REPLACE FUNCTION public.storage_object_in_use(p_bucket TEXT, p_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_couple_id INTEGER;
BEGIN
  IF p_name IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Kullanıcı yeni avatar yüklediyse aynı yol yeniden kullanılıyor demektir
  IF p_bucket = 'avatars' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.users AS u
       WHERE u.id::text = split_part(p_name, '/', 1)
         AND u.avatar_url IS NOT NULL
         AND position('/avatars/' || p_name IN u.avatar_url) > 0);
  END IF;

  IF split_part(p_name, '/', 1) !~ '^[0-9]{1,9}$' THEN
    RETURN TRUE;
  END IF;
  v_couple_id := split_part(p_name, '/', 1)::integer;

  RETURN CASE p_bucket
    -- Taşınan kayıtlar dosyayı eski çiftin klasöründen göstermeye devam eder: çifte değil yola bakılır
    WHEN 'photos' THEN EXISTS (
      SELECT 1 FROM public.photo_archive AS p
       WHERE p.storage_path = p_name OR p.thumb_path = p_name)
    WHEN 'memories' THEN EXISTS (
      SELECT 1 FROM public.memories AS m
       WHERE m.image_path = p_name)
    -- Eski gezegen kayıtları yolu tam adres olarak tutabilir
    WHEN 'couple-memories' THEN EXISTS (
      SELECT 1 FROM public.star_exoplanets AS ep, unnest(ep.media_urls) AS media(ref)
       WHERE ep.couple_id = v_couple_id
         AND (media.ref = p_name OR position('/couple-memories/' || p_name IN media.ref) > 0))
    ELSE TRUE
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_storage_purge(p_bucket TEXT, p_names TEXT[], p_couple_id INTEGER, p_reason TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_couple_id IS NULL OR p_names IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO public.storage_purge_queue (bucket_id, object_name, couple_id, reason)
  SELECT p_bucket, t.name, p_couple_id, p_reason
    FROM (
      SELECT DISTINCT CASE
               WHEN btrim(n) ~* '^https?://' THEN substring(btrim(n) FROM '/' || p_bucket || '/([^?#]+)')
               ELSE btrim(n)
             END AS name
        FROM unnest(p_names) AS n
    ) AS t
   WHERE t.name ~ '^[0-9]{1,9}/[^/]'
     AND t.name !~ '(^|/)\.\.(/|$)'
     AND (
       split_part(t.name, '/', 1) = p_couple_id::text
       -- Yeni eşleşmede bu çifte taşınmış eski klasörler (yalnızca fotoğraf / anı görselleri taşınır)
       OR (p_bucket IN ('photos', 'memories') AND split_part(t.name, '/', 1) IN (
             SELECT m.old_couple_id::text FROM public.couple_merges AS m WHERE m.new_couple_id = p_couple_id))
     )
  ON CONFLICT ON CONSTRAINT storage_purge_queue_object_key DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.storage_object_in_use(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_storage_purge(TEXT, TEXT[], INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_object_in_use(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_storage_purge(TEXT, TEXT[], INTEGER, TEXT) TO service_role;

COMMIT;
