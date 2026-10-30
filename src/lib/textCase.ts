import i18n from "@/lib/i18n";

/**
 * Büyük/küçük harf dönüşümü uygulama diline göre yapılır: Türkçede i → İ ve ı → I,
 * diğer dillerde i → I. (Sabit "tr-TR" kullanmak İngilizce adlarda "İ" üretirdi.)
 */
export function caseLocale(language: string = i18n.language): string {
  return language === "tr" ? "tr-TR" : "en-US";
}

/** Metnin ilk harfini büyük döndürür (avatar ve yıldız sahibi baş harfleri için) */
export function upperInitial(text: string, language?: string): string {
  return text.charAt(0).toLocaleUpperCase(caseLocale(language));
}
