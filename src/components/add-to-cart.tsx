"use client";

import { useRef, useState } from "react";
import { store } from "@/lib/config";
import { modelSizes, totalStock, variantCover, variantStock } from "@/lib/types";
import { useCart } from "./cart-provider";
import { WhatsAppIcon } from "./icons";
import { SizeGuideModal } from "./size-guide-modal";
import { useVariant } from "./variant-context";

export function AddToCart() {
  const { add } = useCart();
  const { product, variant, select } = useVariant();
  const [size, setSize] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const sizesRef = useRef<HTMLDivElement>(null);

  const modelSoldOut = totalStock(product) === 0;
  const colorSoldOut = variantStock(variant) === 0;
  const stockOf = (s: number) => variant.sizes.find((x) => x.size === s)?.stock ?? 0;
  const selectedStock = size ? stockOf(size) : 0;
  const multiColor = product.variants.length > 1;

  function chooseColor(id: string) {
    select(id);
    const next = product.variants.find((v) => v.id === id);
    // Si la talla elegida no hay en el nuevo color, se suelta
    if (size && !(next?.sizes.find((x) => x.size === size)?.stock)) setSize(null);
  }

  function handleAdd() {
    if (!size || selectedStock === 0) {
      setError(true);
      sizesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    add({
      productId: product.id,
      variantId: variant.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      size,
      color: variant.color,
      image: variantCover(product, variant),
      maxQty: selectedStock,
    });
  }

  const askText = encodeURIComponent(
    `Hola ${store.name}, quiero información sobre ${product.name}` +
      `${multiColor ? ` en color ${variant.color}` : ""}${size ? ` talla ${size}` : ""}.`,
  );

  return (
    <div className="mt-6">
      <div className="mb-5">
        <p className="eyebrow mb-2">
          Color: <span className="normal-case tracking-normal text-ink-soft">{variant.color}</span>
          {multiColor && colorSoldOut && <span className="ml-2 normal-case tracking-normal text-sale">· Agotado</span>}
        </p>
        <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="Color">
          {product.variants.map((v) => {
            const active = v.id === variant.id;
            const out = variantStock(v) === 0;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${v.color}${out ? " (agotado)" : ""}`}
                title={v.color}
                disabled={!multiColor}
                onClick={() => chooseColor(v.id)}
                className={`relative size-9 overflow-hidden rounded-full ring-offset-2 ring-offset-white transition ${
                  active ? "ring-2 ring-ink" : "ring-1 ring-black/15"
                }`}
                style={{ background: v.hex }}
              >
                {out && (
                  <span aria-hidden className="absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-ink/70" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={sizesRef} className="mb-2 flex scroll-mt-24 items-center justify-between">
        <p className={`eyebrow ${error ? "text-sale" : ""}`}>
          {error ? "Selecciona tu talla" : `Talla${size ? `: ${size}` : ""}`}
        </p>
        <button type="button" onClick={() => setGuideOpen(true)} className="text-xs text-muted underline underline-offset-4">
          Guía de tallas
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {modelSizes(product).map((s) => {
          const out = stockOf(s) === 0;
          return (
            <button
              key={s}
              disabled={out}
              aria-label={`Talla ${s}${out ? " agotada" : ""}`}
              onClick={() => {
                setSize(s);
                setError(false);
              }}
              className={`relative h-12 border text-sm transition ${
                size === s && !out
                  ? "border-ink bg-ink text-white"
                  : out
                    ? "border-line bg-transparent text-muted/60 line-through"
                    : error
                      ? "border-sale/60 bg-white"
                      : "border-line-strong bg-white hover:border-ink"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
      <SizeGuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        color={variant.color}
        sizes={modelSizes(product)}
        stockOf={stockOf}
        selected={size}
        onSelect={(s) => {
          setSize(s);
          setError(false);
        }}
      />
      {size && selectedStock > 0 && selectedStock <= 2 && (
        <p className="mt-2 text-xs text-sale">
          {selectedStock === 1 ? "¡Último par!" : `¡Últimos ${selectedStock} pares!`}
        </p>
      )}
      {multiColor && colorSoldOut && !modelSoldOut && (
        <p className="mt-2 text-xs text-muted">Este color está agotado. Elige otro color disponible.</p>
      )}

      {/* Botones fijos abajo en el celular */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pr-20 backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:pr-0">
        <button onClick={handleAdd} disabled={colorSoldOut} className="btn flex-1 bg-ink text-white hover:bg-ink-soft">
          {modelSoldOut ? "Agotado" : colorSoldOut ? "Agotado en este color" : "Agregar a la bolsa"}
        </button>
      </div>

      <a
        href={`https://wa.me/${store.whatsapp}?text=${askText}`}
        target="_blank"
        rel="noopener"
        className="btn mt-3 w-full border border-line-strong bg-white text-ink-soft"
      >
        <WhatsAppIcon width={18} height={18} className="text-[#25D366]" /> Preguntar por WhatsApp
      </a>
    </div>
  );
}
