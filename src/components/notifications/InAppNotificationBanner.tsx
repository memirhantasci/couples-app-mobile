import React, { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Platform,
  Vibration,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Mail,
  Pill,
  Clock,
  Camera,
  MapPin,
  Flower,
  Smile,
  Calendar,
  Heart,
  X,
  ChevronRight,
  Sparkles,
  Droplet,
  CheckCircle2,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import {
  InAppNotificationData,
  NotificationType,
  NOTIFICATION_THEMES,
} from "@/types/notification";

interface InAppNotificationBannerProps {
  notification: InAppNotificationData | null;
  onDismiss: () => void;
  onAction?: (notification: InAppNotificationData) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const AUTO_DISMISS_DURATION = 6500;

export const InAppNotificationBanner: React.FC<InAppNotificationBannerProps> = ({
  notification,
  onDismiss,
  onAction,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Animation values (bileşen ömrü boyunca sabit nesneler)
  const [translateY] = useState(() => new Animated.Value(-160));
  const [opacity] = useState(() => new Animated.Value(0));
  const [progressAnim] = useState(() => new Animated.Value(1));
  const [scaleAnim] = useState(() => new Animated.Value(0.92));
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -170,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  // Kaydırma hareketi bir kez kurulur ve yalnızca kapatma isteğini sayar; kapatmayı aşağıdaki
  // effect güncel handleDismiss ile yapar (hareket nesnesi eski bir closure'a takılmaz)
  const [swipeDismissCount, setSwipeDismissCount] = useState(0);
  const dismissFromSwipe = useEffectEvent(() => handleDismiss());
  useEffect(() => {
    if (swipeDismissCount > 0) dismissFromSwipe();
  }, [swipeDismissCount]);

  useEffect(() => {
    if (notification) {

      // Light tactile vibration
      try {
        if (Platform.OS === "android") {
          Vibration.vibrate([0, 50, 40, 60]);
        } else {
          Vibration.vibrate();
        }
      } catch {
        // Fallback silently if vibration not allowed
      }

      // Spring in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 9,
          speed: 12,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();

      // Progress bar auto-dismiss
      progressAnim.setValue(1);
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: AUTO_DISMISS_DURATION,
        useNativeDriver: false,
      }).start();

      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        handleDismiss();
      }, AUTO_DISMISS_DURATION);
    } else {
      translateY.setValue(-160);
      opacity.setValue(0);
      scaleAnim.setValue(0.92);
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [notification]);

  // Pan responder for swipe up to dismiss
  const [panResponder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -30 || gestureState.vy < -0.5) {
          setSwipeDismissCount((count) => count + 1);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 6,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  );

  if (!notification) return null;

  const themeConfig = NOTIFICATION_THEMES[notification.type] || NOTIFICATION_THEMES.general;

  const handlePressCard = () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    handleDismiss();
    if (onAction) {
      onAction(notification);
    } else if (notification.route) {
      router.push(notification.route as any);
    }
  };


  // Renders type-specific icon and custom graphics
  const renderVisualBadge = (type: NotificationType) => {
    switch (type) {
      case "letter":
        return (
          <View style={[styles.waxSealBadge, { borderColor: "#F5C563" }]}>
            <View style={styles.waxSealInner}>
              <Mail size={16} color="#FFEBB8" strokeWidth={2.5} />
            </View>
            <View style={styles.sealHeartDot}>
              <Heart size={8} color="#FF5C77" fill="#FF5C77" />
            </View>
          </View>
        );

      case "medicine":
        return (
          <View style={[styles.medicineCapsuleBadge, { borderColor: "#34D399" }]}>
            <View style={styles.medicineCapsuleTop}>
              <Pill size={16} color="#34D399" strokeWidth={2.4} />
            </View>
            <View style={styles.waterDropBadge}>
              <Droplet size={9} color="#6EE7B7" fill="#6EE7B7" />
            </View>
          </View>
        );

      case "medicine_reminder":
        return (
          <View style={[styles.medicineCapsuleBadge, { borderColor: "#38BDF8" }]}>
            <Clock size={18} color="#38BDF8" strokeWidth={2.4} />
          </View>
        );

      case "photo":
        return (
          <View style={[styles.polaroidBadge, { borderColor: "#F472B6" }]}>
            <Camera size={17} color="#F472B6" strokeWidth={2.4} />
          </View>
        );

      case "map":
        return (
          <View style={[styles.mapPinBadge, { borderColor: "#A78BFA" }]}>
            <MapPin size={17} color="#A78BFA" strokeWidth={2.4} />
          </View>
        );

      case "period":
        return (
          <View style={[styles.periodBadge, { borderColor: "#FB7185" }]}>
            <Flower size={17} color="#FB7185" strokeWidth={2.4} />
          </View>
        );

      case "mood":
        return (
          <View style={[styles.moodBadge, { borderColor: "#FBBF24" }]}>
            <Smile size={17} color="#FBBF24" strokeWidth={2.4} />
          </View>
        );

      case "meeting":
        return (
          <View style={[styles.meetingBadge, { borderColor: "#C084FC" }]}>
            <Calendar size={17} color="#C084FC" strokeWidth={2.4} />
          </View>
        );

      case "pairing":
        return (
          <View style={[styles.defaultBadge, { borderColor: "#FF8AA8" }]}>
            <Sparkles size={17} color="#FF8AA8" strokeWidth={2.4} />
          </View>
        );

      default:
        return (
          <View style={[styles.defaultBadge, { borderColor: "#FF5C77" }]}>
            <Heart size={17} color="#FF5C77" fill="#FF5C77" />
          </View>
        );
    }
  };

  const topOffset = Math.max(insets.top, Platform.OS === "android" ? 14 : 10) + 4;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: topOffset,
          transform: [{ translateY }, { scale: scaleAnim }],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handlePressCard}
        style={[
          styles.cardOuter,
          {
            borderColor: themeConfig.borderGlow,
            shadowColor: themeConfig.accentColor,
          },
        ]}
      >
        <LinearGradient
          colors={themeConfig.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardGradient}
        >
          {/* Top category row */}
          <View style={styles.topRow}>
            <View style={styles.badgeRow}>
              {renderVisualBadge(notification.type)}
              <View style={styles.badgeTextWrapper}>
                <View style={styles.badgeHeaderRow}>
                  <Text style={[styles.badgeTag, { color: themeConfig.accentColor }]}>
                    {themeConfig.badgeLabel.toUpperCase()}
                  </Text>
                  <Sparkles size={11} color={themeConfig.accentColor} style={{ marginLeft: 4 }} />
                </View>
                {notification.senderName ? (
                  <Text style={styles.senderLabel} numberOfLines={1}>
                    {notification.senderName}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Close button */}
            <TouchableOpacity
              onPress={handleDismiss}
              style={styles.closeButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={15} color="rgba(255, 255, 255, 0.6)" />
            </TouchableOpacity>
          </View>

          {/* Main Content */}
          <View style={styles.contentBody}>
            <Text style={styles.titleText} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={styles.bodyText} numberOfLines={2}>
              {notification.body}
            </Text>

            {/* Custom snippet for specific types */}
            {notification.type === "letter" && notification.metadata?.letterTitle ? (
              <View style={styles.vintageSnippet}>
                <Text style={styles.vintageSnippetQuote}>“</Text>
                <Text style={styles.vintageSnippetText} numberOfLines={1}>
                  {notification.metadata.letterTitle}
                </Text>
              </View>
            ) : null}

            {notification.type === "medicine" && notification.metadata?.medicineName ? (
              <View style={styles.medicineSnippet}>
                <CheckCircle2 size={13} color="#34D399" />
                <Text style={styles.medicineSnippetText} numberOfLines={1}>
                  {notification.metadata.medicineName} dozu içildi
                </Text>
              </View>
            ) : null}
          </View>

          {/* Action Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handlePressCard}
              style={[
                styles.primaryActionButton,
                {
                  backgroundColor: themeConfig.iconBg,
                  borderColor: themeConfig.accentColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.primaryActionText,
                  { color: themeConfig.accentColor },
                ]}
              >
                {notification.actionLabel || themeConfig.defaultActionLabel}
              </Text>
              <ChevronRight size={14} color={themeConfig.accentColor} />
            </TouchableOpacity>
          </View>

          {/* Auto-dismiss progress bar */}
          <View style={styles.progressBarBackground}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: themeConfig.accentColor,
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 999999,
    elevation: 999999,
  },
  cardOuter: {
    borderRadius: 22,
    borderWidth: 1.2,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    backgroundColor: "#18060C",
  },
  cardGradient: {
    paddingTop: 12,
    paddingBottom: 11,
    paddingHorizontal: 15,
    borderRadius: 22,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  badgeTextWrapper: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
    justifyContent: "center",
    gap: 2,
  },
  badgeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  badgeTag: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.9,
  },
  senderLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.72)",
    marginTop: 1,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  contentBody: {
    marginBottom: 10,
  },
  titleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  bodyText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.84)",
    lineHeight: 18,
  },
  vintageSnippet: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 197, 99, 0.09)",
    borderLeftWidth: 2.5,
    borderLeftColor: "#F5C563",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  vintageSnippetQuote: {
    fontSize: 14,
    color: "#F5C563",
    fontWeight: "800",
    marginRight: 4,
  },
  vintageSnippetText: {
    fontSize: 11.5,
    fontStyle: "italic",
    color: "#FFEBB8",
    flex: 1,
  },
  medicineSnippet: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(52, 211, 153, 0.1)",
    borderLeftWidth: 2.5,
    borderLeftColor: "#34D399",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
    gap: 6,
  },
  medicineSnippetText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#A7F3D0",
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    gap: 8,
  },
  primaryActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  primaryActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  progressBarBackground: {
    height: 2.5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 10,
    marginHorizontal: -4,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 2,
  },

  // ─── Custom Themed Badge Graphics ─────────────────────────────
  waxSealBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2B0B15",
    borderWidth: 1.6,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    shadowColor: "#F5C563",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  waxSealInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#781C37",
    alignItems: "center",
    justifyContent: "center",
  },
  sealHeartDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    backgroundColor: "#FFFFFF",
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },

  medicineCapsuleBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#08251C",
    borderWidth: 1.6,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    shadowColor: "#34D399",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  medicineCapsuleTop: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(52, 211, 153, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  waterDropBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    backgroundColor: "#064E3B",
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#34D399",
    alignItems: "center",
    justifyContent: "center",
  },

  polaroidBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#270F23",
    borderWidth: 1.6,
    alignItems: "center",
    justifyContent: "center",
  },
  mapPinBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1D0E2F",
    borderWidth: 1.6,
    alignItems: "center",
    justifyContent: "center",
  },
  periodBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#240A16",
    borderWidth: 1.6,
    alignItems: "center",
    justifyContent: "center",
  },
  moodBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#24150A",
    borderWidth: 1.6,
    alignItems: "center",
    justifyContent: "center",
  },
  meetingBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1A102E",
    borderWidth: 1.6,
    alignItems: "center",
    justifyContent: "center",
  },
  defaultBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#260610",
    borderWidth: 1.6,
    alignItems: "center",
    justifyContent: "center",
  },
});
