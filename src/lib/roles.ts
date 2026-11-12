export const roles = [
  { value: "superadmin", label: "Superadmin", description: "Gestiona productos, pedidos y usuarios" },
  { value: "admin", label: "Administrador", description: "Gestiona productos y pedidos" },
  { value: "distribuidor", label: "Distribuidor", description: "Ve pedidos confirmados, descarga su PDF y los marca como despachados" },
] as const;

export type Role = (typeof roles)[number]["value"];

export type StaffMember = {
  email: string;
  role: Role;
  createdAt: string;
};

export function isRole(value: unknown): value is Role {
  return roles.some((r) => r.value === value);
}

export function roleLabel(role: string) {
  return roles.find((r) => r.value === role)?.label ?? role;
}

/** Qué secciones del panel ve cada rol */
export const permissions = {
  products: (r: Role) => r === "superadmin" || r === "admin",
  orders: () => true,
  manageOrders: (r: Role) => r === "superadmin" || r === "admin",
  customers: (r: Role) => r === "superadmin" || r === "admin",
  users: (r: Role) => r === "superadmin",
};
