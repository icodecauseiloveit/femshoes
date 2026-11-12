import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopGrid } from "@/components/shop-grid";
import { getCategories, getProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Tienda",
  description: "Tacones, sandalias, botas, planos y tenis premium para mujer.",
};

export default async function ShopPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  return (
    <Suspense fallback={<div className="min-h-[70vh]" />}>
      <ShopGrid products={products} categories={categories} />
    </Suspense>
  );
}
