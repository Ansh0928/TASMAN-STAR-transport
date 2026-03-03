import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@tasmantransport.com.au";

interface NotificationPayload {
  booking_id: string;
  recipient_email: string;
  notification_type: string;
  subject: string;
  html: string;
}

serve(async (req) => {
  try {
    const payload: NotificationPayload = await req.json();
    const { booking_id, recipient_email, notification_type, subject, html } = payload;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Send email via Resend
    let status: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `Tasman Transport <${FROM_EMAIL}>`,
          to: [recipient_email],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(`Resend API error: ${error}`);
      }
    } catch (err) {
      status = "failed";
      errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Email send failed:", errorMessage);
    }

    // Log notification
    await supabase.from("notifications_log").insert({
      booking_id,
      recipient_email,
      notification_type,
      status,
      error_message: errorMessage,
    });

    return new Response(JSON.stringify({ status, error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: status === "sent" ? 200 : 500,
    });
  } catch (err) {
    console.error("Function error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
