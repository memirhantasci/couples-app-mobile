import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { logger } from "@/utils/logger";
import { View, Text, StyleSheet, Modal, TouchableOpacity, useWindowDimensions, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRealTopInset } from "@/hooks/useRealTopInset";
import { LinearGradient } from "expo-linear-gradient";
import { X, Share2, Heart, Sparkles, Mail, MapPin } from "lucide-react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { CoupleWrappedData } from "@/utils/wrappedCalculator";
import { AppTheme } from "@/lib/theme";
import { appAlert } from "@/lib/dialog";
import { shareStoryImage } from "@/lib/storyShare";
import { StoryCard, STORY_ASPECT, type StoryPalette, type StoryScale } from "@/components/share/StoryCard";
import { useTranslation } from "react-i18next";

// Son slayttaki hikâye önizlemesinin altında kalan yer: paylaş butonu + aralık; üstte ilerleme çubuğu bölgesi
const HEADER_HEIGHT = 70;
const SHARE_BUTTON_HEIGHT = 52;
const SHARE_BUTTON_GAP = 18;

interface CoupleWrappedModalProps {
  visible: boolean;
  onClose: () => void;
  data: CoupleWrappedData | null;
  partnerName?: string;
  theme: AppTheme;
}

const TOTAL_SLIDES = 4;
const SLIDE_DURATION = 5500; // ms

function StoryStatTile({ s, glyph, value, caption }: { s: StoryScale; glyph: ReactNode; value: string; caption: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.07)",
        borderRadius: s(16),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255, 255, 255, 0.14)",
        paddingVertical: s(12),
        paddingHorizontal: s(6),
      }}
    >
      <View style={{ height: s(26), justifyContent: "center" }}>{glyph}</View>
      <Text
        numberOfLines={2}
        style={{
          color: "#FFFFFF",
          fontSize: s(11.5),
          lineHeight: s(14),
          fontFamily: "Inter_600SemiBold",
          textAlign: "center",
          marginTop: s(6),
          minHeight: s(28),
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={2}
        style={{
          color: "rgba(255, 255, 255, 0.55)",
          fontSize: s(8.5),
          lineHeight: s(11),
          fontFamily: "Inter_500Medium",
          textAlign: "center",
          marginTop: s(4),
        }}
      >
        {caption}
      </Text>
    </View>
  );
}

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
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Tam ekran modal ekranın tepesinden başlar; durum çubuğu / Dynamic Island boşluğu gerçek üst güvenli
  // alandan alınır (demo modunda insets.top 0'a çekilir; SafeAreaView ise modal içinde 0 dönebiliyordu)
  const topInset = useRealTopInset();
  const isMale = theme?.gender === "male";
  const modalGradientColors = isMale
    ? (["#0A0E17", "#0D182A", "#13233D", "#0A0E17"] as const)
    : (["#0A0A0C", "#1F0C18", "#2E0A1F", "#0A0A0C"] as const);
  const storyPalette: StoryPalette = isMale
    ? { background: ["#0A1424", "#152B4D", "#0A111C"], glow: "79, 125, 190", decor: "#7FA6DC" }
    : { background: ["#1A0B16", "#3A1029", "#14081A"], glow: "216, 88, 112", decor: "#EC7E95" };
  // Önizleme 9:16 hikâye oranında; ekranda kalan yüksekliğe ve genişliğe sığacak en büyük boyda çizilir
  const storyHeightBudget =
    windowHeight - topInset - insets.bottom - HEADER_HEIGHT - SHARE_BUTTON_HEIGHT - SHARE_BUTTON_GAP - 12;
  const storyWidth = Math.floor(Math.min(windowWidth - 48, storyHeightBudget * STORY_ASPECT));
  const shareBtnColors = isMale
    ? ([theme.accent, "#1D4ED8"] as const)
    : (["#D85870", "#C8213F"] as const);
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
    try {
      setIsSharing(true);
      await shareStoryImage(shareCardRef, {
        dialogTitle: t("wrapped.shareTitle"),
        fallbackMessage: `${data?.romanticStatement} · ${t("common.madeWith")}`,
      });
    } catch (error) {
      logger.warn("Share error:", error);
      appAlert(t("common.error"), t("wrapped.shareError"));
    } finally {
      setIsSharing(false);
    }
  };

  if (!visible || !data) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Arka Plan Gradient */}
        <LinearGradient
          colors={modalGradientColors}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.safeArea, { paddingTop: topInset, paddingBottom: insets.bottom }]}>
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
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.close")} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={styles.closeBtn}>
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Dokunmatik Sol/Sağ Alanları */}
          <View style={[styles.touchAreaContainer, { top: topInset + 70 }]}>
            <TouchableOpacity activeOpacity={1} onPress={handlePrev} style={styles.leftTouch} />
            <TouchableOpacity activeOpacity={1} onPress={handleNext} style={styles.rightTouch} />
          </View>

          {/* Slayt İçerikleri */}
          {/* Son slaytta içerik, sol/sağ dokunma alanlarının ÜSTÜNE çıkar: aksi hâlde o alanlar paylaş
              butonuna gelen dokunuşu yutar. Kartın dışındaki boş yerler hâlâ alta (geri/ileri) geçer. */}
          <View
            style={[styles.slideContainer, currentSlide === TOTAL_SLIDES - 1 && styles.slideContainerInteractive]}
            pointerEvents={currentSlide === TOTAL_SLIDES - 1 ? "box-none" : "auto"}
          >
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

            {/* SLIDE 3: Büyük Final & Instagram hikâyesi (9:16) önizlemesi */}
            {currentSlide === 3 && (
              <View style={styles.finalSlideWrapper}>
                {/* Paylaşılan görsel tam bu karttır: 1080×1920, kenar boşluksuz */}
                <StoryCard
                  width={storyWidth}
                  cardRef={shareCardRef}
                  palette={storyPalette}
                  backdrop={
                    <View pointerEvents="none" style={styles.storyBackdrop}>
                      <Heart size={storyWidth * 0.95} color="rgba(255, 255, 255, 0.035)" fill="rgba(255, 255, 255, 0.035)" />
                    </View>
                  }
                >
                  {(s) => (
                    <>
                      <View style={styles.storyHeader}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: s(6),
                            backgroundColor: "rgba(255, 255, 255, 0.09)",
                            borderRadius: s(14),
                            paddingHorizontal: s(12),
                            paddingVertical: s(6),
                          }}
                        >
                          <Heart size={s(12)} color={theme.accent} fill={theme.accent} />
                          <Text
                            style={{ color: theme.accentLight, fontSize: s(10.5), fontFamily: "Inter_700Bold", letterSpacing: s(1.6) }}
                          >
                            COUPLE WRAPPED
                          </Text>
                        </View>
                        <Text
                          style={{ marginTop: s(8), color: "rgba(255, 255, 255, 0.6)", fontSize: s(11.5), fontFamily: "Inter_500Medium" }}
                        >
                          {data.periodTitle}
                        </Text>
                      </View>

                      <View style={styles.storyHero}>
                        <View
                          style={{
                            width: s(72),
                            height: s(72),
                            borderRadius: s(36),
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "rgba(255, 255, 255, 0.08)",
                            borderWidth: 1,
                            borderColor: "rgba(255, 255, 255, 0.14)",
                            marginBottom: s(12),
                          }}
                        >
                          <Heart size={s(32)} color={theme.accent} fill={theme.accent} />
                        </View>
                        <Text
                          style={{ color: "#FFFFFF", fontSize: s(88), lineHeight: s(96), fontFamily: "PlayfairDisplay_700Bold" }}
                        >
                          {data.daysTogether}
                        </Text>
                        <Text
                          style={{
                            color: "rgba(255, 255, 255, 0.78)",
                            fontSize: s(13),
                            lineHeight: s(19),
                            fontFamily: "Inter_400Regular",
                            textAlign: "center",
                            maxWidth: s(250),
                            marginTop: s(4),
                          }}
                        >
                          {t("wrapped.slides.daysTogether")}
                        </Text>
                        <Text
                          style={{
                            color: "#FFFFFF",
                            fontSize: s(19),
                            lineHeight: s(27),
                            fontFamily: "PlayfairDisplay_400Regular_Italic",
                            textAlign: "center",
                            maxWidth: s(280),
                            marginTop: s(22),
                          }}
                        >
                          {data.romanticStatement}
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", gap: s(8) }}>
                        <StoryStatTile
                          s={s}
                          glyph={<Text style={{ fontSize: s(22) }}>{data.topMood.emoji}</Text>}
                          value={data.topMood.label}
                          caption={t("wrapped.card.mostFelt")}
                        />
                        <StoryStatTile
                          s={s}
                          glyph={<Mail size={s(22)} color={theme.accentLight} />}
                          value={t("wrapped.card.items", { count: data.lettersCount + data.dailyNotesCount })}
                          caption={t("wrapped.card.sharedNotes")}
                        />
                        <StoryStatTile
                          s={s}
                          glyph={<MapPin size={s(22)} color={theme.accentLight} />}
                          value={data.topLocation}
                          caption={t("wrapped.card.meetupPlace")}
                        />
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: s(6), marginTop: s(16) }}>
                        <View style={{ width: s(4), height: s(4), borderRadius: s(2), backgroundColor: theme.accent }} />
                        <Text
                          style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: s(10.5), fontFamily: "Inter_500Medium", letterSpacing: s(0.5) }}
                        >
                          {t("common.madeWith")}
                        </Text>
                      </View>
                    </>
                  )}
                </StoryCard>

                {/* Butonlar */}
                <TouchableOpacity
                  onPress={handleShareStory}
                  disabled={isSharing}
                  activeOpacity={0.85}
                  style={[styles.shareActionBtn, { width: storyWidth }]}
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
        </View>
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
  slideContainerInteractive: {
    zIndex: 15,
  },
  slideContent: {
    alignItems: "center",
    width: "100%",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(216, 88, 112, 0.14)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(216, 88, 112, 0.3)",
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
  storyBackdrop: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  storyHeader: {
    alignItems: "center",
  },
  storyHero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  shareActionBtn: {
    marginTop: SHARE_BUTTON_GAP,
    height: SHARE_BUTTON_HEIGHT,
    borderRadius: 26,
    overflow: "hidden",
    shadowColor: "#D85870",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
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
