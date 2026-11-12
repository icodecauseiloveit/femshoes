"use server";

import {
  agingBucket,
  daysSince,
  documentTypes,
  receivableStatuses,
  type AgingBucket,
  type Customer,
  type CustomerStats,
  type CustomerSummary,
  type Payment,
} from "@/lib/customers";
import { financeOf, paymentsByOrder, toPayment } from "@/lib/order-finance";
import type { OrderItem, OrderStatus, OrderView } from "@/lib/orders";
import { ActionError, requireRole, run, type Result } from "@/lib/staff-auth";
import type { OrderRow } from "./orders-actions";

type CustomerRow = {
  id: string;
  phone: string;
  name: string;
  document_type: string;
  document_number: string;
  email: string;
  city: string;
  address: string;
  neighborhood: string;
  birthday: string | null;
  tags: string[] | null;
  notes: string;
  marketing_consent_at: string | null;
  created_at: string;
};

const toCustomer = (r: CustomerRow): Customer => ({
  id: r.id,
  phone: r.phone,
  name: r.name,
  documentType: r.document_type,
  documentNumber: r.document_number,
  email: r.email,
  city: r.city,
  address: r.address,
  neighborhood: r.neighborhood,
  birthday: r.birthday,
  tags: r.tags ?? [],
  notes: r.notes,
  marketingConsentAt: r.marketing_consent_at,
  createdAt: r.created_at,
});

type StatOrder = { status: OrderStatus; created_at: string; total: number; balance: number };

function statsOf(orders: StatOrder[]): CustomerStats {
  const active = orders.filter((o) => o.status !== "cancelado");
  const purchases = orders.filter((o) => receivableStatuses.includes(o.status));
  const purchased = purchases.reduce((s, o) => s + o.total, 0);
  const dates = active.map((o) => o.created_at).sort();
  const last = dates.at(-1) ?? null;
  return {
    orders: active.length,
    purchases: purchases.length,
    purchased,
    avgTicket: purchases.length ? Math.round(purchased / purchases.length) : 0,
    firstOrderAt: dates[0] ?? null,
    lastOrderAt: last,
    daysSinceLast: daysSince(last),
    balance: purchases.reduce((s, o) => s + Math.max(0, o.balance), 0),
    overdue: purchases.filter((o) => o.status === "despachado").reduce((s, o) => s + Math.max(0, o.balance), 0),
  };
}

const STAFF = ["superadmin", "admin"] as const;

/** Todas las clientas con sus indicadores (compras, ticket, última compra, saldo). */
export async function listCustomers(accessToken: string): Promise<Result<CustomerSummary[]>> {
  return run(async () => {
    const { admin } = await requireRole(accessToken, [...STAFF]);
    const [{ data: customers, error }, { data: orders, error: oErr }, { data: balances, error: bErr }] = await Promise.all([
      admin.from("customers").select("*").order("created_at", { ascending: false }).limit(5000),
      admin.from("orders").select("id, customer_id, status, created_at, total").not("customer_id", "is", null).limit(20000),
      admin.from("order_balances").select("order_id, balance").limit(20000),
    ]);
    if (error || oErr || bErr) throw error ?? oErr ?? bErr;

    const balanceOf = new Map((balances ?? []).map((b) => [b.order_id as string, b.balance as number]));
    const byCustomer = new Map<string, StatOrder[]>();
    for (const o of orders ?? []) {
      const list = byCustomer.get(o.customer_id) ?? [];
      list.push({ status: o.status, created_at: o.created_at, total: o.total, balance: balanceOf.get(o.id) ?? o.total });
      byCustomer.set(o.customer_id, list);
    }
    return (customers as CustomerRow[]).map((r) => ({ ...toCustomer(r), stats: statsOf(byCustomer.get(r.id) ?? []) }));
  });
}

export type CustomerDetail = CustomerSummary & {
  orders: OrderView[];
  topSizes: { label: string; qty: number }[];
  topColors: { label: string; qty: number }[];
  topModels: { label: string; qty: number }[];
};

function top(items: OrderItem[], key: (i: OrderItem) => string, n = 4) {
  const map = new Map<string, number>();
  for (const i of items) map.set(key(i), (map.get(key(i)) ?? 0) + i.qty);
  return [...map].map(([label, qty]) => ({ label, qty })).sort((a, b) => b.qty - a.qty).slice(0, n);
}

/** Ficha de una clienta: datos, indicadores, preferencias e historial de pedidos con pagos. */
export async function getCustomer(accessToken: string, id: string): Promise<Result<CustomerDetail>> {
  return run(async () => {
    const { admin } = await requireRole(accessToken, [...STAFF]);
    const { data: c, error } = await admin.from("customers").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!c) throw new ActionError("La clienta no existe.");
    const { data: rows, error: oErr } = await admin
      .from("orders")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false });
    if (oErr) throw oErr;
    const orders = rows as OrderRow[];
    const payments = await paymentsByOrder(admin, orders.map((o) => o.id));

    const views: OrderView[] = orders.map((r) => ({
      id: r.id,
      number: r.number,
      status: r.status,
      createdAt: r.created_at,
      totalPairs: r.total_pairs,
      items: r.items,
      subtotal: r.subtotal,
      customer: {
        name: r.customer_name,
        phone: r.customer_phone,
        city: r.city,
        address: r.address,
        neighborhood: r.neighborhood,
        payment: r.payment_method,
        notes: r.notes,
      },
      finance: financeOf(r, payments.get(r.id) ?? []),
    }));

    const bought = views.filter((o) => receivableStatuses.includes(o.status)).flatMap((o) => o.items);
    return {
      ...toCustomer(c as CustomerRow),
      stats: statsOf(
        views.map((o) => ({ status: o.status, created_at: o.createdAt, total: o.finance!.total, balance: o.finance!.balance })),
      ),
      orders: views,
      topSizes: top(bought, (i) => `Talla ${i.size}`),
      topColors: top(bought, (i) => i.color || "—"),
      topModels: top(bought, (i) => i.name),
    };
  });
}

export type CustomerPatch = Partial<
  Pick<Customer, "name" | "documentType" | "documentNumber" | "email" | "city" | "address" | "neighborhood" | "birthday" | "tags" | "notes">
>;

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export async function updateCustomer(accessToken: string, id: string, patch: CustomerPatch): Promise<Result<null>> {
  return run(async () => {
    const { admin } = await requireRole(accessToken, [...STAFF]);
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      if (!clip(patch.name, 120)) throw new ActionError("Escribe el nombre de la clienta.");
      row.name = clip(patch.name, 120);
    }
    if (patch.documentType !== undefined) {
      if (!documentTypes.some((d) => d.value === patch.documentType)) throw new ActionError("Tipo de documento no válido.");
      row.document_type = patch.documentType;
    }
    if (patch.documentNumber !== undefined) row.document_number = clip(patch.documentNumber, 30).replace(/[^0-9A-Za-z-]/g, "");
    if (patch.email !== undefined) {
      const email = clip(patch.email, 120).toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ActionError("El correo no es válido.");
      row.email = email;
    }
    if (patch.city !== undefined) row.city = clip(patch.city, 80);
    if (patch.address !== undefined) row.address = clip(patch.address, 200);
    if (patch.neighborhood !== undefined) row.neighborhood = clip(patch.neighborhood, 80);
    if (patch.birthday !== undefined) {
      if (patch.birthday && !/^\d{4}-\d{2}-\d{2}$/.test(patch.birthday)) throw new ActionError("La fecha de cumpleaños no es válida.");
      row.birthday = patch.birthday || null;
    }
    if (patch.tags !== undefined) {
      row.tags = [...new Set(patch.tags.map((t) => clip(t, 30)).filter(Boolean))].slice(0, 10);
    }
    if (patch.notes !== undefined) row.notes = clip(patch.notes, 2000);
    const { error } = await admin.from("customers").update(row).eq("id", id);
    if (error) throw error;
    return null;
  });
}

/* ---------------- Cobro de pedidos ---------------- */

export async function updateOrderCharges(
  accessToken: string,
  input: { orderId: string; shippingCost: number; discount: number },
): Promise<Result<null>> {
  return run(async () => {
    const { admin } = await requireRole(accessToken, [...STAFF]);
    const shipping = Math.round(Number(input.shippingCost));
    const discount = Math.round(Number(input.discount));
    if (!(shipping >= 0) || !(discount >= 0) || shipping > 10_000_000 || discount > 100_000_000) {
      throw new ActionError("Revisa el valor del envío y del descuento.");
    }
    const { data: o, error: gErr } = await admin.from("orders").select("subtotal").eq("id", input.orderId).maybeSingle();
    if (gErr) throw gErr;
    if (!o) throw new ActionError("El pedido no existe.");
    if (discount > o.subtotal + shipping) throw new ActionError("El descuento no puede ser mayor que el valor del pedido.");
    const { error } = await admin.from("orders").update({ shipping_cost: shipping, discount }).eq("id", input.orderId);
    if (error) throw error;
    return null;
  });
}

export async function addPayment(
  accessToken: string,
  input: { orderId: string; amount: number; paidAt: string; method: string; reference: string; notes?: string },
): Promise<Result<Payment>> {
  return run(async () => {
    const { admin, myEmail } = await requireRole(accessToken, [...STAFF]);
    const amount = Math.round(Number(input.amount));
    if (!(amount > 0) || amount > 100_000_000) throw new ActionError("Escribe el valor del pago.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidAt)) throw new ActionError("Elige la fecha del pago.");
    const { data: o, error: gErr } = await admin.from("orders").select("status").eq("id", input.orderId).maybeSingle();
    if (gErr) throw gErr;
    if (!o) throw new ActionError("El pedido no existe.");
    if (o.status === "cancelado") throw new ActionError("No se pueden registrar pagos en un pedido cancelado.");
    const { data, error } = await admin
      .from("order_payments")
      .insert({
        order_id: input.orderId,
        amount,
        paid_at: input.paidAt,
        method: clip(input.method, 40),
        reference: clip(input.reference, 80),
        notes: clip(input.notes, 300),
        created_by: myEmail,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toPayment(data);
  });
}

export async function deletePayment(accessToken: string, paymentId: string): Promise<Result<null>> {
  return run(async () => {
    const { admin } = await requireRole(accessToken, [...STAFF]);
    const { error } = await admin.from("order_payments").delete().eq("id", paymentId);
    if (error) throw error;
    return null;
  });
}

/* ---------------- Cartera ---------------- */

export type ReceivableRow = {
  orderId: string;
  number: number;
  status: OrderStatus;
  createdAt: string;
  dispatchedAt: string | null;
  days: number | null; // días desde el despacho
  bucket: AgingBucket;
  customerId: string | null;
  customerName: string;
  phone: string;
  total: number;
  paid: number;
  balance: number;
};

export type Receivables = {
  rows: ReceivableRow[];
  buckets: Record<AgingBucket, { count: number; balance: number }>;
  total: number;
  overdue: number; // saldo de pedidos ya despachados
};

/** Pedidos confirmados o despachados con saldo pendiente, por antigüedad desde el despacho. */
export async function getReceivables(accessToken: string): Promise<Result<Receivables>> {
  return run(async () => {
    const { admin } = await requireRole(accessToken, [...STAFF]);
    const { data, error } = await admin
      .from("orders")
      .select("*")
      .in("status", receivableStatuses)
      .order("created_at", { ascending: true })
      .limit(5000);
    if (error) throw error;
    const orders = data as OrderRow[];
    const payments = await paymentsByOrder(admin, orders.map((o) => o.id));
    const ids = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))] as string[];
    const phones = new Map<string, string>();
    if (ids.length) {
      const { data: cs, error: cErr } = await admin.from("customers").select("id, phone, name").in("id", ids);
      if (cErr) throw cErr;
      for (const c of cs ?? []) phones.set(c.id, c.phone);
    }

    const buckets = Object.fromEntries(
      (["por-entregar", "0-30", "31-60", "61-90", "90+"] as AgingBucket[]).map((b) => [b, { count: 0, balance: 0 }]),
    ) as Receivables["buckets"];
    const rows: ReceivableRow[] = [];
    for (const r of orders) {
      const f = financeOf(r, payments.get(r.id) ?? []);
      if (f.balance <= 0) continue;
      const bucket = agingBucket(r.status, f.dispatchedAt);
      buckets[bucket].count++;
      buckets[bucket].balance += f.balance;
      rows.push({
        orderId: r.id,
        number: r.number,
        status: r.status,
        createdAt: r.created_at,
        dispatchedAt: f.dispatchedAt,
        days: daysSince(f.dispatchedAt),
        bucket,
        customerId: f.customerId,
        customerName: r.customer_name,
        phone: (f.customerId && phones.get(f.customerId)) || r.customer_phone.replace(/\D/g, ""),
        total: f.total,
        paid: f.paid,
        balance: f.balance,
      });
    }
    // Más antiguos primero: son los que hay que cobrar antes
    rows.sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
    const total = rows.reduce((s, r) => s + r.balance, 0);
    return { rows, buckets, total, overdue: total - buckets["por-entregar"].balance };
  });
}
