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
import { Link, Share2, LogOut, Sparkles, Check, Copy } from "lucide-react-native";
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
  try {
    // 1. Kullanıcının mevcut couple_id'sini kontrol et
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("couple_id")
      .eq("id", userId)
      .maybeSingle();

    if (userError) {
      console.warn("[pairing] user query error:", userError.message);
    }

    let coupleId = user?.couple_id;

    // 2. Eğer user'da couple_id yoksa, bekleyen bir davet kodu var mı kontrol et ve eşleşmeyi dene
    if (!coupleId) {
      const pendingCode = (await AsyncStorage.getItem("@pending_invite_code"))?.trim().toUpperCase();
      if (pendingCode && pendingCode.length >= 4) {
        const { data: joinData, error: joinErr } = await supabase.rpc("join_couple_by_code_uuid", {
          p_code: pendingCode,
        });
        if (!joinErr) {
          await AsyncStorage.removeItem("@pending_invite_code");
          const res = Array.isArray(joinData) ? joinData[0] : joinData;
          coupleId = res?.result_couple_id;
        }
      }
    }

    // 3. Eğer user'da hala couple_id yoksa, yerel hafızada daha önce oluşturulmuş bir coupleId var mı kontrol et
    if (!coupleId) {
      const cachedCoupleId = await AsyncStorage.getItem(`@user_couple_id_${userId}`);
      if (cachedCoupleId) {
        const parsed = parseInt(cachedCoupleId, 10);
        if (!isNaN(parsed)) {
          const { data: c } = await supabase
            .from("couples")
            .select("id, pairing_code")
            .eq("id", parsed)
            .maybeSingle();
          if (c) {
            coupleId = c.id;
          }
        }
      }
    }

    // 4. Hala coupleId yoksa ve bekleyen kod da yoksa yeni bir couple oluştur
    if (!coupleId) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // DİKKAT: 'is_paired' PostgreSQL'de GENERATED column olduğu için insert objesine eklenmez!
      const { data: newCouple, error: insertError } = await supabase
        .from("couples")
        .insert({ pairing_code: code, member_count: 0 })
        .select("id, pairing_code")
        .single();

      if (!insertError && newCouple) {
        coupleId = newCouple.id;
        await AsyncStorage.setItem(`@user_couple_id_${userId}`, String(newCouple.id));
        await AsyncStorage.setItem(`@user_pairing_code_${userId}`, newCouple.pairing_code);

        // Kullanıcıyı bu yeni couple ile eşleştir
        try {
          const { error: joinError } = await supabase.rpc("join_couple_by_code_uuid", {
            p_code: code,
          });
          if (joinError) {
            await supabase
              .from("users")
              .update({ couple_id: newCouple.id })
              .eq("id", userId);
          }
        } catch {
          // Trigger kısıtı varsa silent catch
        }

        return {
          pairingCode: newCouple.pairing_code,
          memberCount: 0,
          isPaired: false,
          hasDates: false,
        };
      } else {
        console.warn("[pairing] insert couple error:", insertError?.message);
        const cachedCode = await AsyncStorage.getItem(`@user_pairing_code_${userId}`);
        if (cachedCode) {
          return { pairingCode: cachedCode, memberCount: 0, isPaired: false, hasDates: false };
        }
      }
    }

    // 4. coupleId varsa detayları getir
    if (coupleId) {
      const { data: couple, error: coupleError } = await supabase
        .from("couples")
        .select("pairing_code, member_count, is_paired, meet_date, relationship_start_date")
        .eq("id", coupleId)
        .maybeSingle();

      if (!coupleError && couple) {
        let pairingCode = couple.pairing_code;

        // Kod boşsa hemen yeni bir 6 haneli kod oluşturup kaydet
        if (!pairingCode) {
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
          let newCode = "";
          for (let i = 0; i < 6; i++) {
            newCode += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          const { error: codeErr } = await supabase
            .from("couples")
            .update({ pairing_code: newCode })
            .eq("id", coupleId);

          if (!codeErr) {
            pairingCode = newCode;
          }
        }

        if (pairingCode) {
          await AsyncStorage.setItem(`@user_pairing_code_${userId}`, pairingCode);
        }

        return {
          pairingCode: pairingCode ?? null,
          memberCount: couple.member_count ?? 0,
          isPaired: couple.is_paired ?? false,
          hasDates: !!couple.relationship_start_date,
        };
      }
    }

    // Son çare: local storage'dan kodu al
    const cachedCode = await AsyncStorage.getItem(`@user_pairing_code_${userId}`);
    return {
      pairingCode: cachedCode ?? null,
      memberCount: 0,
      isPaired: false,
      hasDates: false,
    };
  } catch (err) {
    console.error("[pairing] fetchPairingStatus caught error:", err);
    const cachedCode = await AsyncStorage.getItem(`@user_pairing_code_${userId}`);
    return {
      pairingCode: cachedCode ?? null,
      memberCount: 0,
      isPaired: false,
      hasDates: false,
    };
  }
}

function translatePairingError(msg: string): string {
  if (!msg) return "Bir hata oluştu, lütfen tekrar deneyin.";
  if (msg.includes("INVALID_CODE")) return "Girdiğin kod geçersiz veya kullanım dışı.";
  if (msg.includes("CODE_ALREADY_USED")) return "Bu eşleşme kodu daha önce kullanılmış.";
  if (msg.includes("SELF_CODE")) return "Kendi eşleşme kodunu kullanamazsın.";
  if (msg.includes("COUPLE_FULL")) return "Bu kod artık kullanılamıyor.";
  if (msg.includes("doğrudan değiştirilemez")) return "Eşleşme işlemi tamamlanamadı, lütfen tekrar deneyin.";
  return msg;
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
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

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
      router.replace("/(setup)/dates");
    }
  }, [status?.isPaired, refreshProfile, router]);

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
              router.replace("/(setup)/dates");
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
  }, [userId, params.code, status?.isPaired, refreshProfile, router]);

  async function handleShareInvite() {
    const code = status?.pairingCode;
    if (!code) return;
    const inviteLink = `couplesapp://invite?code=${code}`;
    await Share.share({
      title: "Couples App Daveti 💕",
      message: `Sevgilim, ikimize özel küçük bir evren kurdum! 💌✨\n\nAramıza katılmak ve kilitleri açmak için hemen dokun:\n👉 ${inviteLink}\n\n(Eşleşme Kodumuz: ${code})\n\nSeni çok seviyorum ❤️`,
      url: inviteLink,
    });
  }

  async function handleCopyCode() {
    const code = status?.pairingCode;
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  async function handleCopyLink() {
    const code = status?.pairingCode;
    if (!code) return;
    const inviteLink = `couplesapp://invite?code=${code}`;
    await Clipboard.setStringAsync(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
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
      router.replace("/(setup)/dates");
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

  const activePairingCode = status?.pairingCode;

  return (
    <ScreenBackground colors={["#0A0A10", "#0D0D14", "#0A0A10"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 60, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ marginBottom: 28 }}>
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
                fontSize: 14.5,
                lineHeight: 22,
              }}
            >
              Partnerinle bağlanmak için aşağıdaki 6 haneli kodunu paylaş veya partnerinin kodunu gir.
            </Text>
          </View>

          {/* ─── 1. SENİN EŞLEŞME KODUN KARTI (BELİRGİN VE BÜYÜK) ─── */}
          <View
            style={{
              borderWidth: 1.5,
              borderColor: "rgba(255, 77, 106, 0.4)",
              borderRadius: 24,
              padding: 24,
              backgroundColor: "rgba(255, 77, 106, 0.07)",
              marginBottom: 24,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Sparkles color="#FF4D6A" size={18} />
                <Text style={{ color: "#FF4D6A", fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 1 }}>
                  SENİN EŞLEŞME KODUN
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" }} />
                <Text style={{ color: "#10B981", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Aktif</Text>
              </View>
            </View>

            {/* BÜYÜK VE NET KOD GÖSTERİM KUTUSU */}
            <TouchableOpacity
              onPress={handleCopyCode}
              activeOpacity={0.8}
              style={{
                backgroundColor: "rgba(0,0,0,0.45)",
                borderWidth: 1.5,
                borderColor: "rgba(255, 77, 106, 0.3)",
                borderRadius: 18,
                paddingVertical: 18,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 34,
                  fontFamily: "Inter_700Bold",
                  letterSpacing: 8,
                }}
              >
                {activePairingCode ?? "KOD ALINIYOR"}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}>
                (Kopyalamak için dokun)
              </Text>
            </TouchableOpacity>

            {/* Yan Yana Aksiyon Butonları: Kodu Kopyala & Bağlantıyı Kopyala */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
              <TouchableOpacity
                onPress={handleCopyCode}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  paddingVertical: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                }}
              >
                {copiedCode ? (
                  <>
                    <Check color="#10B981" size={16} />
                    <Text style={{ color: "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      Kopyalandı ✨
                    </Text>
                  </>
                ) : (
                  <>
                    <Copy color="rgba(255,255,255,0.8)" size={16} />
                    <Text style={{ color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      Kodu Kopyala
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleCopyLink}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderRadius: 16,
                  paddingVertical: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                }}
              >
                {copiedLink ? (
                  <>
                    <Check color="#10B981" size={16} />
                    <Text style={{ color: "#10B981", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      Kopyalandı ✨
                    </Text>
                  </>
                ) : (
                  <>
                    <Link color="rgba(255,255,255,0.8)" size={16} />
                    <Text style={{ color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 13 }}>
                      Bağlantıyı Kopyala
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Büyük Ana Paylaş Butonu */}
            <TouchableOpacity
              onPress={handleShareInvite}
              activeOpacity={0.88}
              style={{
                backgroundColor: "#FF4D6A",
                borderRadius: 18,
                paddingVertical: 15,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                marginBottom: 12,
                shadowColor: "#FF4D6A",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
                elevation: 5,
              }}
            >
              <Share2 color="#FFFFFF" size={18} />
              <Text style={{ color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 15 }}>
                Sevgilini Davet Et (Paylaş) 💕
              </Text>
            </TouchableOpacity>

            {/* Bekleniyor Durumu */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#FF4D6A" }} />
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                Partnerin bekleniyor (bağlantıyı açtığında otomatik algılanır)...
              </Text>
            </View>
          </View>

          {/* ─── 2. PARTNERİNİN KODUNU GİR KARTI ─── */}
          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              borderRadius: 24,
              padding: 24,
              backgroundColor: "rgba(255,255,255,0.03)",
              marginBottom: 20,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 6 }}>
              Partnerinin Kodunu Gir
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 18 }}>
              Onun ekranında görünen 6 haneli kodu buraya yaz.
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
                borderColor: "rgba(255,255,255,0.12)",
                borderRadius: 16,
                paddingVertical: 14,
                paddingHorizontal: 20,
                color: "#FFFFFF",
                fontSize: 18,
                letterSpacing: 4,
                textAlign: "center",
                backgroundColor: "rgba(0,0,0,0.3)",
                marginBottom: 16,
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
                  marginBottom: 14,
                }}
              >
                <Text style={{ color: "#FF4D6A", fontSize: 13, textAlign: "center" }}>
                  {submitError}
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting || inputCode.length < 4}
              style={{
                backgroundColor: inputCode.length < 4 ? "rgba(77,156,255,0.4)" : "#4D9CFF",
                paddingVertical: 16,
                borderRadius: 24,
                alignItems: "center",
                shadowColor: "#4D9CFF",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                  Eşleş
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* ─── 3. BEKLEME ODASI: PARTNER KATILINCA NELER AÇILACAK? ─── */}
          <View
            style={{
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              borderRadius: 20,
              padding: 18,
              backgroundColor: "rgba(255,255,255,0.03)",
              marginBottom: 16,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 14.5, fontFamily: "Inter_700Bold", marginBottom: 12 }}>
              Partnerin Katıldığında Neler Açılacak? ✨
            </Text>
            {[
              "⏳ Ortak Aşk Sayacınız ve özel yıldönümü bildirimleriniz",
              "💌 Birbirinize özel mühürlü mektuplar ve origami animasyonu",
              "📸 Birlikte gezdiğiniz yerlerin haritası ve ortak anı albümünüz",
            ].map((item, index) => (
              <Text
                key={item}
                style={{
                  color: "rgba(255,255,255,0.65)",
                  fontSize: 13,
                  lineHeight: 20,
                  marginBottom: index === 2 ? 0 : 8,
                }}
              >
                {item}
              </Text>
            ))}
          </View>

          {/* ─── 4. DEMO MODU İLE TEST ET BUTONU ─── */}
          <TouchableOpacity
            onPress={() => {
              enterDemoMode();
              router.replace("/(tabs)/home");
            }}
            activeOpacity={0.85}
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
              marginBottom: 8,
            }}
          >
            <Sparkles color="#FF4D6A" size={18} />
            <Text style={{ color: "#FF4D6A", fontSize: 14, fontFamily: "Inter_700Bold" }}>
              Uygulamayı Demo Modunda Keşfet ✨
            </Text>
          </TouchableOpacity>
          <Text
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
              lineHeight: 18,
              textAlign: "center",
              paddingHorizontal: 12,
              marginBottom: 16,
            }}
          >
            (Partnerini beklerken uygulamanın tüm özelliklerini demo çiftiyle güvenle keşfedebilirsin).
          </Text>

          {/* ─── 5. ÇIKIŞ / GERİ DÖN BUTONU ─── */}
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
              padding: 12,
              marginBottom: 30,
            }}
          >
            <LogOut color="rgba(255,255,255,0.4)" size={16} />
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13.5, fontWeight: "600" }}>
              Giriş Ekranına Dön
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
