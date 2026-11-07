import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Expo "DeviceNotRegistered" dönen (uygulama silinmiş / token geçersiz) token'ları siler; yanıt sırası mesaj sırasıyla aynıdır. */
async function pruneDeadTokens(admin: any, messages: { to: string }[], expoResult: any): Promise<void> {
  const tickets = expoResult?.data;
  if (!Array.isArray(tickets)) return;
  const dead = tickets
    .map((ticket: any, i: number) =>
      ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered" ? messages[i]?.to : null
    )
    .filter((token: unknown): token is string => typeof token === "string");
  if (dead.length === 0) return;
  const { error } = await admin.from("push_tokens").delete().in("token", dead);
  if (error) console.error("Dead push token cleanup failed:", error.message);
}

/**
 * Zamanlanmış işlerin aynı bildirimi tekrar göndermesini önler (cron sıklığı ne olursa olsun; bkz. push_dedupe tablosu,
 * migration 20261030000004). Anahtar: iş + (mektup/buluşma kimliği) + token. Tablo yoksa ya da okunamazsa göndermeye devam edilir.
 */
const DEDUPE_TTL_HOURS: Record<string, number> = {
  letter_unlock: 72,
  period_reminder: 20,
  anniversary_reminder: 20,
  meeting_reminder: 24,
  inactivity_reminder: 168,
  vault_expiry_reminder: 168,
  // Aşama (3 gün / 1 gün; 7 gün / 1 gün) ve silinme günü anahtarda: her aşama kişi başına bir kez
  account_deletion_reminder: 120,
  inactive_account_reminder: 240,
};

async function dropAlreadySent(admin: any, job: string, messages: any[]): Promise<any[]> {
  const ttl = DEDUPE_TTL_HOURS[job];
  if (!ttl || messages.length === 0) return messages;
  // vaultStage: kasa uyarısının aşaması (7 gün / 1 gün); her aşama kişi başına bir kez gönderilir
  const keyOf = (m: any) => `${job}:${m.data?.letterId ?? m.data?.meetingId ?? m.data?.vaultStage ?? m.data?.dedupeStage ?? ""}:${m.to}`;
  const keys = [...new Set(messages.map(keyOf))];
  const since = new Date(Date.now() - ttl * 60 * 60 * 1000).toISOString();
  const already = new Set<string>();
  for (let i = 0; i < keys.length; i += 200) {
    const { data, error } = await admin.from("push_dedupe").select("key").in("key", keys.slice(i, i + 200)).gte("sent_at", since);
    if (error) {
      console.error("push_dedupe okunamadı, tekrar önleme atlandı:", error.message);
      return messages;
    }
    for (const row of data ?? []) already.add(row.key);
  }
  const fresh = messages.filter((m) => !already.has(keyOf(m)));
  const rows = [...new Set(fresh.map(keyOf))].map((key) => ({ key, sent_at: new Date().toISOString() }));
  if (rows.length > 0) {
    const { error } = await admin.from("push_dedupe").upsert(rows, { onConflict: "key" });
    if (error) console.error("push_dedupe yazılamadı:", error.message);
  }
  return fresh;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dil: istemci, push token'ını kaydederken uygulamanın seçili dilini `push_tokens.language`
// sütununa yazar (tr | en; bkz. migration 025_push_token_language.sql). Sütun henüz yoksa ya da
// değer boşsa Türkçe (varsayılan) kullanılır; bildirimler asla dil yüzünden gönderilmez olmaz.
// ─────────────────────────────────────────────────────────────────────────────
type Lang = "tr" | "en";
const toLang = (value: unknown): Lang => (value === "en" ? "en" : "tr");

// Türkçe tamlayan eki ad sonuna göre değişir (Ayşe'nin, Burak'ın, Cem'in). Aynı kural: src/lib/turkishSuffix.ts
function trGenitive(name: string): string {
  const lower = name.replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
  const letters = lower.replace(/[^a-zçğıöşüâîû]/g, "");
  if (!letters) return name;
  const vowels = "aeıioöuüâîû";
  const endsWithVowel = vowels.includes(letters[letters.length - 1]);
  const lastVowel = [...letters].reverse().find((ch) => vowels.includes(ch)) ?? "e";
  const vowel = "aıâ".includes(lastVowel) ? "ı" : "eiî".includes(lastVowel) ? "i" : "ouû".includes(lastVowel) ? "u" : "ü";
  return `${name}'${endsWithVowel ? "n" : ""}${vowel}n`;
}
const localeOf = (lang: Lang) => (lang === "en" ? "en-US" : "tr-TR");

interface TokenRow {
  token: string;
  lang: Lang;
}

// push_tokens.user_id = int4 (users.id) — direct lookup, no UUID conversion
async function getTokensByUserId(supabase: any, intUserId: number | string): Promise<TokenRow[]> {
  let { data: rows, error } = await supabase.from("push_tokens").select("token, language").eq("user_id", intUserId);
  if (error) {
    // `language` sütunu henüz eklenmemişse yalnızca token okunur (Türkçe varsayılan)
    ({ data: rows } = await supabase.from("push_tokens").select("token").eq("user_id", intUserId));
  }
  return (rows ?? []).map((row: any) => ({ token: row.token, lang: toLang(row.language) }));
}

/** Cron işlerinde RPC yalnızca token döndürür; her token'ın dili ayrıca okunur. */
async function languagesByToken(supabase: any, tokens: (string | null | undefined)[]): Promise<Map<string, Lang>> {
  const map = new Map<string, Lang>();
  const unique = [...new Set(tokens.filter((token): token is string => !!token))];
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await supabase.from("push_tokens").select("token, language").in("token", unique.slice(i, i + 200));
    if (error) return map; // sütun yok → hepsi Türkçe
    for (const row of data ?? []) map.set(row.token, toLang(row.language));
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bildirim metinleri (Türkçe metinler eskisiyle birebir aynıdır)
// ─────────────────────────────────────────────────────────────────────────────
function S(lang: Lang) {
  const en = lang === "en";
  return {
    // Cron
    medicineDueTitle: en ? "💊 Time for Medicine!" : "💊 İlaç Vakti!",
    medicineDueBody: (name: string) =>
      en
        ? `It's time to take ${name ? `your ${name}` : "your medicine"}. Please mark it as taken.`
        : `${name || "Hatırlatıcı"} ilacını içme vaktin geldi. Lütfen içtiğini işaretle.`,
    periodReminderTitle: en ? "🩸 Period Reminder" : "🩸 Regl Hatırlatıcısı",
    periodReminderOwnBody: en ? "Your period is expected in 2 days." : "Tahmini regl tarihine 2 gün kaldı.",
    periodReminderPartnerBody: (name: string) =>
      en
        ? `${name}'s period is expected in 2 days. Get ready to support her 💕`
        : `${trGenitive(name)} tahmini regl tarihine 2 gün kaldı. Ona destek olmaya hazırlan 💕`,
    letterUnlockTitle: en ? "💌 Your Letter Is Unlocked!" : "💌 Mektubun Kilidi Açıldı!",
    letterUnlockBody: (sender: string, title: string) =>
      en
        ? title
          ? `The letter "${title}" that ${sender} wrote you is unlocked today! Read it now.`
          : `The surprise letter ${sender} wrote you is unlocked today! Read it now.`
        : title
          ? `${trGenitive(sender)} sana yazdığı "${title}" mektubunun kilidi bugün açıldı! Hemen oku.`
          : `${trGenitive(sender)} sana yazdığı sürpriz mektubun kilidi bugün açıldı! Hemen oku.`,
    meetingSoonTitle: en ? "⏳ Upcoming Meetup" : "⏳ Yaklaşan Buluşma",
    meetingSoonBody: (title: string) =>
      en
        ? `"${title || "Meetup"}" is almost here! Time to get ready.`
        : `"${title || "Buluşma"}" etkinliğine çok az kaldı! Hazırlanmaya başla.`,
    anniversaryTitle: en ? "🎉 Happy Anniversary!" : "🎉 Mutlu Yıllar!",
    // anniversary_type sunucuda Türkçe (ör. "yıl dönümü") tutulur; İngilizcede genel ifade kullanılır
    anniversaryBody: (years: number | string, type: string) =>
      en
        ? `Today is your ${years}-year anniversary! Here's to many more happy years together...`
        : `Bugün ${years}. ${type}nüz! Birlikte nice mutlu yıllara...`,
    vaultExpiryTitle: en ? "📦 Your photos are about to be deleted" : "📦 Fotoğrafların silinmek üzere",
    vaultExpiryBody: (stage: number, days: number) =>
      en
        ? stage === 1
          ? "Your vault ends within a day. If you don't renew Premium, your full-size photos and profile photos will be permanently deleted. Your written memories and letters stay."
          : `Your vault ends in ${days} days. If you don't renew Premium by then, your full-size photos and profile photos will be permanently deleted. Your written memories and letters stay.`
        : stage === 1
          ? "Kasa süren 1 günden az kalan sürede bitiyor. Premium'u yenilemezsen tam boy fotoğrafların ve profil fotoğrafların kalıcı olarak silinir. Yazılı anıların ve mektupların kalır."
          : `Kasa süren ${days} gün içinde bitiyor. O zamana kadar Premium'u yenilemezsen tam boy fotoğrafların ve profil fotoğrafların kalıcı olarak silinir. Yazılı anıların ve mektupların kalır.`,
    // Hesap silme hatırlatması (silmeye 3 gün ve 1 gün kala)
    deletionSelfTitle: en ? "⏳ Your account is being deleted" : "⏳ Hesabın siliniyor",
    deletionSelfBody: (days: number) =>
      en
        ? days <= 1
          ? "Your account will be permanently deleted tomorrow. To cancel, just sign in to the app."
          : `Your account will be permanently deleted in ${days} days. To cancel, just sign in to the app.`
        : days <= 1
          ? "Hesabın yarın kalıcı olarak silinecek. Vazgeçmek için uygulamaya giriş yapman yeterli."
          : `Hesabın ${days} gün sonra kalıcı olarak silinecek. Vazgeçmek için uygulamaya giriş yapman yeterli.`,
    deletionPartnerTitle: en ? "💔 Your partner's account is being deleted" : "💔 Partnerinin hesabı siliniyor",
    deletionPartnerBody: (days: number) =>
      en
        ? `Your partner's account will be deleted ${days <= 1 ? "tomorrow" : `in ${days} days`}. What they created will be deleted; everything you created stays.`
        : `Partnerinin hesabı ${days <= 1 ? "yarın" : `${days} gün sonra`} silinecek. Onun oluşturdukları silinecek; senin oluşturduklarının hepsi duracak.`,
    // Hareketsiz (eşleşmemiş) hesap temizliği: 7 gün ve 1 gün kala
    inactiveAccountTitle: en ? "🌙 Your account will be deleted" : "🌙 Hesabın silinecek",
    inactiveAccountBody: (days: number) =>
      en
        ? `You haven't opened the app for a long time, so your account will be deleted ${days <= 1 ? "tomorrow" : `in ${days} days`}. Just open the app to keep it.`
        : `Uzun süredir uygulamayı açmadığın için hesabın ${days <= 1 ? "yarın" : `${days} gün sonra`} silinecek. Hesabını korumak için uygulamayı açman yeterli.`,
    inactivityTitle: en ? "🥺 We Miss You" : "🥺 Seni Özledik",
    inactivityBody: en
      ? "It's been a while since you opened the app. Would you like to leave your partner a little note today?"
      : "Uygulamaya girmeyeli biraz zaman oldu, bugün partnerine küçük bir not bırakmak ister misin?",

    // Anlık (webhook)
    medicineTakenTitle: en ? "💊 Medicine Tracking" : "💊 İlaç Takibi",
    medicineTakenBody: (sender: string, medicine: string) =>
      en ? `${sender} took ${medicine ? `their ${medicine}` : "their daily medicine"} ✅` : `${sender} ${medicine || "günlük"} ilacını içti ✅`,
    medicineTakenAction: en ? "Go to Medicine Tracking 💊" : "İlaç Takibine Git 💊",
    letterNewTitle: en ? "💌 New Letter" : "💌 Yeni Mektup",
    letterNewBody: (sender: string, unlockDate: string | null) =>
      en
        ? unlockDate
          ? `${sender} wrote you a letter for the future! (Opens on ${unlockDate})`
          : `${sender} wrote you a letter!`
        : unlockDate
          ? `${sender} sana geleceğe bir mektup yazdı! (${unlockDate} tarihinde açılacak)`
          : `${sender} sana bir mektup yazdı!`,
    letterNewAction: en ? "Go to Letters 💌" : "Mektuplara Git 💌",
    periodStartedTitle: en ? "🩸 Period Calendar" : "🩸 Regl Takvimi",
    periodStartedBody: (sender: string) =>
      en ? `${sender}'s period has started. Don't forget to support her 💕` : `${trGenitive(sender)} regl dönemi başladı. Ona destek olmayı unutma 💕`,
    periodStartedAction: en ? "Go to Cycle Tracking 🌸" : "Döngü Takibine Git 🌸",
    moodTitle: en ? "💭 Mood Update" : "💭 Mod Güncellemesi",
    moodBody: (sender: string, mood: string) => (en ? `${sender} is feeling ${mood} today` : `${sender} bugün kendini ${mood} hissediyor`),
    moodAction: en ? "Reply with a Hug 🫂" : "Sarılarak Yanıtla 🫂",
    meetingNewTitle: en ? "🍽️ New Meetup" : "🍽️ Yeni Buluşma",
    meetingNewBody: (sender: string, date: string | null) =>
      en
        ? date
          ? `${sender} planned a meetup for ${date}!`
          : `${sender} planned a new meetup!`
        : date
          ? `${sender} ${date} için bir buluşma planladı!`
          : `${sender} yeni bir buluşma planladı!`,
    meetingNewAction: en ? "View Plan 🗓️" : "Planı Gör 🗓️",
    memoryNewTitle: en ? "🖼️ New Memory" : "🖼️ Yeni Anı",
    memoryNewBody: (sender: string) =>
      en ? `${sender} added a new memory to the shared album!` : `${sender} ortak albüme yeni bir anı ekledi!`,
    memoryNewAction: en ? "View Memory ✨" : "Anıyı Gör ✨",
    calendarNoteTitle: en ? "📅 Calendar Note" : "📅 Takvim Notu",
    calendarNoteBody: (sender: string) => (en ? `${sender} left a new note on the calendar.` : `${sender} takvime yeni bir not bıraktı.`),
    calendarNoteAction: en ? "Go to Calendar 📅" : "Takvime Git 📅",
    pairingTitle: en ? "💍 Pairing Complete!" : "💍 Eşleşme Başarılı!",
    pairingBody: en
      ? "Wonderful! You've been paired with your partner and can start using the app together."
      : "Harika! Partnerinle başarıyla eşleştiniz, uygulamayı birlikte kullanmaya başlayabilirsiniz.",
    noticeRequestedTitle: en ? "💔 Your partner wants to delete their account" : "💔 Partnerin hesabını silmek istiyor",
    noticeRequestedBody: (date: string) =>
      en
        ? `Their account is scheduled for deletion on ${date}. If it is deleted, everything they created will be deleted; everything you created stays. They can still change their mind until then.`
        : `Hesabı ${date} tarihinde silinecek. Silinirse onun oluşturduğu her şey silinir; senin oluşturduklarının hepsi durur. O zamana kadar partnerin vazgeçebilir.`,
    noticeCancelledTitle: en ? "💞 Your partner changed their mind" : "💞 Partnerin vazgeçti",
    noticeCancelledBody: en ? "They cancelled the account deletion. Everything stays as it is." : "Hesabını silmekten vazgeçti. Her şey yerinde duruyor.",
    noticeDissolvedTitle: en ? "Your partner deleted their account" : "Partnerin hesabını sildi",
    noticeDissolvedBody: en
      ? "Everything they created has been deleted; everything you created is still here. Your star and its planets have been deleted. You can pair with someone new."
      : "Onun oluşturduğu her şey silindi; senin oluşturduklarının hepsi duruyor. Yıldızınız ve içindeki gezegenler silindi. Yeni biriyle eşleşebilirsin.",
    // Süre ve jeton miktarı: referral_reward_period() / referral_reward_tokens() (migration 20261104000006)
    referralRewardTitle: en ? "🎁 Your invite paid off!" : "🎁 Davetiniz meyvesini verdi!",
    referralRewardBody: (reward: string) => {
      if (reward === "tokens") {
        return en
          ? "Your friends paired with their partner! 250 tokens each have been added for you both."
          : "Arkadaşlarınız sevgilisiyle eşleşti! İkinize de 250'şer jeton hediye edildi.";
      }
      if (reward === "quota_reached") {
        return en
          ? "Your friends paired and received their 3-day Premium gift. You've reached your invite reward limit, so no extra reward was added this time."
          : "Arkadaşlarınız eşleşti ve 3 günlük Premium hediyelerini aldı. Davet ödülü sınırınız dolduğu için bu kez size ödül eklenmedi.";
      }
      return en
        ? "Your friends paired with their partner! You both got 3 days of Premium as a gift."
        : "Arkadaşlarınız sevgilisiyle eşleşti! İkinize de 3 gün Premium hediye edildi.";
    },
  };
}

// Bildirime dokununca uygulamanın hangi ekranı açacağı (route), uygulama içi kartın türü ve
// Android bildirim kanalı da mesajla birlikte gider; istemci bunları data üzerinden okur.
function safePlaintextLabel(value: string | null | undefined, fallback: string): string {
  if (!value || typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("enc:")) return fallback;
  return trimmed;
}

interface PushMessage {
  title: string;
  body: string;
  type?: string;
  route?: string;
  actionLabel?: string;
  channelId?: string;
  extra?: Record<string, unknown>;
}

/** Alıcının diline göre mesaj kuran işlev (her token kendi dilinde alır). */
type MessageBuilder = (lang: Lang) => PushMessage;

async function sendToUser(supabase: any, intUserId: number | string, build: MessageBuilder, data: any = {}): Promise<any[]> {
  // Silinmek üzere olan hesap (oturumu kapalı) yalnızca kendi silme hatırlatmasını alır (cron işi), partnerin
  // etkinlik bildirimlerini değil
  const { data: pending } = await supabase.from("account_deletion_requests").select("user_id").eq("user_id", intUserId).maybeSingle();
  if (pending) return [];
  const rows = await getTokensByUserId(supabase, intUserId);
  return rows.map(({ token, lang }) => {
    const message = build(lang);
    return {
      to: token,
      sound: "default",
      title: message.title,
      body: message.body,
      channelId: message.channelId ?? "partner_messages",
      data: {
        ...data,
        ...(message.extra ?? {}),
        ...(message.type ? { type: message.type } : {}),
        ...(message.route ? { route: message.route } : {}),
        ...(message.actionLabel ? { actionLabel: message.actionLabel } : {}),
      },
    };
  });
}

serve(async (req) => {
  // Bu fonksiyon tüm kullanıcılara bildirim gönderebilir (CRON işleri) ve service_role ile çalışır.
  // Uygulamanın herkese açık anon anahtarıyla çağrılamaz: yalnızca service_role anahtarı (pg_cron / DB webhook)
  // ya da PUSH_WEBHOOK_SECRET ile gelen istekler kabul edilir.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  const authHeader = req.headers.get("Authorization") ?? "";
  const authorized =
    (!!serviceKey && authHeader === `Bearer ${serviceKey}`) ||
    (!!webhookSecret && req.headers.get("x-webhook-secret") === webhookSecret);
  if (!authorized) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const body = await req.json();

    // =====================================================================
    // 1. CRON JOBS
    // =====================================================================
    if (body.type === "CRON") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { job } = body;
      let pushMessages: any[] = [];
      const now = new Date();
      // Mektuplar Türkiye saatiyle gece yarısı açılır (public.app_today()); "bugün" Türkiye tarihidir
      const todayDateStr = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().split("T")[0];

      if (job === "medicine_reminder") {
        const trHourStr = ((now.getUTCHours() + 3) % 24).toString().padStart(2, "0");
        const minuteStr = now.getUTCMinutes().toString().padStart(2, "0");
        const currentTimeStr = `${trHourStr}:${minuteStr}`;

        const { data: reminders, error } = await supabase.rpc("get_active_medicine_reminders", { current_time_str: currentTimeStr });
        if (reminders && !error) {
          const langs = await languagesByToken(supabase, reminders.map((r: any) => r.push_token));
          for (const r of reminders) {
            const s = S(langs.get(r.push_token) ?? "tr");
            pushMessages.push({
              to: r.push_token,
              sound: "default",
              title: s.medicineDueTitle,
              body: s.medicineDueBody(safePlaintextLabel(r.medicine_name, "")),
              data: { type: "medicine_reminder", medicineId: r.medicine_id, route: "/(tabs)/medicine" }
            });
          }
        }
      }
      else if (job === "period_reminder") {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - 26);
        const targetDateStr = targetDate.toISOString().split("T")[0];

        const { data: reminders, error } = await supabase.rpc("get_active_period_reminders", { target_date_str: targetDateStr });
        if (reminders && !error) {
          const langs = await languagesByToken(
            supabase,
            reminders.flatMap((r: any) => [r.user_push_token, r.partner_push_token])
          );
          for (const r of reminders) {
            if (r.user_push_token) {
              const s = S(langs.get(r.user_push_token) ?? "tr");
              pushMessages.push({
                to: r.user_push_token,
                sound: "default",
                title: s.periodReminderTitle,
                body: s.periodReminderOwnBody,
                data: { type: "period_reminder", route: "/(tabs)/period-tracker" }
              });
            }
            if (r.partner_push_token) {
              const s = S(langs.get(r.partner_push_token) ?? "tr");
              pushMessages.push({
                to: r.partner_push_token,
                sound: "default",
                title: s.periodReminderTitle,
                body: s.periodReminderPartnerBody(r.display_name),
                data: { type: "period_reminder", route: "/(tabs)/period-tracker" }
              });
            }
          }
        }
      }
      else if (job === "letter_unlock") {
        const { data: reminders, error } = await supabase.rpc("get_letter_unlock_reminders", { today_date_str: todayDateStr });
        if (reminders && !error) {
          const langs = await languagesByToken(supabase, reminders.map((r: any) => r.push_token));
          for (const r of reminders) {
            const s = S(langs.get(r.push_token) ?? "tr");
            pushMessages.push({
              to: r.push_token,
              sound: "default",
              title: s.letterUnlockTitle,
              body: s.letterUnlockBody(r.sender_display_name, safePlaintextLabel(r.letter_title, "")),
              data: { type: "letter_unlock", letterId: r.letter_id, route: "/(tabs)/letters" }
            });
          }
        }
      }
      else if (job === "meeting_reminder") {
        const targetTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const { data: reminders, error } = await supabase.rpc("get_upcoming_meeting_reminders", {
          now_str: now.toISOString(),
          target_time_str: targetTime.toISOString()
        });
        if (reminders && !error) {
          const langs = await languagesByToken(supabase, reminders.map((r: any) => r.push_token));
          for (const r of reminders) {
            const s = S(langs.get(r.push_token) ?? "tr");
            pushMessages.push({
              to: r.push_token,
              sound: "default",
              title: s.meetingSoonTitle,
              body: s.meetingSoonBody(safePlaintextLabel(r.meeting_title, "")),
              data: { type: "meeting_reminder", meetingId: r.meeting_id, route: "/(tabs)/meetings" }
            });
          }
        }
      }
      else if (job === "anniversary_reminder") {
        const currentMonth = (now.getUTCMonth() + 1).toString().padStart(2, "0");
        const currentDay = now.getUTCDate().toString().padStart(2, "0");
        const matchStr = `-${currentMonth}-${currentDay}`;

        const { data: reminders, error } = await supabase.rpc("get_anniversary_reminders", {
          match_str: matchStr,
          current_year: now.getUTCFullYear()
        });
        if (reminders && !error) {
          const langs = await languagesByToken(supabase, reminders.map((r: any) => r.push_token));
          for (const r of reminders) {
            const s = S(langs.get(r.push_token) ?? "tr");
            pushMessages.push({
              to: r.push_token,
              sound: "default",
              title: s.anniversaryTitle,
              body: s.anniversaryBody(r.years, r.anniversary_type),
              data: { type: "anniversary_reminder", route: "/(tabs)/home" }
            });
          }
        }
      }
      else if (job === "vault_expiry_reminder") {
        // Kasa süresi dolmak üzere olan çiftlerin üyeleri: 7 gün ve 1 gün kala (aşama başına bir kez, push_dedupe)
        const { data: reminders, error } = await supabase.rpc("get_vault_expiry_reminders");
        if (error) console.error("get_vault_expiry_reminders failed:", error.message);
        if (reminders && !error) {
          const langs = await languagesByToken(supabase, reminders.map((r: any) => r.push_token));
          for (const r of reminders) {
            const s = S(langs.get(r.push_token) ?? "tr");
            pushMessages.push({
              to: r.push_token,
              sound: "default",
              title: s.vaultExpiryTitle,
              body: s.vaultExpiryBody(Number(r.stage), Number(r.days_left)),
              data: { type: "vault_expiry_reminder", route: "/premium", vaultStage: Number(r.stage) }
            });
          }
        }
      }
      else if (job === "account_deletion_reminder") {
        // Silmeye 3 gün ve 1 gün kala: silinecek kişiye (vazgeçmek için giriş yap) ve partnerine
        const { data: reminders, error } = await supabase.rpc("get_account_deletion_reminders");
        if (error) console.error("get_account_deletion_reminders failed:", error.message);
        if (reminders && !error) {
          const langs = await languagesByToken(supabase, reminders.map((r: any) => r.push_token));
          for (const r of reminders) {
            const s = S(langs.get(r.push_token) ?? "tr");
            const days = Number(r.days_left);
            const self = r.audience === "self";
            pushMessages.push({
              to: r.push_token,
              sound: "default",
              title: self ? s.deletionSelfTitle : s.deletionPartnerTitle,
              body: self ? s.deletionSelfBody(days) : s.deletionPartnerBody(days),
              channelId: "partner_messages",
              data: {
                type: "general",
                route: self ? "/(auth)/login" : "/(tabs)/home",
                dedupeStage: `${r.audience}:${r.stage}:${String(r.scheduled_for).slice(0, 10)}`,
              }
            });
          }
        }
      }
      else if (job === "inactive_account_reminder") {
        // Hareketsiz eşleşmemiş hesap: silmeye 7 gün ve 1 gün kala
        const { data: reminders, error } = await supabase.rpc("get_inactive_account_reminders");
        if (error) console.error("get_inactive_account_reminders failed:", error.message);
        if (reminders && !error) {
          const langs = await languagesByToken(supabase, reminders.map((r: any) => r.push_token));
          for (const r of reminders) {
            const s = S(langs.get(r.push_token) ?? "tr");
            pushMessages.push({
              to: r.push_token,
              sound: "default",
              title: s.inactiveAccountTitle,
              body: s.inactiveAccountBody(Number(r.days_left)),
              data: {
                type: "general",
                route: "/(tabs)/home",
                dedupeStage: `${r.stage}:${String(r.due_at).slice(0, 10)}`,
              }
            });
          }
        }
      }
      else if (job === "inactivity_reminder") {
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const { data: reminders, error } = await supabase.rpc("get_inactivity_reminders", {
          three_days_ago_str: threeDaysAgo.toISOString()
        });
        if (reminders && !error) {
          const langs = await languagesByToken(supabase, reminders.map((r: any) => r.push_token));
          for (const r of reminders) {
            const s = S(langs.get(r.push_token) ?? "tr");
            pushMessages.push({
              to: r.push_token,
              sound: "default",
              title: s.inactivityTitle,
              body: s.inactivityBody,
              data: { type: "inactivity_reminder", route: "/(tabs)/home" }
            });
          }
        }
      }

      pushMessages = await dropAlreadySent(supabase, job, pushMessages);

      if (pushMessages.length > 0) {
        // Expo Push API accepts max 100 messages per request
        const CHUNK_SIZE = 100;
        for (let i = 0; i < pushMessages.length; i += CHUNK_SIZE) {
          const chunk = pushMessages.slice(i, i + CHUNK_SIZE);
          const expoResponse = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Encoding": "gzip, deflate" },
            body: JSON.stringify(chunk),
          });
          const expoResult = await expoResponse.json();
          console.log(`Cron Push Result (Chunk ${Math.floor(i/CHUNK_SIZE) + 1}):`, JSON.stringify(expoResult));
          await pruneDeadTokens(supabase, chunk, expoResult);
        }
      }
      return new Response(`Cron ${job} processed. Messages: ${pushMessages.length}`, { status: 200 });
    }

    // =====================================================================
    // 2. WEBHOOK (ANLIK) BİLDİRİMLER
    // =====================================================================
    const { type, table, record } = body;

    if (type !== "INSERT" && type !== "UPDATE") {
      return new Response("Not INSERT/UPDATE, skipping.", { status: 200 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Mesaj, alıcının (partnerin) diline göre kurulur
    let message: MessageBuilder | null = null;
    let partnerIntId: number | string | null = null;
    let senderIntId: number | string | null = null;
    const oldRecord = body.old_record || {};

    if (table === "medicine_logs" && record.status === "DRANK" && (type === "INSERT" || (type === "UPDATE" && oldRecord.status !== "DRANK"))) {
      senderIntId = record.user_id;
      const { data: medicine } = await supabase.from("medicines").select("name").eq("id", record.medicine_id).single();
      const { data: sender } = await supabase.from("users").select("display_name, couple_id").eq("id", senderIntId).single();
      if (sender && medicine) {
        const medicineName = safePlaintextLabel(medicine.name, "");
        message = (lang) => {
          const s = S(lang);
          return { title: s.medicineTakenTitle, body: s.medicineTakenBody(sender.display_name, medicineName), type: "medicine", route: "/(tabs)/medicine", actionLabel: s.medicineTakenAction, channelId: "medicine_channel" };
        };
        const { data: partner } = await supabase.from("users").select("id").eq("couple_id", sender.couple_id).neq("id", senderIntId).single();
        partnerIntId = partner?.id ?? null;
      }
    }
    // daily_notes (özel günlük) için bilerek bildirim yok: günlük "sadece sen okuyabilirsin" vaadiyle tutulur,
    // yazıldığının partnere haber verilmesi bu gizliliğe ters düşer.
    else if (table === "letters" && type === "INSERT") {
      senderIntId = record.sender_id;
      partnerIntId = record.receiver_id;
      const { data: sender } = await supabase.from("users").select("display_name").eq("id", senderIntId).single();
      if (sender) {
        const isToday = record.unlock_date === new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split("T")[0];
        message = (lang) => {
          const s = S(lang);
          const unlockDate = record.unlock_date && !isToday
            ? new Date(record.unlock_date).toLocaleDateString(localeOf(lang), { day: "numeric", month: "long", year: "numeric" })
            : null;
          return {
            title: s.letterNewTitle,
            body: s.letterNewBody(sender.display_name, unlockDate),
            type: "letter",
            route: "/(tabs)/letters",
            actionLabel: s.letterNewAction,
            channelId: "letters_channel",
          };
        };
      }
    }
    else if (table === "period_logs" && type === "INSERT") {
      senderIntId = record.user_id;
      const { data: sender } = await supabase.from("users").select("display_name, couple_id").eq("id", senderIntId).single();
      if (sender) {
        message = (lang) => {
          const s = S(lang);
          return { title: s.periodStartedTitle, body: s.periodStartedBody(sender.display_name), type: "period", route: "/(tabs)/period-tracker", actionLabel: s.periodStartedAction };
        };
        const { data: partner } = await supabase.from("users").select("id").eq("couple_id", sender.couple_id).neq("id", senderIntId).single();
        partnerIntId = partner?.id ?? null;
      }
    }
    else if (table === "moods") {
      senderIntId = record.user_id;
      const { data: sender } = await supabase.from("users").select("display_name, couple_id").eq("id", senderIntId).single();
      if (sender) {
        message = (lang) => {
          const s = S(lang);
          return { title: s.moodTitle, body: s.moodBody(sender.display_name, record.mood_type), type: "mood", route: "/(tabs)/home", actionLabel: s.moodAction, extra: { moodEmoji: record.mood_type } };
        };
        const { data: partner } = await supabase.from("users").select("id").eq("couple_id", sender.couple_id).neq("id", senderIntId).single();
        partnerIntId = partner?.id ?? null;
      }
    }
    else if (table === "meetings" && type === "INSERT") {
      senderIntId = record.user_id;
      const { data: sender } = await supabase.from("users").select("display_name, couple_id").eq("id", senderIntId).single();
      if (sender) {
        message = (lang) => {
          const s = S(lang);
          const meetingDate = record.meeting_datetime
            ? new Date(record.meeting_datetime).toLocaleDateString(localeOf(lang), { day: "numeric", month: "long" })
            : null;
          return {
            title: s.meetingNewTitle,
            body: s.meetingNewBody(sender.display_name, meetingDate),
            type: "meeting",
            route: "/(tabs)/meetings",
            actionLabel: s.meetingNewAction,
          };
        };
        const { data: partner } = await supabase.from("users").select("id").eq("couple_id", sender.couple_id).neq("id", senderIntId).single();
        partnerIntId = partner?.id ?? null;
      }
    }
    else if (table === "memories" && type === "INSERT") {
      senderIntId = record.user_id;
      const { data: sender } = await supabase.from("users").select("display_name, couple_id").eq("id", senderIntId).single();
      if (sender) {
        message = (lang) => {
          const s = S(lang);
          return { title: s.memoryNewTitle, body: s.memoryNewBody(sender.display_name), type: "photo", route: "/(tabs)/memories", actionLabel: s.memoryNewAction };
        };
        const { data: partner } = await supabase.from("users").select("id").eq("couple_id", sender.couple_id).neq("id", senderIntId).single();
        partnerIntId = partner?.id ?? null;
      }
    }
    else if (table === "calendar_notes" && type === "INSERT") {
      senderIntId = record.user_id;
      const { data: sender } = await supabase.from("users").select("display_name, couple_id").eq("id", senderIntId).single();
      if (sender) {
        message = (lang) => {
          const s = S(lang);
          return { title: s.calendarNoteTitle, body: s.calendarNoteBody(sender.display_name), route: "/(tabs)/calendar", actionLabel: s.calendarNoteAction };
        };
        const { data: partner } = await supabase.from("users").select("id").eq("couple_id", sender.couple_id).neq("id", senderIntId).single();
        partnerIntId = partner?.id ?? null;
      }
    }
    // Partnerin hesap silme talebi / vazgeçmesi / çiftin dağılması (bkz. migration 20261030000002_partner_notices)
    else if (table === "partner_notices" && type === "INSERT") {
      partnerIntId = record.user_id;
      message = (lang) => {
        const s = S(lang);
        const extra = { partnerNotice: true };
        if (record.kind === "deletion_requested") {
          const date = record.scheduled_for
            ? new Date(record.scheduled_for).toLocaleDateString(localeOf(lang), { day: "numeric", month: "long", year: "numeric" })
            : "";
          return { title: s.noticeRequestedTitle, body: s.noticeRequestedBody(date), type: "general", route: "/(tabs)/home", extra };
        }
        if (record.kind === "deletion_cancelled") {
          return { title: s.noticeCancelledTitle, body: s.noticeCancelledBody, type: "general", route: "/(tabs)/home", extra };
        }
        return { title: s.noticeDissolvedTitle, body: s.noticeDissolvedBody, type: "general", route: "/(tabs)/profile", extra };
      };
    }
    else if (table === "couples" && type === "UPDATE" && record.is_paired === true && oldRecord?.is_paired !== true) {
      const { data: coupleUsers } = await supabase.from("users").select("id").eq("couple_id", record.id);
      if (coupleUsers) {
        const allMsgs: any[] = [];
        for (const u of coupleUsers) {
          const msgs = await sendToUser(supabase, u.id,
            (lang) => {
              const s = S(lang);
              return { title: s.pairingTitle, body: s.pairingBody, route: "/(tabs)/home" };
            },
            { type: "pairing_success" }
          );
          allMsgs.push(...msgs);
        }
        if (allMsgs.length > 0) {
          const pairingResponse = await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Encoding": "gzip, deflate" },
            body: JSON.stringify(allMsgs),
          });
          await pruneDeadTokens(supabase, allMsgs, await pairingResponse.json().catch(() => null));
        }
      }
      return new Response("Pairing notifications sent.", { status: 200 });
    }
    // Davet ödüllendi: davet eden çifte haber (bkz. migration 20261104000006_couple_referrals)
    else if (table === "couple_referrals" && type === "UPDATE" && record.status === "rewarded" && oldRecord?.status !== "rewarded") {
      const reward = typeof record.referrer_reward === "string" ? record.referrer_reward : "none";
      if (!record.referrer_couple_id || reward === "none") {
        return new Response("No referrer to notify.", { status: 200 });
      }
      const { data: coupleUsers } = await supabase.from("users").select("id").eq("couple_id", record.referrer_couple_id);
      const allMsgs: any[] = [];
      for (const u of coupleUsers ?? []) {
        const msgs = await sendToUser(supabase, u.id,
          (lang) => {
            const s = S(lang);
            return { title: s.referralRewardTitle, body: s.referralRewardBody(reward), route: "/(tabs)/profile" };
          },
          { type: "referral_reward" }
        );
        allMsgs.push(...msgs);
      }
      if (allMsgs.length > 0) {
        const referralResponse = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Encoding": "gzip, deflate" },
          body: JSON.stringify(allMsgs),
        });
        await pruneDeadTokens(supabase, allMsgs, await referralResponse.json().catch(() => null));
      }
      return new Response("Referral notifications sent.", { status: 200 });
    }

    if (!message || partnerIntId === null) {
      return new Response("No message or partner to notify.", { status: 200 });
    }

    const pushMessages = await sendToUser(supabase, partnerIntId, message, { table, recordId: record.id });

    if (pushMessages.length === 0) {
      return new Response("Partner has no push tokens.", { status: 200 });
    }

    const expoResponse = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Encoding": "gzip, deflate" },
      body: JSON.stringify(pushMessages),
    });

    const expoResult = await expoResponse.json();
    console.log("Expo Push Result:", JSON.stringify(expoResult));
    await pruneDeadTokens(supabase, pushMessages, expoResult);
    return new Response(JSON.stringify({ success: true, sent: pushMessages.length, expoResult }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
