import { supabase } from "@/lib/supabase";
import { todayString, dayjs } from "@/lib/date";

/** Aşk Skoru: 15 (min) – 100 (max) arasında sınırlandırılmış sonuç */
export interface LoveScoreResult {
  score: number;
  subtitle: string;
  breakdown: Record<string, number>; // debug / analiz için
}

/**
 * Çiftin son 7 günlük + bugünkü aktivitelerine bakarak 0-100 arası
 * dinamik bir aşk puanı hesaplar.
 *
 * Kurallar:
 *  - Taban puan: 50
 *  - Gerçekleşen buluşma:           +15
 *  - İlaç yok → nötr (0 değişim)
 *  - İlaç var & içildi:             +10
 *  - İlaç var & içilmedi:           -10
 *  - Gönderilen mektup:             +10
 *  - Regl döngüsü kaydı:           +10
 *  - Günlük not — 1 taraf:         + 5
 *  - Günlük not — 2 taraf:         +15 (bonus)
 *  - Takvim notu — 1 taraf:        + 5
 *  - Takvim notu — 2 taraf:        +10 (bonus)
 *  - Mood seçimi bugün:            + 5
 *  - Son 7 günde fotoğraf:         + 5
 */
export async function computeLoveScore(
  coupleId: number,
  userId: string,
  partnerId: string | null
): Promise<LoveScoreResult> {
  const today = todayString();
  const sevenDaysAgo = dayjs().subtract(7, "day").format("YYYY-MM-DD");
  const thisMonthStart = dayjs().startOf("month").format("YYYY-MM-DD");

  const breakdown: Record<string, number> = {};
  let score = 50;

  try {
    // ── 1. Gerçekleşen buluşmalar (tarihi geçmiş aktif buluşmalar) ─────────────────
    const { data: meetings } = await supabase
      .from("meetings")
      .select("id, meeting_datetime, is_active")
      .eq("couple_id", coupleId)
      .eq("is_active", true)
      .lt("meeting_datetime", dayjs().toISOString())
      .gte("meeting_datetime", dayjs().subtract(30, "day").toISOString());

    if (meetings && meetings.length > 0) {
      breakdown["meetings"] = 15;
      score += 15;
    } else {
      breakdown["meetings"] = 0;
    }

    // ── 2. İlaç takibi ────────────────────────────────────────────────────────────────
    const { data: myMedicines } = await supabase
      .from("medicines")
      .select("id")
      .eq("couple_id", coupleId)
      .eq("user_id", userId)
      .eq("is_active", true);

    if (!myMedicines || myMedicines.length === 0) {
      // Kayıtlı ilaç yok → nötr, puan değişmez
      breakdown["medicine"] = 0;
    } else {
      // Kayıtlı ilaç var, bugün içildi mi?
      const medicineIds = myMedicines.map((m) => m.id);
      const { data: todayLogs } = await supabase
        .from("medicine_logs")
        .select("medicine_id, status")
        .eq("couple_id", coupleId)
        .eq("user_id", userId)
        .eq("date", today)
        .in("medicine_id", medicineIds);

      const takenCount = (todayLogs ?? []).filter((l) => l.status === "taken").length;
      const skippedCount = (todayLogs ?? []).filter((l) => l.status === "skipped").length;

      if (takenCount > 0 && skippedCount === 0) {
        breakdown["medicine"] = 10;
        score += 10;
      } else if (skippedCount > 0) {
        breakdown["medicine"] = -10;
        score -= 10;
      } else {
        // Henüz log girilmemiş → nötr
        breakdown["medicine"] = 0;
      }
    }

    // ── 3. Mektuplar ──────────────────────────────────────────────────────────────────
    const { data: letters } = await supabase
      .from("letters")
      .select("id")
      .eq("couple_id", coupleId)
      .eq("sender_id", userId)
      .gte("created_at", dayjs().subtract(30, "day").toISOString());

    if (letters && letters.length > 0) {
      breakdown["letters"] = 10;
      score += 10;
    } else {
      breakdown["letters"] = 0;
    }

    // ── 4. Regl döngüsü kaydı (bu ay) ──────────────────────────────────────────────
    const { data: periodLogs } = await supabase
      .from("period_logs")
      .select("id")
      .eq("user_id", userId)
      .gte("date", thisMonthStart);

    if (periodLogs && periodLogs.length > 0) {
      breakdown["period"] = 10;
      score += 10;
    } else {
      breakdown["period"] = 0;
    }

    // ── 5. Günlük notlar ──────────────────────────────────────────────────────────────
    const [myNoteRes, partnerNoteRes] = await Promise.all([
      supabase
        .from("daily_notes")
        .select("id")
        .eq("user_id", userId)
        .eq("date", today)
        .limit(1),
      partnerId
        ? supabase
            .from("daily_notes")
            .select("id")
            .eq("user_id", partnerId)
            .eq("date", today)
            .limit(1)
        : Promise.resolve({ data: null }),
    ]);

    const myNoteToday = (myNoteRes.data?.length ?? 0) > 0;
    const partnerNoteToday = (partnerNoteRes.data?.length ?? 0) > 0;

    if (myNoteToday && partnerNoteToday) {
      breakdown["daily_notes"] = 15; // çift bonus
      score += 15;
    } else if (myNoteToday || partnerNoteToday) {
      breakdown["daily_notes"] = 5;
      score += 5;
    } else {
      breakdown["daily_notes"] = 0;
    }

    // ── 6. Takvim notları ────────────────────────────────────────────────────────────
    const [myCalRes, partnerCalRes] = await Promise.all([
      supabase
        .from("calendar_notes")
        .select("id")
        .eq("user_id", userId)
        .gte("date", sevenDaysAgo)
        .limit(1),
      partnerId
        ? supabase
            .from("calendar_notes")
            .select("id")
            .eq("user_id", partnerId)
            .gte("date", sevenDaysAgo)
            .limit(1)
        : Promise.resolve({ data: null }),
    ]);

    const myCalNote = (myCalRes.data?.length ?? 0) > 0;
    const partnerCalNote = (partnerCalRes.data?.length ?? 0) > 0;

    if (myCalNote && partnerCalNote) {
      breakdown["calendar_notes"] = 10;
      score += 10;
    } else if (myCalNote || partnerCalNote) {
      breakdown["calendar_notes"] = 5;
      score += 5;
    } else {
      breakdown["calendar_notes"] = 0;
    }

    // ── 7. Mood seçimi bugün ─────────────────────────────────────────────────────────
    const { data: moodToday } = await supabase
      .from("moods")
      .select("id")
      .eq("user_id", userId)
      .eq("date", today)
      .limit(1);

    if (moodToday && moodToday.length > 0) {
      breakdown["mood"] = 5;
      score += 5;
    } else {
      breakdown["mood"] = 0;
    }

    // ── 8. Fotoğraf (son 7 gün) ──────────────────────────────────────────────────────
    const { data: recentPhotos } = await supabase
      .from("photo_archive")
      .select("id")
      .eq("couple_id", coupleId)
      .gte("created_at", dayjs().subtract(7, "day").toISOString())
      .limit(1);

    if (recentPhotos && recentPhotos.length > 0) {
      breakdown["photos"] = 5;
      score += 5;
    } else {
      breakdown["photos"] = 0;
    }

  } catch {
    // Hesaplama hatası → taban puan 50 ile devam et
  }

  // 15 - 100 arasına sıkıştır
  const clamped = Math.min(100, Math.max(15, score));

  return {
    score: clamped,
    subtitle: getSubtitle(clamped),
    breakdown,
  };
}

function getSubtitle(score: number): string {
  if (score >= 90) return "Kusursuz bir bağ! Aşkınız zirvede 🔥";
  if (score >= 75) return "Harika bir uyum! Birbirinizi hiç ihmal etmiyorsunuz 💖";
  if (score >= 50) return "Güzel bir gün! Birbirinize küçük bir not bırakabilirsiniz 💌";
  return "Bugün biraz ilgi zamanı! Bir anı paylaşmaya ne dersiniz? 🌸";
}
