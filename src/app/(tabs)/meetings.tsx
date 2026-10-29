import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Linking,
  Modal,
} from "react-native";
import { appAlert } from "@/lib/dialog";
import { DialogHost } from "@/components/ui/DialogHost";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useCoupleAvatars } from "@/hooks/useCoupleAvatars";
import { EmptyState } from "@/components/ui/EmptyState";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Trash2, MapPin, AlignJustify, Pencil, ChevronLeft,
  Plus, Calendar, Clock, Navigation, Check, X, Sparkles, Heart
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { notifyPartner, cancelLocalNotification } from "@/lib/notifications";
import { scheduleMeetingReminder, meetingReminderId } from "@/lib/reminderSync";
import { dayjs } from "@/lib/date";
import type { AppTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { MapPickerModal } from "@/components/MapPickerModal";
import { usePageTour } from "@/hooks/usePageTour";
import { useDeferredReady } from "@/hooks/useDeferredReady";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { DEMO_MEETINGS } from "@/constants/demoData";
import { useDemoAction } from "@/hooks/useDemoAction";
import { sanitizeStrict } from "@/utils/sanitize";
import { toast } from "@/lib/toast";
import { fetchMeetings, meetingsQueryKey } from "@/lib/screenQueries";
import { LazyPageTourModal, LazyDemoActionModal, LazyDateTimePickerSheet } from "@/components/ui/lazyMount";
import { useTranslation } from "react-i18next";

/** Güncelleme sorgusu hiçbir satırı değiştirmediğinde (buluşma başkasına ait / silinmiş) fırlatılır. */
const MEETING_UPDATE_DENIED = "MEETING_UPDATE_DENIED";

const PAST_MEETINGS_PAGE_SIZE = 10;

export default function MeetingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { session, profile, isDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme, isLight } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const coupleId = profile?.coupleId;
  const userId = session?.user?.id ? session.user.id : null;
  const { getAvatarUrl } = useCoupleAvatars();
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("meetings");
  // Geçmiş buluşmalar ekran dışında kalır: ilk karede çizilmez, hemen ardından eklenir ve sayfa sayfa açılır
  const showPastSection = useDeferredReady();
  const [pastVisibleCount, setPastVisibleCount] = useState(PAST_MEETINGS_PAGE_SIZE);

  const [showFormModal, setShowFormModal] = useState(false);
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

  // Düzenlenen buluşma (null → yeni buluşma). Orijinal değerler, tarih/yer değişimini ayırt etmek için tutulur.
  const [editingMeeting, setEditingMeeting] = useState<any | null>(null);
  const editingMeetingId: string | number | null = editingMeeting?.id ?? null;

  const { data: meetings, isLoading } = useQuery({
    queryKey: meetingsQueryKey(coupleId, isDemoMode),
    enabled: !!coupleId || isDemoMode,
    queryFn: () => fetchMeetings({ coupleId, isDemoMode }),
    staleTime: 1000 * 60 * 5,
  });

  const onDateConfirm = (selectedDate: Date) => {
    setShowDatePicker(false);
    const newDate = new Date(meetingDate);
    newDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    setMeetingDate(newDate);
  };

  const onTimeConfirm = (selectedTime: Date) => {
    setShowTimePicker(false);
    const newDate = new Date(meetingDate);
    newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
    setMeetingDate(newDate);
  };

  const handleEdit = (m: any) => {
    if (executeOrIntercept(
      () => {},
      t("meetings.demo.editTitle"),
      t("meetings.demo.editDescription")
    )) {
      return;
    }
    setEditingMeeting(m);
    setTitle(m.title);
    setMeetingDate(new Date(m.meeting_datetime));
    setLocationName(m.location_name || "");
    setLatitude(m.latitude || null);
    setLongitude(m.longitude || null);
    setShowFormModal(true);
  };

  const handleCancelEdit = () => {
    setEditingMeeting(null);
    setTitle("");
    setMeetingDate(new Date());
    setLocationName("");
    setLatitude(null);
    setLongitude(null);
    setShowFormModal(false);
  };

  const handleSave = async () => {
    if (executeOrIntercept(
      () => {},
      t("meetings.demo.saveTitle"),
      t("meetings.demo.saveDescription")
    )) {
      return;
    }

    if (!coupleId || !userId) return;

    // Düzenlemede "geçmişe plan yapılamaz" kuralı yalnızca tarih/saat değiştirildiyse geçerlidir:
    // yalnızca başlığı ya da yeri düzeltilen, saati az önce geçmiş bir buluşma yine de kaydedilebilir.
    const originalTime = editingMeeting ? new Date(editingMeeting.meeting_datetime).getTime() : null;
    const timeChanged = originalTime === null || originalTime !== meetingDate.getTime();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (timeChanged && meetingDate.getTime() < fiveMinutesAgo) {
      appAlert(t("common.error"), t("meetings.errors.past"));
      return;
    }

    if (!title.trim()) {
      appAlert(t("common.missingInfo"), t("meetings.errors.titleRequired"));
      return;
    }

    setIsSubmitting(true);

    try {
      const utcDateTime = dayjs(meetingDate).toISOString();
      const cleanTitle = sanitizeStrict(title.trim() || t("tabs.meetings.label"));
      const cleanLocation = locationName.trim() ? sanitizeStrict(locationName.trim()) : null;

      let savedMeetingId: string | number | null = editingMeetingId;
      let successMessage = "";

      if (editingMeeting) {
        // Yalnızca planlayan kişi güncelleyebilir (RLS de aynı kuralı uygular). Güncelleme sessizce
        // 0 satıra denk gelirse başarı mesajı gösterilmesin diye dönen satır sayısı doğrulanır.
        const { data: updatedRows, error } = await supabase
          .from("meetings")
          .update({
            meeting_datetime: utcDateTime,
            title: cleanTitle,
            location_name: cleanLocation,
            latitude: latitude,
            longitude: longitude,
          })
          .eq("id", editingMeeting.id)
          .eq("couple_id", coupleId)
          .eq("user_id", userId)
          .select("id");

        if (error) throw error;
        if (!updatedRows || updatedRows.length === 0) throw new Error(MEETING_UPDATE_DENIED);
        successMessage = t("meetings.toasts.updated");

        // Partner yanlış saatte/yerde beklemesin: tarih veya yer değiştiyse haberdar edilir
        const sameCoordinate = (stored: unknown, current: number | null) =>
          stored == null ? current === null : Number(stored) === current;
        const locationChanged =
          (editingMeeting.location_name || null) !== cleanLocation ||
          !sameCoordinate(editingMeeting.latitude, latitude) ||
          !sameCoordinate(editingMeeting.longitude, longitude);
        if (timeChanged || locationChanged) {
          notifyPartner(
            coupleId,
            userId,
            t("meetings.push.updatedTitle"),
            t("meetings.push.updatedBody", { name: profile?.displayName || t("common.partnerFallback"), title: cleanTitle }),
            {
              type: "meeting",
              meetingChange: "updated",
              meetingId: editingMeeting.id,
              meetingTitle: cleanTitle,
              route: "/(tabs)/meetings",
              actionLabel: t("notifications.actions.viewPlan"),
            }
          );
        }
      } else {
        const { data: insertedData, error } = await supabase.from("meetings").insert({
          meeting_datetime: utcDateTime,
          title: cleanTitle,
          location_name: cleanLocation,
          latitude: latitude,
          longitude: longitude,
          is_active: true,
          couple_id: coupleId,
          user_id: userId,
        }).select("id").single();

        if (error) throw error;
        if (insertedData?.id) {
          savedMeetingId = insertedData.id;
        }

        // Yeni buluşma bildirimi sunucudaki tetikleyiciden (send-push) gelir; burada ayrıca göndermek çift bildirim yapıyordu.

        successMessage = t("meetings.toasts.planned");
      }

      // Buluşmaya 2 saat kala yerel hatırlatıcı kur. Zaman geçmişteyse (düzenleme buluşmayı yakına
      // çektiyse) eski hatırlatıcı iptal edilir. Partnerin cihazında aynı hatırlatıcıyı
      // useReminderSync kurar.
      if (savedMeetingId) {
        await scheduleMeetingReminder(savedMeetingId, cleanTitle, meetingDate);
      }

      handleCancelEdit();
      queryClient.invalidateQueries({ queryKey: ["meetings", coupleId] });
      queryClient.invalidateQueries({ queryKey: ["map_meetings", coupleId] });
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
      // Form modalı kapanırken değil, kapandıktan sonra görünsün (modalın arkasında kalmasın)
      toast.success(successMessage, { delay: 350 });
    } catch (error: any) {
      appAlert(
        t("common.error"),
        error?.message === MEETING_UPDATE_DENIED
          ? t("meetings.errors.onlyPlanner")
          : t("meetings.errors.actionFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (m: any) => {
    if (executeOrIntercept(
      () => {},
      t("meetings.demo.deleteTitle"),
      t("meetings.demo.deleteDescription")
    )) {
      return;
    }

    appAlert(t("meetings.delete.title"), t("meetings.delete.message"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          // Yerel hatırlatıcıyı temizle
          if (m?.id) {
            await cancelLocalNotification(meetingReminderId(m.id));
          }

          const { error } = await supabase
            .from("meetings")
            .delete()
            .eq("id", m.id);

          if (error) {
            appAlert(t("common.error"), t("meetings.errors.deleteFailed"));
          } else {
            queryClient.invalidateQueries({ queryKey: ["meetings", coupleId] });
            queryClient.invalidateQueries({ queryKey: ["map_meetings", coupleId] });
            queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
          }
        }
      }
    ]);
  };

  const now = new Date();
  const activeMeetings = meetings?.filter(m => new Date(m.meeting_datetime) >= now && m.is_active) || [];
  const pastMeetings = meetings?.filter(m => new Date(m.meeting_datetime) < now || !m.is_active) || [];

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity 
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
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
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t("menu.meetups.title")}</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]} numberOfLines={1}>{t("meetings.subtitle")}</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TourGuideButton onPress={openTour} />
            <TouchableOpacity 
              accessibilityRole="button"
              accessibilityLabel={t("common.openMenu")}
              onPress={() => router.push("/menu")} 
              style={[styles.headerBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)", borderColor: theme.cardBorder }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AlignJustify color={theme.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 140 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* HIZLI BULUŞMA EKLE BUTONU */}
          <TouchableOpacity 
            style={[styles.quickPlanBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}
            onPress={() => {
              if (executeOrIntercept(
                () => {},
                t("demo.prompts.planMeetup.title"),
                t("demo.prompts.planMeetup.description")
              )) {
                return;
              }
              handleCancelEdit();
              setShowFormModal(true);
            }}
            activeOpacity={0.88}
          >
            <View style={[styles.quickPlanIconCircle, { backgroundColor: theme.pillAccentBg }]}>
              <Plus size={20} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.quickPlanTitle, { color: theme.text }]}>{t("meetings.plan.cta")}</Text>
              <Text style={[styles.quickPlanSub, { color: theme.textMuted }]}>{t("meetings.plan.ctaSub")}</Text>
            </View>
            <MapPin size={18} color={theme.textMuted} />
          </TouchableOpacity>

          {/* AKTİF BULUŞMALAR BÖLÜMÜ */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t("meetings.upcoming")}</Text>
              {activeMeetings.length > 0 && (
                <Text style={styles.sectionBadgeText}>{t("meetings.count", { count: activeMeetings.length })}</Text>
              )}
            </View>

            {isLoading ? (
              <View style={{ gap: 12 }}>
                <Skeleton height={140} borderRadius={20} />
                <Skeleton height={140} borderRadius={20} />
              </View>
            ) : activeMeetings.length > 0 ? (
              activeMeetings.map((m) => {
                const isMyMeeting = m.user_id === userId;
                const formattedDate = dayjs(m.meeting_datetime).locale(i18n.language).format("D MMMM YYYY, dddd");
                const formattedTime = dayjs(m.meeting_datetime).format("HH:mm");

                return (
                  <View key={m.id} style={[styles.meetingCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
                    {/* Kart Üst Bilgisi */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.titleWithIcon}>
                        <View style={[styles.cardIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                          <Heart size={16} color={theme.accent} fill={theme.accent} />
                        </View>
                        <Text style={styles.cardTitle}>{m.title}</Text>
                      </View>

                      {isMyMeeting && (
                        <View style={styles.cardActionBtns}>
                          <TouchableOpacity
                            onPress={() => handleEdit(m)}
                            style={[styles.cardActionBtn, styles.cardEditBtn]}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={t("meetings.card.editA11y")}
                          >
                            <Pencil color={theme.accent} size={15} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleDelete(m)}
                            style={[styles.cardActionBtn, styles.cardDeleteBtn]}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={t("meetings.card.deleteA11y")}
                          >
                            <Trash2 color={isLight ? "#DC2626" : "#ef4444"} size={15} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* Zaman Rozeti */}
                    <View style={styles.timeBadgeRow}>
                      <View style={styles.timePill}>
                        <Calendar size={13} color={theme.accent} />
                        <Text style={styles.timePillText}>{formattedDate}</Text>
                      </View>
                      <View style={[styles.timePill, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)" }]}>
                        <Clock size={13} color={theme.accent} />
                        <Text style={[styles.timePillText, { color: theme.text }]}>{formattedTime}</Text>
                      </View>
                    </View>

                    {/* Planlayan imzası */}
                    <View style={styles.plannerRow}>
                      <UserAvatar
                        uri={getAvatarUrl(m.user_id)}
                        name={isMyMeeting ? profile?.displayName : t("common.partnerFallback")}
                        size={22}
                        borderWidth={1}
                      />
                      <Text style={[styles.plannerText, { color: theme.textSecondary }]} numberOfLines={1}>
                        {isMyMeeting ? t("meetings.card.plannedByYou") : t("meetings.card.plannedByPartner")}
                      </Text>
                    </View>

                    {/* Konum Satırı */}
                    {m.location_name ? (
                      <View style={styles.locationContainer}>
                        <MapPin color={theme.accent} size={14} />
                        <Text style={[styles.locationText, { color: theme.textSecondary }]} numberOfLines={1}>
                          {m.location_name}
                        </Text>
                      </View>
                    ) : null}

                    {/* Yol Tarifi Butonu */}
                    {(m.latitude && m.longitude) || m.location_name ? (
                      <TouchableOpacity
                        style={[styles.directionsBtn, { backgroundColor: theme.unitBg }]}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (m.latitude && m.longitude) {
                            const url = Platform.select({
                              ios: `maps://app?daddr=${m.latitude},${m.longitude}`,
                              android: `google.navigation:q=${m.latitude},${m.longitude}`
                            }) || `https://www.google.com/maps/dir/?api=1&destination=${m.latitude},${m.longitude}`;
                            Linking.openURL(url);
                          } else if (m.location_name) {
                            const encoded = encodeURIComponent(m.location_name);
                            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
                          }
                        }}
                      >
                        <Navigation size={14} color={theme.accent} />
                        <Text style={[styles.directionsBtnText, { color: theme.accent }]}>
                          {t("meetings.card.directions")}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <EmptyState
                emoji="🥂"
                title={pastMeetings.length > 0 ? t("meetings.empty.noneTitle") : t("meetings.empty.firstTitle")}
                description={
                  pastMeetings.length > 0
                    ? t("meetings.empty.noneDescription")
                    : t("meetings.empty.firstDescription")
                }
                ctaLabel={pastMeetings.length > 0 ? t("meetings.empty.noneCta") : t("meetings.empty.firstCta")}
                onPressCta={() => {
                  if (executeOrIntercept(
                    () => {},
                    t("demo.prompts.planMeetup.title"),
                    t("demo.prompts.planMeetup.description")
                  )) {
                    return;
                  }
                  handleCancelEdit();
                  setShowFormModal(true);
                }}
                theme={theme}
                compact
                style={styles.emptyState}
              />
            )}
          </View>

          {/* GEÇMİŞ BULUŞMALAR BÖLÜMÜ */}
          {showPastSection && pastMeetings.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>{t("meetings.past")}</Text>
              {pastMeetings.slice(0, pastVisibleCount).map((m) => {
                const formattedDate = dayjs(m.meeting_datetime).locale(i18n.language).format("D MMMM YYYY");

                return (
                  <View key={m.id} style={[styles.pastMeetingCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pastCardTitle, { color: theme.text }]}>{m.title}</Text>
                      <Text style={[styles.pastCardDate, { color: theme.textMuted }]}>{formattedDate}</Text>
                      {m.location_name ? (
                        <Text style={[styles.pastLocationText, { color: theme.textSecondary }]} numberOfLines={1}>
                          📍 {m.location_name}
                        </Text>
                      ) : null}
                    </View>
                    <Check size={18} color={theme.textMuted} />
                  </View>
                );
              })}
              {pastMeetings.length > pastVisibleCount && (
                <TouchableOpacity
                  style={[styles.showMorePastBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
                  onPress={() => setPastVisibleCount((count) => count + PAST_MEETINGS_PAGE_SIZE)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.showMorePastText, { color: theme.accent }]}>
                    {t("meetings.showOlder", { remaining: pastMeetings.length - pastVisibleCount })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {/* ─── YENİ BULUŞMA EKLEME / DÜZENLEME MODALI ─── */}
      <Modal visible={showFormModal} animationType="slide" transparent onRequestClose={handleCancelEdit}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MapPin size={18} color={theme.accent} />
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {editingMeetingId ? t("meetings.form.editTitle") : t("meetings.form.newTitle")}
                </Text>
              </View>

              <TouchableOpacity 
                onPress={handleCancelEdit}
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
              {/* Buluşma Başlığı */}
              <View style={{ gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t("meetings.form.titleLabel")}</Text>
                <TextInput
                  style={[
                    styles.textInput, 
                    { 
                      backgroundColor: theme.unitBg,
                      color: theme.text,
                      borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.08)"
                    }
                  ]}
                  placeholder={t("meetings.form.titlePlaceholder")}
                  placeholderTextColor={isLight ? theme.textMuted : "rgba(255,255,255,0.3)"}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={60}
                />
              </View>

              {/* Tarih & Saat Seçicileri */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t("meetings.form.dateLabel")}</Text>
                  <TouchableOpacity 
                    style={[
                      styles.pickerBtn, 
                      { 
                        backgroundColor: theme.unitBg,
                        borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.08)"
                      }
                    ]} 
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Calendar size={14} color={theme.accent} />
                    <Text style={[styles.pickerBtnText, { color: theme.text }]}>{dayjs(meetingDate).format("DD.MM.YYYY")}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t("meetings.form.timeLabel")}</Text>
                  <TouchableOpacity 
                    style={[
                      styles.pickerBtn, 
                      { 
                        backgroundColor: theme.unitBg,
                        borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.08)"
                      }
                    ]} 
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Clock size={14} color={theme.accent} />
                    <Text style={[styles.pickerBtnText, { color: theme.text }]}>{dayjs(meetingDate).format("HH:mm")}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Konum Belirleme */}
              <View style={{ gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t("meetings.form.locationLabel")}</Text>
                <View style={[styles.locationInputBox, { backgroundColor: theme.unitBg, borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.08)" }]}>
                  <TextInput
                    style={[
                      styles.locationTextInput, 
                      { 
                        backgroundColor: theme.unitBg,
                        color: theme.text,
                      }
                    ]}
                    placeholder={t("meetings.form.locationPlaceholder")}
                    placeholderTextColor={isLight ? theme.textMuted : "rgba(255,255,255,0.3)"}
                    value={locationName}
                    onChangeText={setLocationName}
                    maxLength={100}
                  />
                  <TouchableOpacity 
                    style={[styles.mapOpenBtn, { backgroundColor: theme.pillAccentBg }]} 
                    onPress={() => setShowMapModal(true)}
                    activeOpacity={0.8}
                  >
                    <MapPin size={15} color={theme.accent} />
                    <Text style={[styles.mapOpenBtnText, { color: theme.accent }]}>{t("tabs.map.label")}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Kaydet / Güncelle Butonu */}
              <TouchableOpacity
                style={[
                  styles.saveBtn, 
                  { backgroundColor: theme.accent },
                  (!title.trim() || isSubmitting) && { opacity: 0.6 }
                ]}
                onPress={handleSave}
                disabled={isSubmitting || !title.trim()}
                activeOpacity={0.88}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Check size={18} color="#ffffff" />
                    <Text style={styles.saveBtnText}>
                      {editingMeetingId ? t("meetings.form.update") : t("meetings.form.save")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </KeyboardAwareScrollView>
          </View>

          {/* TARİH & SAAT SEÇİCİ: iOS'ta başka bir Modal'ın üstünde açılabilmesi için form Modal'ının içinde render edilir */}
          <LazyDateTimePickerSheet
            visible={showDatePicker}
            mode="date"
            title={t("meetings.form.datePickerTitle")}
            value={meetingDate}
            minimumDate={dayjs().startOf("day").toDate()}
            onCancel={() => setShowDatePicker(false)}
            onConfirm={onDateConfirm}
          />
          <LazyDateTimePickerSheet
            visible={showTimePicker}
            mode="time"
            title={t("meetings.form.timePickerTitle")}
            value={meetingDate}
            onCancel={() => setShowTimePicker(false)}
            onConfirm={onTimeConfirm}
          />

          {/* HARİTA SEÇİCİ: iOS aynı anda yalnızca bir modal sunar; form Modal'ı açıkken kardeş olarak
              render edilirse hiç açılmaz. Tarih/saat seçicileri gibi form Modal'ının içinde render edilir. */}
          <MapPickerModal
            visible={showMapModal}
            onClose={() => setShowMapModal(false)}
            title={t("meetings.form.locationPickerTitle")}
            initialLocation={latitude && longitude ? { latitude, longitude } : undefined}
            onSelectLocation={(loc) => {
              setLatitude(loc.latitude);
              setLongitude(loc.longitude);
              if (!locationName) setLocationName(loc.locationName || "");
            }}
          />
        </View>
        {/* Bu modal açıkken uyarılar/diyaloglar (kök katman modalın arkasında kalır) burada çizilir */}
        <DialogHost embedded visible={showFormModal} />
      </Modal>

      <LazyPageTourModal visible={isTourVisible} guide={guide} onClose={closeTour} />
      <LazyDemoActionModal
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
      paddingBottom: 12,
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
      paddingTop: 8,
      gap: 18,
    },

    /* HIZLI PLANLA KARTI */
    quickPlanBtn: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      gap: 12,
      ...theme.cardShadow,
    },
    quickPlanIconCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
    },
    quickPlanTitle: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      letterSpacing: -0.2,
    },
    quickPlanSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.55)",
      marginTop: 2,
    },

    /* BÖLÜM YAPISI */
    sectionBlock: {
      gap: 10,
    },
    sectionHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginLeft: 4,
    },
    sectionLabel: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.5)",
      letterSpacing: 0.8,
    },
    sectionBadgeText: {
      fontSize: 11.5,
      fontFamily: "Inter_600SemiBold",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.45)",
    },

    /* BULUŞMA KARTI */
    meetingCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 16,
      gap: 12,
      ...theme.cardShadow,
    },
    cardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    titleWithIcon: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    cardIconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitle: {
      flexShrink: 1,
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      letterSpacing: -0.2,
    },
    cardActionBtns: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginLeft: 8,
    },
    cardActionBtn: {
      width: 34,
      height: 34,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    // Düzenle: tema vurgu rengiyle belirgin kalem; Sil: gül/kırmızı tonlu (iki temada da okunur)
    cardEditBtn: {
      backgroundColor: theme.pillAccentBg,
      borderColor: theme.pillAccentBorder,
    },
    cardDeleteBtn: {
      backgroundColor: isLight ? "rgba(220,38,38,0.08)" : "rgba(239,68,68,0.12)",
      borderColor: isLight ? "rgba(220,38,38,0.25)" : "rgba(239,68,68,0.3)",
    },
    timeBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    timePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    timePillText: {
      fontSize: 12.5,
      fontFamily: "Inter_500Medium",
      color: isLight ? theme.text : "rgba(255,255,255,0.85)",
    },
    plannerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    plannerText: {
      flex: 1,
      fontSize: 12.5,
      fontFamily: "Inter_500Medium",
    },
    locationContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 2,
    },
    locationText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.7)",
    },
    directionsBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 11,
      borderRadius: 14,
      marginTop: 2,
    },
    directionsBtnText: {
      fontSize: 13,
      fontFamily: "Inter_700Bold",
    },

    /* GEÇMİŞ BULUŞMA KARTI */
    showMorePastBtn: {
      paddingVertical: 13,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    showMorePastText: {
      fontSize: 13.5,
      fontFamily: "Inter_600SemiBold",
    },
    pastMeetingCard: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      opacity: 0.65,
      ...theme.cardShadow,
    },
    pastCardTitle: {
      fontSize: 14.5,
      fontFamily: "Inter_600SemiBold",
      color: theme.text,
    },
    pastCardDate: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.5)",
      marginTop: 2,
    },
    pastLocationText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.45)",
      marginTop: 2,
    },

    /* BOŞ DURUM */
    emptyState: {
      marginTop: 0,
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
      maxHeight: "88%",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: "rgba(255,255,255,0.08)",
    },
    modalTitle: {
      fontSize: 16.5,
      fontFamily: "Inter_700Bold",
      color: theme.text,
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)",
      alignItems: "center",
      justifyContent: "center",
    },
    fieldLabel: {
      fontSize: 11.5,
      fontFamily: "Inter_600SemiBold",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.6)",
      letterSpacing: 0.5,
    },
    textInput: {
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 14.5,
      fontFamily: "Inter_400Regular",
    },
    pickerBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 14,
    },
    pickerBtnText: {
      fontSize: 13.5,
      fontFamily: "Inter_600SemiBold",
      color: theme.text,
    },
    locationInputBox: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
    },
    locationTextInput: {
      flex: 1,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 14.5,
      fontFamily: "Inter_400Regular",
    },
    mapOpenBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 14,
    },
    mapOpenBtnText: {
      fontSize: 13,
      fontFamily: "Inter_700Bold",
    },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 48,
      borderRadius: 14,
      marginTop: 8,
    },
    saveBtnText: {
      color: "#ffffff",
      fontSize: 14.5,
      fontFamily: "Inter_700Bold",
    },

  });
};
