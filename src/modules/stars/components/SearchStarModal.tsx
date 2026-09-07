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

interface SearchStarModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectStar: (catalogId: string) => void;
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
      const data = await starService.searchStarByName(searchTerm);
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
                keyExtractor={(item, index) => item.catalog_id || index.toString()}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                  query.trim().length >= 2 ? (
                    <Text style={styles.emptyText}>Sonuç bulunamadı.</Text>
                  ) : null
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.resultItem}
                    onPress={() => onSelectStar(item.catalog_id)}
                  >
                    <Star size={18} color="#FBBF24" />
                    <View style={styles.resultTextContainer}>
                      <Text style={styles.resultName}>{item.custom_name || item.common_name}</Text>
                      <Text style={styles.resultCode}>{item.catalog_code}</Text>
                    </View>
                  </TouchableOpacity>
                )}
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
});
