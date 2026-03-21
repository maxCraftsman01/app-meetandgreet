import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-pin",
};

function isAdmin(req: Request): boolean {
  const pin = req.headers.get("x-admin-pin");
  return pin === Deno.env.get("ADMIN_PIN");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isAdmin(req)) {
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
    if (method === "GET") {
      const propertyId = url.searchParams.get("property_id");
      let query = supabase
        .from("manual_reservations")
        .select("*")
        .order("check_in", { ascending: false });

      if (propertyId) {
        query = query.eq("property_id", propertyId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify(data || []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "POST") {
      const body = await req.json();
      const { property_id, guest_name, check_in, check_out, source, net_payout, status, external_id } = body;
      const { data, error } = await supabase
        .from("manual_reservations")
        .insert({ property_id, guest_name, check_in, check_out, source, net_payout, status, external_id })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "PUT") {
      const id = url.searchParams.get("id");
      const body = await req.json();
      // Preserve cleaning_status unless explicitly provided
      const { cleaning_status, ...updateFields } = body;
      const updateData: Record<string, unknown> = { ...updateFields, updated_at: new Date().toISOString() };
      if (cleaning_status !== undefined) {
        updateData.cleaning_status = cleaning_status;
      }
      const { data, error } = await supabase
        .from("manual_reservations")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      const { error } = await supabase
        .from("manual_reservations")
        .delete()
        .eq("id", id);
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
