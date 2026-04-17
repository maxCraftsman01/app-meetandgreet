import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getSupabaseClient, validateAdminPin } from "../_shared/auth.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const supabase = getSupabaseClient();
  const cleanerPin = req.headers.get("x-cleaner-pin");
  const adminPin = req.headers.get("x-admin-pin") || "";
  const userPin = req.headers.get("x-user-pin") || cleanerPin;

  let isAdmin = false;
  try {
    isAdmin = await validateAdminPin(adminPin);
  } catch (e) {
    console.error("validateAdminPin error", e);
    isAdmin = false;
  }

  try {
    const method = req.method;

    if (method === "GET" && isAdmin) {
      const url = new URL(req.url);
      const fromParam = url.searchParams.get("from");
      const toParam = url.searchParams.get("to");
      const today = new Date().toISOString().split("T")[0];

      const { data: properties, error: propErr } = await supabase
        .from("properties").select("id, name, owner_name, keybox_code, cleaning_notes, cleaner_pin");
      if (propErr) {
        console.error("properties query error", propErr);
        return json({ error: "Failed to load properties", details: propErr.message }, 500);
      }
      const propList = properties || [];

      if (fromParam && toParam) {
        const { data: reservations, error: resErr } = await supabase
          .from("manual_reservations").select("*").neq("status", "Cancelled").eq("is_blocked", false)
          .lte("check_in", toParam).gte("check_out", fromParam);
        if (resErr) {
          console.error("reservations query error", resErr);
          return json({ error: "Failed to load reservations", details: resErr.message }, 500);
        }
        const resList = reservations || [];

        const events: any[] = [];
        const current = new Date(fromParam);
        const end = new Date(toParam);
        while (current <= end) {
          const dateStr = current.toISOString().split("T")[0];
          for (const p of propList) {
            const propRes = resList.filter((r: any) => r.property_id === p.id);
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
                date: dateStr, property_id: p.id, property_name: p.name, status,
                guest_name: checkingIn?.guest_name || null,
                check_out_guest: propRes.find((r: any) => r.check_out === dateStr)?.guest_name || null,
                reservation_id: checkingIn?.id || null, keybox_code: p.keybox_code, cleaning_notes: p.cleaning_notes,
              });
            }
          }
          current.setDate(current.getDate() + 1);
        }

        return json(events);
      }

      const { data: reservations, error: resErr } = await supabase
        .from("manual_reservations").select("*").or(`check_in.eq.${today},check_out.eq.${today}`)
        .neq("status", "Cancelled").eq("is_blocked", false);
      if (resErr) {
        console.error("reservations query error", resErr);
        return json({ error: "Failed to load reservations", details: resErr.message }, 500);
      }
      const resList = reservations || [];

      const propertyStatuses = propList.map((p: any) => {
        const propRes = resList.filter((r: any) => r.property_id === p.id);
        const checkingOut = propRes.some((r: any) => r.check_out === today);
        const checkingIn = propRes.find((r: any) => r.check_in === today);
        const hasArrival = !!checkingIn;
        const cleaningDone = checkingIn?.cleaning_status === "completed";

        let status = "idle";
        if (checkingOut && hasArrival) status = "same-day";
        else if (checkingOut && !hasArrival) status = "checkout-only";
        else if (hasArrival && !cleaningDone) status = "arrival-pending";
        else if (hasArrival && cleaningDone) status = "arrival-ready";

        return { ...p, status, today_checkout: checkingOut, today_checkin: hasArrival, cleaning_done: cleaningDone, arrival_reservation: checkingIn || null };
      });

      return json(propertyStatuses);
    }

    if (method === "GET" && userPin) {
      const url = new URL(req.url);
      const fromParam = url.searchParams.get("from");
      const toParam = url.searchParams.get("to");

      const { data: userRows, error: userErr } = await supabase
        .from("app_users").select("id").eq("pin", userPin).limit(1);
      if (userErr) {
        console.error("app_users query error", userErr);
        return json({ error: "Failed to validate user", details: userErr.message }, 500);
      }
      const user = userRows && userRows.length > 0 ? userRows[0] : null;
      if (!user) {
        return json({ error: "Invalid PIN" }, 401);
      }

      const { data: access, error: accessErr } = await supabase
        .from("user_property_access").select("property_id, can_mark_cleaned").eq("user_id", user.id).eq("can_view_cleaning", true);
      if (accessErr) {
        console.error("user_property_access query error", accessErr);
        return json({ error: "Failed to load access", details: accessErr.message }, 500);
      }

      if (!access || access.length === 0) {
        return json([]);
      }

      const propertyIds = access.map((a: any) => a.property_id);
      const { data: properties, error: propErr } = await supabase
        .from("properties").select("id, name, keybox_code, cleaning_notes").in("id", propertyIds);
      if (propErr) {
        console.error("properties query error", propErr);
        return json({ error: "Failed to load properties", details: propErr.message }, 500);
      }
      const propList = properties || [];

      if (fromParam && toParam) {
        const { data: reservations, error: resErr } = await supabase
          .from("manual_reservations").select("*").in("property_id", propertyIds)
          .neq("status", "Cancelled").eq("is_blocked", false).lte("check_in", toParam).gte("check_out", fromParam);
        if (resErr) {
          console.error("reservations query error", resErr);
          return json({ error: "Failed to load reservations", details: resErr.message }, 500);
        }
        const resList = reservations || [];

        const events: any[] = [];
        const current = new Date(fromParam);
        const end = new Date(toParam);
        while (current <= end) {
          const dateStr = current.toISOString().split("T")[0];
          for (const p of propList) {
            const propRes = resList.filter((r: any) => r.property_id === p.id);
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
                date: dateStr, property_id: p.id, property_name: p.name, status,
                guest_name: checkingIn?.guest_name || null,
                check_out_guest: propRes.find((r: any) => r.check_out === dateStr)?.guest_name || null,
                reservation_id: checkingIn?.id || null, keybox_code: p.keybox_code, cleaning_notes: p.cleaning_notes,
              });
            }
          }
          current.setDate(current.getDate() + 1);
        }

        return json(events);
      }

      const today = new Date().toISOString().split("T")[0];
      const { data: reservations, error: resErr } = await supabase
        .from("manual_reservations").select("*").in("property_id", propertyIds)
        .or(`check_in.eq.${today},check_out.eq.${today}`).neq("status", "Cancelled").eq("is_blocked", false);
      if (resErr) {
        console.error("reservations query error", resErr);
        return json({ error: "Failed to load reservations", details: resErr.message }, 500);
      }
      const resList = reservations || [];

      const tasks = propList.map((p: any) => {
        const propRes = resList.filter((r: any) => r.property_id === p.id);
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
          property_id: p.id, property_name: p.name, keybox_code: p.keybox_code, cleaning_notes: p.cleaning_notes,
          status, reservation_id: checkingIn?.id || null, guest_name: checkingIn?.guest_name || null,
          check_in: checkingIn?.check_in || null,
          check_out_guest: propRes.find((r: any) => r.check_out === today)?.guest_name || null,
        };
      });

      return json(tasks);
    }

    if (!userPin && !isAdmin) {
      return json({ error: "Unauthorized" }, 401);
    }

    if (method === "PUT") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      const { reservation_id, cleaning_status } = body || {};
      if (!reservation_id) {
        return json({ error: "Missing reservation_id" }, 400);
      }
      const updates = cleaning_status === "pending"
        ? { cleaning_status: "pending", last_cleaned_at: null }
        : { cleaning_status: "completed", last_cleaned_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from("manual_reservations").update(updates).eq("id", reservation_id).select().limit(1);
      if (error) {
        console.error("reservation update error", error);
        return json({ error: "Failed to update reservation", details: error.message }, 500);
      }
      if (!data || data.length === 0) {
        return json({ error: "Reservation not found" }, 404);
      }
      return json(data[0]);
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err: any) {
    console.error("cleaner-operations unexpected error", err);
    return json({ error: "Internal error", details: err?.message || String(err) }, 500);
  }
});
