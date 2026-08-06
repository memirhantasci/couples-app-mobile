import React, { useState } from "react";
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Image as ImageIcon, Camera, Check, X, Calendar as CalendarIcon, Clock, Menu, Calendar, CheckCircle, AlertCircle, UploadCloud, ArrowUp } from "lucide-react-native";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { dayjs, todayString } from "@/lib/date";
import { deterministicDecrypt } from "@/utils/crypto";
import DateTimePicker from "@react-native-community/datetimepicker";

export default function AddPhotoScreen() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const queryClient = useQueryClient();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  const [localImage, setLocalImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [takenDate, setTakenDate] = useState("");
  const [takenTime, setTakenTime] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [exifStatus, setExifStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");
  const [uploading, setUploading] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Sol üst köşede isimleri göstermek için partner ve kendi adımızı çekelim
  const { data: coupleNames } = useQuery({
    queryKey: ["couple_names", coupleId],
    enabled: !!coupleId,
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, display_name, username")
        .eq("couple_id", coupleId);
      
      if (!data) return "Sen & Partnerin";

      let myName = "";
      let partnerName = "";
      data.forEach((u) => {
        const name = u.display_name || deterministicDecrypt(u.username) || u.username;
        if (u.id === userId) myName = name;
        else partnerName = name;
      });
      return `${myName || "Sen"} & ${partnerName || "Partnerin"}`;
    }
  });

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
        exif: true, // EXIF verilerini çek
      });

      if (result.canceled || !result.assets[0]?.base64) return;

      const asset = result.assets[0];
      setLocalImage(asset);
      setExifStatus("loading");

      // EXIF parse from Expo ImagePicker
      setTimeout(() => {
        let foundDate = false;
        
        if (asset.exif && asset.exif.DateTimeOriginal) {
          // Format: "YYYY:MM:DD HH:MM:SS"
          const parts = asset.exif.DateTimeOriginal.split(" ");
          if (parts.length === 2) {
            const dateParts = parts[0].split(":");
            if (dateParts.length === 3) {
              const formattedDate = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;
              const formattedTime = parts[1].substring(0, 5); // Sadece HH:MM
              setTakenDate(formattedDate);
              setTakenTime(formattedTime);
              setExifStatus("found");
              foundDate = true;
            }
          }
        }

        if (!foundDate) {
          // Fallback to today
          setTakenDate(todayString());
          setTakenTime(dayjs().format("HH:mm"));
          setExifStatus("not_found");
        }
      }, 500);

    } catch (error) {
      console.error(error);
      Alert.alert("Hata", "Fotoğraf seçilirken bir hata oluştu.");
    }
  };

  const handleSave = async () => {
    if (!localImage || !takenDate) {
      Alert.alert("Eksik", "Lütfen bir fotoğraf seçin ve tarih girin.");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Eksik", "Lütfen bir açıklama girin.");
      return;
    }

    setUploading(true);

    try {
      const fileExt = localImage.uri.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${coupleId}/${fileName}`;

      // Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(filePath, decode(localImage.base64!), {
          contentType: `image/${fileExt}`,
        });

      if (uploadError) throw new Error("Fotoğraf yüklenemedi: " + uploadError.message);

      // Get Public URL
      const { data: publicUrlData } = supabase.storage.from("photos").getPublicUrl(filePath);
      const imageUrl = publicUrlData.publicUrl;

      // Save to DB
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
      console.error(error);
      Alert.alert("Hata", error.message || "Kaydetme sırasında bir sorun oluştu.");
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

  if (!session) return <View style={{ flex: 1, backgroundColor: "#0c0c0c" }} />;

  return (
    <LinearGradient colors={["#1a1114", "#0c0c0c", "#1a1114"]} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft color="#fff" size={28} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.namesText}>❤️ {coupleNames || "Sen & Partnerin"} ❤️</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/menu")} style={{ padding: 8, marginRight: -8 }}>
            <Menu color="#fff" size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          <Text style={styles.pageTitle}>FOTOĞRAF YÜKLE 📸</Text>
          
          <Text style={styles.sectionLabel}>Bu anıyı arşive ekle 📸</Text>

          {/* Dotted Upload Box */}
          <TouchableOpacity 
            style={[styles.uploadBox, localImage ? styles.uploadBoxHasImage : {}]} 
            onPress={handlePickImage}
            activeOpacity={0.8}
          >
            {localImage ? (
              <View style={{ width: "100%", alignItems: "center" }}>
                <Image source={{ uri: localImage.uri }} style={styles.previewImage} />
                <View style={styles.changeBadge}>
                  <Text style={styles.changeBadgeText}>Değiştir</Text>
                </View>
              </View>
            ) : (
              <View style={styles.uploadPlaceholder}>
                <View style={styles.iconBox}>
                  <ImageIcon color="#fff" size={28} />
                </View>
                <Text style={styles.uploadTitle}>Fotoğraf Seç</Text>
                <Text style={styles.uploadSub}>Galerinizden bir fotoğraf seçin</Text>
                <View style={styles.uploadBtn}>
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
            <View style={[styles.alertBox, { backgroundColor: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.3)" }]}>
              <CheckCircle color="#22c55e" size={20} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.alertText, { color: "#22c55e", fontWeight: "700" }]}>Çekim bilgileri bulundu</Text>
                <Text style={[styles.alertText, { color: "rgba(34,197,94,0.8)", fontSize: 12, marginTop: 2 }]}>
                  {dayjs(takenDate).format("DD.MM.YYYY")} {takenTime && `saat ${takenTime}`} — İsterseniz düzenleyebilirsiniz.
                </Text>
              </View>
            </View>
          )}

          {exifStatus === "not_found" && (
            <View style={[styles.alertBox, { backgroundColor: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)" }]}>
              <AlertCircle color="#f59e0b" size={20} />
              <Text style={[styles.alertText, { color: "#f59e0b", flex: 1 }]}>
                Fotoğrafın kesin çekim tarihi bulunamadı ancak dosya tarihinden tahmin edildi. Lütfen doğruluğunu kontrol edin.
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
                <Text style={styles.fieldLabel}>Açıklama *</Text>
                <TextInput
                  style={[styles.input, { height: 100, textAlignVertical: "top" }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Bu anı anlatın... Neredeydiniz, ne hissettiniz?"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  multiline
                />
              </View>

              <Text style={styles.infoText}>
                Yüklenen fotoğraflar kalıcı olarak saklanır ve silinemez. Her iki kullanıcı da tüm fotoğrafları görebilir.
              </Text>

              <TouchableOpacity 
                style={styles.saveBtn} 
                onPress={handleSave}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <UploadCloud color="#fff" size={20} />
                    <Text style={styles.saveBtnText}>Fotoğrafı Kaydet</Text>
                  </>
                )}
              </TouchableOpacity>

            </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  backBtn: {
    zIndex: 10,
    padding: 5,
  },
  namesText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#D32F2F",
    textAlign: "center",
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 24,
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    marginBottom: 10,
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: "#D32F2F",
    borderStyle: "dashed",
    borderRadius: 12,
    minHeight: 180,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  uploadBoxHasImage: {
    borderColor: "rgba(232,0,45,0.5)",
    backgroundColor: "rgba(232,0,45,0.05)",
    borderStyle: "solid",
  },
  uploadPlaceholder: {
    alignItems: "center",
  },
  iconBox: {
    backgroundColor: "#D32F2F",
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
    backgroundColor: "#D32F2F",
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
    height: 250,
    borderRadius: 8,
    resizeMode: "contain",
  },
  changeBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  changeBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  alertBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 10,
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
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 15,
  },
  infoText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    lineHeight: 18,
    marginVertical: 10,
  },
  saveBtn: {
    backgroundColor: "#D32F2F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 10,
    gap: 8,
    marginTop: 5,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  }
});
