"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCOP } from "@/lib/format";
import { getSupabase } from "@/lib/supabase";

export type ProductLog = {
  id: number;
  product_id: string | null;
  product_code: string | null;
  product_name: string;
  action: "creado" | "editado" | "ocultado" | "publicado" | "inventario" | "eliminado";
  changes: { label: string; from?: unknown; to?: unknown; kind?: string }[];
  reason: string | null;
  actor: string;
  actor_role: string | null;
  created_at: string;
};

const actionLabel: Record<ProductLog["action"], string> = {
  creado: "Creado",
  editado: "Editado",
  ocultado: "Ocultado",
  publicado: "Publicado",
  inventario: "Inventario",
  eliminado: "Eliminado",
};
const actionStyle: Record<ProductLog["action"], string> = {
  creado: "bg-[#e3efe6] text-[#2f6b3f]",
  editado: "bg-mist text-ink",
  ocultado: "bg-[#fdf1dc] text-[#8a5a12]",
  publicado: "bg-[#e3efe6] text-[#2f6b3f]",
  inventario: "bg-[#e5ecf6] text-[#2d4f7c]",
  eliminado: "bg-sale/10 text-sale",
};

const when = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

function show(v: unknown, kind?: string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (kind === "money") return formatCOP(Number(v));
  if (kind === "bool") return v ? "Sí" : "No";
  if (kind === "count") return `${v} ${Number(v) === 1 ? "foto" : "fotos"}`;
  if (kind === "long") return String(v).length > 80 ? `${String(v).slice(0, 80)}…` : String(v);
  return String(v);
}

/** Historial de cambios de productos: quién, cuándo, qué cambió y por qué. */
export function ProductHistory({ productId, title = "Historial de productos", onBack }: { productId?: string; title?: string; onBack?: () => void }) {
  const [logs, setLogs] = useState<ProductLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return setLoading(false);
    setLoading(true);
    let query = supabase.from("product_logs").select("*").order("created_at", { ascending: false }).limit(300);
    if (productId) query = query.eq("product_id", productId);
    const { data, error } = await query;
    if (error) setError(error.message);
    else setLogs(data as ProductLog[]);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return logs.filter(
      (l) =>
        (!action || l.action === action) &&
        (!t || l.product_name.toLowerCase().includes(t) || (l.product_code ?? "").toLowerCase().includes(t) || l.actor.toLowerCase().includes(t) || (l.reason ?? "").toLowerCase().includes(t)),
    );
  }, [logs, q, action]);

  return (
    <div className="space-y-4">
      {onBack && <button onClick={onBack} className="text-sm text-ink-soft">← Volver</button>}
      {title && <h1 className="text-3xl">{title}</h1>}
      {!productId && (
        <div className="space-y-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por producto, código, usuario o motivo…" className="field" />
          <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="Filtrar por acción" className="border border-line-strong bg-white px-2 py-1.5 text-xs">
            <option value="">Todas las acciones</option>
            {Object.entries(actionLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      )}
      {error && <p className="border border-sale/40 bg-sale/5 p-3 text-sm text-sale">{error}</p>}
      {loading ? (
        <p className="py-8 text-center text-sm text-muted">Cargando historial…</p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Sin movimientos registrados.</p>
      ) : (
        <ol className="space-y-3" data-testid="historial">
          {shown.map((l) => (
            <li key={l.id} className="border border-line bg-white p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {!productId && (
                    <p className="truncate font-medium">
                      {l.product_name}
                      {l.product_code && <span className="ml-2 font-mono text-[0.7rem] text-ink-soft">{l.product_code}</span>}
                    </p>
                  )}
                  <p className="text-xs text-muted">
                    {when(l.created_at)} · {l.actor}
                    {l.actor_role && ` (${l.actor_role})`}
                  </p>
                </div>
                <span className={`eyebrow shrink-0 px-2 py-1 text-[0.58rem] ${actionStyle[l.action]}`}>{actionLabel[l.action]}</span>
              </div>
              <p className="mt-2 text-xs">
                <span className="text-muted">Motivo: </span>
                <span className={l.reason ? "text-ink" : "italic text-muted"}>{l.reason ?? "sin motivo registrado"}</span>
              </p>
              {l.changes.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs">
                  {l.changes.map((c, i) => (
                    <li key={i} className="flex flex-wrap gap-x-1.5">
                      <span className="text-ink-soft">{c.label}:</span>
                      {"from" in c && <span className="text-muted line-through decoration-muted/50">{show(c.from, c.kind)}</span>}
                      {"from" in c && "to" in c && <span className="text-muted">→</span>}
                      {"to" in c && <span className="font-medium">{show(c.to, c.kind)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
