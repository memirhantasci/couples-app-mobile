import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { DateTimePickerSheet } from "@/components/ui/DateTimePickerSheet";
import { ScreenBackground } from "@/components/ui/ScreenBackground";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { setDatesSkipped } from "@/lib/datesSkip";
import { translateDatesError } from "@/lib/relationshipDates";
import { formatLongDate } from "@/lib/date";
import { toast } from "@/lib/toast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar, Check, ChevronRight, Heart, Sparkles } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { localizeServerError } from "@/lib/serverErrors";
import i18n from "@/lib/i18n";

// İlk kaydeden kazanır: partner tarihleri bizden önce kaydettiyse sayaçlar onun tarihinden başlar
function announcePartnerDates(relationshipStartDate: string) {
  toast.info(
    i18n.t("setup.dates.partnerSavedToast", { date: formatLongDate(relationshipStartDate, i18n.language) }),
    { title: i18n.t("setup.dates.partnerSavedTitle"), duration: 7000 }
  );
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function displayDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${day}.${month}.${year}`; // Matching mockup 14.02.2024
}

function WebDateInput({
  value,
  max,
  onChange,
}: {
  value: string;
  max: string;
  onChange: (val: string) => void;
}) {
  if (Platform.OS !== "web") return null;
  return React.createElement("input", {
    type: "date",
    value,
    max,
    onChange: (e: any) => onChange(e.target.value),
    onClick: (e: any) => {
      try {
        if (typeof e.target.showPicker === "function") {
          e.target.showPicker();
        }
      } catch {
        // silent catch
      }
    },
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      opacity: 0,
      cursor: "pointer",
      zIndex: 10,
    },
  });
}

export default function DatesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuth();
  const userId = session?.user?.id;
  // Kendi kaydımız sürerken gelen tarih değişikliği "partner kaydetti" diye duyurulmasın
  const savingRef = useRef(false);
  const relDateAtMountRef = useRef(profile?.relationshipStartDate ?? null);

  // Tanışma tarihi opsiyonel; yalnızca sevgili olma tarihi zorunlu
  const [meetDate, setMeetDate] = useState(new Date());
  const [relDate, setRelDate] = useState(new Date());
  const [includeMeetDate, setIncludeMeetDate] = useState(false);
  const [showMeetPicker, setShowMeetPicker] = useState(false);
  const [showRelPicker, setShowRelPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const today = new Date();

  useEffect(() => {
    async function loadExistingDates() {
      if (!userId) return;
      try {
        const { data: user } = await supabase
          .from("users")
          .select("couple_id")
          .eq("id", userId)
          .single();

        if (user?.couple_id) {
          const { data: couple } = await supabase
            .from("couples")
            .select("meet_date, relationship_start_date")
            .eq("id", user.couple_id)
            .single();

          if (couple) {
            // Sevgili olma tarihi varsa (tanışma tarihi olmasa bile) kurulum tamam
            if (couple.relationship_start_date) {
              await refreshProfile();
              router.replace("/(tabs)/home");
              return;
            }
            if (couple.meet_date) {
              const [y, m, d] = couple.meet_date.split("-").map(Number);
              setMeetDate(new Date(y, m - 1, d));
              setIncludeMeetDate(true);
            }
          }
        }
      } catch {
        // silent catch
      }
    }
    loadExistingDates();
  }, [userId, refreshProfile]);

  // Partner bu ekrandayken tarihleri kaydetti (realtime ile profil yenilendi). Ana sayfaya
  // yönlendirmeyi koruyucu (useProtectedRoute) yapar; burada yalnızca kullanıcıya neden olduğu söylenir.
  useEffect(() => {
    const next = profile?.relationshipStartDate;
    if (!next || relDateAtMountRef.current || savingRef.current) return;
    savingRef.current = true;
    announcePartnerDates(next);
  }, [profile?.relationshipStartDate]);

  function onMeetDateConfirm(selected: Date) {
    setShowMeetPicker(false);
    setMeetDate(selected);
  }

  function onRelDateConfirm(selected: Date) {
    setShowRelPicker(false);
    setRelDate(selected);
  }

  function toggleMeetDate() {
    const next = !includeMeetDate;
    setIncludeMeetDate(next);
    setShowMeetPicker(false);
    setError("");
    // Tanışma tarihi sevgili olma tarihinden sonra olamaz
    if (next && formatDate(meetDate) > formatDate(relDate)) setMeetDate(relDate);
  }

  async function handleSave() {
    // Gün bazında string karşılaştırma (YYYY-MM-DD) saat farkından etkilenmez
    const todayStr = formatDate(today);
    const relStr = formatDate(relDate);

    if (relStr > todayStr) {
      setError(t("setup.errors.futureDate"));
      return;
    }
    if (includeMeetDate) {
      const meetStr = formatDate(meetDate);
      if (meetStr > todayStr) {
        setError(t("setup.dates.meetFuture"));
        return;
      }
      if (meetStr > relStr) {
        setError(t("setup.errors.meetAfterRelationship"));
        return;
      }
    }

    if (!userId) {
      setError(t("auth.errors.noSession"));
      return;
    }
    setIsLoading(true);
    setError("");
    savingRef.current = true;

    try {
      // Sunucu satırı kilitler: iki partner aynı saniyede kaydetse bile yalnızca ilk kayıt yazılır,
      // sonraki kayıt ilk tarihi ezmez ve değişiklik hakkı harcamaz
      const { data, error: saveError } = await supabase.rpc("set_initial_relationship_dates", {
        p_relationship_start_date: relStr,
        p_meet_date: includeMeetDate ? formatDate(meetDate) : null,
      });

      if (saveError) {
        savingRef.current = false;
        setError(translateDatesError(saveError.message));
        return;
      }

      const result = Array.isArray(data) ? data[0] : data;
      if (result && !result.result_applied && result.result_relationship_start_date) {
        announcePartnerDates(result.result_relationship_start_date);
      }

      await refreshProfile();
      router.replace("/(tabs)/home");
    } catch (err: any) {
      savingRef.current = false;
      setError(t("errors.unexpectedWithMessage", { message: localizeServerError(err, "") }));
    } finally {
      setIsLoading(false);
    }
  }

  // Tarihler profilden her zaman girilebilir; kullanıcıyı bu adımda bekletmeyiz
  async function handleSkip() {
    if (!userId) return;
    setIsLoading(true);
    setError("");
    try {
      await setDatesSkipped(userId);
      await refreshProfile();
      router.replace("/(tabs)/home");
    } catch (err: any) {
      setError(t("errors.genericWithMessage", { message: localizeServerError(err, "") }));
    } finally {
      setIsLoading(false);
    }
  }

  const meetMax = formatDate(formatDate(relDate) < formatDate(today) ? relDate : today);

  return (
    <ScreenBackground colors={["#0A0A10", "#0D0D14", "#0A0A10"]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ alignItems: "center", marginBottom: 40 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "rgba(255,255,255,0.03)",
              borderWidth: 1,
              borderColor: "#FF4D6A",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Calendar color="#FF4D6A" size={32} />
          </View>

          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 30,
              fontFamily: "Inter_700Bold",
              letterSpacing: -0.5,
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            {t("setup.dates.title")}
          </Text>
          <Text
            style={{
              color: "rgba(255,255,255,0.6)",
              fontSize: 14,
              textAlign: "center",
            }}
          >
            {t("setup.dates.subtitle")}
          </Text>
        </View>

        {/* Kart 1 — Ana ve zorunlu: Sevgili Olma / Yıl Dönümü Tarihi */}
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS !== "web") setShowRelPicker(true);
          }}
          activeOpacity={0.8}
          style={{
            backgroundColor: "rgba(255,255,255,0.02)",
            borderWidth: 1,
            borderColor: "rgba(255, 77, 106, 0.35)",
            borderRadius: 20,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 16,
            position: "relative",
          }}
        >
          <WebDateInput
            value={formatDate(relDate)}
            max={formatDate(today)}
            onChange={(val) => {
              if (val) {
                const [y, m, d] = val.split("-").map(Number);
                setRelDate(new Date(y, m - 1, d));
              }
            }}
          />

          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: "rgba(0,0,0,0.3)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 16,
            }}
          >
            <Heart color="#FF4D6A" size={22} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 2 }}>
              {t("setup.dates.relationshipLabel")}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
              {t("setup.dates.relationshipHint")}
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600", letterSpacing: 1 }}>
              {displayDate(relDate)}
            </Text>
            <ChevronRight color="rgba(255,255,255,0.3)" size={20} />
          </View>
        </TouchableOpacity>

        {/* Kart 2 — Opsiyonel: Tanışma Tarihi */}
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.02)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.06)",
            borderRadius: 20,
            padding: 16,
            marginBottom: 32,
          }}
        >
          <TouchableOpacity
            onPress={toggleMeetDate}
            activeOpacity={0.8}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                borderWidth: 1.5,
                borderColor: includeMeetDate ? "#FF4D6A" : "rgba(255,255,255,0.25)",
                backgroundColor: includeMeetDate ? "#FF4D6A" : "rgba(255,255,255,0.05)",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 14,
              }}
            >
              {includeMeetDate && <Check color="#FFFFFF" size={14} strokeWidth={3} />}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 2 }}>
                {t("setup.dates.meetLabel")}
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
                {t("setup.dates.meetHint")}
              </Text>
            </View>
          </TouchableOpacity>

          {includeMeetDate ? (
            <TouchableOpacity
              onPress={() => {
                if (Platform.OS !== "web") setShowMeetPicker(true);
              }}
              activeOpacity={0.8}
              style={{
                backgroundColor: "rgba(0,0,0,0.25)",
                borderRadius: 16,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                marginTop: 14,
                position: "relative",
              }}
            >
              <WebDateInput
                value={formatDate(meetDate)}
                max={meetMax}
                onChange={(val) => {
                  if (val) {
                    const [y, m, d] = val.split("-").map(Number);
                    setMeetDate(new Date(y, m - 1, d));
                  }
                }}
              />

              <Sparkles color="#FF4D6A" size={20} style={{ marginRight: 12 }} />
              <Text style={{ flex: 1, color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                {t("setup.dates.meetDay")}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600", letterSpacing: 1 }}>
                  {displayDate(meetDate)}
                </Text>
                <ChevronRight color="rgba(255,255,255,0.3)" size={20} />
              </View>
            </TouchableOpacity>
          ) : (
            <Text
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 12.5,
                lineHeight: 18,
                marginTop: 12,
                marginLeft: 36,
              }}
            >
              {t("setup.dates.meetOptionalNote")}
            </Text>
          )}
        </View>

        {!!error && (
          <View
            style={{
              backgroundColor: "rgba(232,0,45,0.1)",
              borderWidth: 1,
              borderColor: "rgba(232,0,45,0.3)",
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: "#FF4D6A", fontSize: 14, textAlign: "center" }}>
              {error}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={handleSave}
          disabled={isLoading}
          activeOpacity={0.85}
          style={{ borderRadius: 30, overflow: "hidden", opacity: isLoading ? 0.7 : 1 }}
        >
          <LinearGradient
            colors={["#FF4D6A", "#9B4DFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingVertical: 18,
              alignItems: "center",
              borderRadius: 30,
              shadowColor: "#9B4DFF",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4,
              shadowRadius: 14,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 17 }}>
                {t("setup.dates.submit")}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSkip}
          disabled={isLoading}
          activeOpacity={0.7}
          style={{
            marginTop: 14,
            paddingVertical: 15,
            alignItems: "center",
            borderRadius: 30,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.14)",
            opacity: isLoading ? 0.5 : 1,
          }}
        >
          <Text style={{ color: "rgba(255,255,255,0.7)", fontWeight: "600", fontSize: 15 }}>
            {t("setup.dates.later")}
          </Text>
        </TouchableOpacity>

      </ScrollView>

      {/* iOS ve Android: ortak tarih seçici (web'de tarayıcının kendi tarih girdisi kullanılır) */}
      {Platform.OS !== "web" && (
        <>
          <DateTimePickerSheet
            visible={includeMeetDate && showMeetPicker}
            mode="date"
            title={t("setup.dates.meetPickerTitle")}
            value={meetDate}
            maximumDate={formatDate(relDate) < formatDate(today) ? relDate : today}
            onCancel={() => setShowMeetPicker(false)}
            onConfirm={onMeetDateConfirm}
          />
          <DateTimePickerSheet
            visible={showRelPicker}
            mode="date"
            title={t("setup.dates.relationshipPickerTitle")}
            value={relDate}
            maximumDate={today}
            onCancel={() => setShowRelPicker(false)}
            onConfirm={onRelDateConfirm}
          />
        </>
      )}
    </ScreenBackground>
  );
}
