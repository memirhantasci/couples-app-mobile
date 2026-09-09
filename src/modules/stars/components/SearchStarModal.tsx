/**
 * @file SearchStarModal.tsx
 * @module modules/stars/components
 * @description Evrende tescilli veya katalog yıldızlarını arama modalı.
 *
 * Tüm tema modlarıyla (Beyaz, Mavi, Pembe, Gece) tam uyumludur.
 */

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
import { Search, X, Star, Sun, Globe } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { starService } from '../api/starService';
import { CelestialSearchResult } from '../types/star.types';

interface SearchStarModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectStar: (item: CelestialSearchResult) => void;
}

const LOCAL_CELESTIAL_OBJECTS: CelestialSearchResult[] = [
  {
    entity_id: '999901',
    entity_type: 'common',
    display_name: 'Güneş ☀️',
    catalog_code: 'SOL-SUN',
    ra: 280.4600,
    dec: -23.4400,
    is_own_star: false,
  },
  {
    entity_id: '999902',
    entity_type: 'common',
    display_name: 'Dünya 🌍',
    catalog_code: 'SOL-EARTH',
    ra: 100.4600,
    dec: 23.4400,
    is_own_star: false,
  },
  {
    entity_id: '999903',
    entity_type: 'common',
    display_name: 'Venüs ✨',
    catalog_code: 'SOL-VENUS',
    ra: 243.6000,
    dec: -19.9000,
    is_own_star: false,
  },
  {
    entity_id: '999904',
    entity_type: 'common',
    display_name: 'Ay 🌙',
    catalog_code: 'SOL-MOON',
    ra: 101.2000,
    dec: 23.1000,
    is_own_star: false,
  },
  {
    entity_id: 'hip-32349',
    entity_type: 'common',
    display_name: 'Sirius (Akyıldız)',
    catalog_code: 'HIP-32349',
    ra: 101.2872,
    dec: -16.7161,
    is_own_star: false,
  },
  {
    entity_id: 'hip-91262',
    entity_type: 'common',
    display_name: 'Vega',
    catalog_code: 'HIP-91262',
    ra: 279.2347,
    dec: 38.7837,
    is_own_star: false,
  },
  {
    entity_id: 'hip-27989',
    entity_type: 'common',
    display_name: 'Betelgeuse',
    catalog_code: 'HIP-27989',
    ra: 88.7929,
    dec: 7.4071,
    is_own_star: false,
  },
  {
    entity_id: 'hip-11767',
    entity_type: 'common',
    display_name: 'Polaris (Kutup Yıldızı)',
    catalog_code: 'HIP-11767',
    ra: 37.9545,
    dec: 89.2641,
    is_own_star: false,
  },
];

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[İIı]/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[çc]/g, 'c')
    .replace(/[ğg]/g, 'g')
    .replace(/[öo]/g, 'o')
    .replace(/[şs]/g, 's')
    .replace(/[üu]/g, 'u');
}

export const SearchStarModal: React.FC<SearchStarModalProps> = ({
  visible,
  onClose,
  onSelectStar,
}) => {
  const { theme, isLight } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CelestialSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setResults([]);
      return;
    }

    // 1. Instant local match for high responsiveness
    const norm = normalizeText(trimmed);
    const localMatches = LOCAL_CELESTIAL_OBJECTS.filter((obj) => {
      const nName = normalizeText(obj.display_name);
      const nCode = normalizeText(obj.catalog_code);
      return nName.includes(norm) || nCode.includes(norm);
    });

    if (trimmed.length < 2) {
      setResults(localMatches);
      return;
    }

    // 2. Debounced remote search
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const remoteData = await starService.searchCelestialUniverse(trimmed);
        // Deduplicate local + remote results
        const seen = new Set<string>();
        const merged: CelestialSearchResult[] = [];

        for (const item of [...localMatches, ...remoteData]) {
          const key = item.catalog_code || item.entity_id;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(item);
          }
        }
        setResults(merged);
      } catch {
        setResults(localMatches);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 45 : 85}
        tint={isLight ? 'light' : 'dark'}
        style={StyleSheet.absoluteFill}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>Evrende Ara</Text>
              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.closeBtn,
                  { backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)' },
                ]}
              >
                <X size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.inputBorder,
                },
              ]}
            >
              <Search size={18} color={theme.textMuted} style={styles.searchIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Güneş, Dünya, Venüs, Sirius, yıldız adı..."
                placeholderTextColor={theme.textMuted}
                value={query}
                onChangeText={setQuery}
                autoFocus
                returnKeyType="search"
              />
            </View>

            {/* Results */}
            {loading && results.length === 0 ? (
              <ActivityIndicator size="large" color={theme.accent} style={styles.loader} />
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item, index) => item.entity_id || index.toString()}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                  query.trim().length >= 1 ? (
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Sonuç bulunamadı.</Text>
                  ) : null
                }
                renderItem={({ item }) => {
                  let typeLabel = '';
                  let typeColor = theme.textMuted;
                  const isSun = item.catalog_code === 'SOL-SUN';
                  const isEarth = item.catalog_code === 'SOL-EARTH';

                  if (item.entity_type === 'common') {
                    typeLabel = 'Sistem Cisimleri';
                    typeColor = '#FBBF24';
                  } else if (item.entity_type === 'custom') {
                    typeLabel = 'Tescilli Yıldız';
                    typeColor = '#38BDF8';
                  } else if (item.entity_type === 'exoplanet') {
                    typeLabel = 'Anı Gezegeni';
                    typeColor = '#A78BFA';
                  } else {
                    typeLabel = 'Katalog Yıldızı';
                    typeColor = theme.textMuted;
                  }

                  return (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[
                        styles.resultItem,
                        {
                          backgroundColor: theme.unitBg,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                      onPress={() => onSelectStar(item)}
                    >
                      {isSun ? (
                        <Sun size={20} color="#FBBF24" />
                      ) : isEarth ? (
                        <Globe size={20} color="#38BDF8" />
                      ) : (
                        <Star size={18} color={typeColor} />
                      )}
                      <View style={styles.resultTextContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[styles.resultName, { color: theme.text }]}>{item.display_name}</Text>
                          {item.is_own_star && (
                            <Text style={styles.ownStarBadge}> (Senin Yıldızın)</Text>
                          )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <Text style={[styles.typeBadge, { color: typeColor, borderColor: typeColor }]}>
                            {typeLabel}
                          </Text>
                          <Text style={[styles.resultCode, { color: theme.textMuted }]}>{item.catalog_code}</Text>
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

export default SearchStarModal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalContent: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    maxHeight: '80%',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 14,
  },
  loader: {
    marginVertical: 20,
  },
  listContainer: {
    paddingBottom: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 13,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  resultTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultCode: {
    fontSize: 11,
  },
  typeBadge: {
    fontSize: 10,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  ownStarBadge: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: 'bold',
    marginLeft: 6,
  },
});
