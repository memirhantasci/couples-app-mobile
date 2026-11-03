import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path, Rect } from "react-native-svg";
import { Pill, CheckCircle2, Clock, AlertCircle } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import type { MedicineItem, MedicineTab } from "./medicineTypes";
import { hapticTap, playBubblePop } from "@/lib/soundEffects";
import { useTranslation } from "react-i18next";

interface MedicineDoseCardProps {
  medicine: MedicineItem;
  theme: AppTheme;
  activeTab: MedicineTab;
  /** `${medicineId}_${HH:mm}` → "DRANK" | "MISSED" | "PENDING" */
  statusMap: Record<string, string>;
  /** `${medicineId}_${HH:mm}` of the slot currently being saved, if any. */
  loadingSlot: string | null;
  /** Current time as "HH:mm", used to tell upcoming doses from due ones. */
  currentHMS: string;
  /** Returns false when the log was not started (e.g. intercepted in demo mode). */
  onLog: (medicineId: number, status: "DRANK" | "MISSED", timeSlot: string) => boolean;
}

const JUMP_HEIGHT = 30;
const RISE_MS = 210;
/** Yayla düşen hapın zemine ilk değdiği an: bu yayla tepeden düşüş ~150 ms sürer. */
const LAND_MS = RISE_MS + 150;
/** Hap seke seke yerine oturduktan sonra yerini onay ikonuna bırakır. */
const SWAP_MS = LAND_MS + 120;
const SPLASH_MS = 560;
const RISE = { duration: RISE_MS, easing: Easing.out(Easing.quad) };
// Reanimated 4'te varsayılan kütle 4: verilmezse bu yay saniyelerce jöle gibi sallanır
const PILL_SPRING = { damping: 9, stiffness: 180, mass: 1 };
const DROP_COLOR = "#38BDF8";
const SPARKLE_COLOR = "#FDE68A";
/** Kapsülün iki yarısı: pembe ve mavi vurgu renklerinin üstünde de seçilir. */
const PILL_COLORS = ["#FFFFFF", "#FCD34D"] as const;
/**
 * Su damlacıklarının fırlama yönü (derece, 0 = sağ, -90 = yukarı) ve uzaklığı: hapın tepe noktasının
 * çevresinden her yöne, kutunun dışına taşacak kadar.
 */
const DROPS = [
  { angle: -90, distance: 38 },
  { angle: -20, distance: 42 },
  { angle: 40, distance: 36 },
  { angle: 140, distance: 36 },
  { angle: 200, distance: 42 },
] as const;
/** Damlaların arasından parlayıp sönen ışıltılar. */
const SPARKLES = [
  { angle: -130, distance: 28, size: 8 },
  { angle: -50, distance: 30, size: 7 },
  { angle: 90, distance: 24, size: 6 },
] as const;
const TAKEN_GREEN = "rgba(34, 197, 94, 0.16)";

// ─── BUGÜNÜN İLACI: DOZ SLOTLARI ─────────────────────────────────────────────
function MedicineDoseCardBase({
  medicine: m,
  theme,
  activeTab,
  statusMap,
  loadingSlot,
  currentHMS,
  onLog,
}: MedicineDoseCardProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const times = Array.isArray(m.times) && m.times.length > 0
    ? m.times.map((t) => t.substring(0, 5))
    : [m.time ? m.time.substring(0, 5) : "08:00"];

  // "İçtim" denen doz kaydedilirken bekleme simgesi yerine hemen alınmış kutusu görünür; hap zıplaması
  // ve su sıçraması dokunulan bu kutuda oynar
  const [justTakenSlot, setJustTakenSlot] = useState<string | null>(null);

  const handleTake = (slotTime: string) => {
    if (!onLog(m.id, "DRANK", slotTime)) return;
    setJustTakenSlot(`${m.id}_${slotTime}`);
    // Tek titreşim: baloncuk sesi kendi titreşimini vermez, dokunuşu hapticTap verir
    playBubblePop({ haptic: false });
    hapticTap();
  };

  const handleSkip = (slotTime: string) => {
    // Kaydı başarısız olmuş bir "İçtim" atlanırken yeşil kutu gösterilmesin
    setJustTakenSlot(null);
    onLog(m.id, "MISSED", slotTime);
  };

  return (
    <View style={[styles.medCard, { backgroundColor: theme.cardBg, ...theme.cardShadow }]}>
      <View style={styles.medCardHeader}>
        <View style={[styles.medIconBox, { backgroundColor: theme.pillAccentBg }]}>
          <Pill color={theme.accent} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.medName, { color: theme.text }]}>{m.name}</Text>
          <Text style={[styles.medSub, { color: theme.textMuted }]}>{t("medicine.dose.perDay", { count: times.length, times: times.join(", ") })}</Text>
        </View>
      </View>

      {/* Dozaj Slotları */}
      <View style={styles.slotsContainer}>
        {times.map((slotTime, slotIdx) => {
          const key = `${m.id}_${slotTime}`;
          const itemKey = `${m.id}_${slotTime}_${slotIdx}`;
          const status = statusMap[key] || "PENDING";
          const isDrank = status === "DRANK";
          const isMissed = status === "MISSED";
          const isSlotLoading = loadingSlot === key;
          const isTimePassed = currentHMS >= slotTime;
          const isJustTaken = justTakenSlot === key;

          if (isSlotLoading && !isJustTaken) {
            return (
              <View key={itemKey} style={[styles.slotStateBox, { backgroundColor: theme.unitBg }]}>
                <ActivityIndicator color={theme.accent} size="small" />
              </View>
            );
          }

          if (isDrank || isSlotLoading) {
            return (
              <TakenSlot
                key={itemKey}
                label={t("medicine.dose.taken", { time: slotTime })}
                theme={theme}
                celebrate={isJustTaken && !reduceMotion}
              />
            );
          }

          if (isMissed) {
            return (
              <View key={itemKey} style={[styles.slotStateBox, { backgroundColor: theme.unitBg }]}>
                <Text style={[styles.missedStateText, { color: theme.textMuted }]}>{t("medicine.dose.skipped", { time: slotTime })}</Text>
              </View>
            );
          }

          if (!isTimePassed) {
            return (
              <View key={itemKey} style={[styles.slotStateBox, { backgroundColor: theme.unitBg }]}>
                <Clock size={13} color={theme.textMuted} />
                <Text style={[styles.waitingStateText, { color: theme.textSecondary }]}>{t("medicine.dose.pending", { time: slotTime })}</Text>
              </View>
            );
          }

          if (activeTab === "partner") {
            return (
              <View key={itemKey} style={[styles.slotStateBox, { backgroundColor: theme.unitBg }]}>
                <AlertCircle size={14} color={theme.isLight ? "#B45309" : "#f59e0b"} />
                <Text style={[styles.waitingStateText, { color: theme.textSecondary }]}>{t("medicine.dose.notTaken", { time: slotTime })}</Text>
              </View>
            );
          }

          // Kullanıcının kendi ilacı için aksiyon butonları
          return (
            <View key={itemKey} style={styles.actionSlotRow}>
              <TouchableOpacity
                style={[styles.skipBtn, { backgroundColor: theme.unitBg }]}
                onPress={() => handleSkip(slotTime)}
                activeOpacity={0.8}
              >
                <Text style={[styles.skipBtnText, { color: theme.textSecondary }]}>{t("medicine.dose.skip", { time: slotTime })}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.takeBtn, { backgroundColor: theme.accent }]}
                onPress={() => handleTake(slotTime)}
                activeOpacity={0.85}
              >
                <CheckCircle2 size={16} color="#ffffff" />
                <Text style={styles.takeBtnText}>{t("medicine.dose.took", { time: slotTime })}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export const MedicineDoseCard = React.memo(MedicineDoseCardBase);

/** İki renkli, parlak lekeli minik kapsül. */
function Capsule() {
  return (
    <Svg width={22} height={12} viewBox="0 0 22 12">
      <Path d="M6 0 H11 V12 H6 A6 6 0 0 1 6 0 Z" fill={PILL_COLORS[0]} />
      <Path d="M11 0 H16 A6 6 0 0 1 16 12 H11 Z" fill={PILL_COLORS[1]} />
      <Rect x={12.5} y={2.2} width={5} height={1.8} rx={0.9} fill="#FFFFFF" opacity={0.75} />
    </Svg>
  );
}

/** Hapın tepe noktasından dışa fırlayıp küçülerek sönen su damlacığı (ucu uçuş yönüne bakar). */
function WaterDrop({ splash, angle, distance }: { splash: SharedValue<number>; angle: number; distance: number }) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad) * distance;
  const dy = Math.sin(rad) * distance;

  const style = useAnimatedStyle(() => {
    const p = splash.get();
    return {
      opacity: p <= 0 ? 0 : 1 - p,
      transform: [
        { translateX: dx * p },
        { translateY: dy * p + 8 * p * p },
        { rotate: `${angle + 90}deg` },
        { scale: 1 - p },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.burstPiece, style]}>
      <Svg width={7} height={10} viewBox="0 0 7 10">
        <Path d="M3.5 0 C3.5 0 7 4.6 7 6.5 A3.5 3.5 0 0 1 0 6.5 C0 4.6 3.5 0 3.5 0 Z" fill={DROP_COLOR} />
      </Svg>
    </Animated.View>
  );
}

/** Damlalarla birlikte dışa süzülürken parlayıp sönen dört köşeli ışıltı. */
function Sparkle({ splash, angle, distance, size }: { splash: SharedValue<number>; angle: number; distance: number; size: number }) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad) * distance;
  const dy = Math.sin(rad) * distance;

  const style = useAnimatedStyle(() => {
    const p = splash.get();
    const glow = Math.sin(Math.PI * p);
    return {
      opacity: glow,
      transform: [
        { translateX: dx * p },
        { translateY: dy * p },
        { rotate: `${90 * p}deg` },
        { scale: 0.4 + 0.8 * glow },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.burstPiece, style]}>
      <Svg width={size} height={size} viewBox="0 0 8 8">
        <Path d="M4 0 L5 3 L8 4 L5 5 L4 8 L3 5 L0 4 L3 3 Z" fill={SPARKLE_COLOR} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Alınmış doz kutusu. "İçtim" ile yeni açıldıysa (dokunulan buton bu kutuya dönüşür) iki renkli bir hap
 * neşeyle zıplar, havada takla atıp büyür; tepe noktasında mavi su damlacıkları ve ışıltılar saçılır.
 * Hap yere değdiği an kutu vurgu renginden yeşile döner, hafifçe ezilip yaylanır ve hap yerini onay
 * ikonuna bırakır.
 */
function TakenSlot({ label, theme, celebrate }: { label: string; theme: AppTheme; celebrate: boolean }) {
  const greenText = theme.isLight ? "#15803D" : "#22c55e";
  // Kutu kayıt bitene kadar aynı kalır (bekleme ve kayıtlı durum aynı öğe): animasyon yalnızca ilk çizimde
  const [celebrateOnMount] = useState(celebrate);
  const jumpY = useSharedValue(0);
  const tilt = useSharedValue(0);
  const pillScale = useSharedValue(1);
  const pillOpacity = useSharedValue(celebrateOnMount ? 1 : 0);
  const checkIn = useSharedValue(celebrateOnMount ? 0 : 1);
  const squash = useSharedValue(0);
  const tint = useSharedValue(celebrateOnMount ? 0 : 1);
  const splash = useSharedValue(0);

  useEffect(() => {
    if (!celebrateOnMount) return;
    // Yavaşlayarak tepeye çıkar, yayla düşüp zeminde sekerek oturur
    jumpY.set(withSequence(withTiming(-JUMP_HEIGHT, RISE), withSpring(0, PILL_SPRING)));
    tilt.set(
      withSequence(
        withTiming(45, RISE),
        withTiming(-15, { duration: LAND_MS - RISE_MS, easing: Easing.in(Easing.quad) }),
        withSpring(0, PILL_SPRING)
      )
    );
    pillScale.set(withSequence(withTiming(1.25, RISE), withSpring(1, PILL_SPRING)));
    splash.set(withDelay(RISE_MS, withTiming(1, { duration: SPLASH_MS, easing: Easing.out(Easing.quad) })));
    tint.set(withDelay(LAND_MS, withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) })));
    squash.set(
      withDelay(LAND_MS, withSequence(withTiming(1, { duration: 90 }), withSpring(0, { damping: 10, stiffness: 160 })))
    );
    pillOpacity.set(withDelay(SWAP_MS, withTiming(0, { duration: 180 })));
    checkIn.set(withDelay(SWAP_MS, withTiming(1, { duration: 260, easing: Easing.out(Easing.back(2)) })));
  }, [celebrateOnMount, jumpY, tilt, pillScale, pillOpacity, checkIn, squash, tint, splash]);

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(tint.get(), [0, 1], [theme.accent, TAKEN_GREEN]),
    transform: [{ scaleX: 1 + 0.04 * squash.get() }, { scaleY: 1 - 0.12 * squash.get() }],
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(tint.get(), [0, 1], ["#ffffff", greenText]),
  }));
  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.get(),
    transform: [{ translateY: jumpY.get() }, { rotate: `${tilt.get()}deg` }, { scale: pillScale.get() }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, checkIn.get()),
    transform: [{ scale: 0.5 + 0.5 * checkIn.get() }],
  }));

  return (
    <Animated.View style={[styles.slotStateBox, boxStyle]}>
      <View style={styles.takenIconWrap}>
        {celebrateOnMount ? (
          <>
            <View pointerEvents="none" style={styles.burst}>
              {DROPS.map((drop, index) => <WaterDrop key={`drop${index}`} splash={splash} {...drop} />)}
              {SPARKLES.map((sparkle, index) => <Sparkle key={`sparkle${index}`} splash={splash} {...sparkle} />)}
            </View>
            <Animated.View pointerEvents="none" style={[styles.burstPiece, pillStyle]}>
              <Capsule />
            </Animated.View>
          </>
        ) : null}
        <Animated.View style={checkStyle}>
          <CheckCircle2 size={16} color={greenText} />
        </Animated.View>
      </View>
      <Animated.Text style={[styles.drankStateText, labelStyle]}>{label}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  medCard: {
    borderRadius: 28,
    padding: 18,
    gap: 16,
  },
  medCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  medIconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  // Hap onay ikonunun yerinden zıplar; damlacıklar ve ışıltılar hapın tepe noktasından saçılır
  takenIconWrap: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  burst: {
    position: "absolute",
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -JUMP_HEIGHT }],
  },
  burstPiece: {
    position: "absolute",
  },
  medName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  medSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  slotsContainer: {
    gap: 8,
  },
  slotStateBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 18,
  },
  drankStateText: {
    color: "#22c55e",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  missedStateText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
  },
  waitingStateText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
  },
  actionSlotRow: {
    flexDirection: "row",
    gap: 10,
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  skipBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  takeBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 18,
  },
  takeBtnText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
  },
});
