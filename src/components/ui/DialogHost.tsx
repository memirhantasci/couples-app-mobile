import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleCheck, CircleX, HeartHandshake, Info, TriangleAlert, Trash2 } from "lucide-react-native";
import {
  allocateDialogHostId,
  finishDialog,
  getDialogState,
  registerDialogHost,
  subscribeDialogs,
  unregisterDialogHost,
  type DialogButton,
  type DialogItem,
  type DialogTone,
} from "@/lib/dialog";
import { useTheme } from "@/context/ThemeContext";
import type { AppTheme } from "@/lib/theme";
import { hapticError, hapticSuccess, hapticTap, hapticWarning } from "@/lib/soundEffects";

const EXIT_MS = 190;

interface ToneStyle {
  /** Vurgu rengi (açık / koyu zeminde) */
  color: [light: string, dark: string];
  Icon: typeof Info;
}

// Pastel tonlar: lavanta (bilgi), nane (başarı), şeftali (uyarı), gül (hata/silme), pembe (soru)
const TONES: Record<DialogTone, ToneStyle> = {
  info: { color: ["#7C5CD6", "#B8A2FF"], Icon: Info },
  success: { color: ["#15803D", "#6EE7B7"], Icon: CircleCheck },
  warning: { color: ["#B45309", "#FCD34D"], Icon: TriangleAlert },
  error: { color: ["#E11D48", "#FDA4AF"], Icon: CircleX },
  danger: { color: ["#E11D48", "#FDA4AF"], Icon: Trash2 },
  question: { color: ["#DB2777", "#F9A8D4"], Icon: HeartHandshake },
};

function fireHaptic(tone: DialogTone) {
  switch (tone) {
    case "success":
      hapticSuccess();
      break;
    case "warning":
    case "danger":
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
 * `appAlert` çağrılarını cam efektli, pastel tonlu bir kart olarak gösterir.
 *
 *  • Kökte (ToastHost'un yanında) bir kez bağlanır.
 *  • Bir `<Modal>` açıkken kök host modalın ARKASINDA kalır; bu yüzden modalın içine
 *    `<DialogHost embedded />` koyun: modal açıkken diyaloglar onun içinde çizilir.
 */
export function DialogHost({
  embedded = false,
  visible = true,
}: {
  embedded?: boolean;
  visible?: boolean;
}) {
  const state = useSyncExternalStore(subscribeDialogs, getDialogState, getDialogState);
  // Kimlik lazy başlatılır: modal-içi host yalnızca açık ve görünürken kaydedilir
  const [hostId] = useState<number | null>(() => (embedded ? allocateDialogHostId() : null));

  useEffect(() => {
    if (hostId === null || !visible) return;
    registerDialogHost(hostId);
    return () => unregisterDialogHost(hostId);
  }, [hostId, visible]);

  const item = state.current;
  // Açık ve görünür bir modal-içi host varsa kök host susar; yoksa kök host çizer
  const active = embedded ? state.topHost === hostId && visible : state.topHost === null;
  if (!item || !active) return null;

  // key: her diyalog kendi animasyon durumuyla sıfırdan başlar
  return <DialogCard key={item.id} item={item} />;
}

function DialogCard({ item }: { item: DialogItem }) {
  const { theme, isLight } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const tone = TONES[item.tone];
  const accent = isLight ? tone.color[0] : tone.color[1];
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Giriş (appear) ve çıkış (leave) AYRI değerlerdir; aynı değere ikinci bir set çalışan animasyonu iptal eder
  const appear = useSharedValue(0);
  const leave = useSharedValue(0);

  const buttons = item.buttons;

  // Seçilen düğme worklet kapanışına (UI iş parçacığı) taşınmaz: içindeki onPress bir JS fonksiyonudur.
  // Ref'te tutulur; animasyon bitince JS tarafında okunur.
  const chosenButtonRef = useRef<DialogButton | null>(null);

  const finish = useCallback(() => {
    finishDialog(item.id, chosenButtonRef.current);
  }, [item.id]);

  const close = useCallback(
    (button: DialogButton | null) => {
      chosenButtonRef.current = button;
      leave.set(
        withTiming(
          1,
          { duration: reduceMotion ? 100 : EXIT_MS, easing: Easing.in(Easing.cubic) },
          (done) => {
            "worklet";
            if (done) scheduleOnRN(finish);
          }
        )
      );
    },
    [leave, reduceMotion, finish]
  );

  useEffect(() => {
    appear.set(
      reduceMotion
        ? withTiming(1, { duration: 100 })
        : withSpring(1, { damping: 17, stiffness: 210, mass: 0.85 })
    );
    fireHaptic(item.tone);
    AccessibilityInfo.announceForAccessibility(item.message ? `${item.title}. ${item.message}` : item.title);
  }, [item, appear, reduceMotion]);

  // Android geri tuşu: iptal edilebilirse diyaloğu kapat, değilse yut
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (item.cancelable) close(null);
      return true;
    });
    return () => sub.remove();
  }, [item.cancelable, close]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, appear.get()) * (1 - leave.get()),
  }));

  const cardStyle = useAnimatedStyle(() => {
    const a = appear.get();
    const l = leave.get();
    const slide = reduceMotion ? 0 : 1;
    return {
      opacity: Math.min(1, a * 1.6) * (1 - l),
      transform: [
        { translateY: slide * ((1 - a) * 36 + l * 28) },
        { scale: reduceMotion ? 1 : 0.94 + 0.06 * Math.min(1, a) - 0.04 * l },
      ],
    };
  });

  // ─── Düğme düzeni ───
  const cancelButton = buttons.find((b) => b.style === "cancel") ?? null;
  const actionButtons = buttons.filter((b) => b !== cancelButton);
  const stacked = buttons.length >= 3;
  // Birincil: yıkıcı varsa o; yoksa yan yana düzende son eylem düğmesi (iOS/Android geleneği),
  // dikey düzende ilk eylem düğmesi (en önemli seçenek üstte durur)
  const primaryButton =
    actionButtons.find((b) => b.style === "destructive") ??
    (stacked ? actionButtons[0] : actionButtons[actionButtons.length - 1]) ??
    null;
  // Satır düzeninde iptal solda, eylem sağda; sütunda eylemler üstte, iptal altta
  const ordered = stacked
    ? [...actionButtons, ...(cancelButton ? [cancelButton] : [])]
    : [...(cancelButton ? [cancelButton] : []), ...actionButtons];

  const maxWidth = Math.min(screenWidth - 32, 420);

  return (
    <View style={styles.layer} pointerEvents="box-none">
      {/* Arka plan: hafif karartma + cam bulanıklığı; dokunulunca (iptal edilebilirse) kapanır */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => item.cancelable && close(null)}
          accessibilityLabel="Kapat"
        >
          <BlurView
            tint={isLight ? "light" : "dark"}
            intensity={isLight ? 28 : 42}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isLight ? "rgba(60, 20, 40, 0.28)" : "rgba(6, 3, 12, 0.58)" },
            ]}
          />
        </Pressable>
      </Animated.View>

      <View
        style={[styles.sheetArea, { paddingBottom: Math.max(insets.bottom, 12) + 14 }]}
        pointerEvents="box-none"
      >
        <Animated.View
          accessibilityRole="alert"
          accessibilityViewIsModal
          style={[styles.shadowWrap, { shadowColor: accent, maxWidth }, cardStyle]}
        >
          <View style={styles.card}>
            {/* Cam: bulanıklık + yarı saydam dolgu (Android'de bulanıklık olmasa da okunur kalır) */}
            <BlurView
              tint={isLight ? "light" : "dark"}
              intensity={isLight ? 70 : 60}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isLight ? "rgba(255, 255, 255, 0.86)" : "rgba(28, 19, 38, 0.84)" },
              ]}
            />
            {/* Pastel ışıltı: kartın üstünden süzülen ton rengi */}
            <LinearGradient
              colors={[`${accent}${isLight ? "2E" : "33"}`, `${accent}00`]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.7 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            <View style={styles.content}>
              <View style={[styles.iconRing, { borderColor: `${accent}55` }]}>
                <View style={[styles.iconBubble, { backgroundColor: `${accent}${isLight ? "1F" : "2A"}` }]}>
                  {item.emoji ? (
                    <Text style={styles.emoji}>{item.emoji}</Text>
                  ) : (
                    <tone.Icon size={26} color={accent} strokeWidth={2.2} />
                  )}
                </View>
              </View>

              <Text style={styles.title}>{item.title}</Text>
              {item.message ? <Text style={styles.message}>{item.message}</Text> : null}

              <View style={[styles.buttons, stacked ? styles.buttonsStacked : styles.buttonsRow]}>
                {ordered.map((button, index) => {
                  const isPrimary = button === primaryButton;
                  const isDestructive = button.style === "destructive";
                  const label = button.text ?? "Tamam";
                  return (
                    <Pressable
                      key={`${label}-${index}`}
                      onPress={() => close(button)}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      style={({ pressed }) => [
                        styles.button,
                        stacked ? styles.buttonStacked : styles.buttonRowItem,
                        !isPrimary && styles.buttonSecondary,
                        pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                      ]}
                    >
                      {isPrimary ? (
                        <LinearGradient
                          colors={
                            isDestructive
                              ? ["#F43F5E", "#E11D48"]
                              : [theme.accent, theme.accentLight]
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.buttonFill}
                        >
                          <Text style={styles.buttonPrimaryText} numberOfLines={1}>
                            {label}
                          </Text>
                        </LinearGradient>
                      ) : (
                        <View style={styles.buttonFill}>
                          <Text
                            style={[
                              styles.buttonSecondaryText,
                              isDestructive && { color: isLight ? "#BE123C" : "#FDA4AF" },
                            ]}
                            numberOfLines={1}
                          >
                            {label}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) => {
  const isLight = theme.isLight;
  return StyleSheet.create({
    layer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10000,
      elevation: 10000,
    },
    sheetArea: {
      flex: 1,
      justifyContent: "flex-end",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    // Gölgeyi taşıyan katman: overflow verilmez (iOS'ta gölgeyi keserdi)
    shadowWrap: {
      width: "100%",
      borderRadius: 30,
      backgroundColor: isLight ? "#FFFFFF" : "#1C1326",
      shadowOffset: { width: 0, height: 14 },
      shadowOpacity: isLight ? 0.22 : 0.38,
      shadowRadius: 26,
      elevation: 18,
    },
    card: {
      borderRadius: 30,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: isLight ? "rgba(190, 24, 93, 0.16)" : "rgba(255, 255, 255, 0.14)",
    },
    content: {
      alignItems: "center",
      paddingHorizontal: 22,
      paddingTop: 24,
      paddingBottom: 20,
    },
    iconRing: {
      width: 68,
      height: 68,
      borderRadius: 34,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    iconBubble: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    emoji: {
      fontSize: 27,
    },
    title: {
      color: theme.text,
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      textAlign: "center",
      letterSpacing: -0.3,
      marginBottom: 6,
    },
    message: {
      color: theme.textSecondary,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      lineHeight: 21,
      marginBottom: 6,
    },
    buttons: {
      alignSelf: "stretch",
      marginTop: 16,
      gap: 10,
    },
    buttonsRow: {
      flexDirection: "row",
    },
    buttonsStacked: {
      flexDirection: "column",
    },
    button: {
      height: 48,
      borderRadius: 16,
      overflow: "hidden",
    },
    buttonRowItem: {
      flex: 1,
    },
    buttonStacked: {
      alignSelf: "stretch",
    },
    buttonSecondary: {
      backgroundColor: isLight ? "rgba(30, 27, 36, 0.06)" : "rgba(255, 255, 255, 0.09)",
      borderWidth: 1,
      borderColor: isLight ? "rgba(190, 24, 93, 0.14)" : "rgba(255, 255, 255, 0.12)",
    },
    buttonFill: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    buttonPrimaryText: {
      color: "#FFFFFF",
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      letterSpacing: -0.2,
    },
    buttonSecondaryText: {
      color: theme.textSecondary,
      fontSize: 14.5,
      fontFamily: "Inter_600SemiBold",
    },
  });
};
