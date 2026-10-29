/**
 * @file StarSparkManager.ts
 * @module modules/stars/services
 * @description "Bizim Yıldızımız" (Our Star) Gerçek Zamanlı Rezonans ve Etkileşim Yöneticisi
 *
 * Bu yönetici:
 * 1. `star-resonance:${starId}` WebSocket kanalı üzerinden çiftler arası canlı senkronizasyon sağlar.
 * 2. Çift katmanlı (ağ + istemci) filtrelemeyle kullanıcının kendi kıvılcımlarını echo yapmasını önler.
 * 3. (Günlük ışık ritüeli kaldırıldı: yıldızın parlaklığı çiftin aktivitesinden gelir.)
 * 4. Love ping akışında anında yerel haptic ve WebSocket yayını tetikler; DB yazımını 2s debounce
 *    edip modül düzeyindeki 60s kalkanıyla sessizce filtreler (suppress).
 * 5. Tekil RealtimeChannel nesnesi üzerinden hem Broadcast hem Postgres Changes dinleyicilerini
 *    yönetir; unsubscribe() ile bellek sızıntısız temiz ayrılma sağlar.
 */

import { hapticTap } from '@/lib/soundEffects';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { starService, SparkCooldownException } from '../api/starService';
import type {
  ResonanceEvent,
  SparkBroadcastPayload,
} from '../types/star.types';
import i18n from '@/lib/i18n';

// ============================================================================
// 1. MODÜL DÜZEYİNDE KALICI BELLEK (Remount-Safe 60s Trigger Window)
// ============================================================================

/**
 * starId bazında veritabanına en son başarılı 'love_ping' yazılma zamanı (Epoch ms).
 * React component unmount/remount döngülerinde silinmez; böylece ekran kapatılıp
 * açılsa dahi 60 saniyelik DB trigger kalkanı korunur ve gereksiz DB denemeleri engellenir.
 */
const starLovePingTimestampCache = new Map<string, number>();

/**
 * Cache'e zaman damgası kaydeder ve 2 dakikadan eski kayıtları temizleyerek
 * teorik bellek birikmesini (memory leak) sıfırlar.
 */
function recordLovePingTimestamp(starId: string, timestamp: number = Date.now()): void {
  starLovePingTimestampCache.set(starId, timestamp);

  if (starLovePingTimestampCache.size > 50) {
    const now = Date.now();
    for (const [key, time] of starLovePingTimestampCache.entries()) {
      if (now - time > 120_000) {
        starLovePingTimestampCache.delete(key);
      }
    }
  }
}

// ============================================================================
// 2. YÖNETİCİ ARAYÜZ VE TİP TANIMLARI
// ============================================================================

export interface ResonanceCallbacks {
  /**
   * Partner yıldıza bir kıvılcım (daily_spark veya love_ping) gönderdiğinde tetiklenir.
   */
  onPartnerSpark?: (spark: SparkBroadcastPayload) => void;

  /**
   * Çiftlerin eşzamanlı girişiyle rezonans başladığında veya sona erdiğinde tetiklenir.
   */
  onResonanceChange?: (event: ResonanceEvent) => void;
}

export interface StarSparkManagerOptions {
  readonly starId: string;
  readonly senderId?: string;
  readonly senderName?: string;
  readonly initialLuminosity?: number;
}

// ============================================================================
// 3. STAR SPARK MANAGER SINIFI
// ============================================================================

export class StarSparkManager {
  public readonly starId: string;
  private senderId: string;
  private senderName: string;
  private currentLuminosity: number;

  private channel: RealtimeChannel | null = null;
  private lovePingDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private callbacks: ResonanceCallbacks = {};

  constructor(options: StarSparkManagerOptions | string) {
    if (typeof options === 'string') {
      this.starId = options;
      this.senderId = '';
      this.senderName = i18n.t('common.partner');
      this.currentLuminosity = 1.0;
    } else {
      this.starId = options.starId;
      this.senderId = options.senderId ?? '';
      this.senderName = options.senderName ?? i18n.t('common.partner');
      this.currentLuminosity = options.initialLuminosity ?? 1.0;
    }
  }

  /**
   * Kimlik doğrulama yüklendiğinde gönderen bilgilerini dinamik olarak günceller.
   */
  public setSenderInfo(senderId: string, senderName?: string): void {
    this.senderId = senderId;
    if (senderName) {
      this.senderName = senderName;
    }
  }

  /**
   * Güncel parlaklık seviyesini günceller.
   */
  public setLuminosity(luminosity: number): void {
    this.currentLuminosity = Math.min(1.0, Math.max(0.1, luminosity));
  }

  // ==========================================================================
  // ABONELİK VE GERÇEK ZAMANLI SENKRONİZASYON
  // ==========================================================================

  /**
   * `star-resonance:${starId}` kanalına bağlanarak broadcast ve veritabanı değişikliklerini dinler.
   *
   * Çift Katmanlı Self-Filtering:
   * 1. Ağ Seviyesi: Supabase kanal konfigürasyonunda `broadcast: { self: false }`.
   * 2. İstemci Seviyesi (Defense-in-Depth): `payload.senderId === this.senderId` kontrolü.
   */
  public async subscribeToResonance(callbacks: ResonanceCallbacks): Promise<void> {
    this.callbacks = callbacks;

    // Zaten açık bir kanal varsa önce temizle
    if (this.channel) {
      await this.unsubscribe();
    }

    const channelName = `star-resonance:${this.starId}`;

    // Tekil kanal nesnesi: Hem broadcast hem postgres_changes bu kanala zincirlenir
    this.channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        'broadcast',
        { event: 'spark' },
        (response: { payload: SparkBroadcastPayload }) => {
          const payload = response.payload;
          if (!payload) return;

          // İstemci seviyesinde ek doğrulama: Kendi gönderdiğimiz kıvılcımı filtrele
          if (this.senderId && payload.senderId === this.senderId) {
            return;
          }

          if (payload.newLuminosity) {
            this.currentLuminosity = payload.newLuminosity;
          }

          this.callbacks.onPartnerSpark?.(payload);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'couple_stars',
          filter: `id=eq.${this.starId}`,
        },
        (payload: { new: Record<string, any> }) => {
          const updatedRow = payload.new;
          if (!updatedRow) return;

          if (typeof updatedRow.luminosity_level === 'number') {
            this.currentLuminosity = updatedRow.luminosity_level;
          }

          const resonanceUntil = updatedRow.resonance_until ? String(updatedRow.resonance_until) : null;
          const isActive = Boolean(
            resonanceUntil && new Date(resonanceUntil).getTime() > Date.now(),
          );

          this.callbacks.onResonanceChange?.({
            starId: this.starId,
            active: isActive,
            partnersOnline: [],
            triggeredAt: updatedRow.last_spark_at ?? new Date().toISOString(),
            expiresAt: resonanceUntil ?? new Date().toISOString(),
          });
        },
      );

    await this.channel.subscribe();
  }

  // ==========================================================================
  // LOVE PING & ÇİFT KADEMELİ DB THROTTLE MİMARİSİ
  // ==========================================================================

  /**
   * Ekrana dokunulduğunda anlık sevgi titreşimi üretir.
   *
   * İşleyiş:
   * 1. Anında yerel haptic titreşim (`expo-haptics`).
   * 2. Anında `star-resonance:${starId}` kanalına WebSocket broadcast (DB beklenmez, partner anında hisseder).
   * 3. DB log yazımı 2 saniye debounce edilir.
   * 4. 60s Trigger Kalkanı: Son 60 saniye içinde başarılı bir `love_ping` yazılmışsa,
   *    veritabanı isteği sessizce es geçilir (`suppress`). DB hatası UI'a fırlatılmaz.
   */
  public async queueLovePing(customMessage?: string): Promise<void> {
    // 1. Anında Yerel Haptic Titreşim (Kullanıcı ayarlarına saygılı)
    await hapticTap();

    // 2. Anında WebSocket Broadcast (Optimistik iletim)
    if (this.channel) {
      const pingPayload: SparkBroadcastPayload = {
        starId: this.starId,
        senderId: this.senderId,
        senderName: this.senderName,
        sparkType: 'love_ping',
        message: customMessage ? customMessage.trim() : undefined,
        newLuminosity: this.currentLuminosity,
        timestamp: new Date().toISOString(),
      };

      this.channel
        .send({
          type: 'broadcast',
          event: 'spark',
          payload: pingPayload,
        })
        .catch((sendErr) => {
          if (__DEV__) {
            console.warn(
              `[StarSparkManager] queueLovePing: Broadcast iletilemedi (starId: ${this.starId}):`,
              sendErr,
            );
          }
        });
    } else if (__DEV__) {
      console.warn(
        `[StarSparkManager] queueLovePing: Kanal henüz bağlı değil veya kapatılmış (starId: ${this.starId}). Broadcast atlandı.`,
      );
    }

    // 3. Veritabanı Yazımını 2 Saniye Debounce Et
    if (this.lovePingDebounceTimer) {
      clearTimeout(this.lovePingDebounceTimer);
    }

    this.lovePingDebounceTimer = setTimeout(async () => {
      await this.flushLovePingToDb(customMessage);
    }, 2000);
  }

  /**
   * 2 saniyelik debounce sonrası DB'ye log kaydını dener.
   * 60s kuralına takılıyorsa veya trigger P0002 döndürürse sessizce es geçer.
   */
  private async flushLovePingToDb(message?: string): Promise<void> {
    const lastDbTime = starLovePingTimestampCache.get(this.starId) ?? 0;
    const now = Date.now();

    // 60 saniye trigger kalkanı: Son 60 saniyede DB'ye yazıldıysa sessizce es geç
    if (now - lastDbTime < 60_000) {
      return;
    }

    try {
      const updatedDetails = await starService.sendSpark({
        starId: this.starId,
        sparkType: 'love_ping',
        message: message ? message.trim() : undefined,
      });

      // DB yazımı başarılı; zaman damgasını kaydet
      recordLovePingTimestamp(this.starId, Date.now());
      this.currentLuminosity = updatedDetails.luminosity_level;
    } catch (error: any) {
      // P0002 spam kalkanına takıldıysa veya beklenen bir cooldown ise sessizce yut
      if (error instanceof SparkCooldownException || error?.code === 'P0002') {
        recordLovePingTimestamp(this.starId, Date.now());
        return;
      }

      // Geliştirme ortamında RLS yetki sorunu, network çökmesi veya DB hatalarını görünür kıl
      if (__DEV__) {
        console.error(
          `[StarSparkManager] flushLovePingToDb DB yazım hatası (starId: ${this.starId}):`,
          error,
        );
      }
    }
  }

  // ==========================================================================
  // TEMİZ AYRILMA (TEAR DOWN)
  // ==========================================================================

  /**
   * Kanal aboneliğini kapatır, zamanlayıcıları temizler ve kaynakları serbest bırakır.
   */
  public async unsubscribe(): Promise<void> {
    if (this.lovePingDebounceTimer) {
      clearTimeout(this.lovePingDebounceTimer);
      this.lovePingDebounceTimer = null;
    }

    if (this.channel) {
      const channelToClose = this.channel;
      this.channel = null;
      await supabase.removeChannel(channelToClose);
    }

    this.callbacks = {};
  }
}
