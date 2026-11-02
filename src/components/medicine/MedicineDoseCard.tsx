import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
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

const SPIN_MS = 450;
const SPLASH_MS = 560;
const DROP_COLOR = "#38BDF8";
/** Su damlacıklarının fırlama yönü (derece, 0 = sağ, -90 = yukarı) ve uzaklığı. */
const DROPS = [
  { angle: -160, distance: 30 },
  { angle: -115, distance: 34 },
  { angle: -65, distance: 34 },
  { angle: -20, distance: 30 },
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

  const spin = useSharedValue(0);
  const splash = useSharedValue(0);
  // "İçtim" denen doz kaydedilirken bekleme simgesi yerine hemen yeşil kutu görünür
  const [justTakenSlot, setJustTakenSlot] = useState<string | null>(null);

  const handleTake = (slotTime: string) => {
    if (!onLog(m.id, "DRANK", slotTime)) return;
    setJustTakenSlot(`${m.id}_${slotTime}`);
    // Tek titreşim: baloncuk sesi kendi titreşimini vermez, dokunuşu hapticTap verir
    playBubblePop({ haptic: false });
    hapticTap();
    if (reduceMotion) return;
    spin.set(0);
    spin.set(withTiming(1, { duration: SPIN_MS, easing: Easing.out(Easing.back(1.5)) }));
    splash.set(0);
    splash.set(withTiming(1, { duration: SPLASH_MS, easing: Easing.out(Easing.quad) }));
  };

  const handleSkip = (slotTime: string) => {
    // Kaydı başarısız olmuş bir "İçtim" atlanırken yeşil kutu gösterilmesin
    setJustTakenSlot(null);
    onLog(m.id, "MISSED", slotTime);
  };

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${360 * spin.get()}deg` }],
  }));

  return (
    <View style={[styles.medCard, { backgroundColor: theme.cardBg, ...theme.cardShadow }]}>
      <View style={styles.medCardHeader}>
        <View style={styles.medIconWrap}>
          {/* Damlacıklar ikonun arkasından fırlar: kutunun dışına çıkınca görünür */}
          {DROPS.map((drop, index) => (
            <WaterDrop key={index} splash={splash} {...drop} />
          ))}
          <View style={[styles.medIconBox, { backgroundColor: theme.pillAccentBg }]}>
            <Animated.View style={pillStyle}>
              <Pill color={theme.accent} size={20} />
            </Animated.View>
          </View>
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

/** İkonun arkasından fırlayıp hafifçe düşerek sönen su damlacığı (ucu uçuş yönüne bakar). */
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
        { translateY: dy * p + 10 * p * p },
        { rotate: `${angle + 90}deg` },
        { scale: 1 - 0.35 * p },
      ],
    };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.drop, style]}>
      <Svg width={7} height={10} viewBox="0 0 7 10">
        <Path d="M3.5 0 C3.5 0 7 4.6 7 6.5 A3.5 3.5 0 0 1 0 6.5 C0 4.6 3.5 0 3.5 0 Z" fill={DROP_COLOR} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Alınmış doz kutusu. "İçtim" ile yeni açıldıysa vurgu renginden yeşile döner, hafifçe ezilip yaylanır.
 */
function TakenSlot({ label, theme, celebrate }: { label: string; theme: AppTheme; celebrate: boolean }) {
  const greenText = theme.isLight ? "#15803D" : "#22c55e";
  // Kutu kayıt bitene kadar aynı kalır (bekleme ve kayıtlı durum aynı öğe): animasyon yalnızca ilk çizimde
  const [celebrateOnMount] = useState(celebrate);
  const squash = useSharedValue(0);
  const tint = useSharedValue(celebrateOnMount ? 0 : 1);

  useEffect(() => {
    if (!celebrateOnMount) return;
    squash.set(withSequence(withTiming(1, { duration: 90 }), withSpring(0, { damping: 10, stiffness: 160 })));
    tint.set(withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) }));
  }, [celebrateOnMount, squash, tint]);

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(tint.get(), [0, 1], [theme.accent, TAKEN_GREEN]),
    transform: [{ scaleX: 1 + 0.04 * squash.get() }, { scaleY: 1 - 0.12 * squash.get() }],
  }));

  return (
    <Animated.View style={[styles.slotStateBox, boxStyle]}>
      <CheckCircle2 size={16} color={greenText} />
      <Text style={[styles.drankStateText, { color: greenText }]}>{label}</Text>
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
  medIconWrap: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  medIconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  drop: {
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
