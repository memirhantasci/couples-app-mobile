/**
 * @file skiaBridge.ts
 * @module modules/stars/canvas
 * @description Safe bridge for @shopify/react-native-skia
 * Handles environments gracefully where RNSkiaModule is not available (e.g. Expo Go).
 */

import { useState, useEffect } from 'react';
import { Image } from 'react-native';
import { Asset } from 'expo-asset';
import type {
  Skia as SkiaType,
  useFont as useFontType,
  SkTypefaceFontProvider,
} from '@shopify/react-native-skia';

let skiaInstance: typeof SkiaType | null = null;
let canvasComponent: any = null;
let groupComponent: any = null;
let pictureComponent: any = null;
let useFontHook: typeof useFontType | null = null;

// New exports for MicroSystemCanvas
let circleComponent: any = null;
let pathComponent: any = null;
let radialGradientComponent: any = null;
let sweepGradientComponent: any = null;
let pointsComponent: any = null;
let vecFunc: any = null;
let dashPathEffectComponent: any = null;
let blurMaskComponent: any = null;
let linearGradientComponent: any = null;
let rectComponent: any = null;
let ovalComponent: any = null;

let skiaAvailable = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const skiaModule = require('@shopify/react-native-skia');
  if (skiaModule && skiaModule.Skia) {
    skiaInstance = skiaModule.Skia;
    canvasComponent = skiaModule.Canvas;
    groupComponent = skiaModule.Group;
    pictureComponent = skiaModule.Picture;
    useFontHook = skiaModule.useFont;
    
    circleComponent = skiaModule.Circle;
    pathComponent = skiaModule.Path;
    radialGradientComponent = skiaModule.RadialGradient;
    sweepGradientComponent = skiaModule.SweepGradient;
    pointsComponent = skiaModule.Points;
    vecFunc = skiaModule.vec;
    dashPathEffectComponent = skiaModule.DashPathEffect;
    blurMaskComponent = skiaModule.BlurMask;
    linearGradientComponent = skiaModule.LinearGradient;
    rectComponent = skiaModule.Rect;
    ovalComponent = skiaModule.Oval;

    skiaAvailable = true;
  }
} catch {
  // Native RNSkiaModule is missing in current binary (e.g. standard Expo Go)
  skiaAvailable = false;
}

export const isSkiaAvailable = skiaAvailable;
export const Skia = skiaInstance!;
export const Canvas = canvasComponent;
export const Group = groupComponent;
export const Picture = pictureComponent;
export const useFont = useFontHook!;

/** Typeface provider for the Paragraph API (falls back gracefully to system fonts, e.g. emoji or on asset load failure). */
export function useFonts(sources: Record<string, (number | string | any)[]>): SkTypefaceFontProvider | null {
  const [fontMgr, setFontMgr] = useState<SkTypefaceFontProvider | null>(() => {
    if (skiaInstance?.TypefaceFontProvider) {
      try {
        return skiaInstance.TypefaceFontProvider.Make();
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (!skiaInstance?.TypefaceFontProvider) return;
    let cancelled = false;

    const loadTypefaces = async () => {
      try {
        const provider = skiaInstance.TypefaceFontProvider.Make();
        let loadedCount = 0;

        for (const [familyName, typefaces] of Object.entries(sources)) {
          for (const source of typefaces) {
            try {
              let uri: string | null = null;

              if (typeof source === 'number') {
                try {
                  const asset = Asset.fromModule(source);
                  if (!asset.downloaded) {
                    await asset.downloadAsync();
                  }
                  uri = asset.localUri || asset.uri;
                } catch {
                  const resolved = Image.resolveAssetSource(source);
                  uri = resolved?.uri ?? null;
                }
              } else if (typeof source === 'string') {
                uri = source;
              } else if (source && typeof source === 'object' && 'uri' in source) {
                uri = (source as any).uri;
              }

              if (uri && skiaInstance.Data?.fromURI && skiaInstance.Typeface?.MakeFreeTypeFaceFromData) {
                const data = await skiaInstance.Data.fromURI(uri);
                if (data) {
                  const tf = skiaInstance.Typeface.MakeFreeTypeFaceFromData(data);
                  if (tf) {
                    provider.registerFont(tf, familyName);
                    loadedCount++;
                  }
                }
              }
            } catch (singleFontErr) {
              // Dev warning: individual font could not be parsed; Paragraph shaper will gracefully use system fonts
              if (__DEV__) {
                console.warn(`[skiaBridge] Couldn't create typeface for ${familyName}, falling back to system font:`, singleFontErr);
              }
            }
          }
        }

        if (!cancelled && loadedCount > 0) {
          setFontMgr(provider);
        }
      } catch (err) {
        if (__DEV__) {
          console.warn('[skiaBridge] TypefaceFontProvider loading error:', err);
        }
      }
    };

    loadTypefaces();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return fontMgr;
}

export const Circle = circleComponent;
export const Path = pathComponent;
export const RadialGradient = radialGradientComponent;
export const SweepGradient = sweepGradientComponent;
export const Points = pointsComponent;
export const vec = vecFunc;
export const DashPathEffect = dashPathEffectComponent;
export const BlurMask = blurMaskComponent;
export const LinearGradient = linearGradientComponent;
export const Rect = rectComponent;
export const Oval = ovalComponent;
