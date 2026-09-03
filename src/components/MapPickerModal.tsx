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

// ─── Temiz & Aydınlık Romantik Harita Teması (Normal / Beyaz Arka Plan) ──────
const CLEAN_LIGHT_MAP_STYLE = [
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
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#C6DCF2" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4E7294" }] },
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
          item.name || item.street,
          item.district || item.subregion,
          item.city || item.region
        ].filter(Boolean);
        
        const fullAddr = parts.join(', ');
        setResolvedAddress(fullAddr || 'Seçilen Konum');
      } else {
        setResolvedAddress('Seçilen Konum');
      }
    } catch (error) {
      setResolvedAddress('Seçilen Konum');
    }
  };

  // Yeni Koordinat Seçildiğinde
  const applyNewCoordinate = async (newCoord: { latitude: number; longitude: number }) => {
    setSelectedCoordinate(newCoord);
    mapRef.current?.animateToRegion({
      ...newCoord,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    }, 450);

    await fetchAddress(newCoord.latitude, newCoord.longitude);
  };

  // Anlık Konuma Gitme Fonksiyonu
  const moveToUserLocation = async (isInitial = false) => {
    try {
      setIsLocating(true);
      const hasPermission = await ensureLocationPermission();

      if (!hasPermission) {
        if (!isInitial) {
          Alert.alert(
            "Konum İzni Gerekli",
            "Mevcut konumunuzu görebilmek için konum erişimine izin vermeniz gerekmektedir."
          );
        }
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (loc && loc.coords) {
        const userCoord = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };

        userLocationRef.current = userCoord;

        mapRef.current?.animateToRegion({
          ...userCoord,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }, 600);

        if (!selectedCoordinate) {
          await applyNewCoordinate(userCoord);
        }
      }
    } catch (error) {
      try {
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown && lastKnown.coords) {
          const userCoord = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          };
          userLocationRef.current = userCoord;
          mapRef.current?.animateToRegion({
            ...userCoord,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }, 600);
        }
      } catch (fallbackError) {
        console.warn("Location error:", fallbackError);
      }
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    if (visible) {
      if (initialLocation) {
        setRegion({
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        });
        setSelectedCoordinate({
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
        });
        setResolvedAddress(initialLocation.locationName || '');
        
        setTimeout(() => {
          mapRef.current?.animateToRegion({
            latitude: initialLocation.latitude,
            longitude: initialLocation.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }, 400);
        }, 300);
      } else {
        moveToUserLocation(true);
      }
    }
  }, [visible, initialLocation]);

  // Haritaya tıklama
  const handleMapPress = async (e: any) => {
    const coord = e.nativeEvent?.coordinate;
    if (coord && coord.latitude && coord.longitude) {
      setSelectedCoordinate(coord);
      await fetchAddress(coord.latitude, coord.longitude);
    }
  };

  const currentCoord = selectedCoordinate || (region ? { latitude: region.latitude, longitude: region.longitude } : null);

  const handleSelect = () => {
    if (currentCoord) {
      onSelectLocation({
        latitude: currentCoord.latitude,
        longitude: currentCoord.longitude,
        locationName: resolvedAddress.trim() || undefined,
      });
      onClose();
    } else {
      Alert.alert("Konum Belirlenmedi", "Lütfen harita üzerinden bir konum seçin.");
    }
  };

  const activeColor = theme?.accent || '#FF4D6D';
  const activeGradient: [string, string] = [theme?.accent || '#FF4D6D', theme?.accentLight || '#FF758F'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9F6F0" />

        {/* ─── Modern Floating Header (Açık & Temiz) ─── */}
        <View style={[styles.headerFloating, { paddingTop: insets.top + 8 }]}>
          <BlurView tint="light" intensity={85} style={StyleSheet.absoluteFill} />
          
          <TouchableOpacity 
            onPress={onClose} 
            style={styles.closeBtn}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X color="#1A1528" size={20} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Buluşma Noktası</Text>
            <Text style={styles.headerSubtitle}>Haritadan konumu seçin</Text>
          </View>

          {currentCoord ? (
            <TouchableOpacity 
              onPress={handleSelect} 
              style={[styles.confirmQuickBtn, { backgroundColor: `${activeColor}20`, borderColor: activeColor }]}
              activeOpacity={0.8}
            >
              <Check color={activeColor} size={18} strokeWidth={2.6} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 38 }} />
          )}
        </View>

        {/* ─── Map View (Açık & Normal Harita) ─── */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={region}
            onPress={handleMapPress}
            showsUserLocation={true}
            showsMyLocationButton={false}
            customMapStyle={CLEAN_LIGHT_MAP_STYLE}
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
              <BlurView tint="light" intensity={90} style={StyleSheet.absoluteFill} />
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
            <BlurView tint="light" intensity={90} style={StyleSheet.absoluteFill} />
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
            <BlurView tint="light" intensity={95} style={StyleSheet.absoluteFill} />

            {/* Address Details Card */}
            <View style={styles.addressCard}>
              <View style={[styles.addressIconBox, { backgroundColor: `${activeColor}18` }]}>
                <MapPin size={20} color={activeColor} strokeWidth={2.4} />
              </View>
              <View style={styles.addressTextBox}>
                <Text style={styles.addressHeaderLabel}>SEÇİLEN BULUŞMA NOKTASI</Text>
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
                <Text style={styles.submitBtnText}>Bu Konumu Onayla</Text>
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
    backgroundColor: '#F9F6F0',
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
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    overflow: 'hidden',
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#1A1528',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: '#6B6577',
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
    shadowOpacity: 0.2,
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
    borderColor: 'rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxWidth: '88%',
  },
  instructionText: {
    color: '#332E38',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  gpsFloatingBtn: {
    position: 'absolute',
    right: 18,
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.2,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  footerCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.2,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    padding: 18,
    gap: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
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
    color: '#9C95A6',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  addressTitle: {
    color: '#1A1528',
    fontSize: 14.5,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 19,
  },
  addressCoords: {
    color: '#8A8294',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  submitBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FF4D6D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
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
