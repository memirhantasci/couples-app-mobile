import React, { useState } from "react";
import { View, Text, SectionList, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dayjs, todayString } from "@/lib/date";
import { encrypt, decrypt, deterministicDecrypt } from "@/utils/crypto";
import { Lock, ChevronRight, FileEdit, LockKeyhole } from "lucide-react-native";
import { sanitize, sanitizeStrict } from "@/utils/sanitize";
import { logger } from "@/utils/logger";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LettersScreen() {
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const today = todayString();
  const insets = useSafeAreaInsets();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  const [letterLimit, setLetterLimit] = useState(15);

  // --- Mektupları Getir ---
  const { data, isLoading } = useQuery({
    queryKey: ["letters_data", coupleId, userId, letterLimit],
    enabled: !!coupleId && !!userId,
    queryFn: async () => {
      const [receivedRes, sentRes] = await Promise.all([
        supabase
          .from("letters")
          .select("*, sender:users!letters_sender_id_fkey(username, display_name)")
          .eq("couple_id", coupleId)
          .eq("receiver_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("letters")
          .select("*, receiver:users!letters_receiver_id_fkey(username, display_name)")
          .eq("couple_id", coupleId)
          .eq("sender_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      return {
        received: (receivedRes.data || []).map((l: any) => ({
          ...l,
          content: l.content ? decrypt(l.content) : "",
          sender: { 
            ...l.sender, 
            username: l.sender?.username ? (deterministicDecrypt(l.sender.username) || l.sender.username) : "Bilinmeyen" 
          }
        })),
        sent: (sentRes.data || []).map((l: any) => ({
          ...l,
          content: l.content ? decrypt(l.content) : "",
          receiver: { 
            ...l.receiver, 
            username: l.receiver?.username ? (deterministicDecrypt(l.receiver.username) || l.receiver.username) : "Bilinmeyen" 
          }
        })),
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
        username: deterministicDecrypt(u.username) || u.username
      })).filter(u => u.id !== userId && u.id !== Number(userId));
    }
  });

  const [openLetterId, setOpenLetterId] = useState<number | null>(null);

  // --- Form State ---
  const [receiverId, setReceiverId] = useState("");
  const [unlockDate, setUnlockDate] = useState(todayString());
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

      const { error } = await supabase.rpc("save_letter", {
        p_sender_id:   userId,
        p_receiver_id: parseInt(receiverId, 10),
        p_title:       cleanTitle,
        p_content:     encrypt(cleanContent),
        p_unlock_date: unlockDate,
        p_couple_id:   coupleId ? parseInt(String(coupleId), 10) : null,
      });

      if (error) throw error;

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

  const renderLetterItem = (letter: any, type: "received" | "sent") => {
    const unlockDateObj = dayjs(letter.unlock_date);
    const isLockedDate = unlockDateObj.isAfter(dayjs(today).startOf("day"));
    const canOpen = type === "sent" || !isLockedDate;
    const isOpen = openLetterId === letter.id;

    const personName = type === "received"
      ? (letter.sender?.display_name || letter.sender?.username || "Bilinmeyen")
      : (letter.receiver?.display_name || letter.receiver?.username || "Bilinmeyen");

    const dateStr = dayjs(letter.created_at).format("DD.MM.YYYY HH:mm");

    return (
      <View key={letter.id} style={styles.letterContainer}>
        <TouchableOpacity
          activeOpacity={canOpen ? 0.7 : 1}
          onPress={() => canOpen && setOpenLetterId(isOpen ? null : letter.id)}
          style={[styles.letterHeader, !canOpen && { opacity: 0.6 }]}
        >
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.letterDate}>{dateStr}</Text>
              {isLockedDate && (
                <View style={styles.lockedBadge}>
                  <Lock size={12} color="#E8002D" />
                  <Text style={styles.lockedText}>
                    {type === "received" ? `Kilitli (Açılış: ${unlockDateObj.format("DD.MM.YYYY")})` : `Alıcıya Kilitli (${unlockDateObj.format("DD.MM.YYYY")})`}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.letterPerson}>
              {type === "received" ? "Gönderen:" : "Alıcı:"} <Text style={{ color: "#c8922a", fontWeight: "600" }}>{personName}</Text>
            </Text>
          </View>
          {canOpen && (
            <ChevronRight size={20} color="rgba(255,255,255,0.3)" style={{ transform: [{ rotate: isOpen ? "90deg" : "0deg" }] }} />
          )}
        </TouchableOpacity>

        {canOpen && isOpen && (
          <View style={styles.letterBody}>
            <Text style={styles.letterTitle}>{letter.title}</Text>
            <Text style={styles.letterContent}>{letter.content}</Text>
          </View>
        )}
      </View>
    );
  };

  if (!session) return <View style={{ flex: 1, backgroundColor: "#0a0a0f" }} />;

  return (
    <ScreenBackground>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: 0, flex: 1 }]}>
          
          <PageHeader title="MEKTUPLAR 💌" />

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
              renderSectionHeader={({ section }) => (
                <View style={[styles.cardTitleBox, { marginTop: section.type === "received" ? 24 : 16 }]}>
                  <Text style={{ fontSize: 18 }}>{section.icon}</Text>
                  <Text style={styles.cardTitle}>{section.title}</Text>
                </View>
              )}
              renderItem={({ item, section }) => renderLetterItem(item, section.type as "received" | "sent")}
              renderSectionFooter={({ section }) => (
                section.data.length === 0 ? (
                  <Text style={[styles.emptyText, { marginBottom: 16 }]}>
                    {section.type === "received" ? "Henüz sana yazılmış bir mektup yok." : "Henüz kimseye mektup göndermedin."}
                  </Text>
                ) : <View style={{ height: 16 }} />
              )}
              ListFooterComponent={
                <View style={styles.formBox}>
                  {/* --- YENİ MEKTUP YAZ FORMU --- */}
                <View style={[styles.cardTitleBox, { marginBottom: 20 }]}>
                  <View style={styles.iconBox}>
                    <FileEdit color="#c8922a" size={16} />
                  </View>
                  <Text style={[styles.cardTitle, { color: "#c8922a" }]}>Yeni Mektup Yaz</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, errors.receiver && { color: "red" }]}>ALICI KİM?</Text>
                  {users ? (
                    <View style={styles.usersRow}>
                      {users.map(u => (
                        <TouchableOpacity
                          key={u.id}
                          style={[styles.userBtn, receiverId === String(u.id) && styles.userBtnSelected]}
                          onPress={() => {
                            setReceiverId(String(u.id));
                            setErrors(prev => ({ ...prev, receiver: false }));
                          }}
                        >
                          <Text style={[styles.userBtnText, receiverId === String(u.id) && styles.userBtnTextSelected]}>
                            {u.display_name || u.username}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <ActivityIndicator color="#c8922a" style={{ alignSelf: "flex-start" }} />
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>AÇILIŞ TARİHİ (KİLİT)</Text>
                    <LockKeyhole size={14} color="rgba(255,255,255,0.35)" />
                  </View>
                  <TextInput
                    style={styles.input}
                    value={unlockDate}
                    onChangeText={setUnlockDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                  />
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
                  onPress={handleSave}
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
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    paddingBottom: 8,
  },
  letterHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  letterDate: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lockedText: {
    color: "#E8002D",
    fontSize: 11,
    fontWeight: "600",
  },
  letterPerson: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },
  letterBody: {
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderLeftWidth: 2,
    borderLeftColor: "#c8922a",
    padding: 16,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
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
    backgroundColor: "#1a1a1e",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
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
    backgroundColor: "#c8922a",
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
