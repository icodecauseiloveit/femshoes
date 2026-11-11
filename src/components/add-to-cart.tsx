"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { store } from "@/lib/config";
import { totalStock, type Product } from "@/lib/types";
import { useCart } from "./cart-provider";
import { WhatsAppIcon } from "./icons";

export function AddToCart({ product }: { product: Product }) {
  const { add } = useCart();
  const [size, setSize] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const sizesRef = useRef<HTMLDivElement>(null);
  const soldOut = totalStock(product) === 0;
  const selected = product.sizes.find((s) => s.size === size);
  const color = product.colors[0]?.name ?? "";

  function handleAdd() {
    if (!selected) {
      setError(true);
      sizesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      size: selected.size,
      color,
      image: product.images[0] ?? "",
      maxQty: selected.stock,
    });
  }

  const askText = encodeURIComponent(
    `Hola ${store.name}, quiero información sobre ${product.name}${size ? ` en talla ${size}` : ""}.`,
  );

  return (
    <div className="mt-6">
      {product.colors.length > 0 && (
        <div className="mb-5">
          <p className="eyebrow mb-2">
            Color: <span className="normal-case tracking-normal text-ink-soft">{product.colors.map((c) => c.name).join(", ")}</span>
          </p>
          <div className="flex gap-2">
            {product.colors.map((c) => (
              <span key={c.name} className="size-7 rounded-full ring-1 ring-black/15 ring-offset-2 ring-offset-ivory" style={{ background: c.hex }} />
            ))}
          </div>
        </div>
      )}

      <div ref={sizesRef} className="mb-2 flex scroll-mt-24 items-center justify-between">
        <p className={`eyebrow ${error ? "text-sale" : ""}`}>
          {error ? "Selecciona tu talla" : `Talla${size ? `: ${size}` : ""}`}
        </p>
        <Link href="/guia-de-tallas" className="text-xs text-muted underline underline-offset-4">
          Guía de tallas
        </Link>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {product.sizes.map((s) => {
          const out = s.stock === 0;
          return (
            <button
              key={s.size}
              disabled={out}
              onClick={() => {
                setSize(s.size);
                setError(false);
              }}
              className={`relative h-12 border text-sm transition ${
                size === s.size
                  ? "border-ink bg-ink text-ivory"
                  : out
                    ? "border-line bg-transparent text-muted/60 line-through"
                    : error
                      ? "border-sale/60 bg-white"
                      : "border-line bg-white hover:border-ink"
              }`}
            >
              {s.size}
            </button>
          );
        })}
      </div>
      {selected && selected.stock <= 2 && (
        <p className="mt-2 text-xs text-sale">¡Solo quedan {selected.stock}!</p>
      )}

      {/* Botones fijos abajo en el celular */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line bg-ivory/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pr-20 backdrop-blur md:static md:mt-6 md:border-0 md:bg-transparent md:p-0 md:pr-0">
        <button onClick={handleAdd} disabled={soldOut} className="btn flex-1 bg-ink text-ivory hover:bg-ink-soft">
          {soldOut ? "Agotado" : "Agregar a la bolsa"}
        </button>
      </div>

      <a
        href={`https://wa.me/${store.whatsapp}?text=${askText}`}
        target="_blank"
        rel="noopener"
        className="btn mt-3 w-full border border-line bg-white text-ink-soft"
      >
        <WhatsAppIcon width={18} height={18} className="text-[#25D366]" /> Preguntar por WhatsApp
      </a>
    </div>
  );
}
