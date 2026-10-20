import React, { useState, useMemo, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from "react-native";
import { Image } from "expo-image";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { LocaleConfig } from "react-native-calendars";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dayjs, todayString } from "@/lib/date";
import { decrypt, deterministicDecrypt } from "@/utils/crypto";
import { sanitize } from "@/utils/sanitize";
import {
  ChevronLeft, AlignJustify,
  Lock, Plus, Calendar as CalendarIcon, Clock, Maximize2,
  MapPin, Droplet
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { PremiumPaywall } from "@/components/ui/PremiumPaywall";
import { useCoupleAvatars } from "@/hooks/useCoupleAvatars";
import { usePageTour } from "@/hooks/usePageTour";
import { PageTourModal } from "@/components/tour/PageTourModal";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import {
  DEMO_CALENDAR_NOTES,
  DEMO_CALENDAR_USERS,
  DEMO_PARTNER_ID,
  DEMO_PHOTOS,
} from "@/constants/demoData";
import { useDemoAction } from "@/hooks/useDemoAction";
import { DemoActionModal } from "@/components/demo/DemoActionModal";
import { CALENDAR_COLORS } from "@/components/calendar/calendarColors";
import type { CalendarPhotoItem } from "@/components/calendar/calendarTypes";
import { DaySectionCard, dayItemAccent } from "@/components/calendar/DaySectionCard";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { CalendarNoteModal } from "@/components/calendar/CalendarNoteModal";
import { NoteMemoryCard } from "@/components/calendar/NoteMemoryCard";
import { CalendarPhotoLightbox } from "@/components/calendar/CalendarPhotoLightbox";
import { PERIOD_DURATION_DAYS, getPeriodDays, getPeriodStarts } from "@/lib/periodCycle";
import { MOODS } from "@/components/home/MoodSelector";

// Veritabanında ruh hali genelde emoji olarak saklanır; eski/demo kayıtlardaki ham anahtarlar (ör. "love") için eşleme.
const MOOD_KEY_DISPLAY: Record<string, { emoji: string; label: string }> = {
  love: { emoji: "🥰", label: "Aşık / Sevgi Dolu" },
  loved: { emoji: "💖", label: "Sevgi Dolu" },
  happy: { emoji: "😊", label: "Mutlu" },
  calm: { emoji: "😌", label: "Huzurlu" },
  excited: { emoji: "✨", label: "Heyecanlı" },
  tired: { emoji: "😴", label: "Yorgun" },
  sad: { emoji: "😢", label: "Üzgün" },
  angry: { emoji: "😡", label: "Kızgın" },
};

function getMoodDisplay(moodType: string | null | undefined): { emoji: string; label: string } {
  if (!moodType) return { emoji: "💭", label: "" };
  const byKey = MOOD_KEY_DISPLAY[moodType.trim().toLowerCase()];
  if (byKey) return byKey;
  const byEmoji = MOODS.find((mood) => mood.emoji === moodType);
  if (byEmoji) return { emoji: byEmoji.emoji, label: byEmoji.label };
  return { emoji: moodType, label: "" };
}

LocaleConfig.locales['tr'] = {
  monthNames: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
  monthNamesShort: ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'],
  dayNames: ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'],
  dayNamesShort: ['Pz','Pt','Sa','Ça','Pe','Cu','Ct'],
  today: 'Bugün'
};
LocaleConfig.defaultLocale = 'tr';

export { CALENDAR_COLORS };

export default function CalendarScreen() {
  const router = useRouter();
  const { session, profile, isDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme, isLight } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const today = todayString();

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [currentMonth, setCurrentMonth] = useState<string>(today);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<CalendarPhotoItem | null>(null);

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;
  // Demo modunda premium kilitleri yoktur: tüm özellikler açık
  const isPremium = (profile?.isPremium ?? false) || isDemoMode;
  const isFemale = profile?.gender === "female";
  // Erkek kullanıcılar takvimde döngüyü (regl) sadece Premium ise görebilir. Kadın kullanıcılar ise her zaman kendi döngülerini görür.
  const canSeePeriod = isFemale || isPremium;
  const [showPaywall, setShowPaywall] = useState(false);
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("calendar");

  // Veri çekme
  const { data, isLoading } = useQuery({
    queryKey: ["calendar_data", coupleId, isPremium, canSeePeriod, isDemoMode],
    enabled: !!coupleId || !!userId || isDemoMode,
    queryFn: async () => {
      if (isDemoMode) {
        return {
          // Takvim notları çiftin ORTAK defteridir. Kişiye özel "Günlük Notum" kayıtları (DEMO_DAILY_NOTES)
          // burada gösterilmez; demo da ortak aşk notlarıyla dolar.
          notes: DEMO_CALENDAR_NOTES,
          moods: [
            { date: today, mood_type: "love", user_id: userId },
            { date: today, mood_type: "😍", user_id: DEMO_PARTNER_ID },
          ],
          photos: DEMO_PHOTOS.map(p => ({
            id: p.id,
            user_id: p.user_id,
            image_url: p.image_url,
            title: p.title,
            description: p.description,
            taken_date: p.taken_date,
            taken_time: p.taken_time,
          })),
          meetings: [
            { id: 1, title: "Romantik Akşam Yemeği 🍷", location: "Boğaz Manzaralı Restoran", meeting_datetime: `${today}T19:30:00`, status: "approved", created_by: userId }
          ],
          periods: canSeePeriod ? [
            { id: 1, date: dayjs().subtract(2, "day").format("YYYY-MM-DD"), user_id: "demo-partner" }
          ] : [],
          users: DEMO_CALENDAR_USERS,
        };
      }
      const threeMonthsAgo = dayjs().subtract(2, "month").startOf("month").format("YYYY-MM-DD");
      const threeMonthsLater = dayjs().add(2, "month").endOf("month").format("YYYY-MM-DD");

      const [notesRes, moodsRes, photosRes, meetingsRes, periodsRes, usersRes] = await Promise.all([
        supabase
          .from("calendar_notes")
          .select("id, date, note, user_id, created_at")
          .eq("couple_id", coupleId)
          .gte("date", threeMonthsAgo)
          .lte("date", threeMonthsLater),
        supabase
          .from("moods")
          .select("date, mood_type, user_id")
          .eq("couple_id", coupleId)
          .gte("date", threeMonthsAgo)
          .lte("date", threeMonthsLater),
        isPremium ? supabase
          .from("photo_archive")
          .select("id, user_id, image_url, title, description, taken_date, taken_time")
          .eq("couple_id", coupleId)
          .gte("taken_date", threeMonthsAgo)
          .lte("taken_date", threeMonthsLater)
          .order("taken_time", { ascending: false }) : Promise.resolve({ data: [] }),
        supabase
          .from("meetings")
          .select("id, title, location, meeting_datetime, status, created_by")
          .eq("couple_id", coupleId)
          .gte("meeting_datetime", `${threeMonthsAgo}T00:00:00`)
          .lte("meeting_datetime", `${threeMonthsLater}T23:59:59`),
        canSeePeriod && coupleId
          ? supabase
            .from("period_logs")
            .select("id, date, user_id")
            .eq("couple_id", coupleId)
            // Pencere öncesinde başlayıp pencereye taşan 5 günlük süreçler de gelsin
            .gte("date", dayjs(threeMonthsAgo).subtract(PERIOD_DURATION_DAYS - 1, "day").format("YYYY-MM-DD"))
            .lte("date", threeMonthsLater)
          : Promise.resolve({ data: [] }),
        supabase
          .from("users")
          .select("*")
          .eq("couple_id", coupleId),
      ]);

      const userMap = (usersRes.data || []).reduce((acc: any, u: any) => {
        acc[u.id] = {
          ...u,
          display_name: u.display_name ? decrypt(u.display_name) : null,
        };
        return acc;
      }, {});

      return {
        notes: (notesRes.data || []).map((n: any) => ({
          ...n,
          user: userMap[n.user_id],
        })),
        moods: (moodsRes.data || []).map((m: any) => ({
          ...m,
          user: userMap[m.user_id],
        })),
        photos: (photosRes.data || []).map((p: any) => ({
          ...p,
          title: p.title ? decrypt(p.title) : null,
          description: p.description ? decrypt(p.description) : null,
          uploader: userMap[p.user_id],
        })),
        meetings: (meetingsRes.data || []).map((m: any) => ({
          ...m,
          creator: userMap[m.created_by],
        })),
        periods: (periodsRes.data || []).map((p: any) => ({
          ...p,
          user: userMap[p.user_id],
        })),
        users: Object.values(userMap) as any[],
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  // Kullanıcı başına regl başlangıçları (kayıtlar yalnızca başlangıç gününü tutar; 5 günlük süreç buradan türetilir)
  const periodStartsByUser = useMemo(() => {
    const datesByUser: Record<string, string[]> = {};
    data?.periods?.forEach((p: any) => {
      (datesByUser[p.user_id] ||= []).push(p.date);
    });
    return Object.entries(datesByUser).map(([uid, dates]) => ({ userId: uid, starts: getPeriodStarts(dates) }));
  }, [data]);

  // Takvim işaretli günleri
  const markedDates = useMemo(() => {
    if (!data) return {};
    const marks: Record<string, any> = {};

    const addDot = (dateStr: string, color: string, key: string) => {
      if (!marks[dateStr]) marks[dateStr] = { dots: [] };
      if (!marks[dateStr].dots.find((d: any) => d.key === key)) {
        marks[dateStr].dots.push({ key, color });
      }
    };

    data.notes?.forEach((n: any) => addDot(n.date, CALENDAR_COLORS.note, "note"));
    data.moods?.forEach((m: any) => {
      const isMe = m.user_id === userId;
      addDot(m.date, isMe ? CALENDAR_COLORS.myMood : CALENDAR_COLORS.partnerMood, isMe ? "my-mood" : "partner-mood");
    });
    if (isPremium) {
      data.photos?.forEach((p: any) => addDot(p.taken_date, CALENDAR_COLORS.photo, "photo"));
    }
    data.meetings?.forEach((m: any) => {
      const meetDate = dayjs(m.meeting_datetime).format("YYYY-MM-DD");
      addDot(meetDate, CALENDAR_COLORS.meeting, "meeting");
    });
    if (canSeePeriod) {
      periodStartsByUser.forEach(({ starts }) => {
        starts.forEach(start => {
          getPeriodDays(start).forEach(day => addDot(day, CALENDAR_COLORS.period, "period"));
        });
      });
    }

    // 🎨 3.4 Çözümü: Gün hücresi içinde 4+ noktanın taşmasını önlemek için en fazla 3 nokta tut
    // Regl noktası 5 gün boyunca görünmeli; kesilecekse diğerleri kesilir
    Object.keys(marks).forEach(d => {
      if (marks[d].dots && marks[d].dots.length > 3) {
        const periodDot = marks[d].dots.find((dot: any) => dot.key === "period");
        const others = marks[d].dots.filter((dot: any) => dot.key !== "period");
        marks[d].dots = periodDot ? [...others.slice(0, 2), periodDot] : others.slice(0, 3);
      }
    });

    if (marks[selectedDate]) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: theme.accent,
      };
    } else {
      marks[selectedDate] = {
        selected: true,
        selectedColor: theme.accent,
        dots: [],
      };
    }

    return marks;
  }, [data, selectedDate, theme.accent, userId, isPremium, canSeePeriod, periodStartsByUser]);

  const onDayPress = useCallback((day: { dateString: string }) => {
    setSelectedDate(day.dateString);
  }, []);

  const handlePrevMonth = useCallback(() => {
    setCurrentMonth(prev => dayjs(prev).subtract(1, "month").format("YYYY-MM-DD"));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth(prev => dayjs(prev).add(1, "month").format("YYYY-MM-DD"));
  }, []);

  // Seçili güne ait veriler
  const selectedDayNotes = useMemo(() => {
    return data?.notes?.filter((n: any) => n.date === selectedDate) || [];
  }, [data, selectedDate]);

  const selectedDayMoods = useMemo(() => {
    return data?.moods?.filter((m: any) => m.date === selectedDate) || [];
  }, [data, selectedDate]);

  const selectedDayPhotos = useMemo(() => {
    return data?.photos?.filter((p: any) => p.taken_date === selectedDate) || [];
  }, [data, selectedDate]);

  const selectedDayMeetings = useMemo(() => {
    return data?.meetings?.filter((m: any) => {
      return dayjs(m.meeting_datetime).format("YYYY-MM-DD") === selectedDate;
    }) || [];
  }, [data, selectedDate]);

  // Seçili gün bir reglin 5 günlük sürecine denk geliyorsa, o reglin kaçıncı günü olduğuyla birlikte
  const selectedDayPeriods = useMemo(() => {
    if (!canSeePeriod) return [];
    const result: { key: string; userId: string; dayIndex: number }[] = [];
    periodStartsByUser.forEach(({ userId: periodUserId, starts }) => {
      for (const start of starts) {
        const dayIndex = dayjs(selectedDate).diff(dayjs(start), "day") + 1;
        if (dayIndex >= 1 && dayIndex <= PERIOD_DURATION_DAYS) {
          result.push({ key: `${periodUserId}-${start}`, userId: periodUserId, dayIndex });
          break;
        }
      }
    });
    return result;
  }, [periodStartsByUser, selectedDate, canSeePeriod]);

  const userNoteForSelectedDay = useMemo(() => {
    return selectedDayNotes.find((n: any) => n.user_id === userId);
  }, [selectedDayNotes, userId]);

  const openNoteModal = () => {
    if (executeOrIntercept(
      () => {},
      "Takvime Not Eklemek İçin Kayıt Olun 📅",
      "Özel günlerinizi, hatıralarınızı ve planlarınızı ortak takviminize kaydetmek için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }
    setNoteText(userNoteForSelectedDay?.note || "");
    setShowNoteModal(true);
  };

  const handleSaveNote = async () => {
    if (executeOrIntercept(
      () => {},
      "Takvime Not Eklemek İçin Kayıt Olun 📅",
      "Özel günlerinizi, hatıralarınızı ve planlarınızı ortak takviminize kaydetmek için ücretsiz hesabınızı oluşturun."
    )) {
      setShowNoteModal(false);
      return;
    }

    if (!coupleId || !userId) return;
    setSaving(true);

    const cleanNote = sanitize(noteText.trim());

    let error;
    if (userNoteForSelectedDay?.id) {
      const res = await supabase
        .from("calendar_notes")
        .update({ note: cleanNote })
        .eq("id", userNoteForSelectedDay.id);
      error = res.error;
    } else {
      const res = await supabase
        .from("calendar_notes")
        .insert({
          couple_id: coupleId,
          user_id: userId,
          date: selectedDate,
          note: cleanNote,
        });
      error = res.error;
    }

    setSaving(false);
    if (!error) {
      setShowNoteModal(false);
      queryClient.invalidateQueries({ queryKey: ["calendar_data"] });
    }
  };

  const handleDeleteNote = async () => {
    if (executeOrIntercept(
      () => {},
      "Notu Silmek İçin Kayıt Olun 🗑️",
      "Takvimdeki notlarınızı yönetmek ve silmek için ücretsiz hesabınızı oluşturun."
    )) {
      setShowNoteModal(false);
      return;
    }

    if (!userNoteForSelectedDay?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("calendar_notes")
      .delete()
      .eq("id", userNoteForSelectedDay.id);

    setSaving(false);
    if (!error) {
      setShowNoteModal(false);
      queryClient.invalidateQueries({ queryKey: ["calendar_data"] });
    }
  };

  const getAuthorName = useCallback((itemUserId: string | undefined | null) => {
    if (!itemUserId) return "İsimsiz";
    if (itemUserId === userId) {
      const myUserObj = (data?.users as any[])?.find(u => u.id === userId);
      let name = myUserObj?.display_name || myUserObj?.first_name || myUserObj?.full_name || profile?.displayName;
      if (!name && myUserObj?.username) {
        name = deterministicDecrypt(myUserObj.username) || myUserObj.username;
      }
      return name || "Sen";
    }

    const partnerObj = (data?.users as any[])?.find(u => u.id !== userId);
    let pName = partnerObj?.display_name || partnerObj?.first_name || partnerObj?.full_name;
    if (!pName && partnerObj?.username) {
      pName = deterministicDecrypt(partnerObj.username) || partnerObj.username;
    }
    return pName || "Sevgilin";
  }, [data?.users, userId, profile?.displayName]);

  // Premium'a özel profil fotoğrafları (premium bitince null → harf avatarı)
  const { getAvatarUrl: getAuthorAvatar } = useCoupleAvatars();

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/home");
              }
            }}
            style={[styles.headerBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)", borderColor: theme.cardBorder }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft color={theme.text} size={24} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Takvim</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>Özel Günler & Hatıralar 📅</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TourGuideButton onPress={openTour} />
            <TouchableOpacity
              onPress={() => router.push("/menu")}
              style={[styles.headerBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)", borderColor: theme.cardBorder }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AlignJustify color={theme.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
        </View>

        {/* KAYDIRILABİLİR İÇERİK */}
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 140 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* AY SEÇİCİ, TAKVİM VE LEJANT */}
          <CalendarMonthView
            theme={theme}
            isLight={isLight}
            currentMonth={currentMonth}
            markedDates={markedDates}
            canSeePeriod={canSeePeriod}
            onDayPress={onDayPress}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
          />

          {/* SEÇİLEN GÜN BAŞLIĞI & NOT BUTONU */}
          <View style={styles.selectedDayHeaderRow}>
            <View>
              <Text style={[styles.selectedDayDate, { color: theme.text }]}>
                {dayjs(selectedDate).format("D MMMM YYYY, dddd")}
              </Text>
              <Text style={[styles.selectedDaySub, { color: theme.textMuted }]}>Günün Kayıtları ve Anıları</Text>
            </View>

            <TouchableOpacity
              style={[styles.addNoteBtn, { backgroundColor: theme.accent }]}
              onPress={openNoteModal}
              activeOpacity={0.85}
            >
              <Plus size={16} color="#ffffff" />
              <Text style={styles.addNoteBtnText}>
                {userNoteForSelectedDay ? "Notu Düzenle" : "Not Ekle"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* SEÇİLEN GÜNÜN DETAYLARI */}
          {isLoading ? (
            <View style={{ gap: 12, marginTop: 4 }}>
              <Skeleton height={90} borderRadius={18} />
              <Skeleton height={140} borderRadius={18} />
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {/* Fotoğraflar */}
              {(!isPremium || selectedDayPhotos.length > 0) && (
                <DaySectionCard variant="photo" isLight={isLight}>
                  {!isPremium ? (
                    <TouchableOpacity
                      onPress={() => setShowPaywall(true)}
                      activeOpacity={0.8}
                      style={[styles.photoCard, dayItemAccent("photo"), { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, height: 160, justifyContent: "center", alignItems: "center" }]}
                    >
                      <View style={[styles.lockIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                        <Lock color={theme.accent} size={22} />
                      </View>
                      <Text style={[styles.lockTitle, { color: theme.text }]}>Fotoğraflar Gizli</Text>
                      <Text style={[styles.lockSub, { color: theme.textMuted }]}>Takvimdeki fotoğrafları görmek için Premium&apos;a geçin.</Text>
                    </TouchableOpacity>
                  ) : (
                    selectedDayPhotos.map((photo: any) => {
                      const uploaderName = getAuthorName(photo.user_id);
                      const avatarUrl = getAuthorAvatar(photo.user_id);

                      return (
                        <TouchableOpacity
                          key={photo.id}
                          style={[styles.photoCard, dayItemAccent("photo"), { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}
                          activeOpacity={0.92}
                          onPress={() => setSelectedPhoto(photo)}
                        >
                          <View style={{ position: "relative" }}>
                            <Image source={{ uri: photo.image_url }} style={styles.photoImg} contentFit="cover" />
                            <View style={styles.photoExpandBadge}>
                              <Maximize2 size={12} color="#ffffff" />
                            </View>
                          </View>
                          <View style={styles.photoCaptionBox}>
                            {!!photo.title && <Text style={[styles.photoTitle, { color: theme.text }]}>{photo.title}</Text>}
                            {!!photo.description && <Text style={[styles.photoDesc, { color: theme.textSecondary }]}>{photo.description}</Text>}
                          </View>
                          <View style={styles.photoMeta}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              {avatarUrl ? (
                                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} contentFit="cover" />
                              ) : (
                                <View style={[styles.avatarFallback, { backgroundColor: theme.unitBg }]}>
                                  <Text style={styles.avatarFallbackText}>{uploaderName.substring(0, 1).toUpperCase()}</Text>
                                </View>
                              )}
                              <Text style={[styles.photoMetaTextBold, { color: theme.text }]}>{uploaderName}</Text>
                            </View>
                            {!!photo.taken_time && (
                              <Text style={[styles.photoMetaTextTime, { color: theme.textMuted }]}>{photo.taken_time.substring(0, 5)}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </DaySectionCard>
              )}

              {/* Notlar */}
              {selectedDayNotes.length > 0 && (
                <DaySectionCard variant="note" isLight={isLight}>
                  {selectedDayNotes.map((note: any) => (
                    <NoteMemoryCard
                      key={note.id}
                      text={note.note}
                      authorName={getAuthorName(note.user_id)}
                      avatarUrl={getAuthorAvatar(note.user_id)}
                      time={note.created_at ? dayjs(note.created_at).format("HH:mm") : null}
                      isMe={note.user_id === userId}
                      theme={theme}
                      isLight={isLight}
                    />
                  ))}
                </DaySectionCard>
              )}

              {/* Ruh Halleri */}
              {selectedDayMoods.length > 0 && (
                <DaySectionCard variant="mood" isLight={isLight}>
                  <View style={styles.moodsGrid}>
                    {selectedDayMoods.map((m: any, i: number) => {
                      const isMe = m.user_id === userId;
                      const authorName = getAuthorName(m.user_id);
                      const moodDisplay = getMoodDisplay(m.mood_type);
                      const moodColor = isMe ? CALENDAR_COLORS.myMood : CALENDAR_COLORS.partnerMood;
                      const bgTint = isLight
                        ? (isMe ? "rgba(245,158,11,0.06)" : "rgba(14,165,233,0.06)")
                        : (isMe ? "rgba(245,158,11,0.12)" : "rgba(14,165,233,0.12)");
                      const borderTint = isMe ? "rgba(245,158,11,0.35)" : "rgba(14,165,233,0.35)";

                      return (
                        <View key={m.id || `mood-${i}`} style={[styles.moodCard, { backgroundColor: bgTint, borderColor: borderTint }]}>
                          <View style={[styles.moodTag, { backgroundColor: isLight ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.25)" }]}>
                            <Text style={[styles.moodTagText, { color: moodColor }]}>
                              {isMe ? "Sen" : authorName}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 30, marginVertical: 3 }}>{moodDisplay.emoji}</Text>
                          <Text style={[styles.moodAuthor, { color: theme.textSecondary }]}>
                            {moodDisplay.label || authorName}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </DaySectionCard>
              )}

              {/* Buluşmalar */}
              {selectedDayMeetings.length > 0 && (
                <DaySectionCard variant="meeting" isLight={isLight}>
                  {selectedDayMeetings.map((meeting: any) => {
                    const timeStr = dayjs(meeting.meeting_datetime).format("HH:mm");
                    const isApproved = meeting.status === "approved";
                    const isPending = meeting.status === "pending";

                    return (
                      <View key={meeting.id} style={[styles.meetingCard, dayItemAccent("meeting"), { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
                        <View style={styles.meetingHeader}>
                          <Text style={[styles.meetingTitle, { color: theme.text }]}>{meeting.title}</Text>
                          <View style={[styles.statusBadge, {
                            backgroundColor: isApproved ? "rgba(16,185,129,0.15)" : isPending ? "rgba(245,158,11,0.15)" : "rgba(239,68,68,0.15)"
                          }]}>
                            <Text style={[styles.statusBadgeText, {
                              color: isApproved ? "#10B981" : isPending ? "#F59E0B" : "#EF4444"
                            }]}>
                              {isApproved ? "Onaylandı" : isPending ? "Bekliyor" : "İptal Edildi"}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.meetingRow}>
                          <Clock size={13} color={theme.textMuted} />
                          <Text style={[styles.meetingSubText, { color: theme.textSecondary }]}>{timeStr}</Text>
                          {meeting.location ? (
                            <>
                              <Text style={{ color: theme.textMuted }}>•</Text>
                              <MapPin size={13} color={theme.textMuted} />
                              <Text style={[styles.meetingSubText, { color: theme.textSecondary }]} numberOfLines={1}>{meeting.location}</Text>
                            </>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}
                </DaySectionCard>
              )}

              {/* Döngü / Regl Günleri (Sadece kadın kullanıcılar veya Premium erkek kullanıcılar için) */}
              {canSeePeriod && selectedDayPeriods.length > 0 && (
                <DaySectionCard variant="period" isLight={isLight}>
                  {selectedDayPeriods.map((period) => {
                    const authorName = getAuthorName(period.userId);
                    return (
                      <View key={period.key} style={[styles.periodCard, dayItemAccent("period"), { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
                        <View style={[styles.periodIconBox, { backgroundColor: isLight ? "rgba(225,29,72,0.1)" : "rgba(225,29,72,0.18)" }]}>
                          <Droplet size={20} color={CALENDAR_COLORS.period} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.periodTitle, { color: theme.text }]}>
                            {period.dayIndex === 1 ? "Regl Başlangıcı" : `Regl Döngüsünün ${period.dayIndex}. Günü`}
                          </Text>
                          <Text style={[styles.periodSub, { color: theme.textMuted }]}>
                            {authorName ? `${authorName} · ${PERIOD_DURATION_DAYS} günlük süreç` : "Döngü kaydı"}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </DaySectionCard>
              )}

              {/* Boş Durum */}
              {selectedDayNotes.length === 0 && selectedDayMoods.length === 0 && selectedDayPhotos.length === 0 && selectedDayMeetings.length === 0 && selectedDayPeriods.length === 0 && (
                <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
                  <CalendarIcon size={32} color={theme.textMuted} />
                  <Text style={[styles.emptyCardTitle, { color: theme.text }]}>Henüz Kayıt Yok</Text>
                  <Text style={[styles.emptyCardSub, { color: theme.textSecondary }]}>
                    Bu güne ait henüz bir not, ruh hali, buluşma veya fotoğraf bulunmuyor.
                  </Text>
                  <TouchableOpacity
                    style={[styles.emptyAddBtn, { backgroundColor: theme.accent }]}
                    onPress={openNoteModal}
                    activeOpacity={0.85}
                  >
                    <Plus size={15} color="#ffffff" />
                    <Text style={styles.emptyAddBtnText}>İlk Notu Ekle ✍️</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* NOT EKLEME / DÜZENLEME MODALI */}
      <CalendarNoteModal
        visible={showNoteModal}
        theme={theme}
        isLight={isLight}
        selectedDate={selectedDate}
        noteText={noteText}
        hasExistingNote={!!userNoteForSelectedDay}
        saving={saving}
        onChangeNoteText={setNoteText}
        onClose={() => setShowNoteModal(false)}
        onSave={handleSaveNote}
        onDelete={handleDeleteNote}
      />

      {/* ─── FOTOĞRAF TAM EKRAN (LIGHTBOX) MODALI ─── */}
      <CalendarPhotoLightbox
        photo={selectedPhoto}
        theme={theme}
        getAuthorName={getAuthorName}
        onClose={() => setSelectedPhoto(null)}
      />

      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName="Takvimdeki Fotoğraflar"
      />
      <PageTourModal visible={isTourVisible} guide={guide} onClose={closeTour} />
      <DemoActionModal
        visible={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        title={modalConfig.title}
        description={modalConfig.description}
      />
    </ScreenBackground>
  );
}

const createStyles = (theme: AppTheme) => {
  const isLight = theme.isLight;

  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 14,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
      borderWidth: 1,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitleBox: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 8,
    },
    headerTitle: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      letterSpacing: -0.4,
    },
    headerSubtitle: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.55)",
      marginTop: 2,
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 10,
      gap: 16,
    },

    /* SEÇİLEN GÜN */
    selectedDayHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 4,
    },
    selectedDayDate: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: theme.text,
    },
    selectedDaySub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.5)",
      marginTop: 2,
    },
    addNoteBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
    },
    addNoteBtnText: {
      fontSize: 12.5,
      fontFamily: "Inter_700Bold",
      color: "#ffffff",
    },

    /* FOTOĞRAFLAR */
    photoCard: {
      borderRadius: 20,
      borderWidth: 1,
      overflow: "hidden",
    },
    photoImg: {
      width: "100%",
      height: 200,
    },
    photoCaptionBox: {
      padding: 14,
    },
    photoTitle: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      marginBottom: 4,
    },
    photoDesc: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.7)",
      lineHeight: 18,
    },
    photoMeta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingBottom: 14,
    },
    avatarImg: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    avatarFallback: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarFallbackText: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      color: theme.text,
    },
    photoMetaTextBold: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.8)",
    },
    photoMetaTextTime: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.4)",
    },
    photoExpandBadge: {
      position: "absolute",
      right: 12,
      bottom: 12,
      backgroundColor: "rgba(0,0,0,0.65)",
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    lockIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    lockTitle: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      marginBottom: 4,
    },
    lockSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.5)",
      textAlign: "center",
    },

    /* RUH HALLERİ */
    moodsGrid: {
      flexDirection: "row",
      gap: 10,
    },
    moodCard: {
      flex: 1,
      borderRadius: 16,
      borderWidth: 1,
      paddingVertical: 12,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    moodTag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
      marginBottom: 2,
    },
    moodTagText: {
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      letterSpacing: 0.2,
    },
    moodAuthor: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.75)",
    },

    /* BULUŞMALAR */
    meetingCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
    },
    meetingHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    meetingTitle: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
    },
    meetingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
    },
    meetingSubText: {
      fontSize: 12.5,
      fontFamily: "Inter_400Regular",
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    statusBadgeText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
    },

    /* PERİYOD/DÖNGÜ */
    periodCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    periodIconBox: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    periodTitle: {
      fontSize: 14.5,
      fontFamily: "Inter_700Bold",
    },
    periodSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },

    /* BOŞ DURUM */
    emptyCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 24,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 6,
    },
    emptyCardTitle: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      marginTop: 4,
    },
    emptyCardSub: {
      fontSize: 12.5,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.5)",
      textAlign: "center",
      lineHeight: 18,
    },
    emptyAddBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
      marginTop: 8,
    },
    emptyAddBtnText: {
      fontSize: 13,
      fontFamily: "Inter_700Bold",
      color: "#ffffff",
    },
  });
};
