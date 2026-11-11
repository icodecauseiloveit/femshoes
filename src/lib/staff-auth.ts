import "server-only";
import { isRole, type Role } from "./roles";
import { getSupabaseAdmin } from "./supabase-admin";

export class ActionError extends Error {}

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Valida la sesión (token de Supabase) y que el rol esté permitido. */
export async function requireRole(accessToken: string, allowed: Role[]) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new ActionError("Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.");

  const { data, error } = await admin.auth.getUser(accessToken);
  const email = data.user?.email?.toLowerCase();
  if (error || !email) throw new ActionError("Tu sesión expiró. Vuelve a iniciar sesión.");

  const { data: row } = await admin.from("admins").select("role").eq("email", email).maybeSingle();
  const role = row?.role;
  if (!isRole(role) || !allowed.includes(role)) {
    throw new ActionError("No tienes permiso para esta acción.");
  }
  return { admin, myEmail: email, role };
}

export async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, error: e.message };
    console.error("Error en acción del panel:", e);
    return { ok: false, error: "Ocurrió un error inesperado. Intenta de nuevo." };
  }
}
