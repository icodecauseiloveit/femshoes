"use server";

import { updateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog";
import {
  isOrderStatus,
  type OrderItem,
  type OrderStatus,
  type OrderView,
} from "@/lib/orders";
import { ActionError, requireRole, run, type Result } from "@/lib/staff-auth";

type OrderRow = {
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

    return (data as OrderRow[]).map((r): OrderView => {
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
