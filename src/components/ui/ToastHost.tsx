import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { AccessibilityInfo, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react-native";
import {
  finishToast,
  getCurrentToast,
  subscribeToasts,
  type ToastItem,
  type ToastVariant,
} from "@/lib/toast";
import { hapticError, hapticSuccess, hapticTap, hapticWarning } from "@/lib/soundEffects";

const OFFSCREEN_Y = -180;
const ENTER_MS = 320;
const EXIT_MS = 240;
// Parmak bırakıldığında otomatik kapanmaya kalan süre
const RESUME_MS = 1400;
const DISMISS_DISTANCE = 26;
const DISMISS_VELOCITY = 520;

// Yeşil / altın imza: başarı yeşilden altına akan ince çerçeveyle gelir.
const VARIANT_STYLE: Record<
  ToastVariant,
  {
    border: readonly [string, string];
    accent: string;
    iconBg: string;
    Icon: typeof CircleCheck;
  }
> = {
  success: {
    border: ["#34D399", "#F5C563"],
    accent: "#34D399",
    iconBg: "rgba(52, 211, 153, 0.16)",
    Icon: CircleCheck,
  },
  info: {
    border: ["#F5C563", "#FFE9A8"],
    accent: "#F5C563",
    iconBg: "rgba(245, 197, 99, 0.16)",
    Icon: Info,
  },
  warning: {
    border: ["#FBBF24", "#F59E0B"],
    accent: "#FBBF24",
    iconBg: "rgba(251, 191, 36, 0.16)",
    Icon: TriangleAlert,
  },
  error: {
    border: ["#FB7185", "#F43F5E"],
    accent: "#FB7185",
    iconBg: "rgba(251, 113, 133, 0.16)",
    Icon: CircleX,
  },
};

function fireToastHaptic(variant: ToastVariant) {
  switch (variant) {
    case "success":
      hapticSuccess();
      break;
    case "warning":
      hapticWarning();
      break;
    case "error":
      hapticError();
      break;
    default:
      hapticTap();
  }
}

/**
 * Uygulamanın kökünde bir kez bağlanır; `toast.success(...)` çağrılarını tek tek,
 * ekranın üstünden süzülen bir hap olarak gösterir. Yukarı kaydırarak ya da dokunarak kapatılır.
 */
export function ToastHost() {
  const item = useSyncExternalStore(subscribeToasts, getCurrentToast, getCurrentToast);
  if (!item) return null;
  // key: her toast kendi animasyon durumuyla sıfırdan başlar
  return <ToastPill key={item.id} item={item} />;
}

function ToastPill({ item }: { item: ToastItem }) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const style = VARIANT_STYLE[item.variant];

  // Giriş (appear) ve çıkış (leave) AYRI değerlerdir: aynı paylaşılan değere ikinci bir
  // `set(...)` yapmak çalışan animasyonu iptal eder; ikisini stilde birleştiriyoruz.
  const appear = useSharedValue(0);
  const leave = useSharedValue(0);
  const dragY = useSharedValue(0);
  // Kapanış başladıktan sonra "otomatik kapanmaya devam et" çağrılarını yok saymak için
  const exiting = useSharedValue(false);

  // finishToast kimliği eşleşmeyen / tekrarlanan çağrıları zaten yok sayar (idempotent)
  const finish = useCallback(() => {
    finishToast(item.id);
  }, [item.id]);

  // Çıkışı `afterMs` sonra başlayacak şekilde UI iş parçacığında zamanlar (JS meşgul olsa da akıcı kalır).
  const scheduleExit = useCallback(
    (afterMs: number) => {
      leave.set(
        withDelay(
          afterMs,
          withTiming(
            1,
            { duration: reduceMotion ? 140 : EXIT_MS, easing: Easing.in(Easing.cubic) },
            (done) => {
              "worklet";
              if (done) scheduleOnRN(finish);
            }
          )
        )
      );
    },
    [reduceMotion, leave, finish]
  );

  const exitNow = useCallback(() => {
    exiting.set(true);
    cancelAnimation(leave);
    scheduleExit(0);
  }, [exiting, leave, scheduleExit]);

  // Kaydırma başlayınca otomatik kapanma durur ve pil tam görünür kalır
  const holdExit = useCallback(() => {
    cancelAnimation(leave);
    leave.set(0);
  }, [leave]);

  const resumeExit = useCallback(() => {
    if (exiting.get()) return;
    scheduleExit(RESUME_MS);
  }, [exiting, scheduleExit]);

  const handleTap = useCallback(() => {
    item.onPress?.();
    exitNow();
  }, [item, exitNow]);

  useEffect(() => {
    appear.set(
      reduceMotion
        ? withTiming(1, { duration: 120 })
        : withSpring(1, { damping: 15, stiffness: 190, mass: 0.8 })
    );
    scheduleExit(ENTER_MS + item.duration);
    // Güvenlik ağı: animasyon geri çağrısı hiç gelmezse (arka plana atılma vb.) toast takılı kalmasın
    const safety = setTimeout(finish, ENTER_MS + item.duration + EXIT_MS + 1500);

    if (item.haptic) fireToastHaptic(item.variant);
    AccessibilityInfo.announceForAccessibility(
      item.title ? `${item.title}. ${item.message}` : item.message
    );

    return () => clearTimeout(safety);
  }, [item, reduceMotion, appear, scheduleExit, finish]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetY([-8, 8])
      .onStart(() => {
        "worklet";
        scheduleOnRN(holdExit);
      })
      .onUpdate((event) => {
        "worklet";
        // Yukarı serbest; aşağı doğru yalnızca hafif direnç
        dragY.set(event.translationY < 0 ? event.translationY : event.translationY * 0.15);
      })
      .onEnd((event) => {
        "worklet";
        if (event.translationY < -DISMISS_DISTANCE || event.velocityY < -DISMISS_VELOCITY) {
          scheduleOnRN(exitNow);
        } else {
          dragY.set(withSpring(0));
          scheduleOnRN(resumeExit);
        }
      });

    const tap = Gesture.Tap().onEnd((_event, success) => {
      "worklet";
      if (success) scheduleOnRN(handleTap);
    });

    return Gesture.Race(pan, tap);
  }, [dragY, holdExit, exitNow, resumeExit, handleTap]);

  const animatedStyle = useAnimatedStyle(() => {
    const a = appear.get();
    const l = leave.get();
    // Hareket azaltma açıkken kayma / ölçek yok, yalnızca solma
    const slide = reduceMotion ? 0 : 1;
    return {
      opacity: Math.min(1, a * 2) * (1 - l),
      transform: [
        // a > 1 (yay taşması) pilin yerine oturmadan önce hafifçe aşağı zıplamasını sağlar
        { translateY: slide * ((1 - a) * OFFSCREEN_Y + l * OFFSCREEN_Y) + dragY.get() },
        { scale: reduceMotion ? 1 : 0.92 + 0.08 * Math.min(1, a) },
      ],
    };
  });

  const Icon = style.Icon;

  return (
    <View pointerEvents="box-none" style={[styles.layer, { paddingTop: insets.top + 8 }]}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[
            styles.shadowWrap,
            { shadowColor: style.accent, maxWidth: Math.min(screenWidth - 32, 440) },
            animatedStyle,
          ]}
        >
          <LinearGradient
            colors={style.border}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.border}
          >
            <View style={styles.pill}>
              <View style={[styles.iconBubble, { backgroundColor: style.iconBg }]}>
                {item.emoji ? (
                  <Text style={styles.emoji}>{item.emoji}</Text>
                ) : (
                  <Icon size={17} color={style.accent} strokeWidth={2.4} />
                )}
              </View>
              <View style={styles.textCol}>
                {item.title ? (
                  <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                  </Text>
                ) : null}
                <Text style={styles.message} numberOfLines={3}>
                  {item.message}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  // Gölgeyi taşıyan katman: overflow verilmez (iOS'ta gölgeyi keserdi)
  shadowWrap: {
    minWidth: 180,
    borderRadius: 26,
    backgroundColor: "#15101C",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 16,
    elevation: 12,
  },
  border: {
    borderRadius: 26,
    padding: 1.3,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingLeft: 9,
    paddingRight: 18,
    borderRadius: 24.7,
    backgroundColor: "#15101C",
  },
  iconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: {
    fontSize: 16,
  },
  textCol: {
    flexShrink: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
    marginBottom: 1,
  },
  message: {
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
});
