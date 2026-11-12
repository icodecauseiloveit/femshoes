"use client";

import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { refreshCatalog } from "@/app/actions";
import { categoryLabel } from "@/lib/config";
import { useAdminCategories } from "./use-categories";
import { CategoriesPanel } from "./categories-panel";
import { formatCOP } from "@/lib/format";
import { sampleProducts } from "@/lib/sample-products";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { fromRow, skuOf, totalStock, type Product, type ProductRow } from "@/lib/types";
import { ProductImage } from "../product-image";
import { isRole, permissions, roleLabel, type Role } from "@/lib/roles";
import { CustomersPanel } from "./customers-panel";
import { OrdersPanel } from "./orders-panel";
import { ReceivablesPanel } from "./receivables-panel";
import { ProductForm } from "./product-form";
import { StaffPanel } from "./staff-panel";

/** Lee el enlace de recuperación (/admin?reset=1#...) antes de que Supabase limpie la URL. */
function readRecoveryLink() {
  if (typeof window === "undefined") return { recovering: false, linkError: false };
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  return {
    recovering: query.get("reset") === "1" || hash.get("type") === "recovery",
    linkError: Boolean(hash.get("error_code") || query.get("error_code")),
  };
}

function clearRecoveryLink() {
  window.history.replaceState(null, "", "/admin");
}

export function AdminApp() {
  const [link] = useState(readRecoveryLink);
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(isSupabaseConfigured);
  const [recovering, setRecovering] = useState(link.recovering);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  if (!supabase) return <DemoMode />;
  if (checking) return <p className="py-20 text-center text-sm text-muted">Cargando…</p>;
  if (recovering && session) {
    return (
      <ResetPassword
        onDone={() => {
          clearRecoveryLink();
          setRecovering(false);
        }}
      />
    );
  }
  if (!session) {
    const expired = recovering || link.linkError;
    return <Login notice={expired ? "El enlace no es válido o ya expiró. Solicita uno nuevo." : ""} />;
  }
  return <Dashboard email={session.user.email ?? ""} />;
}

/* ---------------- Modo de ejemplo (sin Supabase) ---------------- */

function DemoMode() {
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  if (editing) {
    return (
      <ProductForm
        product={editing === "new" ? null : editing}
        demo
        onClose={() => setEditing(null)}
        onSaved={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="border border-gold/40 bg-sand p-5 text-sm leading-relaxed">
        <p className="eyebrow text-gold">Modo de ejemplo</p>
        <p className="mt-2">
          La tienda está mostrando productos de ejemplo. Para administrar tus productos reales conecta Supabase:
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-ink-soft">
          <li>Crea un proyecto gratis en supabase.com.</li>
          <li>En SQL Editor ejecuta el archivo <code>supabase/schema.sql</code> (cambia el correo de administradora).</li>
          <li>En Authentication &gt; Users crea tu usuario con ese correo y una contraseña.</li>
          <li>
            Agrega las variables <code>NEXT_PUBLIC_SUPABASE_URL</code> y <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en
            Vercel (o en <code>.env.local</code>).
          </li>
        </ol>
        <p className="mt-3 text-ink-soft">Mientras tanto puedes explorar el editor; los cambios no se guardan.</p>
      </div>
      <ProductList products={sampleProducts} onEdit={setEditing} onNew={() => setEditing("new")} />
    </div>
  );
}

/* ---------------- Inicio de sesión ---------------- */

function Login({ notice = "" }: { notice?: string }) {
  const supabase = getSupabase()!;
  const [mode, setMode] = useState<"login" | "forgot">(notice ? "forgot" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(notice);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  function switchMode(next: "login" | "forgot") {
    setMode(next);
    setError("");
    setSent(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("Correo o contraseña incorrectos.");
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/admin?reset=1`,
      });
      // Por seguridad no revelamos si el correo existe: solo avisamos si falló el envío.
      if (error && error.status === 429) setError("Ya pediste un enlace hace poco. Espera un minuto e inténtalo de nuevo.");
      else if (error && (error.status ?? 500) >= 500) setError("No pudimos enviar el correo. Inténtalo más tarde.");
      else setSent(true);
    }
    setLoading(false);
  }

  if (mode === "forgot") {
    return (
      <form onSubmit={submit} className="mx-auto mt-10 max-w-sm space-y-4">
        <h1 className="text-3xl">Recuperar contraseña</h1>
        {sent ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            Si <strong>{email.trim()}</strong> pertenece a una cuenta del equipo, te enviamos un enlace para crear una
            contraseña nueva. Revisa tu bandeja de entrada (y la carpeta de spam).
          </p>
        ) : (
          <>
            <p className="text-sm text-ink-soft">Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.</p>
            <input type="email" required autoComplete="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
            {error && <p className="text-sm text-sale">{error}</p>}
            <button disabled={loading} className="btn w-full bg-ink text-ivory">
              {loading ? "Enviando…" : "Enviar enlace"}
            </button>
          </>
        )}
        <button type="button" onClick={() => switchMode("login")} className="block w-full text-center text-sm underline underline-offset-4">
          Volver a iniciar sesión
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-sm space-y-4">
      <h1 className="text-3xl">Iniciar sesión</h1>
      <input type="email" required autoComplete="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
      <input type="password" required autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className="field" />
      {error && <p className="text-sm text-sale">{error}</p>}
      <button disabled={loading} className="btn w-full bg-ink text-ivory">
        {loading ? "Entrando…" : "Entrar"}
      </button>
      <button type="button" onClick={() => switchMode("forgot")} className="block w-full text-center text-sm underline underline-offset-4">
        ¿Olvidaste tu contraseña?
      </button>
    </form>
  );
}

/* ---------------- Nueva contraseña (desde el enlace del correo) ---------------- */

function ResetPassword({ onDone }: { onDone: () => void }) {
  const supabase = getSupabase()!;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(
        error.code === "same_password" || /different from the old/i.test(error.message)
          ? "La contraseña nueva debe ser distinta a la anterior."
          : "No pudimos guardar la contraseña. Solicita un enlace nuevo e inténtalo otra vez.",
      );
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-10 max-w-sm space-y-4">
      <h1 className="text-3xl">Nueva contraseña</h1>
      <p className="text-sm text-ink-soft">Elige una contraseña de al menos 8 caracteres.</p>
      <input type="password" required minLength={8} autoComplete="new-password" placeholder="Contraseña nueva" value={password} onChange={(e) => setPassword(e.target.value)} className="field" />
      <input type="password" required minLength={8} autoComplete="new-password" placeholder="Repite la contraseña" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="field" />
      {error && <p className="text-sm text-sale">{error}</p>}
      <button disabled={loading} className="btn w-full bg-ink text-ivory">
        {loading ? "Guardando…" : "Guardar y entrar"}
      </button>
    </form>
  );
}

/* ---------------- Panel ---------------- */

function Dashboard({ email }: { email: string }) {
  const supabase = getSupabase()!;
  const myEmail = email.toLowerCase();
  const [role, setRole] = useState<Role | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const openCustomer = (id: string) => {
    setCustomerId(id);
    setTab("clientes");
  };

  useEffect(() => {
    supabase
      .from("admins")
      .select("role")
      .eq("email", myEmail)
      .maybeSingle()
      .then(({ data }) => setRole(data && isRole(data.role) ? data.role : null));
  }, [supabase, myEmail]);

  const header = (
    <div className="flex items-center justify-between text-xs text-muted">
      <span>
        {email}
        {role && ` · ${roleLabel(role)}`}
      </span>
      <button onClick={() => supabase.auth.signOut()} className="underline underline-offset-4">
        Cerrar sesión
      </button>
    </div>
  );

  if (role === undefined) return <p className="py-20 text-center text-sm text-muted">Cargando…</p>;

  if (role === null) {
    return (
      <div className="space-y-5">
        {header}
        <p className="border border-sale/40 bg-sale/5 p-4 text-sm text-sale">
          Tu cuenta no tiene acceso al panel. Pide a un superadmin que te agregue.
        </p>
      </div>
    );
  }

  const tabs = allTabs.filter((t) => permissions[t.perm](role));
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    <div className="space-y-5">
      {header}
      {tabs.length > 1 && (
        <div className="no-scrollbar -mx-4 flex overflow-x-auto border-b border-line px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                if (t.id === "clientes") setCustomerId(null);
              }}
              className={`eyebrow -mb-px shrink-0 border-b-2 px-3 py-3 text-[0.65rem] ${current.id === t.id ? "border-ink text-ink" : "border-transparent text-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {current.id === "productos" && <ProductsPanel />}
      {current.id === "categorias" && <CategoriesPanel />}
      {current.id === "pedidos" && <OrdersPanel role={role} onOpenCustomer={permissions.customers(role) ? openCustomer : undefined} />}
      {current.id === "clientes" && <CustomersPanel openId={customerId} onOpen={setCustomerId} />}
      {current.id === "cartera" && <ReceivablesPanel onOpenCustomer={openCustomer} />}
      {current.id === "usuarios" && <StaffPanel myEmail={myEmail} />}
    </div>
  );
}

type Tab = "productos" | "categorias" | "pedidos" | "clientes" | "cartera" | "usuarios";
const allTabs: { id: Tab; label: string; perm: keyof typeof permissions }[] = [
  { id: "productos", label: "Productos", perm: "products" },
  { id: "categorias", label: "Categorías", perm: "products" },
  { id: "pedidos", label: "Pedidos", perm: "orders" },
  { id: "clientes", label: "Clientas", perm: "customers" },
  { id: "cartera", label: "Cartera", perm: "customers" },
  { id: "usuarios", label: "Usuarios", perm: "users" },
];

function ProductsPanel() {
  const supabase = getSupabase()!;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setProducts((data as ProductRow[]).map(fromRow));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function toggleActive(p: Product) {
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) return alertError(error.message);
    await refreshCatalog();
    load();
  }

  async function remove(p: Product) {
    if (!confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return alertError(error.message);
    await refreshCatalog();
    load();
  }

  if (editing) {
    return (
      <ProductForm
        product={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="border border-sale/40 bg-sale/5 p-3 text-sm text-sale">
          {error}. Verifica que ejecutaste <code>supabase/schema.sql</code> y que tu correo está en la tabla admins.
        </p>
      )}
      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Cargando productos…</p>
      ) : (
        <ProductList
          products={products}
          onEdit={setEditing}
          onNew={() => setEditing("new")}
          onToggle={toggleActive}
          onDelete={remove}
        />
      )}
    </div>
  );
}

function alertError(message: string) {
  alert(`No se pudo completar la acción: ${message}`);
}

/* ---------------- Lista de productos ---------------- */

function ProductList({
  products,
  onEdit,
  onNew,
  onToggle,
  onDelete,
}: {
  products: Product[];
  onEdit: (p: Product) => void;
  onNew: () => void;
  onToggle?: (p: Product) => void;
  onDelete?: (p: Product) => void;
}) {
  const { categories } = useAdminCategories();
  const [q, setQ] = useState("");
  // Busca por nombre o por código (TAC-0012, NEG…)
  const term = q.trim().toLowerCase();
  const list = products.filter(
    (p) =>
      p.name.toLowerCase().includes(term) ||
      (p.code ?? "").toLowerCase().includes(term) ||
      p.variants.some((v) => skuOf(p.code, v.code, "").toLowerCase().includes(term)),
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">Productos <span className="text-lg text-muted">({products.length})</span></h1>
        <button onClick={onNew} className="btn min-h-10 bg-ink px-4 text-ivory">+ Nuevo</button>
      </div>
      <input placeholder="Buscar por nombre o código…" value={q} onChange={(e) => setQ(e.target.value)} className="field mt-4" />
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {list.map((p) => {
          const stock = totalStock(p);
          return (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <button onClick={() => onEdit(p)} className="w-14 shrink-0">
                <ProductImage src={p.images[0]} alt={p.name} sizes="56px" />
              </button>
              <button onClick={() => onEdit(p)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium">{p.name}</p>
                {p.code && <p className="font-mono text-[0.7rem] tracking-wider text-ink-soft">{p.code}</p>}
                <p className="text-xs text-muted">
                  {categoryLabel(p.category, categories)} · {formatCOP(p.price)}
                </p>
                <p className={`text-xs ${stock === 0 ? "text-sale" : "text-muted"}`}>
                  {stock === 0 ? "Sin stock" : `${stock} pares`}
                  {!p.active && " · Oculto"}
                </p>
              </button>
              {onToggle && (
                <button onClick={() => onToggle(p)} className="text-xs text-ink-soft underline underline-offset-4">
                  {p.active ? "Ocultar" : "Mostrar"}
                </button>
              )}
              {onDelete && (
                <button onClick={() => onDelete(p)} className="text-xs text-sale underline underline-offset-4">
                  Eliminar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
