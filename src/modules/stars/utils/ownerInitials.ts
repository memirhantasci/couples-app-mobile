/**
 * @file ownerInitials.ts
 * @module modules/stars/utils
 * @description Bir yıldızı tescillerken, çiftin iki üyesinin baş harflerini
 * (ör. "A 💕 M") hesaplar.
 *
 * `users.display_name` / `users.username` istemci tarafında AES ile
 * şifrelenir (bkz. src/utils/crypto.ts) ve veritabanı bu alanları çözemez.
 * Bu yüzden baş harfler yalnızca KENDİ çiftinin satırlarını okuyabilen
 * istemci tarafından hesaplanır (aynı desen: src/app/(tabs)/home.tsx), tam
 * isim değil yalnızca 1 harf gönderilir — diğer çiftlere karşı mahremiyet
 * korunur.
 */

import { supabase } from '@/lib/supabase';
import { decrypt, deterministicDecrypt } from '@/utils/crypto';

interface CoupleUserRow {
  readonly id: string;
  readonly username: string | null;
  readonly display_name: string | null;
  readonly created_at: string | null;
}

function initialOf(name: string | null | undefined): string | null {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  return trimmed.charAt(0).toLocaleUpperCase('tr-TR');
}

/**
 * Çiftin iki üyesinin baş harflerini "A 💕 M" biçiminde döndürür.
 * RLS yalnızca kendi çiftinizin kullanıcı satırlarını okumanıza izin verir.
 * Herhangi bir sebeple hesaplanamazsa `null` döner (tescil işlemi engellenmez).
 */
export async function computeOwnCoupleInitials(coupleId: number): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, created_at')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) return null;

    const initials = (data as CoupleUserRow[])
      .map((row) => {
        const name = row.display_name
          ? decrypt(row.display_name)
          : row.username
          ? deterministicDecrypt(row.username)
          : null;
        return initialOf(name);
      })
      .filter((value): value is string => Boolean(value));

    if (initials.length === 0) return null;
    return initials.join(' 💕 ');
  } catch {
    return null;
  }
}
