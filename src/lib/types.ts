import type { CategorySlug } from "./config";

export type SizeStock = { size: number; stock: number };
export type ProductColor = { name: string; hex: string };

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  description: string;
  material: string;
  price: number; // COP
  compareAtPrice: number | null; // precio antes del descuento
  colors: ProductColor[];
  sizes: SizeStock[];
  images: string[];
  featured: boolean;
  isNew: boolean;
  active: boolean;
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
  featured: boolean;
  is_new: boolean;
  active: boolean;
};

export function fromRow(r: ProductRow): Product {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    category: r.category as CategorySlug,
    description: r.description ?? "",
    material: r.material ?? "",
    price: r.price,
    compareAtPrice: r.compare_at_price,
    colors: r.colors ?? [],
    sizes: (r.sizes ?? []).sort((a, b) => a.size - b.size),
    images: r.images ?? [],
    featured: r.featured,
    isNew: r.is_new,
    active: r.active,
  };
}

export function toRow(p: Omit<Product, "id">): Omit<ProductRow, "id"> {
  return {
    slug: p.slug,
    name: p.name,
    category: p.category,
    description: p.description,
    material: p.material,
    price: p.price,
    compare_at_price: p.compareAtPrice,
    colors: p.colors,
    sizes: p.sizes,
    images: p.images,
    featured: p.featured,
    is_new: p.isNew,
    active: p.active,
  };
}

export function totalStock(p: Product) {
  return p.sizes.reduce((s, x) => s + x.stock, 0);
}
