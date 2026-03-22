import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-pin",
};

async function isAdmin(req: Request): Promise<boolean> {
  const pin = req.headers.get("x-admin-pin");
  if (!pin) return false;
  
  // Check env-var super-admin
  if (pin === Deno.env.get("ADMIN_PIN")) return true;
  
  // Check if PIN belongs to an is_admin user
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

  if (!(await isAdmin(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

      // Get access for all users
      const { data: access } = await supabase
        .from("user_property_access")
        .select("*, properties:property_id(id, name)");

      // Get all properties for assignment UI
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

      return new Response(JSON.stringify({ users: enriched, properties: allProperties || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST: create user
    if (method === "POST") {
      const body = await req.json();
      const { name, pin, property_access, is_admin } = body;

      if (!name || !pin || pin.length !== 8) {
        return new Response(JSON.stringify({ error: "Name and 8-digit PIN required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: user, error } = await supabase
        .from("app_users")
        .insert({ name, pin, is_admin: is_admin ?? false })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return new Response(JSON.stringify({ error: "PIN already in use" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      // Insert property access if provided
      if (property_access && property_access.length > 0) {
        const rows = property_access.map((pa: any) => ({
          user_id: user.id,
          property_id: pa.property_id,
          can_view_finance: pa.can_view_finance ?? false,
          can_view_cleaning: pa.can_view_cleaning ?? false,
          can_mark_cleaned: pa.can_mark_cleaned ?? false,
        }));
        await supabase.from("user_property_access").insert(rows);
      }

      // Also sync cleaner_pin / owner_pin on the properties table for backward compatibility
      if (property_access) {
        for (const pa of property_access) {
          if (pa.can_view_finance) {
            await supabase.from("properties").update({ owner_pin: pin }).eq("id", pa.property_id);
          }
          if (pa.can_view_cleaning && !pa.can_view_finance) {
            await supabase.from("properties").update({ cleaner_pin: pin }).eq("id", pa.property_id);
          }
        }
      }

      return new Response(JSON.stringify(user), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT: update user
    if (method === "PUT") {
      const id = url.searchParams.get("id");
      const body = await req.json();
      const { name, pin, property_access, is_admin } = body;

      const updateData: Record<string, unknown> = {};
      if (name) updateData.name = name;
      if (pin) updateData.pin = pin;
      if (is_admin !== undefined) updateData.is_admin = is_admin;

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from("app_users")
          .update(updateData)
          .eq("id", id);
        if (error) {
          if (error.code === "23505") {
            return new Response(JSON.stringify({ error: "PIN already in use" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw error;
        }
      }

      // Replace property access
      if (property_access !== undefined) {
        await supabase.from("user_property_access").delete().eq("user_id", id);
        if (property_access.length > 0) {
          const rows = property_access.map((pa: any) => ({
            user_id: id,
            property_id: pa.property_id,
            can_view_finance: pa.can_view_finance ?? false,
            can_view_cleaning: pa.can_view_cleaning ?? false,
            can_mark_cleaned: pa.can_mark_cleaned ?? false,
          }));
          await supabase.from("user_property_access").insert(rows);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE: delete user
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      const { error } = await supabase.from("app_users").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
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
