import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const pin = req.headers.get("x-user-pin") || req.headers.get("x-owner-pin") || req.headers.get("x-admin-pin");
    if (!pin) {
      return new Response(JSON.stringify({ error: "Missing PIN" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseClient();
    const adminPin = Deno.env.get("ADMIN_PIN");
    let isAdmin = false;
    let financePropertyIds: string[] = [];

    if (pin === adminPin) {
      isAdmin = true;
    } else {
      const { data: user } = await supabase.from("app_users").select("id, is_admin").eq("pin", pin).single();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      isAdmin = user.is_admin;
      if (!isAdmin) {
        const { data: access } = await supabase.from("user_property_access").select("property_id, can_view_finance").eq("user_id", user.id);
        financePropertyIds = (access || []).filter((a: any) => a.can_view_finance).map((a: any) => a.property_id);
        if (financePropertyIds.length === 0) {
          return new Response(JSON.stringify({ properties: [], bookings: [], manual_reservations: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const url = new URL(req.url);
    const filterPropertyId = url.searchParams.get("property_id");

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
      JSON.stringify({ properties: properties || [], bookings: bookings || [], manual_reservations: manualReservations || [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
