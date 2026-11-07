-- ============================================================================
-- Hesap silme v2 (4/4): Premium sahibi ve süreklilik
-- ----------------------------------------------------------------------------
-- Tasarım: docs/HESAP_SILME_VE_PREMIUM_TASARIMI.md (madde 4, açık nokta 5)
--
-- • Premium çiftin kaydında durur; KİMİN aldığı couples.premium_owner_id'de tutulur (RevenueCat olayındaki
--   kullanıcı). Silen kişi sahipse partnerde Premium silme gününde biter (2/4).
-- • Mağaza doğrulaması: sync-premium / process-account-deletions Edge Function'ları RevenueCat v2 REST ile
--   kişinin aktif hakkını okur ve apply_verified_entitlement ile kişinin GÜNCEL çiftine yazar (yeni eşleşme,
--   yeniden kayıt, partner silindikten sonra kendi aboneliği). İstemcinin söylediğine güvenilmez.
-- • Tek kalan / eşleşmemiş çiftte yıldız yoktur: kış uykusu → kasa döngüsü işlemez, hak bitince doğrudan
--   ücretsiz olur.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. REVENUECAT OLAYI: sahibi de yazar
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apply_revenuecat_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_expiration_at TIMESTAMPTZ,
  p_cancel_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_couple_id INTEGER;
  v_couple    public.couples%ROWTYPE;
  v_now       TIMESTAMPTZ := statement_timestamp();
  v_active    BOOLEAN;
  v_result    TEXT;
BEGIN
  SELECT u.couple_id INTO v_couple_id FROM public.users AS u WHERE u.id = p_user_id;
  IF v_couple_id IS NULL THEN
    RETURN 'no_couple';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('couple_activity_lock'), v_couple_id);
  SELECT * INTO v_couple FROM public.couples AS c WHERE c.id = v_couple_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'no_couple';
  END IF;

  v_active := public.premium_entitlement_active(v_couple.is_premium, v_couple.premium_expires_at);

  -- 018 tetikleyicisi Premium kolonlarını yalnızca bu bayrakla ya da service_role ile kabul eder
  PERFORM set_config('app.allow_premium_override', 'on', true);

  IF p_event_type IN ('INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION',
                      'NON_RENEWING_PURCHASE', 'SUBSCRIPTION_EXTENDED', 'REFUND_REVERSED') THEN
    IF v_active AND v_couple.premium_expires_at IS NULL THEN
      -- Süresiz hak korunur; sahibi bilinmiyorsa (eski kayıt) ve bu da süresiz alımsa ona bağlanır
      IF p_expiration_at IS NULL AND v_couple.premium_owner_id IS NULL THEN
        UPDATE public.couples AS c SET premium_owner_id = p_user_id WHERE c.id = v_couple_id;
      END IF;
      v_result := 'kept_lifetime';
    ELSE
      UPDATE public.couples AS c
         SET is_premium = TRUE,
             premium_expires_at = CASE
               WHEN p_expiration_at IS NULL THEN NULL
               ELSE GREATEST(c.premium_expires_at, p_expiration_at)
             END,
             -- Sahip: çiftin Premium'unun dayandığı kişi (bitişi en geç olan / süresiz alan)
             premium_owner_id = CASE
               WHEN p_expiration_at IS NULL
                 OR NOT v_active
                 OR c.premium_owner_id IS NULL
                 OR c.premium_expires_at IS NULL
                 OR p_expiration_at >= c.premium_expires_at THEN p_user_id
               ELSE c.premium_owner_id
             END
       WHERE c.id = v_couple_id;
      v_result := 'granted';
    END IF;

  ELSIF p_event_type = 'EXPIRATION'
     OR (p_event_type = 'CANCELLATION' AND p_cancel_reason = 'CUSTOMER_SUPPORT') THEN
    IF NOT COALESCE(v_couple.is_premium, FALSE)
       OR v_couple.premium_expires_at IS NULL
       OR v_couple.premium_expires_at > COALESCE(p_expiration_at, v_now) + INTERVAL '60 seconds' THEN
      v_result := 'kept';
    ELSE
      UPDATE public.couples AS c
         SET premium_expires_at = LEAST(c.premium_expires_at, COALESCE(p_expiration_at, v_now), v_now)
       WHERE c.id = v_couple_id
         AND c.premium_expires_at > LEAST(COALESCE(p_expiration_at, v_now), v_now);
      v_result := 'lapsed';
    END IF;

  ELSE
    v_result := 'ignored';
  END IF;

  PERFORM set_config('app.allow_premium_override', 'off', true);

  PERFORM public.sync_subscription_lifecycle(v_couple_id);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_revenuecat_event(UUID, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_revenuecat_event(UUID, TEXT, TIMESTAMPTZ, TEXT) TO service_role;


-- ============================================================================
-- 2. MAĞAZADAN DOĞRULANMIŞ HAK
-- ============================================================================
-- p_lifetime: süresiz ürün (bitiş yok). p_expires_at: abonelik dönemi sonu. Hak yoksa çağrılmaz.
CREATE OR REPLACE FUNCTION public.apply_verified_entitlement(p_user_id UUID, p_expires_at TIMESTAMPTZ, p_lifetime BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_couple_id INTEGER;
BEGIN
  SELECT u.couple_id INTO v_couple_id FROM public.users AS u WHERE u.id = p_user_id;
  IF v_couple_id IS NULL THEN
    RETURN 'no_couple';
  END IF;
  -- Silinmek üzere olan hesabın hakkı yeni bir çifte yazılmaz
  IF EXISTS (SELECT 1 FROM public.account_deletion_requests AS r WHERE r.user_id = p_user_id) THEN
    RETURN 'deletion_pending';
  END IF;
  RETURN public.merge_premium_into_couple(v_couple_id, p_user_id, p_expires_at, COALESCE(p_lifetime, FALSE));
END;
$$;

REVOKE ALL ON FUNCTION public.apply_verified_entitlement(UUID, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_verified_entitlement(UUID, TIMESTAMPTZ, BOOLEAN) TO service_role;


-- ============================================================================
-- 3. YAŞAM DÖNGÜSÜ: tek kalan / eşleşmemiş çiftte kış uykusu ve kasa yok
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_subscription_lifecycle(p_couple_id INTEGER)
RETURNS public.subscription_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_couple public.couples%ROWTYPE;
  v_now    TIMESTAMPTZ := statement_timestamp();
BEGIN
  IF p_couple_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Kilit sırası her yerde aynı: önce çift kilidi (puan işlemleriyle ortak), sonra çift satırı
  PERFORM pg_advisory_xact_lock(hashtext('couple_activity_lock'), p_couple_id);
  SELECT * INTO v_couple FROM public.couples AS c WHERE c.id = p_couple_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  PERFORM set_config('app.allow_subscription_lifecycle', 'on', true);

  -- Partnersiz çift: yıldızı yok, kasaya alınacak bir şey yok. Hak varsa aktif, yoksa ücretsiz.
  IF NOT public.couple_is_paired(p_couple_id) THEN
    IF public.premium_entitlement_active(v_couple.is_premium, v_couple.premium_expires_at) THEN
      IF v_couple.subscription_status <> 'active' THEN
        UPDATE public.couples AS c
           SET subscription_status = 'active', grace_until = NULL, vault_until = NULL,
               subscription_status_changed_at = v_now
         WHERE c.id = p_couple_id
        RETURNING * INTO v_couple;
      END IF;
    ELSIF v_couple.subscription_status <> 'free' THEN
      UPDATE public.couples AS c
         SET subscription_status = 'free', grace_until = NULL, vault_until = NULL,
             subscription_status_changed_at = v_now
       WHERE c.id = p_couple_id
      RETURNING * INTO v_couple;
    END IF;
    PERFORM set_config('app.allow_subscription_lifecycle', 'off', true);
    RETURN v_couple.subscription_status;
  END IF;

  FOR v_step IN 1..4 LOOP
    IF public.premium_entitlement_active(v_couple.is_premium, v_couple.premium_expires_at) THEN
      IF v_couple.subscription_status <> 'active' THEN
        UPDATE public.couples AS c
           SET subscription_status = 'active', grace_until = NULL, vault_until = NULL,
               subscription_status_changed_at = v_now
         WHERE c.id = p_couple_id
        RETURNING * INTO v_couple;
      END IF;
      EXIT;
    END IF;

    IF v_couple.subscription_status = 'active' THEN
      UPDATE public.couples AS c
         SET subscription_status = 'grace_period',
             grace_until = public.premium_lapsed_at(c.premium_expires_at) + public.subscription_grace_period(),
             vault_until = NULL,
             subscription_status_changed_at = v_now
       WHERE c.id = p_couple_id
      RETURNING * INTO v_couple;

    ELSIF v_couple.subscription_status = 'grace_period' AND v_couple.grace_until <= v_now THEN
      PERFORM public.release_couple_star_to_vault(p_couple_id);
      UPDATE public.couples AS c
         SET subscription_status = 'vault',
             vault_until = c.grace_until + public.subscription_vault_period(),
             grace_until = NULL,
             subscription_status_changed_at = v_now
       WHERE c.id = p_couple_id
      RETURNING * INTO v_couple;

    ELSIF v_couple.subscription_status = 'vault' AND v_couple.vault_until <= v_now THEN
      PERFORM public.purge_vaulted_media(p_couple_id);
      UPDATE public.couples AS c
         SET subscription_status = 'free', vault_until = NULL,
             subscription_status_changed_at = v_now
       WHERE c.id = p_couple_id
      RETURNING * INTO v_couple;

    ELSE
      EXIT;
    END IF;
  END LOOP;

  PERFORM set_config('app.allow_subscription_lifecycle', 'off', true);
  RETURN v_couple.subscription_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_couples_subscription_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Durum ve süreler istemciden, webhook'tan ya da elle değiştirilemez: yalnızca motor (bayrakla)
  IF TG_OP = 'UPDATE'
     AND (NEW.subscription_status, NEW.grace_until, NEW.vault_until, NEW.subscription_status_changed_at)
         IS DISTINCT FROM (OLD.subscription_status, OLD.grace_until, OLD.vault_until, OLD.subscription_status_changed_at)
     AND NOT public.app_flag_on('app.allow_subscription_lifecycle') THEN
    RAISE EXCEPTION 'Abonelik durumu doğrudan değiştirilemez.' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.is_premium IS NOT DISTINCT FROM OLD.is_premium
     AND NEW.premium_expires_at IS NOT DISTINCT FROM OLD.premium_expires_at THEN
    RETURN NEW;
  END IF;

  IF public.premium_entitlement_active(NEW.is_premium, NEW.premium_expires_at) THEN
    -- Satın alma / yenileme / promosyon: kış uykusu ve kasa kalkar
    NEW.subscription_status := 'active';
    NEW.grace_until := NULL;
    NEW.vault_until := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.subscription_status := 'free';
    NEW.grace_until := NULL;
    NEW.vault_until := NULL;
  ELSIF OLD.subscription_status = 'active' THEN
    IF public.couple_is_paired(NEW.id) THEN
      -- Hak bitti (iade, elle kapatma, bitiş tarihinin geriye çekilmesi): kış uykusu başlar
      NEW.subscription_status := 'grace_period';
      NEW.grace_until := public.premium_lapsed_at(NEW.premium_expires_at) + public.subscription_grace_period();
    ELSE
      -- Partnersiz çiftin yıldızı yok: doğrudan ücretsiz
      NEW.subscription_status := 'free';
      NEW.grace_until := NULL;
    END IF;
    NEW.vault_until := NULL;
  END IF;
  -- Kış uykusu / kasa / ücretsiz: süreler yalnızca yenilemeyle değişir

  IF TG_OP = 'INSERT' OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    NEW.subscription_status_changed_at := statement_timestamp();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_subscription_lifecycle(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_subscription_lifecycle(INTEGER) TO service_role;
REVOKE ALL ON FUNCTION public.trg_couples_subscription_lifecycle() FROM PUBLIC, anon, authenticated;

COMMIT;
