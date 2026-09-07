/**
 * @file nameModeration.ts
 * @module modules/stars/utils
 * @description Yıldız isimleri için client-side içerik moderasyonu.
 * Server-side (PostgreSQL) `contains_blocked_word` ile aynı mantıkta çalışır, 
 * ancak API çağrısı yapmadan önce kullanıcıyı uyarmak için ilk katmandır.
 */

// Kaba kelimeler listesi (Basit liste, regex word boundary mantığı ile aranacak)
const BLOCKED_WORDS = [
  'amk', 'aq', 'sik', 'sok', 'oç', 'yarak', 'yarrak', 'piç', 'ibne', 'orospu', 'gavat',
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'pussy', 'whore', 'slut', 'fag'
];

/**
 * Verilen yıldız isminin yasaklı kelimeler içerip içermediğini kontrol eder.
 * @param name Kullanıcının girdiği yıldız ismi
 * @returns { isValid: boolean; message?: string }
 */
export function moderateStarName(name: string): { isValid: boolean; message?: string } {
  if (!name) {
    return { isValid: false, message: 'İsim boş olamaz.' };
  }

  const normalized = name.toLowerCase().trim();

  for (const word of BLOCKED_WORDS) {
    // JavaScript RegExp word boundary (\b) kullanarak eşleşme
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(normalized)) {
      return { 
        isValid: false, 
        message: 'Girdiğiniz isim topluluk kurallarına aykırı kelimeler içeriyor. Lütfen farklı bir isim seçin.' 
      };
    }
  }

  return { isValid: true };
}
