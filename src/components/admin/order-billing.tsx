"use client";

import { useState } from "react";
import { addPayment, deletePayment, updateOrderCharges } from "@/app/admin/customers-actions";
import { paymentMethods, paymentState, paymentStateLabel, type PaymentState } from "@/lib/customers";
import { formatCOP } from "@/lib/format";
import { orderCode, type OrderView } from "@/lib/orders";
import { getSupabase } from "@/lib/supabase";

async function token() {
  const { data } = await getSupabase()!.auth.getSession();
  return data.session?.access_token ?? "";
}

const todayCO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());

export const paymentStateStyle: Record<PaymentState, string> = {
  "sin-pago": "bg-sale/10 text-sale",
  abonado: "bg-[#fdf1dc] text-[#8a5a12]",
  pagado: "bg-[#e3efe6] text-[#2f6b3f]",
  "saldo-a-favor": "bg-[#e5ecf6] text-[#2d4f7c]",
};

export function PaymentBadge({ total, paid }: { total: number; paid: number }) {
  const s = paymentState(total, paid);
  return <span className={`eyebrow whitespace-nowrap px-2 py-1 text-[0.58rem] ${paymentStateStyle[s]}`}>{paymentStateLabel[s]}</span>;
}

const dateFmt = (d: string) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${d}T00:00:00Z`));

/** Cobro de un pedido: envío, descuento, total, pagos/abonos y saldo. */
export function OrderBilling({ order, onChanged }: { order: OrderView; onChanged: () => void }) {
  const f = order.finance!;
  const [editing, setEditing] = useState(false);
  const [shipping, setShipping] = useState(String(f.shippingCost || ""));
  const [discount, setDiscount] = useState(String(f.discount || ""));
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(todayCO);
  const [method, setMethod] = useState<string>(paymentMethods[0]);
  const [reference, setReference] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cancelled = order.status === "cancelado";
  const code = orderCode(order.number);

  async function saveCharges(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await updateOrderCharges(await token(), {
      orderId: order.id,
      shippingCost: Number(shipping || 0),
      discount: Number(discount || 0),
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setError("");
    setEditing(false);
    onChanged();
  }

  async function savePayment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await addPayment(await token(), { orderId: order.id, amount: Number(amount), paidAt, method, reference });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setError("");
    setPaying(false);
    setAmount("");
    setReference("");
    onChanged();
  }

  async function remove(id: string) {
    setBusy(true);
    const res = await deletePayment(await token(), id);
    setBusy(false);
    setConfirmDelete(null);
    if (!res.ok) return setError(res.error);
    onChanged();
  }

  return (
    <div className="space-y-3 border-t border-line bg-mist p-4 text-sm" data-testid={`cobro-${code}`}>
      <div className="flex items-center justify-between">
        <p className="eyebrow text-[0.62rem]">Cobro</p>
        <PaymentBadge total={f.total} paid={f.paid} />
      </div>

      {editing ? (
        <form onSubmit={saveCharges} className="grid grid-cols-2 gap-2">
          <label className="block text-xs text-ink-soft">
            Envío
            <input type="number" inputMode="numeric" min={0} step={1} value={shipping} onChange={(e) => setShipping(e.target.value)} className="field mt-1" aria-label={`Envío de ${code}`} />
          </label>
          <label className="block text-xs text-ink-soft">
            Descuento
            <input type="number" inputMode="numeric" min={0} step={1} value={discount} onChange={(e) => setDiscount(e.target.value)} className="field mt-1" aria-label={`Descuento de ${code}`} />
          </label>
          <div className="col-span-2 flex gap-2">
            <button type="button" onClick={() => setEditing(false)} className="btn min-h-10 flex-1 border border-line">Cancelar</button>
            <button disabled={busy} className="btn min-h-10 flex-1 bg-ink text-white">Guardar</button>
          </div>
        </form>
      ) : (
        <dl className="space-y-1">
          <Row label="Productos" value={formatCOP(order.subtotal ?? 0)} />
          <Row label="Envío" value={f.shippingCost ? formatCOP(f.shippingCost) : "—"} />
          {f.discount > 0 && <Row label="Descuento" value={`− ${formatCOP(f.discount)}`} />}
          <Row label="Total" value={formatCOP(f.total)} strong />
          <Row label="Pagado" value={formatCOP(f.paid)} />
          <Row
            label={f.balance < 0 ? "Saldo a favor" : "Saldo"}
            value={formatCOP(Math.abs(f.balance))}
            strong
            tone={f.balance > 0 && !cancelled ? "text-sale" : undefined}
          />
          {!cancelled && (
            <button type="button" onClick={() => setEditing(true)} className="pt-1 text-xs text-ink-soft underline underline-offset-4">
              Editar envío y descuento
            </button>
          )}
        </dl>
      )}

      {f.payments.length > 0 && (
        <ul className="divide-y divide-line border-y border-line">
          {f.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-xs">
              <span>
                <span className="font-medium text-ink">{formatCOP(p.amount)}</span> · {dateFmt(p.paidAt)} · {p.method}
                {p.reference && <span className="text-muted"> · Ref. {p.reference}</span>}
              </span>
              {confirmDelete === p.id ? (
                <span className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => remove(p.id)} disabled={busy} className="font-medium text-sale">Sí, borrar</button>
                  <button type="button" onClick={() => setConfirmDelete(null)}>No</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(p.id)} className="shrink-0 text-muted underline underline-offset-2">Borrar</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!cancelled &&
        (paying ? (
          <form onSubmit={savePayment} className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-ink-soft">
              Valor
              <input required type="number" inputMode="numeric" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="field mt-1" aria-label={`Valor del pago de ${code}`} />
            </label>
            <label className="block text-xs text-ink-soft">
              Fecha
              <input required type="date" value={paidAt} max={todayCO()} onChange={(e) => setPaidAt(e.target.value)} className="field mt-1" />
            </label>
            <label className="block text-xs text-ink-soft">
              Método
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="field mt-1">
                {paymentMethods.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="block text-xs text-ink-soft">
              Referencia (opcional)
              <input value={reference} onChange={(e) => setReference(e.target.value)} className="field mt-1" placeholder="N.º de comprobante" />
            </label>
            <div className="col-span-2 flex gap-2">
              <button type="button" onClick={() => setPaying(false)} className="btn min-h-10 flex-1 border border-line">Cancelar</button>
              <button disabled={busy} className="btn min-h-10 flex-1 bg-ink text-white">{busy ? "Guardando…" : "Guardar pago"}</button>
            </div>
          </form>
        ) : (
          f.balance > 0 && (
            <button
              type="button"
              onClick={() => {
                setAmount(String(f.balance));
                setPaying(true);
              }}
              className="btn min-h-10 w-full border border-ink"
            >
              Registrar pago
            </button>
          )
        ))}
      {error && <p className="text-xs text-sale">{error}</p>}
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={`flex justify-between ${strong ? "font-medium text-ink" : "text-ink-soft"} ${tone ?? ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
