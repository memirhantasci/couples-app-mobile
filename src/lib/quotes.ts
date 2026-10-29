// Romantic quotes — one per day. The list lives in the locale files (`quotes.daily`),
// so every language shows the same quote on the same day (lists must keep the same length).
import type { TFunction } from 'i18next';

/**
 * Returns the quote for a given day-of-year index, in the language `t` is bound to
 */
export function getQuoteForDay(dayOfYear: number, t: TFunction): string {
  const quotes = t('quotes.daily', { returnObjects: true }) as string[];
  return quotes[(dayOfYear - 1) % quotes.length];
}
