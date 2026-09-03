import React, { useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, 
  ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, 
  Platform, Modal, ScrollView 
} from "react-native";
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
  Clock, Mail, Sparkles, Unlock, UserCheck
} from "lucide-react-native";
import { sanitize, sanitizeStrict } from "@/utils/sanitize";
import { logger } from "@/utils/logger";
import { getTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { PremiumPaywall } from "@/components/ui/PremiumPaywall";
import { WatchAdModal } from "@/components/ui/WatchAdModal";
import { OrigamiBirdAnimation } from "@/components/letters/OrigamiBirdAnimation";

const safeDecrypt = (val: string | null | undefined): string => {
  if (!val) return "";
  try {
    const dec = decrypt(val);
    return dec || val;
  } catch {
    return val;
  }
};

export default function LettersScreen() {
  const router = useRouter();
  const { session, profile, refreshProfile } = useAuth();
  const { theme, isLight } = useTheme();
  const queryClient = useQueryClient();
  const today = todayString();
  const insets = useSafeAreaInsets();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;

  const [activeTab, setActiveTab] = useState<"all" | "received" | "sent">("all");
  const [pageLimit, setPageLimit] = useState(30);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [showOrigamiAnimation, setShowOrigamiAnimation] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const isPremium = profile?.isPremium ?? false;
  const tokenBalance = profile?.tokenBalance ?? 0;

  // --- Mektupları Getir (Sayfalamalı ve Korumalı) ---
  const { data, isLoading } = useQuery({
    queryKey: ["letters_data", coupleId, userId, pageLimit],
    enabled: !!coupleId && !!userId,
    queryFn: async () => {
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
          content: safeDecrypt(l.content),
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
          content: safeDecrypt(l.content),
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
    staleTime: 0,
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

  const allLetters = data?.all || [];
  const receivedLetters = data?.received || [];
  const sentLetters = data?.sent || [];

  const handleOpenWriteModal = () => {
    // Partner varsa alıcıyı otomatik seç
    if (users && users.length === 1 && !receiverId) {
      setReceiverId(String(users[0].id));
    }
    setShowWriteModal(true);
  };

  const handleSave = async () => {
    const newErrors = { 
      receiver: !receiverId, 
      title: !title.trim(), 
      content: !content.trim() 
    };
    setErrors(newErrors);

    if (newErrors.receiver || newErrors.title || newErrors.content) {
      Alert.alert("Eksik Bilgi", "Lütfen kime göndereceğinizi, başlığı ve mektup içeriğini doldurun.");
      return;
    }

    setLoadingForm(true);

    try {
      const cleanTitle = sanitizeStrict(title.trim());
      const cleanContent = sanitize(content.trim());

      if (!cleanTitle || !cleanContent) {
        Alert.alert("Hata", "Geçersiz içerik tespit edildi.");
        setLoadingForm(false);
        return;
      }

      if (!isPremium) {
        const { error: spendError } = await supabase.rpc("spend_tokens", {
          p_amount: 100,
          p_reason: "letter_spend"
        });
        if (spendError) throw spendError;
      }

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
      
      // Formu temizle ve yazma modalını kapat
      setTitle("");
      setContent("");
      setUnlockDate(todayString());
      setShowWriteModal(false);

      if (coupleId && userId) {
        notifyPartner(coupleId, userId, "Gelecekten Bir Mesaj 💌", "Sevgilin sana mühürlü bir mektup gönderdi.");
      }

      // Origami turna kuşu uçuş animasyonunu başlat! 🕊️✨
      setShowOrigamiAnimation(true);
    } catch (error: any) {
      logger.error("Letter save error:", error);
      Alert.alert("Hata", "Mektup mühürlenirken bir hata oluştu: " + (error?.message || ""));
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
      Alert.alert(
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

    const personName = itemType === "received"
      ? (letter.sender?.display_name || letter.sender?.username || "Sevgilin")
      : (letter.receiver?.display_name || letter.receiver?.username || "Sevgilin");

    let relativeDate = dayjs(letter.created_at).format("DD MMMM YYYY");
    if (dayjs(letter.created_at).isSame(dayjs(), 'day')) relativeDate = "Bugün";

    return (
      <View 
        style={[
          styles.letterCard, 
          { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
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
                  <LockKeyhole size={13} color="#f59e0b" />
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

            <Text style={[styles.cardDate, { color: theme.textMuted }]}>{relativeDate}</Text>
          </View>

          {/* Mektup Başlığı */}
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {canOpen ? letter.title : "🔒 Geleceğe Kilitli Mektup"}
          </Text>

          {/* Gönderen / Alıcı Bilgisi */}
          <View style={styles.personRow}>
            <Text style={[styles.personText, { color: theme.textSecondary }]}>
              {itemType === "received" ? `Gönderen: ${personName}` : `Alıcı: ${personName}`}
            </Text>
          </View>

          {/* Kısa Önizleme */}
          <Text 
            style={[
              styles.previewText, 
              { color: theme.textSecondary },
              isLockedDate && itemType === "received" && styles.previewTextBlurred
            ]} 
            numberOfLines={isOpen ? undefined : 2}
          >
            {canOpen 
              ? letter.content 
              : "Bu mektup sevdiğin tarafından belirlenen tarihe kadar özel bir mühürle kilitlenmiştir..."}
          </Text>

          {/* Açık Durumdaki Tam Mektup */}
          {canOpen && isOpen && (
            <View style={[styles.letterContentBox, { borderTopColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}>
              <Text style={[styles.letterContentText, { color: theme.text }]}>{letter.content}</Text>
              <Text style={[styles.letterFooterNote, { color: theme.textMuted }]}>
                {unlockDateStr ? `Açılış Zamanı: ${dayjs(unlockDateStr).locale("tr").format("DD MMMM YYYY")}` : ""}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  }, [theme.cardBg, theme.cardBorder, theme.text, theme.textMuted, theme.textSecondary, isLight, userId, openLetterId, activeTab]);

  const keyExtractor = useCallback((item: any) => item.id.toString(), []);

  if (!session) return <View style={{ flex: 1, backgroundColor: "#0a0a0f" }} />;

  const currentList = activeTab === "all" ? allLetters : activeTab === "received" ? receivedLetters : sentLetters;

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER - Diğer tüm sayfalarla simetrik ve tam uyumlu */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity 
            onPress={() => router.back()} 
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
            style={[styles.writeLetterActionBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
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
        <View style={[styles.tabsWrapper, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
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
              <View style={[styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }]}>
                <Text style={{ fontSize: 38, marginBottom: 12 }}>📮</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  {activeTab === "received" 
                    ? "Henüz Mektubun Yok" 
                    : activeTab === "sent" 
                    ? "Henüz Mektup Göndermedin" 
                    : "Henüz Mektup Bulunmuyor"}
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  {activeTab === "received" 
                    ? "Partnerin sana henüz bir zaman mektubu mühürlememiş. İlk adımı sen atabilirsin!" 
                    : "Sevdiğine duygularını anlatan, zamanda yolculuk yapacak bir mektup yazmaya ne dersin?"}
                </Text>
                <TouchableOpacity 
                  style={[styles.emptyActionBtn, { backgroundColor: theme.accent }]}
                  onPress={handleOpenWriteModal}
                >
                  <Text style={styles.emptyActionBtnText}>Hemen Mektup Yaz ✍️</Text>
                </TouchableOpacity>
              </View>
            }
            ListFooterComponent={
              currentList.length >= pageLimit ? (
                <TouchableOpacity 
                  style={[styles.loadMoreBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
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
          <View style={[styles.modalBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            {/* Modal Başlık Çubuğu */}
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}>
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
                              borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"
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
                            {u.display_name || u.username}
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
                        borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"
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

                  {showDatePicker && (
                    <DateTimePicker
                      value={new Date(unlockDate)}
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      minimumDate={new Date()}
                      onChange={(_, selectedDate) => {
                        setShowDatePicker(Platform.OS === "ios");
                        if (selectedDate) {
                          setUnlockDate(dayjs(selectedDate).format("YYYY-MM-DD"));
                        }
                      }}
                    />
                  )}
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
                        borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"
                      },
                      errors.title && styles.inputError
                    ]}
                    value={title}
                    onChangeText={(text) => {
                      setTitle(text);
                      setErrors(prev => ({ ...prev, title: false }));
                    }}
                    placeholder="Örn: 1. Yılımızda Açılacak Özel Bir Not..."
                    placeholderTextColor={isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)"}
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
                        borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)"
                      },
                      errors.content && styles.inputError
                    ]}
                    value={content}
                    onChangeText={(text) => {
                      setContent(text);
                      setErrors(prev => ({ ...prev, content: false }));
                    }}
                    placeholder="Yüreğinden geçenleri dök... Gelecekte sevdiğinin okumasını istediğin en özel satırlar..."
                    placeholderTextColor={isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.3)"}
                    multiline
                    numberOfLines={6}
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
        onComplete={() => setShowOrigamiAnimation(false)}
        accentColor={theme.accent}
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
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
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
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  writeActionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  tabsWrapper: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    color: "rgba(255,255,255,0.5)",
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
    borderColor: "rgba(255,255,255,0.15)",
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
    borderColor: "rgba(255,255,255,0.08)",
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
    color: "#f59e0b",
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
    color: "#22c55e",
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
  cardDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
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
    color: "rgba(255,255,255,0.6)",
  },
  previewText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
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
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  letterContentText: {
    fontSize: 14.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.85)",
    lineHeight: 23,
  },
  letterFooterNote: {
    marginTop: 12,
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
    textAlign: "right",
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    borderRadius: 20,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 18,
  },
  emptyActionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  emptyActionBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
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
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.7)",
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
    backgroundColor: "rgba(255,255,255,0.05)",
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
    borderColor: "rgba(255,255,255,0.08)",
  },
  userPillText: {
    color: "rgba(255,255,255,0.8)",
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
    borderColor: "rgba(255,255,255,0.08)",
  },
  dateSelectorText: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  inputField: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#ffffff",
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
    color: "rgba(255,255,255,0.45)",
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
