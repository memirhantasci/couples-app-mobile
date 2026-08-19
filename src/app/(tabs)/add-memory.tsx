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
import { Image as ImageIcon, X, Save, Menu, ImagePlus } from "lucide-react-native";
import { dayjs, todayString } from "@/lib/date";

export default function AddMemoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();
  const { session, profile } = useAuth();

  const isEditing = !!params.id;

  const [title, setTitle] = useState(params.title as string || "");
  const [date, setDate] = useState(params.date as string || todayString());
  const [description, setDescription] = useState(params.description as string || "");
  const [imageUrl, setImageUrl] = useState(params.image_url as string || "");
  const [localImage, setLocalImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ title: false, date: false });
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
      let error;
      if (isEditing) {
        const res = await supabase.from("memories")
          .update({
            date: date,
            title: title.trim(),
            description: description.trim() || null,
            image_url: finalImageUrl || null,
          })
          .eq("id", Number(params.id));
        error = res.error;
      } else {
        const payload: any = {
          date: date,
          title: title.trim(),
          description: description.trim() || null,
          image_url: finalImageUrl || null,
          is_default: false,
        };
        if (coupleId) payload.couple_id = coupleId;
        const res = await supabase.from("memories").insert(payload);
        error = res.error;
      }

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["memories"] });
      router.back();
    } catch (error: any) {
      logger.error("Memory save error:", error);
      Alert.alert("Hata", "Anı kaydedilirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenBackground colors={["#1c1c1e", "#0A0A0C", "#1c1c1e"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <X color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? "Anıyı Düzenle" : "Yeni Anı Ekle"}</Text>
          <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, marginRight: -8 }}>
            <Menu color="#fff" size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, errors.title && { color: "red" }]}>Başlık</Text>
            <TextInput
              style={[styles.input, errors.title && { borderColor: "red" }]}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                setErrors(prev => ({ ...prev, title: false }));
              }}
              placeholder="Örn: İlk Buluşmamız"
              placeholderTextColor="rgba(255,255,255,0.4)"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, errors.date && { color: "red" }]}>Tarih (YYYY-AA-GG)</Text>
            <TextInput
              style={[styles.input, errors.date && { borderColor: "red" }]}
              value={date}
              onChangeText={(text) => {
                setDate(text);
                setErrors(prev => ({ ...prev, date: false }));
              }}
              placeholder="2023-05-14"
              placeholderTextColor="rgba(255,255,255,0.4)"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Açıklama (İsteğe bağlı)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="O güne dair hatırlamak istediklerin..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Fotoğraf (İsteğe bağlı)</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
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
            style={[styles.saveBtn, loading && { opacity: 0.7 }]} 
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
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
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
    fontWeight: "500",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    color: "#fff",
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  imagePicker: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
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
    backgroundColor: "#FF2D55",
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 10,
    shadowColor: "#FF2D55",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  }
});
