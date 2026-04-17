import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/auth.ts";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const CLEANUP_MINUTES = 60;

function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  const supabase = getSupabaseClient();
  const clientIp = getClientIp(req);

  try {
    const { pin } = await req.json();

    if (!pin || pin.length !== 8) {
      return new Response(JSON.stringify({ error: "Invalid PIN format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("pin_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", clientIp)
      .gte("attempted_at", windowStart);

    if ((count ?? 0) >= MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({ error: "Too many attempts. Please try again later." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": String(WINDOW_MINUTES * 60) },
        }
      );
    }

    const cleanupCutoff = new Date(Date.now() - CLEANUP_MINUTES * 60 * 1000).toISOString();
    supabase.from("pin_attempts").delete().lt("attempted_at", cleanupCutoff).then(() => {});

    const envAdminPin = Deno.env.get("ADMIN_PIN");
    if (envAdminPin && pin === envAdminPin) {
      await supabase.from("pin_attempts").delete().eq("ip_address", clientIp);
      return new Response(JSON.stringify({ role: "admin", token: pin }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userRows, error: userErr } = await supabase
      .from("app_users")
      .select("id, name, pin, is_admin")
      .eq("pin", pin)
      .limit(1);

    if (userErr) {
      console.error("validate-pin app_users lookup error", userErr);
      return new Response(JSON.stringify({ error: "Server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userRows?.[0];
    if (!user) {
      await supabase.from("pin_attempts").insert({ ip_address: clientIp });
      return new Response(JSON.stringify({ error: "Invalid PIN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("pin_attempts").delete().eq("ip_address", clientIp);

    if (user.is_admin) {
      return new Response(
        JSON.stringify({ role: "admin", token: pin, user_id: user.id, user_name: user.name }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: access } = await supabase
      .from("user_property_access")
      .select("property_id, can_view_finance, can_view_cleaning, can_mark_cleaned, properties:property_id(id, name, owner_name)")
      .eq("user_id", user.id);

    const properties = (access || []).map((a: any) => ({
      id: a.properties.id, name: a.properties.name, owner_name: a.properties.owner_name,
      can_view_finance: a.can_view_finance, can_view_cleaning: a.can_view_cleaning, can_mark_cleaned: a.can_mark_cleaned,
    }));

    return new Response(
      JSON.stringify({ role: "user", token: pin, user_id: user.id, user_name: user.name, properties }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
