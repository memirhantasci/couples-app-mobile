import { supabase } from "@/lib/supabase";

export interface JoinCoupleResult {
  readonly isPaired: boolean;
}

/**
 * Eşleşme koduyla çifte katılır. Sunucu, kod tahmini belirtisi olan sonuçları (geçersiz / dolu kod, deneme
 * sınırı) hata yerine `result_error` ile döndürür; hata fırlatılsaydı deneme sayacı da geri alınırdı
 * (bkz. migration 20261030000001). Burada bunlar eski davranışla aynı biçimde `error.message` olarak sunulur.
 */
export async function joinCoupleByCode(
  code: string
): Promise<{ data: JoinCoupleResult | null; error: { message: string } | null }> {
  const { data, error } = await supabase.rpc("join_couple_by_code_uuid", { p_code: code });
  if (error) return { data: null, error };

  const row = Array.isArray(data) ? data[0] : data;
  if (row?.result_error) return { data: null, error: { message: row.result_error } };
  return { data: { isPaired: !!row?.result_is_paired }, error: null };
}
