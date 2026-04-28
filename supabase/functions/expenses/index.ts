import { handleCors, json } from "../_shared/cors.ts";
import { getSupabaseClient, validateAdminPin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const supabase = getSupabaseClient();
  const adminPinHeader = req.headers.get("x-admin-pin");
  const userPinHeader = req.headers.get("x-user-pin");

  let role: "admin" | "cleaner" | "owner" | null = null;
  let userId: string | null = null;
  let financePropertyIds: string[] = [];

  if (adminPinHeader) {
    if (await validateAdminPin(adminPinHeader)) {
      role = "admin";
      const { data: adminRows, error: adminErr } = await supabase
        .from("app_users").select("id").eq("pin", adminPinHeader).eq("is_admin", true).limit(1);
      if (adminErr) console.error("expenses admin lookup error", adminErr);
      if (adminRows?.[0]) userId = adminRows[0].id;
    }
  } else if (userPinHeader) {
    const { data: userRows, error: userErr } = await supabase
      .from("app_users").select("id, is_admin").eq("pin", userPinHeader).limit(1);
    if (userErr) {
      console.error("expenses app_users lookup error", userErr);
      return json({ error: "Server error" }, 500);
    }
    const user = userRows?.[0];
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

  // Helper: attach linked_tickets to expense rows
  const attachLinkedTickets = async (rows: any[]) => {
    if (!rows || rows.length === 0) return rows;
    const expenseIds = rows.map((r) => r.id);
    const { data: links, error } = await supabase
      .from("expense_tickets")
      .select("expense_id, ticket_id, maintenance_tickets:ticket_id(id, title, status)")
      .in("expense_id", expenseIds);
    if (error) {
      console.error("expense_tickets fetch error", error);
      return rows.map((r) => ({ ...r, linked_ticket_ids: [], linked_tickets: [] }));
    }
    const byExpense = new Map<string, { id: string; title: string; status?: string }[]>();
    for (const l of (links || []) as any[]) {
      const t = l.maintenance_tickets;
      if (!t) continue;
      const arr = byExpense.get(l.expense_id) ?? [];
      arr.push({ id: t.id, title: t.title, status: t.status });
      byExpense.set(l.expense_id, arr);
    }
    return rows.map((r) => {
      const linked = byExpense.get(r.id) ?? [];
      return { ...r, linked_tickets: linked, linked_ticket_ids: linked.map((t) => t.id) };
    });
  };

  // Helper: replace ticket links for an expense (validates property match)
  const setLinkedTickets = async (
    expenseId: string,
    propertyId: string,
    ticketIds: string[],
  ): Promise<{ ok: true } | { ok: false; status: number; error: string }> => {
    const unique = Array.from(new Set(ticketIds.filter(Boolean)));
    if (unique.length > 0) {
      const { data: validTickets, error: vErr } = await supabase
        .from("maintenance_tickets")
        .select("id, property_id")
        .in("id", unique);
      if (vErr) return { ok: false, status: 500, error: vErr.message };
      if ((validTickets?.length ?? 0) !== unique.length) {
        return { ok: false, status: 400, error: "One or more tickets not found" };
      }
      const wrong = (validTickets || []).find((t: any) => t.property_id !== propertyId);
      if (wrong) return { ok: false, status: 400, error: "All linked tickets must belong to the expense's property" };
    }
    const { error: delErr } = await supabase
      .from("expense_tickets").delete().eq("expense_id", expenseId);
    if (delErr) return { ok: false, status: 500, error: delErr.message };
    if (unique.length > 0) {
      const rows = unique.map((tid) => ({ expense_id: expenseId, ticket_id: tid }));
      const { error: insErr } = await supabase.from("expense_tickets").insert(rows);
      if (insErr) return { ok: false, status: 500, error: insErr.message };
    }
    return { ok: true };
  };

  try {
    if (method === "GET") {
      const propertyId = url.searchParams.get("property_id");
      const category = url.searchParams.get("category");
      const paymentStatus = url.searchParams.get("payment_status");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");
      const linkedTicketId = url.searchParams.get("linked_ticket_id");

      // Restrict by ticket link if requested
      let restrictExpenseIds: string[] | null = null;
      if (linkedTicketId) {
        const { data: linkRows, error: lErr } = await supabase
          .from("expense_tickets").select("expense_id").eq("ticket_id", linkedTicketId);
        if (lErr) throw lErr;
        restrictExpenseIds = (linkRows || []).map((r: any) => r.expense_id);
        if (restrictExpenseIds.length === 0) return json([]);
      }

      const applyFilters = (q: any) => {
        if (propertyId) q = q.eq("property_id", propertyId);
        if (category) q = q.eq("category", category);
        if (paymentStatus) q = q.eq("payment_status", paymentStatus);
        if (dateFrom) q = q.gte("date", dateFrom);
        if (dateTo) q = q.lte("date", dateTo);
        if (restrictExpenseIds) q = q.in("id", restrictExpenseIds);
        return q;
      };

      let query: any;
      if (role === "admin") {
        query = supabase.from("expenses")
          .select("*, properties:property_id(name), assigned_user:assigned_to(name)")
          .order("date", { ascending: false });
      } else if (role === "owner") {
        if (financePropertyIds.length === 0) return json([]);
        query = supabase.from("expenses")
          .select("*, properties:property_id(name), assigned_user:assigned_to(name)")
          .eq("visible_to_owner", true)
          .in("property_id", financePropertyIds)
          .order("date", { ascending: false });
      } else if (role === "cleaner") {
        if (!userId) return json([]);
        query = supabase.from("expenses")
          .select("*, properties:property_id(name), assigned_user:assigned_to(name)")
          .eq("category", "cleaning")
          .eq("assigned_to", userId)
          .order("date", { ascending: false });
      } else {
        return json([]);
      }

      query = applyFilters(query);
      const { data, error } = await query;
      if (error) throw error;
      const enriched = await attachLinkedTickets(data || []);
      return json(enriched);
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
        created_by: userId,
      };

      const { data, error } = await supabase.from("expenses").insert(insertPayload).select().single();
      if (error) throw error;

      const ticketIds: string[] = Array.isArray(body.linked_ticket_ids) ? body.linked_ticket_ids : [];
      const linkRes = await setLinkedTickets(data.id, property_id, ticketIds);
      if (!linkRes.ok) {
        // Best-effort: rollback the just-created expense
        await supabase.from("expenses").delete().eq("id", data.id);
        return json({ error: linkRes.error }, linkRes.status);
      }

      const [enriched] = await attachLinkedTickets([data]);
      return json(enriched, 201);
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
        "assigned_to", "property_id",
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

      let updatedRow: any;
      if (Object.keys(updates).length > 0) {
        const { data, error } = await supabase.from("expenses").update(updates).eq("id", expenseId).select().single();
        if (error) throw error;
        updatedRow = data;
      } else {
        const { data, error } = await supabase.from("expenses").select("*").eq("id", expenseId).single();
        if (error) throw error;
        updatedRow = data;
      }

      if (Array.isArray(body.linked_ticket_ids)) {
        const linkRes = await setLinkedTickets(expenseId, updatedRow.property_id, body.linked_ticket_ids);
        if (!linkRes.ok) return json({ error: linkRes.error }, linkRes.status);
      }

      const [enriched] = await attachLinkedTickets([updatedRow]);
      return json(enriched);
    }

    if (method === "DELETE") {
      const expenseId = url.searchParams.get("id");
      if (!expenseId) return json({ error: "id required" }, 400);
      if (role !== "admin") return json({ error: "Only admin can delete expenses" }, 403);
      // Join rows cascade-free: clean up first
      await supabase.from("expense_tickets").delete().eq("expense_id", expenseId);
      const { error } = await supabase.from("expenses").delete().eq("id", expenseId);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err: any) {
    return json({ error: err.message || "Server error" }, 500);
  }
});
