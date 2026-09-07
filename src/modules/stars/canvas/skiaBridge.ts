/**
 * @file skiaBridge.ts
 * @module modules/stars/canvas
 * @description Safe bridge for @shopify/react-native-skia
 * Handles environments gracefully where RNSkiaModule is not available (e.g. Expo Go).
 */

import type { Skia as SkiaType, useFont as useFontType } from '@shopify/react-native-skia';

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

export const Circle = circleComponent;
export const Path = pathComponent;
export const RadialGradient = radialGradientComponent;
export const SweepGradient = sweepGradientComponent;
export const Points = pointsComponent;
export const vec = vecFunc;
export const DashPathEffect = dashPathEffectComponent;
export const BlurMask = blurMaskComponent;
