import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Check admin PIN
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

    // Check owner PIN
    const { data: ownerProps } = await supabase
      .from("properties")
      .select("id, name, owner_name")
      .eq("owner_pin", pin);

    if (ownerProps && ownerProps.length > 0) {
      return new Response(
        JSON.stringify({ role: "owner", token: pin, properties: ownerProps }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check cleaner PIN
    const { data: cleanerProps } = await supabase
      .from("properties")
      .select("id, name, owner_name")
      .eq("cleaner_pin", pin);

    if (cleanerProps && cleanerProps.length > 0) {
      return new Response(
        JSON.stringify({ role: "cleaner", token: pin, properties: cleanerProps }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid PIN" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
