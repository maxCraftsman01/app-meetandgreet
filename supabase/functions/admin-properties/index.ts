import { handleCors, json } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const pin = req.headers.get("x-admin-pin");
  if (pin !== Deno.env.get("ADMIN_PIN")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = getSupabaseClient();
  const url = new URL(req.url);
  const method = req.method;

  try {
    if (method === "GET") {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const enriched = await Promise.all(
        (data || []).map(async (prop) => {
          const today = new Date().toISOString().split("T")[0];
          const { count } = await supabase
            .from("bookings")
            .select("*", { count: "exact", head: true })
            .eq("property_id", prop.id)
            .gte("end_date", today);
          return { ...prop, active_bookings: count || 0 };
        })
      );

      return json(enriched);
    }

    if (method === "POST") {
      const body = await req.json();
      const { data, error } = await supabase.from("properties").insert(body).select().single();
      if (error) throw error;
      return json(data);
    }

    if (method === "PUT") {
      const body = await req.json();
      const id = url.searchParams.get("id");
      const { data, error } = await supabase.from("properties").update(body).eq("id", id).select().single();
      if (error) throw error;
      return json(data);
    }

    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
