import { cacheLife, cacheTag } from "next/cache";
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
