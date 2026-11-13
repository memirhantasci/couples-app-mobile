-- ============================================================================
-- Mektup zaman kilidi (1/2): alıcı için içeriği maskeleyen görünüm
-- ----------------------------------------------------------------------------
-- Sorun: letters_select politikası alıcıya kendi satırlarının tamamını açıyor; kilidi henüz açılmamış
-- (unlock_date gelecekte) mektubun başlığı ve şifreli içeriği API'den doğrudan okunabiliyor. Kilit yalnızca
-- istemcide. Ayrıntı: docs/BILINEN_SINIRLAR_VE_YAYIN_SONRASI_ISLER.md bölüm 1.
--
-- Bu dosya YALNIZCA EKLER: public.my_letters görünümü. letters tablosuna, politikalarına ve mevcut
-- fonksiyonlara dokunmaz; mağazadaki eski sürümler (doğrudan letters okuyanlar) aynen çalışır.
--
-- Görünüm:
--   • Bakan kişinin gönderdiği ve aldığı mektuplar (letters_select ile aynı satırlar).
--   • Alıcı için kilitli mektupta title ve content boş metindir; diğer sütunlar (id, sender_id, unlock_date,
--     created_at, gizleme ve silme alanları) aynen gelir: "mühürlü mektup" kartı, ana sayfa kartı, bildirimler
--     ve sayaçlar bunlarla çalışır. Gönderen kendi mektubunu her zaman tam görür.
--   • Açılış anı sunucudaki public.letter_unlock_at ile aynıdır (unlock_date günü 00:00 Türkiye saati).
--   • is_locked: bu satır bakan kişi için maskelendi mi.
--
-- security_invoker = false: görünüm sahibinin yetkisiyle okur. 2. adımda letters_select yalnızca gönderene
-- indirildiğinde alıcının satırları yalnızca bu görünümden (maskeli) gelir. security_barrier: istemcinin
-- verdiği filtreler görünümün kendi koşulundan sonra uygulanır.
--
-- 2. adım (AYRI, bu dosyada YOK): yeni istemci mağazalarda yayıldıktan sonra letters_select'ten alıcı kolu
-- kaldırılır. Erken uygulanırsa eski sürümlerde gelen mektuplar kaybolur.
-- ============================================================================

BEGIN;

CREATE OR REPLACE VIEW public.my_letters
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  l.id,
  l.sender_id,
  l.receiver_id,
  CASE WHEN v.is_locked THEN ''::character varying ELSE l.title END AS title,
  CASE WHEN v.is_locked THEN ''::text ELSE l.content END AS content,
  l.unlock_date,
  l.created_at,
  l.couple_id,
  l.hidden_by_sender,
  l.hidden_by_receiver,
  l.deletion_requested_at,
  l.deletion_approved_at,
  l.deletion_rejected_at,
  v.is_locked
FROM public.letters AS l
CROSS JOIN LATERAL (
  SELECT (l.sender_id IS DISTINCT FROM (SELECT auth.uid())
          AND public.letter_unlock_at(l.unlock_date) > now()) AS is_locked
) AS v
WHERE l.sender_id = (SELECT auth.uid())
   OR l.receiver_id = (SELECT auth.uid());

COMMENT ON VIEW public.my_letters IS
  'Bakan kişinin mektupları; alıcı için kilitli mektupta title/content boş. İstemci okumaları buradan yapılır.';

-- Supabase yeni nesnelere anon/authenticated için tam yetki verir: yalnızca okuma bırakılır
REVOKE ALL ON public.my_letters FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.my_letters TO authenticated;
GRANT ALL ON public.my_letters TO service_role;

COMMIT;
