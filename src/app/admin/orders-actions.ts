"use server";

import { updateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog";
import {
  isOrderStatus,
  type OrderItem,
  type OrderStatus,
  type OrderView,
} from "@/lib/orders";
import type { Payment } from "@/lib/customers";
import { financeOf, paymentsByOrder } from "@/lib/order-finance";
import { ActionError, requireRole, run, type Result } from "@/lib/staff-auth";

export type OrderRow = {
  id: string;
  number: number;
  status: OrderStatus;
  created_at: string;
  items: OrderItem[];
  total_pairs: number;
  subtotal: number;
  customer_name: string;
  customer_phone: string;
  city: string;
  address: string;
  neighborhood: string;
  payment_method: string;
  notes: string;
  customer_id?: string | null;
  shipping_cost?: number;
  discount?: number;
  total?: number;
  dispatched_at?: string | null;
};

/**
 * Lista de pedidos según el rol:
 * - superadmin/admin: todos los estados, con precios y datos de la clienta.
 * - distribuidor: solo confirmados, sin precios ni datos personales.
 */
export async function listOrders(accessToken: string, status?: string): Promise<Result<OrderView[]>> {
  return run(async () => {
    const { admin, role } = await requireRole(accessToken, ["superadmin", "admin", "distribuidor"]);
    const full = role !== "distribuidor";
    // El distribuidor solo ve pedidos por despachar (confirmados) o ya despachados
    const wanted: OrderStatus | undefined = full
      ? isOrderStatus(status) ? status : undefined
      : status === "despachado" ? "despachado" : "confirmado";

    let query = admin
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (wanted) query = query.eq("status", wanted);

    const { data, error } = await query;
    if (error) throw error;
    const rows = data as OrderRow[];
    const payments = full ? await paymentsByOrder(admin, rows.map((r) => r.id)) : new Map<string, Payment[]>();

    return rows.map((r): OrderView => {
      const base: OrderView = {
        id: r.id,
        number: r.number,
        status: r.status,
        createdAt: r.created_at,
        totalPairs: r.total_pairs,
        items: r.items.map((i) =>
          full
            ? i
            : { productId: i.productId, sku: i.sku, slug: i.slug, name: i.name, image: i.image, size: i.size, color: i.color, qty: i.qty },
        ),
      };
      if (!full) return base;
      return {
        ...base,
        subtotal: r.subtotal,
        finance: financeOf(r, payments.get(r.id) ?? []),
        customer: {
          name: r.customer_name,
          phone: r.customer_phone,
          city: r.city,
          address: r.address,
          neighborhood: r.neighborhood,
          payment: r.payment_method,
          notes: r.notes,
        },
      };
    });
  });
}

/**
 * Cambia el estado de un pedido y ajusta el inventario (en la base de datos):
 * confirmar/despachar descuenta los pares; cancelar o volver a pendiente los devuelve.
 * El distribuidor solo puede pasar un pedido de Confirmado a Despachado.
 */
export async function updateOrderStatus(
  accessToken: string,
  input: { id: string; status: string },
): Promise<Result> {
  return run(async () => {
    const { admin, role } = await requireRole(accessToken, ["superadmin", "admin", "distribuidor"]);
    if (!isOrderStatus(input.status)) throw new ActionError("Estado no válido.");

    if (role === "distribuidor") {
      const { data: current } = await admin.from("orders").select("status").eq("id", input.id).maybeSingle();
      if (current?.status !== "confirmado" || input.status !== "despachado") {
        throw new ActionError("Solo puedes marcar como despachados los pedidos confirmados.");
      }
    }

    const { error } = await admin.rpc("set_order_status", { p_order_id: input.id, p_status: input.status });
    if (error) {
      if (/Stock insuficiente|ya no existe/i.test(error.message)) {
        throw new ActionError(`No se pudo confirmar. ${error.message}.`);
      }
      throw error;
    }
    // El inventario cambió: refrescar la tienda
    updateTag(CATALOG_TAG);
    return undefined;
  });
}

export type OrdersReportInput = { from: string; to: string; statuses: string[] };

export type OrdersReport = {
  from: string;
  to: string;
  statuses: OrderStatus[];
  generatedAt: string;
  generatedBy: string;
  orders: (OrderView & { subtotal: number; customer: NonNullable<OrderView["customer"]> })[];
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
// Las fechas del reporte se interpretan en hora de Colombia
const startOfDay = (d: string) => new Date(`${d}T00:00:00-05:00`);

/**
 * Pedidos para el reporte en PDF (solo superadmin y administrador):
 * rango de fechas (de creación del pedido, hora de Colombia) y estados elegidos.
 */
export async function getOrdersReport(accessToken: string, input: OrdersReportInput): Promise<Result<OrdersReport>> {
  return run(async () => {
    const { admin, myEmail } = await requireRole(accessToken, ["superadmin", "admin"]);
    const statuses = [...new Set((input.statuses ?? []).filter(isOrderStatus))];
    if (statuses.length === 0) throw new ActionError("Elige al menos un estado.");
    if (!DAY.test(input.from) || !DAY.test(input.to)) throw new ActionError("Elige las fechas del reporte.");
    const from = startOfDay(input.from);
    const toExclusive = new Date(startOfDay(input.to).getTime() + 24 * 3600 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(toExclusive.getTime()) || from >= toExclusive) {
      throw new ActionError("La fecha inicial debe ser anterior o igual a la final.");
    }
    if (toExclusive.getTime() - from.getTime() > 400 * 24 * 3600 * 1000) {
      throw new ActionError("El rango máximo del reporte es de un año.");
    }

    const { data, error } = await admin
      .from("orders")
      .select("*")
      .in("status", statuses)
      .gte("created_at", from.toISOString())
      .lt("created_at", toExclusive.toISOString())
      .order("created_at", { ascending: true })
      .limit(3000);
    if (error) throw error;

    return {
      from: input.from,
      to: input.to,
      statuses,
      generatedAt: new Date().toISOString(),
      generatedBy: myEmail,
      orders: (data as OrderRow[]).map((r) => ({
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
      })),
    };
  });
}
