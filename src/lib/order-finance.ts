import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OrderRow } from "@/app/admin/orders-actions";
import type { Payment } from "./customers";
import type { OrderFinance } from "./orders";

type PaymentRow = {
  id: string;
  order_id: string;
  amount: number;
  paid_at: string;
  method: string;
  reference: string;
  notes: string;
  created_by: string;
};

export const toPayment = (p: PaymentRow): Payment => ({
  id: p.id,
  orderId: p.order_id,
  amount: p.amount,
  paidAt: p.paid_at,
  method: p.method,
  reference: p.reference,
  notes: p.notes,
  createdBy: p.created_by,
});

/** Envío, descuento, total, pagos y saldo de cada pedido. */
export function financeOf(r: OrderRow, payments: Payment[]): OrderFinance {
  const total = r.total ?? Math.max(0, r.subtotal + (r.shipping_cost ?? 0) - (r.discount ?? 0));
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return {
    customerId: r.customer_id ?? null,
    shippingCost: r.shipping_cost ?? 0,
    discount: r.discount ?? 0,
    total,
    paid,
    balance: total - paid,
    dispatchedAt: r.dispatched_at ?? null,
    payments: payments.sort((a, b) => a.paidAt.localeCompare(b.paidAt)),
  };
}

/** Pagos de varios pedidos, agrupados por pedido. */
export async function paymentsByOrder(admin: SupabaseClient, orderIds: string[]) {
  const map = new Map<string, Payment[]>();
  if (orderIds.length === 0) return map;
  for (let i = 0; i < orderIds.length; i += 200) {
    const { data, error } = await admin.from("order_payments").select("*").in("order_id", orderIds.slice(i, i + 200));
    if (error) throw error;
    for (const p of (data ?? []) as PaymentRow[]) {
      const list = map.get(p.order_id) ?? [];
      list.push(toPayment(p));
      map.set(p.order_id, list);
    }
  }
  return map;
}
