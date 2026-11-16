/**
 * Roles y permisos del panel.
 * Los roles se guardan en la tabla `roles` (se crean y editan desde el panel).
 * La lista de permisos debe coincidir con la de supabase/migrations/010_roles_personalizados.sql.
 */
export const permissionGroups = [
  {
    label: "Productos",
    items: [
      { key: "productos", label: "Crear y editar productos", hint: "Fotos, precios, colores, tallas e inventario" },
      { key: "productos_publicar", label: "Ocultar y publicar productos", hint: "Sin este permiso, lo que crea queda oculto" },
      { key: "productos_eliminar", label: "Eliminar productos" },
      { key: "categorias", label: "Gestionar categorías" },
    ],
  },
  {
    label: "Pedidos",
    items: [
      { key: "pedidos", label: "Gestionar pedidos", hint: "Ve precios y datos de la clienta, confirma, cancela, cobros y reporte PDF" },
      { key: "despachos", label: "Despachar pedidos", hint: "Solo pedidos confirmados, sin precios ni datos personales" },
    ],
  },
  {
    label: "Clientas",
    items: [
      { key: "clientas", label: "Clientas y cartera", hint: "Ficha de clientas, pagos y cuentas por cobrar" },
      { key: "clientas_eliminar", label: "Eliminar clientas", hint: "Borra la ficha; sus pedidos se conservan. Requiere Clientas y cartera" },
    ],
  },
] as const;

export type Permission = (typeof permissionGroups)[number]["items"][number]["key"];

/** Permisos que necesitan otro para tener sentido (p. ej. eliminar clientas exige ver clientas). */
export const permissionRequires: Partial<Record<Permission, Permission>> = {
  clientas_eliminar: "clientas",
};

export const allPermissions: Permission[] = permissionGroups.flatMap((g) => g.items.map((i) => i.key));

export function isPermission(v: unknown): v is Permission {
  return allPermissions.includes(v as Permission);
}

export function permissionLabel(p: string) {
  for (const g of permissionGroups) for (const i of g.items) if (i.key === p) return i.label;
  return p;
}

/** El superadmin es un rol del sistema: tiene todo y es el único que gestiona usuarios, roles e historial. */
export const SUPERADMIN = "superadmin";

export type Role = string;

export type RoleDef = {
  slug: string;
  name: string;
  description: string;
  permissions: Permission[];
  system: boolean;
  members?: number;
};

/** Lo que puede hacer la persona que tiene la sesión abierta. */
export type Access = {
  role: string;
  roleName: string;
  superadmin: boolean;
  permissions: Permission[];
};

export function can(access: Pick<Access, "superadmin" | "permissions">, p: Permission) {
  return access.superadmin || access.permissions.includes(p);
}

export type StaffMember = {
  email: string;
  role: Role;
  createdAt: string;
};

/** "Carga de productos" → "carga_de_productos" */
export function slugifyRole(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
