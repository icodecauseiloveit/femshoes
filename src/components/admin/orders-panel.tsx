"use client";

import { useCallback, useEffect, useState } from "react";
import { listOrders, updateOrderStatus } from "@/app/admin/orders-actions";
import { formatCOP } from "@/lib/format";
import { orderCode, orderStatuses, statusLabel, type OrderStatus, type OrderView } from "@/lib/orders";
import { permissions, type Role } from "@/lib/roles";
import { getSupabase } from "@/lib/supabase";
import { ProductImage } from "../product-image";
import { OrderBilling, PaymentBadge } from "./order-billing";
import { OrdersReportButton } from "./orders-report";

async function getToken() {
  const { data } = await getSupabase()!.auth.getSession();
  return data.session?.access_token ?? "";
}

const statusStyle: Record<OrderStatus, string> = {
  pendiente: "bg-sand text-ink-soft",
  confirmado: "bg-ink text-ivory",
  despachado: "bg-[#e3efe6] text-[#2f6b3f]",
  cancelado: "bg-sale/10 text-sale",
};

export function OrdersPanel({ role, onOpenCustomer }: { role: Role; onOpenCustomer?: (id: string) => void }) {
  const canManage = permissions.manageOrders(role);
  const [filter, setFilter] = useState<OrderStatus>(canManage ? "pendiente" : "confirmado");
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfFor, setPdfFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listOrders(await getToken(), filter);
    if (res.ok) {
      setOrders(res.data);
      setError("");
    } else setError(res.error);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function changeStatus(order: OrderView, status: OrderStatus) {
    setError("");
    const res = await updateOrderStatus(await getToken(), { id: order.id, status });
    if (!res.ok) {
      setError(res.error);
      return load();
    }
    load();
  }

  async function pdf(order: OrderView) {
    setPdfFor(order.id);
    try {
      const { downloadOrderPdf } = await import("@/lib/order-pdf");
      await downloadOrderPdf(order);
    } catch (e) {
      console.error(e);
      setError("No se pudo generar el PDF.");
    }
    setPdfFor(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">
          Pedidos <span className="text-lg text-muted">({orders.length})</span>
        </h1>
        <div className="flex items-center gap-3">
          <button onClick={load} className="text-xs text-ink-soft underline underline-offset-4">Actualizar</button>
          {canManage && <OrdersReportButton />}
        </div>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {(canManage
          ? orderStatuses.map((s) => ({ value: s.value as OrderStatus, label: s.label }))
          : [
              { value: "confirmado" as OrderStatus, label: "Por despachar" },
              { value: "despachado" as OrderStatus, label: "Despachados" },
            ]
        ).map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-[0.8rem] ${filter === s.value ? "border-ink bg-ink text-ivory" : "border-line bg-white text-ink-soft"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {canManage && (
        <p className="text-xs text-muted">Al confirmar un pedido se descuentan los pares del inventario; al cancelarlo se devuelven.</p>
      )}

      {error && <p className="border border-sale/40 bg-sale/5 p-3 text-sm text-sale">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Cargando pedidos…</p>
      ) : orders.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">
          {!canManage && filter === "confirmado"
            ? "No hay pedidos por despachar."
            : `No hay pedidos ${statusLabel(filter).toLowerCase()}s.`}
        </p>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => (
            <li key={o.id} className="border border-line bg-white">
              <div className="flex items-start justify-between gap-3 border-b border-line p-4">
                <div>
                  <p className="font-medium">{orderCode(o.number)}</p>
                  <p className="text-xs text-muted">
                    {new Date(o.createdAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`eyebrow px-2 py-1 text-[0.6rem] ${statusStyle[o.status]}`}>{statusLabel(o.status)}</span>
                  {o.finance && o.status !== "cancelado" && <PaymentBadge total={o.finance.total} paid={o.finance.paid} />}
                </div>
              </div>

              {o.customer && (
                <div className="border-b border-line p-4 text-sm leading-relaxed text-ink-soft">
                  <p className="text-ink">{o.customer.name} · <a href={`tel:${o.customer.phone}`} className="underline underline-offset-2">{o.customer.phone}</a></p>
                  <p>{o.customer.address}{o.customer.neighborhood && `, barrio ${o.customer.neighborhood}`} · {o.customer.city}</p>
                  <p>Pago: {o.customer.payment}</p>
                  {o.customer.notes && <p>Notas: {o.customer.notes}</p>}
                  {o.finance?.customerId && onOpenCustomer && (
                    <button onClick={() => onOpenCustomer(o.finance!.customerId!)} className="mt-1 text-xs text-ink underline underline-offset-4">
                      Ver ficha de la clienta
                    </button>
                  )}
                </div>
              )}

              <ul className="divide-y divide-line px-4">
                {o.items.map((i, idx) => (
                  <li key={idx} className="flex items-center gap-3 py-3">
                    <div className="w-14 shrink-0">
                      <ProductImage src={i.image} alt={i.name} sizes="56px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.name}</p>
                      {i.sku && <p className="font-mono text-[0.7rem] tracking-wider text-ink-soft">{i.sku}</p>}
                      <p className="text-xs text-ink-soft">{i.color && <span className="font-medium">{i.color} · </span>}Talla {i.size}</p>
                      {i.price !== undefined && <p className="text-xs text-muted">{formatCOP(i.price)} c/u</p>}
                    </div>
                    <p className="text-sm">
                      <span className="text-xs text-muted">Cant. </span>
                      <span className="font-medium">{i.qty}</span>
                    </p>
                  </li>
                ))}
              </ul>

              {o.finance && <OrderBilling order={o} onChanged={load} />}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
                <p className="text-sm">
                  {o.totalPairs} {o.totalPairs === 1 ? "par" : "pares"}
                  {o.subtotal !== undefined && <span className="text-muted"> · {formatCOP(o.subtotal)}</span>}
                </p>
                <div className="flex items-center gap-2">
                  {!canManage && o.status === "confirmado" && (
                    <button
                      onClick={() => {
                        if (confirm(`¿Marcar ${orderCode(o.number)} como despachado?`)) changeStatus(o, "despachado");
                      }}
                      className="btn min-h-10 border border-ink px-3"
                    >
                      Marcar despachado
                    </button>
                  )}
                  {canManage && (
                    <select
                      value={o.status}
                      onChange={(e) => changeStatus(o, e.target.value as OrderStatus)}
                      aria-label={`Estado de ${orderCode(o.number)}`}
                      className="border border-line bg-white px-2 py-2 text-sm"
                    >
                      {orderStatuses.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  )}
                  <button onClick={() => pdf(o)} disabled={pdfFor === o.id} className="btn min-h-10 bg-ink px-4 text-ivory">
                    {pdfFor === o.id ? "Generando…" : "PDF"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
