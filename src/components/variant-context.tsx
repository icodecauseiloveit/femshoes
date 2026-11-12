"use client";

import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { colorSlug, defaultVariant, findVariant, type Product, type ProductVariant } from "@/lib/types";

type VariantContextValue = {
  product: Product;
  variant: ProductVariant;
  select: (variantId: string) => void;
};

const VariantContext = createContext<VariantContextValue | null>(null);

/**
 * Color elegido en la ficha del producto. Se comparte entre la galería y el selector de
 * talla, y se refleja en la URL (?color=nude) para poder compartir el enlace de un color.
 */
export function VariantProvider({ product, children }: { product: Product; children: ReactNode }) {
  const [variantId, setVariantId] = useState(() => defaultVariant(product).id);

  // El color de la URL se lee en el navegador para que la página siga siendo estática
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("color");
    const v = findVariant(product, wanted);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v) setVariantId(v.id);
  }, [product]);

  function select(id: string) {
    const v = product.variants.find((x) => x.id === id);
    if (!v) return;
    setVariantId(id);
    const url = new URL(window.location.href);
    if (product.variants.length > 1) url.searchParams.set("color", colorSlug(v.color));
    window.history.replaceState(window.history.state, "", url);
  }

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  return <VariantContext value={{ product, variant, select }}>{children}</VariantContext>;
}

export function useVariant() {
  const ctx = use(VariantContext);
  if (!ctx) throw new Error("useVariant debe usarse dentro de VariantProvider");
  return ctx;
}
