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
import { encrypt, decrypt } from "@/utils/crypto";
import { sanitizeStrict } from "@/utils/sanitize";
import { toast } from "@/lib/toast";
import { usePageTour } from "@/hooks/usePageTour";
import { useDeferredReady } from "@/hooks/useDeferredReady";
import { PageTourModal } from "@/components/tour/PageTourModal";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { useDemoAction } from "@/hooks/useDemoAction";
import { DemoActionModal } from "@/components/demo/DemoActionModal";
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
import { LegalDocsList } from "@/components/profile/LegalDocsList";
import { DangerZoneCard } from "@/components/profile/DangerZoneCard";
import { profileSharedStyles } from "@/components/profile/profileSharedStyles";
import dayjs from "dayjs";
import "dayjs/locale/tr";

dayjs.locale("tr");

export default function ProfileScreen() {
  const { session, signOut, profile, refreshProfile, isDemoMode, exitDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme, themeMode, setThemeMode, isLight } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [gender, setGender] = useState<"male" | "female">("female");
  const [meetDate, setMeetDate] = useState("");
  const [relStartDate, setRelStartDate] = useState("");
  const [coupleId, setCoupleId] = useState<string | null>(null);

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

  // Demo profili sunucuya gitmeden, ilk çizimde bir kez doldurulur
  if (isDemoMode && !dataLoaded) {
    setDisplayName(DEMO_PROFILE.displayName ?? "Misafir (Demo)");
    setGender("female");
    setMeetDate(DEMO_PROFILE.meetDate ?? "");
    setRelStartDate(DEMO_PROFILE.relationshipStartDate ?? "");
    setDataLoaded(true);
  }

  // Verileri yükle
  React.useEffect(() => {
    if (isDemoMode || !session?.user?.id || dataLoaded) return;
    const uid = session.user.id;
    (async () => {
      const { data: userData } = await supabase
        .from("users")
        .select("display_name, gender, couple_id")
        .eq("id", uid)
        .single();

      if (userData) {
        let cleanName = profile?.displayName;
        if (!cleanName && userData.display_name) {
          const dec = decrypt(userData.display_name);
          if (dec && !dec.startsWith("enc:") && !dec.startsWith("det:")) {
            cleanName = dec;
          }
        }
        if (!cleanName && userData.display_name && !userData.display_name.startsWith("enc:") && !userData.display_name.startsWith("det:")) {
          cleanName = userData.display_name;
        }
        setDisplayName(cleanName || profile?.username || "");
        setGender((userData.gender as "male" | "female") ?? "female");
        setCoupleId(userData.couple_id ?? null);

        if (userData.couple_id) {
          const { data: coupleData } = await supabase
            .from("couples")
            .select("meet_date, relationship_start_date")
            .eq("id", userData.couple_id)
            .single();

          if (coupleData) {
            setMeetDate(coupleData.meet_date ?? "");
            setRelStartDate(coupleData.relationship_start_date ?? "");
          }
        }
      }
      setDataLoaded(true);
    })();
  }, [session, dataLoaded]);

  // Profili Güncelle
  async function handleUpdateProfile() {
    if (executeOrIntercept(
      () => {},
      "Profili Güncellemek İçin Kayıt Olun 👤",
      "Kişisel profilinizi ve tercihlerinizi kaydetmek için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }
    if (!session?.user?.id) return;
    if (displayName.trim().length < 2) {
      setNameError(true);
      toast.warning("Lütfen en az 2 karakterden oluşan bir isim girin.", { title: "Eksik bilgi" });
      return;
    }
    setProfileLoading(true);
    const cleanDisplayName = sanitizeStrict(displayName.trim());
    const { error } = await supabase
      .from("users")
      .update({ display_name: encrypt(cleanDisplayName), gender })
      .eq("id", session.user.id);
    setProfileLoading(false);

    if (error) {
      appAlert("Hata", "Profil güncellenemedi. Lütfen tekrar deneyin.");
    } else {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["user_gender"] });
      toast.success("Profil bilgilerin güncellendi ✨");
    }
  }

  // İlişki Tarihlerini Güncelle
  async function handleUpdateDates() {
    if (executeOrIntercept(
      () => {},
      "İlişki Tarihlerini Belirlemek İçin Kayıt Olun 💕",
      "Tanışma ve sevgililik tarihinizi kaydetmek, sayaçları başlatmak için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }
    if (!coupleId) return;
    if (!relStartDate) {
      toast.warning("Lütfen sevgililik tarihinizi belirleyin.", { title: "Eksik tarih" });
      return;
    }
    setDatesLoading(true);
    const { error } = await supabase
      .from("couples")
      .update({
        meet_date: meetDate ? meetDate : null,
        relationship_start_date: relStartDate,
      })
      .eq("id", coupleId);
    setDatesLoading(false);

    if (error) {
      appAlert("Hata", "Tarihler güncellenemedi. Lütfen tekrar deneyin.");
    } else {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
      toast.success("İlişki tarihlerin güncellendi 💕");
    }
  }

  // Çıkış Yap
  async function handleLogout() {
    if (isDemoMode) {
      exitDemoMode();
      router.replace("/(auth)/login");
      return;
    }
    appAlert("Çıkış Yap", "Hesabınızdan çıkış yapmak istediğinize emin misiniz?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Çıkış Yap",
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
      "Hesap İşlemleri İçin Giriş Yapın 👤",
      "Hesabınızı yönetmek veya silmek için geçerli bir hesabınız olmalıdır."
    )) {
      return;
    }
    appAlert(
      "⚠️ Hesabını Sil",
      "Hesabın ve ilişkinize ait tüm fotoğraflar, mektuplar, günlükler ve anılar 7 gün sonra kalıcı olarak silinir. Partnerinin hesabı kalır ancak ortak veriler onun için de silinir.\n\nBu 7 gün içinde aynı hesapla giriş yaparak silmeyi iptal edebilirsin.\n\nAktif bir aboneliğin varsa App Store veya Google Play üzerinden ayrıca iptal etmelisin.",
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Evet, Hesabımı Sil", style: "destructive", onPress: confirmDeleteAccount },
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
      appAlert("Hata", "Silme talebi oluşturulamadı. Lütfen bağlantını kontrol edip tekrar dene.");
      return;
    }

    const deletionDay = dayjs(scheduledFor as string).format("D MMMM YYYY");
    // Partner ortak anıların silineceğini önceden bilsin (oturum kapanmadan gönderilmeli)
    if (profile?.coupleId && profile.isPaired) {
      await notifyPartner(
        profile.coupleId,
        userId,
        "Hesap silme talebi",
        `Partnerin hesabını silme talebinde bulundu. Ortak anılarınız ${deletionDay} tarihinde kalıcı olarak silinecek.`,
        { type: "account_deletion" }
      );
    }

    await signOut();
    setDeleteLoading(false);
    router.replace("/(auth)/login");
    appAlert(
      "Hesabın silinmek üzere",
      `Hesabın ve tüm verilerin ${deletionDay} tarihinde kalıcı olarak silinecek. Fikrini değiştirirsen bu tarihe kadar giriş yapıp silmeyi iptal edebilirsin.`,
      [{ text: "Tamam" }],
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
            <Text style={[styles.headerTitle, { color: theme.text }]}>Ayarlar</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>Profil & Hesap Tercihleri ⚙️</Text>
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
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 280 }]}
          showsVerticalScrollIndicator={false}
          enableOnAndroid={true}
          extraScrollHeight={130}
          keyboardShouldPersistTaps="handled"
        >
          {/* ─── LÜKS PROFİL HERO KARTI ─── */}
          <View style={[styles.heroProfileCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
            <EditableAvatar name={displayName || "Kullanıcı"} size={54} />

            <View style={styles.heroDetails}>
              <Text style={[styles.heroNameText, { color: theme.text }]} numberOfLines={1}>
                {displayName || "Kullanıcı"}
              </Text>

              <View style={styles.badgesRow}>
                {isPremium ? (
                  <View style={styles.premiumBadge}>
                    <Crown size={12} color={isLight ? "#A16207" : "#ffd700"} />
                    <Text style={styles.premiumBadgeText}>Premium Üye</Text>
                  </View>
                ) : (
                  <View style={styles.standardBadge}>
                    <ShieldCheck size={12} color={isLight ? theme.textSecondary : "rgba(255,255,255,0.6)"} />
                    <Text style={[styles.standardBadgeText, { color: theme.textSecondary }]}>Standart Üye</Text>
                  </View>
                )}

                {coupleId ? (
                  <View style={[styles.pairedBadge, { backgroundColor: `${theme.accent}18` }]}>
                    <Heart size={11} color={theme.accent} fill={theme.accent} />
                    <Text style={[styles.pairedBadgeText, { color: theme.accent }]}>Eşleşildi</Text>
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
                  <Text style={[styles.walletCardTitle, { color: theme.text }]}>Cüzdan & Bakiye</Text>
                  <Text style={[styles.walletCardSub, { color: theme.textMuted }]}>Mevcut Jetonların</Text>
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
                onChangeDisplayName={(val) => {
                  setDisplayName(val);
                  setNameError(false);
                }}
                onSelectGender={(g) => {
                  setGender(g);
                  setGlobalActiveTheme(g, themeMode);
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
                title="Oturum & Güvenlik"
                icon={<LogOut size={18} color={theme.accent} />}
                theme={theme}
                defaultOpen={false}
              >
                <Text style={[profileSharedStyles.sessionHintText, { color: theme.textMuted }]}>
                  Cihazınızdan güvenli bir şekilde çıkış yapın. Bildirim jetonlarınız temizlenecektir.
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
                  <Text style={[profileSharedStyles.logoutBtnText, { color: theme.text }]}>Çıkış Yap</Text>
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
