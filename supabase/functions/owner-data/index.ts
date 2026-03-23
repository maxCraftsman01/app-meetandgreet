import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-owner-pin, x-user-pin, x-admin-pin, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const pin = req.headers.get("x-user-pin") || req.headers.get("x-owner-pin") || req.headers.get("x-admin-pin");
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

    // Check super-admin PIN
    const adminPin = Deno.env.get("ADMIN_PIN");
    let isAdmin = false;
    let financePropertyIds: string[] = [];

    if (pin === adminPin) {
      isAdmin = true;
    } else {
      // Look up user
      const { data: user } = await supabase
        .from("app_users")
        .select("id, is_admin")
        .eq("pin", pin)
        .single();

      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      isAdmin = user.is_admin;

      if (!isAdmin) {
        // Get properties where user has finance access
        const { data: access } = await supabase
          .from("user_property_access")
          .select("property_id, can_view_finance")
          .eq("user_id", user.id);

        financePropertyIds = (access || [])
          .filter((a: any) => a.can_view_finance)
          .map((a: any) => a.property_id);

        if (financePropertyIds.length === 0) {
          return new Response(JSON.stringify({ properties: [], bookings: [], manual_reservations: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Optional property_id filter (for admin viewing a specific property)
    const url = new URL(req.url);
    const filterPropertyId = url.searchParams.get("property_id");

    // Admin gets all properties (or filtered), regular users get only their finance properties
    let propertiesQuery = supabase.from("properties").select("*");
    let bookingsQuery = supabase.from("bookings").select("*");
    let manualQuery = supabase.from("manual_reservations").select("*");

    if (isAdmin) {
      if (filterPropertyId) {
        propertiesQuery = propertiesQuery.eq("id", filterPropertyId);
        bookingsQuery = bookingsQuery.eq("property_id", filterPropertyId);
        manualQuery = manualQuery.eq("property_id", filterPropertyId);
      }
    } else {
      propertiesQuery = propertiesQuery.in("id", financePropertyIds);
      bookingsQuery = bookingsQuery.in("property_id", financePropertyIds);
      manualQuery = manualQuery.in("property_id", financePropertyIds);
    }

    const { data: properties } = await propertiesQuery;
    const { data: bookings } = await bookingsQuery.order("start_date");
    const { data: manualReservations } = await manualQuery.order("check_in");

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
