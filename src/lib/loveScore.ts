import { supabase } from "@/lib/supabase";
import { todayString, dayjs } from "@/lib/date";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";

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
 * Çiftin son 30 günlük ve bugünkü aktivitelerine bakarak 15-100 arası
 * dinamik, adil ve TAM SİMETRİK (her iki partner için %100 aynı) aşk puanı hesaplar.
 *
 * Adil Puanlama Felsefesi (Feature-Aware Dynamic Scoring):
 *  - Taban puan: 50 (İlişkinin temel sevgi ve bağlılık tabanı)
 *  - Premium olmayan kullanıcılar ücretli özellikleri (fotoğraf arşivi vb.) kullanamadıkları
 *    için ASLA cezalandırılmaz veya dezavantajlı olmaz!
 *  - Puanlama paydası (maksimum puan), sadece çiftin ERİŞEBİLDİĞİ ve AKTİF KULLANDIĞI
 *    özellikler üzerinden dinamik olarak oluşturulur.
 *  - Böylece hem ücretsiz kullanıcılar hem de premium kullanıcılar kendi erişebildikleri
 *    özellikleri aktif kullandıklarında 100 tam puana ulaşabilirler!
 *
 * Özellikler:
 *  - Ruh Hali (Mood):             Maks 15 (Her iki taraf: 15 / Tek taraf: 8)
 *  - Günlük Not (Daily Notes):    Maks 20 (Her iki taraf: 20 / Tek taraf: 10)
 *  - Takvim Notu (Calendar):      Maks 15 (Her iki taraf: 15 / Tek taraf: 8)
 *  - Buluşmalar (Meetings):       Maks 25 (Aktif/gerçekleşen buluşma: 25)
 *  - Aşk Mektupları (Letters):    Maks 25 (Her iki taraf: 25 / Tek taraf: 15)
 *  - Fotoğraf Arşivi (Photos):    Maks 15 (Sadece Premium çiftlerde paydaya eklenir)
 *  - İlaç Takibi (Medicine):      Maks 15 (Sadece ilaç kullanan çiftlerde paydaya eklenir)
 *  - Regl Takibi (Period):        Maks 10 (Sadece regl takibi kullanan çiftlerde paydaya eklenir)
 */
export async function computeLoveScore(
  coupleId: number,
  userId?: string | null,
  partnerId?: string | null,
  isPremium?: boolean
): Promise<LoveScoreResult> {
  const today = todayString();
  const sevenDaysAgo = dayjs().subtract(7, "day").format("YYYY-MM-DD");
  const thirtyDaysAgo = dayjs().subtract(30, "day").toISOString();
  const sixtyDaysAgo = dayjs().subtract(60, "day").format("YYYY-MM-DD");
  const thisMonthStart = dayjs().startOf("month").format("YYYY-MM-DD");

  const breakdown: Record<string, number> = {};

  try {
    // ── 0. Çiftin her iki kullanıcısını tespit et ───────────────────────────────
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

    // ── 1. Paralel Veritabanı Sorguları ─────────────────────────────────────────
    const [
      coupleRes,
      meetingsRes,
      lettersRes,
      medicinesRes,
      periodLogsRes,
      todayNotesRes,
      calNotesRes,
      moodLogsRes,
      recentPhotosRes,
    ] = await Promise.all([
      // Çiftin Premium Durumu (Parametre olarak gelmediyse DB'den teyit et)
      isPremium !== undefined
        ? Promise.resolve({ data: { is_premium: isPremium, premium_expires_at: null }, error: null })
        : supabase
            .from("couples")
            .select("is_premium, premium_expires_at")
            .eq("id", coupleId)
            .maybeSingle(),

      // Buluşmalar (Son 30 günde veya gelecekte planlanmış aktif buluşmalar)
      supabase
        .from("meetings")
        .select("id, meeting_datetime")
        .eq("couple_id", coupleId)
        .eq("is_active", true)
        .gte("meeting_datetime", thirtyDaysAgo),

      // Aşk Mektupları (Son 30 günde)
      supabase
        .from("letters")
        .select("id, sender_id")
        .eq("couple_id", coupleId)
        .gte("created_at", thirtyDaysAgo),

      // Aktif İlaçlar
      supabase
        .from("medicines")
        .select("id")
        .eq("couple_id", coupleId)
        .eq("is_active", true),

      // Regl Döngüsü (Son 60 gün)
      userIds.length > 0
        ? supabase
            .from("period_logs")
            .select("id, date")
            .in("user_id", userIds)
            .gte("date", sixtyDaysAgo)
        : Promise.resolve({ data: [] as any[], error: null }),

      // Günlük Notlar (Bugün)
      userIds.length > 0
        ? supabase
            .from("daily_notes")
            .select("id, user_id")
            .in("user_id", userIds)
            .eq("date", today)
        : Promise.resolve({ data: [] as any[], error: null }),

      // Takvim Notları (Son 7 gün)
      userIds.length > 0
        ? supabase
            .from("calendar_notes")
            .select("id, user_id")
            .in("user_id", userIds)
            .gte("date", sevenDaysAgo)
        : Promise.resolve({ data: [] as any[], error: null }),

      // Mood seçimi (Bugün)
      userIds.length > 0
        ? supabase
            .from("moods")
            .select("id, user_id")
            .in("user_id", userIds)
            .eq("date", today)
        : Promise.resolve({ data: [] as any[], error: null }),

      // Fotoğraf Arşivi (Son 30 günde)
      supabase
        .from("photo_archive")
        .select("id, created_at")
        .eq("couple_id", coupleId)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // Premium durumunu çift seviyesinde belirle
    const coupleData = coupleRes?.data;
    const premiumExpiresAt = coupleData?.premium_expires_at;
    const isCouplePremium = Boolean(
      isPremium ?? (coupleData?.is_premium && (!premiumExpiresAt || new Date(premiumExpiresAt) > new Date()))
    );

    // ── 2. Özellik Bazlı Dinamik Ağırlıklandırma Sistemi ─────────────────────
    let maxEarnablePoints = 0;
    let earnedPoints = 0;
    let penalty = 0;

    // ── 1. Ruh Hali / Mood (Bugün) ─── Maks: 15
    maxEarnablePoints += 15;
    const moodLogs = moodLogsRes.data ?? [];
    const moodUsers = new Set(moodLogs.map((m) => m.user_id));
    if (moodUsers.size >= 2) {
      earnedPoints += 15;
      breakdown["mood"] = 15;
    } else if (moodUsers.size === 1) {
      earnedPoints += 8;
      breakdown["mood"] = 8;
    } else {
      breakdown["mood"] = 0;
    }

    // ── 2. Günlük Notlar (Bugün) ─── Maks: 20
    maxEarnablePoints += 20;
    const todayNotes = todayNotesRes.data ?? [];
    const noteUsers = new Set(todayNotes.map((n) => n.user_id));
    if (noteUsers.size >= 2) {
      earnedPoints += 20;
      breakdown["daily_notes"] = 20;
    } else if (noteUsers.size === 1) {
      earnedPoints += 10;
      breakdown["daily_notes"] = 10;
    } else {
      breakdown["daily_notes"] = 0;
    }

    // ── 3. Takvim Notları (Son 7 gün) ─── Maks: 15
    maxEarnablePoints += 15;
    const calNotes = calNotesRes.data ?? [];
    const calUsers = new Set(calNotes.map((c) => c.user_id));
    if (calUsers.size >= 2) {
      earnedPoints += 15;
      breakdown["calendar_notes"] = 15;
    } else if (calUsers.size === 1) {
      earnedPoints += 8;
      breakdown["calendar_notes"] = 8;
    } else {
      breakdown["calendar_notes"] = 0;
    }

    // ── 4. Buluşmalar (Son 30 Gün veya Yaklaşan Buluşma) ─── Maks: 25
    maxEarnablePoints += 25;
    const meetings = meetingsRes.data ?? [];
    if (meetings.length > 0) {
      earnedPoints += 25;
      breakdown["meetings"] = 25;
    } else {
      breakdown["meetings"] = 0;
    }

    // ── 5. Aşk Mektupları (Son 30 Gün) ─── Maks: 25
    maxEarnablePoints += 25;
    const letters = lettersRes.data ?? [];
    if (letters.length > 0) {
      const senders = new Set(letters.map((l) => l.sender_id));
      if (senders.size >= 2) {
        earnedPoints += 25;
        breakdown["letters"] = 25;
      } else {
        earnedPoints += 15;
        breakdown["letters"] = 15;
      }
    } else {
      breakdown["letters"] = 0;
    }

    // ── 6. Fotoğraf Arşivi (Sadece Premium Çiftlerde Paydaya Eklenir) ─── Maks: 15
    // Ücretsiz kullanıcıların puanını ASLA düşürmez!
    if (isCouplePremium) {
      maxEarnablePoints += 15;
      const recentPhotos = recentPhotosRes.data ?? [];
      const hasRecent7d = recentPhotos.some((p) => p.created_at >= dayjs().subtract(7, "day").toISOString());
      if (hasRecent7d) {
        earnedPoints += 15;
        breakdown["photos"] = 15;
      } else if (recentPhotos.length > 0) {
        earnedPoints += 8;
        breakdown["photos"] = 8;
      } else {
        breakdown["photos"] = 0;
      }
    }

    // ── 7. İlaç Takibi (Sadece aktif ilacı olan çiftlerde paydaya eklenir) ─── Maks: 15
    // İlaç kullanmayan çiftler dezavantaj yaşamaz!
    const coupleMedicines = medicinesRes.data ?? [];
    if (coupleMedicines.length > 0) {
      maxEarnablePoints += 15;
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
        earnedPoints += 15;
        breakdown["medicine"] = 15;
      } else if (takenCount > 0 && skippedCount > 0) {
        earnedPoints += 8;
        penalty += 10;
        breakdown["medicine"] = 8;
      } else if (skippedCount > 0) {
        penalty += 15;
        breakdown["medicine"] = -15;
      } else {
        breakdown["medicine"] = 0;
      }
    }

    // ── 8. Regl Takibi (Sadece bu özelliği kullanan çiftlerde paydaya eklenir) ─── Maks: 10
    const periodLogs = periodLogsRes.data ?? [];
    if (periodLogs.length > 0) {
      maxEarnablePoints += 10;
      const thisMonthLogs = periodLogs.filter((p) => p.date >= thisMonthStart);
      if (thisMonthLogs.length > 0) {
        earnedPoints += 10;
        breakdown["period"] = 10;
      } else {
        earnedPoints += 5;
        breakdown["period"] = 5;
      }
    }

    // ── 3. Oransal Skor Hesaplama ─────────────────────────────────────────────
    // Taban Puan: 50 (İlişkinin temel sevgi ve bağlılık tabanı)
    // Aktif Kullanım: +50 puana kadar (Erişilebilir özellikler arasındaki başarı oranına göre)
    const performanceRatio =
      maxEarnablePoints > 0 ? Math.min(1, Math.max(0, earnedPoints / maxEarnablePoints)) : 0;
    const bonusScore = Math.round(performanceRatio * 50);
    const calculatedScore = 50 + bonusScore - penalty;

    // 15 - 100 arasına sınırla
    const clampedScore = Math.min(100, Math.max(15, calculatedScore));

    breakdown["isPremium"] = isCouplePremium ? 1 : 0;
    breakdown["maxEarnablePoints"] = maxEarnablePoints;
    breakdown["earnedPoints"] = earnedPoints;
    breakdown["performanceRatio"] = Math.round(performanceRatio * 100);

    const result: LoveScoreResult = {
      score: clampedScore,
      subtitle: getSubtitle(clampedScore),
      breakdown,
    };

    // Sonucu yerel önbelleğe kaydet (açılışta beklemesiz anında yükleme için)
    setCachedLoveScore(coupleId, result).catch(() => {});

    return result;
  } catch {
    // Hata durumunda güvenli taban puan
    return {
      score: 50,
      subtitle: getSubtitle(50),
      breakdown: { fallback: 1 },
    };
  }
}

function getSubtitle(score: number): string {
  if (score >= 90) return "Kusursuz bir bağ! Aşkınız zirvede 🔥";
  if (score >= 75) return "Harika bir uyum! Birbirinizi hiç ihmal etmiyorsunuz 💖";
  if (score >= 50) return "Güzel bir gün! Birbirinize küçük bir not bırakabilirsiniz 💌";
  return "Bugün biraz ilgi zamanı! Bir anı paylaşmaya ne dersiniz? 🌸";
}
