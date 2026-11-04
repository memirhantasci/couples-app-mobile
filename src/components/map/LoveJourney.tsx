import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Route, X } from "lucide-react-native";
import MapView, { Polyline } from "react-native-maps";
import { useTranslation } from "react-i18next";
import { playStampDrop } from "@/lib/soundEffects";
import type { JourneyStop } from "./journeyStops";

// ─── Zaman Çizelgesi (ms) ───────────────────────────────────────────────────────
// Kamera ilk durağa iner (mühür tıkı) → kısa bekleme → rota bir sonraki durağa uzarken kamera süzülür
// → … → son durakta tüm rota ekrana sığdırılır. Durakta kart açılmaz: ekranda yalnızca rota ve alttaki
// ilerleme hapı vardır, kamera akışı kesilmez.
const FIRST_FLY_MS = 1100;
const FLY_MS = 1500;
const DWELL_MS = 800;
/** Rota parçası uçuş boyunca bu aralıkla uzar (harita çizgisi native bir katmandır, UI iş parçacığından sürülemez) */
const ROUTE_STEP_MS = 90;
const STOP_DELTA = 0.035;
const ROUTE_COLOR = "#FF5C8A";

export type JourneyPhase = "flying" | "arrived" | "finished";

export interface JourneyState {
  stops: JourneyStop[];
  /** Kameranın gittiği / bulunduğu durak */
  index: number;
  phase: JourneyPhase;
}

/**
 * Turu yönetir: kamerayı duraktan durağa süzer, varışta mühür tıkı verir. Zamanlayıcılar yalnızca
 * durak geçişlerini planlar; kamera hareketini harita kendisi (native) canlandırır.
 */
export function useLoveJourney(mapRef: RefObject<MapView | null>) {
  const [journey, setJourney] = useState<JourneyState | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const stopJourney = useCallback(() => {
    clearTimers();
    setJourney(null);
  }, [clearTimers]);

  const fitRoute = useCallback(
    (stops: JourneyStop[], animated: boolean) => {
      mapRef.current?.fitToCoordinates(stops, {
        edgePadding: { top: 200, right: 60, bottom: 220, left: 60 },
        animated,
      });
    },
    [mapRef]
  );

  const startJourney = useCallback(
    (stops: JourneyStop[], reduceMotion: boolean) => {
      clearTimers();
      if (stops.length === 0) return;
      // Hareket azaltma: turun son karesi, yani tüm rota tek seferde ekranda
      if (reduceMotion) {
        setJourney({ stops, index: stops.length - 1, phase: "finished" });
        fitRoute(stops, false);
        return;
      }

      const schedule = (fn: () => void, ms: number) => {
        timersRef.current.push(setTimeout(fn, ms));
      };

      const fly = (index: number) => {
        const stop = stops[index];
        const duration = index === 0 ? FIRST_FLY_MS : FLY_MS;
        setJourney({ stops, index, phase: "flying" });
        mapRef.current?.animateToRegion(
          { latitude: stop.latitude, longitude: stop.longitude, latitudeDelta: STOP_DELTA, longitudeDelta: STOP_DELTA },
          duration
        );
        schedule(() => arrive(index), duration + 60);
      };

      const arrive = (index: number) => {
        setJourney({ stops, index, phase: "arrived" });
        // Her durakta yalnızca ses: uzun bir turda her varışta titreşmek durmadan titretiyordu
        playStampDrop({ haptic: false });
        schedule(() => {
          if (index < stops.length - 1) {
            fly(index + 1);
          } else {
            setJourney({ stops, index, phase: "finished" });
            fitRoute(stops, true);
          }
        }, DWELL_MS);
      };

      fly(0);
    },
    [clearTimers, fitRoute, mapRef]
  );

  useEffect(() => clearTimers, [clearTimers]);

  return { journey, startJourney, stopJourney };
}

/** Haritanın içinde: tamamlanan rota + uçuş sırasında bir sonraki durağa doğru uzayan parça. */
export function JourneyRoute({ journey }: { journey: JourneyState }) {
  const { stops, index, phase } = journey;
  const growing = phase === "flying" && index > 0;
  // Uzayan parçanın ilerlemesi (0..1); yalnızca bu bileşen yeniden çizilir, harita ekranı değil
  const [progress, setProgress] = useState({ index, value: growing ? 0 : 1 });
  if (progress.index !== index) setProgress({ index, value: growing ? 0 : 1 });

  useEffect(() => {
    if (!growing) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const value = Math.min(1, (Date.now() - startedAt) / FLY_MS);
      setProgress({ index, value });
      if (value >= 1) clearInterval(timer);
    }, ROUTE_STEP_MS);
    return () => clearInterval(timer);
  }, [growing, index]);

  const reached = stops.slice(0, index + (growing ? 0 : 1));
  const coordinates = reached.map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
  if (growing) {
    const from = stops[index - 1];
    const to = stops[index];
    // Yumuşak kalkış ve iniş: çizgi kameranın süzülüşüyle aynı ritimde uzar
    const t = progress.value < 0.5 ? 2 * progress.value ** 2 : 1 - (-2 * progress.value + 2) ** 2 / 2;
    coordinates.push({
      latitude: from.latitude + (to.latitude - from.latitude) * t,
      longitude: from.longitude + (to.longitude - from.longitude) * t,
    });
  }
  if (coordinates.length < 2) return null;

  return (
    <>
      {/* Işıma: geniş, yarı saydam alt çizgi */}
      <Polyline coordinates={coordinates} strokeColor="rgba(255, 92, 138, 0.28)" strokeWidth={10} geodesic lineCap="round" />
      <Polyline
        coordinates={coordinates}
        strokeColor={ROUTE_COLOR}
        strokeWidth={3.5}
        lineDashPattern={[10, 8]}
        geodesic
        lineCap="round"
      />
    </>
  );
}

/** Tur sürerken alttaki ipucu hapının yerini alır: ilerleme ve kapatma. */
export function JourneyStatusPill({
  journey,
  isLight,
  accent,
  bottom,
  onClose,
}: {
  journey: JourneyState;
  isLight: boolean;
  accent: string;
  bottom: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const text =
    journey.phase === "finished"
      ? t("map.journey.finished")
      : t("map.journey.progress", { current: journey.index + 1, total: journey.stops.length });

  return (
    <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} style={[styles.statusPill, { bottom }]}>
      <BlurView tint={isLight ? "light" : "dark"} intensity={85} style={StyleSheet.absoluteFill} />
      <Route size={15} color={accent} />
      <Text style={[styles.statusText, { color: isLight ? "#222" : "#fff" }]} numberOfLines={1}>
        {text}
      </Text>
      <TouchableOpacity
        onPress={onClose}
        hitSlop={10}
        style={[styles.statusClose, { backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.12)" }]}
        accessibilityRole="button"
        accessibilityLabel={t("map.journey.close")}
      >
        <X size={14} color={isLight ? "#222" : "#fff"} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  statusPill: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 7,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 92, 138, 0.35)",
    zIndex: 10,
  },
  statusText: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  statusClose: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
});
