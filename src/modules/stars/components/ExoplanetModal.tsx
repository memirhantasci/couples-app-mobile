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
} from 'react-native';
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
dayjs.locale('tr');
import {
  X,
  Orbit,
  Calendar,
  ImagePlus,
  Trash2,
  Sparkles,
  Layers,
  ChevronRight,
  Maximize2,
  Check,
  Edit3,
  AlertCircle,
  Mail,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { starService } from '../api/starService';
import type {
  StarExoplanetRecord,
  OrbitZone,
  PlanetType,
  CreateExoplanetDto,
} from '../types/star.types';

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
}) => {
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

  // Modal görünürlüğü veya mod prop'u değiştiğinde senkronize et
  useEffect(() => {
    if (visible) {
      setActiveMode(mode);
    }
  }, [visible, mode]);

  // Mod veya görünürlük değiştiğinde form alanlarını hazırla
  useEffect(() => {
    if (!visible) return;

    if (activeMode === 'create') {
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

      // Manuel gezegen limitini sorgula
      setIsCheckingLimit(true);
      if (coupleId === 999999 || starId.startsWith('demo-')) {
        setCanAddManual(true);
        setIsCheckingLimit(false);
      } else {
        starService
          .canAddManualExoplanet(starId)
          .then((allowed) => {
            setCanAddManual(allowed);
          })
          .catch(() => {
            setCanAddManual(true);
          })
          .finally(() => {
            setIsCheckingLimit(false);
          });
      }
    } else if (activeMode === 'edit' && selectedPlanet) {
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
    } else if (activeMode === 'view') {
      setFullscreenImage(null);
      setIsDeleting(false);
    }
  }, [visible, activeMode, selectedPlanet, starId, coupleId]);

  // ─── FOTOĞRAF SEÇİCİ ───────────────────────────────────────────────
  const totalPhotosCount = existingPhotos.length + selectedPhotos.length;

  const handlePickPhotos = async () => {
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
    } catch (err) {
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
    const uploadedUrls: string[] = [];
    if (selectedPhotos.length === 0) return uploadedUrls;

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
      const filePath = `${coupleId}/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('couple-memories')
        .upload(filePath, decode(compressed.base64), {
          contentType: 'image/jpeg',
        });

      if (uploadErr) {
        throw uploadErr;
      }

      // Seçenek A: Gerçek Gizlilik (10 yıllık Signed URL)
      const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
        .from('couple-memories')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365 * 10); // 10 yıl

      if (signedUrlErr || !signedUrlData) {
        throw signedUrlErr || new Error('URL oluşturulamadı.');
      }

      uploadedUrls.push(signedUrlData.signedUrl);
    }

    return uploadedUrls;
  };

  // ─── GEZEGEN OLUŞTURMA (Create Modu) ──────────────────────────────
  const handleCreatePlanet = async () => {
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
      const uploadedUrls = await uploadNewPhotos();

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
        media_urls: uploadedUrls,
        custom_metadata: {},
      };

      let newPlanet: StarExoplanetRecord;
      if (coupleId === 999999 || starId.startsWith('demo-')) {
        newPlanet = {
          id: `demo-planet-${Date.now()}`,
          star_id: starId,
          ...payload,
          is_auto_generated: false,
          window_started_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else {
        newPlanet = await starService.createExoplanet(starId, payload);
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
      const newlyUploadedUrls = await uploadNewPhotos();
      const finalMediaUrls = [...existingPhotos, ...newlyUploadedUrls];

      // Silinen fotoğrafları Storage'dan temizle
      if (selectedPlanet?.media_urls) {
        const removedUrls = selectedPlanet.media_urls.filter((url) => !existingPhotos.includes(url));
        if (removedUrls.length > 0) {
          const pathsToRemove = removedUrls
            .map((url) => {
              const match = url.match(/couple-memories\/([^?]+)/);
              return match ? match[1] : null;
            })
            .filter((p): p is string => p !== null);

          if (pathsToRemove.length > 0) {
            // Hata fırlatsa da DB kaydetmesini engellememesi için hatayı yutuyoruz
            await supabase.storage.from('couple-memories').remove(pathsToRemove).catch(() => {});
          }
        }
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
        media_urls: finalMediaUrls,
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
      <View style={styles.modalBackdrop}>
        <BlurView intensity={Platform.OS === 'ios' ? 70 : 100} tint="dark" style={StyleSheet.absoluteFill} />

        <View style={styles.sheetContainer}>
          {/* DRAG HANDLE & HEADER */}
          <View style={styles.dragHandle} />
          <View style={styles.headerRow}>
            <View style={styles.headerTitleBlock}>
              <Orbit size={18} color="#38BDF8" />
              <Text style={styles.headerTitle}>
                {activeMode === 'view'
                  ? 'Anı Ötegezegeni'
                  : activeMode === 'edit'
                  ? 'Anı Gezegenini Düzenle'
                  : 'Yeni Anı Gezegeni İnşa Et'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color="rgba(255, 255, 255, 0.7)" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ========================================================== */}
            {/* MOD 1: ANILARI İNCELEME (VIEW MODE)                         */}
            {/* ========================================================== */}
            {activeMode === 'view' && selectedPlanet && (
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
                    <Text style={styles.viewTitle}>{selectedPlanet.title}</Text>
                    <View style={styles.badgeRow}>
                      <View style={styles.pillBadge}>
                        <Calendar size={11} color="#94A3B8" />
                        <Text style={styles.pillText}>
                          {dayjs(selectedPlanet.milestone_date).format('DD MMMM YYYY')}
                        </Text>
                      </View>
                      <View style={[styles.pillBadge, styles.zoneBadge]}>
                        <Text style={styles.zoneBadgeText}>Kuşak {selectedPlanet.orbit_distance}</Text>
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
                    onPress={() => setActiveMode('edit')}
                    disabled={isDeleting}
                    style={styles.editBtn}
                  >
                    <Edit3 size={15} color="#38BDF8" />
                    <Text style={styles.editBtnText}>Düzenle</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={handleDeletePlanet}
                    disabled={isDeleting}
                    style={styles.deleteBtn}
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
                  <View style={styles.descriptionCard}>
                    <Text style={styles.descriptionText}>{selectedPlanet.description}</Text>
                  </View>
                )}

                {/* FOTOĞRAF GALERİSİ */}
                {selectedPlanet.media_urls && selectedPlanet.media_urls.length > 0 ? (
                  <View style={styles.gallerySection}>
                    <Text style={styles.sectionLabel}>
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
                  <View style={styles.noPhotosBox}>
                    <Text style={styles.noPhotosText}>Bu gezegene henüz fotoğraf eklenmemiş.</Text>
                  </View>
                )}

                {/* İLİŞKİLİ MEKTUPLAR ALANI */}
                {linkedLetterIds.length > 0 && (
                  <View style={styles.lettersSection}>
                    <Text style={styles.sectionLabel}>
                      İLİŞKİLİ MEKTUPLAR ({linkedLetterIds.length})
                    </Text>
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
                              <Mail size={16} color="#C084FC" />
                            </View>
                            <View>
                              <Text style={styles.letterCardTitle}>
                                Mektup #{idx + 1}
                              </Text>
                              <Text style={styles.letterCardSub}>Mektubu Görüntüle</Text>
                            </View>
                          </View>
                          <ChevronRight size={16} color="rgba(255, 255, 255, 0.4)" />
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
                  <Text style={styles.inputLabel}>ANI BAŞLIĞI (ZORUNLU)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Örn: İlk Tatilimiz, Kapadokya Balonları..."
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    value={title}
                    onChangeText={setTitle}
                    maxLength={60}
                    editable={!isSubmitting}
                  />
                </View>

                {/* 2. TARİH GİRDİSİ */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ANI TARİHİ (BUGÜN VEYA GEÇMİŞ: YYYY-AA-GG)</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="YYYY-AA-GG"
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
                    value={milestoneDate}
                    onChangeText={setMilestoneDate}
                    maxLength={10}
                    editable={!isSubmitting}
                  />
                </View>

                {/* 3. YÖRÜNGE KUŞAĞI SEÇİMİ (1-5) */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>YÖRÜNGE KUŞAĞI (1: EN HIZLI - 5: EN SAKİN)</Text>
                  <View style={styles.zoneSelectorRow}>
                    {ORBIT_ZONE_OPTIONS.map((item) => (
                      <TouchableOpacity
                        key={item.zone}
                        activeOpacity={0.8}
                        onPress={() => setOrbitZone(item.zone)}
                        disabled={isSubmitting}
                        style={[
                          styles.zoneBtn,
                          orbitZone === item.zone && styles.zoneBtnActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.zoneBtnText,
                            orbitZone === item.zone && styles.zoneBtnTextActive,
                          ]}
                        >
                          {item.zone}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.zoneHelpText}>
                    {ORBIT_ZONE_OPTIONS.find((z) => z.zone === orbitZone)?.periodDesc}
                  </Text>
                </View>

                {/* 4. GEZEGEN TÜRÜ SEÇİMİ */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>GEZEGEN TÜRÜ</Text>
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
                            isSelected && styles.typeChipActive,
                          ]}
                        >
                          <View
                            style={[
                              styles.typeChipOrb,
                              { backgroundColor: pt.palette[0] },
                            ]}
                          />
                          <Text style={[styles.typeChipText, isSelected && styles.typeChipTextActive]}>
                            {pt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* 5. AÇIKLAMA / NOT GİRDİSİ */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>ANI HİKAYESİ / NOT (İSTEĞE BAĞLI)</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Bu anıyı sevgiliniz için ölümsüzleştiren satırları yazın..."
                    placeholderTextColor="rgba(255, 255, 255, 0.3)"
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
                    <Text style={styles.inputLabel}>FOTOĞRAFLAR ({totalPhotosCount}/5)</Text>
                    {totalPhotosCount < 5 && (
                      <TouchableOpacity
                        onPress={handlePickPhotos}
                        disabled={isSubmitting}
                        style={styles.addPhotoBtn}
                      >
                        <ImagePlus size={14} color="#38BDF8" />
                        <Text style={styles.addPhotoBtnText}>Fotoğraf Ekle</Text>
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
                      style={styles.photoPlaceholderBox}
                    >
                      <ImagePlus size={24} color="rgba(255, 255, 255, 0.4)" />
                      <Text style={styles.photoPlaceholderText}>
                        Galeri'den en fazla 5 fotoğraf seçin
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
                      style={styles.cancelBtn}
                    >
                      <Text style={styles.cancelBtnText}>Vazgeç</Text>
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
                    disabled={isSubmitting || !canAddManual}
                    style={[
                      styles.saveBtn,
                      (isSubmitting || !canAddManual) && styles.saveBtnDisabled,
                    ]}
                  >
                    <LinearGradient
                      colors={
                        !canAddManual
                          ? ['#475569', '#334155']
                          : ['#0284C7', '#2563EB', '#7C3AED']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.saveBtnGradient}
                    >
                      <Sparkles size={18} color="#FFFFFF" />
                      <Text style={styles.saveBtnText}>
                        {isSubmitting
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
          </ScrollView>
        </View>

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
      </View>
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
