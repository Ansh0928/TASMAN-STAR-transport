import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface StatusChangePayload {
  booking_id: string;
  old_status: string;
  new_status: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("en-AU", { timeZone: "Australia/Brisbane" });
}

function buildEmailHtml(
  title: string,
  bookingNumber: string,
  details: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; }
        .header { background: #1e3a5f; color: white; padding: 24px; text-align: center; }
        .content { padding: 24px; }
        .booking-number { font-size: 18px; font-weight: bold; color: #1e3a5f; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
        .footer { padding: 16px 24px; color: #999; font-size: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Tasman Transport</h1>
      </div>
      <div class="content">
        <h2>${title}</h2>
        <p class="booking-number">Booking: ${bookingNumber}</p>
        ${details}
      </div>
      <div class="footer">
        <p>Tasman Transport — Gold Coast ↔ Sydney Freight</p>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  try {
    const payload: StatusChangePayload = await req.json();
    const { booking_id, new_status } = payload;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch booking with customer and driver profiles
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*, customer:profiles!bookings_customer_id_fkey(*), driver:profiles!bookings_driver_id_fkey(*)")
      .eq("id", booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error(`Booking not found: ${bookingError?.message}`);
    }

    // Fetch admin emails
    const { data: admins } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "admin")
      .eq("is_active", true);

    const adminEmails = admins?.map((a: { email: string }) => a.email) ?? [];
    const customerEmail = booking.customer?.email;
    const driverEmail = booking.driver?.email;

    const notifications: Array<{
      email: string;
      subject: string;
      html: string;
      type: string;
    }> = [];

    const details = `
      <div class="detail-row"><strong>Pickup:</strong> ${booking.pickup_address}</div>
      <div class="detail-row"><strong>Dropoff:</strong> ${booking.dropoff_address}</div>
      <div class="detail-row"><strong>Pickup Date:</strong> ${formatDate(booking.pickup_datetime)}</div>
      <div class="detail-row"><strong>Item:</strong> ${booking.item_type} (${booking.weight_kg}kg)</div>
    `;

    switch (new_status) {
      case "confirmed": {
        const driverInfo = booking.driver
          ? `<div class="detail-row"><strong>Driver:</strong> ${booking.driver.full_name} (${booking.driver.phone ?? "N/A"})</div>`
          : "";

        if (customerEmail) {
          notifications.push({
            email: customerEmail,
            subject: `Booking ${booking.booking_number} Confirmed`,
            html: buildEmailHtml("Your Booking is Confirmed!", booking.booking_number, details + driverInfo),
            type: "booking_confirmed_customer",
          });
        }

        if (driverEmail) {
          notifications.push({
            email: driverEmail,
            subject: `New Job Assigned: ${booking.booking_number}`,
            html: buildEmailHtml("New Job Assignment", booking.booking_number, details),
            type: "booking_confirmed_driver",
          });
        }

        for (const email of adminEmails) {
          notifications.push({
            email,
            subject: `Booking ${booking.booking_number} Confirmed`,
            html: buildEmailHtml("Booking Confirmed", booking.booking_number, details + driverInfo),
            type: "booking_confirmed_admin",
          });
        }
        break;
      }

      case "in_transit": {
        if (customerEmail) {
          notifications.push({
            email: customerEmail,
            subject: `Goods Picked Up: ${booking.booking_number}`,
            html: buildEmailHtml("Your Goods Are In Transit!", booking.booking_number, details),
            type: "in_transit_customer",
          });
        }
        break;
      }

      case "delivered": {
        const summary = details + `<div class="detail-row"><strong>Status:</strong> Delivered ✓</div>`;

        if (customerEmail) {
          notifications.push({
            email: customerEmail,
            subject: `Delivery Complete: ${booking.booking_number}`,
            html: buildEmailHtml("Your Delivery is Complete!", booking.booking_number, summary),
            type: "delivered_customer",
          });
        }

        if (driverEmail) {
          notifications.push({
            email: driverEmail,
            subject: `Job Completed: ${booking.booking_number}`,
            html: buildEmailHtml("Job Completed", booking.booking_number, summary),
            type: "delivered_driver",
          });
        }

        for (const email of adminEmails) {
          notifications.push({
            email,
            subject: `Delivery Complete: ${booking.booking_number}`,
            html: buildEmailHtml("Delivery Complete", booking.booking_number, summary),
            type: "delivered_admin",
          });
        }
        break;
      }

      case "cancelled": {
        const cancelDetails = details + `<div class="detail-row"><strong>Status:</strong> Cancelled</div>`;

        if (customerEmail) {
          notifications.push({
            email: customerEmail,
            subject: `Booking Cancelled: ${booking.booking_number}`,
            html: buildEmailHtml("Booking Cancelled", booking.booking_number, cancelDetails),
            type: "cancelled_customer",
          });
        }

        if (driverEmail) {
          notifications.push({
            email: driverEmail,
            subject: `Job Cancelled: ${booking.booking_number}`,
            html: buildEmailHtml("Job Cancelled", booking.booking_number, cancelDetails),
            type: "cancelled_driver",
          });
        }

        for (const email of adminEmails) {
          notifications.push({
            email,
            subject: `Booking Cancelled: ${booking.booking_number}`,
            html: buildEmailHtml("Booking Cancelled", booking.booking_number, cancelDetails),
            type: "cancelled_admin",
          });
        }
        break;
      }
    }

    // Send all notifications
    const results = await Promise.allSettled(
      notifications.map((n) =>
        fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            booking_id,
            recipient_email: n.email,
            notification_type: n.type,
            subject: n.subject,
            html: n.html,
          }),
        })
      )
    );

    return new Response(
      JSON.stringify({
        sent: results.filter((r) => r.status === "fulfilled").length,
        failed: results.filter((r) => r.status === "rejected").length,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Status change handler error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
