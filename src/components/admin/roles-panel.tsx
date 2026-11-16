"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteRole, listRoles, saveRole } from "@/app/admin/actions";
import { permissionGroups, permissionLabel, permissionRequires, type Permission, type RoleDef } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";

async function getToken() {
  const { data } = await getSupabase()!.auth.getSession();
  return data.session?.access_token ?? "";
}

/** Roles del equipo: crear, editar permisos y eliminar (solo superadmin). */
export function RolesPanel() {
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<RoleDef | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listRoles(await getToken());
    if (res.ok) {
      setRoles(res.data);
      setError("");
    } else setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function remove(role: RoleDef) {
    setNotice("");
    const res = await deleteRole(await getToken(), { slug: role.slug });
    setConfirmDelete(null);
    if (!res.ok) return setError(res.error);
    setError("");
    setNotice(`Se eliminó el rol ${role.name}.`);
    load();
  }

  if (editing) {
    return (
      <RoleEditor
        role={editing === "new" ? null : editing}
        onCancel={() => setEditing(null)}
        onSaved={(name, created) => {
          setEditing(null);
          setError("");
          setNotice(created ? `Se creó el rol ${name}. Ya lo puedes asignar en Usuarios.` : `Se guardaron los permisos de ${name}.`);
          load();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">
          Roles <span className="text-lg text-muted">({roles.length})</span>
        </h1>
        <button onClick={() => setEditing("new")} className="btn min-h-10 bg-ink px-4 text-white">
          + Nuevo rol
        </button>
      </div>

      {notice && <p className="border border-gold/40 bg-mist p-3 text-sm">{notice}</p>}
      {error && <p className="border border-sale/40 bg-sale/5 p-3 text-sm text-sale">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Cargando roles…</p>
      ) : (
        <ul className="space-y-3" data-testid="roles">
          {roles.map((r) => (
            <li key={r.slug} className="border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted">
                    {r.members === 1 ? "1 persona" : `${r.members ?? 0} personas`}
                    {r.system && " · rol del sistema"}
                  </p>
                </div>
                {!r.system && (
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    <button onClick={() => setEditing(r)} className="text-ink-soft underline underline-offset-4">
                      Editar
                    </button>
                    {confirmDelete === r.slug ? (
                      <span className="flex items-center gap-2">
                        <span className="text-muted">¿Eliminar?</span>
                        <button onClick={() => remove(r)} className="font-medium text-sale underline underline-offset-4">Sí</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-ink-soft underline underline-offset-4">No</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmDelete(r.slug)} className="text-sale underline underline-offset-4">
                        Eliminar
                      </button>
                    )}
                  </div>
                )}
              </div>
              {r.description && <p className="mt-2 text-sm text-ink-soft">{r.description}</p>}
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {r.system ? (
                  <li className="bg-ink px-2 py-1 text-[0.7rem] text-white">Acceso total · usuarios, roles e historial</li>
                ) : r.permissions.length === 0 ? (
                  <li className="text-xs italic text-muted">Sin permisos</li>
                ) : (
                  r.permissions.map((p) => (
                    <li key={p} className="bg-mist px-2 py-1 text-[0.7rem] text-ink">
                      {permissionLabel(p)}
                    </li>
                  ))
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-muted">
        Gestionar usuarios, roles y ver el historial de productos es exclusivo del Superadmin. Un rol solo se puede
        eliminar cuando nadie lo tiene asignado.
      </p>
    </div>
  );
}

function RoleEditor({
  role,
  onCancel,
  onSaved,
}: {
  role: RoleDef | null;
  onCancel: () => void;
  onSaved: (name: string, created: boolean) => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [perms, setPerms] = useState<Permission[]>(role?.permissions ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Marcar un permiso marca también el que necesita; desmarcar uno quita los que dependen de él
  const toggle = (p: Permission, on: boolean) =>
    setPerms((cur) => {
      if (on) {
        const need = permissionRequires[p];
        return [...new Set([...cur, p, ...(need ? [need] : [])])];
      }
      return cur.filter((x) => x !== p && permissionRequires[x] !== p);
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (perms.length === 0) return setError("Marca al menos un permiso.");
    setSaving(true);
    setError("");
    const res = await saveRole(await getToken(), { slug: role?.slug, name, description, permissions: perms });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onSaved(name.trim(), !role);
  }

  return (
    <form onSubmit={submit} className="space-y-6 pb-8">
      <button type="button" onClick={onCancel} className="text-sm text-ink-soft">← Volver</button>
      <h1 className="text-3xl">{role ? `Editar rol: ${role.name}` : "Nuevo rol"}</h1>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">Nombre del rol</span>
          <input required minLength={2} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="Ej.: Atención a clientas" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-soft">Descripción (opcional)</span>
          <input maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} className="field" placeholder="Qué hace este rol" />
        </label>
      </div>

      <fieldset className="space-y-5">
        <legend className="eyebrow mb-1">Qué puede hacer</legend>
        {permissionGroups.map((g) => (
          <div key={g.label} className="border border-line bg-white p-4">
            <p className="mb-3 text-sm font-medium">{g.label}</p>
            <div className="space-y-3">
              {g.items.map((item) => (
                <label key={item.key} className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={perms.includes(item.key)}
                    onChange={(e) => toggle(item.key, e.target.checked)}
                    className="mt-0.5 size-5 shrink-0 accent-ink"
                  />
                  <span>
                    {item.label}
                    {"hint" in item && item.hint && <span className="block text-xs text-muted">{item.hint}</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </fieldset>

      {error && <p className="text-sm text-sale">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn flex-1 border border-ink">Cancelar</button>
        <button disabled={saving} className="btn flex-1 bg-ink text-white">
          {saving ? "Guardando…" : role ? "Guardar cambios" : "Crear rol"}
        </button>
      </div>
    </form>
  );
}
