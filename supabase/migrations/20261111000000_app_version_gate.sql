-- ============================================================================
-- Zorunlu güncelleme kapısı: platform başına asgari uygulama sürümü
-- ============================================================================
-- İstemci (1.1.0 ve sonrası) açılışta ve öne gelince get_app_version_requirement('ios' | 'android') çağırır.
-- Cihazdaki sürüm min_version'dan KESİN olarak küçükse (ya da sürüm eşit ve min_build doluysa build numarası
-- ondan küçükse) "güncelle" ekranı açılır. Her belirsizlikte (satır yok, min_version boş, yanıt bozuk, ağ hatası)
-- kapı AÇIK kalır. Karar mantığı: src/lib/appVersionGate.ts. Kullanım ve geri alma: docs/ZORUNLU_GUNCELLEME.md.
--
-- YALNIZCA EKLER: yeni bir tablo ve yeni bir fonksiyon. Mevcut hiçbir tabloya, fonksiyona, politikaya ya da
-- yetkiye dokunmaz. Eski sürümler (1.0.0) bu nesneleri hiç çağırmaz; onlar için hiçbir şey değişmez.
--
-- Tabloya istemciden erişilemez (RLS açık, politika yok, anon/authenticated yetkisi yok). Değerler yalnızca
-- Supabase panelinden / service_role ile (docs/ZORUNLU_GUNCELLEME.md'deki tek satır) değiştirilir.
-- Başlangıç değerleri hiçbir sürümü engellemez (min_version boş).
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_version_requirements (
  platform    TEXT PRIMARY KEY CHECK (platform IN ('ios', 'android')),
  -- Görünen sürüm (iOS CFBundleShortVersionString / Android versionName), ör. '1.1.0'. Boş = kapı kapalı.
  min_version TEXT CHECK (min_version IS NULL OR min_version ~ '^[0-9]{1,6}(\.[0-9]{1,6}){0,3}$'),
  -- İsteğe bağlı: aynı görünen sürümün eski build'lerini ayırmak için (iOS CFBundleVersion / Android versionCode).
  -- Yalnızca cihazın sürümü min_version'a EŞİTSE uygulanır.
  min_build   INTEGER CHECK (min_build IS NULL OR min_build > 0),
  -- Mağaza adresi; boşsa ya da geçersizse istemci kendi bildiği adresi kullanır.
  store_url   TEXT CHECK (store_url IS NULL OR (store_url ~ '^https://' AND char_length(store_url) <= 300)),
  -- İsteğe bağlı ekran metni; boşsa istemcinin yerel metni gösterilir.
  message_tr  TEXT CHECK (message_tr IS NULL OR char_length(message_tr) BETWEEN 1 AND 300),
  message_en  TEXT CHECK (message_en IS NULL OR char_length(message_en) BETWEEN 1 AND 300),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT app_version_requirements_build_needs_version CHECK (min_build IS NULL OR min_version IS NOT NULL)
);

ALTER TABLE public.app_version_requirements ENABLE ROW LEVEL SECURITY;
-- Politika yok: istemci rolleri satır göremez ve yazamaz. Yetkiler de ayrıca kaldırılır (Supabase'in yeni
-- tablolara verdiği varsayılan yetkiler).
REVOKE ALL ON public.app_version_requirements FROM PUBLIC, anon, authenticated;

-- Başlangıç: hiçbir sürüm engellenmez. Dosya yeniden çalıştırılırsa sonradan yükseltilmiş değerler ezilmez.
INSERT INTO public.app_version_requirements (platform, min_version, min_build, store_url)
VALUES
  ('ios',     NULL, NULL, 'https://apps.apple.com/app/id6829036716'),
  ('android', NULL, NULL, 'https://play.google.com/store/apps/details?id=app.couplesky.mobile')
ON CONFLICT (platform) DO NOTHING;

-- Giriş yapmamış kullanıcı da çağırabilir (kapı giriş ekranından önce çalışır). Yalnızca okur; satır yoksa NULL.
CREATE OR REPLACE FUNCTION public.get_app_version_requirement(p_platform TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
           'platform',    r.platform,
           'min_version', r.min_version,
           'min_build',   r.min_build,
           'store_url',   r.store_url,
           'message_tr',  r.message_tr,
           'message_en',  r.message_en
         )
  FROM public.app_version_requirements r
  WHERE r.platform = p_platform;
$$;

REVOKE ALL ON FUNCTION public.get_app_version_requirement(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_app_version_requirement(TEXT) TO anon, authenticated;

COMMIT;

-- PostgREST yeni fonksiyonu görsün
NOTIFY pgrst, 'reload schema';
