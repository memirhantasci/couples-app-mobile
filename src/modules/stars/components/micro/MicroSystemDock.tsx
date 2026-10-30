/**
 * @file MicroSystemDock.tsx
 * @module modules/stars/components/micro
 * @description Yıldızın içindeyken alttaki cam panel:
 *   1. Anı gezegenleri şeridi — her gezegen bir kart; ilk kart yeni anı ekler.
 *   2. Gök kubbeye dönüş düğmesi.
 *
 * Yıldızın ışığı artık çiftin uygulamadaki aktivitesinden gelir; günlük ışık ritüeli yoktur.
 */

import { memo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Globe, Plus } from 'lucide-react-native';

import type { StarSystemMapPlanet } from '../../types/star.types';
import { planetTypeLabel } from '../ExoplanetModal';
import { MiniPlanet } from './MiniPlanet';
import { useTranslation } from 'react-i18next';

export interface MicroSystemDockProps {
  readonly planets: readonly StarSystemMapPlanet[];
  readonly isPremium: boolean;
  readonly bottomInset: number;
  readonly highlightPlanetId?: string | null;
  readonly onOpenPlanet: (planet: StarSystemMapPlanet) => void;
  readonly onCreatePlanet: () => void;
  readonly onExitToSky: () => void;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
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
  const { t } = useTranslation();
  const typeLabel = planetTypeLabel(planet.planet_type, t);
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(planet)}
      style={[styles.planetCard, highlighted && styles.planetCardActive]}
      accessibilityRole="button"
      accessibilityLabel={planet.is_locked ? t('stars.micro.lockedPlanetA11y') : t('stars.micro.openPlanetA11y', { display_title: planet.display_title })}
    >
      <MiniPlanet planet={planet} size={34} />
      <View style={styles.planetCardText}>
        <Text style={styles.planetCardTitle} numberOfLines={1}>
          {planet.is_locked ? t('stars.micro.lockedMemory') : planet.display_title}
        </Text>
        <Text style={styles.planetCardSub} numberOfLines={1}>
          {planet.is_locked ? t('stars.micro.unlockPremium') : t('stars.micro.planetSub', { typeLabel, orbit_distance: planet.orbit_distance })}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

function CreateCard({ isPremium, wide, onPress }: { isPremium: boolean; wide: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.createCard, wide && styles.createCardWide]}
      accessibilityRole="button"
      accessibilityLabel={t('stars.micro.createA11y')}
    >
      <LinearGradient colors={['#FDE68A', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.createIcon}>
        <Plus size={16} color="#3B1D00" strokeWidth={2.6} />
      </LinearGradient>
      {wide ? (
        <View style={styles.planetCardText}>
          <Text style={styles.createWideTitle} numberOfLines={1}>
            {t('stars.micro.createFirst')}
          </Text>
          <Text style={styles.planetCardSub} numberOfLines={1}>
            {t('stars.micro.createFirstSub')}
          </Text>
        </View>
      ) : (
        <Text style={styles.createLabel}>{t('notifications.push.memory.subtitle')}</Text>
      )}
      {!isPremium && (
        <View style={styles.crownBadge}>
          <Crown size={10} color="#FBBF24" fill="#FBBF24" />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────────

export const MicroSystemDock = memo(function MicroSystemDock({
  planets,
  isPremium,
  bottomInset,
  highlightPlanetId,
  onOpenPlanet,
  onCreatePlanet,
  onExitToSky,
  onLayout,
}: MicroSystemDockProps) {
  const { t } = useTranslation();
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
          <Text style={styles.sectionEyebrow}>{t('stars.micro.planetsEyebrow')}</Text>
          <Text style={styles.sectionCount}>
            {hasPlanets ? t('stars.micro.planetCount', { count: planets.length }) : t('stars.micro.orbitEmpty')}
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

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onExitToSky}
          style={styles.skyButton}
          accessibilityRole="button"
          accessibilityLabel={t('stars.micro.backToSky')}
        >
          <Globe size={19} color="#7DD3FC" />
          <Text style={styles.skyButtonText}>{t('stars.micro.backToSky')}</Text>
        </TouchableOpacity>
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
  skyButton: {
    height: 50,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(125, 211, 252, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.28)',
  },
  skyButtonText: {
    color: '#BAE6FD',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
});

export default MicroSystemDock;
