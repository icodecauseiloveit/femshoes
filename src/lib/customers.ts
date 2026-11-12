import type { OrderStatus } from "./orders";

export const documentTypes = [
  { value: "", label: "Sin documento" },
  { value: "CC", label: "Cédula (CC)" },
  { value: "CE", label: "Cédula de extranjería (CE)" },
  { value: "NIT", label: "NIT" },
  { value: "PAS", label: "Pasaporte" },
] as const;

export const paymentMethods = ["Transferencia", "Nequi", "Daviplata", "Efectivo", "Tarjeta", "Otro"] as const;

/** Etiquetas sugeridas para segmentar clientas (se pueden escribir otras). */
export const suggestedTags = ["VIP", "Mayorista", "Revendedora", "Frecuente"];

export const INACTIVE_DAYS = 90;

export type Customer = {
  id: string;
  phone: string;
  name: string;
  documentType: string;
  documentNumber: string;
  email: string;
  city: string;
  address: string;
  neighborhood: string;
  birthday: string | null; // YYYY-MM-DD
  tags: string[];
  notes: string;
  marketingConsentAt: string | null;
  createdAt: string;
};

/** Indicadores comerciales de una clienta (pedidos cancelados no cuentan). */
export type CustomerStats = {
  orders: number; // pedidos no cancelados
  purchases: number; // confirmados + despachados
  purchased: number; // valor comprado (confirmados + despachados)
  avgTicket: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  daysSinceLast: number | null;
  balance: number; // saldo por cobrar (confirmados + despachados)
  overdue: number; // saldo de pedidos ya despachados (exigible)
};

export type CustomerSummary = Customer & { stats: CustomerStats };

export type Payment = {
  id: string;
  orderId: string;
  amount: number;
  paidAt: string; // YYYY-MM-DD
  method: string;
  reference: string;
  notes: string;
  createdBy: string;
};

export type PaymentState = "sin-pago" | "abonado" | "pagado" | "saldo-a-favor";

export function paymentState(total: number, paid: number): PaymentState {
  if (paid <= 0) return "sin-pago";
  if (paid < total) return "abonado";
  if (paid === total) return "pagado";
  return "saldo-a-favor";
}

export const paymentStateLabel: Record<PaymentState, string> = {
  "sin-pago": "Sin pago",
  abonado: "Abonado",
  pagado: "Pagado",
  "saldo-a-favor": "Saldo a favor",
};

/** Pedidos que suman a la cartera: confirmados (por entregar) y despachados (exigibles). */
export const receivableStatuses: OrderStatus[] = ["confirmado", "despachado"];

export type AgingBucket = "por-entregar" | "0-30" | "31-60" | "61-90" | "90+";

export const agingLabels: Record<AgingBucket, string> = {
  "por-entregar": "Por entregar",
  "0-30": "0 a 30 días",
  "31-60": "31 a 60 días",
  "61-90": "61 a 90 días",
  "90+": "Más de 90 días",
};

export function agingBucket(status: OrderStatus, dispatchedAt: string | null, now = Date.now()): AgingBucket {
  if (status !== "despachado" || !dispatchedAt) return "por-entregar";
  const days = Math.floor((now - new Date(dispatchedAt).getTime()) / 86_400_000);
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export function daysSince(iso: string | null, now = Date.now()) {
  return iso ? Math.floor((now - new Date(iso).getTime()) / 86_400_000) : null;
}

/** Celular solo con dígitos; a los celulares colombianos de 10 dígitos se les antepone 57 (igual que en la base de datos). */
export function normalizePhone(p: string) {
  const d = p.replace(/\D/g, "");
  return /^3\d{9}$/.test(d) ? `57${d}` : d;
}

/** Celular para mostrar: +57 300 123 4567 */
export function formatPhone(p: string) {
  const m = /^57(3\d{2})(\d{3})(\d{4})$/.exec(p);
  return m ? `+57 ${m[1]} ${m[2]} ${m[3]}` : `+${p}`;
}

export function whatsappLink(phone: string, text?: string) {
  return `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
