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
import { fromRow, productCover, skuOf, totalStock, type Product, type ProductRow } from "@/lib/types";
import { ProductImage } from "../product-image";
import { can, type Access, type Permission } from "@/lib/roles";
import { getMyAccess } from "@/app/admin/actions";
import { RolesPanel } from "./roles-panel";
import { CustomersPanel } from "./customers-panel";
import { OrdersPanel } from "./orders-panel";
import { ReceivablesPanel } from "./receivables-panel";
import { ProductForm } from "./product-form";
import { ProductHistory } from "./product-history";
import { ReasonDialog } from "./reason-dialog";
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
      <div className="border border-gold/40 bg-mist p-5 text-sm leading-relaxed">
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
            <button disabled={loading} className="btn w-full bg-ink text-white">
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
      <button disabled={loading} className="btn w-full bg-ink text-white">
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
      <button disabled={loading} className="btn w-full bg-ink text-white">
        {loading ? "Guardando…" : "Guardar y entrar"}
      </button>
    </form>
  );
}

/* ---------------- Panel ---------------- */

function Dashboard({ email }: { email: string }) {
  const supabase = getSupabase()!;
  const myEmail = email.toLowerCase();
  // Rol y permisos de quien entra: undefined = cargando, null = sin acceso
  const [access, setAccess] = useState<Access | null | undefined>(undefined);
  const [accessError, setAccessError] = useState("");
  const [tab, setTab] = useState<Tab | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const openCustomer = (id: string) => {
    setCustomerId(id);
    setTab("clientes");
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const res = await getMyAccess(data.session?.access_token ?? "");
      if (!alive) return;
      if (res.ok) setAccess(res.data);
      else {
        setAccessError(res.error);
        setAccess(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [supabase, myEmail]);

  const header = (
    <div className="flex items-center justify-between text-xs text-muted">
      <span>
        {email}
        {access && ` · ${access.roleName}`}
      </span>
      <button onClick={() => supabase.auth.signOut()} className="underline underline-offset-4">
        Cerrar sesión
      </button>
    </div>
  );

  if (access === undefined) return <p className="py-20 text-center text-sm text-muted">Cargando…</p>;

  if (access === null) {
    return (
      <div className="space-y-5">
        {header}
        <p className="border border-sale/40 bg-sale/5 p-4 text-sm text-sale">
          {accessError || "Tu cuenta no tiene acceso al panel. Pide a un superadmin que te agregue."}
        </p>
      </div>
    );
  }

  const tabs = allTabs.filter((t) => (t.perm === "superadmin" ? access.superadmin : t.perm.some((p) => can(access, p))));
  const current = tabs.find((t) => t.id === tab) ?? tabs[0] as (typeof tabs)[number] | undefined;

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
              className={`eyebrow -mb-px shrink-0 border-b-2 px-3 py-3 text-[0.65rem] ${current?.id === t.id ? "border-ink text-ink" : "border-transparent text-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {tabs.length === 0 && <p className="py-10 text-center text-sm text-muted">Tu rol todavía no tiene permisos. Pide a un superadmin que los asigne.</p>}
      {current?.id === "productos" && <ProductsPanel access={access} />}
      {current?.id === "categorias" && <CategoriesPanel />}
      {current?.id === "pedidos" && <OrdersPanel canManage={can(access, "pedidos")} onOpenCustomer={can(access, "clientas") ? openCustomer : undefined} />}
      {current?.id === "clientes" && <CustomersPanel openId={customerId} onOpen={setCustomerId} />}
      {current?.id === "cartera" && <ReceivablesPanel onOpenCustomer={openCustomer} />}
      {current?.id === "usuarios" && <StaffPanel myEmail={myEmail} />}
      {current?.id === "roles" && <RolesPanel />}
    </div>
  );
}

type Tab = "productos" | "categorias" | "pedidos" | "clientes" | "cartera" | "usuarios" | "roles";
const allTabs: { id: Tab; label: string; perm: Permission[] | "superadmin" }[] = [
  { id: "productos", label: "Productos", perm: ["productos", "productos_publicar", "productos_eliminar"] },
  { id: "categorias", label: "Categorías", perm: ["categorias"] },
  { id: "pedidos", label: "Pedidos", perm: ["pedidos", "despachos"] },
  { id: "clientes", label: "Clientas", perm: ["clientas"] },
  { id: "cartera", label: "Cartera", perm: ["clientas"] },
  { id: "usuarios", label: "Usuarios", perm: "superadmin" },
  { id: "roles", label: "Roles", perm: "superadmin" },
];

function ProductsPanel({ access }: { access: Access }) {
  const canEdit = can(access, "productos");
  const canPublish = can(access, "productos_publicar");
  const canDelete = can(access, "productos_eliminar");
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

  // Ocultar, publicar y eliminar piden el motivo, que queda en el historial
  const [dialog, setDialog] = useState<{ kind: "toggle" | "delete"; product: Product } | null>(null);
  const [history, setHistory] = useState(false);

  async function toggleActive(p: Product, reason: string) {
    const { error } = await supabase.from("products").update({ active: !p.active, change_reason: reason }).eq("id", p.id);
    if (error) return error.message;
    setDialog(null);
    await refreshCatalog();
    load();
  }

  async function remove(p: Product, reason: string) {
    const { error } = await supabase.rpc("delete_product", { p_id: p.id, p_reason: reason });
    if (error) return error.message;
    setDialog(null);
    await refreshCatalog();
    load();
  }

  if (history) return <ProductHistory onBack={() => setHistory(false)} />;

  if (editing) {
    return (
      <ProductForm
        product={editing === "new" ? null : editing}
        canPublish={canPublish}
        showHistory={access.superadmin}
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
          onEdit={canEdit ? setEditing : undefined}
          onNew={canEdit ? () => setEditing("new") : undefined}
          onToggle={canPublish ? (product) => setDialog({ kind: "toggle", product }) : undefined}
          onDelete={canDelete ? (product) => setDialog({ kind: "delete", product }) : undefined}
          onHistory={access.superadmin ? () => setHistory(true) : undefined}
        />
      )}
      {dialog && (
        <ReasonDialog
          title={
            dialog.kind === "delete"
              ? `Eliminar "${dialog.product.name}"`
              : dialog.product.active
                ? `Ocultar "${dialog.product.name}"`
                : `Publicar "${dialog.product.name}"`
          }
          description={
            dialog.kind === "delete"
              ? "Esta acción no se puede deshacer. El producto queda guardado en el historial."
              : dialog.product.active
                ? "Dejará de verse en la tienda."
                : "Volverá a verse en la tienda."
          }
          confirmLabel={dialog.kind === "delete" ? "Eliminar" : dialog.product.active ? "Ocultar" : "Publicar"}
          danger={dialog.kind === "delete"}
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => (dialog.kind === "delete" ? remove(dialog.product, reason) : toggleActive(dialog.product, reason))}
        />
      )}
    </div>
  );
}

/* ---------------- Lista de productos ---------------- */

function ProductList({
  products,
  onEdit,
  onNew,
  onToggle,
  onDelete,
  onHistory,
}: {
  products: Product[];
  onEdit?: (p: Product) => void;
  onNew?: () => void;
  onToggle?: (p: Product) => void;
  onDelete?: (p: Product) => void;
  onHistory?: () => void;
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
        <div className="flex items-center gap-3">
          {onHistory && (
            <button onClick={onHistory} className="text-xs text-ink-soft underline underline-offset-4">Historial</button>
          )}
          {onNew && <button onClick={onNew} className="btn min-h-10 bg-ink px-4 text-white">+ Nuevo</button>}
        </div>
      </div>
      <input placeholder="Buscar por nombre o código…" value={q} onChange={(e) => setQ(e.target.value)} className="field mt-4" />
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {list.map((p) => {
          const stock = totalStock(p);
          return (
            <li key={p.id} className="flex items-center gap-3 py-3">
              <button onClick={() => onEdit?.(p)} disabled={!onEdit} className="w-14 shrink-0">
                <ProductImage src={productCover(p)} alt={p.name} sizes="56px" />
              </button>
              <button onClick={() => onEdit?.(p)} disabled={!onEdit} className="min-w-0 flex-1 text-left">
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
