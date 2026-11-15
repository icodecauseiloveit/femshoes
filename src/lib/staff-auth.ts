import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPERADMIN, isPermission, type Access, type Permission } from "./roles";
import { getSupabaseAdmin } from "./supabase-admin";

export class ActionError extends Error {}

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Lee el rol y los permisos de un correo del equipo (null si no tiene acceso). */
export async function accessOf(admin: SupabaseClient, email: string): Promise<Access | null> {
  const { data: row } = await admin.from("admins").select("role").eq("email", email).maybeSingle();
  if (!row?.role) return null;
  const { data: role } = await admin.from("roles").select("slug, name, permissions").eq("slug", row.role).maybeSingle();
  if (!role) return null;
  const superadmin = role.slug === SUPERADMIN;
  return {
    role: role.slug,
    roleName: role.name,
    superadmin,
    permissions: ((role.permissions ?? []) as string[]).filter(isPermission),
  };
}

/**
 * Valida la sesión (token de Supabase) y que tenga al menos uno de los permisos pedidos.
 * "superadmin" en la lista exige ser superadmin (usuarios, roles, historial).
 */
export async function requireAccess(accessToken: string, anyOf: (Permission | typeof SUPERADMIN)[]) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new ActionError("Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.");

  const { data, error } = await admin.auth.getUser(accessToken);
  const email = data.user?.email?.toLowerCase();
  if (error || !email) throw new ActionError("Tu sesión expiró. Vuelve a iniciar sesión.");

  const access = await accessOf(admin, email);
  const allowed =
    access &&
    (access.superadmin || anyOf.some((p) => p !== SUPERADMIN && access.permissions.includes(p)));
  if (!allowed) throw new ActionError("No tienes permiso para esta acción.");
  return { admin, myEmail: email, access };
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
