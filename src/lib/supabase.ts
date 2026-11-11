import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const PRODUCT_IMAGES_BUCKET = "productos";

let client: SupabaseClient | null = null;

/** Cliente de Supabase (navegador o servidor). Devuelve null en modo de ejemplo. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: { persistSession: typeof window !== "undefined" },
    });
  }
  return client;
}
