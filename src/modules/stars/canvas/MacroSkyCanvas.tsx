/**
 * @file MacroSkyCanvas.tsx
 * @module modules/stars/canvas
 * @description Makro Gökyüzü 2D Harita Motoru
 *
 * Mimari İlkeler:
 * - Filtreleme Yasaktır: Backend `get_stars_in_viewport` RPC'sinden gelen
 *   ViewportStarItem[] dizisi üzerinde istemci taraflı ASLA ek filtreleme yapılmaz.
 * - HiDPI Ölçekleme: window.devicePixelRatio ile mantıksal piksel koordinatları sabitleniir.
 * - Kamera State Sahipliği: Pan/zoom sırasında React re-render darboğazını önlemek
 *   için cameraRef = useRef<SkyCameraState> kullanılır.
 * - Re-render Stabilitesi: Yeni stars prop'u geldiğinde cameraRef.current ASLA
 *   sıfırlanmaz; mevcut kamera konumu korunur.
 * - initialCamera: Yalnızca ilk mount anında (isInitializedRef.current === false) okunur.
 * - 4-Aşamalı Multi-Pass Rendering: 4 bağımsız for döngüsü ile Z-index katmanları
 *   birbirini asla kesmez ve context state geçişleri minimize edilir.
 * - Hit-Testing: Minimum 24px dokunmatik yarıçap; en yakın yıldız seçilir.
 * - 200ms Debounce: onBoundsChange yalnızca hareket tamamlandıktan 200ms sonra tetiklenir.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import type {
  ViewportStarItem,
  SkyCameraState,
} from '@/modules/stars/types/star.types';

// ============================================================================
// TİP TANIMLAMALARI
// ============================================================================

export interface MacroSkyBounds {
  readonly minRa: number;
  readonly maxRa: number;
  readonly minDec: number;
  readonly maxDec: number;
  readonly zoomLevel: number;
}

export interface MacroSkyCanvasProps {
  /** Backend'den gelen, bounding box içindeki yıldızlar. İstemci tarafında filtreleme YAPILMAZ. */
  readonly stars: ViewportStarItem[];
  /** Yalnızca ilk mount anında okunur; sonraki re-render'larda kamera konumu korunur. */
  readonly initialCamera?: Partial<SkyCameraState>;
  /**
   * Ebeveyn bileşenin haritayı programatik olarak belirli bir noktaya taşımasını sağlar.
   * (ör. "Yıldızıma Git" butonu). Değiştiğinde kamera pürüzsüz animasyonla hedefe taşınır.
   */
  readonly targetCamera?: { readonly centerRa: number; readonly centerDec: number; readonly zoom?: number };
  /** Hit-testing ile seçilen yıldızın tam ViewportStarItem verisini iletir. */
  readonly onSelectStar?: (star: ViewportStarItem) => void;
  /**
   * Pan/zoom durduğunda 200ms debounce ile tetiklenir.
   * Üst bileşen bu bounds ile yeni Supabase RPC çağrısı yapar.
   */
  readonly onBoundsChange?: (bounds: MacroSkyBounds) => void;
  /** Anlık kamera durumunu üst bileşene bildirir (HUD koordinat göstergesi vb. için). */
  readonly onCameraChange?: (camera: SkyCameraState) => void;
  readonly width?: number;
  readonly height?: number;
  readonly style?: object;
  readonly className?: string;
}

// ============================================================================
// SABİTLER
// ============================================================================

const MIN_ZOOM = 1.0;
const MAX_ZOOM = 8.0;
const MIN_TOUCH_RADIUS_PX = 24;
const BOUNDS_DEBOUNCE_MS = 200;

// Tayf sınıfına göre görsel yıldız yarıçapı (mantıksal piksel)
const STAR_BASE_RADIUS_PX: Record<string, number> = {
  O: 3.5, B: 3.2, A: 3.0, F: 2.8, G: 2.6, K: 2.4, M: 2.2,
};
const FALLBACK_STAR_RADIUS = 2.4;

// ============================================================================
// YARDIMCI FONKSİYONLAR
// ============================================================================

/**
 * Mevcut kamera durumundan görünür RA/Dec sınır kutusunu hesaplar.
 * 0°/360° meridyen sarmalını min_ra > max_ra şeklinde kodlar (backend uyumlu).
 */
function computeBounds(camera: SkyCameraState): MacroSkyBounds {
  const fovDec = 60 / camera.zoom;
  const fovRa = fovDec * (camera.viewportWidth / camera.viewportHeight);

  let minRa = camera.centerRa - fovRa / 2;
  let maxRa = camera.centerRa + fovRa / 2;
  const minDec = Math.max(-90, camera.centerDec - fovDec / 2);
  const maxDec = Math.min(90, camera.centerDec + fovDec / 2);

  // 0°/360° meridyen sarmalı: negatif ve 360°'yi aşan değerleri normalize et
  if (minRa < 0) minRa = ((minRa % 360) + 360) % 360;
  if (maxRa > 360) maxRa = maxRa % 360;

  return { minRa, maxRa, minDec, maxDec, zoomLevel: camera.zoom };
}

/**
 * RA/Dec astronomik koordinatlarını Canvas ekran koordinatlarına dönüştürür.
 * Δra = ((ra - centerRa + 540) mod 360) - 180 formülü ile 0°/360° dikişini zarif kapatır.
 */
function projectToScreen(
  ra: number,
  dec: number,
  camera: SkyCameraState,
  width: number,
  height: number,
): { x: number; y: number } {
  const fovDec = 60 / camera.zoom;
  const fovRa = fovDec * (width / height);

  const deltaRa = ((ra - camera.centerRa + 540) % 360) - 180;
  const deltaDec = dec - camera.centerDec;

  const x = width / 2 + (deltaRa / fovRa) * width;
  const y = height / 2 - (deltaDec / fovDec) * height;

  return { x, y };
}

/**
 * Magnitude değerini [0.0, 1.0] parlaklık alfa değerine dönüştürür.
 * Düşük magnitude = parlak yıldız.
 */
function magnitudeToAlpha(magnitude: number, luminosity: number): number {
  // Magnitude -2 (çok parlak) ile 9 (sönük) arasında normalize et
  const normalized = Math.max(0, Math.min(1, 1 - (magnitude + 2) / 11));
  return 0.4 + normalized * 0.6 * luminosity;
}

/**
 * Magnitude değerini görünür yıldız yarıçapına (px) dönüştürür.
 */
function magnitudeToRadius(magnitude: number, spectralType: string, zoom: number): number {
  const baseClass = spectralType.charAt(0).toUpperCase();
  const baseRadius = STAR_BASE_RADIUS_PX[baseClass] ?? FALLBACK_STAR_RADIUS;

  // Parlak yıldızlar daha büyük; magnitude ne kadar düşükse o kadar büyük
  const scale = Math.max(0.5, Math.min(2.5, 1 + (3 - magnitude) * 0.2));
  const zoomBonus = Math.min(1.4, 1 + (zoom - 1) * 0.08);

  return baseRadius * scale * zoomBonus;
}

// ============================================================================
// ANA BILEŞEN
// ============================================================================

/**
 * Makro Gökyüzü 2D Canvas Render Motoru.
 *
 * React Native ortamında Canvas yerine HTML <canvas> elemanı kullanmak için
 * Expo SDK 57+ ile birlikte gelen expo-webview veya React Native Web gerektiren
 * senaryolarda `Platform.select` ile uygun implementasyon seçilebilir.
 * Bu dosya, Web (expo web) ve web tabanlı test ortamları için optimize edilmiştir.
 */
export function MacroSkyCanvas({
  stars,
  initialCamera,
  targetCamera,
  onSelectStar,
  onBoundsChange,
  onCameraChange,
  width = 390,
  height = 844,
}: MacroSkyCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Kamera durumu useRef ile yönetilir; React re-render'ını tetiklemez ve
  // yeni stars prop'u geldiğinde (onBoundsChange → RPC → yeni veri) ASLA sıfırlanmaz.
  const cameraRef = useRef<SkyCameraState>({
    centerRa: initialCamera?.centerRa ?? 180,
    centerDec: initialCamera?.centerDec ?? 0,
    zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialCamera?.zoom ?? 1.0)),
    fovRa: 60,
    fovDec: 60,
    viewportWidth: width,
    viewportHeight: height,
  });

  // initialCamera yalnızca ilk mount anında okunur. Sonraki prop değişimlerinde
  // kamera konumu korunur — yeni stars verisi geldiğinde pan/zoom kaybı OLMAZ.
  const isInitializedRef = useRef(false);

  // Yıldızların hesaplanmış ekran koordinatları; render'da referans için kullanılır.
  // Obje tahsisi render döngüsü dışında yapılır.
  const screenPositionsRef = useRef<Array<{ x: number; y: number; radius: number }>>([]);

  // Debounce timer referansı
  const boundsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sürükleme durum referansı
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startRa: number;
    startDec: number;
  }>({ active: false, startX: 0, startY: 0, startRa: 180, startDec: 0 });

  // -------------------------------------------------------------------
  // BOUNDS DEĞİŞİMİ DEBOUNCE YARDIMCISI
  // -------------------------------------------------------------------
  const fireBoundsChange = useCallback(() => {
    if (!onBoundsChange) return;
    if (boundsDebounceRef.current) clearTimeout(boundsDebounceRef.current);
    boundsDebounceRef.current = setTimeout(() => {
      onBoundsChange(computeBounds(cameraRef.current));
    }, BOUNDS_DEBOUNCE_MS);
  }, [onBoundsChange]);

  // -------------------------------------------------------------------
  // HEDEF KAMERA DEĞİŞİMİ (Programatik Odaklama)
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!targetCamera) return;
    cameraRef.current = {
      ...cameraRef.current,
      centerRa: targetCamera.centerRa,
      centerDec: targetCamera.centerDec,
      zoom: targetCamera.zoom ?? cameraRef.current.zoom,
    };
    onCameraChange?.(cameraRef.current);
    fireBoundsChange();
    renderFrame();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetCamera?.centerRa, targetCamera?.centerDec, targetCamera?.zoom]);

  // -------------------------------------------------------------------
  // 4-AŞAMALI MULTI-PASS RENDER MOTORU
  // -------------------------------------------------------------------
  function renderFrame() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

    // HiDPI: Canvas piksel boyutunu cihaz DPR'ı ile büyüt, mantıksal koordinatları sabitle
    const logicalW = width;
    const logicalH = height;

    if (canvas.width !== Math.floor(logicalW * dpr) || canvas.height !== Math.floor(logicalH * dpr)) {
      canvas.width = Math.floor(logicalW * dpr);
      canvas.height = Math.floor(logicalH * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Gökyüzü arka planı
    ctx.clearRect(0, 0, logicalW, logicalH);
    const bgGradient = ctx.createRadialGradient(
      logicalW / 2, logicalH / 2, 0,
      logicalW / 2, logicalH / 2, Math.max(logicalW, logicalH) * 0.7,
    );
    bgGradient.addColorStop(0, '#0A0F1E');
    bgGradient.addColorStop(1, '#020408');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, logicalW, logicalH);

    const camera = cameraRef.current;

    // Ekran koordinatlarını hesapla ve ref'te sakla (tahsis render dışında)
    if (screenPositionsRef.current.length !== stars.length) {
      screenPositionsRef.current = new Array(stars.length);
    }
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      const { x, y } = projectToScreen(star.ra, star.dec, camera, logicalW, logicalH);
      const radius = magnitudeToRadius(star.magnitude, star.spectral_type, camera.zoom);
      screenPositionsRef.current[i] = { x, y, radius };
    }

    // ─── PASS 1: Işımalar (Glows) ─────────────────────────────────────
    // is_claimed === true olan tüm yıldızlar için arka ışıma çizilir.
    // Bu geçiş önce yapılır; böylece diğer katmanlar (core, ring, label)
    // asla ışıma tarafından örtülmez.
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      if (!star.is_claimed) continue;

      const { x, y, radius } = screenPositionsRef.current[i];
      const glowRadius = radius + 16;

      const baseColor = star.base_color || '#9DB4FF';
      const luminosity = star.luminosity_level ?? 1.0;

      // Rezonans aktifse altın/eflatun, yoksa yıldız rengiyle ışıma
      const innerColor = star.resonance_active
        ? `rgba(245, 158, 11, ${0.4 * luminosity})`
        : `rgba(${hexToRgb(baseColor)}, ${0.3 * luminosity})`;
      const outerColor = star.resonance_active
        ? `rgba(168, 85, 247, ${0.15 * luminosity})`
        : `rgba(${hexToRgb(baseColor)}, 0)`;

      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
      glow.addColorStop(0, innerColor);
      glow.addColorStop(1, outerColor);

      ctx.beginPath();
      ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // ─── PASS 2: Çekirdekler (Cores) ──────────────────────────────────
    // Tüm yıldızlar için ana çekirdek dairesi çizilir.
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      const { x, y, radius } = screenPositionsRef.current[i];
      const alpha = magnitudeToAlpha(star.magnitude, star.luminosity_level ?? 1.0);
      const baseColor = star.base_color || '#FFFFFF';

      ctx.save();
      ctx.globalAlpha = alpha;

      // Çekirdek radyal gradyanı: merkezde parlak, kenarda yıldız rengi
      const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      coreGrad.addColorStop(0, '#FFFFFF');
      coreGrad.addColorStop(0.4, baseColor);
      coreGrad.addColorStop(1, `rgba(${hexToRgb(baseColor)}, 0.6)`);

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      ctx.restore();
    }

    // ─── PASS 3: Odak Halkaları (Focus Rings) ─────────────────────────
    // Yalnızca is_mine === true olan yıldızlar için altın hedefleme halkası.
    // lineDash ayarının diğer çizimleri etkilememesi için save/restore gereklidir.
    ctx.save();
    ctx.strokeStyle = '#F59E0B'; // Altın sarısı
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);

    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      if (!star.is_mine) continue;

      const { x, y, radius } = screenPositionsRef.current[i];
      ctx.beginPath();
      ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // lineDash'i sıfırla — sonraki hiçbir çizim kesik görünmez
    ctx.setLineDash([]);
    ctx.restore();

    // ─── PASS 4: İsim Etiketleri (Name Tags) ──────────────────────────
    // Yalnızca is_mine === true ve custom_name var olan yıldızlar için.
    ctx.save();
    ctx.font = '600 11px -apple-system, "SF Pro Text", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      if (!star.is_mine || !star.custom_name) continue;

      const { x, y, radius } = screenPositionsRef.current[i];
      const labelY = y + radius + 14;

      // Metin gölgesi (okunabilirlik için koyu arka plan)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#F59E0B';
      ctx.fillText(star.custom_name, x, labelY);

      // Gölgeyi temizle
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // Restore DPR scale
    ctx.restore();
  }

  // -------------------------------------------------------------------
  // HIT-TESTING: Dokunma → En Yakın Yıldız Seçimi
  // -------------------------------------------------------------------
  function findNearestStar(touchX: number, touchY: number): ViewportStarItem | null {
    let minDist = Infinity;
    let nearest: ViewportStarItem | null = null;

    for (let i = 0; i < stars.length; i++) {
      const { x, y, radius } = screenPositionsRef.current[i];
      const touchRadius = Math.max(radius + MIN_TOUCH_RADIUS_PX, MIN_TOUCH_RADIUS_PX);
      const dx = touchX - x;
      const dy = touchY - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= touchRadius && dist < minDist) {
        minDist = dist;
        nearest = stars[i];
      }
    }
    return nearest;
  }

  // -------------------------------------------------------------------
  // GESTURELER: PAN & ZOOM
  // -------------------------------------------------------------------
  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    dragRef.current = {
      active: true,
      startX: x,
      startY: y,
      startRa: cameraRef.current.centerRa,
      startDec: cameraRef.current.centerDec,
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current.active) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const camera = cameraRef.current;
    const fovDec = 60 / camera.zoom;
    const fovRa = fovDec * (width / height);

    const deltaRaDeg = -((x - dragRef.current.startX) / width) * fovRa;
    const deltaDecDeg = ((y - dragRef.current.startY) / height) * fovDec;

    let newRa = ((dragRef.current.startRa + deltaRaDeg) % 360 + 360) % 360;
    const newDec = Math.max(-85, Math.min(85, dragRef.current.startDec + deltaDecDeg));

    cameraRef.current = { ...camera, centerRa: newRa, centerDec: newDec };
    onCameraChange?.(cameraRef.current);
    renderFrame();
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dragRef.current.active) return;

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = x - dragRef.current.startX;
    const dy = y - dragRef.current.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 4px hareket eşiğinin altında tap sayılır → yıldız seç
    if (distance < 4) {
      const star = findNearestStar(x, y);
      if (star) onSelectStar?.(star);
    }

    dragRef.current.active = false;
    fireBoundsChange();
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.85 : 1.18;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cameraRef.current.zoom * zoomFactor));
    cameraRef.current = { ...cameraRef.current, zoom: newZoom };
    onCameraChange?.(cameraRef.current);
    renderFrame();
    fireBoundsChange();
  }

  // -------------------------------------------------------------------
  // ETKİLER (EFFECTS)
  // -------------------------------------------------------------------

  // İlk mount: kamera state'i başlat ve ilk render
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      // initialCamera zaten cameraRef.current'ta; bounds değişikliğini bildir
      if (onBoundsChange) {
        onBoundsChange(computeBounds(cameraRef.current));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // stars prop'u her güncellendiğinde canvas yeniden çizilir.
  // cameraRef.current DEĞİŞTİRİLMEZ — kamera konumu korunur.
  useEffect(() => {
    renderFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stars]);

  // Boyut değişikliklerinde yeniden çiz
  useEffect(() => {
    cameraRef.current = { ...cameraRef.current, viewportWidth: width, viewportHeight: height };
    renderFrame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (boundsDebounceRef.current) {
        clearTimeout(boundsDebounceRef.current);
      }
    };
  }, []);

  // -------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------

  // React Native / Expo ortamında Platform.OS === 'web' ise <canvas> render edilir.
  // Native build'de bu bileşen ayrı bir implementasyona bağlanmalıdır.
  if (Platform.OS !== 'web') {
    // Placeholder: Native implementasyon için expo-skia veya react-native-canvas kullanılabilir.
    return <View style={[styles.container, { width, height }]} />;
  }

  return (
    <View style={[styles.container, { width, height }]}>
      <canvas
        ref={canvasRef}
        style={{ width, height, display: 'block', touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      />
    </View>
  );
}

// ============================================================================
// YARDIMCI: HEX'TEN RGB'YE DÖNÜŞÜM
// ============================================================================

/**
 * '#RRGGBB' formatındaki hex renk kodunu 'r, g, b' string'ine çevirir.
 * Canvas createRadialGradient içinde `rgba(${hexToRgb(color)}, alpha)` olarak kullanılır.
 */
function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return '255, 255, 255';
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

// ============================================================================
// STİLLER
// ============================================================================

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#020408',
  },
});

export default MacroSkyCanvas;
