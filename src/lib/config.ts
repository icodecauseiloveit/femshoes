// Configuración general de la tienda. Edita estos valores para personalizarla.
export const store = {
  name: "FemShoes",
  tagline: "Calzado femenino premium",
  description:
    "Calzado femenino premium hecho para acompañarte con elegancia. Tacones, sandalias, botas, planos y tenis con envíos a toda Colombia.",
  // Número que recibe los pedidos (formato internacional, solo dígitos)
  whatsapp: "573004934732",
  whatsappDisplay: "+57 300 493 4732",
  instagram: "",
  currency: "COP",
  country: "Colombia",
  // Envío gratis a partir de este valor (COP). Pon 0 para desactivar.
  freeShippingFrom: 300000,
  paymentMethods: ["Transferencia bancaria", "Nequi", "Daviplata", "Pago contra entrega"],
} as const;

export type Category = { slug: string; label: string; sortOrder: number; active: boolean };

/** Categorías de ejemplo (se usan mientras Supabase no esté conectado). En producción se editan en /admin. */
export const defaultCategories: Category[] = [
  { slug: "tacones", label: "Tacones", sortOrder: 1, active: true },
  { slug: "sandalias", label: "Sandalias", sortOrder: 2, active: true },
  { slug: "botas", label: "Botas", sortOrder: 3, active: true },
  { slug: "planos", label: "Planos", sortOrder: 4, active: true },
  { slug: "tenis", label: "Tenis", sortOrder: 5, active: true },
];

export type CategorySlug = string;

export const allSizes = [34, 35, 36, 37, 38, 39, 40, 41];

export function categoryLabel(slug: string, list: Category[] = defaultCategories) {
  return list.find((c) => c.slug === slug)?.label ?? slug;
}
