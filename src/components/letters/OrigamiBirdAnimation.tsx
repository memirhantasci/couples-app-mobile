import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  TouchableOpacity,
  Platform,
} from "react-native";
import Svg, { Path, Polygon, Defs, LinearGradient, Stop } from "react-native-svg";
import { Sparkles, Heart } from "lucide-react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface OrigamiBirdAnimationProps {
  visible: boolean;
  onComplete: () => void;
  accentColor?: string;
}

export function OrigamiBirdAnimation({
  visible,
  onComplete,
  accentColor = "#FF4D6D",
}: OrigamiBirdAnimationProps) {
  // Main timeline driver
  const animProgress = useRef(new Animated.Value(0)).current;

  // Paper fold animations
  const paperScale = useRef(new Animated.Value(0)).current;
  const paperOpacity = useRef(new Animated.Value(1)).current;
  const paperFoldX = useRef(new Animated.Value(1)).current;
  const paperRotate = useRef(new Animated.Value(0)).current;

  // Bird appearance & flight
  const birdOpacity = useRef(new Animated.Value(0)).current;
  const birdScale = useRef(new Animated.Value(0.2)).current;
  const birdFlightX = useRef(new Animated.Value(0)).current;
  const birdFlightY = useRef(new Animated.Value(0)).current;
  const birdFlightRotate = useRef(new Animated.Value(0)).current;

  // Wing flapping (oscillates continuously during flight)
  const wingFlap = useRef(new Animated.Value(0)).current;

  // Sparkles & Success card
  const sparklesOpacity = useRef(new Animated.Value(0)).current;
  const successCardOpacity = useRef(new Animated.Value(0)).current;
  const successCardScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!visible) {
      // Reset all values
      animProgress.setValue(0);
      paperScale.setValue(0);
      paperOpacity.setValue(1);
      paperFoldX.setValue(1);
      paperRotate.setValue(0);
      birdOpacity.setValue(0);
      birdScale.setValue(0.2);
      birdFlightX.setValue(0);
      birdFlightY.setValue(0);
      birdFlightRotate.setValue(0);
      wingFlap.setValue(0);
      sparklesOpacity.setValue(0);
      successCardOpacity.setValue(0);
      successCardScale.setValue(0.85);
      return;
    }

    // Start wing flap loop
    const wingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wingFlap, {
          toValue: 1,
          duration: 160,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(wingFlap, {
          toValue: 0,
          duration: 160,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    wingLoop.start();

    // Sequence of the entire origami transformation & flight:
    Animated.sequence([
      // 1. Paper emerges and pops to center
      Animated.spring(paperScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),

      // Small pause to see the sealed letter
      Animated.delay(350),

      // 2. Paper folds inward into an origami fold
      Animated.parallel([
        Animated.timing(paperFoldX, {
          toValue: 0.15,
          duration: 500,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(paperRotate, {
          toValue: 1,
          duration: 500,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(paperOpacity, {
          toValue: 0,
          duration: 450,
          delay: 100,
          useNativeDriver: true,
        }),

        // 3. Simultaneously, Origami Crane morphs in!
        Animated.sequence([
          Animated.delay(200),
          Animated.parallel([
            Animated.timing(birdOpacity, {
              toValue: 1,
              duration: 350,
              useNativeDriver: true,
            }),
            Animated.spring(birdScale, {
              toValue: 1,
              friction: 5,
              tension: 60,
              useNativeDriver: true,
            }),
            Animated.timing(sparklesOpacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),

      // 4. Crane anticipates & swoops into the sky!
      Animated.delay(250),
      Animated.parallel([
        // Dip slightly down first (anticipation), then shoot up-right
        Animated.sequence([
          Animated.timing(birdFlightY, {
            toValue: 20,
            duration: 180,
            easing: Easing.quad,
            useNativeDriver: true,
          }),
          Animated.timing(birdFlightY, {
            toValue: -SCREEN_HEIGHT * 0.65,
            duration: 1200,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(birdFlightX, {
            toValue: -15,
            duration: 180,
            easing: Easing.quad,
            useNativeDriver: true,
          }),
          Animated.timing(birdFlightX, {
            toValue: SCREEN_WIDTH * 0.85,
            duration: 1200,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(birdFlightRotate, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(birdScale, {
          toValue: 0.45,
          duration: 1200,
          delay: 200,
          useNativeDriver: true,
        }),
        Animated.timing(birdOpacity, {
          toValue: 0,
          duration: 350,
          delay: 1050,
          useNativeDriver: true,
        }),
      ]),

      // 5. Success Message Card Blooms!
      Animated.parallel([
        Animated.timing(successCardOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(successCardScale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
      ]),

      // Hold on success message for reading
      Animated.delay(1400),
    ]).start(() => {
      wingLoop.stop();
      onComplete();
    });

    return () => {
      wingLoop.stop();
    };
  }, [visible]);

  if (!visible) return null;

  // Interpolations
  const paperRotateInterpolate = paperRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const birdFlightRotateInterpolate = birdFlightRotate.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: ["0deg", "-15deg", "-38deg"],
  });

  const leftWingFlapInterpolate = wingFlap.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "32deg"],
  });

  const rightWingFlapInterpolate = wingFlap.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "-32deg"],
  });

  const wingScaleInterpolate = wingFlap.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.7],
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        {/* Ambient Darkened Backdrop with soft glowing center */}
        <View style={styles.ambientBackdrop} />

        {/* ─── PHASE 1: FOLDING PAPER LETTER ─── */}
        <Animated.View
          style={[
            styles.paperContainer,
            {
              opacity: paperOpacity,
              transform: [
                { scale: paperScale },
                { scaleX: paperFoldX },
                { rotate: paperRotateInterpolate },
              ],
            },
          ]}
        >
          <View style={styles.parchmentSheet}>
            {/* Wax Seal */}
            <View style={styles.waxSeal}>
              <Text style={{ fontSize: 24 }}>💌</Text>
            </View>
            <View style={styles.letterLineShort} />
            <View style={styles.letterLineLong} />
            <View style={styles.letterLineMedium} />
            <Text style={styles.sealingStatusText}>Mektup Katlanıyor...</Text>
          </View>
        </Animated.View>

        {/* ─── PHASE 2: ORIGAMI CRANE / BIRD IN FLIGHT ─── */}
        <Animated.View
          style={[
            styles.birdContainer,
            {
              opacity: birdOpacity,
              transform: [
                { translateX: birdFlightX },
                { translateY: birdFlightY },
                { rotate: birdFlightRotateInterpolate },
                { scale: birdScale },
              ],
            },
          ]}
        >
          {/* Origami Bird Rendered via SVG with 3D Folded Facets */}
          <View style={styles.origamiWrapper}>
            {/* Left Wing Animated */}
            <Animated.View
              style={[
                styles.wingLeftWrapper,
                {
                  transform: [
                    { rotate: leftWingFlapInterpolate },
                    { scaleY: wingScaleInterpolate },
                  ],
                },
              ]}
            >
              <Svg width={60} height={70} viewBox="0 0 60 70">
                <Defs>
                  <LinearGradient id="leftWingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#FFFFFF" />
                    <Stop offset="50%" stopColor="#FFE4EC" />
                    <Stop offset="100%" stopColor="#FFB3C6" />
                  </LinearGradient>
                </Defs>
                <Polygon
                  points="55,60 5,10 40,45"
                  fill="url(#leftWingGrad)"
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth="1.2"
                />
              </Svg>
            </Animated.View>

            {/* Main Body, Neck & Tail */}
            <Svg width={90} height={90} viewBox="0 0 90 90">
              <Defs>
                <LinearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FFFFFF" />
                  <Stop offset="70%" stopColor="#FFF0F5" />
                  <Stop offset="100%" stopColor="#FFC2D1" />
                </LinearGradient>
                <LinearGradient id="headGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FFF5F8" />
                  <Stop offset="100%" stopColor="#FF85A1" />
                </LinearGradient>
                <LinearGradient id="tailGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FFE0E9" />
                  <Stop offset="100%" stopColor="#FF6B8B" />
                </LinearGradient>
              </Defs>

              {/* Neck & Head fold */}
              <Polygon
                points="45,40 32,15 22,8 26,24"
                fill="url(#headGrad)"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="1"
              />

              {/* Tail fold */}
              <Polygon
                points="45,55 58,82 52,70"
                fill="url(#tailGrad)"
                stroke="rgba(255,255,255,0.6)"
                strokeWidth="1"
              />

              {/* Center Diamond Body Facets */}
              <Polygon
                points="45,35 55,50 45,65 35,50"
                fill="url(#bodyGrad)"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="1.5"
              />
              {/* Center Crease line */}
              <Path d="M45,35 L45,65" stroke="rgba(255,105,180,0.4)" strokeWidth="1" />
            </Svg>

            {/* Right Wing Animated */}
            <Animated.View
              style={[
                styles.wingRightWrapper,
                {
                  transform: [
                    { rotate: rightWingFlapInterpolate },
                    { scaleY: wingScaleInterpolate },
                  ],
                },
              ]}
            >
              <Svg width={60} height={70} viewBox="0 0 60 70">
                <Defs>
                  <LinearGradient id="rightWingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#FFFFFF" />
                    <Stop offset="50%" stopColor="#FFD1DC" />
                    <Stop offset="100%" stopColor="#FF85A1" />
                  </LinearGradient>
                </Defs>
                <Polygon
                  points="5,60 55,10 20,45"
                  fill="url(#rightWingGrad)"
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth="1.2"
                />
              </Svg>
            </Animated.View>
          </View>

          {/* Sparkle Aura around bird */}
          <View style={styles.sparkleCluster}>
            <Sparkles size={18} color="#FFD700" />
          </View>
        </Animated.View>

        {/* ─── SPARKLE TRAIL PARTICLES ─── */}
        <Animated.View
          style={[styles.trailContainer, { opacity: sparklesOpacity }]}
          pointerEvents="none"
        >
          <View style={[styles.particle, { top: "42%", left: "48%" }]}>
            <Sparkles size={16} color="#FFF" />
          </View>
          <View style={[styles.particle, { top: "35%", left: "58%" }]}>
            <Heart size={14} color="#FF4D6D" fill="#FF4D6D" />
          </View>
          <View style={[styles.particle, { top: "28%", left: "68%" }]}>
            <Sparkles size={14} color="#FFD700" />
          </View>
          <View style={[styles.particle, { top: "20%", left: "78%" }]}>
            <Heart size={12} color="#FF85A1" fill="#FF85A1" />
          </View>
        </Animated.View>

        {/* ─── PHASE 3: SUCCESS CELEBRATION CARD ─── */}
        <Animated.View
          style={[
            styles.successCard,
            {
              opacity: successCardOpacity,
              transform: [{ scale: successCardScale }],
            },
          ]}
        >
          <View style={styles.successIconCircle}>
            <Text style={{ fontSize: 36 }}>🕊️</Text>
          </View>

          <Text style={styles.successTitle}>Mektubunuz Zamanda Yolculuğa Çıktı!</Text>
          <Text style={styles.successSubtitle}>
            Sevdiğin için mühürlendi ve geleceğe doğru kanatlandı ✨
          </Text>

          <View style={styles.successBadge}>
            <Sparkles size={14} color="#FFD700" />
            <Text style={styles.successBadgeText}>Açılış gününe kadar güvenle kilitli</Text>
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onComplete}
            activeOpacity={0.85}
          >
            <Text style={styles.closeBtnText}>Harika ✨</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(5, 5, 12, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  ambientBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 77, 109, 0.05)",
  },

  /* PAPER LETTER STYLES */
  paperContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  parchmentSheet: {
    width: 220,
    height: 160,
    backgroundColor: "#FFFDF9",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 215, 0, 0.4)",
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  waxSeal: {
    marginBottom: 8,
  },
  letterLineLong: {
    width: "70%",
    height: 3,
    backgroundColor: "rgba(200, 160, 120, 0.35)",
    borderRadius: 2,
    marginVertical: 4,
  },
  letterLineMedium: {
    width: "50%",
    height: 3,
    backgroundColor: "rgba(200, 160, 120, 0.25)",
    borderRadius: 2,
    marginVertical: 4,
  },
  letterLineShort: {
    width: "35%",
    height: 3,
    backgroundColor: "rgba(200, 160, 120, 0.2)",
    borderRadius: 2,
    marginVertical: 4,
  },
  sealingStatusText: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#8B4513",
    letterSpacing: 0.5,
  },

  /* ORIGAMI BIRD STYLES */
  birdContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  origamiWrapper: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  wingLeftWrapper: {
    position: "absolute",
    left: 0,
    top: 15,
  },
  wingRightWrapper: {
    position: "absolute",
    right: 0,
    top: 15,
  },
  sparkleCluster: {
    position: "absolute",
    top: -8,
    right: -8,
  },

  /* PARTICLES */
  trailContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  particle: {
    position: "absolute",
  },

  /* SUCCESS CELEBRATION CARD */
  successCard: {
    width: SCREEN_WIDTH * 0.86,
    maxWidth: 340,
    backgroundColor: "rgba(22, 22, 35, 0.95)",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 77, 109, 0.35)",
    shadowColor: "#FF4D6D",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255, 77, 109, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 77, 109, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    color: "#FFFFFF",
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  successSubtitle: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 18,
  },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 215, 0, 0.12)",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.25)",
    marginBottom: 20,
  },
  successBadgeText: {
    color: "#FFD700",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  closeBtn: {
    backgroundColor: "#FF4D6D",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 22,
    shadowColor: "#FF4D6D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  closeBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
