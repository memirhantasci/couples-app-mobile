import { useState, useEffect, useRef, useCallback } from "react";
import { logger } from "@/utils/logger";
import { View, Text, StyleSheet, Modal, TouchableOpacity, useWindowDimensions, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRealTopInset } from "@/hooks/useRealTopInset";
import { LinearGradient } from "expo-linear-gradient";
import { X, Share2, Heart, Sparkles, Mail, MapPin } from "lucide-react-native";
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { UICountUp } from "@/components/ui/CountUp";
import { scheduleOnRN } from "react-native-worklets";
import type { TFunction } from "i18next";
import { CoupleWrappedData } from "@/utils/wrappedCalculator";
import { ARCHETYPE_EMOJI, type CoupleArchetype } from "@/utils/coupleArchetype";
import { AppTheme } from "@/lib/theme";
import { appAlert } from "@/lib/dialog";
import { shareStoryImage } from "@/lib/storyShare";
import { StoryCard, STORY_ASPECT } from "@/components/share/StoryCard";
import { FrostedBadge, GOLD, Monogram, Polaroid } from "@/components/share/storyDecor";
import { DialogHost } from "@/components/ui/DialogHost";
import { useStoryCouple } from "@/hooks/useStoryCouple";
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

const TOTAL_SLIDES = 5;
/** Son slayt: paylaşılan hikâye kartı. */
const FINAL_SLIDE = TOTAL_SLIDES - 1;
const SLIDE_DURATION = 5500; // ms

// ─── Sahne Girişleri (Instagram hikâyesi gibi) ────────────────────────────────
// Başlık ve ikonlar yukarıdan süzülür; altındaki rozet ve kutular kademeli olarak (80 ms arayla) aşağıdan gelir.
const HERO_DELAY_MS = 120;
const HERO_STEP_MS = 70;
const ITEMS_DELAY_MS = 420;
const ITEM_STAGGER_MS = 80;
/** Arka plan rengi slayt konusuna göre bu sürede yumuşakça değişir */
const BACKDROP_MORPH_MS = 1500;

type GradientColors = readonly [string, string, ...string[]];

/** Çift tipini seçtiren verinin tek satırlık açıklaması ("Paylaşımlarınızın %80'i gece 22:00'den sonra"). */
function archetypeEvidenceText(t: TFunction, { evidence }: CoupleArchetype): string {
  switch (evidence.key) {
    case "night":
      return t("wrapped.archetype.evidence.night", { percent: evidence.value });
    case "morning":
      return t("wrapped.archetype.evidence.morning", { percent: evidence.value });
    case "letters":
      return t("wrapped.archetype.evidence.letters", { count: evidence.value });
    case "photos":
      return t("wrapped.archetype.evidence.photos", { count: evidence.value });
    case "meetings":
      return t("wrapped.archetype.evidence.meetings", { count: evidence.value });
    case "notes":
      return t("wrapped.archetype.evidence.notes", { count: evidence.value });
    default:
      return t("wrapped.archetype.evidence.none");
  }
}

// Slayt konuları: 0 Aşk (birlikte geçen günler) · 1 Ruh hali · 2 Mektuplar · 3 Çift tipi · 4 Final
const SLIDE_BACKDROPS: Record<"female" | "male", readonly GradientColors[]> = {
  female: [
    ["#0A0A0C", "#2A0A1C", "#4A0F2C", "#0A0A0C"],
    ["#0C0A10", "#2A1530", "#3D1F12", "#0C0A10"],
    ["#0A0A12", "#1A1240", "#2E0A3A", "#0A0A12"],
    ["#0A0A10", "#2A1236", "#4A1A3C", "#0A0A10"],
    ["#0A0A0C", "#1F0C18", "#2E0A1F", "#0A0A0C"],
  ],
  male: [
    ["#0A0E17", "#0D1E3A", "#1A2F5A", "#0A0E17"],
    ["#0A0E14", "#14283A", "#2B2A4A", "#0A0E14"],
    ["#090C16", "#16173F", "#1D2E55", "#090C16"],
    ["#090D18", "#121F48", "#2A2A5E", "#090D18"],
    ["#0A0E17", "#0D182A", "#13233D", "#0A0E17"],
  ],
};

/** Slayt arka planlarından biri: etkin slayt indeksine yaklaştıkça görünür, komşusuyla çapraz geçiş yapar. */
function BackdropLayer({ index, active, colors }: { index: number; active: SharedValue<number>; colors: GradientColors }) {
  const style = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - Math.abs(active.get() - index)),
  }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
    </Animated.View>
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
  const slideBackdrops = SLIDE_BACKDROPS[isMale ? "male" : "female"];
  const reduceMotion = useReducedMotion();
  // Final kartındaki Polaroid fotoğrafı, monogram ve isimler
  const couple = useStoryCouple(visible);
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

  // Arka plan, slayt değişince konusunun rengine 1.5 sn'de akar; her açılış ilk slaytın renginden başlar
  const backdropIndex = useSharedValue(0);
  useEffect(() => {
    if (!visible || reduceMotion) {
      backdropIndex.set(visible ? currentSlide : 0);
      return;
    }
    backdropIndex.set(withTiming(currentSlide, { duration: BACKDROP_MORPH_MS, easing: Easing.inOut(Easing.cubic) }));
  }, [visible, currentSlide, reduceMotion, backdropIndex]);

  // Sahne girişleri: hareket azaltma açıkken öğeler doğrudan yerinde görünür
  const heroIn = (step: number) =>
    reduceMotion ? undefined : FadeInUp.delay(HERO_DELAY_MS + step * HERO_STEP_MS).duration(400).springify();
  const itemIn = (step: number) =>
    reduceMotion ? undefined : FadeInDown.delay(ITEMS_DELAY_MS + step * ITEM_STAGGER_MS).duration(380).springify();

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

  const archetype = data.archetype;
  const archetypeName = t(`wrapped.archetype.${archetype.id}.name`);
  const archetypeLine = t(`wrapped.archetype.${archetype.id}.line`);
  const archetypeTraits = [
    t(`wrapped.archetype.${archetype.id}.trait1`),
    t(`wrapped.archetype.${archetype.id}.trait2`),
    t(`wrapped.archetype.${archetype.id}.trait3`),
  ];

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Arka Plan Gradient: slayt konusuna göre çapraz geçişle renk değiştirir */}
        {slideBackdrops.map((colors, index) => (
          <BackdropLayer key={index} index={index} active={backdropIndex} colors={colors} />
        ))}

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
                <Animated.View entering={heroIn(0)} style={styles.iconCircle}>
                  <Heart size={38} color={theme.accent} fill={theme.accent} />
                </Animated.View>
                <Animated.Text entering={heroIn(1)} style={styles.subHeading}>
                  {t("wrapped.slides.storyTitle")}
                </Animated.Text>
                <Animated.View entering={heroIn(2)} style={styles.countRow}>
                  <UICountUp value={data.daysTogether} delay={HERO_DELAY_MS + 2 * HERO_STEP_MS} style={styles.bigStatNumber} />
                </Animated.View>
                <Animated.Text entering={heroIn(3)} style={styles.statLabel}>
                  {t("wrapped.slides.daysTogether")}
                </Animated.Text>

                <Animated.View entering={itemIn(0)} style={styles.quoteBox}>
                  <Text style={styles.quoteText}>
                    {t("wrapped.slides.quote")}
                  </Text>
                </Animated.View>
              </View>
            )}

            {/* SLIDE 1: Ortak Mood */}
            {currentSlide === 1 && (
              <View style={styles.slideContent}>
                <Animated.Text entering={heroIn(0)} style={styles.emojiDisplay}>
                  {data.topMood.emoji}
                </Animated.Text>
                <Animated.Text entering={heroIn(1)} style={styles.subHeading}>
                  {t("wrapped.slides.moodTitle")}
                </Animated.Text>
                <Animated.Text entering={heroIn(2)} style={styles.mainTitle}>
                  {data.topMood.label}
                </Animated.Text>
                <Animated.Text entering={heroIn(3)} style={styles.statDescription}>
                  {t("wrapped.slides.moodDescription", { count: data.topMood.count })}
                </Animated.Text>

                <View style={styles.badgeRow}>
                  <Animated.View entering={itemIn(0)} style={styles.miniPill}>
                    <Text style={styles.miniPillText}>{t("wrapped.slides.pillLove")}</Text>
                  </Animated.View>
                  <Animated.View entering={itemIn(1)} style={styles.miniPill}>
                    <Text style={styles.miniPillText}>{t("wrapped.slides.pillHarmony")}</Text>
                  </Animated.View>
                </View>
              </View>
            )}

            {/* SLIDE 2: Mektup ve Notlar */}
            {currentSlide === 2 && (
              <View style={styles.slideContent}>
                <Animated.View entering={heroIn(0)} style={styles.iconCircle}>
                  <Mail size={36} color={theme.accentLight} />
                </Animated.View>
                <Animated.Text entering={heroIn(1)} style={styles.subHeading}>
                  {t("wrapped.slides.wordsTitle")}
                </Animated.Text>
                <View style={styles.twoColumnGrid}>
                  <Animated.View entering={itemIn(0)} style={styles.statBox}>
                    <UICountUp
                      value={data.lettersCount}
                      delay={ITEMS_DELAY_MS}
                      style={styles.boxNumber}
                    />
                    <Text style={styles.boxLabel}>{t("wrapped.slides.loveLetters")}</Text>
                  </Animated.View>
                  <Animated.View entering={itemIn(1)} style={styles.statBox}>
                    <UICountUp
                      value={data.dailyNotesCount}
                      delay={ITEMS_DELAY_MS + ITEM_STAGGER_MS}
                      style={styles.boxNumber}
                    />
                    <Text style={styles.boxLabel}>{t("wrapped.slides.journalNotes")}</Text>
                  </Animated.View>
                </View>
                <Animated.Text entering={itemIn(2)} style={styles.statDescription}>
                  {data.highlightStat}
                </Animated.Text>
              </View>
            )}

            {/* SLIDE 3: Çift tipi ("Siz nasıl bir çiftsiniz?"): dönemin verilerinden çıkar */}
            {currentSlide === 3 && (
              <View style={styles.slideContent}>
                <Animated.Text entering={heroIn(0)} style={styles.emojiDisplay}>
                  {ARCHETYPE_EMOJI[archetype.id]}
                </Animated.Text>
                <Animated.Text entering={heroIn(1)} style={styles.subHeading}>
                  {t("wrapped.archetype.title")}
                </Animated.Text>
                <Animated.Text entering={heroIn(2)} style={styles.mainTitle}>
                  {archetypeName}
                </Animated.Text>
                <Animated.Text entering={heroIn(3)} style={styles.statDescription}>
                  {archetypeLine}
                </Animated.Text>
                <Animated.Text entering={itemIn(0)} style={styles.archetypeEvidence}>
                  {archetypeEvidenceText(t, archetype)}
                </Animated.Text>

                <View style={styles.badgeRow}>
                  {archetypeTraits.map((trait, index) => (
                    <Animated.View key={index} entering={itemIn(index + 1)} style={styles.miniPill}>
                      <Text style={styles.miniPillText}>{trait}</Text>
                    </Animated.View>
                  ))}
                </View>
              </View>
            )}

            {/* SLIDE 4: Büyük Final & Instagram hikâyesi (9:16) önizlemesi.
                Paylaşılan görsel bu kartın kendisi: içi sabit kalır, yalnızca bütünü sahneye süzülür */}
            {currentSlide === FINAL_SLIDE && (
              <Animated.View entering={heroIn(0)} style={styles.finalSlideWrapper}>
                {/* Paylaşılan görsel tam bu karttır: 1080×1920, kenar boşluksuz */}
                <StoryCard width={storyWidth} cardRef={shareCardRef} tone={isMale ? "azure" : "rose"}>
                  {(s) => (
                    <View style={styles.storyColumn}>
                      {/* Üstte altın monogram ve dönem */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: s(10) }}>
                        {couple.initials ? <Monogram s={s} initials={couple.initials} size={36} /> : null}
                        <View>
                          <Text style={{ color: GOLD.ink, fontSize: s(9.5), fontFamily: "Inter_700Bold", letterSpacing: s(2.6) }}>
                            COUPLE WRAPPED
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{ marginTop: s(2), color: "rgba(255, 255, 255, 0.62)", fontSize: s(10.5), fontFamily: "Inter_500Medium" }}
                          >
                            {data.periodTitle}
                          </Text>
                        </View>
                      </View>

                      {/* Çiftin son fotoğrafı: washi bantla iliştirilmiş, hafif eğik Polaroid */}
                      {/* Çift tipi bloğu için yer açmak üzere Polaroid biraz küçüldü (158 → 124) */}
                      <Polaroid s={s} width={s(124)} photo={couple.cover} rotate={-3.5} caption={couple.names} />

                      <View style={{ alignItems: "center" }}>
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          style={{
                            color: GOLD.ink,
                            fontSize: s(44),
                            lineHeight: s(52),
                            fontFamily: "PlayfairDisplay_700Bold",
                            textShadowColor: "rgba(226, 184, 92, 0.45)",
                            textShadowOffset: { width: 0, height: 0 },
                            textShadowRadius: s(12),
                          }}
                        >
                          {t("wrapped.card.days", { count: data.daysTogether })}
                        </Text>
                        <Text
                          numberOfLines={2}
                          style={{
                            marginTop: s(2),
                            maxWidth: s(276),
                            color: "rgba(255, 255, 255, 0.86)",
                            fontSize: s(13.5),
                            lineHeight: s(19),
                            fontFamily: "PlayfairDisplay_400Regular_Italic",
                            textAlign: "center",
                          }}
                        >
                          {data.romanticStatement}
                        </Text>
                      </View>

                      {/* Çift tipi: kartın paylaşılma sebebi ("biz hangi tipiz?") */}
                      <View style={{ alignItems: "center" }}>
                        <Text style={{ color: GOLD.soft, fontSize: s(8.4), fontFamily: "Inter_700Bold", letterSpacing: s(2.2) }}>
                          {t("wrapped.archetype.cardKicker")}
                        </Text>
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.6}
                          style={{
                            marginTop: s(3),
                            maxWidth: s(290),
                            color: "#FFFFFF",
                            fontSize: s(21),
                            lineHeight: s(27),
                            fontFamily: "PlayfairDisplay_700Bold",
                            textAlign: "center",
                          }}
                        >
                          {ARCHETYPE_EMOJI[archetype.id]} {archetypeName}
                        </Text>
                      </View>

                      {/* Buzlu cam rozetler */}
                      <View style={{ flexDirection: "row", gap: s(8), alignSelf: "stretch" }}>
                        <FrostedBadge
                          s={s}
                          glyph={<Text style={{ fontSize: s(19) }}>{data.topMood.emoji}</Text>}
                          value={t("wrapped.card.moodDays", { count: data.topMood.count, mood: data.topMood.label })}
                          caption={t("wrapped.card.mostFelt")}
                        />
                        <FrostedBadge
                          s={s}
                          glyph={<Mail size={s(19)} color={GOLD.ink} />}
                          value={t("wrapped.card.items", { count: data.lettersCount + data.dailyNotesCount })}
                          caption={t("wrapped.card.sharedNotes")}
                        />
                        <FrostedBadge
                          s={s}
                          glyph={<MapPin size={s(19)} color={GOLD.ink} />}
                          value={data.topLocation}
                          caption={t("wrapped.card.meetupPlace")}
                        />
                      </View>
                    </View>
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
              </Animated.View>
            )}
          </View>
        </View>
      </View>
      {/* Paylaşım hatası bu modalın içinde gösterilir (kök diyalog katmanı modalın arkasında kalırdı) */}
      <DialogHost embedded visible={visible} />
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
  // Sayaç metin kutusu satırı kaplar: rakam sayarken genişlik değişse de ortada kalır
  countRow: {
    alignSelf: "stretch",
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
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
  },
  archetypeEvidence: {
    marginTop: 14,
    maxWidth: 290,
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
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
    lineHeight: 40,
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
  // Final kartının dikey düzeni: başlık, Polaroid, gün sayısı ve rozetler güvenli bölgeye yayılır
  storyColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
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
