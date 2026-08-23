import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Calendar, ChevronRight, Heart, Sparkles } from "lucide-react-native";

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${day}.${month}.${year}`; // Matching mockup 14.02.2024
}

export default function DatesScreen() {
  const { session, refreshProfile } = useAuth();
  const userId = session?.user?.id;

  const [meetDate, setMeetDate] = useState(new Date(2024, 1, 14));
  const [relDate, setRelDate] = useState(new Date(2024, 4, 1));
  const [showMeetPicker, setShowMeetPicker] = useState(false);
  const [showRelPicker, setShowRelPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date();

  function onMeetDateChange(_: DateTimePickerEvent, selected?: Date) {
    setShowMeetPicker(Platform.OS === "ios");
    if (selected) {
      setMeetDate(selected);
      if (selected > relDate) setRelDate(selected);
    }
  }

  function onRelDateChange(_: DateTimePickerEvent, selected?: Date) {
    setShowRelPicker(Platform.OS === "ios");
    if (selected) setRelDate(selected);
  }

  async function handleSave() {
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

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("couple_id")
      .eq("id", userId)
      .single();

    if (userError || !user?.couple_id) {
      setError("Eşleşme bilgisi alınamadı. Lütfen tekrar dene.");
      setIsLoading(false);
      return;
    }

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

    if (couple.meet_date && couple.relationship_start_date) {
      await refreshProfile();
      router.replace("/(tabs)/home");
      return;
    }

    const { error: updateError } = await supabase
      .from("couples")
      .update({
        meet_date: formatDate(meetDate),
        relationship_start_date: formatDate(relDate),
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
    <ScreenBackground colors={["#0A0A10", "#0D0D14", "#0A0A10"]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: 80, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        
        {/* Header */}
        <View style={{ alignItems: "center", marginBottom: 40 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "rgba(255,255,255,0.03)",
              borderWidth: 1,
              borderColor: "#FF4D6A",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Calendar color="#FF4D6A" size={32} />
          </View>

          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 34,
              fontFamily: "PlayfairDisplay_400Regular_Italic",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            İlişki Tarihleriniz
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            Bu özel günleri birlikte sayalım ve asla unutmayalım.
          </Text>
        </View>

        {/* Meet Date Picker */}
        <TouchableOpacity
          onPress={() => setShowMeetPicker(true)}
          activeOpacity={0.8}
          style={{
            backgroundColor: "rgba(255,255,255,0.02)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.06)",
            borderRadius: 20,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: "rgba(0,0,0,0.3)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 16,
            }}
          >
            <Sparkles color="#FF4D6A" size={22} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 2 }}>
              Tanışma Tarihi
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
              İlk buluştuğunuz o eşsiz an
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600", letterSpacing: 1 }}>
              {displayDate(meetDate)}
            </Text>
            <ChevronRight color="rgba(255,255,255,0.3)" size={20} />
          </View>
        </TouchableOpacity>

        {/* Relationship Date Picker */}
        <TouchableOpacity
          onPress={() => setShowRelPicker(true)}
          activeOpacity={0.8}
          style={{
            backgroundColor: "rgba(255,255,255,0.02)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.06)",
            borderRadius: 20,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 40,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: "rgba(0,0,0,0.3)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 16,
            }}
          >
            <Heart color="#FF4D6A" size={22} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 2 }}>
              Sevgili Olma Tarihi
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
              Birlikteliğinizin resmi başlangıcı
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600", letterSpacing: 1 }}>
              {displayDate(relDate)}
            </Text>
            <ChevronRight color="rgba(255,255,255,0.3)" size={20} />
          </View>
        </TouchableOpacity>

        {!!error && (
          <View
            style={{
              backgroundColor: "rgba(232,0,45,0.1)",
              borderWidth: 1,
              borderColor: "rgba(232,0,45,0.3)",
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: "#FF4D6A", fontSize: 14, textAlign: "center" }}>
              {error}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleSave}
          disabled={isLoading}
          activeOpacity={0.85}
          style={{ borderRadius: 30, overflow: "hidden", opacity: isLoading ? 0.7 : 1 }}
        >
          <LinearGradient
            colors={["#FF4D6A", "#9B4DFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingVertical: 18,
              alignItems: "center",
              borderRadius: 30,
              shadowColor: "#9B4DFF",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4,
              shadowRadius: 14,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>
                Başla & Kaydet
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>

      {/* Keep picker components offscreen but rendered */}
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
      {showRelPicker && (
        <DateTimePicker
          value={relDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onRelDateChange}
          maximumDate={today}
          locale="tr-TR"
        />
      )}
    </ScreenBackground>
  );
}
