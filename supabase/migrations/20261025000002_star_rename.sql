-- ============================================================================
-- Yıldız ismini değiştirme: ÇİFT başına 30 günde bir kez
-- ============================================================================
-- • İlk isim konduğu anda hak hazırdır (name_changed_at = NULL).
-- • Hak kullanılınca name_changed_at = now(); 30 gün dolana kadar yeni değişiklik yapılamaz.
-- • Kişi değil çift bazlıdır: iki partnerden biri değiştirirse hak ikisi için de biter.
-- • İsim yalnızca rename_my_star() ile değişebilir; couple_stars'a doğrudan UPDATE (RLS izin veriyordu)
--   isim ve hak damgasını değiştiremez.
-- ============================================================================

BEGIN;

ALTER TABLE public.couple_stars
  ADD COLUMN IF NOT EXISTS name_changed_at TIMESTAMPTZ;

-- ─── 1. İsmin doğrudan güncellenmesini engelle ──────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_star_rename()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND COALESCE(current_setting('app.star_rename', true), '') <> 'on'
     AND (NEW.custom_name IS DISTINCT FROM OLD.custom_name
          OR NEW.name_changed_at IS DISTINCT FROM OLD.name_changed_at) THEN
    RAISE EXCEPTION 'Yıldız ismi yalnızca isim değiştirme işlemiyle güncellenebilir.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_star_rename ON public.couple_stars;
CREATE TRIGGER trg_guard_star_rename
  BEFORE UPDATE ON public.couple_stars
  FOR EACH ROW EXECUTE FUNCTION public.guard_star_rename();

-- ─── 2. İsim değiştirme ─────────────────────────────────────────────────────
-- Hatalar: 42501 yetki, 22023 geçersiz isim, P0006 uygunsuz kelime,
--          P0012 hak beklemede (HINT = hakkın yenileneceği an, ISO), P0013 yıldız yok.
CREATE OR REPLACE FUNCTION public.rename_my_star(p_new_name VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_couple_id  INTEGER;
  v_name       TEXT := BTRIM(COALESCE(p_new_name, ''));
  v_star       public.couple_stars%ROWTYPE;
  v_next_at    TIMESTAMPTZ;
BEGIN
  v_couple_id := public.get_my_couple_id();
  IF v_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz işlem: Bir çifte bağlı değilsiniz.' USING ERRCODE = '42501';
  END IF;

  IF char_length(v_name) < 2 OR char_length(v_name) > 40 THEN
    RAISE EXCEPTION 'Yıldız ismi 2 ile 40 karakter arasında olmalıdır.' USING ERRCODE = '22023';
  END IF;

  IF public.contains_blocked_word(v_name) THEN
    RAISE EXCEPTION 'Yıldız ismi topluluk kurallarına aykırı kelimeler içeremez.' USING ERRCODE = 'P0006';
  END IF;

  SELECT * INTO v_star FROM public.couple_stars WHERE couple_id = v_couple_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Çiftin henüz bir yıldızı yok.' USING ERRCODE = 'P0013';
  END IF;

  IF v_star.name_changed_at IS NOT NULL THEN
    v_next_at := v_star.name_changed_at + INTERVAL '30 days';
    IF now() < v_next_at THEN
      RAISE EXCEPTION 'İsim değiştirme hakkı henüz yenilenmedi.'
        USING ERRCODE = 'P0012', HINT = to_char(v_next_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    END IF;
  END IF;

  IF v_name = v_star.custom_name THEN
    RAISE EXCEPTION 'Yeni isim mevcut isimle aynı; hakkınız korunuyor.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.star_rename', 'on', true);
  UPDATE public.couple_stars
     SET custom_name = v_name,
         name_changed_at = now()
   WHERE id = v_star.id;

  RETURN public.get_my_couple_star_details(v_couple_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rename_my_star(VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_my_star(VARCHAR) TO authenticated;

-- ─── 3. Detay RPC'si: hakkın durumunu da döndür ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_couple_star_details(p_couple_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_caller_couple_id INTEGER;
  v_last_spark_at    TIMESTAMPTZ;
  v_next_spark_at    TIMESTAMPTZ;
  v_can_spark        BOOLEAN;
  v_cooldown_sec     INTEGER;
  v_result           JSONB;
BEGIN
  -- Güvenlik: Sadece kendi çiftinin detayını alabilir
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL OR v_caller_couple_id <> p_couple_id THEN
    RAISE EXCEPTION 'Yetkisiz erişim: Yalnızca kendi çiftinize ait yıldız detaylarını görüntüleyebilirsiniz.'
      USING ERRCODE = '42501';
  END IF;

  -- Kullanıcının son daily_spark zamanını bul
  SELECT created_at INTO v_last_spark_at
    FROM public.star_sparks
   WHERE sender_id  = auth.uid()
     AND spark_type = 'daily_spark'
     AND created_at >= NOW() - INTERVAL '20 hours'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_last_spark_at IS NULL THEN
    v_can_spark     := TRUE;
    v_next_spark_at := NOW();
    v_cooldown_sec  := 0;
  ELSE
    v_can_spark     := FALSE;
    v_next_spark_at := v_last_spark_at + INTERVAL '20 hours';
    v_cooldown_sec  := GREATEST(0, EXTRACT(EPOCH FROM (v_next_spark_at - NOW()))::INTEGER);
  END IF;

  SELECT jsonb_build_object(
    'star_id',                    cs.id,
    'couple_id',                  cs.couple_id,
    'catalog_id',                 cs.catalog_id,
    'catalog_code',               cc.catalog_code,
    'common_name',                cc.common_name,
    'custom_name',                cs.custom_name,
    'ra',                         cc.ra,
    'dec',                        cc.dec,
    'magnitude',                  cc.magnitude,
    'spectral_type',              cc.spectral_type,
    'base_color',                 cc.base_color,
    'luminosity_level',           cs.luminosity_level,
    'last_spark_at',              cs.last_spark_at,
    'resonance_active',           (cs.resonance_until IS NOT NULL AND cs.resonance_until > NOW()),
    'resonance_until',            cs.resonance_until,
    'created_at',                 cs.created_at,
    'can_spark_daily',            v_can_spark,
    'daily_spark_available_at',   v_next_spark_at,
    'cooldown_remaining_seconds', v_cooldown_sec,
    'exoplanet_count',            (SELECT COUNT(*) FROM public.star_exoplanets WHERE star_id = cs.id),
    'total_sparks_count',         (SELECT COUNT(*) FROM public.star_sparks WHERE star_id = cs.id),
    -- İsim değiştirme hakkı: NULL = hak hazır; dolu = hakkın yenileneceği an
    'name_change_available_at',   CASE
                                    WHEN cs.name_changed_at IS NOT NULL
                                     AND cs.name_changed_at + INTERVAL '30 days' > NOW()
                                    THEN cs.name_changed_at + INTERVAL '30 days'
                                    ELSE NULL
                                  END
  ) INTO v_result
  FROM public.couple_stars cs
  JOIN public.celestial_catalog cc ON cc.id = cs.catalog_id
  WHERE cs.couple_id = p_couple_id;

  RETURN v_result;
END;
$function$;

COMMIT;
