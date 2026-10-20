/**
 * @file ExoplanetModal.tsx
 * @module modules/stars/components
 * @description Anı ötegezegeni detaylarını görüntüleyen (View), düzenleyen (Edit) ve yeni gezegen oluşturan (Create) 3 modlu modal.
 *
 * Özellikler:
 * - View Modu:
 *   - Tıklanan anı ötegezegeninin başlık, tarih, açıklama ve fotoğraf galerisi.
 *   - "Düzenle" butonu -> 'edit' moduna geçer.
 *   - "Sil" butonu -> appAlert onay diyaloğu ile silme işlemi (Storage temizliği dahil).
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
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { appAlert } from '@/lib/dialog';
import { DialogHost } from '@/components/ui/DialogHost';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
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
  Crown,
  Quote,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { DateTimePickerSheet } from '@/components/ui/DateTimePickerSheet';
import { starService } from '../api/starService';
import { planetColors, rgba, type PlanetLook } from '../canvas/micro/microScene';
import { MiniPlanet } from './micro/MiniPlanet';
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

export function planetTypeLabel(type: PlanetType): string {
  return PLANET_TYPE_OPTIONS.find((option) => option.type === type)?.label ?? 'Anı';
}

export const ORBIT_ZONE_OPTIONS: readonly {
  readonly zone: OrbitZone;
  readonly label: string;
  readonly periodDesc: string;
}[] = [
  { zone: 1, label: 'Kuşak 1', periodDesc: 'Yıldıza en yakın yörünge' },
  { zone: 2, label: 'Kuşak 2', periodDesc: 'İç yörünge' },
  { zone: 3, label: 'Kuşak 3', periodDesc: 'Orta yörünge' },
  { zone: 4, label: 'Kuşak 4', periodDesc: 'Dış yörünge' },
  { zone: 5, label: 'Kuşak 5', periodDesc: 'Yıldıza en uzak yörünge' },
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
  /**
   * İnceleme modunda `selectedPlanet` yalnızca harita verisinden kurulmuş bir önizlemedir;
   * ayrıntılar (fotoğraf, hikâye, tarih) sunucudan gelene kadar düzenle/sil kapalıdır.
   */
  readonly isLoadingDetails?: boolean;
}

// ============================================================================
// ANA BİLEŞEN
// ============================================================================

/** Memo'lu: üst ekranın saniyelik geri sayım çizimleri açık pencereyi yeniden çizmez. */
export const ExoplanetModal = React.memo(function ExoplanetModal({
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
  isLoadingDetails = false,
}: ExoplanetModalProps) {
  const router = useRouter();

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

  // Düzenleme formunu mevcut anının bilgileriyle doldurur. Form boş açılırsa kayıt,
  // açıklamayı siler ve tüm fotoğrafları "kaldırılmış" sayıp gezegenden ayırır.
  const fillEditForm = (planet: StarExoplanetRecord) => {
    setTitle(planet.title || '');
    setDescription(planet.description || '');
    setMilestoneDate(planet.milestone_date || dayjs().format('YYYY-MM-DD'));
    setOrbitZone((planet.orbit_distance as OrbitZone) || 3);
    setPlanetType((planet.planet_type as PlanetType) || 'terrestrial');
    setExistingPhotos(planet.media_urls || []);
    setSelectedPhotos([]);
    setFormError('');
    setIsSubmitting(false);
    setUploadProgressText('');
  };

  // İnceleme ekranındaki "Düzenle": modal açıkken moda geçiş prop değişimi olmadığından
  // aşağıdaki senkronizasyon bloğu çalışmaz; form burada doldurulur.
  const startEditing = () => {
    if (!isPremium) {
      onPremiumRequired?.();
      return;
    }
    if (!selectedPlanet) return;
    fillEditForm(selectedPlanet);
    setActiveMode('edit');
  };

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
        fillEditForm(selectedPlanet);
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
      appAlert('Sınır', 'Bir anı gezegenine en fazla 5 fotoğraf ekleyebilirsiniz.');
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
      appAlert('Hata', 'Fotoğraf seçilirken bir sorun oluştu.');
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

    appAlert(
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
              appAlert('Hata', err?.message || 'Gezegen silinirken bir sorun oluştu.');
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

  // Pencere, açıldığı uzay sahnesiyle aynı kozmik dili konuşur: tema rengi yerine
  // gezegenin kendi rengiyle hafifçe ışır (formda seçilen türün rengiyle, canlı).
  const previewLook: PlanetLook =
    activeMode === 'view' && selectedPlanet
      ? { palette: selectedPlanet.palette, planet_type: selectedPlanet.planet_type, is_locked: !isPremium }
      : {
          palette: PLANET_TYPE_OPTIONS.find((option) => option.type === planetType)?.palette ?? ['#38BDF8', '#3B82F6'],
          planet_type: planetType,
          is_locked: false,
        };
  const tint = planetColors(previewLook).primary;
  const eyebrow =
    activeMode === 'view'
      ? selectedPlanet?.is_auto_generated
        ? 'OTOMATİK ANI GEZEGENİ'
        : 'ANI GEZEGENİ'
      : activeMode === 'edit'
      ? 'ANI GEZEGENİNİ DÜZENLE'
      : 'YENİ ANI GEZEGENİ';
  const mediaUrls = selectedPlanet?.media_urls ?? [];
  const photoCardWidth = mediaUrls.length > 1 ? Math.round(SCREEN_WIDTH * 0.74) : SCREEN_WIDTH - 40;
  const formDateLabel = dayjs(milestoneDate).isValid() ? dayjs(milestoneDate).format('D MMMM YYYY') : 'Tarih seçin';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* iOS: klavye açılınca sayfa yukarı itilir; Android: KeyboardAwareScrollView odaktaki alanı görünür tutar */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>

        <View style={styles.sheetContainer}>
          <LinearGradient
            colors={[rgba(tint, 0.28), rgba(tint, 0.07), 'rgba(11, 8, 32, 0)']}
            locations={[0, 0.45, 1]}
            style={styles.sheetGlow}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(253, 230, 138, 0)', 'rgba(253, 230, 138, 0.55)', 'rgba(253, 230, 138, 0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.sheetHairline}
            pointerEvents="none"
          />

          {/* DRAG HANDLE & HEADER */}
          <View style={styles.dragHandle} />
          <View style={styles.headerRow}>
            <View style={styles.headerTitleBlock}>
              <Orbit size={14} color="#FDE68A" />
              <Text style={styles.headerEyebrow}>{eyebrow}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Kapat"
            >
              <X size={17} color="#F8FAFC" />
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
                <View style={styles.hero}>
                  <MiniPlanet planet={previewLook} size={76} />
                  <Text style={styles.heroTitle}>Kilitli anı</Text>
                  <Text style={styles.heroSub}>
                    Fotoğraflar, mektuplar ve ayrıntılar Premium üyeliğiniz yeniden aktif olduğunda açılır.
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => {
                    onClose();
                    onPremiumRequired?.();
                  }}
                  style={styles.primaryBtn}
                >
                  <LinearGradient colors={GOLD_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtnGradient}>
                    <Crown size={16} color="#3B1D00" />
                    <Text style={styles.primaryBtnText}>Premium ile Aç</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={handleDeletePlanet}
                  disabled={isDeleting}
                  style={styles.ghostDangerBtn}
                >
                  {isDeleting ? (
                    <ActivityIndicator size="small" color="#F87171" />
                  ) : (
                    <>
                      <Trash2 size={14} color="#F87171" />
                      <Text style={styles.ghostDangerText}>Gezegeni Sil</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
            {activeMode === 'view' && selectedPlanet && isPremium && (
              <View style={styles.viewContent}>
                {/* Gezegen, başlık ve künye */}
                <View style={styles.hero}>
                  <MiniPlanet planet={previewLook} size={76} />
                  <Text style={styles.heroTitle}>{selectedPlanet.title}</Text>
                  <View style={styles.metaRow}>
                    {selectedPlanet.milestone_date ? (
                      <View style={styles.metaPill}>
                        <Calendar size={12} color="#FDE68A" />
                        <Text style={styles.metaPillText}>
                          {dayjs(selectedPlanet.milestone_date).format('D MMMM YYYY')}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.metaPill}>
                      <Orbit size={12} color="#C4B5FD" />
                      <Text style={styles.metaPillText}>
                        {selectedPlanet.orbit_distance}. kuşak · {planetTypeLabel(selectedPlanet.planet_type)}
                      </Text>
                    </View>
                    {selectedPlanet.is_auto_generated && (
                      <View style={[styles.metaPill, styles.metaPillAuto]}>
                        <Sparkles size={12} color="#C084FC" />
                        <Text style={[styles.metaPillText, styles.metaPillAutoText]}>Otomatik</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Pencere anında açılır; ayrıntılar gelene kadar yer tutucu */}
                {isLoadingDetails && (
                  <View style={styles.loadingCard}>
                    <ActivityIndicator size="small" color="#FDE68A" />
                    <Text style={styles.loadingText}>Fotoğraflar ve hikâye yükleniyor…</Text>
                  </View>
                )}

                {/* FOTOĞRAF GALERİSİ */}
                {isLoadingDetails ? null : mediaUrls.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>ANILAR · {mediaUrls.length} FOTOĞRAF</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      snapToInterval={photoCardWidth + 12}
                      style={styles.galleryScroll}
                      contentContainerStyle={styles.galleryRow}
                    >
                      {mediaUrls.map((url, idx) => (
                        <TouchableOpacity
                          key={url + idx}
                          activeOpacity={0.9}
                          onPress={() => setFullscreenImage(url)}
                          style={[styles.photoCard, { width: photoCardWidth }]}
                          accessibilityLabel={`Fotoğraf ${idx + 1}, tam ekran aç`}
                        >
                          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                          <LinearGradient
                            colors={['rgba(5, 3, 15, 0)', 'rgba(5, 3, 15, 0.6)']}
                            style={styles.photoShade}
                            pointerEvents="none"
                          />
                          <View style={styles.photoExpand}>
                            <Maximize2 size={13} color="#FFFFFF" />
                          </View>
                          {mediaUrls.length > 1 && (
                            <Text style={styles.photoIndex}>
                              {idx + 1}/{mediaUrls.length}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ) : (
                  <View style={styles.emptyPhotos}>
                    <ImagePlus size={20} color="rgba(203, 213, 225, 0.5)" />
                    <Text style={styles.emptyPhotosText}>Bu gezegene henüz fotoğraf eklenmemiş.</Text>
                  </View>
                )}

                {/* Açıklama / Aşk Hikayesi */}
                {selectedPlanet.description ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>HİKÂYEMİZ</Text>
                    <View style={styles.storyCard}>
                      <LinearGradient
                        colors={['#FDE68A', '#F59E0B']}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={styles.storyAccent}
                      />
                      <Quote size={16} color="rgba(253, 230, 138, 0.65)" />
                      <Text style={styles.storyText}>{selectedPlanet.description}</Text>
                    </View>
                  </View>
                ) : null}

                {/* İLİŞKİLİ MEKTUPLAR ALANI */}
                {linkedLetterIds.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>İLİŞKİLİ MEKTUPLAR · {linkedLetterIds.length}</Text>
                    <View style={styles.lettersContainer}>
                      {linkedLetterIds.map((letterId, idx) => (
                        <TouchableOpacity
                          key={letterId || idx}
                          activeOpacity={0.82}
                          style={styles.letterCard}
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
                              <Mail size={16} color="#F9A8D4" />
                            </View>
                            <View>
                              <Text style={styles.letterCardTitle}>Mektup #{idx + 1}</Text>
                              <Text style={styles.letterCardSub}>Mektubu görüntüle</Text>
                            </View>
                          </View>
                          <ChevronRight size={16} color="rgba(255, 255, 255, 0.4)" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* AKSİYON BUTONLARI: DÜZENLE & SİL */}
                <View style={[styles.viewActionRow, isLoadingDetails && styles.actionsDisabled]}>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={startEditing}
                    disabled={isDeleting || isLoadingDetails}
                    style={styles.editBtn}
                  >
                    <Edit3 size={15} color="#FDE68A" />
                    <Text style={styles.editBtnText}>Düzenle</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={handleDeletePlanet}
                    disabled={isDeleting || isLoadingDetails}
                    style={styles.deleteBtn}
                    accessibilityLabel="Gezegeni sil"
                  >
                    {isDeleting ? (
                      <ActivityIndicator size="small" color="#F87171" />
                    ) : (
                      <>
                        <Trash2 size={15} color="#F87171" />
                        <Text style={styles.deleteBtnText}>Sil</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ========================================================== */}
            {/* MOD 2 & 3: FORM ALANLARI (CREATE / EDIT)                    */}
            {/* ========================================================== */}
            {(activeMode === 'create' || activeMode === 'edit') && (
              <View style={styles.createContent}>
                {/* Canlı önizleme: seçimler değiştikçe gezegen ve künye güncellenir */}
                <View style={styles.previewCard}>
                  <MiniPlanet planet={previewLook} size={54} />
                  <View style={styles.previewText}>
                    <Text style={styles.previewTitle} numberOfLines={1}>
                      {title.trim() || 'Yeni anı gezegeni'}
                    </Text>
                    <Text style={styles.previewSub} numberOfLines={1}>
                      {orbitZone}. kuşak · {planetTypeLabel(planetType)} · {formDateLabel}
                    </Text>
                  </View>
                </View>

                {/* CREATE MODU İÇİN LİMİT UYARISI */}
                {activeMode === 'create' && !canAddManual && (
                  <View style={styles.limitWarningCard}>
                    <AlertCircle size={20} color="#F59E0B" />
                    <View style={styles.flexOne}>
                      <Text style={styles.limitWarningTitle}>Gezegen Limiti Dolu (10/10)</Text>
                      <Text style={styles.limitWarningText}>
                        Maksimum 10 anı gezegeni oluşturabilirsiniz. Yeni bir anı eklemek için lütfen mevcut gezegenlerden birini silin.
                      </Text>
                    </View>
                  </View>
                )}

                {/* 1. BAŞLIK GİRDİSİ */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ANI BAŞLIĞI</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Örn: İlk Tatilimiz, Kapadokya Balonları..."
                    placeholderTextColor={PLACEHOLDER_COLOR}
                    value={title}
                    onChangeText={setTitle}
                    maxLength={60}
                    editable={!isSubmitting}
                  />
                </View>

                {/* 2. TARİH SEÇİMİ (takvim / çark; elle yazdırılmaz) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ANI TARİHİ</Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    disabled={isSubmitting}
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowDatePicker(true);
                    }}
                    style={[styles.textInput, styles.dateFieldBtn]}
                  >
                    <Calendar size={16} color="#FDE68A" />
                    <Text style={styles.dateFieldText}>{formDateLabel}</Text>
                    <ChevronRight size={16} color="rgba(203, 213, 225, 0.5)" />
                  </TouchableOpacity>
                </View>

                {/* 3. YÖRÜNGE KUŞAĞI SEÇİMİ (1-5) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>YÖRÜNGE KUŞAĞI</Text>
                  <View style={styles.zoneSelectorRow}>
                    {ORBIT_ZONE_OPTIONS.map((item) => {
                      const isSelected = orbitZone === item.zone;
                      return (
                        <TouchableOpacity
                          key={item.zone}
                          activeOpacity={0.8}
                          onPress={() => setOrbitZone(item.zone)}
                          disabled={isSubmitting}
                          style={[styles.zoneBtn, isSelected && styles.zoneBtnActive]}
                          accessibilityLabel={`${item.label}: ${item.periodDesc}`}
                        >
                          <Text style={[styles.zoneBtnText, isSelected && styles.zoneBtnTextActive]}>{item.zone}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.zoneHelpText}>
                    {ORBIT_ZONE_OPTIONS.find((z) => z.zone === orbitZone)?.periodDesc} · her anı kendi halkasında döner
                  </Text>
                </View>

                {/* 4. GEZEGEN TÜRÜ SEÇİMİ */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>GEZEGEN TÜRÜ</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.typeScroll}
                    contentContainerStyle={styles.typeRow}
                  >
                    {PLANET_TYPE_OPTIONS.map((pt) => {
                      const isSelected = planetType === pt.type;
                      return (
                        <TouchableOpacity
                          key={pt.type}
                          activeOpacity={0.8}
                          onPress={() => setPlanetType(pt.type)}
                          disabled={isSubmitting}
                          style={[styles.typeChip, isSelected && styles.typeChipActive]}
                        >
                          <MiniPlanet planet={{ palette: pt.palette, planet_type: pt.type, is_locked: false }} size={20} glow={false} />
                          <Text style={[styles.typeChipText, isSelected && styles.typeChipTextActive]}>{pt.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* 5. AÇIKLAMA / NOT GİRDİSİ */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ANI HİKÂYESİ · İSTEĞE BAĞLI</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Bu anıyı sevgiliniz için ölümsüzleştiren satırları yazın..."
                    placeholderTextColor={PLACEHOLDER_COLOR}
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
                    <Text style={styles.inputLabel}>FOTOĞRAFLAR · {totalPhotosCount}/5</Text>
                    {totalPhotosCount < 5 && (
                      <TouchableOpacity onPress={handlePickPhotos} disabled={isSubmitting} style={styles.addPhotoBtn}>
                        <ImagePlus size={14} color="#7DD3FC" />
                        <Text style={styles.addPhotoBtnText}>Fotoğraf Ekle</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Fotoğraf Küçük Resimleri (Mevcut + Yeni) */}
                  {totalPhotosCount > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.photoPreviewScroll}
                      contentContainerStyle={styles.photoPreviewRow}
                    >
                      {/* Mevcut Fotoğraflar (Edit Modunda) */}
                      {existingPhotos.map((url, idx) => (
                        <View key={`exist_${url}_${idx}`} style={styles.photoThumbWrapper}>
                          <Image source={{ uri: url }} style={styles.photoThumb} contentFit="cover" />
                          <TouchableOpacity
                            onPress={() => handleRemoveExistingPhoto(idx)}
                            disabled={isSubmitting}
                            style={styles.photoDeleteBtn}
                            accessibilityLabel="Fotoğrafı kaldır"
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
                            accessibilityLabel="Fotoğrafı kaldır"
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
                      style={styles.photoPlaceholderBox}
                    >
                      <ImagePlus size={22} color="rgba(203, 213, 225, 0.5)" />
                      <Text style={styles.photoPlaceholderText}>{"Galeri'den en fazla 5 fotoğraf seçin"}</Text>
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
                    <ActivityIndicator size="small" color="#FDE68A" />
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
                      style={styles.cancelBtn}
                    >
                      <Text style={styles.cancelBtnText}>Vazgeç</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.88}
                      onPress={handleUpdatePlanet}
                      disabled={isSubmitting}
                      style={[styles.primaryBtn, styles.flexOne, isSubmitting && styles.primaryBtnDisabled]}
                    >
                      <LinearGradient colors={GOLD_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtnGradient}>
                        <Check size={17} color="#3B1D00" />
                        <Text style={styles.primaryBtnText}>{isSubmitting ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={handleCreatePlanet}
                    disabled={isSubmitting || !canAddManual || isCheckingLimit}
                    style={[
                      styles.primaryBtn,
                      (isSubmitting || !canAddManual || isCheckingLimit) && styles.primaryBtnDisabled,
                    ]}
                  >
                    <LinearGradient
                      colors={!canAddManual || isCheckingLimit ? DISABLED_GRADIENT : GOLD_GRADIENT}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.primaryBtnGradient}
                    >
                      <Sparkles size={18} color={!canAddManual || isCheckingLimit ? '#E2E8F0' : '#3B1D00'} />
                      <Text
                        style={[styles.primaryBtnText, (!canAddManual || isCheckingLimit) && styles.primaryBtnTextDisabled]}
                      >
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
              <TouchableOpacity onPress={() => setFullscreenImage(null)} style={styles.fullscreenCloseBtn} accessibilityLabel="Kapat">
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <Image source={{ uri: fullscreenImage }} style={styles.fullscreenImg} contentFit="contain" />
            </View>
          </Modal>
        )}
      </KeyboardAvoidingView>
      {/* Bu modal açıkken uyarılar/diyaloglar (kök katman modalın arkasında kalır) burada çizilir */}
      <DialogHost embedded />
    </Modal>
  );
});

// ============================================================================
// STİLLER
// ============================================================================

const GOLD_GRADIENT = ['#FEF3C7', '#FBBF24', '#F59E0B', '#D97706'] as const;
const DISABLED_GRADIENT = ['#475569', '#334155'] as const;
const PLACEHOLDER_COLOR = 'rgba(203, 213, 225, 0.38)';

const SURFACE = 'rgba(255, 255, 255, 0.045)';
const SURFACE_BORDER = 'rgba(255, 255, 255, 0.09)';
const TEXT = '#F8FAFC';
const TEXT_SECONDARY = 'rgba(226, 232, 240, 0.8)';
const TEXT_MUTED = 'rgba(203, 213, 225, 0.58)';

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 2, 9, 0.72)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    maxHeight: SCREEN_HEIGHT * 0.9,
    backgroundColor: '#0B0820',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    paddingBottom: 30,
  },
  sheetGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
  },
  sheetHairline: {
    position: 'absolute',
    top: 0,
    left: 40,
    right: 40,
    height: 1,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignSelf: 'center',
    marginTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 6,
  },
  headerTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerEyebrow: {
    color: 'rgba(253, 230, 138, 0.9)',
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 34,
  },
  flexOne: {
    flex: 1,
  },

  // ─── İnceleme ─────────────────────────────────────────────────────────
  viewContent: {
    gap: 22,
  },
  hero: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 6,
  },
  heroTitle: {
    color: TEXT,
    fontSize: 23,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  heroSub: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
  },
  metaPillText: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  metaPillAuto: {
    backgroundColor: 'rgba(192, 132, 252, 0.12)',
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  metaPillAutoText: {
    color: '#E9D5FF',
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.8,
  },
  galleryScroll: {
    marginHorizontal: -20,
  },
  galleryRow: {
    gap: 12,
    paddingHorizontal: 20,
  },
  photoCard: {
    height: 210,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
  },
  photoShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
  },
  photoExpand: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 3, 15, 0.55)',
  },
  photoIndex: {
    position: 'absolute',
    left: 14,
    bottom: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  emptyPhotos: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
  emptyPhotosText: {
    color: TEXT_MUTED,
    fontSize: 12.5,
    fontFamily: 'Inter_500Medium',
  },
  storyCard: {
    gap: 8,
    padding: 16,
    paddingLeft: 20,
    borderRadius: 18,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    overflow: 'hidden',
  },
  storyAccent: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
  },
  storyText: {
    color: TEXT_SECONDARY,
    fontSize: 14.5,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  lettersContainer: {
    gap: 8,
  },
  letterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
  },
  letterCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  letterIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(244, 114, 182, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterCardTitle: {
    color: TEXT,
    fontSize: 13.5,
    fontFamily: 'Inter_700Bold',
  },
  letterCardSub: {
    color: TEXT_MUTED,
    fontSize: 11.5,
    fontFamily: 'Inter_500Medium',
    marginTop: 1,
  },
  loadingCard: {
    height: 120,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.035)',
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
  },
  loadingText: {
    color: TEXT_MUTED,
    fontSize: 12.5,
    fontFamily: 'Inter_500Medium',
  },
  actionsDisabled: {
    opacity: 0.45,
  },
  viewActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  editBtnText: {
    color: '#FDE68A',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  deleteBtn: {
    height: 50,
    paddingHorizontal: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.28)',
  },
  deleteBtnText: {
    color: '#F87171',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  ghostDangerBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  ghostDangerText: {
    color: '#F87171',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  primaryBtn: {
    height: 54,
    borderRadius: 18,
    overflow: 'hidden',
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    color: '#2A1300',
    fontSize: 14.5,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.2,
  },
  primaryBtnTextDisabled: {
    color: '#E2E8F0',
  },

  // ─── Form ─────────────────────────────────────────────────────────────
  createContent: {
    gap: 18,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
  },
  previewText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  previewTitle: {
    color: TEXT,
    fontSize: 16,
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.2,
  },
  previewSub: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  limitWarningCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.32)',
  },
  limitWarningTitle: {
    color: '#FBBF24',
    fontSize: 13.5,
    fontFamily: 'Inter_700Bold',
    marginBottom: 3,
  },
  limitWarningText: {
    color: 'rgba(253, 230, 138, 0.75)',
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1.6,
  },
  textInput: {
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: TEXT,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  textArea: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  dateFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateFieldText: {
    flex: 1,
    color: TEXT,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
  },
  zoneSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  zoneBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  zoneBtnActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
    borderColor: 'rgba(251, 191, 36, 0.6)',
  },
  zoneBtnText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  zoneBtnTextActive: {
    color: '#FDE68A',
  },
  zoneHelpText: {
    color: TEXT_MUTED,
    fontSize: 11.5,
    fontFamily: 'Inter_500Medium',
  },
  typeScroll: {
    marginHorizontal: -20,
  },
  typeRow: {
    gap: 8,
    paddingHorizontal: 20,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingLeft: 10,
    paddingRight: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  typeChipActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderColor: 'rgba(251, 191, 36, 0.6)',
  },
  typeChipText: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  typeChipTextActive: {
    color: '#FDE68A',
  },
  photoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(125, 211, 252, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(125, 211, 252, 0.28)',
  },
  addPhotoBtnText: {
    color: '#7DD3FC',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  photoPreviewScroll: {
    marginHorizontal: -20,
  },
  photoPreviewRow: {
    gap: 10,
    paddingHorizontal: 20,
  },
  photoThumbWrapper: {
    width: 86,
    height: 86,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  photoDeleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 3, 15, 0.65)',
  },
  savedPhotoBadge: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
  },
  photoPlaceholderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 96,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
  photoPlaceholderText: {
    color: TEXT_MUTED,
    fontSize: 12.5,
    fontFamily: 'Inter_500Medium',
  },
  errorBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12.5,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 18,
  },
  submittingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  submittingText: {
    flex: 1,
    color: '#FDE68A',
    fontSize: 12.5,
    fontFamily: 'Inter_600SemiBold',
  },
  formActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    height: 54,
    paddingHorizontal: 20,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
  },
  cancelBtnText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },

  // ─── Tam ekran fotoğraf ───────────────────────────────────────────────
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  fullscreenImg: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
});

export default ExoplanetModal;
