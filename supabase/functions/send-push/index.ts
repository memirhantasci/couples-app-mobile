import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// ─────────────────────────────────────────────────────────────────────────────
// push_tokens.user_id = int4 (users.id) — direct lookup, no UUID conversion
// ─────────────────────────────────────────────────────────────────────────────
async function getTokensByUserId(supabase: any, intUserId: number | string): Promise<string[]> {
  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", intUserId);

  return tokens?.map((t: any) => t.token) ?? [];
}

async function sendToUser(supabase: any, intUserId: number | string, message: { title: string; body: string }, data: any = {}): Promise<any[]> {
  const tokens = await getTokensByUserId(supabase, intUserId);
  return tokens.map((token) => ({
    to: token,
    sound: "default",
    title: message.title,
    body: message.body,
    data,
  }));
}

serve(async (req) => {
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
      const pushMessages: any[] = [];
      const todayDateStr = new Date().toISOString().split("T")[0];
      const now = new Date();

      if (job === "medicine_reminder") {
        const trHourStr = ((now.getUTCHours() + 3) % 24).toString().padStart(2, "0");
        const minuteStr = now.getUTCMinutes().toString().padStart(2, "0");
        const currentTimeStr = `${trHourStr}:${minuteStr}`;

        const { data: reminders, error } = await supabase.rpc("get_active_medicine_reminders", { current_time_str: currentTimeStr });
        if (reminders && !error) {
          for (const r of reminders) {
            pushMessages.push({
              to: r.push_token,
              sound: "default",
              title: "💊 İlaç Vakti!",
              body: `${r.medicine_name} ilacını içme vaktin geldi. Lütfen içtiğini işaretle.`,
              data: { type: "medicine_reminder", medicineId: r.medicine_id }
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
          for (const r of reminders) {
            if (r.user_push_token) {
              pushMessages.push({
                to: r.user_push_token,
                sound: "default",
                title: "🩸 Regl Hatırlatıcısı",
                body: "Tahmini regl tarihine 2 gün kaldı.",
                data: { type: "period_reminder" }
              });
            }
            if (r.partner_push_token) {
              pushMessages.push({
                to: r.partner_push_token,
                sound: "default",
                title: "🩸 Regl Hatırlatıcısı",
                body: `${r.display_name}'in tahmini regl tarihine 2 gün kaldı. Ona destek olmaya hazırlan 💕`,
                data: { type: "period_reminder" }
              });
            }
          }
        }
      }
      else if (job === "letter_unlock") {
        const { data: reminders, error } = await supabase.rpc("get_letter_unlock_reminders", { today_date_str: todayDateStr });
        if (reminders && !error) {
          for (const r of reminders) {
            pushMessages.push({
              to: r.push_token,
              sound: "default",
              title: "💌 Mektubun Kilidi Açıldı!",
              body: `${r.sender_display_name}'in sana yazdığı "${r.letter_title}" mektubunun kilidi bugün açıldı! Hemen oku.`,
              data: { type: "letter_unlock", letterId: r.letter_id }
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
          for (const r of reminders) {
            pushMessages.push({
              to: r.push_token,
              sound: "default",
              title: "⏳ Yaklaşan Buluşma",
              body: `"${r.meeting_title || "Buluşma"}" etkinliğine çok az kaldı! Hazırlanmaya başla.`,
              data: { type: "meeting_reminder", meetingId: r.meeting_id }
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
          for (const r of reminders) {
            pushMessages.push({
              to: r.push_token,
              sound: "default",
              title: "🎉 Mutlu Yıllar!",
              body: `Bugün ${r.years}. ${r.anniversary_type}nüz! Birlikte nice mutlu yıllara...`,
              data: { type: "anniversary_reminder" }
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
          for (const r of reminders) {
            pushMessages.push({
              to: r.push_token,
              sound: "default",
              title: "🥺 Seni Özledik",
              body: "Uygulamaya girmeyeli biraz zaman oldu, bugün partnerine küçük bir not bırakmak ister misin?",
              data: { type: "inactivity_reminder" }
            });
          }
        }
      }

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

    let message: { title: string; body: string } | null = null;
    let partnerIntId: number | string | null = null;
    let senderIntId: number | string | null = null;
    const oldRecord = body.old_record || {};

    if (table === "medicine_logs" && record.status === "DRANK" && (type === "INSERT" || (type === "UPDATE" && oldRecord.status !== "DRANK"))) {
      senderIntId = record.user_id;
      const { data: medicine } = await supabase.from("medicines").select("name").eq("id", record.medicine_id).single();
      const { data: sender } = await supabase.from("users").select("display_name, couple_id").eq("id", senderIntId).single();
      if (sender && medicine) {
        message = { title: "💊 İlaç Takibi", body: `${sender.display_name} ${medicine.name} ilacını içti ✅` };
        const { data: partner } = await supabase.from("users").select("id").eq("couple_id", sender.couple_id).neq("id", senderIntId).single();
        partnerIntId = partner?.id ?? null;
      }
    }
    else if (table === "daily_notes" && type === "INSERT") {
      senderIntId = record.user_id;
      const { data: sender } = await supabase.from("users").select("display_name, couple_id").eq("id", senderIntId).single();
      if (sender) {
        message = { title: "📝 Günlük", body: `${sender.display_name} günlüğüne yeni bir not ekledi` };
        const { data: partner } = await supabase.from("users").select("id").eq("couple_id", sender.couple_id).neq("id", senderIntId).single();
        partnerIntId = partner?.id ?? null;
      }
    }
    else if (table === "letters" && type === "INSERT") {
      senderIntId = record.sender_id;
      partnerIntId = record.receiver_id;
      const { data: sender } = await supabase.from("users").select("display_name").eq("id", senderIntId).single();
      if (sender) {
        const unlockDate = record.unlock_date
          ? new Date(record.unlock_date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
          : null;
        const isToday = record.unlock_date === new Date().toISOString().split("T")[0];
        message = {
          title: "💌 Yeni Mektup",
          body: unlockDate && !isToday
            ? `${sender.display_name} sana geleceğe bir mektup yazdı! (${unlockDate} tarihinde açılacak)`
            : `${sender.display_name} sana bir mektup yazdı!`,
        };
      }
    }
    else if (table === "period_logs" && type === "INSERT") {
      senderIntId = record.user_id;
      const { data: sender } = await supabase.from("users").select("display_name, couple_id").eq("id", senderIntId).single();
      if (sender) {
        message = { title: "🩸 Regl Takvimi", body: `${sender.display_name}'in regl dönemi başladı. Ona destek olmayı unutma 💕` };
        const { data: partner } = await supabase.from("users").select("id").eq("couple_id", sender.couple_id).neq("id", senderIntId).single();
        partnerIntId = partner?.id ?? null;
      }
    }
    else if (table === "moods") {
      senderIntId = record.user_id;
      const { data: sender } = await supabase.from("users").select("display_name, couple_id").eq("id", senderIntId).single();
      if (sender) {
        message = { title: "💭 Mod Güncellemesi", body: `${sender.display_name} bugün kendini ${record.mood_type} hissediyor` };
        const { data: partner } = await supabase.from("users").select("id").eq("couple_id", sender.couple_id).neq("id", senderIntId).single();
        partnerIntId = partner?.id ?? null;
      }
    }
    else if (table === "meetings" && type === "INSERT") {
      senderIntId = record.user_id;
      const { data: sender } = await supabase.from("users").select("display_name, couple_id").eq("id", senderIntId).single();
      if (sender) {
        const meetingDate = record.meeting_datetime
          ? new Date(record.meeting_datetime).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })
          : null;
        message = {
          title: "🍽️ Yeni Buluşma",
          body: meetingDate
            ? `${sender.display_name} ${meetingDate} için bir buluşma planladı!`
            : `${sender.display_name} yeni bir buluşma planladı!`,
        };
        const { data: partner } = await supabase.from("users").select("id").eq("couple_id", sender.couple_id).neq("id", senderIntId).single();
        partnerIntId = partner?.id ?? null;
      }
    }
    else if (table === "memories" && type === "INSERT") {
      senderIntId = record.user_id;
      const { data: sender } = await supabase.from("users").select("display_name, couple_id").eq("id", senderIntId).single();
      if (sender) {
        message = { title: "🖼️ Yeni Anı", body: `${sender.display_name} ortak albüme yeni bir anı ekledi!` };
        const { data: partner } = await supabase.from("users").select("id").eq("couple_id", sender.couple_id).neq("id", senderIntId).single();
        partnerIntId = partner?.id ?? null;
      }
    }
    else if (table === "calendar_notes" && type === "INSERT") {
      senderIntId = record.user_id;
      const { data: sender } = await supabase.from("users").select("display_name, couple_id").eq("id", senderIntId).single();
      if (sender) {
        message = { title: "📅 Takvim Notu", body: `${sender.display_name} takvime yeni bir not bıraktı.` };
        const { data: partner } = await supabase.from("users").select("id").eq("couple_id", sender.couple_id).neq("id", senderIntId).single();
        partnerIntId = partner?.id ?? null;
      }
    }
    else if (table === "couples" && type === "UPDATE" && record.is_paired === true) {
      const { data: coupleUsers } = await supabase.from("users").select("id").eq("couple_id", record.id);
      if (coupleUsers) {
        const allMsgs: any[] = [];
        for (const u of coupleUsers) {
          const msgs = await sendToUser(supabase, u.id,
            { title: "💍 Eşleşme Başarılı!", body: "Harika! Partnerinle başarıyla eşleştiniz, uygulamayı birlikte kullanmaya başlayabilirsiniz." },
            { type: "pairing_success" }
          );
          allMsgs.push(...msgs);
        }
        if (allMsgs.length > 0) {
          await fetch(EXPO_PUSH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Encoding": "gzip, deflate" },
            body: JSON.stringify(allMsgs),
          });
        }
      }
      return new Response("Pairing notifications sent.", { status: 200 });
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
    return new Response(JSON.stringify({ success: true, sent: pushMessages.length, expoResult }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
