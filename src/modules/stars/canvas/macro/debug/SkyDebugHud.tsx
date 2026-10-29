import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

export type SkyDebugMetrics = Readonly<Record<string, string | number>>;

interface SkyDebugHudProps {
  /** Polled on the JS thread twice per second; keep it cheap. */
  readonly getMetrics?: () => SkyDebugMetrics;
}

const SAMPLE_INTERVAL_MS = 500;

function formatMetric(value: string | number) {
  if (typeof value !== 'number') return value;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * Frame-rate overlay for measuring the sky map on a real device.
 *
 * UI thread cadence is sampled with a Reanimated frame callback, JS thread
 * cadence with requestAnimationFrame. "worst" is the longest gap between two
 * frames in the last window, which exposes single dropped frames that an
 * average hides. Tap to collapse.
 */
export function SkyDebugHud({ getMetrics }: SkyDebugHudProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [collapsed, setCollapsed] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const getMetricsRef = useRef(getMetrics);

  useEffect(() => {
    getMetricsRef.current = getMetrics;
  });

  const uiFrames = useSharedValue(0);
  const uiWorstMs = useSharedValue(0);

  useFrameCallback((frame) => {
    const delta = frame.timeSincePreviousFrame;
    if (delta === null) return;
    uiFrames.set(uiFrames.get() + 1);
    if (delta > uiWorstMs.get()) uiWorstMs.set(delta);
  });

  useEffect(() => {
    let jsFrames = 0;
    let jsWorstMs = 0;
    let lastFrameAt = performance.now();
    let lastSampleAt = lastFrameAt;
    let rafId = 0;

    const onFrame = (time: number) => {
      jsFrames += 1;
      jsWorstMs = Math.max(jsWorstMs, time - lastFrameAt);
      lastFrameAt = time;
      rafId = requestAnimationFrame(onFrame);
    };
    rafId = requestAnimationFrame(onFrame);

    const timer = setInterval(() => {
      const now = performance.now();
      const elapsed = Math.max(1, now - lastSampleAt);
      lastSampleAt = now;

      const uiCount = uiFrames.get();
      const uiWorst = uiWorstMs.get();
      uiFrames.set(0);
      uiWorstMs.set(0);

      const next = [
        `UI ${Math.round((uiCount * 1000) / elapsed)} fps · worst ${uiWorst.toFixed(0)}ms`,
        `JS ${Math.round((jsFrames * 1000) / elapsed)} fps · worst ${jsWorstMs.toFixed(0)}ms`,
      ];
      jsFrames = 0;
      jsWorstMs = 0;

      const metrics = getMetricsRef.current?.();
      if (metrics) {
        for (const [key, value] of Object.entries(metrics)) {
          next.push(`${key}: ${formatMetric(value)}`);
        }
      }
      setLines(next);
    }, SAMPLE_INTERVAL_MS);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(timer);
    };
  }, [uiFrames, uiWorstMs]);

  return (
    <Pressable
      onPress={() => setCollapsed((value) => !value)}
      style={[styles.container, { top: insets.top + 112 }]}
      accessibilityLabel={t('stars.debug.hudA11y')}
    >
      {(collapsed ? lines.slice(0, 1) : lines).map((line, index) => (
        <Text key={index} style={styles.line}>
          {line}
        </Text>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 8,
    zIndex: 50,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  line: {
    color: '#A5F3FC',
    fontSize: 10,
    lineHeight: 13,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
});
