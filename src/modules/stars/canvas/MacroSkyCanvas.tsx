import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, runOnJS, useDerivedValue } from 'react-native-reanimated';
import { Inter_400Regular } from '@expo-google-fonts/inter';
import { Sparkles } from 'lucide-react-native';
import { Canvas, Group, Picture, Skia, useFont, isSkiaAvailable } from './skiaBridge';
import type {
  ActiveStarConnection,
  ViewportStarItem,
  SkyCameraState,
} from '@/modules/stars/types/star.types';
import { CONSTELLATION_LINES } from '../config/constellationLines.data';
import { SKY_SECTORS_LIST } from '../config/skySectors.data';

export interface MacroSkyBounds {
  readonly minRa: number;
  readonly maxRa: number;
  readonly minDec: number;
  readonly maxDec: number;
  readonly zoomLevel: number;
}

export interface MacroSkyCanvasProps {
  readonly stars: ViewportStarItem[];
  readonly initialCamera?: Partial<SkyCameraState>;
  readonly targetCamera?: { readonly centerRa: number; readonly centerDec: number; readonly zoom?: number };
  readonly onSelectStar?: (star: ViewportStarItem) => void;
  readonly onBoundsChange?: (bounds: MacroSkyBounds) => void;
  readonly onCameraChange?: (camera: SkyCameraState) => void;
  readonly connections?: ActiveStarConnection[];
  readonly myStarCoords?: { readonly ra: number; readonly dec: number };
  readonly width?: number;
  readonly height?: number;
}

const MIN_ZOOM = 1.0;
const MAX_ZOOM = 8.0;

const STAR_BASE_RADIUS_PX: Record<string, number> = {
  O: 3.5, B: 3.2, A: 3.0, F: 2.8, G: 2.6, K: 2.4, M: 2.2,
};
const FALLBACK_STAR_RADIUS = 2.4;

function computeBounds(camera: SkyCameraState): MacroSkyBounds {
  const fovDec = 60 / camera.zoom;
  const fovRa = fovDec * (camera.viewportWidth / camera.viewportHeight);
  let minRa = camera.centerRa - fovRa / 2;
  let maxRa = camera.centerRa + fovRa / 2;
  const minDec = Math.max(-90, camera.centerDec - fovDec / 2);
  const maxDec = Math.min(90, camera.centerDec + fovDec / 2);

  if (minRa < 0) minRa = ((minRa % 360) + 360) % 360;
  if (maxRa > 360) maxRa = maxRa % 360;

  return { minRa, maxRa, minDec, maxDec, zoomLevel: camera.zoom };
}

function projectToScreen(
  ra: number,
  dec: number,
  camera: SkyCameraState,
  width: number,
  height: number,
) {
  const fovDec = 60 / camera.zoom;
  const fovRa = fovDec * (width / height);
  const deltaRa = ((ra - camera.centerRa + 540) % 360) - 180;
  const deltaDec = dec - camera.centerDec;
  const x = width / 2 + (deltaRa / fovRa) * width;
  const y = height / 2 - (deltaDec / fovDec) * height;
  return { x, y };
}

function magnitudeToRadius(magnitude: number, spectralType: string, zoom: number): number {
  const baseClass = spectralType.charAt(0).toUpperCase();
  const baseRadius = STAR_BASE_RADIUS_PX[baseClass] ?? FALLBACK_STAR_RADIUS;
  const scale = Math.max(0.5, Math.min(2.5, 1 + (3 - magnitude) * 0.2));
  const zoomBonus = Math.min(1.4, 1 + (zoom - 1) * 0.08);
  return baseRadius * scale * zoomBonus;
}

function hexToRgba(hex: string, alpha: number): Float32Array {
  const clean = hex.replace('#', '');
  let r = 255, g = 255, b = 255;
  if (clean.length >= 6) {
    r = parseInt(clean.substring(0, 2), 16);
    g = parseInt(clean.substring(2, 4), 16);
    b = parseInt(clean.substring(4, 6), 16);
  }
  return Skia.Color(`rgba(${r}, ${g}, ${b}, ${alpha})`);
}

function magnitudeToAlpha(magnitude: number, luminosity: number): number {
  const normalized = Math.max(0, Math.min(1, 1 - (magnitude + 2) / 11));
  return 0.4 + normalized * 0.6 * luminosity;
}

function MacroSkyCanvasSkia({
  stars,
  initialCamera,
  targetCamera,
  onSelectStar,
  onBoundsChange,
  onCameraChange,
  connections = [],
  myStarCoords,
  width = 390,
  height = 844,
}: MacroSkyCanvasProps) {
  
  // Font loading from the bundle
  const font = useFont(Inter_400Regular, 10);
  const sectorFont = useFont(Inter_400Regular, 14);

  // Camera State (Committed for Picture)
  const [camera, setCamera] = useState<SkyCameraState>({
    centerRa: initialCamera?.centerRa ?? 180,
    centerDec: initialCamera?.centerDec ?? 0,
    zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialCamera?.zoom ?? 1.0)),
    fovRa: 60,
    fovDec: 60,
    viewportWidth: width,
    viewportHeight: height,
  });

  // Reanimated Shared Values for Gestures (UI Thread)
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const savedScale = useSharedValue(1);

  // Commit Gesture to JS Thread
  const commitGesture = useCallback((tx: number, ty: number, s: number) => {
    setCamera((prev) => {
       const fovDec = 60 / prev.zoom;
       const fovRa = fovDec * (width / height);
       
       // Calculate new RA and Dec
       const dRa = -(tx / width) * fovRa;
       const dDec = (ty / height) * fovDec;
       
       let newRa = (prev.centerRa + dRa) % 360;
       if (newRa < 0) newRa += 360;
       const newDec = Math.max(-90, Math.min(90, prev.centerDec + dDec));
       
       const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * s));
       
       const newCamera = { ...prev, centerRa: newRa, centerDec: newDec, zoom: newZoom };
       
       // Notify parent
       onBoundsChange?.(computeBounds(newCamera));
       onCameraChange?.(newCamera);
       
       return newCamera;
    });
    
    // Reset Shared Values for the newly recorded picture
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    savedScale.value = 1;
  }, [width, height, onBoundsChange, onCameraChange, translateX, translateY, scale, savedTranslateX, savedTranslateY, savedScale]);

  // UI Thread Gesture Handlers
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      runOnJS(commitGesture)(translateX.value, translateY.value, scale.value);
    });

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      runOnJS(commitGesture)(translateX.value, translateY.value, scale.value);
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  // SkPicture Recording (Triggered when `stars` array changes or `camera` commits)
  const picture = useMemo(() => {
    if (!font || !sectorFont) return null;
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));

    // Fill Background
    const bgPaint = Skia.Paint();
    bgPaint.setShader(
      Skia.Shader.MakeRadialGradient(
        Skia.Point(width / 2, height / 2),
        Math.max(width, height) * 0.7,
        [Skia.Color('#0A0F1E'), Skia.Color('#020408')],
        null,
        3 // TileMode.Clamp
      )
    );
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), bgPaint);

    // ─── PASS 4.0: Dünya / Güneş Sistemi Göstergesi ─────────────────
    const earthPos = projectToScreen(0, 0, camera, width, height);
    if (earthPos.x > -50 && earthPos.x < width + 50 && earthPos.y > -50 && earthPos.y < height + 50) {
      const earthGlow = Skia.Paint();
      earthGlow.setColor(Skia.Color('rgba(56, 189, 248, 0.9)'));
      earthGlow.setMaskFilter(Skia.MaskFilter.MakeBlur(0, 8, true));
      canvas.drawCircle(earthPos.x, earthPos.y, 4.5, earthGlow);

      const earthCore = Skia.Paint();
      earthCore.setColor(Skia.Color('#38BDF8'));
      canvas.drawCircle(earthPos.x, earthPos.y, 4.5, earthCore);
      
      const dot = Skia.Paint();
      dot.setColor(Skia.Color('#FFFFFF'));
      canvas.drawCircle(earthPos.x, earthPos.y, 2, dot);

      const earthLabelPaint = Skia.Paint();
      earthLabelPaint.setColor(Skia.Color('#93C5FD'));
      canvas.drawText('Dünya', earthPos.x - 14, earthPos.y + 18, earthLabelPaint, font);
    }

    // PASS 1: Nebula Gradients
    SKY_SECTORS_LIST.forEach((sector) => {
       const center = projectToScreen(sector.center.ra, sector.center.dec, camera, width, height);
       const radius = magnitudeToRadius(-2, 'O', camera.zoom) * 20;
       const color = sector.nebulaPalette?.[0] ?? '#FFFFFF';
       
       const paint = Skia.Paint();
       paint.setBlendMode(12); // Screen
       paint.setShader(
         Skia.Shader.MakeRadialGradient(
           Skia.Point(center.x, center.y),
           radius,
           [hexToRgba(color, 0.25), hexToRgba(color, 0.08), hexToRgba(color, 0)],
           null,
           3
         )
       );
       canvas.drawRect(Skia.XYWHRect(center.x - radius, center.y - radius, radius * 2, radius * 2), paint);
    });

    // PASS 2: Sector Labels (Zoom < 1.8)
    if (camera.zoom < 1.8) {
      SKY_SECTORS_LIST.forEach((sector) => {
        const center = projectToScreen(sector.center.ra, sector.center.dec, camera, width, height);
        const text = `${sector.symbol} ${sector.name}`;
        const textWidth = sectorFont.getTextWidth(text);
        const paint = Skia.Paint();
        paint.setColor(Skia.Color('rgba(255,255,255,0.4)'));
        canvas.drawText(text, center.x - textWidth / 2, center.y + 10, paint, sectorFont);
      });
    }

    // PASS 3: Constellation Lines
    const constPaint = Skia.Paint();
    constPaint.setColor(Skia.Color('rgba(255, 255, 255, 0.15)'));
    constPaint.setStrokeWidth(1);
    constPaint.setStyle(1); // Stroke

    CONSTELLATION_LINES.forEach((line) => {
      const p1 = projectToScreen(line.from.ra, line.from.dec, camera, width, height);
      const p2 = projectToScreen(line.to.ra, line.to.dec, camera, width, height);
      const path = Skia.Path.Make();
      path.moveTo(p1.x, p1.y);
      path.lineTo(p2.x, p2.y);
      canvas.drawPath(path, constPaint);
    });

    // PASS 4: Active Connections
    const connPaint = Skia.Paint();
    connPaint.setColor(Skia.Color('rgba(251, 191, 36, 0.6)'));
    connPaint.setStrokeWidth(2);
    connPaint.setStyle(1); // Stroke
    const connBlur = Skia.MaskFilter.MakeBlur(0, 4, true); // Normal blur
    if (connBlur) connPaint.setMaskFilter(connBlur);

    connections.forEach((conn) => {
      if (!myStarCoords || !conn.other_star_ra || !conn.other_star_dec) return;
      const p1 = projectToScreen(myStarCoords.ra, myStarCoords.dec, camera, width, height);
      const p2 = projectToScreen(conn.other_star_ra, conn.other_star_dec, camera, width, height);
      const path = Skia.Path.Make();
      path.moveTo(p1.x, p1.y);
      path.lineTo(p2.x, p2.y);
      canvas.drawPath(path, connPaint);
    });

    // STAR PASSES (Glow + Core)
    const starGlowPaint = Skia.Paint();
    starGlowPaint.setColor(Skia.Color('white')); // updated per star
    const glowFilter = Skia.MaskFilter.MakeBlur(0, 3, true);
    if (glowFilter) starGlowPaint.setMaskFilter(glowFilter);

    const starCorePaint = Skia.Paint();

    stars.forEach(star => {
       const pos = projectToScreen(star.ra, star.dec, camera, width, height);
       const r = magnitudeToRadius(star.magnitude, star.spectral_type || 'G', camera.zoom);
       const alpha = magnitudeToAlpha(star.magnitude, 1.0);
       
       // PASS 5: Glow
       starGlowPaint.setColor(hexToRgba('#FFFFFF', alpha * 0.4));
       canvas.drawCircle(pos.x, pos.y, r * 2.5, starGlowPaint);

       // PASS 6: Core
       starCorePaint.setColor(hexToRgba('#FFFFFF', alpha));
       canvas.drawCircle(pos.x, pos.y, r, starCorePaint);
    });

    return recorder.finishRecordingAsPicture();
  }, [stars, camera, width, height, font, sectorFont, connections, myStarCoords]);

  if (!font || !sectorFont) {
    return (
      <View style={[styles.container, { width, height, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#FBBF24" />
      </View>
    );
  }

  const transform = useDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ]);

  return (
    <View style={[styles.container, { width, height }]}>
       <GestureDetector gesture={composed}>
          <Animated.View style={{ width, height }}>
             <Canvas style={{ flex: 1 }}>
                <Group transform={transform}>
                   {picture && <Picture picture={picture} />}
                </Group>
             </Canvas>
          </Animated.View>
       </GestureDetector>
    </View>
  );
}

function MacroSkyCanvasFallback({
  stars,
  width = 390,
  height = 844,
}: MacroSkyCanvasProps) {
  return (
    <View style={[styles.container, styles.fallbackContainer, { width, height }]}>
      <View style={styles.fallbackCard}>
        <View style={styles.fallbackIconBadge}>
          <Sparkles size={28} color="#FBBF24" />
        </View>
        <Text style={styles.fallbackTitle}>Makro Gökyüzü Haritası</Text>
        <Text style={styles.fallbackSubtitle}>Skia Graphics Engine</Text>
        <Text style={styles.fallbackDescription}>
          10.000+ yıldız ve nebulayı 60 FPS akıcılıkla çizmek için donanım hızlandırmalı Skia C++ motoru kullanılır.
        </Text>
        <View style={styles.fallbackNoticeBox}>
          <Text style={styles.fallbackNoticeTitle}>Development Build Gereklidir</Text>
          <Text style={styles.fallbackNoticeText}>
            Projenizdeki özel native modüller (RevenueCat, Ads, QuickCrypto vb.) nedeniyle bu haritayı tam performanslı görüntülemek için terminalden uygulamayı derleyin:
          </Text>
          <View style={styles.fallbackCodeBadge}>
            <Text style={styles.fallbackCodeText}>npx expo run:android</Text>
          </View>
        </View>
        <Text style={styles.fallbackMetaText}>
          Yüklü Yıldız: {stars.length} adet
        </Text>
      </View>
    </View>
  );
}

export function MacroSkyCanvas(props: MacroSkyCanvasProps) {
  if (!isSkiaAvailable) {
    return <MacroSkyCanvasFallback {...props} />;
  }
  return <MacroSkyCanvasSkia {...props} />;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#020408',
    overflow: 'hidden',
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  fallbackCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    padding: 24,
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  fallbackIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  fallbackSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FBBF24',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  fallbackDescription: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  fallbackNoticeBox: {
    backgroundColor: 'rgba(2, 6, 23, 0.75)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  fallbackNoticeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F87171',
    marginBottom: 6,
  },
  fallbackNoticeText: {
    fontSize: 12,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 10,
  },
  fallbackCodeBadge: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  fallbackCodeText: {
    color: '#FBBF24',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
  },
  fallbackMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
});

export default MacroSkyCanvas;

