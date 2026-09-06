import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Link, Clipboard as ClipboardIcon, Share2, LogOut, Heart, Sparkles, Check, Copy } from "lucide-react-native";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";

// ─── Types ───────────────────────────────────────────────────────────────────

type PairingStatus = {
  pairingCode: string | null;
  memberCount: number;
  isPaired: boolean;
  hasDates: boolean;
};

// ─── RPC Helpers ─────────────────────────────────────────────────────────────

async function fetchPairingStatus(userId: string): Promise<PairingStatus> {
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("couple_id")
    .eq("id", userId)
    .single();

  if (userError) {
    return { pairingCode: null, memberCount: 0, isPaired: false, hasDates: false };
  }

  let coupleId = user?.couple_id;

  if (!coupleId) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const { data: newCouple, error: insertError } = await supabase
      .from("couples")
      .insert({ pairing_code: code })
      .select("id")
      .single();

    if (!insertError && newCouple) {
      await supabase
        .from("users")
        .update({ couple_id: newCouple.id })
        .eq("id", userId);
      
      coupleId = newCouple.id;
    } else {
      return { pairingCode: null, memberCount: 0, isPaired: false, hasDates: false };
    }
  }

  const { data: couple, error: coupleError } = await supabase
    .from("couples")
    .select("pairing_code, member_count, is_paired, meet_date, relationship_start_date")
    .eq("id", coupleId)
    .single();

  if (coupleError || !couple) {
    return { pairingCode: null, memberCount: 0, isPaired: false, hasDates: false };
  }

  return {
    pairingCode: couple.pairing_code ?? null,
    memberCount: couple.member_count ?? 0,
    isPaired: couple.is_paired ?? false,
    hasDates: !!(couple.meet_date && couple.relationship_start_date),
  };
}

function translatePairingError(msg: string): string {
  if (msg.includes("INVALID_CODE")) return "Girdiğin kod geçersiz veya kullanım dışı.";
  if (msg.includes("CODE_ALREADY_USED")) return "Bu eşleşme kodu daha önce kullanılmış.";
  if (msg.includes("SELF_CODE")) return "Kendi eşleşme kodunu kullanamazsın.";
  if (msg.includes("COUPLE_FULL")) return "Bu kod artık kullanılamıyor.";
  return "Bir hata oluştu, tekrar dene.";
}

// ─── Pairing Screen ──────────────────────────────────────────────────────────

export default function PairingScreen() {
  const router = useRouter();
  const { session, refreshProfile, signOut, enterDemoMode } = useAuth();
  const userId = session?.user?.id;
  const params = useLocalSearchParams<{ code?: string }>();

  const [inputCode, setInputCode] = useState(params.code ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const { data: status, isLoading } = useQuery<PairingStatus>({
    queryKey: ["pairing-status", userId],
    queryFn: () => fetchPairingStatus(userId!),
    enabled: !!userId,
    refetchInterval: 3500,
    refetchIntervalInBackground: false,
  });
    
  useEffect(() => {
    if (!status) return;
    if (status.isPaired) {
      refreshProfile();
    }
  }, [status, refreshProfile]);

  // Hafızada bekleyen davet kodu varsa veya route param gelmişse otomatik eşleş
  useEffect(() => {
    async function checkAutoPair() {
      if (!userId || status?.isPaired) return;
      const pending = (params.code || (await AsyncStorage.getItem("@pending_invite_code")))?.trim().toUpperCase();
      if (pending && pending.length >= 4) {
        setIsSubmitting(true);
        setSubmitError("");
        try {
          const { data, error } = await supabase.rpc("join_couple_by_code_uuid", {
            p_code: pending,
          });
          if (!error) {
            await AsyncStorage.removeItem("@pending_invite_code");
            const result = Array.isArray(data) ? data[0] : data;
            if (result?.result_is_paired) {
              await refreshProfile();
            }
          }
        } catch {
          // sessiz fallback
        } finally {
          setIsSubmitting(false);
        }
      }
    }
    checkAutoPair();
  }, [userId, params.code, status?.isPaired, refreshProfile]);

  async function handleShareInvite() {
    if (!status?.pairingCode) return;
    const inviteLink = `couplesapp://invite?code=${status.pairingCode}`;
    await Share.share({
      title: "Couples App Daveti 💕",
      message: `Canım, Couples App'te aşkımıza özel bir alan kurdum! 💖\n\nOtomatik bağlanmak için bu bağlantıya tıkla:\n${inviteLink}\n\n(Uygulama içinden girmek istersen Eşleşme Kodumuz: ${status.pairingCode})`,
      url: inviteLink,
    });
  }

  async function handleCopyLink() {
    if (!status?.pairingCode) return;
    const inviteLink = `couplesapp://invite?code=${status.pairingCode}`;
    await Clipboard.setStringAsync(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  async function handleCopyCode() {
    if (!status?.pairingCode) return;
    await Clipboard.setStringAsync(status.pairingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  async function handleSubmit() {
    const code = inputCode.trim().toUpperCase();
    if (code.length < 4) {
      setSubmitError("Geçerli bir eşleşme kodu gir.");
      return;
    }
    if (!userId) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError("");

    const { data, error } = await supabase.rpc("join_couple_by_code_uuid", {
      p_code: code,
    });

    if (error) {
      setSubmitError(translatePairingError(error.message));
      setIsSubmitting(false);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    const isPaired: boolean = result?.result_is_paired ?? false;

    setIsSubmitting(false);

    if (isPaired) {
      await AsyncStorage.removeItem("@pending_invite_code");
      await refreshProfile();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0A0A10", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#FF4D6A" size="large" />
      </View>
    );
  }

  return (
    <ScreenBackground colors={["#0A0A10", "#0D0D14", "#0A0A10"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          
          {/* Header */}
          <View style={{ marginBottom: 32 }}>
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 30,
                fontFamily: "Inter_700Bold",
                letterSpacing: -0.5,
                marginBottom: 8,
              }}
            >
              Sevgilinle Eşleş 💕
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 15,
                lineHeight: 22,
              }}
            >
              Davet bağlantısını sevgiline gönder. Linke tıkladığında kod girmesine gerek kalmadan doğrudan seninle eşleşecek!
            </Text>
          </View>

          {/* ─── 1. BÜYÜK DAVET ET KARTI (ÖNERİLEN & KOLAY YÖNTEM) ─── */}
          <View
            style={{
              borderWidth: 1.5,
              borderColor: "rgba(255, 77, 106, 0.35)",
              borderRadius: 24,
              padding: 24,
              backgroundColor: "rgba(255, 77, 106, 0.05)",
              marginBottom: 28,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Sparkles color="#FF4D6A" size={18} />
              <Text style={{ color: "#FF4D6A", fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 1 }}>
                TEK TIKLA DAVET ET
              </Text>
            </View>

            <Text style={{ color: "#FFFFFF", fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 6 }}>
              Sevgiline Davet Bağlantısı Gönder
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13.5, lineHeight: 20, marginBottom: 20 }}>
              WhatsApp veya herhangi bir mesajlaşma uygulamasından paylaş. Sevgilin bağlantıyı açıp kayıt olduğunda otomatik bağlanacaksınız!
            </Text>

            {/* Büyük Ana Paylaş Butonu */}
            <TouchableOpacity
              onPress={handleShareInvite}
              activeOpacity={0.88}
              style={{
                backgroundColor: "#FF4D6A",
                borderRadius: 18,
                paddingVertical: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 12,
                shadowColor: "#FF4D6A",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <Share2 color="#FFFFFF" size={18} />
              <Text style={{ color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>
                Sevgilini Davet Et (Paylaş) 💕
              </Text>
            </TouchableOpacity>

            {/* Yan Yana İkincil Aksiyonlar: Bağlantıyı Kopyala & Kodu Kopyala */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              <TouchableOpacity
                onPress={handleCopyLink}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderRadius: 16,
                  paddingVertical: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.1)",
                }}
              >
                {copiedLink ? (
                  <>
                    <Check color="#10B981" size={15} />
                    <Text style={{ color: "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 12.5 }}>
                      Kopyalandı ✨
                    </Text>
                  </>
                ) : (
                  <>
                    <Link color="rgba(255,255,255,0.7)" size={15} />
                    <Text style={{ color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 12.5 }}>
                      Bağlantıyı Kopyala
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCopyCode}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderRadius: 16,
                  paddingVertical: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.1)",
                }}
              >
                {copiedCode ? (
                  <>
                    <Check color="#10B981" size={15} />
                    <Text style={{ color: "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 12.5 }}>
                      Kopyalandı ✨
                    </Text>
                  </>
                ) : (
                  <>
                    <Copy color="rgba(255,255,255,0.7)" size={15} />
                    <Text style={{ color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 12.5 }}>
                      Kodu Kopyala ({status?.pairingCode ?? "------"})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Bekleniyor Göstergesi */}
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" }}
            >
              <View
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF4D6A" }}
              />
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12.5 }}>
                Partnerin bekleniyor (bağlantıyı açtığında otomatik algılanır)...
              </Text>
            </View>
          </View>

          {/* Enter partner's code Card */}
          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              borderRadius: 24,
              padding: 24,
              backgroundColor: "rgba(255,255,255,0.02)",
            }}
          >
            <Text
              style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 6 }}
            >
              Partnerinin Kodunu Gir
            </Text>
            <Text
              style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 20 }}
            >
              Onun oluşturduğu 6 haneli kodu buraya yaz.
            </Text>

            <TextInput
              value={inputCode}
              onChangeText={(t) => {
                setInputCode(t.toUpperCase());
                if (submitError) setSubmitError("");
              }}
              placeholder="XXXXXX"
              placeholderTextColor="rgba(255,255,255,0.2)"
              maxLength={6}
              autoCapitalize="characters"
              autoCorrect={false}
              style={{
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
                borderRadius: 16,
                paddingVertical: 16,
                paddingHorizontal: 20,
                color: "#FFFFFF",
                fontSize: 18,
                letterSpacing: 4,
                backgroundColor: "rgba(0,0,0,0.3)",
                marginBottom: 20,
              }}
            />

            {!!submitError && (
              <View
                style={{
                  backgroundColor: "rgba(232,0,45,0.1)",
                  borderWidth: 1,
                  borderColor: "rgba(232,0,45,0.3)",
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <Text style={{ color: "#FF4D6A", fontSize: 14, textAlign: "center" }}>
                  {submitError}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting || inputCode.length < 4}
              style={{
                backgroundColor: inputCode.length < 4 ? "rgba(77,156,255,0.5)" : "#4D9CFF",
                paddingVertical: 18,
                borderRadius: 30,
                alignItems: "center",
                shadowColor: "#4D9CFF",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>
                  Eşleş
                </Text>
              )}
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            onPress={() => {
              enterDemoMode();
              router.replace("/(tabs)/home");
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              backgroundColor: "rgba(255, 77, 106, 0.12)",
              borderWidth: 1.2,
              borderColor: "rgba(255, 77, 106, 0.4)",
              borderRadius: 20,
              paddingVertical: 14,
              paddingHorizontal: 20,
              marginTop: 16,
            }}
          >
            <Sparkles color="#FF4D6A" size={18} />
            <Text style={{ color: "#FF4D6A", fontSize: 14, fontFamily: "Inter_700Bold" }}>
              Uygulamayı Demo Modunda Keşfet ✨
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={async () => {
              try {
                await signOut();
              } catch (e) {
                console.error(e);
              }
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              marginTop: 12,
              marginBottom: 40,
              padding: 14,
            }}
          >
            <LogOut color="rgba(255,255,255,0.5)" size={18} />
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: "600" }}>
              Giriş Ekranına Dön
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
