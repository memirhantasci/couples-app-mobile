import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { getTheme } from "@/lib/theme";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { RevenueCatService } from "@/lib/revenuecat";
import { PurchasesPackage } from "react-native-purchases";
import { X, Crown, Check, ShieldCheck } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PaywallScreen() {
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();
  const theme = getTheme(profile?.gender);
  const insets = useSafeAreaInsets();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);

  useEffect(() => {
    const fetchOfferings = async () => {
      const pkgs = await RevenueCatService.getOfferings();
      setPackages(pkgs);
      if (pkgs.length > 0) {
        setSelectedPackage(pkgs[0]); // default to first package (often annual)
      }
      setLoading(false);
    };
    fetchOfferings();
  }, []);

  const handlePurchase = async () => {
    if (!selectedPackage) return;
    setPurchasing(true);
    
    try {
      const customerInfo = await RevenueCatService.purchasePackage(selectedPackage);
      if (customerInfo && typeof customerInfo.entitlements.active['Premium'] !== "undefined") {
        await refreshProfile();
        Alert.alert("Tebrikler!", "Premium aboneliğiniz başarıyla aktif edildi.");
        router.back();
      }
    } catch (e: any) {
      Alert.alert("Satın Alma Başarısız", e.message || "Bir hata oluştu.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      const customerInfo = await RevenueCatService.restorePurchases();
      if (customerInfo && typeof customerInfo.entitlements.active['Premium'] !== "undefined") {
        await refreshProfile();
        Alert.alert("Başarılı", "Satın alımlarınız geri yüklendi.");
        router.back();
      } else {
        Alert.alert("Bilgi", "Aktif bir aboneliğiniz bulunamadı.");
      }
    } catch (e: any) {
      Alert.alert("Hata", "Geri yükleme başarısız oldu.");
    } finally {
      setPurchasing(false);
    }
  };

  const features = [
    "Partnerin için de geçerli ortak Premium",
    "Sınırsız fotoğraf yükleme ve galeri",
    "Erkekler için regl takvimi görünümü",
    "Takvimde geçmiş günlerin fotoğrafları",
    "Sınırsız geleceğe mektup yazma",
    "Tüm reklamlardan arınmış deneyim"
  ];

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 20 }]}>
        
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <View style={styles.closeBtnCircle}>
            <X color="rgba(255,255,255,0.7)" size={20} />
          </View>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={[styles.crownCircle, { backgroundColor: `${theme.accent}20` }]}>
            <Crown color={theme.accent} size={48} />
          </View>
          <Text style={styles.title}>Couples Premium</Text>
          <Text style={styles.subtitle}>İkiniz için de geçerli tek abonelik</Text>
        </View>

        <View style={styles.featuresBox}>
          {features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={[styles.checkCircle, { backgroundColor: theme.accent }]}>
                <Check color="#fff" size={14} />
              </View>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={theme.accent} size="large" style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.packagesContainer}>
            {packages.map((pkg) => {
              const isSelected = selectedPackage?.identifier === pkg.identifier;
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  activeOpacity={0.8}
                  style={[
                    styles.packageCard,
                    { backgroundColor: theme.cardBg, borderColor: isSelected ? theme.accent : "transparent" }
                  ]}
                  onPress={() => setSelectedPackage(pkg)}
                >
                  <View style={styles.packageInfo}>
                    <Text style={styles.packageTitle}>{pkg.product.title.replace("(Couples App)", "")}</Text>
                    <Text style={styles.packagePrice}>{pkg.product.priceString}</Text>
                  </View>
                  <View style={styles.radioOuter}>
                    {isSelected && <View style={[styles.radioInner, { backgroundColor: theme.accent }]} />}
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity 
              style={[styles.ctaBtn, { backgroundColor: theme.accent }, purchasing && { opacity: 0.7 }]}
              onPress={handlePurchase}
              disabled={purchasing || !selectedPackage}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaBtnText}>14 Gün Ücretsiz Dene</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={purchasing}>
              <ShieldCheck color="rgba(255,255,255,0.5)" size={16} />
              <Text style={styles.restoreText}>Satın Alımları Geri Yükle</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  closeBtn: {
    alignSelf: "flex-end",
  },
  closeBtnCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 30,
  },
  crownCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
  },
  featuresBox: {
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 20,
    borderRadius: 20,
    marginBottom: 30,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  featureText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    flex: 1,
  },
  packagesContainer: {
    gap: 12,
  },
  packageCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
  },
  packageInfo: {
    flex: 1,
  },
  packageTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  packagePrice: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  ctaBtn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },
  ctaBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "bold",
  },
  restoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 20,
  },
  restoreText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  }
});
