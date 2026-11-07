import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import { estimateCycleLength, getPeriodStarts } from "@/lib/periodCycle";
import { getQuoteForDay } from "@/lib/quotes";
import {
  MEETING_CELEBRATION_HOURS,
  celebrationCandidate,
  pickActiveMeeting,
  nextMeetingBoundary,
  isMeetingCelebrationSeen,
  markMeetingCelebrationSeen,
} from "@/lib/activeMeeting";
import { decrypt } from "@/utils/crypto";
import { computeLoveScore, getCachedLoveScore, getCachedLoveScoreSync, LoveScoreResult , getLoveScoreSubtitle } from "@/lib/loveScore";
import { scheduleDateLocalNotification } from "@/lib/notifications";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { AlignJustify, Sparkles, Heart, Images, BookOpen, Mail, MapPin, Calendar, ChevronRight, X } from "lucide-react-native";
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
import { PendingLettersBadge } from "@/components/home/PendingLettersCard";
import { StarHibernationCard } from "@/components/home/StarHibernationCard";
import { useCoupleStarSummary } from "@/hooks/useCoupleStarSummary";
import { derivePremiumPhase } from "@/lib/premiumStatus";
import { useHomeSpotlightTour } from "@/hooks/useHomeSpotlightTour";
import { type SpotlightStep } from "@/components/tour/SpotlightTour";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { Reveal } from "@/components/ui/Reveal";
import { Pulse } from "@/components/ui/Pulse";
import { CountUp } from "@/components/ui/CountUp";
import { getHomeSpotlightSteps, type HomeSpotlightTargetId } from "@/constants/featureGuides";
import { DEMO_HOME_DATA, DEMO_LOVE_SCORE } from "@/constants/demoData";
import {
  computeCoupleWrapped,
  CoupleWrappedData,
  hasWrappedActivity,
  isAccountOldEnoughForWrapped,
} from "@/utils/wrappedCalculator";
import { syncCoupleWidget } from "@/utils/widgetBridge";
import { fetchWidgetUnread } from "@/lib/widgetUnread";
import { CoupleAvatarRing } from "@/components/home/CoupleAvatarRing";
import { useCoupleAvatars } from "@/hooks/useCoupleAvatars";
import { LazySpotlightTour, LazyCoupleWrappedModal, LazyPremiumPaywall, LazyStellarHibernationModal } from "@/components/ui/lazyMount";
import { useTranslation } from "react-i18next";
import { istanbulToday } from "@/lib/letterPolicy";

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
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

  // Kış uykusu: Premium'u biten çiftin yıldızı 14 gün koordinatında uyur; gökyüzüne girmeyen çift de görsün diye
  // ana sayfada kalan günle birlikte sakin bir kart çıkar. Yıldızı olmayan çifte (uyuyacak yıldız yok) gösterilmez.
  const starSummary = useCoupleStarSummary();
  const hibernation = useMemo(
    () =>
      derivePremiumPhase({
        isPremium: profile?.isPremium ?? false,
        premiumExpiresAt: profile?.premiumExpiresAt,
        graceUntil: profile?.graceUntil,
      }),
    [profile?.isPremium, profile?.premiumExpiresAt, profile?.graceUntil]
  );
  const isStarHibernating = !isDemoMode && hibernation.phase === "grace" && starSummary !== null;
  const [isHibernationOpen, setIsHibernationOpen] = useState(false);
  const [isHibernationPaywallOpen, setIsHibernationPaywallOpen] = useState(false);
  const handleWakeStar = useCallback(() => {
    setIsHibernationOpen(false);
    setIsHibernationPaywallOpen(true);
  }, []);

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
      prefetchMainScreens(queryClient, { coupleId, userId, isDemoMode });
    }, 1500);
    return () => clearTimeout(timer);
  }, [queryClient, coupleId, userId, isDemoMode]);

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
  const spotlightSteps = useMemo<SpotlightStep[]>(() => {
    const targets: Record<HomeSpotlightTargetId, { ref: React.RefObject<View | null>; radius: number }> = {
      counter: { ref: counterRef, radius: 24 },
      shortcuts: { ref: shortcutsRef, radius: 18 },
      mood: { ref: moodRef, radius: 20 },
      menu: { ref: menuRef, radius: 21 },
    };
    return getHomeSpotlightSteps(t).map((s) => ({
      ...s,
      targetRef: targets[s.id].ref,
      radius: targets[s.id].radius,
    }));
  }, [t]);

  const dayOfMonth = dayjs().date();
  const isWrappedPeriod = dayOfMonth >= 27 || dayOfMonth <= 5;
  // Ayın 1–5'inde özet, yeni başlayan ayı değil biten ayı anlatır; kapatma bilgisi de o aya aittir
  const wrappedMonthsBack = dayOfMonth <= 5 ? 1 : 0;
  const currentMonthKey = dayjs().subtract(wrappedMonthsBack, "month").format("YYYY_MM");

  useEffect(() => {
    if (coupleId && !isDemoMode) {
      getCachedLoveScore(coupleId).then((cached) => {
        if (cached) setCachedScore(cached);
      });
    }
  }, [coupleId, isDemoMode]);

  // Aylık Couple Wrapped: Sadece ayda bir kez (ayın 27'si ile takip eden ayın 5'i arası) ve kullanıcı kapatmadıysa göster
  // Dönem dışında banner render'da gizlenir (isWrappedPeriod); burada yalnızca dönemdeki durum okunur
  // Yeni hesaplara (misafir demo hariç) ve özetlenecek hiçbir şeyi olmayan aya gösterilmez
  const isWrappedAccountEligible = isDemoMode || isAccountOldEnoughForWrapped(session?.user?.created_at);
  useEffect(() => {
    // Dönem dışında ya da uygun olmayan hesapta banner render'da gizlenir
    if (!isWrappedPeriod || !isWrappedAccountEligible) return;

    let cancelled = false;
    AsyncStorage.getItem(`@wrapped_dismissed_${currentMonthKey}`).then((val) => {
      if (cancelled) return;
      if (val) {
        setShowWrappedBanner(false);
        return;
      }
      computeCoupleWrapped(
        coupleId,
        profile?.relationshipStartDate || profile?.meetDate,
        isDemoMode,
        "month",
        dayjs().subtract(wrappedMonthsBack, "month")
      )
        .then((data) => {
          if (cancelled) return;
          setWrappedData(data);
          setShowWrappedBanner(hasWrappedActivity(data));
        })
        // Hesaplanamadıysa uydurma sayılar gösterilmez: kart bu ay gizlenir
        .catch(() => {
          if (!cancelled) setShowWrappedBanner(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [
    coupleId,
    profile?.relationshipStartDate,
    profile?.meetDate,
    isDemoMode,
    currentMonthKey,
    wrappedMonthsBack,
    isWrappedPeriod,
    isWrappedAccountEligible,
  ]);

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
            .gte("meeting_datetime", dayjs().subtract(MEETING_CELEBRATION_HOURS, "hour").toISOString())
            .order("meeting_datetime", { ascending: true })
            .limit(10)
          : Promise.resolve({ data: [] }),
        coupleId
          ? supabase
            .from("letters")
            .select("id, unlock_date, sender_id")
            .eq("couple_id", coupleId)
            .eq("receiver_id", userId)
            // Sunucu mektubu unlock_date gününün 00:00'ında (Türkiye saati) açar (bkz. letterUnlockAt); "bugün" de
            // sunucudaki public.app_today() gibi Türkiye gününe göre alınır, cihaz saat diliminden etkilenmez.
            .gt("unlock_date", istanbulToday())
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
            .select("mood_type, date")
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
        partnerMoodDate: (partnerMoodRes.data?.[0] as { date?: string } | undefined)?.date || null,
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
    enabled: (!!coupleId && !profile?.isSolo) || isDemoMode,
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
        .limit(14);

      if (periodLogs && periodLogs.length > 0) {
        // Döngü ekranıyla aynı hesap: son başlangıç + tahmini döngü uzunluğu (sabit 28 gün varsayılmaz)
        const starts = getPeriodStarts(periodLogs.map((log) => log.date));
        const logDateStr = starts[starts.length - 1];
        const cycleLength = estimateCycleLength(starts);
        // Damga başlangıç + döngü + dil: bunlardan biri değişince bildirim yeniden kurulur
        const scheduleStamp = `${logDateStr}|${cycleLength}|${i18n.language}`;
        if (lastScheduledDate === scheduleStamp) {
          return; // Zaten bu döngü için bildirim zamanlandı
        }

        const lastPeriodDate = dayjs(logDateStr);
        // Bildirim metni "2 gün içinde": beklenen başlangıçtan 2 gün önce, sabah 10:00
        const notifyDate = lastPeriodDate.add(cycleLength - 2, "day").hour(10).minute(0).second(0).toDate();
        
        if (notifyDate.getTime() > Date.now()) {
          const scheduled = await scheduleDateLocalNotification(
            "period_approach_alert",
            t("home.periodAlert.title"),
            t("home.periodAlert.body"),
            notifyDate,
            {
              subtitle: t("notifications.labels.cycleTracking"),
              color: "#FB7185",
              channelId: "partner_messages",
              data: { type: "period", route: "/(tabs)/period-tracker", actionLabel: t("notifications.actions.goToCycle") },
            }
          );
          // Bildirim izni kapalıysa damga yazılmaz: izin sonradan açılınca bildirim yeniden kurulabilsin
          if (scheduled) await AsyncStorage.setItem(cacheKey, scheduleStamp);
        }
      }
    }
    setupPeriodNotification();
  }, [profile?.isPremium, profile?.gender, coupleId, userId, dashboardData?.partner, i18n.language, t]);

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
  const name = profile?.displayName || t("greetings.myLoveFallback");
  const partnerDisplayName =
    dashboardData?.partner?.display_name || dashboardData?.partner?.username || t("common.partnerFallback");
  const quote = useMemo(() => getQuoteForDay(doy, t), [doy, t]);
  // Tek kalınca (partner hesabını sildi) aşk ölçer yeni eşleşmeye kadar 0; sunucu da yalnızca eşleşme
  // anından sonraki etkinliği sayar (get_couple_love_activity)
  const isSolo = !isDemoMode && !!profile?.isSolo;
  const activeLoveScore = isDemoMode
    ? { score: 96 }
    : isSolo
      ? { score: 0 }
      : (loveScoreData || cachedScore);
  const loveMeter = activeLoveScore?.score;
  const loveSubtitle = isDemoMode
    ? t("home.loveMeter.demoSubtitle")
    : isSolo
      ? t("solo.loveMeterSubtitle")
      : loveMeter !== undefined
        ? getLoveScoreSubtitle(loveMeter, t)
        : undefined;
  const dateLabel = useMemo(() => dayjs().locale(i18n.language).format("D MMMM, dddd"), [i18n.language]);

  // ─── Dinamik selamlama + özel günler (yıldönümüne ≤3 gün kala ve 14 Şubat'ta altın ışıltı) ───
  const nowDay = dayjs();
  const specialDay = getSpecialDayState(relDate, nowDay);
  const greeting = getGreeting(nowDay, specialDay, t, dashboardData?.currentMood);
  const captionColor = specialDay.glow ? (isLight ? "#B7791F" : "#F5C563") : theme.textSecondary;

  // ─── BULUŞMA KARTI ───
  // Seçim render anında yapılır: buluşma saati geçince kart kavuşma kutlamasına döner ve kutlama sıradaki
  // (ya da yeni planlanan) buluşma olsa bile yarıda kesilmez; kullanıcı konfetiyi patlatınca ya da kartı
  // kapatınca, ya da 24 saatlik süre dolunca kart sıradaki buluşmaya geçer.
  const [meetingClock, setMeetingClock] = useState(0);
  const [seenCelebrationIds, setSeenCelebrationIds] = useState<Set<number | string>>(new Set());
  const [seenLoaded, setSeenLoaded] = useState(false);

  // Buluşmalar listesi geldikçe bu cihazda daha önce kutlanmış olanları AsyncStorage'dan yükle
  useEffect(() => {
    const meetings = dashboardData?.meetings;
    if (!meetings || meetings.length === 0) return;

    let active = true;
    (async () => {
      const seen = new Set<number | string>();
      for (const m of meetings) {
        if (m.id != null) {
          const isSeen = await isMeetingCelebrationSeen(m.id);
          if (isSeen) seen.add(m.id);
        }
      }
      if (active) {
        setSeenCelebrationIds(seen);
        setSeenLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [dashboardData?.meetings]);

  const handleMeetingCelebrated = useCallback((meetingId: number | string) => {
    markMeetingCelebrationSeen(meetingId);
    setSeenCelebrationIds((prev) => {
      const next = new Set(prev);
      next.add(meetingId);
      return next;
    });
  }, []);

  const meetingNow = Math.max(dataUpdatedAt, meetingClock);
  const activeMeeting = useMemo(() => {
    // Kutlama bekleyen bir buluşma varsa kart, görüldü kayıtları okunana kadar bekler: yoksa daha önce
    // kutlanmış bir buluşma açılışta bir an kutlama kartı olarak yanıp sönerdi
    if (!seenLoaded && celebrationCandidate(dashboardData?.meetings, meetingNow)) return null;
    return pickActiveMeeting<Meeting>(dashboardData?.meetings, meetingNow, seenCelebrationIds);
  }, [dashboardData?.meetings, meetingNow, seenCelebrationIds, seenLoaded]);

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
    ? (() => {
        const mood = MOODS.find((m) => m.emoji === partnerMoodEmoji);
        return mood ? t(mood.labelKey) : null;
      })()
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
        partnerMoodDate: dashboardData?.partnerMoodDate ?? (partnerMoodEmoji ? today : null),
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
    // Dil değişince widget metinleri yeni dilde yeniden gönderilir
    i18n.language,
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
                accessibilityLabel={t("common.openMenu")}
                onPress={() => router.push("/menu")} 
                style={[
                  styles.menuBtn, 
                  { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)" }
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
              style={[styles.demoRibbon, { backgroundColor: theme.pillAccentBg }]}
              accessibilityRole="button"
              accessibilityLabel={t("home.demoRibbon.a11y")}
            >
              <Sparkles size={14} color={theme.accent} />
              <Text style={[styles.demoRibbonText, { color: theme.text }]} numberOfLines={2}>
                {t("home.demoRibbon.text")}
              </Text>
              <ChevronRight size={14} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}

          {/* ─── 1.1 BEKLEYEN MEKTUP BİLDİRİMİ (varsa) ─── */}
          <PendingLettersBadge letters={dashboardData?.pendingLetters} theme={theme} />

          {/* ─── 2. HERO İLİŞKİ SAYACI KARTI ─── */}
          {/* Yıldönümüne ≤3 gün kala ve 14 Şubat'ta kartın etrafında altın ışıltı; kart (counterRef) aynı kalır */}
          <Reveal scope="home" index={1}>
          <AnniversaryGlow active={specialDay.glow} radius={24} isLight={isLight}>
          <View
            ref={counterRef}
            collapsable={false}
            style={[styles.heroLoveCard, { backgroundColor: theme.cardBg, ...theme.cardShadow }]}
          >
            <LinearGradient
              pointerEvents="none"
              colors={[`${theme.accent}40`, `${theme.accent}00`]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.8 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroTopRow}>
              <View style={[styles.heroTopBadge, { backgroundColor: theme.pillAccentBg }]}>
                <Pulse>
                  <Heart size={13} color={theme.accent} fill={theme.accent} />
                </Pulse>
                <Text style={[styles.heroTopBadgeText, { color: theme.accent }]}>
                  {t("home.journeyTitle")}
                </Text>
              </View>
              <CoupleAvatarRing
                myName={profile?.displayName}
                partnerName={partnerDisplayName}
                myAvatarUrl={myAvatarUrl}
                partnerAvatarUrl={partnerAvatarUrl}
                partnerMoodEmoji={dashboardData?.partnerMood}
                interactive
              />
            </View>

            <View style={styles.countersRow}>
              {/* Sevgililik Sayacı */}
              <View style={[styles.counterBox, { backgroundColor: isLight ? "rgba(0,0,0,0.045)" : "rgba(255,255,255,0.07)" }]}>
                <View style={[styles.counterIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                  <Heart size={16} color={theme.accent} fill={theme.accent} />
                </View>
                {relDate || isDemoMode ? (
                  <CountUp value={daysSinceTogether} style={[styles.counterNumber, { color: theme.text }]} />
                ) : (
                  <Text style={[styles.counterNumber, { color: theme.text }]}>—</Text>
                )}
                <Text style={[styles.counterDesc, { color: theme.textSecondary }]}>{t("home.counters.together")}</Text>
              </View>

              {/* Tanışma Sayacı */}
              <View style={[styles.counterBox, { backgroundColor: isLight ? "rgba(0,0,0,0.045)" : "rgba(255,255,255,0.07)" }]}>
                <View style={[styles.counterIconCircle, { backgroundColor: isLight ? "rgba(230, 192, 85, 0.15)" : "rgba(255,255,255,0.06)" }]}>
                  <Sparkles size={16} color={isLight ? "#B7791F" : "#E6C055"} />
                </View>
                {meetDate || isDemoMode ? (
                  <CountUp value={daysSinceMeeting} style={[styles.counterNumber, { color: theme.text }]} />
                ) : (
                  <Text style={[styles.counterNumber, { color: theme.text }]}>—</Text>
                )}
                <Text style={[styles.counterDesc, { color: theme.textSecondary }]}>{t("home.counters.inMyLife")}</Text>
              </View>
            </View>
          </View>
          </AnniversaryGlow>
          </Reveal>

          {/* ─── 3. HIZLI ERİŞİM KISAYOLLARI (QUICK ACTIONS) ─── */}
          <Reveal scope="home" index={2}>
          <View ref={shortcutsRef} collapsable={false} style={styles.quickActionsContainer}>
            <TouchableOpacity 
              style={[styles.actionPill, { backgroundColor: theme.cardBg, ...theme.cardShadow }]}
              onPress={() => router.push("/(tabs)/photos")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Images size={17} color={theme.accent} />
              </View>
              <Text style={[styles.actionPillText, { color: theme.textSecondary }]}>{t("tabs.photos.label")}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionPill, { backgroundColor: theme.cardBg, ...theme.cardShadow }]}
              onPress={() => router.push("/(tabs)/daily-notes")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <BookOpen size={17} color={theme.accent} />
              </View>
              <Text style={[styles.actionPillText, { color: theme.textSecondary }]}>{t("menu.journal.title")}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionPill, { backgroundColor: theme.cardBg, ...theme.cardShadow }]}
              onPress={() => router.push("/(tabs)/letters")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Mail size={17} color={theme.accent} />
              </View>
              <Text style={[styles.actionPillText, { color: theme.textSecondary }]}>{t("tabs.letters.label")}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionPill, { backgroundColor: theme.cardBg, ...theme.cardShadow }]}
              onPress={() => router.push("/(tabs)/meetings")}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <MapPin size={17} color={theme.accent} />
              </View>
              <Text style={[styles.actionPillText, { color: theme.textSecondary }]}>{t("tabs.meetings.label")}</Text>
            </TouchableOpacity>
          </View>
          </Reveal>

          {/* ─── 4. MOD SEÇİMİ (günlük ana aksiyon: kısayolların hemen altında, ilk ekranda görünür) ─── */}
          <Reveal scope="home" index={3}>
            <View ref={moodRef} collapsable={false}>
              <MoodSelector
                currentMood={dashboardData?.currentMood}
                theme={theme}
              />
            </View>
          </Reveal>

          {/* ─── 4b. YILDIZ KIŞ UYKUSUNDA (yalnızca Premium bitmiş, yıldızı olan çiftte) ─── */}
          {isStarHibernating && (
            <Reveal scope="home" index={4}>
              <StarHibernationCard daysLeft={hibernation.graceDaysLeft} onPress={() => setIsHibernationOpen(true)} />
            </Reveal>
          )}

          {/* ─── 5. GÜNÜN SÖZÜ ─── */}
          <View style={[styles.quoteCard, { backgroundColor: theme.cardBg, ...theme.cardShadow }]}>
            <View style={styles.quoteHeaderRow}>
              <View style={[styles.quoteStarCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Sparkles size={14} color={theme.accent} />
              </View>
              <Text style={[styles.quoteTitle, { color: theme.accent }]}>{t("home.quote.title")}</Text>
            </View>
            <Text style={[styles.quoteText, { color: theme.text }]}>“{quote}”</Text>
          </View>

          {/* ─── 6. AŞK ÖLÇER ─── */}
          <Reveal scope="home" index={5}>
          <LoveMeter 
            value={loveMeter} 
            theme={theme} 
            subtitle={loveSubtitle} 
            isLoading={!activeLoveScore && isLoveScoreLoading} 
          />
          </Reveal>

          {/* ─── COUPLE WRAPPED BANNER (Ayda 1 Kez Dönemsel) ─── */}
          {showWrappedBanner && isWrappedPeriod && isWrappedAccountEligible && (
            <TouchableOpacity
              style={[
                styles.wrappedBanner,
                {
                  borderColor: theme.gender === "male" ? "rgba(79, 125, 190, 0.35)" : "rgba(216, 88, 112, 0.35)",
                  shadowColor: theme.accent,
                },
              ]}
              onPress={() => setIsWrappedVisible(true)}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={theme.gender === "male" ? ["#0D1B2A", "#0B1320"] : ["#2A0E1F", "#170B18"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.wrappedGradient}
              >
                <View style={styles.wrappedLeft}>
                  <View style={[styles.wrappedIconBadge, { backgroundColor: theme.pillAccentBg }]}>
                    <Sparkles size={16} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wrappedTitle}>{t("home.wrapped.title")}</Text>
                    <Text style={styles.wrappedSub}>{t("home.wrapped.subtitle")}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={[styles.wrappedArrowCircle, { backgroundColor: theme.pillAccentBg }]}>
                    <ChevronRight size={18} color={theme.accentLight} />
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
              myName={profile?.displayName}
              partnerName={partnerDisplayName}
              onCelebrated={handleMeetingCelebrated}
            />
          )}

          {/* ─── 8. GÜNLÜK NOT ─── */}
          <Reveal scope="home" index={6}>
            <DailyNoteCard existingNote={dashboardData?.currentNote} theme={theme} />
          </Reveal>
        </KeyboardAwareScrollView>
      </View>
      <LazyStellarHibernationModal
        visible={isHibernationOpen && isStarHibernating}
        starName={starSummary?.name ?? t("stars.defaultName")}
        daysLeft={hibernation.graceDaysLeft}
        onWake={handleWakeStar}
        onClose={() => setIsHibernationOpen(false)}
      />
      <LazyPremiumPaywall
        visible={isHibernationPaywallOpen}
        onClose={() => setIsHibernationPaywallOpen(false)}
        featureSource="exoplanet_view"
        gender={profile?.gender}
      />
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
    gap: 16,
  },

  // ─── Couple Wrapped Banner ─────────────────────────────────────────────
  wrappedBanner: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#D85870",
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
    backgroundColor: "rgba(216, 88, 112, 0.2)",
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
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── Hero Aşk Sayacı ───────────────────────────────────────────────────
  heroLoveCard: {
    borderRadius: 28,
    padding: 18,
    overflow: "hidden",
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
    borderRadius: 22,
    paddingVertical: 18,
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
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -1,
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
    paddingVertical: 14,
    borderRadius: 22,
    gap: 8,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 13,
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
    borderRadius: 24,
    padding: 20,
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
    borderRadius: 16,
    marginBottom: 12,
  },
  demoRibbonText: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
});
