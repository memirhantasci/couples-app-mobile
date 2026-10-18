/**
 * @file ExoplanetModal.tsx
 * @module modules/stars/components
 * @description Anı ötegezegeni detaylarını görüntüleyen (View), düzenleyen (Edit) ve yeni gezegen oluşturan (Create) 3 modlu modal.
 *
 * Özellikler:
 * - View Modu:
 *   - Tıklanan anı ötegezegeninin başlık, tarih, açıklama ve fotoğraf galerisi.
 *   - "Düzenle" butonu -> 'edit' moduna geçer.
 *   - "Sil" butonu -> Alert.alert onay diyaloğu ile silme işlemi (Storage temizliği dahil).
 *   - "İlişkili Mektuplar" alanı: linked_letter_ids doluysa mektuplara yönlendirme kartları.
 * - Edit Modu:
 *   - Başlık, anı tarihi, yörünge kuşağı, gezegen türü ve anı hikayesi düzenleme.
 *   - Mevcut fotoğrafları kaldırma ve yeni fotoğraflar ekleme (toplam maks 5).
 *   - Kaydet -> starService.updateExoplanet çağrısı.
 * - Create Modu:
 *   - Limit kontrolü: starService.canAddManualExoplanet ile 10 gezegen sınırı denetimi.
 *   - 10 gezegen doluysa buton disabled + "Maksimum 10 anı gezegeni oluşturabilirsiniz" uyarısı.
 *   - Yeni fotoğrafları 1600px sıkıştırarak 'couple-memories' bucket'ına yükleme.
 *   - Kaydet -> starService.createExoplanet çağrısı.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import {
  X,
  Orbit,
  Calendar,
  ImagePlus,
  Trash2,
  Sparkles,
  ChevronRight,
  Maximize2,
  Check,
  Edit3,
  AlertCircle,
  Mail,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';
import { DateTimePickerSheet } from '@/components/ui/DateTimePickerSheet';
import { starService } from '../api/starService';
import type {
  StarExoplanetRecord,
  OrbitZone,
  PlanetType,
  CreateExoplanetDto,
} from '../types/star.types';

dayjs.locale('tr');

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// GEZEGEN TİPİ VE KUŞAK SABİTLERİ
// ============================================================================

export interface PlanetTypeOption {
  readonly type: PlanetType;
  readonly label: string;
  readonly palette: string[];
}

export const PLANET_TYPE_OPTIONS: readonly PlanetTypeOption[] = [
  { type: 'terrestrial', label: 'Karasal', palette: ['#38BDF8', '#3B82F6'] },
  { type: 'ocean_world', label: 'Okyanus', palette: ['#06B6D4', '#0284C7'] },
  { type: 'crystal', label: 'Kristal', palette: ['#C084FC', '#9333EA'] },
  { type: 'ice_world', label: 'Buz Dünyası', palette: ['#E0F2FE', '#7DD3FC'] },
  { type: 'gas_giant', label: 'Gaz Devi', palette: ['#F59E0B', '#B45309'] },
  { type: 'volcanic', label: 'Volkanik', palette: ['#EF4444', '#B91C1C'] },
  { type: 'desert', label: 'Çöl', palette: ['#FCD34D', '#D97706'] },
  { type: 'ringed_giant', label: 'Halkalı Dev', palette: ['#EC4899', '#8B5CF6'] },
];

export const ORBIT_ZONE_OPTIONS: readonly {
  readonly zone: OrbitZone;
  readonly label: string;
  readonly periodDesc: string;
}[] = [
  { zone: 1, label: 'Kuşak 1', periodDesc: 'En İç / Hızlı (14s)' },
  { zone: 2, label: 'Kuşak 2', periodDesc: 'İç Yörünge (25s)' },
  { zone: 3, label: 'Kuşak 3', periodDesc: 'Denge Kuşağı (36s)' },
  { zone: 4, label: 'Kuşak 4', periodDesc: 'Dış Kuşak (48s)' },
  { zone: 5, label: 'Kuşak 5', periodDesc: 'En Dış / Sakin (60s)' },
];

// ============================================================================
// BİLEŞEN PROPLARI
// ============================================================================

export interface ExoplanetModalProps {
  readonly visible: boolean;
  readonly mode: 'view' | 'edit' | 'create';
  readonly starId: string;
  readonly coupleId: number;
  readonly selectedPlanet?: StarExoplanetRecord | null;
  readonly onClose: () => void;
  readonly onPlanetCreated?: (planet: StarExoplanetRecord) => void;
  readonly onPlanetUpdated?: (planet: StarExoplanetRecord) => void;
  readonly onPlanetDeleted?: (planetId: string) => void;
  /** Second-line UI guard; all mutations are also gated by backend RPCs. */
  readonly isPremium?: boolean;
  readonly onPremiumRequired?: () => void;
}

// ============================================================================
// ANA BİLEŞEN
// ============================================================================

export const ExoplanetModal: React.FC<ExoplanetModalProps> = ({
  visible,
  mode,
  starId,
  coupleId,
  selectedPlanet,
  onClose,
  onPlanetCreated,
  onPlanetUpdated,
  onPlanetDeleted,
  isPremium = false,
  onPremiumRequired,
}) => {
  const router = useRouter();
  const { theme, isLight } = useTheme();

  // Aktif mod (Prop ile başlar, 'view' içinden 'edit'e geçebilir)
  const [activeMode, setActiveMode] = useState<'view' | 'edit' | 'create'>(mode);

  // ─── FORM STATE (Create & Edit Mode) ──────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [milestoneDate, setMilestoneDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [orbitZone, setOrbitZone] = useState<OrbitZone>(3);
  const [planetType, setPlanetType] = useState<PlanetType>('terrestrial');
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]); // Mevcut fotoğraflar (Edit için)
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]); // Yeni yüklenecek yerel URI'lar

  // Yükleme ve Hata Durumları
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [formError, setFormError] = useState('');

  // Manuel Gezegen Limit Durumu (Maks 10)
  const [canAddManual, setCanAddManual] = useState(true);
  const [isCheckingLimit, setIsCheckingLimit] = useState(false);

  // Tam ekran fotoğraf önizleme state'i (View Mode)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Anı tarihi seçici (alt sayfa)
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Modal görünürlüğü veya mod prop'u değiştiğinde render aşamasında form state'ini senkronize et
  const [prevProps, setPrevProps] = useState({ visible, mode, selectedPlanet });
  if (
    visible !== prevProps.visible ||
    mode !== prevProps.mode ||
    selectedPlanet !== prevProps.selectedPlanet
  ) {
    setPrevProps({ visible, mode, selectedPlanet });
    if (visible) {
      const nextMode = (mode !== prevProps.mode || visible !== prevProps.visible) ? mode : activeMode;
      if (nextMode !== activeMode) {
        setActiveMode(nextMode);
      }
      if (nextMode === 'create') {
        setTitle('');
        setDescription('');
        setMilestoneDate(dayjs().format('YYYY-MM-DD'));
        setOrbitZone(3);
        setPlanetType('terrestrial');
        setExistingPhotos([]);
        setSelectedPhotos([]);
        setFormError('');
        setIsSubmitting(false);
        setUploadProgressText('');
        const isDemo = coupleId === 999999 || starId.startsWith('demo-');
        setCanAddManual(true);
        setIsCheckingLimit(!isDemo);
      } else if (nextMode === 'edit' && selectedPlanet) {
        setTitle(selectedPlanet.title || '');
        setDescription(selectedPlanet.description || '');
        setMilestoneDate(selectedPlanet.milestone_date || dayjs().format('YYYY-MM-DD'));
        setOrbitZone((selectedPlanet.orbit_distance as OrbitZone) || 3);
        setPlanetType((selectedPlanet.planet_type as PlanetType) || 'terrestrial');
        setExistingPhotos(selectedPlanet.media_urls || []);
        setSelectedPhotos([]);
        setFormError('');
        setIsSubmitting(false);
        setUploadProgressText('');
      } else if (nextMode === 'view') {
        setFullscreenImage(null);
        setIsDeleting(false);
      }
    }
  }

  // Yalnızca create modunda ve modal açıkken asenkron limit kontrolü yap
  useEffect(() => {
    if (!visible || activeMode !== 'create') return;
    if (coupleId === 999999 || starId.startsWith('demo-')) return;

    let isMounted = true;
    starService
      .canAddManualExoplanet(starId)
      .then((allowed) => {
        if (isMounted) setCanAddManual(allowed);
      })
      .catch(() => {
        if (isMounted) setCanAddManual(true);
      })
      .finally(() => {
        if (isMounted) setIsCheckingLimit(false);
      });

    return () => {
      isMounted = false;
    };
  }, [visible, activeMode, starId, coupleId]);

  // ─── FOTOĞRAF SEÇİCİ ───────────────────────────────────────────────
  const totalPhotosCount = existingPhotos.length + selectedPhotos.length;

  const handlePickPhotos = async () => {
    if (!isPremium) {
      onPremiumRequired?.();
      return;
    }
    if (totalPhotosCount >= 5) {
      Alert.alert('Sınır', 'Bir anı gezegenine en fazla 5 fotoğraf ekleyebilirsiniz.');
      return;
    }

    try {
      const remainingSlots = 5 - totalPhotosCount;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 1,
        base64: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const newUris = result.assets.map((asset) => asset.uri);
      setSelectedPhotos((prev) => [...prev, ...newUris].slice(0, remainingSlots));
    } catch {
      Alert.alert('Hata', 'Fotoğraf seçilirken bir sorun oluştu.');
    }
  };

  const handleRemoveExistingPhoto = (index: number) => {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveNewPhoto = (index: number) => {
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── GEZEGEN SİLME (View Modu) ────────────────────────────────────
  const handleDeletePlanet = () => {
    if (!selectedPlanet) return;

    Alert.alert(
      'Bu anıyı kalıcı olarak silmek istediğinize emin misiniz?',
      'Bu işlem geri alınamaz ve anıya ait fotoğraflar da sistemden kaldırılır.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Evet, Sil',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              if (coupleId === 999999 || starId.startsWith('demo-')) {
                // Demo modunda simülasyon
              } else {
                await starService.deleteExoplanet(selectedPlanet.id);
              }

              try {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch {}

              onPlanetDeleted?.(selectedPlanet.id);
              onClose();
            } catch (err: any) {
              Alert.alert('Hata', err?.message || 'Gezegen silinirken bir sorun oluştu.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  // ─── YENİ FOTOĞRAFLARI YÜKLE (Yardımcı Fonksiyon) ───────────────────
  const uploadNewPhotos = async (): Promise<string[]> => {
    const uploadedPaths: string[] = [];
    if (selectedPhotos.length === 0) return uploadedPaths;

    for (let i = 0; i < selectedPhotos.length; i++) {
      setUploadProgressText(`Fotoğraflar yükleniyor (${i + 1}/${selectedPhotos.length})...`);
      const photoUri = selectedPhotos[i];

      // 1600px %80 JPEG manipülasyonu
      const compressed = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ resize: { width: 1600 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!compressed.base64) {
        throw new Error('Fotoğraf verisi işlenemedi.');
      }

      const fileName = `${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.jpg`;
      const filePath = `${coupleId}/exoplanets/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('couple-memories')
        .upload(filePath, decode(compressed.base64), {
          contentType: 'image/jpeg',
        });

      if (uploadErr) {
        throw uploadErr;
      }

      // Persist only the private Storage path. The service creates a short-lived
      // signed URL only after the protected details RPC has succeeded.
      uploadedPaths.push(filePath);
    }

    return uploadedPaths;
  };

  // ─── GEZEGEN OLUŞTURMA (Create Modu) ──────────────────────────────
  const handleCreatePlanet = async () => {
    if (!isPremium) {
      onPremiumRequired?.();
      return;
    }
    if (isCheckingLimit) {
      setFormError('Gezegen limiti doğrulanıyor, lütfen bekleyin...');
      return;
    }

    if (!canAddManual) {
      setFormError('Maksimum 10 anı gezegeni sınırına ulaşıldı.');
      return;
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2 || trimmedTitle.length > 60) {
      setFormError('Başlık 2 ile 60 karakter arasında olmalıdır.');
      return;
    }

    const today = dayjs().format('YYYY-MM-DD');
    if (!dayjs(milestoneDate).isValid()) {
      setFormError('Lütfen geçerli bir tarih girin (YYYY-AA-GG).');
      return;
    }
    if (milestoneDate > today) {
      setFormError('Anı tarihi gelecek bir zaman olamaz. Bugün veya geçmiş bir gün seçiniz.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    try {
      const uploadedPaths = await uploadNewPhotos();

      setUploadProgressText('Anı gezegeni yörüngeye yerleştiriliyor...');

      const selectedTypeConfig = PLANET_TYPE_OPTIONS.find((p) => p.type === planetType);
      const palette = selectedTypeConfig ? selectedTypeConfig.palette : ['#38BDF8', '#3B82F6'];

      const payload: CreateExoplanetDto = {
        title: trimmedTitle,
        description: description.trim() ? description.trim() : null,
        milestone_date: milestoneDate,
        orbit_distance: orbitZone,
        orbit_speed: 1.0,
        planet_type: planetType,
        palette,
      };

      let newPlanet: StarExoplanetRecord;
      if (coupleId === 999999 || starId.startsWith('demo-')) {
        newPlanet = {
          id: `demo-planet-${Date.now()}`,
          star_id: starId,
          ...payload,
          media_urls: uploadedPaths,
          custom_metadata: {},
          is_auto_generated: false,
          window_started_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else {
        newPlanet = await starService.createExoplanet(starId, payload, uploadedPaths);
      }

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      onPlanetCreated?.(newPlanet);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setUploadProgressText('');
      setFormError(err?.message || 'Gezegen oluşturulurken bir hata oluştu.');
    }
  };

  // ─── GEZEGEN GÜNCELLEME (Edit Modu) ───────────────────────────────
  const handleUpdatePlanet = async () => {
    if (!selectedPlanet) return;
    if (!isPremium) {
      onPremiumRequired?.();
      return;
    }

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2 || trimmedTitle.length > 60) {
      setFormError('Başlık 2 ile 60 karakter arasında olmalıdır.');
      return;
    }

    const today = dayjs().format('YYYY-MM-DD');
    if (!dayjs(milestoneDate).isValid()) {
      setFormError('Lütfen geçerli bir tarih girin (YYYY-AA-GG).');
      return;
    }
    if (milestoneDate > today) {
      setFormError('Anı tarihi gelecek bir zaman olamaz. Bugün veya geçmiş bir gün seçiniz.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    try {
      const newlyUploadedPaths = await uploadNewPhotos();

      // Remove only the planet association. Original files remain intact.
      if (selectedPlanet?.media_urls) {
        const removedUrls = selectedPlanet.media_urls.filter((url) => !existingPhotos.includes(url));
        for (const mediaUrl of removedUrls) {
          await starService.removeMediaFromExoplanet(selectedPlanet.id, mediaUrl);
        }
      }
      for (const mediaPath of newlyUploadedPaths) {
        await starService.appendMediaToExoplanet(selectedPlanet.id, mediaPath);
      }

      setUploadProgressText('Anı gezegeni güncelleniyor...');

      const selectedTypeConfig = PLANET_TYPE_OPTIONS.find((p) => p.type === planetType);
      const palette = selectedTypeConfig ? selectedTypeConfig.palette : ['#38BDF8', '#3B82F6'];

      const updatePayload: Partial<CreateExoplanetDto> = {
        title: trimmedTitle,
        description: description.trim() ? description.trim() : null,
        milestone_date: milestoneDate,
        orbit_distance: orbitZone,
        planet_type: planetType,
        palette,
      };

      let updatedPlanet: StarExoplanetRecord;
      if (coupleId === 999999 || starId.startsWith('demo-')) {
        updatedPlanet = {
          ...selectedPlanet,
          ...updatePayload,
          updated_at: new Date().toISOString(),
        };
      } else {
        updatedPlanet = await starService.updateExoplanet(selectedPlanet.id, updatePayload);
      }

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      onPlanetUpdated?.(updatedPlanet);
      setIsSubmitting(false);
      setActiveMode('view');
    } catch (err: any) {
      setIsSubmitting(false);
      setUploadProgressText('');
      setFormError(err?.message || 'Gezegen güncellenirken bir hata oluştu.');
    }
  };

  // ─── BAĞLANTILI MEKTUPLAR KONTROLÜ ─────────────────────────────────
  const linkedLetterIds: string[] =
    selectedPlanet?.custom_metadata &&
    Array.isArray((selectedPlanet.custom_metadata as any).linked_letter_ids)
      ? ((selectedPlanet.custom_metadata as any).linked_letter_ids as string[])
      : [];

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* iOS: klavye açılınca sayfa yukarı itilir; Android: KeyboardAwareScrollView odaktaki alanı görünür tutar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modalBackdrop, { backgroundColor: isLight ? 'rgba(0, 0, 0, 0.5)' : 'rgba(3, 2, 7, 0.75)' }]}
      >
        <BlurView intensity={Platform.OS === 'ios' ? 70 : 100} tint={isLight ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />

        <View style={[styles.sheetContainer, { backgroundColor: isLight ? '#FFFFFF' : theme.cardBg, borderColor: isLight ? 'rgba(0,0,0,0.08)' : theme.cardBorder }]}>
          {/* DRAG HANDLE & HEADER */}
          <View style={[styles.dragHandle, isLight && { backgroundColor: 'rgba(0,0,0,0.18)' }]} />
          <View style={[styles.headerRow, isLight && { borderBottomColor: 'rgba(0,0,0,0.06)' }]}>
            <View style={styles.headerTitleBlock}>
              <Orbit size={18} color="#38BDF8" />
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                {activeMode === 'view'
                  ? 'Anı Ötegezegeni'
                  : activeMode === 'edit'
                  ? 'Anı Gezegenini Düzenle'
                  : 'Yeni Anı Gezegeni İnşa Et'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, isLight && { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
              <X size={18} color={theme.text} />
            </TouchableOpacity>
          </View>

          <KeyboardAwareScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid
            extraScrollHeight={24}
          >
            {/* ========================================================== */}
            {/* MOD 1: ANILARI İNCELEME (VIEW MODE)                         */}
            {/* ========================================================== */}
            {activeMode === 'view' && selectedPlanet && !isPremium && (
              <View style={styles.viewContent}>
                <View style={[styles.noPhotosBox, isLight && { backgroundColor: theme.unitBg, borderColor: 'rgba(0,0,0,0.06)' }]}>
                  <Sparkles size={24} color="#94A3B8" />
                  <Text style={[styles.noPhotosText, { color: theme.textSecondary }]}>Bu anı gezegeni kilitli.</Text>
                  <Text style={[styles.lockedContentText, { color: theme.textMuted }]}>
                    Fotoğraflar, mektuplar ve ayrıntılar Premium üyeliğiniz yeniden aktif olduğunda açılır.
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={handleDeletePlanet}
                  disabled={isDeleting}
                  style={[styles.deleteBtn, isLight && { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.2)' }]}
                >
                  {isDeleting ? <ActivityIndicator size="small" color="#EF4444" /> : <><Trash2 size={15} color="#EF4444" /><Text style={styles.deleteBtnText}>Gezegeni Sil</Text></>}
                </TouchableOpacity>
              </View>
            )}
            {activeMode === 'view' && selectedPlanet && isPremium && (
              <View style={styles.viewContent}>
                {/* Gezegen Başlık & Kuşak Rozetleri */}
                <View style={styles.viewHeroRow}>
                  <View
                    style={[
                      styles.planetColorOrb,
                      {
                        backgroundColor: selectedPlanet.palette[0] || '#38BDF8',
                        shadowColor: selectedPlanet.palette[0] || '#38BDF8',
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.viewTitle, { color: theme.text }]}>{selectedPlanet.title}</Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.pillBadge, isLight && { backgroundColor: theme.unitBg, borderColor: 'rgba(0,0,0,0.06)' }]}>
                        <Calendar size={11} color={theme.textMuted} />
                        <Text style={[styles.pillText, isLight && { color: theme.textSecondary }]}>
                          {dayjs(selectedPlanet.milestone_date).format('DD MMMM YYYY')}
                        </Text>
                      </View>
                      <View style={[styles.pillBadge, styles.zoneBadge, isLight && { backgroundColor: 'rgba(56, 189, 248, 0.12)', borderColor: 'rgba(56, 189, 248, 0.25)' }]}>
                        <Text style={[styles.zoneBadgeText, isLight && { color: '#0284C7' }]}>Kuşak {selectedPlanet.orbit_distance}</Text>
                      </View>
                      {selectedPlanet.is_auto_generated && (
                        <View style={[styles.pillBadge, styles.autoBadge]}>
                          <Sparkles size={11} color="#C084FC" />
                          <Text style={styles.autoBadgeText}>Otomatik Anı</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* AKSİYON BUTONLARI: DÜZENLE & SİL */}
                <View style={styles.viewActionRow}>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={() => {
                      if (!isPremium) {
                        onPremiumRequired?.();
                        return;
                      }
                      setActiveMode('edit');
                    }}
                    disabled={isDeleting}
                    style={[styles.editBtn, isLight && { backgroundColor: 'rgba(56, 189, 248, 0.1)', borderColor: 'rgba(56, 189, 248, 0.25)' }]}
                  >
                    <Edit3 size={15} color={isLight ? '#0284C7' : '#38BDF8'} />
                    <Text style={[styles.editBtnText, isLight && { color: '#0284C7' }]}>Düzenle</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={handleDeletePlanet}
                    disabled={isDeleting}
                    style={[styles.deleteBtn, isLight && { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.2)' }]}
                  >
                    {isDeleting ? (
                      <ActivityIndicator size="small" color="#EF4444" />
                    ) : (
                      <>
                        <Trash2 size={15} color="#EF4444" />
                        <Text style={styles.deleteBtnText}>Sil</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Açıklama / Aşk Hikayesi */}
                {selectedPlanet.description && (
                  <View style={[styles.descriptionCard, isLight && { backgroundColor: theme.unitBg, borderColor: 'rgba(0,0,0,0.06)' }]}>
                    <Text style={[styles.descriptionText, { color: theme.text }]}>{selectedPlanet.description}</Text>
                  </View>
                )}

                {/* FOTOĞRAF GALERİSİ */}
                {selectedPlanet.media_urls && selectedPlanet.media_urls.length > 0 ? (
                  <View style={styles.gallerySection}>
                    <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                      ANILAR VE FOTOĞRAFLAR ({selectedPlanet.media_urls.length})
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryScroll}>
                      {selectedPlanet.media_urls.map((url, idx) => (
                        <TouchableOpacity
                          key={url + idx}
                          activeOpacity={0.88}
                          onPress={() => setFullscreenImage(url)}
                          style={styles.galleryThumbWrapper}
                        >
                          <Image source={{ uri: url }} style={styles.galleryThumb} contentFit="cover" />
                          <View style={styles.expandIconOverlay}>
                            <Maximize2 size={12} color="#FFFFFF" />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ) : (
                  <View style={[styles.noPhotosBox, isLight && { backgroundColor: theme.unitBg, borderColor: 'rgba(0,0,0,0.06)' }]}>
                    <Text style={[styles.noPhotosText, { color: theme.textSecondary }]}>Bu gezegene henüz fotoğraf eklenmemiş.</Text>
                  </View>
                )}

                {/* İLİŞKİLİ MEKTUPLAR ALANI */}
                {linkedLetterIds.length > 0 && (
                  <View style={styles.lettersSection}>
                    <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
                      İLİŞKİLİ MEKTUPLAR ({linkedLetterIds.length})
                    </Text>
                    <View style={styles.lettersContainer}>
                      {linkedLetterIds.map((letterId, idx) => (
                        <TouchableOpacity
                          key={letterId || idx}
                          activeOpacity={0.82}
                          style={[styles.letterCard, isLight && { backgroundColor: theme.unitBg, borderColor: 'rgba(0,0,0,0.06)' }]}
                          onPress={() => {
                            onClose();
                            try {
                              router.push(`/letters/${letterId}` as any);
                            } catch {
                              router.push('/(tabs)/letters' as any);
                            }
                          }}
                        >
                          <View style={styles.letterCardLeft}>
                            <View style={styles.letterIconWrapper}>
                              <Mail size={16} color="#C084FC" />
                            </View>
                            <View>
                              <Text style={[styles.letterCardTitle, { color: theme.text }]}>
                                Mektup #{idx + 1}
                              </Text>
                              <Text style={[styles.letterCardSub, { color: theme.textMuted }]}>Mektubu Görüntüle</Text>
                            </View>
                          </View>
                          <ChevronRight size={16} color={isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255, 255, 255, 0.4)'} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ========================================================== */}
            {/* MOD 2 & 3: FORM ALANLARI (CREATE / EDIT)                    */}
            {/* ========================================================== */}
            {(activeMode === 'create' || activeMode === 'edit') && (
              <View style={styles.createContent}>
                {/* CREATE MODU İÇİN LİMİT UYARISI */}
                {activeMode === 'create' && !canAddManual && (
                  <View style={styles.limitWarningCard}>
                    <AlertCircle size={20} color="#F59E0B" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.limitWarningTitle}>Gezegen Limiti Dolu (10/10)</Text>
                      <Text style={styles.limitWarningText}>
                        Maksimum 10 anı gezegeni oluşturabilirsiniz. Yeni bir anı eklemek için lütfen mevcut gezegenlerden birini silin.
                      </Text>
                    </View>
                  </View>
                )}

                {/* 1. BAŞLIK GİRDİSİ */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textMuted }]}>ANI BAŞLIĞI (ZORUNLU)</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: isLight ? theme.inputBg : 'rgba(255, 255, 255, 0.06)',
                        borderColor: isLight ? theme.inputBorder : 'rgba(255, 255, 255, 0.14)',
                        color: theme.text,
                      },
                    ]}
                    placeholder="Örn: İlk Tatilimiz, Kapadokya Balonları..."
                    placeholderTextColor={isLight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.3)'}
                    value={title}
                    onChangeText={setTitle}
                    maxLength={60}
                    editable={!isSubmitting}
                  />
                </View>

                {/* 2. TARİH SEÇİMİ (takvim / çark; elle yazdırılmaz) */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textMuted }]}>ANI TARİHİ (BUGÜN VEYA GEÇMİŞ)</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={isSubmitting}
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowDatePicker(true);
                    }}
                    style={[
                      styles.textInput,
                      styles.dateFieldBtn,
                      {
                        backgroundColor: isLight ? theme.inputBg : 'rgba(255, 255, 255, 0.06)',
                        borderColor: isLight ? theme.inputBorder : 'rgba(255, 255, 255, 0.14)',
                      },
                    ]}
                  >
                    <Calendar size={16} color="#38BDF8" />
                    <Text style={[styles.dateFieldText, { color: theme.text }]}>
                      {dayjs(milestoneDate).isValid() ? dayjs(milestoneDate).format('DD MMMM YYYY') : 'Tarih Seçin'}
                    </Text>
                    <ChevronRight size={16} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* 3. YÖRÜNGE KUŞAĞI SEÇİMİ (1-5) */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textMuted }]}>YÖRÜNGE KUŞAĞI (1: EN HIZLI - 5: EN SAKİN)</Text>
                  <View style={styles.zoneSelectorRow}>
                    {ORBIT_ZONE_OPTIONS.map((item) => (
                      <TouchableOpacity
                        key={item.zone}
                        activeOpacity={0.8}
                        onPress={() => setOrbitZone(item.zone)}
                        disabled={isSubmitting}
                        style={[
                          styles.zoneBtn,
                          isLight && { backgroundColor: theme.unitBg, borderColor: 'rgba(0,0,0,0.08)' },
                          orbitZone === item.zone && styles.zoneBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.zoneBtnText,
                            isLight && { color: theme.textSecondary },
                            orbitZone === item.zone && styles.zoneBtnTextActive,
                          ]}
                        >
                          {item.zone}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.zoneHelpText, { color: theme.textMuted }]}>
                    {ORBIT_ZONE_OPTIONS.find((z) => z.zone === orbitZone)?.periodDesc}
                  </Text>
                </View>

                {/* 4. GEZEGEN TÜRÜ SEÇİMİ */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textMuted }]}>GEZEGEN TÜRÜ</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                    {PLANET_TYPE_OPTIONS.map((pt) => {
                      const isSelected = planetType === pt.type;
                      return (
                        <TouchableOpacity
                          key={pt.type}
                          activeOpacity={0.8}
                          onPress={() => setPlanetType(pt.type)}
                          disabled={isSubmitting}
                          style={[
                            styles.typeChip,
                            isLight && { backgroundColor: theme.unitBg, borderColor: 'rgba(0,0,0,0.08)' },
                            isSelected && styles.typeChipActive,
                          ]}
                        >
                          <View
                            style={[
                              styles.typeChipOrb,
                              { backgroundColor: pt.palette[0] },
                            ]}
                          />
                          <Text style={[styles.typeChipText, isLight && { color: theme.textSecondary }, isSelected && styles.typeChipTextActive]}>
                            {pt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* 5. AÇIKLAMA / NOT GİRDİSİ */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textMuted }]}>ANI HİKAYESİ / NOT (İSTEĞE BAĞLI)</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      styles.textArea,
                      {
                        backgroundColor: isLight ? theme.inputBg : 'rgba(255, 255, 255, 0.06)',
                        borderColor: isLight ? theme.inputBorder : 'rgba(255, 255, 255, 0.14)',
                        color: theme.text,
                      },
                    ]}
                    placeholder="Bu anıyı sevgiliniz için ölümsüzleştiren satırları yazın..."
                    placeholderTextColor={isLight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.3)'}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                    maxLength={500}
                    editable={!isSubmitting}
                  />
                </View>

                {/* 6. FOTOĞRAF ALANI */}
                <View style={styles.inputGroup}>
                  <View style={styles.photoHeaderRow}>
                    <Text style={[styles.inputLabel, { color: theme.textMuted }]}>FOTOĞRAFLAR ({totalPhotosCount}/5)</Text>
                    {totalPhotosCount < 5 && (
                      <TouchableOpacity
                        onPress={handlePickPhotos}
                        disabled={isSubmitting}
                        style={[styles.addPhotoBtn, isLight && { backgroundColor: 'rgba(56, 189, 248, 0.1)' }]}
                      >
                        <ImagePlus size={14} color={isLight ? '#0284C7' : '#38BDF8'} />
                        <Text style={[styles.addPhotoBtnText, isLight && { color: '#0284C7' }]}>Fotoğraf Ekle</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Fotoğraf Küçük Resimleri (Mevcut + Yeni) */}
                  {totalPhotosCount > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoPreviewScroll}>
                      {/* Mevcut Fotoğraflar (Edit Modunda) */}
                      {existingPhotos.map((url, idx) => (
                        <View key={`exist_${url}_${idx}`} style={styles.photoThumbWrapper}>
                          <Image source={{ uri: url }} style={styles.photoThumb} contentFit="cover" />
                          <TouchableOpacity
                            onPress={() => handleRemoveExistingPhoto(idx)}
                            disabled={isSubmitting}
                            style={styles.photoDeleteBtn}
                          >
                            <Trash2 size={12} color="#FFFFFF" />
                          </TouchableOpacity>
                          <View style={styles.savedPhotoBadge}>
                            <Check size={9} color="#FFFFFF" />
                          </View>
                        </View>
                      ))}

                      {/* Yeni Seçilen Yerel Fotoğraflar */}
                      {selectedPhotos.map((uri, idx) => (
                        <View key={`new_${uri}_${idx}`} style={styles.photoThumbWrapper}>
                          <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
                          <TouchableOpacity
                            onPress={() => handleRemoveNewPhoto(idx)}
                            disabled={isSubmitting}
                            style={styles.photoDeleteBtn}
                          >
                            <Trash2 size={12} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={handlePickPhotos}
                      disabled={isSubmitting}
                      style={[styles.photoPlaceholderBox, isLight && { backgroundColor: theme.unitBg, borderColor: 'rgba(0,0,0,0.1)' }]}
                    >
                      <ImagePlus size={24} color={isLight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.4)'} />
                      <Text style={[styles.photoPlaceholderText, isLight && { color: theme.textMuted }]}>
                        {"Galeri'den en fazla 5 fotoğraf seçin"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* HATA VE İLERLEME BİLDİRİMİ */}
                {formError ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{formError}</Text>
                  </View>
                ) : null}

                {isSubmitting && (
                  <View style={styles.submittingBox}>
                    <ActivityIndicator size="small" color="#38BDF8" />
                    <Text style={styles.submittingText}>{uploadProgressText}</Text>
                  </View>
                )}

                {/* AKSİYON BUTONLARI */}
                {activeMode === 'edit' ? (
                  <View style={styles.formActionRow}>
                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={() => setActiveMode('view')}
                      disabled={isSubmitting}
                      style={[styles.cancelBtn, isLight && { backgroundColor: theme.unitBg, borderColor: 'rgba(0,0,0,0.08)' }]}
                    >
                      <Text style={[styles.cancelBtnText, isLight && { color: theme.textSecondary }]}>Vazgeç</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleUpdatePlanet}
                      disabled={isSubmitting}
                      style={[styles.saveBtn, styles.flexBtn, isSubmitting && styles.saveBtnDisabled]}
                    >
                      <LinearGradient
                        colors={['#0284C7', '#2563EB', '#7C3AED']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.saveBtnGradient}
                      >
                        <Check size={17} color="#FFFFFF" />
                        <Text style={styles.saveBtnText}>
                          {isSubmitting ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleCreatePlanet}
                    disabled={isSubmitting || !canAddManual || isCheckingLimit}
                    style={[
                      styles.saveBtn,
                      (isSubmitting || !canAddManual || isCheckingLimit) && styles.saveBtnDisabled,
                    ]}
                  >
                    <LinearGradient
                      colors={
                        !canAddManual || isCheckingLimit
                          ? ['#475569', '#334155']
                          : ['#0284C7', '#2563EB', '#7C3AED']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.saveBtnGradient}
                    >
                      <Sparkles size={18} color="#FFFFFF" />
                      <Text style={styles.saveBtnText}>
                        {isCheckingLimit
                          ? 'Limit Kontrol Ediliyor...'
                          : isSubmitting
                          ? 'Yörüngeye Yerleştiriliyor...'
                          : !canAddManual
                          ? 'Gezegen Limiti Dolu (10/10)'
                          : 'Anı Gezegenini Yörüngeye Yerleştir 🪐'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </KeyboardAwareScrollView>
        </View>

        {/* TARİH SEÇİCİ: iOS'ta başka bir Modal'ın üstünde açılabilmesi için bu Modal'ın içinde render edilir */}
        <DateTimePickerSheet
          visible={showDatePicker}
          mode="date"
          title="Anı Tarihi"
          value={dayjs(milestoneDate).isValid() ? dayjs(milestoneDate).toDate() : new Date()}
          maximumDate={new Date()}
          onCancel={() => setShowDatePicker(false)}
          onConfirm={(picked) => {
            setShowDatePicker(false);
            setMilestoneDate(dayjs(picked).format('YYYY-MM-DD'));
            setFormError('');
          }}
        />

        {/* TAM EKRAN GÖRSEL ÖNİZLEME MODALI */}
        {fullscreenImage && (
          <Modal visible transparent animationType="fade" onRequestClose={() => setFullscreenImage(null)}>
            <View style={styles.fullscreenBackdrop}>
              <TouchableOpacity
                onPress={() => setFullscreenImage(null)}
                style={styles.fullscreenCloseBtn}
              >
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <Image source={{ uri: fullscreenImage }} style={styles.fullscreenImg} contentFit="contain" />
            </View>
          </Modal>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ============================================================================
// STİLLER
// ============================================================================

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 2, 7, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    maxHeight: SCREEN_HEIGHT * 0.88,
    backgroundColor: 'rgba(15, 12, 30, 0.96)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    paddingBottom: 30,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignSelf: 'center',
    marginTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // VIEW MODE
  viewContent: {
    gap: 16,
  },
  viewHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  planetColorOrb: {
    width: 48,
    height: 48,
    borderRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
  },
  viewTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pillText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  zoneBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 0.8,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  zoneBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  autoBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 0.8,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  autoBadgeText: {
    color: '#C084FC',
    fontSize: 11,
    fontWeight: '700',
  },

  // VIEW AKSİYON BUTONLARI (Düzenle & Sil)
  viewActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  editBtnText: {
    color: '#38BDF8',
    fontSize: 13.5,
    fontWeight: '700',
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  deleteBtnText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '700',
  },

  descriptionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  descriptionText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    lineHeight: 20,
  },
  gallerySection: {
    marginTop: 4,
  },
  sectionLabel: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  galleryScroll: {
    flexDirection: 'row',
  },
  galleryThumbWrapper: {
    width: 110,
    height: 110,
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    position: 'relative',
  },
  galleryThumb: {
    width: '100%',
    height: '100%',
  },
  expandIconOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 4,
    borderRadius: 6,
  },
  noPhotosBox: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
  },
  noPhotosText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 13,
  },
  lockedContentText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },

  // İLİŞKİLİ MEKTUPLAR
  lettersSection: {
    marginTop: 6,
  },
  lettersContainer: {
    gap: 8,
  },
  letterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.22)',
    borderRadius: 14,
    padding: 12,
  },
  letterCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  letterIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterCardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  letterCardSub: {
    color: '#C084FC',
    fontSize: 12,
    fontWeight: '600',
  },

  // CREATE & EDIT MODE
  createContent: {
    gap: 16,
  },
  limitWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 14,
    padding: 14,
  },
  limitWarningTitle: {
    color: '#F59E0B',
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  limitWarningText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    lineHeight: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  textInput: {
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 14.5,
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  dateFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateFieldText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '600',
  },
  zoneSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  zoneBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderColor: '#38BDF8',
  },
  zoneBtnText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    fontWeight: '700',
  },
  zoneBtnTextActive: {
    color: '#38BDF8',
  },
  zoneHelpText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 11,
    marginTop: 2,
  },
  typeScroll: {
    flexDirection: 'row',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 8,
  },
  typeChipActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderColor: '#C084FC',
  },
  typeChipOrb: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  typeChipText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 12,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  photoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addPhotoBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  photoPreviewScroll: {
    flexDirection: 'row',
  },
  photoThumbWrapper: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 8,
    position: 'relative',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  photoDeleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  savedPhotoBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.85)',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderBox: {
    height: 76,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoPlaceholderText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 16,
  },
  submittingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  submittingText: {
    color: '#38BDF8',
    fontSize: 12.5,
    fontWeight: '600',
  },
  formActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '700',
  },
  flexBtn: {
    flex: 2,
    marginTop: 0,
  },
  saveBtn: {
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },

  // FULLSCREEN IMAGE MODAL
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 24,
    zIndex: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImg: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
});

export default ExoplanetModal;
