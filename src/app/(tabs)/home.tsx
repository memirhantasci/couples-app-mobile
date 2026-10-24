import React, { useCallback, useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prefetchCalendarData } from "@/hooks/useCalendarData";
import { prefetchMainScreens } from "@/lib/screenQueries";
import {
  dayjs,
  daysSince,
  dayOfYear,
  todayString,
} from "@/lib/date";
import { getQuoteForDay } from "@/lib/quotes";
import { MEETING_CELEBRATION_MINUTES, pickActiveMeeting, nextMeetingBoundary } from "@/lib/activeMeeting";
import { decrypt } from "@/utils/crypto";
import { computeLoveScore, getCachedLoveScore, getCachedLoveScoreSync, LoveScoreResult } from "@/lib/loveScore";
import { scheduleDateLocalNotification, cancelLocalNotification } from "@/lib/notifications";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { 
  AlignJustify, Sparkles, Heart, Images, 
  BookOpen, Mail, MapPin, Calendar, Flame, Clock, ChevronRight, X
} from "lucide-react-native";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";

import { useClockBucket } from "@/hooks/useClockBucket";
import { getGreeting, getSpecialDayState } from "@/lib/specialDays";
import { AnniversaryGlow } from "@/components/home/AnniversaryGlow";
import { LoveMeter } from "@/components/home/LoveMeter";
import { MoodSelector, MOODS } from "@/components/home/MoodSelector";
import { DailyNoteCard } from "@/components/home/DailyNoteCard";
import { MeetingCountdown, type Meeting } from "@/components/home/MeetingCountdown";
import { PendingLettersCard, PendingLettersBadge } from "@/components/home/PendingLettersCard";
import { useHomeSpotlightTour } from "@/hooks/useHomeSpotlightTour";
import { type SpotlightStep } from "@/components/tour/SpotlightTour";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { HOME_SPOTLIGHT_STEPS, type HomeSpotlightTargetId } from "@/constants/featureGuides";
import { DEMO_HOME_DATA, DEMO_LOVE_SCORE } from "@/constants/demoData";
import { computeCoupleWrapped, CoupleWrappedData } from "@/utils/wrappedCalculator";
import { syncCoupleWidget } from "@/utils/widgetBridge";
import { fetchWidgetUnread } from "@/lib/widgetUnread";
import { CoupleAvatarRing } from "@/components/home/CoupleAvatarRing";
import { useCoupleAvatars } from "@/hooks/useCoupleAvatars";
import { LazySpotlightTour, LazyCoupleWrappedModal } from "@/components/ui/lazyMount";

export default function HomeScreen() {
  const { session, profile, isDemoMode, exitDemoMode } = useAuth();
  const { theme, isLight } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const today = todayString();
  const doy = dayOfYear();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;
  const { myAvatarUrl, partnerAvatarUrl } = useCoupleAvatars();
  const queryClient = useQueryClient();
  const isPremium = (profile?.isPremium ?? false) || isDemoMode;
  const isFemale = profile?.gender === "female";
  const canSeePeriod = isFemale || isPremium;

  // 🚀 Arka planda Aşk Takvimi verilerini önceden önbelleğe al (Prefetch)
  // Böylece Takvim sekmesine basıldığında sıfır bekleme süresiyle (0ms) açılır
  useEffect(() => {
    if (coupleId || isDemoMode) {
      prefetchCalendarData(queryClient, {
        coupleId,
        userId,
        isPremium,
        canSeePeriod,
        isDemoMode,
      });
    }
  }, [queryClient, coupleId, userId, isPremium, canSeePeriod, isDemoMode]);

  // Ana sayfa çizildikten kısa süre sonra mektup / fotoğraf / anı / buluşma listelerinin ilk sayfasını arkadan indir:
  // sekmeye geçince ağ beklenmez. Ana sayfanın kendi sorgularıyla yarışmasın diye geciktirilir.
  useEffect(() => {
    if (!coupleId && !isDemoMode) return;
    const timer = setTimeout(() => {
      prefetchMainScreens(queryClient, { coupleId, userId, isPremium, isDemoMode });
    }, 1500);
    return () => clearTimeout(timer);
  }, [queryClient, coupleId, userId, isPremium, isDemoMode]);

  const [cachedScore, setCachedScore] = useState<LoveScoreResult | null>(null);
  const [isWrappedVisible, setIsWrappedVisible] = useState(false);
  const [wrappedData, setWrappedData] = useState<CoupleWrappedData | null>(null);
  const [showWrappedBanner, setShowWrappedBanner] = useState(false);
  // ─── Spotlight turu hedefleri ───
  const counterRef = useRef<View>(null);
  const shortcutsRef = useRef<View>(null);
  const moodRef = useRef<View>(null);
  const menuRef = useRef<View>(null);
  // Tek seferlik oluşturulur: SpotlightTour'a her render'da aynı dizi gider
  const [spotlightSteps] = useState<SpotlightStep[]>(() => {
    const targets: Record<HomeSpotlightTargetId, { ref: React.RefObject<View | null>; radius: number }> = {
      counter: { ref: counterRef, radius: 24 },
      shortcuts: { ref: shortcutsRef, radius: 18 },
      mood: { ref: moodRef, radius: 20 },
      menu: { ref: menuRef, radius: 21 },
    };
    return HOME_SPOTLIGHT_STEPS.map((s) => ({
      ...s,
      targetRef: targets[s.id].ref,
      radius: targets[s.id].radius,
    }));
  });

  const currentMonthKey = dayjs().format("YYYY_MM");
  const dayOfMonth = dayjs().date();
  const isWrappedPeriod = dayOfMonth >= 27 || dayOfMonth <= 5;

  useEffect(() => {
    if (coupleId && !isDemoMode) {
      getCachedLoveScore(coupleId).then((cached) => {
        if (cached) setCachedScore(cached);
      });
    }
  }, [coupleId, isDemoMode]);

  // Aylık Couple Wrapped: Sadece ayda bir kez (ayın 27'si ile takip eden ayın 5'i arası) ve kullanıcı kapatmadıysa göster
  // Dönem dışında banner render'da gizlenir (isWrappedPeriod); burada yalnızca dönemdeki durum okunur
  useEffect(() => {
    if (!isWrappedPeriod) return;

    AsyncStorage.getItem(`@wrapped_dismissed_${currentMonthKey}`).then((val) => {
      if (!val) {
        setShowWrappedBanner(true);
        computeCoupleWrapped(
          coupleId,
          profile?.relationshipStartDate || profile?.meetDate,
          isDemoMode
        ).then((data) => setWrappedData(data));
      } else {
        setShowWrappedBanner(false);
      }
    });
  }, [coupleId, profile?.relationshipStartDate, profile?.meetDate, isDemoMode, currentMonthKey, isWrappedPeriod]);

  const dismissWrappedBanner = async () => {
    setShowWrappedBanner(false);
    await AsyncStorage.setItem(`@wrapped_dismissed_${currentMonthKey}`, "true");
  };

  const { data: dashboardData, dataUpdatedAt, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["home_dashboard", coupleId, userId, today, isDemoMode],
    enabled: !!userId || isDemoMode,
    queryFn: async () => {
      if (isDemoMode) {
        return DEMO_HOME_DATA as any;
      }
      const [moodRes, noteRes, meetingRes, lettersRes, usersRes, partnerMoodRes] = await Promise.all([
        supabase
          .from("moods")
          .select("mood_type")
          .eq("user_id", userId)
          .eq("date", today)
          .maybeSingle(),
        supabase
          .from("daily_notes")
          .select("content")
          .eq("user_id", userId)
          .eq("date", today)
          .maybeSingle(),
        coupleId
          ? supabase
            .from("meetings")
            .select("id, meeting_datetime, title, location_name, latitude, longitude, user_id")
            .eq("couple_id", coupleId)
            .eq("is_active", true)
            .gte("meeting_datetime", dayjs().subtract(MEETING_CELEBRATION_MINUTES, "minute").toISOString())
            .order("meeting_datetime", { ascending: true })
            .limit(5)
          : Promise.resolve({ data: [] }),
        coupleId
          ? supabase
            .from("letters")
            .select("id, unlock_date, sender_id")
            .eq("couple_id", coupleId)
            .eq("receiver_id", userId)
            .gt("unlock_date", today)
            .order("unlock_date", { ascending: true })
          : Promise.resolve({ data: [] }),
        coupleId
          ? supabase
            .from("users")
            .select("id, username, display_name, gender")
            .eq("couple_id", coupleId)
          : Promise.resolve({ data: [] }),
        // Çift halkasında partnerin fotoğrafındaki canlı ruh hali rozeti
        coupleId && userId
          ? supabase
            .from("moods")
            .select("mood_type")
            .eq("couple_id", coupleId)
            .eq("date", today)
            .neq("user_id", userId)
            .limit(1)
          : Promise.resolve({ data: [] }),
      ]);

      const userMap = (usersRes.data || []).reduce((acc: any, u: any) => {
        acc[u.id] = u;
        return acc;
      }, {});

      const rawPartner = (usersRes.data || []).find((u: any) => u.id !== userId);
      const partner = rawPartner ? {
        id: rawPartner.id,
        gender: rawPartner.gender,
        display_name: rawPartner.display_name ?? null,
        username: rawPartner.username ?? "",
      } : null;

      return {
        currentMood: moodRes.data?.mood_type || null,
        partnerMood: (partnerMoodRes.data?.[0] as { mood_type?: string } | undefined)?.mood_type || null,
        currentNote: noteRes.data?.content ? decrypt(noteRes.data.content) : null,
        // Hangi buluşmanın kartta görüneceği render anında seçilir (zaman geçtikçe değişebilir)
        meetings: (meetingRes.data ?? []) as any[],
        partner,
        pendingLetters: (lettersRes.data || []).map((l: any) => ({
          ...l,
          sender: userMap[l.sender_id],
        })),
      };
    },
    // Partnerin ruh hali ve notu ana ekranda; kısa tutulur
    staleTime: 1000 * 60,
  });

  // ─── Dinamik Aşk Puanı (Çift için %100 simetrik ve adil) ─────────────────────
  const { data: loveScoreData, isLoading: isLoveScoreLoading } = useQuery({
    queryKey: ["love_score", coupleId, today, isDemoMode, profile?.isPremium],
    enabled: !!coupleId || isDemoMode,
    initialData: (coupleId ? getCachedLoveScoreSync(coupleId) : null) || cachedScore || undefined,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (isDemoMode) {
        return DEMO_LOVE_SCORE as any;
      }
      return computeLoveScore(coupleId!, userId, null, profile?.isPremium);
    },
  });

  // ─── Regl Yaklaşma Bildirimi (Sadece Premium Erkek İçin) ─────────────────────
  useEffect(() => {
    async function setupPeriodNotification() {
      // Erkek değilse veya partner yoksa gereksiz sorgu atmayı önle
      if (isDemoMode || !profile?.isPremium || !coupleId || !userId || profile?.gender !== "male") return;

      const partnerData = dashboardData?.partner;
      if (!partnerData || partnerData.gender !== "female") return;

      const cacheKey = `@period_notif_scheduled_${coupleId}`;
      const lastScheduledDate = await AsyncStorage.getItem(cacheKey);

      const { data: periodLogs } = await supabase
        .from("period_logs")
        .select("date")
        .eq("user_id", partnerData.id)
        .order("date", { ascending: false })
        .limit(1);

      if (periodLogs && periodLogs.length > 0) {
        const logDateStr = periodLogs[0].date;
        if (lastScheduledDate === logDateStr) {
          return; // Zaten bu döngü için bildirim zamanlandı
        }

        const lastPeriodDate = dayjs(logDateStr);
        const notifyDate = lastPeriodDate.add(26, "day").hour(10).minute(0).second(0).toDate();
        
        if (notifyDate.getTime() > Date.now()) {
          await scheduleDateLocalNotification(
            "period_approach_alert",
            "Özel Gün Yaklaşıyor 🌸",
            "Partnerinin regl dönemi 2 gün içinde başlayabilir. Ona biraz daha şefkat gösterme zamanı! 💕",
            notifyDate,
            {
              subtitle: "Döngü Takibi",
              color: "#FB7185",
              channelId: "partner_messages",
              data: { type: "period", route: "/(tabs)/period-tracker", actionLabel: "Döngü Takibine Git 🌸" },
            }
          );
          await AsyncStorage.setItem(cacheKey, logDateStr);
        }
      }
    }
    setupPeriodNotification();
  }, [profile?.isPremium, profile?.gender, coupleId, userId, dashboardData?.partner]);

  // Saat / gün değişince (ve uygulama öne gelince) selamlama ile özel gün durumu yeniden hesaplansın
  useClockBucket();

  const scrollContentStyle = useMemo(
    () => StyleSheet.flatten([
      styles.scrollContent,
      // Alt boşluk: yüzen gezinme çubuğu (64px + alt kenar boşluğu) + nefes payı
      { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 160 },
    ]),
    [insets.top, insets.bottom]
  );

  const meetDate = profile?.meetDate;
  const relDate = profile?.relationshipStartDate;
  // Demo modunda tarih bilgisi yoksa sayaçlar boş kalmasın diye gerçekçi örnek değerler gösterilir
  const DEMO_DAYS_TOGETHER = 365;
  const DEMO_DAYS_KNOWN = 428;
  const daysSinceMeeting = meetDate ? daysSince(dayjs(meetDate)) : isDemoMode ? DEMO_DAYS_KNOWN : 0;
  const daysSinceTogether = relDate ? daysSince(dayjs(relDate)) : isDemoMode ? DEMO_DAYS_TOGETHER : 0;
  const name = profile?.displayName || "Sevgilim";
  const partnerDisplayName =
    dashboardData?.partner?.display_name || dashboardData?.partner?.username || "Sevgilin";
  const quote = useMemo(() => getQuoteForDay(doy), [doy]);
  const activeLoveScore = isDemoMode 
    ? { score: 96, subtitle: "Kusursuz Bir Uyum! 💖" }
    : (loveScoreData || cachedScore);
  const loveMeter = activeLoveScore?.score;
  const loveSubtitle = activeLoveScore?.subtitle;
  const dateLabel = useMemo(() => dayjs().format("D MMMM, dddd"), []);

  // ─── Dinamik selamlama + özel günler (yıldönümüne ≤3 gün kala ve 14 Şubat'ta altın ışıltı) ───
  const nowDay = dayjs();
  const specialDay = getSpecialDayState(relDate, nowDay);
  const greeting = getGreeting(nowDay, specialDay, dashboardData?.currentMood);
  const captionColor = specialDay.glow ? (isLight ? "#B7791F" : "#F5C563") : theme.textSecondary;

  // ─── BULUŞMA KARTI ───
  // Seçim render anında yapılır: buluşma saati geçince sıradaki buluşmaya geçilir,
  // kutlama süresi (30 dk) dolunca kart kalkar; hiçbiri yeniden sorgu gerektirmez.
  // "Şimdi" render'da okunmaz: verinin geldiği an ile zamanlayıcının son uyandığı anın büyüğüdür.
  const [meetingClock, setMeetingClock] = useState(0);
  const meetingNow = Math.max(dataUpdatedAt, meetingClock);
  const activeMeeting = useMemo(
    () => pickActiveMeeting<Meeting>(dashboardData?.meetings, meetingNow),
    [dashboardData?.meetings, meetingNow]
  );

  useEffect(() => {
    const boundary = nextMeetingBoundary(dashboardData?.meetings, meetingNow);
    if (boundary === null) return;
    // Sınır geçmişte kaldıysa (ör. önbellekten gelen veri) hemen uyanır.
    // setTimeout üst sınırı ~24.8 gün; daha uzaksa sınırda uyanıp yeniden planlanır.
    const delay = Math.min(Math.max(0, boundary - Date.now() + 250), 2147483647);
    const timer = setTimeout(() => setMeetingClock(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [dashboardData?.meetings, meetingNow]);

  // ─── ANA EKRAN WIDGET SENKRONİZASYONU ───
  // Gün sayısı widget içinde hesaplanır; buradan yalnızca tarih, isimler, partnerin bugünkü ruh hali,
  // profil fotoğrafları ve okunmamış sayısı gider. Özel günlük notu ve mektup içerikleri gizlilik
  // gereği widget'a ASLA gönderilmez.
  const partnerMoodEmoji: string | null = dashboardData?.partnerMood ?? null;
  const partnerMoodLabel = partnerMoodEmoji
    ? MOODS.find((m) => m.emoji === partnerMoodEmoji)?.label ?? null
    : null;
  const isPremiumActive = !!profile?.isPremium;
  const premiumExpiresAt = profile?.premiumExpiresAt ?? null;
  const hasDashboard = !!dashboardData;
  useEffect(() => {
    // Demo oturumunda gerçek bir çift yok: widget'a hiçbir şey gönderilmez
    if (isDemoMode || !hasDashboard) return;
    let cancelled = false;
    // Okunmamış rozeti yalnızca Premium widget'ta görünür; ücretsiz kullanıcı için sorgulanmaz.
    // Pano her yenilendiğinde (dataUpdatedAt) yeniden sayılır.
    const unreadPromise =
      isPremiumActive && userId && coupleId ? fetchWidgetUnread(userId, coupleId) : Promise.resolve(null);
    unreadPromise.then((unread) => {
      if (cancelled) return;
      syncCoupleWidget({
        isPremium: isPremiumActive,
        premiumExpiresAt,
        myName: profile?.displayName,
        partnerName: partnerDisplayName,
        startDate: relDate || meetDate || null,
        partnerMoodEmoji,
        partnerMoodLabel,
        myAvatarUrl,
        partnerAvatarUrl,
        unreadCount: unread?.unreadCount ?? 0,
        letterUnlocksMs: unread?.letterUnlocksMs ?? [],
      });
    });
    return () => {
      cancelled = true;
    };
  }, [
    isDemoMode,
    hasDashboard,
    dataUpdatedAt,
    userId,
    coupleId,
    isPremiumActive,
    premiumExpiresAt,
    profile?.displayName,
    partnerDisplayName,
    relDate,
    meetDate,
    partnerMoodEmoji,
    partnerMoodLabel,
    myAvatarUrl,
    partnerAvatarUrl,
  ]);

  // ─── SPOTLIGHT TURU ───
  // Eşleşme sonrası ilk Ana Sayfa ziyaretinde bir kez otomatik başlar; demo/misafir modunda asla.
  const {
    isVisible: isSpotlightVisible,
    start: startSpotlight,
    close: closeSpotlight,
  } = useHomeSpotlightTour({
    canAutoStart: !isDemoMode && !!session && !!dashboardData && !isWrappedVisible,
  });

  if ((!session && !isDemoMode) || (!dashboardData && isLoading && !isDemoMode)) {
    return (
      <ScreenBackground style={{ paddingTop: insets.top + 20, paddingHorizontal: 20 }}>
        <Skeleton height={80} borderRadius={20} style={{ marginBottom: 16 }} />
        <Skeleton height={140} borderRadius={24} style={{ marginBottom: 14 }} />
        <Skeleton height={90} borderRadius={20} style={{ marginBottom: 14 }} />
        <Skeleton height={120} borderRadius={20} style={{ marginBottom: 14 }} />
        <Skeleton height={140} borderRadius={20} style={{ marginBottom: 14 }} />
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      {/* Günlük Not kartı sayfanın en altında: klavye açılınca not alanı ve Kaydet butonu (iOS + Android) görünür kalır */}
      <View style={{ flex: 1 }}>
        <KeyboardAwareScrollView
          enableOnAndroid
          extraScrollHeight={80}
          keyboardShouldPersistTaps="handled"
          style={{ flex: 1 }}
          // Düz nesne olmalı: react-native-keyboard-aware-scroll-view Android'de (enableOnAndroid)
          // dizi stilindeki paddingBottom'u okuyamayıp sıfırlıyordu; son kart gezinme çubuğunun altında kalıyordu.
          contentContainerStyle={scrollContentStyle}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ─── 1. MODERN HEADER ─── */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1, marginRight: 10, minWidth: 0 }}>
              <View style={[styles.greetingRow, { flexShrink: 1 }]}>
                <Text 
                  style={[styles.greetingText, { color: theme.text, flexShrink: 1 }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {greeting.text}, {name}
                </Text>
                {greeting.emoji ? (
                  <Text style={[styles.greetingEmoji, { flexShrink: 0 }]}>{greeting.emoji}</Text>
                ) : null}
              </View>
              <View style={styles.dateBadgeRow}>
                <Calendar size={13} color={theme.textMuted} />
                <Text style={[styles.dateLabel, { color: theme.textMuted }]}>{dateLabel}</Text>
              </View>
              {greeting.caption ? (
                <Text
                  style={[styles.captionText, { color: captionColor }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {greeting.caption}
                </Text>
              ) : null}
            </View>

            <View
              ref={menuRef}
              collapsable={false}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 }}
            >
              <TourGuideButton onPress={startSpotlight} />
              <TouchableOpacity 
                accessibilityRole="button"
                accessibilityLabel="Menüyü aç"
                onPress={() => router.push("/menu")} 
                style={[
                  styles.menuBtn, 
                  { 
                    backgroundColor: isLight ? "rgba(0,0,0,0.05)" : theme.cardBg, 
                    borderColor: theme.cardBorder 
                  }
                ]}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <AlignJustify color={theme.textSecondary} size={20} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Misafir (demo) oturumu: gördüğü verilerin örnek olduğunu ve nasıl gerçek hesaba geçeceğini her zaman göster */}
          {isDemoMode ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                exitDemoMode();
                router.replace({ pathname: "/(auth)/login", params: { initialMode: "register" } });
              }}
              style={[styles.demoRibbon, { backgroundColor: theme.pillAccentBg, borderColor: theme.cardBorder }]}
              accessibilityRole="button"
              accessibilityLabel="Demo moddasın. Ücretsiz kayıt olmak veya giriş yapmak için dokun"
            >
              <Sparkles size={14} color={theme.accent} />
              <Text style={[styles.demoRibbonText, { color: theme.text }]} numberOfLines={2}>
                Örnek verilerle geziyorsun. Kendi hesabını açmak için dokun
              </Text>
              <ChevronRight size={14} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}

          {/* ─── 1.1 BEKLEYEN MEKTUP BİLDİRİMİ (varsa) ─── */}
          <PendingLettersBadge letters={dashboardData?.pendingLetters} theme={theme} />

          {/* ─── 2. HERO İLİŞKİ SAYACI KARTI ─── */}
          {/* Yıldönümüne ≤3 gün kala ve 14 Şubat'ta kartın etrafında altın ışıltı; kart (counterRef) aynı kalır */}
          <AnniversaryGlow active={specialDay.glow} radius={24} isLight={isLight}>
          <View
            ref={counterRef}
            collapsable={false}
            style={[styles.heroLoveCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}
          >
            <View style={styles.heroTopRow}>
              <View style={[styles.heroTopBadge, { backgroundColor: theme.pillAccentBg }]}>
                <Heart size={13} color={theme.accent} fill={theme.accent} />
                <Text style={[styles.heroTopBadgeText, { color: theme.accent }]}>
                  AŞKIMIZIN YOLCULUĞU
                </Text>
              </View>
              <CoupleAvatarRing
                myName={profile?.displayName}
                partnerName={partnerDisplayName}
                myAvatarUrl={myAvatarUrl}
                partnerAvatarUrl={partnerAvatarUrl}
                partnerMoodEmoji={dashboardData?.partnerMood}
              />
            </View>

            <View style={styles.countersRow}>
              {/* Sevgililik Sayacı */}
              <View style={[styles.counterBox, { backgroundColor: theme.unitBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
                <View style={[styles.counterIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                  <Heart size={16} color={theme.accent} fill={theme.accent} />
                </View>
                <Text style={[styles.counterNumber, { color: theme.text }]}>{relDate || isDemoMode ? daysSinceTogether : "—"}</Text>
                <Text style={[styles.counterDesc, { color: theme.textSecondary }]}>Gündür Sevgiliyiz</Text>
              </View>

              {/* Tanışma Sayacı */}
              <View style={[styles.counterBox, { backgroundColor: theme.unitBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
                <View style={[styles.counterIconCircle, { backgroundColor: isLight ? "rgba(255, 215, 0, 0.15)" : "rgba(255,255,255,0.06)" }]}>
                  <Sparkles size={16} color={isLight ? "#B7791F" : "#ffd700"} />
                </View>
                <Text style={[styles.counterNumber, { color: theme.text }]}>{meetDate || isDemoMode ? daysSinceMeeting : "—"}</Text>
                <Text style={[styles.counterDesc, { color: theme.textSecondary }]}>Gündür Hayatımdasın</Text>
              </View>
            </View>
          </View>
          </AnniversaryGlow>

          {/* ─── 3. HIZLI ERİŞİM KISAYOLLARI (QUICK ACTIONS) ─── */}
          <View ref={shortcutsRef} collapsable={false} style={styles.quickActionsContainer}>
            <TouchableOpacity 
              style={[styles.actionPill, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}
              onPress={() => router.push("/(tabs)/photos")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Images size={17} color={theme.accent} />
              </View>
              <Text style={[styles.actionPillText, { color: theme.textSecondary }]}>Galeri</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionPill, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}
              onPress={() => router.push("/(tabs)/daily-notes")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <BookOpen size={17} color={theme.accent} />
              </View>
              <Text style={[styles.actionPillText, { color: theme.textSecondary }]}>Günlüğüm</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionPill, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}
              onPress={() => router.push("/(tabs)/letters")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Mail size={17} color={theme.accent} />
              </View>
              <Text style={[styles.actionPillText, { color: theme.textSecondary }]}>Mektuplar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionPill, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}
              onPress={() => router.push("/(tabs)/meetings")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <MapPin size={17} color={theme.accent} />
              </View>
              <Text style={[styles.actionPillText, { color: theme.textSecondary }]}>Buluşma</Text>
            </TouchableOpacity>
          </View>

          {/* ─── 4. MOD SEÇİMİ (günlük ana aksiyon: kısayolların hemen altında, ilk ekranda görünür) ─── */}
          <View ref={moodRef} collapsable={false}>
            <MoodSelector
              currentMood={dashboardData?.currentMood}
              theme={theme}
            />
          </View>

          {/* ─── 5. GÜNÜN SÖZÜ ─── */}
          <View style={[styles.quoteCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
            <View style={styles.quoteHeaderRow}>
              <View style={[styles.quoteStarCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Sparkles size={14} color={theme.accent} />
              </View>
              <Text style={[styles.quoteTitle, { color: theme.accent }]}>GÜNÜN İLHAMI</Text>
            </View>
            <Text style={[styles.quoteText, { color: theme.text }]}>“{quote}”</Text>
          </View>

          {/* ─── 6. AŞK ÖLÇER ─── */}
          <LoveMeter 
            value={loveMeter} 
            theme={theme} 
            subtitle={loveSubtitle} 
            isLoading={!activeLoveScore && isLoveScoreLoading} 
          />

          {/* ─── COUPLE WRAPPED BANNER (Ayda 1 Kez Dönemsel) ─── */}
          {showWrappedBanner && isWrappedPeriod && (
            <TouchableOpacity
              style={[styles.wrappedBanner, { borderColor: "rgba(255, 77, 109, 0.35)" }]}
              onPress={() => setIsWrappedVisible(true)}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={["#2A0E1F", "#170B18"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.wrappedGradient}
              >
                <View style={styles.wrappedLeft}>
                  <View style={styles.wrappedIconBadge}>
                    <Sparkles size={16} color="#FF4D6D" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wrappedTitle}>Aylık Wrapped Hazır! ✨</Text>
                    <Text style={styles.wrappedSub}>Aşk özetini ve anılarınızı keşfedin</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={styles.wrappedArrowCircle}>
                    <ChevronRight size={18} color="#FF8FA3" />
                  </View>
                  <TouchableOpacity
                    onPress={dismissWrappedBanner}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ padding: 4 }}
                  >
                    <X size={16} color="rgba(255,255,255,0.6)" />
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* ─── 7. BULUŞMA GERİ SAYIMI ─── */}
          {activeMeeting && (
            // key: farklı/güncellenen buluşmada geri sayım durumu (ör. "gerçekleşti") sıfırdan başlasın
            <MeetingCountdown
              key={`${activeMeeting.id}-${activeMeeting.meeting_datetime}`}
              meeting={activeMeeting}
              theme={theme}
            />
          )}

          {/* ─── 8. GÜNLÜK NOT ─── */}
          <DailyNoteCard existingNote={dashboardData?.currentNote} theme={theme} />

          {/* ─── 9. BEKLEYEN MEKTUPLAR ─── */}
          <PendingLettersCard letters={dashboardData?.pendingLetters || []} theme={theme} />
        </KeyboardAwareScrollView>
      </View>
      <LazySpotlightTour visible={isSpotlightVisible} steps={spotlightSteps} onClose={closeSpotlight} />
      <LazyCoupleWrappedModal
        visible={isWrappedVisible}
        onClose={() => setIsWrappedVisible(false)}
        data={wrappedData}
        partnerName={name}
        theme={theme}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14,
  },

  // ─── Couple Wrapped Banner ─────────────────────────────────────────────
  wrappedBanner: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#FF4D6D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  wrappedGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  wrappedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  wrappedIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 77, 109, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  wrappedTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  wrappedSub: {
    color: "rgba(255, 255, 255, 0.65)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  wrappedArrowCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    justifyContent: "center",
    alignItems: "center",
  },

  // ─── Header ────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  greetingText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  greetingEmoji: {
    fontSize: 22,
  },
  dateBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  dateLabel: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  captionText: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
    marginTop: 5,
  },
  menuBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── Hero Aşk Sayacı ───────────────────────────────────────────────────
  heroLoveCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },
  heroTopBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    flexShrink: 1,
  },
  heroTopBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  countersRow: {
    flexDirection: "row",
    gap: 12,
  },
  counterBox: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  counterIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  counterNumber: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  counterDesc: {
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
    textAlign: "center",
  },

  // ─── Hızlı Erişim Kısayolları ──────────────────────────────────────────
  quickActionsContainer: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  actionPill: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
  },
  actionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPillText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)",
  },

  // ─── Günün Sözü ────────────────────────────────────────────────────────
  quoteCard: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
  },
  quoteHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  quoteStarCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  quoteTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  quoteText: {
    fontSize: 14.5,
    lineHeight: 22,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.9)",
    fontStyle: "italic",
  },
  demoRibbon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  demoRibbonText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
});
