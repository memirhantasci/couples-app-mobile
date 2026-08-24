import React, { useState, useCallback } from "react";
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ActivityIndicator, Alert, Platform
} from "react-native";
import { Image } from "expo-image";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { useRouter, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Image as ImageIcon, Camera, Check, X, Calendar as CalendarIcon, Clock, Menu, Calendar, CheckCircle, AlertCircle, UploadCloud, ArrowUp , AlignJustify} from "lucide-react-native";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { dayjs, todayString } from "@/lib/date";
import { getTheme } from "@/lib/theme";
import { deterministicDecrypt } from "@/utils/crypto";
import { logger } from "@/utils/logger";
import { PremiumPaywall } from "@/components/ui/PremiumPaywall";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AddPhotoScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const theme = getTheme(profile?.gender);

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;
  const isPremium = profile?.isPremium ?? false;
  const [showPaywall, setShowPaywall] = useState(false);

  const [localImage, setLocalImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [takenDate, setTakenDate] = useState("");
  const [takenTime, setTakenTime] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [exifStatus, setExifStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({ photo: false, description: false });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        base64: true,
        exif: true,
      });

      if (result.canceled || !result.assets[0]?.base64) return;

      const asset = result.assets[0];
      setLocalImage(asset);
      setExifStatus("loading");
      setErrors(prev => ({ ...prev, photo: false }));

      setTimeout(() => {
        let foundDate = false;
        
        if (asset.exif && asset.exif.DateTimeOriginal) {
          const parts = asset.exif.DateTimeOriginal.split(" ");
          if (parts.length === 2) {
            const dateParts = parts[0].split(":");
            if (dateParts.length === 3) {
              const formattedDate = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;
              const formattedTime = parts[1].substring(0, 5);
              setTakenDate(formattedDate);
              setTakenTime(formattedTime);
              setExifStatus("found");
              foundDate = true;
            }
          }
        }

        if (!foundDate) {
          setTakenDate(todayString());
          setTakenTime(dayjs().format("HH:mm"));
          setExifStatus("not_found");
        }
      }, 500);

    } catch (error) {
      logger.error("Photo upload error:", error);
      Alert.alert("Hata", "Fotoğraf seçilirken bir hata oluştu.");
    }
  };

  const handleSave = async () => {
    const newErrors = {
      photo: !localImage,
      description: !description.trim()
    };
    setErrors(newErrors);

    if (newErrors.photo) {
      Alert.alert("Eksik", "Lütfen bir fotoğraf seçin.");
      return;
    }

    if (!takenDate) {
      Alert.alert("Eksik", "Lütfen bir tarih girin.");
      return;
    }

    if (newErrors.description) {
      Alert.alert("Eksik", "Lütfen bir açıklama girin.");
      return;
    }

    if (!localImage) return;

    if (localImage.fileSize && localImage.fileSize > 5 * 1024 * 1024) {
       Alert.alert("Dosya Çok Büyük", "Lütfen 5 MB'dan daha küçük bir fotoğraf seçin.");
       return;
    }

    setUploading(true);

    try {
      const fileExt = localImage.uri.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${coupleId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(filePath, decode(localImage.base64!), {
          contentType: `image/${fileExt}`,
        });

      if (uploadError) throw new Error("Fotoğraf yüklenemedi: " + uploadError.message);

      const { data: publicUrlData } = supabase.storage.from("photos").getPublicUrl(filePath);
      const imageUrl = publicUrlData.publicUrl;

      const { error: dbError } = await supabase.from("photo_archive").insert({
        couple_id: coupleId,
        user_id: userId,
        image_url: imageUrl,
        storage_path: filePath,
        title: title.trim() || null,
        description: description.trim(),
        taken_date: takenDate,
        taken_time: takenTime || null,
        exif_found: exifStatus === "found",
        file_size: localImage.fileSize || 0
      });

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["photo_archive", coupleId] });
      queryClient.invalidateQueries({ queryKey: ["calendar_data"] });

      Alert.alert("Başarılı", "Fotoğraf başarıyla arşive eklendi! 🎉", [
        { text: "Tamam", onPress: () => router.back() }
      ]);
    } catch (error: any) {
      logger.error("Photo delete error:", error);
      Alert.alert("Hata", "Kaydetme sırasında bir sorun oluştu.");
    } finally {
      setUploading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      setTakenDate(`${year}-${month}-${day}`);
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedTime) {
      const hours = String(selectedTime.getHours()).padStart(2, '0');
      const minutes = String(selectedTime.getMinutes()).padStart(2, '0');
      setTakenTime(`${hours}:${minutes}`);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLocalImage(null);
      setTitle("");
      setDescription("");
      setExifStatus("idle");
      setTakenDate("");
      setTakenTime("");
      setErrors({ photo: false, description: false });
      setUploading(false);
    }, [])
  );

  if (!session) return <View style={{ flex: 1, backgroundColor: "#0c0c0c" }} />;

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, paddingTop: insets.top + 16, paddingHorizontal: 20 }}>
          <View style={{ width: 40 }} />
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ fontSize: 28, fontFamily: "PlayfairDisplay_400Regular_Italic", color: "#fff" }}>
              Fotoğraf Yükle
            </Text>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
              Bu anıyı arşive ekle 📸
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, borderRadius: 20, width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" }}>
            <AlignJustify color="rgba(255,255,255,0.7)" size={22} />
          </TouchableOpacity>
        </View>

        <KeyboardAwareScrollView 
          contentContainerStyle={styles.container} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          extraScrollHeight={80}
        >
          
          {/* Dotted Upload Box */}
          <TouchableOpacity 
            style={[styles.uploadBox, localImage ? styles.uploadBoxHasImage : {}, errors.photo && { borderColor: "red" }]} 
            onPress={handlePickImage}
            activeOpacity={0.8}
          >
            {localImage ? (
              <View style={{ width: "100%", alignItems: "center" }}>
                <Image source={{ uri: localImage.uri }} style={styles.previewImage} contentFit="cover" />
                <TouchableOpacity style={styles.changeBadgeOut} onPress={handlePickImage}>
                  <Text style={styles.changeBadgeText}>Değiştir</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <View style={[styles.iconBox, { backgroundColor: theme.accent }]}>
                  <ImageIcon color="#fff" size={28} />
                </View>
                <Text style={styles.uploadTitle}>Fotoğraf Seç</Text>
                <Text style={styles.uploadSub}>Galerinizden bir fotoğraf seçin</Text>
                <View style={[styles.uploadBtn, { backgroundColor: theme.accent }]}>
                  <ArrowUp color="#fff" size={14} style={{ marginRight: 4 }} />
                  <Text style={styles.uploadBtnText}>Galeriyi Aç</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {/* EXIF Alerts */}
          {exifStatus === "loading" && (
            <View style={[styles.alertBox, { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" }]}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={[styles.alertText, { color: "rgba(255,255,255,0.6)" }]}>EXIF bilgileri okunuyor...</Text>
            </View>
          )}

          {exifStatus === "found" && (
            <View style={[styles.alertBox, { borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 8 }]}>
              <Check color="#22c55e" size={16} />
              <Text style={[styles.alertText, { color: "#22c55e" }]}>
                Çekim bilgileri bulundu: {dayjs(takenDate).locale("tr").format("D MMMM YYYY")}, {takenTime}
              </Text>
            </View>
          )}

          {exifStatus === "not_found" && (
            <View style={[styles.alertBox, { borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.1)", borderRadius: 8 }]}>
              <AlertCircle color="#f59e0b" size={16} />
              <Text style={[styles.alertText, { color: "#f59e0b", flex: 1 }]}>
                Çekim bilgileri bulunamadı, dosya tarihi eklendi.
              </Text>
            </View>
          )}

          {/* Form Fields */}
          <View style={{ gap: 16, marginTop: 8 }}>
            
            <View>
                <Text style={styles.fieldLabel}>Çekim Tarihi *</Text>
                <TouchableOpacity style={styles.inputWrap} onPress={() => setShowDatePicker(true)}>
                  <View style={[styles.input, { justifyContent: 'center' }]}>
                    <Text style={{ color: takenDate ? "#fff" : "rgba(255,255,255,0.3)" }}>
                      {takenDate || "YYYY-AA-GG"}
                    </Text>
                  </View>
                  <Calendar color="rgba(255,255,255,0.5)" size={18} style={{ position: "absolute", right: 14 }} />
                </TouchableOpacity>
              </View>

              <View>
                <Text style={styles.fieldLabel}>Çekim Saati (isteğe bağlı)</Text>
                <TouchableOpacity onPress={() => setShowTimePicker(true)}>
                  <View style={[styles.input, { justifyContent: 'center' }]}>
                    <Text style={{ color: takenTime ? "#fff" : "rgba(255,255,255,0.3)" }}>
                      {takenTime || "HH:MM"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={takenDate ? new Date(takenDate) : new Date()}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                />
              )}

              {showTimePicker && (
                <DateTimePicker
                  value={
                    takenTime 
                      ? new Date(`2000-01-01T${takenTime}:00`) 
                      : new Date()
                  }
                  mode="time"
                  is24Hour={true}
                  display="default"
                  onChange={onTimeChange}
                />
              )}

              <View>
                <Text style={styles.fieldLabel}>Başlık (isteğe bağlı)</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Fotoğrafınıza bir başlık verin..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                />
              </View>

              <View>
                <Text style={[styles.fieldLabel, errors.description && { color: "red" }]}>Açıklama *</Text>
                <TextInput
                  style={[styles.input, { height: 100, textAlignVertical: "top" }, errors.description && { borderColor: "red" }]}
                  value={description}
                  onChangeText={(text) => {
                    setDescription(text);
                    setErrors(prev => ({ ...prev, description: false }));
                  }}
                  placeholder="Bu anı anlatın... Neredeydiniz, ne hissettiniz?"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  multiline
                />
              </View>

              <Text style={styles.infoText}>
                * Yüklenen fotoğraflar ortak arşivinizde kalıcı olarak saklanır.
              </Text>

              {!isPremium ? (
                <TouchableOpacity 
                  style={[styles.saveBtn, { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }]} 
                  onPress={() => setShowPaywall(true)}
                >
                  <Text style={[styles.saveBtnText, { color: theme.accent }]}>Premium Özellik 🔒</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={[styles.saveBtn, { backgroundColor: theme.accent }]} 
                  onPress={handleSave}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Arşive Ekle 💾</Text>
                  )}
                </TouchableOpacity>
              )}

            </View>

        </KeyboardAwareScrollView>
        
        <PremiumPaywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          featureName="Fotoğraf Yükle"
          featureDescription="Ortak galeriye dilediğiniz kadar fotoğraf yükleyin."
          gender={profile?.gender}
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: "PlayfairDisplay_400Regular_Italic",
    color: "#fff",
    textAlign: "center",
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    textAlign: "center",
  },
  uploadBox: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    minHeight: 180,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 16,
  },
  uploadBoxHasImage: {
    borderColor: "transparent",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 10,
  },
  uploadPlaceholder: {
    alignItems: "center",
  },
  iconBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  uploadTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  uploadSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    marginBottom: 16,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  uploadBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  previewImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
  },
  changeBadgeOut: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  changeBadgeText: {
    color: "#fff",
    fontSize: 13,
  },
  alertBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  alertText: {
    fontSize: 13,
    lineHeight: 18,
  },
  fieldLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginBottom: 6,
    fontWeight: "500",
  },
  inputWrap: {
    justifyContent: "center",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 14,
  },
  infoText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    textAlign: "center",
    marginVertical: 10,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 20,
    marginTop: 5,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  }
});
