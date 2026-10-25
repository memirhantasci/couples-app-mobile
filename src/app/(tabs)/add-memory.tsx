
import React, { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { appAlert } from "@/lib/dialog";
import { Image } from "expo-image";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { removeStoredFiles, seedStorageImage } from "@/lib/storageImages";
import { StorageImage } from "@/components/common/StorageImage";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "@/utils/logger";
import { decode } from "base64-arraybuffer";
import { Image as ImageIcon, X, Save, Menu, ImagePlus, ChevronLeft , AlignJustify} from "lucide-react-native";
import { dayjs, todayString, formatDateTR } from "@/lib/date";
import type { AppTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { sanitizeStrict, sanitize } from "@/utils/sanitize";
import { useDemoAction } from "@/hooks/useDemoAction";
import { useNotificationPriming } from "@/hooks/useNotificationPriming";
import { toast } from "@/lib/toast";
import { LazyPremiumPaywall, LazyDemoActionModal, LazyPermissionPrimingModal, LazyDateTimePickerSheet } from "@/components/ui/lazyMount";

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  gif: "image/gif",
};

export default function AddMemoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();
  const { session, profile } = useAuth();
  const { isDemoMode, executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const insets = useSafeAreaInsets();
  const { theme, isLight } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const isEditing = !!params.id;
  const priming = useNotificationPriming(session?.user?.id);

  const [title, setTitle] = useState(params.title as string || "");
  const [date, setDate] = useState(params.date as string || todayString());
  const [description, setDescription] = useState(params.description as string || "");
  // "memories" bucket'ındaki mevcut fotoğrafın yolu (düzenlemede)
  const [imagePath, setImagePath] = useState(params.image_path as string || "");
  const [localImage, setLocalImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ title: false, date: false });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  // Demo modunda premium kilitleri yoktur: tüm özellikler açık
  const isPremium = (profile?.isPremium ?? false) || isDemoMode;
  useFocusEffect(
    useCallback(() => {
      // Ekran her odaklandığında formu temizle (eğer yeni ekleme modundaysa)
      if (!isEditing) {
        setTitle("");
        setDate(todayString());
        setDescription("");
        setImagePath("");
        setLocalImage(null);
        setErrors({ title: false, date: false });
        setLoading(false);
      }
    }, [isEditing])
  );

  const coupleId = profile?.coupleId || null;

  async function pickImage() {
    if (executeOrIntercept(
      () => {},
      "Özel Günlere Fotoğraf Eklemek İçin Kayıt Olun 📸",
      "Özel gün ve yıldönümlerinize anı fotoğrafları eklemek için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }

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
    if (executeOrIntercept(
      () => {},
      "Özel Gün Kaydetmek İçin Kayıt Olun 💖",
      "Yıldönümleri ve özel günlerinizi kaydetmek ve geri sayım başlatmak için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }

    const newErrors = {
      title: !title.trim(),
      date: !date.trim(),
    };
    setErrors(newErrors);

    if (newErrors.title || newErrors.date) {
      toast.warning("Lütfen bir başlık ve tarih girin.", { title: "Eksik bilgi" });
      return;
    }

    setLoading(true);

    // Yeni seçilen fotoğrafın yüklendiği yol: kayıt başarısız olursa geri silinir
    let uploadedPath: string | null = null;
    try {
      let finalImagePath = imagePath || null;

      // Upload image if a new one was selected
      if (localImage && localImage.base64) {
        if (localImage.fileSize && localImage.fileSize > 5 * 1024 * 1024) {
           appAlert("Dosya Çok Büyük", "Lütfen 5 MB'dan daha küçük bir fotoğraf seçin.");
           setLoading(false);
           return;
        }

        // Supabase Storage yalnızca standart MIME türlerini kabul eder ("image/jpg" geçersiz, "image/jpeg" geçerli).
        // Önce picker'ın bildirdiği mimeType'a, yoksa uzantıya, o da yoksa JPEG'e bakılır.
        const uriExt = localImage.uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
        const contentType = (localImage.mimeType?.toLowerCase() ?? IMAGE_MIME_BY_EXT[uriExt] ?? 'image/jpeg')
          .replace('image/jpg', 'image/jpeg');
        const fileExt = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${coupleId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("memories")
          .upload(filePath, decode(localImage.base64), {
            contentType,
          });

        if (uploadError) throw uploadError;

        // Bucket private: kayda URL değil yol yazılır, görüntülerken imzalanır
        uploadedPath = filePath;
        finalImagePath = filePath;
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
            image_path: finalImagePath,
          })
          .eq("id", Number(params.id));
        error = res.error;
      } else {
        const payload: any = {
          date: date,
          title: cleanTitle,
          description: cleanDescription,
          image_path: finalImagePath,
          is_default: false,
        };
        if (coupleId) payload.couple_id = coupleId;
        const res = await supabase.from("memories").insert(payload);
        error = res.error;
      }

      if (error) throw error;

      if (uploadedPath && localImage) {
        // Yeni fotoğraf ağdan yeniden inmeden cihazdaki kopyasından açılsın
        seedStorageImage("memories", uploadedPath, localImage.uri);
        // Düzenlemede değiştirilen eski fotoğraf depoda sahipsiz kalmasın
        if (imagePath && imagePath !== uploadedPath) {
          removeStoredFiles("memories", [imagePath]).catch(() => {});
        }
      }
      // Kayıt artık bu dosyayı gösteriyor: sonraki adımlarda hata olsa da dosya silinmemeli
      uploadedPath = null;

      queryClient.invalidateQueries({ queryKey: ["memories"] });

      // Yeni anıda partnere giden bildirim sunucudaki tetikleyiciden (send-push) gelir; burada ayrıca göndermek çift bildirim yapıyordu.

      // Yeni anı kaydedildiyse, uygunsa bildirim ön-onay kartını göster; yönlendirme kart kapanınca yapılır
      if (!isEditing && (await priming.maybePrompt())) return;

      toast.success(isEditing ? "Özel gün güncellendi ✨" : "Özel gün kaydedildi ✨");
      router.replace("/(tabs)/memories");
    } catch (error: any) {
      logger.error("Memory save error:", error);
      if (uploadedPath) removeStoredFiles("memories", [uploadedPath]).catch(() => {});
      appAlert("Hata", "Anı kaydedilirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenBackground>
        <TouchableOpacity 
          onPress={() => router.push("/menu")} 
          style={{ 
            padding: 8, 
            backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)", 
            borderRadius: 20, 
            width: 40, 
            height: 40, 
            alignItems: "center", 
            justifyContent: "center", 
            position: "absolute", 
            top: 40, 
            right: 20, 
            zIndex: 50,
            borderWidth: 1,
            borderColor: theme.cardBorder
          }}
        >
          <AlignJustify color={theme.text} size={22} />
        </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
          <TouchableOpacity onPress={() => router.replace("/(tabs)/memories")} style={{ padding: 8, marginLeft: -8 }}>
            <ChevronLeft color={theme.text} size={28} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{isEditing ? "Anıyı Düzenle" : "Yeni Anı Ekle"}</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Klavye açılınca odaktaki alan (Açıklama) ve Kaydet butonu klavyenin üstüne kayar (iOS + Android) */}
        <KeyboardAwareScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          enableOnAndroid
          extraScrollHeight={24}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }, errors.title && { color: "red" }]}>Başlık</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.unitBg, color: theme.text, borderColor: theme.cardBorder, borderWidth: 1 }, errors.title && { borderColor: "red" }]}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                setErrors(prev => ({ ...prev, title: false }));
              }}
              placeholder="Örn: İlk Buluşmamız"
              placeholderTextColor={isLight ? theme.textMuted : "rgba(255,255,255,0.4)"}
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }, errors.date && { color: "red" }]}>Tarih</Text>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: theme.unitBg, borderColor: theme.cardBorder, borderWidth: 1 }, errors.date && { borderColor: "red" }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: date ? theme.text : (isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.4)") }}>
                {date ? formatDateTR(date) : "Tarih Seçin"}
              </Text>
            </TouchableOpacity>

            <LazyDateTimePickerSheet
              visible={showDatePicker}
              mode="date"
              title="Anı Tarihi"
              value={date ? dayjs(date).toDate() : new Date()}
              onCancel={() => setShowDatePicker(false)}
              onConfirm={(selectedDate) => {
                setShowDatePicker(false);
                setDate(dayjs(selectedDate).format("YYYY-MM-DD"));
                setErrors(prev => ({ ...prev, date: false }));
              }}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Açıklama (İsteğe bağlı)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: theme.unitBg, color: theme.text, borderColor: theme.cardBorder, borderWidth: 1 }]}
              value={description}
              onChangeText={setDescription}
              placeholder="O güne dair hatırlamak istediklerin..."
              placeholderTextColor={isLight ? theme.textMuted : "rgba(255,255,255,0.4)"}
              multiline
              maxLength={1000}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Fotoğraf (İsteğe bağlı)</Text>
            <TouchableOpacity style={[styles.imagePicker, { backgroundColor: theme.unitBg, borderColor: theme.cardBorder, borderWidth: 1 }]} onPress={pickImage}>
              {localImage ? (
                <Image source={{ uri: localImage.uri }} style={styles.previewImg} contentFit="cover" />
              ) : imagePath ? (
                <StorageImage bucket="memories" path={imagePath} style={styles.previewImg} contentFit="cover" />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <ImagePlus color={theme.textMuted} size={32} />
                  <Text style={[styles.imagePlaceholderText, { color: theme.textMuted }]}>Galeriden Seç</Text>
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
        </KeyboardAwareScrollView>
      </View>

      <LazyPremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName="Fotoğraflı Özel Gün"
        featureDescription="Özel günlerinize fotoğraf eklemek için Premium'a geçmeniz gerekmektedir."
        gender={profile?.gender}
      />

      <LazyDemoActionModal
        visible={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        title={modalConfig.title}
        description={modalConfig.description}
      />

      <LazyPermissionPrimingModal
        visible={priming.isVisible}
        onAccept={async () => {
          await priming.accept();
          router.replace("/(tabs)/memories");
        }}
        onDismiss={async () => {
          await priming.dismiss();
          router.replace("/(tabs)/memories");
        }}
      />
    </ScreenBackground>
  );
}

const createStyles = (theme: AppTheme) => {
  const isLight = theme.isLight;

  return StyleSheet.create({
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
      color: theme.text,
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
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.7)",
      marginBottom: 8,
      fontFamily: "Inter_500Medium",
    },
    input: {
      borderRadius: 16,
      color: theme.text,
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
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.4)",
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
};
