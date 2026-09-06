/**
 * @file ExoplanetModal.tsx
 * @module modules/stars/components
 * @description Anı ötegezegeni detaylarını görüntüleyen (View) ve yeni gezegen oluşturan (Create) çift modlu modal.
 *
 * Özellikler:
 * - View Modu: Tıklanan anı ötegezegeninin başlık, tarih, açıklama ve fotoğraf galerisi.
 * - Create Modu:
 *   1. Başlık: 2-60 karakter kontrolü.
 *   2. Tarih: Bugün veya geçmiş tarih (gelecek tarih katı şekilde engellenir).
 *   3. Yörünge Kuşağı: 1-5 arası seçim (Hız ve mesafe önizlemeli).
 *   4. Gezegen Türü: 8 jeofiziksel gezegen türü ve gradyan paleti.
 *   5. Fotoğraf Yükleme: expo-image-picker ile çoklu seçim, 1600px sıkıştırma,
 *      'couple-memories' Supabase Storage bucket'ına yükleme (Staged Upload-First).
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
import dayjs from 'dayjs';
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
  readonly mode: 'view' | 'create';
  readonly starId: string;
  readonly coupleId: number;
  readonly selectedPlanet?: StarExoplanetRecord | null;
  readonly onClose: () => void;
  readonly onPlanetCreated?: (planet: StarExoplanetRecord) => void;
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
}) => {
  // ─── FORM STATE (Create Mode) ──────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [milestoneDate, setMilestoneDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [orbitZone, setOrbitZone] = useState<OrbitZone>(3);
  const [planetType, setPlanetType] = useState<PlanetType>('terrestrial');
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]); // local URIs

  // Yükleme ve Hata Durumları
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [formError, setFormError] = useState('');

  // Tam ekran fotoğraf önizleme state'i (View Mode)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  // Modal her açıldığında form alanlarını sıfırla
  useEffect(() => {
    if (visible && mode === 'create') {
      setTitle('');
      setDescription('');
      setMilestoneDate(dayjs().format('YYYY-MM-DD'));
      setOrbitZone(3);
      setPlanetType('terrestrial');
      setSelectedPhotos([]);
      setFormError('');
      setIsSubmitting(false);
      setUploadProgressText('');
    }
    if (visible && mode === 'view') {
      setFullscreenImage(null);
    }
  }, [visible, mode]);

  // ─── FOTOĞRAF SEÇİCİ ───────────────────────────────────────────────
  const handlePickPhotos = async () => {
    if (selectedPhotos.length >= 5) {
      Alert.alert('Sınır', 'Bir anı gezegenine en fazla 5 fotoğraf ekleyebilirsiniz.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 5 - selectedPhotos.length,
        quality: 1,
        base64: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const newUris = result.assets.map((asset) => asset.uri);
      setSelectedPhotos((prev) => [...prev, ...newUris].slice(0, 5));
    } catch (err) {
      Alert.alert('Hata', 'Fotoğraf seçilirken bir sorun oluştu.');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── GEZEGEN OLUŞTURMA VE STAGED-UPLOAD AKIŞI ──────────────────────
  const handleCreatePlanet = async () => {
    // 1. İstemci Doğrulamaları
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 2 || trimmedTitle.length > 60) {
      setFormError('Başlık 2 ile 60 karakter arasında olmalıdır.');
      return;
    }

    // Tarih kontrolü: Bugün veya geçmiş olmalıdır
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

    const uploadedUrls: string[] = [];

    // 2. Fotoğrafları Sıkıştır ve Supabase Storage'a Yükle
    if (selectedPhotos.length > 0) {
      for (let i = 0; i < selectedPhotos.length; i++) {
        setUploadProgressText(`Fotoğraflar yükleniyor (${i + 1}/${selectedPhotos.length})...`);
        const photoUri = selectedPhotos[i];

        try {
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

          const { data: publicUrlData } = supabase.storage
            .from('couple-memories')
            .getPublicUrl(filePath);

          uploadedUrls.push(publicUrlData.publicUrl);
        } catch (uploadError: any) {
          // Hata durumunda işlemi tamamen durdur; DB'ye satır YAZILMAZ
          setIsSubmitting(false);
          setUploadProgressText('');
          setFormError(
            `Fotoğraf yüklenemedi: ${uploadError?.message || 'Ağ hatası oluştu. Lütfen tekrar deneyin.'}`
          );
          return;
        }
      }
    }

    // 3. Veritabanına Atomik Kayıt
    setUploadProgressText('Anı gezegeni yörüngeye yerleştiriliyor...');

    try {
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
    } catch (dbError: any) {
      setIsSubmitting(false);
      setUploadProgressText('');
      setFormError(dbError?.message || 'Gezegen oluşturulurken veritabanı hatası meydana geldi.');
    }
  };

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
                {mode === 'view' ? 'Anı Ötegezegeni' : 'Yeni Anı Gezegeni İnşa Et'}
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
            {/* MOD A: ANILARI İNCELEME (VIEW MODE)                         */}
            {/* ========================================================== */}
            {mode === 'view' && selectedPlanet && (
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
                    </View>
                  </View>
                </View>

                {/* Açıklama / Aşk Mektubu */}
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
              </View>
            )}

            {/* ========================================================== */}
            {/* MOD B: YENİ GEZEGEN OLUŞTURMA (CREATE MODE)                 */}
            {/* ========================================================== */}
            {mode === 'create' && (
              <View style={styles.createContent}>
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
                  />
                </View>

                {/* 6. FOTOĞRAF YÜKLEME ALANI */}
                <View style={styles.inputGroup}>
                  <View style={styles.photoHeaderRow}>
                    <Text style={styles.inputLabel}>FOTOĞRAFLAR ({selectedPhotos.length}/5)</Text>
                    {selectedPhotos.length < 5 && (
                      <TouchableOpacity onPress={handlePickPhotos} style={styles.addPhotoBtn}>
                        <ImagePlus size={14} color="#38BDF8" />
                        <Text style={styles.addPhotoBtnText}>Fotoğraf Ekle</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Fotoğraf Küçük Resim Izgarası */}
                  {selectedPhotos.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoPreviewScroll}>
                      {selectedPhotos.map((uri, idx) => (
                        <View key={uri + idx} style={styles.photoThumbWrapper}>
                          <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
                          <TouchableOpacity
                            onPress={() => handleRemovePhoto(idx)}
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

                {/* KAYDET BUTONU */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleCreatePlanet}
                  disabled={isSubmitting}
                  style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
                >
                  <LinearGradient
                    colors={['#0284C7', '#2563EB', '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.saveBtnGradient}
                  >
                    <Sparkles size={18} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>
                      {isSubmitting ? 'Yörüngeye Yerleştiriliyor...' : 'Anı Gezegenini Yörüngeye Yerleştir 🪐'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
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
    marginTop: 6,
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

  // CREATE MODE
  createContent: {
    gap: 16,
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
