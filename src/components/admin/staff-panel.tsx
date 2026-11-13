"use client";

import { useCallback, useEffect, useState } from "react";
import { createStaff, listStaff, removeStaff, updateStaffRole } from "@/app/admin/actions";
import { roleLabel, roles, type Role, type StaffMember } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";

async function getToken() {
  const { data } = await getSupabase()!.auth.getSession();
  return data.session?.access_token ?? "";
}

export function StaffPanel({ myEmail }: { myEmail: string }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listStaff(await getToken());
    if (res.ok) {
      setStaff(res.data);
      setError("");
    } else setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function changeRole(member: StaffMember, role: Role) {
    if (role === member.role) return;
    setNotice("");
    const res = await updateStaffRole(await getToken(), { email: member.email, role });
    if (!res.ok) return setError(res.error);
    setError("");
    setNotice(`${member.email} ahora es ${roleLabel(role)}.`);
    load();
  }

  async function remove(member: StaffMember) {
    if (!confirm(`¿Quitar el acceso de ${member.email}? Se eliminará su cuenta del panel.`)) return;
    setNotice("");
    const res = await removeStaff(await getToken(), { email: member.email });
    if (!res.ok) return setError(res.error);
    setError("");
    setNotice(`Se quitó el acceso de ${member.email}.`);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">
          Usuarios <span className="text-lg text-muted">({staff.length})</span>
        </h1>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn min-h-10 bg-ink px-4 text-white">
            + Nuevo
          </button>
        )}
      </div>

      {showForm && (
        <NewStaffForm
          onCancel={() => setShowForm(false)}
          onCreated={(email, role) => {
            setShowForm(false);
            setError("");
            setNotice(`Se creó la cuenta de ${email} como ${roleLabel(role)}. Compártele su correo y contraseña.`);
            load();
          }}
        />
      )}

      {notice && <p className="border border-gold/40 bg-mist p-3 text-sm">{notice}</p>}
      {error && <p className="border border-sale/40 bg-sale/5 p-3 text-sm text-sale">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Cargando usuarios…</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {staff.map((m) => {
            const isMe = m.email === myEmail;
            return (
              <li key={m.email} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.email} {isMe && <span className="text-xs font-normal text-muted">(tú)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    Desde {new Date(m.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <select
                  value={m.role}
                  disabled={isMe}
                  onChange={(e) => changeRole(m, e.target.value as Role)}
                  aria-label={`Rol de ${m.email}`}
                  className="border border-line-strong bg-white px-2 py-2 text-sm disabled:opacity-60"
                >
                  {roles.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                {!isMe && (
                  <button onClick={() => remove(m)} className="text-xs text-sale underline underline-offset-4">
                    Quitar acceso
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="text-xs leading-relaxed text-muted">
        {roles.map((r) => (
          <p key={r.value}>
            <strong className="font-medium text-ink-soft">{r.label}:</strong> {r.description}.
          </p>
        ))}
      </div>
    </div>
  );
}

function NewStaffForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (email: string, role: Role) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>("admin");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await createStaff(await getToken(), { email, password, role });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onCreated(email.trim().toLowerCase(), role);
  }

  return (
    <form onSubmit={submit} className="space-y-4 border border-line bg-white p-4">
      <p className="eyebrow">Nuevo usuario</p>
      <label className="block">
        <span className="mb-1 block text-xs text-ink-soft">Correo</span>
        <input type="email" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
      </label>
      <label className="block">
        <span className="mb-1 flex justify-between text-xs text-ink-soft">
          Contraseña inicial
          <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-muted underline underline-offset-2">
            {showPassword ? "Ocultar" : "Mostrar"}
          </button>
        </span>
        <input
          type={showPassword ? "text" : "password"}
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field"
        />
        <span className="mt-1 block text-xs text-muted">Mínimo 8 caracteres.</span>
      </label>
      <fieldset>
        <legend className="mb-2 text-xs text-ink-soft">Rol</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {roles.map((r) => (
            <label
              key={r.value}
              className={`flex cursor-pointer gap-3 border p-3 text-sm ${role === r.value ? "border-ink bg-white" : "border-line bg-white/60"}`}
            >
              <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="mt-0.5 accent-ink" />
              <span>
                <span className="block font-medium">{r.label}</span>
                <span className="text-xs text-muted">{r.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="text-sm text-sale">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn flex-1 border border-ink">Cancelar</button>
        <button disabled={saving} className="btn flex-1 bg-ink text-white">{saving ? "Creando…" : "Crear usuario"}</button>
      </div>
    </form>
  );
}
