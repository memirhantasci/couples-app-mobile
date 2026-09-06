import React, { useState, useCallback } from "react";
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ActivityIndicator, Alert, Platform 
} from "react-native";
import { Image } from "expo-image";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useRouter, useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { 
  ChevronLeft, ImagePlus, CheckCircle2, 
  AlertCircle, Calendar as CalendarIcon, Clock, AlignJustify, 
  UploadCloud, RefreshCw, MapPin, Navigation, Search
} from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useDemoAction } from "@/hooks/useDemoAction";
import { DemoActionModal } from "@/components/demo/DemoActionModal";
import { decode } from "base64-arraybuffer";
import { notifyPartner } from "@/lib/notifications";
import { dayjs, todayString } from "@/lib/date";
import { getTheme } from "@/lib/theme";
import { logger } from "@/utils/logger";
import { PremiumPaywall } from "@/components/ui/PremiumPaywall";
import { MapPickerModal } from "@/components/MapPickerModal";
import { extractPhotoExif, isValidCoordinate, geocodeAddressString } from "@/utils/exifHelper";
import { sanitize, sanitizeStrict } from "@/utils/sanitize";
import { playCameraClick } from "@/lib/soundEffects";

interface LocationData {
  latitude: number;
  longitude: number;
  locationName?: string;
}

export default function AddPhotoScreen() {
  const router = useRouter();
  const { session, profile, isDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const theme = getTheme(profile?.gender);

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;
  const isPremium = profile?.isPremium ?? false;
  const [showPaywall, setShowPaywall] = useState(false);

  const [localImage, setLocalImage] = useState<{ 
    uri: string; 
    base64?: string;
    thumbUri?: string; 
    thumbBase64?: string;
    fileSize?: number; 
    exif?: any;
  } | null>(null);
  const [takenDate, setTakenDate] = useState(todayString());
  const [takenTime, setTakenTime] = useState(dayjs().format("HH:mm"));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [exifStatus, setExifStatus] = useState<"idle" | "loading" | "found" | "not_found">("idle");
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({ photo: false, description: false });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Konum
  const [photoLocation, setPhotoLocation] = useState<LocationData | null>(null);
  const [exifGpsFound, setExifGpsFound] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [manualAddressInput, setManualAddressInput] = useState("");
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  const handleQuickGeocode = async () => {
    const query = manualAddressInput.trim();
    if (!query) return;
    setIsSearchingAddress(true);
    try {
      const res = await geocodeAddressString(query);
      if (res && isValidCoordinate(res.latitude, res.longitude)) {
        setPhotoLocation(res);
        setExifGpsFound(false);
        setManualAddressInput("");
      } else {
        Alert.alert(
          "Adres Bulunamadı",
          "Girdiğiniz il, ilçe, mahalle veya sokak bulunamadı. Lütfen yazımı kontrol edin veya harita üzerinden seçmeyi deneyin."
        );
      }
    } catch {
      Alert.alert("Hata", "Adres aranırken bir sorun oluştu.");
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handlePickImage = async () => {
    if (executeOrIntercept(
      () => {},
      "Ortak Fotoğraf Eklemek İçin Kayıt Olun 📸",
      "Sevgilinizle ortak anı albümü oluşturmak ve fotoğraflarınızın çekildiği yerleri haritada görmek için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }

    if (!isPremium) {
      setShowPaywall(true);
      return;
    }

    try {
      // base64:false — büyük fotoğrafları JS heap'e yüklemeyiz (OOM crash engeli)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1, // Manipülatör kendi sıkıştırmasını yapacak
        base64: false,
        exif: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setExifStatus("loading");
      setErrors(prev => ({ ...prev, photo: false }));

      // EXIF ve GPS bilgilerini derinlemesine oku (saf JS DataView binary + native fallback)
      const exifResult = await extractPhotoExif(asset.uri, asset.exif);

      // Tarih ve saat
      if (exifResult.takenDate) {
        setTakenDate(exifResult.takenDate);
        setTakenTime(exifResult.takenTime || dayjs().format("HH:mm"));
        setExifStatus("found");
      } else {
        setTakenDate(todayString());
        setTakenTime(dayjs().format("HH:mm"));
        setExifStatus("not_found");
      }

      // GPS Konumu (Geçerli koordinat kontrolü - 0,0 Null Island kesinlikle kabul edilmez)
      if (exifResult.location && isValidCoordinate(exifResult.location.latitude, exifResult.location.longitude)) {
        setPhotoLocation(exifResult.location);
        setExifGpsFound(true);
      } else {
        setPhotoLocation(null);
        setExifGpsFound(false);
      }

      // Tam boy görsel: maks 1600px, JPEG %80 kalite, base64: true
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1600 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      // Thumbnail: 300px JPEG %70 kalite, base64: true
      const thumbnail = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 300 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      setLocalImage({ 
        uri: compressed.uri, 
        base64: compressed.base64,
        thumbUri: thumbnail.uri, 
        thumbBase64: thumbnail.base64,
        exif: asset.exif 
      });

    } catch (error) {
      logger.error("Photo pick error:", error);
      Alert.alert("Hata", "Fotoğraf seçilirken bir hata oluştu.");
    }
  };

  const handleSave = async () => {
    if (executeOrIntercept(
      () => {},
      "Ortak Fotoğraf Eklemek İçin Kayıt Olun 📸",
      "Sevgilinizle ortak anı albümü oluşturmak ve fotoğraflarınızın çekildiği yerleri haritada görmek için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }

    if (!isPremium) {
      setShowPaywall(true);
      return;
    }

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
      Alert.alert("Eksik", "Lütfen bir çekim tarihi girin.");
      return;
    }

    if (newErrors.description) {
      Alert.alert("Eksik", "Lütfen fotoğraf için bir açıklama veya hikaye girin.");
      return;
    }

    if (!localImage) return;

    setUploading(true);

    try {
      // Girdi sanitizasyonu — null-byte, kontrol karakterleri ve script taglerini filtrele
      const cleanTitle = title.trim() ? sanitizeStrict(title.trim()) : null;
      const cleanDescription = sanitize(description.trim());

      if (!cleanDescription) {
        Alert.alert("Hata", "Geçersiz içerik tespit edildi. Lütfen açıklamayı tekrar yazın.");
        setUploading(false);
        return;
      }

      if (!localImage.base64) {
        throw new Error("Fotoğraf işlenemedi. Lütfen fotoğrafı tekrar seçin.");
      }

      // Tam boy görsel yükleme — base64 decode ile doğrudan ArrayBuffer yüklemesi
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const filePath = `${coupleId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("photos")
        .upload(filePath, decode(localImage.base64), {
          contentType: "image/jpeg",
        });

      if (uploadError) throw new Error("Fotoğraf yüklenemedi: " + uploadError.message);

      const { data: publicUrlData } = supabase.storage.from("photos").getPublicUrl(filePath);
      const imageUrl = publicUrlData.publicUrl;

      // Thumbnail yükleme — galeri ızgarası için hızlı küçük resim
      let thumbUrl: string | null = null;
      if (localImage.thumbBase64) {
        try {
          const thumbFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}_thumb.jpg`;
          const thumbFilePath = `${coupleId}/thumbs/${thumbFileName}`;
          const { error: thumbError } = await supabase.storage
            .from("photos")
            .upload(thumbFilePath, decode(localImage.thumbBase64), { contentType: "image/jpeg" });
          if (!thumbError) {
            const { data: thumbUrlData } = supabase.storage.from("photos").getPublicUrl(thumbFilePath);
            thumbUrl = thumbUrlData.publicUrl;
          }
        } catch (thumbErr) {
          // Thumbnail başarısız olsa bile ana görsel yüklemeye devam et
          logger.error("Thumbnail upload error (non-fatal):", thumbErr);
        }
      }

      const validLat = photoLocation && isValidCoordinate(photoLocation.latitude, photoLocation.longitude)
        ? photoLocation.latitude
        : null;
      const validLng = photoLocation && isValidCoordinate(photoLocation.latitude, photoLocation.longitude)
        ? photoLocation.longitude
        : null;
      const validLocationName = (validLat != null && validLng != null)
        ? (photoLocation?.locationName ?? null)
        : null;

      const { error: dbError } = await supabase.from("photo_archive").insert({
        couple_id: coupleId,
        user_id: userId,
        image_url: imageUrl,
        thumb_url: thumbUrl,
        storage_path: filePath,
        title: cleanTitle,
        description: cleanDescription,
        taken_date: takenDate,
        taken_time: takenTime || null,
        exif_found: exifStatus === "found",
        file_size: 0,
        latitude: validLat,
        longitude: validLng,
        location_name: validLocationName,
      });

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["photo_archive", coupleId] });
      queryClient.invalidateQueries({ queryKey: ["map_photos", coupleId] });
      queryClient.invalidateQueries({ queryKey: ["calendar_data"] });
      playCameraClick();

      if (isPremium && coupleId && userId) {
        const senderName = profile?.displayName || "Sevgilin";
        const photoTitle = title.trim();
        const notificationBody = photoTitle 
          ? `${senderName} galeriye yeni bir fotoğraf ekledi: "${photoTitle}"`
          : `${senderName} galeriye yeni bir fotoğraf ekledi.`;
        notifyPartner(coupleId, userId, "Yeni Bir Anı 📸", notificationBody, {
          type: "photo",
          route: "/(tabs)/memories",
          actionLabel: "Anıyı Gör 📸",
        });
      }

      Alert.alert("Başarılı", "Fotoğraf başarıyla ortak arşive eklendi! 🎉", [
        { text: "Harika", onPress: () => router.back() }
      ]);
    } catch (error: any) {
      logger.error("Photo save error:", error);
      Alert.alert("Hata", "Kaydetme sırasında bir sorun oluştu: " + (error?.message || ""));
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
      setTakenDate(todayString());
      setTakenTime(dayjs().format("HH:mm"));
      setErrors({ photo: false, description: false });
      setUploading(false);
      setPhotoLocation(null);
      setExifGpsFound(false);
    }, [])
  );

  if (!session) return <View style={{ flex: 1, backgroundColor: "#0c0c0c" }} />;

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER - Diğer tüm sayfalarla tam uyumlu ve simetrik */}
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft color="#ffffff" size={24} />
          </TouchableOpacity>

          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>Fotoğraf Yükle</Text>
            <Text style={styles.headerSubtitle}>Ortak Galeri Anısı 📸</Text>
          </View>

          <TouchableOpacity 
            onPress={() => router.push("/menu")} 
            style={styles.headerBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AlignJustify color="rgba(255,255,255,0.75)" size={20} />
          </TouchableOpacity>
        </View>

        <KeyboardAwareScrollView 
          contentContainerStyle={styles.container} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          extraScrollHeight={80}
        >
          {/* FOTOĞRAF SEÇİM ALANI */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Text style={styles.cardHeaderTitle}>Görsel</Text>
            <TouchableOpacity 
              style={[
                styles.imagePickerBox, 
                { backgroundColor: theme.unitBg },
                errors.photo && styles.boxError
              ]} 
              onPress={handlePickImage}
              activeOpacity={0.88}
            >
              {localImage ? (
                <View style={styles.imagePreviewWrapper}>
                  <Image source={{ uri: localImage.uri }} style={styles.previewImage} contentFit="cover" />
                  <TouchableOpacity 
                    style={styles.changeImageBadge} 
                    onPress={handlePickImage}
                    activeOpacity={0.8}
                  >
                    <RefreshCw size={13} color="#ffffff" />
                    <Text style={styles.changeImageText}>Değiştir</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.pickerPlaceholder}>
                  <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                    <ImagePlus color={theme.accent} size={28} />
                  </View>
                  <Text style={styles.placeholderTitle}>Fotoğraf Seç</Text>
                  <Text style={styles.placeholderSubtitle}>
                    Galerinizden ortak arşive eklemek istediğiniz fotoğrafı seçin
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* EXIF BİLGİ DURUM ROZETLERİ */}
            {exifStatus === "loading" && (
              <View style={styles.exifLoadingBox}>
                <ActivityIndicator color={theme.accent} size="small" />
                <Text style={styles.exifLoadingText}>Çekim tarihi taranıyor...</Text>
              </View>
            )}

            {exifStatus === "found" && (
              <View style={styles.exifSuccessBox}>
                <CheckCircle2 color="#22c55e" size={16} />
                <Text style={styles.exifSuccessText}>
                  Çekim zamanı algılandı: {dayjs(takenDate).locale("tr").format("D MMMM YYYY")}, {takenTime}
                </Text>
              </View>
            )}

            {exifStatus === "not_found" && (
              <View style={styles.exifNoticeBox}>
                <AlertCircle color="#f59e0b" size={16} />
                <Text style={styles.exifNoticeText}>
                  Fotoğrafta çekim zamanı bulunamadı, şimdiki zaman eklendi.
                </Text>
              </View>
            )}
          </View>

          {/* KONUM KARTI */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Text style={styles.cardHeaderTitle}>Konum Bilgisi</Text>

            {photoLocation ? (
              <View style={[styles.exifSuccessBox, { backgroundColor: exifGpsFound ? "rgba(34,197,94,0.12)" : "rgba(59,130,246,0.12)", borderColor: exifGpsFound ? "rgba(34,197,94,0.3)" : "rgba(59,130,246,0.3)" }]}>
                {exifGpsFound ? (
                  <Navigation size={16} color="#22c55e" />
                ) : (
                  <MapPin size={16} color="#60a5fa" />
                )}
                <View style={{ flex: 1, paddingRight: 6 }}>
                  <Text style={[styles.exifSuccessText, { color: exifGpsFound ? "#22c55e" : "#60a5fa", fontFamily: "Inter_700Bold", fontSize: 11.5 }]}>
                    {exifGpsFound ? "Fotoğraftan Otomatik Algılandı" : "Belirlenen Konum"}
                  </Text>
                  <Text style={[styles.locationDetailText, { color: theme.textSecondary }]} numberOfLines={2}>
                    {photoLocation.locationName ?? `${photoLocation.latitude.toFixed(4)}, ${photoLocation.longitude.toFixed(4)}`}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setShowMapPicker(true)} 
                  style={[styles.changeLocBtn, { borderColor: exifGpsFound ? "rgba(34,197,94,0.4)" : "rgba(59,130,246,0.4)", marginRight: 6 }]}
                >
                  <Text style={[styles.changeLocBtnText, { color: exifGpsFound ? "#22c55e" : "#60a5fa" }]}>Harita</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => { setPhotoLocation(null); setExifGpsFound(false); }} 
                  style={[styles.changeLocBtn, { borderColor: "rgba(239,68,68,0.4)" }]}
                >
                  <Text style={[styles.changeLocBtnText, { color: "#ef4444" }]}>Kaldır</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {/* Hızlı Adres / İl / İlçe / Mahalle / Sokak Girişi */}
                <View style={[styles.quickAddressRow, { backgroundColor: theme.unitBg, borderColor: theme.cardBorder }]}>
                  <Search size={15} color={theme.textMuted} style={{ marginLeft: 12 }} />
                  <TextInput
                    style={[styles.quickAddressInput, { color: theme.text }]}
                    placeholder="İl, ilçe, mahalle veya sokak yazın..."
                    placeholderTextColor={theme.textMuted}
                    value={manualAddressInput}
                    onChangeText={setManualAddressInput}
                    onSubmitEditing={handleQuickGeocode}
                    returnKeyType="search"
                  />
                  {isSearchingAddress ? (
                    <ActivityIndicator size="small" color={theme.accent} style={{ marginRight: 10 }} />
                  ) : manualAddressInput.trim().length > 0 ? (
                    <TouchableOpacity onPress={handleQuickGeocode} style={[styles.quickFindBtn, { backgroundColor: theme.accent }]}>
                      <Text style={styles.quickFindBtnText}>Bul</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Haritadan Seç Butonu */}
                <TouchableOpacity
                  style={[styles.locationPickerBtn, { backgroundColor: theme.unitBg, borderColor: theme.cardBorder }]}
                  onPress={() => setShowMapPicker(true)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg, width: 38, height: 38, borderRadius: 19 }]}>
                    <MapPin size={17} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.locationPickerTitle, { color: theme.text }]}>Haritadan Nokta Seç</Text>
                    <Text style={[styles.locationPickerSub, { color: theme.textMuted }]}>Haritaya dokunarak tam konumu işaretleyin</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* TARİH VE SAAT KARTI */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Text style={styles.cardHeaderTitle}>Zaman Bilgisi</Text>
            <View style={styles.rowInputs}>
              {/* Tarih */}
              <View style={{ flex: 1.2 }}>
                <Text style={styles.fieldLabel}>Çekim Tarihi *</Text>
                <TouchableOpacity 
                  style={[styles.inputRowBtn, { backgroundColor: theme.unitBg }]} 
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <CalendarIcon size={16} color={theme.accent} />
                  <Text style={styles.inputRowBtnText} numberOfLines={1}>
                    {dayjs(takenDate).locale("tr").format("DD MMM YYYY")}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Saat */}
              <View style={{ flex: 0.8 }}>
                <Text style={styles.fieldLabel}>Saat</Text>
                <TouchableOpacity 
                  style={[styles.inputRowBtn, { backgroundColor: theme.unitBg }]} 
                  onPress={() => setShowTimePicker(true)}
                  activeOpacity={0.7}
                >
                  <Clock size={16} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.inputRowBtnText}>
                    {takenTime || "Seç"}
                  </Text>
                </TouchableOpacity>
              </View>
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
          </View>

          {/* BAŞLIK VE AÇIKLAMA KARTI */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <Text style={styles.cardHeaderTitle}>Anı Detayları</Text>
            
            {/* Başlık Input */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Fotoğraf Başlığı (İsteğe bağlı)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: theme.unitBg }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Örn: Kapadokya Gün Batımı ✨"
                placeholderTextColor="rgba(255,255,255,0.3)"
                maxLength={80}
              />
            </View>

            {/* Açıklama Input */}
            <View style={styles.fieldGroup}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[styles.fieldLabel, errors.description && { color: "#ff5c77" }]}>
                  Anının Hikayesi *
                </Text>
                {errors.description && (
                  <Text style={{ fontSize: 11, color: "#ff5c77", fontFamily: "Inter_500Medium" }}>
                    Zorunlu alan
                  </Text>
                )}
              </View>
              <TextInput
                style={[
                  styles.textInput, 
                  styles.textArea, 
                  { backgroundColor: theme.unitBg },
                  errors.description && styles.boxError
                ]}
                value={description}
                onChangeText={(text) => {
                  setDescription(text);
                  setErrors(prev => ({ ...prev, description: false }));
                }}
                placeholder="Bu fotoğrafa dair hatırlamak istediğin özel bir his, mekan veya anı..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                numberOfLines={4}
                maxLength={500}
              />
            </View>
          </View>

          {/* KAYDET BUTONU */}
          <View style={{ marginTop: 6 }}>
            {!isPremium ? (
              <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.12)", borderWidth: 1 }]} 
                onPress={() => setShowPaywall(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.saveBtnText, { color: theme.accent }]}>Premium Özellik 🔒</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[
                  styles.saveBtn, 
                  { backgroundColor: theme.accent, shadowColor: theme.accent },
                  uploading && { opacity: 0.75 }
                ]} 
                onPress={handleSave}
                disabled={uploading}
                activeOpacity={0.85}
              >
                {uploading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <UploadCloud size={20} color="#ffffff" />
                    <Text style={styles.saveBtnText}>Ortak Arşive Ekle</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

        </KeyboardAwareScrollView>
        
        {/* Premium Paywall */}
        <PremiumPaywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          featureName="Fotoğraf Yükle"
          featureDescription="Ortak galeriye dilediğiniz kadar fotoğraf yükleyin."
          gender={profile?.gender}
        />

        {/* Harita Konum Seçici */}
        <MapPickerModal
          visible={showMapPicker}
          onClose={() => setShowMapPicker(false)}
          title="Fotoğraf Konumu"
          initialLocation={
            photoLocation && isValidCoordinate(photoLocation.latitude, photoLocation.longitude)
              ? photoLocation
              : undefined
          }
          onSelectLocation={(loc) => {
            if (isValidCoordinate(loc.latitude, loc.longitude)) {
              setPhotoLocation(loc);
              setExifGpsFound(false);
            }
            setShowMapPicker(false);
          }}
        />

        <DemoActionModal
          visible={isDemoModalOpen}
          onClose={() => setIsDemoModalOpen(false)}
          title={modalConfig.title}
          description={modalConfig.description}
        />
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleBox: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 130,
    gap: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.9)",
    letterSpacing: -0.2,
  },
  imagePickerBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    minHeight: 180,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  boxError: {
    borderColor: "#ff5c77",
    borderWidth: 1.5,
  },
  locationPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  locationPickerTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  locationPickerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
    marginTop: 2,
  },
  changeLocBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.4)",
  },
  changeLocBtnText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: "#22c55e",
  },
  locationDetailText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 16,
  },
  quickAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
  },
  quickAddressInput: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  quickFindBtn: {
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickFindBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  pickerPlaceholder: {
    alignItems: "center",
    padding: 24,
    gap: 8,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  placeholderTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#ffffff",
  },
  placeholderSubtitle: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  imagePreviewWrapper: {
    width: "100%",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    aspectRatio: 1.15,
    borderRadius: 15,
  },
  changeImageBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  changeImageText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  exifLoadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 10,
    borderRadius: 12,
  },
  exifLoadingText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  exifSuccessBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(34,197,94,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.25)",
    padding: 10,
    borderRadius: 12,
  },
  exifSuccessText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#22c55e",
    flex: 1,
  },
  exifNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245,158,11,0.1)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
    padding: 10,
    borderRadius: 12,
  },
  exifNoticeText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#f59e0b",
    flex: 1,
  },
  rowInputs: {
    flexDirection: "row",
    gap: 12,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 6,
  },
  inputRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  inputRowBtnText: {
    color: "#ffffff",
    fontSize: 13.5,
    fontFamily: "Inter_500Medium",
  },
  fieldGroup: {
    gap: 2,
  },
  textInput: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
    lineHeight: 20,
  },
  saveBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnText: {
    color: "#ffffff",
    fontSize: 15.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
});
