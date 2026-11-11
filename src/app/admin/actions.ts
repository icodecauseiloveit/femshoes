"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isRole, type Role, type StaffMember } from "@/lib/roles";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

class ActionError extends Error {}

/** Verifica la sesión y que quien llama sea superadmin. */
async function requireSuperadmin(accessToken: string) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new ActionError("Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  }
  const { data, error } = await admin.auth.getUser(accessToken);
  const email = data.user?.email?.toLowerCase();
  if (error || !email) throw new ActionError("Tu sesión expiró. Vuelve a iniciar sesión.");

  const { data: row } = await admin.from("admins").select("role").eq("email", email).maybeSingle();
  if (row?.role !== "superadmin") {
    throw new ActionError("Solo un superadmin puede gestionar usuarios.");
  }
  return { admin, myEmail: email };
}

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, error: e.message };
    console.error("Error en acción de usuarios:", e);
    return { ok: false, error: "Ocurrió un error inesperado. Intenta de nuevo." };
  }
}

async function countSuperadmins(admin: SupabaseClient) {
  const { count } = await admin
    .from("admins")
    .select("email", { count: "exact", head: true })
    .eq("role", "superadmin");
  return count ?? 0;
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
    return (data ?? []).map((r) => ({ email: r.email, role: r.role as Role, createdAt: r.created_at }));
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
    if (!isRole(input.role)) throw new ActionError("Selecciona un rol válido.");

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
    if (!isRole(input.role)) throw new ActionError("Selecciona un rol válido.");
    const email = input.email.toLowerCase();

    if (input.role !== "superadmin") {
      const { data: current } = await admin.from("admins").select("role").eq("email", email).maybeSingle();
      if (current?.role === "superadmin" && (await countSuperadmins(admin)) <= 1) {
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
    if (row.role === "superadmin" && (await countSuperadmins(admin)) <= 1) {
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
