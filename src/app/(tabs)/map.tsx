import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import MapView, { Marker, Callout, Region } from "react-native-maps";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Camera,
  StickyNote,
  X,
  Trash2,
  Check,
  LocateFixed,
  Navigation,
  ChevronDown,
  Image as ImageIcon,
  MessageSquare,
} from "lucide-react-native";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { getTheme } from "@/lib/theme";
import { dayjs } from "@/lib/date";

const { width: SW, height: SH } = Dimensions.get("window");

interface PhotoPin {
  id: number;
  image_url: string;
  latitude: number;
  longitude: number;
  location_name?: string | null;
  taken_date: string;
  title?: string | null;
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

type BottomSheetMode =
  | "hidden"
  | "add_note"
  | "photo_detail"
  | "note_detail";

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#16131f" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#16131f" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#958fa3" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d6aebc" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d19a9a" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1c2528" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#729b7d" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#262133" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1b1726" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8d889b" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#422e54" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1b1424" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3c7a6" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#272138" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d19a9a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e0b17" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4d586e" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#0e0b17" }] },
];

export default function MapScreen() {
  const { session, profile } = useAuth();
  const theme = getTheme(profile?.gender);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const mapRef = useRef<MapView | null>(null);
  const userLocRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const coupleId = profile?.coupleId ?? null;
  const userId = session?.user?.id ?? null;

  const [isLocating, setIsLocating] = useState(false);
  const [sheetMode, setSheetMode] = useState<BottomSheetMode>("hidden");
  const [pendingCoord, setPendingCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoPin | null>(null);
  const [selectedNote, setSelectedNote] = useState<MapNote | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  // ─── Fotoğraf pinlerini çek ──────────────────────────────────────────────
  const { data: photoPins = [], isLoading: loadingPhotos } = useQuery({
    queryKey: ["map_photos", coupleId],
    enabled: !!coupleId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("photo_archive")
        .select("id, image_url, latitude, longitude, location_name, taken_date, title, user_id")
        .eq("couple_id", coupleId)
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (error) throw error;
      return (data ?? []) as PhotoPin[];
    },
  });

  // ─── Harita notlarını çek ─────────────────────────────────────────────────
  const { data: mapNotes = [], isLoading: loadingNotes } = useQuery({
    queryKey: ["map_notes", coupleId],
    enabled: !!coupleId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("map_notes")
        .select("id, user_id, latitude, longitude, note, created_at")
        .eq("couple_id", coupleId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MapNote[];
    },
  });

  // ─── Not Kaydet ───────────────────────────────────────────────────────────
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["map_notes", coupleId] });
      setSheetMode("hidden");
      setNoteText("");
      setPendingCoord(null);
    },
    onError: (e: any) => {
      Alert.alert("Hata", "Not kaydedilemedi: " + (e?.message ?? ""));
    },
  });

  // ─── Not Sil ─────────────────────────────────────────────────────────────
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      const { error } = await supabase.from("map_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["map_notes", coupleId] });
      setSheetMode("hidden");
      setSelectedNote(null);
    },
    onError: (e: any) => {
      Alert.alert("Hata", "Not silinemedi: " + (e?.message ?? ""));
    },
  });

  // ─── Harita uzun basış → Not ekle ────────────────────────────────────────
  const handleMapLongPress = (e: any) => {
    const coord = e.nativeEvent.coordinate;
    setPendingCoord(coord);
    setNoteText("");
    setSheetMode("add_note");
  };

  // ─── GPS ──────────────────────────────────────────────────────────────────
  const goToUserLocation = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Konum İzni", "Konumunuza gitmek için lütfen konum iznini verin.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (loc?.coords) {
        const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        userLocRef.current = coord;
        mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 800);
      }
    } catch {
      // sessizce geç
    } finally {
      setIsLocating(false);
    }
  };

  const closeSheet = () => {
    setSheetMode("hidden");
    setPendingCoord(null);
    setNoteText("");
    setSelectedPhoto(null);
    setSelectedNote(null);
  };

  const handleSaveNote = async () => {
    if (!pendingCoord || !noteText.trim()) return;
    setIsSavingNote(true);
    await saveNoteMutation.mutateAsync({ lat: pendingCoord.latitude, lng: pendingCoord.longitude, note: noteText });
    setIsSavingNote(false);
  };

  const handleDeleteNote = (note: MapNote) => {
    Alert.alert(
      "Notu Sil",
      "Bu notu silmek istediğinize emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => deleteNoteMutation.mutate(note.id),
        },
      ]
    );
  };

  const isLoading = loadingPhotos || loadingNotes;

  return (
    <View style={styles.root}>
      {/* ─── Harita ─────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        customMapStyle={DARK_MAP_STYLE}
        initialRegion={{
          latitude: 39.0,
          longitude: 35.0,
          latitudeDelta: 20,
          longitudeDelta: 20,
        }}
        onLongPress={handleMapLongPress}
        onPress={() => {
          if (sheetMode !== "add_note") closeSheet();
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* ─── Fotoğraf Pinleri ─────────────────────────────────────── */}
        {photoPins.map((photo) => (
          <Marker
            key={`photo-${photo.id}`}
            coordinate={{ latitude: photo.latitude, longitude: photo.longitude }}
            onPress={() => {
              setSelectedPhoto(photo);
              setSelectedNote(null);
              setSheetMode("photo_detail");
            }}
          >
            <View style={styles.photoPin}>
              <Image
                source={{ uri: photo.image_url }}
                style={styles.photoPinImage}
                contentFit="cover"
              />
              <View style={[styles.photoPinTail, { borderTopColor: theme.accent }]} />
            </View>
          </Marker>
        ))}

        {/* ─── Not Pinleri ──────────────────────────────────────────── */}
        {mapNotes.map((note) => (
          <Marker
            key={`note-${note.id}`}
            coordinate={{ latitude: note.latitude, longitude: note.longitude }}
            onPress={() => {
              setSelectedNote(note);
              setSelectedPhoto(null);
              setSheetMode("note_detail");
            }}
          >
            <View style={[styles.notePin, { backgroundColor: theme.accent }]}>
              <StickyNote size={14} color="#fff" />
            </View>
          </Marker>
        ))}

        {/* ─── Bekleyen Koordinat Pini ──────────────────────────────── */}
        {pendingCoord && sheetMode === "add_note" && (
          <Marker coordinate={pendingCoord}>
            <View style={[styles.pendingPin, { backgroundColor: "#3b82f6" }]}>
              <MapPin size={14} color="#fff" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* ─── Üst Başlık ─────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <BlurView tint="dark" intensity={70} style={StyleSheet.absoluteFill} />
        <View style={styles.topBarContent}>
          <View>
            <Text style={styles.topBarTitle}>Harita</Text>
            <Text style={styles.topBarSub}>
              {photoPins.length} fotoğraf · {mapNotes.length} not
            </Text>
          </View>

          <View style={styles.topBarActions}>
            {/* GPS Butonu */}
            <TouchableOpacity
              style={[styles.mapBtn, { borderColor: "rgba(255,255,255,0.15)" }]}
              onPress={goToUserLocation}
              activeOpacity={0.8}
            >
              {isLocating ? (
                <ActivityIndicator size={16} color={theme.accent} />
              ) : (
                <Navigation size={17} color={theme.accent} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ─── Yükleniyor ─────────────────────────────────────────────────── */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )}

      {/* ─── Not Ekle Hint Banner ────────────────────────────────────────── */}
      {!isLoading && sheetMode === "hidden" && (
        <View style={[styles.hintBanner, { bottom: insets.bottom + 90 }]}>
          <BlurView tint="dark" intensity={80} style={StyleSheet.absoluteFill} />
          <MessageSquare size={14} color="rgba(255,255,255,0.55)" />
          <Text style={styles.hintText}>Not eklemek için haritaya uzun basın</Text>
        </View>
      )}

      {/* ─── Bottom Sheet ───────────────────────────────────────────────── */}
      {sheetMode !== "hidden" && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.sheetOverlay, { paddingBottom: insets.bottom }]}
        >
          <BlurView tint="dark" intensity={85} style={StyleSheet.absoluteFill} />

          {/* ── Not Ekleme ──────────────────────────────────────────────── */}
          {sheetMode === "add_note" && (
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View style={styles.sheetIconBadge}>
                  <StickyNote size={16} color={theme.accent} />
                </View>
                <Text style={styles.sheetTitle}>Buraya Not Bırak</Text>
                <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeSheet}>
                  <X size={18} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.noteInput, { borderColor: theme.cardBorder }]}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Bu yere dair bir şey yaz..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                numberOfLines={3}
                autoFocus
              />
              <TouchableOpacity
                style={[
                  styles.sheetSaveBtn,
                  {
                    backgroundColor: noteText.trim() ? theme.accent : "rgba(255,255,255,0.08)",
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
                    <Text style={styles.sheetSaveBtnText}>Notu Kaydet</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Fotoğraf Detay ──────────────────────────────────────────── */}
          {sheetMode === "photo_detail" && selectedPhoto && (
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetIconBadge, { backgroundColor: "rgba(59,130,246,0.2)" }]}>
                  <ImageIcon size={16} color="#60a5fa" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {selectedPhoto.title ?? "Fotoğraf Anısı"}
                  </Text>
                  <Text style={styles.sheetSubtitle}>
                    {dayjs(selectedPhoto.taken_date).locale("tr").format("D MMMM YYYY")}
                    {selectedPhoto.location_name ? ` · ${selectedPhoto.location_name}` : ""}
                  </Text>
                </View>
                <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeSheet}>
                  <X size={18} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>

              <Image
                source={{ uri: selectedPhoto.image_url }}
                style={styles.photoDetailImg}
                contentFit="cover"
              />

              {/* Silme - sadece kendi fotoğrafı */}
              {selectedPhoto.user_id === userId && (
                <TouchableOpacity
                  style={styles.deletePhotoBtn}
                  onPress={() => {
                    Alert.alert(
                      "Fotoğrafı Sil",
                      "Bu fotoğrafı galeriden kalıcı olarak silmek istediğinize emin misiniz?",
                      [
                        { text: "Vazgeç", style: "cancel" },
                        {
                          text: "Sil",
                          style: "destructive",
                          onPress: async () => {
                            const { error } = await supabase
                              .from("photo_archive")
                              .delete()
                              .eq("id", selectedPhoto.id);
                            if (!error) {
                              queryClient.invalidateQueries({ queryKey: ["map_photos", coupleId] });
                              queryClient.invalidateQueries({ queryKey: ["photo_archive", coupleId] });
                              closeSheet();
                            } else {
                              Alert.alert("Hata", "Fotoğraf silinemedi.");
                            }
                          },
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <Trash2 size={14} color="#ff5c77" />
                  <Text style={styles.deletePhotoBtnText}>Fotoğrafı Sil</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Not Detay ───────────────────────────────────────────────── */}
          {sheetMode === "note_detail" && selectedNote && (
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View style={[styles.sheetIconBadge, { backgroundColor: "rgba(245,158,11,0.2)" }]}>
                  <StickyNote size={16} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetTitle}>Harita Notu</Text>
                  <Text style={styles.sheetSubtitle}>
                    {dayjs(selectedNote.created_at).locale("tr").format("D MMMM YYYY, HH:mm")}
                  </Text>
                </View>
                <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeSheet}>
                  <X size={18} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </View>

              <View style={styles.noteDetailCard}>
                <Text style={styles.noteDetailText}>{selectedNote.note}</Text>
              </View>

              {/* Silme - sadece kendi notu */}
              {selectedNote.user_id === userId && (
                <TouchableOpacity
                  style={styles.deletePhotoBtn}
                  onPress={() => handleDeleteNote(selectedNote)}
                  activeOpacity={0.8}
                >
                  <Trash2 size={14} color="#ff5c77" />
                  <Text style={styles.deletePhotoBtnText}>Notu Sil</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0e0b17",
  },
  // ─── Üst Bar ──────────────────────────────────────────────────────────────
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  topBarTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  topBarSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
    marginTop: 2,
  },
  topBarActions: {
    flexDirection: "row",
    gap: 8,
  },
  mapBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // ─── Yüklenme Overlay ─────────────────────────────────────────────────────
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14,11,23,0.65)",
  },
  // ─── Hint Banner ──────────────────────────────────────────────────────────
  hintBanner: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  hintText: {
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
  },
  // ─── Fotoğraf Pin ─────────────────────────────────────────────────────────
  photoPin: {
    alignItems: "center",
  },
  photoPinImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: "#ffffff",
  },
  photoPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
  // ─── Not Pin ──────────────────────────────────────────────────────────────
  notePin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  // ─── Bekleyen Pin ─────────────────────────────────────────────────────────
  pendingPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  // ─── Bottom Sheet ─────────────────────────────────────────────────────────
  sheetOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  sheet: {
    padding: 20,
    gap: 14,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,77,109,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
    marginTop: 1,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  noteInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 90,
    textAlignVertical: "top",
    lineHeight: 20,
  },
  sheetSaveBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sheetSaveBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#ffffff",
  },
  photoDetailImg: {
    width: "100%",
    aspectRatio: 1.6,
    borderRadius: 16,
  },
  deletePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,92,119,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,92,119,0.25)",
  },
  deletePhotoBtnText: {
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
    color: "#ff5c77",
  },
  noteDetailCard: {
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
    borderRadius: 14,
    padding: 14,
  },
  noteDetailText: {
    fontSize: 14.5,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.9)",
    lineHeight: 22,
  },
});
