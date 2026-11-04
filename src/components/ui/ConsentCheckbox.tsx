import type { ReactNode } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Check } from "lucide-react-native";

interface ConsentCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  /** Etiket (bağlantı içeren <Text> olabilir). Kutu dışında kalan metne dokunmak da kutuyu değiştirir. */
  children: ReactNode;
  accentColor: string;
  /** İşaretlenmemiş kutunun çerçeve rengi */
  borderColor?: string;
  accessibilityLabel?: string;
}

/** Açık rıza / koşul onayı için işaretlenmemiş başlayan, erişilebilir onay kutusu. */
export function ConsentCheckbox({
  checked,
  onToggle,
  children,
  accentColor,
  borderColor = "rgba(255,255,255,0.35)",
  accessibilityLabel,
}: ConsentCheckboxProps) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={accessibilityLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[
          styles.box,
          { borderColor: checked ? accentColor : borderColor, backgroundColor: checked ? accentColor : "transparent" },
        ]}
      >
        {checked ? <Check size={15} color="#FFFFFF" strokeWidth={3} /> : null}
      </TouchableOpacity>
      <View style={styles.label}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  label: {
    flex: 1,
  },
});
