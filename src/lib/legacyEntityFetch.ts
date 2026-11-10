import { decodeLegacyEntities, hasLegacyEntities } from "@/utils/sanitize";

/**
 * Supabase istemcisinin fetch'ini saran okuma katmanı: PostgREST (tablo ve RPC) yanıtlarındaki, eski sürümlerin
 * sanitizeStrict ile yazdığı HTML varlıklarını ("Ali&#x27;s") ekrana ulaşmadan çözer.
 *
 * Neden burada: etkilenen sütunlar (buluşma başlığı/yeri, anı/fotoğraf/mektup başlığı, ilaç adı, görünen isim)
 * otuzu aşkın ekran, kanca ve yardımcıda okunuyor; sunucu da görünen isimden etiketler türetip farklı anahtarlarla
 * döndürüyor (yıldız sahibi etiketi, davet etiketi). Ekran ekran çözmek bir yeri unutmaya açıktı. Düzenleme
 * formları da aynı veriden dolduğu için düzenlenip kaydedilen kayıt kodlanmadan geri yazılır.
 *
 * Kapsam: yalnızca /rest/v1/ altındaki, başarılı, JSON gövdeli yanıtlar. Gövdede varlık yoksa (neredeyse her
 * yanıt) yanıt nesnesine hiç dokunulmaz. Realtime yükleri buradan geçmez; uygulama onları yalnızca yeniden çekme
 * tetikleyicisi olarak kullanıyor (AuthContext), veri yine buradan gelir.
 */

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url ?? "";
}

function decodeDeep(value: unknown): unknown {
  if (typeof value === "string") return decodeLegacyEntities(value);
  if (Array.isArray(value)) return value.map(decodeDeep);
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) result[key] = decodeDeep(entry);
    return result;
  }
  return value;
}

export function withLegacyEntityDecoding(baseFetch: FetchLike): FetchLike {
  return async (input, init) => {
    const response = await baseFetch(input, init);

    if (!urlOf(input).includes("/rest/v1/")) return response;
    if (!response.ok || response.status === 204) return response;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return response;

    let text: string;
    try {
      text = await response.clone().text();
    } catch {
      return response;
    }
    if (!hasLegacyEntities(text)) return response;

    let decoded: string;
    try {
      decoded = JSON.stringify(decodeDeep(JSON.parse(text)));
    } catch {
      return response;
    }

    const headers = new Headers(response.headers);
    // Gövde değişti: eski uzunluk/sıkıştırma bilgisi artık doğru değil
    headers.delete("content-length");
    headers.delete("content-encoding");
    return new Response(decoded, { status: response.status, statusText: response.statusText, headers });
  };
}
