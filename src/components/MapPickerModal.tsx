import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions, Platform } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { X, MapPin, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
  // Varsayılan konum (İstanbul veya kullanıcının mevcut konumu olabilir)
  const defaultLocation = {
    latitude: 41.0082,
    longitude: 28.9784,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const [region, setRegion] = useState<Region>(initialLocation ? {
    ...initialLocation,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  } : defaultLocation);

  const [selectedCoordinate, setSelectedCoordinate] = useState<{ latitude: number; longitude: number } | null>(
    initialLocation ? { latitude: initialLocation.latitude, longitude: initialLocation.longitude } : null
  );

  const handleSelect = () => {
    if (selectedCoordinate) {
      onSelectLocation({
        latitude: selectedCoordinate.latitude,
        longitude: selectedCoordinate.longitude,
        locationName: 'Seçili Konum', // Gelişmiş versiyonda Geocoding ile burası doldurulabilir
      });
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X color="#fff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Konum Seç</Text>
          {selectedCoordinate ? (
            <TouchableOpacity onPress={handleSelect} style={styles.confirmBtn}>
              <Check color="#22c55e" size={24} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} /> // Yer tutucu
          )}
        </View>

        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={region}
            onPress={(e) => setSelectedCoordinate(e.nativeEvent.coordinate)}
          >
            {selectedCoordinate && (
              <Marker
                coordinate={selectedCoordinate}
                title="Buluşma Noktası"
                description="Buluşacağınız yeri seçtiniz."
              >
                <View style={styles.markerContainer}>
                  <MapPin color="#D32F2F" size={32} fill="#D32F2F" />
                </View>
              </Marker>
            )}
          </MapView>
          {!selectedCoordinate && (
            <View style={styles.instructionOverlay}>
              <Text style={styles.instructionText}>Haritaya dokunarak buluşma noktasını seçin</Text>
            </View>
          )}
        </View>

        {selectedCoordinate && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSelect}>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  instructionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1c1c1e',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
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
    padding: 16,
    borderRadius: 14,
  },
  submitBtnText: {
    color: "#1a1114",
    fontSize: 16,
    fontWeight: "700",
  }
});
