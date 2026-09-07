import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Search, X, Star } from 'lucide-react-native';
import { starService } from '../api/starService';
import { CelestialSearchResult } from '../types/star.types';

interface SearchStarModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectStar: (item: CelestialSearchResult) => void;
}

export const SearchStarModal: React.FC<SearchStarModalProps> = ({
  visible,
  onClose,
  onSelectStar,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch(query.trim());
      } else {
        setResults([]);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const performSearch = async (searchTerm: string) => {
    setLoading(true);
    try {
      const data = await starService.searchCelestialUniverse(searchTerm);
      setResults(data);
    } catch (error) {
      console.warn('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Evrende Ara</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.inputContainer}>
              <Search size={18} color="#888" style={styles.searchIcon} />
              <TextInput
                style={styles.input}
                placeholder="Yıldız adı veya kodu..."
                placeholderTextColor="#888"
                value={query}
                onChangeText={setQuery}
                autoFocus
                returnKeyType="search"
              />
            </View>

            {/* Results */}
            {loading ? (
              <ActivityIndicator size="large" color="#38BDF8" style={styles.loader} />
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item, index) => item.entity_id || index.toString()}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                  query.trim().length >= 2 ? (
                    <Text style={styles.emptyText}>Sonuç bulunamadı.</Text>
                  ) : null
                }
                renderItem={({ item }) => {
                  const celestialItem = item as CelestialSearchResult;
                  let typeLabel = '';
                  let typeColor = '#888';
                  if (celestialItem.entity_type === 'common') {
                    typeLabel = 'Sistem Cisimleri';
                    typeColor = '#FBBF24';
                  } else if (celestialItem.entity_type === 'custom') {
                    typeLabel = 'Tescilli Yıldız';
                    typeColor = '#38BDF8';
                  } else if (celestialItem.entity_type === 'exoplanet') {
                    typeLabel = 'Anı Gezegeni';
                    typeColor = '#A78BFA';
                  } else {
                    typeLabel = 'Katalog Yıldızı';
                    typeColor = '#9CA3AF';
                  }

                  return (
                    <TouchableOpacity
                      style={styles.resultItem}
                      onPress={() => onSelectStar(celestialItem)}
                    >
                      <Star size={18} color={typeColor} />
                      <View style={styles.resultTextContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.resultName}>{celestialItem.display_name}</Text>
                          {celestialItem.is_own_star && (
                            <Text style={styles.ownStarBadge}> (Senin Yıldızın)</Text>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <Text style={[styles.typeBadge, { color: typeColor, borderColor: typeColor }]}>
                            {typeLabel}
                          </Text>
                          <Text style={styles.resultCode}>{celestialItem.catalog_code}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: 'rgba(15, 12, 30, 0.95)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    padding: 20,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#FFF',
    height: 44,
  },
  loader: {
    marginVertical: 20,
  },
  listContainer: {
    paddingBottom: 20,
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  resultTextContainer: {
    marginLeft: 12,
  },
  resultName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultCode: {
    color: '#888',
    fontSize: 12,
  },
  typeBadge: {
    fontSize: 10,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  ownStarBadge: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: 'bold',
    marginLeft: 6,
  },
});
