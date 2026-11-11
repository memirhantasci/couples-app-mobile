
import { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { appAlert } from "@/lib/dialog";
import { Image } from "expo-image";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { useLocalSearchParams, useRouter } from "expo-router";
import { formEntryOf } from "@/lib/formEntry";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { removeStoredFiles, seedStorageImage } from "@/lib/storageImages";
import { StorageImage } from "@/components/common/StorageImage";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "@/utils/logger";
import { decode } from "base64-arraybuffer";
import { Save, ImagePlus, Calendar as CalendarIcon, RefreshCw, Sparkles } from "lucide-react-native";
import { dayjs, todayString, formatLongDate } from "@/lib/date";
import type { AppTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "@/components/ui/KeyboardAwareScrollView";
import { sanitize } from "@/utils/sanitize";
import { useDemoAction } from "@/hooks/useDemoAction";
import { useNotificationPriming } from "@/hooks/useNotificationPriming";
import { toast } from "@/lib/toast";
import { LazyPremiumPaywall, LazyDemoActionModal, LazyPermissionPrimingModal, LazyDateTimePickerSheet } from "@/components/ui/lazyMount";
import { useTranslation } from "react-i18next";
import { WashiCornerPair } from "@/components/memories/WashiTape";
import { playStampDrop } from "@/lib/soundEffects";

/** Yüklenen anı fotoğrafının en geniş kenarı (px); galeri yüklemesindeki tam boy ile aynı. */
const MEMORY_IMAGE_MAX_WIDTH = 1600;

export default function AddMemoryScreen() {
  const { t, i18n } = useTranslation();
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
  const [isNewlyPicked, setIsNewlyPicked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ title: false, date: false });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  // Demo modunda premium kilitleri yoktur: tüm özellikler açık
  const isPremium = (profile?.isPremium ?? false) || isDemoMode;

  // Ekran sekme olarak bellekte kalır: yeni bir açılışta (formEntry) form, parametrelerdeki kayıttan ya da
  // boş olarak baştan kurulur. Menüye girip dönmek açılış sayılmaz; taslak yerinde kalır.
  const entry = formEntryOf(params);
  const [seenEntry, setSeenEntry] = useState(entry);
  if (seenEntry !== entry) {
    setSeenEntry(entry);
    setTitle((params.title as string) || "");
    setDate((params.date as string) || todayString());
    setDescription((params.description as string) || "");
    setImagePath((params.image_path as string) || "");
    setLocalImage(null);
    setIsNewlyPicked(false);
    setErrors({ title: false, date: false });
    setLoading(false);
  }

  const coupleId = profile?.coupleId || null;

  async function pickImage() {
    if (executeOrIntercept(
      () => {},
      t("memories.demo.addPhotoTitle"),
      t("memories.demo.addPhotoDescription")
    )) {
      return;
    }

    if (!isPremium) {
      setShowPaywall(true);
      return;
    }
    // Galeri hızlı açılsın diye (fotoğraf yükleme ekranıyla aynı ayarlar) kırpma ekranı (allowsEditing) ve seçim anında
    // yeniden sıkıştırma (quality < 1) kullanılmaz: ikisi de seçiciyi yavaşlatır. Küçültme ve JPEG'e çevirme
    // kayıt sırasında yapılır (bkz. handleSave); önizleme zaten çerçeveyi dolduracak şekilde ortadan kırpılır.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      setLocalImage(result.assets[0]);
      setIsNewlyPicked(true);
      // Fotoğraf anı defterine bantlanırken "çıt" damga sesi (ve tek tok titreşim)
      playStampDrop();
    }
  }

  async function handleSave() {
    if (executeOrIntercept(
      () => {},
      t("memories.demo.saveTitle"),
      t("memories.demo.saveDescription")
    )) {
      return;
    }

    const newErrors = {
      title: !title.trim(),
      date: !date.trim(),
    };
    setErrors(newErrors);

    if (newErrors.title || newErrors.date) {
      toast.warning(t("memories.add.titleAndDateRequired"), { title: t("common.missingInformation") });
      return;
    }

    setLoading(true);

    // Yeni seçilen fotoğrafın yüklendiği yol: kayıt başarısız olursa geri silinir
    let uploadedPath: string | null = null;
    try {
      let finalImagePath = imagePath || null;

      // Upload image if a new one was selected
      if (localImage) {
        // Fotoğraf yüklenmeden önce en çok MEMORY_IMAGE_MAX_WIDTH genişliğe küçültülür ve JPEG'e çevrilir
        // (galeri yüklemesiyle aynı yaklaşım); daha küçük görüntü büyütülmez.
        const compressed = await ImageManipulator.manipulateAsync(
          localImage.uri,
          localImage.width > MEMORY_IMAGE_MAX_WIDTH ? [{ resize: { width: MEMORY_IMAGE_MAX_WIDTH } }] : [],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        if (!compressed.base64) throw new Error(t("memories.add.photoPrepFailed"));
        // Yükleme sınırı (bucket 5 MB) küçültülmüş kopya için denetlenir; orijinal dosyanın boyutu önemli değil
        if (compressed.base64.length * 0.75 > 5 * 1024 * 1024) {
          appAlert(t("memories.add.fileTooLargeTitle"), t("memories.add.fileTooLargeMessage"));
          setLoading(false);
          return;
        }
        const contentType = 'image/jpeg';
        const fileExt = 'jpg';
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${coupleId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("memories")
          .upload(filePath, decode(compressed.base64), {
            contentType,
          });

        if (uploadError) throw uploadError;

        // Bucket private: kayda URL değil yol yazılır, görüntülerken imzalanır
        uploadedPath = filePath;
        finalImagePath = filePath;
      }

      // Save to database
      const cleanTitle = sanitize(title.trim());
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

      toast.success(isEditing ? t("memories.toasts.updated") : t("memories.toasts.saved"));
      router.replace("/(tabs)/memories");
    } catch (error: any) {
      logger.error("Memory save error:", error);
      if (uploadedPath) removeStoredFiles("memories", [uploadedPath]).catch(() => {});
      appAlert(t("common.error"), t("memories.add.saveFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenBackground>

      <View style={{ flex: 1 }}>
        <ScreenHeader
          title={isEditing ? t("memories.add.editTitle") : t("memories.add.newTitle")}
          subtitle={t("memories.subtitle")}
          fallbackRoute="/(tabs)/memories"
        />

        {/* Klavye açılınca odaktaki alan (Açıklama) ve Kaydet butonu klavyenin üstüne kayar (iOS + Android) */}
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={StyleSheet.flatten([styles.content, { paddingBottom: insets.bottom + 120 }])}
          showsVerticalScrollIndicator={false}
          enableOnAndroid
          extraScrollHeight={90}
          keyboardShouldPersistTaps="handled"
        >
          {/* FOTOĞRAF KARTI */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardHeaderTitle}>{t("memories.add.photoLabel")}</Text>
            </View>

            <View style={styles.imageFrame}>
              <TouchableOpacity
                style={
                  localImage || imagePath
                    ? styles.photoPreviewFrame
                    : [styles.imagePickerBox, { backgroundColor: theme.unitBg, borderColor: theme.inputBorder }]
                }
                onPress={pickImage}
                activeOpacity={0.88}
              >
                {localImage ? (
                  <View style={styles.previewWrapper}>
                    <Image source={{ uri: localImage.uri }} style={styles.previewImg} contentFit="cover" />
                    <View style={styles.changeImageBadge}>
                      <RefreshCw size={13} color="#ffffff" />
                      <Text style={styles.changeImageText}>{t("photos.add.change")}</Text>
                    </View>
                  </View>
                ) : imagePath ? (
                  <View style={styles.previewWrapper}>
                    <StorageImage bucket="memories" path={imagePath} style={styles.previewImg} contentFit="cover" />
                    <View style={styles.changeImageBadge}>
                      <RefreshCw size={13} color="#ffffff" />
                      <Text style={styles.changeImageText}>{t("photos.add.change")}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.pickerPlaceholder}>
                    <View style={[styles.iconCircle, { backgroundColor: theme.pillAccentBg }]}>
                      <ImagePlus color={theme.accent} size={26} />
                    </View>
                    <Text style={styles.placeholderTitle}>{t("memories.add.chooseFromGallery")}</Text>
                    <Text style={styles.placeholderSubtitle}>{t("photos.add.selectHint")}</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Fotoğraf anı defterine tutturulur: düzenlemede tamamen sabittir, yalnızca yeni fotoğraf seçildiğinde elle yapıştırma efekti oynar */}
              {localImage || imagePath ? (
                <WashiCornerPair animate={isNewlyPicked} />
              ) : null}
            </View>
          </View>

          {/* TARİH KARTI */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
            <Text style={styles.cardHeaderTitle}>{t("photos.add.timeInfo")}</Text>
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }, errors.date && { color: "#D85F78" }]}>
                {t("common.date")}
              </Text>
              <TouchableOpacity
                style={[
                  styles.dateRowBtn,
                  { backgroundColor: theme.unitBg, borderColor: theme.inputBorder },
                  errors.date && styles.boxError,
                ]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.75}
              >
                <View style={[styles.dateIconBadge, { backgroundColor: theme.pillAccentBg }]}>
                  <CalendarIcon size={16} color={theme.accent} />
                </View>
                <Text
                  style={[
                    styles.dateBtnText,
                    { color: date ? theme.text : isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.4)" },
                  ]}
                >
                  {date ? formatLongDate(date, i18n.language) : t("memories.add.selectDate")}
                </Text>
              </TouchableOpacity>

              <LazyDateTimePickerSheet
                visible={showDatePicker}
                mode="date"
                title={t("memories.add.dateTitle")}
                value={date ? dayjs(date).toDate() : new Date()}
                onCancel={() => setShowDatePicker(false)}
                onConfirm={(selectedDate) => {
                  setShowDatePicker(false);
                  setDate(dayjs(selectedDate).format("YYYY-MM-DD"));
                  setErrors((prev) => ({ ...prev, date: false }));
                }}
              />
            </View>
          </View>

          {/* BAŞLIK VE AÇIKLAMA KARTI */}
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}>
            <View style={styles.cardHeaderRow}>
              <Sparkles size={15} color={theme.accent} />
              <Text style={styles.cardHeaderTitle}>{t("photos.add.details")}</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }, errors.title && { color: "#D85F78" }]}>
                {t("home.meeting.titleLabel")}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: theme.unitBg, color: theme.text, borderColor: theme.inputBorder, borderWidth: 1 },
                  errors.title && styles.boxError,
                ]}
                value={title}
                onChangeText={(text) => {
                  setTitle(text);
                  setErrors((prev) => ({ ...prev, title: false }));
                }}
                placeholder={t("memories.add.titlePlaceholder")}
                placeholderTextColor={isLight ? theme.textMuted : "rgba(255,255,255,0.4)"}
                maxLength={100}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>{t("memories.add.descriptionLabel")}</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { backgroundColor: theme.unitBg, color: theme.text, borderColor: theme.inputBorder, borderWidth: 1 },
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder={t("memories.add.descriptionPlaceholder")}
                placeholderTextColor={isLight ? theme.textMuted : "rgba(255,255,255,0.4)"}
                multiline
                maxLength={1000}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: theme.accent, shadowColor: theme.accent },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Save color="#fff" size={20} />
                <Text style={styles.saveBtnText}>{t("common.save")}</Text>
              </>
            )}
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </View>

      <LazyPremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName={t("memories.premium.featureName")}
        featureDescription={t("memories.premium.featureDescription")}
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
    content: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 120,
      gap: 14,
    },
    card: {
      borderRadius: 22,
      borderWidth: 1,
      padding: 16,
      gap: 12,
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    cardHeaderTitle: {
      fontSize: 14,
      fontFamily: "Inter_600SemiBold",
      color: theme.text,
      letterSpacing: -0.2,
    },
    fieldGroup: {
      gap: 6,
    },
    label: {
      fontSize: 12.5,
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.7)",
      fontFamily: "Inter_500Medium",
    },
    input: {
      borderRadius: 14,
      color: theme.text,
      fontSize: 14.5,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: "Inter_400Regular",
    },
    boxError: {
      borderColor: "#D85F78",
      borderWidth: 1.5,
    },
    dateRowBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 14,
      borderWidth: 1,
    },
    dateIconBadge: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    dateBtnText: {
      fontSize: 14.5,
      fontFamily: "Inter_500Medium",
      flex: 1,
    },
    textArea: {
      minHeight: 108,
      textAlignVertical: "top",
      lineHeight: 20,
    },
    imageFrame: {
      position: "relative",
    },
    imagePickerBox: {
      borderRadius: 16,
      borderWidth: 1,
      minHeight: 180,
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
    },
    photoPreviewFrame: {
      width: "100%",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      backgroundColor: theme.unitBg,
      overflow: "hidden",
    },
    previewWrapper: {
      width: "100%",
      height: 200,
    },
    pickerPlaceholder: {
      alignItems: "center",
      padding: 22,
      gap: 6,
    },
    iconCircle: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    placeholderTitle: {
      fontSize: 14.5,
      fontFamily: "Inter_600SemiBold",
      color: theme.text,
    },
    placeholderSubtitle: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: theme.textSecondary,
      textAlign: "center",
      lineHeight: 17,
      paddingHorizontal: 12,
    },
    previewImg: {
      width: "100%",
      height: "100%",
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
    saveBtn: {
      height: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 16,
      marginTop: 4,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 4,
    },
    saveBtnText: {
      color: "#fff",
      fontSize: 15.5,
      fontFamily: "Inter_700Bold",
      letterSpacing: -0.2,
    },
  });
};
