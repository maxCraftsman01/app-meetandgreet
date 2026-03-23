import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-pin",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminPin = req.headers.get("x-admin-pin") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate admin
    const envPin = Deno.env.get("ADMIN_PIN") || "";
    let isAdmin = adminPin === envPin && envPin !== "";
    if (!isAdmin) {
      const { data: adminUser } = await supabase
        .from("app_users")
        .select("id")
        .eq("pin", adminPin)
        .eq("is_admin", true)
        .maybeSingle();
      isAdmin = !!adminUser;
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!from || !to) {
      return new Response(
        JSON.stringify({ error: "from and to query params required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all properties
    const { data: properties, error: propErr } = await supabase
      .from("properties")
      .select("id, name")
      .order("name");
    if (propErr) throw propErr;

    // Fetch manual reservations overlapping the date range
    const { data: reservations, error: resErr } = await supabase
      .from("manual_reservations")
      .select("*")
      .lte("check_in", to)
      .gte("check_out", from);
    if (resErr) throw resErr;

    // Fetch iCal bookings overlapping the date range
    const { data: bookings, error: bookErr } = await supabase
      .from("bookings")
      .select("*")
      .lte("start_date", to)
      .gte("end_date", from);
    if (bookErr) throw bookErr;

    // Fetch cleaners for filter dropdown
    const { data: users } = await supabase
      .from("app_users")
      .select("id, name")
      .eq("is_admin", false);

    const { data: access } = await supabase
      .from("user_property_access")
      .select("user_id, property_id, can_view_cleaning");

    return new Response(
      JSON.stringify({ properties, reservations, bookings, users: users || [], access: access || [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("admin-timeline error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
