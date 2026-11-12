"use client";

import { useCallback, useEffect, useState } from "react";
import { getReceivables, type Receivables } from "@/app/admin/customers-actions";
import { agingLabels, formatPhone, whatsappLink, type AgingBucket } from "@/lib/customers";
import { store } from "@/lib/config";
import { formatCOP } from "@/lib/format";
import { orderCode } from "@/lib/orders";
import { getSupabase } from "@/lib/supabase";
import { WhatsAppIcon } from "../icons";

const order: AgingBucket[] = ["0-30", "31-60", "61-90", "90+", "por-entregar"];
const bucketTone: Record<AgingBucket, string> = {
  "por-entregar": "text-ink-soft",
  "0-30": "text-ink",
  "31-60": "text-[#8a5a12]",
  "61-90": "text-sale",
  "90+": "text-sale font-semibold",
};

/** Cartera: saldos por cobrar de pedidos confirmados y despachados, por antigüedad desde el despacho. */
export function ReceivablesPanel({ onOpenCustomer }: { onOpenCustomer: (id: string) => void }) {
  const [data, setData] = useState<Receivables | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<AgingBucket | "">("");

  const load = useCallback(async () => {
    const { data: s } = await getSupabase()!.auth.getSession();
    const res = await getReceivables(s.session?.access_token ?? "");
    if (res.ok) {
      setData(res.data);
      setError("");
    } else setError(res.error);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const rows = data?.rows.filter((r) => !filter || r.bucket === filter) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl">Cartera</h1>
        <button onClick={load} className="text-xs text-ink-soft underline underline-offset-4">Actualizar</button>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        Saldos de pedidos confirmados y despachados. La antigüedad se cuenta desde el despacho, porque la clienta paga al
        recibir el producto a conformidad.
      </p>
      {error && <p className="border border-sale/40 bg-sale/5 p-3 text-sm text-sale">{error}</p>}
      {!data ? (
        !error && <p className="py-10 text-center text-sm text-muted">Cargando cartera…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 border border-ink bg-ink p-3 text-ivory">
              <p className="text-[0.68rem] uppercase tracking-wider opacity-70">Total por cobrar</p>
              <p className="mt-1 text-2xl">{formatCOP(data.total)}</p>
              <p className="text-xs opacity-70">
                Exigible (ya entregado): {formatCOP(data.overdue)} · Por entregar: {formatCOP(data.buckets["por-entregar"].balance)}
              </p>
            </div>
            {order.map((b) => (
              <button
                key={b}
                onClick={() => setFilter(filter === b ? "" : b)}
                aria-pressed={filter === b}
                className={`border p-3 text-left ${filter === b ? "border-ink bg-sand" : "border-line bg-white"}`}
              >
                <p className="text-[0.68rem] uppercase tracking-wider text-muted">{agingLabels[b]}</p>
                <p className={`mt-1 text-base ${bucketTone[b]}`}>{formatCOP(data.buckets[b].balance)}</p>
                <p className="text-xs text-muted">{data.buckets[b].count} {data.buckets[b].count === 1 ? "pedido" : "pedidos"}</p>
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">{filter ? "No hay saldos en este rango." : "¡No hay saldos pendientes!"}</p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {rows.map((r) => {
                const msg = `Hola ${r.customerName.split(" ")[0]}, te escribimos de ${store.name} por el pedido ${orderCode(r.number)}. ` +
                  `Queda un saldo de ${formatCOP(r.balance)}. ¿Nos confirmas cuándo podrías realizar el pago? ¡Gracias!`;
                return (
                  <li key={r.orderId} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">
                        {orderCode(r.number)} · {r.customerName}
                      </p>
                      <p className="text-xs text-muted">{formatPhone(r.phone)}</p>
                      <p className={`text-xs ${bucketTone[r.bucket]}`}>
                        {r.bucket === "por-entregar" ? "Confirmado, por entregar" : `Despachado hace ${r.days} ${r.days === 1 ? "día" : "días"}`}
                      </p>
                      {r.customerId && (
                        <button onClick={() => onOpenCustomer(r.customerId!)} className="mt-1 text-xs underline underline-offset-4">
                          Ver ficha y registrar pago
                        </button>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-right text-xs">
                      <span className="text-sm font-medium text-sale">{formatCOP(r.balance)}</span>
                      <span className="text-muted">de {formatCOP(r.total)}</span>
                      {r.bucket !== "por-entregar" && (
                        <a href={whatsappLink(r.phone, msg)} target="_blank" rel="noopener" className="mt-1 flex items-center gap-1 text-[#1a8f4a] underline underline-offset-2">
                          <WhatsAppIcon width={14} height={14} /> Cobrar
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
