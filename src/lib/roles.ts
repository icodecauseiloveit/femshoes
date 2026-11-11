export const roles = [
  { value: "superadmin", label: "Superadmin", description: "Gestiona productos y usuarios" },
  { value: "admin", label: "Administrador", description: "Gestiona productos" },
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
