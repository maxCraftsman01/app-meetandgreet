import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cleaner-pin, x-admin-pin, x-user-pin",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const cleanerPin = req.headers.get("x-cleaner-pin");
  const adminPin = req.headers.get("x-admin-pin");
  const userPin = req.headers.get("x-user-pin") || cleanerPin; // unified PIN support
  const isAdmin = adminPin === Deno.env.get("ADMIN_PIN");

  try {
    const method = req.method;

    // Admin: get all properties' cleaning status for daily ops dashboard
    if (method === "GET" && isAdmin) {
      const url = new URL(req.url);
      const fromParam = url.searchParams.get("from");
      const toParam = url.searchParams.get("to");
      const today = new Date().toISOString().split("T")[0];

      const { data: properties } = await supabase
        .from("properties")
        .select("id, name, owner_name, keybox_code, cleaning_notes, cleaner_pin");

      // If from/to provided, return schedule for range
      if (fromParam && toParam) {
        const { data: reservations } = await supabase
          .from("manual_reservations")
          .select("*")
          .neq("status", "Cancelled")
          .lte("check_in", toParam)
          .gte("check_out", fromParam);

        const events: any[] = [];
        const current = new Date(fromParam);
        const end = new Date(toParam);
        while (current <= end) {
          const dateStr = current.toISOString().split("T")[0];
          for (const p of (properties || [])) {
            const propRes = (reservations || []).filter((r: any) => r.property_id === p.id);
            const checkingOut = propRes.some((r: any) => r.check_out === dateStr);
            const checkingIn = propRes.find((r: any) => r.check_in === dateStr);
            const hasArrival = !!checkingIn;
            const cleaningDone = checkingIn?.cleaning_status === "completed";

            if (checkingOut || hasArrival) {
              let status = "idle";
              if (checkingOut && hasArrival) status = "same-day";
              else if (checkingOut && !hasArrival) status = "checkout-only";
              else if (hasArrival && !cleaningDone) status = "arrival-pending";
              else if (hasArrival && cleaningDone) status = "arrival-ready";

              events.push({
                date: dateStr,
                property_id: p.id,
                property_name: p.name,
                status,
                guest_name: checkingIn?.guest_name || null,
                check_out_guest: propRes.find((r: any) => r.check_out === dateStr)?.guest_name || null,
                reservation_id: checkingIn?.id || null,
                keybox_code: p.keybox_code,
                cleaning_notes: p.cleaning_notes,
              });
            }
          }
          current.setDate(current.getDate() + 1);
        }

        return new Response(JSON.stringify(events), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Default: today only (existing behavior)
      const { data: reservations } = await supabase
        .from("manual_reservations")
        .select("*")
        .or(`check_in.eq.${today},check_out.eq.${today}`)
        .neq("status", "Cancelled");

      const propertyStatuses = (properties || []).map((p: any) => {
        const propRes = (reservations || []).filter((r: any) => r.property_id === p.id);
        const checkingOut = propRes.some((r: any) => r.check_out === today);
        const checkingIn = propRes.find((r: any) => r.check_in === today);
        const hasArrival = !!checkingIn;
        const cleaningDone = checkingIn?.cleaning_status === "completed";

        let status = "idle";
        if (checkingOut && hasArrival) status = "same-day";
        else if (checkingOut && !hasArrival) status = "checkout-only";
        else if (hasArrival && !cleaningDone) status = "arrival-pending";
        else if (hasArrival && cleaningDone) status = "arrival-ready";

        return {
          ...p,
          status,
          today_checkout: checkingOut,
          today_checkin: hasArrival,
          cleaning_done: cleaningDone,
          arrival_reservation: checkingIn || null,
        };
      });

      return new Response(JSON.stringify(propertyStatuses), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User access: look up by PIN in app_users + user_property_access
    if (method === "GET" && userPin) {
      const url = new URL(req.url);
      const fromParam = url.searchParams.get("from");
      const toParam = url.searchParams.get("to");

      // Find user by PIN
      const { data: user } = await supabase
        .from("app_users")
        .select("id")
        .eq("pin", userPin)
        .single();

      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid PIN" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get properties where user has cleaning access
      const { data: access } = await supabase
        .from("user_property_access")
        .select("property_id, can_mark_cleaned")
        .eq("user_id", user.id)
        .eq("can_view_cleaning", true);

      if (!access || access.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const propertyIds = access.map((a: any) => a.property_id);

      const { data: properties } = await supabase
        .from("properties")
        .select("id, name, keybox_code, cleaning_notes")
        .in("id", propertyIds);

      // Range query for week/month views
      if (fromParam && toParam) {
        const { data: reservations } = await supabase
          .from("manual_reservations")
          .select("*")
          .in("property_id", propertyIds)
          .neq("status", "Cancelled")
          .lte("check_in", toParam)
          .gte("check_out", fromParam);

        const events: any[] = [];
        const current = new Date(fromParam);
        const end = new Date(toParam);
        while (current <= end) {
          const dateStr = current.toISOString().split("T")[0];
          for (const p of (properties || [])) {
            const propRes = (reservations || []).filter((r: any) => r.property_id === p.id);
            const checkingOut = propRes.some((r: any) => r.check_out === dateStr);
            const checkingIn = propRes.find((r: any) => r.check_in === dateStr);
            const hasArrival = !!checkingIn;
            const cleaningDone = checkingIn?.cleaning_status === "completed";

            if (checkingOut || hasArrival) {
              let status = "idle";
              if (checkingOut && hasArrival) status = "same-day";
              else if (checkingOut && !hasArrival) status = "checkout-only";
              else if (hasArrival && !cleaningDone) status = "arrival-pending";
              else if (hasArrival && cleaningDone) status = "arrival-ready";

              events.push({
                date: dateStr,
                property_id: p.id,
                property_name: p.name,
                status,
                guest_name: checkingIn?.guest_name || null,
                check_out_guest: propRes.find((r: any) => r.check_out === dateStr)?.guest_name || null,
                reservation_id: checkingIn?.id || null,
                keybox_code: p.keybox_code,
                cleaning_notes: p.cleaning_notes,
              });
            }
          }
          current.setDate(current.getDate() + 1);
        }

        return new Response(JSON.stringify(events), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Default: today only
      const today = new Date().toISOString().split("T")[0];

      const { data: reservations } = await supabase
        .from("manual_reservations")
        .select("*")
        .in("property_id", propertyIds)
        .or(`check_in.eq.${today},check_out.eq.${today}`)
        .neq("status", "Cancelled");

      const tasks = (properties || []).map((p: any) => {
        const propRes = (reservations || []).filter((r: any) => r.property_id === p.id);
        const checkingOut = propRes.some((r: any) => r.check_out === today);
        const checkingIn = propRes.find((r: any) => r.check_in === today);
        const hasArrival = !!checkingIn;
        const cleaningDone = checkingIn?.cleaning_status === "completed";

        let status = "idle";
        if (checkingOut && hasArrival) status = "same-day";
        else if (checkingOut && !hasArrival) status = "checkout-only";
        else if (hasArrival && !cleaningDone) status = "arrival-pending";
        else if (hasArrival && cleaningDone) status = "arrival-ready";

        return {
          property_id: p.id,
          property_name: p.name,
          keybox_code: p.keybox_code,
          cleaning_notes: p.cleaning_notes,
          status,
          reservation_id: checkingIn?.id || null,
          guest_name: checkingIn?.guest_name || null,
          check_in: checkingIn?.check_in || null,
          check_out_guest: propRes.find((r: any) => r.check_out === today)?.guest_name || null,
        };
      });

      return new Response(JSON.stringify(tasks), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!userPin && !isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT: mark as cleaned
    if (method === "PUT") {
      const body = await req.json();
      const { reservation_id } = body;

      if (!reservation_id) {
        return new Response(JSON.stringify({ error: "Missing reservation_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("manual_reservations")
        .update({
          cleaning_status: "completed",
          last_cleaned_at: new Date().toISOString(),
        })
        .eq("id", reservation_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
