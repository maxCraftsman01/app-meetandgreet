import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-pin",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function isAdmin(pin: string): Promise<boolean> {
  if (!pin) return false;
  if (pin === Deno.env.get("ADMIN_PIN")) return true;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data } = await supabase
    .from("app_users")
    .select("id")
    .eq("pin", pin)
    .eq("is_admin", true)
    .single();

  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const pin = req.headers.get("x-admin-pin") || "";

  try {
    if (!(await isAdmin(pin))) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  } catch (err) {
    console.error("Admin check failed:", err);
    return jsonResponse({ error: "Admin validation failed" }, 500);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const method = req.method;

  try {
    // GET: list all users with their property access
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

      return jsonResponse({ users: enriched, properties: allProperties || [] });
    }

    // POST: create user
    if (method === "POST") {
      const body = await req.json();
      const { name, pin: userPin, property_access, is_admin: isAdminFlag } = body;

      if (!name || !userPin || userPin.length !== 8) {
        return jsonResponse({ error: "Name and 8-digit PIN required" }, 400);
      }

      const { data: user, error } = await supabase
        .from("app_users")
        .insert({ name, pin: userPin, is_admin: isAdminFlag ?? false })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return jsonResponse({ error: "PIN already in use" }, 400);
        }
        throw error;
      }

      if (property_access && property_access.length > 0) {
        const rows = property_access.map((pa: any) => ({
          user_id: user.id,
          property_id: pa.property_id,
          can_view_finance: pa.can_view_finance ?? false,
          can_view_cleaning: pa.can_view_cleaning ?? false,
          can_mark_cleaned: pa.can_mark_cleaned ?? false,
        }));
        const { error: accessError } = await supabase.from("user_property_access").insert(rows);
        if (accessError) {
          console.error("Failed to insert property access:", accessError);
          throw accessError;
        }
      }

      return jsonResponse(user);
    }

    // PUT: update user
    if (method === "PUT") {
      const id = url.searchParams.get("id");
      if (!id) {
        return jsonResponse({ error: "User id is required" }, 400);
      }

      const body = await req.json();
      console.log("PUT user", id, JSON.stringify(body));

      const { name, pin: userPin, property_access, is_admin: isAdminFlag } = body;

      const updateData: Record<string, unknown> = {};
      if (name) updateData.name = name;
      if (userPin) updateData.pin = userPin;
      if (isAdminFlag !== undefined) updateData.is_admin = isAdminFlag;

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from("app_users")
          .update(updateData)
          .eq("id", id);
        if (error) {
          console.error("Failed to update app_users:", error);
          if (error.code === "23505") {
            return jsonResponse({ error: "PIN already in use" }, 400);
          }
          throw error;
        }
      }

      // Replace property access
      if (property_access !== undefined) {
        const { error: delError } = await supabase
          .from("user_property_access")
          .delete()
          .eq("user_id", id);
        if (delError) {
          console.error("Failed to delete old access:", delError);
          throw delError;
        }

        if (Array.isArray(property_access) && property_access.length > 0) {
          const rows = property_access.map((pa: any) => ({
            user_id: id,
            property_id: pa.property_id,
            can_view_finance: pa.can_view_finance ?? false,
            can_view_cleaning: pa.can_view_cleaning ?? false,
            can_mark_cleaned: pa.can_mark_cleaned ?? false,
          }));
          const { error: insError } = await supabase
            .from("user_property_access")
            .insert(rows);
          if (insError) {
            console.error("Failed to insert new access:", insError);
            throw insError;
          }
        }
      }

      return jsonResponse({ success: true });
    }

    // DELETE: delete user
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) {
        return jsonResponse({ error: "User id is required" }, 400);
      }
      const { error } = await supabase.from("app_users").delete().eq("id", id);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("admin-users error:", err);
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});
