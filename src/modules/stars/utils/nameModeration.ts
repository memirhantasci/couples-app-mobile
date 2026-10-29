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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Verilen yıldız isminin yasaklı kelimeler içerip içermediğini kontrol eder.
 * Türkçe karakter duyarlı sınır eşleme (Turkish-aware boundary regex) kullanır.
 * @param name Kullanıcının girdiği yıldız ismi
 * @returns { isValid: boolean; message?: string }
 */
export function moderateStarName(name: string): { isValid: boolean; message?: string } {
  if (!name) {
    return { isValid: false, message: 'İsim boş olamaz.' };
  }

  const normalized = name.toLocaleLowerCase('tr-TR').trim();

  for (const word of BLOCKED_WORDS) {
    const escaped = escapeRegex(word.toLocaleLowerCase('tr-TR'));
    // Standart \b Türkçe karakterleri (ç, ğ, ı, ö, ş, ü) word character saymadığı için özel sınır kullanıyoruz
    const regex = new RegExp(`(?:^|[^a-z0-9çğıöşü])${escaped}(?:$|[^a-z0-9çğıöşü])`, 'iu');
    if (regex.test(normalized)) {
      return { 
        isValid: false, 
        message: 'Girdiğiniz isim topluluk kurallarına aykırı kelimeler içeriyor. Lütfen farklı bir isim seçin.' 
      };
    }
  }

  return { isValid: true };
}
