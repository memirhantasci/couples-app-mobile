/**
 * Profil ve İlişki Bilgileri Değişiklik Kısıtlamaları (Cooldown) Yardımcısı
 * 
 * Kurallar:
 * - Görünen İsim: 30 günde 1 (Kişi bazlı)
 * - Cinsiyet: 90 günde 1 (Kişi bazlı)
 * - İlişki Tarihleri: 30 günde 1 (Çift/İlişki bazlı - partnerlerden biri değiştirirse ikisi için kilitlenir)
 * 
 * İlk Hak Kuralı:
 * Kurulum aşamasında (onboarding) yanlış yazılmış olabileceği için kullanıcılara ve çifte
 * kurulumdan sonra beklemeden kullanabilecekleri 1 anında düzeltme hakkı hazır verilir.
 * Bu hak kullanıldığında ilgili cooldown sayacı başlar.
 */

export interface CooldownStatus {
  /** Kullanıcı şu an değişiklik yapabilir mi? */
  canChange: boolean;
  /** Bu değişiklik kullanıcının kurulum sonrası tanımlı ilk ücretsiz hakkı mı? */
  isInitialFreeRight: boolean;
  /** Kilitliyse bir sonraki değişikliğe kaç gün kaldı? (1...N) */
  remainingDays: number;
  /** Bir sonraki değişikliğin yapılabileceği net tarih */
  nextAllowedDate: Date | null;
}

export function getCooldownStatus(
  lastChangedAt: string | null | undefined,
  cooldownDays: number
): CooldownStatus {
  // Henüz hiç değişiklik yapılmamışsa (null/boş) ilk hak hazır
  if (!lastChangedAt) {
    return {
      canChange: true,
      isInitialFreeRight: true,
      remainingDays: 0,
      nextAllowedDate: null,
    };
  }

  const lastDateMs = new Date(lastChangedAt).getTime();
  if (isNaN(lastDateMs)) {
    return {
      canChange: true,
      isInitialFreeRight: true,
      remainingDays: 0,
      nextAllowedDate: null,
    };
  }

  const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
  const nextDate = new Date(lastDateMs + cooldownMs);
  const now = Date.now();
  const diffMs = nextDate.getTime() - now;

  // Süre dolmuşsa tekrar değişiklik hakkı kazanılmıştır
  if (diffMs <= 0) {
    return {
      canChange: true,
      isInitialFreeRight: false,
      remainingDays: 0,
      nextAllowedDate: null,
    };
  }

  // Kalan gün sayısı (küsuratlar yukarı yuvarlanır)
  const remainingDays = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

  return {
    canChange: false,
    isInitialFreeRight: false,
    remainingDays,
    nextAllowedDate: nextDate,
  };
}
