import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  TouchableOpacity,
} from "react-native";
import Svg, { Polygon, Defs, LinearGradient, Stop } from "react-native-svg";
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
  // Paper sheet animations
  const paperScale = useRef(new Animated.Value(0)).current;
  const paperOpacity = useRef(new Animated.Value(1)).current;
  const paperFoldX = useRef(new Animated.Value(1)).current;
  const paperFoldY = useRef(new Animated.Value(1)).current;
  const paperRotate = useRef(new Animated.Value(0)).current;

  // Origami Bird animations
  const birdOpacity = useRef(new Animated.Value(0)).current;
  const birdScale = useRef(new Animated.Value(0.3)).current;
  const birdFlightX = useRef(new Animated.Value(0)).current;
  const birdFlightY = useRef(new Animated.Value(0)).current;
  const birdFlightRotate = useRef(new Animated.Value(0)).current;

  // Wing flapping (continuous smooth oscillation during flight)
  const wingFlap = useRef(new Animated.Value(0)).current;

  // Trail sparkles & Success card
  const sparklesOpacity = useRef(new Animated.Value(0)).current;
  const successCardOpacity = useRef(new Animated.Value(0)).current;
  const successCardScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!visible) {
      paperScale.setValue(0);
      paperOpacity.setValue(1);
      paperFoldX.setValue(1);
      paperFoldY.setValue(1);
      paperRotate.setValue(0);
      birdOpacity.setValue(0);
      birdScale.setValue(0.3);
      birdFlightX.setValue(0);
      birdFlightY.setValue(0);
      birdFlightRotate.setValue(0);
      wingFlap.setValue(0);
      sparklesOpacity.setValue(0);
      successCardOpacity.setValue(0);
      successCardScale.setValue(0.85);
      return;
    }

    // Wing flapping loop
    const wingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wingFlap, {
          toValue: 1,
          duration: 150,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(wingFlap, {
          toValue: 0,
          duration: 150,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    wingLoop.start();

    // ─── MASTER ANIMATION TIMELINE ───
    Animated.sequence([
      // 1. Mektup Kağıdı Ortaya Çıkar
      Animated.spring(paperScale, {
        toValue: 1,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),

      // Kısa bir bekleme (Mektup okunur)
      Animated.delay(400),

      // 2. Mektup Sayfası Katlanmaya Başlar (Origami Külah / Üçgen & Elmas Katlaması)
      Animated.parallel([
        Animated.timing(paperFoldX, {
          toValue: 0.18,
          duration: 550,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(paperFoldY, {
          toValue: 0.65,
          duration: 550,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(paperRotate, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(paperOpacity, {
          toValue: 0,
          duration: 400,
          delay: 200,
          useNativeDriver: true,
        }),

        // 3. Katlanan Kağıttan Büyülü Origami Kuşu Doğar
        Animated.sequence([
          Animated.delay(220),
          Animated.parallel([
            Animated.timing(birdOpacity, {
              toValue: 1,
              duration: 350,
              useNativeDriver: true,
            }),
            Animated.spring(birdScale, {
              toValue: 1,
              friction: 5,
              tension: 65,
              useNativeDriver: true,
            }),
            Animated.timing(sparklesOpacity, {
              toValue: 1,
              duration: 350,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]),

      // Kuş kanatlarını açar ve uçuşa hazırlanır
      Animated.delay(250),

      // 4. Kuş Kanat Çırparak Gökyüzüne Doğru Süzülür ve Uçar
      Animated.parallel([
        // Y ekseninde önce hafif çöker (hazırlık), sonra yukarı fırlar
        Animated.sequence([
          Animated.timing(birdFlightY, {
            toValue: 15,
            duration: 160,
            easing: Easing.quad,
            useNativeDriver: true,
          }),
          Animated.timing(birdFlightY, {
            toValue: -SCREEN_HEIGHT * 0.75,
            duration: 1200,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
        ]),

        // X ekseninde sağa doğru uçar
        Animated.sequence([
          Animated.timing(birdFlightX, {
            toValue: -10,
            duration: 160,
            easing: Easing.quad,
            useNativeDriver: true,
          }),
          Animated.timing(birdFlightX, {
            toValue: SCREEN_WIDTH * 0.95,
            duration: 1200,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
        ]),

        // Uçuş açısına doğru döner (yaklaşık -35 derece)
        Animated.timing(birdFlightRotate, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),

        // Perspektif: Uzaklaştıkça küçülür
        Animated.timing(birdScale, {
          toValue: 0.4,
          duration: 1200,
          delay: 150,
          useNativeDriver: true,
        }),

        // Ekrandan çıkarken yavaşça kaybolur
        Animated.timing(birdOpacity, {
          toValue: 0,
          duration: 300,
          delay: 1050,
          useNativeDriver: true,
        }),
      ]),

      // 5. Başarı Kartı Ortaya Çıkar (Mektubun Kanatlandı!)
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

      // Kullanıcının okuması için ekranda kalma süresi
      Animated.delay(1300),
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

  // Smooth realistic origami wing flapping
  const leftWingFlapInterpolate = wingFlap.interpolate({
    inputRange: [0, 1],
    outputRange: ["-18deg", "28deg"],
  });

  const rightWingFlapInterpolate = wingFlap.interpolate({
    inputRange: [0, 1],
    outputRange: ["18deg", "-28deg"],
  });

  const wingScaleInterpolate = wingFlap.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.78],
  });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        {/* Karartılmış arka plan */}
        <View style={styles.ambientBackdrop} />

        {/* ─── 1. ADIM: GERÇEK MEKTUP KAĞIDI (KATLANAN SAYFA) ─── */}
        <Animated.View
          style={[
            styles.paperContainer,
            {
              opacity: paperOpacity,
              transform: [
                { scale: paperScale },
                { scaleX: paperFoldX },
                { scaleY: paperFoldY },
                { rotate: paperRotateInterpolate },
              ],
            },
          ]}
        >
          <View style={styles.letterSheet}>
            {/* Romantik Mektup Başlığı */}
            <View style={styles.letterHeader}>
              <View style={styles.stampCircle}>
                <Heart size={16} color="#FF4D6D" fill="#FF4D6D" />
              </View>
              <Text style={styles.letterTitle}>Sevgilime Özel...</Text>
            </View>

            {/* Yumuşak Mektup Satırları */}
            <View style={styles.letterLinesWrapper}>
              <View style={styles.letterLine} />
              <View style={styles.letterLine} />
              <View style={styles.letterLine} />
              <View style={[styles.letterLine, { width: "65%" }]} />
            </View>

            {/* Alt Mühür & İpucu */}
            <View style={styles.letterFooter}>
              <Text style={styles.letterFoldingHint}>Kuşa Katlanıyor... 🕊️</Text>
            </View>
          </View>
        </Animated.View>

        {/* ─── 2. ADIM: BEYAZ ZARİF ORIGAMI KUŞU (KANAT ÇIRPARAK UÇAN) ─── */}
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
          <View style={styles.origamiWrapper}>
            {/* Sol Kanat (Animated Flap) */}
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
              <Svg width={65} height={75} viewBox="0 0 65 75">
                <Defs>
                  <LinearGradient id="leftWingMain" x1="100%" y1="100%" x2="0%" y2="0%">
                    <Stop offset="0%" stopColor="#FFFFFF" />
                    <Stop offset="60%" stopColor="#FFF0F5" />
                    <Stop offset="100%" stopColor="#FFD1DC" />
                  </LinearGradient>
                  <LinearGradient id="leftWingFold" x1="100%" y1="100%" x2="0%" y2="0%">
                    <Stop offset="0%" stopColor="#FFF5F7" />
                    <Stop offset="100%" stopColor="#FFB8C6" />
                  </LinearGradient>
                </Defs>
                {/* Ana Origami Kanat Yüzeyi */}
                <Polygon points="60,65 5,12 38,30" fill="url(#leftWingMain)" />
                {/* Alt Origami Katlama Kıvrımı */}
                <Polygon points="60,65 38,30 46,55" fill="url(#leftWingFold)" />
              </Svg>
            </Animated.View>

            {/* Gövde, Baş ve Kuyruk (Origami Turna Kuşu Şekli) */}
            <Svg width={90} height={95} viewBox="0 0 90 95">
              <Defs>
                <LinearGradient id="bodyFaceLeft" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FFFFFF" />
                  <Stop offset="100%" stopColor="#FFF2F5" />
                </LinearGradient>
                <LinearGradient id="bodyFaceRight" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FFE8EE" />
                  <Stop offset="100%" stopColor="#FFCCD7" />
                </LinearGradient>
                <LinearGradient id="headBeak" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FFFFFF" />
                  <Stop offset="100%" stopColor="#FF9EB5" />
                </LinearGradient>
                <LinearGradient id="tailGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FFF5F8" />
                  <Stop offset="100%" stopColor="#FFA6BC" />
                </LinearGradient>
              </Defs>

              {/* Origami Kuyruk */}
              <Polygon points="45,65 58,92 50,75" fill="url(#tailGradient)" />

              {/* Origami Boyun & Zarif Baş */}
              <Polygon points="45,45 32,18 22,12 26,24" fill="url(#headBeak)" />

              {/* Gövde Sol Elmas Yüzey */}
              <Polygon points="45,35 34,55 45,72 45,35" fill="url(#bodyFaceLeft)" />

              {/* Gövde Sağ Elmas Yüzey (Gölgeli origami katı) */}
              <Polygon points="45,35 56,55 45,72 45,35" fill="url(#bodyFaceRight)" />
            </Svg>

            {/* Sağ Kanat (Animated Flap) */}
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
              <Svg width={65} height={75} viewBox="0 0 65 75">
                <Defs>
                  <LinearGradient id="rightWingMain" x1="0%" y1="100%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#FFFFFF" />
                    <Stop offset="60%" stopColor="#FFF0F5" />
                    <Stop offset="100%" stopColor="#FFCCD7" />
                  </LinearGradient>
                  <LinearGradient id="rightWingFold" x1="0%" y1="100%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#FFE4EC" />
                    <Stop offset="100%" stopColor="#FFA6BC" />
                  </LinearGradient>
                </Defs>
                {/* Ana Origami Kanat Yüzeyi */}
                <Polygon points="5,65 60,12 27,30" fill="url(#rightWingMain)" />
                {/* Alt Origami Katlama Kıvrımı */}
                <Polygon points="5,65 27,30 19,55" fill="url(#rightWingFold)" />
              </Svg>
            </Animated.View>
          </View>

          {/* Kuşun Etrafındaki Büyülü Parıltı */}
          <View style={styles.sparkleCluster}>
            <Sparkles size={16} color="#FFD700" />
          </View>
        </Animated.View>

        {/* ─── UÇUŞ İZİ PARÇACIKLARI (KALPLER VE YILDIZLAR) ─── */}
        <Animated.View
          style={[styles.trailContainer, { opacity: sparklesOpacity }]}
          pointerEvents="none"
        >
          <View style={[styles.particle, { top: "42%", left: "46%" }]}>
            <Sparkles size={15} color="#FFF" />
          </View>
          <View style={[styles.particle, { top: "34%", left: "56%" }]}>
            <Heart size={14} color="#FF4D6D" fill="#FF4D6D" />
          </View>
          <View style={[styles.particle, { top: "26%", left: "67%" }]}>
            <Sparkles size={14} color="#FFD700" />
          </View>
          <View style={[styles.particle, { top: "18%", left: "78%" }]}>
            <Heart size={12} color="#FF85A1" fill="#FF85A1" />
          </View>
        </Animated.View>

        {/* ─── 3. ADIM: TAMAMLANMA & KUTLAMA KARTI ─── */}
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
            <Text style={{ fontSize: 34 }}>🕊️</Text>
          </View>

          <Text style={styles.successTitle}>Mektubun Kanatlandı!</Text>
          <Text style={styles.successSubtitle}>
            Mektup sayfası kuşa dönüştü ve sevgiline doğru gökyüzünde süzülüyor ✨
          </Text>

          <View style={styles.successBadge}>
            <Sparkles size={13} color="#FFD700" />
            <Text style={styles.successBadgeText}>Açılış gününe kadar güvenle mühürlendi</Text>
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
    backgroundColor: "rgba(6, 5, 14, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  ambientBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 77, 109, 0.06)",
  },

  /* MEKTUP KAĞIDI STİLLERİ */
  paperContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  letterSheet: {
    width: 210,
    height: 250,
    backgroundColor: "#FFFDF9",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255, 77, 109, 0.25)",
    shadowColor: "#FF4D6D",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 12,
    justifyContent: "space-between",
  },
  letterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 77, 109, 0.15)",
    paddingBottom: 10,
  },
  stampCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 77, 109, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  letterTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#2D1B2D",
    letterSpacing: -0.2,
  },
  letterLinesWrapper: {
    gap: 12,
    paddingVertical: 14,
  },
  letterLine: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(230, 200, 210, 0.45)",
    borderRadius: 2,
  },
  letterFooter: {
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 77, 109, 0.12)",
    paddingTop: 8,
  },
  letterFoldingHint: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: "#FF4D6D",
  },

  /* BEYAZ ORIGAMI KUŞU STİLLERİ */
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
    left: 4,
    top: 18,
  },
  wingRightWrapper: {
    position: "absolute",
    right: 4,
    top: 18,
  },
  sparkleCluster: {
    position: "absolute",
    top: -6,
    right: -6,
  },

  /* PARÇACIKLAR */
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

  /* KUTLAMA KARTI */
  successCard: {
    width: SCREEN_WIDTH * 0.86,
    maxWidth: 340,
    backgroundColor: "rgba(20, 18, 30, 0.96)",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255, 77, 109, 0.35)",
    shadowColor: "#FF4D6D",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 14,
  },
  successIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(255, 77, 109, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 77, 109, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: {
    color: "#FFFFFF",
    fontSize: 18.5,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  successSubtitle: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 16,
  },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 20,
  },
  successBadgeText: {
    color: "#FFD700",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  closeBtn: {
    backgroundColor: "#FF4D6D",
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 22,
    shadowColor: "#FF4D6D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  closeBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
