import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
  StatusBar,
  TextInput,
} from "react-native";
import { appAlert } from "@/lib/dialog";
import { showPermissionDeniedDialog } from "@/lib/permissions";
import { DialogHost } from "@/components/ui/DialogHost";
import MapView, { Marker, Region, UserLocationChangeEvent } from "react-native-maps";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRealTopInset } from "@/hooks/useRealTopInset";
import {
  X,
  MapPin,
  Check,
  Navigation,
  Sparkles,
  Layers,
  Heart,
  Maximize2,
  Search,
} from "lucide-react-native";
import * as Location from "expo-location";
import { useTheme } from "@/context/ThemeContext";
import { isValidCoordinate, geocodeAddressString, formatGeocodedAddress } from "@/utils/exifHelper";

const { width: SW, height: SH } = Dimensions.get("window");

export interface LocationData {
  latitude: number;
  longitude: number;
  locationName?: string;
}

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (location: LocationData) => void;
  initialLocation?: LocationData;
  title?: string;
}

type MapThemeType = "romantic" | "midnight" | "silver";

// ─── HARİTA STİLLERİ (Aşk Haritası ile Birebir Aynı) ───────────────────────────

// 1. Romantik & Sıcak Pastel Tema (Varsayılan Açık Mod: Yumuşak krem, sakin yollar)
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

// 2. Geceyarısı Kadife Tema (Siyah/Koyu Modlar: Zengin lacivert & antrasit)
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

// 3. Minimalist Gümüş Tema
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

export function MapPickerModal({
  visible,
  onClose,
  onSelectLocation,
  initialLocation,
  title = "Konum Seçin",
}: MapPickerModalProps) {
  const insets = useSafeAreaInsets();
  const topInset = useRealTopInset();
  const { theme, isLight: isAppLight } = useTheme();

  const mapRef = useRef<MapView | null>(null);
  const userLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // Tema: Beyaz modda "romantic", koyu/renkli modlarda "midnight"
  const [mapTheme, setMapTheme] = useState<MapThemeType>(() => (isAppLight ? "romantic" : "midnight"));
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  // Uygulama teması değişince harita teması varsayılanına döner
  const [themeFor, setThemeFor] = useState(isAppLight);
  if (themeFor !== isAppLight) {
    setThemeFor(isAppLight);
    setMapTheme(isAppLight ? "romantic" : "midnight");
  }

  // Varsayılan Konum (İstanbul)
  const defaultRegion: Region = {
    latitude: 41.0082,
    longitude: 28.9784,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };

  const [selectedCoord, setSelectedCoord] = useState<{ latitude: number; longitude: number } | null>(
    initialLocation && isValidCoordinate(initialLocation.latitude, initialLocation.longitude)
      ? { latitude: initialLocation.latitude, longitude: initialLocation.longitude }
      : null
  );

  const [resolvedAddress, setResolvedAddress] = useState<string>(
    initialLocation && isValidCoordinate(initialLocation.latitude, initialLocation.longitude)
      ? (initialLocation.locationName || "")
      : ""
  );
  const [isLocating, setIsLocating] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Adres Çözümleme (Reverse Geocode)
  const fetchAddress = async (lat: number, lng: number) => {
    try {
      setIsResolvingAddress(true);
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results && results.length > 0) {
        const fullAddr = formatGeocodedAddress(results[0]);
        setResolvedAddress(fullAddr || "Seçilen Konum");
      } else {
        setResolvedAddress("Seçilen Konum");
      }
    } catch {
      setResolvedAddress("Seçilen Konum");
    } finally {
      setIsResolvingAddress(false);
    }
  };

  // Adres Arama (Forward Geocode - İl, ilçe, mahalle, sokak, mekan adı)
  const handleSearchAddress = async () => {
    const query = searchQuery.trim();
    if (!query) return;
    setIsSearching(true);
    try {
      const res = await geocodeAddressString(query);
      if (res && isValidCoordinate(res.latitude, res.longitude)) {
        await handleSelectCoordinate({ latitude: res.latitude, longitude: res.longitude });
        setResolvedAddress(res.locationName);
      } else {
        appAlert(
          "Adres Bulunamadı",
          "Girdiğiniz il, ilçe, mahalle veya sokak bulunamadı. Lütfen yazımı kontrol edin veya harita üzerinden bir noktaya dokunun."
        );
      }
    } catch {
      appAlert("Hata", "Adres aranırken bir hata oluştu.");
    } finally {
      setIsSearching(false);
    }
  };

  // Yeni Konum Belirleme
  const handleSelectCoordinate = async (coord: { latitude: number; longitude: number }) => {
    if (!isValidCoordinate(coord.latitude, coord.longitude)) return;
    setSelectedCoord(coord);
    mapRef.current?.animateToRegion(
      {
        ...coord,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      },
      400
    );
    await fetchAddress(coord.latitude, coord.longitude);
  };

  // GPS konumunu bulup haritayı oraya götürür (yükleniyor bayrağını çağıran yönetir)
  const locateUser = async (silent: boolean) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (!silent) {
          showPermissionDeniedDialog("Konum İzni Gerekli", "Mevcut konumunuzu görebilmek için ayarlardan konum erişimine izin vermelisiniz.");
        }
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (loc?.coords) {
        const coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        userLocationRef.current = coord;
        mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 600);

        if (!selectedCoord) {
          await handleSelectCoordinate(coord);
        }
      }
    } catch {
      try {
        const last = await Location.getLastKnownPositionAsync({});
        if (last?.coords) {
          const coord = { latitude: last.coords.latitude, longitude: last.coords.longitude };
          userLocationRef.current = coord;
          mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 600);
        }
      } catch {
        // sessizce geç
      }
    }
  };

  // GPS Konumuna Git
  const moveToUserLocation = (silent = false) => {
    setIsLocating(true);
    return locateUser(silent).finally(() => setIsLocating(false));
  };

  // Modal Açıldığında: seçim başlangıç konumuna sıfırlanır (render sırasında), harita oraya
  // ya da başlangıç konumu yoksa GPS konumuna gider (effect). Anahtar değere göredir: üst bileşen
  // her çizimde yeni bir konum nesnesi verse de seçim boşuna sıfırlanmaz.
  const hasInitialLocation =
    !!initialLocation && isValidCoordinate(initialLocation.latitude, initialLocation.longitude);
  const openKey = visible
    ? hasInitialLocation
      ? `${initialLocation!.latitude},${initialLocation!.longitude},${initialLocation!.locationName ?? ""}`
      : "gps"
    : "closed";
  const [appliedOpenKey, setAppliedOpenKey] = useState<string | null>(null);
  if (appliedOpenKey !== openKey) {
    setAppliedOpenKey(openKey);
    if (visible) {
      setIsMapReady(false);
      if (hasInitialLocation) {
        setSelectedCoord({ latitude: initialLocation!.latitude, longitude: initialLocation!.longitude });
        setResolvedAddress(initialLocation!.locationName || "");
      } else {
        // Geçersiz veya 0,0 konum durumunda ASLA okyanusa gitme, kullanıcının GPS konumuna git
        setSelectedCoord(null);
        setResolvedAddress("");
        setIsLocating(true);
      }
    }
  }

  useEffect(() => {
    if (!visible) return;
    if (hasInitialLocation) {
      const target = { latitude: initialLocation!.latitude, longitude: initialLocation!.longitude };
      const timer = setTimeout(() => {
        mapRef.current?.animateToRegion({ ...target, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 500);
      }, 300);
      return () => clearTimeout(timer);
    }
    void locateUser(true).finally(() => setIsLocating(false));
    // Yalnızca açılış anahtarı değiştiğinde çalışır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey]);

  // Haritaya Tıklama
  const handleMapPress = async (e: any) => {
    setShowThemePicker(false);
    const coord = e.nativeEvent?.coordinate;
    if (coord && coord.latitude && coord.longitude) {
      await handleSelectCoordinate(coord);
    }
  };

  // Onaylama
  const handleConfirm = () => {
    if (selectedCoord && isValidCoordinate(selectedCoord.latitude, selectedCoord.longitude)) {
      onSelectLocation({
        latitude: selectedCoord.latitude,
        longitude: selectedCoord.longitude,
        locationName: resolvedAddress.trim() || undefined,
      });
      onClose();
    } else {
      appAlert("Konum Belirlenmedi", "Lütfen harita üzerinden bir noktaya dokunarak konum seçin.");
    }
  };

  // Seçili Tema Stili
  const selectedMapStyle =
    mapTheme === "romantic"
      ? ROMANTIC_CREAM_STYLE
      : mapTheme === "midnight"
      ? MIDNIGHT_VELVET_STYLE
      : MINIMAL_SILVER_STYLE;

  const isLight = mapTheme === "romantic" || mapTheme === "silver";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: isLight ? "#F7F4EF" : "#0F131D" }]}>
        <StatusBar barStyle={isLight ? "dark-content" : "light-content"} />

        {/* ─── HARİTA (Aşk Haritası ile Birebir Aynı, Parlamasız) ─────────── */}
        <MapView
          ref={mapRef}
          style={[StyleSheet.absoluteFill, { opacity: isMapReady ? 1 : 0 }]}
          customMapStyle={selectedMapStyle}
          onMapReady={() => setIsMapReady(true)}
          initialRegion={
            initialLocation && isValidCoordinate(initialLocation.latitude, initialLocation.longitude)
              ? {
                  latitude: initialLocation.latitude,
                  longitude: initialLocation.longitude,
                  latitudeDelta: 0.015,
                  longitudeDelta: 0.015,
                }
              : defaultRegion
          }
          onPress={handleMapPress}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          onUserLocationChange={(event: UserLocationChangeEvent) => {
            const c = event.nativeEvent?.coordinate;
            if (c && c.latitude && c.longitude) {
              userLocationRef.current = {
                latitude: c.latitude,
                longitude: c.longitude,
              };
            }
          }}
        >
          {/* SADECE SEÇİLEN KONUM PİNİ (Fotoğraflar ve notlar yok, temiz arayüz) */}
          {selectedCoord && (
            <Marker coordinate={selectedCoord} anchor={{ x: 0.5, y: 1 }}>
              <View style={styles.selectedMarkerWrapper}>
                <View style={[styles.markerAura, { backgroundColor: `${theme.accent}30` }]} />
                <LinearGradient
                  colors={[theme.accent, theme.accentLight || "#FF758F"]}
                  style={styles.selectedMarkerCore}
                >
                  <MapPin size={18} color="#FFFFFF" />
                </LinearGradient>
                <View style={[styles.markerStem, { borderTopColor: theme.accent }]} />
              </View>
            </Marker>
          )}
        </MapView>

        {/* ─── ÜST KONTROL ÇUBUĞU (Aşk Haritası ile Birebir Aynı Tasarım) ──── */}
        <View
          style={[
            styles.topBar,
            {
              paddingTop: topInset + 8,
              backgroundColor: isLight ? "rgba(255,255,255,0.80)" : "rgba(15,19,29,0.74)",
              borderBottomColor: isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.12)",
            },
          ]}
        >
          <BlurView tint={isLight ? "light" : "dark"} intensity={80} style={StyleSheet.absoluteFill} />

          <View style={styles.topBarMainRow}>
            {/* Kapat Butonu */}
            <TouchableOpacity
              style={[
                styles.topActionBtn,
                {
                  backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)",
                  borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.15)",
                },
              ]}
              onPress={onClose}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={isLight ? "#1A1528" : "#FFFFFF"} />
            </TouchableOpacity>

            {/* Başlık & Alt Başlık */}
            <View style={styles.topTitleBox}>
              <Text style={[styles.topBarTitle, { color: isLight ? "#1A1528" : "#FFFFFF" }]}>
                {title}
              </Text>
              <Text style={[styles.topBarSub, { color: isLight ? "#6B6577" : "rgba(255,255,255,0.6)" }]}>
                {isResolvingAddress
                  ? "Adres çözümleniyor..."
                  : selectedCoord
                  ? "Noktayı değiştirmek için dokunun"
                  : "Haritadan bir nokta seçin"}
              </Text>
            </View>

            {/* Sağ Aksiyon Butonları (Tema & GPS) */}
            <View style={styles.topActionsGroup}>
              <TouchableOpacity
                style={[
                  styles.topActionBtn,
                  {
                    backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)",
                    borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.15)",
                  },
                ]}
                onPress={() => setShowThemePicker(!showThemePicker)}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Layers size={16} color={theme.accent} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.topActionBtn,
                  {
                    backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.1)",
                    borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.15)",
                  },
                ]}
                onPress={() => moveToUserLocation(false)}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {isLocating ? (
                  <ActivityIndicator size={16} color={theme.accent} />
                ) : (
                  <Navigation size={16} color={theme.accent} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ─── ADRES / SEMT / MAHALLE / SOKAK ARAMA ÇUBUĞU ─── */}
          <View
            style={[
              styles.searchBarWrapper,
              {
                backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)",
                borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.12)",
              },
            ]}
          >
            <Search size={15} color={theme.accent} style={{ marginLeft: 10 }} />
            <TextInput
              style={[styles.searchInput, { color: isLight ? "#1A1528" : "#FFFFFF" }]}
              placeholder="İl, ilçe, mahalle veya sokak ara..."
              placeholderTextColor={isLight ? "rgba(26,21,40,0.55)" : "rgba(255,255,255,0.45)"}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchAddress}
              returnKeyType="search"
            />
            {isSearching ? (
              <ActivityIndicator size="small" color={theme.accent} style={{ marginRight: 10 }} />
            ) : searchQuery.length > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginRight: 6 }}>
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  style={styles.searchClearBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={13} color={isLight ? "#666" : "#aaa"} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSearchAddress}
                  style={[styles.searchGoBtn, { backgroundColor: theme.accent }]}
                >
                  <Text style={styles.searchGoBtnText}>Bul</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* ─── TEMA SEÇİCİ AÇILIR MENÜ ────────────────────────────────────── */}
          {showThemePicker && (
            <View
              style={[
                styles.themePickerMenu,
                {
                  backgroundColor: isLight ? "#FFFFFF" : "#1A1626",
                  borderColor: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.14)",
                },
              ]}
            >
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
                      { borderColor: isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.14)" },
                      mapTheme === t.id && { borderColor: theme.accent, backgroundColor: `${theme.accent}15` },
                    ]}
                    onPress={() => {
                      setMapTheme(t.id);
                      setShowThemePicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.themeOptionTitle,
                        { color: isLight ? "#2A2433" : "#F4F1F8" },
                        mapTheme === t.id && { color: theme.accent },
                      ]}
                    >
                      {t.label}
                    </Text>
                    <Text style={[styles.themeOptionDesc, { color: isLight ? "#6B6577" : "rgba(255,255,255,0.6)" }]}>{t.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* ─── YÜKLENİYOR / HAZIRLANIYOR GÖSTERGESİ ─────────────────────── */}
        {!isMapReady && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        )}

        {/* ─── REHBER ÇUBUĞU (Konum Seçilmediğinde) ──────────────────────── */}
        {isMapReady && !selectedCoord && (
          <View
            style={[
              styles.hintPill,
              {
                bottom: insets.bottom + 30,
                backgroundColor: isLight ? "rgba(255,255,255,0.86)" : "rgba(18,16,30,0.78)",
              },
            ]}
          >
            <BlurView tint={isLight ? "light" : "dark"} intensity={85} style={StyleSheet.absoluteFill} />
            <Heart size={14} color={theme.accent} fill={theme.accent} />
            <Text style={[styles.hintPillText, { color: isLight ? "#222" : "#fff" }]}>
              Konum belirlemek için haritaya dokunun
            </Text>
          </View>
        )}

        {/* ─── FLOATING DETAY VE ONAY KARTI (Aşk Haritası ile Birebir Aynı) ── */}
        {selectedCoord && (
          <View
            style={[
              styles.detailCardOverlay,
              {
                bottom: Math.max(insets.bottom, 16) + 12,
                backgroundColor: isLight ? "rgba(255,255,255,0.90)" : "rgba(18,16,30,0.84)",
                borderColor: isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.15)",
              },
            ]}
          >
            <BlurView tint={isLight ? "light" : "dark"} intensity={95} style={StyleSheet.absoluteFill} />

            <View style={styles.detailCardBody}>
              {/* Kart Üst Rozet & Kapat */}
              <View style={styles.detailCardHeader}>
                <View style={[styles.detailBadge, { backgroundColor: `${theme.accent}25` }]}>
                  <MapPin size={12} color={theme.accent} />
                  <Text style={[styles.detailBadgeText, { color: theme.accent }]}>Seçilen Konum</Text>
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedCoord(null)}
                  style={[
                    styles.detailCloseBtn,
                    { backgroundColor: isLight ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.12)" },
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={15} color={isLight ? "#4A4356" : "rgba(255,255,255,0.7)"} />
                </TouchableOpacity>
              </View>

              {/* Adres ve Koordinat Bilgisi */}
              <View style={styles.locationInfoBox}>
                <Text
                  style={[styles.locationTitle, { color: isLight ? "#1A1528" : "#FFFFFF" }]}
                  numberOfLines={2}
                >
                  {resolvedAddress || "Harita Üzerinde İşaretlenen Nokta"}
                </Text>
                <Text style={[styles.locationCoords, { color: isLight ? "#5C566B" : "rgba(255,255,255,0.6)" }]}>
                  📍 {selectedCoord.latitude.toFixed(5)}, {selectedCoord.longitude.toFixed(5)}
                </Text>
              </View>

              {/* Onaylama Butonu */}
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={[theme.accent, theme.accentLight || "#FF758F"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.confirmGradient}
                >
                  <Check size={18} color="#FFFFFF" strokeWidth={2.6} />
                  <Text style={styles.confirmBtnText}>Bu Konumu Onayla</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      {/* Bu modal açıkken uyarılar/diyaloglar (kök katman modalın arkasında kalır) burada çizilir */}
      <DialogHost embedded visible={visible} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // ─── ÜST KONTROL ÇUBUĞU ────────────────────────────────────────────────
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
    paddingBottom: 12,
    overflow: "hidden",
  },
  topBarMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    gap: 12,
  },
  topTitleBox: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  topBarSub: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  topActionsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  // ─── ARAMA ÇUBUĞU ───────────────────────────────────────────────────────
  searchBarWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 10,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  searchClearBtn: {
    padding: 4,
  },
  searchGoBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  searchGoBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },

  // ─── TEMA MENÜSÜ ───────────────────────────────────────────────────────
  themePickerMenu: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  themeMenuHeader: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
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
    borderColor: "rgba(0,0,0,0.08)",
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

  // ─── SEÇİLEN KONUM PİNİ ────────────────────────────────────────────────
  selectedMarkerWrapper: {
    alignItems: "center",
    justifyContent: "center",
    width: 50,
    height: 50,
  },
  markerAura: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  selectedMarkerCore: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
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

  // ─── REHBER PILL (HINT) ────────────────────────────────────────────────
  hintPill: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
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
    fontSize: 12.5,
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
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  detailBadgeText: {
    fontSize: 11.5,
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
  locationInfoBox: {
    gap: 4,
  },
  locationTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    lineHeight: 20,
  },
  locationCoords: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  confirmBtn: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#FF4D6D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  confirmGradient: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
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
