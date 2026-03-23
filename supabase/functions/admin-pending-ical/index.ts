import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-pin, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const pin = req.headers.get("x-admin-pin");
  if (pin !== Deno.env.get("ADMIN_PIN")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get all iCal bookings
    const { data: bookings, error: bErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("status", "booked")
      .order("start_date");
    if (bErr) throw bErr;

    // Get all manual reservations (to filter out already-converted)
    const { data: manualRes, error: mErr } = await supabase
      .from("manual_reservations")
      .select("external_id, check_in, check_out, property_id")
      .neq("status", "Cancelled");
    if (mErr) throw mErr;

    // Build a set of matched external_ids and date+property combos
    const matchedIds = new Set((manualRes || []).filter(r => r.external_id).map(r => r.external_id));
    const matchedDates = new Set(
      (manualRes || []).map(r => `${r.property_id}_${r.check_in}_${r.check_out}`)
    );

    // Filter out bookings that already have manual entries
    const pending = (bookings || []).filter((b) => {
      const extId = `${b.property_id}_${b.start_date}_${b.end_date}`;
      if (matchedIds.has(extId)) return false;
      if (matchedDates.has(`${b.property_id}_${b.start_date}_${b.end_date}`)) return false;
      return true;
    });

    return new Response(JSON.stringify(pending), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
