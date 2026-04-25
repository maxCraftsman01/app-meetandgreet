import { handleCors, json } from "../_shared/cors.ts";
import { getSupabaseClient, validateAdminPin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const adminPin = req.headers.get("x-admin-pin") || "";
    const supabase = getSupabaseClient();

    if (!(await validateAdminPin(adminPin))) {
      return json({ error: "Unauthorized" }, 401);
    }

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!from || !to) {
      return json({ error: "from and to query params required" }, 400);
    }

    const { data: properties, error: propErr } = await supabase.from("properties").select("id, name").order("name");
    if (propErr) throw propErr;

    const { data: reservations, error: resErr } = await supabase
      .from("manual_reservations").select("*").lte("check_in", to).gte("check_out", from);
    if (resErr) throw resErr;

    const { data: bookings, error: bookErr } = await supabase
      .from("bookings").select("*").lte("start_date", to).gte("end_date", from);
    if (bookErr) throw bookErr;

    const { data: users } = await supabase.from("app_users").select("id, name").eq("is_admin", false);
    const { data: access } = await supabase.from("user_property_access").select("user_id, property_id, can_view_cleaning");

    return json({ properties, reservations, bookings, users: users || [], access: access || [] });
  } catch (err) {
    console.error("admin-timeline error:", err);
    return json({ error: (err instanceof Error ? err.message : String(err)) || "Internal error" }, 500);
  }
});
