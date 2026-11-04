import { useState, useEffect, memo, useCallback, useRef } from "react";
import {
  AppState,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeInUp,
  FadeOutDown,
  LayoutAnimationConfig,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useFocusEffect } from "expo-router";
import { getCountdown, dayjs } from "@/lib/date";
import { Heart, Info, MapPin, X, Navigation } from "lucide-react-native";
import { AppTheme } from "@/lib/theme";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useCoupleAvatars } from "@/hooks/useCoupleAvatars";
import { AnniversaryGlow } from "@/components/home/AnniversaryGlow";
import { Pulse } from "@/components/ui/Pulse";
import { rainConfetti } from "@/lib/confettiRain";
import { playCelebration } from "@/lib/soundEffects";
import { useTranslation } from "react-i18next";
import { markMeetingCelebrationSeen } from "@/lib/activeMeeting";
import { openDirections as openMapDirections } from "@/components/map/openDirections";

// Skia yalnızca native modül mevcutsa yüklenir (Expo Go vb. ortamlarda çökmesin);
// yoksa kavuşma kartı dönen hale yerine yıldönümü ışıltısıyla sarılır.
let SkiaLib: typeof import("@shopify/react-native-skia") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@shopify/react-native-skia");
  if (mod?.Skia && mod?.Canvas) SkiaLib = mod;
} catch {
  SkiaLib = null;
}

export interface Meeting {
  id: number;
  title: string;
  meeting_datetime: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  /** Buluşmayı planlayan kişi */
  user_id?: string | null;
}

interface CountdownProps {
  meeting: Meeting;
  theme: AppTheme;
  /** Kavuşma kartında sarılan avatarların baş harfleri için */
  myName?: string | null;
  partnerName?: string | null;
  onCelebrated?: (meetingId: number) => void;
}

export const MeetingCountdown = memo(function MeetingCountdown({ meeting, theme, myName, partnerName, onCelebrated }: CountdownProps) {
  const { t, i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const targetDate = meeting.meeting_datetime;
  const title = meeting.title || t("tabs.meetings.label");

  const [countdown, setCountdown] = useState(() => getCountdown(targetDate));
  const [showModal, setShowModal] = useState(false);
  // Planlayanın profil fotoğrafı varsa konum ikonunun yerine imza olarak görünür
  const { getAvatarUrl, myAvatarUrl, partnerAvatarUrl } = useCoupleAvatars();
  const plannerAvatarUrl = getAvatarUrl(meeting.user_id);
  // Buluşma bugün ama saati henüz gelmedi: geri sayım sürer, kart kavuşma gününe bürünür
  const [isMeetingDay] = useState(() => dayjs(targetDate).isSame(dayjs(), "day"));

  // Sayaç yalnızca bu ekran odaktayken ve uygulama öndeyken tiklar. Sekmeler bellekte kaldığı için aksi halde
  // başka bir sekmedeyken ya da arka planda saniyede bir render + yaylı rakam animasyonu sürüp pil tüketirdi.
  // Odağa / öne dönüşte önce o anki gerçek farkla eşitlenir (rakamlar bayat kalmaz), sonra saniyelik tik yeniden başlar.
  useFocusEffect(
    useCallback(() => {
      if (countdown.isPast) return;

      let interval: ReturnType<typeof setInterval> | null = null;
      const stop = () => {
        if (interval) clearInterval(interval);
        interval = null;
      };
      const sync = () => {
        const next = getCountdown(targetDate);
        setCountdown(next);
        return next;
      };
      const start = () => {
        if (interval) return;
        if (sync().isPast) return;
        interval = setInterval(() => {
          if (sync().isPast) stop();
        }, 1000);
      };

      if (AppState.currentState === "active") start();
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") start();
        else stop();
      });
      return () => {
        subscription.remove();
        stop();
      };
    }, [targetDate, countdown.isPast])
  );

  const openDirections = () => {
    if (meeting.latitude && meeting.longitude) {
      openMapDirections(meeting.latitude, meeting.longitude);
    }
  };

  const formattedDate = dayjs(targetDate).locale(i18n.language).format("D MMMM");

  if (countdown.isPast) {
    return (
      <>
        <ReunionCard
          meetingId={meeting.id}
          title={title}
          theme={theme}
          myName={myName}
          partnerName={partnerName}
          myAvatarUrl={myAvatarUrl}
          partnerAvatarUrl={partnerAvatarUrl}
          onOpenDetails={() => setShowModal(true)}
          onCelebrated={onCelebrated}
        />
        <MeetingModal
          visible={showModal}
          onClose={() => setShowModal(false)}
          meeting={meeting}
          openDirections={openDirections}
          theme={theme}
        />
      </>
    );
  }

  const units = [
    { label: t("home.meeting.days"), value: countdown.days },
    { label: t("home.meeting.hours"), value: countdown.hours },
    { label: t("home.meeting.minutes"), value: countdown.minutes },
    { label: t("home.meeting.seconds"), value: countdown.seconds },
  ];

  return (
    // Buluşma günü kart, saati gelene kadar altın bir ışıltıyla sarılır. Alt boşluk sarmalayıcıdadır:
    // kartın içinde kalsaydı ışıltı halkaları kartın altına taşardı.
    <View style={styles.cardSpacing}>
    <AnniversaryGlow active={isMeetingDay} radius={20} isLight={theme.isLight}>
    <TouchableOpacity
      style={[styles.card, styles.cardInGlow, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}
      activeOpacity={0.9}
      onPress={() => setShowModal(true)}
    >
      {isMeetingDay ? (
        <View style={styles.meetingDayRow}>
          <Pulse scale={1.08} period={1800}>
            <View style={[styles.meetingDayPill, { backgroundColor: theme.pillAccentBg, borderColor: theme.pillAccentBorder }]}>
              <Text style={[styles.meetingDayText, { color: theme.accent }]}>{t("home.meeting.reunion.todayBadge")}</Text>
            </View>
          </Pulse>
        </View>
      ) : null}

      {/* Başlık Satırı */}
      <View style={styles.titleRow}>
        {plannerAvatarUrl ? (
          <UserAvatar uri={plannerAvatarUrl} size={28} borderWidth={1} />
        ) : (
          <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
            <MapPin size={13} color={theme.accent} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionLabel, { color: theme.text }]}>{t("home.meeting.next")}</Text>
          {meeting.location_name && (
            <Text style={[styles.locationText, { color: theme.textSecondary }]}>{meeting.location_name}</Text>
          )}
        </View>
        <Text style={[styles.dateChip, { color: theme.textMuted }]}>{formattedDate}</Text>
      </View>

      {/* Geri Sayım Kutuları — kart ilk çizildiğinde rakamlar kaymaz, yalnızca sonraki değişimler akar */}
      <LayoutAnimationConfig skipEntering>
        <View style={styles.grid}>
          {units.map((unit) => (
            <View key={unit.label} style={[styles.unitBox, { backgroundColor: theme.unitBg, borderColor: theme.cardBorder }]}>
              <RollingValue
                value={String(unit.value).padStart(2, "0")}
                style={[styles.unitValue, { color: theme.text }]}
                animate={!reduceMotion}
              />
              <Text style={[styles.unitLabel, { color: theme.textMuted }]}>{unit.label}</Text>
            </View>
          ))}
        </View>
      </LayoutAnimationConfig>

      <MeetingModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        meeting={meeting}
        openDirections={openDirections}
        theme={theme}
      />
    </TouchableOpacity>
    </AnniversaryGlow>
    </View>
  );
});

/**
 * Değeri değiştikçe yeni rakam yukarıdan yaylanarak düşer, eskisi aşağı akıp kaybolur (kilometre sayacı).
 * Yalnızca değişen kutu canlanır: saniyeler her saniye, dakikalar dakikada bir.
 */
function RollingValue({ value, style, animate }: { value: string; style: StyleProp<TextStyle>; animate: boolean }) {
  return (
    <View style={styles.rollingWindow}>
      <Animated.Text
        key={value}
        entering={animate ? FadeInUp.duration(200).springify() : undefined}
        exiting={animate ? FadeOutDown.duration(200) : undefined}
        style={style}
      >
        {value}
      </Animated.Text>
    </View>
  );
}

// ─── Kavuşma Günü Kartı ───────────────────────────────────────────────────────

const REUNION_AVATAR = 46;
const REUNION_STAGE_H = 64;
const RUN_MS = 950;
/** Kutlama (ses, konfeti, sarılma) iki dokunuşta bundan sık yeniden oynamaz. */
const REPLAY_GAP_MS = 700;

interface ReunionCardProps {
  meetingId: number;
  title: string;
  theme: AppTheme;
  myName?: string | null;
  partnerName?: string | null;
  myAvatarUrl?: string | null;
  partnerAvatarUrl?: string | null;
  onOpenDetails: () => void;
  onCelebrated?: (meetingId: number) => void;
}

/** Buluşma anı geldi: iki avatar iki yandan koşup sarılır; karta dokununca ekran boyunca konfeti yağar. */
function ReunionCard({
  meetingId,
  title,
  theme,
  myName,
  partnerName,
  myAvatarUrl,
  partnerAvatarUrl,
  onOpenDetails,
  onCelebrated,
}: ReunionCardProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [stageW, setStageW] = useState(0);
  const [cardSize, setCardSize] = useState<{ width: number; height: number } | null>(null);
  const [celebrated, setCelebrated] = useState(false);
  const run = useSharedValue(reduceMotion ? 1 : 0);
  const hug = useSharedValue(reduceMotion ? 1 : 0);
  const cardOpacity = useSharedValue(1);
  const celebrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // State güncellemesi bir sonraki çizimde görünür; art arda hızlı dokunuşlar bu ref ile elenir
  const celebratedRef = useRef(false);
  const dismissedRef = useRef(false);
  const lastCelebrateAtRef = useRef(0);

  useEffect(() => {
    return () => {
      if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
    };
  }, []);

  const playHug = useCallback(() => {
    if (reduceMotion) return;
    cancelAnimation(run);
    cancelAnimation(hug);
    run.set(0);
    hug.set(0);
    run.set(
      withTiming(1, { duration: RUN_MS, easing: Easing.inOut(Easing.quad) }, (done) => {
        "worklet";
        // Varınca tatlı bir yaylanmayla sarılırlar
        if (done) hug.set(withSpring(1, { damping: 7, stiffness: 170 }));
      })
    );
  }, [reduceMotion, run, hug]);

  // Kart her göründüğünde (ekran odağa geldiğinde) kavuşma yeniden oynar
  useFocusEffect(
    useCallback(() => {
      playHug();
    }, [playHug])
  );

  /** Kart solarken kartı listeden kaldırır: animasyon bitince çağıran, JS zamanlayıcısıyla (worklet geri çağrısı değil). */
  const fadeOutThenRemove = (fadeMs: number) => {
    cardOpacity.set(withTiming(0, { duration: fadeMs, easing: Easing.out(Easing.quad) }));
    if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
    celebrateTimerRef.current = setTimeout(() => onCelebrated?.(meetingId), fadeMs);
  };

  const handleCelebrate = () => {
    // Kapat (X) ile kaldırılmaya başlayan kart yeniden canlanmaz
    if (dismissedRef.current) return;

    // Her dokunuş kartın kapanma sayacını baştan başlatır: ikinci dokunuş kartı kaldırmaz, yalnızca ömrünü uzatır.
    // Kart zaten solmaya başladıysa (sayaç dolmuş, kaldırma bekliyor) tam görünürlüğe döner.
    cancelAnimation(cardOpacity);
    cardOpacity.set(1);
    if (celebrateTimerRef.current) clearTimeout(celebrateTimerRef.current);
    // Konfetiler patladıktan sonra kart 3.5 sn ekranda kalıp nazikçe kapanır
    celebrateTimerRef.current = setTimeout(() => fadeOutThenRemove(350), 3500);

    if (!celebratedRef.current) {
      celebratedRef.current = true;
      setCelebrated(true);
      // Yerel hafızaya hemen kaydet: kullanıcı uygulamadan çıksa bile artık görüldü sayılır
      markMeetingCelebrationSeen(meetingId);
    }

    // Seri dokunuşlar kutlamayı yeniden oynatmaz (üst üste binen ses / animasyon / konfeti uygulamayı çökertiyordu);
    // ses 500 ms'den sık çalmaz, konfeti yağmuru sürerken yenisi başlamaz
    const now = Date.now();
    if (now - lastCelebrateAtRef.current < REPLAY_GAP_MS) return;
    lastCelebrateAtRef.current = now;

    playCelebration();
    rainConfetti();
    playHug();
  };

  const handleDismiss = () => {
    dismissedRef.current = true;
    celebratedRef.current = true;
    markMeetingCelebrationSeen(meetingId);
    fadeOutThenRemove(250);
  };

  const handleStageLayout = (event: LayoutChangeEvent) => setStageW(Math.round(event.nativeEvent.layout.width));
  const handleCardLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setCardSize((prev) =>
      prev && Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1 ? prev : { width, height }
    );
  };

  const leftStyle = useRunnerStyle(-1, stageW, run, hug);
  const rightStyle = useRunnerStyle(1, stageW, run, hug);
  const heartStyle = useAnimatedStyle(() => ({
    opacity: hug.get(),
    transform: [{ translateY: -4 * hug.get() }, { scale: 0.4 + 0.6 * hug.get() }],
  }));

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.get(),
    transform: [{ scale: 0.95 + 0.05 * cardOpacity.get() }],
  }));

  const card = (
    <Animated.View style={cardAnimStyle}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={handleCelebrate}
        onLayout={handleCardLayout}
        style={[styles.card, styles.reunionCard, { backgroundColor: theme.cardBg, ...theme.cardShadow }]}
        accessibilityRole="button"
        accessibilityHint={t("home.meeting.reunion.celebrateHint")}
      >
        {/* Kapat / Görüldü butonu */}
        <TouchableOpacity
          onPress={handleDismiss}
          hitSlop={10}
          style={[styles.reunionCloseBtn, { backgroundColor: theme.pillAccentBg }]}
          accessibilityRole="button"
          accessibilityLabel={t("a11y.close")}
        >
          <X size={14} color={theme.accent} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onOpenDetails}
          hitSlop={10}
          style={[styles.reunionInfoBtn, { backgroundColor: theme.pillAccentBg }]}
          accessibilityRole="button"
          accessibilityLabel={t("home.meeting.details")}
        >
          <Info size={14} color={theme.accent} />
        </TouchableOpacity>

      <View style={styles.reunionStage} onLayout={handleStageLayout}>
        {stageW > 0 ? (
          <>
            <Animated.View style={[styles.runner, leftStyle]}>
              <UserAvatar uri={myAvatarUrl} name={myName} size={REUNION_AVATAR} borderColor={theme.cardBg} borderWidth={2} />
            </Animated.View>
            <Animated.View style={[styles.runner, rightStyle]}>
              <UserAvatar
                uri={partnerAvatarUrl}
                name={partnerName}
                size={REUNION_AVATAR}
                borderColor={theme.cardBg}
                borderWidth={2}
              />
            </Animated.View>
            <Animated.View style={[styles.reunionHeart, { left: stageW / 2 - 9 }, heartStyle]}>
              <Heart size={18} color={theme.accent} fill={theme.accent} />
            </Animated.View>
          </>
        ) : null}
      </View>

      <Text style={[styles.reunionTitle, { color: theme.text }]}>{t("home.meeting.reunion.title")}</Text>
      <Text style={[styles.reunionMeeting, { color: theme.textSecondary }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.reunionHint, { color: theme.accent }]}>
        {celebrated ? t("home.meeting.reunion.celebrated") : t("home.meeting.reunion.celebrateHint")}
      </Text>
    </TouchableOpacity>
    </Animated.View>
  );

  if (!SkiaLib) {
    return (
      <View style={styles.reunionWrap}>
        <AnniversaryGlow active radius={20} isLight={theme.isLight}>
          {card}
        </AnniversaryGlow>
      </View>
    );
  }

  return (
    <View style={styles.reunionWrap}>
      {cardSize ? <ReunionHalo width={cardSize.width} height={cardSize.height} animate={!reduceMotion} /> : null}
      {card}
    </View>
  );
}

/** side: -1 sol (sen), +1 sağ (sevgilin). Kenardan zıplayarak koşar, merkezde birbirine yaslanır. */
function useRunnerStyle(side: -1 | 1, stageW: number, run: SharedValue<number>, hug: SharedValue<number>) {
  return useAnimatedStyle(() => {
    const r = run.get();
    const h = hug.get();
    const center = stageW / 2 - REUNION_AVATAR / 2;
    const start = side < 0 ? 0 : stageW - REUNION_AVATAR;
    // Sarılınca %30 üst üste biner
    const end = center + side * REUNION_AVATAR * 0.36;
    const x = start + (end - start) * r - side * REUNION_AVATAR * 0.08 * h;
    // Koşarken küçük adımlar: her adımda hafif bir sıçrama, varışa doğru söner
    const hop = Math.abs(Math.sin(r * Math.PI * 4)) * 7 * (1 - r * r);
    return {
      transform: [
        { translateX: x },
        { translateY: -hop },
        { rotate: `${-side * 10 * h}deg` },
        { scale: 1 + 0.05 * h },
      ],
    };
  });
}

const HALO_PAD = 10;
const HALO_SPIN_MS = 6000;

/** Skia: kartın çevresinde dönen altın ve gül kurusu ışıma. */
function ReunionHalo({ width, height, animate }: { width: number; height: number; animate: boolean }) {
  const Skia = SkiaLib!;
  const spin = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      if (!animate) return;
      spin.set(0);
      spin.set(withRepeat(withTiming(1, { duration: HALO_SPIN_MS, easing: Easing.linear }), -1, false));
      return () => cancelAnimation(spin);
    }, [animate, spin])
  );

  const center = { x: width / 2 + HALO_PAD, y: height / 2 + HALO_PAD };
  const shaderTransform = useDerivedValue(() => [{ rotate: spin.get() * Math.PI * 2 }]);
  const colors = ["#F5C563", "#C98B95", "#FFE3A3", "#B76E79", "#F5C563"];
  const rect = { x: HALO_PAD, y: HALO_PAD, width, height };

  return (
    <Skia.Canvas
      pointerEvents="none"
      style={{ position: "absolute", left: -HALO_PAD, top: -HALO_PAD, width: width + HALO_PAD * 2, height: height + HALO_PAD * 2 }}
    >
      <Skia.RoundedRect {...rect} r={20} style="stroke" strokeWidth={7} opacity={0.55}>
        <Skia.SweepGradient c={center} colors={colors} origin={center} transform={shaderTransform} />
        <Skia.BlurMask blur={7} style="normal" />
      </Skia.RoundedRect>
      <Skia.RoundedRect {...rect} r={20} style="stroke" strokeWidth={2}>
        <Skia.SweepGradient c={center} colors={colors} origin={center} transform={shaderTransform} />
      </Skia.RoundedRect>
    </Skia.Canvas>
  );
}

function MeetingModal({
  visible,
  onClose,
  meeting,
  openDirections,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  meeting: Meeting;
  openDirections: () => void;
  theme: AppTheme;
}) {
  const { t, i18n } = useTranslation();
  const formattedDate = dayjs(meeting.meeting_datetime)
    .locale(i18n.language)
    .format("DD MMMM YYYY, dddd - HH:mm");

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{t("home.meeting.details")}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.close")} onPress={onClose} style={{ padding: 4 }}>
              <X color={theme.textSecondary} size={24} />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 16 }}>
            <View>
              <Text style={[styles.detailLabel, { color: theme.textMuted }]}>{t("home.meeting.titleLabel")}</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>{meeting.title || t("tabs.meetings.label")}</Text>
            </View>

            <View>
              <Text style={[styles.detailLabel, { color: theme.textMuted }]}>{t("home.meeting.dateTime")}</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>{formattedDate}</Text>
            </View>

            {meeting.location_name && (
              <View>
                <Text style={[styles.detailLabel, { color: theme.textMuted }]}>{t("home.meeting.location")}</Text>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}
                >
                  <MapPin color={theme.accent} size={16} />
                  <Text style={[styles.detailValue, { color: theme.text }]}>{meeting.location_name}</Text>
                </View>
              </View>
            )}

            {meeting.latitude && meeting.longitude && (
              <TouchableOpacity
                style={[styles.directionsBtn, { backgroundColor: "#22c55e" }]}
                onPress={openDirections}
              >
                <Navigation color="#fff" size={18} />
                <Text style={styles.directionsBtnText}>{t("common.getDirections")}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 0,
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
  },
  cardSpacing: {
    marginBottom: 18,
  },
  cardInGlow: {
    marginBottom: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  locationText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    marginTop: 1,
  },
  dateChip: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    fontFamily: "Inter_500Medium",
  },
  grid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  unitBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 0,
  },
  unitValue: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    fontVariant: ["tabular-nums"],
    lineHeight: 28,
  },
  // Kayan rakamın penceresi: giren ve çıkan rakam bu kutunun dışında görünmez
  rollingWindow: {
    height: 30,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  meetingDayRow: {
    alignItems: "flex-start",
    marginBottom: 12,
  },
  meetingDayPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  meetingDayText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  reunionWrap: {
    marginBottom: 18,
  },
  reunionCard: {
    alignItems: "center",
    marginBottom: 0,
    paddingTop: 16,
  },
  reunionCloseBtn: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  reunionInfoBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  reunionStage: {
    alignSelf: "stretch",
    height: REUNION_STAGE_H,
    marginHorizontal: 24,
    marginBottom: 10,
  },
  runner: {
    position: "absolute",
    left: 0,
    bottom: 0,
  },
  reunionHeart: {
    position: "absolute",
    top: 0,
  },
  reunionTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  reunionMeeting: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  reunionHint: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    marginTop: 10,
  },
  unitLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "rgba(255,255,255,0.45)",
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  detailLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    marginBottom: 4,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  directionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
  },
  directionsBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
