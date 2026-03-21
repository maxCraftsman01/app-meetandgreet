import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-owner-pin",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const pin = req.headers.get("x-owner-pin");
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

    const { data: properties, error } = await supabase
      .from("properties")
      .select("*")
      .eq("owner_pin", pin);

    if (error || !properties || properties.length === 0) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get bookings for all properties
    const propertyIds = properties.map((p) => p.id);
    const { data: bookings } = await supabase
      .from("bookings")
      .select("*")
      .in("property_id", propertyIds)
      .order("start_date");

    // Get manual reservations for all properties
    const { data: manualReservations } = await supabase
      .from("manual_reservations")
      .select("*")
      .in("property_id", propertyIds)
      .order("check_in");

    return new Response(
      JSON.stringify({
        properties,
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
