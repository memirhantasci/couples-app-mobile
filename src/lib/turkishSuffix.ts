/**
 * Türkçe hal ekleri (tamlayan "-in", çıkma "-den") kullanıcı adlarına büyük ünlü uyumu ve ünlü/ünsüz sonuna
 * göre eklenir: Ayşe'nin, Burak'ın, Cem'in, Ali'nin; Ayşe'den, Burak'tan, Cem'den.
 * Aynı kural Edge Function'da (supabase/functions/send-push) satır içi kopyayla kullanılır; birini değiştirirken ikisini güncelle.
 */

const VOWELS = "aeıioöuüâîû";
const HARD_CONSONANTS = "çfhkpsşt";

/** İ → i, I → ı kuralıyla küçültür (cihaz yerel ayarına bağlı kalmaz). */
function lowerTr(text: string): string {
  return text.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
}

export type TurkishCase = "genitive" | "ablative";

/** Apostrofla başlayan eki döndürür ("'nin", "'dan"); addan harf bulunamazsa boş metin. */
export function turkishSuffix(name: string, grammaticalCase: TurkishCase): string {
  const letters = lowerTr(name).replace(/[^a-zçğıöşüâîû]/g, "");
  if (!letters) return "";

  const last = letters[letters.length - 1];
  const endsWithVowel = VOWELS.includes(last);
  const lastVowel = [...letters].reverse().find((ch) => VOWELS.includes(ch)) ?? "e";

  if (grammaticalCase === "genitive") {
    const vowel = "aıâ".includes(lastVowel) ? "ı" : "ei".includes(lastVowel) || lastVowel === "î" ? "i" : "ou".includes(lastVowel) || lastVowel === "û" ? "u" : "ü";
    return `'${endsWithVowel ? "n" : ""}${vowel}n`;
  }

  const back = "aıouâîû".includes(lastVowel) && lastVowel !== "î";
  const consonant = !endsWithVowel && HARD_CONSONANTS.includes(last) ? "t" : "d";
  return `'${consonant}${back ? "a" : "e"}n`;
}

/** "Ayşe" → "Ayşe'nin" */
export function withGenitive(name: string): string {
  return `${name}${turkishSuffix(name, "genitive")}`;
}

/** "Burak" → "Burak'tan" */
export function withAblative(name: string): string {
  return `${name}${turkishSuffix(name, "ablative")}`;
}
