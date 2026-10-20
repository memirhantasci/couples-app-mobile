/**
 * @file MicroSystemDock.tsx
 * @module modules/stars/components/micro
 * @description Yıldızın içindeyken alttaki cam panel:
 *   1. Anı gezegenleri şeridi — her gezegen bir kart; ilk kart yeni anı ekler.
 *   2. Günlük ritüel düğmesi — ışık hazırsa altın "Yıldızımızı Aydınlat",
 *      bekleme süresindeyse sonraki ışığa kalan süre ve ilerleme çubuğuyla
 *      "Sevgi Titreşimi Gönder".
 *   3. Gök kubbeye dönüş düğmesi.
 */

import React, { memo, useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Globe, Heart, Plus, Zap } from 'lucide-react-native';

import type { StarSystemMapPlanet } from '../../types/star.types';
import { ORBIT_CONFIG } from '../../types/star.types';
import { planetTypeLabel } from '../ExoplanetModal';
import { MiniPlanet } from './MiniPlanet';

const DAILY_COOLDOWN_SEC = ORBIT_CONFIG.DAILY_COOLDOWN_HOURS * 3600;

export interface MicroSystemDockProps {
  readonly planets: readonly StarSystemMapPlanet[];
  readonly cooldownSec: number;
  readonly isPremium: boolean;
  readonly bottomInset: number;
  readonly highlightPlanetId?: string | null;
  readonly onOpenPlanet: (planet: StarSystemMapPlanet) => void;
  readonly onCreatePlanet: () => void;
  readonly onSpark: () => void;
  readonly onExitToSky: () => void;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
}

function formatCountdown(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return [hours, minutes, seconds].map((part) => part.toString().padStart(2, '0')).join(':');
}

// ─── Kartlar ────────────────────────────────────────────────────────────────

const PlanetCard = memo(function PlanetCard({
  planet,
  highlighted,
  onPress,
}: {
  planet: StarSystemMapPlanet;
  highlighted: boolean;
  onPress: (planet: StarSystemMapPlanet) => void;
}) {
  const typeLabel = planetTypeLabel(planet.planet_type);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(planet)}
      style={[styles.planetCard, highlighted && styles.planetCardActive]}
      accessibilityRole="button"
      accessibilityLabel={planet.is_locked ? 'Kilitli anı gezegeni' : `${planet.display_title} anı gezegenini aç`}
    >
      <MiniPlanet planet={planet} size={34} />
      <View style={styles.planetCardText}>
        <Text style={styles.planetCardTitle} numberOfLines={1}>
          {planet.is_locked ? 'Kilitli anı' : planet.display_title}
        </Text>
        <Text style={styles.planetCardSub} numberOfLines={1}>
          {planet.is_locked ? 'Premium ile aç 👑' : `${typeLabel} · ${planet.orbit_distance}. kuşak`}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

function CreateCard({ isPremium, wide, onPress }: { isPremium: boolean; wide: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.createCard, wide && styles.createCardWide]}
      accessibilityRole="button"
      accessibilityLabel="Yeni anı gezegeni oluştur"
    >
      <LinearGradient colors={['#FDE68A', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.createIcon}>
        <Plus size={16} color="#3B1D00" strokeWidth={2.6} />
      </LinearGradient>
      {wide ? (
        <View style={styles.planetCardText}>
          <Text style={styles.createWideTitle} numberOfLines={1}>
            İlk anı gezegeninizi oluşturun
          </Text>
          <Text style={styles.planetCardSub} numberOfLines={1}>
            Fotoğraflarınız ve hikâyeniz yörüngede dönsün
          </Text>
        </View>
      ) : (
        <Text style={styles.createLabel}>Yeni Anı</Text>
      )}
      {!isPremium && (
        <View style={styles.crownBadge}>
          <Crown size={10} color="#FBBF24" fill="#FBBF24" />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Günlük ritüel düğmesi ──────────────────────────────────────────────────

/** Altın düğmenin üzerinden ara ara geçen ışık süzmesi. */
function Shimmer() {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withDelay(2200, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );
  }, [progress, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -120 + progress.value * 520 }, { rotate: '18deg' }],
  }));
  if (reduceMotion) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.shimmer, style]}>
      <LinearGradient
        colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

function SparkButton({ cooldownSec, onPress }: { cooldownSec: number; onPress: () => void }) {
  const ready = cooldownSec <= 0;

  if (ready) {
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onPress}
        style={styles.sparkShell}
        accessibilityRole="button"
        accessibilityLabel="Yıldızımızı aydınlat: bugünün ışığını gönder"
      >
        <LinearGradient
          colors={['#FEF3C7', '#FBBF24', '#F59E0B', '#D97706']}
          locations={[0, 0.35, 0.7, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sparkReady}
        >
          <Shimmer />
          <View style={styles.sparkIconReady}>
            <Zap size={17} color="#7C2D12" fill="#7C2D12" />
          </View>
          <View style={styles.sparkTextBlock}>
            <Text style={styles.sparkTitleReady}>Yıldızımızı Aydınlat</Text>
            <Text style={styles.sparkSubReady}>Bugünün ışığı sizi bekliyor ✨</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const progress = Math.max(0, Math.min(1, 1 - cooldownSec / DAILY_COOLDOWN_SEC));
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.sparkShell, styles.sparkCooldown]}
      accessibilityRole="button"
      accessibilityLabel={`Sevgi titreşimi gönder. Sonraki ışık ${formatCountdown(cooldownSec)} sonra`}
    >
      <View style={styles.sparkIconCooldown}>
        <Heart size={16} color="#FBBF24" fill="rgba(251, 191, 36, 0.35)" />
      </View>
      <View style={styles.sparkTextBlock}>
        <Text style={styles.sparkTitleCooldown}>Sevgi Titreşimi Gönder</Text>
        <Text style={styles.sparkSubCooldown} numberOfLines={1}>
          Sonraki ışığa <Text style={styles.sparkTimer}>{formatCountdown(cooldownSec)}</Text>
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <LinearGradient
          colors={['#F59E0B', '#FDE68A']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]}
        />
      </View>
    </TouchableOpacity>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────────

export const MicroSystemDock = memo(function MicroSystemDock({
  planets,
  cooldownSec,
  isPremium,
  bottomInset,
  highlightPlanetId,
  onOpenPlanet,
  onCreatePlanet,
  onSpark,
  onExitToSky,
  onLayout,
}: MicroSystemDockProps) {
  const hasPlanets = planets.length > 0;

  return (
    <Animated.View
      entering={FadeInUp.duration(700).delay(350)}
      style={[styles.shadowShell, { bottom: bottomInset + 10 }]}
      onLayout={onLayout}
    >
      <View style={styles.panel}>
        <LinearGradient
          colors={['rgba(253, 230, 138, 0)', 'rgba(253, 230, 138, 0.5)', 'rgba(253, 230, 138, 0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.topHairline}
          pointerEvents="none"
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>ANI GEZEGENLERİ</Text>
          <Text style={styles.sectionCount}>
            {hasPlanets ? `${planets.length} anı yörüngede` : 'Yörünge boş'}
          </Text>
        </View>

        {hasPlanets ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cardRow}
            style={styles.cardScroller}
          >
            <CreateCard isPremium={isPremium} wide={false} onPress={onCreatePlanet} />
            {planets.map((planet) => (
              <PlanetCard
                key={planet.id}
                planet={planet}
                highlighted={planet.id === highlightPlanetId}
                onPress={onOpenPlanet}
              />
            ))}
          </ScrollView>
        ) : (
          <CreateCard isPremium={isPremium} wide onPress={onCreatePlanet} />
        )}

        <View style={styles.actionRow}>
          <SparkButton cooldownSec={cooldownSec} onPress={onSpark} />
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onExitToSky}
            style={styles.skyButton}
            accessibilityRole="button"
            accessibilityLabel="Gök Kubbeye Çık"
          >
            <Globe size={21} color="#7DD3FC" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  shadowShell: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
    borderRadius: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
  },
  panel: {
    borderRadius: 28,
    overflow: 'hidden',
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    // Canlı bulanıklık yok: 60 FPS sahnenin üstünde her karede yeniden hesaplanıp takılmaya yol açıyordu.
    backgroundColor: 'rgba(10, 8, 26, 0.88)',
  },
  topHairline: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sectionEyebrow: {
    color: 'rgba(253, 230, 138, 0.85)',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.2,
  },
  sectionCount: {
    color: 'rgba(203, 213, 225, 0.55)',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  cardScroller: {
    marginHorizontal: -14,
  },
  cardRow: {
    gap: 10,
    paddingHorizontal: 14,
  },
  planetCard: {
    width: 168,
    height: 62,
    borderRadius: 18,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  planetCardActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.09)',
    borderColor: 'rgba(251, 191, 36, 0.55)',
  },
  planetCardText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  planetCardTitle: {
    color: '#F8FAFC',
    fontSize: 12.5,
    fontFamily: 'Inter_700Bold',
  },
  planetCardSub: {
    color: 'rgba(203, 213, 225, 0.58)',
    fontSize: 10.5,
    fontFamily: 'Inter_500Medium',
  },
  createCard: {
    width: 92,
    height: 62,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(251, 191, 36, 0.45)',
  },
  createCardWide: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 14,
    gap: 12,
  },
  createIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createLabel: {
    color: '#FDE68A',
    fontSize: 11.5,
    fontFamily: 'Inter_700Bold',
  },
  createWideTitle: {
    color: '#FDE68A',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  crownBadge: {
    position: 'absolute',
    top: 5,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sparkShell: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    overflow: 'hidden',
  },
  sparkReady: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  shimmer: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    left: 0,
    width: 70,
  },
  sparkIconReady: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  sparkTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  sparkTitleReady: {
    color: '#2A1300',
    fontSize: 15,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.2,
  },
  sparkSubReady: {
    color: 'rgba(42, 19, 0, 0.7)',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  sparkCooldown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(251, 191, 36, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  sparkIconCooldown: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
  },
  sparkTitleCooldown: {
    color: '#FDE68A',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  sparkSubCooldown: {
    color: 'rgba(253, 230, 138, 0.6)',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
  },
  sparkTimer: {
    color: 'rgba(253, 230, 138, 0.9)',
    fontFamily: 'Inter_700Bold',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
  },
  progressFill: {
    height: '100%',
  },
  skyButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(125, 211, 252, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.28)',
  },
});

export default MicroSystemDock;
