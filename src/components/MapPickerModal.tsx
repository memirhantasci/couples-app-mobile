import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, 
  Dimensions, Platform, ActivityIndicator, Alert,
  PermissionsAndroid 
} from 'react-native';
import MapView, { Marker, Region, UserLocationChangeEvent } from 'react-native-maps';
import { X, MapPin, Check, LocateFixed } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Güvenli Location modülü yüklemesi (Native modül henüz build edilmediyse çökmemesi için)
let LocationModule: any = null;
try {
  LocationModule = require('expo-location');
} catch (e) {
  LocationModule = null;
}

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

export function MapPickerModal({ visible, onClose, onSelectLocation, initialLocation }: MapPickerModalProps) {
  const mapRef = useRef<MapView | null>(null);
  const userLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

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

  // Android ve iOS Yerleşik Konum İzni Kontrolü
  const ensureLocationPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const hasFine = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        if (hasFine) return true;

        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Konum İzni Gerekli',
            message: 'Buluşma yerinizi kolayca seçebilmeniz için mevcut konumunuza erişim izni vermeniz gerekmektedir.',
            buttonPositive: 'İzin Ver',
            buttonNegative: 'İptal',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        return false;
      }
    }
    return true;
  };

  // Adres Çözümleme (Reverse Geocoding): Expo Location veya Web API fallback
  const fetchAddress = async (lat: number, lng: number) => {
    try {
      if (LocationModule && LocationModule.reverseGeocodeAsync) {
        const results = await LocationModule.reverseGeocodeAsync({ latitude: lat, longitude: lng });
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
      }
    } catch (e) {
      // Hata durumunda geç
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

      // 1. Konum İzni Al
      const hasPerm = await ensureLocationPermission();
      if (!hasPerm) {
        if (!isAuto) {
          Alert.alert('Konum İzni Verilmedi', 'Mevcut konumunuza gidebilmek için lütfen konum iznine onay verin.');
        }
        setIsLocating(false);
        return;
      }

      // 2. Haritanın hazırda yakaladığı bir konum varsa anında odaklan
      if (userLocationRef.current) {
        await applyNewCoordinate(userLocationRef.current);
        setIsLocating(false);
        return;
      }

      // 3. Standart Geolocation ile cihazdan konum çek
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            if (position?.coords) {
              const newCoord = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              };
              userLocationRef.current = newCoord;
              await applyNewCoordinate(newCoord);
            }
            setIsLocating(false);
          },
          async (error) => {
            // High accuracy başarısız olursa low accuracy dene
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                if (pos?.coords) {
                  const newCoord = {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                  };
                  userLocationRef.current = newCoord;
                  await applyNewCoordinate(newCoord);
                }
                setIsLocating(false);
              },
              (err) => {
                if (!isAuto) {
                  Alert.alert(
                    'GPS Servisi Kapalı Olabilir', 
                    'Cihazınızdan GPS konumu henüz alınamadı. Telefonunuzun üst panelinden "Konum / GPS" servisinin açık olduğunu kontrol edin veya haritaya dokunarak istediğiniz yeri seçin.'
                  );
                }
                setIsLocating(false);
              },
              { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
            );
          },
          { enableHighAccuracy: true, timeout: 7000, maximumAge: 10000 }
        );
        return;
      }

      // 4. Expo Location Fallback
      if (LocationModule && LocationModule.getCurrentPositionAsync) {
        try {
          const loc = await LocationModule.getCurrentPositionAsync({
            accuracy: LocationModule.Accuracy?.Balanced || 3,
          });
          if (loc?.coords) {
            const newCoord = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            userLocationRef.current = newCoord;
            await applyNewCoordinate(newCoord);
            setIsLocating(false);
            return;
          }
        } catch (e) {}
      }

      if (!isAuto) {
        Alert.alert('GPS Sinyali Bekleniyor', 'Lütfen cihazınızın Konum/GPS özelliğinin açık olduğundan emin olun.');
      }
    } catch (error) {
      if (!isAuto) {
        Alert.alert('Hata', 'Konum bilgisi alınırken bir sorun oluştu.');
      }
    } finally {
      setIsLocating(false);
    }
  };

  // Modal açıldığında kontrol
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
        // İzin kontrolünü arka planda başlat
        ensureLocationPermission().then((granted) => {
          if (granted && userLocationRef.current) {
            applyNewCoordinate(userLocationRef.current);
          }
        });
      }
    }
  }, [visible]);

  // Haritaya tıklandığında
  const handleMapPress = async (e: any) => {
    const coord = e.nativeEvent.coordinate;
    setSelectedCoordinate(coord);
    await fetchAddress(coord.latitude, coord.longitude);
  };

  const handleSelect = () => {
    if (selectedCoordinate) {
      onSelectLocation({
        latitude: selectedCoordinate.latitude,
        longitude: selectedCoordinate.longitude,
        locationName: resolvedAddress || 'Seçili Konum',
      });
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Buluşma Noktası Seç</Text>
          {selectedCoordinate ? (
            <TouchableOpacity onPress={handleSelect} style={styles.confirmBtn}>
              <Check color="#22c55e" size={24} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Harita */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={region}
            onPress={handleMapPress}
            showsUserLocation={true}
            showsMyLocationButton={true}
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
            {selectedCoordinate && (
              <Marker
                coordinate={selectedCoordinate}
                title="Buluşma Noktası"
                description={resolvedAddress || "Buluşacağınız yeri seçtiniz."}
              >
                <View style={styles.markerContainer}>
                  <MapPin color="#ff4081" size={36} fill="#ff4081" />
                </View>
              </Marker>
            )}
          </MapView>

          {/* Harita Üzeri İpucu */}
          {!selectedCoordinate && (
            <View style={styles.instructionOverlay}>
              <Text style={styles.instructionText}>
                Haritaya dokunarak veya GPS ile buluşma noktasını seçin
              </Text>
            </View>
          )}

          {/* GPS / Mevcut Konum Butonu */}
          <TouchableOpacity 
            style={styles.gpsBtn} 
            onPress={() => moveToUserLocation(false)}
            activeOpacity={0.8}
            disabled={isLocating}
          >
            {isLocating ? (
              <ActivityIndicator color="#ffd700" size="small" />
            ) : (
              <LocateFixed color="#ffffff" size={22} />
            )}
          </TouchableOpacity>
        </View>

        {/* Alt Seçim Çubuğu */}
        {selectedCoordinate && (
          <View style={styles.footer}>
            {resolvedAddress ? (
              <View style={styles.selectedAddressBadge}>
                <MapPin size={15} color="#ffd700" />
                <Text style={styles.selectedAddressText} numberOfLines={1}>
                  {resolvedAddress}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.submitBtn} onPress={handleSelect} activeOpacity={0.88}>
              <LinearGradient 
                colors={["#b8860b", "#ffd700", "#b8860b"]} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 0 }} 
                style={styles.submitBtnGradient}
              >
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
    backgroundColor: '#1c1c1e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#1c1c1e',
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  closeBtn: {
    padding: 8,
    marginLeft: -8,
  },
  confirmBtn: {
    padding: 8,
    marginRight: -8,
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
  instructionOverlay: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,15,20,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: '90%',
  },
  instructionText: {
    color: '#fff',
    fontSize: 13.5,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  gpsBtn: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(28,28,30,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1c1c1e',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  selectedAddressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  selectedAddressText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  submitBtn: {
    shadowColor: "#ffd700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  submitBtnGradient: {
    alignItems: "center",
    justifyContent: "center",
    padding: 15,
    borderRadius: 14,
  },
  submitBtnText: {
    color: "#1a1114",
    fontSize: 15.5,
    fontFamily: "Inter_700Bold",
  }
});
