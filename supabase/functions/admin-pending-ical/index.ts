import { handleCors, json } from "../_shared/cors.ts";
import { getSupabaseClient, validateAdminPin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const pin = req.headers.get("x-admin-pin") || "";
  if (!(await validateAdminPin(pin))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = getSupabaseClient();

  try {
    const { data: bookings, error: bErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("status", "booked")
      .order("start_date");
    if (bErr) throw bErr;

    const { data: manualRes, error: mErr } = await supabase
      .from("manual_reservations")
      .select("external_id, check_in, check_out, property_id")
      .neq("status", "Cancelled");
    if (mErr) throw mErr;

    const matchedIds = new Set((manualRes || []).filter(r => r.external_id).map(r => r.external_id));
    const matchedDates = new Set(
      (manualRes || []).map(r => `${r.property_id}_${r.check_in}_${r.check_out}`)
    );

    const pending = (bookings || []).filter((b) => {
      const extId = `${b.property_id}_${b.start_date}_${b.end_date}`;
      if (matchedIds.has(extId)) return false;
      if (matchedDates.has(`${b.property_id}_${b.start_date}_${b.end_date}`)) return false;
      return true;
    });

    return json(pending);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
