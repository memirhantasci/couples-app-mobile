import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Share,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import {
  X,
  Share2,
  Heart,
  Calendar,
  Sparkles,
  MapPin,
  Mail,
  BookOpen,
  ChevronRight,
  ChevronLeft,
} from "lucide-react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { CoupleWrappedData } from "@/utils/wrappedCalculator";
import { AppTheme } from "@/lib/theme";
import { appAlert } from "@/lib/dialog";
import { useTranslation } from "react-i18next";

const { width: SW, height: SH } = Dimensions.get("window");

interface CoupleWrappedModalProps {
  visible: boolean;
  onClose: () => void;
  data: CoupleWrappedData | null;
  partnerName?: string;
  theme: AppTheme;
}

const TOTAL_SLIDES = 4;
const SLIDE_DURATION = 5500; // ms

function ProgressFill({ state, progress }: { state: "done" | "active" | "idle"; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({
    width: state === "done" ? "100%" : state === "active" ? `${progress.value}%` : "0%",
  }));
  return <Animated.View style={[styles.progressBarFill, style]} />;
}

export function CoupleWrappedModal({
  visible,
  onClose,
  data,
  partnerName,
  theme,
}: CoupleWrappedModalProps) {
  const { t } = useTranslation();
  const isMale = theme?.gender === "male";
  const modalGradientColors = isMale
    ? (["#0A0E17", "#0D182A", "#13233D", "#0A0E17"] as const)
    : (["#0A0A0C", "#1F0C18", "#2E0A1F", "#0A0A0C"] as const);
  const cardGradientColors = isMale
    ? (["#0D1726", "#142238", "#0B111A"] as const)
    : (["#1C1622", "#2B1425", "#160D1A"] as const);
  const shareBtnColors = isMale
    ? ([theme.accent, "#1D4ED8"] as const)
    : (["#FF4D6D", "#E8002D"] as const);
  const [currentSlide, setCurrentSlide] = useState(0);
  // Aktif slaytın ilerleme çubuğu (0-100): UI thread'inde animasyonla ilerler. Eskiden 50 ms'de bir React state
  // güncelleniyor, tüm modal (4 slayt, görseller) saniyede 20 kez yeniden çiziliyordu.
  const progress = useSharedValue(0);
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<View>(null);

  // Her slayt (ve her açılış) ilerleme çubuğu sıfırdan başlar
  const [progressFor, setProgressFor] = useState({ visible, currentSlide, data });
  if (progressFor.visible !== visible || progressFor.currentSlide !== currentSlide || progressFor.data !== data) {
    // Her açılış ilk slayttan başlar (modal kapanınca bileşen bellekte kalır)
    if (visible && !progressFor.visible) setCurrentSlide(0);
    setProgressFor({ visible, currentSlide, data });
  }

  const advanceSlide = useCallback(() => {
    setCurrentSlide((s) => Math.min(s + 1, TOTAL_SLIDES - 1));
  }, []);

  // Otomatik slayt ilerleme: her slayt (ve her açılış) çubuğu sıfırdan doldurur; dolunca sonraki slayta geçilir
  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;
    if (!visible || !data) return;
    progress.value = withTiming(100, { duration: SLIDE_DURATION, easing: Easing.linear }, (finished) => {
      'worklet';
      if (finished && currentSlide < TOTAL_SLIDES - 1) scheduleOnRN(advanceSlide);
    });
    return () => cancelAnimation(progress);
  }, [visible, currentSlide, data, progress, advanceSlide]);

  const handleNext = () => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      setCurrentSlide((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide((s) => s - 1);
    }
  };

  // Hikaye Paylaşım Fonksiyonu
  const handleShareStory = async () => {
    if (!shareCardRef.current) return;
    try {
      setIsSharing(true);
      const uri = await captureRef(shareCardRef, {
        format: "png",
        quality: 1.0,
        result: "tmpfile",
      });

      if (!uri) throw new Error("Görüntü oluşturulamadı");
      const fileUri = uri.startsWith("file://") ? uri : `file://${uri}`;

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "image/png",
          dialogTitle: t("wrapped.shareTitle"),
          UTI: "public.png",
          anchor: {
            x: SW / 2,
            y: SH / 2,
            width: 1,
            height: 1,
          },
        });
      } else {
        await Share.share({
          url: fileUri,
          message: `${data?.romanticStatement} · Made with Couples App`,
        });
      }
    } catch (error) {
      console.warn("Share error:", error);
      appAlert(t("common.error"), t("wrapped.shareError"));
    } finally {
      setIsSharing(false);
    }
  };

  if (!visible || !data) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Arka Plan Gradient */}
        <LinearGradient
          colors={modalGradientColors}
          style={StyleSheet.absoluteFill}
        />

        <SafeAreaView style={styles.safeArea}>
          {/* Üst Bar: İlerleme Çubukları & Kapat Butonu */}
          <View style={styles.header}>
            <View style={styles.progressContainer}>
              {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => (
                <View key={idx} style={styles.progressBarTrack}>
                  <ProgressFill state={idx < currentSlide ? "done" : idx === currentSlide ? "active" : "idle"} progress={progress} />
                </View>
              ))}
            </View>

            <View style={styles.headerRow}>
              <View style={styles.periodBadge}>
                <Sparkles size={13} color={theme.accent} />
                <Text style={styles.periodText}>{data.periodTitle}</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.closeBtn}>
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Dokunmatik Sol/Sağ Alanları */}
          <View style={styles.touchAreaContainer}>
            <TouchableOpacity activeOpacity={1} onPress={handlePrev} style={styles.leftTouch} />
            <TouchableOpacity activeOpacity={1} onPress={handleNext} style={styles.rightTouch} />
          </View>

          {/* Slayt İçerikleri */}
          <View style={styles.slideContainer}>
            {/* SLIDE 0: Birlikte Geçen Günler */}
            {currentSlide === 0 && (
              <View style={styles.slideContent}>
                <View style={styles.iconCircle}>
                  <Heart size={38} color={theme.accent} fill={theme.accent} />
                </View>
                <Text style={styles.subHeading}>{t("wrapped.slides.storyTitle")}</Text>
                <Text style={styles.bigStatNumber}>{data.daysTogether}</Text>
                <Text style={styles.statLabel}>{t("wrapped.slides.daysTogether")}</Text>

                <View style={styles.quoteBox}>
                  <Text style={styles.quoteText}>
                    {t("wrapped.slides.quote")}
                  </Text>
                </View>
              </View>
            )}

            {/* SLIDE 1: Ortak Mood */}
            {currentSlide === 1 && (
              <View style={styles.slideContent}>
                <Text style={styles.emojiDisplay}>{data.topMood.emoji}</Text>
                <Text style={styles.subHeading}>{t("wrapped.slides.moodTitle")}</Text>
                <Text style={styles.mainTitle}>{data.topMood.label}</Text>
                <Text style={styles.statDescription}>
                  {t("wrapped.slides.moodDescription", { count: data.topMood.count })}
                </Text>

                <View style={styles.badgeRow}>
                  <View style={styles.miniPill}>
                    <Text style={styles.miniPillText}>{t("wrapped.slides.pillLove")}</Text>
                  </View>
                  <View style={styles.miniPill}>
                    <Text style={styles.miniPillText}>{t("wrapped.slides.pillHarmony")}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* SLIDE 2: Mektup ve Notlar */}
            {currentSlide === 2 && (
              <View style={styles.slideContent}>
                <View style={styles.iconCircle}>
                  <Mail size={36} color={theme.accentLight} />
                </View>
                <Text style={styles.subHeading}>{t("wrapped.slides.wordsTitle")}</Text>
                <View style={styles.twoColumnGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.boxNumber}>{data.lettersCount}</Text>
                    <Text style={styles.boxLabel}>{t("wrapped.slides.loveLetters")}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.boxNumber}>{data.dailyNotesCount}</Text>
                    <Text style={styles.boxLabel}>{t("wrapped.slides.journalNotes")}</Text>
                  </View>
                </View>
                <Text style={styles.statDescription}>
                  {data.highlightStat}
                </Text>
              </View>
            )}

            {/* SLIDE 3: Büyük Final & Paylaşılabilir Story Kartı */}
            {currentSlide === 3 && (
              <View style={styles.finalSlideWrapper}>
                {/* Paylaşılacak Kart (Capture Target) */}
                <View ref={shareCardRef} collapsable={false} style={[styles.shareableCard, { shadowColor: theme.accent, borderColor: isMale ? "rgba(77, 156, 255, 0.25)" : "rgba(255, 255, 255, 0.12)" }]}>
                  <LinearGradient
                    colors={cardGradientColors}
                    style={StyleSheet.absoluteFill}
                  />

                  {/* Kart Üst Başlık */}
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeartIcon}>
                      <Heart size={16} color={theme.accent} fill={theme.accent} />
                    </View>
                    <Text style={[styles.cardHeaderTitle, { color: theme.accentLight }]}>COUPLE WRAPPED</Text>
                    <Text style={styles.cardPeriodBadge}>{data.periodTitle}</Text>
                  </View>

                  {/* Romantik İfade */}
                  <Text style={styles.cardRomanticTitle}>
                    {data.romanticStatement}
                  </Text>

                  {/* Kart İçi Grid İstatistikler */}
                  <View style={styles.cardMetricsContainer}>
                    <View style={styles.cardMetricRow}>
                      <Text style={styles.cardMetricLabel}>{t("wrapped.card.together")}</Text>
                      <Text style={styles.cardMetricVal}>{t("wrapped.card.days", { count: data.daysTogether })}</Text>
                    </View>
                    <View style={styles.cardMetricDivider} />
                    <View style={styles.cardMetricRow}>
                      <Text style={styles.cardMetricLabel}>{t("wrapped.card.mostFelt")}</Text>
                      <Text style={styles.cardMetricVal}>{data.topMood.emoji} {data.topMood.label}</Text>
                    </View>
                    <View style={styles.cardMetricDivider} />
                    <View style={styles.cardMetricRow}>
                      <Text style={styles.cardMetricLabel}>{t("wrapped.card.sharedNotes")}</Text>
                      <Text style={styles.cardMetricVal}>{t("wrapped.card.items", { count: data.lettersCount + data.dailyNotesCount })}</Text>
                    </View>
                    <View style={styles.cardMetricDivider} />
                    <View style={styles.cardMetricRow}>
                      <Text style={styles.cardMetricLabel}>{t("wrapped.card.meetupPlace")}</Text>
                      <Text style={styles.cardMetricVal}>{data.topLocation}</Text>
                    </View>
                  </View>

                  {/* Minimalist, Zarif ve Göze Sokulmayan İmza */}
                  <View style={styles.subtleWatermarkContainer}>
                    <View style={styles.watermarkDot} />
                    <Text style={styles.subtleWatermarkText}>Made with Couples App</Text>
                  </View>
                </View>

                {/* Butonlar */}
                <TouchableOpacity
                  onPress={handleShareStory}
                  disabled={isSharing}
                  activeOpacity={0.85}
                  style={styles.shareActionBtn}
                >
                  <LinearGradient
                    colors={shareBtnColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.shareBtnGradient}
                  >
                    {isSharing ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Share2 size={18} color="#FFFFFF" />
                        <Text style={styles.shareBtnText}>{t("wrapped.shareInstagram")}</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#0A0A0C",
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    zIndex: 20,
  },
  progressContainer: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  progressBarTrack: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  periodBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 107, 139, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  periodText: {
    color: "#FF8FA3",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  touchAreaContainer: {
    position: "absolute",
    top: 70,
    bottom: 90,
    left: 0,
    right: 0,
    flexDirection: "row",
    zIndex: 10,
  },
  leftTouch: {
    flex: 1,
  },
  rightTouch: {
    flex: 2,
  },
  slideContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    zIndex: 5,
  },
  slideContent: {
    alignItems: "center",
    width: "100%",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 77, 109, 0.14)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 109, 0.3)",
  },
  subHeading: {
    color: "#FF8FA3",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
    marginBottom: 8,
  },
  bigStatNumber: {
    color: "#FFFFFF",
    fontSize: 76,
    fontFamily: "PlayfairDisplay_700Bold",
    lineHeight: 84,
  },
  statLabel: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 280,
    marginTop: 6,
  },
  quoteBox: {
    marginTop: 40,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  quoteText: {
    color: "#E2E8F0",
    fontSize: 13,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    textAlign: "center",
  },
  emojiDisplay: {
    fontSize: 76,
    marginBottom: 20,
  },
  mainTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontFamily: "PlayfairDisplay_700Bold",
    textAlign: "center",
    marginBottom: 10,
  },
  statDescription: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 290,
    lineHeight: 20,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
  },
  miniPill: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  miniPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  twoColumnGrid: {
    flexDirection: "row",
    gap: 14,
    width: "100%",
    marginVertical: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 18,
    paddingVertical: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  boxNumber: {
    color: "#FF8FA3",
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  boxLabel: {
    color: "#E2E8F0",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  finalSlideWrapper: {
    width: "100%",
    alignItems: "center",
  },
  shareableCard: {
    width: SW * 0.88,
    borderRadius: 26,
    overflow: "hidden",
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    elevation: 8,
    shadowColor: "#FF4D6D",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  cardHeartIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 77, 109, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  cardHeaderTitle: {
    color: "#FF8FA3",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.5,
    flex: 1,
  },
  cardPeriodBadge: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  cardRomanticTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: "PlayfairDisplay_700Bold",
    lineHeight: 30,
    marginBottom: 20,
  },
  cardMetricsContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  cardMetricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  cardMetricLabel: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  cardMetricVal: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  cardMetricDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  subtleWatermarkContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 4,
  },
  watermarkDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FF4D6D",
  },
  subtleWatermarkText: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
  },
  shareActionBtn: {
    marginTop: 20,
    width: SW * 0.88,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    shadowColor: "#FF4D6D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  shareBtnGradient: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  shareBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
