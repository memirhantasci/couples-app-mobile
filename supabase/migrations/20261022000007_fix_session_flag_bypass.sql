-- ============================================================================
-- MIGRATION: 20261022000007_fix_session_flag_bypass.sql
--
-- Güvenlik: korumalı kolonlar havuzlanmış bağlantıda doğrudan UPDATE ile değişebiliyordu.
--
-- RPC'ler (join_couple_by_code_uuid, spend_tokens, redeem_promo_code...) tetikleyici
-- korumasını set_config('app.allow_...', 'true', true) ile geçer. İşlem bitince bu bayrak
-- aynı veritabanı bağlantısında NULL'a değil boş metne ('') döner. Tetikleyiciler
-- "IS NULL" / "IS NOT NULL" baktığı için, bağlantı havuzunda daha önce böyle bir RPC
-- çalışmış bir bağlantıya düşen herhangi bir istemci şunları doğrudan değiştirebiliyordu:
--   - users.couple_id      (başka bir çiftin bekleme satırına sızmak)
--   - users.token_balance  (jeton bakiyesi yazmak)
--   - couples.is_premium / premium_expires_at (premium açmak)
--   - name_last_changed_at / gender_last_changed_at kısıtları
--
-- Bayrak artık yalnızca açıkça 'true' / 'on' ise geçerli (public.app_flag_on, 006'da).
-- Mantık aynen korunur; yalnızca bayrak kontrolü değişir.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.check_users_update_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_couples_update_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Eğer is_premium veya premium_expires_at değiştirilmeye çalışılıyorsa ve sistem bayrağı yoksa engelle
  IF (NEW.is_premium IS DISTINCT FROM OLD.is_premium OR NEW.premium_expires_at IS DISTINCT FROM OLD.premium_expires_at) THEN
    -- Sadece servis rolü (admin) veya internal güvenli RPC izin verir
    IF NOT app_flag_on('app.allow_premium_override') AND auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'Premium durumu kullanıcı tarafından doğrudan güncellenemez.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_users_cooldown_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sistem / admin geçişi
  IF app_flag_on('app.allow_profile_override') OR auth.role() = 'service_role' THEN
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
$$;

COMMIT;
