"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SUPERADMIN,
  isPermission,
  slugifyRole,
  type Access,
  type Permission,
  type RoleDef,
  type StaffMember,
} from "@/lib/roles";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ActionError, accessOf, requireAccess, run, type Result } from "@/lib/staff-auth";

/** Verifica la sesión y que quien llama sea superadmin. */
async function requireSuperadmin(accessToken: string) {
  try {
    return await requireAccess(accessToken, [SUPERADMIN]);
  } catch (e) {
    if (e instanceof ActionError && e.message.startsWith("No tienes permiso")) {
      throw new ActionError("Solo un superadmin puede gestionar usuarios y roles.");
    }
    throw e;
  }
}

async function countSuperadmins(admin: SupabaseClient) {
  const { count } = await admin
    .from("admins")
    .select("email", { count: "exact", head: true })
    .eq("role", SUPERADMIN);
  return count ?? 0;
}

async function assertRoleExists(admin: SupabaseClient, slug: string) {
  const { data } = await admin.from("roles").select("slug").eq("slug", slug).maybeSingle();
  if (!data) throw new ActionError("Selecciona un rol válido.");
}

async function findUserIdByEmail(admin: SupabaseClient, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) return user.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function listStaff(accessToken: string): Promise<Result<StaffMember[]>> {
  return run(async () => {
    const { admin } = await requireSuperadmin(accessToken);
    const { data, error } = await admin
      .from("admins")
      .select("email, role, created_at")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({ email: r.email, role: r.role as string, createdAt: r.created_at }));
  });
}

export async function createStaff(
  accessToken: string,
  input: { email: string; password: string; role: string },
): Promise<Result> {
  return run(async () => {
    const { admin } = await requireSuperadmin(accessToken);
    const email = input.email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ActionError("El correo no es válido.");
    if (input.password.length < 8) throw new ActionError("La contraseña debe tener al menos 8 caracteres.");
    await assertRoleExists(admin, input.role);

    const { data: existing } = await admin.from("admins").select("email").eq("email", email).maybeSingle();
    if (existing) throw new ActionError("Ese correo ya tiene acceso al panel.");

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
    });
    if (error) {
      if (/already|registered|exists/i.test(error.message)) {
        throw new ActionError("Ya existe una cuenta con ese correo.");
      }
      throw error;
    }

    const { error: insertError } = await admin
      .from("admins")
      .insert({ email, role: input.role, user_id: data.user.id });
    if (insertError) {
      // Deshacer la cuenta si no se pudo registrar el rol
      await admin.auth.admin.deleteUser(data.user.id);
      throw insertError;
    }
    return undefined;
  });
}

export async function updateStaffRole(
  accessToken: string,
  input: { email: string; role: string },
): Promise<Result> {
  return run(async () => {
    const { admin, myEmail } = await requireSuperadmin(accessToken);
    await assertRoleExists(admin, input.role);
    const email = input.email.toLowerCase();

    if (input.role !== SUPERADMIN) {
      const { data: current } = await admin.from("admins").select("role").eq("email", email).maybeSingle();
      if (current?.role === SUPERADMIN && (await countSuperadmins(admin)) <= 1) {
        throw new ActionError("Debe quedar al menos un superadmin.");
      }
      if (email === myEmail) {
        throw new ActionError("No puedes quitarte tu propio rol de superadmin.");
      }
    }

    const { error } = await admin.from("admins").update({ role: input.role }).eq("email", email);
    if (error) throw error;
    return undefined;
  });
}

export async function removeStaff(accessToken: string, input: { email: string }): Promise<Result> {
  return run(async () => {
    const { admin, myEmail } = await requireSuperadmin(accessToken);
    const email = input.email.toLowerCase();
    if (email === myEmail) throw new ActionError("No puedes eliminar tu propia cuenta.");

    const { data: row } = await admin.from("admins").select("role, user_id").eq("email", email).maybeSingle();
    if (!row) throw new ActionError("Ese usuario ya no tiene acceso.");
    if (row.role === SUPERADMIN && (await countSuperadmins(admin)) <= 1) {
      throw new ActionError("Debe quedar al menos un superadmin.");
    }

    const { error } = await admin.from("admins").delete().eq("email", email);
    if (error) throw error;

    // El acceso ya quedó revocado (sin rol no entra al panel); ahora se borra la cuenta.
    const userId = row.user_id ?? (await findUserIdByEmail(admin, email));
    if (userId) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.error("No se pudo borrar la cuenta de", email, deleteError.message);
        throw new ActionError("Se quitó el acceso, pero no se pudo borrar la cuenta. Intenta de nuevo.");
      }
    }
    return undefined;
  });
}

/* ---------------- Mi acceso ---------------- */

/** Rol y permisos de quien tiene la sesión abierta (null si no tiene acceso al panel). */
export async function getMyAccess(accessToken: string): Promise<Result<Access | null>> {
  return run(async () => {
    const admin = getSupabaseAdmin();
    if (!admin) throw new ActionError("Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.");
    const { data, error } = await admin.auth.getUser(accessToken);
    const email = data.user?.email?.toLowerCase();
    if (error || !email) throw new ActionError("Tu sesión expiró. Vuelve a iniciar sesión.");
    return accessOf(admin, email);
  });
}

/* ---------------- Roles ---------------- */

type RoleRow = { slug: string; name: string; description: string; permissions: string[]; system: boolean };

/** Roles con su número de personas (solo superadmin). */
export async function listRoles(accessToken: string): Promise<Result<RoleDef[]>> {
  return run(async () => {
    const { admin } = await requireSuperadmin(accessToken);
    const [{ data: roles, error }, { data: members, error: mErr }] = await Promise.all([
      admin.from("roles").select("slug, name, description, permissions, system").order("created_at", { ascending: true }),
      admin.from("admins").select("role"),
    ]);
    if (error) throw error;
    if (mErr) throw mErr;
    const count = new Map<string, number>();
    for (const m of members ?? []) count.set(m.role, (count.get(m.role) ?? 0) + 1);
    return ((roles ?? []) as RoleRow[])
      .map((r) => ({
        slug: r.slug,
        name: r.name,
        description: r.description,
        permissions: (r.permissions ?? []).filter(isPermission),
        system: r.system,
        members: count.get(r.slug) ?? 0,
      }))
      .sort((a, b) => Number(b.system) - Number(a.system));
  });
}

/** Crea (sin slug) o edita (con slug) un rol. El superadmin no se puede editar. */
export async function saveRole(
  accessToken: string,
  input: { slug?: string; name: string; description: string; permissions: string[] },
): Promise<Result<string>> {
  return run(async () => {
    const { admin } = await requireSuperadmin(accessToken);
    const name = input.name.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 40) throw new ActionError("El nombre del rol debe tener entre 2 y 40 caracteres.");
    const description = input.description.trim().slice(0, 200);
    const permissions = [...new Set(input.permissions)].filter(isPermission) as Permission[];
    if (permissions.length === 0) throw new ActionError("Marca al menos un permiso.");

    const { data: all, error: listErr } = await admin.from("roles").select("slug, name, system");
    if (listErr) throw listErr;
    const rows = (all ?? []) as Pick<RoleRow, "slug" | "name" | "system">[];
    const sameName = rows.find((r) => r.name.toLowerCase() === name.toLowerCase() && r.slug !== input.slug);
    if (sameName) throw new ActionError("Ya existe un rol con ese nombre.");

    if (input.slug) {
      const current = rows.find((r) => r.slug === input.slug);
      if (!current) throw new ActionError("Ese rol ya no existe.");
      if (current.system) throw new ActionError("El rol Superadmin no se puede modificar.");
      const { error } = await admin
        .from("roles")
        .update({ name, description, permissions, updated_at: new Date().toISOString() })
        .eq("slug", input.slug);
      if (error) throw error;
      return input.slug;
    }

    const base = slugifyRole(name) || "rol";
    let slug = base.length >= 2 ? base : `rol_${base}`;
    for (let i = 2; rows.some((r) => r.slug === slug); i++) slug = `${base.slice(0, 36)}_${i}`;
    const { error } = await admin.from("roles").insert({ slug, name, description, permissions });
    if (error) throw error;
    return slug;
  });
}

/** Elimina un rol que nadie tenga asignado. */
export async function deleteRole(accessToken: string, input: { slug: string }): Promise<Result> {
  return run(async () => {
    const { admin } = await requireSuperadmin(accessToken);
    const { data: role } = await admin.from("roles").select("system").eq("slug", input.slug).maybeSingle();
    if (!role) throw new ActionError("Ese rol ya no existe.");
    if (role.system) throw new ActionError("El rol Superadmin no se puede eliminar.");
    const { count } = await admin.from("admins").select("email", { count: "exact", head: true }).eq("role", input.slug);
    if ((count ?? 0) > 0) {
      throw new ActionError(`No se puede eliminar: ${count} ${count === 1 ? "persona tiene" : "personas tienen"} este rol. Cámbialas de rol primero.`);
    }
    const { error } = await admin.from("roles").delete().eq("slug", input.slug);
    if (error) throw error;
    return undefined;
  });
}
