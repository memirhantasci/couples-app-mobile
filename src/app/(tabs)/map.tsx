import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Calendar,
  Camera,
  Check,
  ChevronRight,
  Heart,
  Layers,
  MapPin,
  Maximize2,
  Navigation,
  Sparkles,
  StickyNote,
  Trash2,
  X,
  ZoomIn
} from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { dayjs } from "@/lib/date";
import { notifyPartner } from "@/lib/notifications";
import { usePageTour } from "@/hooks/usePageTour";
import { PageTourModal } from "@/components/tour/PageTourModal";
import { TourGuideButton } from "@/components/tour/TourGuideButton";
import { supabase } from "@/lib/supabase";
import { getTheme } from "@/lib/theme";
import { isValidCoordinate } from "@/utils/exifHelper";
import { DEMO_PHOTOS, DEMO_MAP_LOCATIONS, DEMO_HOME_DATA } from "@/constants/demoData";
import { useDemoAction } from "@/hooks/useDemoAction";
import { DemoActionModal } from "@/components/demo/DemoActionModal";

const { width: SW, height: SH } = Dimensions.get("window");

// ─── Veri Tipleri ─────────────────────────────────────────────────────────────

interface PhotoPin {
  id: number;
  image_url: string;
  latitude: number;
  longitude: number;
  location_name?: string | null;
  taken_date: string;
  title?: string | null;
  description?: string | null;
  user_id: string;
}

interface MapNote {
  id: number;
  user_id: string;
  latitude: number;
  longitude: number;
  note: string;
  created_at: string;
}

interface MeetingPin {
  id: number;
  title: string;
  location_name?: string | null;
  latitude: number;
  longitude: number;
  meeting_datetime: string;
  is_active: boolean;
  user_id: string;
}

type MapThemeType = "romantic" | "midnight" | "silver";
type FilterType = "all" | "photos" | "notes" | "meetings";

type SelectedItem =
  | { type: "photo"; data: PhotoPin }
  | { type: "note"; data: MapNote }
  | { type: "meeting"; data: MeetingPin }
  | null;

// ─── HARİTA STİLLERİ (Otoyollar bağırmıyor, romantik, zarif ve aydınlık) ─────

// 1. Romantik & Sıcak Pastel Tema (Varsayılan: Yumuşak krem, nane/gül parklar, sakin su)
const ROMANTIC_CREAM_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#F9F6F0" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4A4356" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#F9F6F0" }, { weight: 2 }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#9E4A68" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#F0E9DF" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#E7EFE6" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#5E8467" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#E8DFD8" }, { weight: 0.8 }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#FCEEE9" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#F2D7CD" }, { weight: 1 }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#8E6058" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#EAE3DC" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#C6DCF2" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4E7294" }] },
];

// 2. Geceyarısı Kadife Tema (Sade, zengin lacivert/antrasit koyu tema)
const MIDNIGHT_VELVET_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0F131D" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0F131D" }, { weight: 2 }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9BA5B9" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#E0A8BA" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#8E99AF" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#161F26" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#618F71" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1C2232" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#131722" }, { weight: 0.8 }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7B879D" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2A3249" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1A1F2E" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#C9D4EC" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#192030" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0A0D15" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3B5270" }] },
];

// 3. Minimalist Gümüş Tema (Temiz, nötr Apple Maps tarzı)
const MINIMAL_SILVER_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#F2F4F7" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5F6368" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#F2F4F7" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#E3ECE2" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#E0E3E8" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#D2E2F0" }] },
];

function PhotoMarkerPin({
  photo,
  onPress,
}: {
  photo: PhotoPin;
  onPress: () => void;
}) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  return (
    <Marker
      coordinate={{ latitude: photo.latitude, longitude: photo.longitude }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={styles.photoMarkerWrapper}>
        <View style={styles.photoPolaroidFrame}>
          <Image
            source={{ uri: photo.image_url }}
            style={styles.photoMarkerImg}
            contentFit="cover"
            cachePolicy="memory-disk"
            onLoadEnd={() => {
              setTimeout(() => setTracksViewChanges(false), 300);
            }}
            transition={0}
          />
          <View style={styles.photoHeartBadge}>
            <Heart size={10} color="#fff" fill="#fff" />
          </View>
        </View>
        <View style={[styles.markerStem, { borderTopColor: "#FFFFFF" }]} />
      </View>
    </Marker>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const { session, profile, isDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const theme = getTheme(profile?.gender);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const mapRef = useRef<MapView | null>(null);
  const userLocRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastMarkerPressRef = useRef<number>(0);

  const coupleId = profile?.coupleId ?? null;
  const userId = session?.user?.id ?? null;
  const isPremium = profile?.isPremium ?? false;
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("map");

  // Harita Tema ve Filtreleme
  const [mapTheme, setMapTheme] = useState<MapThemeType>("romantic");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [showThemePicker, setShowThemePicker] = useState(false);

  // Etkileşim, Detay Kartı ve Modal State'leri
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [pendingCoord, setPendingCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [fullScreenPhoto, setFullScreenPhoto] = useState<PhotoPin | null>(null);

  // ─── 1. Fotoğraf Pinlerini Çek (description dahil) ────────────────────────
  const {
    data: photoPins = [],
    isLoading: loadingPhotos,
    refetch: refetchPhotos,
  } = useQuery({
    queryKey: ["map_photos", coupleId, isDemoMode],
    enabled: (!!coupleId && isPremium) || isDemoMode,
    staleTime: 1000 * 30,
    queryFn: async () => {
      if (isDemoMode) {
        return DEMO_PHOTOS.map((p) => ({
          id: p.id,
          image_url: p.image_url,
          latitude: p.latitude!,
          longitude: p.longitude!,
          location_name: p.city || "Özel Konum",
          taken_date: p.taken_date,
          title: p.title,
          description: p.description,
          user_id: p.user_id,
        })).filter((p) => isValidCoordinate(p.latitude, p.longitude));
      }
      const { data, error } = await supabase
        .from("photo_archive")
        .select("id, image_url, latitude, longitude, location_name, taken_date, title, description, user_id")
        .eq("couple_id", coupleId)
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) throw error;
      return ((data ?? []) as PhotoPin[]).filter((p) => isValidCoordinate(p.latitude, p.longitude));
    },
  });

  // ─── 2. Harita Notlarını Çek ──────────────────────────────────────────────
  const {
    data: mapNotes = [],
    isLoading: loadingNotes,
    refetch: refetchNotes,
  } = useQuery({
    queryKey: ["map_notes", coupleId, isDemoMode],
    enabled: !!coupleId || isDemoMode,
    staleTime: 1000 * 30,
    queryFn: async () => {
      if (isDemoMode) {
        return DEMO_MAP_LOCATIONS.map((loc) => ({
          id: loc.id,
          user_id: "demo",
          latitude: loc.latitude,
          longitude: loc.longitude,
          note: `${loc.title} - ${loc.description}`,
          created_at: loc.date,
        })).filter((n) => isValidCoordinate(n.latitude, n.longitude));
      }
      const { data, error } = await supabase
        .from("map_notes")
        .select("id, user_id, latitude, longitude, note, created_at")
        .eq("couple_id", coupleId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as MapNote[]).filter((n) => isValidCoordinate(n.latitude, n.longitude));
    },
  });

  // ─── 3. Buluşma Noktalarını Çek ───────────────────────────────────────────
  const {
    data: meetingPins = [],
    isLoading: loadingMeetings,
    refetch: refetchMeetings,
  } = useQuery({
    queryKey: ["map_meetings", coupleId, isDemoMode],
    enabled: !!coupleId || isDemoMode,
    staleTime: 1000 * 30,
    queryFn: async () => {
      if (isDemoMode) {
        return DEMO_HOME_DATA.activeMeeting ? [{
          id: DEMO_HOME_DATA.activeMeeting.id,
          title: DEMO_HOME_DATA.activeMeeting.title,
          location_name: DEMO_HOME_DATA.activeMeeting.location_name,
          latitude: DEMO_HOME_DATA.activeMeeting.latitude,
          longitude: DEMO_HOME_DATA.activeMeeting.longitude,
          meeting_datetime: DEMO_HOME_DATA.activeMeeting.meeting_datetime,
          is_active: true,
          user_id: "demo",
        }] : [];
      }
      const { data, error } = await supabase
        .from("meetings")
        .select("id, title, location_name, latitude, longitude, meeting_datetime, is_active, user_id")
        .eq("couple_id", coupleId)
        .eq("is_active", true)
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) throw error;
      return ((data ?? []) as MeetingPin[]).filter((m) => isValidCoordinate(m.latitude, m.longitude));
    },
  });

  // Sayfaya her gelindiğinde güncel verileri otomatik yenile
  useFocusEffect(
    useCallback(() => {
      refetchPhotos();
      refetchNotes();
      refetchMeetings();
    }, [refetchPhotos, refetchNotes, refetchMeetings])
  );

  // ─── Marker Tıklama (Tıklamanın MapView tarafından ezilmesini önler) ─────
  const handleMarkerPress = (item: SelectedItem) => {
    lastMarkerPressRef.current = Date.now();
    setSelectedItem(item);
  };

  // Haritaya tıklama (Marker tıklandıysa kartı kapatma)
  const handleMapPress = () => {
    if (Date.now() - lastMarkerPressRef.current < 450) return;
    setSelectedItem(null);
  };

  // ─── Not Kaydetme ─────────────────────────────────────────────────────────
  const saveNoteMutation = useMutation({
    mutationFn: async ({ lat, lng, note }: { lat: number; lng: number; note: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ["map_notes", coupleId] });
      setIsAddingNote(false);
      setNoteText("");
      setPendingCoord(null);

      if (coupleId && userId) {
        const senderName = profile?.displayName || "Sevgilin";
        const noteStr = (variables as any)?.note || "";
        const notePreview = noteStr.trim() || "";
        const notificationBody = notePreview 
          ? `${senderName} haritaya bir anı notu bıraktı: "${notePreview}"` 
          : `${senderName} haritaya senin için bir aşk notu bıraktı.`;
        notifyPartner(coupleId, userId, "Haritada Yeni Bir Aşk Notu 💌", notificationBody);
      }
    },
    onError: (e: any) => {
      Alert.alert("Hata", "Not kaydedilemedi: " + (e?.message ?? ""));
    },
  });

  // ─── Not Silme ────────────────────────────────────────────────────────────
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      const { error } = await supabase.from("map_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["map_notes", coupleId] });
      setSelectedItem(null);
    },
    onError: (e: any) => {
      Alert.alert("Hata", "Not silinemedi: " + (e?.message ?? ""));
    },
  });

  // ─── Haritada Not Bırakma (Uzun Basış) ────────────────────────────────────
  const handleMapLongPress = (e: any) => {
    if (executeOrIntercept(
      () => {},
      "Haritaya Aşk Notu Bırakmak İçin Kayıt Olun 📍",
      "Partnerinizle gittiğiniz özel konumlara hatıra notları bırakmak için ücretsiz hesabınızı oluşturun."
    )) {
      return;
    }
    const coord = e.nativeEvent?.coordinate;
    if (coord && coord.latitude && coord.longitude) {
      setPendingCoord(coord);
      setNoteText("");
      setSelectedItem(null);
      setIsAddingNote(true);
    }
  };

  // ─── GPS Konumuna Git ─────────────────────────────────────────────────────
  const goToUserLocation = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Konum İzni", "Konumunuza gidebilmek için lütfen konum izni verin.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (loc?.coords) {
        const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        userLocRef.current = coord;
        mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 750);
      }
    } catch {
      // sessizce geç
    } finally {
      setIsLocating(false);
    }
  };

  // ─── Tüm Pinleri Ekrana Sığdır ─────────────────────────────────────────────
  const fitAllPins = () => {
    const coords: { latitude: number; longitude: number }[] = [];
    if (activeFilter === "all" || activeFilter === "photos") {
      photoPins.forEach((p) => {
        if (isValidCoordinate(p.latitude, p.longitude)) {
          coords.push({ latitude: p.latitude, longitude: p.longitude });
        }
      });
    }
    if (activeFilter === "all" || activeFilter === "notes") {
      mapNotes.forEach((n) => {
        if (isValidCoordinate(n.latitude, n.longitude)) {
          coords.push({ latitude: n.latitude, longitude: n.longitude });
        }
      });
    }
    if (activeFilter === "all" || activeFilter === "meetings") {
      meetingPins.forEach((m) => {
        if (isValidCoordinate(m.latitude, m.longitude)) {
          coords.push({ latitude: m.latitude, longitude: m.longitude });
        }
      });
    }

    if (coords.length === 0) {
      goToUserLocation();
      return;
    }

    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 140, right: 60, bottom: 240, left: 60 },
      animated: true,
    });
  };

  // ─── Harici Harita ile Yol Tarifi ─────────────────────────────────────────
  const openDirections = (lat: number, lng: number, label?: string) => {
    const scheme = Platform.select({
      ios: `maps://app?daddr=${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
    });
    const url = scheme || `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    });
  };

  const handleSaveNote = async () => {
    if (!pendingCoord || !noteText.trim()) return;
    setIsSavingNote(true);
    await saveNoteMutation.mutateAsync({
      lat: pendingCoord.latitude,
      lng: pendingCoord.longitude,
      note: noteText,
    });
    setIsSavingNote(false);
  };

  // Buluşma Geri Sayımı Metni
  const getMeetingCountdown = (meetingDateStr: string) => {
    const now = dayjs();
    const target = dayjs(meetingDateStr);
    const diffHours = target.diff(now, "hour");
    const diffDays = target.diff(now, "day");

    if (diffHours < 0) return "Gerçekleşti";
    if (diffDays === 0) return "🎉 Bugün Buluşma Günü!";
    if (diffDays === 1) return "⏳ Yarın!";
    return `⏳ ${diffDays} gün kaldı`;
  };

  // Seçili Tema Stili
  const selectedMapStyle =
    mapTheme === "romantic"
      ? ROMANTIC_CREAM_STYLE
      : mapTheme === "midnight"
        ? MIDNIGHT_VELVET_STYLE
        : MINIMAL_SILVER_STYLE;

  const isLight = mapTheme === "romantic" || mapTheme === "silver";
  const isLoading = loadingPhotos || loadingNotes || loadingMeetings;

  return (
    <View style={styles.root}>
      <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

      {/* ─── HARİTA ─────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        customMapStyle={selectedMapStyle}
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
        {/* ── 1. Fotoğraf Pinleri (Polaroid Çerçeveli) ──────────────────── */}
        {(activeFilter === "all" || activeFilter === "photos") &&
          photoPins.map((photo) => (
            <PhotoMarkerPin
              key={`photo-${photo.id}`}
              photo={photo}
              onPress={() => handleMarkerPress({ type: "photo", data: photo })}
            />
          ))}

        {/* ── 2. Aşk Notu Pinleri (Mühürlü Aşk Zarfı Tasarımı) ─────────── */}
        {(activeFilter === "all" || activeFilter === "notes") &&
          mapNotes.map((note) => (
            <Marker
              key={`note-${note.id}`}
              coordinate={{ latitude: note.latitude, longitude: note.longitude }}
              onPress={(e) => {
                e.stopPropagation?.();
                handleMarkerPress({ type: "note", data: note });
              }}
              tracksViewChanges={false}
            >
              <View style={styles.noteMarkerWrapper}>
                <LinearGradient
                  colors={["#FF4D6D", "#E01E5A"]}
                  style={styles.noteEnvelopePill}
                >
                  <Text style={{ fontSize: 13 }}>💌</Text>
                </LinearGradient>
                <View style={[styles.markerStem, { borderTopColor: "#E01E5A" }]} />
              </View>
            </Marker>
          ))}

        {/* ── 3. Buluşma Pinleri (Zarif Randevu & Takvim Rozeti) ──────────── */}
        {(activeFilter === "all" || activeFilter === "meetings") &&
          meetingPins.map((meeting) => (
            <Marker
              key={`meeting-${meeting.id}`}
              coordinate={{ latitude: meeting.latitude, longitude: meeting.longitude }}
              onPress={(e) => {
                e.stopPropagation?.();
                handleMarkerPress({ type: "meeting", data: meeting });
              }}
              tracksViewChanges={false}
            >
              <View style={styles.meetingMarkerWrapper}>
                <LinearGradient
                  colors={["#8B5CF6", "#6D28D9"]}
                  style={styles.meetingPill}
                >
                  <Calendar size={13} color="#fff" />
                  <Text style={styles.meetingMarkerText} numberOfLines={1}>
                    {meeting.title}
                  </Text>
                </LinearGradient>
                <View style={[styles.markerStem, { borderTopColor: "#6D28D9" }]} />
              </View>
            </Marker>
          ))}

        {/* ── 4. Bekleyen Not Pini ──────────────────────────────────────── */}
        {pendingCoord && isAddingNote && (
          <Marker coordinate={pendingCoord}>
            <View style={styles.pendingMarkerWrapper}>
              <View style={styles.pendingMarkerPulse} />
              <View style={[styles.pendingMarkerCore, { backgroundColor: theme.accent }]}>
                <MapPin size={16} color="#fff" />
              </View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* ─── ÜST KONTROL ÇUBUĞU (Başlık & Filtreler) ──────────────────── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <BlurView tint={isLight ? "light" : "dark"} intensity={80} style={StyleSheet.absoluteFill} />

        <View style={styles.topBarMainRow}>
          <View>
            <Text style={[styles.topBarTitle, { color: isLight ? "#1A1528" : "#FFFFFF" }]}>
              Aşk Haritası
            </Text>
            <Text style={[styles.topBarSub, { color: isLight ? "#6B6577" : "rgba(255,255,255,0.55)" }]}>
              {isPremium ? `${photoPins.length} Anı · ` : ""}{mapNotes.length} Not · {meetingPins.length} Buluşma
            </Text>
          </View>

          {/* Aksiyon Butonları (Rehber, Tema, Sığdır, GPS) */}
          <View style={styles.topActionsGroup}>
            <TourGuideButton onPress={openTour} />
            <TouchableOpacity
              style={[
                styles.topActionBtn,
                {
                  backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)",
                  borderColor: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)",
                },
              ]}
              onPress={() => setShowThemePicker(!showThemePicker)}
              activeOpacity={0.8}
            >
              <Layers size={16} color={theme.accent} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.topActionBtn,
                {
                  backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)",
                  borderColor: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)",
                },
              ]}
              onPress={fitAllPins}
              activeOpacity={0.8}
            >
              <Maximize2 size={16} color={theme.accent} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.topActionBtn,
                {
                  backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)",
                  borderColor: isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)",
                },
              ]}
              onPress={goToUserLocation}
              activeOpacity={0.8}
            >
              {isLocating ? (
                <ActivityIndicator size={16} color={theme.accent} />
              ) : (
                <Navigation size={16} color={theme.accent} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── KATEGORİ FİLTRE ÇİPLERİ ───────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {([
            { id: "all" as const, label: `Tümü (${(isPremium ? photoPins.length : 0) + mapNotes.length + meetingPins.length})`, icon: Sparkles },
            ...(isPremium ? [{ id: "photos" as const, label: `Fotoğraflar (${photoPins.length})`, icon: Camera }] : []),
            { id: "notes" as const, label: `Aşk Notları (${mapNotes.length})`, icon: StickyNote },
            { id: "meetings" as const, label: `Buluşmalar (${meetingPins.length})`, icon: Calendar },
          ]).map((item) => {
            const isSelected = activeFilter === item.id;
            const ItemIcon = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setActiveFilter(item.id)}
                style={[
                  styles.filterChip,
                  isSelected
                    ? { backgroundColor: theme.accent, borderColor: theme.accent }
                    : {
                      backgroundColor: isLight ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.08)",
                      borderColor: isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)",
                    },
                ]}
                activeOpacity={0.8}
              >
                <ItemIcon size={12} color={isSelected ? "#fff" : isLight ? "#555" : "#aaa"} />
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isSelected ? "#fff" : isLight ? "#333" : "rgba(255,255,255,0.75)" },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ─── TEMA SEÇİCİ AÇILIR MENÜ ────────────────────────────────────── */}
        {showThemePicker && (
          <View style={[styles.themePickerMenu, { backgroundColor: isLight ? "#FFFFFF" : "#1A1626" }]}>
            <Text style={[styles.themeMenuHeader, { color: isLight ? "#333" : "#fff" }]}>Harita Teması</Text>
            <View style={styles.themeOptionsRow}>
              {[
                { id: "romantic" as const, label: "🌸 Romantik", desc: "Sıcak & Krem" },
                { id: "midnight" as const, label: "🌙 Gece", desc: "Kadife Koyu" },
                { id: "silver" as const, label: "✨ Sade", desc: "Gümüş Minimal" },
              ].map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.themeOptionBtn,
                    mapTheme === t.id && { borderColor: theme.accent, backgroundColor: `${theme.accent}15` },
                  ]}
                  onPress={() => {
                    setMapTheme(t.id);
                    setShowThemePicker(false);
                  }}
                >
                  <Text style={[styles.themeOptionTitle, mapTheme === t.id && { color: theme.accent }]}>
                    {t.label}
                  </Text>
                  <Text style={styles.themeOptionDesc}>{t.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* ─── YÜKLENİYOR GÖSTERGESİ ─────────────────────────────────────── */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )}

      {/* ─── HIZLI NOT EKLEME REHBERİ (Floating Pill) ──────────────────── */}
      {!isLoading && !selectedItem && !isAddingNote && (
        <View style={[styles.hintPill, { bottom: insets.bottom + 90 }]}>
          <BlurView tint={isLight ? "light" : "dark"} intensity={85} style={StyleSheet.absoluteFill} />
          <Heart size={14} color={theme.accent} fill={theme.accent} />
          <Text style={[styles.hintPillText, { color: isLight ? "#222" : "#fff" }]}>
            Not bırakmak için haritaya uzun basın
          </Text>
        </View>
      )}

      {/* ─── DETAY KARTI (Floating Glass Card with High zIndex) ─────────── */}
      {selectedItem && (
        <View style={[styles.detailCardOverlay, { bottom: insets.bottom + 85 }]}>
          <BlurView tint="dark" intensity={95} style={StyleSheet.absoluteFill} />

          {/* 1. FOTOĞRAF DETAYI */}
          {selectedItem.type === "photo" && (
            <View style={styles.detailCardBody}>
              <View style={styles.detailCardHeader}>
                <View style={styles.detailBadge}>
                  <Camera size={12} color="#fff" />
                  <Text style={styles.detailBadgeText}>Fotoğraf Anısı</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedItem(null)}
                  style={styles.detailCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              <View style={styles.photoPreviewRow}>
                <TouchableOpacity
                  onPress={() => setFullScreenPhoto(selectedItem.data)}
                  activeOpacity={0.85}
                  style={styles.photoThumbContainer}
                >
                  <Image
                    source={{ uri: selectedItem.data.image_url }}
                    style={styles.photoDetailThumb}
                    contentFit="cover"
                  />
                  <View style={styles.zoomIconBadge}>
                    <ZoomIn size={12} color="#fff" />
                  </View>
                </TouchableOpacity>

                <View style={styles.photoDetailInfo}>
                  <Text style={styles.photoDetailTitle} numberOfLines={2}>
                    {selectedItem.data.title || "Fotoğraf Anısı"}
                  </Text>
                  <Text style={styles.photoDetailDate}>
                    📅 {dayjs(selectedItem.data.taken_date).locale("tr").format("D MMMM YYYY")}
                  </Text>
                  {selectedItem.data.location_name ? (
                    <Text style={styles.photoDetailLocation} numberOfLines={1}>
                      📍 {selectedItem.data.location_name}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Fotoğraf Açıklaması */}
              {selectedItem.data.description ? (
                <View style={styles.descriptionBox}>
                  <Text style={styles.descriptionText} numberOfLines={3}>
                    {selectedItem.data.description}
                  </Text>
                </View>
              ) : null}

              <View style={styles.detailActionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.accent }]}
                  onPress={() =>
                    openDirections(
                      selectedItem.data.latitude,
                      selectedItem.data.longitude,
                      selectedItem.data.title || "Anı Konumu"
                    )
                  }
                  activeOpacity={0.85}
                >
                  <Navigation size={14} color="#fff" />
                  <Text style={styles.actionBtnText}>Yol Tarifi Al</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnSecondary}
                  onPress={() => setFullScreenPhoto(selectedItem.data)}
                  activeOpacity={0.85}
                >
                  <ZoomIn size={14} color="#fff" />
                  <Text style={styles.actionBtnSecondaryText}>Büyüt</Text>
                </TouchableOpacity>

                {selectedItem.data.user_id === userId && (
                  <TouchableOpacity
                    style={styles.deleteActionBtn}
                    onPress={() => {
                      Alert.alert("Fotoğrafı Sil", "Bu fotoğrafı haritadan ve galeriden silmek istiyor musunuz?", [
                        { text: "Vazgeç", style: "cancel" },
                        {
                          text: "Sil",
                          style: "destructive",
                          onPress: async () => {
                            await supabase.from("photo_archive").delete().eq("id", selectedItem.data.id);
                            queryClient.invalidateQueries({ queryKey: ["map_photos", coupleId] });
                            queryClient.invalidateQueries({ queryKey: ["photo_archive", coupleId] });
                            setSelectedItem(null);
                          },
                        },
                      ]);
                    }}
                    activeOpacity={0.8}
                  >
                    <Trash2 size={15} color="#FF4D6D" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* 2. AŞK NOTU DETAYI */}
          {selectedItem.type === "note" && (
            <View style={styles.detailCardBody}>
              <View style={styles.detailCardHeader}>
                <View style={[styles.detailBadge, { backgroundColor: "rgba(224, 30, 90, 0.85)" }]}>
                  <StickyNote size={12} color="#fff" />
                  <Text style={styles.detailBadgeText}>Harita Aşk Notu</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedItem(null)}
                  style={styles.detailCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              {/* Not Mesajı Parşömeni */}
              <View style={styles.noteMessageCard}>
                <Text style={styles.quoteMark}>“</Text>
                <Text style={styles.noteMessageText}>{selectedItem.data.note}</Text>
                <Text style={styles.noteDateMeta}>
                  {dayjs(selectedItem.data.created_at).locale("tr").format("D MMMM YYYY, HH:mm")}
                </Text>
              </View>

              <View style={styles.detailActionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.accent }]}
                  onPress={() =>
                    openDirections(
                      selectedItem.data.latitude,
                      selectedItem.data.longitude,
                      "Aşk Notu Konumu"
                    )
                  }
                  activeOpacity={0.85}
                >
                  <Navigation size={14} color="#fff" />
                  <Text style={styles.actionBtnText}>Konuma Yol Tarifi</Text>
                </TouchableOpacity>

                {selectedItem.data.user_id === userId && (
                  <TouchableOpacity
                    style={styles.deleteActionBtn}
                    onPress={() => {
                      Alert.alert("Notu Sil", "Bu notu haritadan silmek istiyor musunuz?", [
                        { text: "Vazgeç", style: "cancel" },
                        {
                          text: "Sil",
                          style: "destructive",
                          onPress: () => deleteNoteMutation.mutate(selectedItem.data.id),
                        },
                      ]);
                    }}
                    activeOpacity={0.8}
                  >
                    <Trash2 size={15} color="#FF4D6D" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* 3. BULUŞMA DETAYI */}
          {selectedItem.type === "meeting" && (
            <View style={styles.detailCardBody}>
              <View style={styles.detailCardHeader}>
                <View style={[styles.detailBadge, { backgroundColor: "rgba(109, 40, 217, 0.85)" }]}>
                  <Calendar size={12} color="#fff" />
                  <Text style={styles.detailBadgeText}>Buluşma Planı</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedItem(null)}
                  style={styles.detailCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>

              <View style={styles.meetingDetailsBox}>
                <View style={styles.meetingTopRow}>
                  <Text style={styles.meetingTitleText}>{selectedItem.data.title}</Text>
                  <View style={styles.meetingCountdownBadge}>
                    <Text style={styles.meetingCountdownText}>
                      {getMeetingCountdown(selectedItem.data.meeting_datetime)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.meetingDatetimeText}>
                  🗓️ {dayjs(selectedItem.data.meeting_datetime).locale("tr").format("D MMMM YYYY, dddd · HH:mm")}
                </Text>
                {selectedItem.data.location_name ? (
                  <Text style={styles.meetingLocationText} numberOfLines={2}>
                    📍 {selectedItem.data.location_name}
                  </Text>
                ) : null}
              </View>

              <View style={styles.detailActionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#8B5CF6" }]}
                  onPress={() =>
                    openDirections(
                      selectedItem.data.latitude,
                      selectedItem.data.longitude,
                      selectedItem.data.title
                    )
                  }
                  activeOpacity={0.85}
                >
                  <Navigation size={14} color="#fff" />
                  <Text style={styles.actionBtnText}>Yol Tarifi Al</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnSecondary}
                  onPress={() => router.push("/(tabs)/meetings")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionBtnSecondaryText}>Buluşmaları Gör</Text>
                  <ChevronRight size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ─── TAM EKRAN FOTOĞRAF LIGHTBOX MODAL ──────────────────────────── */}
      <Modal
        visible={!!fullScreenPhoto}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setFullScreenPhoto(null)}
      >
        {fullScreenPhoto && (
          <View style={styles.lightboxContainer}>
            <BlurView tint="dark" intensity={95} style={StyleSheet.absoluteFill} />

            <View style={[styles.lightboxHeader, { paddingTop: insets.top + 10 }]}>
              <TouchableOpacity
                style={styles.lightboxCloseBtn}
                onPress={() => setFullScreenPhoto(null)}
              >
                <X size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.lightboxTitle} numberOfLines={1}>
                {fullScreenPhoto.title || "Fotoğraf Anısı"}
              </Text>
              <View style={{ width: 40 }} />
            </View>

            <View style={styles.lightboxImageWrapper}>
              <Image
                source={{ uri: fullScreenPhoto.image_url }}
                style={styles.lightboxImage}
                contentFit="contain"
              />
            </View>

            <View style={[styles.lightboxFooter, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={styles.lightboxDate}>
                📅 {dayjs(fullScreenPhoto.taken_date).locale("tr").format("D MMMM YYYY")}
                {fullScreenPhoto.location_name ? ` · 📍 ${fullScreenPhoto.location_name}` : ""}
              </Text>
              {fullScreenPhoto.description ? (
                <Text style={styles.lightboxDesc}>{fullScreenPhoto.description}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.lightboxDirectionsBtn, { backgroundColor: theme.accent }]}
                onPress={() =>
                  openDirections(
                    fullScreenPhoto.latitude,
                    fullScreenPhoto.longitude,
                    fullScreenPhoto.title || "Fotoğraf Konumu"
                  )
                }
              >
                <Navigation size={15} color="#fff" />
                <Text style={styles.lightboxDirectionsText}>Bu Konuma Yol Tarifi Al</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* ─── YENİ NOT EKLEME MODALI (Ezilmeyen, Tam Ekran Kart) ─────────── */}
      <Modal
        visible={isAddingNote}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setIsAddingNote(false);
          setPendingCoord(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setIsAddingNote(false);
              setPendingCoord(null);
            }}
          >
            <BlurView tint="dark" intensity={70} style={StyleSheet.absoluteFill} />
          </TouchableOpacity>

          <View style={[styles.modalNoteCard, { marginBottom: Platform.OS === "ios" ? 40 : 20 }]}>
            <View style={styles.modalNoteHeader}>
              <View style={[styles.modalNoteIconCircle, { backgroundColor: `${theme.accent}20` }]}>
                <StickyNote size={20} color={theme.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalNoteTitle}>Buraya Bir Aşk Notu Bırak 💌</Text>
                <Text style={styles.modalNoteSubtitle}>
                  Sevgilin haritayı açtığında burada senin notunu görecek.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.detailCloseBtn}
                onPress={() => {
                  setIsAddingNote(false);
                  setPendingCoord(null);
                }}
              >
                <X size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalNoteInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Buraya dair özel bir hatıra veya aşk sözü yaz..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
              numberOfLines={4}
              maxLength={300}
              autoFocus
            />

            <View style={styles.charCountRow}>
              <Text style={styles.charCountText}>{noteText.length} / 300</Text>
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setIsAddingNote(false);
                  setPendingCoord(null);
                }}
              >
                <Text style={styles.modalCancelBtnText}>Vazgeç</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSaveBtn,
                  {
                    backgroundColor: noteText.trim() ? theme.accent : "rgba(255,255,255,0.15)",
                    opacity: isSavingNote ? 0.7 : 1,
                  },
                ]}
                onPress={handleSaveNote}
                disabled={!noteText.trim() || isSavingNote}
                activeOpacity={0.85}
              >
                {isSavingNote ? (
                  <ActivityIndicator size={16} color="#fff" />
                ) : (
                  <>
                    <Check size={16} color="#fff" />
                    <Text style={styles.modalSaveBtnText}>Notu Mühürle & Bırak</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <PageTourModal visible={isTourVisible} guide={guide} onClose={closeTour} />
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

  // ─── ÜST KONTROL BARI ───────────────────────────────────────────────────
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
    zIndex: 20,
  },
  topBarMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topBarTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  topBarSub: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  topActionsGroup: {
    flexDirection: "row",
    gap: 8,
  },
  topActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── KATEGORİ FİLTRE ÇİPLERİ ───────────────────────────────────────────
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },

  // ─── TEMA SEÇİCİ MENÜSÜ ────────────────────────────────────────────────
  themePickerMenu: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  themeMenuHeader: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  themeOptionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  themeOptionBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
  },
  themeOptionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#444",
  },
  themeOptionDesc: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#888",
    marginTop: 2,
  },

  // ─── MARKER / PİN TASARIMLARI ──────────────────────────────────────────
  markerStem: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
    alignSelf: "center",
  },

  // 1. Fotoğraf Pin
  photoMarkerWrapper: {
    alignItems: "center",
  },
  photoPolaroidFrame: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    padding: 3,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#FF4D6D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  photoMarkerImg: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  photoHeartBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FF4D6D",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },

  // 2. Aşk Notu Pin
  noteMarkerWrapper: {
    alignItems: "center",
  },
  noteEnvelopePill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#FF1493",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },

  // 3. Buluşma Pin
  meetingMarkerWrapper: {
    alignItems: "center",
  },
  meetingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
    maxWidth: 130,
  },
  meetingMarkerText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },

  // 4. Bekleyen Pin
  pendingMarkerWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
  },
  pendingMarkerPulse: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 77, 109, 0.25)",
  },
  pendingMarkerCore: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
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

  // ─── FLOATING DETAY KARTI ──────────────────────────────────────────────
  detailCardOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 25,
    zIndex: 999,
  },
  detailCardBody: {
    padding: 16,
    gap: 12,
  },
  detailCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(59, 130, 246, 0.85)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  detailBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  detailCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Fotoğraf Detay
  photoPreviewRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  photoThumbContainer: {
    position: "relative",
  },
  photoDetailThumb: {
    width: 72,
    height: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  zoomIconBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.65)",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  photoDetailInfo: {
    flex: 1,
    gap: 3,
  },
  photoDetailTitle: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },
  photoDetailDate: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  photoDetailLocation: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
  },
  descriptionBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  descriptionText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },

  // Aşk Notu Detay
  noteMessageCard: {
    backgroundColor: "rgba(255, 77, 109, 0.1)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 77, 109, 0.25)",
  },
  quoteMark: {
    fontSize: 24,
    color: "#FF4D6D",
    fontFamily: "Inter_700Bold",
    lineHeight: 22,
    marginBottom: -4,
  },
  noteMessageText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 20,
  },
  noteDateMeta: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    textAlign: "right",
  },

  // Buluşma Detay
  meetingDetailsBox: {
    backgroundColor: "rgba(139, 92, 246, 0.1)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.25)",
    gap: 5,
  },
  meetingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  meetingTitleText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  meetingCountdownBadge: {
    backgroundColor: "rgba(139, 92, 246, 0.3)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  meetingCountdownText: {
    color: "#E9D5FF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  meetingDatetimeText: {
    color: "#C4B5FD",
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
  },
  meetingLocationText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },

  // Aksiyon Butonları
  detailActionsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  actionBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  actionBtnSecondaryText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
  deleteActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255, 77, 109, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 77, 109, 0.3)",
  },

  // ─── FULLSCREEN LIGHTBOX ───────────────────────────────────────────────
  lightboxContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "space-between",
  },
  lightboxHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  lightboxCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    flex: 1,
    textAlign: "center",
    paddingHorizontal: 10,
  },
  lightboxImageWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxImage: {
    width: SW,
    height: SH * 0.65,
  },
  lightboxFooter: {
    paddingHorizontal: 20,
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingTop: 16,
  },
  lightboxDate: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
  },
  lightboxDesc: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  lightboxDirectionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 6,
  },
  lightboxDirectionsText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },

  // ─── YENİ NOT EKLEME MODALI ─────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalNoteCard: {
    backgroundColor: "#161224",
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  modalNoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalNoteIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  modalNoteTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  modalNoteSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  modalNoteInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 14,
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    minHeight: 100,
    textAlignVertical: "top",
    lineHeight: 20,
  },
  charCountRow: {
    alignItems: "flex-end",
    marginTop: -6,
  },
  charCountText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  modalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalCancelBtnText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  modalSaveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  modalSaveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
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
