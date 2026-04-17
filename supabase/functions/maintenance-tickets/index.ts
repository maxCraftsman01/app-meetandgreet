import { handleCors, corsHeaders, json } from "../_shared/cors.ts";
import { getSupabaseClient, validateAdminPin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const supabase = getSupabaseClient();
  const adminPinHeader = req.headers.get("x-admin-pin");
  const userPinHeader = req.headers.get("x-user-pin");

  let role: "admin" | "cleaner" | "owner" | null = null;
  let userId: string | null = null;
  let userPropertyIds: string[] = [];
  let canMarkProperties: string[] = [];
  let financePropertyIds: string[] = [];

  if (adminPinHeader) {
    if (await validateAdminPin(adminPinHeader)) {
      role = "admin";
      const { data: adminRows, error: adminErr } = await supabase
        .from("app_users").select("id").eq("pin", adminPinHeader).eq("is_admin", true).limit(1);
      if (adminErr) console.error("maintenance-tickets admin lookup error", adminErr);
      if (adminRows?.[0]) userId = adminRows[0].id;
    }
  } else if (userPinHeader) {
    const { data: userRows, error: userErr } = await supabase
      .from("app_users").select("id, is_admin").eq("pin", userPinHeader).limit(1);
    if (userErr) {
      console.error("maintenance-tickets app_users lookup error", userErr);
      return json({ error: "Server error" }, 500);
    }
    const user = userRows?.[0];
    if (user) {
      userId = user.id;
      if (user.is_admin) {
        role = "admin";
      } else {
        const { data: access } = await supabase
          .from("user_property_access").select("property_id, can_view_finance, can_mark_cleaned").eq("user_id", user.id);
        userPropertyIds = (access || []).map((a: any) => a.property_id);
        canMarkProperties = (access || []).filter((a: any) => a.can_mark_cleaned).map((a: any) => a.property_id);
        financePropertyIds = (access || []).filter((a: any) => a.can_view_finance).map((a: any) => a.property_id);
        if (canMarkProperties.length > 0) role = "cleaner";
        else if (financePropertyIds.length > 0) role = "owner";
      }
    }
  }

  if (!role) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const method = req.method;

  try {
    if (method === "GET") {
      const propertyId = url.searchParams.get("property_id");

      if (role === "admin") {
        let query = supabase.from("maintenance_tickets").select("*, ticket_media(*), properties:property_id(name)").order("created_at", { ascending: false });
        if (propertyId) query = query.eq("property_id", propertyId);
        const { data, error } = await query;
        if (error) throw error;
        return json(data || []);
      }

      if (role === "owner") {
        if (userPropertyIds.length === 0) return json([]);
        let query = supabase.from("maintenance_tickets").select("*, ticket_media(*), properties:property_id(name)")
          .in("property_id", userPropertyIds).or(`visible_to_owner.eq.true,created_by_user_id.eq.${userId}`).order("created_at", { ascending: false });
        if (propertyId) query = query.eq("property_id", propertyId);
        const { data, error } = await query;
        if (error) throw error;
        const masked = (data || []).map((t: any) => {
          if (!t.cost_visible_to_owner && t.created_by_user_id !== userId) return { ...t, repair_cost: 0 };
          return t;
        });
        return json(masked);
      }

      if (role === "cleaner") {
        if (!userId) return json([]);
        const propFilter = userPropertyIds.length > 0 ? userPropertyIds : ["00000000-0000-0000-0000-000000000000"];
        let query = supabase.from("maintenance_tickets").select("*, ticket_media(*), properties:property_id(name)")
          .or(`created_by_user_id.eq.${userId},and(visible_to_cleaner.eq.true,property_id.in.(${propFilter.join(",")}))`).order("created_at", { ascending: false });
        if (propertyId) query = query.eq("property_id", propertyId);
        const { data, error } = await query;
        if (error) throw error;
        return json((data || []).map((t: any) => ({ ...t, repair_cost: 0 })));
      }

      return json([]);
    }

    if (method === "POST") {
      const body = await req.json();
      const { property_id, title, description, priority, media } = body;
      if (!property_id || !title) return json({ error: "property_id and title required" }, 400);
      if (role === "cleaner" && !canMarkProperties.includes(property_id)) return json({ error: "No access to this property" }, 403);

      let visible_to_owner = false;
      let visible_to_cleaner = true;
      if (role === "admin") { visible_to_owner = false; visible_to_cleaner = false; }
      else if (role === "owner") { visible_to_owner = true; visible_to_cleaner = false; }

      const { data: ticket, error } = await supabase.from("maintenance_tickets").insert({
        property_id, created_by_user_id: userId,
        created_by_role: role === "admin" ? "admin" : role === "owner" ? "owner" : "cleaner",
        title, description: description || "", priority: priority || "normal",
        visible_to_owner, visible_to_cleaner,
      }).select().single();
      if (error) throw error;

      if (media && Array.isArray(media)) {
        for (const m of media) {
          if (m.storage_path) await supabase.from("ticket_media").insert({ ticket_id: ticket.id, media_type: m.media_type, storage_path: m.storage_path });
        }
      }
      return json(ticket, 201);
    }

    if (method === "PUT") {
      const ticketId = url.searchParams.get("id");
      if (!ticketId) return json({ error: "id required" }, 400);
      if (role !== "admin") return json({ error: "Only admin can update tickets" }, 403);
      const body = await req.json();
      const updates: Record<string, unknown> = {};
      if (body.status !== undefined) { updates.status = body.status; if (body.status === "resolved") updates.resolved_at = new Date().toISOString(); }
      if (body.repair_cost !== undefined) updates.repair_cost = body.repair_cost;
      if (body.visible_to_owner !== undefined) updates.visible_to_owner = body.visible_to_owner;
      if (body.visible_to_cleaner !== undefined) updates.visible_to_cleaner = body.visible_to_cleaner;
      if (body.priority !== undefined) updates.priority = body.priority;
      if (body.cost_visible_to_owner !== undefined) updates.cost_visible_to_owner = body.cost_visible_to_owner;
      if (body.title !== undefined) {
        if (typeof body.title !== "string" || body.title.trim().length === 0) {
          return json({ error: "title must be a non-empty string" }, 400);
        }
        updates.title = body.title.trim();
      }
      if (body.description !== undefined) {
        if (typeof body.description !== "string") {
          return json({ error: "description must be a string" }, 400);
        }
        updates.description = body.description;
      }
      if (body.property_id !== undefined) {
        if (typeof body.property_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.property_id)) {
          return json({ error: "property_id must be a valid uuid" }, 400);
        }
        const { data: prop, error: propErr } = await supabase
          .from("properties").select("id").eq("id", body.property_id).limit(1);
        if (propErr) {
          console.error("maintenance-tickets property lookup error", propErr);
          return json({ error: "Server error validating property" }, 500);
        }
        if (!prop?.[0]) return json({ error: "property_id not found" }, 404);
        updates.property_id = body.property_id;
      }
      const { data, error } = await supabase.from("maintenance_tickets").update(updates).eq("id", ticketId).select("*, ticket_media(*), properties:property_id(name)").single();
      if (error) throw error;
      return json(data);
    }

    if (method === "DELETE") {
      const ticketId = url.searchParams.get("id");
      if (!ticketId) return json({ error: "id required" }, 400);
      if (role !== "admin") return json({ error: "Only admin can delete tickets" }, 403);
      const { error } = await supabase.from("maintenance_tickets").delete().eq("id", ticketId);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err: any) {
    return json({ error: err.message || "Server error" }, 500);
  }
});
