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
  ClaimRandomStarParams,
  CoupleStarDetails,
  CreateExoplanetDto,
  GetStarsViewportParams,
  SendStarSparkParams,
  SparkCooldownError,
  StarExoplanetRecord,
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
 */
async function withSmartRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt > maxRetries || !isNetworkError(error)) {
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
): Promise<ViewportStarItem[]> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase.rpc('get_stars_in_viewport', {
      min_ra: params.minRa,
      max_ra: params.maxRa,
      min_dec: params.minDec,
      max_dec: params.maxDec,
      zoom_level: params.zoomLevel,
    });

    if (error) {
      handleSupabaseError(error);
    }

    return (data ?? []) as ViewportStarItem[];
  });
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
 * Mikro Yıldız Sisteminde yörüngede dönen tüm anı ötegezegenlerini getirir.
 * RLS politikası yalnızca çiftin kendi gezegenlerini dönmesini garanti eder.
 */
export async function getStarExoplanets(starId: string): Promise<StarExoplanetRecord[]> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase
      .from('star_exoplanets')
      .select('*')
      .eq('star_id', starId)
      .order('milestone_date', { ascending: false });

    if (error) {
      handleSupabaseError(error);
    }

    return (data ?? []) as StarExoplanetRecord[];
  });
}

/**
 * Yıldızın yörüngesine yeni bir anı ötegezegeni (Exoplanet) ekler.
 * id, star_id, created_at, updated_at alanları sistem tarafından otomatik atanır.
 */
export async function createExoplanet(
  starId: string,
  payload: CreateExoplanetDto,
): Promise<StarExoplanetRecord> {
  return withSmartRetry(async () => {
    const { data, error } = await supabase
      .from('star_exoplanets')
      .insert({
        star_id: starId,
        title: payload.title.trim(),
        description: payload.description ? payload.description.trim() : null,
        milestone_date: payload.milestone_date,
        orbit_distance: payload.orbit_distance,
        orbit_speed: payload.orbit_speed ?? 1.0,
        planet_type: payload.planet_type ?? 'terrestrial',
        palette: payload.palette ?? ['#4facfe', '#00f2fe'],
        media_urls: payload.media_urls ?? [],
        custom_metadata: payload.custom_metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      handleSupabaseError(error);
    }

    return data as StarExoplanetRecord;
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

export const starService = {
  fetchStarsInViewport,
  claimRandomStar,
  getMyStarDetails,
  getStarExoplanets,
  createExoplanet,
  sendSpark,
};
