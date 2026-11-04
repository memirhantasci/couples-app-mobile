import { supabase } from "@/lib/supabase";
import { todayString, dayjs } from "@/lib/date";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import type { TFunction } from "i18next";

/** Aşk Skoru: 15 (min) – 100 (max) arasında sınırlandırılmış sonuç */
export interface LoveScoreResult {
  score: number;
  breakdown: Record<string, number>; // analiz ve denetim için
}

const inMemoryScoreCache: Record<number, LoveScoreResult> = {};

/** Bellek içi senkron önbellek (açılışta initialData olarak sıfır gecikmeyle döner) */
export function getCachedLoveScoreSync(coupleId: number): LoveScoreResult | null {
  return inMemoryScoreCache[coupleId] || null;
}

/** Yerel önbellekten son aşk puanını oku (açılışta 50 flash'ını engellemek için) */
export async function getCachedLoveScore(coupleId: number): Promise<LoveScoreResult | null> {
  if (inMemoryScoreCache[coupleId]) return inMemoryScoreCache[coupleId];
  try {
    const raw = await AsyncStorage.getItem(`@love_score_${coupleId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      inMemoryScoreCache[coupleId] = parsed;
      return parsed;
    }
  } catch {}
  return null;
}

/** Yerel önbelleğe son aşk puanını kaydet */
export async function setCachedLoveScore(coupleId: number, data: LoveScoreResult): Promise<void> {
  inMemoryScoreCache[coupleId] = data;
  try {
    await AsyncStorage.setItem(`@love_score_${coupleId}`, JSON.stringify(data));
  } catch {}
}

/** Aşk skorunun beslendiği aktivite özeti (sayılar; içerik değil). */
interface CoupleActivity {
  moodAuthors: number;
  dailyAuthors: number;
  calendarAuthors: number;
  completedMeetings: number;
  letterSenders: number;
  photoRecent7d: boolean;
  photoAny30d: boolean;
}

/**
 * Sunucudaki puan günlüğünden okur (get_couple_love_activity). Günlük silinen, geçmiş güne yazılan ya da
 * sahte kayıtlardan etkilenmez: ekle-sil-ekle, geçmişe not ve uydurma buluşma skoru oynatamaz.
 * Fonksiyon henüz veritabanında yoksa (migration uygulanmadıysa) null döner ve eski yönteme düşülür.
 */
async function fetchActivityFromServerLog(): Promise<CoupleActivity | null> {
  const { data, error } = await supabase.rpc("get_couple_love_activity");
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, number> | null;
  return {
    moodAuthors: Number(row?.mood_authors_today ?? 0),
    dailyAuthors: Number(row?.daily_authors_today ?? 0),
    calendarAuthors: Number(row?.calendar_authors_recent ?? 0),
    completedMeetings: Number(row?.completed_meetings_recent ?? 0),
    letterSenders: Number(row?.letter_senders_recent ?? 0),
    photoRecent7d: Number(row?.photo_recent_7d ?? 0) > 0,
    photoAny30d: Number(row?.photo_recent_30d ?? 0) > 0,
  };
}

/** Eski yöntem (yalnızca sunucu fonksiyonu yoksa): canlı satırlardan sayar; manipülasyona açıktır. */
async function fetchActivityFromLiveRows(
  coupleId: number,
  userIds: string[],
  today: string,
  sevenDaysAgo: string,
  thirtyDaysAgo: string
): Promise<CoupleActivity> {
  const [meetingsRes, lettersRes, noteActivityRes, moodLogsRes, recentPhotosRes] = await Promise.all([
    supabase
      .from("meetings")
      .select("id")
      .eq("couple_id", coupleId)
      .eq("is_active", true)
      .lte("meeting_datetime", new Date().toISOString())
      .gte("meeting_datetime", thirtyDaysAgo),
    supabase.from("letters").select("id, sender_id").eq("couple_id", coupleId).gte("created_at", thirtyDaysAgo),
    supabase.rpc("get_couple_note_activity", { p_today: today, p_since: sevenDaysAgo }),
    userIds.length > 0
      ? supabase.from("moods").select("id, user_id").in("user_id", userIds).eq("date", today)
      : Promise.resolve({ data: [] as any[], error: null }),
    supabase
      .from("photo_archive")
      .select("id, created_at")
      .eq("couple_id", coupleId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const queryError =
    meetingsRes.error || lettersRes.error || noteActivityRes.error || moodLogsRes.error || recentPhotosRes.error;
  if (queryError) throw queryError;

  const noteActivity = Array.isArray(noteActivityRes.data) ? noteActivityRes.data[0] : noteActivityRes.data;
  const photos = recentPhotosRes.data ?? [];
  const sevenDaysAgoIso = dayjs().subtract(7, "day").toISOString();
  return {
    moodAuthors: new Set((moodLogsRes.data ?? []).map((m: any) => m.user_id)).size,
    dailyAuthors: Number(noteActivity?.daily_authors_today ?? 0),
    calendarAuthors: Number(noteActivity?.calendar_authors_recent ?? 0),
    completedMeetings: (meetingsRes.data ?? []).length,
    letterSenders: new Set((lettersRes.data ?? []).map((l: any) => l.sender_id)).size,
    photoRecent7d: photos.some((p: any) => p.created_at >= sevenDaysAgoIso),
    photoAny30d: photos.length > 0,
  };
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
      const { data: coupleUsers, error: coupleUsersError } = await supabase
        .from("users")
        .select("id")
        .eq("couple_id", coupleId);
      if (coupleUsersError) throw coupleUsersError;
      userIds = (coupleUsers ?? []).map((u) => u.id);
      if (userId && !userIds.includes(userId)) userIds.push(userId);
      if (partnerId && !userIds.includes(partnerId)) userIds.push(partnerId);
    }

    // ── 1. Paralel Veritabanı Sorguları ─────────────────────────────────────────
    const [coupleRes, medicinesRes, periodLogsRes, activity] = await Promise.all([
      // Çiftin Premium Durumu (Parametre olarak gelmediyse DB'den teyit et)
      isPremium !== undefined
        ? Promise.resolve({ data: { is_premium: isPremium, premium_expires_at: null }, error: null })
        : supabase
            .from("couples")
            .select("is_premium, premium_expires_at")
            .eq("id", coupleId)
            .maybeSingle(),

      // Aktif İlaçlar
      supabase
        .from("medicines")
        .select("id")
        .eq("couple_id", coupleId)
        .eq("is_active", true),

      // Regl Döngüsü (Son 60 gün): yalnızca "kullanılıyor mu / bu ay kayıt var mı" bayrakları, sunucuda
      // hesaplanır. Satırlar okunsaydı ücretsiz erkek partner (RLS) bileşeni görmez, iki partner farklı skor görürdü.
      supabase.rpc("get_couple_period_activity", { p_since: sixtyDaysAgo, p_month_start: thisMonthStart }),

      // Ruh hali, günlük, takvim notu, buluşma, mektup ve fotoğraf: sunucudaki puan günlüğünden (yalnızca
      // sayılar). Günlükler kişisel olduğundan satırlar okunsaydı her partner yalnızca kendi notunu görür,
      // iki taraf farklı skor görürdü; günlük ayrıca silme / geçmişe kayıt / uydurma buluşma hilelerine kapalıdır.
      fetchActivityFromServerLog().then(
        (fromLog) => fromLog ?? fetchActivityFromLiveRows(coupleId, userIds, today, sevenDaysAgo, thirtyDaysAgo)
      ),
    ]);

    // Ağ hatasında Supabase fırlatmaz, { data: null, error } döner. Bu boş veriyle hesaplanan düşük
    // skor diskteki gerçek skorun üzerine yazılmasın: hata catch'e iletilir, önbellekteki skor kullanılır.
    const queryError =
      coupleRes.error || medicinesRes.error || periodLogsRes.error;
    if (queryError) throw queryError;

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
    if (activity.moodAuthors >= 2) {
      earnedPoints += 15;
      breakdown["mood"] = 15;
    } else if (activity.moodAuthors === 1) {
      earnedPoints += 8;
      breakdown["mood"] = 8;
    } else {
      breakdown["mood"] = 0;
    }

    // ── 2. Günlük Notlar (Bugün) ─── Maks: 20
    maxEarnablePoints += 20;
    if (activity.dailyAuthors >= 2) {
      earnedPoints += 20;
      breakdown["daily_notes"] = 20;
    } else if (activity.dailyAuthors === 1) {
      earnedPoints += 10;
      breakdown["daily_notes"] = 10;
    } else {
      breakdown["daily_notes"] = 0;
    }

    // ── 3. Takvim Notları (Son 7 gün; yalnızca bugün ya da ileri bir güne yazılanlar puan getirir) ─── Maks: 15
    maxEarnablePoints += 15;
    if (activity.calendarAuthors >= 2) {
      earnedPoints += 15;
      breakdown["calendar_notes"] = 15;
    } else if (activity.calendarAuthors === 1) {
      earnedPoints += 8;
      breakdown["calendar_notes"] = 8;
    } else {
      breakdown["calendar_notes"] = 0;
    }

    // ── 4. Buluşmalar (Son 30 günde GERÇEKLEŞEN, önceden planlanmış buluşma) ─── Maks: 25
    // Yaklaşan buluşma puan getirmez: yoksa uydurma bir buluşma ekleyip silerek skor oynatılabilirdi.
    maxEarnablePoints += 25;
    if (activity.completedMeetings > 0) {
      earnedPoints += 25;
      breakdown["meetings"] = 25;
    } else {
      breakdown["meetings"] = 0;
    }

    // ── 5. Aşk Mektupları (Son 30 Gün) ─── Maks: 25
    maxEarnablePoints += 25;
    if (activity.letterSenders > 0) {
      if (activity.letterSenders >= 2) {
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
      if (activity.photoRecent7d) {
        earnedPoints += 15;
        breakdown["photos"] = 15;
      } else if (activity.photoAny30d) {
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
      const { data: todayLogs, error: medicineLogsError } = await supabase
        .from("medicine_logs")
        .select("medicine_id, status")
        .eq("couple_id", coupleId)
        .eq("date", today)
        .in("medicine_id", medicineIds);
      if (medicineLogsError) throw medicineLogsError;

      const takenCount = (todayLogs ?? []).filter((l) => l.status === "DRANK").length;
      const skippedCount = (todayLogs ?? []).filter((l) => l.status === "MISSED").length;

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
    const periodActivity = Array.isArray(periodLogsRes.data) ? periodLogsRes.data[0] : periodLogsRes.data;
    if (periodActivity?.has_recent) {
      maxEarnablePoints += 10;
      if (periodActivity.has_this_month) {
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
      breakdown,
    };

    // Sonucu yerel önbelleğe kaydet (açılışta beklemesiz anında yükleme için)
    setCachedLoveScore(coupleId, result).catch(() => {});

    return result;
  } catch {
    // Hata (ör. çevrimdışı): bilinen son skor gösterilir; o da yoksa güvenli taban puan
    const cached = await getCachedLoveScore(coupleId);
    if (cached) return cached;
    return {
      score: 50,
      breakdown: { fallback: 1 },
    };
  }
}

/**
 * Skora göre alt başlık. Metin önbelleğe yazılmaz, ekranda `t` ile üretilir:
 * böylece önbellekteki skor dil değişse de güncel dilde görünür.
 */
export function getLoveScoreSubtitle(score: number, t: TFunction): string {
  if (score >= 90) return t("home.loveMeter.subtitle.excellent");
  if (score >= 75) return t("home.loveMeter.subtitle.great");
  if (score >= 50) return t("home.loveMeter.subtitle.good");
  return t("home.loveMeter.subtitle.low");
}
