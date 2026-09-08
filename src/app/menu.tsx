import React, { useState } from "react";
import { 
  View, Text, TouchableOpacity, StyleSheet, 
  ScrollView, Platform, Alert, Modal 
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { 
  X, Heart, Settings, Home, Pill, CalendarHeart, 
  Droplet, MapPin, LogOut, ChevronRight, User, 
  BookOpen, Mail, Images, Camera, Sparkles, ShieldCheck,
  Calendar, Clock, ImagePlus, HelpCircle, Check, Bell, Orbit
} from "lucide-react-native";
import { NotificationShowcaseModal } from "@/components/notifications/NotificationShowcaseModal";
import { useAuth } from "@/context/AuthContext";
import { getTheme } from "@/lib/theme";
import { decrypt, deterministicDecrypt } from "@/utils/crypto";
import { dayjs, daysSince } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LegalModal } from "@/components/legal/LegalModal";
import { FEATURE_GUIDES } from "@/constants/featureGuides";
import { PageTourModal } from "@/components/tour/PageTourModal";
import { resetAllPageTours } from "@/hooks/usePageTour";
import { useDemoAction } from "@/hooks/useDemoAction";
import { DemoActionModal } from "@/components/demo/DemoActionModal";
import { CoupleWrappedModal } from "@/components/wrapped/CoupleWrappedModal";
import { computeCoupleWrapped, CoupleWrappedData } from "@/utils/wrappedCalculator";

export default function MenuScreen() {
  const router = useRouter();
  const { profile, session, signOut, isDemoMode, exitDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme, isLight } = useTheme();
  const styles = React.useMemo(() => getMenuStyles(theme, isLight), [theme, isLight]);
  const insets = useSafeAreaInsets();
  const [legalVisible, setLegalVisible] = React.useState(false);
  const [selectedTourPage, setSelectedTourPage] = useState<string | null>(null);
  const [showGuideCatalog, setShowGuideCatalog] = useState(false);
  const [showWrapped, setShowWrapped] = useState(false);
  const [wrappedData, setWrappedData] = useState<CoupleWrappedData | null>(null);
  const [showNotificationShowcase, setShowNotificationShowcase] = useState(false);

  const relDate = profile?.relationshipStartDate;
  const coupleId = profile?.coupleId;

  React.useEffect(() => {
    computeCoupleWrapped(coupleId || null, relDate, isDemoMode).then((data) => setWrappedData(data));
  }, [coupleId, relDate, isDemoMode]);

  const handleRoute = (path: string) => {
    router.back();
    setTimeout(() => {
      router.push(path as any);
    }, 120);
  };

  const handleSignOut = async () => {
    try {
      if (isDemoMode) {
        exitDemoMode();
        return;
      }
      await signOut();
    } finally {
      router.replace("/(auth)/login" as any);
    }
  };
  
  const daysSinceTogether = relDate ? daysSince(dayjs(relDate)) : 0;
  const currentUserId = session?.user?.id;

  const { data: partnerName } = useQuery({
    queryKey: ["partner_name", coupleId],
    enabled: !!coupleId && !!currentUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("display_name, username")
        .eq("couple_id", coupleId)
        .neq("id", currentUserId)
        .maybeSingle();

      if (data?.display_name) {
        const dec = decrypt(data.display_name);
        if (dec && !dec.startsWith("enc:")) return dec;
      }
      if (data?.username) {
        const dec = deterministicDecrypt(data.username);
        if (dec && !dec.startsWith("det:")) return dec;
      }
      return "Sevgilin";
    },
    staleTime: 1000 * 60 * 60,
  });

  const displayName = profile?.displayName || "Kullanıcı";
  const initialLetter = displayName.charAt(0).toUpperCase();

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Uygulama Menüsü</Text>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={[styles.closeBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : theme.cardBg, borderColor: theme.cardBorder }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X color={theme.text} size={18} />
          </TouchableOpacity>
        </View>

        <ScrollView 
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── DEMO SÜRÜMÜ BİLGİLENDİRME KARTI ─── */}
          {isDemoMode && (
            <View style={styles.demoCard}>
              <LinearGradient
                colors={["rgba(255, 46, 99, 0.18)", "rgba(255, 107, 139, 0.08)"]}
                style={styles.demoCardGradient}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <Sparkles size={18} color="#FF2E63" />
                  <Text style={styles.demoCardTitle}>Demo Modundasınız ✨</Text>
                </View>
                <Text style={styles.demoCardDesc}>
                  Uygulamayı kayıt olmadan inceliyorsunuz. Sevgilinizle ortak alanınızı başlatıp anılarınızı kaydetmek için kaydolun.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    router.back();
                    exitDemoMode();
                    router.replace({ pathname: "/(auth)/login", params: { initialMode: "register" } });
                  }}
                  style={styles.demoCardBtn}
                  activeOpacity={0.88}
                >
                  <Text style={styles.demoCardBtnText}>Ücretsiz Kayıt Ol 💖</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}

          {/* ─── LÜKS ÇİFT PROFİL KARTI ─── */}
          <View style={[styles.profileCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={[styles.avatarCircle, { backgroundColor: theme.pillAccentBg, borderColor: theme.accent }]}>
              <Text style={[styles.avatarLetter, { color: theme.accent }]}>{initialLetter}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
              <View style={styles.profileSubtitleRow}>
                <Heart size={11} color={theme.accent} fill={theme.accent} />
                <Text style={[styles.profileSubtitle, { color: theme.textSecondary }]}>
                  {displayName} & {partnerName || "Sevgilin"} • {daysSinceTogether} Gün
                </Text>
              </View>
            </View>
          </View>

          {/* ─── KATEGORİ 1: AŞK & ANILAR (ANA BÖLÜMLER) ─── */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeaderLabel}>AŞK & ORTAK ANILAR</Text>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => handleRoute("/our-star")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Orbit color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Bizim Yıldızımız ✨</Text>
                <Text style={styles.menuSub}>Gökyüzündeki sonsuz dijital anıtınız</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => handleRoute("/(tabs)/home")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Home color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Ana Sayfa</Text>
                <Text style={styles.menuSub}>Günün özeti ve aşk ölçer</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => handleRoute("/(tabs)/photos")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Images color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Ortak Galeri</Text>
                <Text style={styles.menuSub}>Birlikte biriktirdiğiniz fotoğraflar</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => {
                if (executeOrIntercept(
                  () => handleRoute("/(tabs)/add-photo"),
                  "Ortak Fotoğraf Eklemek İçin Kayıt Olun 📸",
                  "Sevgilinizle ortak anı albümü oluşturmak ve fotoğraflarınızın çekildiği yerleri haritada görmek için ücretsiz hesabınızı oluşturun."
                )) {
                  return;
                }
                handleRoute("/(tabs)/add-photo");
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <ImagePlus color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Fotoğraf Yükle</Text>
                <Text style={styles.menuSub}>Yeni anı ve fotoğraf paylaş</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => handleRoute("/(tabs)/daily-notes")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <BookOpen color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Günlüğüm</Text>
                <Text style={styles.menuSub}>Sana özel şifreli not defterin</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: "rgba(255, 77, 109, 0.35)" }]} 
              onPress={() => setShowWrapped(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: "rgba(255, 77, 109, 0.2)" }]}>
                <Sparkles color="#FF4D6D" size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Couple Wrapped ✨</Text>
                <Text style={styles.menuSub}>Aylık ve yıllık romantik özetiniz</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => handleRoute("/(tabs)/letters")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Mail color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Mektuplar</Text>
                <Text style={styles.menuSub}>Zaman kilitli aşk mektupları</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => handleRoute("/(tabs)/memories")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Heart color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Özel Günler & Yıldönümleri</Text>
                <Text style={styles.menuSub}>Unutulmaz tarihlerin geri sayımı</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => handleRoute("/(tabs)/calendar")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <CalendarHeart color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Aşk Takvimi</Text>
                <Text style={styles.menuSub}>Ruh halleri, notlar ve fotoğraflar</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => handleRoute("/(tabs)/map")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <MapPin color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Aşk Haritası</Text>
                <Text style={styles.menuSub}>Fotoğraflı anılar ve mühürlü aşk notları</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => handleRoute("/(tabs)/meetings")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Clock color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Buluşmalar</Text>
                <Text style={styles.menuSub}>Geri sayım ve buluşma planları</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>
          </View>

          {/* ─── KATEGORİ 2: SAĞLIK & ÖZEL TAKİP ─── */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeaderLabel}>SAĞLIK & TAKİP</Text>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => handleRoute("/(tabs)/medicine")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Pill color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>İlaç Takibi</Text>
                <Text style={styles.menuSub}>Senin ve sevgilinin günlük dozları</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => handleRoute("/(tabs)/period-tracker")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Droplet color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Döngü & Regl Takvimi</Text>
                <Text style={styles.menuSub}>Hassas dönemler ve hatırlatıcılar</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>
          </View>

          {/* ─── KATEGORİ 3: AYARLAR & HESAP ─── */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeaderLabel}>HESAP & AYARLAR</Text>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => setShowNotificationShowcase(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Bell color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.menuTitle}>Özel Bildirim Tasarımları</Text>
                  <View style={{ backgroundColor: theme.accent, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6 }}>
                    <Text style={{ fontSize: 9.5, fontWeight: "800", color: "#fff" }}>YENİ</Text>
                  </View>
                </View>
                <Text style={styles.menuSub}>Mektup, ilaç ve anı bildirim vitrini</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => setShowGuideCatalog(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <HelpCircle color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Nasıl Çalışır? (Özellik Rehberi)</Text>
                <Text style={styles.menuSub}>Her sayfa ve özelliğin detaylı tanıtımı</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => handleRoute("/(tabs)/profile")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Settings color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Ayarlar & Profil</Text>
                <Text style={styles.menuSub}>Sesler, temalar, tarihler ve güvenlik</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]} 
              onPress={() => setLegalVisible(true)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <ShieldCheck color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>Yasal Bilgiler & Gizlilik</Text>
                <Text style={styles.menuSub}>KVKK, gizlilik ve kullanım şartları</Text>
              </View>
              <ChevronRight color="rgba(255,255,255,0.35)" size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.logoutItem, { backgroundColor: "rgba(255, 77, 106, 0.08)", borderColor: "rgba(255, 77, 106, 0.25)" }]} 
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: "rgba(255, 77, 106, 0.15)" }]}>
                <LogOut color="#ff4d6a" size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={[styles.menuTitle, { color: "#ff4d6a" }]}>Çıkış Yap</Text>
                <Text style={styles.menuSub}>Oturumu güvenli bir şekilde kapat</Text>
              </View>
              <ChevronRight color="rgba(255, 77, 106, 0.4)" size={18} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      <LegalModal
        visible={legalVisible}
        onClose={() => setLegalVisible(false)}
        accentColor={theme.accent}
      />

      {/* ÖZEL BİLDİRİM TASARIMLARI VİTRİN MODALI */}
      <NotificationShowcaseModal
        visible={showNotificationShowcase}
        onClose={() => setShowNotificationShowcase(false)}
      />

      {/* REHBER KATALOĞU SEÇİM MODALI */}
      <Modal
        visible={showGuideCatalog}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGuideCatalog(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
          <View style={{ backgroundColor: isLight ? "#fff" : "#1A1624", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%", padding: 20, paddingBottom: insets.bottom + 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text }}>Özellik Rehberleri</Text>
                <Text style={{ fontSize: 12, color: theme.textMuted }}>İncelemek istediğiniz sayfayı seçin</Text>
              </View>
              <TouchableOpacity onPress={() => setShowGuideCatalog(false)} style={{ padding: 6 }}>
                <X color={theme.text} size={20} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
              {Object.values(FEATURE_GUIDES).map((g) => (
                <TouchableOpacity
                  key={g.pageKey}
                  onPress={() => {
                    setShowGuideCatalog(false);
                    setTimeout(() => setSelectedTourPage(g.pageKey), 200);
                  }}
                  style={{ flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 14, backgroundColor: isLight ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)" }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: theme.text }}>{g.title}</Text>
                    <Text style={{ fontSize: 12, color: theme.textMuted }}>{g.tagline}</Text>
                  </View>
                  <ChevronRight size={16} color={theme.textMuted} />
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                onPress={async () => {
                  await resetAllPageTours();
                  setShowGuideCatalog(false);
                  Alert.alert("Sıfırlandı 🎉", "Tüm tanıtım turları sıfırlandı. Sayfalara girdiğinizde ilk defa giriyormuşsunuz gibi turlar otomatik açılacaktır.");
                }}
                style={{ marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: theme.pillAccentBg, borderWidth: 1, borderColor: theme.pillAccentBorder, alignItems: "center" }}
              >
                <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 14 }}>Tüm Tanıtımları Baştan Başlat 🔄</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* SEÇİLEN SAYFA TURU MODALI */}
      {selectedTourPage && (
        <PageTourModal
          visible={!!selectedTourPage}
          guide={FEATURE_GUIDES[selectedTourPage]}
          onClose={() => setSelectedTourPage(null)}
        />
      )}

      <DemoActionModal
        visible={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        title={modalConfig.title}
        description={modalConfig.description}
      />

      <CoupleWrappedModal
        visible={showWrapped}
        onClose={() => setShowWrapped(false)}
        data={wrappedData}
        partnerName={partnerName || "Sevgilin"}
        theme={theme}
      />
    </ScreenBackground>
  );
}

const getMenuStyles = (theme: any, isLight: boolean) => StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: theme.text,
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 20,
  },

  /* PROFİL KARTI */
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
  },
  avatarCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16.5,
    fontFamily: "Inter_700Bold",
    color: theme.text,
    marginBottom: 4,
  },
  profileSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  profileSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: theme.textSecondary,
  },

  /* BÖLÜM KAPLARI */
  sectionContainer: {
    gap: 10,
  },
  sectionHeaderLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: theme.textMuted,
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
  },
  logoutItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    marginTop: 4,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: theme.text,
    letterSpacing: -0.2,
  },
  menuSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: theme.textMuted,
    marginTop: 2,
  },
  demoCard: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.2,
    borderColor: "rgba(255, 46, 99, 0.35)",
    marginBottom: 12,
  },
  demoCardGradient: {
    padding: 16,
  },
  demoCardTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  demoCardDesc: {
    color: "rgba(255, 255, 255, 0.75)",
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    marginBottom: 12,
  },
  demoCardBtn: {
    backgroundColor: "#FF2E63",
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  demoCardBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Inter_700Bold",
  },
});
