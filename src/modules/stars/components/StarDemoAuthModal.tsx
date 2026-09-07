/**
 * @file StarDemoAuthModal.tsx
 * @module modules/stars/components
 * @description Demo/misafir modundaki kullanıcının bir yıldıza tıkladığında
 * sahiplenme öncesi kayıt veya giriş yapmasını sağlayan yönlendirme kartı.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Sparkles, UserPlus, LogIn, X } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import type { ViewportStarItem } from '../types/star.types';

export interface StarDemoAuthModalProps {
  readonly visible: boolean;
  readonly targetStar?: ViewportStarItem | null;
  readonly onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const StarDemoAuthModal: React.FC<StarDemoAuthModalProps> = ({
  visible,
  targetStar,
  onClose,
}) => {
  const router = useRouter();
  const { exitDemoMode } = useAuth();

  const handleRegister = () => {
    onClose();
    exitDemoMode();
    router.replace({
      pathname: '/(auth)/login',
      params: { initialMode: 'register' },
    });
  };

  const handleLogin = () => {
    onClose();
    exitDemoMode();
    router.replace({
      pathname: '/(auth)/login',
      params: { initialMode: 'login' },
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 70 : 100}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.card}>
          {/* Kapat Butonu (X) */}
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Kapat"
          >
            <X size={18} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>

          {/* İkon */}
          <View style={styles.iconCircle}>
            <LinearGradient
              colors={['#F59E0B', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Sparkles size={26} color="#FFFFFF" />
            </LinearGradient>
          </View>

          {/* Hedef Yıldız Rozeti (Eğer seçilen yıldız varsa) */}
          {targetStar && (
            <View style={styles.starBadge}>
              <View
                style={[
                  styles.starColorDot,
                  { backgroundColor: targetStar.base_color || '#9DB4FF' },
                ]}
              />
              <Text style={styles.starBadgeName} numberOfLines={1}>
                {targetStar.common_name
                  ? `${targetStar.common_name} (${targetStar.catalog_code})`
                  : targetStar.catalog_code}
              </Text>
              <Text style={styles.starBadgeMag}>
                {targetStar.magnitude} mag
              </Text>
            </View>
          )}

          {/* Başlık / Mesaj */}
          <Text style={styles.title}>
            Bu yıldızı sahiplenmek için kayıt olmanız gerekiyor ✨
          </Text>

          {/* Açıklama */}
          <Text style={styles.description}>
            Aşkınızı gökyüzüne mühürlemek, yıldızınızı adlandırmak ve partnerinizle ortak alanınızı başlatmak için ücretsiz hesabınızı oluşturun.
          </Text>

          {/* Aksiyon Butonları (3 Buton: Kayıt Ol, Giriş Yap, Kapat) */}
          <View style={styles.buttonGroup}>
            {/* 1. Buton: Kayıt Ol */}
            <TouchableOpacity
              onPress={handleRegister}
              activeOpacity={0.88}
              style={styles.registerBtn}
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.registerGradient}
              >
                <UserPlus size={18} color="#030207" style={{ marginRight: 8 }} />
                <Text style={styles.registerBtnText}>Kayıt Ol</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* 2. Buton: Giriş Yap */}
            <TouchableOpacity
              onPress={handleLogin}
              activeOpacity={0.75}
              style={styles.loginBtn}
            >
              <LogIn size={16} color="#38BDF8" style={{ marginRight: 6 }} />
              <Text style={styles.loginBtnText}>Giriş Yap</Text>
            </TouchableOpacity>

            {/* 3. Buton: Kapat */}
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.65}
              style={styles.dismissBtn}
            >
              <Text style={styles.dismissBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 2, 7, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 48, 360),
    backgroundColor: '#0C0A1D',
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 14,
    overflow: 'hidden',
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  starBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  starColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  starBadgeName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 8,
    maxWidth: 160,
  },
  starBadgeMag: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  description: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  buttonGroup: {
    width: '100%',
    gap: 10,
  },
  registerBtn: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  registerGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerBtnText: {
    color: '#030207',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  loginBtn: {
    width: '100%',
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
  },
  dismissBtn: {
    width: '100%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13,
    fontWeight: '500',
  },
});
