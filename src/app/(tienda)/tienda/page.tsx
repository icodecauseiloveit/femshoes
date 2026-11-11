import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopGrid } from "@/components/shop-grid";
import { getProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Tienda",
  description: "Tacones, sandalias, botas, planos y tenis premium para mujer.",
};

export default async function ShopPage() {
  const products = await getProducts();
  return (
    <Suspense fallback={<div className="min-h-[70vh]" />}>
      <ShopGrid products={products} />
    </Suspense>
  );
}
