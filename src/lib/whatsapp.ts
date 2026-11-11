import type { CartItem } from "@/components/cart-provider";
import { store } from "./config";
import { formatCOP } from "./format";

export type CustomerData = {
  name: string;
  phone: string;
  city: string;
  address: string;
  neighborhood: string;
  payment: string;
  notes: string;
};

/** Construye el mensaje de pedido que se envía por WhatsApp. */
export function buildOrderMessage(items: CartItem[], customer: CustomerData) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const freeShipping = store.freeShippingFrom > 0 && subtotal >= store.freeShippingFrom;

  const lines = [
    `Hola ${store.name}, quiero hacer este pedido:`,
    "",
    ...items.map(
      (i, n) =>
        `${n + 1}. ${i.name}\n   Talla ${i.size}${i.color ? ` · ${i.color}` : ""} · Cant. ${i.qty} · ${formatCOP(i.price * i.qty)}`,
    ),
    "",
    `Subtotal: ${formatCOP(subtotal)}`,
    `Envío: ${freeShipping ? "Gratis" : "Por confirmar"}`,
    "",
    "Datos de envío:",
    `Nombre: ${customer.name}`,
    `Celular: ${customer.phone}`,
    `Ciudad: ${customer.city}`,
    `Dirección: ${customer.address}${customer.neighborhood ? `, barrio ${customer.neighborhood}` : ""}`,
    `Pago: ${customer.payment}`,
  ];
  if (customer.notes.trim()) lines.push(`Notas: ${customer.notes.trim()}`);
  return lines.join("\n");
}

export function whatsappUrl(message: string) {
  return `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(message)}`;
}
