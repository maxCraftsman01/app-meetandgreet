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
  const url = new URL(req.url);
  const method = req.method;

  try {
    if (method === "GET") {
      const propertyId = url.searchParams.get("property_id");
      let query = supabase.from("manual_reservations").select("*").order("check_in", { ascending: false });
      if (propertyId) query = query.eq("property_id", propertyId);
      const { data, error } = await query;
      if (error) throw error;
      return json(data || []);
    }

    if (method === "POST") {
      const body = await req.json();
      const { property_id, guest_name, check_in, check_out, source, net_payout, status, external_id } = body;
      const { data, error } = await supabase
        .from("manual_reservations")
        .insert({ property_id, guest_name, check_in, check_out, source, net_payout, status, external_id })
        .select().single();
      if (error) throw error;
      return json(data);
    }

    if (method === "PUT") {
      const id = url.searchParams.get("id");
      const body = await req.json();
      const { cleaning_status, ...updateFields } = body;
      const updateData: Record<string, unknown> = { ...updateFields, updated_at: new Date().toISOString() };
      if (cleaning_status !== undefined) updateData.cleaning_status = cleaning_status;
      const { data, error } = await supabase.from("manual_reservations").update(updateData).eq("id", id).select().single();
      if (error) throw error;
      return json(data);
    }

    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      const { error } = await supabase.from("manual_reservations").delete().eq("id", id);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
