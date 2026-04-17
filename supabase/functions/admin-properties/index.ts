import { handleCors, json } from "../_shared/cors.ts";
import { getSupabaseClient, validateAdminPin } from "../_shared/auth.ts";

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function sanitizePayload(body: Record<string, unknown>, isUpdate = false) {
  const out: Record<string, unknown> = { ...body };
  if ("nightly_rate" in out && out.nightly_rate !== null && out.nightly_rate !== undefined) {
    const n = Number(out.nightly_rate);
    out.nightly_rate = Number.isFinite(n) ? n : 0;
  }
  if (!isUpdate && (out.currency === undefined || out.currency === null || out.currency === "")) {
    out.currency = "EUR";
  }
  if ("ical_urls" in out) out.ical_urls = toArray(out.ical_urls);
  if ("listing_urls" in out) out.listing_urls = toArray(out.listing_urls);
  return out;
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const pin = req.headers.get("x-admin-pin") || "";
  const isAdmin = await validateAdminPin(pin);
  if (!isAdmin) {
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
      if (error) {
        console.error("[admin-properties] GET error:", error);
        return json({ error: "Failed to load properties", details: error.message }, 500);
      }

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
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const name = typeof body.name === "string" ? body.name.trim() : "";
      const owner_name = typeof body.owner_name === "string" ? body.owner_name.trim() : "";
      const owner_pin = typeof body.owner_pin === "string" ? body.owner_pin.trim() : "";
      const missing: string[] = [];
      if (!name) missing.push("name");
      if (!owner_name) missing.push("owner_name");
      if (!owner_pin) missing.push("owner_pin");
      if (missing.length) {
        return json({ error: `Missing required fields: ${missing.join(", ")}` }, 400);
      }

      const payload = sanitizePayload({ ...body, name, owner_name, owner_pin });
      const { data, error } = await supabase.from("properties").insert(payload).select().single();
      if (error) {
        console.error("[admin-properties] POST error:", error, "payload:", payload);
        return json({ error: "Failed to create property", details: error.message }, 500);
      }
      return json(data);
    }

    if (method === "PUT") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Missing 'id' query parameter" }, 400);

      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const payload = sanitizePayload(body, true);
      const { data, error } = await supabase
        .from("properties")
        .update(payload)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) {
        console.error("[admin-properties] PUT error:", error, "id:", id, "payload:", payload);
        return json({ error: "Failed to update property", details: error.message }, 500);
      }
      if (!data) return json({ error: "Property not found" }, 404);
      return json(data);
    }

    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Missing 'id' query parameter" }, 400);
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) {
        console.error("[admin-properties] DELETE error:", error, "id:", id);
        return json({ error: "Failed to delete property", details: error.message }, 500);
      }
      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("[admin-properties] Unexpected error:", err);
    return json({ error: "Internal server error", details: (err as Error).message }, 500);
  }
});
