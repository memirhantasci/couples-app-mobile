import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  StyleSheet
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { WatchAdModal } from "@/components/ui/WatchAdModal";
import { PremiumSuccessModal } from "@/components/ui/PremiumSuccessModal";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { getTheme, AppTheme, getAvailableThemes, ThemeMode, setGlobalActiveTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { encrypt, decrypt } from "@/utils/crypto";
import DateTimePicker from "@react-native-community/datetimepicker";
import { RevenueCatService } from "@/lib/revenuecat";
import { usePageTour, resetAllPageTours } from "@/hooks/usePageTour";
import { PageTourModal } from "@/components/tour/PageTourModal";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import {
  User,
  Gift,
  CalendarHeart,
  LogOut,
  Trash2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlignJustify,
  Wallet,
  PlayCircle,
  Sparkles,
  Crown,
  Calendar,
  ShieldCheck,
  Heart,
  Lock,
  ChevronLeft,
  FileText,
  CreditCard,
  UserCheck,
  Palette,
  Check,
  LayoutGrid,
  RotateCcw,
} from "lucide-react-native";
import { useTabBar } from "@/context/TabBarContext";
import { LegalModal } from "@/components/legal/LegalModal";
import { LegalDocType } from "@/constants/legalTexts";
import dayjs from "dayjs";
import "dayjs/locale/tr";

dayjs.locale("tr");

// ─── Modern Grup Kartı ────────────────────────────────────────────────────────
function ModernSection({
  title,
  icon,
  children,
  theme,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  theme: AppTheme;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
      <TouchableOpacity
        activeOpacity={0.78}
        onPress={() => setIsOpen(!isOpen)}
        style={styles.sectionHeader}
      >
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
            {icon}
          </View>
          <Text style={[styles.sectionTitleText, { color: theme.text }]}>{title}</Text>
        </View>

        <View style={styles.chevronWrapper}>
          {isOpen ? (
            <ChevronUp size={18} color={theme.textMuted} />
          ) : (
            <ChevronDown size={18} color={theme.textMuted} />
          )}
        </View>
      </TouchableOpacity>

      {isOpen && (
        <View style={[styles.sectionContent, { borderTopColor: theme.cardBorder }]}>
          {children}
        </View>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const { session, signOut, profile, refreshProfile } = useAuth();
  const { theme, themeMode, setThemeMode, isLight } = useTheme();
  const { enabledTabs, allTabs, toggleTab, isTabEnabled, resetTabs, maxTabs } = useTabBar();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [gender, setGender] = useState<"male" | "female">("female");
  const [meetDate, setMeetDate] = useState("");
  const [relStartDate, setRelStartDate] = useState("");
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [deletionDate, setDeletionDate] = useState<string | null>(null);

  const [showMeetDatePicker, setShowMeetDatePicker] = useState(false);
  const [showRelDatePicker, setShowRelDatePicker] = useState(false);

  const [profileLoading, setProfileLoading] = useState(false);
  const [datesLoading, setDatesLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Promosyon Kodu
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  // Reklam & Premium Modal
  const [showAdModal, setShowAdModal] = useState(false);
  const [showPremiumSuccess, setShowPremiumSuccess] = useState(false);
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("profile");

  // Yasal Sözleşmeler Modal State
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [selectedLegalDoc, setSelectedLegalDoc] = useState<LegalDocType>("kvkk");

  const openLegal = (doc: LegalDocType) => {
    setSelectedLegalDoc(doc);
    setLegalModalVisible(true);
  };

  // Verileri yükle
  React.useEffect(() => {
    if (!session?.user?.id || dataLoaded) return;
    const uid = session.user.id;
    (async () => {
      const { data: userData } = await supabase
        .from("users")
        .select("display_name, gender, couple_id")
        .eq("id", uid)
        .single();

      if (userData) {
        setDisplayName(userData.display_name ? (decrypt(userData.display_name) || userData.display_name) : "");
        setGender((userData.gender as "male" | "female") ?? "female");
        setCoupleId(userData.couple_id ?? null);

        if (userData.couple_id) {
          const { data: coupleData } = await supabase
            .from("couples")
            .select("meet_date, relationship_start_date, deletion_scheduled_at")
            .eq("id", userData.couple_id)
            .single();

          if (coupleData) {
            setMeetDate(coupleData.meet_date ?? "");
            setRelStartDate(coupleData.relationship_start_date ?? "");
            setDeletionDate(coupleData.deletion_scheduled_at ?? null);
          }
        }
      }
      setDataLoaded(true);
    })();
  }, [session, dataLoaded]);

  // Profili Güncelle
  async function handleUpdateProfile() {
    if (!session?.user?.id) return;
    if (displayName.trim().length < 2) {
      setNameError(true);
      Alert.alert("Eksik Bilgi", "Lütfen en az 2 karakterden oluşan bir isim girin.");
      return;
    }
    setProfileLoading(true);
    const { error } = await supabase
      .from("users")
      .update({ display_name: encrypt(displayName.trim()), gender })
      .eq("id", session.user.id);
    setProfileLoading(false);

    if (error) {
      Alert.alert("Hata", "Profil güncellenemedi. Lütfen tekrar deneyin.");
    } else {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["user_gender"] });
      Alert.alert("Başarılı ✨", "Profil bilgileriniz başarıyla güncellendi!");
    }
  }

  // İlişki Tarihlerini Güncelle
  async function handleUpdateDates() {
    if (!coupleId) return;
    if (!meetDate || !relStartDate) {
      Alert.alert("Eksik Tarih", "Lütfen her iki tarihi de belirleyin.");
      return;
    }
    setDatesLoading(true);
    const { error } = await supabase
      .from("couples")
      .update({ meet_date: meetDate, relationship_start_date: relStartDate })
      .eq("id", coupleId);
    setDatesLoading(false);

    if (error) {
      Alert.alert("Hata", "Tarihler güncellenemedi. Lütfen tekrar deneyin.");
    } else {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["home_dashboard"] });
      Alert.alert("Başarılı 💕", "İlişki tarihleriniz güncellendi!");
    }
  }

  // Çıkış Yap
  async function handleLogout() {
    Alert.alert("Çıkış Yap", "Hesabınızdan çıkış yapmak istediğinize emin misiniz?", [
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

  // Promosyon Kodu
  async function handleRedeemPromo() {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;

    if (code === "FREEMIRHAN") {
      setPromoLoading(true);
      const { error } = await supabase.rpc("set_premium_status", { p_is_premium: true, p_expires_at: null });
      if (error) {
        Alert.alert("Hata", "Premium aktif edilemedi.");
      } else {
        await refreshProfile();
        setPromoCode("");
        setShowPremiumSuccess(true);
      }
      setPromoLoading(false);
      return;
    }

    if (code === "DELETEMIRHAN") {
      setPromoLoading(true);
      const { error } = await supabase.rpc("set_premium_status", { p_is_premium: false, p_expires_at: null });
      if (error) {
        Alert.alert("Hata", "Premium iptal edilemedi.");
      } else {
        await refreshProfile();
        setPromoCode("");
        Alert.alert("Bilgi", "Premium başarıyla sonlandırıldı.");
      }
      setPromoLoading(false);
      return;
    }

    setPromoLoading(true);
    try {
      const { data, error } = await supabase.rpc("redeem_promo_code", {
        p_code: code
      });
      if (error) throw error;
      
      await refreshProfile();
      
      if (data?.reward_type === "premium") {
        setShowPremiumSuccess(true);
      } else {
        Alert.alert(
          "Tebrikler! 🎉",
          `${data?.reward_amount} Token hesabınıza yüklendi!` 
        );
      }
      
      setPromoCode("");
    } catch (err: any) {
      Alert.alert("Hata", err.message || "Promosyon kodu kullanılamadı.");
    } finally {
      setPromoLoading(false);
    }
  }

  // Hesap Silme
  async function handleDeleteAccount() {
    Alert.alert(
      "⚠️ Hesabını Sil",
      "Eğer hesabınızı silerseniz, tüm fotoğraflarınız, mektuplarınız ve hatıralarınız 1 hafta sonra kalıcı olarak silinir.\n\nBu 1 hafta içinde herhangi biriniz giriş yaparsa silinme otomatik iptal edilir.\n\nOnaylıyor musunuz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Evet, Hesabımı Sil",
          style: "destructive",
          onPress: async () => {
            if (!coupleId) {
              Alert.alert("Hata", "Çift bilgisi bulunamadı.");
              return;
            }
            setDeleteLoading(true);
            const deletionScheduledAt = new Date();
            deletionScheduledAt.setDate(deletionScheduledAt.getDate() + 7);

            const { error } = await supabase
              .from("couples")
              .update({ deletion_scheduled_at: deletionScheduledAt.toISOString() })
              .eq("id", coupleId);

            setDeleteLoading(false);

            if (error) {
              Alert.alert("Hata", "İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.");
              return;
            }

            if (session?.user?.id) {
              await supabase.from("push_tokens").delete().eq("user_id", session.user.id);
            }
            await signOut();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  }

  const isPremium = profile?.isPremium ?? false;
  const tokenBalance = profile?.tokenBalance ?? 0;
  const initialLetter = displayName ? displayName.trim().charAt(0).toUpperCase() : "U";

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
          <View style={[styles.heroProfileCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={[styles.avatarCircle, { backgroundColor: theme.pillAccentBg, borderColor: theme.accent }]}>
              <Text style={[styles.avatarText, { color: theme.accent }]}>{initialLetter}</Text>
            </View>

            <View style={styles.heroDetails}>
              <Text style={[styles.heroNameText, { color: theme.text }]} numberOfLines={1}>
                {displayName || "Kullanıcı"}
              </Text>
              
              <View style={styles.badgesRow}>
                {isPremium ? (
                  <View style={styles.premiumBadge}>
                    <Crown size={12} color="#ffd700" />
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
          <View style={[styles.walletCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
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

            <View style={styles.walletDivider} />

            <TouchableOpacity
              onPress={() => setShowAdModal(true)}
              activeOpacity={0.85}
              style={[styles.watchAdBtn, { borderColor: `${theme.accent}40`, backgroundColor: `${theme.accent}12` }]}
            >
              <PlayCircle color={theme.accent} size={18} />
              <Text style={[styles.watchAdBtnText, { color: theme.accent }]}>
                Reklam İzle & +100 Token Kazan
              </Text>
            </TouchableOpacity>
          </View>

          {/* SİLİNME UYARISI */}
          {deletionDate && (
            <View style={styles.deletionWarningBox}>
              <Text style={styles.deletionWarningTitle}>⚠️ Hesabınız Silinmek Üzere</Text>
              <Text style={styles.deletionWarningText}>
                {dayjs(deletionDate).format("D MMMM YYYY")} tarihinde hesabınız kalıcı olarak silinecektir. Uygulamayı kullanmaya devam ederek bu işlemi iptal edebilirsiniz.
              </Text>
            </View>
          )}

          {/* ─── TEMA & GÖRÜNÜM TERCİHİ ─── */}
          <ModernSection 
            title="Arayüz & Tema Modu" 
            icon={<Palette size={18} color={theme.accent} />} 
            theme={theme}
            defaultOpen={true}
          >
            <View style={{ gap: 10 }}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {gender === "female" ? "KADIN ARAYÜZ MODLARI 🌸" : "ERKEK ARAYÜZ MODLARI ⚡"}
              </Text>

              <View style={styles.themeOptionsContainer}>
                {getAvailableThemes(gender).map((t) => {
                  const isSelected = themeMode === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      activeOpacity={0.82}
                      onPress={() => {
                        setThemeMode(t.id);
                      }}
                      style={[
                        styles.themeOptionCard,
                        {
                          backgroundColor: theme.unitBg,
                          borderColor: isSelected ? theme.accent : (isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"),
                          borderWidth: isSelected ? 2 : 1,
                        }
                      ]}
                    >
                      {/* Renk Paleti Önizleme */}
                      <View style={styles.palettePreviewRow}>
                        <View style={[styles.colorDot, { backgroundColor: t.previewColors[0] }]} />
                        <View style={[styles.colorDot, { backgroundColor: t.previewColors[1] }]} />
                        <View style={[styles.colorDot, { backgroundColor: t.previewColors[2] }]} />
                      </View>

                      {/* Bilgi */}
                      <View style={styles.themeInfoBlock}>
                        <View style={styles.themeTitleRow}>
                          <Text style={[styles.themeOptionTitle, { color: theme.text }]}>
                            {t.name}
                          </Text>
                          {isSelected ? (
                            <View style={[styles.activeThemeCheck, { backgroundColor: theme.accent }]}>
                              <Check size={12} color="#ffffff" strokeWidth={3} />
                            </View>
                          ) : (
                            <View style={[styles.inactiveThemeCheck, { borderColor: isLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)" }]} />
                          )}
                        </View>
                        <Text style={[styles.themeOptionDesc, { color: theme.textMuted }]}>
                          {t.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ModernSection>

          {/* ─── ALT BAR MENÜSÜ ÖZELLEŞTİRME ─── */}
          <ModernSection 
            title="Alt Bar Menüsü Özelleştirme" 
            icon={<LayoutGrid size={18} color={theme.accent} />} 
            theme={theme}
            defaultOpen={true}
          >
            <View style={{ gap: 12 }}>
              <View style={styles.tabSectionHeaderRow}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  SEÇİLEN SEKMELER ({enabledTabs.length}/{maxTabs})
                </Text>
                <TouchableOpacity 
                  onPress={resetTabs} 
                  style={[styles.resetTabsBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)" }]}
                  activeOpacity={0.7}
                >
                  <RotateCcw size={12} color={theme.accent} />
                  <Text style={[styles.resetTabsText, { color: theme.accent }]}>Sıfırla</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionSubtitleText, { color: theme.textMuted }]}>
                Alt barda hızlıca erişmek istediğiniz sayfaları seçin. Kullanmadığınız sekmeleri (örn. ilaç takibi yapmıyorsanız İlaçlar'ı) kaldırıp yerine Galeri, Notlar veya Buluşma ekleyebilirsiniz.
              </Text>

              {/* Canlı Önizleme Çubuğu */}
              <View 
                style={[
                  styles.tabPreviewStrip, 
                  { 
                    backgroundColor: theme.unitBg,
                    borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
                  }
                ]}
              >
                <Text style={[styles.tabPreviewTitle, { color: theme.textSecondary }]}>
                  Aktif Alt Bar Önizlemesi
                </Text>

                <View style={styles.tabPreviewCapsulesRow}>
                  {enabledTabs.map((key) => {
                    const item = allTabs.find((t) => t.key === key);
                    if (!item) return null;
                    const ItemIcon = item.Icon;
                    return (
                      <View 
                        key={key} 
                        style={[
                          styles.tabPreviewCapsule,
                          { 
                            backgroundColor: theme.pillAccentBg,
                            borderColor: theme.pillAccentBorder,
                          }
                        ]}
                      >
                        <ItemIcon size={12} color={theme.accent} />
                        <Text style={[styles.tabPreviewCapsuleText, { color: theme.text }]} numberOfLines={1}>
                          {item.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Tüm Sayfaların Listesi & Seçim */}
              <View style={styles.tabItemsList}>
                {allTabs.map((item) => {
                  const isEnabled = isTabEnabled(item.key);
                  const isMandatory = item.isMandatory;
                  const ItemIcon = item.Icon;

                  return (
                    <TouchableOpacity
                      key={item.key}
                      activeOpacity={isMandatory ? 1 : 0.78}
                      onPress={() => toggleTab(item.key)}
                      style={[
                        styles.tabOptionCard,
                        {
                          backgroundColor: theme.unitBg,
                          borderColor: isEnabled 
                            ? theme.accent 
                            : (isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)"),
                          borderWidth: isEnabled ? 1.5 : 1,
                        }
                      ]}
                    >
                      <View style={styles.tabOptionLeft}>
                        <View 
                          style={[
                            styles.tabOptionIconBox, 
                            { 
                              backgroundColor: isEnabled ? theme.pillAccentBg : (isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.05)"),
                              borderColor: isEnabled ? theme.pillAccentBorder : "transparent"
                            }
                          ]}
                        >
                          <ItemIcon 
                            size={18} 
                            color={isEnabled ? theme.accent : theme.textMuted} 
                          />
                        </View>

                        <View style={styles.tabOptionInfo}>
                          <View style={styles.tabOptionTitleRow}>
                            <Text style={[styles.tabOptionTitle, { color: theme.text }]}>
                              {item.label}
                            </Text>
                            {isMandatory && (
                              <View style={[styles.mandatoryBadge, { backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)" }]}>
                                <Lock size={9} color={theme.textMuted} />
                                <Text style={[styles.mandatoryBadgeText, { color: theme.textMuted }]}>Zorunlu</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.tabOptionDesc, { color: theme.textMuted }]} numberOfLines={1}>
                            {item.description}
                          </Text>
                        </View>
                      </View>

                      {/* Sağ Taraf: Aktiflik Durumu */}
                      <View style={styles.tabOptionRight}>
                        {isMandatory ? (
                          <View style={[styles.activeTabCheck, { backgroundColor: theme.accent }]}>
                            <Check size={12} color="#ffffff" strokeWidth={3} />
                          </View>
                        ) : isEnabled ? (
                          <View style={[styles.activeTabCheck, { backgroundColor: theme.accent }]}>
                            <Check size={12} color="#ffffff" strokeWidth={3} />
                          </View>
                        ) : (
                          <View style={[styles.inactiveTabCheck, { borderColor: isLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)" }]} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ModernSection>

          {/* ─── KİŞİSEL BİLGİLER ─── */}
          <ModernSection 
            title="Kişisel Bilgiler" 
            icon={<User size={18} color={theme.accent} />} 
            theme={theme}
            defaultOpen={true}
          >
            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>GÖRÜNEN İSİM</Text>
              <TextInput
                style={[
                  styles.textInput, 
                  { 
                    backgroundColor: theme.unitBg,
                    color: theme.text,
                    borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)"
                  },
                  nameError && styles.inputError
                ]}
                value={displayName}
                onChangeText={(val) => {
                  setDisplayName(val);
                  setNameError(false);
                }}
                placeholder="Adınız..."
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>CİNSİYET TERCİHİ</Text>
              <View style={styles.genderSelectRow}>
                {(["female", "male"] as const).map((g) => {
                  const isSelected = gender === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      onPress={() => {
                        setGender(g);
                        setGlobalActiveTheme(g, themeMode);
                      }}
                      activeOpacity={0.8}
                      style={[
                        styles.genderBtn,
                        { 
                          backgroundColor: theme.unitBg,
                          borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)"
                        },
                        isSelected && {
                          borderColor: theme.accent,
                          backgroundColor: theme.pillAccentBg,
                          borderWidth: 1.5,
                        }
                      ]}
                    >
                      <Text style={{ fontSize: 16 }}>{g === "female" ? "🌸" : "⚡"}</Text>
                      <Text 
                        style={[
                          styles.genderBtnText,
                          { color: isSelected ? (isLight ? theme.accent : "#ffffff") : theme.textSecondary },
                          isSelected && { fontFamily: "Inter_700Bold" }
                        ]}
                      >
                        {g === "female" ? "Kadın" : "Erkek"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.actionSaveBtn, { backgroundColor: theme.accent }]}
              onPress={handleUpdateProfile}
              disabled={profileLoading}
              activeOpacity={0.88}
            >
              {profileLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.actionSaveBtnText}>Değişiklikleri Kaydet</Text>
              )}
            </TouchableOpacity>
          </ModernSection>

          {/* ─── İLİŞKİ TARİHLERİ ─── */}
          {coupleId && (
            <ModernSection 
              title="İlişki Tarihleri" 
              icon={<CalendarHeart size={18} color={theme.accent} />} 
              theme={theme}
              defaultOpen={false}
            >
              <View style={styles.inputGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>TANIŞMA TARİHİ</Text>
                <TouchableOpacity
                  onPress={() => setShowMeetDatePicker(true)}
                  style={[styles.datePickerBtn, { backgroundColor: theme.unitBg, borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)" }]}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Calendar size={18} color={theme.accent} />
                    <Text style={[styles.datePickerBtnText, { color: theme.text }]}>
                      {meetDate ? dayjs(meetDate).format("DD MMMM YYYY") : "Tarih Seçiniz"}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={theme.textMuted} />
                </TouchableOpacity>

                {showMeetDatePicker && (
                  <DateTimePicker
                    value={meetDate ? new Date(meetDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={(_, selectedDate) => {
                      setShowMeetDatePicker(Platform.OS === 'ios');
                      if (selectedDate) {
                        setMeetDate(dayjs(selectedDate).format("YYYY-MM-DD"));
                      }
                    }}
                  />
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>SEVGİLİ OLMA TARİHİ</Text>
                <TouchableOpacity
                  onPress={() => setShowRelDatePicker(true)}
                  style={[styles.datePickerBtn, { backgroundColor: theme.unitBg, borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)" }]}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Heart size={18} color={theme.accent} />
                    <Text style={[styles.datePickerBtnText, { color: theme.text }]}>
                      {relStartDate ? dayjs(relStartDate).format("DD MMMM YYYY") : "Tarih Seçiniz"}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={theme.textMuted} />
                </TouchableOpacity>

                {showRelDatePicker && (
                  <DateTimePicker
                    value={relStartDate ? new Date(relStartDate) : new Date()}
                    mode="date"
                    display="default"
                    onChange={(_, selectedDate) => {
                      setShowRelDatePicker(Platform.OS === 'ios');
                      if (selectedDate) {
                        setRelStartDate(dayjs(selectedDate).format("YYYY-MM-DD"));
                      }
                    }}
                  />
                )}
              </View>

              <TouchableOpacity 
                style={[styles.actionSaveBtn, { backgroundColor: theme.accent }]}
                onPress={handleUpdateDates}
                disabled={datesLoading}
                activeOpacity={0.88}
              >
                {datesLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.actionSaveBtnText}>Tarihleri Güncelle 💕</Text>
                )}
              </TouchableOpacity>
            </ModernSection>
          )}

          {/* ─── PROMOSYON KODLARI ─── */}
          <ModernSection 
            title="Promosyon & Hediye Kodu" 
            icon={<Gift size={18} color={theme.accent} />} 
            theme={theme}
            defaultOpen={false}
          >
            <Text style={[styles.promoHintText, { color: theme.textMuted }]}>
              Özel bir indirim veya hediye kodunuz varsa buraya girerek hesabınıza tanımlayabilirsiniz.
            </Text>

            <View style={styles.promoInputRow}>
              <TextInput
                style={[
                  styles.promoTextInput, 
                  { 
                    backgroundColor: theme.unitBg,
                    color: theme.text,
                    borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)"
                  }
                ]}
                placeholder="HEDİYE KODU"
                placeholderTextColor={isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)"}
                value={promoCode}
                onChangeText={setPromoCode}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                onPress={handleRedeemPromo}
                disabled={promoLoading || !promoCode.trim()}
                style={[
                  styles.promoApplyBtn,
                  { backgroundColor: theme.accent },
                  (!promoCode.trim() || promoLoading) && { opacity: 0.5 }
                ]}
                activeOpacity={0.85}
              >
                {promoLoading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.promoApplyBtnText}>Kullan</Text>
                )}
              </TouchableOpacity>
            </View>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                onPress={() => RevenueCatService.presentCodeRedemptionSheet()}
                style={[styles.iosCodeBtn, { backgroundColor: theme.unitBg }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.iosCodeBtnText, { color: theme.textSecondary }]}>App Store Teklif Kodu Kullan 🍎</Text>
              </TouchableOpacity>
            )}
          </ModernSection>

          {/* ─── UYGULAMA REHBERLERİ & TANITIMLAR ─── */}
          <ModernSection 
            title="Tanıtımlar & Özellik Rehberleri" 
            icon={<Sparkles size={18} color={theme.accent} />} 
            theme={theme}
            defaultOpen={false}
          >
            <Text style={[styles.sessionHintText, { color: theme.textMuted }]}>
              Uygulamadaki tüm sayfaların ve özelliklerin ne işe yaradığını dilediğiniz an baştan inceleyebilirsiniz.
            </Text>
            
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={openTour}
                style={[
                  styles.logoutBtn, 
                  { 
                    backgroundColor: theme.pillAccentBg,
                    borderColor: theme.pillAccentBorder
                  }
                ]}
                activeOpacity={0.8}
              >
                <Sparkles size={16} color={theme.accent} />
                <Text style={[styles.logoutBtnText, { color: theme.accent }]}>Bu Sayfanın Rehberini Aç 💡</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  await resetAllPageTours();
                  Alert.alert("Sıfırlandı 🎉", "Tüm sayfaların ilk açılış tanıtım turları sıfırlandı. Sayfaları ziyaret ettiğinizde tanıtımlar baştan gösterilecektir.");
                }}
                style={[
                  styles.logoutBtn, 
                  { 
                    backgroundColor: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
                    borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)"
                  }
                ]}
                activeOpacity={0.8}
              >
                <Text style={[styles.logoutBtnText, { color: theme.text }]}>Tüm Sayfa Tanıtımlarını Baştan Başlat 🔄</Text>
              </TouchableOpacity>
            </View>
          </ModernSection>

          {/* ─── OTURUM & GÜVENLİK ─── */}
          <ModernSection 
            title="Oturum & Güvenlik" 
            icon={<LogOut size={18} color={theme.accent} />} 
            theme={theme}
            defaultOpen={false}
          >
            <Text style={[styles.sessionHintText, { color: theme.textMuted }]}>
              Cihazınızdan güvenli bir şekilde çıkış yapın. Bildirim jetonlarınız temizlenecektir.
            </Text>
            
            <TouchableOpacity
              onPress={handleLogout}
              style={[
                styles.logoutBtn, 
                { 
                  backgroundColor: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
                  borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.1)"
                }
              ]}
              activeOpacity={0.8}
            >
              <LogOut size={16} color={theme.text} />
              <Text style={[styles.logoutBtnText, { color: theme.text }]}>Çıkış Yap</Text>
            </TouchableOpacity>
          </ModernSection>

          {/* ─── YASAL BİLGİLER & GİZLİLİK SÖZLEŞMELERİ ─── */}
          <ModernSection 
            title="Yasal & Gizlilik Sözleşmeleri" 
            icon={<ShieldCheck size={18} color={theme.accent} />} 
            theme={theme}
            defaultOpen={false}
          >
            <Text style={[styles.sessionHintText, { color: theme.textMuted }]}>
              Verilerinizin güvenliği, gizliliğiniz ve mevzuat haklarınızla ilgili tüm yasal metinleri dilediğiniz zaman inceleyebilirsiniz.
            </Text>

            <View style={styles.legalListContainer}>
              {([
                { id: "kvkk" as const, title: "KVKK Aydınlatma Metni", sub: "6698 Sayılı Kanun Kapsamında Bilgilendirme", icon: ShieldCheck },
                { id: "privacy" as const, title: "Gizlilik Politikası", sub: "Veri Koruma, Şifreleme ve Güvenlik İlkeleri", icon: Lock },
                { id: "terms" as const, title: "Kullanım Koşulları (EULA)", sub: "Kullanıcı Sözleşmesi ve Genel Kurallar", icon: FileText },
                { id: "consent" as const, title: "Açık Rıza Metni", sub: "Sağlık ve Konum Verilerinin İşlenmesi", icon: UserCheck },
                { id: "subscription" as const, title: "Abonelik ve İade Şartları", sub: "Mesafeli Satış, İptal ve Yenileme", icon: CreditCard },
              ]).map((item) => {
                const ItemIcon = item.icon;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => openLegal(item.id)}
                    style={[styles.legalItemCard, { backgroundColor: theme.unitBg }]}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.legalItemIconBox, { backgroundColor: theme.pillAccentBg }]}>
                      <ItemIcon size={16} color={theme.accent} />
                    </View>
                    <View style={styles.legalItemTextBox}>
                      <Text style={[styles.legalItemTitle, { color: theme.text }]}>{item.title}</Text>
                      <Text style={[styles.legalItemSub, { color: theme.textMuted }]}>{item.sub}</Text>
                    </View>
                    <ChevronRight size={16} color={theme.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </ModernSection>

          {/* ─── TEHLİKE BÖLGESİ ─── */}
          <ModernSection 
            title="Hesap Yönetimi & Tehlike Bölgesi" 
            icon={<Trash2 size={18} color="#ff4d6a" />} 
            theme={theme}
            defaultOpen={false}
          >
            <View style={[styles.dangerNoticeBox, isLight && { backgroundColor: "rgba(255, 77, 106, 0.08)", borderColor: "rgba(255, 77, 106, 0.25)" }]}>
              <Text style={styles.dangerNoticeTitle}>⚠️ KVKK md. 11 Kapsamında Veri İmhası</Text>
              <Text style={[styles.dangerNoticeText, { color: isLight ? "#991B1B" : "rgba(255,255,255,0.7)" }]}>
                Unutulma hakkınız uyarınca hesabınızı sildiğinizde, ilişkinize ait tüm ortak fotoğraflar, şifreli mektuplar, günlükler ve veriler 7 günlük cayma süresi sonunda sunucularımızdan kalıcı olarak imha edilir.
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleDeleteAccount}
              disabled={deleteLoading}
              style={styles.deleteAccountBtn}
              activeOpacity={0.8}
            >
              {deleteLoading ? (
                <ActivityIndicator color="#ff4d6a" size="small" />
              ) : (
                <Text style={styles.deleteAccountBtnText}>Hesabımı ve Tüm Verileri Sil</Text>
              )}
            </TouchableOpacity>
          </ModernSection>

          {/* Alt Tab Bar İçin Ekstra Ferah Boşluk */}
          <View style={{ height: 120 }} />
        </KeyboardAwareScrollView>
      </View>

      <WatchAdModal
        visible={showAdModal}
        onClose={() => setShowAdModal(false)}
        onSuccess={() => setShowAdModal(false)}
      />

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
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  heroDetails: {
    flex: 1,
  },
  heroNameText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
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
    color: "#ffd700",
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
  standardBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  standardBadgeText: {
    color: "rgba(255,255,255,0.6)",
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
    color: "#ffffff",
  },
  walletCardSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
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
    color: "#ffd700",
  },
  walletDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 14,
  },
  watchAdBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  watchAdBtnText: {
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
  },

  /* BÖLÜM KARTLARI */
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitleText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  chevronWrapper: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    gap: 14,
  },

  /* FORM ALANLARI */
  inputGroup: {
    marginTop: 12,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.5,
  },
  textInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 14.5,
    fontFamily: "Inter_400Regular",
  },
  inputError: {
    borderColor: "#ff4d6a",
    borderWidth: 1.5,
  },
  genderSelectRow: {
    flexDirection: "row",
    gap: 10,
  },
  genderBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  genderBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.6)",
  },
  actionSaveBtn: {
    marginTop: 14,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  actionSaveBtnText: {
    color: "#ffffff",
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },

  /* TARİH SEÇİCİ */
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  datePickerBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#ffffff",
  },

  /* PROMOSYON KODU */
  promoHintText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    lineHeight: 18,
    marginTop: 10,
  },
  promoInputRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  promoTextInput: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 14.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  promoApplyBtn: {
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  promoApplyBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  iosCodeBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  iosCodeBtnText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },

  /* OTURUM */
  sessionHintText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    lineHeight: 18,
    marginTop: 10,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginTop: 10,
  },
  logoutBtnText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },

  /* TEHLİKE */
  dangerNoticeBox: {
    backgroundColor: "rgba(255, 77, 106, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 106, 0.25)",
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    gap: 6,
  },
  dangerNoticeTitle: {
    color: "#ff4d6a",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  dangerNoticeText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  deleteAccountBtn: {
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "rgba(255, 77, 106, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 106, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteAccountBtnText: {
    color: "#ff4d6a",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },

  /* SİLİNME UYARISI */
  deletionWarningBox: {
    backgroundColor: "rgba(255, 77, 106, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 106, 0.3)",
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  deletionWarningTitle: {
    color: "#ff4d6a",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  deletionWarningText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },

  /* YASAL METİNLER LİSTESİ */
  legalListContainer: {
    marginTop: 12,
    gap: 8,
  },
  legalItemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    gap: 12,
  },
  legalItemIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  legalItemTextBox: {
    flex: 1,
  },
  legalItemTitle: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  legalItemSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },

  /* TEMA SEÇİCİ */
  themeOptionsContainer: {
    gap: 10,
    marginTop: 4,
  },
  themeOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    borderRadius: 16,
    gap: 12,
  },
  palettePreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 6,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  colorDot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  themeInfoBlock: {
    flex: 1,
  },
  themeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  themeOptionTitle: {
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },
  themeOptionDesc: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  activeThemeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  inactiveThemeCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },

  /* ALT BAR MENÜSÜ ÖZELLEŞTİRME */
  tabSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionSubtitleText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  resetTabsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
  },
  resetTabsText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
  tabPreviewStrip: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    gap: 10,
    marginTop: 2,
  },
  tabPreviewTitle: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  tabPreviewCapsulesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
  },
  tabPreviewCapsule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabPreviewCapsuleText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
  tabItemsList: {
    gap: 8,
    marginTop: 4,
  },
  tabOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 16,
    gap: 12,
  },
  tabOptionLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tabOptionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  tabOptionInfo: {
    flex: 1,
    gap: 2,
  },
  tabOptionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tabOptionTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  mandatoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mandatoryBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  tabOptionDesc: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
  },
  tabOptionRight: {
    paddingLeft: 4,
  },
  activeTabCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  inactiveTabCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
});

