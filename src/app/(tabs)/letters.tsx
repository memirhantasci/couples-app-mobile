import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ActionCard } from "@/components/ui/ActionCard";
import { Reveal } from "@/components/ui/Reveal";
import { SegmentedControl } from "@/components/profile/SegmentedControl";
import { useFocusEffect } from "expo-router";
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Modal } from "react-native";
import { ScreenHeader, ScreenHeaderButton } from "@/components/ui/ScreenHeader";
import { SoloFeatureBanner } from "@/components/common/SoloFeatureBanner";
import { useSoloGate } from "@/lib/soloGate";
import { appAlert, type DialogButton } from "@/lib/dialog";
import { DialogHost } from "@/components/ui/DialogHost";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { Skeleton } from "@/components/ui/Skeleton";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { notifyPartner } from "@/lib/notifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dayjs, todayString } from "@/lib/date";
import { encrypt, decrypt } from "@/utils/crypto";
import { ChevronRight, LockKeyhole, Calendar as CalendarIcon, X, PenLine, Send, Clock, Unlock, UserCheck, ChevronDown, Eye, EyeOff, MoreHorizontal, Hourglass, HeartHandshake } from "lucide-react-native";
import { sanitize, sanitizeStrict } from "@/utils/sanitize";
import { logger } from "@/utils/logger";
import type { AppTheme } from "@/lib/theme";
import { useTheme } from "@/context/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { useCoupleAvatars } from "@/hooks/useCoupleAvatars";
import { usePageTour } from "@/hooks/usePageTour";
import { useDemoAction } from "@/hooks/useDemoAction";
import { hapticStamp, playLetterSend } from "@/lib/soundEffects";
import { LockedHourglassBadge } from "@/components/letters/LockedHourglassBadge";
import { LockedLetterPadlock, LockedLetterPill } from "@/components/letters/LockedLetterFeedback";
import { toast } from "@/lib/toast";
import { markLettersSeen } from "@/lib/letterArrival";
import { requestReviewAtMoment } from "@/lib/storeReview";
import { preloadBrokenSeals } from "@/lib/letterSeals";
import { markLettersVisited } from "@/lib/widgetUnread";
import { setCoupleWidgetUnread } from "@/utils/widgetBridge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useNotificationPriming } from "@/hooks/useNotificationPriming";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { fetchLetters, lettersQueryKey, LETTERS_PAGE_SIZE } from "@/lib/screenQueries";
import { safeStorage as AsyncStorage } from "@/lib/safeStorage";
import { LetterAdCard } from "@/components/letters/LetterAdCard";
import { LazyPremiumPaywall, LazyPageTourModal, LazyDemoActionModal, LazyWatchAdModal, LazyPermissionPrimingModal, LazyDateTimePickerSheet, LazyOrigamiBirdAnimation, LazyLetterReadingModal } from "@/components/ui/lazyMount";
import type { ReadableLetter } from "@/components/letters/LetterReadingModal";
import { deletionRequestOpensAt, deletionRetryAt, isHiddenBy, letterDeletableAt, letterDeletionState, letterUnlockAt } from "@/lib/letterPolicy";
import { useTranslation } from "react-i18next";
import { localizeServerError } from "@/lib/serverErrors";

const formatPolicyMoment = (ms: number, language: string) => dayjs(ms).locale(language).format("D MMMM HH:mm");
const formatPolicyDay = (ms: number, language: string) => dayjs(ms).locale(language).format("D MMMM");

// Bakan kişinin kendi listesinden gizlediği mektuplar ayrı görünümde durur. Yanıt bekleyen bir
// silme isteği, alıcı mektubu gizlemiş olsa da gözden kaçmasın diye ana listede kalır.
const isHiddenForMe = (letter: any): boolean =>
  isHiddenBy(letter, letter._type) &&
  !(letter._type === "received" && letterDeletionState(letter) === "pending");

// Çözülemeyen içerik "" olur: şifreli metin kullanıcıya asla gösterilmez
const safeDecrypt = (val: string | null | undefined): string => (val ? decrypt(val) : "");

// Kullanıcı adı ve görünen isim düz metin saklanır
const readableName = (val: string | null | undefined): string => (val ?? "").trim();

export default function LettersScreen() {
  const { t, i18n } = useTranslation();
  const { session, profile, refreshProfile, isDemoMode } = useAuth();
  const { executeOrIntercept, isDemoModalOpen, setIsDemoModalOpen, modalConfig } = useDemoAction();
  const soloGate = useSoloGate();
  const { theme, isLight } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const coupleId = profile?.coupleId || null;
  const userId = session?.user?.id ? session.user.id : null;
  const { getAvatarUrl } = useCoupleAvatars();
  const priming = useNotificationPriming(userId);

  const [activeTab, setActiveTab] = useState<"all" | "received" | "sent">("all");
  const [pageLimit, setPageLimit] = useState(LETTERS_PAGE_SIZE);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [showOrigamiAnimation, setShowOrigamiAnimation] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  // Demo modunda premium kilitleri yoktur: tüm özellikler açık
  const isPremium = (profile?.isPremium ?? false) || isDemoMode;
  const tokenBalance = profile?.tokenBalance ?? 0;
  const { isTourVisible, guide, openTour, closeTour } = usePageTour("letters");

  // --- Mektupları Getir (Sayfalamalı ve Korumalı) ---
  const { data, isLoading, refetch: refetchLetters } = useQuery({
    queryKey: lettersQueryKey(coupleId, userId, pageLimit, isDemoMode),
    enabled: (!!coupleId && !!userId) || isDemoMode,
    queryFn: () => fetchLetters({ coupleId, userId, pageLimit, isDemoMode }),
    staleTime: 1000 * 60 * 5, // 5 dk — invalidateQueries zaten yeni mektup yazılınca günceller
    // pageLimit anahtarın parçası: "daha fazla" yüklenirken eski liste görünür kalsın (iskelete dönüp kaydırma konumunu kaybetmesin)
    placeholderData: (previous) => previous,
  });

  // --- Alıcı Kullanıcıları Getir ---
  const { refreshing: lettersRefreshing, onRefresh: onRefreshLetters } = usePullToRefresh(refetchLetters);

  const { data: users } = useQuery({
    queryKey: ["users_for_letter", coupleId],
    enabled: !!coupleId,
    queryFn: async () => {
      const { data } = await supabase
        .from("users")
        .select("id, username, display_name")
        .eq("role", "USER")
        .eq("couple_id", coupleId);
      return (data || []).filter(u => u.id !== userId && u.id !== Number(userId));
    }
  });

  const [openLetterId, setOpenLetterId] = useState<number | null>(null);
  // Açılmış gelen mektup, mum mühür kırılarak okunan pencerede açılır (gönderilenler yerinde genişler)
  const [readingLetter, setReadingLetter] = useState<ReadableLetter | null>(null);
  // Tarihi gelmemiş mektuba son dokunuş: kartın kilidi sallanır, altında kalan gün hapı belirir.
  // `nonce` her dokunuşta artar ki aynı karta tekrar dokunmak animasyonu yeniden oynatsın
  const [lockedTap, setLockedTap] = useState<{ id: number; nonce: number } | null>(null);
  // Mührü önceden kırılmış mektup okuma penceresinde beklemeden açık gelsin: hafıza şimdiden yüklenir
  useEffect(() => {
    preloadBrokenSeals();
  }, []);

  // --- Form State ---
  const [receiverId, setReceiverId] = useState("");
  const [unlockDate, setUnlockDate] = useState(todayString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loadingForm, setLoadingForm] = useState(false);
  const [errors, setErrors] = useState({ receiver: false, title: false, content: false });

  // ─── Otomatik Taslak Kaydetme & Yükleme ─────────────────────────────────────
  useEffect(() => {
    if (!coupleId) return;
    const draftKey = `@couples_letter_draft_${coupleId}`;
    AsyncStorage.getItem(draftKey).then((saved) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.title) setTitle(parsed.title);
          if (parsed.content) setContent(parsed.content);
          if (parsed.unlockDate) setUnlockDate(parsed.unlockDate);
        } catch {}
      }
    });
  }, [coupleId]);

  useEffect(() => {
    if (!coupleId) return;
    const draftKey = `@couples_letter_draft_${coupleId}`;
    if (!title.trim() && !content.trim()) {
      return;
    }
    const timeout = setTimeout(() => {
      AsyncStorage.setItem(draftKey, JSON.stringify({ title, content, unlockDate }));
    }, 800);
    return () => clearTimeout(timeout);
  }, [title, content, unlockDate, coupleId]);

  // Gizlenenler görünümü: yalnızca bakan kişinin kendi listesinden kaldırdığı mektuplar
  const [showHidden, setShowHidden] = useState(false);
  const [busyLetterId, setBusyLetterId] = useState<number | null>(null);

  const hiddenCount = (data?.all || []).filter(isHiddenForMe).length;
  // Son gizli mektup da geri getirilince görünüm kendiliğinden ana listeye döner
  const isHiddenView = showHidden && hiddenCount > 0;
  const allLetters = (data?.all || []).filter((l: any) => isHiddenForMe(l) === isHiddenView);
  const receivedLetters = (data?.received || []).filter((l: any) => isHiddenForMe(l) === isHiddenView);
  const sentLetters = (data?.sent || []).filter((l: any) => isHiddenForMe(l) === isHiddenView);
  const pendingApprovalCount = (data?.received || []).filter(
    (l: any) => letterDeletionState(l) === "pending"
  ).length;

  // Mektuplar ekranı odaktayken gelen kutusu görülüyor: en yeni gelen mektup "görüldü" sayılır;
  // böylece uygulamaya sonra girildiğinde aynı mektup için kuş karşılaması tekrar oynamaz.
  const latestReceivedAt: string | null = data?.received?.[0]?.created_at ?? null;
  useFocusEffect(
    useCallback(() => {
      if (userId && latestReceivedAt) markLettersSeen(userId, latestReceivedAt);
    }, [userId, latestReceivedAt])
  );

  // Mektuplar görüldü: widget'taki okunmamış rozetinde yalnızca yanıt bekleyen silme istekleri kalır
  useFocusEffect(
    useCallback(() => {
      if (!userId || isDemoMode || isLoading) return;
      markLettersVisited(userId).then(() => setCoupleWidgetUnread(pendingApprovalCount));
    }, [userId, isDemoMode, isLoading, pendingApprovalCount])
  );

  const handleOpenWriteModal = () => {
    if (executeOrIntercept(
      () => {},
      t("demo.prompts.writeLetter.title"),
      t("demo.prompts.writeLetter.description")
    )) {
      return;
    }
    // Mektup bir partnere yazılır (tek kalan Premium olsa bile)
    if (soloGate.blockPartnerFeature()) return;
    // Partner varsa alıcıyı otomatik seç
    if (users && users.length === 1 && !receiverId) {
      setReceiverId(String(users[0].id));
    }
    setShowWriteModal(true);
  };

  const handleSave = async () => {
    if (executeOrIntercept(
      () => {},
      t("demo.prompts.writeLetter.title"),
      t("demo.prompts.writeLetter.description")
    )) {
      setShowWriteModal(false);
      return;
    }

    const newErrors = { 
      receiver: !receiverId, 
      title: !title.trim(), 
      content: !content.trim() 
    };
    setErrors(newErrors);

    if (newErrors.receiver || newErrors.title || newErrors.content) {
      appAlert(t("common.missingInfo"), t("letters.errors.missingFields"));
      return;
    }

    setLoadingForm(true);

    try {
      const cleanTitle = sanitizeStrict(title.trim());
      const cleanContent = sanitize(content.trim());

      if (!cleanTitle || !cleanContent) {
        appAlert(t("common.error"), t("letters.errors.invalidContent"));
        setLoadingForm(false);
        return;
      }

      // save_letter RPC'si veritabanı seviyesinde Premium durumunu kontrol eder,
      // Premium değilse 100 token'ı atomik olarak düşer. Bakiye yetersizse hata fırlatır.
      const { error } = await supabase.rpc("save_letter", {
        p_receiver_id: receiverId,
        p_title:       cleanTitle,
        p_content:     encrypt(cleanContent),
        p_unlock_date: unlockDate,
        p_couple_id:   coupleId ?? null,
      });

      if (error) throw error;

      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["letters_data"] });

      // Formu temizle, taslağı sil ve yazma modalını kapat
      setTitle("");
      setContent("");
      setUnlockDate(todayString());
      if (coupleId) {
        AsyncStorage.removeItem(`@couples_letter_draft_${coupleId}`).catch(() => {});
      }
      setShowWriteModal(false);

      // Alıcıya giden bildirim sunucudaki tetikleyiciden (send-push) gelir; burada ayrıca göndermek çift bildirim yapıyordu.

      // Origami turna kuşu uçuş animasyonunu ve ses efektini başlat! 🕊️✨
      playLetterSend();
      setShowOrigamiAnimation(true);
    } catch (error: any) {
      logger.error("Letter save error:", error);
      if (error?.code === "P0002" || error?.message?.includes("Token") || error?.message?.includes("Premium")) {
        appAlert(
          t("letters.insufficient.title"),
          t("letters.insufficient.message"),
          [
            { text: t("common.cancel"), style: "cancel" },
            { 
              text: t("common.discoverPremium"), 
              onPress: () => {
                setShowWriteModal(false);
                // Yazma modalı kapanırken ikinci bir Modal hemen açılamaz (iOS): paywall kapanış bitince açılır
                setTimeout(() => setShowPaywall(true), 450);
              } 
            }
          ]
        );
      } else {
        appAlert(t("common.error"), t("letters.errors.sealFailedWithMessage", { message: localizeServerError(error, "") }));
      }
    } finally {
      setLoadingForm(false);
    }
  };

  const confirmAndSave = () => {
    if (!isPremium && tokenBalance < 100) {
      setShowWriteModal(false);
      // Yazma modalı kapanırken ikinci bir Modal hemen açılamaz (iOS): paywall kapanış bitince açılır
      setTimeout(() => setShowPaywall(true), 450);
      return;
    }

    if (!isPremium) {
      appAlert(
        t("letters.tokenUse.title"),
        t("letters.tokenUse.message"),
        [
          { text: t("common.cancelAction"), style: "cancel" },
          { text: t("letters.tokenUse.confirm"), onPress: () => handleSave() }
        ]
      );
    } else {
      handleSave();
    }
  };

  // --- Gizleme ve partner onaylı silme (kurallar: src/lib/letterPolicy.ts, sunucuda RPC'ler) ---
  const runLetterAction = async (letterId: number, action: () => Promise<void>) => {
    setBusyLetterId(letterId);
    try {
      await action();
    } catch (error: any) {
      logger.error("Letter action error:", error);
      appAlert(t("letters.errors.actionFailedTitle"), localizeServerError(error, t("letters.errors.tryAgainLater")));
    } finally {
      setBusyLetterId(null);
      queryClient.invalidateQueries({ queryKey: ["letters_data"] });
    }
  };

  const handleSetHidden = (letter: any, hidden: boolean) =>
    runLetterAction(letter.id, async () => {
      const { error } = await supabase.rpc("set_letter_hidden", { p_letter_id: letter.id, p_hidden: hidden });
      if (error) throw error;
      toast.success(
        hidden ? t("letters.toasts.hidden") : t("letters.toasts.unhidden")
      );
    });

  const submitDeletionRequest = (letter: any) =>
    runLetterAction(letter.id, async () => {
      const { error } = await supabase.rpc("request_letter_deletion", { p_letter_id: letter.id });
      if (error) throw error;
      toast.success(t("letters.toasts.requestSent"));
      if (coupleId && userId) {
        notifyPartner(coupleId, userId, t("notifications.push.letterDeleteRequest.subtitle"), t("letters.push.deleteRequestBody"), {
          type: "letter_delete_request",
          letterTitle: letter.title,
          route: "/(tabs)/letters",
          actionLabel: t("letters.push.viewRequest"),
        });
      }
    });

  const handleCancelDeletion = (letter: any) =>
    runLetterAction(letter.id, async () => {
      const { error } = await supabase.rpc("cancel_letter_deletion", { p_letter_id: letter.id });
      if (error) throw error;
      toast.success(t("letters.toasts.requestWithdrawn"));
    });

  const respondToDeletion = (letter: any, approve: boolean) =>
    runLetterAction(letter.id, async () => {
      const { data: deletedNow, error } = await supabase.rpc("respond_letter_deletion", {
        p_letter_id: letter.id,
        p_approve: approve,
      });
      if (error) throw error;
      if (!approve) {
        toast.success(t("letters.toasts.keptLetter"));
      } else if (deletedNow) {
        toast.success(t("letters.toasts.deletedBoth"));
      } else {
        toast.success(t("letters.toasts.approvalSaved", { date: formatPolicyDay(letterDeletableAt(letter), i18n.language) }));
      }
      if (coupleId && userId) {
        notifyPartner(
          coupleId,
          userId,
          t("notifications.push.letterDeleteResponse.subtitle"),
          approve ? t("notifications.push.letterDeleteResponse.approved") : t("letters.push.keepAsked"),
          {
            type: "letter_delete_response",
            approved: approve,
            letterTitle: letter.title,
            route: "/(tabs)/letters",
          }
        );
      }
    });

  const handleApproveDeletion = (letter: any) => {
    const deletableAt = letterDeletableAt(letter);
    appAlert(
      t("letters.allowDelete.title"),
      Date.now() < deletableAt
        ? t("letters.allowDelete.messageOnDate", { date: formatPolicyDay(deletableAt, i18n.language) })
        : t("letters.allowDelete.messageNow"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("letters.allowDelete.confirm"), style: "destructive", onPress: () => respondToDeletion(letter, true) },
      ]
    );
  };

  // Alıcısız mektup (alıcının hesabı silindi): sunucu isteği beklemeden siler (request_letter_deletion)
  const handleDeleteWithoutReceiver = (letter: any) => {
    appAlert(
      t("letters.deleteNow.title"),
      t("letters.deleteNow.message"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("letters.deleteNow.confirm"),
          style: "destructive",
          onPress: () =>
            runLetterAction(letter.id, async () => {
              const { error } = await supabase.rpc("request_letter_deletion", { p_letter_id: letter.id });
              if (error) throw error;
              toast.success(t("letters.toasts.deleted"));
            }),
        },
      ]
    );
  };

  const handleRequestDeletion = (letter: any, isLocked: boolean) => {
    if (isLocked) {
      appAlert(
        t("letters.cantDelete.title"),
        t("letters.cantDelete.message"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("letters.hideFromList"), onPress: () => handleSetHidden(letter, true) },
        ]
      );
      return;
    }
    const now = Date.now();
    const opensAt = deletionRequestOpensAt(letter);
    if (now < opensAt) {
      appAlert(
        t("letters.tooEarly.title"),
        t("letters.tooEarly.message", { date: formatPolicyMoment(opensAt, i18n.language) }),
        undefined,
        { forceDialog: true }
      );
      return;
    }
    const retryAt = deletionRetryAt(letter);
    if (retryAt !== null && now < retryAt) {
      appAlert(
        t("letters.partnerKept.title"),
        t("letters.partnerKept.message", { date: formatPolicyMoment(retryAt, i18n.language) }),
        undefined,
        { forceDialog: true }
      );
      return;
    }
    const deletableAt = letterDeletableAt(letter);
    appAlert(
      t("letters.sendRequest.title"),
      now < deletableAt
        ? t("letters.deleteRequest.confirmOnDate", { date: formatPolicyDay(deletableAt, i18n.language) })
        : t("letters.deleteRequest.confirmNow"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("letters.sendRequest.confirm"), onPress: () => submitDeletionRequest(letter) },
      ]
    );
  };

  const openLetterMenu = (letter: any, itemType: "sent" | "received", isLocked: boolean) => {
    if (executeOrIntercept(() => {}, t("letters.demo.manageTitle"), t("letters.demo.manageDescription"))) return;
    const hidden = isHiddenBy(letter, itemType);
    const buttons: DialogButton[] = [
      hidden
        ? { text: t("letters.options.unhide"), onPress: () => handleSetHidden(letter, false) }
        : { text: t("letters.hideFromList"), onPress: () => handleSetHidden(letter, true) },
    ];
    if (itemType === "sent" && !letter.receiver_id) {
      // Alıcının hesabı silinmiş: onay bekleyecek kimse yok, gönderen mektubu doğrudan siler
      buttons.push({ text: t("letters.options.deleteNow"), style: "destructive", onPress: () => handleDeleteWithoutReceiver(letter) });
    } else if (itemType === "sent") {
      const deletion = letterDeletionState(letter);
      buttons.push(
        deletion === "pending" || deletion === "approved"
          ? { text: t("letters.options.withdraw"), onPress: () => handleCancelDeletion(letter) }
          : { text: t("letters.options.requestDeletion"), onPress: () => handleRequestDeletion(letter, isLocked) }
      );
    }
    buttons.push({ text: t("common.cancel"), style: "cancel" });
    appAlert(
      t("letters.options.title"),
      itemType === "sent"
        ? t("letters.options.messageReceived")
        : t("letters.options.messageSent"),
      buttons,
      { tone: "question" }
    );
  };

  const renderLetterItem = useCallback(({ item: letter, index }: { item: any; index: number }) => {
    const unlockDateStr = letter.unlock_date.substring(0, 10);
    // Sunucu mektubu açılış gününün 00:00 UTC'sinde açar (Türkiye'de 03:00). Kilit durumu ve gösterilen saat
    // bu gerçek ana göre hesaplanır; yerel gün karşılaştırması 00:00–03:00 arasında yanlış sonuç verirdi.
    const unlockMoment = dayjs(letterUnlockAt(letter));
    const isLockedDate = unlockMoment.valueOf() > Date.now();
    const itemType = letter._type || (letter.sender_id === userId ? "sent" : "received");
    const canOpen = itemType === "sent" || !isLockedDate;
    const isOpen = openLetterId === letter.id;
    // Alıcının henüz açamadığı mektup: kum saati rozeti, sallanan kilit ve kalan gün hapı
    const isSealedForMe = itemType === "received" && isLockedDate;
    const lockedTapKey = isSealedForMe && lockedTap && lockedTap.id === letter.id ? lockedTap.nonce : 0;
    const createdMs = dayjs(letter.created_at).valueOf();
    const sandProgress = isSealedForMe
      ? Math.min(0.92, Math.max(0.08, (Date.now() - createdMs) / Math.max(1, unlockMoment.valueOf() - createdMs)))
      : 0;
    const daysUntilOpen = isSealedForMe
      ? Math.max(1, dayjs(unlockDateStr).startOf("day").diff(dayjs().startOf("day"), "day"))
      : 0;

    const personObj = itemType === "received" ? letter.sender : letter.receiver;
    const personName =
      readableName(personObj?.display_name) || readableName(personObj?.username) || t("letters.myLoveHeart");
    const personAvatarUrl = getAvatarUrl(itemType === "received" ? letter.sender_id : letter.receiver_id);

    let relativeDate = dayjs(letter.created_at).locale(i18n.language).format("DD MMMM YYYY");
    if (dayjs(letter.created_at).isSame(dayjs(), 'day')) relativeDate = t("common.today");

    // Kilitli (henüz açılamayan) mektubun içeriği hiç çözülmez; açılabilir olanlar önbellekten gelir
    const letterContent = canOpen ? safeDecrypt(letter.content) : "";

    // Silme isteğinin durumu: alıcıya karar kutusu, diğer durumlarda tek satırlık not
    const deletion = letterDeletionState(letter);
    const isBusy = busyLetterId === letter.id;
    const deletionDay = formatPolicyDay(letterDeletableAt(letter), i18n.language);
    const amber = isLight ? "#B45309" : "#f59e0b";
    let deletionNote: { icon: React.ReactNode; text: string; action?: { label: string; onPress: () => void } } | null = null;
    if (itemType === "sent" && deletion === "pending") {
      deletionNote = {
        icon: <Hourglass size={14} color={amber} />,
        text: t("letters.note.pending"),
        action: { label: t("letters.note.withdraw"), onPress: () => handleCancelDeletion(letter) },
      };
    } else if (deletion === "approved") {
      deletionNote = {
        icon: <Clock size={14} color={amber} />,
        text: itemType === "sent"
          ? t("letters.note.partnerApproved", { deletionDay })
          : t("letters.note.youApproved", { deletionDay }),
        action: itemType === "sent"
          ? { label: t("common.cancel"), onPress: () => handleCancelDeletion(letter) }
          : { label: t("letters.note.keep"), onPress: () => respondToDeletion(letter, false) },
      };
    } else if (itemType === "sent" && deletion === "rejected") {
      deletionNote = {
        icon: <HeartHandshake size={14} color={theme.accent} />,
        text: t("letters.note.partnerKept"),
      };
    }

    return (
      <Reveal scope="letters" index={index}>
      <View 
        style={[
          styles.letterCard, 
          { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow },
          isLockedDate && itemType === "received" && styles.letterCardLocked
        ]}
      >
        <TouchableOpacity
          activeOpacity={canOpen ? 0.75 : 1}
          onPress={() => {
            if (!canOpen) {
              // Mektup açılmaz: kilit sallanır, mekanik bir tık hissedilir, kalan süre hatırlatılır
              hapticStamp();
              setLockedTap((prev) => ({ id: letter.id, nonce: (prev?.nonce ?? 0) + 1 }));
              return;
            }
            if (itemType === "received") {
              setReadingLetter({
                id: letter.id,
                title: letter.title,
                content: letterContent,
                senderName: personName,
                senderAvatarUrl: personAvatarUrl,
                createdAt: letter.created_at,
                unlockDate: unlockDateStr || null,
              });
              return;
            }
            setOpenLetterId(isOpen ? null : letter.id);
          }}
        >
          {/* Üst Durum Çubuğu */}
          <View style={styles.cardTopRow}>
            <View style={styles.badgeContainer}>
              {/* Tümü sekmesindeyken Gelen / Giden belirteci */}
              {activeTab === "all" && (
                <View
                  style={[
                    styles.directionBadge,
                    {
                      backgroundColor:
                        itemType === "received"
                          ? "rgba(168, 85, 247, 0.15)"
                          : "rgba(59, 130, 246, 0.15)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.directionBadgeText,
                      { color: itemType === "received" ? "#c084fc" : "#60a5fa" },
                    ]}
                  >
                    {itemType === "received" ? t("letters.badge.received") : t("letters.badge.sent")}
                  </Text>
                </View>
              )}

              {isSealedForMe ? (
                <LockedHourglassBadge
                  label={t("letters.card.locked", { date: dayjs(unlockDateStr).locale(i18n.language).format("DD MMM YYYY") })}
                  progress={sandProgress}
                />
              ) : (
                <View style={styles.unlockedBadge}>
                  {itemType === "sent" && isLockedDate ? (
                    <LockKeyhole size={12} color={isLight ? "#15803D" : "#22c55e"} />
                  ) : (
                    <Unlock size={12} color={isLight ? "#15803D" : "#22c55e"} />
                  )}
                  <Text style={styles.unlockedBadgeText}>
                    {itemType === "sent"
                      ? isLockedDate
                        ? t("letters.card.sealed", { date: dayjs(unlockDateStr).locale(i18n.language).format("DD MMM YYYY") })
                        : t("letters.card.sentStatus")
                      : t("letters.card.opened")}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.cardActionsRow}>
              {canOpen && itemType === "received" && <ChevronRight size={14} color={theme.textMuted} />}
              {canOpen && itemType === "sent" && (
                <ChevronDown
                  size={14}
                  color={theme.textMuted}
                  style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}
                />
              )}
              {isSealedForMe && <LockedLetterPadlock shakeKey={lockedTapKey} />}
              {/* Alıcı kilitli bir mektubu göremez; gizleme/silme seçenekleri açılmış ya da gönderilmiş mektuplarda */}
              {!isSealedForMe && (
                <TouchableOpacity
                  onPress={() => openLetterMenu(letter, itemType, isLockedDate)}
                  style={[styles.cardMoreBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)" }]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel={t("letters.card.optionsA11y")}
                >
                  <MoreHorizontal size={16} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Mektup Başlığı */}
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            {canOpen ? letter.title : t("letters.card.lockedTitle")}
          </Text>

          {/* Gönderen / Alıcı Bilgisi & Yazılma Tarihi */}
          <View style={styles.personRow}>
            <View style={styles.personInfoLeft}>
              <UserAvatar uri={personAvatarUrl} name={personName} size={22} borderWidth={1} />
              <Text style={[styles.personText, { color: theme.textSecondary }]} numberOfLines={1}>
                {itemType === "received" ? t("letters.card.from", { personName }) : t("letters.card.to", { personName })}
              </Text>
            </View>
            <Text style={[styles.cardDate, { color: theme.textMuted }]}>{relativeDate}</Text>
          </View>

          {/* Kapalı Durumdayken Kısa Önizleme */}
          {!isOpen && (
            <Text 
              style={[
                styles.previewText, 
                { color: theme.textSecondary },
                isLockedDate && itemType === "received" && styles.previewTextBlurred
              ]} 
              numberOfLines={2}
            >
              {canOpen
                ? letterContent
                : t("letters.card.lockedNote")}
            </Text>
          )}

          {/* Açık Durumdaki Tam Mektup İçeriği */}
          {canOpen && isOpen && (
            <View style={[styles.letterContentBox, { borderTopColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)" }]}>
              <View style={styles.letterContentHeaderRow}>
                <Text style={[styles.letterContentLabel, { color: theme.accent }]}>{t("letters.card.content")}</Text>
              </View>
              <Text style={[styles.letterContentText, { color: theme.text }]}>{letterContent}</Text>
              {unlockDateStr ? (
                <Text style={[styles.letterFooterNote, { color: theme.textMuted }]}>
                  {t("letters.card.openingDate", { date: dayjs(unlockDateStr).locale(i18n.language).format("DD MMMM YYYY") })}
                </Text>
              ) : null}
            </View>
          )}

          {isSealedForMe && <LockedLetterPill showKey={lockedTapKey} daysLeft={daysUntilOpen} />}
        </TouchableOpacity>

        {/* Alıcının kararı: onay vermeden mektup silinmez */}
        {itemType === "received" && deletion === "pending" && (
          <View style={styles.deletionRequestBox}>
            <View style={styles.deletionRequestRow}>
              <Hourglass size={15} color={amber} />
              <Text style={[styles.deletionRequestText, { color: theme.text }]}>
                {t("letters.card.deletionAsk")}
              </Text>
            </View>
            <View style={styles.policyActions}>
              <TouchableOpacity
                style={[styles.policyBtn, { backgroundColor: theme.unitBg, borderColor: theme.cardBorder }]}
                onPress={() => respondToDeletion(letter, false)}
                disabled={isBusy}
                activeOpacity={0.85}
              >
                <Text style={[styles.policyBtnText, { color: theme.text }]}>{t("letters.card.keepIt")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.policyBtn, { backgroundColor: theme.accent, borderColor: theme.accent }]}
                onPress={() => handleApproveDeletion(letter)}
                disabled={isBusy}
                activeOpacity={0.85}
              >
                {isBusy ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={[styles.policyBtnText, { color: "#ffffff" }]}>{t("letters.card.allowDeletion")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {deletionNote && (
          <View style={styles.policyStrip}>
            {deletionNote.icon}
            <Text style={[styles.policyStripText, { color: theme.textSecondary }]}>{deletionNote.text}</Text>
            {deletionNote.action && (
              <TouchableOpacity
                onPress={deletionNote.action.onPress}
                disabled={isBusy}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.policyLink, { color: theme.accent }]}>{deletionNote.action.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {isHiddenView && (
          <View style={styles.policyStrip}>
            <EyeOff size={14} color={theme.textMuted} />
            <Text style={[styles.policyStripText, { color: theme.textMuted }]}>{t("letters.card.hiddenOnlyForYou")}</Text>
            <TouchableOpacity
              onPress={() => handleSetHidden(letter, false)}
              disabled={isBusy}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.policyLink, { color: theme.accent }]}>{t("letters.card.bringBack")}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      </Reveal>
    );
  }, [
    theme.cardBg, theme.cardBorder, theme.text, theme.textMuted, theme.textSecondary, theme.accent, theme.unitBg,
    isLight, userId, openLetterId, activeTab, getAvatarUrl, busyLetterId, isHiddenView, lockedTap,
    openLetterMenu, handleSetHidden, handleCancelDeletion, respondToDeletion, handleApproveDeletion,
    t, i18n.language,
  ]);

  const keyExtractor = useCallback((item: any) => item.id.toString(), []);

  if (!session && !isDemoMode) return <View style={{ flex: 1, backgroundColor: "#0a0a0f" }} />;

  const currentList = activeTab === "all" ? allLetters : activeTab === "received" ? receivedLetters : sentLetters;
  // Sayfalama sunucudan gelen listeye göre yapılır: gizlenenler görünmese de daha eski mektuplar olabilir
  const fetchedList =
    (activeTab === "all" ? data?.all : activeTab === "received" ? data?.received : data?.sent) || [];

  return (
    <ScreenBackground>
      <View style={{ flex: 1 }}>
        {/* HEADER - Diğer tüm sayfalarla simetrik ve tam uyumlu */}
        <ScreenHeader title={t("tabs.letters.label")} subtitle={t("letters.subtitle")} onOpenTour={openTour} actions={
          <ScreenHeaderButton label={t("a11y.edit")} 
              onPress={handleOpenWriteModal} 
            >
              <PenLine color={theme.accent} size={19} />
            </ScreenHeaderButton>
        } />

        {/* Tek kalan: mektup eşleşme ister; kendi yazdığı eski mektuplar aşağıda durur */}
        <SoloFeatureBanner style={{ marginHorizontal: 16, marginBottom: 10 }} />

        {/* Premium olmayanlar için: reklam izleyerek mektup token'ı kazanma kartı */}
        {!isPremium && (
          <View style={styles.topActionContainer}>
            <LetterAdCard theme={theme} tokenBalance={tokenBalance} onPress={() => setShowAdModal(true)} />
          </View>
        )}

        {/* ÜSTTE HIZLI MEKTUP YAZ BUTONU */}
        <View style={styles.topActionContainer}>
          <ActionCard
            icon={PenLine}
            title={t("letters.write.cta")}
            subtitle={t("letters.write.ctaSub")}
            theme={theme}
            onPress={handleOpenWriteModal}
          />
        </View>

        {/* SEKME ÇUBUĞU (TÜMÜ / GELENLER / GÖNDERİLENLER) */}
        <View style={styles.tabsWrapper}>
          <SegmentedControl
            theme={theme}
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { key: "all", label: t("letters.filters.all", { total: allLetters.length }) },
              { key: "received", label: t("letters.filters.received", { total: receivedLetters.length }) },
              { key: "sent", label: t("letters.filters.sent", { total: sentLetters.length }) },
            ]}
          />
        </View>

        {/* Partnerin silme isteği: karar verilene kadar burada hatırlatılır */}
        {!isHiddenView && pendingApprovalCount > 0 && (
          <TouchableOpacity
            style={styles.approvalBanner}
            onPress={() => setActiveTab("received")}
            activeOpacity={0.85}
          >
            <Hourglass size={16} color={isLight ? "#B45309" : "#f59e0b"} />
            <Text style={[styles.approvalBannerText, { color: isLight ? "#92400E" : "#FCD34D" }]}>
              {pendingApprovalCount === 1
                ? t("letters.approvalBanner.one")
                : t("letters.approvalBanner.many", { total: pendingApprovalCount })}
            </Text>
            <ChevronRight size={16} color={isLight ? "#B45309" : "#f59e0b"} />
          </TouchableOpacity>
        )}

        {/* Gizlenenler: yalnızca bakan kişinin listesinden kaldırılmış mektuplar */}
        {hiddenCount > 0 && (
          <View style={styles.hiddenBar}>
            {isHiddenView ? (
              <Text style={[styles.hiddenBarText, { color: theme.textMuted }]}>
                {t("letters.hiddenNote")}
              </Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <TouchableOpacity
              style={[
                styles.hiddenTogglePill,
                {
                  backgroundColor: isHiddenView ? theme.pillAccentBg : theme.cardBg,
                  borderColor: isHiddenView ? theme.accent : theme.cardBorder,
                },
              ]}
              onPress={() => setShowHidden(!isHiddenView)}
              activeOpacity={0.85}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              {isHiddenView ? (
                <Eye size={13} color={theme.accent} />
              ) : (
                <EyeOff size={13} color={theme.textSecondary} />
              )}
              <Text style={[styles.hiddenToggleText, { color: isHiddenView ? theme.accent : theme.textSecondary }]}>
                {isHiddenView ? t("letters.backToMine") : t("letters.hiddenTab", { total: hiddenCount })}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* MEKTUP LİSTESİ */}
        {isLoading ? (
          <View style={{ paddingHorizontal: 16, gap: 14, marginTop: 10 }}>
            <Skeleton height={120} borderRadius={18} />
            <Skeleton height={120} borderRadius={18} />
            <Skeleton height={120} borderRadius={18} />
          </View>
        ) : (
          <FlatList
            data={currentList}
            keyExtractor={keyExtractor}
            renderItem={renderLetterItem}
            refreshing={lettersRefreshing}
            onRefresh={onRefreshLetters}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 130 }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              isHiddenView ? (
                <EmptyState
                  emoji="🙈"
                  title={t("letters.empty.hiddenTitle")}
                  description={t("letters.empty.hiddenDescription")}
                  ctaLabel={t("letters.backToMine")}
                  onPressCta={() => setShowHidden(false)}
                  theme={theme}
                />
              ) : (
              <EmptyState
                illustrationType="letters"
                // Gelen kutusu sessiz: uyuyan kedi ilk satırları bekliyor. Gönderilenler sekmesi ise ilk mektuba çağırır
                title={activeTab === "sent" ? t("letters.empty.firstMarkTitle") : t("empty.lettersTitle")}
                description={
                  activeTab === "sent"
                    ? t("letters.empty.firstMarkDescription")
                    : t("empty.lettersDesc")
                }
                ctaLabel={t("letters.empty.cta")}
                onPressCta={handleOpenWriteModal}
                theme={theme}
              />
              )
            }
            ListFooterComponent={
              fetchedList.length >= pageLimit ? (
                <TouchableOpacity 
                  style={[styles.loadMoreBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow }]}
                  onPress={() => setPageLimit((prev) => prev + 15)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.loadMoreText, { color: theme.accent }]}>
                    {t("letters.loadMore", { shown: currentList.length })}
                  </Text>
                </TouchableOpacity>
              ) : null
            }
            onEndReached={() => {
              if (fetchedList.length >= pageLimit) {
                setPageLimit((prev) => prev + 15);
              }
            }}
            onEndReachedThreshold={0.4}
          />
        )}

      </View>

      {/* YENİ MEKTUP YAZMA MODALI (Modern, temiz ve klavye duyarlı!) */}
      <Modal
        visible={showWriteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowWriteModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, ...theme.cardShadow, paddingBottom: insets.bottom + 20 }]}>
            {/* Modal Başlık Çubuğu */}
            <View style={[styles.modalHeader, { borderBottomColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <PenLine size={20} color={theme.accent} />
                <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>{t("letters.compose.title")}</Text>
              </View>

              <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("a11y.close")} 
                onPress={() => setShowWriteModal(false)}
                style={[styles.modalCloseBtn, { backgroundColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)" }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 60, gap: 16 }}
              enableOnAndroid={true}
              enableAutomaticScroll={true}
              extraScrollHeight={160}
              extraHeight={160}
              keyboardOpeningTime={250}
              keyboardShouldPersistTaps="handled"
            >
                {/* KİME ALANI */}
                <View>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }, errors.receiver && { color: "#D85F78" }]}>
                    {t("letters.compose.toLabel")}
                  </Text>
                  <View style={styles.usersSelectorRow}>
                    {users?.map((u) => {
                      const isSelected = receiverId === String(u.id);
                      return (
                        <TouchableOpacity
                          key={u.id}
                          style={[
                            styles.userPillBtn,
                            { 
                              backgroundColor: theme.unitBg,
                              borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.08)"
                            },
                            isSelected && { 
                              borderColor: theme.accent, 
                              backgroundColor: theme.pillAccentBg,
                              borderWidth: 1.5
                            }
                          ]}
                          onPress={() => {
                            setReceiverId(String(u.id));
                            setErrors(prev => ({ ...prev, receiver: false }));
                          }}
                        >
                          <UserCheck size={16} color={isSelected ? theme.accent : theme.textMuted} />
                          <Text 
                            style={[
                              styles.userPillText, 
                              { color: isSelected ? theme.accent : theme.textSecondary },
                              isSelected && { fontFamily: "Inter_700Bold" }
                            ]}
                          >
                            {readableName(u.display_name) || readableName(u.username) || t("letters.myLoveHeart")}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    {(!users || users.length === 0) && (
                      <View style={[styles.userPillBtn, { backgroundColor: theme.unitBg, flex: 1 }]}>
                        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                          {t("letters.compose.partnerNotPaired")}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* AÇILIŞ TARİHİ (KİLİT) */}
                <View>
                  <View style={styles.fieldLabelRow}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t("letters.compose.unlockDateLabel")}</Text>
                    <View style={[styles.lockHintPill, { backgroundColor: theme.pillAccentBg }]}>
                      <LockKeyhole size={11} color={theme.accent} />
                      <Text style={[styles.lockHintText, { color: theme.accent }]}>{t("letters.compose.timeLock")}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.dateSelectorBtn, 
                      { 
                        backgroundColor: theme.unitBg,
                        borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.08)"
                      }
                    ]}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <CalendarIcon size={18} color={theme.accent} />
                      <Text style={[styles.dateSelectorText, { color: theme.text }]}>
                        {dayjs(unlockDate).locale(i18n.language).format("DD MMMM YYYY, dddd")}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={theme.textMuted} />
                  </TouchableOpacity>

                  <LazyDateTimePickerSheet
                    visible={showDatePicker}
                    mode="date"
                    title={t("letters.compose.unlockDateTitle")}
                    value={dayjs(unlockDate).toDate()}
                    minimumDate={dayjs().startOf("day").toDate()}
                    onCancel={() => setShowDatePicker(false)}
                    onConfirm={(selectedDate) => {
                      setShowDatePicker(false);
                      setUnlockDate(dayjs(selectedDate).format("YYYY-MM-DD"));
                    }}
                  />
                </View>

                {/* MEKTUP BAŞLIĞI */}
                <View>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }, errors.title && { color: "#D85F78" }]}>
                    {t("letters.compose.titleLabel")}
                  </Text>
                  <TextInput
                    style={[
                      styles.inputField, 
                      { 
                        backgroundColor: theme.unitBg,
                        color: theme.text,
                        borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.08)"
                      },
                      errors.title && styles.inputError
                    ]}
                    value={title}
                    onChangeText={(text) => {
                      setTitle(text);
                      setErrors(prev => ({ ...prev, title: false }));
                    }}
                    placeholder={t("letters.compose.titlePlaceholder")}
                    placeholderTextColor={isLight ? theme.textMuted : "rgba(255,255,255,0.3)"}
                    maxLength={100}
                  />
                </View>

                {/* MEKTUP İÇERİĞİ */}
                <View>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }, errors.content && { color: "#D85F78" }]}>
                    {t("letters.compose.contentLabel")}
                  </Text>
                  <TextInput
                    style={[
                      styles.inputField, 
                      styles.textAreaField, 
                      { 
                        backgroundColor: theme.unitBg,
                        color: theme.text,
                        borderColor: isLight ? theme.inputBorder : "rgba(255,255,255,0.08)"
                      },
                      errors.content && styles.inputError
                    ]}
                    value={content}
                    onChangeText={(text) => {
                      setContent(text);
                      setErrors(prev => ({ ...prev, content: false }));
                    }}
                    placeholder={t("letters.compose.contentPlaceholder")}
                    placeholderTextColor={isLight ? theme.textMuted : "rgba(255,255,255,0.3)"}
                    multiline
                    numberOfLines={6}
                    maxLength={4000}
                  />
                </View>

                {/* MÜHÜRLE BUTONU (Sarı kaldırıldı, modern theme.accent entegre edildi!) */}
                <TouchableOpacity 
                  style={[
                    styles.sealBtn, 
                    { backgroundColor: theme.accent, shadowColor: theme.accent },
                    loadingForm && { opacity: 0.75 }
                  ]} 
                  onPress={confirmAndSave}
                  disabled={loadingForm}
                  activeOpacity={0.88}
                >
                  {loadingForm ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Send size={18} color="#ffffff" />
                      <Text style={styles.sealBtnText}>{t("letters.compose.submit")}</Text>
                    </>
                  )}
                </TouchableOpacity>

                {!isPremium && (
                  <Text style={[styles.tokenNoticeText, { color: theme.textMuted }]}>
                    {t("letters.compose.tokenNote", { balance: tokenBalance })}
                  </Text>
                )}
            </KeyboardAwareScrollView>
          </View>
        </View>
        {/* Bu modal açıkken uyarılar/diyaloglar (kök katman modalın arkasında kalır) burada çizilir */}
        <DialogHost embedded visible={showWriteModal} />
      </Modal>

      {/* Premium Paywall Modal */}
      <LazyPremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureName={t("letters.premium.featureName")}
        featureDescription={t("letters.premium.featureDescription")}
        gender={profile?.gender}
        onWatchAd={() => {
          setShowPaywall(false);
          setShowAdModal(true);
        }}
      />

      <LazyWatchAdModal
        visible={showAdModal}
        onClose={() => setShowAdModal(false)}
        onSuccess={() => setShowAdModal(false)}
      />

      <LazyOrigamiBirdAnimation
        visible={showOrigamiAnimation}
        onComplete={() => {
          setShowOrigamiAnimation(false);
          // Kuş uçup gidince bloklayıcı bir kart yerine süzülen başarı pili.
          toast.success(t("letters.toasts.sealed"), { delay: 250, haptic: false });
          // Bildirim ön-onay kartı, başarı pili görülebilsin diye biraz sonra gösterilir
          setTimeout(() => priming.maybePrompt(), 2800);
        }}
        accentColor={theme.accent}
      />
      <LazyLetterReadingModal
        visible={readingLetter !== null}
        letter={readingLetter}
        theme={theme}
        onClose={() => setReadingLetter(null)}
        onFirstOpened={() => {
          // Zamana kilitli mektubun mührü ilk kez kırıldı: duygusal an (demo hesapta istenmez)
          if (!isDemoMode) void requestReviewAtMoment("letter_first_open");
        }}
      />
      <LazyPermissionPrimingModal
        visible={priming.isVisible}
        onAccept={priming.accept}
        onDismiss={priming.dismiss}
      />
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

const createStyles = (theme: AppTheme) => {
  const isLight = theme.isLight;

  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 14,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
      borderWidth: 1,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitleBox: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 8,
    },
    headerTitle: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      letterSpacing: -0.4,
    },
    headerSubtitle: {
      fontSize: 12.5,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.6)",
      marginTop: 2,
    },
    topActionContainer: {
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    writeLetterActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderRadius: 24,
      gap: 14,
    },
    writeActionIconCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
    },
    writeActionTitle: {
      fontSize: 15,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      letterSpacing: -0.2,
    },
    writeActionSub: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.55)",
      marginTop: 2,
    },
    tabsWrapper: {
      marginHorizontal: 16,
      marginBottom: 14,
    },
    tabBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    tabText: {
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.5)",
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 130,
      gap: 12,
    },
    letterCard: {
      borderRadius: 28,
      padding: 18,
    },
    letterCardLocked: {
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.15)",
    },
    cardTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    badgeContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
      marginRight: 8,
    },
    cardActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 0,
    },
    directionBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 8,
      paddingVertical: 3.5,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
    },
    directionBadgeText: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
    },
    unlockedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: "rgba(34,197,94,0.12)",
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(34,197,94,0.25)",
      maxWidth: "100%",
    },
    unlockedBadgeText: {
      color: isLight ? "#15803D" : "#22c55e",
      fontSize: 11.5,
      fontFamily: "Inter_600SemiBold",
    },
    cardDate: {
      fontSize: 11.5,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.4)",
      flexShrink: 0,
    },
    cardTitle: {
      fontSize: 16,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      letterSpacing: -0.3,
      marginBottom: 4,
    },
    personRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 8,
    },
    personInfoLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flex: 1,
      marginRight: 8,
    },
    personText: {
      fontSize: 12.5,
      fontFamily: "Inter_500Medium",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.6)",
      flexShrink: 1,
    },
    previewText: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.5)",
      lineHeight: 18,
    },
    previewTextBlurred: {
      opacity: 0.6,
      fontStyle: "italic",
    },
    letterContentBox: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
    },
    letterContentHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    letterContentLabel: {
      fontSize: 11,
      fontFamily: "Inter_700Bold",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    letterContentText: {
      fontSize: 14.5,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.text : "rgba(255,255,255,0.85)",
      lineHeight: 23,
    },
    letterFooterNote: {
      marginTop: 12,
      fontSize: 11.5,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.4)",
      textAlign: "right",
    },
    cardMoreBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 2,
    },

    /* GİZLEME VE SİLME İSTEĞİ */
    policyStrip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
    },
    policyStripText: {
      flex: 1,
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      lineHeight: 17,
    },
    policyLink: {
      fontSize: 12.5,
      fontFamily: "Inter_700Bold",
    },
    deletionRequestBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      backgroundColor: "rgba(245,158,11,0.10)",
      borderColor: "rgba(245,158,11,0.28)",
      gap: 10,
    },
    deletionRequestRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    deletionRequestText: {
      flex: 1,
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      lineHeight: 18,
    },
    policyActions: {
      flexDirection: "row",
      gap: 8,
    },
    policyBtn: {
      flex: 1,
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    policyBtnText: {
      fontSize: 13,
      fontFamily: "Inter_700Bold",
    },
    approvalBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 16,
      marginBottom: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 22,
      backgroundColor: "rgba(245,158,11,0.12)",
    },
    approvalBannerText: {
      flex: 1,
      fontSize: 12.5,
      fontFamily: "Inter_600SemiBold",
      lineHeight: 17,
    },
    hiddenBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 16,
      marginTop: -4,
      marginBottom: 12,
    },
    hiddenBarText: {
      flex: 1,
      fontSize: 11.5,
      fontFamily: "Inter_400Regular",
      lineHeight: 16,
    },
    hiddenTogglePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
    },
    hiddenToggleText: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
    },

    /* MODAL STILLERI */
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.75)",
      justifyContent: "flex-end",
    },
    modalBox: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: 1,
      padding: 20,
      height: "92%",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
    },
    modalHeaderTitle: {
      fontSize: 18,
      fontFamily: "Inter_700Bold",
      color: theme.text,
      letterSpacing: -0.3,
    },
    modalCloseBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)",
      alignItems: "center",
      justifyContent: "center",
    },
    fieldLabel: {
      fontSize: 11.5,
      fontFamily: "Inter_600SemiBold",
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.7)",
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    fieldLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    lockHintPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    lockHintText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
    },
    usersSelectorRow: {
      flexDirection: "row",
      gap: 10,
    },
    userPillBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
    },
    userPillText: {
      color: isLight ? theme.textSecondary : "rgba(255,255,255,0.8)",
      fontSize: 13.5,
      fontFamily: "Inter_600SemiBold",
    },
    dateSelectorBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
    },
    dateSelectorText: {
      color: theme.text,
      fontSize: 14,
      fontFamily: "Inter_500Medium",
    },
    inputField: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isLight ? theme.cardBorder : "rgba(255,255,255,0.08)",
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: theme.text,
      fontSize: 14,
      fontFamily: "Inter_400Regular",
    },
    textAreaField: {
      minHeight: 140,
      textAlignVertical: "top",
      lineHeight: 21,
    },
    inputError: {
      borderColor: "#D85F78",
      borderWidth: 1.5,
    },
    sealBtn: {
      height: 52,
      borderRadius: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 8,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 4,
    },
    sealBtnText: {
      color: "#ffffff",
      fontSize: 15.5,
      fontFamily: "Inter_700Bold",
      letterSpacing: -0.2,
    },
    tokenNoticeText: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: isLight ? theme.textMuted : "rgba(255,255,255,0.45)",
      textAlign: "center",
      lineHeight: 17,
    },
    loadMoreBtn: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 8,
      marginBottom: 20,
    },
    loadMoreText: {
      fontSize: 13.5,
      fontFamily: "Inter_600SemiBold",
    },
  });
};
