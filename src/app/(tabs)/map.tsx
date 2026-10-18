import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { Heart } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView from "react-native-maps";
import type { LongPressEvent } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DemoActionModal } from "@/components/demo/DemoActionModal";
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
import type {
  FilterType,
  MapCoordinate,
  MapNote,
  MapThemeType,
  PhotoPin,
  SelectedItem,
} from "@/components/map/mapTypes";
import { PageTourModal } from "@/components/tour/PageTourModal";
import { MAP_THEME_STYLES, isLightMapTheme } from "@/constants/mapStyles";
import { useAuth } from "@/context/AuthContext";
import { useDemoAction } from "@/hooks/useDemoAction";
import { useMapData } from "@/hooks/useMapData";
import { usePageTour } from "@/hooks/usePageTour";
import { notifyPartner } from "@/lib/notifications";
import { playStampDrop } from "@/lib/soundEffects";
import { supabase } from "@/lib/supabase";
import { getTheme } from "@/lib/theme";

const DEMO_NOTE_TITLE = "Haritaya Aşk Notu Bırakmak İçin Kayıt Olun 📍";
const DEMO_NOTE_DESC =
  "Partnerinizle gittiğiniz özel konumlara hatıra notları bırakmak için ücretsiz hesabınızı oluşturun.";

export default function MapScreen() {
  const router = useRouter();
  const { session, profile, isDemoMode } = useAuth();
  const {
    executeOrIntercept,
    isDemoModalOpen,
    setIsDemoModalOpen,
    modalConfig,
  } = useDemoAction();
  const theme = getTheme(profile?.gender);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const mapRef = useRef<MapView | null>(null);
  const lastMarkerPressRef = useRef<number>(0);

  const coupleId = profile?.coupleId ?? null;
  const userId = session?.user?.id ?? null;
  const isPremium = profile?.isPremium ?? false;
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("map");

  const { photoPins, mapNotes, meetingPins, storyPins, isLoading } = useMapData({
    coupleId,
    isPremium,
    isDemoMode,
  });

  // Harita Tema ve Filtreleme
  const [mapTheme, setMapTheme] = useState<MapThemeType>("romantic");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  // Etkileşim, Detay Kartı ve Modal State'leri
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  // Doluysa "not ekle" modalı açıktır ve bu konumda bekleyen pin gösterilir.
  const [pendingCoord, setPendingCoord] = useState<MapCoordinate | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [fullScreenPhoto, setFullScreenPhoto] = useState<PhotoPin | null>(null);
  const [isStoryVisible, setIsStoryVisible] = useState(false);

  // ─── Marker Tıklama (Tıklamanın MapView tarafından ezilmesini önler) ─────
  const handleMarkerPress = useCallback((item: SelectedItem) => {
    lastMarkerPressRef.current = Date.now();
    setSelectedItem(item);
  }, []);

  // Haritaya tıklama (Marker tıklandıysa kartı kapatma)
  const handleMapPress = () => {
    if (Date.now() - lastMarkerPressRef.current < 450) return;
    setSelectedItem(null);
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

      if (coupleId && userId) {
        const senderName = profile?.displayName || "Sevgilin";
        const notePreview = variables.note.trim();
        const notificationBody = notePreview
          ? `${senderName} haritaya bir anı notu bıraktı: "${notePreview}"`
          : `${senderName} haritaya senin için bir aşk notu bıraktı.`;
        notifyPartner(
          coupleId,
          userId,
          "Haritada Yeni Bir Aşk Notu 💌",
          notificationBody,
          {
            type: "map",
            route: "/(tabs)/map",
            actionLabel: "Haritada Keşfet 🗺️",
          },
        );
      }
    },
    onError: (e: Error) => {
      Alert.alert("Hata", "Not kaydedilemedi: " + (e?.message ?? ""));
    },
  });

  // ─── Not Silme ────────────────────────────────────────────────────────────
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      const { error } = await supabase
        .from("map_notes")
        .delete()
        .eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["map_notes", coupleId] });
      setSelectedItem(null);
    },
    onError: (e: Error) => {
      Alert.alert("Hata", "Not silinemedi: " + (e?.message ?? ""));
    },
  });

  // ─── Haritada Not Bırakma (Uzun Basış) ────────────────────────────────────
  const handleMapLongPress = (e: LongPressEvent) => {
    if (executeOrIntercept(() => {}, DEMO_NOTE_TITLE, DEMO_NOTE_DESC)) return;

    const coord = e.nativeEvent?.coordinate;
    if (coord && coord.latitude && coord.longitude) {
      setSelectedItem(null);
      setPendingCoord({ latitude: coord.latitude, longitude: coord.longitude });
    }
  };

  const closeAddNote = useCallback(() => setPendingCoord(null), []);

  const handleSaveNote = (text: string) => {
    if (executeOrIntercept(() => {}, DEMO_NOTE_TITLE, DEMO_NOTE_DESC)) {
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
        "Fotoğrafı Silmek İçin Kayıt Olun 🗑️",
        "Haritadaki fotoğrafları yönetmek ve silmek için ücretsiz hesabınızı oluşturun.",
      )
    ) {
      return;
    }
    Alert.alert(
      "Fotoğrafı Sil",
      "Bu fotoğrafı haritadan ve galeriden silmek istiyor musunuz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            await supabase.from("photo_archive").delete().eq("id", photo.id);
            queryClient.invalidateQueries({ queryKey: ["map_photos", coupleId] });
            queryClient.invalidateQueries({ queryKey: ["photo_archive", coupleId] });
            setSelectedItem(null);
          },
        },
      ],
    );
  };

  const handleDeleteNote = (note: MapNote) => {
    if (
      executeOrIntercept(
        () => {},
        "Notu Silmek İçin Kayıt Olun 🗑️",
        "Haritadaki aşk notlarını yönetmek ve silmek için ücretsiz hesabınızı oluşturun.",
      )
    ) {
      return;
    }
    Alert.alert("Notu Sil", "Bu notu haritadan silmek istiyor musunuz?", [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: () => deleteNoteMutation.mutate(note.id),
      },
    ]);
  };

  // ─── GPS Konumuna Git ─────────────────────────────────────────────────────
  const goToUserLocation = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Konum İzni",
          "Konumunuza gidebilmek için lütfen konum izni verin.",
        );
        return;
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
      }
    } catch {
      // sessizce geç
    } finally {
      setIsLocating(false);
    }
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

  const isLight = isLightMapTheme(mapTheme);
  const isAddingNote = pendingCoord !== null;

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

      {/* ─── HARİTA ─────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        customMapStyle={MAP_THEME_STYLES[mapTheme]}
        initialRegion={{
          latitude: 41.0082,
          longitude: 28.9784,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
        onLongPress={handleMapLongPress}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {(activeFilter === "all" || activeFilter === "photos") &&
          photoPins.map((photo) => (
            <PhotoMarkerPin
              key={`photo-${photo.id}`}
              photo={photo}
              onSelect={handleMarkerPress}
            />
          ))}

        {(activeFilter === "all" || activeFilter === "notes") &&
          mapNotes.map((note) => (
            <NoteMarkerPin
              key={`note-${note.id}`}
              note={note}
              onSelect={handleMarkerPress}
            />
          ))}

        {(activeFilter === "all" || activeFilter === "meetings") &&
          meetingPins.map((meeting) => (
            <MeetingMarkerPin
              key={`meeting-${meeting.id}`}
              meeting={meeting}
              onSelect={handleMarkerPress}
            />
          ))}

        {pendingCoord && (
          <PendingNoteMarker coordinate={pendingCoord} accent={theme.accent} />
        )}
      </MapView>

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
        onMapThemeChange={setMapTheme}
        isLocating={isLocating}
        onOpenTour={openTour}
        onOpenStory={() => setIsStoryVisible(true)}
        onFitAll={fitAllPins}
        onLocate={goToUserLocation}
      />

      {/* ─── YÜKLENİYOR GÖSTERGESİ ─────────────────────────────────────── */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )}

      {/* ─── HIZLI NOT EKLEME REHBERİ (Floating Pill) ──────────────────── */}
      {!isLoading && !selectedItem && !isAddingNote && (
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
            Not bırakmak için haritaya uzun basın
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

      <PageTourModal
        visible={isTourVisible}
        guide={guide}
        onClose={closeTour}
      />
      <DemoActionModal
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
    backgroundColor: "#F7F4EF",
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
    borderColor: "rgba(255, 77, 109, 0.25)",
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
