import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { appAlert } from "@/lib/dialog";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { PremiumSuccessModal } from "@/components/ui/PremiumSuccessModal";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { notifyPartner } from "@/lib/notifications";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { setGlobalActiveTheme, type AppTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { sanitizeStrict } from "@/utils/sanitize";
import { toast } from "@/lib/toast";
import { getCooldownStatus } from "@/lib/cooldown";
import {
  type DatesChangeStatus,
  daysUntilPeriodEnd,
  fetchDatesChangeStatus,
  parseDatesChangeStatus,
  translateDatesError,
} from "@/lib/relationshipDates";
import { formatLongDate } from "@/lib/date";
import {
  DEFAULT_MEMORY_DESCRIPTIONS,
  DEFAULT_MEMORY_TITLES,
  DEFAULT_MEMORY_TITLE_LIST,
} from "@/lib/defaultMemories";
import { usePageTour } from "@/hooks/usePageTour";
import { useDeferredReady } from "@/hooks/useDeferredReady";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { useDemoAction } from "@/hooks/useDemoAction";
import { DEMO_PROFILE } from "@/constants/demoData";
import { EditableAvatar } from "@/components/avatar/EditableAvatar";
import {
  LogOut,
  AlignJustify,
  Wallet,
  Crown,
  ShieldCheck,
  Heart,
  ChevronLeft,
} from "lucide-react-native";
import { LegalModal } from "@/components/legal/LegalModal";
import { LegalDocType } from "@/constants/legalTexts";
import { ModernSection } from "@/components/profile/ModernSection";
import { ThemePicker } from "@/components/profile/ThemePicker";
import { TabBarCustomizer } from "@/components/profile/TabBarCustomizer";
import { PersonalInfoForm } from "@/components/profile/PersonalInfoForm";
import { RelationshipDatesCard } from "@/components/profile/RelationshipDatesCard";
import { PromoCodeCard } from "@/components/profile/PromoCodeCard";
import { SoundHapticsTestBox } from "@/components/profile/SoundHapticsTestBox";
import { TourGuidesCard } from "@/components/profile/TourGuidesCard";
import { LanguagePicker } from "@/components/profile/LanguagePicker";
import { LegalDocsList } from "@/components/profile/LegalDocsList";
import { DangerZoneCard } from "@/components/profile/DangerZoneCard";
import { profileSharedStyles } from "@/components/profile/profileSharedStyles";
import dayjs from "dayjs";
import { LazyPageTourModal, LazyDemoActionModal } from "@/components/ui/lazyMount";
import { useTranslation } from "react-i18next";
import { localizeServerError } from "@/lib/serverErrors";

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { session, signOut, profile, refreshProfile, isDemoMode, exitDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme, themeMode, setThemeMode, isLight } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState("");
  const [initialDisplayName, setInitialDisplayName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [gender, setGender] = useState<"male" | "female">("female");
  const [initialGender, setInitialGender] = useState<"male" | "female">("female");
  const [meetDate, setMeetDate] = useState("");
  const [initialMeetDate, setInitialMeetDate] = useState("");
  const [relStartDate, setRelStartDate] = useState("");
  const [initialRelStartDate, setInitialRelStartDate] = useState("");
  const [coupleId, setCoupleId] = useState<string | null>(null);

  // Cooldown zaman damgaları
  const [nameLastChangedAt, setNameLastChangedAt] = useState<string | null>(null);
  const [genderLastChangedAt, setGenderLastChangedAt] = useState<string | null>(null);
  const [datesStatus, setDatesStatus] = useState<DatesChangeStatus | null>(null);

  const [profileLoading, setProfileLoading] = useState(false);
  const [datesLoading, setDatesLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Premium Modal
  const [showPremiumSuccess, setShowPremiumSuccess] = useState(false);
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("profile");
  // Ekranın ilk karesinde yalnızca üst bölümler çizilir; kaydırınca görünen alt kartlar hemen ardından eklenir
  const showLowerSections = useDeferredReady();

  // Yasal Sözleşmeler Modal State
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [selectedLegalDoc, setSelectedLegalDoc] = useState<LegalDocType>("kvkk");

  const openLegal = (doc: LegalDocType) => {
    setSelectedLegalDoc(doc);
    setLegalModalVisible(true);
  };

  // Cooldown durumları (30 gün isim, 90 gün cinsiyet). Çift bazlı tarih hakları sunucudan gelir (datesStatus).
  const nameCooldown = useMemo(
    () => getCooldownStatus(nameLastChangedAt, 30),
    [nameLastChangedAt]
  );
  const genderCooldown = useMemo(
    () => getCooldownStatus(genderLastChangedAt, 90),
    [genderLastChangedAt]
  );

  // Değişiklik kontrolleri
  const isNameChanged = displayName.trim() !== initialDisplayName.trim();
  const isGenderChanged = gender !== initialGender;
  const hasProfileChanges = isNameChanged || isGenderChanged;

  const isMeetDateChanged = (meetDate || "") !== (initialMeetDate || "");
  const isRelDateChanged = (relStartDate || "") !== (initialRelStartDate || "");
  const hasDatesChanges = isMeetDateChanged || isRelDateChanged;

  // Demo profili sunucuya gitmeden, ilk çizimde bir kez doldurulur. Koşullu ve tek seferlik olduğundan
  // render sırasında durum ayarlanır (React'in önerdiği kalıp): efekt içinde setState ek bir yeniden çizim doğurur.
  if (isDemoMode && !dataLoaded) {
    const dName = DEMO_PROFILE.displayName ?? t("profile.guestName");
    setDisplayName(dName);
    setInitialDisplayName(dName);
    setGender("female");
    setInitialGender("female");
    setMeetDate(DEMO_PROFILE.meetDate ?? "");
    setInitialMeetDate(DEMO_PROFILE.meetDate ?? "");
    setRelStartDate(DEMO_PROFILE.relationshipStartDate ?? "");
    setInitialRelStartDate(DEMO_PROFILE.relationshipStartDate ?? "");
    setDataLoaded(true);
  }

  // Verileri yükle
  React.useEffect(() => {
    if (isDemoMode || !session?.user?.id || dataLoaded) return;
    const uid = session.user.id;
    (async () => {
      const { data: userData } = await supabase
        .from("users")
        .select("display_name, gender, couple_id, name_last_changed_at, gender_last_changed_at")
        .eq("id", uid)
        .single();

      if (userData) {
        const loadedName = profile?.displayName || userData.display_name || profile?.username || "";
        const loadedGender = (userData.gender as "male" | "female") ?? "female";

        setDisplayName(loadedName);
        setInitialDisplayName(loadedName);
        setGender(loadedGender);
        setInitialGender(loadedGender);
        setCoupleId(userData.couple_id ?? null);
        setNameLastChangedAt(userData.name_last_changed_at ?? null);
        setGenderLastChangedAt(userData.gender_last_changed_at ?? null);

        if (userData.couple_id) {
          const { data: coupleData } = await supabase
            .from("couples")
            .select("meet_date, relationship_start_date")
            .eq("id", userData.couple_id)
            .single();

          if (coupleData) {
            const mDate = coupleData.meet_date ?? "";
            const rDate = coupleData.relationship_start_date ?? "";
            setMeetDate(mDate);
            setInitialMeetDate(mDate);
            setRelStartDate(rDate);
            setInitialRelStartDate(rDate);
          }
          setDatesStatus(await fetchDatesChangeStatus());
        }
      }
      setDataLoaded(true);
    })();
  }, [session, dataLoaded]);

  // Profili Güncelle
  async function handleUpdateProfile() {
    if (executeOrIntercept(
      () => {},
      t("profile.demo.updateTitle"),
      t("profile.demo.updateDescription")
    )) {
      return;
    }
    if (!session?.user?.id) return;

    if (!hasProfileChanges) {
      toast.info(t("profile.toasts.noChanges"));
      return;
    }

    if (isNameChanged && displayName.trim().length < 2) {
      setNameError(true);
      toast.warning(t("profile.errors.nameTooShort"), { title: t("common.missingInformation") });
      return;
    }

    // Cooldown engelleri
    if (isNameChanged && !nameCooldown.canChange) {
      appAlert(
        t("profile.alerts.nameRestrictedTitle"),
        t("profile.alerts.nameRestricted", { count: nameCooldown.remainingDays }),
        [{ text: t("common.gotIt") }],
        { tone: "warning" }
      );
      return;
    }

    if (isGenderChanged && !genderCooldown.canChange) {
      appAlert(
        t("profile.alerts.genderRestrictedTitle"),
        t("profile.alerts.genderRestricted", { count: genderCooldown.remainingDays }),
        [{ text: t("common.gotIt") }],
        { tone: "warning" }
      );
      return;
    }

    // Onay diyalogları
    if (isNameChanged && isGenderChanged) {
      appAlert(
        t("profile.alerts.confirmBothTitle"),
        t("profile.alerts.confirmBothMessage"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.confirmAndSave"), style: "default", onPress: () => executeSaveProfile() },
        ],
        { tone: "warning" }
      );
      return;
    }

    if (isNameChanged) {
      appAlert(
        t("profile.alerts.confirmNameTitle"),
        t("profile.alerts.confirmNameMessage"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.confirmAndSave"), style: "default", onPress: () => executeSaveProfile() },
        ],
        { tone: "warning" }
      );
      return;
    }

    if (isGenderChanged) {
      appAlert(
        t("profile.alerts.confirmGenderTitle"),
        t("profile.alerts.confirmGenderMessage"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("common.confirmAndSave"), style: "default", onPress: () => executeSaveProfile() },
        ],
        { tone: "warning" }
      );
      return;
    }
  }

  async function executeSaveProfile() {
    if (!session?.user?.id) return;
    setProfileLoading(true);
    const cleanDisplayName = sanitizeStrict(displayName.trim());
    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, any> = {};

    if (isNameChanged) {
      updatePayload.display_name = cleanDisplayName;
      updatePayload.name_last_changed_at = nowIso;
    }
    if (isGenderChanged) {
      updatePayload.gender = gender;
      updatePayload.gender_last_changed_at = nowIso;
    }

    const { error } = await supabase
      .from("users")
      .update(updatePayload)
      .eq("id", session.user.id);
    setProfileLoading(false);

    if (error) {
      appAlert(t("common.error"), localizeServerError(error, t("profile.errors.updateFailed")));
    } else {
      if (isNameChanged) {
        setInitialDisplayName(cleanDisplayName);
        setNameLastChangedAt(nowIso);
      }
      if (isGenderChanged) {
        setInitialGender(gender);
        setGenderLastChangedAt(nowIso);
        // Anında tema ve stil senkronizasyonu
        setGlobalActiveTheme(gender, themeMode);
      }
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["user_gender"] });
      queryClient.invalidateQueries({ queryKey: ["period_logs"] });
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
      toast.success(t("profile.toasts.updated"));
    }
  }

  // İlişki Tarihlerini Güncelle
  async function handleUpdateDates() {
    if (executeOrIntercept(
      () => {},
      t("profile.demo.datesTitle"),
      t("profile.demo.datesDescription")
    )) {
      return;
    }
    if (!coupleId) return;

    if (!hasDatesChanges) {
      toast.info(t("profile.toasts.noDateChanges"));
      return;
    }

    if (!relStartDate) {
      toast.warning(t("setup.errors.relationshipDateRequired"), { title: t("profile.errors.missingDate") });
      return;
    }

    // Çift bazlı hak kontrolü (asıl denetim sunucuda; bu yalnızca erken bilgilendirme)
    if (datesStatus?.hasDates && datesStatus.remaining <= 0) {
      showDatesLimitAlert(datesStatus);
      return;
    }

    // Çift bazlı onay uyarısı
    const rightNote = !datesStatus || !datesStatus.hasDates
      ? t("profile.dates.firstSaveNote")
      : t("profile.dates.allowanceNote", { remaining: datesStatus.remaining });
    appAlert(
      t("profile.dates.updateTitle"),
      t("profile.dates.updateMessage", { rightNote }),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("profile.dates.confirmUpdate"), style: "default", onPress: () => executeSaveDates() },
      ],
      { tone: "warning" }
    );
  }

  function showDatesLimitAlert(status: DatesChangeStatus) {
    const days = daysUntilPeriodEnd(status.periodEndsAt);
    const when = status.periodEndsAt
      ? t("profile.dates.lockedWhenDate", { date: formatLongDate(status.periodEndsAt, i18n.language), days })
      : t("profile.dates.lockedWhenNext");
    appAlert(
      t("profile.dates.lockedTitle"),
      t("profile.dates.lockedMessage", { when }),
      [{ text: t("common.gotIt") }],
      { tone: "warning" }
    );
  }

  async function executeSaveDates() {
    if (!coupleId) return;
    setDatesLoading(true);
    const { data, error } = await supabase.rpc("change_relationship_dates", {
      p_relationship_start_date: relStartDate,
      p_meet_date: meetDate ? meetDate : null,
    });

    if (error) {
      setDatesLoading(false);
      if (error.message.includes("DATES_CHANGE_LIMIT")) {
        // Partner bu arada son hakkı kullanmış olabilir: güncel durumu göster
        const fresh = await fetchDatesChangeStatus();
        setDatesStatus(fresh);
        if (fresh) {
          showDatesLimitAlert(fresh);
          return;
        }
      }
      appAlert(t("common.error"), translateDatesError(error.message));
      return;
    }

    setInitialMeetDate(meetDate);
    setInitialRelStartDate(relStartDate);
    setDatesStatus(parseDatesChangeStatus(data));

    // Özel Günler / Anılar tablosundaki ilgili kartları senkronize et
    try {
      const { data: existingMemories } = await supabase
        .from("memories")
        .select("id, title, date")
        .eq("couple_id", coupleId)
        .in("title", DEFAULT_MEMORY_TITLE_LIST);

      const relMemory = existingMemories?.find((m) => m.title === DEFAULT_MEMORY_TITLES.relationship);
      if (relMemory) {
        if (relMemory.date !== relStartDate) {
          await supabase
            .from("memories")
            .update({ date: relStartDate })
            .eq("id", relMemory.id);
        }
      } else {
        await supabase.from("memories").insert({
          couple_id: coupleId,
          title: DEFAULT_MEMORY_TITLES.relationship,
          date: relStartDate,
          description: DEFAULT_MEMORY_DESCRIPTIONS.relationship,
          is_default: true,
        });
      }

      if (meetDate) {
        const meetMemory = existingMemories?.find((m) => m.title === DEFAULT_MEMORY_TITLES.meet);
        if (meetMemory) {
          if (meetMemory.date !== meetDate) {
            await supabase
              .from("memories")
              .update({ date: meetDate })
              .eq("id", meetMemory.id);
          }
        } else {
          await supabase.from("memories").insert({
            couple_id: coupleId,
            title: DEFAULT_MEMORY_TITLES.meet,
            date: meetDate,
            description: DEFAULT_MEMORY_DESCRIPTIONS.meet,
            is_default: true,
          });
        }
      }
    } catch (e) {
      console.warn("Özel günler senkronizasyonunda hata:", e);
    }

    setDatesLoading(false);
    await refreshProfile();
    queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["memories"] });
    queryClient.invalidateQueries({ queryKey: ["calendar_data"] });

    const parsedCoupleId = coupleId ? parseInt(coupleId, 10) : (profile?.coupleId ?? null);
    if (parsedCoupleId && session?.user?.id) {
      notifyPartner(
        parsedCoupleId,
        session.user.id,
        t("profile.push.datesUpdatedTitle"),
        t("profile.push.datesUpdatedBody", { name: displayName || t("common.yourPartner") }),
        { type: "milestone", route: "/(tabs)/home" }
      ).catch(() => {});
    }

    toast.success(t("profile.toasts.datesUpdated"));
  }

  // Çıkış Yap
  async function handleLogout() {
    if (isDemoMode) {
      exitDemoMode();
      router.replace("/(auth)/login");
      return;
    }
    appAlert(t("auth.signOut"), t("profile.signOut.message"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("auth.signOut"),
        style: "destructive",
        onPress: async () => {
          if (session?.user?.id) {
            await supabase
              .from("push_tokens")
              .delete()
              .eq("user_id", session.user.id);
          }
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  // Hesap Silme: sunucuda 7 gün sonrası için talep açılır, tüm cihazlarda oturum kapanır.
  // Silmeyi saatlik bir sunucu işi yapar (dosyalar, veriler, hesap); bu süre içinde aynı
  // hesapla giriş yapan kullanıcıya silmeyi iptal etme seçeneği sunulur (AuthContext).
  async function handleDeleteAccount() {
    if (executeOrIntercept(
      () => {},
      t("profile.demo.accountTitle"),
      t("profile.demo.accountDescription")
    )) {
      return;
    }
    appAlert(
      t("profile.delete.title"),
      t("profile.delete.message"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("profile.delete.confirm"), style: "destructive", onPress: confirmDeleteAccount },
      ]
    );
  }

  async function confirmDeleteAccount() {
    const userId = session?.user?.id;
    if (!userId) return;

    setDeleteLoading(true);
    const { data: scheduledFor, error } = await supabase.rpc("request_account_deletion");
    if (error || !scheduledFor) {
      setDeleteLoading(false);
      appAlert(t("common.error"), t("profile.delete.requestFailed"));
      return;
    }

    const deletionDay = dayjs(scheduledFor as string).format("D MMMM YYYY");
    // Partner ortak anıların silineceğini önceden bilsin (oturum kapanmadan gönderilmeli)
    if (profile?.coupleId && profile.isPaired) {
      await notifyPartner(
        profile.coupleId,
        userId,
        t("profile.push.deleteTitle"),
        t("profile.push.deleteBody", { deletionDay }),
        { type: "account_deletion" }
      );
    }

    await signOut();
    setDeleteLoading(false);
    router.replace("/(auth)/login");
    appAlert(
      t("auth.deletion.pendingTitle"),
      t("profile.delete.scheduledMessage", { deletionDay }),
      [{ text: t("common.ok") }],
      { forceDialog: true }
    );
  }

  // Demo modunda premium kilitleri yoktur: tüm özellikler açık
  const isPremium = (profile?.isPremium ?? false) || isDemoMode;
  const tokenBalance = profile?.tokenBalance ?? 0;

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
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t("tabs.profile.label")}</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]} numberOfLines={1}>{t("profile.subtitle")}</Text>
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

        {/* KAYDIRILABİLİR İÇERİK */}
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={StyleSheet.flatten([styles.scrollContent, { paddingBottom: insets.bottom + 280 }])}
          showsVerticalScrollIndicator={false}
          enableOnAndroid={true}
          extraScrollHeight={130}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── LÜKS PROFİL HERO KARTI ─── */}
          <View style={[styles.heroProfileCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
            <EditableAvatar name={displayName || t("common.userFallback")} size={54} />

            <View style={styles.heroDetails}>
              <Text style={[styles.heroNameText, { color: theme.text }]} numberOfLines={1}>
                {displayName || t("common.userFallback")}
              </Text>

              <View style={styles.badgesRow}>
                {isPremium ? (
                  <View style={styles.premiumBadge}>
                    <Crown size={12} color={isLight ? "#A16207" : "#ffd700"} />
                    <Text style={styles.premiumBadgeText}>{t("profile.membership.premium")}</Text>
                  </View>
                ) : (
                  <View style={styles.standardBadge}>
                    <ShieldCheck size={12} color={isLight ? theme.textSecondary : "rgba(255,255,255,0.6)"} />
                    <Text style={[styles.standardBadgeText, { color: theme.textSecondary }]}>{t("profile.membership.standard")}</Text>
                  </View>
                )}

                {coupleId ? (
                  <View style={[styles.pairedBadge, { backgroundColor: `${theme.accent}18` }]}>
                    <Heart size={11} color={theme.accent} fill={theme.accent} />
                    <Text style={[styles.pairedBadgeText, { color: theme.accent }]}>{t("profile.membership.paired")}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* ─── CÜZDAN & AYRICALIKLAR ─── */}
          <View style={[styles.walletCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
            <View style={styles.walletHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={[styles.walletIconCircle, { backgroundColor: theme.pillAccentBg }]}>
                  <Wallet size={18} color={theme.accent} />
                </View>
                <View>
                  <Text style={[styles.walletCardTitle, { color: theme.text }]}>{t("profile.wallet.title")}</Text>
                  <Text style={[styles.walletCardSub, { color: theme.textMuted }]}>{t("profile.wallet.current")}</Text>
                </View>
              </View>

              <View style={styles.tokenPill}>
                <Text style={styles.tokenEmoji}>🪙</Text>
                <Text style={styles.tokenAmountText}>{tokenBalance}</Text>
              </View>
            </View>
          </View>

          {/* ─── TEMA & GÖRÜNÜM TERCİHİ ─── */}
          <ThemePicker
            theme={theme}
            isLight={isLight}
            gender={gender}
            themeMode={themeMode}
            onSelectTheme={setThemeMode}
          />

          {/* ─── DİL SEÇİMİ (Türkçe / English) ─── */}
          <LanguagePicker theme={theme} isLight={isLight} />

          {/* ─── ALT BAR MENÜSÜ ÖZELLEŞTİRME ─── */}
          <TabBarCustomizer theme={theme} isLight={isLight} />

          {showLowerSections && (
            <>
              {/* ─── KİŞİSEL BİLGİLER ─── */}
              <PersonalInfoForm
                theme={theme}
                isLight={isLight}
                displayName={displayName}
                nameError={nameError}
                gender={gender}
                loading={profileLoading}
                nameCooldown={nameCooldown}
                genderCooldown={genderCooldown}
                hasChanges={hasProfileChanges}
                onChangeDisplayName={(val) => {
                  setDisplayName(val);
                  setNameError(false);
                }}
                onSelectGender={(g) => {
                  setGender(g);
                }}
                onSave={handleUpdateProfile}
              />

              {/* ─── İLİŞKİ TARİHLERİ ─── */}
              {coupleId && (
                <RelationshipDatesCard
                  theme={theme}
                  isLight={isLight}
                  meetDate={meetDate}
                  relStartDate={relStartDate}
                  loading={datesLoading}
                  datesStatus={datesStatus}
                  hasChanges={hasDatesChanges}
                  onChangeMeetDate={setMeetDate}
                  onChangeRelStartDate={setRelStartDate}
                  onSave={handleUpdateDates}
                />
              )}

              {/* ─── PROMOSYON KODLARI ─── */}
              <PromoCodeCard
                theme={theme}
                isLight={isLight}
                executeOrIntercept={executeOrIntercept}
                refreshProfile={refreshProfile}
                onPremiumSuccess={() => setShowPremiumSuccess(true)}
              />

              {/* ─── SES & DOKUNSAL EFEKTLER (AUDIO & HAPTICS) ─── */}
              <SoundHapticsTestBox theme={theme} isLight={isLight} />

              {/* ─── UYGULAMA REHBERLERİ & TANITIMLAR ─── */}
              <TourGuidesCard theme={theme} isLight={isLight} onOpenTour={openTour} />

              {/* ─── OTURUM & GÜVENLİK ─── */}
              <ModernSection
                title={t("profile.session.title")}
                icon={<LogOut size={18} color={theme.accent} />}
                theme={theme}
                defaultOpen={false}
              >
                <Text style={[profileSharedStyles.sessionHintText, { color: theme.textMuted }]}>
                  {t("profile.session.description")}
                </Text>

                <TouchableOpacity
                  onPress={handleLogout}
                  style={[
                    profileSharedStyles.logoutBtn,
                    {
                      backgroundColor: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
                      borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.1)",
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <LogOut size={16} color={theme.text} />
                  <Text style={[profileSharedStyles.logoutBtnText, { color: theme.text }]}>{t("auth.signOut")}</Text>
                </TouchableOpacity>
              </ModernSection>

              {/* ─── YASAL BİLGİLER & GİZLİLİK SÖZLEŞMELERİ ─── */}
              <LegalDocsList theme={theme} onOpenDoc={openLegal} />

              {/* ─── TEHLİKE BÖLGESİ ─── */}
              <DangerZoneCard
                theme={theme}
                isLight={isLight}
                loading={deleteLoading}
                onDeleteAccount={handleDeleteAccount}
              />

            </>
          )}

          {/* Alt Tab Bar İçin Ekstra Ferah Boşluk */}
          <View style={{ height: 120 }} />
        </KeyboardAwareScrollView>
      </View>

      <PremiumSuccessModal
        visible={showPremiumSuccess}
        onClose={() => setShowPremiumSuccess(false)}
      />

      <LegalModal
        visible={legalModalVisible}
        onClose={() => setLegalModalVisible(false)}
        initialDoc={selectedLegalDoc}
        accentColor={theme.accent}
      />
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
      gap: 14,
    },

    /* HERO PROFİL KARTI */
    heroProfileCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderRadius: 22,
      borderWidth: 1,
      gap: 14,
    },
    heroDetails: {
      flex: 1,
    },
    heroNameText: {
      fontSize: 17,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      letterSpacing: -0.2,
      marginBottom: 6,
    },
    badgesRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    premiumBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(255, 215, 0, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(255, 215, 0, 0.3)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    premiumBadgeText: {
      color: isLight ? "#A16207" : "#ffd700",
      fontSize: 11.5,
      fontFamily: "Inter_600SemiBold",
    },
    standardBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    standardBadgeText: {
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.6)",
      fontSize: 11.5,
      fontFamily: "Inter_500Medium",
    },
    pairedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    pairedBadgeText: {
      fontSize: 11.5,
      fontFamily: "Inter_600SemiBold",
    },

    /* CÜZDAN KARTI */
    walletCard: {
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
    },
    walletHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    walletIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    walletCardTitle: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: theme.text,
    },
    walletCardSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.5)",
    },
    tokenPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: "rgba(255, 215, 0, 0.12)",
      borderWidth: 1,
      borderColor: "rgba(255, 215, 0, 0.3)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
    },
    tokenEmoji: {
      fontSize: 15,
    },
    tokenAmountText: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: isLight ? "#A16207" : "#ffd700",
    },
  });
};
