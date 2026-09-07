/**
 * @file ParticlePool.ts
 * @module modules/stars/canvas
 * @description Sıfır Bellek Tahsisli (Zero-Allocation) Parçacık Havuz Motoru
 *
 * Mimari Kararlar:
 * - IParticlePool (star.types.ts'deki temel arayüz) breaking change yapılmadan korunur.
 * - IExtendedParticlePool, spawn ve render metodlarını ekler. Canvas bileşenleri
 *   bu genişletilmiş arayüzü kullanır.
 * - ParticlePool somut sınıfı IExtendedParticlePool'u implement eder.
 * - 200 adet Particle nesnesi constructor anında önceden tahsis edilir.
 * - Render döngüsünde (acquire, release, spawn, update, render) ASLA `new` kullanılmaz.
 * - Aktif parçacık listesi swap-and-pop tekniğiyle O(1) sürede yönetilir.
 */

import type {
  IParticlePool,
  Particle,
  ParticlePoolConfig,
} from '@/modules/stars/types/star.types';

// ============================================================================
// GENİŞLETİLMİŞ PARÇACIK OLUŞTURMA TİPİ
// ============================================================================

/**
 * spawn() metoduna iletilen opsiyonel parçacık başlangıç parametreleri.
 * Tanımlanmayan alanlar için makul varsayılanlar uygulanır.
 */
export interface SpawnParticleOptions {
  readonly vx?: number;             // Başlangıç X hızı (px/s)
  readonly vy?: number;             // Başlangıç Y hızı (px/s)
  readonly life?: number;           // Başlangıç yaşamı (sn)
  readonly maxLife?: number;        // Maksimum yaşam süresi (sn)
  readonly size?: number;           // Anlık boyut (px)
  readonly startSize?: number;      // Başlangıç boyutu (px)
  readonly endSize?: number;        // Bitiş boyutu (px), lerp ile geçiş yapar
  readonly color?: string;          // CSS renk değeri ('#RRGGBB', 'rgba(...)' vb.)
  readonly alpha?: number;          // Başlangıç alfa [0.0, 1.0]
  readonly decayRate?: number;      // Yaşam tüketme hızı (1.0 = normal)
  readonly rotation?: number;       // Başlangıç dönüş açısı (rad)
  readonly angularVelocity?: number; // Açısal hız (rad/s)
}

// ============================================================================
// GENİŞLETİLMİŞ PARÇACIK HAVUZ ARAYÜZÜ
// ============================================================================

/**
 * star.types.ts'deki IParticlePool arayüzünü bozmadan spawn ve render
 * metodlarını ekleyen genişletilmiş arayüz.
 *
 * Canvas bileşenleri bu arayüzü tüketir; IParticlePool bekleyen başka
 * tüketicilerle tam uyumluluk korunur.
 */
export interface IExtendedParticlePool extends IParticlePool {
  /**
   * Havuzdan boş bir parçacık alır, konumunu ve parametrelerini ayarlar,
   * aktif listeye ekler ve referansı döner.
   * @returns Başlatılmış parçacık veya havuz doluysa null.
   */
  spawn(x: number, y: number, options?: SpawnParticleOptions): Particle | null;

  /**
   * Tüm aktif parçacıkları Canvas'a çizer.
   * ctx.save() / ctx.restore() ile context izolasyonu sağlar.
   */
  render(ctx: CanvasRenderingContext2D): void;
}

// ============================================================================
// VARSAYILAN PARÇACIK HAVUZ YAPILANDIRMASI
// ============================================================================

const DEFAULT_CONFIG: ParticlePoolConfig = {
  maxParticles: 200,
  emissionRate: 8,
  blendMode: 'lighter',
  gravity: { x: 0, y: -4 },  // Hafif yukarı kaldırma (kozmik toz etkisi)
  drag: 0.97,                  // Sürtünme katsayısı
  jitter: 0.3,                 // Rastgele saçılma
};

// ============================================================================
// SOMUT PARÇACIK HAVUZ UYGULAMASI
// ============================================================================

/**
 * IExtendedParticlePool arayüzünü uygulayan somut parçacık havuzu.
 *
 * Başlangıç tahsisi: maxParticles sayısı kadar Particle nesnesi constructor
 * anında oluşturulur. Sonraki tüm işlemler (spawn, update, render) bellek
 * tahsisi yapmadan in-place veri güncellemesiyle çalışır.
 */
export class ParticlePool implements IExtendedParticlePool {
  private readonly pool: Particle[];
  private readonly active: Particle[];
  private readonly freeIndices: number[];
  private readonly config: ParticlePoolConfig;

  constructor(config: Partial<ParticlePoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    const size = this.config.maxParticles;

    // Render döngüsünde `new` kullanmamak için tüm nesneler baştan tahsis edilir.
    this.pool = [];
    this.active = [];
    this.freeIndices = [];

    for (let i = 0; i < size; i++) {
      // Her parçacık varsayılan (inactive) haliyle tahsis edilir.
      this.pool.push({
        id: i,
        active: false,
        x: 0, y: 0,
        vx: 0, vy: 0,
        life: 0, maxLife: 1,
        size: 2, startSize: 2, endSize: 0,
        color: '#FFFFFF',
        alpha: 0,
        decayRate: 1,
        rotation: 0,
        angularVelocity: 0,
      });
      this.freeIndices.push(i);
    }
  }

  // --------------------------------------------------------------------------
  // IParticlePool: Temel Arayüz Metodları
  // --------------------------------------------------------------------------

  /**
   * Havuzdan boş bir parçacık referansı alır ve aktif listeye ekler.
   * Bellek tahsisi YAPILMAZ — havuzdaki mevcut nesne sıfırlanarak döner.
   */
  acquire(): Particle | null {
    if (this.freeIndices.length === 0) {
      return null;
    }
    // Son boş indeksi çek (yığın işlemi, O(1))
    const idx = this.freeIndices.pop()!;
    const particle = this.pool[idx];
    particle.active = true;
    this.active.push(particle);
    return particle;
  }

  /**
   * Parçacığı aktif listeden swap-and-pop ile O(1) sürede çıkarır,
   * pasif hale getirir ve boş indeks yığınına geri ekler.
   */
  release(particle: Particle): void {
    const idx = this.active.indexOf(particle);
    if (idx === -1) return;

    // Swap-and-pop: Son elemanı çıkarılan yere taşı.
    const last = this.active[this.active.length - 1];
    this.active[idx] = last;
    this.active.pop();

    particle.active = false;
    particle.alpha = 0;
    this.freeIndices.push(particle.id);
  }

  /**
   * Tüm aktif parçacıkları deltaTimeSec kadar ilerletir.
   * Yaşamı biten parçacıklar otomatik olarak havuza iade edilir.
   *
   * Geriye doğru iterasyon (i = length-1 → 0) kullanılır; bu sayede
   * release() çağrısının swap-and-pop'u döngü indeksini bozması önlenir.
   */
  update(deltaTimeSec: number): void {
    const { gravity, drag, jitter } = this.config;

    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];

      // Yaşam tüketimi
      p.life -= deltaTimeSec * p.decayRate;
      if (p.life <= 0) {
        this.release(p);
        continue;
      }

      // Hareket güncelleme
      p.vx += gravity.x * deltaTimeSec;
      p.vy += gravity.y * deltaTimeSec;
      p.vx *= drag;
      p.vy *= drag;

      // Rastgele saçılma (jitter)
      if (jitter > 0) {
        p.vx += (Math.random() - 0.5) * jitter;
        p.vy += (Math.random() - 0.5) * jitter;
      }

      p.x += p.vx * deltaTimeSec;
      p.y += p.vy * deltaTimeSec;
      p.rotation += p.angularVelocity * deltaTimeSec;

      // Boyut lineer interpolasyonu (startSize → endSize)
      const lifeFrac = Math.max(0, p.life / p.maxLife);
      p.size = p.endSize + (p.startSize - p.endSize) * lifeFrac;

      // Alfa lineer interpolasyonu (solma efekti)
      p.alpha = lifeFrac;
    }
  }

  getActiveParticles(): readonly Particle[] {
    return this.active;
  }

  getActiveCount(): number {
    return this.active.length;
  }

  /**
   * Tüm aktif parçacıkları havuza iade eder.
   * Unmount veya sahne geçişlerinde çağrılır.
   */
  reset(): void {
    // Geriye doğru iterasyon ile release güvenli çalışır.
    for (let i = this.active.length - 1; i >= 0; i--) {
      this.release(this.active[i]);
    }
  }

  // --------------------------------------------------------------------------
  // IExtendedParticlePool: Genişletilmiş Canvas Metodları
  // --------------------------------------------------------------------------

  /**
   * Havuzdan bir parçacık alır, konumunu ve verilen parametreleri in-place yazar.
   * Render döngüsünde ASLA nesne tahsisi yapılmaz.
   */
  spawn(x: number, y: number, options: SpawnParticleOptions = {}): Particle | null {
    const p = this.acquire();
    if (!p) return null;

    const maxLife = options.maxLife ?? options.life ?? 1.5;

    p.x = x;
    p.y = y;
    p.vx = options.vx ?? (Math.random() - 0.5) * 30;
    p.vy = options.vy ?? (Math.random() - 0.5) * 30;
    p.maxLife = maxLife;
    p.life = options.life ?? maxLife;
    p.startSize = options.startSize ?? options.size ?? 2.5;
    p.endSize = options.endSize ?? 0;
    p.size = p.startSize;
    p.color = options.color ?? '#E2C27D';
    p.alpha = options.alpha ?? 1.0;
    p.decayRate = options.decayRate ?? 1.0;
    p.rotation = options.rotation ?? Math.random() * Math.PI * 2;
    p.angularVelocity = options.angularVelocity ?? (Math.random() - 0.5) * 2;

    return p;
  }

  /**
   * Tüm aktif parçacıkları Canvas bağlamına çizer.
   * ctx.save() / ctx.restore() ile tam izolasyon sağlar.
   *
   * Blend mode `lighter` veya `screen` kullanılarak yıldız/kozmos parlaması efekti elde edilir.
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (this.active.length === 0) return;

    ctx.save();
    ctx.globalCompositeOperation = this.config.blendMode as GlobalCompositeOperation;

    for (const p of this.active) {
      if (p.size <= 0 || p.alpha <= 0) continue;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));

      // Radyal gradyan ile yumuşak kenarlı parçacık çizimi
      const halfSize = p.size / 2;
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, halfSize);
      gradient.addColorStop(0, p.color);
      gradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(0, 0, halfSize, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }
}

// ============================================================================
// YARDIMCI FABRIKA FONKSİYONU
// ============================================================================

/**
 * Verilen yapılandırmayla yeni bir ParticlePool oluşturan kısayol fabrika fonksiyonu.
 */
export function createParticlePool(config?: Partial<ParticlePoolConfig>): IExtendedParticlePool {
  return new ParticlePool(config);
}
