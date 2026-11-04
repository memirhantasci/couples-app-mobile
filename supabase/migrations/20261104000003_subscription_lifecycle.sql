-- ============================================================================
-- Abonelik yaşam döngüsü: Premium → Kış Uykusu (14 gün) → Kasa (90 gün) → Ücretsiz
-- ============================================================================
-- 20261104000002_premium_lapse_star_release.sql'in yerini alır. O sürüm 14. günde anı gezegenlerini ve
-- dosyalarını siliyordu; yeni kural gezegenleri 90 gün kasada tutar. Eski parçalar (cron işi, fonksiyonlar)
-- burada kaldırılır; migration o sürüm hiç uygulanmamış olsa da çalışır.
--
-- Durumlar (couples.subscription_status):
--   free          Premium yok, bekleyen bir süre yok (hiç Premium olmamış ya da kasa süresi dolmuş çift)
--   active        Premium hakkı geçerli (has_active_premium)
--   grace_period  Kış uykusu: hak bitti, grace_until'e kadar. Yıldız koordinatı çiftte kalır; Premium
--                 özellikleri (anı gezegenleri, yıldız bağları, yeni içerik) donar. Hiçbir şey silinmez.
--   vault         Kasa: kış uykusu yenilenmeden bitti. Yıldız koordinatı serbest kalır (başkası alabilir),
--                 yıldız bağları ve ışıltı skoru silinir. Anı gezegenleri yıldızdan ayrılıp kasada bekler
--                 (star_id NULL); fotoğraflar, anılar, mektuplar yerinde kalır. vault_until'e kadar.
--   → free        Kasa süresi doldu: tam boy fotoğraflar kalıcı olarak silinir (fotoğraf arşivinin küçük
--                 önizlemesi kalır, önizlemesi olmayan fotoğraf kaydı silinir), anı ve gezegen görselleri
--                 silinir. Metinler (anı, gezegen, mektup, not) kalır.
--   Yenileme her durumdan active'e döndürür. Kasadaki gezegenler, çift yeni bir yıldız sahiplendiği an o
--   yıldıza geri bağlanır.
--
-- Süreler kayan değil sabittir: grace_until = hakkın fiilen bittiği an + 14 gün, vault_until = grace_until +
-- 90 gün. Zamanlanmış işin gecikmesi süreyi uzatmaz.
--
-- Doğruluk kaynağı:
--   • Premium hakkı: is_premium + premium_expires_at (premium_entitlement_active). has_active_premium ve
--     bütün Premium kalkanları değişmeden bunu kullanır; kış uykusunda false döner (= donma).
--   • Yaşam döngüsü kolonları yalnızca bu migration'daki tetikleyici ve motor tarafından yazılır:
--       - Premium kolonları değişince (webhook, promosyon, set_premium_status) tetikleyici durumu hemen
--         hesaplar: hak geçerliyse active, active'ten düştüyse grace_period.
--       - Zamana bağlı geçişler (süre bitişi, kış uykusu → kasa → ücretsiz) sync_subscription_lifecycle ile
--         çift satırı kilitliyken, koşul yeniden doğrulanarak yapılır; yenilemeyle yarışmaz.
--
-- Silme hakkı (KVKK md. 7 / GDPR md. 17): Premium'dan bağımsızdır.
--   • Dosya silme artık istemcinin Storage çağrısına bağlı değil: fotoğraf / anı / gezegen kaydı silinince ya
--     da görsel kayıttan çıkarılınca dosya yolu storage_purge_queue'ya düşer, storage-purge Edge Function
--     Storage API ile siler. (Premium bitince depo politikaları silmeyi reddettiği için dosyalar sahipsiz
--     kalıyordu.)
--   • photo_archive: SELECT politikası Premium istediği için Premium'suz kullanıcı kendi fotoğrafını
--     doğrudan silemiyordu (PostgreSQL DELETE'te SELECT politikasını da uygular) → delete_archived_photo RPC.
--   • delete_exoplanet ve remove_media_from_exoplanet kasadaki gezegenlerde de, Premium'suz da çalışır.
--   • memories ve mektup silme akışları zaten Premium'a bakmıyor; değişmedi.
--
-- Zamanlama:
--   subscription-lifecycle (saatlik)   advance_subscription_lifecycles(): saf SQL, HTTP yok
--   storage-purge (10 dakikada bir)    kuyrukta iş varsa storage-purge Edge Function'ı çağırır
--
-- Kurulum: bu migration + `supabase functions deploy storage-purge --no-verify-jwt`
--          + `supabase functions deploy revenuecat-webhook --no-verify-jwt` (apply_revenuecat_event'i çağırır).
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


-- ────────────────────────────────────────────────────────────────────────────
-- 0. Eski kural (20261104000002) kaldırılır
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname = 'release-lapsed-stars' LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.invoke_release_lapsed_stars();
DROP FUNCTION IF EXISTS public.release_lapsed_star(INTEGER);
DROP FUNCTION IF EXISTS public.list_lapsed_stars(INTEGER);
DROP FUNCTION IF EXISTS public.is_star_lapsed(INTEGER, INTERVAL);
-- star_lapse_releases (varsa) denetim kaydı olarak kalır


-- ────────────────────────────────────────────────────────────────────────────
-- 1. Kurallar: süreler ve Premium hakkı (tek kaynak)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.subscription_grace_period()
RETURNS INTERVAL
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT INTERVAL '14 days' $$;

CREATE OR REPLACE FUNCTION public.subscription_vault_period()
RETURNS INTERVAL
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$ SELECT INTERVAL '90 days' $$;

-- Premium hakkı şu an geçerli mi? (premium_expires_at NULL = süresiz)
CREATE OR REPLACE FUNCTION public.premium_entitlement_active(p_is_premium BOOLEAN, p_expires_at TIMESTAMPTZ)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(p_is_premium, FALSE)
     AND (p_expires_at IS NULL OR p_expires_at > statement_timestamp());
$$;

-- Hakkın fiilen bittiği an: bitiş tarihi geçmişse o tarih, değilse (iade / elle kapatma) şimdi
CREATE OR REPLACE FUNCTION public.premium_lapsed_at(p_expires_at TIMESTAMPTZ)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT LEAST(COALESCE(p_expires_at, statement_timestamp()), statement_timestamp());
$$;

-- Davranış aynı; kural artık premium_entitlement_active'ten gelir
CREATE OR REPLACE FUNCTION public.has_active_premium(p_couple_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.couples AS c
     WHERE c.id = p_couple_id
       AND public.premium_entitlement_active(c.is_premium, c.premium_expires_at)
  );
$$;

COMMENT ON FUNCTION public.has_active_premium(INTEGER) IS
  'Premium hakkı geçerli mi. Kış uykusunda (grace_period) ve kasada (vault) false: Premium özellikleri donar. '
  'Yaşam döngüsü couples.subscription_status üzerinden izlenir; bu fonksiyon zamanlanmış işe bağlı değildir.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. couples: durum ve süre kolonları
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('free', 'active', 'grace_period', 'vault');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

ALTER TABLE public.couples
  ADD COLUMN IF NOT EXISTS subscription_status            public.subscription_status NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS grace_until                    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vault_until                    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN public.couples.subscription_status IS
  'free | active | grace_period (kış uykusu) | vault (kasa). Yalnızca yaşam döngüsü tetikleyicisi ve motoru yazar.';
COMMENT ON COLUMN public.couples.grace_until IS 'Kış uykusunun bittiği an (yalnızca grace_period).';
COMMENT ON COLUMN public.couples.vault_until IS 'Kasanın bittiği, tam boy fotoğrafların silineceği an (yalnızca vault).';

-- Mevcut çiftler. Hakkı geçerli olanlar active; hakkı bitmiş ama Premium izi taşıyanlar (bitiş tarihi,
-- yıldız ya da fotoğraf arşivi) bugünden başlayan 14 günlük kış uykusuna alınır: yeni kural geriye dönük
-- uygulanmaz, kimse uyarı süresi tanınmadan yıldızını ya da fotoğrafını kaybetmez.
-- Yalnızca ilk uygulamada çalışır (tetikleyici henüz yokken): migration tekrar çalışırsa süreler kaymaz.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
     WHERE tgrelid = 'public.couples'::regclass AND tgname = 'trg_couples_subscription_lifecycle'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.couples AS c
     SET subscription_status = 'active'
   WHERE public.premium_entitlement_active(c.is_premium, c.premium_expires_at);

  UPDATE public.couples AS c
     SET subscription_status = 'grace_period',
         grace_until = statement_timestamp() + public.subscription_grace_period()
   WHERE NOT public.premium_entitlement_active(c.is_premium, c.premium_expires_at)
     AND (
       COALESCE(c.is_premium, FALSE)
       OR c.premium_expires_at IS NOT NULL
       OR EXISTS (SELECT 1 FROM public.couple_stars AS cs WHERE cs.couple_id = c.id)
       OR EXISTS (SELECT 1 FROM public.photo_archive AS p WHERE p.couple_id = c.id)
     );
END;
$$;

ALTER TABLE public.couples DROP CONSTRAINT IF EXISTS couples_subscription_deadlines_check;
ALTER TABLE public.couples
  ADD CONSTRAINT couples_subscription_deadlines_check CHECK (
    CASE subscription_status
      WHEN 'grace_period' THEN grace_until IS NOT NULL AND vault_until IS NULL
      WHEN 'vault'        THEN vault_until IS NOT NULL AND grace_until IS NULL
      ELSE grace_until IS NULL AND vault_until IS NULL
    END
  );

CREATE INDEX IF NOT EXISTS idx_couples_active_expiry
  ON public.couples (premium_expires_at) WHERE subscription_status = 'active';
CREATE INDEX IF NOT EXISTS idx_couples_grace_due
  ON public.couples (grace_until) WHERE subscription_status = 'grace_period';
CREATE INDEX IF NOT EXISTS idx_couples_vault_due
  ON public.couples (vault_until) WHERE subscription_status = 'vault';


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Tetikleyici: Premium kolonları değişince durumu hemen hesaplar; kolonları dışarıdan korur
-- ────────────────────────────────────────────────────────────────────────────
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
    -- Hak bitti (iade, elle kapatma, bitiş tarihinin geriye çekilmesi): kış uykusu başlar
    NEW.subscription_status := 'grace_period';
    NEW.grace_until := public.premium_lapsed_at(NEW.premium_expires_at) + public.subscription_grace_period();
    NEW.vault_until := NULL;
  END IF;
  -- Kış uykusu / kasa / ücretsiz: süreler yalnızca yenilemeyle değişir

  IF TG_OP = 'INSERT' OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    NEW.subscription_status_changed_at := statement_timestamp();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_couples_subscription_lifecycle ON public.couples;
CREATE TRIGGER trg_couples_subscription_lifecycle
  BEFORE INSERT OR UPDATE ON public.couples
  FOR EACH ROW EXECUTE FUNCTION public.trg_couples_subscription_lifecycle();


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Denetim kaydı: yıldızın bırakılması ve görsellerin silinmesi
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_lifecycle_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  couple_id   INTEGER NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  event       TEXT NOT NULL CHECK (event IN ('star_released', 'media_purged')),
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscription_lifecycle_events_couple
  ON public.subscription_lifecycle_events (couple_id, occurred_at DESC);
ALTER TABLE public.subscription_lifecycle_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_lifecycle_events FROM PUBLIC, anon, authenticated;


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Anı gezegenleri yıldıza değil çifte aittir: yıldız bırakılınca kasaya geçer
-- ────────────────────────────────────────────────────────────────────────────
-- star_id NULL = kasada. Gezegenlere erişen bütün RPC'ler couple_stars üzerinden bağlandığı için kasadaki
-- gezegen görünmez; yalnızca silinebilir (delete_exoplanet).
ALTER TABLE public.star_exoplanets ADD COLUMN IF NOT EXISTS couple_id INTEGER;

UPDATE public.star_exoplanets AS ep
   SET couple_id = cs.couple_id
  FROM public.couple_stars AS cs
 WHERE cs.id = ep.star_id
   AND ep.couple_id IS DISTINCT FROM cs.couple_id;

ALTER TABLE public.star_exoplanets ALTER COLUMN couple_id SET NOT NULL;
ALTER TABLE public.star_exoplanets ALTER COLUMN star_id DROP NOT NULL;

DO $$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
     WHERE conrelid = 'public.star_exoplanets'::regclass AND conname = 'star_exoplanets_couple_id_fkey'
  ) THEN
    ALTER TABLE public.star_exoplanets
      ADD CONSTRAINT star_exoplanets_couple_id_fkey
      FOREIGN KEY (couple_id) REFERENCES public.couples(id) ON DELETE CASCADE;
  END IF;

  -- Yıldız silinince gezegen artık silinmez, kasaya düşer (ON DELETE CASCADE → SET NULL)
  FOR r IN
    SELECT conname FROM pg_catalog.pg_constraint
     WHERE conrelid = 'public.star_exoplanets'::regclass
       AND contype = 'f'
       AND confrelid = 'public.couple_stars'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.star_exoplanets DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE public.star_exoplanets
    ADD CONSTRAINT star_exoplanets_star_id_fkey
    FOREIGN KEY (star_id) REFERENCES public.couple_stars(id) ON DELETE SET NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_star_exoplanets_couple ON public.star_exoplanets (couple_id);

-- couple_id her zaman bağlı olduğu yıldızın çiftidir; kasaya düşen gezegen sahibini korur
CREATE OR REPLACE FUNCTION public.trg_star_exoplanets_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.star_id IS NOT NULL THEN
    SELECT cs.couple_id INTO NEW.couple_id FROM public.couple_stars AS cs WHERE cs.id = NEW.star_id;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.couple_id := OLD.couple_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_star_exoplanets_owner ON public.star_exoplanets;
CREATE TRIGGER trg_star_exoplanets_owner
  BEFORE INSERT OR UPDATE OF star_id, couple_id ON public.star_exoplanets
  FOR EACH ROW EXECUTE FUNCTION public.trg_star_exoplanets_owner();

-- Çift yeniden yıldız sahiplenince kasadaki gezegenleri o yıldıza döner (kimlikleri, mektup bağları,
-- otomatik gezegen pencereleri ve dosya yolları aynen kalır)
CREATE OR REPLACE FUNCTION public.trg_couple_stars_restore_vault()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.star_exoplanets AS ep
     SET star_id = NEW.id
   WHERE ep.couple_id = NEW.couple_id
     AND ep.star_id IS NULL;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_couple_stars_restore_vault ON public.couple_stars;
CREATE TRIGGER trg_couple_stars_restore_vault
  AFTER INSERT ON public.couple_stars
  FOR EACH ROW EXECUTE FUNCTION public.trg_couple_stars_restore_vault();


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Depo silme kuyruğu
-- ────────────────────────────────────────────────────────────────────────────
-- Dosya SQL ile silinemez (depoda sahipsiz kalır); kayıt tarafı silinince yol buraya yazılır, storage-purge
-- Edge Function Storage API ile siler. Bütün çift dosyaları `<couple_id>/...` altındadır; bu biçime uymayan
-- yol kuyruğa hiç alınmaz.
CREATE TABLE IF NOT EXISTS public.storage_purge_queue (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket_id    TEXT NOT NULL CHECK (bucket_id IN ('photos', 'memories', 'couple-memories')),
  object_name  TEXT NOT NULL CHECK (object_name ~ '^[0-9]{1,9}/[^/]' AND object_name !~ '(^|/)\.\.(/|$)'),
  couple_id    INTEGER NOT NULL,
  reason       TEXT NOT NULL CHECK (reason IN ('record_deleted', 'media_detached', 'vault_expired')),
  enqueued_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts     INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_error   TEXT,
  CONSTRAINT storage_purge_queue_object_key UNIQUE (bucket_id, object_name)
);
ALTER TABLE public.storage_purge_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_purge_queue FROM PUBLIC, anon, authenticated;

-- Yolları kuyruğa ekler. Eski gezegen kayıtlarındaki tam adresten (…/<bucket>/<yol>) yol çıkarılır;
-- geçersiz ya da başka çiftin klasöründeki değerler atlanır.
CREATE OR REPLACE FUNCTION public.enqueue_storage_purge(
  p_bucket    TEXT,
  p_names     TEXT[],
  p_couple_id INTEGER,
  p_reason    TEXT
)
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
     AND split_part(t.name, '/', 1) = p_couple_id::text
  ON CONFLICT ON CONSTRAINT storage_purge_queue_object_key DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Bir satırın (jsonb) verilen kolonlarındaki dosya yolları; kolon metin ya da metin dizisi olabilir
CREATE OR REPLACE FUNCTION public.row_media_paths(p_row JSONB, p_columns TEXT[])
RETURNS SETOF TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT v.path
    FROM unnest(p_columns) AS col(name)
    CROSS JOIN LATERAL (
      SELECT p_row ->> col.name AS path
       WHERE jsonb_typeof(p_row -> col.name) = 'string'
      UNION ALL
      SELECT e.path
        FROM jsonb_array_elements_text(
               CASE WHEN jsonb_typeof(p_row -> col.name) = 'array' THEN p_row -> col.name ELSE '[]'::jsonb END
             ) AS e(path)
    ) AS v
   WHERE p_row IS NOT NULL;
$$;

-- Kayıt silinince ya da görsel kayıttan çıkarılınca artık gösterilmeyen yollar kuyruğa düşer.
-- TG_ARGV: bucket, ardından yol kolonları. Hiçbir koşulda silme / güncellemeyi engellemez.
CREATE OR REPLACE FUNCTION public.trg_enqueue_detached_media()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_bucket  TEXT   := TG_ARGV[0];
  v_columns TEXT[] := TG_ARGV[1:TG_NARGS - 1];
  v_old     JSONB  := to_jsonb(OLD);
  v_new     JSONB  := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) END;
BEGIN
  BEGIN
    PERFORM public.enqueue_storage_purge(
      v_bucket,
      ARRAY(
        SELECT public.row_media_paths(v_old, v_columns)
        EXCEPT
        SELECT public.row_media_paths(v_new, v_columns)
      ),
      NULLIF(v_old ->> 'couple_id', '')::integer,
      CASE WHEN TG_OP = 'DELETE' THEN 'record_deleted' ELSE 'media_detached' END
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Silinecek dosya kuyruğa alınamadı (% %): %', TG_TABLE_NAME, TG_OP, SQLERRM;
  END;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_detached_media ON public.photo_archive;
CREATE TRIGGER trg_enqueue_detached_media
  AFTER DELETE OR UPDATE OF storage_path, thumb_path ON public.photo_archive
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_detached_media('photos', 'storage_path', 'thumb_path');

DROP TRIGGER IF EXISTS trg_enqueue_detached_media ON public.memories;
CREATE TRIGGER trg_enqueue_detached_media
  AFTER DELETE OR UPDATE OF image_path ON public.memories
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_detached_media('memories', 'image_path');

DROP TRIGGER IF EXISTS trg_enqueue_detached_media ON public.star_exoplanets;
CREATE TRIGGER trg_enqueue_detached_media
  AFTER DELETE OR UPDATE OF media_urls ON public.star_exoplanets
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_detached_media('couple-memories', 'media_urls');

-- Dosya hâlâ bir kayıt tarafından gösteriliyor mu? Bilinmeyen bucket / yol biçimi: evet (asla silinmez)
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
  IF p_name IS NULL OR split_part(p_name, '/', 1) !~ '^[0-9]{1,9}$' THEN
    RETURN TRUE;
  END IF;
  v_couple_id := split_part(p_name, '/', 1)::integer;

  RETURN CASE p_bucket
    WHEN 'photos' THEN EXISTS (
      SELECT 1 FROM public.photo_archive AS p
       WHERE p.couple_id = v_couple_id AND (p.storage_path = p_name OR p.thumb_path = p_name))
    WHEN 'memories' THEN EXISTS (
      SELECT 1 FROM public.memories AS m
       WHERE m.couple_id = v_couple_id AND m.image_path = p_name)
    -- Eski gezegen kayıtları yolu tam adres olarak tutabilir
    WHEN 'couple-memories' THEN EXISTS (
      SELECT 1 FROM public.star_exoplanets AS ep, unnest(ep.media_urls) AS media(ref)
       WHERE ep.couple_id = v_couple_id
         AND (media.ref = p_name OR position('/couple-memories/' || p_name IN media.ref) > 0))
    ELSE TRUE
  END;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 7. Motor: kış uykusu → kasa → ücretsiz
-- ────────────────────────────────────────────────────────────────────────────
-- Kış uykusu bitti: yıldız koordinatı serbest kalır, gezegenler kasaya geçer. Kilitler çağırandadır.
CREATE OR REPLACE FUNCTION public.release_couple_star_to_vault(p_couple_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_star_id     UUID;
  v_catalog_id  BIGINT;
  v_planets     INTEGER := 0;
  v_connections INTEGER := 0;
BEGIN
  SELECT cs.id, cs.catalog_id INTO v_star_id, v_catalog_id
    FROM public.couple_stars AS cs
   WHERE cs.couple_id = p_couple_id
     FOR UPDATE;

  IF v_star_id IS NOT NULL THEN
    -- Yıldız bağları (iki yönlü) ve bu çiftin gönderdiği istekler
    DELETE FROM public.star_connections AS sc
     WHERE sc.requested_by_couple_id = p_couple_id
        OR sc.star_a_id = v_star_id
        OR sc.star_b_id = v_star_id;
    GET DIAGNOSTICS v_connections = ROW_COUNT;

    -- Gezegenler kasaya (yıldız silinince FK de aynısını yapar; burada açıkça ve sayılarak)
    UPDATE public.star_exoplanets AS ep SET star_id = NULL WHERE ep.star_id = v_star_id;
    GET DIAGNOSTICS v_planets = ROW_COUNT;

    UPDATE public.celestial_catalog AS cc SET is_claimed = FALSE WHERE cc.id = v_catalog_id;

    -- Kıvılcımlar ve yıldız bildirimleri ON DELETE CASCADE ile gider
    DELETE FROM public.couple_stars AS cs WHERE cs.id = v_star_id;
  END IF;

  -- Işıltı skoru ve günlük döküm sıfırlanır (aşk skorunun beslendiği couple_activity_log korunur)
  DELETE FROM public.couple_activity_score AS s WHERE s.couple_id = p_couple_id;
  DELETE FROM public.couple_daily_activity AS d WHERE d.couple_id = p_couple_id;

  INSERT INTO public.subscription_lifecycle_events (couple_id, event, details)
  VALUES (p_couple_id, 'star_released', jsonb_build_object(
    'catalog_id', v_catalog_id,
    'vaulted_planets', v_planets,
    'removed_connections', v_connections
  ));
END;
$$;

-- Kasa bitti: tam boy görseller kalıcı olarak silinir. Fotoğraf arşivinde küçük önizleme (300 px) kalır ve
-- tam boy yolunun yerine geçer; önizlemesi olmayan fotoğraf kaydı silinir. Anı ve gezegen görselleri kayıttan
-- çıkarılır, metinler kalır. Kayıtsız kalmış (sahipsiz) dosyalar da storage.objects'ten bulunup kuyruğa alınır.
CREATE OR REPLACE FUNCTION public.purge_vaulted_media(p_couple_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_prefix          TEXT := p_couple_id::text || '/';
  v_queued          INTEGER := 0;
  v_photos_reduced  INTEGER;
  v_photos_deleted  INTEGER;
  v_memory_images   INTEGER;
  v_planet_media    INTEGER;
BEGIN
  v_queued := v_queued + public.enqueue_storage_purge(
    'photos',
    ARRAY(
      SELECT o.name FROM storage.objects AS o
       WHERE o.bucket_id = 'photos' AND o.name LIKE v_prefix || '%'
      EXCEPT
      SELECT p.thumb_path FROM public.photo_archive AS p
       WHERE p.couple_id = p_couple_id AND p.thumb_path IS NOT NULL
    ),
    p_couple_id, 'vault_expired');

  v_queued := v_queued + public.enqueue_storage_purge(
    'memories',
    ARRAY(SELECT o.name FROM storage.objects AS o
           WHERE o.bucket_id = 'memories' AND o.name LIKE v_prefix || '%'),
    p_couple_id, 'vault_expired');

  v_queued := v_queued + public.enqueue_storage_purge(
    'couple-memories',
    ARRAY(SELECT o.name FROM storage.objects AS o
           WHERE o.bucket_id = 'couple-memories' AND o.name LIKE v_prefix || 'exoplanets/%'),
    p_couple_id, 'vault_expired');

  -- Kayıtlar (tetikleyiciler kayıtlı yolları ayrıca kuyruğa ekler; tekrarlar yok sayılır)
  UPDATE public.photo_archive AS p
     SET storage_path = p.thumb_path
   WHERE p.couple_id = p_couple_id
     AND p.thumb_path IS NOT NULL
     AND p.storage_path IS DISTINCT FROM p.thumb_path;
  GET DIAGNOSTICS v_photos_reduced = ROW_COUNT;

  DELETE FROM public.photo_archive AS p
   WHERE p.couple_id = p_couple_id AND p.thumb_path IS NULL;
  GET DIAGNOSTICS v_photos_deleted = ROW_COUNT;

  UPDATE public.memories AS m
     SET image_path = NULL
   WHERE m.couple_id = p_couple_id AND m.image_path IS NOT NULL;
  GET DIAGNOSTICS v_memory_images = ROW_COUNT;

  UPDATE public.star_exoplanets AS ep
     SET media_urls = ARRAY[]::TEXT[]
   WHERE ep.couple_id = p_couple_id AND cardinality(ep.media_urls) > 0;
  GET DIAGNOSTICS v_planet_media = ROW_COUNT;

  INSERT INTO public.subscription_lifecycle_events (couple_id, event, details)
  VALUES (p_couple_id, 'media_purged', jsonb_build_object(
    'queued_objects', v_queued,
    'photos_reduced_to_preview', v_photos_reduced,
    'photos_deleted', v_photos_deleted,
    'memory_images_removed', v_memory_images,
    'planets_media_removed', v_planet_media
  ));
END;
$$;

-- Tek çiftin durumunu saatine göre ilerletir; sonuç durumunu döner. Çift satırı kilitliyken koşul yeniden
-- doğrulanır, bu yüzden yenilemeyle yarışmaz. Gecikmeli çalışırsa birden fazla adımı aynı işlemde atar
-- (ör. aylarca çalışmamışsa active → grace_period → vault → free); sonuç her zaman kurala göre aynıdır.
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

-- Saatlik iş: süresi gelen çiftleri ilerletir. Bir çiftin hatası diğerlerini durdurmaz.
CREATE OR REPLACE FUNCTION public.advance_subscription_lifecycles(p_limit INTEGER DEFAULT 500)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_couple_id INTEGER;
  v_done      INTEGER := 0;
BEGIN
  FOR v_couple_id IN
    SELECT c.id
      FROM public.couples AS c
     WHERE (c.subscription_status = 'active'
            AND (c.is_premium IS NOT TRUE OR c.premium_expires_at <= statement_timestamp()))
        OR (c.subscription_status = 'grace_period' AND c.grace_until <= statement_timestamp())
        OR (c.subscription_status = 'vault' AND c.vault_until <= statement_timestamp())
     ORDER BY c.id
     LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 5000))
  LOOP
    BEGIN
      PERFORM public.sync_subscription_lifecycle(v_couple_id);
      v_done := v_done + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Abonelik durumu ilerletilemedi (çift %): %', v_couple_id, SQLERRM;
    END;
  END LOOP;
  RETURN v_done;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 8. RevenueCat olayı: tek işlemde karar + yaşam döngüsü
-- ────────────────────────────────────────────────────────────────────────────
-- Webhook önceki sürümde çifti okuyup ayrı bir istekle yazıyordu; eşzamanlı ya da sırası karışık gelen iki
-- olay birbirini ezebiliyordu. Artık çift satırı kilitlenir, kural uygulanır ve durum aynı işlemde ilerler.
--   • Satın alma / yenileme: bitiş = max(mevcut, mağaza); mağaza bitişi yoksa süresiz. Süresiz Premium korunur.
--   • EXPIRATION / iade (CANCELLATION + CUSTOMER_SUPPORT): is_premium kapatılmaz; bitiş tarihi hakkın gerçek
--     bitiş anına çekilir (iade: şimdi) ve 14 günlük kış uykusu başlar. Daha geç bitişli bir promosyon ya
--     da süresiz Premium etkilenmez.
--   • CANCELLATION (otomatik yenileme kapatıldı), BILLING_ISSUE vb.: ödenmiş dönem sürer, değişiklik yok.
-- Dönüş: granted | kept_lifetime | lapsed | kept | ignored | no_couple
CREATE OR REPLACE FUNCTION public.apply_revenuecat_event(
  p_user_id       UUID,
  p_event_type    TEXT,
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

  -- 018 tetikleyicisi Premium kolonlarını yalnızca bu bayrakla ya da service_role ile kabul eder
  PERFORM set_config('app.allow_premium_override', 'on', true);

  IF p_event_type IN ('INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION',
                      'NON_RENEWING_PURCHASE', 'SUBSCRIPTION_EXTENDED', 'REFUND_REVERSED') THEN
    IF COALESCE(v_couple.is_premium, FALSE) AND v_couple.premium_expires_at IS NULL THEN
      v_result := 'kept_lifetime';
    ELSE
      UPDATE public.couples AS c
         SET is_premium = TRUE,
             premium_expires_at = CASE
               WHEN p_expiration_at IS NULL THEN NULL
               ELSE GREATEST(c.premium_expires_at, p_expiration_at)
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


-- ────────────────────────────────────────────────────────────────────────────
-- 9. Silme hakkı: Premium'dan bağımsız
-- ────────────────────────────────────────────────────────────────────────────
-- Fotoğraf arşivi: yalnızca yükleyen siler (20261022000001 kuralı). Dosyalar kuyruktan silinir.
CREATE OR REPLACE FUNCTION public.delete_archived_photo(p_photo_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_couple_id INTEGER;
BEGIN
  v_couple_id := public.get_my_couple_id();
  IF v_uid IS NULL OR v_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erişim.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.photo_archive AS p
   WHERE p.id = p_photo_id
     AND p.couple_id = v_couple_id
     AND p.user_id = v_uid;
  RETURN FOUND;
END;
$$;

-- Gezegen silme: yıldıza bağlı ya da kasadaki gezegen. Dosyalar kuyruktan silinir.
CREATE OR REPLACE FUNCTION public.delete_exoplanet(p_exoplanet_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_couple_id INTEGER;
BEGIN
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erişim.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.star_exoplanets AS ep
   WHERE ep.id = p_exoplanet_id
     AND ep.couple_id = v_caller_couple_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gezegen bulunamadı veya yetkiniz yok.' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Gezegenden fotoğraf çıkarma bir silme işlemidir: Premium istenmez (ekleme Premium'da kalır)
CREATE OR REPLACE FUNCTION public.remove_media_from_exoplanet(p_planet_id UUID, p_media_url TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_couple_id INTEGER;
BEGIN
  v_caller_couple_id := public.get_my_couple_id();
  IF v_caller_couple_id IS NULL THEN
    RAISE EXCEPTION 'Yetkisiz erişim.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.star_exoplanets AS ep
     SET media_urls = array_remove(ep.media_urls, btrim(p_media_url)),
         updated_at = statement_timestamp()
   WHERE ep.id = p_planet_id
     AND ep.couple_id = v_caller_couple_id
     AND btrim(p_media_url) = ANY (ep.media_urls);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Medya veya gezegen bulunamadı ya da yetkiniz yok.' USING ERRCODE = '42501';
  END IF;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 10. Kış uykusunda yıldız bağları donar
-- ────────────────────────────────────────────────────────────────────────────
-- Yeni istek ve kabul için iki çiftin de Premium hakkı geçerli olmalı (her yol için tablo seviyesinde).
-- Reddetme ve mevcut bağlar etkilenmez; kasaya geçişte bağlar silinir. Karşı çiftin aboneliği mesajda
-- açığa çıkmaz.
CREATE OR REPLACE FUNCTION public.enforce_star_connection_premium()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_my_couple_id INTEGER := public.get_my_couple_id();
  v_couple_a     INTEGER;
  v_couple_b     INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' AND NOT (NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted') THEN
    RETURN NEW;
  END IF;

  SELECT cs.couple_id INTO v_couple_a FROM public.couple_stars AS cs WHERE cs.id = NEW.star_a_id;
  SELECT cs.couple_id INTO v_couple_b FROM public.couple_stars AS cs WHERE cs.id = NEW.star_b_id;

  IF v_my_couple_id IN (v_couple_a, v_couple_b) AND NOT public.has_active_premium(v_my_couple_id) THEN
    RAISE EXCEPTION 'Yıldız bağı kurmak için aktif Premium üyelik gereklidir.' USING ERRCODE = 'P0010';
  END IF;
  IF NOT public.has_active_premium(v_couple_a) OR NOT public.has_active_premium(v_couple_b) THEN
    RAISE EXCEPTION 'Bu yıldız şu an yeni bağ kabul etmiyor.' USING ERRCODE = 'P0015';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_star_connection_premium ON public.star_connections;
CREATE TRIGGER trg_enforce_star_connection_premium
  BEFORE INSERT OR UPDATE OF status ON public.star_connections
  FOR EACH ROW EXECUTE FUNCTION public.enforce_star_connection_premium();


-- ────────────────────────────────────────────────────────────────────────────
-- 11. storage-purge Edge Function'ın kuyruk arayüzü
-- ────────────────────────────────────────────────────────────────────────────
-- Silinecek dosyaları kilitleyerek verir. Hâlâ bir kayıt tarafından gösterilen dosya hiç verilmez, kuyruktan
-- düşer. Kilit süresi içinde bitmeyen iş (fonksiyon çöktü) kilit dolunca yeniden verilir.
CREATE OR REPLACE FUNCTION public.claim_storage_purge_batch(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (queue_id BIGINT, bucket_id TEXT, object_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT q.id, public.storage_object_in_use(q.bucket_id, q.object_name) AS in_use
      FROM public.storage_purge_queue AS q
     WHERE q.attempts < 10
       AND (q.locked_until IS NULL OR q.locked_until < statement_timestamp())
     ORDER BY q.id
     LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 100), 500))
       FOR UPDATE SKIP LOCKED
  ),
  dropped AS (
    DELETE FROM public.storage_purge_queue AS q
     USING candidates AS c
     WHERE q.id = c.id AND c.in_use
  )
  UPDATE public.storage_purge_queue AS q
     SET locked_until = statement_timestamp() + INTERVAL '10 minutes',
         attempts = q.attempts + 1
    FROM candidates AS c
   WHERE q.id = c.id AND NOT c.in_use
  RETURNING q.id, q.bucket_id, q.object_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_storage_purge(p_queue_ids BIGINT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.storage_purge_queue AS q WHERE q.id = ANY (p_queue_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Başarısız silme: artan bekleme (30 dk × deneme); 10 denemeden sonra last_error ile kuyrukta kalır
CREATE OR REPLACE FUNCTION public.fail_storage_purge(p_queue_ids BIGINT[], p_error TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.storage_purge_queue AS q
     SET locked_until = statement_timestamp() + make_interval(mins => 30 * LEAST(q.attempts, 10)),
         last_error = left(p_error, 1000)
   WHERE q.id = ANY (p_queue_ids);
$$;

-- pg_cron → Edge Function (yalnızca kuyrukta hazır iş varsa; send-push ile aynı Vault deseni)
CREATE OR REPLACE FUNCTION public.invoke_storage_purge()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.storage_purge_queue AS q
     WHERE q.attempts < 10
       AND (q.locked_until IS NULL OR q.locked_until < statement_timestamp())
  ) THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'PUSH_WEBHOOK_SECRET'
   LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'PUSH_WEBHOOK_SECRET Vault içinde bulunamadı';
  END IF;

  PERFORM net.http_post(
    url     := 'https://vjnzoomngpwlkxwvixqs.supabase.co/functions/v1/storage-purge',
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- 12. Yetkiler
-- ────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.subscription_grace_period()                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.subscription_vault_period()                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.premium_entitlement_active(BOOLEAN, TIMESTAMPTZ)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.premium_lapsed_at(TIMESTAMPTZ)                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_active_premium(INTEGER)                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_couples_subscription_lifecycle()                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_star_exoplanets_owner()                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_couple_stars_restore_vault()                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_storage_purge(TEXT, TEXT[], INTEGER, TEXT)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.row_media_paths(JSONB, TEXT[])                      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_enqueue_detached_media()                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.storage_object_in_use(TEXT, TEXT)                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_couple_star_to_vault(INTEGER)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_vaulted_media(INTEGER)                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_subscription_lifecycle(INTEGER)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_subscription_lifecycles(INTEGER)            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_revenuecat_event(UUID, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_star_connection_premium()                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_storage_purge_batch(INTEGER)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_storage_purge(BIGINT[])                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_storage_purge(BIGINT[], TEXT)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invoke_storage_purge()                              FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.delete_archived_photo(BIGINT)                       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_exoplanet(UUID)                              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_media_from_exoplanet(UUID, TEXT)             FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_archived_photo(BIGINT)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_exoplanet(UUID)                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_media_from_exoplanet(UUID, TEXT)          TO authenticated;

GRANT EXECUTE ON FUNCTION public.sync_subscription_lifecycle(INTEGER)             TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_subscription_lifecycles(INTEGER)         TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_revenuecat_event(UUID, TEXT, TIMESTAMPTZ, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_storage_purge_batch(INTEGER)               TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_storage_purge(BIGINT[])                 TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_storage_purge(BIGINT[], TEXT)               TO service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 13. Zamanlama
-- ────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  FOR v_job_id IN
    SELECT jobid FROM cron.job WHERE jobname IN ('subscription-lifecycle', 'storage-purge')
  LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;
END;
$$;

SELECT cron.schedule('subscription-lifecycle', '7 * * * *',
  $cron$ SELECT public.advance_subscription_lifecycles(500); $cron$);
SELECT cron.schedule('storage-purge', '*/10 * * * *',
  $cron$ SELECT public.invoke_storage_purge(); $cron$);

COMMIT;
