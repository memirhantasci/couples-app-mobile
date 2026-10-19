import { dayjs } from "@/lib/date";

// period_logs yalnızca reglin BAŞLADIĞI günü tutar; süreç ve sonraki döngü bundan hesaplanır.
// DB trigger'ı (check_period_log_rules) aynı sabitleri uygular — değiştirirken ikisini birlikte güncelle.
export const PERIOD_DURATION_DAYS = 5;
export const DEFAULT_CYCLE_LENGTH = 28;
export const MIN_DAYS_BETWEEN_STARTS = 16;
export const MAX_STARTS_PER_MONTH = 2;

// Tıbbi olarak tipik döngü 21–35 gün arasındadır (ortalama 28). Bu aralığın dışındaki aralıklar
// çoğunlukla atlanmış ya da yanlış girilmiş bir kayıttan gelir; tahmini bozmasın diye hesaba katılmaz.
export const MIN_CYCLE_LENGTH = 21;
export const MAX_CYCLE_LENGTH = 35;
// Döngü zamanla değişebildiği için yalnızca en güncel aralıklara bakılır.
const CYCLE_HISTORY_WINDOW = 6;
// Beklenen başlangıçtan bu kadar gün geçtiyse büyük olasılıkla yeni başlangıç işaretlenmemiştir;
// "N gün gecikti" yerine nötr bir bekleme mesajı gösterilir.
export const MAX_REASONABLE_DELAY_DAYS = 14;

/**
 * Tarih listesinden regl başlangıç günlerini (eskiden → yeniye) çıkarır.
 * Eski sürümde ardışık günler tek tek kaydedildiği için, bir öncekinden
 * MIN_DAYS_BETWEEN_STARTS günden yakın kayıtlar aynı reglin parçası sayılır ve ilk günü başlangıç alınır.
 * Birden fazla kullanıcının kaydı varsa her kullanıcı için ayrı çağrılmalıdır.
 */
export function getPeriodStarts(dates: string[]): string[] {
  const starts: string[] = [];
  [...dates].sort().forEach((date) => {
    const last = starts[starts.length - 1];
    if (!last || dayjs(date).diff(dayjs(last), "day") >= MIN_DAYS_BETWEEN_STARTS) {
      starts.push(date);
    }
  });
  return starts;
}

/**
 * Regl başlangıçlarından (eskiden → yeniye) tahmini döngü uzunluğu.
 * Son aralıklardan yalnızca 21–35 gün arasında olanların ortalaması alınır; uygun aralık yoksa
 * (tek kayıt, ya da 40 gün gibi atlanmış kayıttan doğan aralıklar) standart 28 gün baz alınır.
 */
export function estimateCycleLength(starts: string[]): number {
  const gaps: number[] = [];
  for (let i = Math.max(1, starts.length - CYCLE_HISTORY_WINDOW); i < starts.length; i++) {
    const gap = dayjs(starts[i]).diff(dayjs(starts[i - 1]), "day");
    if (gap >= MIN_CYCLE_LENGTH && gap <= MAX_CYCLE_LENGTH) gaps.push(gap);
  }
  if (gaps.length === 0) return DEFAULT_CYCLE_LENGTH;
  return Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
}

/** Başlangıç gününden itibaren süreç boyunca (başlangıç dahil) YYYY-MM-DD günleri */
export function getPeriodDays(startStr: string): string[] {
  const start = dayjs(startStr);
  return Array.from({ length: PERIOD_DURATION_DAYS }, (_, i) => start.add(i, "day").format("YYYY-MM-DD"));
}
