/**
 * @file starService.ts
 * @module modules/stars/api
 * @description "Bizim Yıldızımız" (Our Star) Modülü Supabase API Servis Katmanı
 *
 * Bu servis:
 * 1. 0°/360° meridyen sarmalı PostGIS viewport sorgularını (LOD bazlı) çalıştırır.
 * 2. Katı tip güvenliğiyle (coupleId: number) yıldız tescil ve detay fonksiyonlarını çağırır.
 * 3. Mikro-evren anı ötegezegenleri (star_exoplanets) CRUD işlemlerini yönetir.
 * 4. P0001 ve P0002 trigger kalkanı hatalarını ayrıştırıp SparkCooldownException üretir.
 * 5. İş kuralı ve yetki hatalarını atlayıp yalnızca geçici ağ hatalarında 3x exponential retry uygular.
 */

import { supabase } from '@/lib/supabase';
import type {
  ActiveStarConnection,
  ClaimRandomStarParams,
  ClaimSpecificStarParams,
  ClaimStarInSectorParams,
  CoupleStarDetails,
  CreateExoplanetDto,
  CreateExoplanetFromMediaParams,
  GetStarsViewportParams,
  PendingConnectionDetail,
  SectorDynamicOverview,
  SendStarSparkParams,
  SparkCooldownError,
  StarConnectionRecord,
  StarExoplanetRecord,
  StarSystemMapPlanet,
  StarSearchResult,
  CelestialSearchResult,
  ViewportStarItem,
} from '../types/star.types';

// ============================================================================
// 1. ÖZEL HATA SINIFLARI VE HATA AYRIŞTIRICILAR
// ============================================================================

/**
 * PostgreSQL P0001 (20h Daily Cooldown) veya P0002 (60s Love Ping Spam)
 * trigger kalkanı istisnası oluştuğunda fırlatılan tip güvenli hata sınıfı.
 */
export class SparkCooldownException extends Error implements SparkCooldownError {
  readonly code: 'COOLDOWN_ACTIVE' | 'SPAM_COOLDOWN';
  readonly remainingSeconds: number;

  constructor(code: 'COOLDOWN_ACTIVE' | 'SPAM_COOLDOWN', remainingSeconds: number, message: string) {
    super(message);
    this.name = 'SparkCooldownException';
    this.code = code;
    this.remainingSeconds = remainingSeconds;
    Object.setPrototypeOf(this, SparkCooldownException.prototype);
  }
}

/** Raised when the database rejects a premium-gated stars operation. */
export class PremiumRequiredError extends Error {
  readonly code = 'P0010' as const;

  constructor(message: string) {
    super(message);
    this.name = 'PremiumRequiredError';
    Object.setPrototypeOf(this, PremiumRequiredError.prototype);
  }
}

/**
 * PostgreSQL exception'ından (HINT veya mesaj metni) kalan saniyeyi ayrıştırır.
 */
function parseCooldownSeconds(error: any, defaultSec: number): number {
  if (error?.hint) {
    const parsed = parseInt(String(error.hint), 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  if (error?.message) {
    const match = String(error.message).match(/(\d+)\s*saniye/i);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  return defaultSec;
}

/**
 * Supabase/PostgreSQL hatalarını inceler; P0001/P0002 ise yapılandırılmış
 * SparkCooldownException üretir, aksi halde hatayı doğrudan fırlatır.
 */
function handleSupabaseError(error: any): never {
  if (error?.code === 'P0001') {
    const remaining = parseCooldownSeconds(error, 72000); // 20 saat varsayılan
    throw new SparkCooldownException(
      'COOLDOWN_ACTIVE',
      remaining,
      error.message || `Günlük kıvılcım hakkınız henüz yenilenmedi. Kalan süre: ${remaining} saniye.`,
    );
  }

  if (error?.code === 'P0002') {
    const remaining = parseCooldownSeconds(error, 60); // 60 saniye varsayılan
    throw new SparkCooldownException(
      'SPAM_COOLDOWN',
      remaining,
      error.message || `Lütfen peş peşe titreşim göndermeden önce ${remaining} saniye bekleyin.`,
    );
  }

  // P0004: Hedef yıldız race condition ile başkaca alındı
  if (error?.code === 'P0004') {
    throw new Error(
      error.message || 'Bu yıldız az önce başka bir çift tarafından seçildi, lütfen başka bir yıldız seçin.',
    );
  }

  // P0005: Bu çiftin zaten bir yıldızı var (frontend engelini atlatma / race)
  if (error?.code === 'P0005') {
    throw new Error(
      error.message || 'Zaten bir yıldızınız var — her çift yalnızca bir yıldıza sahip olabilir.',
    );
  }

  // P0006: İçerik moderasyonu ihlali
  if (error?.code === 'P0006') {
    throw new Error(
      error.message || 'Yıldız ismi topluluk kurallarına aykırı kelimeler içeremez.',
    );
  }

  // P0010 is also used by the older star-connection flow. Only turn the
  // entitlement variant into PremiumRequiredError.
  if (error?.code === 'P0010') {
    if (String(error.message || '').toLocaleLowerCase('tr-TR').includes('premium')) {
      throw new PremiumRequiredError(error.message || 'Bu işlem için aktif Premium üyelik gereklidir.');
    }
    throw new Error(
      error.message || 'Bağlantı kurabilmek için önce bir yıldız sahiplenmelisiniz.',
    );
  }

  // P0011: Maksimum 3 yıldız bağlantısı sınırı
  if (error?.code === 'P0011') {
    throw new Error(
      error.message || 'Maksimum 3 yıldız bağlantısı sınırına ulaşıldı.',
    );
  }

  // P0012: Zaten aktif veya bekleyen bağlantı var
  if (error?.code === 'P0012') {
    throw new Error(
      error.message || 'Bu yıldızla zaten aktif veya bekleyen bir bağlantı mevcut.',
    );
  }

  // P0014: İstek zaten yanıtlanmış
  if (error?.code === 'P0014') {
    throw new Error(
      error.message || 'Bu bağlantı isteği zaten yanıtlanmış.',
    );
  }

  throw error;
}

// ============================================================================
// 2. AKILLI RETRY MEKANİZMASI (Smart Exponential Backoff)
// ============================================================================

/**
 * Kesinlikle retry yapılmaması gereken PostgreSQL iş kuralı ve yetki kodları.
 */
const NON_RETRYABLE_CODES = new Set([
  'P0001', // Günlük kıvılcım 20h cooldown
  'P0002', // Love ping 60s anti-spam
  'P0003', // Uygun kriterde boşta yıldız kalmadı
  'P0004', // Hedef yıldız az önce başkaca tescillendi (race condition)
  'P0005', // Bu çiftin zaten bir yıldızı var
  'P0006', // Moderasyon ihlali
  'P0007', // Manuel gezegen limiti aşıldı (frontend koruması atlanırsa)
  'P0010', // Bağlantı için önce yıldız sahiplenilmeli
  'P0011', // Maksimum 3 bağlantı sınırı
  'P0012', // Zaten aktif veya bekleyen bağlantı var
  'P0014', // İstek zaten yanıtlanmış
  '42501', // Yetkisiz işlem / RLS engeli
  '22023', // Geçersiz parametre değeri
  '23505', // Unique constraint ihlali
  'PGRST116', // single() sorgusunda satır bulunamadı
]);

/**
 * Hatayı analiz ederek iş kuralı hatası olup olmadığını belirler.
 */
function isBusinessError(error: any): boolean {
  if (!error) return false;
  if (error instanceof SparkCooldownException) return true;
  if (error.code && NON_RETRYABLE_CODES.has(String(error.code))) return true;

  // 4xx istemci hataları (408 Request Timeout hariç) retry edilmez
  if (
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408
  ) {
    return true;
  }

  return false;
}

/**
 * Hatayı analiz ederek yeniden denenebilir geçici ağ hatası olup olmadığını belirler.
 */
function isNetworkError(error: any): boolean {
  if (!error || isBusinessError(error)) return false;

  const msg = (error.message || '').toLowerCase();
  const details = (error.details || '').toLowerCase();

  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('fetcherror') ||
    msg.includes('aborterror') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    details.includes('network') ||
    (typeof error.status === 'number' && error.status >= 500)
  );
}

/**
 * Geçici ağ hatalarında 3 defaya kadar üstel gecikmeyle (300ms, 600ms, 1200ms + jitter)
 * fonksiyonu yeniden dener. İş kuralı veya yetki hatalarında derhal fırlatır.
 * `signal` iptal edildiyse (ör. artık görünmeyen bir gökyüzü karosu) yeniden denemez.
 */
async function withSmartRetry<T>(fn: () => Promise<T>, maxRetries = 3, signal?: AbortSignal): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (signal?.aborted || attempt > maxRetries || !isNetworkError(error)) {
        throw error;
      }
      const baseDelay = 300 * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 100;
      await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
    }
  }
}

// ============================================================================
// 3. API SERVİS METODLARI
// ============================================================================

/**
 * Makro Gökyüzü Canvas'ının görüş alanındaki (viewport) yıldızları çeker.
 * 0°/360° meridyen geçişini ve zoom seviyesine göre dinamik LOD filtrelemesini
 * PostGIS veritabanı fonksiyonu (get_stars_in_viewport) üzerinden yürütür.
 */
export async function fetchStarsInViewport(
  params: GetStarsViewportParams,
  options: { readonly signal?: AbortSignal } = {},
): Promise<ViewportStarItem[]> {
  const { signal } = options;
  return withSmartRetry(async () => {
    const request = supabase.rpc('get_stars_in_viewport', {
      min_ra: params.minRa,
      max_ra: params.maxRa,
      min_dec: params.minDec,
      max_dec: params.maxDec,
      zoom_level: params.zoomLevel,
    });
    const { data, error } = await (signal ? request.abortSignal(signal) : request);

    if (error) {
      handleSupabaseError(error);
    }

    return (data ?? []) as ViewportStarItem[];
  }, 3, signal);
}

/**
 * Çift adına katalogdan rastgele uygun bir yıldızı atomik olarak tesciller.
 * pg_advisory_xact_lock ve FOR UPDATE SKIP LOCKED ile eşzamanlı çakışmaları sıfırlar.
 *
 * KRİTİK KURAL: coupleId INTEGER tipinde olmalıdır (couples.id int4 uyumu).
 */
export async function claimRandomStar(
  params: ClaimRandomStarParams,
): Promise<CoupleStarDetails> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('claim_random_available_star', {
      p_couple_id: params.coupleId,
      p_custom_name: params.customName.trim(),
      p_mag_max: params.maxMagnitude ?? 6.5,
    });

    if (error) {
      handleSupabaseError(error);
    }

    return data as CoupleStarDetails;
  });
}

/**
 * Kullanıcının MacroSkyCanvas üzerinde seçtiği belirli bir yıldızı atomik olarak tesciller.
 * FOR UPDATE kilidi ile race condition korunması sağlanır.
 * P0004: Yıldız az önce başkaca alındı.
 * P0005: Bu çiftin zaten bir yıldızı var.
 *
 * KRİTİK KURAL: coupleId INTEGER tipinde olmalıdır (couples.id int4 uyumu).
 */
export async function claimSpecificStar(
  params: ClaimSpecificStarParams,
): Promise<CoupleStarDetails> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('claim_specific_star', {
      p_couple_id: params.coupleId,
      p_star_catalog_id: params.starCatalogId,
      p_custom_name: params.customName.trim(),
    });

    if (error) {
      handleSupabaseError(error);
    }

    return data as CoupleStarDetails;
  });
}

/**
 * Kullanıcının kendi çiftine ait tescilli yıldızın tüm detaylarını,
 * canlı rezonans durumunu ve kıvılcım geri sayım bilgilerini çeker.
 *
 * KRİTİK KURAL: coupleId INTEGER tipinde olmalıdır (couples.id int4 uyumu).
 */
export async function getMyStarDetails(coupleId: number): Promise<CoupleStarDetails> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('get_my_couple_star_details', {
      p_couple_id: coupleId,
    });

    if (error) {
      handleSupabaseError(error);
    }

    return data as CoupleStarDetails;
  });
}

/**
 * Mikro sistem için yalnızca güvenli harita verisini getirir. Kilitli
 * gezegenlerde başlık, açıklama, medya ve mektup referansları dönmez.
 */
export async function getStarExoplanets(starId: string): Promise<StarSystemMapPlanet[]> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('get_star_system_map', {
      p_star_id: starId,
    });

    if (error) {
      handleSupabaseError(error);
    }

    return (data ?? []) as StarSystemMapPlanet[];
  });
}

function storagePathFromMediaReference(reference: string): string {
  if (!/^https?:\/\//i.test(reference)) return reference;
  const match = reference.match(/\/couple-memories\/([^?]+)/i);
  return match ? decodeURIComponent(match[1]) : reference;
}

/** Convert persisted private Storage paths to client-displayable signed URLs. */
async function hydrateMediaUrls(record: StarExoplanetRecord): Promise<StarExoplanetRecord> {
  const mediaUrls = await Promise.all(
    (record.media_urls ?? []).map(async (reference) => {
      const path = storagePathFromMediaReference(reference);
      // Legacy signed URLs are already consumable and cannot be re-signed if
      // their source path cannot be determined.
      if (/^https?:\/\//i.test(path)) return reference;
      const { data, error } = await supabase.storage
        .from('couple-memories')
        .createSignedUrl(path, 60 * 15);
      if (error || !data) throw error || new Error('Medya erişim bağlantısı oluşturulamadı.');
      return data.signedUrl;
    }),
  );

  return { ...record, media_urls: mediaUrls };
}

/** Fetches sensitive planet content only after the backend entitlement check. */
export async function getExoplanetDetails(planetId: string): Promise<StarExoplanetRecord> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('get_exoplanet_details', {
      p_exoplanet_id: planetId,
    });
    if (error) handleSupabaseError(error);
    return hydrateMediaUrls(data as StarExoplanetRecord);
  });
}

/**
 * Yıldızın yörüngesine yeni bir anı ötegezegeni (Exoplanet) ekler.
 * id, star_id, created_at, updated_at alanları sistem tarafından otomatik atanır.
 * is_auto_generated = FALSE, window_started_at = NULL olarak ayarlanır.
 */
export async function createExoplanet(
  starId: string,
  payload: CreateExoplanetDto,
  mediaPaths: readonly string[] = [],
): Promise<StarExoplanetRecord> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('create_exoplanet', {
      p_star_id: starId,
      p_title: payload.title.trim(),
      p_description: payload.description ? payload.description.trim() : null,
      p_milestone_date: payload.milestone_date,
      p_orbit_distance: payload.orbit_distance,
      p_orbit_speed: payload.orbit_speed ?? 1.0,
      p_planet_type: payload.planet_type ?? 'terrestrial',
      p_palette: payload.palette ?? ['#4facfe', '#00f2fe'],
    });

    if (error) handleSupabaseError(error);
    const created = data as StarExoplanetRecord;

    for (const mediaPath of mediaPaths) {
      await appendMediaToExoplanet(created.id, mediaPath);
    }

    return getExoplanetDetails(created.id);
  });
}

/**
 * Var olan bir gezegen kaydını günceller (başlık, açıklama, tip vb.).
 * is_auto_generated ve window_started_at değiştirilemez (DB seviyesinde sahiplik korumalı).
 */
export async function updateExoplanet(
  planetId: string,
  payload: Partial<CreateExoplanetDto>,
): Promise<StarExoplanetRecord> {
  return withSmartRetry(async () => {
    const patch: Record<string, unknown> = {};
    if (payload.title !== undefined) patch.title = payload.title.trim();
    if (payload.description !== undefined) patch.description = payload.description ? payload.description.trim() : null;
    if (payload.milestone_date !== undefined) patch.milestone_date = payload.milestone_date;
    if (payload.orbit_distance !== undefined) patch.orbit_distance = payload.orbit_distance;
    if (payload.orbit_speed !== undefined) patch.orbit_speed = payload.orbit_speed;
    if (payload.planet_type !== undefined) patch.planet_type = payload.planet_type;
    if (payload.palette !== undefined) patch.palette = payload.palette;

    const { error } = await supabase.rpc('update_exoplanet', {
      p_planet_id: planetId,
      p_patch: patch,
    });

    if (error) handleSupabaseError(error);

    return getExoplanetDetails(planetId);
  });
}

/**
 * Gezegeni siler. Orijinal medya ve mektup kayıtları korunur; yalnızca
 * gezegen bağlantısı kaldırılır. This remains available after expiration.
 */
export async function deleteExoplanet(planetId: string): Promise<void> {
  return withSmartRetry(async () => {
    const { error } = await supabase.rpc('delete_exoplanet', { p_exoplanet_id: planetId });
    if (error) handleSupabaseError(error);
  });
}

export async function appendMediaToExoplanet(planetId: string, mediaPath: string): Promise<void> {
  return withSmartRetry(async () => {
    const { error } = await supabase.rpc('append_media_to_exoplanet', {
      p_planet_id: planetId,
      p_media_url: storagePathFromMediaReference(mediaPath),
    });
    if (error) handleSupabaseError(error);
  });
}

export async function removeMediaFromExoplanet(planetId: string, mediaPath: string): Promise<void> {
  return withSmartRetry(async () => {
    const { error } = await supabase.rpc('remove_media_from_exoplanet', {
      p_planet_id: planetId,
      p_media_url: storagePathFromMediaReference(mediaPath),
    });
    if (error) handleSupabaseError(error);
  });
}

/**
 * Belirtilen yıldıza daha fazla manuel gezegen eklenip eklenemeyeceğini kontrol eder.
 * DB'deki sahiplik kontrolü sayesinde başkasının star_id'si ile çağrılırsa hata fırlatır.
 *
 * @returns TRUE → limit aşılmamış (10 altında), FALSE → limit dolu
 */
export async function canAddManualExoplanet(starId: string): Promise<boolean> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('check_manual_exoplanet_limit', {
      p_star_id: starId,
    });

    if (error) {
      handleSupabaseError(error);
    }

    return data as boolean;
  });
}

/**
 * Medya upload'u veya mektup bağlamadan otomatik gezegen oluşturur/bulur,
 * ardından medya/mektup referansını o gezegene ekler.
 *
 * Akış:
 *   1. `get_or_create_auto_exoplanet` RPC → mevcut aktif pencerede varsa döner,
 *      yoksa yeni otomatik gezegen oluşturur (45 günlük pencere).
 *   2. photoUrl varsa `append_media_to_exoplanet` RPC → media_urls dizisine ekler.
 *   3. letterId varsa `append_letter_to_exoplanet` RPC → custom_metadata.linked_letter_ids dizisine ekler.
 *   4. Güncel gezegen kaydını DB'den çekip döndürür.
 *
 * En az bir parametre (photoUrl veya letterId) sağlanmalıdır.
 */
export async function createExoplanetFromMedia(
  params: CreateExoplanetFromMediaParams,
): Promise<StarExoplanetRecord> {
  if (!params.photoUrl && !params.letterId) {
    throw new Error('createExoplanetFromMedia: photoUrl veya letterId sağlanmalıdır.');
  }

  return withSmartRetry(async () => {
    // 1. Otomatik gezegen al veya oluştur
    const { data: planetId, error: rpcError } = await supabase.rpc(
      'get_or_create_auto_exoplanet',
      { p_star_id: params.starId },
    );

    if (rpcError) {
      handleSupabaseError(rpcError);
    }

    const resolvedPlanetId = planetId as string;

    // 2. Fotoğraf Storage yolunu gezegene ekle
    if (params.photoUrl) {
      await appendMediaToExoplanet(resolvedPlanetId, params.photoUrl);
    }

    // 3. Mektup referansını gezegene ekle
    if (params.letterId) {
      const { error: letterError } = await supabase.rpc('append_letter_to_exoplanet', {
        p_planet_id: resolvedPlanetId,
        p_letter_id: params.letterId,
      });
      if (letterError) {
        handleSupabaseError(letterError);
      }
    }

    // 4. Güncel hassas gezegen kaydını kontrollü RPC'den döndür
    return getExoplanetDetails(resolvedPlanetId);
  });
}

/**
 * Yıldıza kıvılcım (daily_spark veya love_ping) gönderir.
 * Veritabanındaki `send_star_spark` RPC'sini çağırır.
 *
 * Hata Yönetimi:
 * - P0001 (Günlük hak dolmadı) veya P0002 (Spam koruması) durumlarında
 *   SparkCooldownException fırlatır.
 */
export async function sendSpark(params: SendStarSparkParams): Promise<CoupleStarDetails> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('send_star_spark', {
      p_star_id: params.starId,
      p_spark_type: params.sparkType ?? 'daily_spark',
      p_message: params.message ? params.message.trim() : null,
    });

    if (error) {
      handleSupabaseError(error);
    }

    return data as CoupleStarDetails;
  });
}

// ============================================================================
// 7. YILDIZ BAĞLANTILARI (STAGE 5 — ARKADAŞ ÇİFT BAĞLANTILARI)
// ============================================================================

/**
 * İsme göre tescilli çift yıldızlarını arar (kendi yıldızı hariç, escape korumalı).
 */
export async function searchStarByName(query: string): Promise<StarSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('search_star_by_name', {
      p_query: trimmed,
    });

    if (error) {
      handleSupabaseError(error);
    }

    return (data || []) as StarSearchResult[];
  });
}

/**
 * Genel Harita / Evren Araması yapar (yaygın isim, katalog, ötegezegen vs).
 */
export async function searchCelestialUniverse(query: string): Promise<CelestialSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('search_celestial_universe', {
      p_query: trimmed,
    });

    if (error) {
      handleSupabaseError(error);
    }

    return (data || []) as CelestialSearchResult[];
  });
}

/**
 * Hedef yıldıza bağlantı isteği gönderir (Atomik RPC, simetrik lock & 3 limit).
 */
export async function requestStarConnection(targetStarId: string): Promise<StarConnectionRecord> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('request_star_connection', {
      p_target_star_id: targetStarId,
    });

    if (error) {
      handleSupabaseError(error);
    }

    return data as StarConnectionRecord;
  });
}

/**
 * Gelen bağlantı isteğini onaylar (accept=true) veya reddeder (accept=false).
 */
export async function respondToConnection(connectionId: string, accept: boolean): Promise<void> {
  return withSmartRetry(async () => {
    const { error } = await supabase.rpc('respond_to_star_connection', {
      p_connection_id: connectionId,
      p_accept: accept,
    });

    if (error) {
      handleSupabaseError(error);
    }
  });
}

/**
 * Var olan bir yıldız bağlantısını sonlandırır veya bekleyen isteği siler.
 * RLS delete politikası uyarınca authenticated kullanıcı kendi bağlantısını silebilir.
 */
export async function removeStarConnection(connectionId: string): Promise<void> {
  return withSmartRetry(async () => {
    const { error } = await supabase
      .from('star_connections')
      .delete()
      .eq('id', connectionId);

    if (error) {
      handleSupabaseError(error);
    }
  });
}

/**
 * Çiftin kabul edilmiş aktif bağlantılarını (diğer yıldızın ad ve koordinatlarıyla) getirir.
 */
export async function getMyStarConnections(): Promise<ActiveStarConnection[]> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('get_my_star_connections');

    if (error) {
      handleSupabaseError(error);
    }

    return (data || []) as ActiveStarConnection[];
  });
}

/**
 * Çiftin bekleyen (gelen ve giden) bağlantı isteklerini listeler.
 */
export async function getPendingConnections(): Promise<PendingConnectionDetail[]> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('get_my_pending_connections');

    if (error) {
      handleSupabaseError(error);
    }

    return (data || []) as PendingConnectionDetail[];
  });
}

/**
 * Çiftin bağlantı limitinin (3 adet) dolu olup olmadığını sorgular (Client UI helper).
 */
export async function checkConnectionLimit(coupleId: number): Promise<boolean> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('check_connection_limit', {
      p_couple_id: coupleId,
    });

    if (error) {
      handleSupabaseError(error);
    }

    return Boolean(data);
  });
}

/**
 * Katalog ID'sine göre tescilli çift yıldızının UUID'sini (star_id) sorgular.
 * MacroSkyCanvas üzerinden yıldız seçilip doğrudan bağlantı kurulurken kullanılır.
 */
export async function getStarIdByCatalogId(catalogId: number): Promise<string | null> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase
      .from('couple_stars')
      .select('id')
      .eq('catalog_id', catalogId)
      .maybeSingle();

    if (error || !data) return null;
    return (data as { id: string }).id;
  });
}

// ============================================================================
// 8. GÖKYÜZÜ SEKTÖRLERİ API (STAGE 6)
// ============================================================================

/**
 * Sektör dinamik verilerini (doluluk, enerji, arkadaş varlığı) çeker.
 * Yalnızca SectorAtlasModal açıldığında çağrılır.
 * 5 dakikalık client-side bellek içi önbellek ile gereksiz Supabase trafiği engellenir.
 */
let sectorsOverviewCache: { data: SectorDynamicOverview[]; fetchedAt: number } | null = null;
const SECTORS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 dakika

export async function getSectorsOverview(): Promise<SectorDynamicOverview[]> {
  // Cache kontrolü
  if (sectorsOverviewCache && Date.now() - sectorsOverviewCache.fetchedAt < SECTORS_CACHE_TTL_MS) {
    return sectorsOverviewCache.data;
  }

  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('get_sectors_overview');

    if (error) {
      handleSupabaseError(error);
    }

    const result = (data as SectorDynamicOverview[]) || [];
    sectorsOverviewCache = { data: result, fetchedAt: Date.now() };
    return result;
  });
}

/**
 * Belirtilen sektörden bir yıldız sahiplenir.
 * Sektörde boş katalog yıldızı kalmadıysa otomatik prosedürel sanal yıldız üretir.
 * Koordinat parametresi ALINMAZ; fonksiyon sınırları sky_sectors tablosundan çeker.
 */
export async function claimStarInSector(
  params: ClaimStarInSectorParams,
): Promise<CoupleStarDetails> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('claim_star_in_sector', {
      p_couple_id: params.coupleId,
      p_sector_id: params.sectorId,
      p_custom_name: params.customName,
    });

    if (error) {
      handleSupabaseError(error);
    }

    return data as CoupleStarDetails;
  });
}

/**
 * Sektör önbelleğini temizler (tescil sonrası güncel veri çekmek için).
 */
export function invalidateSectorsCache(): void {
  sectorsOverviewCache = null;
}


export const starService = {
  fetchStarsInViewport,
  claimRandomStar,
  claimSpecificStar,
  getMyStarDetails,
  getStarExoplanets,
  getExoplanetDetails,
  createExoplanet,
  updateExoplanet,
  deleteExoplanet,
  appendMediaToExoplanet,
  removeMediaFromExoplanet,
  canAddManualExoplanet,
  createExoplanetFromMedia,
  sendSpark,
  searchStarByName,
  searchCelestialUniverse,
  requestStarConnection,
  respondToConnection,
  removeStarConnection,
  getMyStarConnections,
  getPendingConnections,
  checkConnectionLimit,
  getStarIdByCatalogId,
  getSectorsOverview,
  claimStarInSector,
  invalidateSectorsCache,
};

