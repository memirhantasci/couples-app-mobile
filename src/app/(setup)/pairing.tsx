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
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Link, Clipboard as ClipboardIcon, Share as ShareIcon, LogOut } from "lucide-react-native";

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
  const { session, refreshProfile, signOut } = useAuth();
  const userId = session?.user?.id;
  const params = useLocalSearchParams<{ code?: string }>();

  const [inputCode, setInputCode] = useState(params.code ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: status, isLoading } = useQuery<PairingStatus>({
    queryKey: ["pairing-status", userId],
    queryFn: () => fetchPairingStatus(userId!),
    enabled: !!userId,
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
  });
    
  useEffect(() => {
    if (!status) return;
    if (status.isPaired) {
      refreshProfile();
    }
  }, [status, refreshProfile]);

  async function handleCopy() {
    if (!status?.pairingCode) return;
    await Clipboard.setStringAsync(status.pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!status?.pairingCode) return;
    await Share.share({
      message: `Benimle eşleş! Kodum: ${status.pairingCode}. Ya da direkt tıkla: couplesapp://pair?code=${status.pairingCode}`,
    });
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
          <View style={{ marginBottom: 40 }}>
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 34,
                fontFamily: "PlayfairDisplay_400Regular_Italic",
                marginBottom: 8,
              }}
            >
              Eşleşme Kodu
            </Text>
            <Text
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 15,
                lineHeight: 22,
              }}
            >
              Partnerinle bağlanmak için kodunu paylaş veya onun kodunu gir.
            </Text>
          </View>

          {/* Your Code Card */}
          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(255, 77, 106, 0.2)",
              borderRadius: 24,
              padding: 24,
              backgroundColor: "rgba(255,255,255,0.02)",
              marginBottom: 24,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <Link color="#FF4D6A" size={18} />
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600", letterSpacing: 1 }}>
                SENİN KODUN
              </Text>
            </View>

            <View
              style={{
                backgroundColor: "rgba(0,0,0,0.3)",
                borderRadius: 16,
                paddingVertical: 20,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 36,
                  fontWeight: "800",
                  letterSpacing: 4,
                }}
              >
                {status?.pairingCode ?? "------"}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginBottom: 24 }}>
              <TouchableOpacity
                onPress={handleCopy}
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderRadius: 20,
                  paddingVertical: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 16 }}>{copied ? "✅" : "📋"}</Text>
                <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>
                  {copied ? "Kopyalandı" : "Kopyala"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShare}
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderRadius: 20,
                  paddingVertical: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Text style={{ fontSize: 16 }}>📤</Text>
                <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>
                  Paylaş
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" }}
            >
              <View
                style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF4D6A" }}
              />
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                Partnerin bekleniyor...
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
              marginTop: 16,
              marginBottom: 40,
              padding: 16,
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
