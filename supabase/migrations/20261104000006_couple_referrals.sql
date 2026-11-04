-- ============================================================================
-- Çift Arkadaşını Davet Et (Couple Referral & Win-Win)
-- ============================================================================
-- Eşleşmiş her çiftin kısa bir davet kodu vardır (SKY + 5 karakter, ekranda SKY-XXXXX). Arkadaş, hesabını
-- açtıktan sonraki 7 gün içinde bu kodu girer (eşleşme ekranında, davet bağlantısıyla ya da eşleştikten
-- sonra davet penceresinde). Kod girmek tek başına HİÇBİR ödül vermez: ödül yalnızca kodu giren kişinin
-- çifti 2 kişilik gerçek bir çifte dönüştüğü an (couples.member_count 1 → 2) değerlendirilir.
--
-- Ödül (her iki çifte ayrı ayrı, grant_referral_reward):
--   • Premium hakkı yoksa (ücretsiz, kış uykusu, kasa)  → şimdiden itibaren 3 gün Premium. Bitince çift
--     20261104000003'teki yaşam döngüsüne (14 gün kış uykusu → 90 gün kasa) olağan biçimde düşer.
--   • Premium'u bu programın hediyesiyse (bitiş, son davet ödülünün yazdığı anla birebir aynı) → bitişe +3 gün.
--   • Premium'u mağaza aboneliği, promosyon ya da süresizse → çiftin iki üyesine 250'şer jeton.
--     Mağaza aboneliğinin bitişine gün eklemek işe yaramazdı: apply_revenuecat_event yenilemede
--     bitiş = max(mevcut, mağaza) yazar, eklenen günler ilk yenilemede kaybolurdu.
--
-- Sahtekârlık kalkanı (activate_couple_referrals):
--   • Davet eden ile edilen çiftin üyeleri, ya da yeni çiftin iki üyesi aynı cihaz kimliğini paylaşıyorsa
--     (device_authorizations) ödül verilmez (same_device). Cihaz kimliği uygulama kurulumunda rastgele
--     üretilir; aynı telefonda açılan sahte hesapları yakalar.
--   • Davet eden çift en fazla 5 kez ödül alır (couple_referral_codes.rewarded_count yalnızca artar; davet
--     edilen hesap silinse de düşmez). Kota dolduktan sonra gelen arkadaş çift hediyesini yine alır.
--   • Bir kullanıcı ömründe bir kez davet edilebilir; daha önce ödüllenmiş bir çiftin üyesi yeni bir çiftle
--     tekrar ödül kazandıramaz (member_already_rewarded); bir çift tek davetle ödüllenir.
--   • Kod yalnızca yeni hesaplarca (7 gün) ve kullanıcı başına 10 dakikada 10 denemeyle girilebilir.
--
-- Gökkubbe: ödüllenen iki çiftin ikisinin de yıldızı olduğu an (ödül anında, yıldız tescilinde ya da Premium
-- yeniden açıldığında) aralarında kabul edilmiş bir yıldız bağı kendiliğinden kurulur; olağan bağ kurallarına
-- uyulur (iki çiftin de Premium'u geçerli, en fazla 3 bağ, daha önce reddedilmiş bağ yeniden kurulmaz).
-- Yıldızı olmayan taraf Gökkubbe'de arkadaşının yıldızını gösteren bir davet kartı görür
-- (get_referral_star_invite).
--
-- Bildirim: davet ödüllenince davet eden çifte push gider (send-push, couple_referrals dalı).
--
-- Tablolara istemci doğrudan erişemez; her şey SECURITY DEFINER RPC'lerle yürür:
--   apply_referral_code, get_my_referral_overview, get_referral_star_invite.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Kurallar (tek kaynak)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.referral_reward_period()
RETURNS INTERVAL
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT INTERVAL '3 days' $$;

CREATE OR REPLACE FUNCTION public.referral_reward_tokens()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT 250 $$;

-- Davet eden çiftin en fazla kaç davetten ödül alacağı (adil kullanım kotası)
CREATE OR REPLACE FUNCTION public.referral_reward_quota()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT 5 $$;

-- Davet kodunun girilebileceği süre (hesabın açılışından itibaren): eski kullanıcılar kod giremez
CREATE OR REPLACE FUNCTION public.referral_entry_window()
RETURNS INTERVAL
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT INTERVAL '7 days' $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Tablolar
-- ────────────────────────────────────────────────────────────────────────────
-- Kod, eşleşme kodundan ayrıdır ve ayrı tablodadır: couples satırını üyeler güncelleyebildiği için kod orada
-- olsaydı istemci kendi kodunu değiştirebilirdi. Alfabe eşleşme koduyla aynıdır (0/O, 1/I/L yok).
CREATE TABLE IF NOT EXISTS public.couple_referral_codes (
  couple_id      INTEGER PRIMARY KEY REFERENCES public.couples(id) ON DELETE CASCADE,
  code           TEXT NOT NULL UNIQUE CHECK (code ~ '^SKY[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{5}$'),
  rewarded_count INTEGER NOT NULL DEFAULT 0 CHECK (rewarded_count >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.couple_referral_codes.rewarded_count IS
  'Davet edenin aldığı ödül sayısı (kota). Yalnızca artar: davet edilen hesap silinse de düşmez.';

-- Davet, kodu giren kullanıcıya bağlıdır: eşleşmede kullanıcının boş bekleme çifti silinebilir
-- (join_couple_by_code_uuid), davet ise kullanıcının vardığı çifte uygulanır.
CREATE TABLE IF NOT EXISTS public.couple_referrals (
  id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  referrer_couple_id     INTEGER REFERENCES public.couples(id) ON DELETE SET NULL,
  referred_user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Değerlendirildiği andaki çift ve üyeleri (aynı kişilerin tekrar ödül kazandırmasını önler)
  referred_couple_id     INTEGER REFERENCES public.couples(id) ON DELETE SET NULL,
  referred_member_ids    UUID[] NOT NULL DEFAULT '{}',
  status                 TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'rewarded', 'rejected')),
  reject_reason          TEXT
                         CHECK (reject_reason IN ('same_device', 'member_already_rewarded',
                                                  'couple_already_referred', 'self_referral')),
  referred_reward        TEXT CHECK (referred_reward IN ('premium_days', 'premium_extended', 'tokens')),
  referrer_reward        TEXT CHECK (referrer_reward IN ('premium_days', 'premium_extended', 'tokens',
                                                         'quota_reached', 'none')),
  -- Ödülün yazdığı Premium bitişi: çiftin Premium'unun bu programın hediyesi olup olmadığını anlamak için
  referred_premium_until TIMESTAMPTZ,
  referrer_premium_until TIMESTAMPTZ,
  stars_linked_at        TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at            TIMESTAMPTZ,
  CONSTRAINT couple_referrals_referred_user_key UNIQUE (referred_user_id),
  CONSTRAINT couple_referrals_state_check CHECK (
    CASE status
      WHEN 'pending'  THEN resolved_at IS NULL AND reject_reason IS NULL
                           AND referred_reward IS NULL AND referrer_reward IS NULL
      WHEN 'rewarded' THEN resolved_at IS NOT NULL AND reject_reason IS NULL
                           AND referred_reward IS NOT NULL AND referrer_reward IS NOT NULL
      ELSE                 resolved_at IS NOT NULL AND reject_reason IS NOT NULL
                           AND referred_reward IS NULL AND referrer_reward IS NULL
    END
  )
);

CREATE INDEX IF NOT EXISTS idx_couple_referrals_referrer
  ON public.couple_referrals (referrer_couple_id, created_at DESC);
-- Bir çift (satırı) en fazla bir kez ödüllenir; eşzamanlı değerlendirmelere karşı son kalkan
CREATE UNIQUE INDEX IF NOT EXISTS idx_couple_referrals_one_reward_per_couple
  ON public.couple_referrals (referred_couple_id) WHERE status = 'rewarded';
CREATE INDEX IF NOT EXISTS idx_couple_referrals_rewarded_members
  ON public.couple_referrals USING gin (referred_member_ids) WHERE status = 'rewarded';

ALTER TABLE public.couple_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_referrals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.couple_referral_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.couple_referrals FROM PUBLIC, anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Yardımcılar
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.couple_member_ids(p_couple_id INTEGER)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(array_agg(u.id ORDER BY u.id), '{}'::UUID[])
    FROM public.users AS u
   WHERE u.couple_id = p_couple_id;
$$;

-- İki kullanıcı kümesinden farklı iki kişi aynı cihaz kimliğini kullanmış mı?
-- (Aynı küme iki kez verilirse çiftin kendi üyeleri karşılaştırılır.)
CREATE OR REPLACE FUNCTION public.referral_devices_overlap(p_users_a UUID[], p_users_b UUID[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.device_authorizations AS a
      JOIN public.device_authorizations AS b ON b.device_id = a.device_id
     WHERE a.user_id = ANY (p_users_a)
       AND b.user_id = ANY (p_users_b)
       AND a.user_id <> b.user_id
  );
$$;

-- Davet listesinde gösterilen ilk ad (yıldız etiketleriyle aynı kural: engelli kelimede baş harf)
CREATE OR REPLACE FUNCTION public.referral_first_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
           WHEN n.first_name IS NOT NULL AND NOT public.contains_blocked_word(n.first_name)
             THEN public.star_name_initial(n.first_name) || substr(n.first_name, 2)
           ELSE public.star_name_initial(n.base_name)
         END
    FROM public.users AS u
   CROSS JOIN LATERAL (
     SELECT NULLIF(left(split_part(btrim(COALESCE(u.display_name, '')), ' ', 1), 20), '') AS first_name,
            NULLIF(btrim(COALESCE(NULLIF(btrim(u.display_name), ''), u.username, '')), '') AS base_name
   ) AS n
   WHERE u.id = p_user_id;
$$;

-- Çiftin davet kodu; yoksa üretilir. Eşzamanlı iki çağrı aynı kodu görür.
CREATE OR REPLACE FUNCTION public.ensure_referral_code(p_couple_id INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes BYTEA;
  v_code  TEXT;
BEGIN
  SELECT rc.code INTO v_code FROM public.couple_referral_codes AS rc WHERE rc.couple_id = p_couple_id;

  WHILE v_code IS NULL LOOP
    v_bytes := extensions.gen_random_bytes(5);
    v_code := 'SKY';
    FOR i IN 0..4 LOOP
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
    END LOOP;

    -- Kod çakışması ya da aynı çift için eşzamanlı ekleme: hiçbir şey yazılmaz, yeniden okunur
    INSERT INTO public.couple_referral_codes (couple_id, code)
    VALUES (p_couple_id, v_code)
    ON CONFLICT DO NOTHING;

    SELECT rc.code INTO v_code FROM public.couple_referral_codes AS rc WHERE rc.couple_id = p_couple_id;
  END LOOP;

  RETURN v_code;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Ödül
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_referral_reward(
  p_couple_id       INTEGER,
  OUT reward        TEXT,
  OUT premium_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_couple     public.couples%ROWTYPE;
  v_gift_until TIMESTAMPTZ;
  v_tokens     INTEGER := public.referral_reward_tokens();
BEGIN
  SELECT * INTO v_couple FROM public.couples AS c WHERE c.id = p_couple_id FOR UPDATE;
  IF NOT FOUND THEN
    reward := 'none';
    RETURN;
  END IF;

  -- Çiftin şu anki Premium'u bu programın hediyesi mi: bitiş, bir davet ödülünün yazdığı anla aynı
  SELECT max(g.until) INTO v_gift_until
    FROM (
      SELECT r.referred_premium_until AS until
        FROM public.couple_referrals AS r
       WHERE r.referred_couple_id = p_couple_id AND r.status = 'rewarded'
      UNION ALL
      SELECT r.referrer_premium_until
        FROM public.couple_referrals AS r
       WHERE r.referrer_couple_id = p_couple_id AND r.status = 'rewarded'
    ) AS g;

  -- Premium kolonları yalnızca bu bayrakla yazılır (check_couples_update_integrity); durum ve süreleri
  -- yaşam döngüsü tetikleyicisi hesaplar (kış uykusu / kasa kalkar)
  PERFORM set_config('app.allow_premium_override', 'on', true);
  IF NOT public.premium_entitlement_active(v_couple.is_premium, v_couple.premium_expires_at) THEN
    UPDATE public.couples AS c
       SET is_premium = TRUE,
           premium_expires_at = statement_timestamp() + public.referral_reward_period()
     WHERE c.id = p_couple_id
    RETURNING c.premium_expires_at INTO premium_until;
    reward := 'premium_days';
  ELSIF v_couple.premium_expires_at = v_gift_until THEN
    UPDATE public.couples AS c
       SET premium_expires_at = c.premium_expires_at + public.referral_reward_period()
     WHERE c.id = p_couple_id
    RETURNING c.premium_expires_at INTO premium_until;
    reward := 'premium_extended';
  END IF;
  PERFORM set_config('app.allow_premium_override', 'off', true);

  IF reward IS NULL THEN
    -- Mağaza aboneliği, promosyon ya da süresiz Premium: iki üyeye jeton
    PERFORM set_config('app.allow_token_change', 'on', true);
    WITH credited AS (
      UPDATE public.users AS u
         SET token_balance = COALESCE(u.token_balance, 0) + v_tokens
       WHERE u.couple_id = p_couple_id
      RETURNING u.id
    )
    INSERT INTO public.token_transactions (user_id, amount, reason)
    SELECT credited.id, v_tokens, 'referral_reward' FROM credited;
    PERFORM set_config('app.allow_token_change', 'off', true);
    reward := 'tokens';
  END IF;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Gökkubbe: davetle bağlanan çiftlerin yıldız bağı
-- ────────────────────────────────────────────────────────────────────────────
-- request/respond_to_star_connection ile aynı kurallar ve kilitler. Kurulamazsa (yıldız yok, Premium yok,
-- sınır dolu) false döner; bir sonraki yıldız tescilinde ya da Premium açılışında yeniden denenir.
CREATE OR REPLACE FUNCTION public.link_referral_stars(p_referral_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ref      public.couple_referrals%ROWTYPE;
  v_star_a   UUID;
  v_star_b   UUID;
  v_existing public.star_connections%ROWTYPE;
BEGIN
  SELECT * INTO v_ref
    FROM public.couple_referrals AS r
   WHERE r.id = p_referral_id
     AND r.status = 'rewarded'
     AND r.stars_linked_at IS NULL
     FOR UPDATE;
  IF NOT FOUND OR v_ref.referrer_couple_id IS NULL OR v_ref.referred_couple_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT cs.id INTO v_star_a FROM public.couple_stars AS cs WHERE cs.couple_id = v_ref.referrer_couple_id;
  SELECT cs.id INTO v_star_b FROM public.couple_stars AS cs WHERE cs.couple_id = v_ref.referred_couple_id;
  IF v_star_a IS NULL OR v_star_b IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Kış uykusundaki yıldız yeni bağ kurmaz (enforce_star_connection_premium ile aynı kural)
  IF NOT public.has_active_premium(v_ref.referrer_couple_id)
     OR NOT public.has_active_premium(v_ref.referred_couple_id) THEN
    RETURN FALSE;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('star_conn_lock'),
                                LEAST(v_ref.referrer_couple_id, v_ref.referred_couple_id));
  PERFORM pg_advisory_xact_lock(hashtext('star_conn_lock'),
                                GREATEST(v_ref.referrer_couple_id, v_ref.referred_couple_id));

  SELECT * INTO v_existing
    FROM public.star_connections AS sc
   WHERE (sc.star_a_id = v_star_a AND sc.star_b_id = v_star_b)
      OR (sc.star_a_id = v_star_b AND sc.star_b_id = v_star_a)
     FOR UPDATE;

  IF v_existing.status = 'rejected' THEN
    -- Taraflardan biri bu bağı daha önce reddetti: karara saygı, kendiliğinden kurulmaz
    UPDATE public.couple_referrals AS r SET stars_linked_at = statement_timestamp() WHERE r.id = v_ref.id;
    RETURN FALSE;
  END IF;

  IF v_existing.status IS DISTINCT FROM 'accepted' THEN
    -- Her yıldızın en fazla 3 kabul edilmiş bağı olur (request/respond_to_star_connection)
    IF (SELECT count(*) FROM public.star_connections AS sc
         WHERE (sc.star_a_id = v_star_a OR sc.star_b_id = v_star_a) AND sc.status = 'accepted') >= 3
       OR (SELECT count(*) FROM public.star_connections AS sc
         WHERE (sc.star_a_id = v_star_b OR sc.star_b_id = v_star_b) AND sc.status = 'accepted') >= 3 THEN
      RETURN FALSE;
    END IF;

    IF v_existing.id IS NOT NULL THEN
      -- Bekleyen bir istek vardı: davet bağı onu kabul eder
      UPDATE public.star_connections AS sc
         SET status = 'accepted', responded_at = statement_timestamp()
       WHERE sc.id = v_existing.id;
    ELSE
      INSERT INTO public.star_connections (star_a_id, star_b_id, status, requested_by_couple_id, created_at, responded_at)
      VALUES (v_star_a, v_star_b, 'accepted', v_ref.referrer_couple_id, statement_timestamp(), statement_timestamp());
    END IF;
  END IF;

  UPDATE public.couple_referrals AS r SET stars_linked_at = statement_timestamp() WHERE r.id = v_ref.id;
  RETURN TRUE;
END;
$$;

-- Çiftin henüz bağlanmamış bütün ödüllü davetleri; birinin hatası diğerlerini ve çağıranı durdurmaz
CREATE OR REPLACE FUNCTION public.link_referral_stars_for_couple(p_couple_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_referral_id BIGINT;
BEGIN
  FOR v_referral_id IN
    SELECT r.id
      FROM public.couple_referrals AS r
     WHERE r.status = 'rewarded'
       AND r.stars_linked_at IS NULL
       AND (r.referrer_couple_id = p_couple_id OR r.referred_couple_id = p_couple_id)
     ORDER BY r.id
  LOOP
    BEGIN
      PERFORM public.link_referral_stars(v_referral_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Davet yıldız bağı kurulamadı (davet %): %', v_referral_id, SQLERRM;
    END;
  END LOOP;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Aktivasyon: çift 2 kişi olduğu an
-- ────────────────────────────────────────────────────────────────────────────
-- Çiftin üyelerinin bekleyen davetlerini değerlendirir. İki üye de kod girmişse en eski geçerli davet
-- ödüllenir, diğerleri kapanır. Davet satırları kilitlenir: eşzamanlı iki değerlendirme aynı daveti iki kez
-- ödüllendiremez (ikincisi satırı artık 'pending' bulmaz).
CREATE OR REPLACE FUNCTION public.activate_couple_referrals(p_couple_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_members          UUID[];
  v_ref              public.couple_referrals%ROWTYPE;
  v_referrer_members UUID[];
  v_reason           TEXT;
  v_rewarded_id      BIGINT;
  v_referred         RECORD;
  v_referrer_reward  TEXT;
  v_referrer_until   TIMESTAMPTZ;
  v_quota_used       INTEGER;
  v_now              TIMESTAMPTZ := statement_timestamp();
BEGIN
  v_members := public.couple_member_ids(p_couple_id);
  IF cardinality(v_members) <> 2 THEN
    RETURN;
  END IF;

  FOR v_ref IN
    SELECT *
      FROM public.couple_referrals AS r
     WHERE r.referred_user_id = ANY (v_members)
       AND r.status = 'pending'
     ORDER BY r.created_at, r.id
       FOR UPDATE
  LOOP
    v_referrer_members := public.couple_member_ids(v_ref.referrer_couple_id);

    v_reason := CASE
      WHEN v_rewarded_id IS NOT NULL THEN 'couple_already_referred'
      WHEN v_ref.referrer_couple_id = p_couple_id OR v_referrer_members && v_members THEN 'self_referral'
      WHEN EXISTS (
        SELECT 1
          FROM public.couple_referrals AS r
         WHERE r.status = 'rewarded'
           AND (r.referred_couple_id = p_couple_id OR r.referred_member_ids && v_members)
      ) THEN 'member_already_rewarded'
      WHEN public.referral_devices_overlap(v_members, v_members)
        OR public.referral_devices_overlap(v_members, v_referrer_members) THEN 'same_device'
    END;

    IF v_reason IS NOT NULL THEN
      UPDATE public.couple_referrals AS r
         SET status = 'rejected',
             reject_reason = v_reason,
             referred_couple_id = p_couple_id,
             referred_member_ids = v_members,
             resolved_at = v_now
       WHERE r.id = v_ref.id;
      CONTINUE;
    END IF;

    SELECT * INTO v_referred FROM public.grant_referral_reward(p_couple_id);

    -- Davet eden çift dağılmışsa (hesap silme) ödül yalnızca yeni çifte verilir
    v_referrer_reward := 'none';
    v_referrer_until := NULL;
    IF cardinality(v_referrer_members) = 2 THEN
      SELECT rc.rewarded_count INTO v_quota_used
        FROM public.couple_referral_codes AS rc
       WHERE rc.couple_id = v_ref.referrer_couple_id
         FOR UPDATE;

      IF COALESCE(v_quota_used, 0) >= public.referral_reward_quota() THEN
        v_referrer_reward := 'quota_reached';
      ELSE
        SELECT g.reward, g.premium_until INTO v_referrer_reward, v_referrer_until
          FROM public.grant_referral_reward(v_ref.referrer_couple_id) AS g;
        UPDATE public.couple_referral_codes AS rc
           SET rewarded_count = rc.rewarded_count + 1
         WHERE rc.couple_id = v_ref.referrer_couple_id;
      END IF;
    END IF;

    UPDATE public.couple_referrals AS r
       SET status = 'rewarded',
           referred_couple_id = p_couple_id,
           referred_member_ids = v_members,
           referred_reward = v_referred.reward,
           referred_premium_until = v_referred.premium_until,
           referrer_reward = v_referrer_reward,
           referrer_premium_until = v_referrer_until,
           resolved_at = v_now
     WHERE r.id = v_ref.id;
    v_rewarded_id := v_ref.id;
  END LOOP;

  IF v_rewarded_id IS NOT NULL THEN
    PERFORM public.link_referral_stars_for_couple(p_couple_id);
  END IF;
END;
$$;

-- Tetikleyici bir hatayla değerlendirmeyi atladıysa (ör. kilit çakışması) davet 'pending' kalır;
-- çiftin bir sonraki davet / Gökkubbe çağrısında yeniden değerlendirilir. Hiçbir zaman hata fırlatmaz.
CREATE OR REPLACE FUNCTION public.heal_couple_referrals(p_couple_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_couple_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.couple_referrals AS r
      JOIN public.users AS u ON u.id = r.referred_user_id
     WHERE u.couple_id = p_couple_id
       AND r.status = 'pending'
  ) THEN
    BEGIN
      PERFORM public.activate_couple_referrals(p_couple_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Davet ödülü yeniden değerlendirilemedi (çift %): %', p_couple_id, SQLERRM;
    END;
  END IF;

  PERFORM public.link_referral_stars_for_couple(p_couple_id);
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. Tetikleyiciler (hiçbiri eşleşmeyi, yıldız tescilini ya da Premium yazımını engellemez)
-- ────────────────────────────────────────────────────────────────────────────
-- Üye sayısı users üzerindeki AFTER tetikleyicisiyle (update_couple_member_count) yazılır; bu an kullanıcı
-- satırı zaten çifte geçmiştir. Hangi yoldan eşleşilirse eşleşilsin (kod, davet bağlantısı) yakalanır.
CREATE OR REPLACE FUNCTION public.trg_couples_referral_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  BEGIN
    PERFORM public.activate_couple_referrals(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Davet ödülü değerlendirilemedi (çift %): %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_couples_referral_activation ON public.couples;
CREATE TRIGGER trg_couples_referral_activation
  AFTER UPDATE OF member_count ON public.couples
  FOR EACH ROW
  WHEN (NEW.member_count >= 2 AND NEW.member_count IS DISTINCT FROM OLD.member_count)
  EXECUTE FUNCTION public.trg_couples_referral_activation();

-- Premium yeniden açılınca (yenileme, davet ödülü) bekleyen yıldız bağları kurulur.
-- subscription_status BEFORE tetikleyicisinde hesaplandığı için kolon listesiz tetikleyici + WHEN.
CREATE OR REPLACE FUNCTION public.trg_couples_referral_star_retry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.link_referral_stars_for_couple(NEW.id);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Davet yıldız bağları denenemedi (çift %): %', NEW.id, SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_couples_referral_star_retry ON public.couples;
CREATE TRIGGER trg_couples_referral_star_retry
  AFTER UPDATE ON public.couples
  FOR EACH ROW
  WHEN (NEW.subscription_status = 'active' AND OLD.subscription_status IS DISTINCT FROM 'active')
  EXECUTE FUNCTION public.trg_couples_referral_star_retry();

-- Yıldız tescil edilince davetle bağlı arkadaş yıldızına bağ kurulur
CREATE OR REPLACE FUNCTION public.trg_couple_stars_referral_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.link_referral_stars_for_couple(NEW.couple_id);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Davet yıldız bağı denenemedi (çift %): %', NEW.couple_id, SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_couple_stars_referral_link ON public.couple_stars;
CREATE TRIGGER trg_couple_stars_referral_link
  AFTER INSERT ON public.couple_stars
  FOR EACH ROW EXECUTE FUNCTION public.trg_couple_stars_referral_link();

-- Davet ödüllenince davet eden çifte bildirim (invoke_push_webhook hiçbir koşulda yazmayı engellemez)
DROP TRIGGER IF EXISTS push_on_couple_referrals ON public.couple_referrals;
CREATE TRIGGER push_on_couple_referrals
  AFTER UPDATE OF status ON public.couple_referrals
  FOR EACH ROW
  WHEN (NEW.status = 'rewarded' AND OLD.status IS DISTINCT FROM 'rewarded' AND NEW.referrer_couple_id IS NOT NULL)
  EXECUTE FUNCTION public.invoke_push_webhook();


-- ────────────────────────────────────────────────────────────────────────────
-- 8. İstemci RPC'leri
-- ────────────────────────────────────────────────────────────────────────────
-- Davet kodunu girer. Kod tahmini belirtisi olan sonuçlar hata yerine result_error ile DÖNER (fırlatılsaydı
-- deneme sayacı da geri alınırdı; bkz. 20261030000001). result_status: pending | rewarded | rejected.
-- result_error: TOO_MANY_REQUESTS | INVALID_CODE | SELF_CODE | NOT_ELIGIBLE | ALREADY_REFERRED |
--               COUPLE_ALREADY_REFERRED
DROP FUNCTION IF EXISTS public.apply_referral_code(TEXT);

CREATE FUNCTION public.apply_referral_code(p_code TEXT)
RETURNS TABLE (result_status TEXT, result_error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_code        TEXT := public.normalize_pairing_code(p_code);
  v_couple_id   INTEGER;
  v_created_at  TIMESTAMPTZ;
  v_referrer_id INTEGER;
  v_existing    public.couple_referrals%ROWTYPE;
  v_members     UUID[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.consume_auth_rate_limit('referral_apply', v_uid::text, 10, 10 * 60) THEN
    RETURN QUERY SELECT NULL::TEXT, 'TOO_MANY_REQUESTS'::TEXT;
    RETURN;
  END IF;

  -- Kilit sırası eşleşmeyle aynı: önce kullanıcı satırı, sonra çiftler
  SELECT u.couple_id, u.created_at INTO v_couple_id, v_created_at
    FROM public.users AS u
   WHERE u.id = v_uid
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  SELECT rc.couple_id INTO v_referrer_id FROM public.couple_referral_codes AS rc WHERE rc.code = v_code;

  SELECT * INTO v_existing FROM public.couple_referrals AS r WHERE r.referred_user_id = v_uid;
  IF FOUND THEN
    -- Aynı kodu tekrar girmek (ör. davet bağlantısına ikinci dokunuş) hata değildir
    IF v_referrer_id IS NOT NULL AND v_existing.referrer_couple_id = v_referrer_id THEN
      RETURN QUERY SELECT v_existing.status, NULL::TEXT;
    ELSE
      RETURN QUERY SELECT NULL::TEXT, 'ALREADY_REFERRED'::TEXT;
    END IF;
    RETURN;
  END IF;

  -- Kod yok ya da davet eden çift artık eşleşmiş değil
  IF v_referrer_id IS NULL OR cardinality(public.couple_member_ids(v_referrer_id)) <> 2 THEN
    RETURN QUERY SELECT NULL::TEXT, 'INVALID_CODE'::TEXT;
    RETURN;
  END IF;
  IF v_referrer_id = v_couple_id THEN
    RETURN QUERY SELECT NULL::TEXT, 'SELF_CODE'::TEXT;
    RETURN;
  END IF;
  IF COALESCE(v_created_at, '-infinity'::TIMESTAMPTZ) < statement_timestamp() - public.referral_entry_window() THEN
    RETURN QUERY SELECT NULL::TEXT, 'NOT_ELIGIBLE'::TEXT;
    RETURN;
  END IF;

  -- Partner başka bir kod girmişse ya da çift zaten bir davetle ödüllenmişse
  v_members := public.couple_member_ids(v_couple_id);
  IF EXISTS (
    SELECT 1
      FROM public.couple_referrals AS r
     WHERE r.referred_user_id = ANY (v_members)
        OR (r.status = 'rewarded' AND r.referred_couple_id = v_couple_id)
  ) THEN
    RETURN QUERY SELECT NULL::TEXT, 'COUPLE_ALREADY_REFERRED'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.couple_referrals (referrer_couple_id, referred_user_id)
  VALUES (v_referrer_id, v_uid);

  -- Kod eşleştikten sonra girildiyse ödül hemen değerlendirilir (hata olursa davet bekler, sonra iyileşir)
  IF cardinality(v_members) = 2 THEN
    PERFORM public.heal_couple_referrals(v_couple_id);
  END IF;

  RETURN QUERY
    SELECT r.status, NULL::TEXT FROM public.couple_referrals AS r WHERE r.referred_user_id = v_uid;
END;
$$;

-- Davet penceresinin bütün verisi. Eşleşmiş çiftin kodu yoksa burada üretilir.
CREATE OR REPLACE FUNCTION public.get_my_referral_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_couple_id  INTEGER;
  v_created_at TIMESTAMPTZ;
  v_members    UUID[];
  v_code       TEXT;
  v_used       INTEGER := 0;
  v_mine       JSONB;
  v_invitees   JSONB := '[]'::JSONB;
  v_can_enter  BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT u.couple_id, u.created_at INTO v_couple_id, v_created_at FROM public.users AS u WHERE u.id = v_uid;
  v_members := public.couple_member_ids(v_couple_id);

  -- Yalnızca eşleşmiş çift davet edebilir
  IF cardinality(v_members) = 2 THEN
    PERFORM public.heal_couple_referrals(v_couple_id);
    v_code := public.ensure_referral_code(v_couple_id);
    SELECT rc.rewarded_count INTO v_used FROM public.couple_referral_codes AS rc WHERE rc.couple_id = v_couple_id;

    SELECT COALESCE(jsonb_agg(i.item ORDER BY i.created_at DESC), '[]'::JSONB) INTO v_invitees
      FROM (
        SELECT r.created_at,
               jsonb_build_object(
                 'id', r.id,
                 -- Eşleşen çift iki ilk adla, bekleyen kişi kendi ilk adıyla (yıldız bağlarındaki kural)
                 'label', CASE
                            WHEN r.status = 'rewarded' AND r.referred_couple_id IS NOT NULL
                              THEN public.star_owner_label(r.referred_couple_id, TRUE, TRUE)
                            ELSE public.referral_first_name(r.referred_user_id)
                          END,
                 'status', r.status,
                 'reward', r.referrer_reward,
                 'created_at', r.created_at,
                 'resolved_at', r.resolved_at
               ) AS item
          FROM public.couple_referrals AS r
         WHERE r.referrer_couple_id = v_couple_id
         ORDER BY r.created_at DESC
         LIMIT 50
      ) AS i;
  END IF;

  -- Bu çiftin kendisinin girdiği davet (iki üyeden birinin)
  SELECT jsonb_build_object(
           'status', r.status,
           'reward', r.referred_reward,
           'inviter_label', CASE WHEN r.status = 'rewarded' THEN public.star_owner_label(r.referrer_couple_id, TRUE, TRUE) END
         )
    INTO v_mine
    FROM public.couple_referrals AS r
   WHERE r.referred_user_id = v_uid OR r.referred_user_id = ANY (v_members)
   ORDER BY (r.status = 'rewarded') DESC, r.created_at
   LIMIT 1;

  v_can_enter := v_mine IS NULL
    AND COALESCE(v_created_at, '-infinity'::TIMESTAMPTZ) >= statement_timestamp() - public.referral_entry_window()
    AND NOT EXISTS (
      SELECT 1 FROM public.couple_referrals AS r
       WHERE r.status = 'rewarded' AND r.referred_couple_id = v_couple_id
    );

  RETURN jsonb_build_object(
    'code', v_code,
    'reward_days', EXTRACT(DAY FROM public.referral_reward_period())::INTEGER,
    'reward_tokens', public.referral_reward_tokens(),
    'quota', public.referral_reward_quota(),
    'rewarded_count', COALESCE(v_used, 0),
    'has_star', EXISTS (SELECT 1 FROM public.couple_stars AS cs WHERE cs.couple_id = v_couple_id),
    'can_enter_code', v_can_enter,
    'my_referral', v_mine,
    'invitees', v_invitees
  );
END;
$$;

-- Gökkubbe davet kartı: bu çiftin yıldızı yokken davetle bağlı arkadaş çiftin yıldızı varsa onu döner
-- (davet edildiğimiz çift önce, sonra en son ödüllenen davet). Yıldızı olan çiftte boş döner.
CREATE OR REPLACE FUNCTION public.get_referral_star_invite()
RETURNS TABLE (
  friend_label      TEXT,
  friend_star_name  TEXT,
  friend_ra         NUMERIC,
  friend_dec        NUMERIC,
  friend_catalog_id BIGINT,
  invited_us        BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_couple_id INTEGER := public.get_my_couple_id();
BEGIN
  IF v_couple_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.heal_couple_referrals(v_couple_id);

  IF EXISTS (SELECT 1 FROM public.couple_stars AS cs WHERE cs.couple_id = v_couple_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT public.star_owner_label(f.couple_id, TRUE, TRUE),
           -- Bildirimlerle gizlenmiş yıldız adı gösterilmez
           CASE WHEN cs.name_hidden_at IS NULL THEN cs.custom_name::TEXT END,
           cc.ra,
           cc."dec",
           cc.id,
           f.invited_us
      FROM (
        SELECT CASE WHEN r.referred_couple_id = v_couple_id THEN r.referrer_couple_id
                    ELSE r.referred_couple_id END AS couple_id,
               r.referred_couple_id = v_couple_id AS invited_us,
               r.resolved_at
          FROM public.couple_referrals AS r
         WHERE r.status = 'rewarded'
           AND (r.referred_couple_id = v_couple_id OR r.referrer_couple_id = v_couple_id)
      ) AS f
      JOIN public.couple_stars AS cs ON cs.couple_id = f.couple_id
      JOIN public.celestial_catalog AS cc ON cc.id = cs.catalog_id
     ORDER BY f.invited_us DESC, f.resolved_at DESC
     LIMIT 1;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 9. Yetkiler
-- ────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.referral_reward_period()                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_reward_tokens()                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_reward_quota()                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_entry_window()                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.couple_member_ids(INTEGER)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_devices_overlap(UUID[], UUID[])      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_first_name(UUID)                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_referral_code(INTEGER)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_referral_reward(INTEGER)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_referral_stars(BIGINT)                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_referral_stars_for_couple(INTEGER)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_couple_referrals(INTEGER)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.heal_couple_referrals(INTEGER)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_couples_referral_activation()             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_couples_referral_star_retry()             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_couple_stars_referral_link()              FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.apply_referral_code(TEXT)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_referral_overview()                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_referral_star_invite()                    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_referral_code(TEXT)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_referral_overview()                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_star_invite()                 TO authenticated;

COMMIT;
