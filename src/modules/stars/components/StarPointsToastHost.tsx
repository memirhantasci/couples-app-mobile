/**
 * @file StarPointsToastHost.tsx
 * @module modules/stars/components
 * @description Yıldızı parlatan bir aktivite yapıldığında "+2 puan 🌟" bildirimi.
 *
 * Puanı veritabanı trigger'ları verir (mektup, ruh hali, fotoğraf...); bu bileşen
 * yalnızca çiftin `couple_activity_log` kayıtlarını realtime dinler ve kullanıcının
 * kendi kazandığı puanı gösterir. Kayıt ekranlarının puandan haberi olması gerekmez.
 */

import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import i18n from '@/lib/i18n';
import type { ParseKeys } from 'i18next';
import type { CoupleActivityLogRecord, StarActivityType } from '../types/star.types';

const ACTIVITY_LABEL_KEYS: Record<StarActivityType, ParseKeys> = {
  mood: 'stars.activity.mood',
  medicine: 'stars.activity.medicine',
  calendar_note: 'stars.activity.calendar_note',
  pinned_note: 'stars.activity.pinned_note',
  period_tracking: 'stars.activity.period_tracking',
  letter: 'stars.activity.letter',
  planet: 'stars.activity.planet',
  photo: 'stars.activity.photo',
  diary: 'stars.activity.diary',
  profile_pic: 'stars.activity.profile_pic',
  meeting: 'stars.activity.meeting',
  memory: 'stars.activity.memory',
  wish: 'stars.activity.wish',
};

/** Bu aktivitelerin ekranı ışık katkısını zaten kendisi gösterir (ör. dilek ekranı); bildirim tekrarlanmaz. */
const SILENT_ACTIVITIES: ReadonlySet<StarActivityType> = new Set<StarActivityType>(['wish']);

export function StarPointsToastHost() {
  const { session, profile, isDemoMode } = useAuth();
  const userId = session?.user?.id;
  const coupleId = profile?.coupleId;

  useEffect(() => {
    if (isDemoMode || !userId || !coupleId) return;

    let cancelled = false;
    let hasStar = false;

    // Çiftin yıldızı var mı kontrol et
    supabase
      .from('couple_stars')
      .select('id')
      .eq('couple_id', coupleId)
      .maybeSingle()
      .then(
        ({ data }) => {
          if (!cancelled) {
            hasStar = Boolean(data);
          }
        },
        () => {},
      );

    const channel = supabase
      .channel(`star_points_${coupleId}_${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'couple_activity_log', filter: `couple_id=eq.${coupleId}` },
        async (payload) => {
          const entry = payload.new as CoupleActivityLogRecord;
          if (entry.status !== 'awarded' || entry.points <= 0 || entry.user_id !== userId) return;
          if (SILENT_ACTIVITIES.has(entry.activity_type)) return;

          // Henüz yıldız varlığı tespit edilmediyse son durumu doğrula
          if (!hasStar) {
            const { data } = await supabase
              .from('couple_stars')
              .select('id')
              .eq('couple_id', coupleId)
              .maybeSingle();
            hasStar = Boolean(data);
          }

          // Çift henüz bir yıldız sahiplenmemişse veya bileşen unmount olduysa gösterme
          if (!hasStar || cancelled) return;

          // Kayıt ekranının kendi başarı bildiriminden sonra sıraya girer; haptik onda zaten verildi.
          // Abonelik uzun ömürlüdür; metin, olay anındaki geçerli dilde çözülür.
          toast.success(i18n.t('stars.pointsToast', { count: entry.points }), {
            title: i18n.t(ACTIVITY_LABEL_KEYS[entry.activity_type]),
            haptic: false,
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [isDemoMode, userId, coupleId]);

  return null;
}
