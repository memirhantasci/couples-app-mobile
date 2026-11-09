import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, Calendar, Check, ChevronLeft, Clock, Crown, Database, Info, MapPin, Printer, Share2, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { MapPickerModal } from "@/components/MapPickerModal";
import { StorySharePreview } from "@/components/share/StorySharePreview";
import { LazyDateTimePickerSheet, LazyDemoActionModal, LazyPremiumPaywall } from "@/components/ui/lazyMount";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useDemoAction } from "@/hooks/useDemoAction";
import { useStoryCouple } from "@/hooks/useStoryCouple";
import { DEMO_STAR_DETAILS } from "@/constants/demoData";
import { dayjs } from "@/lib/date";
import { getMyStarDetails } from "@/modules/stars/api/starService";
import { computeSky, type SkyResult } from "../astronomy";
import { NightSkyStoryCard, type SkyChartHighlight } from "../render";
import {
  buildDateOptions,
  buildSkyRequest,
  cleanPlaceName,
  dateFromTime,
  DEFAULT_SKY_TIME,
  DEMO_SKY_PLACE,
  defaultDateChoice,
  effectiveTitle,
  formatDateLine,
  formatYmd,
  gateFor,
  MAX_PLACE_NAME,
  MAX_TITLE_LENGTH,
  parseYmd,
  placeFromLocation,
  resolveChosenDate,
  selectWarnings,
  SKY_MIN_DATE,
  skyErrorKey,
  timeFromDate,
  todayString,
  type SkyDateChoice,
  type SkyPlace,
} from "./flowLogic";
import { describeOurStar } from "./ourStar";
import { PrintSharePreview } from "./PrintSharePreview";
import { EMPTY_SKY_PREFS, loadSkyPrefs, saveSkyPrefs } from "./skyPrefs";

const STEP_COUNT = 4;

export interface NightSkyFlowModalProps {
  visible: boolean;
  onClose: () => void;
  /** Açılışta hangi tarih seçeneği öne gelsin (kullanılabilirse); yıldönümü modalı "relationship" verir */
  initialDateChoice?: SkyDateChoice;
  /**
   * Paywall'daki yükseltme düğmesi /paywall'a gitmeden önce çağrılır: üstte açık modallar kapatılmalıdır.
   * Verilmezse yalnızca bu akış kapanır.
   */
  onLeaveForUpgrade?: () => void;
}

/**
 * "Bizim Gecemiz" 4 adımlı akışı. Ekran değil modaldır: iki giriş noktasından biri (yıldönümü kutlaması) zaten
 * bir modalın içindedir ve rota değiştirmeden, bulunduğu yerin üstünde açılıp kapanmalıdır; menü de aynı bileşeni açar.
 * Kapalıyken hiç kurulmaz, her açılışta baştan başlar.
 */
export function NightSkyFlowModal({ visible, ...rest }: NightSkyFlowModalProps) {
  if (!visible) return null;
  return <FlowScene {...rest} />;
}

function FlowScene({ onClose, initialDateChoice, onLeaveForUpgrade }: Omit<NightSkyFlowModalProps, "visible">) {
  const { t, i18n } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { profile, isDemoMode } = useAuth();
  const couple = useStoryCouple();
  const user = { isPremium: !!profile?.isPremium, isDemoMode };
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();

  const today = useMemo(() => todayString(), []);
  const [step, setStep] = useState(0);
  const [customDate, setCustomDate] = useState<string | null>(null);
  const options = useMemo(
    () => buildDateOptions({ meetDate: profile?.meetDate, relationshipStartDate: profile?.relationshipStartDate }, customDate, today),
    [profile?.meetDate, profile?.relationshipStartDate, customDate, today]
  );
  const [choice, setChoice] = useState<SkyDateChoice>(() => defaultDateChoice(options, initialDateChoice));
  const [place, setPlace] = useState<SkyPlace | null>(isDemoMode ? DEMO_SKY_PLACE : null);
  // Koordinat saklanmadığından yer her açılışta yeniden seçilir; önceki adı yalnızca hatırlatmadır
  const [lastPlaceName, setLastPlaceName] = useState<string | null>(null);
  const [time, setTime] = useState(DEFAULT_SKY_TIME);
  const [timeKnown, setTimeKnown] = useState(true);
  const [title, setTitle] = useState(EMPTY_SKY_PREFS.title);

  const [showMap, setShowMap] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

  // Son seçimler cihazdan okunur. Demo modu gerçek tercihleri ne okur ne yazar. Yazma, gerçek tercihler okunana
  // kadar da kapalıdır; demo hiç yüklemediği için yazmaya hiçbir zaman başlamaz.
  const prefsLoaded = useRef(false);
  // Bu oturum bir an bile demo olduysa durumdaki yer/saat demodan kalmış olabilir (demo yeri "İstanbul" hazır gelir):
  // demo biter bitmez kayıt etkisi çalışsa demo seçimi gerçek tercihe sızardı. Akış zaten kapanır; yazma da kapalı kalır.
  const demoTainted = useRef(isDemoMode);
  useEffect(() => {
    if (isDemoMode) demoTainted.current = true;
  }, [isDemoMode]);
  useEffect(() => {
    if (isDemoMode) return;
    let cancelled = false;
    loadSkyPrefs().then((prefs) => {
      if (cancelled) return;
      setLastPlaceName(prefs.placeName);
      setTime(prefs.time);
      setTimeKnown(prefs.timeKnown);
      setTitle(prefs.title);
      prefsLoaded.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [isDemoMode]);

  // Kayıt isteğinden giriş ekranına geçilirken demo biter: akış (ve üstünde açıldığı modal) girişin üstünde kalmasın
  const wasDemo = useRef(isDemoMode);
  useEffect(() => {
    if (wasDemo.current && !isDemoMode) (onLeaveForUpgrade ?? onClose)();
    wasDemo.current = isDemoMode;
  }, [isDemoMode, onLeaveForUpgrade, onClose]);

  const chosenDate = resolveChosenDate(options, choice);
  const canAdvance = step === 0 ? chosenDate !== null : step === 1 ? place !== null : true;
  const premiumTitle = effectiveTitle(title, gateFor("customTitle", user) === "allow");
  // Kullanıcı alanı yazarken boşluk girebilsin diye durumda ham tutulur; posterin gördüğü temizlenmişidir
  const posterPlaceName = cleanPlaceName(place?.name);

  // Gökyüzü yalnızca önizleme adımında hesaplanır
  const computed = useMemo<{ sky: SkyResult | null; errorKey: string | null }>(() => {
    if (step !== STEP_COUNT - 1 || !chosenDate || !place) return { sky: null, errorKey: null };
    try {
      return { sky: computeSky(buildSkyRequest({ date: chosenDate, time, place })), errorKey: null };
    } catch (error) {
      return { sky: null, errorKey: skyErrorKey(error) };
    }
  }, [step, chosenDate, time, place]);

  useEffect(() => {
    if (isDemoMode || demoTainted.current || step !== STEP_COUNT - 1 || !prefsLoaded.current) return;
    saveSkyPrefs({ placeName: posterPlaceName, time, timeKnown, title });
  }, [isDemoMode, step, posterPlaceName, time, timeKnown, title]);

  // Yıldız verisi akışı bekletmez: gelene kadar cümlesiz çizilir. Yıldızı olmayan çift ya da hata: cümle yok.
  const coupleId = profile?.coupleId ?? null;
  const { data: remoteStar } = useQuery({
    queryKey: ["night_sky_star", coupleId],
    enabled: !isDemoMode && !!coupleId,
    staleTime: 1000 * 60 * 5,
    retry: false,
    queryFn: () => getMyStarDetails(coupleId as number),
  });
  const coupleStar = isDemoMode ? DEMO_STAR_DETAILS : remoteStar;
  const ourStar = useMemo(() => {
    if (!computed.sky || !chosenDate || !place) return null;
    try {
      return describeOurStar(coupleStar, buildSkyRequest({ date: chosenDate, time, place }), computed.sky.sun.twilight);
    } catch {
      return null;
    }
  }, [computed.sky, chosenDate, time, place, coupleStar]);
  const starLine = ourStar
    ? t(`sky.poster.star.${ourStar.sentence.key}`, {
        degrees: ourStar.sentence.degrees,
        direction: t(`sky.poster.starDirection.${ourStar.sentence.direction}`),
      })
    : null;
  const highlight = ourStar?.highlight ?? undefined;

  const dateLine =
    chosenDate && formatDateLine(chosenDate, time, timeKnown, (day) => dayjs(day).locale(i18n.language).format("D MMMM YYYY"));
  const warnings = computed.sky ? selectWarnings(computed.sky) : [];

  const openPaywallOrRun = (action: "customTitle" | "printExport") => {
    const gate = gateFor(action, user);
    if (gate === "paywall") setShowPaywall(true);
    else if (gate === "signup") executeOrIntercept(() => {}, t("sky.flow.demoPrompt.title"), t("sky.flow.demoPrompt.description"));
    else if (action === "printExport") setShowPrint(true);
  };

  const muted = theme.textMuted;
  const card = { backgroundColor: theme.cardBg, borderColor: theme.cardBorder };

  const header = (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={step === 0 ? t("sky.flow.close") : t("sky.flow.back")}
        onPress={step === 0 ? onClose : () => setStep(step - 1)}
        hitSlop={10}
        style={styles.headerButton}
      >
        {step === 0 ? <X size={22} color={theme.text} /> : <ChevronLeft size={24} color={theme.text} />}
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {t("sky.flow.title")}
        </Text>
        <View style={styles.dots}>
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <View key={index} style={[styles.dot, { backgroundColor: index <= step ? theme.accent : theme.cardBorder, width: index === step ? 22 : 8 }]} />
          ))}
        </View>
      </View>
      <View style={styles.headerButton} />
    </View>
  );

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={step === 0 ? onClose : () => setStep(step - 1)}>
      <LinearGradient colors={theme.bgGradient} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {header}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.stepCount, { color: muted }]}>{t("sky.flow.stepOf", { current: step + 1, total: STEP_COUNT })}</Text>

          {step === 0 && (
            <>
              <Heading title={t("sky.flow.date.question")} hint={t("sky.flow.date.hint")} color={theme.text} muted={muted} />
              {options.map((option) => {
                const selected = choice === option.id && option.available;
                const subtitle = option.id === "custom" ? option.date : option.available ? option.date : option.reason ? t(`sky.flow.date.reason.${option.reason}`) : null;
                return (
                  <TouchableOpacity
                    key={option.id}
                    activeOpacity={0.85}
                    disabled={!option.available}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: !option.available }}
                    onPress={() => {
                      setChoice(option.id);
                      if (option.id === "custom") setShowDatePicker(true);
                    }}
                    style={[styles.option, card, selected && { borderColor: theme.accent, backgroundColor: theme.pillAccentBg }, !option.available && { opacity: 0.5 }]}
                  >
                    <View style={[styles.radio, { borderColor: selected ? theme.accent : muted }]}>
                      {selected ? <View style={[styles.radioDot, { backgroundColor: theme.accent }]} /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionTitle, { color: theme.text }]}>{t(`sky.flow.date.option.${option.id}`)}</Text>
                      {subtitle ? (
                        <Text style={[styles.optionSub, { color: theme.textSecondary }]} numberOfLines={2}>
                          {option.date ? dayjs(parseYmd(option.date) ?? undefined).locale(i18n.language).format("D MMMM YYYY") : subtitle}
                        </Text>
                      ) : option.id === "custom" ? (
                        <Text style={[styles.optionSub, { color: theme.textSecondary }]}>{t("sky.flow.date.pick")}</Text>
                      ) : null}
                    </View>
                    {option.id === "custom" && option.date ? <Calendar size={18} color={theme.accent} /> : null}
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {step === 1 && (
            <>
              <Heading title={t("sky.flow.place.question")} hint={t("sky.flow.place.hint")} color={theme.text} muted={muted} />
              <TouchableOpacity activeOpacity={0.85} onPress={() => setShowMap(true)} style={[styles.option, card, place && { borderColor: theme.accent }]} accessibilityRole="button">
                <MapPin size={22} color={theme.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: theme.text }]} numberOfLines={2}>
                    {place ? t("sky.flow.place.unnamed") : t("sky.flow.place.pick")}
                  </Text>
                  {place ? (
                    <Text style={[styles.optionSub, { color: theme.textSecondary }]}>{t("sky.flow.place.change")}</Text>
                  ) : lastPlaceName ? (
                    <Text style={[styles.optionSub, { color: theme.textSecondary }]} numberOfLines={2}>
                      {t("sky.flow.place.lastPlace", { name: lastPlaceName })}
                    </Text>
                  ) : null}
                </View>
                {place ? <Check size={18} color={theme.accent} /> : null}
              </TouchableOpacity>
              {place ? (
                <>
                  <View style={[styles.option, card]}>
                    <TextInput
                      value={place.name ?? ""}
                      onChangeText={(text) => setPlace((current) => (current ? { ...current, name: text.slice(0, MAX_PLACE_NAME) } : current))}
                      maxLength={MAX_PLACE_NAME}
                      placeholder={t("sky.flow.place.namePlaceholder")}
                      placeholderTextColor={muted}
                      accessibilityLabel={t("sky.flow.place.nameLabel")}
                      style={[styles.input, { color: theme.text }]}
                    />
                  </View>
                  <Text style={[styles.note, { color: theme.textSecondary }]}>
                    {posterPlaceName ? t("sky.flow.place.nameHint") : t("sky.flow.place.unnamedHint")}
                  </Text>
                </>
              ) : null}
            </>
          )}

          {step === 2 && (
            <>
              <Heading title={t("sky.flow.time.question")} hint={t("sky.flow.time.hint")} color={theme.text} muted={muted} />
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={!timeKnown}
                onPress={() => setShowTimePicker(true)}
                style={[styles.option, card, timeKnown && { borderColor: theme.accent }, !timeKnown && { opacity: 0.5 }]}
                accessibilityRole="button"
              >
                <Clock size={22} color={theme.accent} />
                <Text style={[styles.timeValue, { color: theme.text }]}>{time}</Text>
                <Text style={[styles.optionSub, { color: theme.textSecondary, flex: 1, textAlign: "right" }]}>{t("sky.flow.time.change")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: !timeKnown }}
                onPress={() => {
                  const next = !timeKnown;
                  setTimeKnown(next);
                  if (!next) setTime(DEFAULT_SKY_TIME);
                }}
                style={[styles.option, card, !timeKnown && { borderColor: theme.accent, backgroundColor: theme.pillAccentBg }]}
              >
                <View style={[styles.checkbox, { borderColor: !timeKnown ? theme.accent : muted, backgroundColor: !timeKnown ? theme.accent : "transparent" }]}>
                  {!timeKnown ? <Check size={14} color="#FFFFFF" /> : null}
                </View>
                <Text style={[styles.optionTitle, { color: theme.text, flex: 1 }]}>{t("sky.flow.time.unknown")}</Text>
              </TouchableOpacity>
              {!timeKnown ? <Text style={[styles.note, { color: theme.textSecondary }]}>{t("sky.flow.time.unknownNote", { time: DEFAULT_SKY_TIME })}</Text> : null}
            </>
          )}

          {step === 3 && (
            <>
              {computed.errorKey ? (
                <View style={[styles.option, card, { borderColor: "#DC2626" }]}>
                  <AlertTriangle size={20} color="#DC2626" />
                  <Text style={[styles.optionSub, { color: theme.text, flex: 1 }]}>{t(computed.errorKey as never)}</Text>
                </View>
              ) : computed.sky && chosenDate && place && dateLine ? (
                <>
                  <View style={styles.cardWrap}>
                    <NightSkyCard
                      width={Math.min(windowWidth - 64, 250)}
                      sky={computed.sky}
                      dateLine={dateLine}
                      placeName={posterPlaceName}
                      names={couple.names}
                      title={premiumTitle}
                      highlight={highlight}
                      starLine={starLine}
                    />
                  </View>

                  {warnings.map((warning) => (
                    <View key={warning} style={[styles.warning, { backgroundColor: theme.pillAccentBg, borderColor: theme.pillAccentBorder }]}>
                      <AlertTriangle size={16} color={theme.accent} style={{ marginTop: 2 }} />
                      <Text style={[styles.warningText, { color: theme.text }]}>{t(`sky.flow.warnings.${warning}`)}</Text>
                    </View>
                  ))}

                  <View style={styles.infoRow}>
                    <Info size={14} color={muted} style={{ marginTop: 2 }} />
                    <Text style={[styles.infoText, { color: muted }]}>{t("sky.flow.preview.info")}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Database size={14} color={muted} style={{ marginTop: 2 }} />
                    <Text style={[styles.infoText, { color: muted }]}>{t("sky.flow.preview.dataSources")}</Text>
                  </View>

                  {gateFor("customTitle", user) === "allow" ? (
                    <View style={[styles.option, card]}>
                      <TextInput
                        value={title}
                        onChangeText={(text) => setTitle(text.slice(0, MAX_TITLE_LENGTH))}
                        maxLength={MAX_TITLE_LENGTH}
                        placeholder={t("sky.poster.defaultTitle")}
                        placeholderTextColor={muted}
                        accessibilityLabel={t("sky.flow.preview.titleLabel")}
                        style={[styles.input, { color: theme.text }]}
                      />
                      <Crown size={16} color={theme.accent} />
                    </View>
                  ) : (
                    <LockedRow
                      icon={<Crown size={20} color={theme.accent} />}
                      title={t("sky.flow.preview.titleLabel")}
                      sub={t("sky.flow.preview.premiumOnly")}
                      onPress={() => openPaywallOrRun("customTitle")}
                      theme={theme}
                    />
                  )}

                  <LockedRow
                    icon={<Printer size={20} color={theme.accent} />}
                    title={t("sky.flow.preview.print")}
                    sub={t("sky.flow.preview.printSub")}
                    onPress={() => openPaywallOrRun("printExport")}
                    theme={theme}
                  />
                </>
              ) : null}
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          {step < STEP_COUNT - 1 ? (
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!canAdvance}
              onPress={() => setStep(step + 1)}
              style={[styles.primary, { backgroundColor: theme.accent, opacity: canAdvance ? 1 : 0.4 }]}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>{t("sky.flow.next")}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!computed.sky}
              onPress={() => setShowShare(true)}
              style={[styles.primary, { backgroundColor: theme.accent, opacity: computed.sky ? 1 : 0.4 }]}
              accessibilityRole="button"
            >
              <Share2 size={18} color="#FFFFFF" />
              <Text style={styles.primaryText}>{t("sky.flow.preview.share")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      <MapPickerModal
        visible={showMap}
        onClose={() => setShowMap(false)}
        title={t("sky.flow.place.mapTitle")}
        initialLocation={place ? { latitude: place.latitude, longitude: place.longitude, locationName: posterPlaceName ?? undefined } : undefined}
        onSelectLocation={(location) => {
          // Harita seçici bu metinleri "adres çözülemedi" anlamında koyar; ekranda kalır, postere gitmez
          // Pime dokunulmadan onaylanırsa seçici bizim verdiğimiz adı aynen geri verir: o, kullanıcının düzenlediği
          // ad olabilir ve kısaltmadan geçmemelidir
          const next = placeFromLocation(location, [t("map.picker.selected"), t("map.picker.markedPoint"), t("map.customLocation")], posterPlaceName);
          if (next) setPlace(next);
          setShowMap(false);
        }}
      />

      <LazyDateTimePickerSheet
        visible={showDatePicker}
        mode="date"
        title={t("sky.flow.date.pickerTitle")}
        value={(customDate && parseYmd(customDate)) || new Date()}
        minimumDate={parseYmd(SKY_MIN_DATE) ?? undefined}
        maximumDate={new Date()}
        onCancel={() => setShowDatePicker(false)}
        onConfirm={(date) => {
          const value = formatYmd(date);
          // Seçici sınırları zaten uygular; yine de gelecek/aralık dışı değer akışa girmez
          if (value > today || value < SKY_MIN_DATE) return false;
          setCustomDate(value);
          setChoice("custom");
          setShowDatePicker(false);
        }}
      />
      <LazyDateTimePickerSheet
        visible={showTimePicker}
        mode="time"
        title={t("sky.flow.time.pickerTitle")}
        value={dateFromTime(time)}
        onCancel={() => setShowTimePicker(false)}
        onConfirm={(date) => {
          setTime(timeFromDate(date));
          setShowTimePicker(false);
        }}
      />

      <LazyPremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onUpgrade={onLeaveForUpgrade ?? onClose}
        featureSource="night_sky"
      />

      {isDemoModalOpen && (
        <LazyDemoActionModal
          visible={isDemoModalOpen}
          onClose={() => setIsDemoModalOpen(false)}
          title={modalConfig.title}
          description={modalConfig.description}
        />
      )}

      {computed.sky && dateLine && place ? (
        <StorySharePreview
          visible={showShare}
          onClose={() => setShowShare(false)}
          dialogTitle={t("sky.flow.share.dialogTitle")}
          fallbackMessage={`${premiumTitle ?? t("sky.poster.defaultTitle")} · ${t("common.madeWith")}`}
          shareLabel={t("sky.flow.preview.share")}
          renderCard={(width, cardRef) => (
            <NightSkyStoryCard
              width={width}
              cardRef={cardRef}
              sky={computed.sky as SkyResult}
              dateLine={dateLine}
              placeName={posterPlaceName}
              names={couple.names}
              title={premiumTitle}
              highlight={highlight}
              starLine={starLine}
            />
          )}
        />
      ) : null}

      {computed.sky && dateLine && place ? (
        <PrintSharePreview
          visible={showPrint}
          onClose={() => setShowPrint(false)}
          layout={{ sky: computed.sky, dateLine, placeName: posterPlaceName, names: couple.names, title: premiumTitle, highlight, starLine }}
        />
      ) : null}
    </Modal>
  );
}

/** Önizleme adımındaki küçük kart (paylaşılan görsel StorySharePreview'dakidir). */
function NightSkyCard({ width, sky, dateLine, placeName, names, title, highlight, starLine }: { width: number; sky: SkyResult; dateLine: string; placeName: string | null; names: string | null; title: string | null; highlight?: SkyChartHighlight; starLine: string | null }) {
  const cardRef = useRef<View>(null);
  return <NightSkyStoryCard width={width} cardRef={cardRef} sky={sky} dateLine={dateLine} placeName={placeName} names={names} title={title} highlight={highlight} starLine={starLine} />;
}

function Heading({ title, hint, color, muted }: { title: string; hint: string; color: string; muted: string }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[styles.question, { color }]}>{title}</Text>
      <Text style={[styles.hint, { color: muted }]}>{hint}</Text>
    </View>
  );
}

function LockedRow({ icon, title, sub, onPress, theme }: { icon: ReactNode; title: string; sub: string; onPress: () => void; theme: ReturnType<typeof useTheme>["theme"] }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} accessibilityRole="button" style={[styles.option, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={[styles.optionTitle, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.optionSub, { color: theme.textSecondary }]}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 10 },
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 16, fontFamily: "PlayfairDisplay_700Bold" },
  dots: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { height: 6, borderRadius: 3 },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 12 },
  stepCount: { fontSize: 11.5, fontFamily: "Inter_600SemiBold", letterSpacing: 1, textTransform: "uppercase" },
  question: { fontSize: 26, lineHeight: 34, fontFamily: "PlayfairDisplay_700Bold" },
  hint: { marginTop: 6, fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular" },
  option: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 18, borderWidth: 1.2 },
  optionTitle: { fontSize: 15.5, fontFamily: "Inter_600SemiBold" },
  optionSub: { marginTop: 2, fontSize: 13, lineHeight: 18, fontFamily: "Inter_400Regular" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  timeValue: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  note: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_500Medium" },
  cardWrap: { alignItems: "center", marginBottom: 4 },
  warning: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  warningText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: "Inter_500Medium" },
  infoRow: { flexDirection: "row", gap: 8 },
  infoText: { flex: 1, fontSize: 12.5, lineHeight: 18, fontFamily: "Inter_400Regular" },
  input: { flex: 1, fontSize: 15.5, fontFamily: "Inter_600SemiBold", paddingVertical: 0 },
  footer: { paddingHorizontal: 20, paddingTop: 10 },
  primary: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 18 },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_700Bold" },
});
