import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

export async function validateAdminPin(pin: string): Promise<boolean> {
  if (!pin) return false;
  if (pin === Deno.env.get("ADMIN_PIN")) return true;

  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("app_users")
    .select("id")
    .eq("pin", pin)
    .eq("is_admin", true)
    .maybeSingle();

  return !!data;
}
