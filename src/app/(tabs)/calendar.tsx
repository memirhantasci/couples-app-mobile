import React, { useState, useMemo, useCallback } from "react";
import { 
  View, Text, ScrollView, StyleSheet, TouchableOpacity, 
  ActivityIndicator, TextInput, Modal, Platform 
} from "react-native";
import { Image } from "expo-image";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { Calendar, LocaleConfig } from "react-native-calendars";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dayjs, todayString } from "@/lib/date";
import { decrypt, deterministicDecrypt, encrypt } from "@/utils/crypto";
import { 
  ChevronRight, Heart, FileText, Sparkles, 
  ChevronLeft, X, Check, Trash2, AlignJustify, 
  Lock, Plus, Calendar as CalendarIcon, Clock, Camera, Smile, Maximize2
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { PremiumPaywall } from "@/components/ui/PremiumPaywall";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { usePageTour } from "@/hooks/usePageTour";
import { PageTourModal } from "@/components/tour/PageTourModal";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { DEMO_DAILY_NOTES, DEMO_PHOTOS } from "@/constants/demoData";
import { useDemoAction } from "@/hooks/useDemoAction";
import { DemoActionModal } from "@/components/demo/DemoActionModal";

LocaleConfig.locales['tr'] = {
  monthNames: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
  monthNamesShort: ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'],
  dayNames: ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'],
  dayNamesShort: ['Pz','Pt','Sa','Ça','Pe','Cu','Ct'],
  today: 'Bugün'
};
LocaleConfig.defaultLocale = 'tr';

export const CALENDAR_COLORS = {
  note: "#EC4899",        // Canlı Fuşya / Pembe (Notlar)
  myMood: "#F59E0B",      // Canlı Sıcak Amber (Senin Ruh Halin)
  partnerMood: "#0EA5E9", // Canlı Elektrik Gökmavisi (Partnerinin Ruh Hali)
  photo: "#10B981",       // Canlı Zümrüt Yeşili (Fotoğraflar)
};

export default function CalendarScreen() {
  const router = useRouter();
  const { session, profile, isDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme, isLight } = useTheme();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const today = todayString();

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [currentMonth, setCurrentMonth] = useState<string>(today);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;
  const isPremium = profile?.isPremium ?? false;
  const [showPaywall, setShowPaywall] = useState(false);
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("calendar");

  // Veri çekme
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["calendar_data", coupleId, isDemoMode],
    enabled: !!coupleId || !!userId || isDemoMode,
    queryFn: async () => {
      if (isDemoMode) {
        return {
          notes: DEMO_DAILY_NOTES.map(n => ({
            id: n.id,
            date: n.date,
            note: n.content,
            user_id: userId,
            created_at: new Date().toISOString(),
          })),
          moods: [
            { date: today, mood_type: "love", user_id: userId }
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
          partner: { display_name: "Sevgilin" },
          me: { display_name: "Misafir" },
        };
      }
      const threeMonthsAgo = dayjs().subtract(2, "month").startOf("month").format("YYYY-MM-DD");
      const threeMonthsLater = dayjs().add(2, "month").endOf("month").format("YYYY-MM-DD");

      const [notesRes, moodsRes, photosRes, usersRes] = await Promise.all([
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
        users: Object.values(userMap) as any[],
      };
    },
    staleTime: 1000 * 60 * 5,
  });

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

    data.notes.forEach((n: any) => addDot(n.date, CALENDAR_COLORS.note, "note"));
    data.moods.forEach((m: any) => {
      const isMe = m.user_id === userId;
      addDot(m.date, isMe ? CALENDAR_COLORS.myMood : CALENDAR_COLORS.partnerMood, isMe ? "my-mood" : "partner-mood");
    });
    if (isPremium) {
      data.photos.forEach((p: any) => addDot(p.taken_date, CALENDAR_COLORS.photo, "photo"));
    }

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
  }, [data, selectedDate, theme.accent, userId]);

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
    if (!coupleId || !userId) return;
    setSaving(true);

    let error;
    if (userNoteForSelectedDay?.id) {
      const res = await supabase
        .from("calendar_notes")
        .update({ note: noteText.trim() })
        .eq("id", userNoteForSelectedDay.id);
      error = res.error;
    } else {
      const res = await supabase
        .from("calendar_notes")
        .insert({
          couple_id: coupleId,
          user_id: userId,
          date: selectedDate,
          note: noteText.trim(),
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
    return pName || "Partnerin";
  }, [data?.users, userId, profile?.displayName]);

  const getAuthorAvatar = useCallback((itemUserId: string | undefined | null) => {
    if (!itemUserId) return null;
    const userObj = (data?.users as any[])?.find(u => u.id === itemUserId);
    return userObj?.avatar_url || null;
  }, [data?.users]);

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity 
            onPress={() => router.back()} 
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
          {/* AY SEÇİCİ ÇUBUĞU */}
          <View style={[styles.monthNavCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.monthArrowBtn} activeOpacity={0.75}>
              <ChevronLeft color={theme.text} size={20} />
            </TouchableOpacity>

            <View style={styles.monthTextBox}>
              <CalendarIcon size={16} color={theme.accent} />
              <Text style={[styles.monthText, { color: theme.text }]}>
                {dayjs(currentMonth).format("MMMM YYYY")}
              </Text>
            </View>

            <TouchableOpacity onPress={handleNextMonth} style={styles.monthArrowBtn} activeOpacity={0.75}>
              <ChevronRight color={theme.text} size={20} />
            </TouchableOpacity>
          </View>

          {/* TAKVİM BİLEŞENİ */}
          <View style={[styles.calendarCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Calendar
              current={currentMonth}
              key={`${currentMonth}_${theme.id}_${theme.gender}`}
              firstDay={1}
              onDayPress={onDayPress}
              markedDates={markedDates}
              markingType={'multi-dot'}
              theme={{
                calendarBackground: 'transparent',
                textSectionTitleColor: theme.textMuted,
                selectedDayBackgroundColor: theme.accent,
                selectedDayTextColor: '#ffffff',
                todayTextColor: theme.accent,
                dayTextColor: theme.text,
                textDisabledColor: isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.2)',
                dotColor: theme.accent,
                selectedDotColor: '#ffffff',
                monthTextColor: theme.text,
                textDayFontSize: 14,
                textDayHeaderFontSize: 11.5,
                textDayHeaderFontWeight: '600',
                ...({
                  'stylesheet.calendar.header': {
                    header: {
                      display: 'none',
                    },
                  },
                  'stylesheet.day.multiDot': {
                    base: {
                      width: 36,
                      height: 36,
                      alignItems: 'center',
                      paddingTop: 4,
                      borderRadius: 12,
                    },
                    today: {
                      borderColor: theme.accent,
                      borderWidth: 1.5,
                      borderRadius: 12,
                    },
                    selected: {
                      backgroundColor: theme.accent,
                      borderRadius: 12,
                    },
                    dot: {
                      width: 6,
                      height: 6,
                      marginTop: 2.5,
                      marginHorizontal: 1.5,
                      borderRadius: 3,
                      opacity: 1,
                    },
                  },
                } as any),
              }}
            />

            {/* LEJANT (RENK KILAVUZU) */}
            <View style={[styles.legendRow, { borderTopColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}>
              <View style={[styles.legendItem, { backgroundColor: isLight ? "rgba(236,72,153,0.08)" : "rgba(236,72,153,0.14)", borderColor: "rgba(236,72,153,0.3)" }]}>
                <View style={[styles.legendDot, { backgroundColor: CALENDAR_COLORS.note }]} />
                <Text style={[styles.legendText, { color: isLight ? "#BE185D" : "#F472B6" }]}>Not</Text>
              </View>
              <View style={[styles.legendItem, { backgroundColor: isLight ? "rgba(245,158,11,0.08)" : "rgba(245,158,11,0.14)", borderColor: "rgba(245,158,11,0.3)" }]}>
                <View style={[styles.legendDot, { backgroundColor: CALENDAR_COLORS.myMood }]} />
                <Text style={[styles.legendText, { color: isLight ? "#B45309" : "#FBBF24" }]}>Ruh Halim</Text>
              </View>
              <View style={[styles.legendItem, { backgroundColor: isLight ? "rgba(14,165,233,0.08)" : "rgba(14,165,233,0.14)", borderColor: "rgba(14,165,233,0.3)" }]}>
                <View style={[styles.legendDot, { backgroundColor: CALENDAR_COLORS.partnerMood }]} />
                <Text style={[styles.legendText, { color: isLight ? "#0369A1" : "#38BDF8" }]}>Partnerim</Text>
              </View>
              <View style={[styles.legendItem, { backgroundColor: isLight ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.14)", borderColor: "rgba(16,185,129,0.3)" }]}>
                <View style={[styles.legendDot, { backgroundColor: CALENDAR_COLORS.photo }]} />
                <Text style={[styles.legendText, { color: isLight ? "#047857" : "#34D399" }]}>Fotoğraf</Text>
              </View>
            </View>
          </View>

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
              {selectedDayPhotos.length > 0 && (
                <View style={{ gap: 12 }}>
                  <View style={[styles.sectionHeaderBadge, { backgroundColor: isLight ? "rgba(16,185,129,0.1)" : "rgba(16,185,129,0.16)", borderColor: "rgba(16,185,129,0.3)" }]}>
                    <Camera size={15} color={CALENDAR_COLORS.photo} />
                    <Text style={[styles.sectionHeaderText, { color: isLight ? "#047857" : "#34D399" }]}>FOTOĞRAF ARŞİVİ</Text>
                  </View>

                  {!isPremium ? (
                    <TouchableOpacity
                      onPress={() => setShowPaywall(true)}
                      activeOpacity={0.8}
                      style={[styles.photoCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderLeftWidth: 3.5, borderLeftColor: CALENDAR_COLORS.photo, height: 160, justifyContent: "center", alignItems: "center" }]}
                    >
                      <View style={[styles.lockIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                        <Lock color={theme.accent} size={22} />
                      </View>
                      <Text style={[styles.lockTitle, { color: theme.text }]}>Fotoğraflar Gizli</Text>
                      <Text style={[styles.lockSub, { color: theme.textMuted }]}>Takvimdeki fotoğrafları görmek için Premium'a geçin.</Text>
                    </TouchableOpacity>
                  ) : (
                    selectedDayPhotos.map((photo: any) => {
                      const uploaderName = getAuthorName(photo.user_id);
                      const avatarUrl = getAuthorAvatar(photo.user_id);

                      return (
                        <TouchableOpacity 
                          key={photo.id} 
                          style={[styles.photoCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderLeftWidth: 3.5, borderLeftColor: CALENDAR_COLORS.photo }]}
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
                </View>
              )}

              {/* Notlar */}
              {selectedDayNotes.length > 0 && (
                <View style={{ gap: 10 }}>
                  <View style={[styles.sectionHeaderBadge, { backgroundColor: isLight ? "rgba(236,72,153,0.1)" : "rgba(236,72,153,0.16)", borderColor: "rgba(236,72,153,0.3)" }]}>
                    <FileText size={15} color={CALENDAR_COLORS.note} />
                    <Text style={[styles.sectionHeaderText, { color: isLight ? "#BE185D" : "#F472B6" }]}>GÜNÜN NOTLARI</Text>
                  </View>

                  {selectedDayNotes.map((note: any) => {
                    const authorName = getAuthorName(note.user_id);
                    return (
                      <View key={note.id} style={[styles.noteBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderLeftWidth: 3.5, borderLeftColor: CALENDAR_COLORS.note }]}>
                        <Text style={[styles.noteText, { color: theme.text }]}>{note.note}</Text>
                        <View style={[styles.noteMeta, { borderTopColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}>
                          <Text style={[styles.noteAuthor, { color: CALENDAR_COLORS.note }]}>— {authorName}</Text>
                          {!!note.created_at && (
                            <Text style={[styles.noteTime, { color: theme.textMuted }]}>{dayjs(note.created_at).format("HH:mm")}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Ruh Halleri */}
              {selectedDayMoods.length > 0 && (
                <View style={{ gap: 10 }}>
                  <View style={[styles.sectionHeaderBadge, { backgroundColor: isLight ? "rgba(245,158,11,0.1)" : "rgba(245,158,11,0.16)", borderColor: "rgba(245,158,11,0.3)" }]}>
                    <Smile size={15} color={CALENDAR_COLORS.myMood} />
                    <Text style={[styles.sectionHeaderText, { color: isLight ? "#B45309" : "#FBBF24" }]}>HİSSEDİLEN RUH HALLERİ</Text>
                  </View>

                  <View style={styles.moodsGrid}>
                    {selectedDayMoods.map((m: any, i: number) => {
                      const isMe = m.user_id === userId;
                      const authorName = getAuthorName(m.user_id);
                      const moodColor = isMe ? CALENDAR_COLORS.myMood : CALENDAR_COLORS.partnerMood;
                      const bgTint = isLight 
                        ? (isMe ? "rgba(245,158,11,0.06)" : "rgba(14,165,233,0.06)") 
                        : (isMe ? "rgba(245,158,11,0.12)" : "rgba(14,165,233,0.12)");
                      const borderTint = isMe ? "rgba(245,158,11,0.35)" : "rgba(14,165,233,0.35)";

                      return (
                        <View key={m.id || `mood-${i}`} style={[styles.moodCard, { backgroundColor: bgTint, borderColor: borderTint }]}>
                          <View style={[styles.moodTag, { backgroundColor: isLight ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.25)" }]}>
                            <Text style={[styles.moodTagText, { color: moodColor }]}>
                              {isMe ? "Sen" : "Partnerin"}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 30, marginVertical: 3 }}>{m.mood_type}</Text>
                          <Text style={[styles.moodAuthor, { color: theme.textSecondary }]}>{authorName}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Boş Durum */}
              {selectedDayNotes.length === 0 && selectedDayMoods.length === 0 && selectedDayPhotos.length === 0 && (
                <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                  <CalendarIcon size={32} color={theme.textMuted} />
                  <Text style={[styles.emptyCardTitle, { color: theme.text }]}>Henüz Kayıt Yok</Text>
                  <Text style={[styles.emptyCardSub, { color: theme.textSecondary }]}>
                    Bu güne ait henüz bir not, ruh hali veya fotoğraf bulunmuyor.
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
      <Modal visible={showNoteModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <FileText size={18} color={theme.accent} />
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {userNoteForSelectedDay ? "Günün Notunu Düzenle" : "Güne Not Ekle"}
                </Text>
              </View>

              <TouchableOpacity 
                onPress={() => setShowNoteModal(false)}
                style={[styles.modalCloseBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16, gap: 14 }}
              enableOnAndroid={true}
              extraScrollHeight={130}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.modalDateText, { color: theme.textMuted }]}>
                {dayjs(selectedDate).format("D MMMM YYYY, dddd")}
              </Text>

              <TextInput
                style={[
                  styles.modalTextInput, 
                  { 
                    backgroundColor: theme.unitBg, 
                    color: theme.text,
                    borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"
                  }
                ]}
                multiline
                maxLength={1000}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Bugünle ilgili küçük bir hatıra veya not bırak..."
                placeholderTextColor={isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)"}
              />

              <Text style={[styles.modalCharCount, { color: theme.textMuted }]}>
                {noteText.length} / 1000 karakter
              </Text>

              <View style={styles.modalActionsRow}>
                {userNoteForSelectedDay && (
                  <TouchableOpacity 
                    onPress={handleDeleteNote}
                    disabled={saving}
                    style={styles.modalDeleteBtn}
                  >
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}

                <View style={{ flex: 1 }} />

                <TouchableOpacity 
                  onPress={() => setShowNoteModal(false)}
                  style={[styles.modalCancelBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}
                >
                  <Text style={[styles.modalCancelBtnText, { color: theme.textSecondary }]}>Vazgeç</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={handleSaveNote}
                  disabled={saving || !noteText.trim()}
                  style={[styles.modalSaveBtn, { backgroundColor: theme.accent }, !noteText.trim() && { opacity: 0.5 }]}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Check size={16} color="#ffffff" />
                      <Text style={styles.modalSaveBtnText}>Kaydet</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── FOTOĞRAF TAM EKRAN (LIGHTBOX) MODALI ─── */}
      <Modal
        visible={!!selectedPhoto}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.lightboxBackdrop}>
          {/* Lightbox Üst Bar */}
          <View style={[styles.lightboxHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity 
              onPress={() => setSelectedPhoto(null)}
              style={styles.lightboxCloseBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.lightboxDatePill}>
              <CalendarIcon size={13} color={theme.accent} />
              <Text style={[styles.lightboxDateText, { color: theme.accent }]}>
                {selectedPhoto ? dayjs(selectedPhoto.taken_date).locale("tr").format("DD MMMM YYYY") : ""}
              </Text>
            </View>

            <View style={{ width: 40 }} />
          </View>

          {/* Tam Ekran Fotoğraf */}
          <View style={styles.lightboxMainArea}>
            {selectedPhoto && (
              <Image 
                source={{ uri: selectedPhoto.image_url }} 
                style={styles.lightboxImg} 
                contentFit="contain" 
              />
            )}
          </View>

          {/* Alt Bilgi Kartı */}
          {selectedPhoto && (
            <View style={[styles.lightboxFooter, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.lightboxMetaRow}>
                <Text style={styles.lightboxAuthor}>
                  {getAuthorName(selectedPhoto.user_id)}
                </Text>
                {selectedPhoto.taken_time && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Clock size={12} color="rgba(255,255,255,0.6)" />
                    <Text style={styles.lightboxTime}>{selectedPhoto.taken_time.substring(0, 5)}</Text>
                  </View>
                )}
              </View>

              {selectedPhoto.title ? (
                <Text style={styles.lightboxTitle}>{selectedPhoto.title}</Text>
              ) : null}

              {selectedPhoto.description ? (
                <Text style={styles.lightboxDesc}>{selectedPhoto.description}</Text>
              ) : null}
            </View>
          )}
        </View>
      </Modal>

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

const styles = StyleSheet.create({
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
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
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
    color: "#ffffff",
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 16,
  },

  /* AY GEZGİNİ */
  monthNavCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  monthArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  monthTextBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  monthText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.2,
  },

  /* TAKVİM KARTI */
  calendarCard: {
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    marginTop: 10,
    borderTopWidth: 1,
    flexWrap: "wrap",
    gap: 6,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
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
    color: "#ffffff",
  },
  selectedDaySub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
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

  /* SECTION HEADER */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  sectionHeaderBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
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
    color: "#ffffff",
    marginBottom: 4,
  },
  photoDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
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
    color: "#ffffff",
  },
  photoMetaTextBold: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.8)",
  },
  photoMetaTextTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
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
    color: "#ffffff",
    marginBottom: 4,
  },
  lockSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },

  /* NOTLAR */
  noteBox: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  noteText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
    lineHeight: 21,
  },
  noteMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  noteAuthor: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  noteTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
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
    color: "rgba(255,255,255,0.75)",
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
    color: "#ffffff",
    marginTop: 4,
  },
  emptyCardSub: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
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

  /* MODAL */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    padding: 18,
  },
  modalBox: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalDateText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
    marginBottom: 4,
  },
  modalTextInput: {
    borderRadius: 16,
    padding: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#ffffff",
    minHeight: 140,
    textAlignVertical: "top",
    lineHeight: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalCharCount: {
    alignSelf: "flex-end",
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
  },
  modalActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  modalDeleteBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  modalCancelBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  modalSaveBtn: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalSaveBtnText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
  },

  /* FOTOĞRAF BÜYÜT ROZETİ */
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

  /* LIGHTBOX MODAL */
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "#000000",
    justifyContent: "space-between",
  },
  lightboxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 10,
    zIndex: 10,
  },
  lightboxCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxDatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  lightboxDateText: {
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
  lightboxMainArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxImg: {
    width: "100%",
    height: "100%",
  },
  lightboxFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    gap: 6,
  },
  lightboxMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  lightboxAuthor: {
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
  },
  lightboxTime: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  lightboxTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  lightboxDesc: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    lineHeight: 19,
  },
});
