import React, { useState } from "react";
import { useRouter } from "expo-router";
import { View, Text, SectionList, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform, Modal } from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dayjs, todayString } from "@/lib/date";
import { encrypt, decrypt, deterministicDecrypt } from "@/utils/crypto";
import { Lock, ChevronRight, FileEdit, LockKeyhole, Calendar as CalendarIcon, XCircle, ChevronDown, AlignJustify } from "lucide-react-native";
import { sanitize, sanitizeStrict } from "@/utils/sanitize";
import { logger } from "@/utils/logger";
import { getTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { PremiumPaywall } from "@/components/ui/PremiumPaywall";
import { WatchAdModal } from "@/components/ui/WatchAdModal";

export default function LettersScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const today = todayString();
  const insets = useSafeAreaInsets();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;
  const theme = getTheme(profile?.gender);

  const [letterLimit, setLetterLimit] = useState(15);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [isSpendingToken, setIsSpendingToken] = useState(false);
  const isPremium = profile?.isPremium ?? false;
  const tokenBalance = profile?.tokenBalance ?? 0;
  const { refreshProfile } = useAuth();

  // --- Mektupları Getir ---
  const { data, isLoading } = useQuery({
    queryKey: ["letters_data", coupleId, userId, letterLimit],
    enabled: !!coupleId && !!userId,
    queryFn: async () => {
      const [receivedRes, sentRes, usersRes] = await Promise.all([
        supabase
          .from("letters")
          .select("*")
          .eq("couple_id", coupleId)
          .eq("receiver_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("letters")
          .select("*")
          .eq("couple_id", coupleId)
          .eq("sender_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("users")
          .select("id, username, display_name")
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
        received: (receivedRes.data || []).map((l: any) => {
          const senderObj = userMap[l.sender_id];
          return {
            ...l,
            content: l.content ? decrypt(l.content) : "",
            sender: senderObj ? { 
              ...senderObj, 
              username: senderObj.username ? (deterministicDecrypt(senderObj.username) || senderObj.username) : "Bilinmeyen" 
            } : null
          };
        }),
        sent: (sentRes.data || []).map((l: any) => {
          const receiverObj = userMap[l.receiver_id];
          return {
            ...l,
            content: l.content ? decrypt(l.content) : "",
            receiver: receiverObj ? { 
              ...receiverObj, 
              username: receiverObj.username ? (deterministicDecrypt(receiverObj.username) || receiverObj.username) : "Bilinmeyen" 
            } : null
          };
        }),
      };
    },
    staleTime: 1000 * 60 * 5,
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

  const receivedLetters = data?.received || [];
  const sentLetters = data?.sent || [];

  const handleSave = async () => {
    const newErrors = { receiver: !receiverId, title: !title.trim(), content: !content.trim() };
    setErrors(newErrors);

    if (newErrors.receiver || newErrors.title || newErrors.content) {
      Alert.alert("Eksik Bilgi", "Lütfen tüm alanları doldur.");
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
      Alert.alert("Başarılı", "Mektup başarıyla mühürlendi! 💌");
      
      // Formu temizle
      setReceiverId("");
      setTitle("");
      setContent("");
      setUnlockDate(todayString());
      
    } catch (error: any) {
      logger.error("Letter save error:", error);
      Alert.alert("Hata", "Mektup mührlenirken bir hata oluştu.");
    } finally {
      setLoadingForm(false);
    }
  };

  const confirmAndSave = () => {
    if (!isPremium) {
      Alert.alert(
        "Token Kullanımı",
        "Bu mektubu göndermek için 100 token kullanılacaktır. Onaylıyor musunuz?",
        [
          { text: "İptal", style: "cancel" },
          { text: "Onayla", onPress: () => handleSave() }
        ]
      );
    } else {
      handleSave();
    }
  };

  const renderLetterItem = (letter: any, type: "received" | "sent") => {
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const unlockDateStr = letter.unlock_date.substring(0, 10);
    const isLockedDate = unlockDateStr > localToday;
    const unlockDateObj = dayjs(unlockDateStr);
    const canOpen = type === "sent" || !isLockedDate;
    const isOpen = openLetterId === letter.id;

    const personName = type === "received"
      ? (letter.sender?.display_name || letter.sender?.username || "Bilinmeyen")
      : (letter.receiver?.display_name || letter.receiver?.username || "Bilinmeyen");

    let relativeDate = dayjs(letter.created_at).format("DD.MM.YYYY");
    if (dayjs(letter.created_at).isSame(dayjs(), 'day')) relativeDate = "Bugün";

    return (
      <View key={letter.id} style={[styles.letterContainer, { backgroundColor: theme.cardBg }]}>
        <TouchableOpacity
          activeOpacity={canOpen ? 0.7 : 1}
          onPress={() => canOpen && setOpenLetterId(isOpen ? null : letter.id)}
          style={{ opacity: (!canOpen && type === "received") ? 0.8 : 1 }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <View style={styles.lockedBadge}>
              {isLockedDate ? (
                <>
                  <XCircle size={14} color="#E8002D" />
                  <Text style={styles.lockedText}>
                    Kilitli (Açılış: {unlockDateObj.format("DD.MM.YYYY")})
                  </Text>
                </>
              ) : (
                <Text style={[styles.lockedText, { color: "#4ade80" }]}>Açık</Text>
              )}
            </View>
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>{relativeDate}</Text>
          </View>
          
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15, marginBottom: 4 }}>
            {letter.title || "İsimsiz Mektup"}
          </Text>
          
          <Text style={styles.letterPerson}>
            {type === "received" ? `Kimden: ${personName}` : `Kime: ${personName}`}
          </Text>

          {!isOpen && (
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 4 }} numberOfLines={1}>
              {(!canOpen && type === "received") ? "Bu mektubun içeriği henüz kilitli..." : (letter.content || "İçerik yok...")}
            </Text>
          )}

          {canOpen && isOpen && (
            <View style={styles.letterBody}>
              <Text style={styles.letterContent}>{letter.content}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (!session) return <View style={{ flex: 1, backgroundColor: "#0a0a0f" }} />;

  return (
    <ScreenBackground>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, paddingTop: insets.top + 16 }}>
            <View style={{ width: 40 }} />
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ fontSize: 28, fontFamily: "PlayfairDisplay_400Regular_Italic", color: "#fff" }}>
                Mektuplar
              </Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 4 }}>Geleceğe mesajlar 💌</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" }}>
              <AlignJustify color="rgba(255,255,255,0.7)" size={22} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={{ marginTop: 40, gap: 24 }}>
              <Skeleton height={200} borderRadius={16} />
              <Skeleton height={200} borderRadius={16} />
            </View>
          ) : (
            <SectionList
              sections={[
                { title: "Gelen Mektuplar", icon: "✉️", data: receivedLetters, type: "received" },
                { title: "Gönderdiğim Mektuplar", icon: "➤", data: sentLetters, type: "sent" }
              ]}
              keyExtractor={(item, index) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 150 }}
              renderSectionHeader={({ section }) => (
                <View style={{ marginBottom: 12, marginTop: section.type === "received" ? 0 : 20 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.4)", letterSpacing: 0.5 }}>
                    {section.type === "received" ? "GELEN MEKTUPLAR" : "GÖNDERDİĞİM MEKTUPLAR"}
                  </Text>
                </View>
              )}
              renderItem={({ item, section }) => renderLetterItem(item, section.type as "received" | "sent")}
              renderSectionFooter={({ section }) => (
                section.data.length === 0 ? (
                  <View style={[styles.letterContainer, { backgroundColor: theme.cardBg, paddingVertical: 20, alignItems: "center" }]}>
                    <Text style={[styles.emptyText, { marginBottom: 0 }]}>
                      {section.type === "received" ? "Henüz sana yazılmış bir mektup yok." : "Henüz kimseye mektup göndermedin."}
                    </Text>
                  </View>
                ) : null
              )}
              ListFooterComponent={
                <View style={[styles.formBox, { backgroundColor: theme.cardBg, borderColor: 'transparent' }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 24 }}>
                    <Text style={{ fontSize: 18 }}>✍️</Text>
                    <Text style={{ fontSize: 24, fontFamily: "PlayfairDisplay_400Regular_Italic", color: "#fff" }}>
                      Yeni Mektup Yaz
                    </Text>
                  </View>

                  {/* Premium Guard */}
                  {!isPremium && tokenBalance < 100 ? (
                    <TouchableOpacity
                      onPress={() => setShowPaywall(true)}
                      activeOpacity={0.7}
                      style={{
                        alignItems: "center",
                        paddingVertical: 30,
                        borderRadius: 16,
                        backgroundColor: "rgba(255,255,255,0.03)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.06)",
                      }}
                    >
                      <Lock color={theme.accent} size={32} />
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16, marginTop: 12 }}>
                        Premium Özellik
                      </Text>
                      <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 6, textAlign: "center", paddingHorizontal: 20 }}>
                        Mektup yazmak için Premium'a geç veya 100 token harca
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: `${theme.accent}15` }}>
                        <Text style={{ color: theme.accent, fontWeight: "700", fontSize: 13 }}>Detayları Gör →</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                  <View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, errors.receiver && { color: "red" }]}>KİME</Text>
                    <View style={styles.usersRow}>
                      {users?.map((u) => {
                        const isSelected = receiverId === String(u.id);
                        return (
                          <TouchableOpacity
                            key={u.id}
                            style={[
                              styles.input,
                              { flex: 1, paddingVertical: 12, alignItems: "center" },
                              isSelected && { borderColor: "#c8922a", backgroundColor: "rgba(200,146,42,0.1)" }
                            ]}
                            onPress={() => {
                              setReceiverId(String(u.id));
                              setErrors(prev => ({ ...prev, receiver: false }));
                            }}
                          >
                            <Text style={[styles.userBtnText, isSelected && { color: "#c8922a", fontWeight: "bold" }]}>
                              {u.display_name || u.username}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {(!users || users.length === 0) && (
                        <TouchableOpacity style={[styles.input, { flex: 1, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
                          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Kullanıcı Seçiniz</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>AÇILIŞ TARİHİ (KİLİT)</Text>
                    <LockKeyhole size={14} color="rgba(255,255,255,0.35)" />
                  </View>
                  <TouchableOpacity
                    style={[styles.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>
                      {dayjs(unlockDate).format("DD MMMM YYYY")}
                    </Text>
                    <CalendarIcon size={16} color="#c8922a" />
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

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, errors.title && { color: "red" }]}>MEKTUP BAŞLIĞI</Text>
                  <TextInput
                    style={[styles.input, errors.title && { borderColor: "red" }]}
                    value={title}
                    onChangeText={(text) => {
                      setTitle(text);
                      setErrors(prev => ({ ...prev, title: false }));
                    }}
                    placeholder="Gelecekteki Bize..."
                    placeholderTextColor="rgba(255,255,255,0.4)"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, errors.content && { color: "red" }]}>MEKTUP İÇERİĞİ</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, errors.content && { borderColor: "red" }]}
                    value={content}
                    onChangeText={(text) => {
                      setContent(text);
                      setErrors(prev => ({ ...prev, content: false }));
                    }}
                    placeholder="Yüreğinden geçenleri dök..."
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    multiline
                  />
                </View>

                <TouchableOpacity 
                  style={[styles.saveBtn, loadingForm && { opacity: 0.7 }]} 
                  onPress={confirmAndSave}
                  disabled={loadingForm}
                >
                  {loadingForm ? (
                    <ActivityIndicator color="#111" />
                  ) : (
                    <>
                      <Text style={{ fontSize: 18 }}>📮</Text>
                      <Text style={styles.saveBtnText}>MEKTUBU MÜHÜRLE</Text>
                    </>
                  )}
                </TouchableOpacity>

                </View>
                  )}
              </View>
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>

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

    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 120, // Alt bar için boşluk
  },
  loadMoreBtn: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  loadMoreText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  formBox: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 18,
    marginTop: 8,
  },
  cardTitleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(200,146,42,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 13,
  },
  letterContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  letterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  letterDate: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lockedText: {
    color: "#E8002D",
    fontSize: 12,
    fontWeight: "600",
  },
  letterPerson: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },
  letterBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
  },
  letterTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#f4f4f5",
    marginBottom: 8,
  },
  letterContent: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 22,
  },
  
  /* Form Styles */
  inputGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "bold",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  usersRow: {
    flexDirection: "row",
    gap: 12,
  },
  userBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#1a1a1e",
  },
  userBtnSelected: {
    borderColor: "#c8922a",
    backgroundColor: "rgba(200,146,42,0.1)",
  },
  userBtnText: {
    color: "#f4f4f5",
    fontSize: 14,
  },
  userBtnTextSelected: {
    color: "#c8922a",
    fontWeight: "bold",
  },
  input: {
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    color: "#fff",
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: "top",
    lineHeight: 22,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fdb765",
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 10,
    shadowColor: "#c8922a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  saveBtnText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 0.5,
  }
});
