import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { WatchAdModal } from "@/components/ui/WatchAdModal";
import { PremiumSuccessModal } from "@/components/ui/PremiumSuccessModal";
import { router, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { getTheme, AppTheme } from "@/lib/theme";
import { encrypt, decrypt } from "@/utils/crypto";
import DateTimePicker from "@react-native-community/datetimepicker";
import { RevenueCatService } from "@/lib/revenuecat";
import {
  User,
  Gift,
  CalendarHeart,
  LogOut,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  Menu,
  AlignJustify,
  Wallet,
  PlayCircle
} from "lucide-react-native";

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
  theme,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  theme: AppTheme;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View
      style={{
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: theme.cardBg,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.05)",
        marginBottom: 12,
      }}
    >
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 18,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              backgroundColor: theme.pillAccentBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </View>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
            {title}
          </Text>
        </View>
        <View>
          {open ? (
            <ChevronUp size={18} color="rgba(255,255,255,0.4)" />
          ) : (
            <ChevronDown size={18} color="rgba(255,255,255,0.4)" />
          )}
        </View>
      </TouchableOpacity>

      {open && (
        <View
          style={{
            paddingHorizontal: 18,
            paddingBottom: 20,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.06)",
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}

// ─── Label + Input ────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  error,
  theme,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  error?: boolean;
  theme: AppTheme;
}) {
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: error ? "#FF4D6A" : "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 6 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? ""}
        placeholderTextColor="rgba(255,255,255,0.3)"
        multiline={multiline}
        style={{
          backgroundColor: theme.inputBg,
          borderWidth: 1,
          borderColor: error ? "red" : "rgba(255,255,255,0.1)",
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 13,
          color: "#fff",
          fontSize: 15,
          minHeight: multiline ? 80 : undefined,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

// ─── Save Button ──────────────────────────────────────────────────────────────

function SaveButton({
  onPress,
  loading,
  label = "Kaydet",
  theme,
}: {
  onPress: () => void;
  loading?: boolean;
  label?: string;
  theme: AppTheme;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={{
        marginTop: 18,
        backgroundColor: loading ? theme.pillAccentBg : theme.accent,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: "center",
        shadowColor: theme.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: loading ? theme.accent : "#fff", fontWeight: "700", fontSize: 15 }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { session, signOut, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const theme = getTheme(profile?.gender);

  const [displayName, setDisplayName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [gender, setGender] = useState<"male" | "female">("female");
  const [meetDate, setMeetDate] = useState("");
  const [relStartDate, setRelStartDate] = useState("");
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [deletionDate, setDeletionDate] = useState<string | null>(null);

  const [showMeetDatePicker, setShowMeetDatePicker] = useState(false);
  const [showRelDatePicker, setShowRelDatePicker] = useState(false);

  const [profileLoading, setProfileLoading] = useState(false);
  const [datesLoading, setDatesLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // Promosyon Kodu
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  // Reklam & Premium Modal
  const [showAdModal, setShowAdModal] = useState(false);
  const [showPremiumSuccess, setShowPremiumSuccess] = useState(false);

  // Eklentiler: Tema vs
  // Verileri yükle
  React.useEffect(() => {
    if (!session?.user?.id || dataLoaded) return;
    const uid = session.user.id;
    (async () => {
      const { data: userData } = await supabase
        .from("users")
        .select("display_name, gender, couple_id")
        .eq("id", uid)
        .single();

      if (userData) {
        setDisplayName(userData.display_name ? decrypt(userData.display_name) : "");
        setGender((userData.gender as "male" | "female") ?? "female");
        setCoupleId(userData.couple_id ?? null);

        if (userData.couple_id) {
          const { data: coupleData } = await supabase
            .from("couples")
            .select("meet_date, relationship_start_date, deletion_scheduled_at")
            .eq("id", userData.couple_id)
            .single();

          if (coupleData) {
            setMeetDate(coupleData.meet_date ?? "");
            setRelStartDate(coupleData.relationship_start_date ?? "");
            setDeletionDate(coupleData.deletion_scheduled_at ?? null);
          }
        }
      }
      setDataLoaded(true);
    })();
  }, [session, dataLoaded]);

  // Profili Güncelle
  async function handleUpdateProfile() {
    if (!session?.user?.id) return;
    if (displayName.trim().length < 2) {
      setNameError(true);
      Alert.alert("Hata", "İsim en az 2 karakter olmalı.");
      return;
    }
    setProfileLoading(true);
    const { error } = await supabase
      .from("users")
      .update({ display_name: encrypt(displayName.trim()), gender })
      .eq("id", session.user.id);
    setProfileLoading(false);

    if (error) {
      Alert.alert("Hata", "Profil güncellenemedi. Lütfen tekrar deneyin.");
    } else {
      queryClient.invalidateQueries({ queryKey: ["user_gender"] });
      Alert.alert("Başarılı 🎉", "Profilin güncellendi!");
    }
  }

  // İlişki Tarihlerini Güncelle
  async function handleUpdateDates() {
    if (!coupleId) return;
    if (!meetDate || !relStartDate) {
      Alert.alert("Hata", "Her iki tarih de gereklidir.");
      return;
    }
    setDatesLoading(true);
    const { error } = await supabase
      .from("couples")
      .update({ meet_date: meetDate, relationship_start_date: relStartDate })
      .eq("id", coupleId);
    setDatesLoading(false);

    if (error) {
      Alert.alert("Hata", "Tarihler güncellenemedi. Lütfen tekrar deneyin.");
    } else {
      Alert.alert("Başarılı 💕", "İlişki tarihleri güncellendi!");
    }
  }

  // Çıkış Yap
  async function handleLogout() {
    Alert.alert("Çıkış Yap", "Hesabından çıkış yapmak istediğinden emin misin?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Çıkış Yap",
        style: "destructive",
        onPress: async () => {
          // Push token'ı sil
          if (session?.user?.id) {
            await supabase
              .from("push_tokens")
              .delete()
              .eq("user_id", session.user.id);
          }
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  // Promosyon Kodu İşlemi
  async function handleRedeemPromo() {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;

    if (code === "FREEMIRHAN") {
      setPromoLoading(true);
      const { error } = await supabase.rpc("set_premium_status", { p_is_premium: true, p_expires_at: null });
      if (error) {
        Alert.alert("Hata", "Premium aktif edilemedi.");
      } else {
        await refreshProfile();
        setPromoCode("");
        setShowPremiumSuccess(true);
      }
      setPromoLoading(false);
      return;
    }

    if (code === "DELETEMIRHAN") {
      setPromoLoading(true);
      const { error } = await supabase.rpc("set_premium_status", { p_is_premium: false, p_expires_at: null });
      if (error) {
        Alert.alert("Hata", "Premium iptal edilemedi.");
      } else {
        await refreshProfile();
        setPromoCode("");
        Alert.alert("Bilgi", "Premium başarıyla sonlandırıldı.");
      }
      setPromoLoading(false);
      return;
    }

    setPromoLoading(true);
    try {
      const { data, error } = await supabase.rpc("redeem_promo_code", {
        p_code: code
      });
      if (error) throw error;
      
      await refreshProfile(); // Refresh tokens / premium status
      
      if (data?.reward_type === "premium") {
        setShowPremiumSuccess(true);
      } else {
        Alert.alert(
          "Tebrikler! 🎉",
          `${data?.reward_amount} Token hesabınıza yüklendi!` 
        );
      }
      
      setPromoCode("");
    } catch (err: any) {
      Alert.alert("Hata", err.message || "Promosyon kodu kullanılamadı.");
    } finally {
      setPromoLoading(false);
    }
  }

  // Hesap Silme
  async function handleDeleteAccount() {
    Alert.alert(
      "⚠️ Hesabını Sil",
      "Eğer hesabını silersen, sana ve partnerine ait tüm fotoğraflar, mektuplar ve veriler kalıcı olarak yok edilir.\n\nAncak verileriniz 1 hafta boyunca dondurulur. Bu süre içinde ikinizden biri giriş yaparsa silinme iptal edilir.\n\n1 hafta sonunda her şey kalıcı olarak silinir.\n\nDevam etmek istiyor musun?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Evet, Hesabımı Sil",
          style: "destructive",
          onPress: async () => {
            if (!coupleId) {
              Alert.alert("Hata", "Çift bilgisi bulunamadı.");
              return;
            }
            setDeleteLoading(true);
            const deletionScheduledAt = new Date();
            deletionScheduledAt.setDate(deletionScheduledAt.getDate() + 7);

            const { error } = await supabase
              .from("couples")
              .update({ deletion_scheduled_at: deletionScheduledAt.toISOString() })
              .eq("id", coupleId);

            setDeleteLoading(false);

            if (error) {
              Alert.alert("Hata", "İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.");
              return;
            }

            // Push token temizle ve çıkış yap
            if (session?.user?.id) {
              await supabase.from("push_tokens").delete().eq("user_id", session.user.id);
            }
            router.replace("/(auth)/login");
            setTimeout(() => {
              signOut();
            }, 100);
          },
        },
      ]
    );
  }

  return (
    <ScreenBackground>
      <KeyboardAwareScrollView 
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={60}
      >
        {/* Başlık */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, paddingTop: insets.top + 16, paddingHorizontal: 20 }}>
          <View style={{ width: 40 }} />
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontSize: 28, fontFamily: "PlayfairDisplay_400Regular_Italic" }}>
              Ayarlar ⚙️
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 }}>
              Profil ve hesap bilgilerini yönet
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" }}>
            <AlignJustify color="rgba(255,255,255,0.7)" size={22} />
          </TouchableOpacity>
        </View>

        {/* Cüzdan ve Premium */}
        <SectionCard title="Cüzdanım" icon={<Wallet size={18} color={theme.accent} />} theme={theme}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 15 }}>Mevcut Token:</Text>
            <Text style={{ color: "#c8922a", fontWeight: "700", fontSize: 18 }}>🪙 {profile?.tokenBalance ?? 0}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 15 }}>Premium Durumu:</Text>
            {profile?.isPremium ? (
              <Text style={{ color: "#4ade80", fontWeight: "700", fontSize: 15 }}>Aktif (Sınırsız)</Text>
            ) : (
              <Text style={{ color: "rgba(255,255,255,0.4)", fontWeight: "600", fontSize: 15 }}>Aktif Değil</Text>
            )}
          </View>
          
          <TouchableOpacity
            onPress={() => setShowAdModal(true)}
            style={{
              marginTop: 16,
              backgroundColor: "rgba(255, 215, 0, 0.1)",
              borderWidth: 1,
              borderColor: "rgba(255, 215, 0, 0.3)",
              borderRadius: 14,
              paddingVertical: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8
            }}
          >
            <PlayCircle color="#FFD700" size={18} />
            <Text style={{ color: "#FFD700", fontWeight: "700", fontSize: 14 }}>
              Reklam İzle & Token Kazan
            </Text>
          </TouchableOpacity>
        </SectionCard>

        {/* Silinme Uyarısı */}
        {deletionDate && (
          <View
            style={{
              backgroundColor: "rgba(232,0,45,0.1)",
              borderWidth: 1,
              borderColor: "rgba(232,0,45,0.3)",
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: "#FF4D6A", fontWeight: "700", fontSize: 14, marginBottom: 6 }}>
              ⚠️ Hesabın Silinmek Üzere
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, lineHeight: 20 }}>
              {new Date(deletionDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })} tarihinde
              tüm veriler kalıcı silinecek. Giriş yaparak iptal edebilirsin.
            </Text>
          </View>
        )}

        {/* Kişisel Bilgiler */}
        <SectionCard title="Kişisel Bilgiler" icon={<User size={18} color={theme.accent} />} theme={theme}>
          <Field
            theme={theme}
            label="Görünen İsim"
            value={displayName}
            onChange={(val) => {
              setDisplayName(val);
              setNameError(false);
            }}
            placeholder="Adın"
            error={nameError}
          />
          <View style={{ marginTop: 16 }}>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 8 }}>
              Cinsiyet
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {(["female", "male"] as const).map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setGender(g)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: gender === g ? theme.accent : "rgba(255,255,255,0.12)",
                    backgroundColor: gender === g ? theme.pillAccentBg : "rgba(255,255,255,0.02)",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: gender === g ? theme.accent : "rgba(255,255,255,0.5)",
                      fontWeight: "600",
                      fontSize: 14,
                    }}
                  >
                    {g === "female" ? "Kadın" : "Erkek"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <SaveButton theme={theme} onPress={handleUpdateProfile} loading={profileLoading} label="Değişiklikleri Kaydet" />
        </SectionCard>

        {/* İlişki Tarihleri */}
        {coupleId && (
          <SectionCard title="İlişki Tarihleri" icon={<CalendarHeart size={18} color={theme.accent} />} theme={theme} defaultOpen={false}>
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 6 }}>Tanışma Tarihi</Text>
              <TouchableOpacity
                onPress={() => setShowMeetDatePicker(true)}
                style={{
                  backgroundColor: theme.inputBg, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
                  borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13
                }}
              >
                <Text style={{ color: meetDate ? "#fff" : "rgba(255,255,255,0.3)", fontSize: 15 }}>
                  {meetDate || "Seçiniz"}
                </Text>
              </TouchableOpacity>
              {showMeetDatePicker && (
                <DateTimePicker
                  value={meetDate ? new Date(meetDate) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowMeetDatePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      const offset = selectedDate.getTimezoneOffset();
                      const adjustedDate = new Date(selectedDate.getTime() - (offset*60*1000));
                      setMeetDate(adjustedDate.toISOString().split('T')[0]);
                    }
                  }}
                />
              )}
            </View>

            <View style={{ marginTop: 16 }}>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 6 }}>Sevgili Olma Tarihi</Text>
              <TouchableOpacity
                onPress={() => setShowRelDatePicker(true)}
                style={{
                  backgroundColor: theme.inputBg, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
                  borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13
                }}
              >
                <Text style={{ color: relStartDate ? "#fff" : "rgba(255,255,255,0.3)", fontSize: 15 }}>
                  {relStartDate || "Seçiniz"}
                </Text>
              </TouchableOpacity>
              {showRelDatePicker && (
                <DateTimePicker
                  value={relStartDate ? new Date(relStartDate) : new Date()}
                  mode="date"
                  display="default"
                  onChange={(event, selectedDate) => {
                    setShowRelDatePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      const offset = selectedDate.getTimezoneOffset();
                      const adjustedDate = new Date(selectedDate.getTime() - (offset*60*1000));
                      setRelStartDate(adjustedDate.toISOString().split('T')[0]);
                    }
                  }}
                />
              )}
            </View>

            <SaveButton theme={theme} onPress={handleUpdateDates} loading={datesLoading} label="Tarihleri Güncelle" />
          </SectionCard>
        )}

        {/* Oturum / Çıkış */}
        <SectionCard title="Oturum" icon={<LogOut size={18} color={theme.accent} />} theme={theme} defaultOpen={false}>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 20, marginTop: 12 }}>
            Hesabından güvenli bir şekilde çıkış yapar. Bildirim jetonun temizlenir.
          </Text>
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              marginTop: 16,
              paddingVertical: 14,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.1)",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "rgba(255,255,255,0.8)", fontWeight: "700", fontSize: 15 }}>
              Çıkış Yap
            </Text>
          </TouchableOpacity>
        </SectionCard>

        {/* Promosyon Kodları */}
        <SectionCard title="Promosyon Kodları" icon={<Gift size={18} color={theme.accent} />} theme={theme} defaultOpen={false}>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 16 }}>
            Özel bir indirim veya hediye kodunuz varsa buradan kullanabilirsiniz.
          </Text>
          
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            <TextInput
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 12,
                color: "#fff",
                fontSize: 15,
                textTransform: "uppercase"
              }}
              placeholder="HEDİYE KODU"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              onPress={handleRedeemPromo}
              disabled={promoLoading || !promoCode.trim()}
              style={{
                backgroundColor: theme.accent,
                borderRadius: 14,
                paddingHorizontal: 20,
                justifyContent: "center",
                opacity: (!promoCode.trim() || promoLoading) ? 0.6 : 1
              }}
            >
              {promoLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>Kullan</Text>}
            </TouchableOpacity>
          </View>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              onPress={() => RevenueCatService.presentCodeRedemptionSheet()}
              style={{
                paddingVertical: 12,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.03)"
              }}
            >
              <Text style={{ color: "rgba(255,255,255,0.7)", fontWeight: "600", fontSize: 13 }}>
                App Store Kodu Kullan (İndirimler İçin)
              </Text>
            </TouchableOpacity>
          )}
        </SectionCard>

        {/* Tehlike Bölgesi */}
        <SectionCard title="Tehlike Bölgesi" icon={<Trash2 size={18} color="#FF4D6A" />} theme={theme} defaultOpen={false}>
          <View
            style={{
              backgroundColor: "rgba(232,0,45,0.06)",
              borderWidth: 1,
              borderColor: "rgba(232,0,45,0.2)",
              borderRadius: 14,
              padding: 14,
              marginTop: 14,
            }}
          >
            <Text style={{ color: "#FF4D6A", fontWeight: "700", fontSize: 14, marginBottom: 6 }}>
              ⚠️ Dikkat: Geri Alınamaz
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 20 }}>
              Hesabını silersen, sana ve partnerine ait tüm fotoğraflar, mektuplar ve notlar kalıcı olarak silinir.{"\n\n"}
              Verileriniz 1 hafta dondurulur — bu sürede ikinizden biri giriş yaparsa iptal edilir.
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={deleteLoading}
            style={{
              marginTop: 14,
              paddingVertical: 14,
              borderRadius: 16,
              backgroundColor: "rgba(232,0,45,0.08)",
              borderWidth: 1,
              borderColor: "rgba(232,0,45,0.3)",
              alignItems: "center",
            }}
          >
            {deleteLoading ? (
              <ActivityIndicator color="#FF4D6A" />
            ) : (
              <Text style={{ color: "#FF4D6A", fontWeight: "700", fontSize: 15 }}>
                Hesabımı Sil
              </Text>
            )}
          </TouchableOpacity>
        </SectionCard>
      </KeyboardAwareScrollView>

      <WatchAdModal
        visible={showAdModal}
        onClose={() => setShowAdModal(false)}
        onSuccess={() => setShowAdModal(false)}
      />

      <PremiumSuccessModal
        visible={showPremiumSuccess}
        onClose={() => setShowPremiumSuccess(false)}
      />
    </ScreenBackground>
  );
}
