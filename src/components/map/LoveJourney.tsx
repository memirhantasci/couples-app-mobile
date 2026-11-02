import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Route, X } from "lucide-react-native";
import MapView, { Polyline } from "react-native-maps";
import { useTranslation } from "react-i18next";
import { dayjs } from "@/lib/date";
import { useStorageImage } from "@/lib/storageImages";
import { playStampDrop } from "@/lib/soundEffects";
import type { JourneyStop } from "./journeyStops";

// ─── Zaman Çizelgesi (ms) ───────────────────────────────────────────────────────
// Kamera ilk durağa iner → anı kartı belirir (mühür tıkı) → kısa bekleme → rota bir sonraki durağa
// uzarken kamera süzülür → … → son durakta tüm rota ekrana sığdırılır.
const FIRST_FLY_MS = 1100;
const FLY_MS = 1500;
const DWELL_MS = 1700;
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
        playStampDrop();
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

/** Varılan durağın anısı: kameranın ortaladığı pinin hemen üstünde minik bir kart. */
export function JourneyStopCard({ journey, isLight }: { journey: JourneyState; isLight: boolean }) {
  const { height } = useWindowDimensions();
  const { stops, index, phase } = journey;
  if (phase !== "arrived") return null;
  const stop = stops[index];
  // Kamera durağı haritanın (tam ekran) ortasına alır: kart pinin üst ucunun üstünde durur
  return (
    <View pointerEvents="none" style={[styles.stopCardAnchor, { bottom: height / 2 + 74 }]}>
      <Animated.View
        key={stop.key}
        entering={ZoomIn.springify().damping(13)}
        exiting={FadeOut.duration(180)}
        style={[styles.stopCard, { backgroundColor: isLight ? "rgba(255,255,255,0.96)" : "rgba(24,18,30,0.94)" }]}
      >
        <StopVisual stop={stop} />
        <StopText stop={stop} total={stops.length} index={index} isLight={isLight} />
      </Animated.View>
    </View>
  );
}

function StopVisual({ stop }: { stop: JourneyStop }) {
  const photoSource = useStorageImage(
    "photos",
    stop.type === "photo" ? stop.photo.thumb_path || stop.photo.storage_path : null
  );
  if (stop.type === "photo") {
    return <Image source={photoSource} style={styles.stopPhoto} contentFit="cover" cachePolicy="memory-disk" transition={120} />;
  }
  return (
    <View style={[styles.stopEmoji, { backgroundColor: stop.type === "note" ? "#FDE2EA" : "#EDE4FF" }]}>
      <Text style={styles.stopEmojiText}>{stop.type === "note" ? "💌" : "📅"}</Text>
    </View>
  );
}

function StopText({ stop, index, total, isLight }: { stop: JourneyStop; index: number; total: number; isLight: boolean }) {
  const { t, i18n } = useTranslation();
  const label =
    stop.type === "photo"
      ? stop.photo.title || stop.photo.location_name || null
      : stop.type === "note"
        ? stop.note.note
        : stop.meeting.title || stop.meeting.location_name || null;

  return (
    <View style={styles.stopTextCol}>
      <Text style={[styles.stopStep, { color: ROUTE_COLOR }]}>
        {t("map.journey.step", { current: index + 1, total })}
      </Text>
      {label ? (
        <Text style={[styles.stopLabel, { color: isLight ? "#1A1528" : "#FFFFFF" }]} numberOfLines={2}>
          {label}
        </Text>
      ) : null}
      <Text style={[styles.stopDate, { color: isLight ? "#6B6577" : "rgba(255,255,255,0.6)" }]}>
        {dayjs(stop.time).locale(i18n.language).format("D MMMM YYYY")}
      </Text>
    </View>
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
      ? t("map.journey.finished", { count: journey.stops.length })
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
  stopCardAnchor: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 12,
  },
  stopCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 8,
    paddingRight: 14,
    borderRadius: 18,
    maxWidth: 270,
    shadowColor: "#FF5C8A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },
  stopPhoto: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  stopEmoji: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stopEmojiText: {
    fontSize: 24,
  },
  stopTextCol: {
    flexShrink: 1,
    gap: 2,
  },
  stopStep: {
    fontSize: 10.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  stopLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  stopDate: {
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
  },
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
