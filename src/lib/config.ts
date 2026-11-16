// Configuración general de la tienda. Edita estos valores para personalizarla.
export const store = {
  name: "ChuzChuz",
  tagline: "Calzado para toda la familia",
  description:
    "Calzado para mujeres, hombres, niñas y niños, hecho para acompañarte en cada paso. Envíos a toda Colombia.",
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

export type Category = { slug: string; label: string; sortOrder: number; active: boolean; code?: string };

/** Categorías de ejemplo (se usan mientras Supabase no esté conectado). En producción se editan en /admin. */
export const defaultCategories: Category[] = [
  { slug: "tacones", label: "Tacones", sortOrder: 1, active: true, code: "TAC" },
  { slug: "sandalias", label: "Sandalias", sortOrder: 2, active: true, code: "SAN" },
  { slug: "botas", label: "Botas", sortOrder: 3, active: true, code: "BOT" },
  { slug: "planos", label: "Planos", sortOrder: 4, active: true, code: "PLA" },
  { slug: "tenis", label: "Tenis", sortOrder: 5, active: true, code: "TEN" },
];

export type CategorySlug = string;

/** Todas las tallas que se pueden activar en /admin: de niños (20) a hombre (45). */
export const allSizes = Array.from({ length: 26 }, (_, i) => 20 + i);

/** Público de cada producto. Un producto puede tener varios (p. ej. tenis para mujeres y hombres). */
export const audiences = [
  { value: "mujeres", label: "Mujeres", sizes: [35, 40] },
  { value: "hombres", label: "Hombres", sizes: [38, 44] },
  { value: "ninas", label: "Niñas", sizes: [24, 34] },
  { value: "ninos", label: "Niños", sizes: [24, 34] },
] as const;
export type Audience = (typeof audiences)[number]["value"];

export function isAudience(v: unknown): v is Audience {
  return audiences.some((a) => a.value === v);
}
export function audienceLabel(v: string) {
  return audiences.find((a) => a.value === v)?.label ?? v;
}

/** Tallas y pares que trae cada color nuevo en /admin (editables). */
export const defaultSizes = [35, 36, 37, 38, 39, 40];
export const defaultStock = 20;

/** Tallas iniciales según el público marcado: el rango que cubre a todos (sin público, 35 a 40). */
export function defaultSizesFor(list: readonly string[]): number[] {
  const ranges = audiences.filter((a) => list.includes(a.value)).map((a) => a.sizes);
  if (!ranges.length) return defaultSizes;
  const from = Math.min(...ranges.map((r) => r[0]));
  const to = Math.max(...ranges.map((r) => r[1]));
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export function categoryLabel(slug: string, list: Category[] = defaultCategories) {
  return list.find((c) => c.slug === slug)?.label ?? slug;
}
