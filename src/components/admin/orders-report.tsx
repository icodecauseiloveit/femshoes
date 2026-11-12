"use client";

import { useState } from "react";
import { getOrdersReport } from "@/app/admin/orders-actions";
import { formatCOP } from "@/lib/format";
import { orderStatuses, type OrderStatus } from "@/lib/orders";
import { getSupabase } from "@/lib/supabase";
import { CloseIcon } from "../icons";

// Fecha de hoy en Colombia en formato YYYY-MM-DD
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const shift = (d: string, days: number) => {
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
};
const firstOfMonth = (d: string) => `${d.slice(0, 8)}01`;
const lastOfPrevMonth = (d: string) => shift(firstOfMonth(d), -1);

const ranges = [
  { label: "Hoy", get: () => [today(), today()] },
  { label: "Últimos 7 días", get: () => [shift(today(), -6), today()] },
  { label: "Este mes", get: () => [firstOfMonth(today()), today()] },
  { label: "Mes anterior", get: () => [firstOfMonth(lastOfPrevMonth(today())), lastOfPrevMonth(today())] },
] as const;

/** Reporte de pedidos en PDF (superadmin y administrador): detalle por pedido y consolidado por modelo y color. */
export function OrdersReportButton() {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(() => firstOfMonth(today()));
  const [to, setTo] = useState(today);
  const [statuses, setStatuses] = useState<OrderStatus[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  function toggle(s: OrderStatus) {
    setStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function generate() {
    setError("");
    setResult("");
    if (statuses.length === 0) return setError("Elige al menos un estado.");
    if (!from || !to || from > to) return setError("Revisa las fechas: la inicial debe ser anterior o igual a la final.");
    setBusy(true);
    try {
      const { data } = await getSupabase()!.auth.getSession();
      const res = await getOrdersReport(data.session?.access_token ?? "", { from, to, statuses });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const { buildOrdersReportPdf } = await import("@/lib/report-pdf");
      const { doc, filename, totals } = buildOrdersReportPdf(res.data);
      doc.save(filename);
      setResult(
        `Listo: ${totals.orders} ${totals.orders === 1 ? "pedido" : "pedidos"} · ${totals.qty} ${totals.qty === 1 ? "par" : "pares"} · ${formatCOP(totals.value)}`,
      );
    } catch (e) {
      console.error(e);
      setError("No se pudo generar el reporte.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn min-h-9 border border-ink px-3 text-[0.7rem]">
        Reporte PDF
      </button>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Reporte de pedidos">
          <button aria-label="Cerrar" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="animate-fade-up absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto bg-ivory pb-[max(1rem,env(safe-area-inset-bottom))] md:inset-x-auto md:left-1/2 md:top-1/2 md:bottom-auto md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-2xl">Reporte de pedidos</h2>
              <button onClick={() => setOpen(false)} aria-label="Cerrar" className="-mr-2 p-2">
                <CloseIcon />
              </button>
            </div>
            <div className="space-y-6 px-5 py-5">
              <p className="text-xs leading-relaxed text-muted">
                PDF con el detalle de cada pedido (código, modelo, color, talla, cantidad y valor, con total por pedido y total
                general) y el consolidado por modelo y color.
              </p>

              <div>
                <p className="eyebrow mb-2">Período</p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {ranges.map((r) => {
                    const [a, b] = r.get();
                    const active = a === from && b === to;
                    return (
                      <button
                        key={r.label}
                        type="button"
                        onClick={() => {
                          setFrom(a);
                          setTo(b);
                        }}
                        className={`rounded-full border px-3 py-1 text-[0.78rem] ${active ? "border-ink bg-ink text-ivory" : "border-line bg-white text-ink-soft"}`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-ink-soft">Desde</span>
                    <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="field" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-ink-soft">Hasta</span>
                    <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="field" />
                  </label>
                </div>
              </div>

              <div>
                <p className="eyebrow mb-2">Estados a incluir</p>
                <div className="grid grid-cols-2 gap-2">
                  {orderStatuses.map((s) => (
                    <label key={s.value} className="flex items-center gap-2 border border-line bg-white px-3 py-2.5 text-sm">
                      <input type="checkbox" checked={statuses.includes(s.value)} onChange={() => toggle(s.value)} className="size-4 accent-ink" />
                      {s.label}
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted">Para ventas reales usa Confirmado y Despachado.</p>
              </div>

              {error && <p className="text-sm text-sale">{error}</p>}
              {result && <p className="border border-gold/40 bg-sand p-3 text-sm">{result}</p>}

              <button onClick={generate} disabled={busy} className="btn w-full bg-ink text-ivory">
                {busy ? "Generando…" : "Generar PDF"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
