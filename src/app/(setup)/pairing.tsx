import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// ─── Types ───────────────────────────────────────────────────────────────────

type PairingStatus = {
  pairingCode: string | null;
  memberCount: number;
  isPaired: boolean;
  hasDates: boolean;
};

// ─── RPC Helpers ─────────────────────────────────────────────────────────────

async function fetchPairingStatus(userId: string): Promise<PairingStatus> {
  // Get user's couple_id
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("couple_id")
    .eq("auth_id", userId)
    .single();

  if (userError || !user?.couple_id) {
    return { pairingCode: null, memberCount: 0, isPaired: false, hasDates: false };
  }

  // Get couple details — always fresh from DB, never cached boolean
  const { data: couple, error: coupleError } = await supabase
    .from("couples")
    .select("pairing_code, member_count, is_paired, meet_date, relationship_start_date")
    .eq("id", user.couple_id)
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
  const { session } = useAuth();
  const userId = session?.user?.id;
  const params = useLocalSearchParams<{ code?: string }>();

  const [inputCode, setInputCode] = useState(params.code ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [copied, setCopied] = useState(false);

  // ── Poll pairing status every 4 seconds (web'deki setInterval mantığının RQ karşılığı)
  const { data: status, isLoading } = useQuery<PairingStatus>({
    queryKey: ["pairing-status", userId],
    queryFn: () => fetchPairingStatus(userId!),
    enabled: !!userId,
    refetchInterval: 4000, // Her 4 saniyede otomatik yenile
    refetchIntervalInBackground: false,
  });

  // ── Auto-navigate when partner has joined
  useEffect(() => {
    if (!status) return;
    if (status.isPaired) {
      if (status.hasDates) {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/(setup)/dates");
      }
    }
  }, [status]);

  // ── Copy pairing code to clipboard
  async function handleCopy() {
    if (!status?.pairingCode) return;
    await Clipboard.setStringAsync(status.pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Share pairing code via native share sheet
  async function handleShare() {
    if (!status?.pairingCode) return;
    await Share.share({
      message: `Benimle eşleş! Kodum: ${status.pairingCode}. Ya da direkt tıkla: couplesapp://pair?code=${status.pairingCode}`,
    });
  }

  // ── Submit partner's code
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
      p_user_id: userId,
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
      router.replace("/(setup)/dates");
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#080811", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#E8002D" size="large" />
      </View>
    );
  }

  return (
    <LinearGradient colors={["#080811", "#0A0A0C", "#080811"]} style={{ flex: 1 }}>
      {/* Red glow */}
      <View
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: "rgba(232, 0, 45, 0.12)",
        }}
      />

      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        {/* Header */}
        <View style={{ alignItems: "center", marginBottom: 36 }}>
          <Text style={{ fontSize: 52, marginBottom: 14 }}>💑</Text>
          <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "800", marginBottom: 8 }}>
            Eşleşme Bekleniyor
          </Text>
          <Text
            style={{ color: "rgba(255,255,255,0.6)", fontSize: 14, textAlign: "center", lineHeight: 20 }}
          >
            Sevgilinin seninle eşleşebilmesi için bu kodu ona gönder:
          </Text>
        </View>

        {/* Your Code Card */}
        <View
          style={{
            borderWidth: 1.5,
            borderColor: "rgba(245, 200, 66, 0.4)",
            borderStyle: "dashed",
            borderRadius: 20,
            padding: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginBottom: 16,
            backgroundColor: "rgba(245,200,66,0.05)",
          }}
        >
          <Text
            style={{
              color: "#F5C842",
              fontSize: 32,
              fontWeight: "800",
              letterSpacing: 6,
            }}
          >
            {status?.pairingCode ?? "------"}
          </Text>
          <TouchableOpacity onPress={handleCopy} style={{ padding: 8 }}>
            <Text style={{ fontSize: 22 }}>{copied ? "✅" : "📋"}</Text>
          </TouchableOpacity>
        </View>

        {/* Share Button */}
        <TouchableOpacity
          onPress={handleShare}
          style={{
            backgroundColor: "rgba(245,200,66,0.12)",
            borderWidth: 1,
            borderColor: "rgba(245,200,66,0.3)",
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <Text style={{ color: "#F5C842", fontWeight: "700", fontSize: 15 }}>
            📤 Kodu Paylaş
          </Text>
        </TouchableOpacity>

        {/* Polling indicator */}
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 32 }}
        >
          <View
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ADE80" }}
          />
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            Sevgilinin eşleşmesini bekliyorsun...
          </Text>
        </View>

        {/* Divider */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>veya</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />
        </View>

        {/* Enter partner's code */}
        <Text
          style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, marginBottom: 12, textAlign: "center" }}
        >
          Sevgilinin kodu sende mi? Buraya gir:
        </Text>

        <TextInput
          value={inputCode}
          onChangeText={(t) => {
            setInputCode(t.toUpperCase());
            if (submitError) setSubmitError("");
          }}
          placeholder="Örn: A8F4T1"
          placeholderTextColor="rgba(245,200,66,0.3)"
          maxLength={6}
          autoCapitalize="characters"
          autoCorrect={false}
          style={{
            borderWidth: 1.5,
            borderColor: "rgba(245,200,66,0.4)",
            borderStyle: "dashed",
            borderRadius: 16,
            paddingVertical: 16,
            paddingHorizontal: 20,
            color: "#F5C842",
            fontSize: 22,
            fontWeight: "700",
            letterSpacing: 6,
            textAlign: "center",
            backgroundColor: "rgba(0,0,0,0.25)",
            marginBottom: 12,
          }}
        />

        {!!submitError && (
          <View
            style={{
              backgroundColor: "rgba(232,0,45,0.12)",
              borderWidth: 1,
              borderColor: "rgba(232,0,45,0.3)",
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: "#FF4D6A", fontSize: 14, textAlign: "center" }}>
              ⚠️ {submitError}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting || inputCode.length < 4}
          style={{
            backgroundColor: inputCode.length < 4 ? "rgba(232,0,45,0.3)" : "#E8002D",
            paddingVertical: 18,
            borderRadius: 18,
            alignItems: "center",
            shadowColor: "#E8002D",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>
              Eşleşmeyi Tamamla
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}
