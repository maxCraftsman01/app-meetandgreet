import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-owner-pin, x-user-pin, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const pin = req.headers.get("x-user-pin") || req.headers.get("x-owner-pin");
    if (!pin) {
      return new Response(JSON.stringify({ error: "Missing PIN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up user and their property access
    const { data: user } = await supabase
      .from("app_users")
      .select("id")
      .eq("pin", pin)
      .single();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get properties where user has finance access
    const { data: access } = await supabase
      .from("user_property_access")
      .select("property_id, can_view_finance")
      .eq("user_id", user.id);

    const financePropertyIds = (access || [])
      .filter((a: any) => a.can_view_finance)
      .map((a: any) => a.property_id);

    if (financePropertyIds.length === 0) {
      return new Response(JSON.stringify({ properties: [], bookings: [], manual_reservations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: properties } = await supabase
      .from("properties")
      .select("*")
      .in("id", financePropertyIds);

    const { data: bookings } = await supabase
      .from("bookings")
      .select("*")
      .in("property_id", financePropertyIds)
      .order("start_date");

    const { data: manualReservations } = await supabase
      .from("manual_reservations")
      .select("*")
      .in("property_id", financePropertyIds)
      .order("check_in");

    return new Response(
      JSON.stringify({
        properties: properties || [],
        bookings: bookings || [],
        manual_reservations: manualReservations || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
