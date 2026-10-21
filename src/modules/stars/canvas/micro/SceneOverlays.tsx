/**
 * @file SceneOverlays.tsx
 * @module modules/stars/canvas/micro
 * @description Skia sahnesinin üstündeki RN katmanları: izleyiciye yakın
 * gezegenlerin isimleri, iki ruhun ucundaki çift fotoğrafları, ilk girişteki
 * ipucu ve boş yörünge mesajı. Konumlar sahneyle aynı UI-thread durum
 * dizilerinden okunur; dokunmaları engellemez (pointerEvents="none").
 */

import React, { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Hand, Sparkles } from 'lucide-react-native';

import type { StarSystemMapPlanet } from '../../types/star.types';
import { B_ALPHA, B_DEPTH, B_SCALE, B_X, B_Y, BODY_STRIDE, clamp } from './microScene';

const LABEL_WIDTH = 140;
const AVATAR_SIZE = 30;

// ─── Gezegen isimleri ───────────────────────────────────────────────────────

interface PlanetLabelProps {
  readonly index: number;
  readonly motion: SharedValue<number[]>;
  readonly intro: SharedValue<number>;
  readonly radius: number;
  readonly title: string;
  readonly locked: boolean;
}

const PlanetLabel = memo(function PlanetLabel({ index, motion, intro, radius, title, locked }: PlanetLabelProps) {
  const base = index * BODY_STRIDE;
  const style = useAnimatedStyle(() => {
    const m = motion.value;
    const depth = m[base + B_DEPTH] ?? -1;
    const scale = m[base + B_SCALE] ?? 1;
    // Yalnızca izleyiciye dönük yarıda görünür; arkaya geçerken söner.
    const visibility = clamp((depth - 0.12) / 0.4, 0, 1) * intro.value;
    return {
      opacity: visibility,
      transform: [
        { translateX: (m[base + B_X] ?? 0) - LABEL_WIDTH / 2 },
        { translateY: (m[base + B_Y] ?? 0) + radius * scale + 7 },
      ],
    };
  });

  return (
    <Animated.View style={[styles.labelAnchor, style]}>
      <View style={styles.labelPill}>
        <Text style={[styles.labelText, locked && styles.labelTextLocked]} numberOfLines={1}>
          {locked ? '🔒 Kilitli anı' : title}
        </Text>
      </View>
    </Animated.View>
  );
});

// ─── Çiftin fotoğrafları ────────────────────────────────────────────────────

interface SoulAvatarProps {
  readonly index: number;
  readonly souls: SharedValue<number[]>;
  readonly uri: string;
  readonly color: string;
}

const SoulAvatar = memo(function SoulAvatar({ index, souls, uri, color }: SoulAvatarProps) {
  const base = index * BODY_STRIDE;
  const style = useAnimatedStyle(() => {
    const m = souls.value;
    const depth = m[base + B_DEPTH] ?? 0;
    // Yıldızın arkasına geçerken fotoğraf ışığa dönüşür (yalnızca Skia ruhu kalır).
    const fade = clamp(1 + depth * 3, 0, 1);
    return {
      opacity: fade * clamp((m[base + B_ALPHA] ?? 0) * 1.25, 0, 1),
      transform: [
        { translateX: (m[base + B_X] ?? 0) - AVATAR_SIZE / 2 },
        { translateY: (m[base + B_Y] ?? 0) - AVATAR_SIZE / 2 },
        // Yakınlaştırınca fotoğraf büyür ama sahneyi kaplamaz.
        { scale: clamp(m[base + B_SCALE] ?? 1, 0.5, 1.6) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.avatar, { borderColor: color, shadowColor: color }, style]}>
      <Image source={{ uri }} style={styles.avatarImage} contentFit="cover" transition={200} />
    </Animated.View>
  );
});

// ─── İlk giriş ipucu (uygulama oturumu başına bir kez) ──────────────────────

let hasShownSceneHint = false;

function SceneHint({ top }: { top: number }) {
  const [visible, setVisible] = useState(() => !hasShownSceneHint);

  useEffect(() => {
    if (!visible) return;
    hasShownSceneHint = true;
    const timer = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View
      entering={FadeIn.delay(1500).duration(700)}
      exiting={FadeOut.duration(500)}
      style={[styles.hintWrap, { top }]}
    >
      <View style={styles.hintPill}>
        <View style={styles.hintRow}>
          <Sparkles size={12} color="#FDE68A" />
          <Text style={styles.hintText}>Yıldıza dokun, sevgine titreşim gönder</Text>
        </View>
        <View style={styles.hintRow}>
          <Hand size={12} color="#C4B5FD" />
          <Text style={styles.hintText}>Sürükle, sistemi çevir · Gezegene dokun, anını aç</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Kompozisyon ────────────────────────────────────────────────────────────

export interface SceneOverlaysProps {
  readonly planets: readonly StarSystemMapPlanet[];
  readonly radii: readonly number[];
  readonly motion: SharedValue<number[]>;
  readonly souls: SharedValue<number[]>;
  readonly intro: SharedValue<number>;
  readonly soulColors: readonly [string, string];
  readonly myAvatarUrl?: string | null;
  readonly partnerAvatarUrl?: string | null;
  readonly hintTop: number;
  readonly emptyCaptionTop: number;
  readonly showHint: boolean;
}

export const SceneOverlays = memo(function SceneOverlays({
  planets,
  radii,
  motion,
  souls,
  intro,
  soulColors,
  myAvatarUrl,
  partnerAvatarUrl,
  hintTop,
  emptyCaptionTop,
  showHint,
}: SceneOverlaysProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {planets.map((planet, index) => (
        <PlanetLabel
          key={planet.id}
          index={index}
          motion={motion}
          intro={intro}
          radius={radii[index] ?? 10}
          title={planet.display_title}
          locked={planet.is_locked}
        />
      ))}

      {myAvatarUrl ? <SoulAvatar index={0} souls={souls} uri={myAvatarUrl} color={soulColors[0]} /> : null}
      {partnerAvatarUrl ? <SoulAvatar index={1} souls={souls} uri={partnerAvatarUrl} color={soulColors[1]} /> : null}

      {planets.length === 0 && (
        <Animated.View entering={FadeIn.delay(900).duration(700)} style={[styles.emptyWrap, { top: emptyCaptionTop }]}>
          <Text style={styles.emptyTitle}>Yörüngeniz sizi bekliyor</Text>
          <Text style={styles.emptyText}>İlk anınızı aşağıdan bir gezegene dönüştürün ✨</Text>
        </Animated.View>
      )}

      {showHint && <SceneHint top={hintTop} />}
    </View>
  );
});

const styles = StyleSheet.create({
  labelAnchor: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: LABEL_WIDTH,
    alignItems: 'center',
  },
  labelPill: {
    maxWidth: LABEL_WIDTH,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 9,
    backgroundColor: 'rgba(8, 6, 22, 0.55)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  labelText: {
    color: 'rgba(248, 250, 252, 0.9)',
    fontSize: 10.5,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.1,
  },
  labelTextLocked: {
    color: 'rgba(203, 213, 225, 0.7)',
  },
  avatar: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1.5,
    backgroundColor: '#0B0820',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR_SIZE / 2,
  },
  hintWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  hintPill: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 8, 26, 0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(253, 230, 138, 0.35)',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hintText: {
    color: 'rgba(241, 245, 249, 0.88)',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    flexShrink: 1,
  },
  emptyWrap: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    color: '#FDE68A',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(251, 191, 36, 0.6)',
    textShadowRadius: 10,
  },
  emptyText: {
    color: 'rgba(203, 213, 225, 0.72)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
