import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from "react-native";
import { appAlert } from "@/lib/dialog";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { X, Heart, Settings, Home, Pill, CalendarHeart, Droplet, MapPin, LogOut, ChevronRight, BookOpen, Mail, Images, Sparkles, ShieldCheck, Clock, ImagePlus, HelpCircle, Orbit } from "lucide-react-native";
import { useAuth } from "@/context/AuthContext";

import { dayjs, daysSince } from "@/lib/date";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LegalModal } from "@/components/legal/LegalModal";
import { getAllPageGuides, getPageGuide } from "@/constants/featureGuides";
import { resetAllPageTours } from "@/hooks/usePageTour";
import { useDeferredReady } from "@/hooks/useDeferredReady";
import { useDemoAction } from "@/hooks/useDemoAction";
import { EditableAvatar } from "@/components/avatar/EditableAvatar";
import { LazyPageTourModal, LazyDemoActionModal } from "@/components/ui/lazyMount";
import { useTranslation } from "react-i18next";

export default function MenuScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, session, signOut, isDemoMode, exitDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme, isLight } = useTheme();
  const styles = React.useMemo(() => getMenuStyles(theme, isLight), [theme, isLight]);
  const insets = useSafeAreaInsets();
  const guides = React.useMemo(() => getAllPageGuides(t), [t]);
  const [legalVisible, setLegalVisible] = React.useState(false);
  const [selectedTourPage, setSelectedTourPage] = useState<string | null>(null);
  const [showGuideCatalog, setShowGuideCatalog] = useState(false);
  // Menü her açılışta baştan kurulur: ilk karede ilk kategori çizilir, ekran dışındaki sağlık ve hesap
  // kategorileri hemen ardından eklenir (açılış animasyonu JS iş parçacığı kilitli kalmadan başlar)
  const showLowerSections = useDeferredReady();

  const relDate = profile?.relationshipStartDate;
  const coupleId = profile?.coupleId;

  const isNavigatingRef = React.useRef(false);

  const handleClose = () => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 600);

    if (router.canDismiss?.()) {
      router.dismiss();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/home");
    }
  };

  const handleRoute = (path: string) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 600);

    // Menü, sekmelerin (tabs) ÜSTÜNDE duran bir modal. Bir sekmeye giderken önce kapatıp
    // sonra bir kare sonra push edersek, modal kapanma animasyonu boyunca (birkaç yüz ms)
    // önceki sekme görünür kalır — kullanıcı istediği sekmeye değil, eski sekmeye bakar.
    // `push` + `dismiss` ise YANLIŞ: menü kök yığının odaktaki ekranı olduğu için push, mevcut
    // sekmelere geçmek yerine kök yığına İKİNCİ bir (tabs) ekranı ekler, dismiss de onu kapatır
    // ve menü açık kalır. `dismissTo` menüyü kaldırmayı ve hedef sekmeye geçmeyi tek adımda yapar:
    // ne ikinci bir ekran oluşur ne de eski sekme görünür.
    const isTabRoute = path.startsWith("/(tabs)/");

    if (isTabRoute) {
      router.dismissTo(path as any);
      return;
    }

    // Sekme dışı rotalar (ör. /our-star, /paywall): bunlar kök yığına yeni bir ekran olarak
    // eklenir, modalın üstüne değil. dismiss() hedefinin belirsizleşmemesi için eski sıra
    // (önce kapat, sonra bir kare sonra it) korunur.
    if (router.canDismiss?.()) {
      router.dismiss();
      requestAnimationFrame(() => {
        router.push(path as any);
      });
    } else if (router.canGoBack()) {
      router.back();
      requestAnimationFrame(() => {
        router.push(path as any);
      });
    } else {
      router.replace(path as any);
    }
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

      return data?.display_name || data?.username || t("common.partnerFallback");
    },
    staleTime: 1000 * 60 * 60,
  });

  const displayName = profile?.displayName || t("common.userFallback");

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t("menu.title")}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.close")} 
            onPress={handleClose} 
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
                  <Text style={styles.demoCardTitle}>{t("menu.demo.title")}</Text>
                </View>
                <Text style={styles.demoCardDesc}>
                  {t("menu.demo.description")}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    exitDemoMode();
                    router.replace({ pathname: "/(auth)/login", params: { initialMode: "register" } });
                  }}
                  style={styles.demoCardBtn}
                  activeOpacity={0.88}
                >
                  <Text style={styles.demoCardBtnText}>{t("menu.demo.signUp")}</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          )}

          {/* ─── LÜKS ÇİFT PROFİL KARTI ─── */}
          <View style={[styles.profileCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
            <EditableAvatar name={displayName} size={50} />
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
              <View style={styles.profileSubtitleRow}>
                <Heart size={11} color={theme.accent} fill={theme.accent} />
                <Text style={[styles.profileSubtitle, { color: theme.textSecondary }]}>
                  {displayName} & {partnerName || t("common.partnerFallback")}{relDate ? ` • ${t("menu.daysTogether", { count: daysSinceTogether })}` : ""}
                </Text>
              </View>
            </View>
          </View>

          {/* ─── KATEGORİ 1: AŞK & ANILAR (ANA BÖLÜMLER) ─── */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionHeaderLabel}>{t("menu.sections.love")}</Text>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]} 
              onPress={() => handleRoute("/our-star")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Orbit color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{t("menu.ourStar.title")}</Text>
                <Text style={styles.menuSub}>{t("menu.ourStar.subtitle")}</Text>
              </View>
              <ChevronRight color={theme.textMuted} size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]} 
              onPress={() => handleRoute("/(tabs)/home")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Home color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{t("tabs.home.label")}</Text>
                <Text style={styles.menuSub}>{t("menu.home.subtitle")}</Text>
              </View>
              <ChevronRight color={theme.textMuted} size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]} 
              onPress={() => handleRoute("/(tabs)/photos")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Images color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{t("notifications.push.gallery.subtitle")}</Text>
                <Text style={styles.menuSub}>{t("menu.gallery.subtitle")}</Text>
              </View>
              <ChevronRight color={theme.textMuted} size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]} 
              onPress={() => {
                if (executeOrIntercept(
                  () => handleRoute("/(tabs)/add-photo"),
                  t("demo.prompts.addPhoto.title"),
                  t("demo.prompts.addPhoto.description")
                )) {
                  return;
                }
                if (!profile?.isPremium) {
                  handleRoute("/paywall");
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
                <Text style={styles.menuTitle}>{t("menu.upload.title")}</Text>
                <Text style={styles.menuSub}>{t("menu.upload.subtitle")}</Text>
              </View>
              <ChevronRight color={theme.textMuted} size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]} 
              onPress={() => handleRoute("/(tabs)/daily-notes")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <BookOpen color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{t("menu.journal.title")}</Text>
                <Text style={styles.menuSub}>{t("menu.journal.subtitle")}</Text>
              </View>
              <ChevronRight color={theme.textMuted} size={18} />
            </TouchableOpacity>


            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]} 
              onPress={() => handleRoute("/(tabs)/letters")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Mail color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{t("tabs.letters.label")}</Text>
                <Text style={styles.menuSub}>{t("menu.letters.subtitle")}</Text>
              </View>
              <ChevronRight color={theme.textMuted} size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]} 
              onPress={() => handleRoute("/(tabs)/memories")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Heart color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{t("menu.specialDays.title")}</Text>
                <Text style={styles.menuSub}>{t("menu.specialDays.subtitle")}</Text>
              </View>
              <ChevronRight color={theme.textMuted} size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]} 
              onPress={() => handleRoute("/(tabs)/calendar")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <CalendarHeart color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{t("menu.calendar.title")}</Text>
                <Text style={styles.menuSub}>{t("menu.calendar.subtitle")}</Text>
              </View>
              <ChevronRight color={theme.textMuted} size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]} 
              onPress={() => handleRoute("/(tabs)/map")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <MapPin color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{t("notifications.push.map.subtitle")}</Text>
                <Text style={styles.menuSub}>{t("menu.map.subtitle")}</Text>
              </View>
              <ChevronRight color={theme.textMuted} size={18} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]} 
              onPress={() => handleRoute("/(tabs)/meetings")}
              activeOpacity={0.8}
            >
              <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                <Clock color={theme.accent} size={18} />
              </View>
              <View style={styles.menuTextContainer}>
                <Text style={styles.menuTitle}>{t("menu.meetups.title")}</Text>
                <Text style={styles.menuSub}>{t("menu.meetups.subtitle")}</Text>
              </View>
              <ChevronRight color={theme.textMuted} size={18} />
            </TouchableOpacity>
          </View>

          {showLowerSections && (
            <>
              {/* ─── KATEGORİ 2: SAĞLIK & ÖZEL TAKİP ─── */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionHeaderLabel}>{t("menu.sections.health")}</Text>

                <TouchableOpacity 
                  style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]} 
                  onPress={() => handleRoute("/(tabs)/medicine")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                    <Pill color={theme.accent} size={18} />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>{t("notifications.labels.medicineTracking")}</Text>
                    <Text style={styles.menuSub}>{t("menu.medicine.subtitle")}</Text>
                  </View>
                  <ChevronRight color={theme.textMuted} size={18} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]} 
                  onPress={() => handleRoute("/(tabs)/period-tracker")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                    <Droplet color={theme.accent} size={18} />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>{t("menu.cycle.title")}</Text>
                    <Text style={styles.menuSub}>{t("menu.cycle.subtitle")}</Text>
                  </View>
                  <ChevronRight color={theme.textMuted} size={18} />
                </TouchableOpacity>
              </View>

              {/* ─── KATEGORİ 3: AYARLAR & HESAP ─── */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionHeaderLabel}>{t("menu.sections.account")}</Text>


                <TouchableOpacity 
                  style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]} 
                  onPress={() => setShowGuideCatalog(true)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                    <HelpCircle color={theme.accent} size={18} />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>{t("menu.guide.title")}</Text>
                    <Text style={styles.menuSub}>{t("menu.guide.subtitle")}</Text>
                  </View>
                  <ChevronRight color={theme.textMuted} size={18} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]} 
                  onPress={() => handleRoute("/(tabs)/profile")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                    <Settings color={theme.accent} size={18} />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>{t("menu.settings.title")}</Text>
                    <Text style={styles.menuSub}>{t("menu.settings.subtitle")}</Text>
                  </View>
                  <ChevronRight color={theme.textMuted} size={18} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.menuItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]} 
                  onPress={() => setLegalVisible(true)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                    <ShieldCheck color={theme.accent} size={18} />
                  </View>
                  <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>{t("menu.legal.title")}</Text>
                    <Text style={styles.menuSub}>{t("menu.legal.subtitle")}</Text>
                  </View>
                  <ChevronRight color={theme.textMuted} size={18} />
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
                    <Text style={[styles.menuTitle, { color: "#ff4d6a" }]}>{t("auth.signOut")}</Text>
                    <Text style={styles.menuSub}>{t("menu.signOut.subtitle")}</Text>
                  </View>
                  <ChevronRight color="rgba(255, 77, 106, 0.4)" size={18} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {legalVisible && (
        <LegalModal
          visible={legalVisible}
          onClose={() => setLegalVisible(false)}
          accentColor={theme.accent}
        />
      )}

      {/* REHBER KATALOĞU SEÇİM MODALI */}
      {showGuideCatalog && (
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
                  <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text }}>{t("menu.guides.title")}</Text>
                  <Text style={{ fontSize: 12, color: theme.textMuted }}>{t("menu.guides.subtitle")}</Text>
                </View>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.close")} onPress={() => setShowGuideCatalog(false)} style={{ padding: 6 }}>
                  <X color={theme.text} size={20} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 16 }}>
                {guides.map((g) => (
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
                    appAlert(t("menu.guides.resetTitle"), t("menu.guides.resetMessage"));
                  }}
                  style={{ marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: theme.pillAccentBg, borderWidth: 1, borderColor: theme.pillAccentBorder, alignItems: "center" }}
                >
                  <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 14 }}>{t("menu.guides.restartTour")}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* SEÇİLEN SAYFA TURU MODALI */}
      {selectedTourPage && (
        <LazyPageTourModal
          visible={!!selectedTourPage}
          guide={selectedTourPage ? getPageGuide(selectedTourPage, t) : null}
          onClose={() => setSelectedTourPage(null)}
        />
      )}

      {isDemoModalOpen && (
        <LazyDemoActionModal
          visible={isDemoModalOpen}
          onClose={() => setIsDemoModalOpen(false)}
          title={modalConfig.title}
          description={modalConfig.description}
        />
      )}
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
    color: isLight ? "#9F1239" : "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  demoCardDesc: {
    color: isLight ? theme.textSecondary : "rgba(255, 255, 255, 0.75)",
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
