import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, 
  Dimensions, Platform, ActivityIndicator, Alert,
  StatusBar 
} from 'react-native';
import MapView, { Marker, Region, UserLocationChangeEvent } from 'react-native-maps';
import { X, MapPin, Check, LocateFixed, Navigation, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useAuth } from '@/context/AuthContext';
import { getTheme } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

interface LocationData {
  latitude: number;
  longitude: number;
  locationName?: string;
}

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (location: LocationData) => void;
  initialLocation?: LocationData;
}

// Modern Dark Map Styling (Google Maps JSON)
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
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#0e0b17" }] }
];

export function MapPickerModal({ visible, onClose, onSelectLocation, initialLocation }: MapPickerModalProps) {
  const mapRef = useRef<MapView | null>(null);
  const userLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const theme = getTheme(profile?.gender);

  // Varsayılan konum (İstanbul)
  const defaultLocation: Region = {
    latitude: 41.0082,
    longitude: 28.9784,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };

  const [region, setRegion] = useState<Region>(
    initialLocation ? {
      latitude: initialLocation.latitude,
      longitude: initialLocation.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    } : defaultLocation
  );

  const [selectedCoordinate, setSelectedCoordinate] = useState<{ latitude: number; longitude: number } | null>(
    initialLocation ? { latitude: initialLocation.latitude, longitude: initialLocation.longitude } : null
  );

  const [resolvedAddress, setResolvedAddress] = useState<string>(
    initialLocation?.locationName || ''
  );
  const [isLocating, setIsLocating] = useState(false);

  // Android ve iOS Doğal Konum İzni Kontrolü
  const ensureLocationPermission = async (): Promise<boolean> => {
    try {
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      if (existingStatus === 'granted') {
        return true;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.warn("Location permission error:", err);
      return false;
    }
  };

  // Adres Çözümleme (Reverse Geocoding)
  const fetchAddress = async (lat: number, lng: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results && results.length > 0) {
        const item = results[0];
        const parts = [
          item.district || item.subregion || item.street, 
          item.city || item.region
        ].filter(Boolean);
        const name = parts.length > 0 ? parts.join(', ') : (item.name || 'Seçili Konum');
        setResolvedAddress(name);
        return name;
      }
    } catch (e) {
      // Hata durumunda web API fallback'e geç
    }

    // Web Fallback (Nominatim OpenStreetMap)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=tr`, {
        headers: { 'User-Agent': 'CouplesAppMobile/1.0' }
      });
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const sub = addr.suburb || addr.neighbourhood || addr.town || addr.district || addr.road;
        const city = addr.province || addr.city || addr.state;
        const parts = [sub, city].filter(Boolean);
        const name = parts.length > 0 ? parts.join(', ') : (data.display_name?.split(',')[0] || 'Seçili Konum');
        setResolvedAddress(name);
        return name;
      }
    } catch (e) {
      // Hata durumunda geç
    }

    setResolvedAddress('Seçili Konum');
    return 'Seçili Konum';
  };

  const applyNewCoordinate = async (newCoord: { latitude: number; longitude: number }) => {
    const newRegion: Region = {
      ...newCoord,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 800);
    setSelectedCoordinate(newCoord);
    await fetchAddress(newCoord.latitude, newCoord.longitude);
  };

  // Kullanıcının Mevcut GPS Konumuna Git
  const moveToUserLocation = async (isAuto = false) => {
    try {
      if (!isAuto) setIsLocating(true);

      const hasPerm = await ensureLocationPermission();
      if (!hasPerm) {
        if (!isAuto) {
          Alert.alert(
            'Konum İzni Gerekli', 
            'Buluşma yerinizi mevcut konumunuza göre ayarlayabilmek için lütfen konum iznini onaylayın veya harita üzerinden istediğiniz noktaya dokunun.'
          );
        }
        setIsLocating(false);
        return;
      }

      if (userLocationRef.current) {
        await applyNewCoordinate(userLocationRef.current);
        setIsLocating(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (loc?.coords) {
        const newCoord = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        userLocationRef.current = newCoord;
        await applyNewCoordinate(newCoord);
      }
    } catch (error) {
      if (!isAuto) {
        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown?.coords) {
            const newCoord = {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            };
            userLocationRef.current = newCoord;
            await applyNewCoordinate(newCoord);
            setIsLocating(false);
            return;
          }
        } catch (e) {}

        Alert.alert(
          'Konum Alınamadı', 
          'Cihazınızın Konum/GPS özelliğinin açık olduğundan emin olun veya doğrudan harita üzerine dokunarak istediğiniz yeri seçin.'
        );
      }
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    if (visible) {
      if (initialLocation) {
        const initCoord = {
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
        };
        setSelectedCoordinate(initCoord);
        setResolvedAddress(initialLocation.locationName || 'Seçili Konum');
        const initRegion: Region = {
          ...initCoord,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        };
        setRegion(initRegion);
        setTimeout(() => {
          mapRef.current?.animateToRegion(initRegion, 500);
        }, 200);
      } else {
        // Otomatik olarak kullanıcının anlık konumunu bul ve haritayı oraya odakla
        moveToUserLocation(true);
      }
    }
  }, [visible]);

  const handleMapPress = async (e: any) => {
    const coord = e.nativeEvent.coordinate;
    if (!coord) return;
    setSelectedCoordinate(coord);
    await fetchAddress(coord.latitude, coord.longitude);
  };

  const currentCoord = selectedCoordinate || (region ? { latitude: region.latitude, longitude: region.longitude } : null);

  const handleSelect = () => {
    if (currentCoord) {
      onSelectLocation({
        latitude: currentCoord.latitude,
        longitude: currentCoord.longitude,
        locationName: resolvedAddress || 'Seçili Konum',
      });
      onClose();
    }
  };

  const isMale = profile?.gender === "male";
  const activeColor = isMale ? "#4D9CFF" : "#FF4D6D";
  const activeGradient = isMale 
    ? (["#4D9CFF", "#1B6FD8", "#0A4DB8"] as const) 
    : (["#FF3366", "#E8002D", "#C0006B"] as const);

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* ─── Modern Floating Header ─── */}
        <View style={[styles.headerFloating, { paddingTop: insets.top + 10 }]}>
          <BlurView tint="dark" intensity={70} style={StyleSheet.absoluteFill} />
          
          <TouchableOpacity 
            onPress={onClose} 
            style={styles.closeBtn}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X color="#FFFFFF" size={20} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Buluşma Noktası</Text>
            <Text style={styles.headerSubtitle}>Haritadan konumu seçin</Text>
          </View>

          {currentCoord ? (
            <TouchableOpacity 
              onPress={handleSelect} 
              style={[styles.confirmQuickBtn, { backgroundColor: `${activeColor}25`, borderColor: activeColor }]}
              activeOpacity={0.8}
            >
              <Check color={activeColor} size={18} strokeWidth={2.6} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 38 }} />
          )}
        </View>

        {/* ─── Map View ─── */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={region}
            onPress={handleMapPress}
            showsUserLocation={true}
            showsMyLocationButton={false}
            customMapStyle={DARK_MAP_STYLE}
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
            {currentCoord && (
              <Marker
                coordinate={currentCoord}
                title="Buluşma Noktası"
                description={resolvedAddress || "Buluşacağınız yeri seçtiniz."}
                anchor={{ x: 0.5, y: 1 }}
              >
                {/* Modern Glowing Pulse Marker */}
                <View style={styles.markerContainer}>
                  <View style={[styles.markerAura, { backgroundColor: `${activeColor}35` }]} />
                  <View style={[styles.markerBadge, { backgroundColor: activeColor }]}>
                    <MapPin color="#FFFFFF" size={20} strokeWidth={2.2} />
                  </View>
                  <View style={[styles.markerStem, { borderTopColor: activeColor }]} />
                </View>
              </Marker>
            )}
          </MapView>

          {/* ─── Top Instruction Banner ─── */}
          {!selectedCoordinate && (
            <View style={[styles.instructionBadge, { top: insets.top + 76 }]}>
              <BlurView tint="dark" intensity={80} style={StyleSheet.absoluteFill} />
              <Navigation size={14} color={activeColor} style={{ transform: [{ rotate: "45deg" }] }} />
              <Text style={styles.instructionText}>
                Haritaya dokunarak buluşma yerini belirleyin
              </Text>
            </View>
          )}

          {/* ─── Floating GPS Button (Anlık Konum) ─── */}
          <TouchableOpacity 
            style={[styles.gpsFloatingBtn, { bottom: 200 }]} 
            onPress={() => moveToUserLocation(false)}
            activeOpacity={0.85}
            disabled={isLocating}
          >
            <BlurView tint="dark" intensity={85} style={StyleSheet.absoluteFill} />
            {isLocating ? (
              <ActivityIndicator color={activeColor} size="small" />
            ) : (
              <LocateFixed color={activeColor} size={22} strokeWidth={2.4} />
            )}
          </TouchableOpacity>
        </View>

        {/* ─── Modern Floating Bottom Sheet (Konum Seç Kartı) ─── */}
        {currentCoord && (
          <View style={[styles.footerCard, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <BlurView tint="dark" intensity={95} style={StyleSheet.absoluteFill} />

            {/* Address Details Card */}
            <View style={styles.addressCard}>
              <View style={[styles.addressIconBox, { backgroundColor: `${activeColor}20` }]}>
                <MapPin size={20} color={activeColor} strokeWidth={2.4} />
              </View>
              <View style={styles.addressTextBox}>
                <Text style={styles.addressHeaderLabel}>SEÇİLEN KONUM</Text>
                <Text style={styles.addressTitle} numberOfLines={2}>
                  {resolvedAddress || "Harita Üzerindeki Nokta"}
                </Text>
                <Text style={styles.addressCoords}>
                  {currentCoord.latitude.toFixed(5)}, {currentCoord.longitude.toFixed(5)}
                </Text>
              </View>
            </View>

            {/* Primary Action Button */}
            <TouchableOpacity 
              style={styles.submitBtn} 
              onPress={handleSelect} 
              activeOpacity={0.88}
            >
              <LinearGradient 
                colors={activeGradient} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 0 }} 
                style={styles.submitGradient}
              >
                <Check color="#FFFFFF" size={20} strokeWidth={2.5} />
                <Text style={styles.submitBtnText}>Bu Konumu Seç</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0812',
  },
  headerFloating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11.5,
    fontFamily: 'Inter_500Medium',
    marginTop: 1,
  },
  confirmQuickBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: Dimensions.get('window').width,
    height: '100%',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerAura: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    top: -6,
  },
  markerBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerStem: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
    marginTop: -1,
  },
  instructionBadge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    maxWidth: '88%',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  gpsFloatingBtn: {
    position: 'absolute',
    right: 18,
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  footerCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 18,
    gap: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 18,
    padding: 14,
  },
  addressIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressTextBox: {
    flex: 1,
  },
  addressHeaderLabel: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  addressTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 19,
  },
  addressCoords: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  submitBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  submitGradient: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 20,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.2,
  },
});
