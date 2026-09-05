
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Image } from "expo-image";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "@/utils/logger";
import { decode } from "base64-arraybuffer";
import { Image as ImageIcon, X, Save, Menu, ImagePlus, ChevronLeft , AlignJustify} from "lucide-react-native";
import { dayjs, todayString, formatDateTR } from "@/lib/date";
import { getTheme } from "@/lib/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { PremiumPaywall } from "@/components/ui/PremiumPaywall";
import { sanitizeStrict, sanitize } from "@/utils/sanitize";

export default function AddMemoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();
  const { session, profile } = useAuth();
  const insets = useSafeAreaInsets();
  const theme = getTheme(profile?.gender);

  const isEditing = !!params.id;

  const [title, setTitle] = useState(params.title as string || "");
  const [date, setDate] = useState(params.date as string || todayString());
  const [description, setDescription] = useState(params.description as string || "");
  const [imageUrl, setImageUrl] = useState(params.image_url as string || "");
  const [localImage, setLocalImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ title: false, date: false });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const isPremium = profile?.isPremium ?? false;
  useFocusEffect(
    useCallback(() => {
      // Ekran her odaklandığında formu temizle (eğer yeni ekleme modundaysa)
      if (!isEditing) {
        setTitle("");
        setDate(todayString());
        setDescription("");
        setImageUrl("");
        setLocalImage(null);
        setErrors({ title: false, date: false });
        setLoading(false);
      }
    }, [isEditing])
  );

  const coupleId = profile?.coupleId || null;

  async function pickImage() {
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.6,
      base64: true, // We need base64 to upload easily to Supabase from React Native
    });

    if (!result.canceled && result.assets[0]) {
      setLocalImage(result.assets[0]);
    }
  }

  async function handleSave() {
    const newErrors = {
      title: !title.trim(),
      date: !date.trim(),
    };
    setErrors(newErrors);

    if (newErrors.title || newErrors.date) {
      Alert.alert("Eksik Bilgi", "Lütfen bir başlık ve tarih girin.");
      return;
    }
    
    setLoading(true);

    try {
      let finalImageUrl = imageUrl;

      // Upload image if a new one was selected
      if (localImage && localImage.base64) {
        if (localImage.fileSize && localImage.fileSize > 5 * 1024 * 1024) {
           Alert.alert("Dosya Çok Büyük", "Lütfen 5 MB'dan daha küçük bir fotoğraf seçin.");
           setLoading(false);
           return;
        }

        const fileExt = localImage.uri.split('.').pop() || 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${coupleId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("memories")
          .upload(filePath, decode(localImage.base64), {
            contentType: `image/${fileExt}`,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("memories")
          .getPublicUrl(filePath);

        finalImageUrl = publicUrlData.publicUrl;
      }

      // Save to database
      const cleanTitle = sanitizeStrict(title.trim());
      const cleanDescription = description.trim() ? sanitize(description.trim()) : null;

      let error;
      if (isEditing) {
        const res = await supabase.from("memories")
          .update({
            date: date,
            title: cleanTitle,
            description: cleanDescription,
            image_url: finalImageUrl || null,
          })
          .eq("id", Number(params.id));
        error = res.error;
      } else {
        const payload: any = {
          date: date,
          title: cleanTitle,
          description: cleanDescription,
          image_url: finalImageUrl || null,
          is_default: false,
        };
        if (coupleId) payload.couple_id = coupleId;
        const res = await supabase.from("memories").insert(payload);
        error = res.error;
      }

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["memories"] });
      router.replace("/(tabs)/memories");
    } catch (error: any) {
      logger.error("Memory save error:", error);
      Alert.alert("Hata", "Anı kaydedilirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenBackground>

        <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center", position: "absolute", top: 40, right: 20, zIndex: 50 }}>
          <AlignJustify color="rgba(255,255,255,0.7)" size={22} />
        </TouchableOpacity>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <TouchableOpacity onPress={() => router.replace("/(tabs)/memories")} style={{ padding: 8, marginLeft: -8 }}>
            <ChevronLeft color="#fff" size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? "Anıyı Düzenle" : "Yeni Anı Ekle"}</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, errors.title && { color: "red" }]}>Başlık</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.unitBg }, errors.title && { borderColor: "red" }]}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                setErrors(prev => ({ ...prev, title: false }));
              }}
              placeholder="Örn: İlk Buluşmamız"
              placeholderTextColor="rgba(255,255,255,0.4)"
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, errors.date && { color: "red" }]}>Tarih</Text>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: theme.unitBg }, errors.date && { borderColor: "red" }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: date ? "#fff" : "rgba(255,255,255,0.4)" }}>
                {date ? formatDateTR(date) : "Tarih Seçin"}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={date ? new Date(date) : new Date()}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (event.type === "set" && selectedDate) {
                    setDate(dayjs(selectedDate).format("YYYY-MM-DD"));
                    setErrors(prev => ({ ...prev, date: false }));
                  }
                }}
              />
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Açıklama (İsteğe bağlı)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.unitBg }]}
              value={description}
              onChangeText={setDescription}
              placeholder="O güne dair hatırlamak istediklerin..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
              maxLength={1000}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Fotoğraf (İsteğe bağlı)</Text>
            <TouchableOpacity style={[styles.imagePicker, { backgroundColor: theme.unitBg }]} onPress={pickImage}>
              {localImage ? (
                <Image source={{ uri: localImage.uri }} style={styles.previewImg} contentFit="cover" />
              ) : imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.previewImg} contentFit="cover" />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <ImagePlus color="rgba(255,255,255,0.4)" size={32} />
                  <Text style={styles.imagePlaceholderText}>Galeriden Seç</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: theme.accent }, loading && { opacity: 0.7 }]} 
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Save color="#fff" size={20} />
                <Text style={styles.saveBtnText}>Kaydet</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName="Fotoğraflı Özel Gün"
        featureDescription="Özel günlerinize fotoğraf eklemek için Premium'a geçmeniz gerekmektedir."
        gender={profile?.gender}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: -0.5,
  },
  content: {
    padding: 20,
    paddingBottom: 100,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 8,
    fontFamily: "Inter_500Medium",
  },
  input: {
    borderRadius: 16,
    color: "#fff",
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Inter_400Regular",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  imagePicker: {
    borderRadius: 16,
    overflow: "hidden",
    height: 180,
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholderText: {
    color: "rgba(255,255,255,0.4)",
    marginTop: 8,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  previewImg: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    borderRadius: 20,
    marginTop: 10,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  }
});
