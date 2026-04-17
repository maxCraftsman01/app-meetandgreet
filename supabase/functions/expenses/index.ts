import { handleCors, json } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const supabase = getSupabaseClient();
  const adminPinHeader = req.headers.get("x-admin-pin");
  const userPinHeader = req.headers.get("x-user-pin");
  const envAdminPin = Deno.env.get("ADMIN_PIN");

  let role: "admin" | "cleaner" | "owner" | null = null;
  let userId: string | null = null;
  let financePropertyIds: string[] = [];

  if (adminPinHeader) {
    if (adminPinHeader === envAdminPin) {
      role = "admin";
    } else {
      const { data: adminUser } = await supabase
        .from("app_users").select("id, is_admin").eq("pin", adminPinHeader).single();
      if (adminUser?.is_admin) { role = "admin"; userId = adminUser.id; }
    }
  } else if (userPinHeader) {
    const { data: user } = await supabase
      .from("app_users").select("id, is_admin").eq("pin", userPinHeader).single();
    if (user) {
      userId = user.id;
      if (user.is_admin) {
        role = "admin";
      } else {
        const { data: access } = await supabase
          .from("user_property_access")
          .select("property_id, can_view_finance, can_view_cleaning, can_mark_cleaned")
          .eq("user_id", user.id);
        const accessRows = access || [];
        financePropertyIds = accessRows.filter((a: any) => a.can_view_finance).map((a: any) => a.property_id);
        const cleanerAccess = accessRows.some((a: any) => a.can_view_cleaning || a.can_mark_cleaned);
        if (cleanerAccess) role = "cleaner";
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
      const category = url.searchParams.get("category");
      const paymentStatus = url.searchParams.get("payment_status");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");

      const applyFilters = (q: any) => {
        if (propertyId) q = q.eq("property_id", propertyId);
        if (category) q = q.eq("category", category);
        if (paymentStatus) q = q.eq("payment_status", paymentStatus);
        if (dateFrom) q = q.gte("date", dateFrom);
        if (dateTo) q = q.lte("date", dateTo);
        return q;
      };

      if (role === "admin") {
        let query = supabase.from("expenses")
          .select("*, properties:property_id(name), assigned_user:assigned_to(name)")
          .order("date", { ascending: false });
        query = applyFilters(query);
        const { data, error } = await query;
        if (error) throw error;
        return json(data || []);
      }

      if (role === "owner") {
        if (financePropertyIds.length === 0) return json([]);
        let query = supabase.from("expenses")
          .select("*, properties:property_id(name), assigned_user:assigned_to(name)")
          .eq("visible_to_owner", true)
          .in("property_id", financePropertyIds)
          .order("date", { ascending: false });
        query = applyFilters(query);
        const { data, error } = await query;
        if (error) throw error;
        return json(data || []);
      }

      if (role === "cleaner") {
        if (!userId) return json([]);
        let query = supabase.from("expenses")
          .select("*, properties:property_id(name), assigned_user:assigned_to(name)")
          .eq("category", "cleaning")
          .eq("assigned_to", userId)
          .order("date", { ascending: false });
        query = applyFilters(query);
        const { data, error } = await query;
        if (error) throw error;
        return json(data || []);
      }

      return json([]);
    }

    if (method === "POST") {
      if (role !== "admin") return json({ error: "Only admin can create expenses" }, 403);
      const body = await req.json();
      const { property_id, date, category, title } = body;
      if (!property_id || !date || !category || !title) {
        return json({ error: "property_id, date, category, and title are required" }, 400);
      }
      const allowedCategories = ["cleaning", "maintenance", "repair", "shopping", "supplies", "other"];
      if (!allowedCategories.includes(category)) {
        return json({ error: "Invalid category" }, 400);
      }
      const allowedStatuses = ["pending", "paid", "invoiced"];
      if (body.payment_status && !allowedStatuses.includes(body.payment_status)) {
        return json({ error: "Invalid payment_status" }, 400);
      }
      if (!userId) return json({ error: "created_by user required (admin must be a registered app_user)" }, 400);

      const insertPayload: Record<string, unknown> = {
        property_id,
        date,
        category,
        title,
        description: body.description ?? "",
        amount: body.amount ?? null,
        payment_status: body.payment_status ?? "pending",
        paid_at: body.paid_at ?? null,
        visible_to_owner: body.visible_to_owner ?? false,
        assigned_to: body.assigned_to ?? null,
        linked_ticket_id: body.linked_ticket_id ?? null,
        created_by: userId,
      };

      const { data, error } = await supabase.from("expenses").insert(insertPayload).select().single();
      if (error) throw error;
      return json(data, 201);
    }

    if (method === "PUT") {
      const expenseId = url.searchParams.get("id");
      if (!expenseId) return json({ error: "id required" }, 400);
      if (role !== "admin") return json({ error: "Only admin can update expenses" }, 403);
      const body = await req.json();
      const updates: Record<string, unknown> = {};
      const fields = [
        "date", "category", "title", "description", "amount",
        "payment_status", "paid_at", "visible_to_owner",
        "assigned_to", "linked_ticket_id", "property_id",
      ];
      for (const f of fields) {
        if (body[f] !== undefined) updates[f] = body[f];
      }
      if (updates.category) {
        const allowed = ["cleaning", "maintenance", "repair", "shopping", "supplies", "other"];
        if (!allowed.includes(updates.category as string)) return json({ error: "Invalid category" }, 400);
      }
      if (updates.payment_status) {
        const allowed = ["pending", "paid", "invoiced"];
        if (!allowed.includes(updates.payment_status as string)) return json({ error: "Invalid payment_status" }, 400);
        if (updates.payment_status === "paid" && !updates.paid_at && body.paid_at === undefined) {
          updates.paid_at = new Date().toISOString();
        }
      }

      const { data, error } = await supabase.from("expenses").update(updates).eq("id", expenseId).select().single();
      if (error) throw error;
      return json(data);
    }

    if (method === "DELETE") {
      const expenseId = url.searchParams.get("id");
      if (!expenseId) return json({ error: "id required" }, 400);
      if (role !== "admin") return json({ error: "Only admin can delete expenses" }, 403);
      const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err: any) {
    return json({ error: err.message || "Server error" }, 500);
  }
});
