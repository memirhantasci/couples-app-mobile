import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import { appAlert } from "@/lib/dialog";
import { DialogHost } from "@/components/ui/DialogHost";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { notifyPartner } from "@/lib/notifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dayjs, todayString } from "@/lib/date";
import { encrypt, decrypt, deterministicDecrypt } from "@/utils/crypto";
import { 
  Lock, ChevronRight, LockKeyhole, Calendar as CalendarIcon, 
  X, AlignJustify, PenLine, Send, ChevronLeft, 
  Clock, Mail, Sparkles, Unlock, UserCheck, ChevronDown
} from "lucide-react-native";
import { sanitize, sanitizeStrict } from "@/utils/sanitize";
import { logger } from "@/utils/logger";
import type { AppTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DateTimePickerSheet } from "@/components/ui/DateTimePickerSheet";
import { PremiumPaywall } from "@/components/ui/PremiumPaywall";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useCoupleAvatars } from "@/hooks/useCoupleAvatars";
import { WatchAdModal } from "@/components/ui/WatchAdModal";
import { OrigamiBirdAnimation } from "@/components/letters/OrigamiBirdAnimation";
import { usePageTour } from "@/hooks/usePageTour";
import { PageTourModal } from "@/components/tour/PageTourModal";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { DEMO_LETTERS } from "@/constants/demoData";
import { useDemoAction } from "@/hooks/useDemoAction";
import { playLetterSend, hapticStamp } from "@/lib/soundEffects";
import { toast } from "@/lib/toast";
import { markLettersSeen } from "@/lib/letterArrival";
import { EmptyState } from "@/components/ui/EmptyState";
import { DemoActionModal } from "@/components/demo/DemoActionModal";
import { PermissionPrimingModal } from "@/components/common/PermissionPrimingModal";
import { useNotificationPriming } from "@/hooks/useNotificationPriming";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";

const safeDecrypt = (val: string | null | undefined): string => {
  if (!val) return "";
  try {
    const dec = decrypt(val);
    return dec || val;
  } catch {
    return val;
  }
};

// Çözülemeyen şifreli değerler ("enc:" / "det:") kullanıcıya asla gösterilmemeli.
const readableName = (val: string | null | undefined): string => {
  if (!val) return "";
  const trimmed = val.trim();
  if (trimmed.startsWith("enc:") || trimmed.startsWith("det:")) {
    const dec = decrypt(trimmed);
    return dec && !dec.startsWith("enc:") && !dec.startsWith("det:") ? dec : "";
  }
  return trimmed;
};

export default function LettersScreen() {
  const router = useRouter();
  const { session, profile, refreshProfile, isDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { theme, isLight } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const today = todayString();
  const insets = useSafeAreaInsets();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;
  const { getAvatarUrl } = useCoupleAvatars();
  const priming = useNotificationPriming(userId);

  const [activeTab, setActiveTab] = useState<"all" | "received" | "sent">("all");
  const [pageLimit, setPageLimit] = useState(30);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [showOrigamiAnimation, setShowOrigamiAnimation] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  // Demo modunda premium kilitleri yoktur: tüm özellikler açık
  const isPremium = (profile?.isPremium ?? false) || isDemoMode;
  const tokenBalance = profile?.tokenBalance ?? 0;
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("letters");

  // --- Mektupları Getir (Sayfalamalı ve Korumalı) ---
  const { data, isLoading } = useQuery({
    queryKey: ["letters_data", coupleId, userId, pageLimit, isDemoMode],
    enabled: (!!coupleId && !!userId) || isDemoMode,
    queryFn: async () => {
      if (isDemoMode) {
        const all = DEMO_LETTERS;
        const received = DEMO_LETTERS.filter(l => l._type === "received");
        const sent = DEMO_LETTERS.filter(l => l._type === "sent");
        return { all, received, sent };
      }
      const [receivedRes, sentRes, usersRes] = await Promise.all([
        supabase
          .from("letters")
          .select("*")
          .eq("couple_id", coupleId)
          .eq("receiver_id", userId)
          .order("created_at", { ascending: false })
          .limit(pageLimit),
        supabase
          .from("letters")
          .select("*")
          .eq("couple_id", coupleId)
          .eq("sender_id", userId)
          .order("created_at", { ascending: false })
          .limit(pageLimit),
        supabase
          .from("users")
          .select("id, username, display_name")
          .eq("couple_id", coupleId),
      ]);

      const userMap = (usersRes.data || []).reduce((acc: any, u: any) => {
        acc[u.id] = {
          ...u,
          display_name: u.display_name ? safeDecrypt(u.display_name) : null,
        };
        return acc;
      }, {});

      const received = (receivedRes.data || []).map((l: any) => {
        const senderObj = userMap[l.sender_id];
        return {
          ...l,
          _type: "received" as const,
          // İçerik burada çözülmez: crypto-js saf JS olduğundan 30-60 mektubu birden çözmek ekranı
          // kilitliyordu. Çözme yalnızca ekranda görünen/açılan satır için render'da (önbellekli) yapılır.
          content: l.content,
          sender: senderObj ? { 
            ...senderObj, 
            username: senderObj.username ? (deterministicDecrypt(senderObj.username) || senderObj.username) : "Sevgilin" 
          } : null
        };
      });

      const sent = (sentRes.data || []).map((l: any) => {
        const receiverObj = userMap[l.receiver_id];
        return {
          ...l,
          _type: "sent" as const,
          content: l.content,
          receiver: receiverObj ? { 
            ...receiverObj, 
            username: receiverObj.username ? (deterministicDecrypt(receiverObj.username) || receiverObj.username) : "Sevgilin" 
          } : null
        };
      });

      return {
        received,
        sent,
        all: [...received, ...sent].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      };
    },
    staleTime: 1000 * 60 * 5, // 5 dk — invalidateQueries zaten yeni mektup yazılınca günceller
  });

  // --- Alıcı Kullanıcıları Getir ---
  const { data: users } = useQuery({
    queryKey: ["users_for_letter", coupleId],
    enabled: !!coupleId,
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, username, display_name")
        .eq("role", "USER")
        .eq("couple_id", coupleId);
      return (data || []).map(u => ({
        ...u,
        username: deterministicDecrypt(u.username) || u.username,
        display_name: u.display_name ? decrypt(u.display_name) : null
      })).filter(u => u.id !== userId && u.id !== Number(userId));
    }
  });

  const [openLetterId, setOpenLetterId] = useState<number | null>(null);

  // --- Form State ---
  const [receiverId, setReceiverId] = useState("");
  const [unlockDate, setUnlockDate] = useState(todayString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loadingForm, setLoadingForm] = useState(false);
  const [errors, setErrors] = useState({ receiver: false, title: false, content: false });

  // ─── Otomatik Taslak Kaydetme & Yükleme ─────────────────────────────────────
  useEffect(() => {
    if (!coupleId) return;
    const draftKey = `@couples_letter_draft_${coupleId}`;
    AsyncStorage.getItem(draftKey).then((saved) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.title) setTitle(parsed.title);
          if (parsed.content) setContent(parsed.content);
          if (parsed.unlockDate) setUnlockDate(parsed.unlockDate);
        } catch {}
      }
    });
  }, [coupleId]);

  useEffect(() => {
    if (!coupleId) return;
    const draftKey = `@couples_letter_draft_${coupleId}`;
    if (!title.trim() && !content.trim()) {
      return;
    }
    const timeout = setTimeout(() => {
      AsyncStorage.setItem(draftKey, JSON.stringify({ title, content, unlockDate }));
    }, 800);
    return () => clearTimeout(timeout);
  }, [title, content, unlockDate, coupleId]);

  const allLetters = data?.all || [];
  const receivedLetters = data?.received || [];
  const sentLetters = data?.sent || [];

  // Mektuplar ekranı odaktayken gelen kutusu görülüyor: en yeni gelen mektup "görüldü" sayılır;
  // böylece uygulamaya sonra girildiğinde aynı mektup için kuş karşılaması tekrar oynamaz.
  const latestReceivedAt: string | null = receivedLetters[0]?.created_at ?? null;
  useFocusEffect(
    useCallback(() => {
      if (userId && latestReceivedAt) markLettersSeen(userId, latestReceivedAt);
    }, [userId, latestReceivedAt])
  );

  const handleOpenWriteModal = () => {
    if (executeOrIntercept(
      () => {},
      "Mektup Yazmak ve Mühürlemek İçin Kayıt Olun 💌",
      "Partnerinize zaman kilitli mektuplar göndermek ve dilediğiniz tarihte açılmasını sağlamak için ücretsiz hesap oluşturun."
    )) {
      return;
    }
    // Partner varsa alıcıyı otomatik seç
    if (users && users.length === 1 && !receiverId) {
      setReceiverId(String(users[0].id));
    }
    setShowWriteModal(true);
  };

  const handleSave = async () => {
    if (executeOrIntercept(
      () => {},
      "Mektup Yazmak ve Mühürlemek İçin Kayıt Olun 💌",
      "Partnerinize zaman kilitli mektuplar göndermek ve dilediğiniz tarihte açılmasını sağlamak için ücretsiz hesap oluşturun."
    )) {
      setShowWriteModal(false);
      return;
    }

    const newErrors = { 
      receiver: !receiverId, 
      title: !title.trim(), 
      content: !content.trim() 
    };
    setErrors(newErrors);

    if (newErrors.receiver || newErrors.title || newErrors.content) {
      appAlert("Eksik Bilgi", "Lütfen kime göndereceğinizi, başlığı ve mektup içeriğini doldurun.");
      return;
    }

    // Doğrulama geçti ve mühürleme başlıyor: mühür basılırken tok bir darbe hissi.
    // (Mektup gerçekten mühürlenince playLetterSend başarı titreşimini verir.)
    hapticStamp();
    setLoadingForm(true);

    try {
      const cleanTitle = sanitizeStrict(title.trim());
      const cleanContent = sanitize(content.trim());

      if (!cleanTitle || !cleanContent) {
        appAlert("Hata", "Geçersiz içerik tespit edildi.");
        setLoadingForm(false);
        return;
      }

      // save_letter RPC'si veritabanı seviyesinde Premium durumunu kontrol eder,
      // Premium değilse 100 token'ı atomik olarak düşer. Bakiye yetersizse hata fırlatır.
      const { error } = await supabase.rpc("save_letter", {
        p_receiver_id: receiverId,
        p_title:       cleanTitle,
        p_content:     encrypt(cleanContent),
        p_unlock_date: unlockDate,
        p_couple_id:   coupleId ?? null,
      });

      if (error) throw error;

      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["letters_data"] });

      // Formu temizle, taslağı sil ve yazma modalını kapat
      setTitle("");
      setContent("");
      setUnlockDate(todayString());
      if (coupleId) {
        AsyncStorage.removeItem(`@couples_letter_draft_${coupleId}`).catch(() => {});
      }
      setShowWriteModal(false);

      // Mektup Premium'la veya 100 token'la gönderilebildiği için bildirim de her iki durumda gider
      if (coupleId && userId) {
        const senderName = profile?.displayName || "Sevgilin";
        const letterHeader = cleanTitle.trim();
        const notificationBody = letterHeader 
          ? `${senderName} sana mühürlü bir mektup gönderdi: "${letterHeader}"`
          : `${senderName} sana mühürlü bir mektup gönderdi.`;
        notifyPartner(coupleId, userId, "Gelecekten Bir Mektup 💌", notificationBody, {
          type: "letter",
          letterTitle: letterHeader,
          route: "/(tabs)/letters",
          actionLabel: "Mektubu Aç 📜",
        });
      }

      // Origami turna kuşu uçuş animasyonunu ve ses efektini başlat! 🕊️✨
      playLetterSend();
      setShowOrigamiAnimation(true);
    } catch (error: any) {
      logger.error("Letter save error:", error);
      if (error?.code === "P0002" || error?.message?.includes("Token") || error?.message?.includes("Premium")) {
        appAlert(
          "Yetersiz Bakiye",
          "Mektup mühürlemek için 100 Token veya aktif Premium üyelik gereklidir.",
          [
            { text: "Vazgeç", style: "cancel" },
            { 
              text: "Premium'u Keşfet", 
              onPress: () => {
                setShowWriteModal(false);
                setShowPaywall(true);
              } 
            }
          ]
        );
      } else {
        appAlert("Hata", "Mektup mühürlenirken bir hata oluştu: " + (error?.message || ""));
      }
    } finally {
      setLoadingForm(false);
    }
  };

  const confirmAndSave = () => {
    if (!isPremium && tokenBalance < 100) {
      setShowWriteModal(false);
      setShowPaywall(true);
      return;
    }

    if (!isPremium) {
      appAlert(
        "Token Kullanımı",
        "Bu mektubu mühürlemek için 100 token kullanılacaktır. Onaylıyor musunuz?",
        [
          { text: "İptal", style: "cancel" },
          { text: "Onayla ve Mühürle", onPress: () => handleSave() }
        ]
      );
    } else {
      handleSave();
    }
  };

  const renderLetterItem = useCallback(({ item: letter }: { item: any }) => {
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const unlockDateStr = letter.unlock_date.substring(0, 10);
    const isLockedDate = unlockDateStr > localToday;
    const unlockDateObj = dayjs(unlockDateStr);
    const itemType = letter._type || (letter.sender_id === userId ? "sent" : "received");
    const canOpen = itemType === "sent" || !isLockedDate;
    const isOpen = openLetterId === letter.id;

    const personObj = itemType === "received" ? letter.sender : letter.receiver;
    const personName =
      readableName(personObj?.display_name) || readableName(personObj?.username) || "Sevgilim ❤️";
    const personAvatarUrl = getAvatarUrl(itemType === "received" ? letter.sender_id : letter.receiver_id);

    let relativeDate = dayjs(letter.created_at).format("DD MMMM YYYY");
    if (dayjs(letter.created_at).isSame(dayjs(), 'day')) relativeDate = "Bugün";

    // Kilitli (henüz açılamayan) mektubun içeriği hiç çözülmez; açılabilir olanlar önbellekten gelir
    const letterContent = canOpen ? safeDecrypt(letter.content) : "";

    return (
      <View 
        style={[
          styles.letterCard, 
          { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow },
          isLockedDate && itemType === "received" && styles.letterCardLocked
        ]}
      >
        <TouchableOpacity
          activeOpacity={canOpen ? 0.75 : 1}
          onPress={() => canOpen && setOpenLetterId(isOpen ? null : letter.id)}
        >
          {/* Üst Durum Çubuğu */}
          <View style={styles.cardTopRow}>
            <View style={styles.badgeContainer}>
              {/* Tümü sekmesindeyken Gelen / Giden belirteci */}
              {activeTab === "all" && (
                <View
                  style={[
                    styles.directionBadge,
                    {
                      backgroundColor:
                        itemType === "received"
                          ? "rgba(168, 85, 247, 0.15)"
                          : "rgba(59, 130, 246, 0.15)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.directionBadgeText,
                      { color: itemType === "received" ? "#c084fc" : "#60a5fa" },
                    ]}
                  >
                    {itemType === "received" ? "📥 Gelen" : "📤 Giden"}
                  </Text>
                </View>
              )}

              {isLockedDate && itemType === "received" ? (
                <View style={styles.lockedBadge}>
                  <LockKeyhole size={13} color={isLight ? "#B45309" : "#f59e0b"} />
                  <Text style={styles.lockedBadgeText}>
                    Kilitli • {unlockDateObj.locale("tr").format("DD MMM YYYY")}
                  </Text>
                </View>
              ) : (
                <View style={styles.unlockedBadge}>
                  <Unlock size={13} color="#22c55e" />
                  <Text style={styles.unlockedBadgeText}>
                    {itemType === "sent"
                      ? isLockedDate
                        ? `Mühürlü • ${unlockDateObj.locale("tr").format("DD MMM")}`
                        : "Gönderildi"
                      : "Açıldı"}
                  </Text>
                </View>
              )}
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.cardDate, { color: theme.textMuted }]}>{relativeDate}</Text>
              {canOpen && (
                <ChevronDown 
                  size={14} 
                  color={theme.textMuted} 
                  style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }} 
                />
              )}
            </View>
          </View>

          {/* Mektup Başlığı */}
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {canOpen ? letter.title : "🔒 Geleceğe Kilitli Mektup"}
          </Text>

          {/* Gönderen / Alıcı Bilgisi */}
          <View style={styles.personRow}>
            <UserAvatar uri={personAvatarUrl} name={personName} size={22} borderWidth={1} />
            <Text style={[styles.personText, { color: theme.textSecondary }]}>
              {itemType === "received" ? `Gönderen: ${personName}` : `Alıcı: ${personName}`}
            </Text>
          </View>

          {/* Kapalı Durumdayken Kısa Önizleme */}
          {!isOpen && (
            <Text 
              style={[
                styles.previewText, 
                { color: theme.textSecondary },
                isLockedDate && itemType === "received" && styles.previewTextBlurred
              ]} 
              numberOfLines={2}
            >
              {canOpen
                ? letterContent
                : "Bu mektup sevdiğin tarafından belirlenen tarihe kadar özel bir mühürle kilitlenmiştir..."}
            </Text>
          )}

          {/* Açık Durumdaki Tam Mektup İçeriği */}
          {canOpen && isOpen && (
            <View style={[styles.letterContentBox, { borderTopColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)" }]}>
              <View style={styles.letterContentHeaderRow}>
                <Text style={[styles.letterContentLabel, { color: theme.accent }]}>Mektup İçeriği</Text>
              </View>
              <Text style={[styles.letterContentText, { color: theme.text }]}>{letterContent}</Text>
              {unlockDateStr ? (
                <Text style={[styles.letterFooterNote, { color: theme.textMuted }]}>
                  {`Açılış Zamanı: ${dayjs(unlockDateStr).locale("tr").format("DD MMMM YYYY")}`}
                </Text>
              ) : null}
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }, [theme.cardBg, theme.cardBorder, theme.text, theme.textMuted, theme.textSecondary, isLight, userId, openLetterId, activeTab, getAvatarUrl]);

  const keyExtractor = useCallback((item: any) => item.id.toString(), []);

  if (!session && !isDemoMode) return <View style={{ flex: 1, backgroundColor: "#0a0a0f" }} />;

  const currentList = activeTab === "all" ? allLetters : activeTab === "received" ? receivedLetters : sentLetters;

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER - Diğer tüm sayfalarla simetrik ve tam uyumlu */}
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
            <Text style={[styles.headerTitle, { color: theme.text }]}>Mektuplar</Text>
            <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>Geleceğe Zaman Kapsülü 💌</Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TourGuideButton onPress={openTour} />
            <TouchableOpacity 
              onPress={handleOpenWriteModal} 
              style={[styles.headerBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : theme.cardBg, borderColor: theme.cardBorder }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <PenLine color={theme.accent} size={19} />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push("/menu")} 
              style={[styles.headerBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)", borderColor: theme.cardBorder }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AlignJustify color={theme.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ÜSTTE HIZLI MEKTUP YAZ BUTONU */}
        <View style={styles.topActionContainer}>
          <TouchableOpacity 
            style={[styles.writeLetterActionBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}
            onPress={handleOpenWriteModal}
            activeOpacity={0.88}
          >
            <View style={[styles.writeActionIconCircle, { backgroundColor: theme.pillAccentBg }]}>
              <PenLine size={20} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.writeActionTitle, { color: theme.text }]}>Yeni Bir Mektup Yaz</Text>
              <Text style={[styles.writeActionSub, { color: theme.textMuted }]}>Sevdiğine gelecekte açılacak bir mesaj bırak ✨</Text>
            </View>
            <ChevronRight size={18} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {/* SEKME ÇUBUĞU (TÜMÜ / GELENLER / GÖNDERİLENLER) */}
        <View style={[styles.tabsWrapper, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1, ...theme.cardShadow }]}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === "all" && { backgroundColor: theme.unitBg }]}
            onPress={() => setActiveTab("all")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, { color: activeTab === "all" ? theme.accent : theme.textSecondary }, activeTab === "all" && { fontFamily: "Inter_700Bold" }]}>
              Tümü ({allLetters.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === "received" && { backgroundColor: theme.unitBg }]}
            onPress={() => setActiveTab("received")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, { color: activeTab === "received" ? theme.accent : theme.textSecondary }, activeTab === "received" && { fontFamily: "Inter_700Bold" }]}>
              Gelen ({receivedLetters.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === "sent" && { backgroundColor: theme.unitBg }]}
            onPress={() => setActiveTab("sent")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, { color: activeTab === "sent" ? theme.accent : theme.textSecondary }, activeTab === "sent" && { fontFamily: "Inter_700Bold" }]}>
              Giden ({sentLetters.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* MEKTUP LİSTESİ */}
        {isLoading ? (
          <View style={{ paddingHorizontal: 16, gap: 14, marginTop: 10 }}>
            <Skeleton height={120} borderRadius={18} />
            <Skeleton height={120} borderRadius={18} />
            <Skeleton height={120} borderRadius={18} />
          </View>
        ) : (
          <FlatList
            data={activeTab === "all" ? allLetters : activeTab === "received" ? receivedLetters : sentLetters}
            keyExtractor={keyExtractor}
            renderItem={renderLetterItem}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                emoji={activeTab === "received" ? "📬" : "💌"}
                title={activeTab === "received" ? "Sana ilk mektup henüz gelmedi" : "Geleceğe ilk izi bırak!"}
                description={
                  activeTab === "received"
                    ? "Partnerin sana mühürlü bir mektup yazdığında burada belirecek. Sen de ilk adımı atıp ona bir sürpriz bırakabilirsin."
                    : "Partnerinin ilk yıl dönümünüzde veya doğum gününde açacağı ilk mühürlü mektubunu hemen yaz."
                }
                ctaLabel="İlk Mektubu Mühürle 💌"
                onPressCta={handleOpenWriteModal}
                theme={theme}
              />
            }
            ListFooterComponent={
              currentList.length >= pageLimit ? (
                <TouchableOpacity 
                  style={[styles.loadMoreBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}
                  onPress={() => setPageLimit((prev) => prev + 15)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.loadMoreText, { color: theme.accent }]}>
                    Daha Fazla Mektup Yükle ({currentList.length} Gösteriliyor) 📜
                  </Text>
                </TouchableOpacity>
              ) : null
            }
            onEndReached={() => {
              if (currentList.length >= pageLimit) {
                setPageLimit((prev) => prev + 15);
              }
            }}
            onEndReachedThreshold={0.4}
          />
        )}

      </View>

      {/* YENİ MEKTUP YAZMA MODALI (Modern, temiz ve klavye duyarlı!) */}
      <Modal
        visible={showWriteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowWriteModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
            {/* Modal Başlık Çubuğu */}
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <PenLine size={20} color={theme.accent} />
                <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>Mektup Mühürle</Text>
              </View>

              <TouchableOpacity 
                onPress={() => setShowWriteModal(false)}
                style={[styles.modalCloseBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 60, gap: 16 }}
              enableOnAndroid={true}
              enableAutomaticScroll={true}
              extraScrollHeight={160}
              extraHeight={160}
              keyboardOpeningTime={250}
              keyboardShouldPersistTaps="handled"
            >
                {/* KİME ALANI */}
                <View>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }, errors.receiver && { color: "#ff5c77" }]}>
                    KİME GÖNDERİLECEK *
                  </Text>
                  <View style={styles.usersSelectorRow}>
                    {users?.map((u) => {
                      const isSelected = receiverId === String(u.id);
                      return (
                        <TouchableOpacity
                          key={u.id}
                          style={[
                            styles.userPillBtn,
                            { 
                              backgroundColor: theme.unitBg,
                              borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.08)"
                            },
                            isSelected && { 
                              borderColor: theme.accent, 
                              backgroundColor: theme.pillAccentBg,
                              borderWidth: 1.5
                            }
                          ]}
                          onPress={() => {
                            setReceiverId(String(u.id));
                            setErrors(prev => ({ ...prev, receiver: false }));
                          }}
                        >
                          <UserCheck size={16} color={isSelected ? theme.accent : theme.textMuted} />
                          <Text 
                            style={[
                              styles.userPillText, 
                              { color: isSelected ? theme.accent : theme.textSecondary },
                              isSelected && { fontFamily: "Inter_700Bold" }
                            ]}
                          >
                            {readableName(u.display_name) || readableName(u.username) || "Sevgilim ❤️"}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    {(!users || users.length === 0) && (
                      <View style={[styles.userPillBtn, { backgroundColor: theme.unitBg, flex: 1 }]}>
                        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                          Partnerin henüz eşleşmemiş
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* AÇILIŞ TARİHİ (KİLİT) */}
                <View>
                  <View style={styles.fieldLabelRow}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>KİLİT AÇILMA TARİHİ *</Text>
                    <View style={[styles.lockHintPill, { backgroundColor: theme.pillAccentBg }]}>
                      <LockKeyhole size={11} color={theme.accent} />
                      <Text style={[styles.lockHintText, { color: theme.accent }]}>Zaman Kilidi</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.dateSelectorBtn, 
                      { 
                        backgroundColor: theme.unitBg,
                        borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.08)"
                      }
                    ]}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <CalendarIcon size={18} color={theme.accent} />
                      <Text style={[styles.dateSelectorText, { color: theme.text }]}>
                        {dayjs(unlockDate).locale("tr").format("DD MMMM YYYY, dddd")}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={theme.textMuted} />
                  </TouchableOpacity>

                  <DateTimePickerSheet
                    visible={showDatePicker}
                    mode="date"
                    title="Kilit Açılma Tarihi"
                    value={dayjs(unlockDate).toDate()}
                    minimumDate={dayjs().startOf("day").toDate()}
                    onCancel={() => setShowDatePicker(false)}
                    onConfirm={(selectedDate) => {
                      setShowDatePicker(false);
                      setUnlockDate(dayjs(selectedDate).format("YYYY-MM-DD"));
                    }}
                  />
                </View>

                {/* MEKTUP BAŞLIĞI */}
                <View>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }, errors.title && { color: "#ff5c77" }]}>
                    MEKTUP BAŞLIĞI *
                  </Text>
                  <TextInput
                    style={[
                      styles.inputField, 
                      { 
                        backgroundColor: theme.unitBg,
                        color: theme.text,
                        borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.08)"
                      },
                      errors.title && styles.inputError
                    ]}
                    value={title}
                    onChangeText={(text) => {
                      setTitle(text);
                      setErrors(prev => ({ ...prev, title: false }));
                    }}
                    placeholder="Örn: 1. Yılımızda Açılacak Özel Bir Not..."
                    placeholderTextColor={isLight ? theme.textMuted : "rgba(255,255,255,0.3)"}
                    maxLength={100}
                  />
                </View>

                {/* MEKTUP İÇERİĞİ */}
                <View>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }, errors.content && { color: "#ff5c77" }]}>
                    MEKTUP İÇERİĞİ *
                  </Text>
                  <TextInput
                    style={[
                      styles.inputField, 
                      styles.textAreaField, 
                      { 
                        backgroundColor: theme.unitBg,
                        color: theme.text,
                        borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.08)"
                      },
                      errors.content && styles.inputError
                    ]}
                    value={content}
                    onChangeText={(text) => {
                      setContent(text);
                      setErrors(prev => ({ ...prev, content: false }));
                    }}
                    placeholder="Yüreğinden geçenleri dök... Gelecekte sevdiğinin okumasını istediğin en özel satırlar..."
                    placeholderTextColor={isLight ? theme.textMuted : "rgba(255,255,255,0.3)"}
                    multiline
                    numberOfLines={6}
                    maxLength={4000}
                  />
                </View>

                {/* MÜHÜRLE BUTONU (Sarı kaldırıldı, modern theme.accent entegre edildi!) */}
                <TouchableOpacity 
                  style={[
                    styles.sealBtn, 
                    { backgroundColor: theme.accent, shadowColor: theme.accent },
                    loadingForm && { opacity: 0.75 }
                  ]} 
                  onPress={confirmAndSave}
                  disabled={loadingForm}
                  activeOpacity={0.88}
                >
                  {loadingForm ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Send size={18} color="#ffffff" />
                      <Text style={styles.sealBtnText}>Mektubu Mühürle 💌</Text>
                    </>
                  )}
                </TouchableOpacity>

                {!isPremium && (
                  <Text style={[styles.tokenNoticeText, { color: theme.textMuted }]}>
                    * Premium olmayan üyeler için 100 Token karşılığında mühürlenir. (Mevcut bakiyeniz: {tokenBalance} Token)
                  </Text>
                )}
            </KeyboardAwareScrollView>
          </View>
        </View>
        {/* Bu modal açıkken uyarılar/diyaloglar (kök katman modalın arkasında kalır) burada çizilir */}
        <DialogHost embedded />
      </Modal>

      {/* Premium Paywall Modal */}
      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName="Mektup Yaz"
        featureDescription="Sevdiğine zamanda yolculuğa çıkan mektuplar yaz."
        gender={profile?.gender}
        onWatchAd={() => {
          setShowPaywall(false);
          setShowAdModal(true);
        }}
      />

      <WatchAdModal
        visible={showAdModal}
        onClose={() => setShowAdModal(false)}
        onSuccess={() => setShowAdModal(false)}
      />

      <OrigamiBirdAnimation
        visible={showOrigamiAnimation}
        onComplete={() => {
          setShowOrigamiAnimation(false);
          // Kuş uçup gidince bloklayıcı bir kart yerine süzülen başarı pili.
          // Titreşim yok: mühür ve başarı titreşimi zaten verildi.
          toast.success("Mektubun mühürlendi ve geleceğe emanet edildi ✨", { delay: 250, haptic: false });
          // Bildirim ön-onay kartı, başarı pili görülebilsin diye biraz sonra gösterilir
          setTimeout(() => priming.maybePrompt(), 2800);
        }}
        accentColor={theme.accent}
      />
      <PermissionPrimingModal
        visible={priming.isVisible}
        onAccept={priming.accept}
        onDismiss={priming.dismiss}
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
      fontSize: 12.5,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.6)",
      marginTop: 2,
    },
    topActionContainer: {
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    writeLetterActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      gap: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 3,
    },
    writeActionIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    writeActionTitle: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      letterSpacing: -0.2,
    },
    writeActionSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.55)",
      marginTop: 2,
    },
    tabsWrapper: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginBottom: 14,
      borderRadius: 14,
      padding: 4,
      borderWidth: 1,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.05)",
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    tabText: {
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.5)",
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 130,
      gap: 12,
    },
    letterCard: {
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 2,
    },
    letterCardLocked: {
      borderStyle: "dashed",
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.15)",
    },
    cardTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    badgeContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    directionBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 3.5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
    },
    directionBadgeText: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
    },
    lockedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(245,158,11,0.12)",
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(245,158,11,0.25)",
    },
    lockedBadgeText: {
      color: isLight ? "#B45309" : "#f59e0b",
      fontSize: 11.5,
      fontFamily: "Inter_600SemiBold",
    },
    unlockedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(34,197,94,0.12)",
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(34,197,94,0.25)",
    },
    unlockedBadgeText: {
      color: isLight ? "#15803D" : "#22c55e",
      fontSize: 11.5,
      fontFamily: "Inter_600SemiBold",
    },
    cardDate: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.4)",
    },
    cardTitle: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    personRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
    },
    personText: {
      fontSize: 12.5,
      fontFamily: "Inter_500Medium",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.6)",
    },
    previewText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.5)",
      lineHeight: 18,
    },
    previewTextBlurred: {
      opacity: 0.6,
      fontStyle: "italic",
    },
    letterContentBox: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
    },
    letterContentHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    letterContentLabel: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    letterContentText: {
      fontSize: 14.5,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.text : "rgba(255,255,255,0.85)",
      lineHeight: 23,
    },
    letterFooterNote: {
      marginTop: 12,
      fontSize: 11.5,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.4)",
      textAlign: "right",
    },

    /* MODAL STILLERI */
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "flex-end",
    },
    modalBox: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: 1,
      padding: 20,
      height: "92%",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
    },
    modalHeaderTitle: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      letterSpacing: -0.3,
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
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.7)",
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    fieldLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    lockHintPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    lockHintText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
    },
    usersSelectorRow: {
      flexDirection: "row",
      gap: 10,
    },
    userPillBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
    },
    userPillText: {
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.8)",
      fontSize: 13.5,
      fontFamily: "Inter_600SemiBold",
    },
    dateSelectorBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
    },
    dateSelectorText: {
      color: theme.text,
      fontSize: 14,
      fontFamily: "Inter_500Medium",
    },
    inputField: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: theme.text,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
    },
    textAreaField: {
      minHeight: 140,
      textAlignVertical: "top",
      lineHeight: 21,
    },
    inputError: {
      borderColor: "#ff5c77",
      borderWidth: 1.5,
    },
    sealBtn: {
      height: 52,
      borderRadius: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 8,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 4,
    },
    sealBtnText: {
      color: "#ffffff",
      fontSize: 15.5,
      fontFamily: "Inter_700Bold",
      letterSpacing: -0.2,
    },
    tokenNoticeText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.45)",
      textAlign: "center",
      lineHeight: 17,
    },
    loadMoreBtn: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
      marginBottom: 20,
    },
    loadMoreText: {
      fontSize: 13.5,
      fontFamily: "Inter_600SemiBold",
    },
  });
};
