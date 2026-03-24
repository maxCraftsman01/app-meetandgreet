import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-pin, x-user-pin, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const adminPinHeader = req.headers.get("x-admin-pin");
  const userPinHeader = req.headers.get("x-user-pin");
  const envAdminPin = Deno.env.get("ADMIN_PIN");

  let role: "admin" | "cleaner" | "owner" | null = null;
  let userId: string | null = null;
  let userPropertyIds: string[] = [];
  let canMarkProperties: string[] = [];
  let financePropertyIds: string[] = [];

  // Authenticate
  if (adminPinHeader) {
    if (adminPinHeader === envAdminPin) {
      role = "admin";
    } else {
      const { data: adminUser } = await supabase
        .from("app_users")
        .select("id, is_admin")
        .eq("pin", adminPinHeader)
        .single();
      if (adminUser?.is_admin) {
        role = "admin";
        userId = adminUser.id;
      }
    }
  } else if (userPinHeader) {
    const { data: user } = await supabase
      .from("app_users")
      .select("id, is_admin")
      .eq("pin", userPinHeader)
      .single();
    if (user) {
      userId = user.id;
      if (user.is_admin) {
        role = "admin";
      } else {
        const { data: access } = await supabase
          .from("user_property_access")
          .select("property_id, can_view_finance, can_mark_cleaned")
          .eq("user_id", user.id);
        
        userPropertyIds = (access || []).map((a: any) => a.property_id);
        canMarkProperties = (access || []).filter((a: any) => a.can_mark_cleaned).map((a: any) => a.property_id);
        financePropertyIds = (access || []).filter((a: any) => a.can_view_finance).map((a: any) => a.property_id);
        
        // Assign role: if user has cleaning access, they're a cleaner; if only finance, they're owner
        if (canMarkProperties.length > 0) {
          role = "cleaner";
        } else if (financePropertyIds.length > 0) {
          role = "owner";
        }
      }
    }
  }

  if (!role) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const method = req.method;

  try {
    // GET — list tickets
    if (method === "GET") {
      const propertyId = url.searchParams.get("property_id");

      if (role === "admin") {
        let query = supabase
          .from("maintenance_tickets")
          .select("*, ticket_media(*), properties:property_id(name)")
          .order("created_at", { ascending: false });
        if (propertyId) query = query.eq("property_id", propertyId);
        const { data, error } = await query;
        if (error) throw error;
        return json(data || []);
      }

      if (role === "owner") {
        if (userPropertyIds.length === 0) return json([]);
        // Owner sees: tickets they created OR visible_to_owner = true on their properties
        let query = supabase
          .from("maintenance_tickets")
          .select("*, ticket_media(*), properties:property_id(name)")
          .in("property_id", userPropertyIds)
          .or(`visible_to_owner.eq.true,created_by_user_id.eq.${userId}`)
          .order("created_at", { ascending: false });
        if (propertyId) query = query.eq("property_id", propertyId);
        const { data, error } = await query;
        if (error) throw error;
        return json(data || []);
      }

      if (role === "cleaner") {
        if (!userId) return json([]);
        // Cleaner sees: tickets they created OR visible_to_cleaner = true on their properties
        const propFilter = userPropertyIds.length > 0 ? userPropertyIds : ["00000000-0000-0000-0000-000000000000"];
        let query = supabase
          .from("maintenance_tickets")
          .select("*, ticket_media(*), properties:property_id(name)")
          .or(`created_by_user_id.eq.${userId},and(visible_to_cleaner.eq.true,property_id.in.(${propFilter.join(",")}))`)
          .order("created_at", { ascending: false });
        if (propertyId) query = query.eq("property_id", propertyId);
        const { data, error } = await query;
        if (error) throw error;
        return json(data || []);
      }

      return json([]);
    }

    // POST — create ticket
    if (method === "POST") {
      const body = await req.json();
      const { property_id, title, description, priority, media } = body;

      if (!property_id || !title) return json({ error: "property_id and title required" }, 400);

      if (role === "cleaner" && !canMarkProperties.includes(property_id)) {
        return json({ error: "No access to this property" }, 403);
      }

      // Set default visibility based on creator role
      let visible_to_owner = false;
      let visible_to_cleaner = true;
      if (role === "admin") {
        visible_to_owner = false;
        visible_to_cleaner = false;
      } else if (role === "owner") {
        visible_to_owner = true;
        visible_to_cleaner = false;
      }
      // cleaner: visible_to_cleaner=true, visible_to_owner=false (defaults)

      const { data: ticket, error } = await supabase
        .from("maintenance_tickets")
        .insert({
          property_id,
          created_by_user_id: userId,
          created_by_role: role === "admin" ? "admin" : role === "owner" ? "owner" : "cleaner",
          title,
          description: description || "",
          priority: priority || "normal",
          visible_to_owner,
          visible_to_cleaner,
        })
        .select()
        .single();

      if (error) throw error;

      if (media && Array.isArray(media)) {
        for (const m of media) {
          if (m.storage_path) {
            await supabase.from("ticket_media").insert({
              ticket_id: ticket.id,
              media_type: m.media_type,
              storage_path: m.storage_path,
            });
          }
        }
      }

      return json(ticket, 201);
    }

    // PUT — update ticket (admin only for most fields)
    if (method === "PUT") {
      const ticketId = url.searchParams.get("id");
      if (!ticketId) return json({ error: "id required" }, 400);

      if (role !== "admin") return json({ error: "Only admin can update tickets" }, 403);

      const body = await req.json();
      const updates: Record<string, unknown> = {};
      if (body.status !== undefined) {
        updates.status = body.status;
        if (body.status === "resolved") updates.resolved_at = new Date().toISOString();
      }
      if (body.repair_cost !== undefined) updates.repair_cost = body.repair_cost;
      if (body.visible_to_owner !== undefined) updates.visible_to_owner = body.visible_to_owner;
      if (body.visible_to_cleaner !== undefined) updates.visible_to_cleaner = body.visible_to_cleaner;
      if (body.priority !== undefined) updates.priority = body.priority;

      const { data, error } = await supabase
        .from("maintenance_tickets")
        .update(updates)
        .eq("id", ticketId)
        .select()
        .single();

      if (error) throw error;
      return json(data);
    }

    // DELETE — admin only
    if (method === "DELETE") {
      const ticketId = url.searchParams.get("id");
      if (!ticketId) return json({ error: "id required" }, 400);
      if (role !== "admin") return json({ error: "Only admin can delete tickets" }, 403);

      const { error } = await supabase
        .from("maintenance_tickets")
        .delete()
        .eq("id", ticketId);

      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err: any) {
    return json({ error: err.message || "Server error" }, 500);
  }
});
