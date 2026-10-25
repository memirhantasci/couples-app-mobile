-- moods tablosunda aynı işi yapan iki push webhook tetikleyicisi vardı
-- (on_mood_changed ve on_mood_updated: ikisi de AFTER INSERT OR UPDATE → invoke_push_webhook()).
-- Her ruh hali güncellemesinde send-push iki kez çalışıp partnere çift bildirim gönderiyordu.
-- Biri kalır; diğer tablolarda zaten tek tetikleyici var.

DROP TRIGGER IF EXISTS on_mood_changed ON public.moods;
