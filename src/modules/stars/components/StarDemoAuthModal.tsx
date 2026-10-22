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
import { useTheme } from '@/context/ThemeContext';
import type { ViewportStarItem } from '../types/star.types';
import { UNCLAIMED_STAR_BRIGHTNESS } from '../canvas/macro/starStyle';

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
  const { theme, isLight } = useTheme();

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
      <View style={[styles.overlay, { backgroundColor: isLight ? 'rgba(0, 0, 0, 0.5)' : 'rgba(3, 2, 7, 0.75)' }]}>
        <BlurView
          intensity={Platform.OS === 'ios' ? 70 : 100}
          tint={isLight ? 'light' : 'dark'}
          style={StyleSheet.absoluteFill}
        />

        <View
          style={[
            styles.card,
            {
              backgroundColor: isLight ? '#FFFFFF' : theme.cardBg,
              borderColor: isLight ? 'rgba(0, 0, 0, 0.08)' : theme.cardBorder,
              shadowColor: isLight ? '#000000' : theme.accent,
            },
          ]}
        >
          {/* Kapat Butonu (X) */}
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, isLight && { backgroundColor: 'rgba(0,0,0,0.05)' }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Kapat"
          >
            <X size={18} color={theme.text} />
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
            <View style={[styles.starBadge, isLight && { backgroundColor: theme.unitBg, borderColor: 'rgba(0,0,0,0.06)' }]}>
              <View
                style={[
                  styles.starColorDot,
                  { backgroundColor: targetStar.base_color || '#9DB4FF' },
                ]}
              />
              <Text style={[styles.starBadgeName, { color: theme.text }]} numberOfLines={1}>
                {targetStar.common_name
                  ? `${targetStar.common_name} (${targetStar.catalog_code})`
                  : targetStar.catalog_code}
              </Text>
              <Text style={[styles.starBadgeMag, { color: theme.textMuted }]}>
                Işık %{Math.round(UNCLAIMED_STAR_BRIGHTNESS * 100)}
              </Text>
            </View>
          )}

          {/* Başlık / Mesaj */}
          <Text style={[styles.title, { color: theme.text }]}>
            Bu yıldızı sahiplenmek için kayıt olmanız gerekiyor ✨
          </Text>

          {/* Açıklama */}
          <Text style={[styles.description, { color: theme.textSecondary }]}>
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
              style={[
                styles.loginBtn,
                isLight && { backgroundColor: theme.unitBg, borderColor: 'rgba(0,0,0,0.08)' },
              ]}
            >
              <LogIn size={16} color={isLight ? theme.accent : '#38BDF8'} style={{ marginRight: 6 }} />
              <Text style={[styles.loginBtnText, { color: isLight ? theme.accent : '#38BDF8' }]}>Giriş Yap</Text>
            </TouchableOpacity>

            {/* 3. Buton: Kapat */}
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.65}
              style={styles.dismissBtn}
            >
              <Text style={[styles.dismissBtnText, { color: theme.textMuted }]}>Kapat</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: Math.min(SCREEN_WIDTH - 48, 360),
    borderRadius: 24,
    borderWidth: 1.2,
    padding: 24,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
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
    fontSize: 12,
    fontWeight: '600',
    marginRight: 8,
    maxWidth: 160,
  },
  starBadgeMag: {
    fontSize: 11,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  description: {
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
    fontSize: 13,
    fontWeight: '500',
  },
});
