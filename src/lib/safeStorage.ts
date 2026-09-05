import AsyncStorage from "@react-native-async-storage/async-storage";

const memoryFallback = new Map<string, string>();

/**
 * Güvenli Storage sarmalayıcısı.
 * iOS Expo Go veya native binary eksik ortamlarda 'Native module is null'
 * hatasıyla uygulamanın çökmesini engeller ve in-memory fallback kullanır.
 */
export const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return memoryFallback.get(key) ?? null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      memoryFallback.set(key, value);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      memoryFallback.delete(key);
    }
  },

  clear: async (): Promise<void> => {
    try {
      await AsyncStorage.clear();
    } catch {
      memoryFallback.clear();
    }
  },
};

export default safeStorage;
