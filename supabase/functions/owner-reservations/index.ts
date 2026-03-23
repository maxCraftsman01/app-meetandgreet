import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-pin, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const pin = req.headers.get("x-user-pin");
    if (!pin) {
      return new Response(JSON.stringify({ error: "Missing PIN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if this is the super-admin PIN
    const adminPin = Deno.env.get("ADMIN_PIN");
    let userId: string | null = null;
    let isAdmin = false;

    if (pin === adminPin) {
      isAdmin = true;
    } else {
      // Look up user
      const { data: user } = await supabase
        .from("app_users")
        .select("id, is_admin")
        .eq("pin", pin)
        .single();

      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid PIN" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = user.id;
      isAdmin = user.is_admin;
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { property_id, check_in, check_out, guest_name, net_payout, is_blocked } = body;

      if (!property_id || !check_in || !check_out) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check permission: admin has full access, others need can_view_finance
      if (!isAdmin && userId) {
        const { data: access } = await supabase
          .from("user_property_access")
          .select("can_view_finance")
          .eq("user_id", userId)
          .eq("property_id", property_id)
          .single();

        if (!access?.can_view_finance) {
          return new Response(JSON.stringify({ error: "No finance access for this property" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const insertData: Record<string, unknown> = {
        property_id,
        check_in,
        check_out,
        guest_name: is_blocked ? "Blocked" : (guest_name || "Private Guest"),
        net_payout: is_blocked ? 0 : (net_payout || 0),
        is_blocked: !!is_blocked,
        source: is_blocked ? "Owner" : "Direct",
        status: "Confirmed",
      };

      const { data, error } = await supabase
        .from("manual_reservations")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
