import { useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, MapPin, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { DialogHost } from "@/components/ui/DialogHost";
import { MapPickerModal } from "@/components/MapPickerModal";
import { TEXT_WHITE } from "@/lib/theme";
import { sanitize } from "@/utils/sanitize";
import { WISHLIST_NOTE_MAX, WISHLIST_TITLE_MAX, type WishlistCategory, type WishlistItem } from "@/lib/wishlist";
import type { WishlistItemPatch } from "@/lib/wishlistData";
import {
  WISHLIST_LOCATION_NAME_MAX,
  locationAfterNameEdit,
  locationFromMap,
  locationPatch,
  type WishlistLocationDraft,
} from "@/lib/wishlistLocation";
import { CategoryChips } from "./CategoryChips";
import { scrimColor, weakFill } from "./wishlistTheme";

interface WishlistEditSheetProps {
  item: WishlistItem | null;
  onClose: () => void;
  onSave: (id: number, patch: WishlistItemPatch) => Promise<boolean>;
}

/** Yalnızca ekleyene açılır: başlık, not, kategori ve konum burada düzenlenir. */
export function WishlistEditSheet({ item, onClose, onSave }: WishlistEditSheetProps) {
  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      {/* Madde değişince form yeni değerlerle baştan kurulur */}
      {item ? <EditForm key={item.id} item={item} onClose={onClose} onSave={onSave} /> : null}
      <DialogHost embedded visible={!!item} />
    </Modal>
  );
}

function EditForm({
  item,
  onClose,
  onSave,
}: {
  item: WishlistItem;
  onClose: () => void;
  onSave: (id: number, patch: WishlistItemPatch) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(item.title);
  const [note, setNote] = useState(item.note ?? "");
  const [category, setCategory] = useState<WishlistCategory>(item.category);
  const [location, setLocation] = useState<WishlistLocationDraft>({
    name: item.location_name ?? "",
    latitude: item.latitude,
    longitude: item.longitude,
  });
  const [showMap, setShowMap] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && !saving;
  const inputColors = { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const ok = await onSave(item.id, {
      title: sanitize(title),
      note: sanitize(note) || null,
      category,
      // Konum adı silindiyse koordinat da kalkar (wishlistLocation.ts)
      ...locationPatch(location, sanitize),
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <View style={[styles.backdrop, { backgroundColor: scrimColor(theme) }]}>
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.cardBg, paddingBottom: insets.bottom + 16, ...theme.cardShadow },
        ]}
      >
        <View style={styles.headerRow}>
          <Text numberOfLines={1} style={[styles.heading, { color: theme.text }]}>
            {t("wishlist.edit.title")}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("a11y.close")}
            onPress={onClose}
            style={styles.closeTouch}
            activeOpacity={0.7}
          >
            <View style={[styles.closeCircle, { backgroundColor: weakFill(theme) }]}>
              <X size={18} color={theme.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        <KeyboardAwareScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.form}
          enableOnAndroid
          extraScrollHeight={130}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t("wishlist.edit.titleLabel")}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={WISHLIST_TITLE_MAX}
              placeholder={t("wishlist.quick.placeholder")}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t("wishlist.edit.titleLabel")}
              style={[styles.input, inputColors]}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t("wishlist.edit.noteLabel")}</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              maxLength={WISHLIST_NOTE_MAX}
              multiline
              placeholder={t("wishlist.edit.notePlaceholder")}
              placeholderTextColor={theme.textMuted}
              accessibilityLabel={t("wishlist.edit.noteLabel")}
              style={[styles.input, styles.noteInput, inputColors]}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t("wishlist.edit.categoryLabel")}</Text>
            <CategoryChips value={category} onChange={(next) => next && setCategory(next)} />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t("wishlist.edit.locationLabel")}</Text>
            <View style={styles.locationRow}>
              <TextInput
                value={location.name}
                // Elle değişen ad eski noktayı göstermesin: koordinat temizlenir
                onChangeText={(name) => setLocation((draft) => locationAfterNameEdit(draft, name))}
                maxLength={WISHLIST_LOCATION_NAME_MAX}
                placeholder={t("wishlist.edit.locationPlaceholder")}
                placeholderTextColor={theme.textMuted}
                accessibilityLabel={t("wishlist.edit.locationLabel")}
                style={[styles.input, styles.locationInput, inputColors]}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("wishlist.edit.mapA11y")}
                onPress={() => setShowMap(true)}
                activeOpacity={0.8}
                style={[styles.mapBtn, { backgroundColor: theme.pillAccentBg }]}
              >
                <MapPin size={18} color={theme.accent} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("common.save")}
            accessibilityState={{ disabled: !canSave }}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.88}
            style={[styles.saveBtn, { backgroundColor: theme.accent }, !canSave && styles.saveDisabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={TEXT_WHITE} />
            ) : (
              <>
                <Check size={18} color={TEXT_WHITE} />
                <Text style={[styles.saveText, { color: TEXT_WHITE }]}>{t("common.save")}</Text>
              </>
            )}
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </View>

      {/* iOS aynı anda tek modal sunar: harita seçici formun içinde çizilir */}
      <MapPickerModal
        visible={showMap}
        onClose={() => setShowMap(false)}
        title={t("wishlist.edit.mapTitle")}
        initialLocation={
          location.latitude !== null && location.longitude !== null
            ? { latitude: location.latitude, longitude: location.longitude, locationName: location.name }
            : undefined
        }
        // Haritadan seçilen nokta adı her zaman günceller
        onSelectLocation={(picked) => setLocation(locationFromMap(picked))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "90%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  heading: {
    flex: 1,
    fontSize: 16.5,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  closeTouch: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -6,
  },
  closeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  form: {
    gap: 14,
    paddingBottom: 8,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    fontFamily: "Inter_400Regular",
  },
  noteInput: {
    minHeight: 84,
    textAlignVertical: "top",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  locationInput: {
    flex: 1,
    minWidth: 0,
  },
  mapBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    borderRadius: 16,
    marginTop: 4,
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },
});
