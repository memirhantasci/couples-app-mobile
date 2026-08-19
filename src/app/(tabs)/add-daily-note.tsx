import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView } from "react-native";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { ChevronLeft, Check } from "lucide-react-native";
import { getTheme } from "@/lib/theme";
import { encrypt } from "@/utils/crypto";
import dayjs from "dayjs";
import "dayjs/locale/tr";
import { useQueryClient } from "@tanstack/react-query";

dayjs.locale("tr");

export default function AddDailyNoteScreen() {
  const { session, profile } = useAuth();
  const theme = getTheme(profile?.gender);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert("Uyarı", "Lütfen günlüğüne bir şeyler yaz!");
      return;
    }

    if (!session?.user?.id) return;

    setIsSubmitting(true);
    try {
      const encrypted = encrypt(content.trim());
      const { error } = await supabase.from("daily_notes").insert({
        user_id: session.user.id,
        date: dayjs().format("YYYY-MM-DD"),
        content: encrypted,
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["daily_notes_history", session.user.id] });
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert("Hata", "Günlük kaydedilirken bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        
        {/* HEADER */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: Platform.OS === "ios" ? 60 : 40,
          paddingHorizontal: 20,
          paddingBottom: 20,
        }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 5, marginLeft: -5 }}>
            <ChevronLeft color="#fff" size={28} />
          </TouchableOpacity>
          <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>Yeni Sayfa 📓</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* EDITOR */}
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginBottom: 12, marginLeft: 8 }}>
            {dayjs().format("D MMMM YYYY, dddd")}
          </Text>
          
          <TextInput
            style={{
              flex: 1,
              minHeight: 300,
              backgroundColor: theme.cardBg,
              borderRadius: 24,
              padding: 24,
              color: "#fff",
              fontSize: 16,
              lineHeight: 26,
              textAlignVertical: "top",
            }}
            multiline
            placeholder="Sevgili günlük..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={content}
            onChangeText={setContent}
            autoFocus
          />

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={isSubmitting}
            style={{
              backgroundColor: theme.accent,
              paddingVertical: 16,
              borderRadius: 30,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              marginTop: 20,
              gap: 8,
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Check color="#fff" size={20} />
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Kaydet</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}
