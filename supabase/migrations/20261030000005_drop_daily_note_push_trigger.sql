-- ============================================================================
-- daily_notes üzerindeki push tetikleyicisini kaldır
-- ============================================================================
-- send-push özel günlük (daily_notes) için bilerek bildirim göndermez: günlük "sadece sen okuyabilirsin"
-- vaadiyle tutulur ve yazıldığının partnere haber verilmesi bu gizliliğe ters düşer. Canlıda kalmış
-- `on_daily_note_added` tetikleyicisi ise her günlük kaydında satırı (şifreli içerik dahil) boş yere
-- Edge Function'a gönderiyordu. Aşağıdaki blok daily_notes üzerindeki tüm push webhook tetikleyicilerini siler.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT t.tgname
      FROM pg_trigger AS t
      JOIN pg_class AS c ON c.oid = t.tgrelid
      JOIN pg_namespace AS n ON n.oid = c.relnamespace
     WHERE NOT t.tgisinternal
       AND n.nspname = 'public'
       AND c.relname = 'daily_notes'
       AND (pg_get_triggerdef(t.oid) ILIKE '%invoke_push_webhook%' OR pg_get_triggerdef(t.oid) ILIKE '%send-push%')
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.daily_notes', v_rec.tgname);
  END LOOP;
END $$;

COMMIT;
