import { handleCors, json } from "../_shared/cors.ts";
import { getSupabaseClient, validateAdminPin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const pin = req.headers.get("x-admin-pin") || "";

  try {
    if (!(await validateAdminPin(pin))) {
      return json({ error: "Unauthorized" }, 401);
    }
  } catch (err) {
    console.error("Admin check failed:", err);
    return json({ error: "Admin validation failed" }, 500);
  }

  const supabase = getSupabaseClient();
  const url = new URL(req.url);
  const method = req.method;

  try {
    if (method === "GET") {
      const { data: users, error } = await supabase
        .from("app_users")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: access } = await supabase
        .from("user_property_access")
        .select("*, properties:property_id(id, name)");

      const { data: allProperties } = await supabase
        .from("properties")
        .select("id, name")
        .order("name");

      const enriched = (users || []).map((u: any) => ({
        ...u,
        property_access: (access || [])
          .filter((a: any) => a.user_id === u.id)
          .map((a: any) => ({
            property_id: a.property_id,
            property_name: a.properties?.name || "Unknown",
            can_view_finance: a.can_view_finance,
            can_view_cleaning: a.can_view_cleaning,
            can_mark_cleaned: a.can_mark_cleaned,
          })),
      }));

      return json({ users: enriched, properties: allProperties || [] });
    }

    if (method === "POST") {
      const body = await req.json();
      const { name, pin: userPin, property_access, is_admin: isAdminFlag } = body;

      if (!name || !userPin || userPin.length !== 8) {
        return json({ error: "Name and 8-digit PIN required" }, 400);
      }

      const { data: user, error } = await supabase
        .from("app_users")
        .insert({ name, pin: userPin, is_admin: isAdminFlag ?? false })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") return json({ error: "PIN already in use" }, 400);
        throw error;
      }

      if (property_access && property_access.length > 0) {
        const rows = property_access.map((pa: any) => ({
          user_id: user.id, property_id: pa.property_id,
          can_view_finance: pa.can_view_finance ?? false,
          can_view_cleaning: pa.can_view_cleaning ?? false,
          can_mark_cleaned: pa.can_mark_cleaned ?? false,
        }));
        const { error: accessError } = await supabase.from("user_property_access").insert(rows);
        if (accessError) throw accessError;
      }

      return json(user);
    }

    if (method === "PUT") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "User id is required" }, 400);

      const body = await req.json();
      const { name, pin: userPin, property_access, is_admin: isAdminFlag } = body;

      const updateData: Record<string, unknown> = {};
      if (name) updateData.name = name;
      if (userPin) updateData.pin = userPin;
      if (isAdminFlag !== undefined) updateData.is_admin = isAdminFlag;

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase.from("app_users").update(updateData).eq("id", id);
        if (error) {
          if (error.code === "23505") return json({ error: "PIN already in use" }, 400);
          throw error;
        }
      }

      if (property_access !== undefined) {
        await supabase.from("user_property_access").delete().eq("user_id", id);
        if (Array.isArray(property_access) && property_access.length > 0) {
          const rows = property_access.map((pa: any) => ({
            user_id: id, property_id: pa.property_id,
            can_view_finance: pa.can_view_finance ?? false,
            can_view_cleaning: pa.can_view_cleaning ?? false,
            can_mark_cleaned: pa.can_mark_cleaned ?? false,
          }));
          const { error: insError } = await supabase.from("user_property_access").insert(rows);
          if (insError) throw insError;
        }
      }

      return json({ success: true });
    }

    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "User id is required" }, 400);
      const { error } = await supabase.from("app_users").delete().eq("id", id);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("admin-users error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
