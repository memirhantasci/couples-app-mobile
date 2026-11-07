-- ============================================================================
-- İlaç ekleme: iki gevşek politikayı tek, sıkı politikada birleştirir
-- ----------------------------------------------------------------------------
-- Önceki hâlde "Insert own couple medicines" yalnızca couple_id = benim çiftim koşulunu arıyordu; user_id olarak
-- çiftten bağımsız herhangi bir kullanıcı yazılabiliyordu (o kullanıcıya hatırlatma bildirimi gider).
-- Yeni kural: ilaç ya bana ya da çiftimdeki bir üyeye eklenebilir (partnere ilaç ekleme özelliği korunur).
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "Insert own couple medicines" ON public.medicines;
DROP POLICY IF EXISTS "Insert own data" ON public.medicines;

CREATE POLICY medicines_insert_self_or_partner ON public.medicines
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      user_id = (SELECT auth.uid())
      AND (couple_id IS NULL OR couple_id = (SELECT get_my_couple_id()))
    )
    OR (
      couple_id = (SELECT get_my_couple_id())
      AND user_id IN (SELECT u.id FROM public.users AS u WHERE u.couple_id = (SELECT get_my_couple_id()))
    )
  );

COMMIT;
