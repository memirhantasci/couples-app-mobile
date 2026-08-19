import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView
} from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { router, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  User,
  CalendarHeart,
  LogOut,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  Menu,
} from "lucide-react-native";

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View
      style={{
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.04)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
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
              backgroundColor: "rgba(232,0,45,0.12)",
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
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  error?: boolean;
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
          backgroundColor: "rgba(255,255,255,0.07)",
          borderWidth: 1,
          borderColor: error ? "red" : "rgba(255,255,255,0.12)",
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
}: {
  onPress: () => void;
  loading?: boolean;
  label?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      style={{
        marginTop: 18,
        backgroundColor: loading ? "rgba(232,0,45,0.5)" : "#E8002D",
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: "center",
        shadowColor: "#E8002D",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [displayName, setDisplayName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [gender, setGender] = useState<"male" | "female">("female");
  const [meetDate, setMeetDate] = useState("");
  const [relStartDate, setRelStartDate] = useState("");
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [deletionDate, setDeletionDate] = useState<string | null>(null);

  const [profileLoading, setProfileLoading] = useState(false);
  const [datesLoading, setDatesLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

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
        setDisplayName(userData.display_name ?? "");
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
    const uid = session.user.id;
    const { error } = await supabase
      .from("users")
      .update({ display_name: displayName.trim(), gender })
      .eq("id", uid);
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
            await signOut();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  }

  return (
    <ScreenBackground>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingTop: insets.top + 10, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
        {/* Başlık */}
        <View style={{ marginBottom: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: -0.5 }}>
              Ayarlar ⚙️
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginTop: 4 }}>
              Profil ve hesap bilgilerini yönet
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, marginRight: -8, marginTop: -8 }}>
            <Menu color="#fff" size={24} />
          </TouchableOpacity>
        </View>

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
        <SectionCard title="Kişisel Bilgiler" icon={<User size={18} color="#E8002D" />}>
          <Field
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
                    borderColor: gender === g ? "#E8002D" : "rgba(255,255,255,0.12)",
                    backgroundColor: gender === g ? "rgba(232,0,45,0.15)" : "rgba(255,255,255,0.05)",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: gender === g ? "#E8002D" : "rgba(255,255,255,0.5)",
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
          <SaveButton onPress={handleUpdateProfile} loading={profileLoading} label="Değişiklikleri Kaydet" />
        </SectionCard>

        {/* İlişki Tarihleri */}
        {coupleId && (
          <SectionCard title="İlişki Tarihleri" icon={<CalendarHeart size={18} color="#E8002D" />} defaultOpen={false}>
            <Field
              label="Tanışma Tarihi (YYYY-AA-GG)"
              value={meetDate}
              onChange={setMeetDate}
              placeholder="2023-06-15"
            />
            <Field
              label="Sevgili Olma Tarihi (YYYY-AA-GG)"
              value={relStartDate}
              onChange={setRelStartDate}
              placeholder="2023-07-01"
            />
            <SaveButton onPress={handleUpdateDates} loading={datesLoading} label="Tarihleri Güncelle" />
          </SectionCard>
        )}

        {/* Oturum / Çıkış */}
        <SectionCard title="Oturum" icon={<LogOut size={18} color="#E8002D" />} defaultOpen={false}>
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 20, marginTop: 12 }}>
            Hesabından güvenli bir şekilde çıkış yapar. Bildirim jetonun temizlenir.
          </Text>
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              marginTop: 16,
              paddingVertical: 14,
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.07)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 15 }}>
              Çıkış Yap
            </Text>
          </TouchableOpacity>
        </SectionCard>

        {/* Tehlike Bölgesi */}
        <SectionCard title="Tehlike Bölgesi" icon={<Trash2 size={18} color="#E8002D" />} defaultOpen={false}>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
