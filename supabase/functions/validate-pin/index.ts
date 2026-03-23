import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pin } = await req.json();

    if (!pin || pin.length !== 8) {
      return new Response(JSON.stringify({ error: "Invalid PIN format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check env-var super-admin PIN
    const adminPin = Deno.env.get("ADMIN_PIN");
    if (pin === adminPin) {
      return new Response(JSON.stringify({ role: "admin", token: pin }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up user in app_users table
    const { data: user } = await supabase
      .from("app_users")
      .select("id, name, pin, is_admin")
      .eq("pin", pin)
      .single();

    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid PIN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If user is an admin, return admin role
    if (user.is_admin) {
      return new Response(
        JSON.stringify({ role: "admin", token: pin, user_id: user.id, user_name: user.name }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get property access permissions for this user
    const { data: access } = await supabase
      .from("user_property_access")
      .select("property_id, can_view_finance, can_view_cleaning, can_mark_cleaned, properties:property_id(id, name, owner_name)")
      .eq("user_id", user.id);

    const properties = (access || []).map((a: any) => ({
      id: a.properties.id,
      name: a.properties.name,
      owner_name: a.properties.owner_name,
      can_view_finance: a.can_view_finance,
      can_view_cleaning: a.can_view_cleaning,
      can_mark_cleaned: a.can_mark_cleaned,
    }));

    return new Response(
      JSON.stringify({
        role: "user",
        token: pin,
        user_id: user.id,
        user_name: user.name,
        properties,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
