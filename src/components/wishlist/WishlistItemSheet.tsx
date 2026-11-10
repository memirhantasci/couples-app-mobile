import { useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, MapPin, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/context/ThemeContext";
import { DialogHost } from "@/components/ui/DialogHost";
import { MapPickerModal } from "@/components/MapPickerModal";
import { useSubmitLock } from "@/hooks/useSubmitLock";
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

/**
 * Pencerenin açılış isteği. Ekleme ve düzenleme AYNI penceredir; yalnızca başlık ve kaydet düğmesinin metni değişir.
 *   • create: hızlı ekleme çubuğundaki başlık ve kategori taşınır (kategori seçilmediyse "Diğer" seçili gelir:
 *     hızlı eklemede de öyle kaydedilir). Not ve konum boş başlar.
 *   • edit: maddenin kayıtlı alanları.
 */
export type WishlistSheetRequest =
  | { mode: "create"; title: string; category: WishlistCategory | null }
  | { mode: "edit"; item: WishlistItem };

interface WishlistSheetDraft {
  title: string;
  note: string;
  category: WishlistCategory;
  location: WishlistLocationDraft;
}

function initialDraft(request: WishlistSheetRequest): WishlistSheetDraft {
  if (request.mode === "create") {
    return {
      title: request.title,
      note: "",
      category: request.category ?? "other",
      location: { name: "", latitude: null, longitude: null },
    };
  }
  const { item } = request;
  return {
    title: item.title,
    note: item.note ?? "",
    category: item.category,
    location: { name: item.location_name ?? "", latitude: item.latitude, longitude: item.longitude },
  };
}

/**
 * Sunucuya gidecek alanlar. Metinler `sanitize` ile temizlenir (sanitizeStrict değil: başlıkta noktalama kalır).
 * Konum kuralları wishlistLocation.ts'te: ad boşsa koordinat da kaydedilmez.
 */
function sheetFields(draft: WishlistSheetDraft): WishlistItemPatch {
  return {
    title: sanitize(draft.title),
    note: sanitize(draft.note) || null,
    category: draft.category,
    ...locationPatch(draft.location, sanitize),
  };
}

interface WishlistItemSheetProps {
  request: WishlistSheetRequest | null;
  onClose: () => void;
  /**
   * Kayıt. Kapılar (sınır, eşleşme, çevrimdışı), hata gösterimi ve başarıda pencereyi kapatmak ekranın işidir;
   * pencere yalnızca alanları toplar ve aynı anda tek kayıt gönderir.
   */
  onSubmit: (fields: WishlistItemPatch) => Promise<unknown>;
}

/** Ortak listede fikir ekleme (create) ve düzenleme (edit, yalnızca ekleyene) penceresi. */
export function WishlistItemSheet({ request, onClose, onSubmit }: WishlistItemSheetProps) {
  // Kilit pencere ömrü boyunca tek: klavyedeki "bitti" ile düğme aynı karede gelse de tek kayıt gider
  const submit = useSubmitLock();
  // Kayıt sürerken kapatılmaz: sonuç (hata uyarısı ya da kapanış) bu pencerede gösterilir
  const close = () => {
    if (!submit.pending) onClose();
  };
  // Kapanırken (request null) son form çizilmeye devam eder: Modal aşağı kayarak kapanır, içi boşalıp bir anda
  // kaybolmaz. Her yeni açılış (yeni istek nesnesi) yeni bir kimlik alır ve form baştan kurulur.
  const [shown, setShown] = useState<{ request: WishlistSheetRequest; id: number } | null>(() =>
    request ? { request, id: 1 } : null
  );
  if (request && request !== shown?.request) setShown({ request, id: (shown?.id ?? 0) + 1 });

  return (
    <Modal visible={!!request} transparent animationType="slide" onRequestClose={close}>
      {shown ? (
        <SheetForm
          key={shown.id}
          request={shown.request}
          onClose={close}
          onSubmit={(fields) => void submit.run(() => onSubmit(fields))}
          saving={submit.pending}
        />
      ) : null}
      <DialogHost embedded visible={!!request} />
    </Modal>
  );
}

function SheetForm({
  request,
  onClose,
  onSubmit,
  saving,
}: {
  request: WishlistSheetRequest;
  onClose: () => void;
  onSubmit: (fields: WishlistItemPatch) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(() => initialDraft(request));
  const [showMap, setShowMap] = useState(false);
  const isCreate = request.mode === "create";

  const update = (patch: Partial<WishlistSheetDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const canSave = draft.title.trim().length > 0 && !saving;
  const inputColors = { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text };
  const submitLabel = isCreate ? t("wishlist.create.cta") : t("common.save");

  const handleSave = () => {
    if (!canSave) return;
    onSubmit(sheetFields(draft));
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
          <Text numberOfLines={1} accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
            {isCreate ? t("wishlist.create.title") : t("wishlist.edit.title")}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t("a11y.close")}
            accessibilityState={{ disabled: saving }}
            disabled={saving}
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
              value={draft.title}
              onChangeText={(title) => update({ title })}
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
              value={draft.note}
              onChangeText={(note) => update({ note })}
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
            <CategoryChips value={draft.category} onChange={(next) => next && update({ category: next })} />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>{t("wishlist.edit.locationLabel")}</Text>
            <View style={styles.locationRow}>
              <TextInput
                value={draft.location.name}
                // Elle değişen ad eski noktayı göstermesin: koordinat temizlenir
                onChangeText={(name) =>
                  setDraft((current) => ({ ...current, location: locationAfterNameEdit(current.location, name) }))
                }
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
            accessibilityLabel={submitLabel}
            accessibilityState={{ disabled: !canSave, busy: saving }}
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
                <Text style={[styles.saveText, { color: TEXT_WHITE }]}>{submitLabel}</Text>
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
          draft.location.latitude !== null && draft.location.longitude !== null
            ? { latitude: draft.location.latitude, longitude: draft.location.longitude, locationName: draft.location.name }
            : undefined
        }
        // Haritadan seçilen nokta adı her zaman günceller
        onSelectLocation={(picked) => update({ location: locationFromMap(picked) })}
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
