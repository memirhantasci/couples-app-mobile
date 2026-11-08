-- device_authorizations: (user_id, device_id) benzersiz değildi ve tabloda birincil anahtar yoktu.
-- İlk girişte aynı cihaz iki kez kaydoluyor (sosyal giriş akışı ile AuthContext yarışı); istemci "bu cihaz yetkili mi"
-- sorusunu .maybeSingle() ile soruyor ve iki satır görünce hata alıp "yetkisiz" sayarak her girişte e-posta OTP'si
-- gönderiyordu (Apple/Google/e-posta girişinin hepsi). Çözüm: tekrarları birleştir, benzersiz kuralı ve birincil anahtarı ekle.
-- Eski istemciler değişmeden çalışır: onConflict kullanan upsert'ler (verify-device) kuralı kullanır, kullanmayanlar
-- yarışta unique ihlali alır (istemci sonucu zaten yok sayar).

-- 1. Her (user_id, device_id) için en eski satır kalır; biri bile yetkiliyse yetkili sayılır
UPDATE public.device_authorizations AS keep
   SET is_authorized = TRUE
 WHERE keep.id IN (SELECT min(id) FROM public.device_authorizations GROUP BY user_id, device_id)
   AND EXISTS (
     SELECT 1 FROM public.device_authorizations AS d
      WHERE d.user_id = keep.user_id AND d.device_id = keep.device_id AND d.is_authorized
   );

DELETE FROM public.device_authorizations
 WHERE id NOT IN (SELECT min(id) FROM public.device_authorizations GROUP BY user_id, device_id);

-- 2. Benzersizlik + birincil anahtar
CREATE UNIQUE INDEX IF NOT EXISTS device_authorizations_user_device_key
  ON public.device_authorizations (user_id, device_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.device_authorizations'::regclass AND contype = 'p'
  ) THEN
    ALTER TABLE public.device_authorizations ADD PRIMARY KEY (id);
  END IF;
END $$;
