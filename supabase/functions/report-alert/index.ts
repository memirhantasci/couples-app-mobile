import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Yıldız bildirimi geldiğinde destek adresine e-posta gönderir (tetikleyici: public.notify_star_report).
// E-posta Resend API'siyle gider. Gerekli Edge Function sırları:
//   RESEND_API_KEY      Resend API anahtarı
//   REPORT_ALERT_FROM   Gönderen, ör. "CoupleSky <bildirim@couplesky.app>" (Resend'de doğrulanmış alan adı)
//   REPORT_ALERT_TO     (isteğe bağlı) alıcı; varsayılan destek@couplesky.app
//   PUSH_WEBHOOK_SECRET send-push ile ortak, tetikleyicinin gönderdiği gizli anahtar

const DEFAULT_TO = "destek@couplesky.app";
const RESEND_URL = "https://api.resend.com/emails";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

serve(async (req) => {
  // Yalnızca veritabanı tetikleyicisi çağırabilir: ortak gizli anahtar ya da service_role anahtarı
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
    const { star_id: starId } = await req.json();
    if (typeof starId !== "string" || starId.length === 0) {
      return new Response("star_id gerekli", { status: 400 });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("REPORT_ALERT_FROM");
    if (!resendKey || !from) {
      console.error("report-alert: RESEND_API_KEY ya da REPORT_ALERT_FROM tanımlı değil");
      return new Response("E-posta ayarı eksik", { status: 500 });
    }
    const to = Deno.env.get("REPORT_ALERT_TO") ?? DEFAULT_TO;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey!);

    const { data: star } = await admin
      .from("couple_stars")
      .select("catalog_id, custom_name, name_hidden_at")
      .eq("id", starId)
      .maybeSingle();

    const { data: reports } = await admin
      .from("star_reports")
      .select("reporter_id, reporter_couple_id")
      .eq("star_id", starId);

    // Aynı çiftin iki partneri tek taraf sayılır (report_star ile aynı kural)
    const parties = new Set(
      (reports ?? []).map((r: { reporter_id: string; reporter_couple_id: number | null }) =>
        r.reporter_couple_id !== null ? `c${r.reporter_couple_id}` : `u${r.reporter_id}`
      )
    ).size;

    const name = star?.custom_name ? String(star.custom_name) : "(adı yok)";
    const hidden = !!star?.name_hidden_at;
    const subject = `[CoupleSky] Yıldız bildirildi: ${name} (${parties} çift)`;
    const html = `
      <p>Bir yıldız uygulama içinden bildirildi.</p>
      <ul>
        <li><b>Yıldız adı:</b> ${escapeHtml(name)}</li>
        <li><b>Katalog no:</b> ${escapeHtml(String(star?.catalog_id ?? "?"))}</li>
        <li><b>Bildiren çift sayısı:</b> ${parties}</li>
        <li><b>Ad herkesten gizlendi mi:</b> ${hidden ? "Evet (3+ çift)" : "Hayır"}</li>
      </ul>
      <p>Uygunsuzsa Supabase panelinden <code>couple_stars.name_hidden_at</code> alanını doldurarak adı hemen gizleyebilirsiniz.
      Kullanım Koşulları gereği bildirimler en geç 7 gün içinde incelenmelidir.</p>`;

    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!response.ok) {
      console.error("report-alert: Resend hatası", response.status, await response.text());
      return new Response("E-posta gönderilemedi", { status: 502 });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("report-alert error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
