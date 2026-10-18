import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useTheme } from "@/context/ThemeContext";

/**
 * Uygulamanın TEK tarih / saat seçicisi. Hiçbir ekran DateTimePicker'ı doğrudan kullanmaz.
 *
 * - iOS: alt sayfada sistem çarkı; seçim "Seç" ile onaylanır (iOS 14+ "compact" hapı yok).
 * - Android: aynı alt sayfa başlığıyla (Vazgeç / Başlık / Seç) özel aylık takvim (yıl seçimli)
 *   ve saat çarkı. Sistem iletişim kutusu kullanılmaz; böylece her ekranda aynı görünür.
 *
 * Kontrollü kullanım: `visible` ile aç, `onConfirm` içinde değeri kaydedip kapat.
 * `onConfirm` false dönerse alt sayfa açık kalır (ör. doğrulama hatası).
 */

export interface DateTimePickerSheetProps {
  visible: boolean;
  mode: "date" | "time";
  value: Date;
  title?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  onConfirm: (date: Date) => boolean | void;
  onCancel: () => void;
}

export function DateTimePickerSheet({ visible, onCancel, ...body }: DateTimePickerSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {/* Modal kapalıyken içerik monte edilmez; her açılışta taslak güncel değerle başlar */}
      <SheetBody onCancel={onCancel} {...body} />
    </Modal>
  );
}

const MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function SheetBody({
  mode,
  value,
  title,
  minimumDate,
  maximumDate,
  onConfirm,
  onCancel,
}: Omit<DateTimePickerSheetProps, "visible">) {
  const { theme, isLight } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Date>(value);

  const heading = title ?? (mode === "date" ? "Tarih Seç" : "Saat Seç");

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.cardBg,
            borderColor: theme.cardBorder,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.22)" }]} />

        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.headerAction, { color: theme.textSecondary }]}>Vazgeç</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{heading}</Text>
          <TouchableOpacity
            onPress={() => onConfirm(draft)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.headerAction, { color: theme.accent, fontFamily: "Inter_700Bold" }]}>Seç</Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === "ios" ? (
          <DateTimePicker
            value={draft}
            mode={mode}
            display="spinner"
            locale="tr-TR"
            themeVariant={isLight ? "light" : "dark"}
            textColor={theme.text}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(_, date) => {
              if (date) setDraft(date);
            }}
            style={styles.iosWheel}
          />
        ) : mode === "date" ? (
          <CalendarPane
            value={draft}
            onChange={setDraft}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
          />
        ) : (
          <TimePane value={draft} onChange={setDraft} />
        )}
      </View>
    </View>
  );
}

// ─── Android: aylık takvim ────────────────────────────────────────────────────

const DAY_CELL = 44;
const YEAR_ROW = 46;
const YEAR_COLUMNS = 4;

function CalendarPane({
  value,
  onChange,
  minimumDate,
  maximumDate,
}: {
  value: Date;
  onChange: (date: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
}) {
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const [view, setView] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const [yearMode, setYearMode] = useState(false);
  const yearScrollRef = useRef<ScrollView>(null);

  // Yüzde genişlik yerine tam piksel: yuvarlama farkı yüzünden 7. hücre alt satıra düşmesin
  const innerWidth = screenWidth - 34; // sheet yatay boşluk (16*2) + kenarlık (1*2)
  const dayWidth = Math.floor(innerWidth / 7);
  const yearWidth = Math.floor(innerWidth / YEAR_COLUMNS);

  const min = minimumDate ? startOfDay(minimumDate) : -Infinity;
  const max = maximumDate ? startOfDay(maximumDate) : Infinity;
  const today = startOfDay(new Date());
  const selected = startOfDay(value);

  const year = view.getFullYear();
  const month = view.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = (view.getDay() + 6) % 7; // hafta Pazartesi ile başlar

  const cells: (number | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);

  const canGoPrev = new Date(year, month, 0).getTime() >= min;
  const canGoNext = new Date(year, month + 1, 1).getTime() <= max;

  const minYear = Number.isFinite(min) ? new Date(min).getFullYear() : 1950;
  const maxYear = Number.isFinite(max) ? new Date(max).getFullYear() : new Date().getFullYear() + 20;
  const years = Array.from({ length: Math.max(1, maxYear - minYear + 1) }, (_, i) => minYear + i);

  const shiftMonth = (delta: number) => setView(new Date(year, month + delta, 1));

  const pickDay = (day: number) => {
    // Saat bilgisi (varsa) korunur; yalnızca gün değişir
    onChange(new Date(year, month, day, value.getHours(), value.getMinutes()));
  };

  const pickYear = (y: number) => {
    // Seçilen yıl sınırların dışında kalan bir aya denk geliyorsa en yakın geçerli aya çek
    let next = new Date(y, month, 1);
    if (new Date(y, month + 1, 0).getTime() < min) next = new Date(min);
    if (next.getTime() > max) next = new Date(max);
    setView(new Date(next.getFullYear(), next.getMonth(), 1));
    setYearMode(false);
  };

  return (
    <View style={styles.calendar}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity
          onPress={() => shiftMonth(-1)}
          disabled={!canGoPrev || yearMode}
          style={[styles.navBtn, { backgroundColor: theme.unitBg, opacity: canGoPrev && !yearMode ? 1 : 0.3 }]}
        >
          <ChevronLeft size={18} color={theme.text} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setYearMode((v) => !v)} style={styles.monthTitleBtn} activeOpacity={0.7}>
          <Text style={[styles.monthTitle, { color: theme.text }]}>
            {MONTHS[month]} {year}
          </Text>
          <ChevronDown
            size={16}
            color={theme.accent}
            style={{ transform: [{ rotate: yearMode ? "180deg" : "0deg" }] }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => shiftMonth(1)}
          disabled={!canGoNext || yearMode}
          style={[styles.navBtn, { backgroundColor: theme.unitBg, opacity: canGoNext && !yearMode ? 1 : 0.3 }]}
        >
          <ChevronRight size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      {yearMode ? (
        <ScrollView
          ref={yearScrollRef}
          style={styles.calendarBody}
          contentContainerStyle={[styles.yearGrid, { width: yearWidth * YEAR_COLUMNS }]}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          onLayout={() => {
            const row = Math.floor(Math.max(0, year - minYear) / YEAR_COLUMNS);
            yearScrollRef.current?.scrollTo({ y: Math.max(0, row * YEAR_ROW - YEAR_ROW * 2), animated: false });
          }}
        >
          {years.map((y) => {
            const isActive = y === year;
            return (
              <TouchableOpacity
                key={y}
                onPress={() => pickYear(y)}
                style={[
                  styles.yearChip,
                  { width: yearWidth },
                  isActive && { backgroundColor: theme.pillAccentBg, borderColor: theme.accent },
                ]}
              >
                <Text
                  style={[
                    styles.yearText,
                    { color: isActive ? theme.accent : theme.textSecondary },
                    isActive && { fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {y}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.calendarBody}>
          <View style={[styles.weekRow, { width: dayWidth * 7 }]}>
            {WEEKDAYS.map((d) => (
              <Text key={d} style={[styles.weekday, { color: theme.textMuted, width: dayWidth }]}>
                {d}
              </Text>
            ))}
          </View>
          <View style={[styles.dayGrid, { width: dayWidth * 7 }]}>
            {cells.map((day, i) => {
              if (day === null) return <View key={`e${i}`} style={[styles.dayCell, { width: dayWidth }]} />;
              const time = new Date(year, month, day).getTime();
              const disabled = time < min || time > max;
              const isSelected = time === selected;
              const isToday = time === today;
              return (
                <TouchableOpacity
                  key={day}
                  disabled={disabled}
                  onPress={() => pickDay(day)}
                  activeOpacity={0.7}
                  style={[styles.dayCell, { width: dayWidth }]}
                >
                  <View
                    style={[
                      styles.dayCircle,
                      isToday && !isSelected && { borderWidth: 1.5, borderColor: theme.accent },
                      isSelected && { backgroundColor: theme.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: isSelected ? "#FFFFFF" : theme.text, opacity: disabled ? 0.25 : 1 },
                        isSelected && { fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Android: saat çarkı ──────────────────────────────────────────────────────

const WHEEL_ITEM = 46;
const WHEEL_VISIBLE = 5;

function TimePane({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const { theme } = useTheme();

  const setPart = (part: "h" | "m", n: number) => {
    const next = new Date(value);
    if (part === "h") next.setHours(n);
    else next.setMinutes(n);
    onChange(next);
  };

  return (
    <View style={styles.timePane}>
      <View
        pointerEvents="none"
        style={[
          styles.wheelBand,
          { backgroundColor: theme.pillAccentBg, borderColor: theme.pillAccentBorder },
        ]}
      />
      <Wheel count={24} value={value.getHours()} onChange={(n) => setPart("h", n)} />
      <Text style={[styles.timeColon, { color: theme.text }]}>:</Text>
      <Wheel count={60} value={value.getMinutes()} onChange={(n) => setPart("m", n)} />
    </View>
  );
}

function Wheel({ count, value, onChange }: { count: number; value: number; onChange: (n: number) => void }) {
  const { theme } = useTheme();
  const ref = useRef<ScrollView>(null);

  // Çark ilk açılışta mevcut değere kaydırılır (animasyonsuz)
  useEffect(() => {
    const timer = setTimeout(() => ref.current?.scrollTo({ y: value * WHEEL_ITEM, animated: false }), 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = (y: number) => {
    const index = Math.min(count - 1, Math.max(0, Math.round(y / WHEEL_ITEM)));
    if (index !== value) onChange(index);
  };

  return (
    <View style={styles.wheel}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM}
        decelerationRate="fast"
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: WHEEL_ITEM * Math.floor(WHEEL_VISIBLE / 2) }}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={(e) => settle(e.nativeEvent.contentOffset.y)}
      >
        {Array.from({ length: count }, (_, i) => {
          const isActive = i === value;
          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              style={styles.wheelItem}
              onPress={() => {
                ref.current?.scrollTo({ y: i * WHEEL_ITEM, animated: true });
                onChange(i);
              }}
            >
              <Text
                style={{
                  fontSize: isActive ? 26 : 19,
                  fontFamily: isActive ? "Inter_700Bold" : "Inter_500Medium",
                  color: isActive ? theme.text : theme.textMuted,
                }}
              >
                {String(i).padStart(2, "0")}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  grabber: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  headerTitle: {
    fontSize: 14.5,
    fontFamily: "Inter_600SemiBold",
  },
  headerAction: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  iosWheel: {
    height: 200,
  },

  // Takvim
  calendar: {
    paddingTop: 6,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  monthTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  // 6 hafta + gün adları sabit yükseklikte: ay değişince sayfa zıplamaz
  calendarBody: {
    height: DAY_CELL * 6 + 28,
  },
  weekRow: {
    flexDirection: "row",
    height: 28,
    alignItems: "center",
    alignSelf: "center",
  },
  weekday: {
    textAlign: "center",
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignSelf: "center",
  },
  dayCell: {
    height: DAY_CELL,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    fontSize: 14.5,
    fontFamily: "Inter_500Medium",
  },
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignSelf: "center",
  },
  yearChip: {
    height: YEAR_ROW,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  yearText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },

  // Saat çarkı
  timePane: {
    height: WHEEL_ITEM * WHEEL_VISIBLE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  wheelBand: {
    position: "absolute",
    left: 24,
    right: 24,
    top: WHEEL_ITEM * Math.floor(WHEEL_VISIBLE / 2),
    height: WHEEL_ITEM,
    borderRadius: 14,
    borderWidth: 1,
  },
  wheel: {
    width: 96,
    height: WHEEL_ITEM * WHEEL_VISIBLE,
  },
  wheelItem: {
    height: WHEEL_ITEM,
    alignItems: "center",
    justifyContent: "center",
  },
  timeColon: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginHorizontal: 4,
    marginBottom: 4,
  },
});
