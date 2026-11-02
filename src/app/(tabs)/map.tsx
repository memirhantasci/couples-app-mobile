import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Location from "expo-location";
import { useFocusEffect, useIsFocused, useRouter } from "expo-router";
import { Heart } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { appAlert } from "@/lib/dialog";
import { showPermissionDeniedDialog } from "@/lib/permissions";
import MapView from "react-native-maps";
import type { LongPressEvent, MapPressEvent, Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/ui/EmptyState";
import { MapAddNoteModal } from "@/components/map/MapAddNoteModal";
import { MapControlBar } from "@/components/map/MapControlBar";
import { MapDetailCard } from "@/components/map/MapDetailCard";
import { MapPhotoLightbox } from "@/components/map/MapPhotoLightbox";
import {
  MeetingMarkerPin,
  NoteMarkerPin,
  PendingNoteMarker,
} from "@/components/map/MapPinMarkers";
import { MapStoryModal } from "@/components/map/MapStoryModal";
import { PhotoMarkerPin } from "@/components/map/PhotoMarkerPin";
import {
  MAX_RIPPLES,
  MapPinRipples,
  ripplePhase,
  rippleTipOffset,
  type RipplePinType,
  type RipplePoint,
} from "@/components/map/MapPinRipples";
import { JourneyRoute, JourneyStatusPill, useLoveJourney } from "@/components/map/LoveJourney";
import { buildJourneyStops } from "@/components/map/journeyStops";
import type {
  FilterType,
  MapCoordinate,
  MapNote,
  MapThemeType,
  PhotoPin,
  SelectedItem,
} from "@/components/map/mapTypes";
import { MAP_THEME_STYLES, isLightMapTheme } from "@/constants/mapStyles";
import { useAuth } from "@/context/AuthContext";
import { useDemoAction } from "@/hooks/useDemoAction";
import { useCoupleAvatars } from "@/hooks/useCoupleAvatars";
import { useMapData } from "@/hooks/useMapData";
import { usePageTour } from "@/hooks/usePageTour";
import { notifyPartner } from "@/lib/notifications";
import { deleteArchivedPhoto } from "@/lib/photoArchive";
import { playStampDrop } from "@/lib/soundEffects";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/context/ThemeContext";
import { toast } from "@/lib/toast";
import { LazyPageTourModal, LazyDemoActionModal } from "@/components/ui/lazyMount";
import { useTranslation } from "react-i18next";
import { localizeServerError } from "@/lib/serverErrors";

const INITIAL_REGION: Region = {
  latitude: 41.0082,
  longitude: 28.9784,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const RIPPLE_COLOR = "#FF6B8F";

export default function MapScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  // Durum çubuğunu yalnızca görünür sekme yönetir (dondurulmuş sekmenin eski StatusBar kaydı kalmasın)
  const isFocused = useIsFocused();
  const { session, profile, isDemoMode } = useAuth();
  const {
    executeOrIntercept,
    isDemoModalOpen,
    setIsDemoModalOpen,
    modalConfig,
  } = useDemoAction();
  // useTheme: themeMode ve isLight bilgisi ile harita stilini senkronize eder
  const { theme, isLight: isAppLight } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  // Pinlerde anıyı/buluşmayı ekleyenin profil fotoğrafı (Premium)
  const { getAvatarUrl } = useCoupleAvatars();
  const mapRef = useRef<MapView | null>(null);
  const lastMarkerPressRef = useRef<number>(0);

  const coupleId = profile?.coupleId ?? null;
  const userId = session?.user?.id ?? null;
  // Demo modunda premium kilitleri yoktur: tüm özellikler açık
  const isPremium = (profile?.isPremium ?? false) || isDemoMode;
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("map");

  const { photoPins, mapNotes, meetingPins, storyPins, isLoading } = useMapData({
    coupleId,
    isPremium,
    isDemoMode,
  });

  // Harita Tema ve Filtreleme: Kullanıcı koyu moddaysa otomatik "midnight", açık/beyaz moddaysa sade "silver" açılır.
  const userManualThemeRef = useRef(false);
  const [mapTheme, setMapTheme] = useState<MapThemeType>(() =>
    isAppLight ? "silver" : "midnight"
  );

  // Uygulama tema modu değiştiğinde (kullanıcı oturum içinde manuel tema seçmediyse) haritayı senkronize tut
  useEffect(() => {
    if (!userManualThemeRef.current) {
      setMapTheme(isAppLight ? "silver" : "midnight");
    }
  }, [isAppLight]);

  const handleMapThemeChange = useCallback((nextTheme: MapThemeType) => {
    userManualThemeRef.current = true;
    setMapTheme(nextTheme);
  }, []);

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  // Etkileşim, Detay Kartı ve Modal State'leri
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  // Doluysa "not ekle" modalı açıktır ve bu konumda bekleyen pin gösterilir.
  const [pendingCoord, setPendingCoord] = useState<MapCoordinate | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  useEffect(() => {
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => setHasLocationPermission(status === "granted"))
      .catch(() => {});
  }, []);
  // "İlk notu bırak": konum izni istemeden, haritada dokunulan yere not bırakma modu
  const [isPickingSpot, setIsPickingSpot] = useState(false);
  const [fullScreenPhoto, setFullScreenPhoto] = useState<PhotoPin | null>(null);
  const [isStoryVisible, setIsStoryVisible] = useState(false);

  // ─── Marker Tıklama (Tıklamanın MapView tarafından ezilmesini önler) ─────
  const handleMarkerPress = useCallback((item: SelectedItem) => {
    lastMarkerPressRef.current = Date.now();
    setSelectedItem(item);
  }, []);

  // Haritaya tıklama (Marker tıklandıysa kartı kapatma)
  const handleMapPress = (e: MapPressEvent) => {
    if (Date.now() - lastMarkerPressRef.current < 450) return;
    setSelectedItem(null);
    if (isPickingSpot) {
      const coord = e.nativeEvent?.coordinate;
      if (coord && coord.latitude && coord.longitude) {
        setIsPickingSpot(false);
        setPendingCoord({ latitude: coord.latitude, longitude: coord.longitude });
      }
    }
  };

  // ─── Not Kaydetme ─────────────────────────────────────────────────────────
  const saveNoteMutation = useMutation({
    mutationFn: async ({
      lat,
      lng,
      note,
    }: {
      lat: number;
      lng: number;
      note: string;
    }) => {
      const { error } = await supabase.from("map_notes").insert({
        couple_id: coupleId,
        user_id: userId,
        latitude: lat,
        longitude: lng,
        note: note.trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      playStampDrop();
      queryClient.invalidateQueries({ queryKey: ["map_notes", coupleId] });
      setPendingCoord(null);
      // Not modalı kapanırken değil kapandıktan sonra; mühür sesi/haptiği zaten verildi
      toast.success(t("map.toasts.noteLeft"), { delay: 350, haptic: false });

      if (coupleId && userId) {
        const senderName = profile?.displayName || t("common.partnerFallback");
        const notePreview = variables.note.trim();
        const notificationBody = notePreview
          ? t("map.notify.memoryNote", { senderName, notePreview })
          : t("map.notify.loveNote", { senderName });
        notifyPartner(
          coupleId,
          userId,
          t("notifications.demo.map.title"),
          notificationBody,
          {
            type: "map",
            note: notePreview,
            route: "/(tabs)/map",
            actionLabel: t("map.notify.explore"),
          },
        );
      }
    },
    onError: (e: Error) => {
      appAlert(t("common.error"), t("map.errors.saveFailedWithMessage", { message: localizeServerError(e, "") }));
    },
  });

  // ─── Not Silme ────────────────────────────────────────────────────────────
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      let query = supabase
        .from("map_notes")
        .delete()
        .eq("id", noteId);
      if (userId) {
        query = query.eq("user_id", userId);
      }
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["map_notes", coupleId] });
      setSelectedItem(null);
    },
    onError: (e: Error) => {
      appAlert(t("common.error"), t("map.errors.deleteFailedWithMessage", { message: localizeServerError(e, "") }));
    },
  });

  // ─── Haritada Not Bırakma (Uzun Basış) ────────────────────────────────────
  const handleMapLongPress = (e: LongPressEvent) => {
    if (executeOrIntercept(() => {}, t("demo.prompts.mapNote.title"), t("demo.prompts.mapNote.description"))) return;

    const coord = e.nativeEvent?.coordinate;
    if (coord && coord.latitude && coord.longitude) {
      setSelectedItem(null);
      setPendingCoord({ latitude: coord.latitude, longitude: coord.longitude });
    }
  };

  const closeAddNote = useCallback(() => setPendingCoord(null), []);

  const handleSaveNote = (text: string) => {
    if (executeOrIntercept(() => {}, t("demo.prompts.mapNote.title"), t("demo.prompts.mapNote.description"))) {
      setPendingCoord(null);
      return;
    }
    if (!pendingCoord || !text.trim()) return;
    saveNoteMutation.mutate({
      lat: pendingCoord.latitude,
      lng: pendingCoord.longitude,
      note: text,
    });
  };

  // ─── Fotoğraf / Not Silme (Detay Kartından) ───────────────────────────────
  const handleDeletePhoto = (photo: PhotoPin) => {
    if (
      executeOrIntercept(
        () => {},
        t("demo.prompts.deletePhoto.title"),
        t("map.demo.deletePhotoDescription"),
      )
    ) {
      return;
    }
    // Sahiplik kontrolü
    if (photo.user_id && userId && photo.user_id !== userId) {
      appAlert(t("common.unauthorizedTitle"), t("photos.errors.ownOnly"));
      return;
    }
    appAlert(
      t("photos.delete.title"),
      t("map.delete.photoMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            if (!userId) return;
            // Önce kayıt (yalnızca yükleyen), sonra depodaki dosyalar (tam boy + küçük resim)
            try {
              await deleteArchivedPhoto(photo, userId);
              queryClient.invalidateQueries({ queryKey: ["map_photos", coupleId] });
              queryClient.invalidateQueries({ queryKey: ["photo_archive", coupleId] });
              queryClient.invalidateQueries({ queryKey: ["calendar_data"] });
              setSelectedItem(null);
            } catch {
              appAlert(t("common.error"), t("photos.errors.deleteFailedGeneric"));
            }
          },
        },
      ],
    );
  };

  const handleDeleteNote = (note: MapNote) => {
    if (
      executeOrIntercept(
        () => {},
        t("calendar.demo.deleteTitle"),
        t("map.demo.deleteNoteDescription"),
      )
    ) {
      return;
    }
    // Sahiplik kontrolü
    if (note.user_id && userId && note.user_id !== userId) {
      appAlert(t("common.unauthorizedTitle"), t("map.errors.ownNotesOnly"));
      return;
    }
    appAlert(t("map.delete.noteTitle"), t("map.delete.noteMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => deleteNoteMutation.mutate(note.id),
      },
    ]);
  };

  // ─── GPS Konumuna Git ─────────────────────────────────────────────────────
  // Haritayı konuma kaydırır ve bulunan koordinatı döndürür (izin yok / hata → null).
  const goToUserLocation = async (): Promise<MapCoordinate | null> => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasLocationPermission(status === "granted");
      if (status !== "granted") {
        showPermissionDeniedDialog(
          t("map.permission.title"),
          t("map.permission.message"),
        );
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (loc?.coords) {
        mapRef.current?.animateToRegion(
          {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          },
          750,
        );
        return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }
      return null;
    } catch {
      // sessizce geç
      return null;
    } finally {
      setIsLocating(false);
    }
  };

  // Boş harita kartındaki eylem: konum izni istemeden yer seçme moduna geç; kullanıcı haritada
  // istediği yere dokunur, not o noktaya bırakılır (konuma gitmek isteyen sağdaki konum butonunu kullanır)
  const handleDropFirstNote = () => {
    if (executeOrIntercept(() => {}, t("demo.prompts.mapNote.title"), t("demo.prompts.mapNote.description"))) return;
    setSelectedItem(null);
    setIsPickingSpot(true);
  };

  // ─── Tüm Pinleri Ekrana Sığdır ─────────────────────────────────────────────
  const fitAllPins = () => {
    const coords: MapCoordinate[] = [];
    const pick = (list: MapCoordinate[]) =>
      list.forEach((p) => coords.push({ latitude: p.latitude, longitude: p.longitude }));

    if (activeFilter === "all" || activeFilter === "photos") pick(photoPins);
    if (activeFilter === "all" || activeFilter === "notes") pick(mapNotes);
    if (activeFilter === "all" || activeFilter === "meetings") pick(meetingPins);

    if (coords.length === 0) {
      goToUserLocation();
      return;
    }

    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 140, right: 60, bottom: 240, left: 60 },
      animated: true,
    });
  };

  // ─── Pinlerde Nabız Dalgası ───────────────────────────────────────────────
  // Dalgalar haritanın üstündeki tek Skia katmanında çizilir (bkz. MapPinRipples). Harita kayarken
  // gizlenir; durunca ekrandaki pinlerin ekran konumları native haritadan okunup yeniden yerleştirilir.
  const reduceMotion = useReducedMotion();
  const ripplePoints = useSharedValue<RipplePoint[]>([]);
  const rippleVisible = useSharedValue(0);
  const ripplesShownRef = useRef(false);
  const rippleRequestRef = useRef(0);
  const lastRegionRef = useRef<Region>(INITIAL_REGION);

  const ripplePins = useMemo(() => {
    const pins: { key: string; type: RipplePinType; latitude: number; longitude: number }[] = [];
    if (activeFilter === "all" || activeFilter === "photos") {
      photoPins.forEach((p) => pins.push({ key: `photo-${p.id}`, type: "photo", latitude: p.latitude, longitude: p.longitude }));
    }
    if (activeFilter === "all" || activeFilter === "notes") {
      mapNotes.forEach((n) => pins.push({ key: `note-${n.id}`, type: "note", latitude: n.latitude, longitude: n.longitude }));
    }
    if (activeFilter === "all" || activeFilter === "meetings") {
      meetingPins.forEach((m) => pins.push({ key: `meeting-${m.id}`, type: "meeting", latitude: m.latitude, longitude: m.longitude }));
    }
    return pins;
  }, [activeFilter, photoPins, mapNotes, meetingPins]);

  const hideRipples = useCallback(() => {
    // Süren bir konumlama varsa sonucu artık geçersiz: harita yeniden kıpırdadı
    rippleRequestRef.current += 1;
    if (!ripplesShownRef.current) return;
    ripplesShownRef.current = false;
    rippleVisible.set(withTiming(0, { duration: 120 }));
  }, [rippleVisible]);

  const placeRipples = useCallback(
    async (region: Region) => {
      const map = mapRef.current;
      if (!map || reduceMotion) return;
      const request = ++rippleRequestRef.current;
      const halfLat = region.latitudeDelta / 2;
      const halfLng = region.longitudeDelta / 2;
      const distanceToCenter = (p: { latitude: number; longitude: number }) =>
        (p.latitude - region.latitude) ** 2 + (p.longitude - region.longitude) ** 2;
      const inView = ripplePins
        .filter(
          (p) => Math.abs(p.latitude - region.latitude) <= halfLat && Math.abs(p.longitude - region.longitude) <= halfLng
        )
        .sort((a, b) => distanceToCenter(a) - distanceToCenter(b))
        .slice(0, MAX_RIPPLES);
      try {
        const screenPoints = await Promise.all(
          inView.map((p) => map.pointForCoordinate({ latitude: p.latitude, longitude: p.longitude }))
        );
        if (request !== rippleRequestRef.current) return;
        ripplePoints.set(
          screenPoints.map((point, i) => ({
            x: point.x,
            y: point.y + rippleTipOffset(inView[i].type),
            phase: ripplePhase(inView[i].key),
          }))
        );
        ripplesShownRef.current = true;
        rippleVisible.set(withTiming(1, { duration: 260 }));
      } catch {
        // Harita henüz hazır değil: bir sonraki durmada yeniden denenir
      }
    },
    [reduceMotion, ripplePins, ripplePoints, rippleVisible]
  );

  // Pinler ya da filtre değişince dalgalar yeni listeye göre yerleşir
  useEffect(() => {
    placeRipples(lastRegionRef.current);
  }, [placeRipples]);

  // ─── "Aşk Rotamız" ─────────────────────────────────────────────────────────
  const { journey, startJourney, stopJourney } = useLoveJourney(mapRef);

  // Ekrandan çıkılınca tur durur (zamanlayıcılar ve rota temizlenir)
  useFocusEffect(useCallback(() => stopJourney, [stopJourney]));

  const handleToggleJourney = () => {
    if (journey) {
      stopJourney();
      return;
    }
    const stops = buildJourneyStops({
      photos: activeFilter === "all" || activeFilter === "photos" ? photoPins : [],
      notes: activeFilter === "all" || activeFilter === "notes" ? mapNotes : [],
      meetings: activeFilter === "all" || activeFilter === "meetings" ? meetingPins : [],
    });
    if (stops.length < 2) {
      toast.info(t("map.journey.notEnough"), { emoji: "📍" });
      return;
    }
    setSelectedItem(null);
    startJourney(stops, reduceMotion);
  };

  const isLight = isLightMapTheme(mapTheme);
  const mapBgColor = isLight ? "#F7F4EF" : "#0F131D";
  const isAddingNote = pendingCoord !== null;
  // Hiç pin yoksa (not, buluşma, fotoğraf): ipucu yerine romantik bir davet kartı gösterilir
  const isMapEmpty = photoPins.length === 0 && mapNotes.length === 0 && meetingPins.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: mapBgColor }]}>
      {isFocused ? <StatusBar barStyle={isLight ? "dark-content" : "light-content"} /> : null}

      {/* ─── HARİTA ─────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={[StyleSheet.absoluteFill, { backgroundColor: mapBgColor }]}
        loadingBackgroundColor={mapBgColor}
        loadingIndicatorColor={theme.accent}
        // customMapStyle yalnızca Google Maps'te çalışır (Android). iOS'ta harita Apple Maps'tir ve
        // JSON stili yok sayar; orada renk modu yalnızca açık/koyu arayüz stiliyle değişir.
        customMapStyle={Platform.OS === "android" ? MAP_THEME_STYLES[mapTheme] : undefined}
        userInterfaceStyle={Platform.OS === "ios" ? (isLight ? "light" : "dark") : undefined}
        initialRegion={INITIAL_REGION}
        onLongPress={handleMapLongPress}
        onPress={handleMapPress}
        onMapReady={() => placeRipples(lastRegionRef.current)}
        onRegionChange={hideRipples}
        onRegionChangeComplete={(region) => {
          lastRegionRef.current = region;
          placeRipples(region);
        }}
        showsUserLocation={hasLocationPermission}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {(activeFilter === "all" || activeFilter === "photos") &&
          photoPins.map((photo) => (
            <PhotoMarkerPin
              key={`photo-${photo.id}`}
              photo={photo}
              avatarUrl={getAvatarUrl(photo.user_id)}
              onSelect={handleMarkerPress}
            />
          ))}

        {(activeFilter === "all" || activeFilter === "notes") &&
          mapNotes.map((note) => (
            <NoteMarkerPin
              key={`note-${note.id}`}
              note={note}
              avatarUrl={getAvatarUrl(note.user_id)}
              onSelect={handleMarkerPress}
            />
          ))}

        {(activeFilter === "all" || activeFilter === "meetings") &&
          meetingPins.map((meeting) => (
            <MeetingMarkerPin
              key={`meeting-${meeting.id}`}
              meeting={meeting}
              avatarUrl={getAvatarUrl(meeting.user_id)}
              onSelect={handleMarkerPress}
            />
          ))}

        {pendingCoord && (
          <PendingNoteMarker coordinate={pendingCoord} accent={theme.accent} />
        )}

        {journey ? <JourneyRoute journey={journey} /> : null}
      </MapView>

      {/* ─── PİNLERDE NABIZ DALGASI (dokunuşları engellemez) ───────────────── */}
      <MapPinRipples points={ripplePoints} visible={rippleVisible} color={RIPPLE_COLOR} />

      {/* ─── ÜST KONTROL ÇUBUĞU (Başlık, Filtreler, Tema, Hikaye) ───────── */}
      <MapControlBar
        accent={theme.accent}
        isLight={isLight}
        topInset={insets.top}
        isPremium={isPremium}
        photoCount={photoPins.length}
        noteCount={mapNotes.length}
        meetingCount={meetingPins.length}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        mapTheme={mapTheme}
        onMapThemeChange={handleMapThemeChange}
        isLocating={isLocating}
        onOpenTour={openTour}
        onOpenStory={() => setIsStoryVisible(true)}
        onFitAll={fitAllPins}
        onLocate={goToUserLocation}
        isJourneyActive={!!journey}
        onToggleJourney={handleToggleJourney}
      />

      {/* ─── YÜKLENİYOR GÖSTERGESİ ─────────────────────────────────────── */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )}

      {/* ─── BOŞ HARİTA DAVETİ ─────────────────────────────────────────── */}
      {!isLoading && isMapEmpty && !selectedItem && !isAddingNote && !isPickingSpot && (
        <View style={[styles.emptyWrap, { bottom: insets.bottom + 100 }]} pointerEvents="box-none">
          <EmptyState
            compact
            emoji="📍"
            title={t("map.empty.title")}
            description={t("map.empty.description")}
            ctaLabel={t("map.empty.cta")}
            onPressCta={handleDropFirstNote}
            theme={theme}
            style={styles.emptyCard}
          />
        </View>
      )}

      {/* ─── YER SEÇME REHBERİ (ilk not) ───────────────────────────────── */}
      {isPickingSpot && !isAddingNote && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setIsPickingSpot(false)}
          style={[styles.hintPill, { bottom: insets.bottom + 90 }]}
          accessibilityRole="button"
          accessibilityLabel={t("map.pick.cancelA11y")}
        >
          <BlurView
            tint={isLight ? "light" : "dark"}
            intensity={85}
            style={StyleSheet.absoluteFill}
          />
          <Heart size={14} color={theme.accent} fill={theme.accent} />
          <Text style={[styles.hintPillText, { color: isLight ? "#222" : "#fff" }]}>
            {t("map.pick.hint")}
          </Text>
        </TouchableOpacity>
      )}

      {/* ─── AŞK ROTAMIZ: ilerleme ve kapatma ──────────────────────────── */}
      {journey && !selectedItem ? (
        <JourneyStatusPill
          journey={journey}
          isLight={isLight}
          accent={theme.accent}
          bottom={insets.bottom + 90}
          onClose={stopJourney}
        />
      ) : null}

      {/* ─── HIZLI NOT EKLEME REHBERİ (Floating Pill) ──────────────────── */}
      {!isLoading && !isMapEmpty && !selectedItem && !isAddingNote && !journey && (
        <View style={[styles.hintPill, { bottom: insets.bottom + 90 }]}>
          <BlurView
            tint={isLight ? "light" : "dark"}
            intensity={85}
            style={StyleSheet.absoluteFill}
          />
          <Heart size={14} color={theme.accent} fill={theme.accent} />
          <Text
            style={[styles.hintPillText, { color: isLight ? "#222" : "#fff" }]}
          >
            {t("map.longPressHint")}
          </Text>
        </View>
      )}

      {/* ─── DETAY KARTI ────────────────────────────────────────────────── */}
      {selectedItem && (
        <MapDetailCard
          item={selectedItem}
          accent={theme.accent}
          bottomInset={insets.bottom}
          currentUserId={userId}
          onClose={() => setSelectedItem(null)}
          onZoomPhoto={setFullScreenPhoto}
          onDeletePhoto={handleDeletePhoto}
          onDeleteNote={handleDeleteNote}
          onOpenMeetings={() => router.push("/(tabs)/meetings")}
        />
      )}

      <MapPhotoLightbox
        photo={fullScreenPhoto}
        accent={theme.accent}
        onClose={() => setFullScreenPhoto(null)}
      />

      <MapAddNoteModal
        visible={isAddingNote}
        accent={theme.accent}
        isSaving={saveNoteMutation.isPending}
        onSave={handleSaveNote}
        onClose={closeAddNote}
      />

      <MapStoryModal
        visible={isStoryVisible}
        onClose={() => setIsStoryVisible(false)}
        pins={storyPins}
        theme={theme}
      />

      <LazyPageTourModal
        visible={isTourVisible}
        guide={guide}
        onClose={closeTour}
      />
      <LazyDemoActionModal
        visible={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        title={modalConfig.title}
        description={modalConfig.description}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0F131D",
  },

  // ─── BOŞ HARİTA KARTI ──────────────────────────────────────────────────
  emptyWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 10,
  },
  emptyCard: {
    alignSelf: "stretch",
    maxWidth: 420,
  },

  // ─── REHBER PILL (HİNT) ────────────────────────────────────────────────
  hintPill: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(216, 88, 112, 0.25)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  hintPillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  // ─── YÜKLENİYOR ────────────────────────────────────────────────────────
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 10, 20, 0.4)",
    zIndex: 15,
  },
});
