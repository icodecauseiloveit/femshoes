import type { CategorySlug } from "./config";
import { slugify } from "./format";

export type SizeStock = { size: number; stock: number };
export type ProductColor = { name: string; hex: string };

/** Un color de un modelo: sus fotos y sus existencias por talla. */
export type ProductVariant = {
  id: string; // identificador corto y estable (no cambia si se renombra el color)
  color: string;
  hex: string;
  images: string[];
  sizes: SizeStock[];
};

/** Datos que se editan en /admin. */
export type ProductInput = {
  slug: string;
  name: string;
  category: CategorySlug;
  description: string;
  material: string;
  price: number; // COP, igual para todos los colores
  compareAtPrice: number | null; // precio antes del descuento
  variants: ProductVariant[];
  featured: boolean;
  isNew: boolean;
  active: boolean;
};

/**
 * Producto listo para mostrar. `colors`, `sizes` e `images` se calculan a partir de
 * las variantes (tallas sumadas entre colores, fotos del primer color primero).
 */
export type Product = ProductInput & {
  id: string;
  colors: ProductColor[];
  sizes: SizeStock[];
  images: string[];
};

// Fila tal como se guarda en Supabase (snake_case)
export type ProductRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  material: string | null;
  price: number;
  compare_at_price: number | null;
  colors: ProductColor[] | null;
  sizes: SizeStock[] | null;
  images: string[] | null;
  variants?: ProductVariant[] | null;
  featured: boolean;
  is_new: boolean;
  active: boolean;
};

export function newVariantId() {
  return Math.random().toString(36).slice(2, 10);
}

export const colorSlug = (name: string) => slugify(name);

const bySize = (a: SizeStock, b: SizeStock) => a.size - b.size;

/**
 * Productos guardados antes de las variantes: el primer color se queda con las fotos y
 * el inventario; los demás colores quedan con las mismas fotos y sin existencias.
 */
export function legacyVariants(colors: ProductColor[], sizes: SizeStock[], images: string[]): ProductVariant[] {
  const list = colors.length ? colors : [{ name: "Único", hex: "#141210" }];
  return list.map((c, i) => ({
    id: `v${i + 1}`,
    color: c.name || "Único",
    hex: c.hex || "#141210",
    images: [...images],
    sizes: (i === 0 ? sizes : sizes.map((s) => ({ size: s.size, stock: 0 }))).map((s) => ({ ...s })).sort(bySize),
  }));
}

function cleanVariant(v: ProductVariant): ProductVariant {
  return {
    id: String(v.id || newVariantId()),
    color: String(v.color ?? "").trim(),
    hex: v.hex || "#141210",
    images: (v.images ?? []).filter(Boolean),
    sizes: (v.sizes ?? [])
      .map((s) => ({ size: Number(s.size), stock: Math.max(0, Math.floor(Number(s.stock) || 0)) }))
      .sort(bySize),
  };
}

/** Calcula los campos resumidos (colores, tallas sumadas y fotos) a partir de las variantes. */
export function summarize(variants: ProductVariant[]) {
  const totals = new Map<number, number>();
  for (const v of variants) for (const s of v.sizes) totals.set(s.size, (totals.get(s.size) ?? 0) + s.stock);
  return {
    colors: variants.map((v) => ({ name: v.color, hex: v.hex })),
    sizes: [...totals].map(([size, stock]) => ({ size, stock })).sort(bySize),
    images: [...new Set(variants.flatMap((v) => v.images))],
  };
}

export function withSummary(p: ProductInput & { id: string }): Product {
  const variants = p.variants.map(cleanVariant);
  return { ...p, variants, ...summarize(variants) };
}

export function fromRow(r: ProductRow): Product {
  const variants = r.variants?.length
    ? r.variants
    : legacyVariants(r.colors ?? [], r.sizes ?? [], r.images ?? []);
  return withSummary({
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category as CategorySlug,
    description: r.description ?? "",
    material: r.material ?? "",
    price: r.price,
    compareAtPrice: r.compare_at_price,
    variants,
    featured: r.featured,
    isNew: r.is_new,
    active: r.active,
  });
}

export function toRow(p: ProductInput): Omit<ProductRow, "id"> {
  const variants = p.variants.map(cleanVariant);
  const { colors, sizes, images } = summarize(variants);
  return {
    slug: p.slug,
    name: p.name,
    category: p.category,
    description: p.description,
    material: p.material,
    price: p.price,
    compare_at_price: p.compareAtPrice,
    variants,
    // Columnas resumidas: se mantienen para búsquedas y compatibilidad
    colors,
    sizes,
    images,
    featured: p.featured,
    is_new: p.isNew,
    active: p.active,
  };
}

export function totalStock(p: { variants: ProductVariant[] }) {
  return p.variants.reduce((s, v) => s + variantStock(v), 0);
}

export function variantStock(v: ProductVariant) {
  return v.sizes.reduce((s, x) => s + x.stock, 0);
}

export function findVariant(p: Product, key: string | null | undefined) {
  if (!key) return undefined;
  return p.variants.find((v) => v.id === key) ?? p.variants.find((v) => colorSlug(v.color) === colorSlug(key));
}

/** Color que se muestra primero: el pedido en la URL o el primero con existencias. */
export function defaultVariant(p: Product, wanted?: string | null) {
  return findVariant(p, wanted) ?? p.variants.find((v) => variantStock(v) > 0) ?? p.variants[0];
}

/** Todas las tallas del modelo (unión entre colores), para que la cuadrícula no cambie de forma. */
export function modelSizes(p: Product) {
  return [...new Set(p.variants.flatMap((v) => v.sizes.map((s) => s.size)))].sort((a, b) => a - b);
}
