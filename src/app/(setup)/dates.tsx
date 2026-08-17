import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

// ─── Date Picker Notu ─────────────────────────────────────────────────────────
// react-native-date-picker → Expo Go'da (development build olmadan) çalışmıyor.
// Bu yüzden @react-native-community/datetimepicker kullandık.
// Bu paket Expo Go'da sorunsuz çalışır, iOS ve Android'in native date picker
// arayüzünü kullanır. Üretim (production) build'de de aynı şekilde çalışır.
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  // ISO 8601 formatında YYYY-MM-DD — web projesiyle birebir aynı
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(date: Date): string {
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DatesScreen() {
  const { session, refreshProfile } = useAuth();
  const userId = session?.user?.id;

  // State
  const [meetDate, setMeetDate] = useState(new Date(2020, 0, 1));
  const [relDate, setRelDate] = useState(new Date(2020, 0, 1));
  const [showMeetPicker, setShowMeetPicker] = useState(false);
  const [showRelPicker, setShowRelPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date();

  function onMeetDateChange(_: DateTimePickerEvent, selected?: Date) {
    setShowMeetPicker(Platform.OS === "ios");
    if (selected) {
      setMeetDate(selected);
      // Ensure relDate >= meetDate
      if (selected > relDate) setRelDate(selected);
    }
  }

  function onRelDateChange(_: DateTimePickerEvent, selected?: Date) {
    setShowRelPicker(Platform.OS === "ios");
    if (selected) setRelDate(selected);
  }

  async function handleSave() {
    // Validation (web'deki setup.ts ile aynı kurallar)
    if (meetDate > today || relDate > today) {
      setError("Gelecek bir tarih seçemezsiniz.");
      return;
    }
    if (meetDate > relDate) {
      setError("Tanışma tarihi, sevgili olma tarihinden sonra olamaz.");
      return;
    }

    if (!userId) return;
    setIsLoading(true);
    setError("");

    // Get couple_id
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("couple_id")
      .eq("id", parseInt(userId, 10))
      .single();

    if (userError || !user?.couple_id) {
      setError("Eşleşme bilgisi alınamadı. Lütfen tekrar dene.");
      setIsLoading(false);
      return;
    }

    // ── Race condition koruması (web'deki setup.ts ile birebir aynı mantık):
    // Güncel veriyi çek. Eğer partner tarih kaydettiyse, biz kaydetmiyoruz,
    // direkt home'a yönlendiriyoruz — partner'ın verisi ezilmez.
    const { data: couple, error: coupleError } = await supabase
      .from("couples")
      .select("meet_date, relationship_start_date")
      .eq("id", user.couple_id)
      .single();

    if (coupleError) {
      setError("Eşleşme bilgileri alınırken hata oluştu.");
      setIsLoading(false);
      return;
    }

    // Eğer partner zaten tarihleri kaydetmişse → direkt home'a yönlendir
    if (couple.meet_date && couple.relationship_start_date) {
      await refreshProfile();
      router.replace("/(tabs)/home");
      return;
    }

    // Tarihleri kaydet (WHERE koşulumuz SQL'de yoktur ama application seviyesinde kontrol ettik)
    const { error: updateError } = await supabase
      .from("couples")
      .update({
        meet_date: formatDate(meetDate),           // YYYY-MM-DD — web ile aynı format
        relationship_start_date: formatDate(relDate), // YYYY-MM-DD
      })
      .eq("id", user.couple_id);

    setIsLoading(false);

    if (updateError) {
      setError("Tarihler kaydedilirken bir hata oluştu.");
      return;
    }

    await refreshProfile();
    router.replace("/(tabs)/home");
  }

  return (
    <ScreenBackground colors={["#080811", "#0A0A0C", "#080811"]}>
      {/* Background blobs */}
      <View
        style={{
          position: "absolute",
          top: -80,
          left: -80,
          width: 280,
          height: 280,
          borderRadius: 140,
          backgroundColor: "rgba(232, 0, 45, 0.15)",
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: -40,
          right: -60,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: "rgba(245, 200, 66, 0.08)",
        }}
      />

      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        {/* Header */}
        <View style={{ alignItems: "center", marginBottom: 36 }}>
          <Text style={{ fontSize: 52, marginBottom: 14 }}>🗓️</Text>
          <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "800", marginBottom: 8 }}>
            Tarihleri Belirleyin
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 14,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            Birlikte geçirdiğiniz o güzel günlerin{"\n"}sayısını tutabilmemiz için tarihlere ihtiyacımız var.
          </Text>
        </View>

        {/* Meet Date Picker */}
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            borderRadius: 20,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 8 }}>
            Tanışma Tarihi
          </Text>
          <TouchableOpacity
            onPress={() => setShowMeetPicker(true)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "600" }}>
              {displayDate(meetDate)}
            </Text>
            <Text style={{ fontSize: 20 }}>📅</Text>
          </TouchableOpacity>

          {showMeetPicker && (
            <DateTimePicker
              value={meetDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onMeetDateChange}
              maximumDate={relDate < today ? relDate : today}
              locale="tr-TR"
            />
          )}
          {Platform.OS === "android" && (
            <TouchableOpacity
              onPress={() => setShowMeetPicker(true)}
              style={{ position: "absolute", inset: 0 }}
            />
          )}
        </View>

        {/* Relationship Start Date Picker */}
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            borderRadius: 20,
            padding: 20,
            marginBottom: 32,
          }}
        >
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 8 }}>
            Sevgili Olma Tarihi
          </Text>
          <TouchableOpacity
            onPress={() => setShowRelPicker(true)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "600" }}>
              {displayDate(relDate)}
            </Text>
            <Text style={{ fontSize: 20 }}>💕</Text>
          </TouchableOpacity>

          {showRelPicker && (
            <DateTimePicker
              value={relDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onRelDateChange}
              minimumDate={meetDate}
              maximumDate={today}
              locale="tr-TR"
            />
          )}
        </View>

        {/* Error */}
        {!!error && (
          <View
            style={{
              backgroundColor: "rgba(232,0,45,0.12)",
              borderWidth: 1,
              borderColor: "rgba(232,0,45,0.3)",
              borderRadius: 14,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: "#FF4D6A", fontSize: 14, textAlign: "center" }}>
              {error}
            </Text>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={isLoading}
          style={{
            backgroundColor: isLoading ? "rgba(232,0,45,0.5)" : "#E8002D",
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
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>
              Kaydet ve Başla ✨
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenBackground>
  );
}
