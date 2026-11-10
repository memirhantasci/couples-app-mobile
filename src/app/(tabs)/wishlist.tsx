import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Redirect } from "expo-router";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { ParseKeys } from "i18next";

import { EmptyState } from "@/components/ui/EmptyState";
import { Reveal } from "@/components/ui/Reveal";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { LazyDemoActionModal, LazyPageTourModal, LazyPremiumPaywall } from "@/components/ui/lazyMount";
import { SoloFeatureBanner } from "@/components/common/SoloFeatureBanner";
import { BothWantSection } from "@/components/wishlist/BothWantSection";
import { CategoryFilter } from "@/components/wishlist/CategoryChips";
import { PickButton } from "@/components/wishlist/PickButton";
import { PickerSheet } from "@/components/wishlist/PickerSheet";
import { QuickAddBar } from "@/components/wishlist/QuickAddBar";
import { WishlistDetailSheet } from "@/components/wishlist/WishlistDetailSheet";
import { WishlistItemSheet, type WishlistSheetRequest } from "@/components/wishlist/WishlistItemSheet";
import { WishlistIdeas } from "@/components/wishlist/WishlistIdeas";
import {
  WishlistItemCard,
  type WishlistCardActions,
  type WishlistCardPeople,
} from "@/components/wishlist/WishlistItemCard";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useCoupleAvatars } from "@/hooks/useCoupleAvatars";
import { useDemoAction } from "@/hooks/useDemoAction";
import { useIsOffline } from "@/hooks/useIsOffline";
import { usePageTour } from "@/hooks/usePageTour";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useWishlist, type WishlistWriteResult } from "@/hooks/useWishlist";
import { appAlert } from "@/lib/dialog";
import { showPartnerRequired, showSoloPremiumRequired, useSoloGate } from "@/lib/soloGate";
import { hapticSelection, playBubblePop, playSuccessChime } from "@/lib/soundEffects";
import { toast } from "@/lib/toast";
import {
  WISHLIST_DONE_PAGE_SIZE,
  buildWishlistView,
  getWishlistQuota,
  isBothWant,
  pickWishlistItem,
  wishlistBodyState,
  type WishlistCategory,
  type WishlistItem,
  type WishlistPick,
} from "@/lib/wishlist";
import type { WishlistItemPatch } from "@/lib/wishlistData";
import type { WishlistIdea } from "@/lib/wishlistIdeas";
import { canOpenWishlist, wishlistDataNotice } from "@/lib/wishlistAvailability";
import { WISHLIST_ERROR_KEYS } from "@/lib/wishlistErrors";
import { sanitize } from "@/utils/sanitize";

const OPEN_PAGE_SIZE = 30;
/** Bir Modal kapanırken iOS ikincisini hemen açamaz: paywall pencerenin kapanışı bitince açılır (letters.tsx ile aynı) */
const MODAL_SWAP_DELAY = 450;
const EMPTY_ITEMS: WishlistItem[] = [];
/** Ekranın yatay boşluğu (tasarım kuralı 16); filtre sırası bu boşluğu aşıp ekran kenarına kadar kayar */
const CONTENT_INSET = 16;

/** Yayında değilse (wishlistAvailability.ts) derin bağlantı ya da kalmış bir yol bile ekranı açmaz. */
export default function WishlistScreen() {
  const { isDemoMode } = useAuth();
  if (!canOpenWishlist(isDemoMode)) return <Redirect href="/(tabs)/home" />;
  return <WishlistContent />;
}

function WishlistContent() {
  const { t } = useTranslation();
  const { session, profile, isDemoMode, refreshProfile } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const soloGate = useSoloGate();
  const isOffline = useIsOffline();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("wishlist");
  const { getAvatarUrl, partnerAvatarUrl } = useCoupleAvatars();

  const userId = session?.user?.id ?? null;
  const dataNotice = wishlistDataNotice(isDemoMode);
  const isPaired = isDemoMode || !!profile?.isPaired;
  const isPremium = !!profile?.isPremium;

  const [filter, setFilter] = useState<WishlistCategory | null>(null);
  const [doneOpen, setDoneOpen] = useState(false);
  const [openVisible, setOpenVisible] = useState(OPEN_PAGE_SIZE);
  const [paywallOpen, setPaywallOpen] = useState(false);
  // Ekleme ve düzenleme aynı penceredir (WishlistItemSheet)
  const [sheet, setSheet] = useState<WishlistSheetRequest | null>(null);
  // Ayrıntılı ekleme çubuktan açıldı: pencere kapanınca çubuğa "eklendi mi" bildirilir (iptalde çubuk korunur)
  const createDone = useRef<((added: boolean) => void) | null>(null);
  // Karta dokununca açılan ayrıntı penceresi: kimlik tutulur, madde listeden güncel hâliyle okunur
  const [detailId, setDetailId] = useState<number | null>(null);
  const [pick, setPick] = useState<WishlistPick | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [rollId, setRollId] = useState(0);

  // Yapılanlar sunucuda, ekranın geçerli filtresiyle (activeWishlistFilter) aynı kategoriye göre süzülür
  const wishlist = useWishlist({ coupleId: profile?.coupleId, userId, isDemoMode, filter });
  const { refreshing, onRefresh } = usePullToRefresh(wishlist.refetch);
  const openItems = wishlist.openItems ?? EMPTY_ITEMS;

  const quota = useMemo(() => getWishlistQuota(openItems, isPremium), [openItems, isPremium]);
  const view = useMemo(
    () => buildWishlistView({ openItems, doneTotal: wishlist.doneTotal, userId, isPaired, filter }),
    [openItems, wishlist.doneTotal, userId, isPaired, filter]
  );

  /** Yazma eylemlerinin ortak kapısı: demo kayıt ister, tek kalan eşleşme ister, çevrimdışı yazılamaz. */
  const canWrite = (options?: { allowSolo?: boolean }): boolean => {
    if (executeOrIntercept(() => {}, t("wishlist.demo.title"), t("wishlist.demo.description"))) return false;
    if (!options?.allowSolo && soloGate.blockPartnerFeature()) return false;
    if (isOffline) {
      toast.warning(t("wishlist.errors.offline"));
      return false;
    }
    return true;
  };

  const showLimit = () => {
    if (quota.showCounter) setPaywallOpen(true);
    else toast.warning(t("wishlist.errors.premiumCap", { limit: quota.limit }));
  };

  const handleLimitPress = () => {
    if (executeOrIntercept(() => {}, t("wishlist.demo.title"), t("wishlist.demo.description"))) return;
    showLimit();
  };

  /**
   * Yazım sonucunu kullanıcıya söyler. Sınır paywall/uyarı, eşleşme ve tek kalan Premium soloGate kalıbıyla
   * yönlendirir; diğerleri türüne özel metin (wishlistErrors.ts). Bilinmeyen hata için `unknownKey` gösterilir.
   * `present` verilirse metin onunla gösterilir (düzenleme penceresi kendi içinde uyarır).
   */
  const reportWrite = (
    result: WishlistWriteResult,
    unknownKey: ParseKeys = "wishlist.errors.generic",
    present: (message: string) => void = (message) => toast.error(message)
  ) => {
    if (result === "ok") return;
    if (result === "limit") return showLimit();
    if (result === "partnerRequired" || result === "soloPremium") {
      // Sunucu eşleşmenin bittiğini söyledi (ör. partner hesabını sildi): profil yenilenince tek kalan bandı
      // görünür ve hızlı ekleme çubuğu kilitlenir; yoksa ekran açık görünmeye devam ederdi.
      if (!isDemoMode) void refreshProfile().catch(() => {});
      return result === "partnerRequired" ? showPartnerRequired() : showSoloPremiumRequired();
    }
    present(t(result === "unknown" ? unknownKey : WISHLIST_ERROR_KEYS[result]));
  };

  /** Ekleme kapıları (demo, tek kalan, çevrimdışı, sınır): çubuk, fikir çipleri ve pencere için aynı. Sınırda sunucuya gidilmez. */
  const canAdd = (): boolean => {
    if (!canWrite()) return false;
    if (quota.reached) {
      showLimit();
      return false;
    }
    return true;
  };

  const addTitle = async (rawTitle: string, category: WishlistCategory): Promise<boolean> => {
    if (!canAdd()) return false;
    const title = sanitize(rawTitle);
    if (!title) return false;

    const result = await wishlist.addItem({
      title,
      category,
      note: null,
      location_name: null,
      latitude: null,
      longitude: null,
    });
    if (result === "ok") {
      playBubblePop();
      return true;
    }
    reportWrite(result, "wishlist.errors.add");
    return false;
  };

  // Çip, ekleme bitene kadar kilitli kalır (WishlistIdeas, useSubmitLock)
  const addIdea = (idea: WishlistIdea) => addTitle(idea.title, idea.category);

  const confirmDelete = (item: WishlistItem) => {
    // Tek kalan kendi maddesini silebilir: veri onun, sunucu da silmeyi engellemez
    if (!canWrite({ allowSolo: true })) return;
    appAlert(
      t("wishlist.delete.title"),
      t("wishlist.delete.message"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            const result = await wishlist.removeItem(item.id);
            if (result === "ok") toast.success(t("wishlist.toasts.deleted"));
            else reportWrite(result);
          },
        },
      ],
      { forceDialog: true, tone: "danger" }
    );
  };

  // Kart eylemleri her çizimde güncel kapıları (çevrimdışı, sınır, demo) görür, ama nesne sabit kalır:
  // React.memo'lu kartlar (özellikle uzun Yaptıklarımız listesi) yalnızca kendi maddeleri değişince çizilir.
  const handlers = {
    onToggleWant: (item: WishlistItem) => {
      if (!canWrite()) return;
      hapticSelection();
      void wishlist.toggleWant(item).then((result) => reportWrite(result));
    },
    onToggleDone: (item: WishlistItem) => {
      if (!canWrite()) return;
      // Geri alınan madde yeniden açık sayılır: sınır doluysa sunucuya gitmeden söylenir
      if (item.status === "done" && quota.reached) return showLimit();
      if (item.status === "open") playSuccessChime();
      else hapticSelection();
      void wishlist.toggleDone(item).then((result) => reportWrite(result));
    },
    onEdit: (item: WishlistItem) => {
      if (canWrite()) setSheet({ mode: "edit", item });
    },
    onDelete: (item: WishlistItem) => confirmDelete(item),
    // Karta dokunma: ayrıntı penceresi (okumak için kapı yok: demo, tek kalan ve çevrimdışında da açılır)
    onOpen: (item: WishlistItem) => setDetailId(item.id),
  };
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });
  const actions = useMemo<WishlistCardActions>(
    () => ({
      onToggleWant: (item) => handlersRef.current.onToggleWant(item),
      onToggleDone: (item) => handlersRef.current.onToggleDone(item),
      onOpen: (item) => handlersRef.current.onOpen(item),
      onEdit: (item) => handlersRef.current.onEdit(item),
      onDelete: (item) => handlersRef.current.onDelete(item),
    }),
    []
  );

  const partnerName = t("common.partnerFallback");
  const myName = profile?.displayName;
  const people = useMemo<WishlistCardPeople>(
    () => ({ userId, myName, partnerName, getAvatarUrl }),
    [userId, myName, partnerName, getAvatarUrl]
  );

  const closeSheet = useCallback((added = false) => {
    createDone.current?.(added);
    createDone.current = null;
    setSheet(null);
  }, []);

  /** Çubuktaki "Ayrıntı ekle": kapılar pencere açılmadan denetlenir (sınır doluysa pencere hiç açılmaz). */
  const openCreate = (draft: { title: string; category: WishlistCategory | null }) =>
    new Promise<boolean>((resolve) => {
      if (!canAdd()) return resolve(false);
      createDone.current?.(false);
      createDone.current = resolve;
      setSheet({ mode: "create", ...draft });
    });

  const closeSheetThenLimit = () => {
    closeSheet(false);
    setTimeout(showLimit, MODAL_SWAP_DELAY);
  };

  // Pencerenin içindeki uyarılar pencerenin kendi DialogHost'unda görünür
  const alertInSheet = (message: string) => appAlert(t("common.error"), message);

  const submitSheet = async (fields: WishlistItemPatch): Promise<void> => {
    if (!sheet) return;
    if (isOffline) return alertInSheet(t("wishlist.errors.offline"));

    if (sheet.mode === "edit") {
      const result = await wishlist.saveItem(sheet.item.id, fields);
      if (result !== "ok") return reportWrite(result, "wishlist.errors.generic", alertInSheet);
      toast.success(t("wishlist.toasts.updated"), { delay: 350 });
      return closeSheet();
    }

    // Pencere açıkken liste dolmuş olabilir (partner ekledi): sunucuya gitmeden pencere kapanır, paywall/uyarı açılır
    if (quota.reached) return closeSheetThenLimit();
    if (!fields.title) return;
    const result = await wishlist.addItem(fields);
    if (result === "ok") {
      playBubblePop();
      return closeSheet(true);
    }
    if (result === "limit") return closeSheetThenLimit();
    reportWrite(result, "wishlist.errors.add", alertInSheet);
  };

  const rollPick = (excludeId: number | null) => {
    const next = pickWishlistItem(openItems, userId, { isPaired, category: view.filter, excludeId });
    if (!next) return;
    setPick(next);
    setRollId((id) => id + 1);
    setPickOpen(true);
  };

  const cancelSheet = useCallback(() => closeSheet(false), [closeSheet]);

  // Madde silinir ya da başka filtreye düşerse (yapılanlar süzülür) pencere kendiliğinden kapanır
  const detailItem = useMemo(
    () =>
      detailId === null
        ? null
        : (openItems.find((item) => item.id === detailId) ??
          wishlist.doneItems.find((item) => item.id === detailId) ??
          null),
    [detailId, openItems, wishlist.doneItems]
  );
  const closeDetail = useCallback(() => setDetailId(null), []);
  /** Ayrıntıdan düzenle / sil: önce pencere kapanır (iOS iki Modal'ı aynı anda sunamaz), kapılar sonra denetlenir */
  const editFromDetail = useCallback((item: WishlistItem) => {
    setDetailId(null);
    setTimeout(() => handlersRef.current.onEdit(item), MODAL_SWAP_DELAY);
  }, []);
  const deleteFromDetail = useCallback((item: WishlistItem) => {
    setDetailId(null);
    setTimeout(() => handlersRef.current.onDelete(item), MODAL_SWAP_DELAY);
  }, []);

  // wishlistBodyState: açık madde varken yapılanlar sorgusu açık listeyi gizlemez; açık madde yokken yapılanlar
  // bilinmeden "boş" denmez (iskelet / çevrimdışı / hata)
  const bodyState = wishlistBodyState(wishlist);
  const showOfflineState = bodyState === "offline";
  const showErrorState = bodyState === "error";
  const showLoading = bodyState === "loading";

  const renderBody = () => {
    if (showOfflineState) {
      return (
        <EmptyState
          emoji="📡"
          title={t("wishlist.states.offlineTitle")}
          description={t("wishlist.states.offlineDescription")}
          theme={theme}
          compact
        />
      );
    }
    if (showErrorState) {
      return (
        <EmptyState
          emoji="🌧️"
          title={t("wishlist.states.errorTitle")}
          description={t("wishlist.states.errorDescription")}
          ctaLabel={t("common.tryAgain")}
          onPressCta={() => void wishlist.refetch()}
          theme={theme}
          compact
        />
      );
    }
    if (showLoading) {
      return (
        <View style={styles.list}>
          <Skeleton height={60} borderRadius={20} />
          <Skeleton height={60} borderRadius={20} />
          <Skeleton height={60} borderRadius={20} />
          <Skeleton height={60} borderRadius={20} />
        </View>
      );
    }

    const doneRemaining = view.doneCount - wishlist.doneItems.length;
    const done = wishlist.done;
    // Yapılanlar bölümü kendi hatasını gösterir; açık liste etkilenmez
    const showDoneError = done.isError && view.doneCount === 0;
    // 🎲 açık fikirler başlığının sağında; o bölüm yoksa (bütün açıklar "ikimiz de") "İkimiz de" başlığında
    const pickInBoth = view.canPick && !view.showOpenSection;
    const pickButton = (onAccent: boolean) => (
      <PickButton source={view.pickSource} onPress={() => rollPick(null)} onAccent={onAccent} />
    );

    return (
      <>
        {/* Filtre her şeye uygulanır ("İkimiz de", 🎲, açıklar, yapılanlar): etkilediği her şeyin üstünde durur */}
        {view.showFilterChips ? (
          <Reveal scope="wishlist" index={1} style={styles.filter}>
            <CategoryFilter value={filter} onChange={setFilter} inset={CONTENT_INSET} />
          </Reveal>
        ) : null}

        {view.bothWant.length > 0 ? (
          <Reveal scope="wishlist" index={2}>
            <BothWantSection
              items={view.bothWant}
              people={people}
              partnerAvatarUrl={partnerAvatarUrl}
              actions={actions}
              accessory={pickInBoth ? pickButton(theme.isLight) : null}
            />
          </Reveal>
        ) : null}

        {view.showOpenSection ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, styles.sectionLabelFlex, { color: theme.textMuted }]}>
                {t("wishlist.sections.open", { total: view.open.length })}
              </Text>
              {view.canPick && !pickInBoth ? pickButton(false) : null}
            </View>
            {view.open.length > 0 ? (
              <View style={styles.list}>
                {view.open.slice(0, openVisible).map((item, index) => (
                  <Reveal scope="wishlist" index={index + 3} key={item.id}>
                    <WishlistItemCard item={item} people={people} actions={actions} />
                  </Reveal>
                ))}
                {view.open.length > openVisible ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.8}
                    onPress={() => setOpenVisible((count) => count + OPEN_PAGE_SIZE)}
                    style={[styles.moreBtn, { backgroundColor: theme.cardBg, ...theme.cardShadow }]}
                  >
                    <Text style={[styles.moreText, { color: theme.accent }]}>
                      {t("wishlist.showMore", { count: view.open.length - openVisible })}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : view.showFilteredEmpty ? (
              <Text style={[styles.filteredEmpty, { color: theme.textSecondary }]}>{t("wishlist.empty.filtered")}</Text>
            ) : null}
          </View>
        ) : null}

        {view.emptyState ? (
          <>
            <Reveal scope="wishlist" index={1}>
              <EmptyState
                emoji="💭"
                title={view.emptyState === "allDone" ? t("wishlist.empty.allDoneTitle") : t("wishlist.empty.title")}
                description={
                  view.emptyState === "allDone"
                    ? t("wishlist.empty.allDoneDescription")
                    : t("wishlist.empty.description")
                }
                theme={theme}
                compact
              />
            </Reveal>
            <Reveal scope="wishlist" index={2}>
              <WishlistIdeas onPick={addIdea} />
            </Reveal>
          </>
        ) : null}

        {showDoneError ? (
          <View style={[styles.section, styles.doneErrorRow]}>
            <Text style={[styles.filteredEmpty, styles.doneLabel, { color: theme.textSecondary }]}>
              {t("wishlist.doneSection.loadError")}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              activeOpacity={0.7}
              onPress={() => void done.retry()}
              style={styles.doneRetry}
            >
              <Text style={[styles.moreText, { color: theme.accent }]}>{t("common.tryAgain")}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {view.showDoneSection ? (
          <View style={styles.section}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded: doneOpen, busy: done.isSwitching }}
              activeOpacity={0.7}
              onPress={() => setDoneOpen((open) => !open)}
              style={styles.doneToggle}
            >
              <Text style={[styles.sectionLabel, styles.doneLabel, { color: theme.textMuted }]}>
                {t("wishlist.sections.done", { total: view.doneCount })}
              </Text>
              {/* Kategori değişti: önceki sayfalar görünür, yenisi gelene kadar yalnızca bu küçük gösterge döner */}
              {done.isSwitching && !done.isPaused ? (
                <ActivityIndicator
                  size="small"
                  color={theme.textMuted}
                  accessibilityLabel={t("wishlist.doneSection.loadingA11y")}
                  style={styles.doneSpinner}
                />
              ) : null}
              {doneOpen ? (
                <ChevronUp size={18} color={theme.textMuted} />
              ) : (
                <ChevronDown size={18} color={theme.textMuted} />
              )}
            </TouchableOpacity>
            {doneOpen ? (
              <View style={[styles.list, done.isSwitching && styles.doneStale]}>
                {wishlist.doneItems.map((item) => (
                  <WishlistItemCard key={item.id} item={item} people={people} actions={actions} />
                ))}
                {wishlist.doneHasMore && doneRemaining > 0 ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ busy: wishlist.isLoadingMoreDone }}
                    activeOpacity={0.8}
                    disabled={wishlist.isLoadingMoreDone}
                    onPress={() => void wishlist.loadMoreDone()}
                    style={[styles.moreBtn, { backgroundColor: theme.cardBg, ...theme.cardShadow }]}
                  >
                    <Text style={[styles.moreText, { color: theme.accent }]}>
                      {t("wishlist.showMore", { count: Math.min(doneRemaining, WISHLIST_DONE_PAGE_SIZE) })}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </>
    );
  };

  return (
    <ScreenBackground>
      <View style={styles.flex}>
        <ScreenHeader
          title={t("wishlist.title")}
          subtitle={t("wishlist.subtitle")}
          onOpenTour={guide ? openTour : undefined}
        />
        <SoloFeatureBanner style={styles.soloBanner} />
        {dataNotice ? (
          <Text style={[styles.dataNotice, { color: theme.textMuted }]}>
            {dataNotice === "demo" ? t("wishlist.preview.demo") : t("wishlist.preview.mock")}
          </Text>
        ) : null}

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        >
          <Reveal scope="wishlist" index={0}>
            <QuickAddBar
              quota={quota}
              locked={soloGate.isSolo}
              onLockedPress={() => soloGate.blockPartnerFeature()}
              onLimitPress={handleLimitPress}
              onSubmit={addTitle}
              onOpenDetails={openCreate}
            />
          </Reveal>
          {renderBody()}
        </ScrollView>
      </View>

      <PickerSheet
        visible={pickOpen}
        pick={pick}
        rollId={rollId}
        onAgain={() => rollPick(pick?.item.id ?? null)}
        onClose={() => setPickOpen(false)}
      />
      <WishlistDetailSheet
        item={detailItem}
        people={people}
        partnerAvatarUrl={partnerAvatarUrl}
        bothWant={detailItem ? isBothWant(detailItem, userId, isPaired) : false}
        onClose={closeDetail}
        onEdit={editFromDetail}
        onDelete={deleteFromDetail}
      />
      <WishlistItemSheet request={sheet} onClose={cancelSheet} onSubmit={submitSheet} />
      <LazyPremiumPaywall visible={paywallOpen} onClose={() => setPaywallOpen(false)} featureSource="wishlist" />
      <LazyPageTourModal visible={isTourVisible} guide={guide} onClose={closeTour} />
      <LazyDemoActionModal
        visible={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        title={modalConfig.title}
        description={modalConfig.description}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dataNotice: {
    marginHorizontal: 20,
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },
  soloBanner: {
    marginHorizontal: 16,
    marginBottom: 10,
  },
  content: {
    paddingHorizontal: CONTENT_INSET,
    paddingTop: 8,
    gap: 18,
  },
  section: {
    gap: 10,
  },
  // Filtre çiplerinin dokunma alanı (44) görünen hapından yüksek: çubuğa ve alttaki bölüme görünür boşluk 18 kalsın
  filter: {
    marginVertical: -8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: 8,
    minHeight: 32,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  sectionLabelFlex: {
    flexShrink: 1,
  },
  list: {
    gap: 8,
  },
  filteredEmpty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginLeft: 4,
  },
  moreBtn: {
    minHeight: 48,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: {
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  doneToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingRight: 4,
  },
  doneLabel: {
    flex: 1,
  },
  doneSpinner: {
    marginRight: 8,
  },
  doneStale: {
    opacity: 0.55,
  },
  doneErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  doneRetry: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
});
