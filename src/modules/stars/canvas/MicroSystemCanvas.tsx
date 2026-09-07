/**
 * @file MicroSystemCanvas.tsx
 * @module modules/stars/canvas
 * @description Mikro Yıldız Sistemi & Anı Ötegezegenleri Kepler Render Motoru
 *
 * Mimari İlkeler:
 * - Responsive Yarıçap Senkronu: star.types.ts içindeki getResponsiveOrbitRadius(zone, screenWidth)
 *   doğrudan kullanılır. HiDPI ctx.scale(dpr, dpr) zaten mantıksal piksel koordinatlarını
 *   sabitlediği için dönen piksel değeri ASLA ikinci bir katsayıyla çarpılmaz (çift ölçekleme yok).
 * - Tekil Zaman Parametresi: requestAnimationFrame(timestamp) → t = timestamp / 1000
 *   tüm animasyon hesaplamalarında (korona, rezonans, Kepler) tek kaynak doğru olarak kullanılır.
 * - ctx.setLineDash Sıfırlama: Yörünge çizgilerinden sonra ASLA ctx.setLineDash([]) sıfırlanmadan
 *   geçilmez; ctx.save()/ctx.restore() ile katman izolasyonu sağlanır.
 * - Unmount Temizliği: cancelAnimationFrame ve pool.reset() ile bellek ve döngü güvenliği.
 * - IExtendedParticlePool: spawn ve render çağrıları tip güvenliğiyle çalışır.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';
import type {
  CoupleStarDetails,
  StarExoplanetRecord,
  OrbitZone,
  PlanetType,
} from '@/modules/stars/types/star.types';
import {
  getResponsiveOrbitRadius,
  calculateOrbitalAngularVelocity,
  ORBIT_CONFIG,
} from '@/modules/stars/types/star.types';
import { createParticlePool } from './ParticlePool';
import type { IExtendedParticlePool } from './ParticlePool';

// ============================================================================
// TİP TANIMLAMALARI
// ============================================================================

export interface MicroSystemCanvasProps {
  /** Merkez yıldızın tam detay verisi (luminosity, resonance, custom_name vb.) */
  readonly starDetails: CoupleStarDetails;
  /** Bu yıldızın yörüngesindeki tüm anı ötegezegenleri. */
  readonly exoplanets: StarExoplanetRecord[];
  /** Yörüngede dönen bir ötegezegene tıklandığında tetiklenir. */
  readonly onSelectPlanet?: (planet: StarExoplanetRecord) => void;
  /** Merkez yıldıza tıklandığında tetiklenir. */
  readonly onSelectCenterStar?: (star: CoupleStarDetails) => void;
  /** onSelectCenterStar ile eş işlevli; geriye dönük uyumluluk alias'ı. */
  readonly onSelectStar?: (star: CoupleStarDetails) => void;
  readonly width?: number;
  readonly height?: number;
  readonly style?: object;
  readonly className?: string;
}

// ============================================================================
// SABİTLER
// ============================================================================

const MIN_PLANET_TOUCH_RADIUS_PX = 28;
const CENTER_STAR_TOUCH_RADIUS_PX = 40;
const CENTER_STAR_BASE_RADIUS = 22;

// Rezonans animasyon açısal hızları (rad/s)
const RESONANCE_OUTER_ANGULAR_VELOCITY = 0.6; // Altın halka
const RESONANCE_INNER_ANGULAR_VELOCITY = 0.4; // Mor/eflatun iç ark (ters yön)

// Nefes alan korona parametreleri
const CORONA_BREATH_RATE = 1.8;              // Hz
const CORONA_BREATH_AMPLITUDE = 0.08;        // ±%8 boyut salınımı

// Kozmik toz emisyon aralığı (saniye)
const DUST_EMISSION_INTERVAL_SEC = 0.18;

// Gezegen tiplerine göre görsel yarıçap
const PLANET_RADIUS_BY_TYPE: Record<PlanetType, number> = {
  terrestrial: 8,
  gas_giant: 13,
  ice_world: 9,
  ocean_world: 9,
  crystal: 8,
  volcanic: 9,
  desert: 8,
  ringed_giant: 12,
};

// ============================================================================
// YARDIMCI FONKSİYONLAR
// ============================================================================

/**
 * Gezegen ID'sinden deterministik, tekrarlanabilir bir başlangıç açısı üretir.
 * Aynı kuşaktaki iki gezegen ASLA aynı theta_0 ile başlamaz.
 * `new` kullanılmaz — sadece string karakterleri üzerinde saf sayısal işlem.
 */
function deterministicInitialPhase(planetId: string): number {
  let hash = 0;
  for (let i = 0; i < planetId.length; i++) {
    hash = (hash * 31 + planetId.charCodeAt(i)) >>> 0;
  }
  return (hash % 360) * (Math.PI / 180);
}

/**
 * İki boyutlu gradient oluşturmak için hex renk dizisinden Canvas LinearGradient verir.
 * Palet boşsa varsayılan kozmik mavi gradyan kullanılır.
 */
function buildPlanetGradient(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  palette: readonly string[],
): CanvasGradient {
  const colors = palette.length >= 2 ? palette : ['#4facfe', '#00f2fe'];
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  colors.forEach((color, i) => {
    grad.addColorStop(i / (colors.length - 1), color);
  });
  return grad;
}

/**
 * hex renk kodunu r, g, b string'ine çevirir (rgba kullanımı için).
 */
function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return '200, 200, 255';
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// ============================================================================
// ANA BILEŞEN
// ============================================================================

/**
 * Mikro Yıldız Sistemi Canvas Render Motoru.
 *
 * Merkez yıldız etrafında Kepler mekaniğiyle dönen anı ötegezegenlerini,
 * nefes alan korona ışımasını, rezonans halkalarını ve kozmik toz parçacıklarını
 * sıfır React state olmadan 60 FPS ile çizer.
 */
export function MicroSystemCanvas({
  starDetails,
  exoplanets,
  onSelectPlanet,
  onSelectCenterStar,
  onSelectStar,
  width,
  height,
}: MicroSystemCanvasProps) {
  const { width: screenW } = Dimensions.get('window');
  const canvasWidth = width ?? screenW;
  const canvasHeight = height ?? screenW; // Kare canvas varsayılan

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastDustEmitRef = useRef<number>(0);

  // Mutable props referansları — animasyon döngüsünü restart etmeden anlık değer okuma
  const starDetailsRef = useRef(starDetails);
  starDetailsRef.current = starDetails;

  const exoplanetsRef = useRef(exoplanets);
  exoplanetsRef.current = exoplanets;

  const callbacksRef = useRef({ onSelectPlanet, onSelectCenterStar, onSelectStar });
  callbacksRef.current = { onSelectPlanet, onSelectCenterStar, onSelectStar };

  // Parçacık havuzu — bileşen yaşamı boyunca aynı örnek kullanılır
  const poolRef = useRef<IExtendedParticlePool>(
    createParticlePool({
      maxParticles: 80,
      blendMode: 'lighter',
      gravity: { x: 0, y: -6 },
      drag: 0.96,
      jitter: 0.5,
    }),
  );

  // Gezegen ekran koordinatları — hit-testing için render dışında referans
  const planetScreensRef = useRef<{
    planet: StarExoplanetRecord;
    x: number;
    y: number;
    radius: number;
  }[]>([]);

  // ─── ANA RENDER FONKSİYONU ─────────────────────────────────────────

  function drawFrame(timestamp: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const starDetails = starDetailsRef.current;
    const exoplanets = exoplanetsRef.current;

    // t: Evrensel zaman parametresi (saniye) — tüm animasyonlar buradan beslenir
    const t = timestamp / 1000;
    const deltaTimeSec = lastTimeRef.current > 0
      ? Math.min(0.05, (timestamp - lastTimeRef.current) / 1000)
      : 0.016;
    lastTimeRef.current = timestamp;

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const W = canvasWidth;
    const H = canvasHeight;
    const cx = W / 2;
    const cy = H / 2;

    // HiDPI ölçekleme
    if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Arka plan
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
    bg.addColorStop(0, '#0D0B1F');
    bg.addColorStop(1, '#030207');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ─── KOZMIK TOZ PARTİKÜLLERİ (Ambient Stardust) ──────────────────
    // Merkez yıldızdan sakin, yavaş yükselen toz emisyonu
    if (t - lastDustEmitRef.current > DUST_EMISSION_INTERVAL_SEC) {
      lastDustEmitRef.current = t;
      const angle = Math.random() * Math.PI * 2;
      const spawnDist = CENTER_STAR_BASE_RADIUS + Math.random() * 10;
      const spawnX = cx + Math.cos(angle) * spawnDist;
      const spawnY = cy + Math.sin(angle) * spawnDist;

      const dustColor = starDetails.resonance_active
        ? (Math.random() > 0.5 ? '#F59E0B' : '#A855F7')
        : starDetails.base_color;

      poolRef.current.spawn(spawnX, spawnY, {
        vx: Math.cos(angle) * (5 + Math.random() * 12),
        vy: Math.sin(angle) * (5 + Math.random() * 12) - 8,
        life: 1.2 + Math.random() * 0.8,
        maxLife: 2.0,
        startSize: 1.5 + Math.random() * 1.5,
        endSize: 0,
        color: dustColor,
        alpha: 0.6 + Math.random() * 0.4,
        decayRate: 0.7,
      });
    }

    // Parçacıkları güncelle
    poolRef.current.update(deltaTimeSec);

    // ─── YÖRÜNGELERİ ÇİZ ─────────────────────────────────────────────
    // ctx.save/restore ve setLineDash([]) ile tam izolasyon
    ctx.save();
    ctx.setLineDash([4, 8]);
    ctx.lineWidth = 0.6;

    for (let zone = 1; zone <= ORBIT_CONFIG.ZONE_COUNT; zone++) {
      // getResponsiveOrbitRadius doğrudan kullanılır — HiDPI dpr ile ÇARPILMAZ (çift ölçekleme önleme)
      const orbitRadius = getResponsiveOrbitRadius(zone as OrbitZone, canvasWidth);
      const zoneOpacity = 0.08 + (zone / ORBIT_CONFIG.ZONE_COUNT) * 0.06;

      ctx.strokeStyle = `rgba(180, 180, 255, ${zoneOpacity})`;
      ctx.beginPath();
      ctx.arc(cx, cy, orbitRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Yörünge kesik çizgisini sıfırla — sonraki hiçbir çizim kesik görünmez
    ctx.setLineDash([]);
    ctx.restore();

    // ─── MERKEZ YILDIZ: NEFES ALAN KORONA ────────────────────────────
    // pulse = 1.0 + 0.08 * sin(t * 1.8) — aynı t, senkronize
    const pulse = 1.0 + CORONA_BREATH_AMPLITUDE * Math.sin(t * CORONA_BREATH_RATE);
    const starRadius = CENTER_STAR_BASE_RADIUS * pulse;
    const luminosity = starDetails.luminosity_level ?? 1.0;
    const starColor = starDetails.base_color || '#9DB4FF';

    // Dış korona ışıması
    ctx.globalCompositeOperation = 'lighter';
    const coronaGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, starRadius * 3.5);
    coronaGlow.addColorStop(0, `rgba(${hexToRgb(starColor)}, ${0.5 * luminosity})`);
    coronaGlow.addColorStop(0.5, `rgba(${hexToRgb(starColor)}, ${0.15 * luminosity})`);
    coronaGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(cx, cy, starRadius * 3.5, 0, Math.PI * 2);
    ctx.fillStyle = coronaGlow;
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Yıldız çekirdeği
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, starRadius);
    coreGrad.addColorStop(0, '#FFFFFF');
    coreGrad.addColorStop(0.3, starColor);
    coreGrad.addColorStop(1, `rgba(${hexToRgb(starColor)}, 0.8)`);
    ctx.beginPath();
    ctx.arc(cx, cy, starRadius, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // ─── REZONANS HALKALARI (resonance_active: true) ──────────────────
    // θ₁ = (t * 0.6) % 2π — dış altın halka (saat yönü)
    // θ₂ = (-t * 0.4) % 2π — iç eflatun ark (ters yön)
    // İkisi de aynı t parametresinden senkronize türetilir
    if (starDetails.resonance_active) {
      const theta1 = (t * RESONANCE_OUTER_ANGULAR_VELOCITY) % (Math.PI * 2);
      const theta2 = (-(t * RESONANCE_INNER_ANGULAR_VELOCITY)) % (Math.PI * 2);
      const ringRadius = starRadius + 8 + 2 * Math.sin(t * 2.5);

      ctx.save();
      // Dış altın rezonans arkı
      ctx.strokeStyle = `rgba(245, 158, 11, ${0.7 * luminosity})`;
      ctx.lineWidth = 1.8;
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius, theta1, theta1 + Math.PI * 1.4);
      ctx.stroke();

      // İç eflatun/mor rezonans arkı (ters yön)
      ctx.strokeStyle = `rgba(168, 85, 247, ${0.6 * luminosity})`;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = '#A855F7';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, ringRadius - 5, theta2, theta2 + Math.PI * 1.1);
      ctx.stroke();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ─── ÖTEGEZEGENLERİ ÇİZ ──────────────────────────────────────────
    // Dokunma tespiti için ekran koordinatlarını kaydet
    if (planetScreensRef.current.length !== exoplanets.length) {
      planetScreensRef.current = new Array(exoplanets.length).fill(null).map(() => ({
        planet: exoplanets[0],
        x: 0,
        y: 0,
        radius: 0,
      }));
    }

    for (let i = 0; i < exoplanets.length; i++) {
      const planet = exoplanets[i];
      const zone = planet.orbit_distance as OrbitZone;

      // Yörünge yarıçapı: getResponsiveOrbitRadius ile hesaplanır, DPR ile ÇARPILMAZ
      const orbitRadius = getResponsiveOrbitRadius(zone, canvasWidth);

      // Kepler açısal hız
      const omega = calculateOrbitalAngularVelocity(zone, planet.orbit_speed);

      // Deterministik başlangıç açısı (ID'den, aynı kuşakta çakışma önleme)
      const theta0 = deterministicInitialPhase(planet.id);

      // Anlık açı: θ = (t * ω + θ₀) mod 2π
      const angle = (t * omega + theta0) % (Math.PI * 2);

      const px = cx + Math.cos(angle) * orbitRadius;
      const py = cy + Math.sin(angle) * orbitRadius;
      const pRadius = PLANET_RADIUS_BY_TYPE[planet.planet_type] ?? 8;

      // Hit-testing için kaydet
      planetScreensRef.current[i] = { planet, x: px, y: py, radius: pRadius };

      // Gezegen atmosfer aurası
      ctx.globalCompositeOperation = 'lighter';
      const aurora = ctx.createRadialGradient(px, py, 0, px, py, pRadius * 2.2);
      const auraColor = planet.palette[0] ?? '#4facfe';
      aurora.addColorStop(0, `rgba(${hexToRgb(auraColor)}, 0.3)`);
      aurora.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(px, py, pRadius * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = aurora;
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // Gezegen gövdesi
      const grad = buildPlanetGradient(ctx, px, py, pRadius, planet.palette);
      ctx.beginPath();
      ctx.arc(px, py, pRadius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Halkalı gezegen türleri için eliptik halkalar
      if (planet.planet_type === 'ringed_giant' || planet.planet_type === 'gas_giant') {
        ctx.save();
        ctx.translate(px, py);
        ctx.scale(1, 0.3);
        ctx.strokeStyle = `rgba(${hexToRgb(planet.palette[1] ?? planet.palette[0] ?? '#FFFFFF')}, 0.5)`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, pRadius * 1.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ─── PARTİKÜLLERİ ÇİZ ────────────────────────────────────────────
    poolRef.current.render(ctx);

    // Restore DPR scale
    ctx.restore();

    // Sonraki kare
    animFrameRef.current = requestAnimationFrame(drawFrame);
  }

  // ─── DOKUNMA ALGILAMA ─────────────────────────────────────────────

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const scaleX = canvasWidth / (rect.width || canvasWidth);
    const scaleY = canvasHeight / (rect.height || canvasHeight);
    const touchX = (e.clientX - rect.left) * scaleX;
    const touchY = (e.clientY - rect.top) * scaleY;

    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    const starDetails = starDetailsRef.current;
    const { onSelectCenterStar, onSelectStar, onSelectPlanet } = callbacksRef.current;

    // Merkez yıldıza tıklama kontrolü
    const dxCenter = touchX - cx;
    const dyCenter = touchY - cy;
    const distCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);
    if (distCenter <= CENTER_STAR_TOUCH_RADIUS_PX) {
      onSelectCenterStar?.(starDetails);
      onSelectStar?.(starDetails); // Alias

      // Merkez yıldız tıklanınca kısa kıvılcım patlaması
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        poolRef.current.spawn(cx, cy, {
          vx: Math.cos(angle) * (40 + Math.random() * 30),
          vy: Math.sin(angle) * (40 + Math.random() * 30),
          life: 0.6 + Math.random() * 0.4,
          maxLife: 1.0,
          startSize: 3,
          endSize: 0,
          color: starDetails.resonance_active ? '#F59E0B' : starDetails.base_color,
          decayRate: 1.2,
        });
      }
      return;
    }

    // Ötegezegenlere tıklama — en yakın gezegeni bul
    let minDist = Infinity;
    let nearestPlanet: StarExoplanetRecord | null = null;

    for (const item of planetScreensRef.current) {
      if (!item) continue;
      const touchRadius = Math.max(item.radius + 18, MIN_PLANET_TOUCH_RADIUS_PX);
      const dx = touchX - item.x;
      const dy = touchY - item.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= touchRadius && dist < minDist) {
        minDist = dist;
        nearestPlanet = item.planet;
      }
    }

    if (nearestPlanet) {
      onSelectPlanet?.(nearestPlanet);
    }
  }

  // ─── YAŞAM DÖNGÜSÜ ────────────────────────────────────────────────

  // Farklı bir yıldıza geçildiğinde parçacık havuzunu temizle
  const lastStarIdRef = useRef(starDetails.star_id);
  useEffect(() => {
    if (lastStarIdRef.current !== starDetails.star_id) {
      lastStarIdRef.current = starDetails.star_id;
      poolRef.current.reset();
      lastDustEmitRef.current = 0;
    }
  }, [starDetails.star_id]);

  // Animasyon döngüsü: SADECE mount anında başlar, unmount'ta sonlanır.
  // resonance_active veya luminosity_level değişimlerinde ASLA restart EDİLMEZ.
  // Bu değerler doğrudan starDetailsRef.current üzerinden okunur; böylece
  // deltaTimeSec kesintiye uğramaz ve gereksiz rAF döngü iptalleri engellenir.
  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(drawFrame);
    const pool = poolRef.current;

    return () => {
      // Unmount: döngü ve bellek temizliği — sıfır sızıntı garantisi
      cancelAnimationFrame(animFrameRef.current);
      pool.reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── RENDER ───────────────────────────────────────────────────────

  if (Platform.OS !== 'web') {
    // Placeholder: Native build için expo-skia veya react-native-canvas entegrasyonu gereklidir.
    return <View style={[styles.container, { width: canvasWidth, height: canvasHeight }]} />;
  }

  return (
    <View style={[styles.container, { width: canvasWidth, height: canvasHeight }]}>
      <canvas
        ref={canvasRef}
        style={{ width: canvasWidth, height: canvasHeight, display: 'block', touchAction: 'none' }}
        onPointerUp={handlePointerUp}
      />
    </View>
  );
}

// ============================================================================
// STİLLER
// ============================================================================

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#030207',
  },
});

export default MicroSystemCanvas;
