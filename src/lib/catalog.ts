import { cacheLife, cacheTag } from "next/cache";
import { defaultCategories, type Category } from "./config";
import { sampleProducts } from "./sample-products";
import { getSupabase } from "./supabase";
import { fromRow, type Product, type ProductRow } from "./types";

export const CATALOG_TAG = "products";

/** Productos activos de la tienda. Usa Supabase si está configurado; si no, los de ejemplo. */
export async function getProducts(): Promise<Product[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");

  const supabase = getSupabase();
  if (!supabase) return sampleProducts;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error leyendo productos de Supabase:", error.message);
    return [];
  }
  return (data as ProductRow[]).map(fromRow);
}

export async function getProductBySlug(slug: string) {
  const products = await getProducts();
  return products.find((p) => p.slug === slug) ?? null;
}

type CategoryRow = { slug: string; label: string; sort_order: number; active: boolean };

/** Categorías visibles en la tienda, en el orden definido en /admin. */
export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheTag(CATALOG_TAG);
  cacheLife("hours");

  const supabase = getSupabase();
  if (!supabase) return defaultCategories;

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    // Antes de la migración 004 la tabla no existe: usar las categorías por defecto
    console.error("Error leyendo categorías:", error.message);
    return defaultCategories;
  }
  return (data as CategoryRow[]).map((r) => ({
    slug: r.slug,
    label: r.label,
    sortOrder: r.sort_order,
    active: r.active,
  }));
}
