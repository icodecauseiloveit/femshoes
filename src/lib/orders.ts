export const orderStatuses = [
  { value: "pendiente", label: "Pendiente" },
  { value: "confirmado", label: "Confirmado" },
  { value: "despachado", label: "Despachado" },
  { value: "cancelado", label: "Cancelado" },
] as const;

export type OrderStatus = (typeof orderStatuses)[number]["value"];

export function isOrderStatus(v: unknown): v is OrderStatus {
  return orderStatuses.some((s) => s.value === v);
}

export function statusLabel(s: string) {
  return orderStatuses.find((x) => x.value === s)?.label ?? s;
}

export type OrderItem = {
  productId: string;
  slug: string;
  name: string;
  image: string;
  size: number;
  color: string;
  qty: number;
  price?: number; // solo para superadmin/admin
};

export type OrderCustomer = {
  name: string;
  phone: string;
  city: string;
  address: string;
  neighborhood: string;
  payment: string;
  notes: string;
};

/** Pedido tal como lo ve cada rol: precios y datos de la clienta solo para superadmin/admin */
export type OrderView = {
  id: string;
  number: number;
  status: OrderStatus;
  createdAt: string;
  items: OrderItem[];
  totalPairs: number;
  subtotal?: number;
  customer?: OrderCustomer;
};

export function orderCode(n: number) {
  return `FS-${String(n).padStart(4, "0")}`;
}
