import { dayjs } from "@/lib/date";

// period_logs yalnızca reglin BAŞLADIĞI günü tutar; süreç ve sonraki döngü bundan hesaplanır.
// DB trigger'ı (check_period_log_rules) aynı sabitleri uygular — değiştirirken ikisini birlikte güncelle.
export const PERIOD_DURATION_DAYS = 5;
export const DEFAULT_CYCLE_LENGTH = 28;
export const MIN_DAYS_BETWEEN_STARTS = 16;
export const MAX_STARTS_PER_MONTH = 2;

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

/** Başlangıç gününden itibaren süreç boyunca (başlangıç dahil) YYYY-MM-DD günleri */
export function getPeriodDays(startStr: string): string[] {
  const start = dayjs(startStr);
  return Array.from({ length: PERIOD_DURATION_DAYS }, (_, i) => start.add(i, "day").format("YYYY-MM-DD"));
}
