"use server";

import { updateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog";
import type { OrderCustomer, OrderItem } from "@/lib/orders";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { fromRow, type ProductRow } from "@/lib/types";

/** Refresca el catálogo de la tienda después de guardar cambios en /admin. */
export async function refreshCatalog() {
  updateTag(CATALOG_TAG);
}

type CreateOrderInput = {
  items: { productId: string; size: number; qty: number }[];
  customer: OrderCustomer;
};

type CreateOrderResult =
  | { ok: true; number: number }
  | { ok: false; error: string; issues?: string[] };

const clip = (s: unknown, max: number) => String(s ?? "").trim().slice(0, max);

/**
 * Registra el pedido antes de enviarlo por WhatsApp.
 * Los nombres, precios y existencias se toman de la base de datos, no del navegador.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "not-configured" };

  try {
    const c = input.customer;
    const customer: OrderCustomer = {
      name: clip(c.name, 120),
      phone: clip(c.phone, 30),
      city: clip(c.city, 80),
      address: clip(c.address, 200),
      neighborhood: clip(c.neighborhood, 80),
      payment: clip(c.payment, 60),
      notes: clip(c.notes, 500),
    };
    if (!customer.name || !customer.phone || !customer.city || !customer.address) {
      return { ok: false, error: "Completa tus datos de envío." };
    }

    // Unir líneas repetidas (mismo producto y talla) para validar existencias correctamente
    const merged = new Map<string, { productId: string; size: number; qty: number }>();
    for (const i of input.items ?? []) {
      if (typeof i.productId !== "string" || !Number.isInteger(i.size) || !Number.isInteger(i.qty) || i.qty <= 0) continue;
      const key = `${i.productId}|${i.size}`;
      const prev = merged.get(key);
      merged.set(key, { productId: i.productId, size: i.size, qty: (prev?.qty ?? 0) + i.qty });
    }
    const lines = [...merged.values()];
    if (lines.length === 0 || lines.length > 30) return { ok: false, error: "Tu bolsa está vacía." };

    const ids = [...new Set(lines.map((l) => l.productId))];
    const { data, error } = await admin.from("products").select("*").in("id", ids).eq("active", true);
    if (error) throw error;
    const products = new Map((data as ProductRow[]).map((r) => [r.id, fromRow(r)]));

    const issues: string[] = [];
    const items: OrderItem[] = [];
    for (const l of lines) {
      const p = products.get(l.productId);
      if (!p) {
        issues.push("Un producto de tu bolsa ya no está disponible.");
        continue;
      }
      const stock = p.sizes.find((s) => s.size === l.size)?.stock ?? 0;
      if (stock < l.qty) {
        issues.push(
          stock === 0
            ? `${p.name} talla ${l.size} se agotó.`
            : `${p.name} talla ${l.size}: solo quedan ${stock}.`,
        );
        continue;
      }
      items.push({
        productId: p.id,
        slug: p.slug,
        name: p.name,
        image: p.images[0] ?? "",
        size: l.size,
        color: p.colors.map((x) => x.name).join(", "),
        qty: Math.min(l.qty, 20),
        price: p.price,
      });
    }
    if (issues.length) return { ok: false, error: "Revisa tu bolsa", issues };

    const totalPairs = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => s + i.qty * (i.price ?? 0), 0);

    const { data: row, error: insertError } = await admin
      .from("orders")
      .insert({
        customer_name: customer.name,
        customer_phone: customer.phone,
        city: customer.city,
        address: customer.address,
        neighborhood: customer.neighborhood,
        payment_method: customer.payment,
        notes: customer.notes,
        items,
        total_pairs: totalPairs,
        subtotal,
      })
      .select("number")
      .single();
    if (insertError) throw insertError;
    return { ok: true, number: row.number as number };
  } catch (e) {
    console.error("No se pudo registrar el pedido:", e);
    return { ok: false, error: "No se pudo registrar el pedido." };
  }
}
