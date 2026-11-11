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

export const categories = [
  { slug: "tacones", label: "Tacones" },
  { slug: "sandalias", label: "Sandalias" },
  { slug: "botas", label: "Botas" },
  { slug: "planos", label: "Planos" },
  { slug: "tenis", label: "Tenis" },
] as const;

export type CategorySlug = (typeof categories)[number]["slug"];

export const allSizes = [34, 35, 36, 37, 38, 39, 40, 41];

export function categoryLabel(slug: string) {
  return categories.find((c) => c.slug === slug)?.label ?? slug;
}
