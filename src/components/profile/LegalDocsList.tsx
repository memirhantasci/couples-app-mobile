import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ShieldCheck, Lock, FileText, UserCheck, CreditCard, ChevronRight } from "lucide-react-native";
import type { AppTheme } from "@/lib/theme";
import type { LegalDocType } from "@/constants/legalTexts";
import { ModernSection } from "./ModernSection";
import { profileSharedStyles } from "./profileSharedStyles";

interface LegalDocsListProps {
  theme: AppTheme;
  onOpenDoc: (doc: LegalDocType) => void;
}

const LEGAL_ITEMS = [
  { id: "kvkk" as const, title: "KVKK Aydınlatma Metni", sub: "6698 Sayılı Kanun Kapsamında Bilgilendirme", icon: ShieldCheck },
  { id: "privacy" as const, title: "Gizlilik Politikası", sub: "Veri Koruma, Şifreleme ve Güvenlik İlkeleri", icon: Lock },
  { id: "terms" as const, title: "Kullanım Koşulları (EULA)", sub: "Kullanıcı Sözleşmesi ve Genel Kurallar", icon: FileText },
  { id: "consent" as const, title: "Açık Rıza Metni", sub: "Sağlık ve Konum Verilerinin İşlenmesi", icon: UserCheck },
  { id: "subscription" as const, title: "Abonelik ve İade Şartları", sub: "Mesafeli Satış, İptal ve Yenileme", icon: CreditCard },
];

export function LegalDocsList({ theme, onOpenDoc }: LegalDocsListProps) {
  return (
    <ModernSection
      title="Yasal & Gizlilik Sözleşmeleri"
      icon={<ShieldCheck size={18} color={theme.accent} />}
      theme={theme}
      defaultOpen={false}
    >
      <Text style={[profileSharedStyles.sessionHintText, { color: theme.textMuted }]}>
        Verilerinizin güvenliği, gizliliğiniz ve mevzuat haklarınızla ilgili tüm yasal metinleri dilediğiniz zaman inceleyebilirsiniz.
      </Text>

      <View style={styles.legalListContainer}>
        {LEGAL_ITEMS.map((item) => {
          const ItemIcon = item.icon;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onOpenDoc(item.id)}
              style={[styles.legalItemCard, { backgroundColor: theme.unitBg }]}
              activeOpacity={0.8}
            >
              <View style={[styles.legalItemIconBox, { backgroundColor: theme.pillAccentBg }]}>
                <ItemIcon size={16} color={theme.accent} />
              </View>
              <View style={styles.legalItemTextBox}>
                <Text style={[styles.legalItemTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.legalItemSub, { color: theme.textMuted }]}>{item.sub}</Text>
              </View>
              <ChevronRight size={16} color={theme.textMuted} />
            </TouchableOpacity>
          );
        })}
      </View>
    </ModernSection>
  );
}

const styles = StyleSheet.create({
  legalListContainer: {
    marginTop: 12,
    gap: 8,
  },
  legalItemCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 14,
    gap: 12,
  },
  legalItemIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  legalItemTextBox: {
    flex: 1,
  },
  legalItemTitle: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  legalItemSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
