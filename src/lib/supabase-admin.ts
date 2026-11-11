import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con la llave de servicio (service role). Solo se usa en el servidor:
 * salta las reglas de seguridad, así que nunca debe llegar al navegador.
 * Requiere la variable de entorno SUPABASE_SERVICE_ROLE_KEY (en tiempo de ejecución).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
