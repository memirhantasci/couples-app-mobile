/**
 * @file star.types.ts
 * @module modules/stars/types
 * @description "Bizim Yıldızımız" (Our Star) Modülü Master Tip Sistemi
 *
 * Bu dosya:
 * 1. PostgreSQL/PostGIS veritabanı tablolarının birebir strict TypeScript karşılıkları
 * 2. RPC fonksiyon girdileri, çıktıları ve hata tipleri
 * 3. Keplerian yörünge mekaniği ve responsive 2D Canvas çizim parametreleri
 * 4. Sıfır bellek sızıntılı (Zero-Allocation) parçacık motoru ve havuz tipleri
 * 5. Supabase Realtime WebSocket broadcast ve varlık (Presence) sinyal tipleri
 */

// ============================================================================
// 1. ASTRONOMİK VE ALAN TİPLERİ (Domain Primitives)
// ============================================================================

/**
 * Morgan-Keenan yıldız tayf sınıflandırması.
 * Sıcak mavi devlerden (O) soğuk kırmızı cücelere (M) kadar uzanır.
 * Alt-tip detayları (ör. 'A1V', 'M3.5III') da desteklenir.
 */
export type SpectralClass = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';
export type SpectralType = SpectralClass | (string & {});

/**
 * Mikro yıldız sistemindeki anı ötegezegenlerinin jeofiziksel ve görsel tipi.
 */
export type PlanetType =
  | 'terrestrial'   // Karasal / Dünya benzeri
  | 'gas_giant'     // Gaz devi (halkalı anılar)
  | 'ice_world'     // Buz dünyası (kristal/pastel)
  | 'ocean_world'   // Okyanus dünyası (turkuaz)
  | 'crystal'       // Kristalize gök cismi (prizmatik)
  | 'volcanic'      // Volkanik / ateş dünyası
  | 'desert'        // Çöl gezegeni (altın sarısı)
  | 'ringed_giant'; // Geniş halkalı dev

/**
 * Kullanıcı tarafından arayüz üzerinden manuel olarak gönderilebilen kıvılcım tipleri.
 * `send_star_spark` RPC ve RLS politikaları yalnızca bu tipleri kabul eder.
 */
export type UserInitiatedSparkType =
  | 'daily_spark'       // Günde 1 kez, parlaklığı artıran ana ritüel (20h cooldown)
  | 'love_ping';        // Anlık haptik titreşim (60s spam korumalı)

/**
 * Sistem yaşam döngüsü tarafından otomatik tetiklenen kıvılcım tipleri.
 * Yalnızca SECURITY DEFINER yetkili fonksiyonlar (tescil, anı ekleme vb.) tarafından oluşturulur.
 */
export type SystemSparkType =
  | 'welcome_spark'     // Yıldız tescil edildiğinde sistemce eklenen ilk karşılama kıvılcımı (günlük hakkı tüketmez)
  | 'memory_ignite'     // Yeni anı/ötegezegen eklendiğinde yayılan kıvılcım (TODO: Anı oluşturma RPC/trigger fazında tetiklenecek)
  | 'resonance_boost';  // Eşler aynı anda girdiğinde patlayan rezonans ışığı

/**
 * Yıldıza gönderilen tüm sevgi kıvılcımı kategorileri.
 */
export type SparkType = UserInitiatedSparkType | SystemSparkType;


// ============================================================================
// 2. VERİTABANI VARLIK TİPLERİ (Database Entity Records)
// ============================================================================

/**
 * `celestial_catalog` tablosu satır tipi.
 */
export interface CelestialStarRecord {
  readonly id: number;               // BIGINT GENERATED ALWAYS AS IDENTITY
  readonly catalog_code: string;     // VARCHAR(32) UNIQUE, ör: 'HIP-32349'
  readonly ra: number;               // NUMERIC(8,4) — [0.0000, 360.0000]
  readonly dec: number;              // NUMERIC(8,4) — [-90.0000, +90.0000]
  readonly magnitude: number;        // NUMERIC(4,2) — [-30.00, 35.00] (düşük = parlak)
  readonly spectral_type: SpectralType;
  readonly base_color: string;       // Hex renk kodu, ör: '#9DB4FF'
  readonly is_claimed: boolean;
}

/**
 * `couple_stars` tablosu satır tipi.
 */
export interface CoupleStarRecord {
  readonly id: string;                   // UUID
  readonly couple_id: number;            // INTEGER REFERENCES couples(id)
  readonly catalog_id: number;           // BIGINT REFERENCES celestial_catalog(id)
  readonly custom_name: string;
  readonly luminosity_level: number;     // [0.10, 1.00]
  readonly last_spark_at: string;        // ISO 8601 UTC
  readonly resonance_active: boolean;
  readonly resonance_until: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/**
 * `star_exoplanets` tablosu satır tipi.
 * is_auto_generated ve window_started_at: 20260907_stage3_exoplanet_crud.sql ile eklendi.
 */
export interface StarExoplanetRecord {
  readonly id: string;
  readonly star_id: string;
  readonly title: string;
  readonly description: string | null;
  readonly milestone_date: string | null; // YYYY-MM-DD; null when cleared in an edit patch
  readonly orbit_distance: OrbitZone;
  readonly orbit_speed: number;          // Kepler hız çarpanı (1.00 = doğal hız)
  readonly planet_type: PlanetType;
  readonly palette: string[];            // Gradiyent renk hex dizisi
  readonly media_urls: string[];
  readonly custom_metadata: Record<string, unknown>;
  /**
   * TRUE → `get_or_create_auto_exoplanet` RPC tarafından otomatik oluşturuldu.
   * FALSE → kullanıcı UI üzerinden manuel olarak oluşturdu.
   */
  readonly is_auto_generated: boolean;
  /**
   * Otomatik gezegen penceresinin başlangıç zamanı (ISO 8601 UTC).
   * 45 gün geçtikten sonra `get_or_create_auto_exoplanet` yeni pencere açar.
   * Manuel gezegenler için NULL.
   */
  readonly window_started_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/**
 * Manuel gezegen oluştururken kullanılan DTO.
 * id, star_id, is_auto_generated, window_started_at, created_at, updated_at
 * alanları sistem/DB tarafından üretilir — DTO'dan çıkarılmıştır.
 */
export type CreateExoplanetDto = Omit<
  StarExoplanetRecord,
  | 'id'
  | 'star_id'
  | 'media_urls'
  | 'custom_metadata'
  | 'is_auto_generated'
  | 'window_started_at'
  | 'created_at'
  | 'updated_at'
>;

/**
 * The deliberately small payload returned for a star-system map. A locked
 * planet never carries its title, description, media paths, or letter links.
 */
export interface StarSystemMapPlanet {
  readonly id: string;
  readonly orbit_distance: OrbitZone;
  readonly orbit_speed: number;
  readonly planet_type: PlanetType;
  readonly palette: string[];
  readonly is_locked: boolean;
  readonly display_title: string;
}

/**
 * Medya veya mektuptan otomatik gezegen tetiklemek için kullanılan parametre tipi.
 * `createExoplanetFromMedia` servis metoduna iletilir.
 */
export interface CreateExoplanetFromMediaParams {
  /** Gezegenin ekleneceği `couple_stars.id` (UUID) */
  readonly starId: string;
  /** Storage'a yüklenen medya URL'si (couple-memories/{coupleId}/...) */
  readonly photoUrl?: string;
  /** Gezegenle ilişkilendirilecek mektup UUID'si */
  readonly letterId?: string;
}

/**
 * `star_sparks` tablosu satır tipi.
 */
export interface StarSparkRecord {
  readonly id: string;
  readonly star_id: string;
  readonly sender_id: string;
  readonly spark_type: SparkType;
  readonly message: string | null;
  readonly created_at: string;
}


// ============================================================================
// 3. RPC GİRDİ VE ÇIKTI TİPLERİ (Remote Procedure Calls)
// ============================================================================

/**
 * `claim_random_available_star` RPC parametreleri.
 */
export interface ClaimRandomStarParams {
  readonly coupleId: number;
  readonly customName: string;
  readonly maxMagnitude?: number;   // Varsayılan: 6.50
}

/**
 * `claim_specific_star` RPC parametreleri.
 * Kullanıcının MacroSkyCanvas'ta seçtiği belirli yıldıza özel tescil için kullanılır.
 */
export interface ClaimSpecificStarParams {
  readonly coupleId: number;
  readonly starCatalogId: number;   // celestial_catalog.id (BIGINT)
  readonly customName: string;
}

/**
 * `get_my_couple_star_details`, `claim_random_available_star` ve
 * `claim_specific_star` dönüş tipi. Frontend detay panelinde doğrudan kullanılır.
 */
export interface CoupleStarDetails {
  readonly star_id: string;
  readonly couple_id: number;
  readonly catalog_id: number;
  readonly catalog_code: string;
  /**
   * Yıldızın yaygın astronomi adı (Sirius, Vega, Polaris vb.).
   * NULL ise UI'da gösterilmez; yalnızca tanınan parlak yıldızlar için dolu.
   */
  readonly common_name?: string | null;
  readonly custom_name: string;
  readonly ra: number;
  readonly dec: number;
  readonly magnitude: number;
  readonly spectral_type: SpectralType;
  readonly base_color: string;
  readonly luminosity_level: number;
  readonly last_spark_at: string;
  readonly resonance_active: boolean;
  readonly resonance_until: string | null;
  readonly created_at: string;
  readonly can_spark_daily: boolean;
  readonly daily_spark_available_at: string;
  readonly cooldown_remaining_seconds: number;
  readonly exoplanet_count: number;
  readonly total_sparks_count: number;
}

/**
 * `get_stars_in_viewport` RPC parametreleri.
 */
export interface GetStarsViewportParams {
  readonly minRa: number;          // [0, 360]
  readonly maxRa: number;          // [0, 360]
  readonly minDec: number;         // [-90, +90]
  readonly maxDec: number;         // [-90, +90]
  readonly zoomLevel: number;      // 1.0 = geniş, 5.0+ = detay
}

/**
 * `get_stars_in_viewport` sorgusundan dönen satır tipi.
 * 2D Canvas render motoruna doğrudan beslenir.
 */
export interface ViewportStarItem {
  readonly catalog_id: number;
  readonly catalog_code: string;
  readonly ra: number;
  readonly dec: number;
  readonly magnitude: number;
  readonly spectral_type: SpectralType;
  readonly base_color: string;
  /**
   * Yıldızın yaygın astronomi adı (Sirius, Vega, Polaris vb.).
   * NULL ise UI'da gösterilmez; çoğu katalog yıldızı için NULL.
   */
  readonly common_name?: string | null;
  readonly is_claimed: boolean;
  readonly is_mine: boolean;
  /**
   * Yıldızın kullanıcıya özel görüntüleme adı:
   * - `null`: Boşta duran katalog yıldızları (`is_claimed === false`).
   * - `'Tescilli Yıldız'`: Başka bir çiftin tescilli yıldızı (`is_claimed === true && is_mine === false`, mahremiyet maskelemesi).
   * - `string` (gerçek isim): Kullanıcının kendi çiftine ait yıldız (`is_mine === true`).
   */
  readonly custom_name: string | null;
  readonly luminosity_level: number;
  readonly resonance_active: boolean;
}

/**
 * `send_star_spark` RPC parametreleri.
 */
export interface SendStarSparkParams {
  readonly starId: string;
  readonly sparkType?: UserInitiatedSparkType;
  readonly message?: string;
}

/**
 * PostgreSQL trigger P0001/P0002 exception'ı yakalandığında frontend'e iletilen payload.
 */
export interface SparkCooldownError {
  readonly code: 'COOLDOWN_ACTIVE' | 'SPAM_COOLDOWN';
  readonly remainingSeconds: number;
  readonly message: string;
}


// ============================================================================
// 4. KEPLER YÖRÜNGE MEKANİĞİ VE GÖRSELLEŞTİRME
// ============================================================================

/**
 * 5 ayrı Yörünge Kuşağı (Orbital Belt).
 * 1: En iç yörünge (en hızlı), 5: En dış yörünge (en sakin).
 */
export type OrbitZone = 1 | 2 | 3 | 4 | 5;

/**
 * Yörünge mekaniği ve sistem sabitleri.
 * LOCK_NAMESPACE: Advisory lock'larda çakışmayı önlemek için bu dosyada tek
 * yerde tanımlıdır. Yeni advisory lock gerektiren fonksiyonlarda farklı
 * namespace string'leri kullanılmalıdır.
 */
export const ORBIT_CONFIG = {
  /** 5 yörünge kuşağı */
  ZONE_COUNT: 5 as const,
  /** Kuşak 1'in tam 360° tur süresi (saniye) */
  BASE_PERIOD_SEC: 14,
  /**
   * Mobil referans piksel yarıçapları (iPhone 14 bazlı, 390px genişlik).
   * Index 0 kullanılmaz; 1-5 kuşak yarıçaplarıdır.
   * Kepler 3. Yasası: T_zone = BASE_PERIOD_SEC * (R_zone / R_1)^1.5
   * Kuşak 1: 75px → 14.0 sn  |  Kuşak 2: 110px → 25.0 sn
   * Kuşak 3: 145px → 36.4 sn |  Kuşak 4: 180px → 48.0 sn
   * Kuşak 5: 215px → 60.3 sn
   * En yavaş/en hızlı oran: ~4.3x (görsel olarak sakin ama asla donmuş değil)
   */
  BASE_RADII_PX: [0, 75, 110, 145, 180, 215] as const,
  /** Günlük kıvılcım soğuma süresi (saat) */
  DAILY_COOLDOWN_HOURS: 20,
  /** Love ping spam koruması (saniye) */
  PING_COOLDOWN_SECONDS: 60,
  /** Rezonans süresi (dakika) */
  RESONANCE_DURATION_MINUTES: 30,
  /** PostgreSQL advisory lock namespace sabiti */
  LOCK_NAMESPACE: 'claim_star_lock',
} as const;

/**
 * Ekran genişliğine duyarlı (responsive) yörünge boyut bilgisi.
 */
export interface ResponsiveOrbitDimensions {
  readonly zone: OrbitZone;
  readonly radiusPx: number;
  readonly strokeWidth: number;
  readonly orbitOpacity: number;
}

/**
 * Kepler yörünge parametreleri.
 */
export interface KeplerOrbitParams {
  readonly zone: OrbitZone;
  readonly semiMajorAxis: number;        // Yarı büyük eksen (piksel veya normalize koordinat)
  readonly eccentricity: number;          // Basıklık (0 = tam daire, 0.05–0.15 = eliptik)
  readonly inclination: number;           // Yörünge eğikliği (radyan)
  readonly orbitalPeriodSec: number;      // Tam bir periyot süresi (saniye)
  readonly angularVelocity: number;       // Açısal hız (rad/s): ω = 2π / T
  readonly speedMultiplier: number;       // Veritabanı orbit_speed çarpanı
  readonly initialPhaseRad: number;       // Başlangıç anomali açısı θ₀ (çarpışma önleme)
}

/**
 * Her karede Canvas/GPU'ya iletilen hesaplanmış ötegezegen render verisi.
 */
export interface ExoplanetRenderData {
  readonly id: string;
  readonly title: string;
  readonly planetType: PlanetType;
  readonly palette: readonly string[];
  readonly zone: OrbitZone;
  readonly currentAngleRad: number;
  readonly screenX: number;               // Merkeze göre X (piksel)
  readonly screenY: number;               // Merkeze göre Y (piksel)
  readonly depthZ: number;                // z > 0: yıldızın önünde, z < 0: arkasında
  readonly trailPoints: readonly {
    readonly x: number;
    readonly y: number;
    readonly alpha: number;
  }[];
}


// ============================================================================
// 5. BELLEK SIZINTISIZ PARÇACIK MOTORU (Zero-Allocation Particle Pool)
// ============================================================================

export type ParticleBlendMode = 'source-over' | 'lighter' | 'screen';

/**
 * Bellek havuzundaki tekil parçacık yapısı.
 * new/delete edilmez; havuzdan ödünç alınır, sıfırlanır ve geri verilir.
 */
export interface Particle {
  id: number;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  startSize: number;
  endSize: number;
  color: string;
  alpha: number;
  decayRate: number;
  rotation: number;
  angularVelocity: number;
}

/**
 * Parçacık motoru havuz yapılandırması.
 */
export interface ParticlePoolConfig {
  readonly maxParticles: number;     // Maksimum eşzamanlı parçacık (ör: 300)
  readonly emissionRate: number;     // Saniyede üretilen parçacık adedi
  readonly blendMode: ParticleBlendMode;
  readonly gravity: { readonly x: number; readonly y: number };
  readonly drag: number;             // Sürtünme katsayısı (0.95–0.99)
  readonly jitter: number;           // Rastgele saçılma katsayısı
}

/**
 * Yeniden kullanılabilir Parçacık Havuz Arayüzü.
 */
export interface IParticlePool {
  acquire(): Particle | null;
  release(particle: Particle): void;
  update(deltaTimeSec: number): void;
  getActiveParticles(): readonly Particle[];
  getActiveCount(): number;
  reset(): void;
}


// ============================================================================
// 6. MAKRO GÖKYÜZÜ KOORDİNAT SİSTEMİ VE PROJEKSİYON
// ============================================================================

/**
 * Küresel gökyüzü astronomik koordinatları (PostGIS WGS84 eşleniği).
 */
export interface CelestialCoords {
  readonly ra: number;               // Right Ascension: 0°–360°
  readonly dec: number;              // Declination: -90°–+90°
}

/**
 * 2D ekran Canvas koordinatları.
 */
export interface ScreenCoords {
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
  readonly radius: number;
  readonly opacity: number;          // [0, 1]
  readonly glowRadius: number;
}

/**
 * Kullanıcı kamerası ve görüş alanı durumu.
 */
export interface SkyCameraState {
  readonly centerRa: number;
  readonly centerDec: number;
  readonly zoom: number;             // [1.0, 10.0]
  readonly fovRa: number;            // Ekrana sığan RA genişliği (derece)
  readonly fovDec: number;           // Ekrana sığan Dec yüksekliği (derece)
  readonly viewportWidth: number;    // Ekran genişliği (piksel)
  readonly viewportHeight: number;   // Ekran yüksekliği (piksel)
}

/**
 * Gökyüzü haritası projeksiyon tipi.
 */
export type SkyProjectionType =
  | 'equirectangular'   // Hızlı, düz silindirik projeksiyon (harita kaydırma)
  | 'stereographic'     // Küresel gökkubbe hissi veren konformal projeksiyon
  | 'orthographic';     // Uzaydan küreye bakış


// ============================================================================
// 7. GERÇEK ZAMANLI SENKRONİZASYON VE WEBSOCKET (Supabase Realtime)
// ============================================================================

/**
 * Supabase Broadcast Kanalı: `star-resonance:{starId}`
 * Partner kıvılcım gönderdiğinde diğer eşin ekranında anında patlar.
 */
export interface SparkBroadcastPayload {
  readonly starId: string;
  readonly senderId: string;
  readonly senderName: string;
  readonly sparkType: SparkType;
  readonly message?: string;
  readonly newLuminosity: number;
  readonly timestamp: string;        // ISO 8601 UTC
}

/**
 * Eşlerin aynı anda yıldıza girmesiyle oluşan Rezonans Etkinliği.
 */
export interface ResonanceEvent {
  readonly starId: string;
  readonly active: boolean;
  readonly partnersOnline: readonly string[];
  readonly triggeredAt: string;
  readonly expiresAt: string;
}

/**
 * Supabase Presence Kanalı: Haritada veya yıldızda anlık kullanıcı varlığı.
 */
export interface StarPresenceState {
  readonly userId: string;
  readonly coupleId: number;
  readonly currentStarId: string | null; // null ise Makro Gökyüzünde geziyor
  readonly enteredAt: string;
}


// ============================================================================
// 8. YARDIMCI HESAPLAMA FONKSİYONLARI
// ============================================================================

/**
 * Kuşak ve hız çarpanına göre Kepler açısal hızını (rad/s) hesaplar.
 *
 * Formül:
 *   rRatio = R_zone / R_1
 *   T_zone = T_base × rRatio^1.5    (Kepler 3. Yasası: T² ∝ a³)
 *   ω = (2π / T_zone) × speedMultiplier
 */
export function calculateOrbitalAngularVelocity(
  zone: OrbitZone,
  speedMultiplier: number = 1.0,
): number {
  const baseT = ORBIT_CONFIG.BASE_PERIOD_SEC;
  const radii = ORBIT_CONFIG.BASE_RADII_PX;
  const rRatio = radii[zone] / radii[1];
  const period = baseT * Math.pow(rRatio, 1.5);
  return ((2 * Math.PI) / period) * speedMultiplier;
}

/**
 * Cihaz genişliğine duyarlı (responsive) yörünge piksel yarıçapını döndürür.
 *
 * iPhone 14 bazlı (390px) referans alınarak, ekran küçüldüğünde yarıçaplar
 * orantılı daralır, büyüdüğünde genişler. Min 0.75x, Max 1.3x ölçekleme.
 */
export function getResponsiveOrbitRadius(
  zone: OrbitZone,
  screenWidth: number,
): number {
  const referenceWidth = 390; // iPhone 14 baz genişliği
  const scaleFactor = Math.min(1.3, Math.max(0.75, screenWidth / referenceWidth));
  return ORBIT_CONFIG.BASE_RADII_PX[zone] * scaleFactor;
}

// ============================================================================
// 9. YILDIZ BAĞLANTILARI (STAGE 5 — ARKADAŞ ÇİFT BAĞLANTILARI)
// ============================================================================

export type StarConnectionStatus = 'pending' | 'accepted' | 'rejected';

export interface StarConnectionRecord {
  readonly id: string;
  readonly star_a_id: string;
  readonly star_b_id: string;
  readonly status: StarConnectionStatus;
  readonly requested_by_couple_id: number;
  readonly created_at: string;
  readonly responded_at: string | null;
}

export interface StarSearchResult {
  readonly star_id: string;
  readonly custom_name: string;
  readonly catalog_code: string;
  readonly ra: number;
  readonly dec: number;
}

export interface ActiveStarConnection {
  readonly connection_id: string;
  readonly other_star_id: string;
  readonly other_star_name: string;
  readonly other_star_ra: number;
  readonly other_star_dec: number;
}

export interface PendingConnectionDetail {
  readonly connection_id: string;
  readonly other_star_id: string;
  readonly other_star_name: string;
  readonly is_incoming: boolean;
  readonly created_at: string;
}


// ============================================================================
// 10. GÖKYÜZÜ SEKTÖRLERİ (STAGE 6 — SANAL GÖKYÜZÜ SEKTÖRLERİ)
// ============================================================================

/**
 * `claim_star_in_sector` RPC parametreleri.
 * Sınır koordinatları client'tan gönderilmez; fonksiyon bunları sky_sectors tablosundan çeker.
 */
export interface ClaimStarInSectorParams {
  readonly coupleId: number;
  readonly sectorId: string;
  readonly customName: string;
}

/**
 * `get_sectors_overview` RPC'sinden dönen her bir sektörün dinamik verileri.
 * Statik veriler (isim, renk, açıklama) client-side skySectors.data.ts içindedir.
 */
export interface SectorDynamicOverview {
  readonly sector_id: string;
  readonly claimed_stars_count: number;
  readonly available_stars_count: number;
  readonly sector_energy: number;
  readonly has_friends_here: boolean;
}

/**
 * Sinematik kamera uçuş hedef koordinatları.
 */
export interface FlyToTarget {
  readonly centerRa: number;
  readonly centerDec: number;
  readonly zoom?: number;
  readonly nonce?: number;
}

export interface CelestialSearchResult {
  readonly entity_id: string;
  readonly entity_type: 'common' | 'custom' | 'catalog' | 'exoplanet';
  readonly display_name: string;
  readonly catalog_code: string;
  readonly ra: number;
  readonly dec: number;
  readonly is_own_star: boolean;
}
