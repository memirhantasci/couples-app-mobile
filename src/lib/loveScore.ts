import { supabase } from "@/lib/supabase";
import { todayString, dayjs } from "@/lib/date";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Aşk Skoru: 15 (min) – 100 (max) arasında sınırlandırılmış sonuç */
export interface LoveScoreResult {
  score: number;
  subtitle: string;
  breakdown: Record<string, number>; // analiz ve denetim için
}

/** Yerel önbellekten son aşk puanını oku (açılışta 50 flash'ını engellemek için) */
export async function getCachedLoveScore(coupleId: number): Promise<LoveScoreResult | null> {
  try {
    const raw = await AsyncStorage.getItem(`@love_score_${coupleId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/** Yerel önbelleğe son aşk puanını kaydet */
export async function setCachedLoveScore(coupleId: number, data: LoveScoreResult): Promise<void> {
  try {
    await AsyncStorage.setItem(`@love_score_${coupleId}`, JSON.stringify(data));
  } catch {}
}

/**
 * Çiftin son 30 günlük ve bugünkü aktivitelerine bakarak 0-100 arası
 * dinamik ve TAM SİMETRİK (her iki partner için %100 aynı) aşk puanı hesaplar.
 *
 * Kurallar (Çift Odaklı):
 *  - Taban puan: 50
 *  - Gerçekleşen buluşma:                +15
 *  - Mektup yazılmış (1 kişi: +10 / her iki taraf: +15)
 *  - İlaç takibi: İlaç yok: 0 / İçildi: +10 / Unutuldu: -10
 *  - Regl döngüsü kaydı (bu ay):        +10
 *  - Günlük not (1 kişi: +5 / her iki taraf: +15)
 *  - Takvim notu (1 kişi: +5 / her iki taraf: +10)
 *  - Mood seçimi bugün (1 kişi: +5 / her iki taraf: +10)
 *  - Son 7 günde fotoğraf:              + 5
 */
export async function computeLoveScore(
  coupleId: number,
  userId?: string | null,
  partnerId?: string | null
): Promise<LoveScoreResult> {
  const today = todayString();
  const sevenDaysAgo = dayjs().subtract(7, "day").format("YYYY-MM-DD");
  const thirtyDaysAgo = dayjs().subtract(30, "day").toISOString();
  const thisMonthStart = dayjs().startOf("month").format("YYYY-MM-DD");

  const breakdown: Record<string, number> = {};
  let score = 50;

  try {
    // ── 0. Çiftin her iki kullanıcısını tespit et (Kişiye özel sapmaları önler) ───
    let userIds: string[] = [];
    if (userId && partnerId) {
      userIds = [userId, partnerId];
    } else {
      const { data: coupleUsers } = await supabase
        .from("users")
        .select("id")
        .eq("couple_id", coupleId);
      userIds = (coupleUsers ?? []).map((u) => u.id);
      if (userId && !userIds.includes(userId)) userIds.push(userId);
      if (partnerId && !userIds.includes(partnerId)) userIds.push(partnerId);
    }

    // ── 1. Gerçekleşen buluşmalar (Son 30 günde gerçekleşen aktif buluşmalar) ───
    const { data: meetings } = await supabase
      .from("meetings")
      .select("id")
      .eq("couple_id", coupleId)
      .eq("is_active", true)
      .lt("meeting_datetime", dayjs().toISOString())
      .gte("meeting_datetime", thirtyDaysAgo);

    if (meetings && meetings.length > 0) {
      breakdown["meetings"] = 15;
      score += 15;
    } else {
      breakdown["meetings"] = 0;
    }

    // ── 2. Aşk Mektupları (Son 30 günde yazılan mektuplar) ──────────────────────
    const { data: letters } = await supabase
      .from("letters")
      .select("id, sender_id")
      .eq("couple_id", coupleId)
      .gte("created_at", thirtyDaysAgo);

    if (letters && letters.length > 0) {
      const senders = new Set(letters.map((l) => l.sender_id));
      if (senders.size >= 2) {
        breakdown["letters"] = 15; // Çift bonusu: Her iki partner de mektup yazmış
        score += 15;
      } else {
        breakdown["letters"] = 10;
        score += 10;
      }
    } else {
      breakdown["letters"] = 0;
    }

    // ── 3. İlaç Takibi (Çiftin aktif ilaçları ve bugünkü durumları) ─────────────
    const { data: coupleMedicines } = await supabase
      .from("medicines")
      .select("id")
      .eq("couple_id", coupleId)
      .eq("is_active", true);

    if (!coupleMedicines || coupleMedicines.length === 0) {
      // Kayıtlı ilaç yok → nötr (0 değişim)
      breakdown["medicine"] = 0;
    } else {
      const medicineIds = coupleMedicines.map((m) => m.id);
      const { data: todayLogs } = await supabase
        .from("medicine_logs")
        .select("medicine_id, status")
        .eq("couple_id", coupleId)
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
        breakdown["medicine"] = 0;
      }
    }

    // ── 4. Regl Döngüsü (Bu ay çift için girilmiş döngü/semptom kaydı) ──────────
    if (userIds.length > 0) {
      const { data: periodLogs } = await supabase
        .from("period_logs")
        .select("id")
        .in("user_id", userIds)
        .gte("date", thisMonthStart);

      if (periodLogs && periodLogs.length > 0) {
        breakdown["period"] = 10;
        score += 10;
      } else {
        breakdown["period"] = 0;
      }
    }

    // ── 5. Günlük Notlar (Bugün yazılan günlük notlar) ──────────────────────────
    if (userIds.length > 0) {
      const { data: todayNotes } = await supabase
        .from("daily_notes")
        .select("id, user_id")
        .in("user_id", userIds)
        .eq("date", today);

      const noteUsers = new Set((todayNotes ?? []).map((n) => n.user_id));
      if (noteUsers.size >= 2) {
        breakdown["daily_notes"] = 15; // İki taraf da yazmış (çift bonusu)
        score += 15;
      } else if (noteUsers.size === 1) {
        breakdown["daily_notes"] = 5; // Bir taraf yazmış
        score += 5;
      } else {
        breakdown["daily_notes"] = 0;
      }
    }

    // ── 6. Takvim Notları (Son 7 gündeki notlar) ────────────────────────────────
    if (userIds.length > 0) {
      const { data: calNotes } = await supabase
        .from("calendar_notes")
        .select("id, user_id")
        .in("user_id", userIds)
        .gte("date", sevenDaysAgo);

      const calUsers = new Set((calNotes ?? []).map((c) => c.user_id));
      if (calUsers.size >= 2) {
        breakdown["calendar_notes"] = 10; // İki taraf da not eklemiş
        score += 10;
      } else if (calUsers.size === 1) {
        breakdown["calendar_notes"] = 5;
        score += 5;
      } else {
        breakdown["calendar_notes"] = 0;
      }
    }

    // ── 7. Mood Seçimi (Bugünkü ruh hali paylaşımı) ─────────────────────────────
    if (userIds.length > 0) {
      const { data: moodLogs } = await supabase
        .from("moods")
        .select("id, user_id")
        .in("user_id", userIds)
        .eq("date", today);

      const moodUsers = new Set((moodLogs ?? []).map((m) => m.user_id));
      if (moodUsers.size >= 2) {
        breakdown["mood"] = 10; // İki taraf da kaydetmiş
        score += 10;
      } else if (moodUsers.size === 1) {
        breakdown["mood"] = 5; // Bir taraf kaydetmiş
        score += 5;
      } else {
        breakdown["mood"] = 0;
      }
    }

    // ── 8. Fotoğraf (Son 7 günde ortak galeriye fotoğraf ekleme) ───────────────
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
    // Hata durumunda güvenli taban puan
  }

  // 15 - 100 arasına sınırla
  const clamped = Math.min(100, Math.max(15, score));
  const result: LoveScoreResult = {
    score: clamped,
    subtitle: getSubtitle(clamped),
    breakdown,
  };

  // Sonucu yerel önbelleğe kaydet (açılışta beklemesiz anında yükleme için)
  setCachedLoveScore(coupleId, result).catch(() => {});

  return result;
}

function getSubtitle(score: number): string {
  if (score >= 90) return "Kusursuz bir bağ! Aşkınız zirvede 🔥";
  if (score >= 75) return "Harika bir uyum! Birbirinizi hiç ihmal etmiyorsunuz 💖";
  if (score >= 50) return "Güzel bir gün! Birbirinize küçük bir not bırakabilirsiniz 💌";
  return "Bugün biraz ilgi zamanı! Bir anı paylaşmaya ne dersiniz? 🌸";
}
