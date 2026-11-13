"use client";

import { useRef, useState } from "react";
import { ProductImage } from "./product-image";
import { variantGallery } from "@/lib/types";
import { useVariant } from "./variant-context";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const list = images.length ? images : [""];

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function goTo(i: number) {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div>
      <div className="relative">
        <div
          ref={scroller}
          onScroll={onScroll}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        >
          {list.map((src, i) => (
            <div key={i} className="w-full shrink-0 snap-center">
              <ProductImage
                src={src}
                alt={`${name} — foto ${i + 1}`}
                priority={i === 0}
                sizes="(min-width: 768px) 55vw, 100vw"
              />
            </div>
          ))}
        </div>
        {list.length > 1 && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2 md:hidden">
            {list.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Ver foto ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-ink" : "w-1.5 bg-ink/30"}`}
              />
            ))}
          </div>
        )}
      </div>
      {list.length > 1 && (
        <div className="mt-3 hidden gap-3 md:flex">
          {list.map((src, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`w-20 border transition ${i === index ? "border-ink" : "border-transparent opacity-70"}`}
            >
              <ProductImage src={src} alt="" sizes="80px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Galería del color elegido en la ficha del producto. */
export function VariantGallery() {
  const { product, variant } = useVariant();
  const images = variantGallery(product, variant);
  const name = product.variants.length > 1 ? `${product.name} ${variant.color}` : product.name;
  return <ProductGallery key={variant.id} images={images} name={name} />;
}
