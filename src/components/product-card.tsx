"use client";

import Link from "next/link";
import { useState } from "react";
import { discountPercent, formatCOP } from "@/lib/format";
import { colorSlug, defaultVariant, totalStock, variantStock, type Product } from "@/lib/types";
import { ProductImage } from "./product-image";

const MAX_SWATCHES = 5;

/**
 * Tarjeta del catálogo. Los círculos de color cambian la foto y el enlace lleva a la
 * ficha con ese color elegido. `color` (slug) preselecciona un color, p. ej. al filtrar.
 */
export function ProductCard({ product, priority, color }: { product: Product; priority?: boolean; color?: string }) {
  const [variantId, setVariantId] = useState(() => defaultVariant(product, color).id);
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const multiColor = product.variants.length > 1;

  const off = discountPercent(product.price, product.compareAtPrice);
  const soldOut = totalStock(product) === 0;
  const href = multiColor ? `/producto/${product.slug}?color=${colorSlug(variant.color)}` : `/producto/${product.slug}`;
  const image = variant.images[0] ?? product.images[0];
  const extra = product.variants.length - MAX_SWATCHES;

  return (
    <div className="group">
      <Link href={href} className="block">
        <div className="relative">
          <ProductImage
            src={image}
            alt={multiColor ? `${product.name} ${variant.color}` : product.name}
            priority={priority}
            sizes="(min-width: 1024px) 25vw, 50vw"
            className="transition duration-500 group-hover:opacity-90"
          />
          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {product.isNew && <span className="eyebrow bg-ivory/90 px-2 py-1 text-[0.6rem]">Nuevo</span>}
            {off > 0 && <span className="eyebrow bg-sale px-2 py-1 text-[0.6rem] text-white">-{off}%</span>}
          </div>
          {soldOut ? (
            <span className="eyebrow absolute inset-x-0 bottom-0 bg-ink/80 py-2 text-center text-[0.6rem] text-white">
              Agotado
            </span>
          ) : (
            multiColor &&
            variantStock(variant) === 0 && (
              <span className="eyebrow absolute inset-x-0 bottom-0 bg-ivory/90 py-2 text-center text-[0.6rem]">
                Agotado en {variant.color}
              </span>
            )
          )}
        </div>
        <div className="mt-3 space-y-1 px-0.5">
          <h3 className="font-sans text-[0.92rem] font-normal leading-snug tracking-normal">{product.name}</h3>
          <p className="flex items-baseline gap-2 text-sm">
            <span className={off > 0 ? "text-sale" : ""}>{formatCOP(product.price)}</span>
            {off > 0 && <span className="text-xs text-muted line-through">{formatCOP(product.compareAtPrice!)}</span>}
          </p>
        </div>
      </Link>
      {product.variants.length > 0 && (
        <div className="flex items-center gap-1 px-0.5 pt-1.5">
          {product.variants.slice(0, MAX_SWATCHES).map((v) => {
            const active = v.id === variant.id;
            return multiColor ? (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariantId(v.id)}
                aria-label={`Ver en ${v.color}`}
                aria-pressed={active}
                title={v.color}
                // Área táctil cómoda en el celular con un círculo pequeño
                className="grid size-7 place-items-center"
              >
                <span
                  className={`size-3.5 rounded-full ring-offset-1 ring-offset-ivory ${active ? "ring-1 ring-ink" : "ring-1 ring-black/10"}`}
                  style={{ background: v.hex }}
                />
              </button>
            ) : (
              <span key={v.id} title={v.color} className="size-3 rounded-full ring-1 ring-black/10" style={{ background: v.hex }} />
            );
          })}
          {extra > 0 && <span className="text-xs text-muted">+{extra}</span>}
        </div>
      )}
    </div>
  );
}
